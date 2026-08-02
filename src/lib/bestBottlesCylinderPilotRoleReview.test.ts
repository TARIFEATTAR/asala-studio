import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";

import type { CylinderDualRoleRemediationPlan } from "./bestBottlesCylinderDualRoleRemediation";
import {
  computeCanonicalGeometrySha256,
  computeCylinderDualRolePlanSha256,
} from "./bestBottlesCylinderDualRoleRunner";
import {
  PILOT_SUPPORTING_IDENTITY_EVIDENCE,
  buildCylinderPilotRoleReview,
  renderCylinderPilotRoleReviewHtml,
  type CylinderPilotRoleReviewBuildInput,
} from "./bestBottlesCylinderPilotRoleReview";

const sha = (character: string): string => character.repeat(64);
const sha256Text = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

const PILOT_ROLE_JOBS = [
  {
    jobId: "GBCYLBLU5SPRYBLKSH|GBCYLBLU5MLSPRSBLK|assemble-cap-on-reference",
    jobType: "assemble-cap-on-reference" as const,
    targetRole: "identity-cap-on" as const,
    sourceEvidenceLane: "approved-recovery" as const,
    reviewStatus: "sealed-input-review-pending" as const,
  },
  {
    jobId: "GBCYLBLU5SPRYBLKSH|GBCYLBLU5MLSPRSBLK|preserve-cap-off-sidecar-reference",
    jobType: "preserve-cap-off-sidecar-reference" as const,
    targetRole: "pdp-cap-off-sidecar" as const,
    sourceEvidenceLane: "approved-recovery" as const,
    reviewStatus: "sealed-input-review-pending" as const,
  },
];

function remediationPlan(): CylinderDualRoleRemediationPlan {
  const plan = {
    version: "best-bottles-cylinder-dual-role-remediation-v2",
    generatedAt: "2026-07-14T00:00:00.000Z",
    provenance: {
      inputs: {
        fixture: { path: "tmp/fixture.json", sha256: sha("9") },
      },
      localEvidenceVerificationCount: 136,
    },
    authorization: {
      planMode: "read-only",
      outputState: "review-pending",
      remoteWrites: "forbidden",
      publishStatus: "not-authorized",
    },
    summary: {
      sourceIdentityCount: 377,
      cylinderIdentityCount: 375,
      vialHandoffCount: 2,
      strictBothRolesReadyCount: 172,
      currentLiveSidecarRemediationCount: 56,
      approvedDetachedDualRoleCount: 123,
      approvedTopologyExceptionCount: 13,
      hardBlockedNoEvidenceCount: 11,
      roleJobCount: 2,
      externalWriteCount: 0,
    },
    rows: [{
      canonicalIdentityKey: "GBCYLBLU5SPRYBLKSH|GBCYLBLU5MLSPRSBLK",
      websiteSku: "GBCylBlu5SpryBlkSh",
      graceSku: "GB-CYL-BLU-5ML-SPR-SBLK",
      canonicalFamily: "Cylinder",
      route: "approved-detached-dual-role",
      canonical: {
        websiteSku: "GBCylBlu5SpryBlkSh",
        graceSku: "GB-CYL-BLU-5ML-SPR-SBLK",
        family: "Cylinder",
        productGroupSlug: "cylinder-blue-5ml",
        capacityMl: "5",
        canon_bodyHeightMm: "53.0",
        canon_widthAxisMm: "17.0",
        canon_secondAxisMm: "17.0",
        canon_heightWithCapMm: "72.0",
      },
      evidence: {
        lane: "approved-recovery",
        classification: "detached-cap-sidecar",
        sourceSha256: sha("b"),
        referenceSha256: sha("c"),
        width: 2080,
        height: 2288,
        resolutionStatus: "approved",
        sourceLocator: "tmp/reference.png",
        opaque: true,
        originalBackgroundEligible: true,
        verificationMethod: "sha256+sharp-alpha-scan",
      },
      roleJobs: PILOT_ROLE_JOBS,
      blockers: [],
    }],
    sha256: "",
  } satisfies CylinderDualRoleRemediationPlan;
  plan.sha256 = computeCylinderDualRolePlanSha256(plan);
  return plan;
}

