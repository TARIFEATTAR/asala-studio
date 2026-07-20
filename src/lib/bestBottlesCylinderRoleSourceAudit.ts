import { createHash } from "node:crypto";

export type CylinderRoleSourceRole = "identity-cap-on" | "pdp-cap-off-sidecar";

export interface CylinderRoleSourceAuditJob {
  jobId: string;
  jobType: string;
  canonicalIdentityKey: string;
  websiteSku: string;
  graceSku: string;
  role: CylinderRoleSourceRole;
  route: string;
  evidenceLane: string;
  sourceLocator: string;
  sourceSha256: string | null;
  referenceSha256: string;
  outputRelativePath: string;
  prompt: string;
  promptSha256: string;
  planSha256?: string;
}

export interface CylinderRoleSourceInvalidJob extends CylinderRoleSourceAuditJob {
  reason: "cross-lane-source-and-reference-reuse";
  pairedJobId: string;
}

export interface CylinderRoleSourceAuditResult {
  summary: {
    auditedJobCount: number;
    crossLaneSharedReferenceIdentityCount: number;
    invalidJobCount: number;
    validJobCount: number;
  };
  invalidJobs: CylinderRoleSourceInvalidJob[];
  validJobs: CylinderRoleSourceAuditJob[];
}

function sameEvidence(
  first: CylinderRoleSourceAuditJob,
  second: CylinderRoleSourceAuditJob,
): boolean {
  const sameNonEmpty = (firstValue: string | null, secondValue: string | null) => (
    Boolean(firstValue) && firstValue === secondValue
  );
  return sameNonEmpty(first.sourceLocator, second.sourceLocator)
    || sameNonEmpty(first.sourceSha256, second.sourceSha256)
    || sameNonEmpty(first.referenceSha256, second.referenceSha256);
}

export function auditCylinderRoleSourceJobs(
  jobs: readonly CylinderRoleSourceAuditJob[],
): CylinderRoleSourceAuditResult {
  const byIdentity = new Map<string, CylinderRoleSourceAuditJob[]>();
  for (const job of jobs) {
    const identityJobs = byIdentity.get(job.canonicalIdentityKey) ?? [];
    identityJobs.push(job);
    byIdentity.set(job.canonicalIdentityKey, identityJobs);
  }
  for (const [identity, identityJobs] of byIdentity) {
    for (const role of ["identity-cap-on", "pdp-cap-off-sidecar"] as const) {
      if (identityJobs.filter((job) => job.role === role).length > 1) {
        throw new Error(`More than one job exists for the same identity role: ${identity} / ${role}.`);
      }
    }
  }

  const invalidJobs: CylinderRoleSourceInvalidJob[] = [];
  const invalidJobIds = new Set<string>();
  let crossLaneSharedReferenceIdentityCount = 0;

  for (const identityJobs of byIdentity.values()) {
    const capOn = identityJobs.find((job) => job.role === "identity-cap-on");
    const sidecar = identityJobs.find((job) => job.role === "pdp-cap-off-sidecar");
    if (!capOn || !sidecar || !sameEvidence(capOn, sidecar)) continue;
    crossLaneSharedReferenceIdentityCount += 1;

    for (const [job, pairedJob] of [[capOn, sidecar], [sidecar, capOn]] as const) {
      invalidJobs.push({
        ...job,
        reason: "cross-lane-source-and-reference-reuse",
        pairedJobId: pairedJob.jobId,
      });
      invalidJobIds.add(job.jobId);
    }
  }

  const validJobs = jobs.filter((job) => !invalidJobIds.has(job.jobId));
  return {
    summary: {
      auditedJobCount: jobs.length,
      crossLaneSharedReferenceIdentityCount,
      invalidJobCount: invalidJobs.length,
      validJobCount: validJobs.length,
    },
    invalidJobs,
    validJobs,
  };
}

interface CylinderRoleSourceArtifactSource<T = unknown> {
  path: string;
  fileSha256: string;
  data: T;
}

interface CylinderRoleSourcePlanJob {
  jobId: string;
  jobType: string;
  targetRole: CylinderRoleSourceRole;
  sourceEvidenceLane: string;
}

