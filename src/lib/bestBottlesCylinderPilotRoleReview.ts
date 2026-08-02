import { createHash } from "node:crypto";

import type { CylinderDualRoleRemediationPlan } from "./bestBottlesCylinderDualRoleRemediation";
import {
  computeCanonicalGeometrySha256,
  computeCylinderDualRolePlanSha256,
} from "./bestBottlesCylinderDualRoleRunner";
import type { FramingQaReport } from "./product-image/framingQa";
import type { ShadowQaReport } from "./product-image/shadowQa";

export const BEST_BOTTLES_CYLINDER_PILOT_ROLE_REVIEW_VERSION =
  "best-bottles-cylinder-pilot-role-review-v1" as const;
export const PILOT_REVIEW_WEBSITE_SKU = "GBCylBlu5SpryBlkSh" as const;
export const PILOT_REVIEW_GRACE_SKU = "GB-CYL-BLU-5ML-SPR-SBLK" as const;

export const PILOT_SUPPORTING_IDENTITY_EVIDENCE = {
  sha256: "e84f99572cded9a24efc9add7b6f7e402bd9c677532c3dc8438503d6c439126f",
  width: 588,
  height: 1280,
  disposition: "supporting-identity-only",
  referenceAuthority: false,
  productionEligible: false,
  promotable: false,
} as const;

export type CylinderPilotReviewRole =
  | "identity-cap-on"
  | "pdp-cap-off-sidecar";
export type CylinderPilotReviewTopology = "assembled" | "detached";
export type CylinderPilotReviewJobType =
  | "assemble-cap-on-reference"
  | "preserve-cap-off-sidecar-reference";

export interface CylinderPilotRolePlanJob {
  jobId: string;
  jobType: CylinderPilotReviewJobType;
  targetRole: CylinderPilotReviewRole;
  sourceEvidenceLane: string;
  reviewStatus: string;
}

export interface CylinderPilotCompiledJob {
  websiteSku: string;
  graceSku: string;
  role: CylinderPilotReviewRole;
  jobId: string;
  jobType: CylinderPilotReviewJobType;
  planSha256: string;
  sourceSha256: string;
  referenceSha256: string;
  sourceLocator: string;
  prompt: string;
  promptSha256: string;
  canonicalGeometrySha256: string;
}

export interface CylinderPilotPngProof {
  relativePath: string;
  actualSha256: string;
  format: "png";
  width: number;
  height: number;
  opaque: boolean;
}

export interface CylinderPilotRoleReviewInput {
  websiteSku: string;
  graceSku: string;
  role: CylinderPilotReviewRole;
  topology: CylinderPilotReviewTopology;
  jobId: string;
  jobType: CylinderPilotReviewJobType;
  planSha256: string;
  sourceSha256: string;
  referenceSha256: string;
  promptSha256: string;
  canonicalGeometrySha256: string;
  evidenceLocator: string;
  actualReferenceSha256: string;
  referenceVerification: "direct-locator-bytes";
  sourceVerification: "sealed-plan-semantic-sha-no-byte-locator";
  recordFileSha256: string;
  rawInputSha256: string;
  rawInputSha256After: string;
  pass1InputSha256: string;
  pass1OutputSha256: string;
  pass2InputSha256: string;
  pass2OutputSha256: string;
  png: CylinderPilotPngProof;
  framingDecision: string;
  qaIssues: string[];
  framingQa: FramingQaReport;
  recordedShadowQaStatus: "pass" | "review" | "fail";
  recomputedShadowQa: ShadowQaReport;
}

export interface CylinderPilotRoleReviewBuildInput {
  sealedRunPlanSha256: string;
  plan: {
    version: string;
    semanticSha256: string;
    recordedFileSha256: string;
    actualFileSha256: string;
    document: CylinderDualRoleRemediationPlan;
    authorization: {
      planMode: string;
      outputState: string;
      remoteWrites: string;
      publishStatus: string;
    };
    identity: {
      websiteSku: string;
      graceSku: string;
      canonicalIdentityKey: string;
      roleJobs: CylinderPilotRolePlanJob[];
    };
  };
  compiledJobsFileSha256: string;
  compiledJobs: CylinderPilotCompiledJob[];
  roles: CylinderPilotRoleReviewInput[];
  supportingIdentityEvidence: typeof PILOT_SUPPORTING_IDENTITY_EVIDENCE;
}

