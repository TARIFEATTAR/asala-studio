import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ACTIVE_CYLINDER_MATERIAL_RENDERERS,
  BEST_BOTTLES_MATERIAL_PILOT_CANVAS,
  buildMaterialPilotCanonicalBodyScaleContract,
  buildRoleSemanticReviewChecklist,
  buildMaterialPilotScaleContract,
  buildWholeRasterNormalizationPlan,
  classifyMaterialPilotGatewayFailure,
  evaluateNativeBoneCanvas,
  evaluateMaterialPilotScaleQa,
  evaluateRoleSemanticQa,
  type MaterialPilotAttemptMetric,
  summarizeMaterialPilotAttempts,
  validateMaterialPilotRequest,
} from "./bestBottlesMaterialPilot.ts";

describe("attempt telemetry reconciliation", () => {
  it("classifies a Supabase idle timeout as a terminal gateway failure", () => {
    assert.deepEqual(
      classifyMaterialPilotGatewayFailure(504, {
        code: "IDLE_TIMEOUT",
        message: "Request idle timeout limit (150s) reached",
      }),
      {
        failureStage: "gateway",
        failureCode: "edge_idle_timeout",
        failureReasons: ["edge_idle_timeout_150s"],
        errorMessage: "Request idle timeout limit (150s) reached",
        durationMs: 150000,
      },
    );
    assert.equal(classifyMaterialPilotGatewayFailure(200, {}), null);
  });
});

describe("comparative catalog-scale lock", () => {
  it("keeps the six canonical Cylinder spray bodies monotonic through 100 ml", () => {
    const rows = [
      { capacityMl: 3, body: 37, width: 14, assembled: 54 },
      { capacityMl: 5, body: 53, width: 17, assembled: 72 },
      { capacityMl: 9, body: 70, width: 20, assembled: 96 },
      { capacityMl: 25, body: 83, width: 32, assembled: 108 },
      { capacityMl: 50, body: 117, width: 32, assembled: 142 },
      { capacityMl: 100, body: 154, width: 35, assembled: 195 },
    ].map((row) => buildMaterialPilotCanonicalBodyScaleContract({
      capacityMl: row.capacityMl,
      canonBodyHeightMm: row.body,
      canonBodyWidthMm: row.width,
      canonAssembledHeightMm: row.assembled,
    }));

    assert.deepEqual(rows.map((row) => row.bodyTargetPx), [878, 1027, 1151, 1287, 1470, 1540]);
    assert.ok(rows.every((row, index) => index === 0 || row.bodyTargetPx > rows[index - 1].bodyTargetPx));
    assert.ok(rows.every((row) => row.baselineYPx === 2082));
    assert.equal(rows[5].version, "best-bottles-canonical-body-scale-v2");
  });

  it("resolves the canonical 5 ml and regular 9 ml Cylinder bodies on one curve", () => {
    const five = buildMaterialPilotScaleContract({
      capacityMl: 5,
      canonBodyHeightMm: 53,
      canonBodyWidthMm: 17,
      canonAssembledHeightMm: 72,
    });
    const nine = buildMaterialPilotScaleContract({
      capacityMl: 9,
      canonBodyHeightMm: 70,
      canonBodyWidthMm: 20,
      canonAssembledHeightMm: 96,
    });

    assert.equal(five.bodyTargetPx, 1027);
    assert.equal(five.assembledTargetPct, 61);
    assert.equal(nine.bodyTargetPx, 1151);
    assert.equal(nine.assembledTargetPct, 69);
    assert.ok(nine.bodyTargetPx > five.bodyTargetPx);
    assert.equal(five.baselineYPx, nine.baselineYPx);
  });

  it("fails closed until bottle-body bounds are measured and ignores cap bounds", () => {
    const contract = buildMaterialPilotScaleContract({
      capacityMl: 5,
      canonBodyHeightMm: 53,
      canonBodyWidthMm: 17,
      canonAssembledHeightMm: 72,
    });
    assert.equal(evaluateMaterialPilotScaleQa(contract, null).status, "measurement-required");

    const pass = evaluateMaterialPilotScaleQa(contract, {
      left: 875,
      right: 1204,
      top: contract.baselineYPx - contract.bodyTargetPx + 1,
      bottom: contract.baselineYPx,
    });
    assert.equal(pass.status, "pass");

    const tooTall = evaluateMaterialPilotScaleQa(contract, {
      left: 850,
      right: 1229,
      top: 800,
      bottom: contract.baselineYPx,
    });
    assert.equal(tooTall.status, "fail");
    assert.ok(tooTall.failureReasons.includes("body_height_out_of_range"));
  });
});

