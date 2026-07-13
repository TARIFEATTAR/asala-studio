import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";

import type {
  PsdAuditRecord,
  PsdIdentityStatus,
  PsdReviewUnit,
} from "./bestBottlesPsdCapStateAudit";
import {
  applyPsdReviewDecisions,
  validatePsdReviewDecision,
} from "./bestBottlesPsdReviewDecisions";

function makeUnit(input: {
  key: string;
  hash?: string;
  identityStatus?: PsdIdentityStatus;
}): PsdReviewUnit {
  const identityStatus = input.identityStatus ?? "exact-website-sku";
  const sourceSha256 = input.hash ?? createHash("sha256").update(input.key).digest("hex");
  const websiteSku = identityStatus === "exact-website-sku" ? `WEB-${input.key}` : null;
  const graceSku = identityStatus === "exact-grace-sku" ? `GB-${input.key}` : null;
  const record = {
    sourcePath: `/archive/${input.key}.psd`,
    sourceRelativePath: `${input.key}.psd`,
    sourceSha256,
    sourceBytes: 100,
    family: "Cylinder",
    identityReasons: [],
    composite: null,
    machineTriage: {
      proposedClassification: "ambiguous-manual-review",
      confidence: "low",
      reasons: ["visual_review_required"],
    },
    identityStatus,
    websiteSku,
    graceSku,
    aliasProvenance: null,
    reviewStatus: "pending-human-review",
    reviewer: null,
    reviewedAt: null,
  } as PsdAuditRecord;
  return {
    reviewUnitKey: input.key,
    sourceSha256,
    websiteSku,
    graceSku,
    family: "Cylinder",
    sources: [record],
    representative: record,
  };
}

const exactUnit = makeUnit({ key: "exact" });
const ambiguousUnit = makeUnit({ key: "ambiguous", identityStatus: "ambiguous" });
const validDecision = {
  reviewUnitKey: exactUnit.reviewUnitKey,
  sourceSha256: exactUnit.sourceSha256,
  decision: "assembled-cap-on" as const,
  reviewer: "Jordan Richter",
  reviewedAt: "2026-07-12T20:00:00-07:00",
  notes: "reviewed against the composite",
};

describe("PSD human review decision validation", () => {
  it("requires a named reviewer and ISO timestamp for an approved state", () => {
    // @ts-expect-error -- Intentionally omits sourceSha256 to exercise the runtime reviewer guard.
    assert.throws(() => validatePsdReviewDecision({
      reviewUnitKey: "unit",
      decision: "assembled-cap-on",
      reviewer: "",
      reviewedAt: "",
      notes: "",
    }), /reviewer/i);

    assert.throws(() => validatePsdReviewDecision({
      ...validDecision,
      reviewedAt: "July 12, 2026",
    }), /timestamp|ISO/i);
    assert.throws(() => validatePsdReviewDecision({
      ...validDecision,
      reviewedAt: "2026-02-31T20:00:00Z",
    }), /timestamp|ISO/i);
  });

  it("rejects a machine reviewer and unsupported decisions", () => {
    assert.throws(() => validatePsdReviewDecision({
      ...validDecision,
      reviewer: "machine",
    }), /human reviewer/i);
    assert.throws(() => validatePsdReviewDecision({
      ...validDecision,
      decision: "approved" as never,
    }), /decision/i);
  });

  it("requires a valid SHA-256 source hash for every completed decision", () => {
    for (const sourceSha256 of [undefined, "", "not-a-sha-256"]) {
      assert.throws(() => validatePsdReviewDecision({
        ...validDecision,
        sourceSha256,
      } as unknown as Parameters<typeof validatePsdReviewDecision>[0]), /source hash|SHA-256/i);
    }
  });

  it("rejects approval when canonical identity is ambiguous or conflicting", () => {
    for (const unit of [ambiguousUnit, makeUnit({ key: "conflict", identityStatus: "conflict" })]) {
      assert.throws(() => applyPsdReviewDecisions({
        reviewUnits: [unit],
        decisions: [{ ...validDecision, reviewUnitKey: unit.reviewUnitKey, sourceSha256: unit.sourceSha256 }],
      }), /identity/i);
    }
  });

  it("keeps unreviewed units pending and records them in the worklist", () => {
    const units = [exactUnit, ambiguousUnit];
    const result = applyPsdReviewDecisions({ reviewUnits: units, decisions: [] });
    assert.equal(result.reviewed.length, 0);
    assert.equal(result.approved.length, 0);
    assert.equal(result.pending.length, units.length);
  });

  it("rejects duplicate rows, unknown keys, and source-hash mismatches", () => {
    assert.throws(() => applyPsdReviewDecisions({
      reviewUnits: [exactUnit],
      decisions: [validDecision, validDecision],
    }), /duplicate/i);
    assert.throws(() => applyPsdReviewDecisions({
      reviewUnits: [exactUnit],
      decisions: [{ ...validDecision, reviewUnitKey: "unknown" }],
    }), /unknown/i);
    assert.throws(() => applyPsdReviewDecisions({
      reviewUnits: [exactUnit],
      decisions: [{ ...validDecision, sourceSha256: "f".repeat(64) }],
    }), /hash/i);
  });

  it("never propagates a decision to another review unit by hash alone", () => {
    const sharedHash = "b".repeat(64);
    const reviewed = makeUnit({ key: "reviewed", hash: sharedHash });
    const untouched = makeUnit({ key: "untouched", hash: sharedHash });
    const result = applyPsdReviewDecisions({
      reviewUnits: [reviewed, untouched],
      decisions: [{ ...validDecision, reviewUnitKey: reviewed.reviewUnitKey, sourceSha256: sharedHash }],
    });

    assert.deepEqual(result.approved.map((row) => row.reviewUnitKey), [reviewed.reviewUnitKey]);
    assert.deepEqual(result.pending.map((row) => row.reviewUnitKey), [untouched.reviewUnitKey]);
  });

  it("retains human provenance for a blocked identity outcome", () => {
    const result = applyPsdReviewDecisions({
      reviewUnits: [ambiguousUnit],
      decisions: [{
        ...validDecision,
        reviewUnitKey: ambiguousUnit.reviewUnitKey,
        sourceSha256: ambiguousUnit.sourceSha256,
        decision: "blocked",
      }],
    });

    assert.equal(result.blocked.length, 1);
    assert.deepEqual(result.blocked[0].reviewer, { kind: "human", identity: "Jordan Richter" });
    assert.equal(result.blocked[0].reviewedAt, new Date(validDecision.reviewedAt).toISOString());
    assert.equal(result.approved.length, 0);
  });
});