function framingQa(role: "identity-cap-on" | "pdp-cap-off-sidecar") {
  return {
    status: "pass" as const,
    failures: [],
    warnings: [],
    primaryBounds: role === "identity-cap-on"
      ? { top: 706, bottom: 2082, left: 760, right: 1306 }
      : { top: 706, bottom: 2080, left: 656, right: 1424 },
    measurements: {
      fillHeightPct: role === "identity-cap-on" ? 60.2 : 60.1,
      baselineYPx: role === "identity-cap-on" ? 2082 : 2081,
      targetBaselineYPx: 2082,
      baselineDeltaPx: role === "identity-cap-on" ? 0 : -1,
      centerXPct: role === "identity-cap-on" ? 49.7 : 50,
      targetCenterXPct: 50,
      centerDeltaPct: role === "identity-cap-on" ? -0.3 : 0,
    },
    target: {
      family: "cylinder" as const,
      profileId: "cylinder-standard",
      relativeScaleZoneId: "small-cylinder",
      fillHeightPct: 61,
      fillHeightRangePct: { min: 59, max: 63 },
      baselinePct: 9,
      primaryObjectCenterXPct: 50,
    },
  };
}

function shadowQa(role: "identity-cap-on" | "pdp-cap-off-sidecar") {
  const contacts = role === "identity-cap-on"
    ? [{
        contact: "bottle" as const,
        status: "pass" as const,
        bounds: { top: 706, bottom: 2082, left: 760, right: 1306 },
        measurements: {
          contactGapPx: 0,
          contactCoreDensity: 0.67,
          rightExtensionPx: 0,
          rightExtensionRatio: 0,
          leftExtensionPx: 0,
          verticalDepthPx: 56,
          componentCount: 1,
          shadowPixelCount: 13697,
        },
        failures: [],
        warnings: ["Shadow right extension ratio 0.000 is below the target zone."],
      }]
    : [
        {
          contact: "bottle" as const,
          status: "pass" as const,
          bounds: { top: 706, bottom: 2081, left: 709, right: 1075 },
          measurements: {
            contactGapPx: 0,
            contactCoreDensity: 0.8,
            rightExtensionPx: 0,
            rightExtensionRatio: 0,
            leftExtensionPx: 0,
            verticalDepthPx: 47,
            componentCount: 1,
            shadowPixelCount: 8020,
          },
          failures: [],
          warnings: ["Shadow right extension ratio 0.000 is below the target zone."],
        },
        {
          contact: "sidecar" as const,
          status: "pass" as const,
          bounds: { top: 1417, bottom: 2081, left: 1160, right: 1483 },
          measurements: {
            contactGapPx: 0,
            contactCoreDensity: 0.96,
            rightExtensionPx: 16,
            rightExtensionRatio: 0.049,
            leftExtensionPx: 33,
            verticalDepthPx: 80,
            componentCount: 1,
            shadowPixelCount: 21492,
          },
          failures: [],
          warnings: ["Shadow right extension ratio 0.049 is below the target zone."],
        },
      ];
  return {
    status: "pass" as const,
    failures: [],
    warnings: contacts.flatMap((contact) => contact.warnings),
    contacts,
    measurements: contacts[0].measurements,
    target: {
      maxContactGapPx: 2 as const,
      rightExtensionRatio: { min: 0.2 as const, max: 0.3 as const },
      contract: "contact-back-right-v1" as const,
    },
  };
}

