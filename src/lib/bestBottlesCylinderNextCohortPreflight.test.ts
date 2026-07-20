import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";

import {
  computeCanonicalGeometrySha256,
  computeCanonicalProductTruthRecordSha256,
  computeCylinderDualRolePlanSha256,
} from "./bestBottlesCylinderDualRoleRunner";
import {
  NEXT_COHORT_IDENTITIES,
  NEXT_COHORT_JOB_IDS,
  buildCylinderNextCohortPreflight,
  renderCylinderNextCohortPreflightHtml,
  serializeCylinderNextCohortPreflight,
  type CylinderNextCohortPreflightBuildInput,
} from "./bestBottlesCylinderNextCohortPreflight";

const sha = (character: string): string => character.repeat(64);
const sha256 = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

const geometryByFinish = {
  "Black Matte": ["53.0", "72.0"],
  "Black Shiny": ["53.0", "72.0"],
  "Gold Matte": ["54.2", "66.8"],
  "Gold Shiny": ["54.2", "66.8"],
} as const;

function validInput(): CylinderNextCohortPreflightBuildInput {
  const canonicalRows = NEXT_COHORT_IDENTITIES.map((identity, index) => {
    const [body, assembled] = geometryByFinish[identity.closureFinish];
    return {
      graceSku: identity.graceSku,
      websiteSku: identity.websiteSku,
      productGroupSlug: "cylinder-5ml-clear-13-415-finemist",
      family: "Cylinder",
      category: "Glass Bottle",
      bottleCollection: "Cylinder",
      color: "Clear",
      capacityMl: "5",
      material: "Glass",
      glassFinish: "Clear",
      canon_bodyHeightMm: body,
      canon_widthAxisMm: "17.0",
      canon_secondAxisMm: "17.0",
      canon_heightWithCapMm: assembled,
      applicator: "Fine Mist Sprayer",
      capStyle: "Spray",
      capColor: identity.closureFinish.replace("Black", "Black").replace("Gold", "Gold"),
      trimColor: "",
      itemName: `Fixture ${index + 1}`,
    };
  });
  const rows = NEXT_COHORT_IDENTITIES.map((identity, index) => {
    const canonical = canonicalRows[index];
    const sourceSha256 = sha(String(index + 1));
    const referenceSha256 = sha(String(index + 5));
    const sourceLocator = `tmp/reference-${index + 1}.png`;
    return {
      canonicalIdentityKey: identity.canonicalIdentityKey,
      websiteSku: identity.websiteSku,
      graceSku: identity.graceSku,
      canonicalFamily: "Cylinder",
      route: "approved-detached-dual-role",
      canonical: {
        websiteSku: identity.websiteSku,
        graceSku: identity.graceSku,
        family: "Cylinder",
        productGroupSlug: canonical.productGroupSlug,
        capacityMl: "5",
        canon_bodyHeightMm: canonical.canon_bodyHeightMm,
        canon_widthAxisMm: canonical.canon_widthAxisMm,
        canon_secondAxisMm: canonical.canon_secondAxisMm,
        canon_heightWithCapMm: canonical.canon_heightWithCapMm,
      },
      evidence: {
        lane: "approved-recovery",
        classification: "detached-cap-or-sidecar",
        sourceSha256,
        referenceSha256,
        width: 600,
        height: 975,
        resolutionStatus: "low-resolution",
        sourceLocator,
        opaque: true,
        originalBackgroundEligible: true,
        verificationMethod: "sha256+sharp-alpha-scan",
      },
      roleJobs: [
        {
          jobId: identity.jobIds[0],
          jobType: "assemble-cap-on-reference",
          targetRole: "identity-cap-on",
          sourceEvidenceLane: "approved-recovery",
          reviewStatus: "sealed-input-review-pending",
        },
        {
          jobId: identity.jobIds[1],
          jobType: "preserve-cap-off-sidecar-reference",
          targetRole: "pdp-cap-off-sidecar",
          sourceEvidenceLane: "approved-recovery",
          reviewStatus: "sealed-input-review-pending",
        },
      ],
      blockers: [],
    };
  });
  const plan = {
    version: "best-bottles-cylinder-dual-role-remediation-v2",
    generatedAt: "2026-07-14T00:00:00.000Z",
    provenance: { inputs: {}, localEvidenceVerificationCount: 4 },
    authorization: {
      planMode: "read-only",
      outputState: "review-pending",
      remoteWrites: "forbidden",
      publishStatus: "not-authorized",
    },
    summary: {
      sourceIdentityCount: 4,
      cylinderIdentityCount: 4,
      vialHandoffCount: 0,
      strictBothRolesReadyCount: 0,
      currentLiveSidecarRemediationCount: 0,
      approvedDetachedDualRoleCount: 4,
      approvedTopologyExceptionCount: 0,
      hardBlockedNoEvidenceCount: 0,
      roleJobCount: 8,
      externalWriteCount: 0,
    },
    rows,
    sha256: "",
  } as any;
  plan.sha256 = computeCylinderDualRolePlanSha256(plan);
  const canonicalFileSha256 = sha("a");
  const planFileSha256 = sha("b");
  const jobs = rows.flatMap((row, identityIndex) => row.roleJobs.map((roleJob, roleIndex) => {
    const canonicalRow = canonicalRows[identityIndex] as any;
    const prompt = `Prompt for ${roleJob.jobId}`;
    return {
      workflowVersion: "best-bottles-cylinder-dual-role-runner-v1",
      jobId: roleJob.jobId,
      jobType: roleJob.jobType,
      canonicalIdentityKey: row.canonicalIdentityKey,
      websiteSku: row.websiteSku,
      graceSku: row.graceSku,
      role: roleJob.targetRole,
      route: row.route,
      evidenceLane: roleJob.sourceEvidenceLane,
      sourceLocator: row.evidence.sourceLocator,
      planSha256: plan.sha256,
      sourceSha256: row.evidence.sourceSha256,
      referenceSha256: row.evidence.referenceSha256,
      canonicalProductTruthFileSha256: canonicalFileSha256,
      canonicalProductTruthRecordSha256:
        computeCanonicalProductTruthRecordSha256(canonicalRow),
      prompt,
      promptSha256: sha256(prompt),
      deterministicOperation: null,
      deterministicOperationSha256: null,
      canonicalGeometrySha256: computeCanonicalGeometrySha256(row.canonical),
      outputRelativePath: `outputs/${identityIndex}-${roleIndex}.png`,
      status: "compiled-dry-run",
      reviewStatus: "review-pending",
      warnings: [],
    };
  }));
  return {
    sealedRunPlanSha256: plan.sha256,
    plan: {
      document: plan,
      actualFileSha256: planFileSha256,
    },
    compileAll: {
      actualFileSha256: sha("c"),
      document: {
        workflowVersion: "best-bottles-cylinder-dual-role-runner-v1",
        mode: "compile-only",
        planSha256: plan.sha256,
        planFileSha256,
        canonicalProductTruthFileSha256: canonicalFileSha256,
        selectedJobCount: 328,
        jobs,
        externalWriteCount: 0,
      },
    },
    canonicalProductTruth: {
      actualFileSha256: canonicalFileSha256,
      rows: canonicalRows as any,
    },
    references: rows.map((row) => ({
      sourceLocator: row.evidence.sourceLocator,
      actualSha256: row.evidence.referenceSha256,
      format: "png" as const,
      width: row.evidence.width,
      height: row.evidence.height,
      opaque: true,
    })),
  };
}

