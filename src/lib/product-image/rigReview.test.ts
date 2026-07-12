import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildRigReviewRequirements, isRigApprovalReady, type RigReviewEvidence } from "./rigReview";
import type { ShadowQaReport } from "./shadowQa";

const confirmed = { identity: true, applicatorState: true, surfaceAndCrop: true };

function shadowQa(status: "pass" | "review"): ShadowQaReport {
  return {
    status,
    failures: [],
    warnings: [],
    measurements: {
      contactGapPx: 0,
      contactCoreDensity: 0.36,
      rightExtensionPx: 18,
      rightExtensionRatio: 0.28,
      leftExtensionPx: 2,
      verticalDepthPx: 8,
      componentCount: 1,
      shadowPixelCount: 120,
    },
    target: {
      maxContactGapPx: 2,
      rightExtensionRatio: { min: 0.2, max: 0.3 },
      contract: "contact-back-right-v1",
    },
  };
}

function passingReview(overrides: Partial<RigReviewEvidence> = {}): RigReviewEvidence {
  return {
    required: true,
    applied: true,
    reason: "Canonical Best Bottles master.",
    framingDecision: "pass",
    framingQa: {
      status: "pass",
      failures: [],
      warnings: [],
      measurements: {
        fillHeightPct: 67,
        baselineYPx: 2082,
        targetBaselineYPx: 2082,
        baselineDeltaPx: 0,
        centerXPct: 50,
        targetCenterXPct: 50,
        centerDeltaPct: 0,
      },
      target: {
        family: "cylinder",
        profileId: "roller-bottle",
        relativeScaleZoneId: "small-cylinder",
        fillHeightPct: 67,
        fillHeightRangePct: { min: 65, max: 70 },
        baselinePct: 9,
        primaryObjectCenterXPct: 50,
      },
    },
    qaIssues: [],
    objectBounds: { left: 700, top: 550, right: 1380, bottom: 2082 },
    preTransformObjectBounds: { left: 760, top: 620, right: 1320, bottom: 2070 },
    shiftXPx: 8,
    shiftYPx: 12,
    scaleFactor: 1.04,
    maskControlled: false,
    shadowOwner: "rig",
    shadowQa: null,
    ...overrides,
  };
}

describe("rig review approval gate", () => {
  it("allows approval only when every required rig check passes", () => {
    const review = passingReview();
    assert.equal(isRigApprovalReady(review, confirmed), true);
    assert.equal(buildRigReviewRequirements(review).every((row) => row.status === "pass"), true);
  });

  it("blocks approval until non-measurable visual requirements are confirmed", () => {
    assert.equal(isRigApprovalReady(passingReview()), false);
    assert.equal(
      isRigApprovalReady(passingReview(), { ...confirmed, applicatorState: false }),
      false,
    );
  });

  it("blocks approval when visible rig evidence is missing", () => {
    assert.equal(isRigApprovalReady(null), false);
    assert.equal(
      isRigApprovalReady(passingReview({ applied: false, framingQa: null, objectBounds: null })),
      false,
    );
  });

  it("blocks approval when a measured requirement misses tolerance", () => {
    const review = passingReview();
    review.framingQa!.measurements.baselineDeltaPx = 11;
    assert.equal(isRigApprovalReady(review, confirmed), false);
    assert.equal(
      buildRigReviewRequirements(review).find((row) => row.id === "baseline")?.status,
      "fail",
    );
  });

  it("permits non-rig assets without manufacturing rig evidence", () => {
    assert.equal(
      isRigApprovalReady(
        passingReview({ required: false, applied: false, framingQa: null, objectBounds: null }),
      ),
      true,
    );
  });

  it("blocks model-owned approval until the shadow report passes", () => {
    assert.equal(
      isRigApprovalReady(
        passingReview({ shadowOwner: "model", shadowQa: shadowQa("review") }),
        confirmed,
      ),
      false,
    );
    assert.equal(
      isRigApprovalReady(
        passingReview({ shadowOwner: "rig", shadowQa: null }),
        confirmed,
      ),
      true,
    );
  });
});