function roleInput(
  role: "identity-cap-on" | "pdp-cap-off-sidecar",
  planSha256: string,
  canonicalGeometrySha256: string,
) {
  const capOn = role === "identity-cap-on";
  const prompt = capOn ? "Assemble the cap on the bottle." : "Preserve the detached sidecar cap.";
  return {
    websiteSku: "GBCylBlu5SpryBlkSh",
    graceSku: "GB-CYL-BLU-5ML-SPR-SBLK",
    role,
    topology: capOn ? "assembled" as const : "detached" as const,
    jobId: capOn
      ? "GBCYLBLU5SPRYBLKSH|GBCYLBLU5MLSPRSBLK|assemble-cap-on-reference"
      : "GBCYLBLU5SPRYBLKSH|GBCYLBLU5MLSPRSBLK|preserve-cap-off-sidecar-reference",
    jobType: capOn
      ? "assemble-cap-on-reference" as const
      : "preserve-cap-off-sidecar-reference" as const,
    planSha256,
    sourceSha256: sha("b"),
    referenceSha256: sha("c"),
    prompt,
    promptSha256: sha256Text(prompt),
    canonicalGeometrySha256,
    evidenceLocator: "tmp/reference.png",
    actualReferenceSha256: sha("c"),
    referenceVerification: "direct-locator-bytes" as const,
    sourceVerification: "sealed-plan-semantic-sha-no-byte-locator" as const,
    recordFileSha256: capOn ? sha("1") : sha("2"),
    rawInputSha256: capOn ? sha("3") : sha("4"),
    rawInputSha256After: capOn ? sha("3") : sha("4"),
    pass1InputSha256: capOn ? sha("3") : sha("4"),
    pass1OutputSha256: capOn ? sha("5") : sha("6"),
    pass2InputSha256: capOn ? sha("5") : sha("6"),
    pass2OutputSha256: capOn ? sha("7") : sha("8"),
    png: {
      relativePath: capOn
        ? "normalized/framing-recovery-v3/GBCylBlu5SpryBlkSh__GB-CYL-BLU-5ML-SPR-SBLK__identity-cap-on/pass-02.png"
        : "normalized/framing-recovery-v3/GBCylBlu5SpryBlkSh__GB-CYL-BLU-5ML-SPR-SBLK__pdp-cap-off-sidecar/pass-02.png",
      actualSha256: capOn ? sha("7") : sha("8"),
      format: "png" as const,
      width: 2080,
      height: 2288,
      opaque: true,
    },
    framingDecision: "pass" as const,
    qaIssues: [],
    framingQa: framingQa(role),
    recordedShadowQaStatus: "fail" as const,
    recomputedShadowQa: shadowQa(role),
  };
}

function validInput(): CylinderPilotRoleReviewBuildInput {
  const document = remediationPlan();
  const planSha256 = document.sha256;
  const canonicalGeometrySha256 = computeCanonicalGeometrySha256(document.rows[0].canonical);
  const roles = [
    roleInput("identity-cap-on", planSha256, canonicalGeometrySha256),
    roleInput("pdp-cap-off-sidecar", planSha256, canonicalGeometrySha256),
  ];
  return {
    sealedRunPlanSha256: planSha256,
    plan: {
      version: "best-bottles-cylinder-dual-role-remediation-v2",
      semanticSha256: planSha256,
      recordedFileSha256: sha("9"),
      actualFileSha256: sha("9"),
      document,
      authorization: {
        planMode: "read-only",
        outputState: "review-pending",
        remoteWrites: "forbidden",
        publishStatus: "not-authorized",
      },
      identity: {
        websiteSku: "GBCylBlu5SpryBlkSh",
        graceSku: "GB-CYL-BLU-5ML-SPR-SBLK",
        canonicalIdentityKey: "GBCYLBLU5SPRYBLKSH|GBCYLBLU5MLSPRSBLK",
        roleJobs: [...PILOT_ROLE_JOBS],
      },
    },
    compiledJobsFileSha256: sha("0"),
    compiledJobs: roles.map((role) => ({
      websiteSku: role.websiteSku,
      graceSku: role.graceSku,
      role: role.role,
      jobId: role.jobId,
      jobType: role.jobType,
      planSha256: role.planSha256,
      sourceSha256: role.sourceSha256,
      referenceSha256: role.referenceSha256,
      sourceLocator: role.evidenceLocator,
      prompt: role.prompt,
      promptSha256: role.promptSha256,
      canonicalGeometrySha256: role.canonicalGeometrySha256,
    })),
    roles: [
      roles[1],
      roles[0],
    ],
    supportingIdentityEvidence: { ...PILOT_SUPPORTING_IDENTITY_EVIDENCE },
  };
}