export interface CylinderPilotRoleReviewEntry {
  websiteSku: typeof PILOT_REVIEW_WEBSITE_SKU;
  graceSku: typeof PILOT_REVIEW_GRACE_SKU;
  role: CylinderPilotReviewRole;
  topology: CylinderPilotReviewTopology;
  jobId: string;
  jobType: CylinderPilotReviewJobType;
  hashes: {
    sourceSha256: string;
    referenceSha256: string;
    promptSha256: string;
    canonicalGeometrySha256: string;
    actualReferenceSha256: string;
    recordFileSha256: string;
    rawInputSha256: string;
    passInputSha256: string;
    outputSha256: string;
  };
  png: CylinderPilotPngProof & { reviewHref: string };
  evidence: {
    locator: string;
    referenceVerification: "direct-locator-bytes";
    sourceVerification: "sealed-plan-semantic-sha-no-byte-locator";
  };
  promptVerification: "sha256-of-compiled-prompt-text";
  canonicalGeometryVerification: "recomputed-from-sealed-plan-canonical";
  framingQa: FramingQaReport;
  recordedShadowQaStatus: "pass" | "review" | "fail";
  shadowQaSource: "recomputed-current-detector";
  shadowQa: ShadowQaReport;
  machineStatus: "pass";
  reviewStatus: "review-pending";
  promotionStatus: "not-promoted";
}

export interface CylinderPilotRoleReviewArtifact {
  workflowVersion: typeof BEST_BOTTLES_CYLINDER_PILOT_ROLE_REVIEW_VERSION;
  inputSetSha256: string;
  identity: {
    websiteSku: typeof PILOT_REVIEW_WEBSITE_SKU;
    graceSku: typeof PILOT_REVIEW_GRACE_SKU;
    canonicalIdentityKey: "GBCYLBLU5SPRYBLKSH|GBCYLBLU5MLSPRSBLK";
  };
  plan: {
    semanticSha256: string;
    recomputedSemanticSha256: string;
    fileSha256: string;
    compiledJobsFileSha256: string;
    canonicalGeometrySha256: string;
  };
  roles: CylinderPilotRoleReviewEntry[];
  supportingIdentityEvidence: typeof PILOT_SUPPORTING_IDENTITY_EVIDENCE;
  machineStatus: "pass";
  reviewStatus: "review-pending";
  humanVisualApproval: "not-recorded";
  promotionStatus: "not-promoted";
  externalWriteCount: 0;
}

const REQUIRED_ROLES = [
  "identity-cap-on",
  "pdp-cap-off-sidecar",
] as const satisfies readonly CylinderPilotReviewRole[];

const ROLE_CONTRACT: Record<CylinderPilotReviewRole, {
  jobType: CylinderPilotReviewJobType;
  topology: CylinderPilotReviewTopology;
  expectedContacts: readonly string[];
}> = {
  "identity-cap-on": {
    jobType: "assemble-cap-on-reference",
    topology: "assembled",
    expectedContacts: ["bottle"],
  },
  "pdp-cap-off-sidecar": {
    jobType: "preserve-cap-off-sidecar-reference",
    topology: "detached",
    expectedContacts: ["bottle", "sidecar"],
  },
};

function assertCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/i.test(value);
}

function assertSha256(value: unknown, label: string): asserts value is string {
  assertCondition(isSha256(value), `${label} must be a SHA-256 hash.`);
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([first], [second]) => first.localeCompare(second))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }
  return value;
}

function sha256Json(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(value)))
    .digest("hex");
}