describe("Cylinder material-upgrade renderer registry", () => {
  it("activates only GPT Image 2 and Nano Banana 2 while reserving Higgsfield", () => {
    assert.deepEqual(
      ACTIVE_CYLINDER_MATERIAL_RENDERERS.map((renderer) => ({
        id: renderer.id,
        model: renderer.model,
        active: renderer.active,
      })),
      [
        {
          id: "openai-gpt-image-2",
          model: "gpt-image-2",
          active: true,
        },
        {
          id: "google-nano-banana-2",
          model: "models/gemini-3.1-flash-image-preview",
          active: true,
        },
      ],
    );
  });
});

describe("native Bone canvas policy", () => {
  it("requires an exact opaque 2080x2288 GPT Image 2 response", () => {
    assert.deepEqual(
      buildWholeRasterNormalizationPlan("openai-gpt-image-2", 2080, 2288),
      {
        sourceWidth: 2080,
        sourceHeight: 2288,
        targetWidth: 2080,
        targetHeight: 2288,
        operations: [],
        backgroundMutationAllowed: false,
      },
    );
  });

  it("normalizes a square Nano Banana response only by symmetric crop and resize", () => {
    const plan = buildWholeRasterNormalizationPlan(
      "google-nano-banana-2",
      2048,
      2048,
    );

    assert.equal(plan.backgroundMutationAllowed, false);
    assert.deepEqual(plan.operations, [
      {
        kind: "crop",
        x: 93,
        y: 0,
        width: 1862,
        height: 2048,
      },
      {
        kind: "resize",
        width: 2080,
        height: 2288,
      },
    ]);
    assert.equal(
      plan.operations.some((operation) =>
        ["fill", "paint", "composite", "translate"].includes(operation.kind)
      ),
      false,
    );
  });

  it("accepts a uniform native Bone border and rejects a dark edge artifact", () => {
    const clean = evaluateNativeBoneCanvas([
      [245, 243, 239],
      [244, 242, 238],
      [246, 244, 240],
      [245, 243, 239],
    ]);
    assert.equal(clean.pass, true);

    const darkEdge = evaluateNativeBoneCanvas([
      [245, 243, 239],
      [245, 243, 239],
      [36, 36, 36],
      [245, 243, 239],
    ]);
    assert.equal(darkEdge.pass, false);
    assert.ok(darkEdge.failureReasons.includes("bone_border_color_drift"));
  });
});

describe("role-clean request validation", () => {
  const baseRequest = {
    family: "Cylinder",
    websiteSku: "GBCylBlu5SpryBlkSh",
    graceSku: "GB-CYL-CBL-5ML-SPR-BLK",
    rendererId: "openai-gpt-image-2" as const,
    assetRole: "sidecar" as const,
    prompt: "role-clean prompt",
    canonicalTruthHash: "a".repeat(64),
    references: [
      {
        role: "sidecar-product-truth" as const,
        url: "https://example.com/sidecar.png",
        sha256: "b".repeat(64),
      },
    ],
  };

  it("accepts an exact sidecar reference for a sidecar job", () => {
    assert.deepEqual(validateMaterialPilotRequest(baseRequest), {
      ok: true,
      issues: [],
    });
  });

  it("rejects cap-on evidence in a sidecar job", () => {
    const result = validateMaterialPilotRequest({
      ...baseRequest,
      references: [{
        ...baseRequest.references[0],
        role: "cap-on-product-truth" as const,
      }],
    });

    assert.equal(result.ok, false);
    assert.match(result.issues.join("\n"), /sidecar-product-truth/);
  });

  it("rejects non-Cylinder work and disabled renderers", () => {
    const result = validateMaterialPilotRequest({
      ...baseRequest,
      family: "Boston Round",
      rendererId: "higgsfield-future" as const,
    });

    assert.equal(result.ok, false);
    assert.match(result.issues.join("\n"), /Cylinder/);
    assert.match(result.issues.join("\n"), /not active/);
  });
});

