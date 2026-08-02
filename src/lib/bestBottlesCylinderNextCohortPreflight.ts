import { createHash } from "node:crypto";

import type { CylinderDualRoleRemediationPlan } from "./bestBottlesCylinderDualRoleRemediation";
import {
  computeCanonicalGeometrySha256,
  computeCanonicalProductTruthRecordSha256,
  computeCylinderDualRolePlanSha256,
  type CylinderDualRoleCanonicalProductTruthRow,
} from "./bestBottlesCylinderDualRoleRunner";

export const BEST_BOTTLES_CYLINDER_NEXT_COHORT_PREFLIGHT_VERSION =
  "best-bottles-cylinder-next-cohort-preflight-v1" as const;

const REQUIRED_ROUTE = "approved-detached-dual-role" as const;
const REQUIRED_EVIDENCE_LANE = "approved-recovery" as const;

export const NEXT_COHORT_IDENTITIES = [
  {
    canonicalIdentityKey: "GBCYL5SPRYBLKMATT|GBCYLCLR5MLSPRMBLK",
    websiteSku: "GBCyl5SpryBlkMatt",
    graceSku: "GB-CYL-CLR-5ML-SPR-MBLK",
    closureFinish: "Black Matte",
    jobIds: [
      "GBCYL5SPRYBLKMATT|GBCYLCLR5MLSPRMBLK|assemble-cap-on-reference",
      "GBCYL5SPRYBLKMATT|GBCYLCLR5MLSPRMBLK|preserve-cap-off-sidecar-reference",
    ],
  },
  {
    canonicalIdentityKey: "GBCYL5SPRYBLKSH|GBCYLCLR5MLSPRSBLK",
    websiteSku: "GBCyl5SpryBlkSh",
    graceSku: "GB-CYL-CLR-5ML-SPR-SBLK",
    closureFinish: "Black Shiny",
    jobIds: [
      "GBCYL5SPRYBLKSH|GBCYLCLR5MLSPRSBLK|assemble-cap-on-reference",
      "GBCYL5SPRYBLKSH|GBCYLCLR5MLSPRSBLK|preserve-cap-off-sidecar-reference",
    ],
  },
  {
    canonicalIdentityKey: "GBCYL5SPRYGLMATT|GBCYLCLR5MLSPRMGLD",
    websiteSku: "GBCyl5SpryGlMatt",
    graceSku: "GB-CYL-CLR-5ML-SPR-MGLD",
    closureFinish: "Gold Matte",
    jobIds: [
      "GBCYL5SPRYGLMATT|GBCYLCLR5MLSPRMGLD|assemble-cap-on-reference",
      "GBCYL5SPRYGLMATT|GBCYLCLR5MLSPRMGLD|preserve-cap-off-sidecar-reference",
    ],
  },
  {
    canonicalIdentityKey: "GBCYL5SPRYGLSH|GBCYLCLR5MLSPRSGLD",
    websiteSku: "GBCyl5SpryGlSh",
    graceSku: "GB-CYL-CLR-5ML-SPR-SGLD",
    closureFinish: "Gold Shiny",
    jobIds: [
      "GBCYL5SPRYGLSH|GBCYLCLR5MLSPRSGLD|assemble-cap-on-reference",
      "GBCYL5SPRYGLSH|GBCYLCLR5MLSPRSGLD|preserve-cap-off-sidecar-reference",
    ],
  },
] as const;

export const NEXT_COHORT_JOB_IDS = NEXT_COHORT_IDENTITIES.flatMap(
  (identity) => identity.jobIds,
) as readonly string[];

export interface CylinderNextCohortCompiledJobInput {
  workflowVersion: string;
  jobId: string;
  jobType: string;
  canonicalIdentityKey: string;
  websiteSku: string;
  graceSku: string;
  role: string;
  route: string;
  evidenceLane: string;
  sourceLocator: string;
  planSha256: string;
  sourceSha256: string | null;
  referenceSha256: string;
  canonicalProductTruthFileSha256: string;
  canonicalProductTruthRecordSha256: string;
  prompt: string | null;
  promptSha256: string | null;
  canonicalGeometrySha256: string;
  [key: string]: unknown;
}

export interface CylinderNextCohortReferenceInput {
  sourceLocator: string;
  actualSha256: string;
  format: string;
  width: number;
  height: number;
  opaque: boolean;
}