function sha256Text(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function validateCylinderPilotRoleReviewInput(
  input: CylinderPilotRoleReviewBuildInput,
): void {
  assertSha256(input.sealedRunPlanSha256, "Sealed run plan SHA");
  assertSha256(input.plan.semanticSha256, "Plan semantic SHA");
  assertSha256(input.plan.recordedFileSha256, "Recorded plan file SHA");
  assertSha256(input.plan.actualFileSha256, "Actual plan file SHA");
  assertSha256(input.compiledJobsFileSha256, "Compiled jobs file SHA");
  const recomputedPlanSha256 = computeCylinderDualRolePlanSha256(input.plan.document);
  assertCondition(
    recomputedPlanSha256 === input.plan.semanticSha256,
    `Recomputed semantic plan SHA ${recomputedPlanSha256} does not match embedded ${input.plan.semanticSha256}.`,
  );
  assertCondition(
    input.plan.semanticSha256 === input.sealedRunPlanSha256,
    "Plan semantic SHA does not match the sealed run plan SHA.",
  );
  assertCondition(
    input.plan.actualFileSha256 === input.plan.recordedFileSha256,
    "Actual plan file SHA does not match the recorded plan file SHA.",
  );
  assertCondition(
    input.plan.authorization.planMode === "read-only" &&
      input.plan.authorization.outputState === "review-pending" &&
      input.plan.authorization.remoteWrites === "forbidden" &&
      input.plan.authorization.publishStatus === "not-authorized",
    "Plan authorization must remain read-only, review-pending, and not authorized for publication.",
  );
  assertCondition(
    input.plan.identity.websiteSku === PILOT_REVIEW_WEBSITE_SKU &&
      input.plan.identity.graceSku === PILOT_REVIEW_GRACE_SKU &&
      input.plan.identity.canonicalIdentityKey ===
        "GBCYLBLU5SPRYBLKSH|GBCYLBLU5MLSPRSBLK",
    "Plan identity does not match the exact pilot Website SKU + Grace SKU.",
  );
  const trustedRows = input.plan.document.rows.filter(
    (row) => row.websiteSku === PILOT_REVIEW_WEBSITE_SKU && row.graceSku === PILOT_REVIEW_GRACE_SKU,
  );
  assertCondition(trustedRows.length === 1, "Sealed plan must contain the exact pilot identity once.");
  const trustedRow = trustedRows[0];
  assertCondition(
    trustedRow.canonicalIdentityKey === input.plan.identity.canonicalIdentityKey &&
      JSON.stringify(trustedRow.roleJobs) === JSON.stringify(input.plan.identity.roleJobs),
    "Pilot identity and role jobs must come directly from the recomputed sealed plan.",
  );
  const trustedCanonicalGeometrySha256 = computeCanonicalGeometrySha256(trustedRow.canonical);
  assertCondition(
    input.roles.length === REQUIRED_ROLES.length &&
      input.compiledJobs.length === REQUIRED_ROLES.length &&
      input.plan.identity.roleJobs.length === REQUIRED_ROLES.length,
    "Both exact required roles must be present exactly once.",
  );

  for (const requiredRole of REQUIRED_ROLES) {
    const roleMatches = input.roles.filter((entry) => entry.role === requiredRole);
    const jobMatches = input.compiledJobs.filter((entry) => entry.role === requiredRole);
    const planMatches = input.plan.identity.roleJobs.filter(
      (entry) => entry.targetRole === requiredRole,
    );
    assertCondition(
      roleMatches.length === 1 && jobMatches.length === 1 && planMatches.length === 1,
      `Required role ${requiredRole} must be present exactly once; duplicate or absent role detected.`,
    );
    const role = roleMatches[0];
    const job = jobMatches[0];
    const planJob = planMatches[0];
    const contract = ROLE_CONTRACT[requiredRole];
    assertCondition(
      role.websiteSku === PILOT_REVIEW_WEBSITE_SKU &&
        role.graceSku === PILOT_REVIEW_GRACE_SKU &&
        job.websiteSku === PILOT_REVIEW_WEBSITE_SKU &&
        job.graceSku === PILOT_REVIEW_GRACE_SKU,
      `${requiredRole} crosses the exact pilot identity boundary.`,
    );
    assertCondition(
      role.jobType === contract.jobType &&
        job.jobType === contract.jobType &&
        planJob.jobType === contract.jobType,
      `${requiredRole} job type does not match its role contract.`,
    );
    assertCondition(
      role.topology === contract.topology,
      `${requiredRole} topology does not match its role contract.`,
    );
    assertCondition(
      role.jobId === job.jobId && role.jobId === planJob.jobId,
      `${requiredRole} job ID crosses sealed role authority.`,
    );
    assertCondition(
      planJob.reviewStatus === "sealed-input-review-pending",
      `${requiredRole} plan role job is not sealed-input-review-pending.`,
    );
    assertCondition(
      role.planSha256 === input.plan.semanticSha256 &&
        job.planSha256 === input.plan.semanticSha256,
      `${requiredRole} plan SHA does not match sealed authority.`,
    );
    for (const [label, roleValue, jobValue] of [
      ["source SHA", role.sourceSha256, job.sourceSha256],
      ["reference SHA", role.referenceSha256, job.referenceSha256],
      ["prompt SHA", role.promptSha256, job.promptSha256],
      ["canonical geometry SHA", role.canonicalGeometrySha256, job.canonicalGeometrySha256],
    ] as const) {
      assertSha256(roleValue, `${requiredRole} ${label}`);
      assertCondition(roleValue === jobValue, `${requiredRole} ${label} does not match the compiled role job.`);
    }
    assertCondition(
      job.sourceSha256 === trustedRow.evidence.sourceSha256 &&
        job.referenceSha256 === trustedRow.evidence.referenceSha256,
      `${requiredRole} source SHA or reference SHA does not match recomputed sealed-plan authority.`,
    );
    assertCondition(
      role.canonicalGeometrySha256 === trustedCanonicalGeometrySha256,
      `${requiredRole} canonical geometry SHA does not match canonical geometry recomputed from the sealed plan.`,
    );
    assertCondition(
      typeof job.prompt === "string" && job.prompt.length > 0 &&
        sha256Text(job.prompt) === job.promptSha256 &&
        job.promptSha256 === role.promptSha256,
      `${requiredRole} prompt SHA does not match actual compiled prompt text.`,
    );
    assertCondition(
      job.sourceLocator === trustedRow.evidence.sourceLocator &&
        role.evidenceLocator === trustedRow.evidence.sourceLocator,
      `${requiredRole} evidence locator does not match sealed-plan authority.`,
    );
    assertCondition(
      role.referenceVerification === "direct-locator-bytes" &&
        role.actualReferenceSha256 === role.referenceSha256,
      `${requiredRole} reference SHA does not match actual locator bytes.`,
    );
    assertCondition(
      role.sourceVerification === "sealed-plan-semantic-sha-no-byte-locator",
      `${requiredRole} source SHA must be explicitly anchored to the recomputed sealed plan when no byte locator exists.`,
    );
    for (const [label, value] of [
      ["record file SHA", role.recordFileSha256],
      ["raw input SHA", role.rawInputSha256],
      ["raw input after SHA", role.rawInputSha256After],
      ["pass 1 input SHA", role.pass1InputSha256],
      ["pass 1 output SHA", role.pass1OutputSha256],
      ["pass 2 input SHA", role.pass2InputSha256],
      ["pass 2 output SHA", role.pass2OutputSha256],
      ["actual output SHA", role.png.actualSha256],
    ] as const) assertSha256(value, `${requiredRole} ${label}`);
    assertCondition(
      role.rawInputSha256 === role.rawInputSha256After &&
        role.pass1InputSha256 === role.rawInputSha256,
      `${requiredRole} raw input SHA continuity is broken.`,
    );
    assertCondition(
      role.pass2InputSha256 === role.pass1OutputSha256,
      `${requiredRole} pass 2 input SHA does not match pass 1 output SHA.`,
    );
    assertCondition(
      role.png.actualSha256 === role.pass2OutputSha256,
      `${requiredRole} actual output SHA does not match pass 2 output SHA.`,
    );
    assertCondition(role.png.format === "png", `${requiredRole} output must be PNG.`);
    assertCondition(
      role.png.width === 2080 && role.png.height === 2288,
      `${requiredRole} output must be exactly 2080 × 2288.`,
    );
    assertCondition(role.png.opaque, `${requiredRole} output must be fully opaque.`);
    const expectedPath =
      `normalized/framing-recovery-v3/${PILOT_REVIEW_WEBSITE_SKU}__${PILOT_REVIEW_GRACE_SKU}__${requiredRole}/pass-02.png`;
    assertCondition(
      role.png.relativePath === expectedPath,
      `${requiredRole} pass-02 path crosses the sealed role boundary.`,
    );
    assertCondition(
      role.framingDecision === "pass" &&
        role.framingQa.status === "pass" &&
        role.framingQa.failures.length === 0 &&
        role.qaIssues.length === 0,
      `${requiredRole} framing QA must pass without issues.`,
    );
    assertCondition(
      ["pass", "review", "fail"].includes(role.recordedShadowQaStatus),
      `${requiredRole} recorded recovery shadow QA status is missing.`,
    );
    assertCondition(
      role.recomputedShadowQa.status === "pass" &&
        role.recomputedShadowQa.failures.length === 0,
      `${requiredRole} recomputed shadow QA must pass; stale detector output is rejected.`,
    );
    const contacts = role.recomputedShadowQa.contacts ?? [];
    assertCondition(
      contacts.length === contract.expectedContacts.length &&
        contract.expectedContacts.every((contact) =>
          contacts.some((entry) => entry.contact === contact && entry.status === "pass")
        ),
      `${requiredRole} recomputed shadow QA must pass every expected contact.`,
    );
  }

  assertCondition(
    JSON.stringify(input.supportingIdentityEvidence) ===
      JSON.stringify(PILOT_SUPPORTING_IDENTITY_EVIDENCE),
    "Supporting identity evidence must remain metadata-only and non-promotable.",
  );
}

function escapeHtml(value: unknown): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function buildCylinderPilotRoleReview(
  input: CylinderPilotRoleReviewBuildInput,
): CylinderPilotRoleReviewArtifact {
  validateCylinderPilotRoleReviewInput(input);
  const roles = REQUIRED_ROLES.map((requiredRole) => {
    const role = input.roles.find((entry) => entry.role === requiredRole)!;
    return {
      websiteSku: PILOT_REVIEW_WEBSITE_SKU,
      graceSku: PILOT_REVIEW_GRACE_SKU,
      role: role.role,
      topology: role.topology,
      jobId: role.jobId,
      jobType: role.jobType,
      hashes: {
        sourceSha256: role.sourceSha256,
        referenceSha256: role.referenceSha256,
        promptSha256: role.promptSha256,
        canonicalGeometrySha256: role.canonicalGeometrySha256,
        actualReferenceSha256: role.actualReferenceSha256,
        recordFileSha256: role.recordFileSha256,
        rawInputSha256: role.rawInputSha256,
        passInputSha256: role.pass2InputSha256,
        outputSha256: role.pass2OutputSha256,
      },
      png: {
        ...role.png,
        reviewHref: `../../${role.png.relativePath}`,
      },
      evidence: {
        locator: role.evidenceLocator,
        referenceVerification: role.referenceVerification,
        sourceVerification: role.sourceVerification,
      },
      promptVerification: "sha256-of-compiled-prompt-text" as const,
      canonicalGeometryVerification: "recomputed-from-sealed-plan-canonical" as const,
      framingQa: role.framingQa,
      recordedShadowQaStatus: role.recordedShadowQaStatus,
      shadowQaSource: "recomputed-current-detector" as const,
      shadowQa: role.recomputedShadowQa,
      machineStatus: "pass" as const,
      reviewStatus: "review-pending" as const,
      promotionStatus: "not-promoted" as const,
    };
  });
  const inputEnvelope = {
    workflowVersion: BEST_BOTTLES_CYLINDER_PILOT_ROLE_REVIEW_VERSION,
    identity: {
      websiteSku: PILOT_REVIEW_WEBSITE_SKU,
      graceSku: PILOT_REVIEW_GRACE_SKU,
      canonicalIdentityKey: "GBCYLBLU5SPRYBLKSH|GBCYLBLU5MLSPRSBLK",
    },
    sealedRunPlanSha256: input.sealedRunPlanSha256,
    plan: input.plan,
    compiledJobsFileSha256: input.compiledJobsFileSha256,
    compiledJobs: [...input.compiledJobs].sort((first, second) =>
      REQUIRED_ROLES.indexOf(first.role) - REQUIRED_ROLES.indexOf(second.role)
    ),
    roles,
    supportingIdentityEvidence: input.supportingIdentityEvidence,
  };
  return {
    workflowVersion: BEST_BOTTLES_CYLINDER_PILOT_ROLE_REVIEW_VERSION,
    inputSetSha256: sha256Json(inputEnvelope),
    identity: inputEnvelope.identity,
    plan: {
      semanticSha256: input.plan.semanticSha256,
      recomputedSemanticSha256: computeCylinderDualRolePlanSha256(input.plan.document),
      fileSha256: input.plan.actualFileSha256,
      compiledJobsFileSha256: input.compiledJobsFileSha256,
      canonicalGeometrySha256: computeCanonicalGeometrySha256(
        input.plan.document.rows.find(
          (row) => row.websiteSku === PILOT_REVIEW_WEBSITE_SKU && row.graceSku === PILOT_REVIEW_GRACE_SKU,
        )!.canonical,
      ),
    },
    roles,
    supportingIdentityEvidence: input.supportingIdentityEvidence,
    machineStatus: "pass",
    reviewStatus: "review-pending",
    humanVisualApproval: "not-recorded",
    promotionStatus: "not-promoted",
    externalWriteCount: 0,
  };
}

export function renderCylinderPilotRoleReviewHtml(
  artifact: CylinderPilotRoleReviewArtifact,
): string {
  const cards = artifact.roles.map((role) => {
    const measurements = role.framingQa.measurements;
    const contacts = (role.shadowQa.contacts ?? []).map((contact) =>
      `<li><strong>${escapeHtml(contact.contact)}</strong>: ${escapeHtml(contact.status)}, ` +
      `${escapeHtml(contact.measurements.componentCount)} component(s), ` +
      `depth ${escapeHtml(contact.measurements.verticalDepthPx)}px</li>`
    ).join("");
    const warnings = role.shadowQa.warnings.length > 0
      ? role.shadowQa.warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("")
      : "<li>None</li>";
    return `<article class="role-card">
      <h2>${escapeHtml(role.role)}</h2>
      <a href="${escapeHtml(role.png.reviewHref)}"><img src="${escapeHtml(role.png.reviewHref)}" alt="${escapeHtml(role.role)} pass-02"></a>
      <p>${escapeHtml(role.png.width)} × ${escapeHtml(role.png.height)} · opaque PNG</p>
      <p>Topology ${escapeHtml(role.topology)} · Baseline ${escapeHtml(measurements.baselineYPx)} / target ${escapeHtml(measurements.targetBaselineYPx)}</p>
      <p>Fill ${escapeHtml(measurements.fillHeightPct)}% · Center ${escapeHtml(measurements.centerXPct)}% · delta ${escapeHtml(measurements.centerDeltaPct)}%</p>
      <h3>Shadow contacts</h3><ul>${contacts}</ul>
      <h3>Warnings</h3><ul>${warnings}</ul>
    </article>`;
  }).join("\n");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Best Bottles pilot role review</title>
<style>body{font-family:system-ui,sans-serif;margin:0;background:#f5f3ef;color:#24211d}.banner{padding:16px 24px;background:#332f2a;color:#fff;font-weight:700}.meta{padding:16px 24px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px;padding:24px}.role-card{background:#fff;padding:18px;border:1px solid #cfc8bd;border-radius:8px}.role-card img{display:block;width:100%;height:auto;background:#f5f3ef}@media(max-width:800px){.grid{grid-template-columns:1fr}}</style>
</head><body>
<div class="banner">Machine pass — human visual review pending — not promoted</div>
<section class="meta"><h1>${escapeHtml(artifact.identity.websiteSku)} | ${escapeHtml(artifact.identity.graceSku)}</h1>
<p>Input set ${escapeHtml(artifact.inputSetSha256)}</p>
<p>Supporting identity evidence: ${escapeHtml(artifact.supportingIdentityEvidence.sha256)}, ${escapeHtml(artifact.supportingIdentityEvidence.width)} × ${escapeHtml(artifact.supportingIdentityEvidence.height)}, ${escapeHtml(artifact.supportingIdentityEvidence.disposition)}. Not reference authority or promotable.</p></section>
<main class="grid">${cards}</main>
</body></html>\n`;
}
