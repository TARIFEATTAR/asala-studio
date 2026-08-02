import { createHash } from "node:crypto";

import type {
  CylinderDualRoleRemediationPlan,
  CylinderDualRoleRemediationRow,
  CylinderDualRoleRoute,
} from "./bestBottlesCylinderDualRoleRemediation";
import {
  computeCanonicalGeometrySha256,
  computeCanonicalProductTruthRecordSha256,
  computeCylinderDualRolePlanSha256,
  type CylinderDualRoleCanonicalProductTruthRow,
  type CylinderDualRoleCompiledJob,
} from "./bestBottlesCylinderDualRoleRunner";
import {
  buildCylinderNextCohortPreflight,
  serializeCylinderNextCohortPreflight,
  type CylinderNextCohortPreflightArtifact,
  type CylinderNextCohortReferenceInput,
} from "./bestBottlesCylinderNextCohortPreflight";
import { parseCsv } from "./bestBottlesGapWorklist";

export const BEST_BOTTLES_CYLINDER_FULL_EXECUTION_SCHEDULE_VERSION =
  "best-bottles-cylinder-full-execution-schedule-v1" as const;

export const CYLINDER_FULL_SCHEDULE_OUTPUT_CONTRACT = {
  format: "png",
  width: 2080,
  height: 2288,
  opaque: true,
} as const;

const PILOT_IDENTITY_KEY = "GBCYLBLU5SPRYBLKSH|GBCYLBLU5MLSPRSBLK";
const PILOT_WEBSITE_SKU = "GBCylBlu5SpryBlkSh";
const PILOT_GRACE_SKU = "GB-CYL-BLU-5ML-SPR-SBLK";
const RUNNER_COMMAND = "npx tsx scripts/best-bottles/run-cylinder-dual-role-remediation.ts";

const ROUTE_PRIORITY: Record<string, number> = {
  "approved-detached-dual-role": 0,
  "remediate-current-live-sidecar": 1,
  "approved-topology-exception": 2,
};

export interface CylinderFullScheduleFileInput<T> {
  path: string;
  actualFileSha256: string;
  document: T;
}

export interface CylinderFullScheduleReferenceProof {
  sourceLocator: string;
  resolvedLocalLocator: string;
  expectedSha256: string;
  actualSha256: string;
  verificationMode: "direct-local-locator-bytes" | "cached-local-byte-proof-for-sealed-https-locator";
}

export interface CylinderFullSchedulePilotOutputProof {
  jobId: string;
  resolvedLocalLocator: string;
  expectedSha256: string;
  actualSha256: string;
}

interface PilotRoleArtifact {
  websiteSku: string;
  graceSku: string;
  role: string;
  jobId: string;
  jobType: string;
  hashes: {
    promptSha256: string;
    canonicalGeometrySha256: string;
    outputSha256: string;
  };
  png: {
    relativePath: string;
    actualSha256: string;
    format: string;
    width: number;
    height: number;
    opaque: boolean;
  };
  machineStatus: string;
  reviewStatus: string;
  promotionStatus: string;
}

interface PilotArtifact {
  workflowVersion: string;
  inputSetSha256: string;
  identity: { websiteSku: string; graceSku: string; canonicalIdentityKey: string };
  plan: {
    semanticSha256: string;
    recomputedSemanticSha256: string;
    fileSha256: string;
    canonicalGeometrySha256: string;
  };
  roles: PilotRoleArtifact[];
  machineStatus: string;
  reviewStatus: string;
  humanVisualApproval: string;
  promotionStatus: string;
  externalWriteCount: number;
}

interface CompileAllArtifact {
  workflowVersion: string;
  mode: string;
  planSha256: string;
  planFileSha256: string;
  canonicalProductTruthFileSha256: string;
  selectedJobCount: number;
  jobs: CylinderDualRoleCompiledJob[];
  externalWriteCount: number;
}

export interface CylinderFullExecutionScheduleBuildInput {
  sealedRunPlanSha256: string;
  plan: CylinderFullScheduleFileInput<CylinderDualRoleRemediationPlan>;
  compileAll: CylinderFullScheduleFileInput<CompileAllArtifact>;
  pilot: CylinderFullScheduleFileInput<PilotArtifact>;
  nextCohort: CylinderFullScheduleFileInput<CylinderNextCohortPreflightArtifact>;
  canonicalProductTruth: {
    path: string;
    actualFileSha256: string;
    rawText: string;
    rows: CylinderDualRoleCanonicalProductTruthRow[];
  };
  references: CylinderFullScheduleReferenceProof[];
  pilotOutputProofs: CylinderFullSchedulePilotOutputProof[];
}

export interface CylinderFullScheduleJob {
  jobId: string;
  canonicalIdentityKey: string;
  websiteSku: string;
  graceSku: string;
  jobType: string;
  role: string;
  route: CylinderDualRoleRoute;
  evidenceLane: string;
  materialCohort: string;
  capacityMl: number;
  sourceLocator: string;
  resolvedLocalReferenceLocator: string;
  sourceSha256: string | null;
  referenceSha256: string;
  promptSha256: string;
  canonicalProductTruthRecordSha256: string;
  canonicalGeometrySha256: string;
  outputRelativePath: string;
  outputContract: typeof CYLINDER_FULL_SCHEDULE_OUTPUT_CONTRACT;
  generationStatus: "not-started";
  humanVisualApproval: "not-recorded";
  promotionStatus: "not-promoted";
}

export interface CylinderFullScheduleBatch {
  batchNumber: number;
  preparedFirstBatch: boolean;
  route: CylinderDualRoleRoute;
  materialCohorts: string[];
  evidenceLanes: string[];
  capacitiesMl: number[];
  canonicalGeometrySha256s: string[];
  identityCount: number;
  jobCount: number;
  jobs: CylinderFullScheduleJob[];
  command: string;
  commandStatus: "disabled-not-run";
  generationStatus: "not-started";
}