describe("role-specific semantic QA", () => {
  it("builds different required checks for sidecar and cap-on roles", () => {
    assert.ok(
      buildRoleSemanticReviewChecklist("sidecar").requiredChecks.includes(
        "exactly_one_detached_cap",
      ),
    );
    assert.ok(
      buildRoleSemanticReviewChecklist("cap-on").requiredChecks.includes(
        "no_detached_cap",
      ),
    );
  });

  it("rejects an assembled cap in a sidecar output", () => {
    const result = evaluateRoleSemanticQa({
      assetRole: "sidecar",
      productCount: 1,
      detachedCapCount: 1,
      assembledCapPresent: true,
      fitmentPresent: true,
      extraComponentCount: 0,
      closureIdentityMatch: true,
      materialIdentityMatch: true,
      sharedBaselinePass: true,
    });

    assert.equal(result.decision, "reject");
    assert.ok(result.failureReasons.includes("sidecar_has_assembled_cap"));
  });

  it("passes a single exact assembled cap-on product", () => {
    const result = evaluateRoleSemanticQa({
      assetRole: "cap-on",
      productCount: 1,
      detachedCapCount: 0,
      assembledCapPresent: true,
      fitmentPresent: true,
      extraComponentCount: 0,
      closureIdentityMatch: true,
      materialIdentityMatch: true,
      sharedBaselinePass: true,
    });

    assert.deepEqual(result, {
      decision: "pass",
      failureReasons: [],
      humanReviewRequired: true,
      publishEligible: false,
    });
  });
});

describe("benchmark attempt aggregation", () => {
  it("reports approval, latency, failure reasons, and cost per approved image", () => {
    const attempts: MaterialPilotAttemptMetric[] = [
      {
        rendererId: "openai-gpt-image-2",
        jobKey: "job-a",
        attemptOrdinal: 1,
        providerStatus: "completed",
        humanDecision: "approved-keep",
        failureReasons: [],
        durationMs: 120_000,
        estimatedCostUsd: 0.20,
        nativeBonePass: true,
      },
      {
        rendererId: "openai-gpt-image-2",
        jobKey: "job-b",
        attemptOrdinal: 1,
        providerStatus: "completed",
        humanDecision: "needs-regen",
        failureReasons: ["incorrect_closure"],
        durationMs: 180_000,
        estimatedCostUsd: 0.20,
        nativeBonePass: false,
      },
      {
        rendererId: "google-nano-banana-2",
        jobKey: "job-a",
        attemptOrdinal: 1,
        providerStatus: "failed",
        humanDecision: null,
        failureReasons: ["provider_error"],
        durationMs: 30_000,
        estimatedCostUsd: 0.05,
        nativeBonePass: null,
      },
    ];

    const report = summarizeMaterialPilotAttempts(attempts);
    const openai = report.byRenderer.find((row) =>
      row.rendererId === "openai-gpt-image-2"
    );

    assert.equal(report.totalAttempts, 3);
    assert.equal(openai?.returnedVisualAttempts, 2);
    assert.equal(openai?.approvedAttempts, 1);
    assert.equal(openai?.approvalRate, 0.5);
    assert.equal(openai?.firstPassApprovalRate, 0.5);
    assert.equal(openai?.nativeBonePassRate, 0.5);
    assert.equal(openai?.totalEstimatedCostUsd, 0.4);
    assert.equal(openai?.costPerApprovedImageUsd, 0.4);
    assert.deepEqual(openai?.failureReasonCounts, { incorrect_closure: 1 });
    assert.equal(openai?.medianDurationMs, 150_000);
    assert.deepEqual(BEST_BOTTLES_MATERIAL_PILOT_CANVAS, {
      width: 2080,
      height: 2288,
      backgroundHex: "#F5F3EF",
    });
  });
});