interface RemediationPlanArtifact {
  sha256: string;
  rows: Array<{
    canonicalIdentityKey: string;
    websiteSku: string;
    graceSku: string;
    route: string;
    evidence: {
      sourceLocator: string;
      sourceSha256: string | null;
      referenceSha256: string;
    };
    roleJobs: CylinderRoleSourcePlanJob[];
  }>;
}

interface CompiledJobsArtifact {
  planSha256: string;
  planFileSha256: string;
  selectedJobCount: number;
  jobs: CylinderRoleSourceAuditJob[];
}

interface RoleAwareReadinessArtifact {
  rows: Array<{
    status: string;
    references: {
      identityCapOn: { publicUrl?: string | null; exportSha256?: string | null };
      pdpCapOffSidecar: { publicUrl?: string | null; exportSha256?: string | null };
    };
  }>;
}

interface PilotReviewArtifact {
  roles: Array<{
    jobId: string;
    role: CylinderRoleSourceRole;
    hashes: { outputSha256: string };
    png: { relativePath: string };
  }>;
}

interface JobCollectionArtifact {
  jobs: Array<{ jobId: string }>;
}

interface ScheduleArtifact {
  batches: Array<{ jobs: Array<{ jobId: string }> }>;
}

export interface CylinderRoleSourceDefectAuditInput {
  generatedAt: string;
  sources: {
    roleAwareReadiness: CylinderRoleSourceArtifactSource<RoleAwareReadinessArtifact>;
    remediationPlan: CylinderRoleSourceArtifactSource<RemediationPlanArtifact>;
    compiledJobs: CylinderRoleSourceArtifactSource<CompiledJobsArtifact>;
    pilotReview: CylinderRoleSourceArtifactSource<PilotReviewArtifact>;
    nextCohort: CylinderRoleSourceArtifactSource<JobCollectionArtifact>;
    fullSchedule: CylinderRoleSourceArtifactSource<ScheduleArtifact>;
    priorFullSchedule: CylinderRoleSourceArtifactSource<ScheduleArtifact>;
  };
  negativeEvidence: {
    path: string;
    sha256: string;
    width: number;
    height: number;
    userFinding: string;
  };
  invalidPilotPngDerivatives: Array<{
    path: string;
    sha256: string;
  }>;
}

export interface CylinderRolePlanCompilationReconciliation {
  status: "verified";
  semanticPlanSha256: string;
  planFileSha256: string;
  planJobCount: number;
  compiledJobCount: number;
  matchedJobCount: number;
  matchedEvidenceBindingJobCount: number;
  duplicatePlanJobIdCount: 0;
  duplicateCompiledJobIdCount: 0;
  duplicatePlanIdentityRoleCount: 0;
  duplicateCompiledIdentityRoleCount: 0;
}

