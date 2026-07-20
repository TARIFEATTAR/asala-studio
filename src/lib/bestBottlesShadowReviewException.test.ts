import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isBestBottlesShadowReviewExceptionValid,
  type BestBottlesShadowReviewException,
  type BestBottlesShadowReviewEvidence,
} from "./bestBottlesShadowReviewException";

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);
const HASH_C = "c".repeat(64);
const HASH_D = "d".repeat(64);
const HASH_E = "e".repeat(64);

function fixture(): {
  exception: BestBottlesShadowReviewException;
  evidence: BestBottlesShadowReviewEvidence;
} {
  return {
    exception: {
      policyVersion: "best-bottles-shadow-review-exception-v1",
      status: "active",
      reasonCode: "extension-ratio-boundary",
      reason: "Visible contact and direction are correct; extension is slightly outside the detector band.",
      imageId: "image-1",
      pipelineSkuJobId: "job-1",
      finalImageHash: HASH_A,
      sourceReferenceHash: HASH_B,
      promptHash: HASH_C,
      shadowReportHash: HASH_D,
      shadowTopologyHash: HASH_E,
      shadowContract: "contact-back-right-v1",
      shadowTopologyKind: "assembled",
      expectedContacts: ["bottle"],
      reviewerId: "reviewer-1",
      createdAt: "2026-07-13T15:00:00.000Z",
      revokedAt: null,
    },
    evidence: {
      imageId: "image-1",
      pipelineSkuJobId: "job-1",
      finalImageHash: HASH_A,
      sourceReferenceHash: HASH_B,
      promptHash: HASH_C,
      shadowReportHash: HASH_D,
      shadowTopologyHash: HASH_E,
      geometryReady: true,
      identityReady: true,
      shadowTopology: {
        kind: "assembled",
        expectedContacts: ["bottle"],
      },
      shadowQa: {
        status: "review",
        contract: "contact-back-right-v1",
        contacts: [{
          contact: "bottle",
          status: "review",
          bounds: { left: 10, right: 80, top: 90, bottom: 110 },
          shadowPixelCount: 700,
          failures: ["right extension ratio is 0.31"],
        }],
      },
    },
  };
}

describe("Best Bottles shadow review exceptions", () => {
  it("accepts an active exact-hash exception for a present but borderline shadow", () => {
    const { exception, evidence } = fixture();
    assert.equal(isBestBottlesShadowReviewExceptionValid(exception, evidence), true);
  });

  it("fails closed when any immutable image, prompt, source, report, or topology hash drifts", () => {
    const fields = [
      "finalImageHash",
      "sourceReferenceHash",
      "promptHash",
      "shadowReportHash",
      "shadowTopologyHash",
    ] as const;
    for (const field of fields) {
      const { exception, evidence } = fixture();
      assert.equal(
        isBestBottlesShadowReviewExceptionValid(
          { ...exception, [field]: "f".repeat(64) },
          evidence,
        ),
        false,
        field,
      );
    }
  });

  it("never overrides missing contacts, absent bounds, identity drift, or geometry failure", () => {
    const { exception, evidence } = fixture();
    assert.equal(
      isBestBottlesShadowReviewExceptionValid(exception, {
        ...evidence,
        shadowQa: { ...evidence.shadowQa, contacts: [] },
      }),
      false,
    );
    assert.equal(
      isBestBottlesShadowReviewExceptionValid(exception, {
        ...evidence,
        shadowQa: {
          ...evidence.shadowQa,
          contacts: [{ ...evidence.shadowQa.contacts[0], bounds: null }],
        },
      }),
      false,
    );
    assert.equal(
      isBestBottlesShadowReviewExceptionValid(exception, { ...evidence, identityReady: false }),
      false,
    );
    assert.equal(
      isBestBottlesShadowReviewExceptionValid(exception, { ...evidence, geometryReady: false }),
      false,
    );
  });

  it("rejects revoked, free-form, and missing-shadow exceptions", () => {
    const { exception, evidence } = fixture();
    assert.equal(
      isBestBottlesShadowReviewExceptionValid(
        { ...exception, status: "revoked", revokedAt: "2026-07-13T16:00:00.000Z" },
        evidence,
      ),
      false,
    );
    assert.equal(
      isBestBottlesShadowReviewExceptionValid(
        { ...exception, reasonCode: "missing-contact" as typeof exception.reasonCode },
        evidence,
      ),
      false,
    );
    assert.equal(
      isBestBottlesShadowReviewExceptionValid(exception, {
        ...evidence,
        shadowQa: {
          ...evidence.shadowQa,
          contacts: [{
            ...evidence.shadowQa.contacts[0],
            shadowPixelCount: 0,
            failures: ["missing contact shadow"],
          }],
        },
      }),
      false,
    );
  });
});