describe("Best Bottles next Cylinder cohort preflight", () => {
  it("builds the exact four-identity/eight-job generation-not-started artifact", () => {
    const artifact = buildCylinderNextCohortPreflight(validInput());

    assert.match(artifact.inputSetSha256, /^[a-f0-9]{64}$/);
    assert.equal(artifact.identities.length, 4);
    assert.equal(artifact.jobs.length, 8);
    assert.deepEqual(artifact.jobs.map((job) => job.jobId), [...NEXT_COHORT_JOB_IDS]);
    assert.deepEqual(artifact.jobs.map((job) => job.role), [
      "identity-cap-on", "pdp-cap-off-sidecar",
      "identity-cap-on", "pdp-cap-off-sidecar",
      "identity-cap-on", "pdp-cap-off-sidecar",
      "identity-cap-on", "pdp-cap-off-sidecar",
    ]);
    assert.deepEqual(artifact.identities.map((identity) => identity.closureFinish), [
      "Black Matte", "Black Shiny", "Gold Matte", "Gold Shiny",
    ]);
    assert.equal(artifact.identities[0].canonicalMeasurements.bodyHeightMm, 53);
    assert.equal(artifact.identities[2].canonicalMeasurements.assembledHeightMm, 66.8);
    assert.notEqual(
      artifact.identities[0].canonicalGeometrySha256,
      artifact.identities[2].canonicalGeometrySha256,
    );
    assert.equal(artifact.identities[0].sourceReference.disposition, "source-reference-only");
    assert.deepEqual(artifact.outputContract, {
      format: "png", width: 2080, height: 2288, opaque: true,
    });
    assert.equal(artifact.generationStatus, "not-started");
    assert.equal(artifact.humanVisualApproval, "not-recorded");
    assert.equal(artifact.promotionStatus, "not-promoted");
    assert.equal(artifact.externalWriteCount, 0);
  });

  it("is byte-idempotent and renders four relative-link source cards", () => {
    const first = buildCylinderNextCohortPreflight(validInput());
    const second = buildCylinderNextCohortPreflight(validInput());
    const firstJson = serializeCylinderNextCohortPreflight(first);
    const secondJson = serializeCylinderNextCohortPreflight(second);
    const firstHtml = renderCylinderNextCohortPreflightHtml(first);
    const secondHtml = renderCylinderNextCohortPreflightHtml(second);

    assert.equal(firstJson, secondJson);
    assert.equal(firstHtml, secondHtml);
    assert.match(firstHtml, /Preflight pass — generation not started — pilot approval required/);
    assert.equal((firstHtml.match(/class="source-card"/g) ?? []).length, 4);
    assert.match(firstHtml, /identity-cap-on/);
    assert.match(firstHtml, /pdp-cap-off-sidecar/);
    assert.match(firstHtml, /Black Matte/);
    assert.match(firstHtml, /54\.2 mm/);
    assert.match(firstHtml, /600 × 975/);
    assert.match(firstHtml, /src="\.\.\//);
    assert.doesNotMatch(firstHtml, /(?:src|href)="(?:https?:|file:|\/)/);
  });

  for (const scenario of [
    {
      name: "missing job",
      mutate(input: CylinderNextCohortPreflightBuildInput) { input.compileAll.document.jobs.pop(); },
      error: /missing|required.*job/i,
    },
    {
      name: "duplicate job",
      mutate(input: CylinderNextCohortPreflightBuildInput) { input.compileAll.document.jobs[1] = { ...input.compileAll.document.jobs[0] }; },
      error: /duplicate|required.*job/i,
    },
    {
      name: "crossed identity",
      mutate(input: CylinderNextCohortPreflightBuildInput) { input.compileAll.document.jobs[0].websiteSku = NEXT_COHORT_IDENTITIES[1].websiteSku; },
      error: /identity|cross/i,
    },
    {
      name: "extra job",
      mutate(input: CylinderNextCohortPreflightBuildInput) { input.compileAll.document.jobs.push({ ...input.compileAll.document.jobs[0], jobId: `${input.compileAll.document.jobs[0].jobId}-extra` }); },
      error: /exactly eight|extra|required.*job/i,
    },
    {
      name: "reordered job",
      mutate(input: CylinderNextCohortPreflightBuildInput) { input.compileAll.document.jobs.reverse(); },
      error: /order/i,
    },
    {
      name: "wrong route",
      mutate(input: CylinderNextCohortPreflightBuildInput) { input.compileAll.document.jobs[0].route = "strict-both-roles-ready"; },
      error: /route/i,
    },
    {
      name: "wrong role",
      mutate(input: CylinderNextCohortPreflightBuildInput) { input.compileAll.document.jobs[0].role = "pdp-cap-off-sidecar"; },
      error: /role/i,
    },
    {
      name: "stale plan",
      mutate(input: CylinderNextCohortPreflightBuildInput) { input.compileAll.document.jobs[0].planSha256 = sha("f"); },
      error: /plan SHA|stale/i,
    },
    {
      name: "mutated prompt",
      mutate(input: CylinderNextCohortPreflightBuildInput) { input.compileAll.document.jobs[0].prompt += " mutated"; },
      error: /prompt SHA/i,
    },
    {
      name: "mutated geometry",
      mutate(input: CylinderNextCohortPreflightBuildInput) { input.compileAll.document.jobs[0].canonicalGeometrySha256 = sha("f"); },
      error: /canonical geometry SHA/i,
    },
    {
      name: "mutated canonical row",
      mutate(input: CylinderNextCohortPreflightBuildInput) { input.canonicalProductTruth.rows[0].capColor = "Mutated"; },
      error: /canonical.*record SHA/i,
    },
    {
      name: "missing reference",
      mutate(input: CylinderNextCohortPreflightBuildInput) { input.references.pop(); },
      error: /reference/i,
    },
    {
      name: "reference byte mismatch",
      mutate(input: CylinderNextCohortPreflightBuildInput) { input.references[0].actualSha256 = sha("f"); },
      error: /reference.*byte|reference SHA/i,
    },
  ]) {
    it(`fails closed on ${scenario.name}`, () => {
      const input = validInput();
      scenario.mutate(input);
      assert.throws(() => buildCylinderNextCohortPreflight(input), scenario.error);
    });
  }
});