export interface CylinderNextCohortPreflightBuildInput {
  sealedRunPlanSha256: string;
  plan: {
    document: CylinderDualRoleRemediationPlan;
    actualFileSha256: string;
  };
  compileAll: {
    actualFileSha256: string;
    document: {
      workflowVersion: string;
      mode: string;
      planSha256: string;
      planFileSha256: string;
      canonicalProductTruthFileSha256: string;
      selectedJobCount: number;
      jobs: CylinderNextCohortCompiledJobInput[];
      externalWriteCount: number;
    };
  };
  canonicalProductTruth: {
    actualFileSha256: string;
    rows: CylinderDualRoleCanonicalProductTruthRow[];
  };
  references: CylinderNextCohortReferenceInput[];
}

export interface CylinderNextCohortArtifactJob {
  jobId: string;
  canonicalIdentityKey: string;
  websiteSku: string;
  graceSku: string;
  route: typeof REQUIRED_ROUTE;
  evidenceLane: typeof REQUIRED_EVIDENCE_LANE;
  role: "identity-cap-on" | "pdp-cap-off-sidecar";
  jobType: "assemble-cap-on-reference" | "preserve-cap-off-sidecar-reference";
  sourceLocator: string;
  sourceSha256: string;
  referenceSha256: string;
  promptSha256: string;
  canonicalProductTruthRecordSha256: string;
  canonicalGeometrySha256: string;
  outputContract: typeof OUTPUT_CONTRACT;
  generationStatus: "not-started";
  reviewStatus: "pilot-approval-required";
  promotionStatus: "not-promoted";
}

export interface CylinderNextCohortArtifactIdentity {
  canonicalIdentityKey: string;
  websiteSku: string;
  graceSku: string;
  family: "Cylinder";
  capacityMl: 5;
  bodyColor: "Clear";
  closureFinish: string;
  route: typeof REQUIRED_ROUTE;
  evidenceLane: typeof REQUIRED_EVIDENCE_LANE;
  roleJobs: Array<{
    role: "identity-cap-on" | "pdp-cap-off-sidecar";
    jobId: string;
    jobType: "assemble-cap-on-reference" | "preserve-cap-off-sidecar-reference";
  }>;
  canonicalMeasurements: {
    bodyHeightMm: number;
    assembledHeightMm: number;
    widthMm: number;
    secondAxisMm: number;
  };
  canonicalGeometrySha256: string;
  canonicalProductTruthRecordSha256: string;
  sourceReference: {
    sourceLocator: string;
    sourceSha256: string;
    referenceSha256: string;
    actualReferenceSha256: string;
    format: "png";
    width: number;
    height: number;
    opaque: true;
    disposition: "source-reference-only";
  };
}

const OUTPUT_CONTRACT = {
  format: "png",
  width: 2080,
  height: 2288,
  opaque: true,
} as const;

export interface CylinderNextCohortPreflightArtifact {
  workflowVersion: typeof BEST_BOTTLES_CYLINDER_NEXT_COHORT_PREFLIGHT_VERSION;
  inputSetSha256: string;
  authority: {
    plan: {
      semanticSha256: string;
      recomputedSemanticSha256: string;
      runAncestorSha256: string;
      fileSha256: string;
    };
    compileAll: {
      fileSha256: string;
      declaredPlanFileSha256: string;
      declaredCanonicalProductTruthFileSha256: string;
    };
    canonicalProductTruth: {
      path: "docs/best-bottles-canonical-truth/best-bottles-master-truth.csv";
      fileSha256: string;
    };
  };
  identityCount: 4;
  jobCount: 8;
  identities: CylinderNextCohortArtifactIdentity[];
  jobs: CylinderNextCohortArtifactJob[];
  outputContract: typeof OUTPUT_CONTRACT;
  generationStatus: "not-started";
  humanVisualApproval: "not-recorded";
  promotionStatus: "not-promoted";
  externalWriteCount: 0;
}

function assertCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertSha256(value: unknown, label: string): asserts value is string {
  assertCondition(
    typeof value === "string" && /^[a-f0-9]{64}$/i.test(value),
    `${label} must be a SHA-256 hash.`,
  );
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
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

function expectedRole(index: number): "identity-cap-on" | "pdp-cap-off-sidecar" {
  return index % 2 === 0 ? "identity-cap-on" : "pdp-cap-off-sidecar";
}

function expectedJobType(index: number):
  | "assemble-cap-on-reference"
  | "preserve-cap-off-sidecar-reference" {
  return index % 2 === 0
    ? "assemble-cap-on-reference"
    : "preserve-cap-off-sidecar-reference";
}

function exactIdentityRows(
  rows: CylinderDualRoleCanonicalProductTruthRow[],
  websiteSku: string,
  graceSku: string,
): CylinderDualRoleCanonicalProductTruthRow[] {
  return rows.filter((row) => row.websiteSku === websiteSku && row.graceSku === graceSku);
}

function positiveNumber(value: string, label: string): number {
  const parsed = Number(value);
  assertCondition(Number.isFinite(parsed) && parsed > 0, `${label} must be a positive canonical measurement.`);
  return parsed;
}

function validateTopLevelAuthority(input: CylinderNextCohortPreflightBuildInput): string {
  assertSha256(input.sealedRunPlanSha256, "Sealed run ancestor SHA");
  assertSha256(input.plan.actualFileSha256, "Actual plan file SHA");
  assertSha256(input.compileAll.actualFileSha256, "Actual compile-all file SHA");
  assertSha256(input.canonicalProductTruth.actualFileSha256, "Actual canonical product-truth file SHA");
  const embeddedPlanSha256 = input.plan.document.sha256;
  assertSha256(embeddedPlanSha256, "Embedded plan semantic SHA");
  const recomputedPlanSha256 = computeCylinderDualRolePlanSha256(input.plan.document);
  assertCondition(
    recomputedPlanSha256 === embeddedPlanSha256,
    `Recomputed semantic plan SHA ${recomputedPlanSha256} does not match embedded ${embeddedPlanSha256}.`,
  );
  assertCondition(
    embeddedPlanSha256 === input.sealedRunPlanSha256,
    "Plan semantic SHA does not match the sealed run ancestor.",
  );
  assertCondition(
    input.compileAll.document.planSha256 === embeddedPlanSha256,
    "Compile-all plan SHA is stale relative to sealed plan authority.",
  );
  assertCondition(
    input.compileAll.document.planFileSha256 === input.plan.actualFileSha256,
    "Actual plan bytes do not match the compile-all declared plan-file SHA.",
  );
  assertCondition(
    input.compileAll.document.canonicalProductTruthFileSha256 ===
      input.canonicalProductTruth.actualFileSha256,
    "Actual canonical product-truth bytes do not match the compile-all declared file SHA.",
  );
  assertCondition(
    input.plan.document.authorization.remoteWrites === "forbidden" &&
      input.plan.document.summary.externalWriteCount === 0 &&
      input.compileAll.document.mode === "compile-only" &&
      input.compileAll.document.externalWriteCount === 0,
    "Sealed inputs must preserve compile-only execution and zero external writes.",
  );
  return recomputedPlanSha256;
}

export function buildCylinderNextCohortPreflight(
  input: CylinderNextCohortPreflightBuildInput,
): CylinderNextCohortPreflightArtifact {
  const recomputedPlanSha256 = validateTopLevelAuthority(input);
  const jobs = input.compileAll.document.jobs;
  assertCondition(jobs.length === 8, "Next Cylinder cohort requires exactly eight compiled jobs; missing or extra job detected.");
  const jobIds = jobs.map((job) => job.jobId);
  assertCondition(new Set(jobIds).size === jobIds.length, "Duplicate compiled job detected in next Cylinder cohort.");
  for (let index = 0; index < NEXT_COHORT_JOB_IDS.length; index += 1) {
    assertCondition(
      jobIds[index] === NEXT_COHORT_JOB_IDS[index],
      `Compiled job order mismatch at position ${index + 1}; expected ${NEXT_COHORT_JOB_IDS[index]}.`,
    );
  }

  assertCondition(input.references.length === 4, "Exactly four approved source references are required.");
  const referenceByLocator = new Map<string, CylinderNextCohortReferenceInput>();
  for (const reference of input.references) {
    assertCondition(!referenceByLocator.has(reference.sourceLocator), `Duplicate reference locator ${reference.sourceLocator}.`);
    referenceByLocator.set(reference.sourceLocator, reference);
  }

  const artifactIdentities: CylinderNextCohortArtifactIdentity[] = [];
  const artifactJobs: CylinderNextCohortArtifactJob[] = [];
  for (let identityIndex = 0; identityIndex < NEXT_COHORT_IDENTITIES.length; identityIndex += 1) {
    const identity = NEXT_COHORT_IDENTITIES[identityIndex];
    const planRows = input.plan.document.rows.filter(
      (row) => row.canonicalIdentityKey === identity.canonicalIdentityKey,
    );
    assertCondition(planRows.length === 1, `Sealed plan must contain exact identity ${identity.canonicalIdentityKey} once.`);
    const planRow = planRows[0];
    assertCondition(
      planRow.websiteSku === identity.websiteSku && planRow.graceSku === identity.graceSku,
      `${identity.canonicalIdentityKey} crosses the exact Website SKU + Grace SKU identity.`,
    );
    assertCondition(planRow.route === REQUIRED_ROUTE, `${identity.canonicalIdentityKey} has wrong route.`);
    assertCondition(
      planRow.evidence.lane === REQUIRED_EVIDENCE_LANE,
      `${identity.canonicalIdentityKey} has wrong evidence lane.`,
    );
    assertCondition(
      planRow.roleJobs.length === 2 &&
        planRow.roleJobs.every((roleJob, roleIndex) =>
          roleJob.jobId === identity.jobIds[roleIndex] &&
          roleJob.targetRole === expectedRole(roleIndex) &&
          roleJob.jobType === expectedJobType(roleIndex) &&
          roleJob.sourceEvidenceLane === REQUIRED_EVIDENCE_LANE
        ),
      `${identity.canonicalIdentityKey} sealed role order or role authority is invalid.`,
    );

    const canonicalMatches = exactIdentityRows(
      input.canonicalProductTruth.rows,
      identity.websiteSku,
      identity.graceSku,
    );
    assertCondition(
      canonicalMatches.length === 1,
      `Canonical product truth must contain the exact record join for ${identity.websiteSku} + ${identity.graceSku} once.`,
    );
    const canonicalRow = canonicalMatches[0];
    const canonicalRecordSha256 = computeCanonicalProductTruthRecordSha256(canonicalRow);
    for (const field of [
      "canon_bodyHeightMm",
      "canon_heightWithCapMm",
      "canon_widthAxisMm",
      "canon_secondAxisMm",
    ] as const) {
      assertCondition(
        String(planRow.canonical[field]).trim() === canonicalRow[field].trim(),
        `${identity.canonicalIdentityKey} canonical measurement ${field} does not match exact product truth.`,
      );
    }
    assertCondition(
      canonicalRow.family === "Cylinder" && canonicalRow.capacityMl === "5" && canonicalRow.color === "Clear",
      `${identity.canonicalIdentityKey} canonical row is not the required clear 5 mL Cylinder identity.`,
    );
    const canonicalGeometrySha256 = computeCanonicalGeometrySha256(planRow.canonical);
    const reference = referenceByLocator.get(planRow.evidence.sourceLocator);
    assertCondition(reference, `Missing reference for ${identity.canonicalIdentityKey}.`);
    assertSha256(reference.actualSha256, `${identity.canonicalIdentityKey} actual reference SHA`);
    assertCondition(
      reference.actualSha256 === planRow.evidence.referenceSha256,
      `${identity.canonicalIdentityKey} reference byte SHA does not match sealed reference SHA.`,
    );
    assertCondition(
      reference.format === "png" && reference.width === planRow.evidence.width &&
        reference.height === planRow.evidence.height && reference.opaque === true,
      `${identity.canonicalIdentityKey} reference dimensions, format, or opacity do not match sealed evidence.`,
    );
    assertCondition(
      !/^[a-z][a-z0-9+.-]*:\/\//i.test(planRow.evidence.sourceLocator) &&
        !planRow.evidence.sourceLocator.startsWith("/") &&
        !planRow.evidence.sourceLocator.split(/[\\/]/).includes(".."),
      `${identity.canonicalIdentityKey} reference locator must be a workspace-relative local path.`,
    );
    assertSha256(planRow.evidence.sourceSha256, `${identity.canonicalIdentityKey} source SHA`);
    assertSha256(planRow.evidence.referenceSha256, `${identity.canonicalIdentityKey} reference SHA`);

    const identityJobs = jobs.slice(identityIndex * 2, identityIndex * 2 + 2);
    for (let roleIndex = 0; roleIndex < identityJobs.length; roleIndex += 1) {
      const job = identityJobs[roleIndex];
      const role = expectedRole(roleIndex);
      const jobType = expectedJobType(roleIndex);
      assertCondition(
        job.canonicalIdentityKey === identity.canonicalIdentityKey &&
          job.websiteSku === identity.websiteSku && job.graceSku === identity.graceSku,
        `${job.jobId} crosses exact cohort identity authority.`,
      );
      assertCondition(job.route === REQUIRED_ROUTE, `${job.jobId} has wrong route.`);
      assertCondition(job.evidenceLane === REQUIRED_EVIDENCE_LANE, `${job.jobId} has wrong evidence lane.`);
      assertCondition(job.role === role, `${job.jobId} has wrong role.`);
      assertCondition(job.jobType === jobType, `${job.jobId} has wrong role job type.`);
      assertCondition(job.planSha256 === input.plan.document.sha256, `${job.jobId} has stale plan SHA.`);
      assertCondition(
        job.sourceLocator === planRow.evidence.sourceLocator &&
          job.sourceSha256 === planRow.evidence.sourceSha256 &&
          job.referenceSha256 === planRow.evidence.referenceSha256,
        `${job.jobId} source locator, source SHA, or reference SHA crosses sealed authority.`,
      );
      assertCondition(
        job.canonicalProductTruthFileSha256 === input.canonicalProductTruth.actualFileSha256,
        `${job.jobId} canonical product-truth file SHA is stale.`,
      );
      assertCondition(
        job.canonicalProductTruthRecordSha256 === canonicalRecordSha256,
        `${job.jobId} canonical product-truth record SHA does not match the exact joined row.`,
      );
      assertCondition(
        typeof job.prompt === "string" && job.prompt.length > 0 &&
          sha256(job.prompt) === job.promptSha256,
        `${job.jobId} prompt SHA does not match actual prompt text.`,
      );
      assertCondition(
        job.canonicalGeometrySha256 === canonicalGeometrySha256,
        `${job.jobId} canonical geometry SHA does not match geometry recomputed from the sealed plan row.`,
      );
      assertSha256(job.promptSha256, `${job.jobId} prompt SHA`);
      artifactJobs.push({
        jobId: job.jobId,
        canonicalIdentityKey: identity.canonicalIdentityKey,
        websiteSku: identity.websiteSku,
        graceSku: identity.graceSku,
        route: REQUIRED_ROUTE,
        evidenceLane: REQUIRED_EVIDENCE_LANE,
        role,
        jobType,
        sourceLocator: planRow.evidence.sourceLocator,
        sourceSha256: planRow.evidence.sourceSha256,
        referenceSha256: planRow.evidence.referenceSha256,
        promptSha256: job.promptSha256,
        canonicalProductTruthRecordSha256: canonicalRecordSha256,
        canonicalGeometrySha256,
        outputContract: OUTPUT_CONTRACT,
        generationStatus: "not-started",
        reviewStatus: "pilot-approval-required",
        promotionStatus: "not-promoted",
      });
    }

    artifactIdentities.push({
      canonicalIdentityKey: identity.canonicalIdentityKey,
      websiteSku: identity.websiteSku,
      graceSku: identity.graceSku,
      family: "Cylinder",
      capacityMl: 5,
      bodyColor: "Clear",
      closureFinish: identity.closureFinish,
      route: REQUIRED_ROUTE,
      evidenceLane: REQUIRED_EVIDENCE_LANE,
      roleJobs: identityJobs.map((job, roleIndex) => ({
        role: expectedRole(roleIndex),
        jobId: job.jobId,
        jobType: expectedJobType(roleIndex),
      })),
      canonicalMeasurements: {
        bodyHeightMm: positiveNumber(canonicalRow.canon_bodyHeightMm, "Body height"),
        assembledHeightMm: positiveNumber(canonicalRow.canon_heightWithCapMm, "Assembled height"),
        widthMm: positiveNumber(canonicalRow.canon_widthAxisMm, "Width"),
        secondAxisMm: positiveNumber(canonicalRow.canon_secondAxisMm, "Second axis"),
      },
      canonicalGeometrySha256,
      canonicalProductTruthRecordSha256: canonicalRecordSha256,
      sourceReference: {
        sourceLocator: planRow.evidence.sourceLocator,
        sourceSha256: planRow.evidence.sourceSha256,
        referenceSha256: planRow.evidence.referenceSha256,
        actualReferenceSha256: reference.actualSha256,
        format: "png",
        width: reference.width,
        height: reference.height,
        opaque: true,
        disposition: "source-reference-only",
      },
    });
  }

  assertCondition(
    referenceByLocator.size === artifactIdentities.length &&
      artifactIdentities.every((identity) => referenceByLocator.has(identity.sourceReference.sourceLocator)),
    "Extra source reference input detected outside the exact four-identity cohort.",
  );

  const authority = {
    plan: {
      semanticSha256: input.plan.document.sha256,
      recomputedSemanticSha256: recomputedPlanSha256,
      runAncestorSha256: input.sealedRunPlanSha256,
      fileSha256: input.plan.actualFileSha256,
    },
    compileAll: {
      fileSha256: input.compileAll.actualFileSha256,
      declaredPlanFileSha256: input.compileAll.document.planFileSha256,
      declaredCanonicalProductTruthFileSha256:
        input.compileAll.document.canonicalProductTruthFileSha256,
    },
    canonicalProductTruth: {
      path: "docs/best-bottles-canonical-truth/best-bottles-master-truth.csv" as const,
      fileSha256: input.canonicalProductTruth.actualFileSha256,
    },
  };
  const inputEnvelope = {
    workflowVersion: BEST_BOTTLES_CYLINDER_NEXT_COHORT_PREFLIGHT_VERSION,
    authority,
    identities: artifactIdentities,
    jobs: artifactJobs,
    outputContract: OUTPUT_CONTRACT,
  };
  return {
    workflowVersion: BEST_BOTTLES_CYLINDER_NEXT_COHORT_PREFLIGHT_VERSION,
    inputSetSha256: sha256(stableJson(inputEnvelope)),
    authority,
    identityCount: 4,
    jobCount: 8,
    identities: artifactIdentities,
    jobs: artifactJobs,
    outputContract: OUTPUT_CONTRACT,
    generationStatus: "not-started",
    humanVisualApproval: "not-recorded",
    promotionStatus: "not-promoted",
    externalWriteCount: 0,
  };
}

export function serializeCylinderNextCohortPreflight(
  artifact: CylinderNextCohortPreflightArtifact,
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

export function renderCylinderNextCohortPreflightHtml(
  artifact: CylinderNextCohortPreflightArtifact,
): string {
  const cards = artifact.identities.map((identity) => {
    const sourceHref = `../../../../../../../${identity.sourceReference.sourceLocator}`;
    const roles = identity.roleJobs.map((roleJob) =>
      `<li><strong>${escapeHtml(roleJob.role)}</strong> · ${escapeHtml(roleJob.jobType)}</li>`
    ).join("");
    const measurements = identity.canonicalMeasurements;
    return `<article class="source-card">
      <h2>${escapeHtml(identity.closureFinish)}</h2>
      <a href="${escapeHtml(sourceHref)}"><img src="${escapeHtml(sourceHref)}" alt="${escapeHtml(identity.closureFinish)} approved source reference"></a>
      <p><strong>Website SKU:</strong> ${escapeHtml(identity.websiteSku)}<br><strong>Grace SKU:</strong> ${escapeHtml(identity.graceSku)}</p>
      <ul>${roles}</ul>
      <p><strong>Canonical measurements:</strong> body ${escapeHtml(measurements.bodyHeightMm)} mm · assembled ${escapeHtml(measurements.assembledHeightMm)} mm · width ${escapeHtml(measurements.widthMm)} mm · second axis ${escapeHtml(measurements.secondAxisMm)} mm</p>
      <p><strong>Reference:</strong> ${escapeHtml(identity.sourceReference.width)} × ${escapeHtml(identity.sourceReference.height)} opaque PNG<br><code>${escapeHtml(identity.sourceReference.referenceSha256)}</code></p>
      <p><strong>Canonical geometry:</strong> <code>${escapeHtml(identity.canonicalGeometrySha256)}</code></p>
    </article>`;
  }).join("\n");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Best Bottles next Cylinder cohort preflight</title>
<style>body{font-family:system-ui,sans-serif;margin:0;background:#f5f3ef;color:#24211d}.banner{padding:18px 24px;background:#25352c;color:#fff;font-weight:750}.meta{padding:18px 24px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px;padding:24px}.source-card{background:#fff;padding:18px;border:1px solid #cfc8bd;border-radius:8px}.source-card img{display:block;width:100%;height:auto;background:#fff}.source-card code{overflow-wrap:anywhere;font-size:11px}@media(max-width:800px){.grid{grid-template-columns:1fr}}</style>
</head><body>
<div class="banner">Preflight pass — generation not started — pilot approval required</div>
<section class="meta"><h1>Next bounded Cylinder cohort</h1><p>4 exact identities · 8 exact role jobs · output contract 2080 × 2288 opaque PNG</p><p>Input set <code>${escapeHtml(artifact.inputSetSha256)}</code></p></section>
<main class="grid">${cards}</main>
</body></html>\n`;
}