export interface CylinderFullExecutionScheduleArtifact {
  workflowVersion: typeof BEST_BOTTLES_CYLINDER_FULL_EXECUTION_SCHEDULE_VERSION;
  inputSetSha256: string;
  authority: {
    plan: { path: string; semanticSha256: string; recomputedSemanticSha256: string; fileSha256: string };
    compileAll: { path: string; fileSha256: string };
    pilotArtifact: { path: string; fileSha256: string; inputSetSha256: string };
    nextCohortArtifact: { path: string; fileSha256: string; inputSetSha256: string };
    canonicalProductTruth: { path: string; fileSha256: string };
    verifiedReferenceLocatorCount: number;
  };
  summary: {
    sealedRoleJobCount: 328;
    scheduledJobCount: 326;
    scheduledIdentityCount: 191;
    batchCount: number;
    blockerIdentityCount: 11;
    vialHandoffCount: 2;
    pilotRenderedJobCount: 2;
    routeJobCounts: Record<string, number>;
    routeIdentityCounts: Record<string, number>;
    batchJobCountDistribution: Record<string, number>;
  };
  pilot: {
    canonicalIdentityKey: typeof PILOT_IDENTITY_KEY;
    websiteSku: typeof PILOT_WEBSITE_SKU;
    graceSku: typeof PILOT_GRACE_SKU;
    disposition: "rendered-review-pending";
    jobs: Array<{ jobId: string; role: string; outputSha256: string; localOutputLocator: string; machineStatus: "pass" }>;
    humanVisualApproval: "not-recorded";
    promotionStatus: "not-promoted";
  };
  blockers: Array<{
    canonicalIdentityKey: string;
    websiteSku: string;
    graceSku: string;
    route: "hard-blocked-no-evidence";
    reasons: string[];
  }>;
  vialHandoffs: Array<{
    canonicalIdentityKey: string;
    websiteSku: string;
    graceSku: string;
    route: "routed-to-vial";
  }>;
  batches: CylinderFullScheduleBatch[];
  generationStatus: "not-started";
  humanVisualApproval: "not-recorded";
  promotionStatus: "not-promoted";
  externalWriteCount: 0;
}

function assertCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function sha256(value: Uint8Array | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function normalizedIdentity(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function exactIdentityKey(websiteSku: string, graceSku: string): string {
  return `${normalizedIdentity(websiteSku)}|${normalizedIdentity(graceSku)}`;
}

function assertSha(value: unknown, label: string): asserts value is string {
  assertCondition(typeof value === "string" && /^[a-f0-9]{64}$/.test(value), `${label} must be a SHA-256 hash.`);
}

function assertJsonFileSeal<T>(input: CylinderFullScheduleFileInput<T>, label: string): void {
  assertSha(input.actualFileSha256, `${label} actual file SHA`);
  const recomputed = sha256(`${JSON.stringify(input.document, null, 2)}\n`);
  assertCondition(recomputed === input.actualFileSha256, `${label} artifact file SHA mismatch; bytes or document mutated.`);
}

function rolePriority(role: string): number {
  return role === "identity-cap-on" ? 0 : role === "pdp-cap-off-sidecar" ? 1 : 99;
}

function materialCohort(row: CylinderDualRoleCanonicalProductTruthRow): string {
  const material = row.material.trim().toLowerCase();
  const finish = row.glassFinish.trim().toLowerCase();
  const color = row.color.trim().toLowerCase();
  if (material.includes("aluminum") || material.includes("aluminium")) return "brushed-aluminum";
  if (material.includes("plastic")) {
    if (color.includes("white")) return "white-plastic";
    if (color.includes("black")) return "black-plastic";
    if (finish.includes("frost") || color.includes("frost")) return "frosted-plastic";
    return "clear-plastic";
  }
  assertCondition(material.includes("glass"), `Unsupported material cohort ${row.material} for ${row.websiteSku}.`);
  if (finish.includes("frost") || color.includes("frost")) return "frosted-glass";
  if (finish.includes("cobalt") || color.includes("cobalt") || color.includes("blue")) return "cobalt-glass";
  if (finish.includes("amber") || color.includes("amber")) return "amber-glass";
  if (finish.includes("green") || color.includes("green")) return "green-glass";
  if (finish.includes("swirl") || finish.includes("flut")) return "swirl-glass";
  return "clear-glass";
}

function exactCanonicalRow(
  rows: CylinderDualRoleCanonicalProductTruthRow[],
  websiteSku: string,
  graceSku: string,
): CylinderDualRoleCanonicalProductTruthRow {
  const matches = rows.filter((row) => row.websiteSku === websiteSku && row.graceSku === graceSku);
  assertCondition(matches.length === 1, `Canonical product truth must contain exact record join ${websiteSku} + ${graceSku} once.`);
  return matches[0];
}

interface ValidatedAuthority {
  rowsByIdentity: Map<string, CylinderDualRoleRemediationRow>;
  jobsById: Map<string, CylinderDualRoleCompiledJob>;
  canonicalByIdentity: Map<string, CylinderDualRoleCanonicalProductTruthRow>;
  referenceByLocator: Map<string, CylinderFullScheduleReferenceProof>;
  pilotJobs: Set<string>;
  recomputedPlanSha256: string;
}

function validateAuthority(input: CylinderFullExecutionScheduleBuildInput): ValidatedAuthority {
  assertJsonFileSeal(input.plan, "Plan");
  assertJsonFileSeal(input.compileAll, "Compile-all");
  assertJsonFileSeal(input.pilot, "Pilot");
  assertJsonFileSeal(input.nextCohort, "Next-cohort");
  assertSha(input.sealedRunPlanSha256, "Sealed run plan SHA");
  assertSha(input.canonicalProductTruth.actualFileSha256, "Canonical product-truth file SHA");
  assertCondition(
    sha256(input.canonicalProductTruth.rawText) === input.canonicalProductTruth.actualFileSha256,
    "Canonical product-truth file SHA mismatch; bytes mutated.",
  );
  const reparsedCanonical = parseCsv(input.canonicalProductTruth.rawText).records;
  assertCondition(
    stableJson(reparsedCanonical) === stableJson(input.canonicalProductTruth.rows),
    "Canonical product-truth parsed rows do not match sealed file bytes.",
  );

  const plan = input.plan.document;
  const compile = input.compileAll.document;
  const recomputedPlanSha256 = computeCylinderDualRolePlanSha256(plan);
  assertCondition(
    recomputedPlanSha256 === plan.sha256 && plan.sha256 === input.sealedRunPlanSha256,
    "Recomputed semantic plan SHA does not match embedded or sealed run authority.",
  );
  assertCondition(
    compile.planSha256 === plan.sha256 && compile.planFileSha256 === input.plan.actualFileSha256,
    "Compile-all plan authority does not match exact sealed plan bytes.",
  );
  assertCondition(
    compile.canonicalProductTruthFileSha256 === input.canonicalProductTruth.actualFileSha256,
    "Compile-all canonical product-truth SHA does not match actual bytes.",
  );
  assertCondition(
    plan.authorization.remoteWrites === "forbidden" && plan.summary.externalWriteCount === 0 &&
      compile.mode === "compile-only" && compile.externalWriteCount === 0,
    "Authority must preserve compile-only mode and zero external writes.",
  );
  assertCondition(
    plan.summary.roleJobCount === 328 && compile.selectedJobCount === 328 && compile.jobs.length === 328,
    "Exact sealed population requires 328 compile-all jobs.",
  );

  const rowsByIdentity = new Map<string, CylinderDualRoleRemediationRow>();
  for (const row of plan.rows) {
    assertCondition(!rowsByIdentity.has(row.canonicalIdentityKey), `Duplicate plan identity ${row.canonicalIdentityKey}.`);
    assertCondition(
      row.canonicalIdentityKey === exactIdentityKey(row.websiteSku, row.graceSku),
      `Plan identity ${row.canonicalIdentityKey} crosses exact Website SKU + Grace SKU authority.`,
    );
    rowsByIdentity.set(row.canonicalIdentityKey, row);
  }
  const planJobs = plan.rows.flatMap((row) => row.roleJobs.map((job) => ({ row, job })));
  assertCondition(planJobs.length === 328, "Sealed plan role-job population must be exactly 328.");
  const planJobById = new Map(planJobs.map((entry) => [entry.job.jobId, entry]));
  assertCondition(planJobById.size === 328, "Duplicate role job in sealed plan population.");

  const referenceByLocator = new Map<string, CylinderFullScheduleReferenceProof>();
  for (const proof of input.references) {
    assertCondition(!referenceByLocator.has(proof.sourceLocator), `Duplicate reference proof for ${proof.sourceLocator}.`);
    assertSha(proof.expectedSha256, `${proof.sourceLocator} expected reference SHA`);
    assertSha(proof.actualSha256, `${proof.sourceLocator} actual reference SHA`);
    assertCondition(
      proof.expectedSha256 === proof.actualSha256,
      `Reference byte SHA mismatch for ${proof.sourceLocator}.`,
    );
    assertCondition(
      !proof.resolvedLocalLocator.startsWith("/") && !proof.resolvedLocalLocator.split(/[\\/]/).includes("..") &&
        !/^[a-z][a-z0-9+.-]*:\/\//i.test(proof.resolvedLocalLocator),
      `Reference byte proof for ${proof.sourceLocator} must resolve to a relative local locator.`,
    );
    referenceByLocator.set(proof.sourceLocator, proof);
  }

  const jobsById = new Map<string, CylinderDualRoleCompiledJob>();
  const canonicalByIdentity = new Map<string, CylinderDualRoleCanonicalProductTruthRow>();
  for (const job of compile.jobs) {
    assertCondition(!jobsById.has(job.jobId), `Duplicate compile-all job ${job.jobId}.`);
    const sealed = planJobById.get(job.jobId);
    assertCondition(sealed, `Extra compile-all job ${job.jobId} is outside the sealed population.`);
    const { row, job: roleJob } = sealed;
    assertCondition(
      job.canonicalIdentityKey === row.canonicalIdentityKey && job.websiteSku === row.websiteSku &&
        job.graceSku === row.graceSku && job.jobType === roleJob.jobType && job.role === roleJob.targetRole &&
        job.route === row.route && job.evidenceLane === roleJob.sourceEvidenceLane,
      `${job.jobId} crosses job identity, role, route, or evidence authority.`,
    );
    assertCondition(
      job.sourceLocator === row.evidence.sourceLocator && job.sourceSha256 === row.evidence.sourceSha256 &&
        job.referenceSha256 === row.evidence.referenceSha256,
      `${job.jobId} source/reference hashes or locator cross sealed authority.`,
    );
    assertCondition(job.planSha256 === plan.sha256, `${job.jobId} carries stale plan SHA.`);
    assertCondition(
      job.canonicalProductTruthFileSha256 === input.canonicalProductTruth.actualFileSha256,
      `${job.jobId} carries stale canonical product-truth file SHA.`,
    );
    assertCondition(
      typeof job.prompt === "string" && job.prompt.length > 0 && sha256(job.prompt) === job.promptSha256,
      `${job.jobId} prompt SHA does not match prompt text.`,
    );
    assertCondition(job.deterministicOperation === null && job.deterministicOperationSha256 === null, `${job.jobId} has an unexpected deterministic operation.`);
    assertCondition(
      computeCanonicalGeometrySha256(row.canonical) === job.canonicalGeometrySha256,
      `${job.jobId} canonical geometry SHA does not match the sealed plan row.`,
    );
    const canonical = exactCanonicalRow(input.canonicalProductTruth.rows, row.websiteSku, row.graceSku);
    assertCondition(
      computeCanonicalProductTruthRecordSha256(canonical) === job.canonicalProductTruthRecordSha256,
      `${job.jobId} canonical product-truth record SHA does not match exact joined row.`,
    );
    for (const field of ["canon_bodyHeightMm", "canon_heightWithCapMm", "canon_widthAxisMm", "canon_secondAxisMm"] as const) {
      assertCondition(
        String(row.canonical[field]).trim() === canonical[field].trim(),
        `${job.jobId} canonical product truth geometry ${field} crosses sealed plan authority.`,
      );
    }
    const proof = referenceByLocator.get(job.sourceLocator);
    assertCondition(proof, `Missing actual reference byte proof for ${job.sourceLocator}.`);
    assertCondition(proof.expectedSha256 === job.referenceSha256, `${job.jobId} reference byte proof crosses sealed hash.`);
    assertCondition(
      job.outputRelativePath === `outputs/${job.websiteSku.replace(/[^A-Za-z0-9._-]+/g, "_")}__${job.graceSku.replace(/[^A-Za-z0-9._-]+/g, "_")}__${job.role}.png` &&
        job.status === "compiled-dry-run" && job.reviewStatus === "review-pending",
      `${job.jobId} output contract or compile status is invalid.`,
    );
    jobsById.set(job.jobId, job);
    canonicalByIdentity.set(job.canonicalIdentityKey, canonical);
  }
  assertCondition(jobsById.size === planJobById.size, "Compile-all is missing one or more sealed jobs.");
  assertCondition(referenceByLocator.size === new Set(compile.jobs.map((job) => job.sourceLocator)).size, "Missing or extra reference locator byte proof.");

  const pilot = input.pilot.document;
  assertCondition(
    pilot.identity.canonicalIdentityKey === PILOT_IDENTITY_KEY && pilot.identity.websiteSku === PILOT_WEBSITE_SKU &&
      pilot.identity.graceSku === PILOT_GRACE_SKU,
    "Pilot artifact crosses the exact pilot identity.",
  );
  assertCondition(
    pilot.plan.semanticSha256 === plan.sha256 && pilot.plan.recomputedSemanticSha256 === recomputedPlanSha256 &&
      pilot.plan.fileSha256 === input.plan.actualFileSha256,
    "Pilot artifact plan authority is stale.",
  );
  assertCondition(
    pilot.machineStatus === "pass" && pilot.reviewStatus === "review-pending" &&
      pilot.humanVisualApproval === "not-recorded" && pilot.promotionStatus === "not-promoted" &&
      pilot.externalWriteCount === 0,
    "Pilot machine pass/review-pending/not-promoted authority is required.",
  );
  const pilotPlanRow = rowsByIdentity.get(PILOT_IDENTITY_KEY);
  assertCondition(pilotPlanRow && pilotPlanRow.roleJobs.length === 2, "Pilot identity must have two exact sealed role jobs.");
  assertCondition(pilot.roles.length === 2 && input.pilotOutputProofs.length === 2, "Pilot requires two exact rendered output proofs.");
  const pilotOutputByJob = new Map(input.pilotOutputProofs.map((proof) => [proof.jobId, proof]));
  const pilotJobs = new Set<string>();
  for (let index = 0; index < 2; index += 1) {
    const role = pilot.roles[index];
    const sealedRole = pilotPlanRow.roleJobs[index];
    const compiled = jobsById.get(sealedRole.jobId);
    const proof = pilotOutputByJob.get(role.jobId);
    assertCondition(
      role.jobId === sealedRole.jobId && role.jobType === sealedRole.jobType && role.role === sealedRole.targetRole &&
        role.websiteSku === PILOT_WEBSITE_SKU && role.graceSku === PILOT_GRACE_SKU,
      "Pilot role identity, type, or role order crosses sealed authority.",
    );
    assertCondition(compiled, `Pilot compiled job ${role.jobId} is missing.`);
    assertCondition(
      role.hashes.promptSha256 === compiled.promptSha256 &&
        role.hashes.canonicalGeometrySha256 === compiled.canonicalGeometrySha256 &&
        role.hashes.canonicalGeometrySha256 === pilot.plan.canonicalGeometrySha256,
      `Pilot role ${role.jobId} prompt or geometry SHA is stale.`,
    );
    assertCondition(
      role.machineStatus === "pass" && role.reviewStatus === "review-pending" && role.promotionStatus === "not-promoted",
      `Pilot role ${role.jobId} must preserve machine pass and not-promoted status.`,
    );
    assertCondition(
      role.png.format === "png" && role.png.width === 2080 && role.png.height === 2288 && role.png.opaque === true,
      `Pilot role ${role.jobId} output contract is invalid.`,
    );
    assertCondition(proof, `Pilot output proof ${role.jobId} is missing.`);
    assertCondition(
      proof.expectedSha256 === role.hashes.outputSha256 && proof.expectedSha256 === role.png.actualSha256 &&
        proof.actualSha256 === proof.expectedSha256,
      `Pilot output SHA mismatch for ${role.jobId}.`,
    );
    pilotJobs.add(role.jobId);
  }
  assertCondition(pilotJobs.size === 2 && pilotOutputByJob.size === 2, "Pilot output proofs contain duplicate or extra jobs.");

  const next = input.nextCohort.document;
  const nextReferences: CylinderNextCohortReferenceInput[] = next.identities.map((identity) => {
    const proof = referenceByLocator.get(identity.sourceReference.sourceLocator);
    assertCondition(proof, `Next cohort reference proof missing for ${identity.sourceReference.sourceLocator}.`);
    return {
      sourceLocator: proof.sourceLocator,
      actualSha256: proof.actualSha256,
      format: identity.sourceReference.format,
      width: identity.sourceReference.width,
      height: identity.sourceReference.height,
      opaque: identity.sourceReference.opaque,
    };
  });
  let rebuiltNext: CylinderNextCohortPreflightArtifact;
  try {
    rebuiltNext = buildCylinderNextCohortPreflight({
      sealedRunPlanSha256: input.sealedRunPlanSha256,
      plan: { document: plan, actualFileSha256: input.plan.actualFileSha256 },
      compileAll: {
        actualFileSha256: input.compileAll.actualFileSha256,
        document: { ...compile, jobs: next.jobs.map((nextJob) => {
          const compiled = jobsById.get(nextJob.jobId);
          assertCondition(compiled, `Next cohort job ${nextJob.jobId} is absent from compile-all.`);
          return compiled;
        }) },
      },
      canonicalProductTruth: {
        actualFileSha256: input.canonicalProductTruth.actualFileSha256,
        rows: input.canonicalProductTruth.rows,
      },
      references: nextReferences,
    });
  } catch (error) {
    throw new Error(`Next-cohort authority validation failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  assertCondition(
    serializeCylinderNextCohortPreflight(rebuiltNext) === serializeCylinderNextCohortPreflight(next),
    "Next-cohort artifact does not exactly match recomputed authority or job order.",
  );

  const blockers = plan.rows.filter((row) => row.route === "hard-blocked-no-evidence");
  const vials = plan.rows.filter((row) => row.route === "routed-to-vial");
  assertCondition(blockers.length === 11 && blockers.every((row) => row.roleJobs.length === 0 && row.blockers.length > 0), "Exactly 11 hard evidence blockers must remain outside the schedule.");
  assertCondition(vials.length === 2 && vials.every((row) => row.roleJobs.length === 0 && row.canonicalFamily === "Vial"), "Exactly two Vial handoffs must remain outside the Cylinder schedule.");

  return { rowsByIdentity, jobsById, canonicalByIdentity, referenceByLocator, pilotJobs, recomputedPlanSha256 };
}

interface IdentityUnit {
  identity: string;
  route: CylinderDualRoleRoute;
  materialCohort: string;
  capacityMl: number;
  geometrySha: string;
  evidenceLane: string;
  jobs: CylinderFullScheduleJob[];
}

function makeScheduledJob(
  compiled: CylinderDualRoleCompiledJob,
  row: CylinderDualRoleRemediationRow,
  canonical: CylinderDualRoleCanonicalProductTruthRow,
  proof: CylinderFullScheduleReferenceProof,
): CylinderFullScheduleJob {
  assertCondition(typeof compiled.promptSha256 === "string", `${compiled.jobId} is missing prompt SHA.`);
  return {
    jobId: compiled.jobId,
    canonicalIdentityKey: compiled.canonicalIdentityKey,
    websiteSku: compiled.websiteSku,
    graceSku: compiled.graceSku,
    jobType: compiled.jobType,
    role: compiled.role,
    route: compiled.route,
    evidenceLane: compiled.evidenceLane,
    materialCohort: materialCohort(canonical),
    capacityMl: Number(canonical.capacityMl),
    sourceLocator: compiled.sourceLocator,
    resolvedLocalReferenceLocator: proof.resolvedLocalLocator,
    sourceSha256: compiled.sourceSha256,
    referenceSha256: compiled.referenceSha256,
    promptSha256: compiled.promptSha256,
    canonicalProductTruthRecordSha256: compiled.canonicalProductTruthRecordSha256,
    canonicalGeometrySha256: compiled.canonicalGeometrySha256,
    outputRelativePath: compiled.outputRelativePath,
    outputContract: CYLINDER_FULL_SCHEDULE_OUTPUT_CONTRACT,
    generationStatus: "not-started",
    humanVisualApproval: "not-recorded",
    promotionStatus: "not-promoted",
  };
}

function cohortKey(unit: IdentityUnit): string {
  return [unit.route, unit.materialCohort, unit.geometrySha, unit.capacityMl, unit.evidenceLane].join("|");
}

function shellSingleQuote(value: string): string {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

function renderBatchCommand(jobs: CylinderFullScheduleJob[]): string {
  const allowlist = jobs.map((job) => job.jobId).join(",");
  return `${RUNNER_COMMAND} --execute --allowlist ${shellSingleQuote(allowlist)} --count ${jobs.length}`;
}

function makeBatch(batchNumber: number, units: IdentityUnit[], preparedFirstBatch: boolean): CylinderFullScheduleBatch {
  const jobs = units.flatMap((unit) => unit.jobs);
  const unique = <T>(values: T[]): T[] => Array.from(new Set(values));
  const command = renderBatchCommand(jobs);
  return {
    batchNumber,
    preparedFirstBatch,
    route: units[0].route,
    materialCohorts: unique(units.map((unit) => unit.materialCohort)),
    evidenceLanes: unique(units.map((unit) => unit.evidenceLane)),
    capacitiesMl: unique(units.map((unit) => unit.capacityMl)).sort((a, b) => a - b),
    canonicalGeometrySha256s: unique(units.map((unit) => unit.geometrySha)),
    identityCount: units.length,
    jobCount: jobs.length,
    jobs,
    command,
    commandStatus: "disabled-not-run",
    generationStatus: "not-started",
  };
}

function assembleArtifact(
  input: CylinderFullExecutionScheduleBuildInput,
  authority: ValidatedAuthority,
): CylinderFullExecutionScheduleArtifact {
  const scheduledRows = input.plan.document.rows.filter((row) => row.roleJobs.length > 0 && row.canonicalIdentityKey !== PILOT_IDENTITY_KEY);
  assertCondition(scheduledRows.length === 191, "Unpaid schedule must span exactly 191 identities after pilot exclusion.");
  const units = scheduledRows.map((row): IdentityUnit => {
    assertCondition(
      row.route === "approved-detached-dual-role" || row.route === "remediate-current-live-sidecar" || row.route === "approved-topology-exception",
      `Scheduled blocker/Vial or unsupported route ${row.route} detected.`,
    );
    const canonical = authority.canonicalByIdentity.get(row.canonicalIdentityKey);
    assertCondition(canonical, `Canonical product truth missing for scheduled identity ${row.canonicalIdentityKey}.`);
    const proof = authority.referenceByLocator.get(row.evidence.sourceLocator ?? "");
    assertCondition(proof, `Reference proof missing for scheduled identity ${row.canonicalIdentityKey}.`);
    const jobs = row.roleJobs.map((roleJob) => {
      const compiled = authority.jobsById.get(roleJob.jobId);
      assertCondition(compiled, `Compiled job ${roleJob.jobId} missing from scheduled identity.`);
      return makeScheduledJob(compiled, row, canonical, proof);
    }).sort((left, right) => rolePriority(left.role) - rolePriority(right.role));
    if (row.route === "remediate-current-live-sidecar") {
      assertCondition(jobs.length === 1 && jobs[0].role === "pdp-cap-off-sidecar", `${row.canonicalIdentityKey} current-live route must carry one sidecar role.`);
    } else {
      assertCondition(
        jobs.length === 2 && jobs[0].role === "identity-cap-on" && jobs[1].role === "pdp-cap-off-sidecar",
        `${row.canonicalIdentityKey} dual-role order must be identity-cap-on then pdp-cap-off-sidecar.`,
      );
    }
    return {
      identity: row.canonicalIdentityKey,
      route: row.route,
      materialCohort: jobs[0].materialCohort,
      capacityMl: jobs[0].capacityMl,
      geometrySha: jobs[0].canonicalGeometrySha256,
      evidenceLane: jobs[0].evidenceLane,
      jobs,
    };
  });

  const unitByIdentity = new Map(units.map((unit) => [unit.identity, unit]));
  const firstIdentities: IdentityUnit[] = [];
  for (const nextJob of input.nextCohort.document.jobs) {
    const unit = unitByIdentity.get(nextJob.canonicalIdentityKey);
    assertCondition(unit, `Batch 1 next-cohort identity ${nextJob.canonicalIdentityKey} is missing.`);
    if (!firstIdentities.includes(unit)) firstIdentities.push(unit);
  }
  assertCondition(firstIdentities.length === 4 && firstIdentities.flatMap((unit) => unit.jobs).length === 8, "Batch 1 requires exact four identities/eight jobs.");
  const expectedFirstIds = input.nextCohort.document.jobs.map((job) => job.jobId);
  assertCondition(
    stableJson(firstIdentities.flatMap((unit) => unit.jobs).map((job) => job.jobId)) === stableJson(expectedFirstIds),
    "Batch 1 must exactly equal the sealed next-cohort artifact order.",
  );
  const firstSet = new Set(firstIdentities.map((unit) => unit.identity));
  const remaining = units.filter((unit) => !firstSet.has(unit.identity)).sort((left, right) =>
    (ROUTE_PRIORITY[left.route] ?? 99) - (ROUTE_PRIORITY[right.route] ?? 99) ||
    left.materialCohort.localeCompare(right.materialCohort) ||
    left.geometrySha.localeCompare(right.geometrySha) ||
    left.capacityMl - right.capacityMl ||
    left.identity.localeCompare(right.identity)
  );

  const batches: CylinderFullScheduleBatch[] = [makeBatch(1, firstIdentities, true)];
  let pending: IdentityUnit[] = [];
  for (const unit of remaining) {
    const wouldCrossCohort = pending.length > 0 && cohortKey(pending[0]) !== cohortKey(unit);
    const wouldExceedEight = pending.reduce((count, item) => count + item.jobs.length, 0) + unit.jobs.length > 8;
    if (wouldCrossCohort || wouldExceedEight) {
      batches.push(makeBatch(batches.length + 1, pending, false));
      pending = [];
    }
    pending.push(unit);
  }
  if (pending.length > 0) batches.push(makeBatch(batches.length + 1, pending, false));

  const allJobs = batches.flatMap((batch) => batch.jobs);
  assertCondition(allJobs.length === 326, "Unpaid schedule must contain exactly 326 jobs.");
  const blockers = input.plan.document.rows.filter((row) => row.route === "hard-blocked-no-evidence").map((row) => ({
    canonicalIdentityKey: row.canonicalIdentityKey,
    websiteSku: row.websiteSku,
    graceSku: row.graceSku,
    route: "hard-blocked-no-evidence" as const,
    reasons: [...row.blockers],
  }));
  const vialHandoffs = input.plan.document.rows.filter((row) => row.route === "routed-to-vial").map((row) => ({
    canonicalIdentityKey: row.canonicalIdentityKey,
    websiteSku: row.websiteSku,
    graceSku: row.graceSku,
    route: "routed-to-vial" as const,
  }));
  const routeJobCounts = Object.fromEntries(Array.from(new Set(allJobs.map((job) => job.route))).map((route) => [route, allJobs.filter((job) => job.route === route).length]));
  const routeIdentityCounts = Object.fromEntries(Array.from(new Set(units.map((unit) => unit.route))).map((route) => [route, units.filter((unit) => unit.route === route).length]));
  const batchJobCountDistribution = Object.fromEntries(Array.from(new Set(batches.map((batch) => batch.jobCount))).sort((a, b) => a - b).map((count) => [String(count), batches.filter((batch) => batch.jobCount === count).length]));
  const pilotOutputByJob = new Map(input.pilotOutputProofs.map((proof) => [proof.jobId, proof]));
  const authorityRecord = {
    plan: {
      path: input.plan.path,
      semanticSha256: input.plan.document.sha256,
      recomputedSemanticSha256: authority.recomputedPlanSha256,
      fileSha256: input.plan.actualFileSha256,
    },
    compileAll: { path: input.compileAll.path, fileSha256: input.compileAll.actualFileSha256 },
    pilotArtifact: { path: input.pilot.path, fileSha256: input.pilot.actualFileSha256, inputSetSha256: input.pilot.document.inputSetSha256 },
    nextCohortArtifact: { path: input.nextCohort.path, fileSha256: input.nextCohort.actualFileSha256, inputSetSha256: input.nextCohort.document.inputSetSha256 },
    canonicalProductTruth: { path: input.canonicalProductTruth.path, fileSha256: input.canonicalProductTruth.actualFileSha256 },
    verifiedReferenceLocatorCount: input.references.length,
  };
  const envelope = {
    workflowVersion: BEST_BOTTLES_CYLINDER_FULL_EXECUTION_SCHEDULE_VERSION,
    authority: authorityRecord,
    referenceProofs: input.references,
    pilotOutputProofs: input.pilotOutputProofs,
    batches,
    blockers,
    vialHandoffs,
  };
  return {
    workflowVersion: BEST_BOTTLES_CYLINDER_FULL_EXECUTION_SCHEDULE_VERSION,
    inputSetSha256: sha256(stableJson(envelope)),
    authority: authorityRecord,
    summary: {
      sealedRoleJobCount: 328,
      scheduledJobCount: 326,
      scheduledIdentityCount: 191,
      batchCount: batches.length,
      blockerIdentityCount: 11,
      vialHandoffCount: 2,
      pilotRenderedJobCount: 2,
      routeJobCounts,
      routeIdentityCounts,
      batchJobCountDistribution,
    },
    pilot: {
      canonicalIdentityKey: PILOT_IDENTITY_KEY,
      websiteSku: PILOT_WEBSITE_SKU,
      graceSku: PILOT_GRACE_SKU,
      disposition: "rendered-review-pending",
      jobs: input.pilot.document.roles.map((role) => {
        const proof = pilotOutputByJob.get(role.jobId);
        assertCondition(proof, `Pilot output proof ${role.jobId} missing while assembling artifact.`);
        return { jobId: role.jobId, role: role.role, outputSha256: proof.actualSha256, localOutputLocator: proof.resolvedLocalLocator, machineStatus: "pass" as const };
      }),
      humanVisualApproval: "not-recorded",
      promotionStatus: "not-promoted",
    },
    blockers,
    vialHandoffs,
    batches,
    generationStatus: "not-started",
    humanVisualApproval: "not-recorded",
    promotionStatus: "not-promoted",
    externalWriteCount: 0,
  };
}

function validateArtifactStructure(
  input: CylinderFullExecutionScheduleBuildInput,
  artifact: CylinderFullExecutionScheduleArtifact,
): void {
  assertCondition(artifact.batches.length === artifact.summary.batchCount, "Batch invariant: batch count summary mismatch.");
  const blockerIds = new Set(artifact.blockers.map((row) => row.canonicalIdentityKey));
  const vialIds = new Set(artifact.vialHandoffs.map((row) => row.canonicalIdentityKey));
  const pilotIds = new Set(artifact.pilot.jobs.map((job) => job.jobId));
  const identityBatch = new Map<string, number>();
  const jobIds = new Set<string>();
  for (const batch of artifact.batches) {
    assertCondition(batch.jobCount === batch.jobs.length && batch.jobCount <= 8, `Batch invariant: batch ${batch.batchNumber} exceeds eight jobs or count mismatches.`);
    const expectedCommand = renderBatchCommand(batch.jobs);
    assertCondition(batch.command === expectedCommand, `Batch ${batch.batchNumber} command/allowlist mismatch.`);
    assertCondition(batch.jobs.every((job) => job.route === batch.route), `Batch invariant: route mixing in batch ${batch.batchNumber}.`);
    const identities = Array.from(new Set(batch.jobs.map((job) => job.canonicalIdentityKey)));
    assertCondition(identities.length === batch.identityCount, `Batch invariant: identity count mismatch in batch ${batch.batchNumber}.`);
    for (const identity of identities) {
      assertCondition(!blockerIds.has(identity), `Scheduled blocker identity ${identity}.`);
      assertCondition(!vialIds.has(identity), `Scheduled Vial handoff identity ${identity}.`);
      const prior = identityBatch.get(identity);
      assertCondition(prior === undefined || prior === batch.batchNumber, `Batch invariant: identity ${identity} split across batches.`);
      identityBatch.set(identity, batch.batchNumber);
      const roles = batch.jobs.filter((job) => job.canonicalIdentityKey === identity).map((job) => job.role);
      if (batch.route === "remediate-current-live-sidecar") {
        assertCondition(roles.length === 1 && roles[0] === "pdp-cap-off-sidecar", `Batch invariant: role order invalid for ${identity}.`);
      } else {
        assertCondition(roles.length === 2 && roles[0] === "identity-cap-on" && roles[1] === "pdp-cap-off-sidecar", `Batch invariant: role order invalid for ${identity}.`);
      }
    }
    if (!batch.preparedFirstBatch) {
      assertCondition(batch.materialCohorts.length === 1 && batch.canonicalGeometrySha256s.length === 1 && batch.capacitiesMl.length === 1 && batch.evidenceLanes.length === 1, `Batch invariant: non-prepared batch ${batch.batchNumber} is not homogeneous.`);
    }
    for (const job of batch.jobs) {
      assertCondition(!jobIds.has(job.jobId), `Duplicate scheduled job ${job.jobId}.`);
      assertCondition(!pilotIds.has(job.jobId), `Pilot job leakage detected for ${job.jobId}.`);
      jobIds.add(job.jobId);
    }
  }
  assertCondition(jobIds.size === 326 && identityBatch.size === 191, "Schedule population must be exactly 326 jobs across 191 identities.");
  assertCondition(
    stableJson(artifact.batches[0].jobs.map((job) => job.jobId)) === stableJson(input.nextCohort.document.jobs.map((job) => job.jobId)),
    "Batch 1 does not exactly equal the next-cohort artifact.",
  );
}

export function buildCylinderFullExecutionSchedule(
  input: CylinderFullExecutionScheduleBuildInput,
): CylinderFullExecutionScheduleArtifact {
  const authority = validateAuthority(input);
  const artifact = assembleArtifact(input, authority);
  validateArtifactStructure(input, artifact);
  return artifact;
}

export function validateCylinderFullExecutionSchedule(
  input: CylinderFullExecutionScheduleBuildInput,
  artifact: CylinderFullExecutionScheduleArtifact,
): void {
  const authority = validateAuthority(input);
  validateArtifactStructure(input, artifact);
  const expected = assembleArtifact(input, authority);
  assertCondition(
    serializeCylinderFullExecutionSchedule(artifact) === serializeCylinderFullExecutionSchedule(expected),
    "Schedule artifact does not exactly match recomputed plan/job/reference/canonical authority.",
  );
}

export function serializeCylinderFullExecutionSchedule(
  artifact: CylinderFullExecutionScheduleArtifact,
): string {
  return `${JSON.stringify(artifact, null, 2)}\n`;
}

function escapeHtml(value: unknown): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function renderCylinderFullExecutionScheduleHtml(
  artifact: CylinderFullExecutionScheduleArtifact,
): string {
  const rows = artifact.batches.map((batch) => {
    const identities = Array.from(new Map(batch.jobs.map((job) => [job.canonicalIdentityKey, job])).values());
    const details = identities.map((job) => {
      const roles = batch.jobs.filter((candidate) => candidate.canonicalIdentityKey === job.canonicalIdentityKey).map((candidate) => candidate.role).join(" → ");
      const referenceHref = `../../../../../../../${job.resolvedLocalReferenceLocator}`;
      return `<li><strong>${escapeHtml(job.websiteSku)} + ${escapeHtml(job.graceSku)}</strong> · ${escapeHtml(roles)} · <a href="${escapeHtml(referenceHref)}">reference</a></li>`;
    }).join("");
    return `<tr><td>${batch.batchNumber}</td><td>${escapeHtml(batch.route)}</td><td>${escapeHtml(batch.materialCohorts.join(", "))}<br>${escapeHtml(batch.evidenceLanes.join(", "))}</td><td>${batch.identityCount} / ${batch.jobCount}</td><td>${escapeHtml(batch.capacitiesMl.join(", "))}</td><td>${batch.canonicalGeometrySha256s.map((hash) => `<code>${escapeHtml(hash)}</code>`).join("<br>")}</td><td><ul>${details}</ul><pre class="disabled-not-run" aria-label="disabled not-run command">${escapeHtml(batch.command)}</pre></td></tr>`;
  }).join("\n");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Best Bottles Cylinder full execution schedule</title>
<style>body{font:14px/1.4 system-ui,sans-serif;margin:0;background:#f5f3ef;color:#24211d}.banner{padding:18px 24px;background:#593c23;color:#fff;font-weight:800}.meta{padding:18px 24px}table{border-collapse:collapse;width:calc(100% - 32px);margin:0 16px 32px;background:#fff}th,td{border:1px solid #cbc3b7;padding:8px;vertical-align:top;text-align:left}th{background:#e9e3d9;position:sticky;top:0}ul{margin:0;padding-left:18px}code{overflow-wrap:anywhere;font-size:10px}.disabled-not-run{white-space:pre-wrap;background:#eee8df;border:1px dashed #8d8375;padding:8px;user-select:all}.disabled-not-run::before{content:"DISABLED / NOT RUN — ";font-weight:800;color:#8b261d}</style>
</head><body>
<div class="banner">Schedule sealed — 326 jobs not started — pilot approval required</div>
<section class="meta"><h1>Full bounded Cylinder execution schedule</h1><p>${artifact.summary.batchCount} batches · 191 identities · 326 unpaid jobs · 11 blockers excluded · 2 Vial handoffs excluded</p><p>Pilot: rendered-review-pending · human visual approval not recorded · not promoted.</p><p>Input set <code>${escapeHtml(artifact.inputSetSha256)}</code></p></section>
<table><thead><tr><th>Batch</th><th>Route</th><th>Cohort / lane</th><th>Identities / jobs</th><th>mL</th><th>Geometry SHA</th><th>Exact SKU pairs, roles, references, disabled command</th></tr></thead><tbody>${rows}</tbody></table>
</body></html>\n`;
}