describe("Best Bottles Cylinder pilot role review", () => {
  it("builds a deterministic review-pending artifact only when both exact roles pass", () => {
    const artifact = buildCylinderPilotRoleReview(validInput());

    assert.match(artifact.inputSetSha256, /^[a-f0-9]{64}$/);
    assert.equal(artifact.machineStatus, "pass");
    assert.equal(artifact.reviewStatus, "review-pending");
    assert.equal(artifact.humanVisualApproval, "not-recorded");
    assert.equal(artifact.promotionStatus, "not-promoted");
    assert.equal(artifact.externalWriteCount, 0);
    assert.deepEqual(artifact.roles.map((entry) => entry.role), [
      "identity-cap-on",
      "pdp-cap-off-sidecar",
    ]);
    assert.equal(artifact.roles[0].png.width, 2080);
    assert.equal(artifact.roles[1].shadowQa.contacts?.[1]?.contact, "sidecar");
    assert.equal(artifact.roles[0].recordedShadowQaStatus, "fail");
    assert.equal(artifact.roles[0].shadowQaSource, "recomputed-current-detector");
    assert.equal(artifact.supportingIdentityEvidence.disposition, "supporting-identity-only");

    const reordered = validInput();
    reordered.roles.reverse();
    assert.equal(
      buildCylinderPilotRoleReview(reordered).inputSetSha256,
      artifact.inputSetSha256,
    );
  });

  it("renders actual pass-02 links and never labels machine pass as human approval", () => {
    const html = renderCylinderPilotRoleReviewHtml(
      buildCylinderPilotRoleReview(validInput()),
    );

    assert.match(html, /Machine pass — human visual review pending — not promoted/);
    assert.match(html, /\.\.\/\.\.\/normalized\/framing-recovery-v3\//);
    assert.match(html, /2080 × 2288/);
    assert.match(html, /Baseline 2082/);
    assert.match(html, /Fill 60\.2%/);
    assert.match(html, /sidecar/);
    assert.match(html, /supporting-identity-only/);
    assert.doesNotMatch(html, /human visual approval:\s*approved/i);
    assert.doesNotMatch(html, /<img[^>]+e84f9957/i);
  });

  it("fails closed on mutated seals and hash discontinuity", () => {
    const planHash = validInput();
    planHash.plan.actualFileSha256 = sha("a");
    assert.throws(() => buildCylinderPilotRoleReview(planHash), /plan file SHA/i);

    const jobHash = validInput();
    jobHash.compiledJobs[0].sourceSha256 = sha("a");
    assert.throws(() => buildCylinderPilotRoleReview(jobHash), /source SHA/i);

    const passChain = validInput();
    passChain.roles[0].pass2InputSha256 = sha("a");
    assert.throws(() => buildCylinderPilotRoleReview(passChain), /pass.*input SHA/i);

    const outputHash = validInput();
    outputHash.roles[0].png.actualSha256 = sha("a");
    assert.throws(() => buildCylinderPilotRoleReview(outputHash), /output SHA/i);
  });

  it("fails closed on stale detector output and role crossing", () => {
    const stale = validInput();
    stale.roles[0].recomputedShadowQa.status = "fail";
    stale.roles[0].recomputedShadowQa.failures = ["stale detector failure"];
    assert.throws(() => buildCylinderPilotRoleReview(stale), /recomputed shadow QA/i);

    const crossed = validInput();
    crossed.roles[0].role = "identity-cap-on";
    assert.throws(() => buildCylinderPilotRoleReview(crossed), /required role|duplicate/i);

    const crossedJob = validInput();
    crossedJob.roles[0].jobType = "assemble-cap-on-reference";
    assert.throws(() => buildCylinderPilotRoleReview(crossedJob), /job type|role/i);
  });

  it("fails closed on invalid PNG proof or an absent role", () => {
    const transparent = validInput();
    transparent.roles[0].png.opaque = false;
    assert.throws(() => buildCylinderPilotRoleReview(transparent), /opaque/i);

    for (const [width, height] of [[2079, 2288], [2080, 2287]]) {
      const wrongDimensions = validInput();
      wrongDimensions.roles[0].png.width = width;
      wrongDimensions.roles[0].png.height = height;
      assert.throws(
        () => buildCylinderPilotRoleReview(wrongDimensions),
        /2080 × 2288/i,
      );
    }

    const absent = validInput();
    absent.roles = absent.roles.filter((entry) => entry.role !== "identity-cap-on");
    assert.throws(() => buildCylinderPilotRoleReview(absent), /required role/i);
  });

  it("rejects any attempt to elevate the supporting screenshot to authority", () => {
    const input = validInput();
    (input.supportingIdentityEvidence as { promotable: boolean }).promotable = true;
    assert.throws(
      () => buildCylinderPilotRoleReview(input),
      /supporting identity evidence/i,
    );
  });
});
