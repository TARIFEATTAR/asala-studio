import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";

import type {
  PsdAuditRecord,
  PsdIdentityStatus,
  PsdReviewUnit,
} from "./bestBottlesPsdCapStateAudit";
import { buildPsdReviewUnitKey } from "./bestBottlesPsdCapStateAudit";
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
    canonicalReviewMetadata: null,
    composite: {
      width: 100,
      height: 130,
      opaque: true,
      sceneCount: 1,
      foregroundBounds: { left: 10, top: 10, width: 80, height: 110 },
      largeForegroundComponentCount: 1,
      whiteCornerCount: 4,
      minimumSafeMarginPct: 7,
      previewPath: `/previews/${sourceSha256}.png`,
      evidenceSha256: "e".repeat(64),
    },
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
    reviewUnitKey: buildPsdReviewUnitKey(record),
    sourceSha256,
    websiteSku,
    graceSku,
    family: "Cylinder",
    canonicalReviewMetadata: null,
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

  it("requires usable composite preview evidence for concrete approval", () => {
    const evidenceBlocked = makeUnit({ key: "evidence-blocked" });
    evidenceBlocked.representative.composite = null;
    assert.throws(() => applyPsdReviewDecisions({
      reviewUnits: [evidenceBlocked],
      decisions: [{
        ...validDecision,
        reviewUnitKey: evidenceBlocked.reviewUnitKey,
        sourceSha256: evidenceBlocked.sourceSha256,
      }],
    }), /evidence|preview|composite/i);

    const blocked = applyPsdReviewDecisions({
      reviewUnits: [evidenceBlocked],
      decisions: [{
        ...validDecision,
        reviewUnitKey: evidenceBlocked.reviewUnitKey,
        sourceSha256: evidenceBlocked.sourceSha256,
        decision: "blocked",
        notes: "ImageMagick could not render the PSD composite.",
      }],
    });
    assert.equal(blocked.blocked.length, 1);
    assert.equal(blocked.approved.length, 0);
  });

  it("requires durable reason notes for a human blocked decision", () => {
    assert.throws(() => validatePsdReviewDecision({
      ...validDecision,
      decision: "blocked",
      notes: "   ",
    }), /notes|reason/i);
  });

  it("rejects malformed persisted unit internals before any propagation", () => {
    const malformed = makeUnit({ key: "malformed" });
    const injected = makeUnit({ key: "injected" }).representative;
    malformed.sources.push(injected);
    assert.throws(() => applyPsdReviewDecisions({
      reviewUnits: [malformed],
      decisions: [{
        ...validDecision,
        reviewUnitKey: malformed.reviewUnitKey,
        sourceSha256: malformed.sourceSha256,
      }],
    }), /mismatch|mixed|review-unit key|hash/i);

    const foreignRepresentative = makeUnit({ key: "foreign-representative" });
    foreignRepresentative.representative = makeUnit({ key: "other" }).representative;
    assert.throws(() => applyPsdReviewDecisions({
      reviewUnits: [foreignRepresentative],
      decisions: [],
    }), /representative/i);
  });
});