export interface CylinderRoleSourceDefectAuditArtifact {
  version: "best-bottles-cylinder-role-source-defect-audit-v1";
  generatedAt: string;
  sha256: string;
  summary: {
    auditedJobCount: number;
    crossLaneSharedReferenceIdentityCount: number;
    invalidJobCount: number;
    validRoleSpecificJobCount: number;
    missingExactCapOnReferenceCount: number;
    missingExactSidecarReferenceCount: number;
    priorDistinctRolePairCount: number;
    quarantinedGeneratedOutputCount: number;
    affectedNextCohortJobCount: number;
    affectedScheduledJobCount: number;
    externalWriteCount: 0;
  };
  invalidJobCountsByRoute: Record<string, number>;
  invalidJobs: CylinderRoleSourceInvalidJob[];
  validRoleSpecificJobs: CylinderRoleSourceAuditJob[];
  roleBlockers: Array<{
    canonicalIdentityKey: string;
    missingRole: CylinderRoleSourceRole;
    blocker: "missing-exact-role-specific-reference";
  }>;
  quarantinedGeneratedOutputs: Array<{
    jobId: string;
    role: CylinderRoleSourceRole;
    relativePath: string;
    sha256: string;
    disposition: "quarantined-wrong-lane-source";
  }>;
  promptBindingAudit: {
    status: "verified-role-specific-v2-bindings";
    requiredJobCount: number;
    nonemptyPromptSha256Count: number;
    verifiedPromptByteSha256Count: number;
    missingPromptTextJobIds: string[];
    missingPromptSha256JobIds: string[];
    promptSha256MismatchJobIds: string[];
    sharedOppositeRolePromptSha256IdentityCount: number;
  };
  materialAuthorityAudit: {
    status: "not-explicitly-bound-in-v2";
    explicitRoleMaterialAuthorityCount: 0;
    requiredForReplacementPlan: true;
    statement: "The v2 compiled jobs contain prompt material language but no explicit role-specific material authority locator or SHA-256 binding.";
  };
  planCompilationReconciliation: CylinderRolePlanCompilationReconciliation;
  affectedDerivatives: Array<{
    kind: "pilot-review" | "next-cohort" | "full-execution-schedule";
    path: string;
    fileSha256: string;
    invalidJobIds: string[];
    disposition: "superseded-role-source-defect";
  }>;
  negativeEvidence: CylinderRoleSourceDefectAuditInput["negativeEvidence"] & {
    authority: "negative-supporting-evidence-only";
    productionReferenceEligible: false;
  };
  sources: Array<{ id: string; path: string; fileSha256: string }>;
  authorization: {
    externalWriteCount: 0;
    generationStatus: "blocked-for-invalid-role-source-jobs";
    promotionStatus: "blocked-for-invalid-role-source-jobs";
  };
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => (
      `${JSON.stringify(key)}:${stableJson(record[key])}`
    )).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value: unknown): string {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

function normalizedIdentity(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function duplicateCount(values: readonly string[]): number {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.values()].filter((count) => count > 1).length;
}

export function reconcileCylinderRolePlanAndCompilation(
  plan: RemediationPlanArtifact,
  compilation: CompiledJobsArtifact,
  actualPlanFileSha256: string,
): CylinderRolePlanCompilationReconciliation {
  const unsealedPlan = { ...plan } as Omit<RemediationPlanArtifact, "sha256"> & { sha256?: string };
  delete unsealedPlan.sha256;
  const semanticPlanSha256 = sha256(unsealedPlan);
  if (semanticPlanSha256 !== plan.sha256) {
    throw new Error("Remediation plan semantic SHA-256 does not match its embedded seal.");
  }
  if (compilation.planSha256 !== semanticPlanSha256) {
    throw new Error("Compilation plan SHA-256 crosses the sealed remediation plan.");
  }
  if (compilation.planFileSha256 !== actualPlanFileSha256) {
    throw new Error("Compilation plan file SHA-256 does not match the audited plan bytes.");
  }

  const planJobs = plan.rows.flatMap((row) => row.roleJobs.map((job) => ({ row, job })));
  const planJobIds = planJobs.map(({ job }) => job.jobId);
  const compiledJobIds = compilation.jobs.map((job) => job.jobId);
  const duplicatePlanJobIdCount = duplicateCount(planJobIds);
  const duplicateCompiledJobIdCount = duplicateCount(compiledJobIds);
  const duplicatePlanIdentityRoleCount = duplicateCount(planJobs.map(({ row, job }) => (
    `${row.canonicalIdentityKey}|${job.targetRole}`
  )));
  const duplicateCompiledIdentityRoleCount = duplicateCount(compilation.jobs.map((job) => (
    `${job.canonicalIdentityKey}|${job.role}`
  )));
  if (duplicatePlanJobIdCount > 0) throw new Error("Duplicate job IDs exist in the sealed remediation plan.");
  if (duplicateCompiledJobIdCount > 0) throw new Error("Duplicate job IDs exist in the compiled jobs.");
  if (compilation.selectedJobCount !== compilation.jobs.length) {
    throw new Error("Compilation selectedJobCount does not equal its compiled job count.");
  }
  if (planJobs.length !== compilation.jobs.length) {
    throw new Error("Compiled job count does not equal the sealed plan role-job count.");
  }

  const compiledById = new Map(compilation.jobs.map((job) => [job.jobId, job]));
  for (const { row, job: planJob } of planJobs) {
    const compiledJob = compiledById.get(planJob.jobId);
    if (!compiledJob) throw new Error(`Missing compiled job for sealed plan job ${planJob.jobId}.`);
    if (compiledJob.planSha256 !== semanticPlanSha256) {
      throw new Error(`${compiledJob.jobId} planSha256 crosses the sealed plan.`);
    }
    if (compiledJob.jobType !== planJob.jobType) {
      throw new Error(`${compiledJob.jobId} job type crosses sealed plan.`);
    }
    if (compiledJob.role !== planJob.targetRole) {
      throw new Error(`${compiledJob.jobId} role crosses sealed plan.`);
    }
    if (compiledJob.canonicalIdentityKey !== row.canonicalIdentityKey) {
      throw new Error(`${compiledJob.jobId} identity crosses sealed plan.`);
    }
    if (compiledJob.websiteSku !== row.websiteSku || compiledJob.graceSku !== row.graceSku) {
      throw new Error(`${compiledJob.jobId} SKU identity crosses sealed plan.`);
    }
    if (compiledJob.route !== row.route) {
      throw new Error(`${compiledJob.jobId} route crosses sealed plan.`);
    }
    if (compiledJob.evidenceLane !== planJob.sourceEvidenceLane) {
      throw new Error(`${compiledJob.jobId} evidence lane crosses sealed plan.`);
    }
    if (compiledJob.sourceLocator !== row.evidence.sourceLocator) {
      throw new Error(`${compiledJob.jobId} source locator crosses sealed plan evidence.`);
    }
    if (compiledJob.sourceSha256 !== row.evidence.sourceSha256) {
      throw new Error(`${compiledJob.jobId} source SHA-256 crosses sealed plan evidence.`);
    }
    if (compiledJob.referenceSha256 !== row.evidence.referenceSha256) {
      throw new Error(`${compiledJob.jobId} reference SHA-256 crosses sealed plan evidence.`);
    }
    const expectedIdentity = `${normalizedIdentity(row.websiteSku)}|${normalizedIdentity(row.graceSku)}`;
    if (row.canonicalIdentityKey !== expectedIdentity) {
      throw new Error(`${compiledJob.jobId} canonical identity key is not exact.`);
    }
  }
  const planIdSet = new Set(planJobIds);
  for (const jobId of compiledJobIds) {
    if (!planIdSet.has(jobId)) throw new Error(`Compiled job ${jobId} is not a sealed plan member.`);
  }
  if (duplicatePlanIdentityRoleCount > 0) {
    throw new Error("More than one sealed plan job exists for the same identity role.");
  }
  if (duplicateCompiledIdentityRoleCount > 0) {
    throw new Error("More than one compiled job exists for the same identity role.");
  }

  return {
    status: "verified",
    semanticPlanSha256,
    planFileSha256: actualPlanFileSha256,
    planJobCount: planJobs.length,
    compiledJobCount: compilation.jobs.length,
    matchedJobCount: compilation.jobs.length,
    matchedEvidenceBindingJobCount: compilation.jobs.length,
    duplicatePlanJobIdCount: 0,
    duplicateCompiledJobIdCount: 0,
    duplicatePlanIdentityRoleCount: 0,
    duplicateCompiledIdentityRoleCount: 0,
  };
}

function auditPromptBindings(jobs: readonly CylinderRoleSourceAuditJob[]) {
  const missingPromptTextJobIds = jobs
    .filter((job) => typeof job.prompt !== "string" || job.prompt.length === 0)
    .map((job) => job.jobId);
  const missingPromptSha256JobIds = jobs
    .filter((job) => !/^[a-f0-9]{64}$/i.test(job.promptSha256))
    .map((job) => job.jobId);
  const promptSha256MismatchJobIds = jobs
    .filter((job) => (
      typeof job.prompt === "string"
      && job.prompt.length > 0
      && /^[a-f0-9]{64}$/i.test(job.promptSha256)
      && createHash("sha256").update(job.prompt).digest("hex") !== job.promptSha256
    ))
    .map((job) => job.jobId);
  const byIdentity = new Map<string, CylinderRoleSourceAuditJob[]>();
  for (const job of jobs) {
    const identityJobs = byIdentity.get(job.canonicalIdentityKey) ?? [];
    identityJobs.push(job);
    byIdentity.set(job.canonicalIdentityKey, identityJobs);
  }
  const sharedOppositeRolePromptSha256IdentityCount = [...byIdentity.values()].filter((identityJobs) => {
    const capOn = identityJobs.find((job) => job.role === "identity-cap-on");
    const sidecar = identityJobs.find((job) => job.role === "pdp-cap-off-sidecar");
    return Boolean(
      capOn?.promptSha256
      && sidecar?.promptSha256
      && capOn.promptSha256 === sidecar.promptSha256,
    );
  }).length;
  if (missingPromptTextJobIds.length > 0 || missingPromptSha256JobIds.length > 0) {
    throw new Error("Every v2 role job requires prompt text and a nonempty prompt SHA-256 binding.");
  }
  if (promptSha256MismatchJobIds.length > 0) {
    throw new Error("Compiled prompt bytes do not match promptSha256.");
  }
  if (sharedOppositeRolePromptSha256IdentityCount > 0) {
    throw new Error("Opposite v2 roles must not share a prompt SHA-256 binding.");
  }
  return {
    status: "verified-role-specific-v2-bindings" as const,
    requiredJobCount: jobs.length,
    nonemptyPromptSha256Count: jobs.length,
    verifiedPromptByteSha256Count: jobs.length,
    missingPromptTextJobIds,
    missingPromptSha256JobIds,
    promptSha256MismatchJobIds,
    sharedOppositeRolePromptSha256IdentityCount,
  };
}

function countByRoute(jobs: readonly CylinderRoleSourceInvalidJob[]): Record<string, number> {
  const counts = new Map<string, number>();
  for (const job of jobs) counts.set(job.route, (counts.get(job.route) ?? 0) + 1);
  return Object.fromEntries([...counts.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

export function buildCylinderRoleSourceDefectAudit(
  input: CylinderRoleSourceDefectAuditInput,
): CylinderRoleSourceDefectAuditArtifact {
  const planCompilationReconciliation = reconcileCylinderRolePlanAndCompilation(
    input.sources.remediationPlan.data,
    input.sources.compiledJobs.data,
    input.sources.remediationPlan.fileSha256,
  );
  const promptBindingAudit = auditPromptBindings(input.sources.compiledJobs.data.jobs);
  const roleAudit = auditCylinderRoleSourceJobs(input.sources.compiledJobs.data.jobs);
  const invalidJobIds = new Set(roleAudit.invalidJobs.map((job) => job.jobId));
  const priorDistinctRolePairCount = input.sources.roleAwareReadiness.data.rows.filter((row) => {
    if (row.status !== "both-roles-verified") return false;
    const capOn = row.references.identityCapOn;
    const sidecar = row.references.pdpCapOffSidecar;
    return capOn.publicUrl !== sidecar.publicUrl && capOn.exportSha256 !== sidecar.exportSha256;
  }).length;

  const pilotInvalidJobIds = input.sources.pilotReview.data.roles
    .map((role) => role.jobId)
    .filter((jobId) => invalidJobIds.has(jobId));
  const nextInvalidJobIds = input.sources.nextCohort.data.jobs
    .map((job) => job.jobId)
    .filter((jobId) => invalidJobIds.has(jobId));
  const scheduledInvalidJobIds = input.sources.fullSchedule.data.batches
    .flatMap((batch) => batch.jobs)
    .map((job) => job.jobId)
    .filter((jobId) => invalidJobIds.has(jobId));

  const invalidPilotCapOn = input.sources.pilotReview.data.roles.find((role) => (
    role.role === "identity-cap-on" && invalidJobIds.has(role.jobId)
  ));
  if (!invalidPilotCapOn) throw new Error("The invalid pilot cap-on job is missing from the pilot review.");
  const quarantinedGeneratedOutputs = input.invalidPilotPngDerivatives
    .map((derivative) => ({
      jobId: invalidPilotCapOn.jobId,
      role: invalidPilotCapOn.role,
      relativePath: derivative.path,
      sha256: derivative.sha256,
      disposition: "quarantined-wrong-lane-source" as const,
    }));

  const roleBlockers = roleAudit.invalidJobs.map((job) => ({
    canonicalIdentityKey: job.canonicalIdentityKey,
    missingRole: job.role,
    blocker: "missing-exact-role-specific-reference" as const,
  }));
  const sources = Object.entries(input.sources).map(([id, source]) => ({
    id,
    path: source.path,
    fileSha256: source.fileSha256,
  }));
  const affectedDerivatives: CylinderRoleSourceDefectAuditArtifact["affectedDerivatives"] = [
    {
      kind: "pilot-review",
      path: input.sources.pilotReview.path,
      fileSha256: input.sources.pilotReview.fileSha256,
      invalidJobIds: pilotInvalidJobIds,
      disposition: "superseded-role-source-defect",
    },
    {
      kind: "next-cohort",
      path: input.sources.nextCohort.path,
      fileSha256: input.sources.nextCohort.fileSha256,
      invalidJobIds: nextInvalidJobIds,
      disposition: "superseded-role-source-defect",
    },
    {
      kind: "full-execution-schedule",
      path: input.sources.fullSchedule.path,
      fileSha256: input.sources.fullSchedule.fileSha256,
      invalidJobIds: scheduledInvalidJobIds,
      disposition: "superseded-role-source-defect",
    },
    {
      kind: "full-execution-schedule",
      path: input.sources.priorFullSchedule.path,
      fileSha256: input.sources.priorFullSchedule.fileSha256,
      invalidJobIds: input.sources.priorFullSchedule.data.batches
        .flatMap((batch) => batch.jobs)
        .map((job) => job.jobId)
        .filter((jobId) => invalidJobIds.has(jobId)),
      disposition: "superseded-role-source-defect",
    },
  ];

  const unsigned = {
    version: "best-bottles-cylinder-role-source-defect-audit-v1" as const,
    generatedAt: input.generatedAt,
    summary: {
      auditedJobCount: roleAudit.summary.auditedJobCount,
      crossLaneSharedReferenceIdentityCount: roleAudit.summary.crossLaneSharedReferenceIdentityCount,
      invalidJobCount: roleAudit.summary.invalidJobCount,
      validRoleSpecificJobCount: roleAudit.summary.validJobCount,
      missingExactCapOnReferenceCount: roleAudit.invalidJobs.filter((job) => job.role === "identity-cap-on").length,
      missingExactSidecarReferenceCount: roleAudit.invalidJobs.filter((job) => job.role === "pdp-cap-off-sidecar").length,
      priorDistinctRolePairCount,
      quarantinedGeneratedOutputCount: quarantinedGeneratedOutputs.length,
      affectedNextCohortJobCount: nextInvalidJobIds.length,
      affectedScheduledJobCount: scheduledInvalidJobIds.length,
      externalWriteCount: 0 as const,
    },
    invalidJobCountsByRoute: countByRoute(roleAudit.invalidJobs),
    invalidJobs: roleAudit.invalidJobs,
    validRoleSpecificJobs: roleAudit.validJobs,
    roleBlockers,
    quarantinedGeneratedOutputs,
    promptBindingAudit,
    materialAuthorityAudit: {
      status: "not-explicitly-bound-in-v2" as const,
      explicitRoleMaterialAuthorityCount: 0 as const,
      requiredForReplacementPlan: true as const,
      statement: "The v2 compiled jobs contain prompt material language but no explicit role-specific material authority locator or SHA-256 binding." as const,
    },
    planCompilationReconciliation,
    affectedDerivatives,
    negativeEvidence: {
      ...input.negativeEvidence,
      authority: "negative-supporting-evidence-only" as const,
      productionReferenceEligible: false as const,
    },
    sources,
    authorization: {
      externalWriteCount: 0 as const,
      generationStatus: "blocked-for-invalid-role-source-jobs" as const,
      promotionStatus: "blocked-for-invalid-role-source-jobs" as const,
    },
  };

  return { ...unsigned, sha256: sha256(unsigned) };
}
