import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PSD_CAP_STATE_CLASSIFICATIONS,
  assertMachineCannotApprove,
  buildPsdReviewUnitKey,
  groupPsdAuditRecords,
  type PsdAuditRecord,
} from "./bestBottlesPsdCapStateAudit";

const base: PsdAuditRecord = {
  sourcePath: "/archive/A.psd",
  sourceRelativePath: "Cylinder/A.psd",
  sourceSha256: "a".repeat(64),
  sourceBytes: 100,
  websiteSku: "WebA",
  graceSku: "GB-A",
  family: "Cylinder",
  identityStatus: "exact-website-sku",
  identityReasons: [],
  composite: null,
  machineTriage: {
    proposedClassification: "ambiguous-manual-review",
    confidence: "low",
    reasons: ["visual_review_required"],
  },
  reviewStatus: "pending-human-review",
};

describe("Best Bottles PSD cap-state audit domain", () => {
  it("uses the complete evidence-preserving taxonomy", () => {
    assert.deepEqual(PSD_CAP_STATE_CLASSIFICATIONS, [
      "assembled-cap-on",
      "cap-off-applicator-exposed",
      "detached-cap-or-sidecar",
      "component-only",
      "multi-product-layout",
      "ambiguous-manual-review",
      "blocked-identity-conflict",
    ]);
  });

  it("keeps duplicate pixels separate across canonical identities", () => {
    const groups = groupPsdAuditRecords([
      base,
      { ...base, sourcePath: "/archive/A copy.psd" },
      { ...base, sourcePath: "/archive/B.psd", websiteSku: "WebB", graceSku: "GB-B" },
    ]);
    assert.equal(groups.length, 2);
    assert.equal(groups.find((group) => group.websiteSku === "WebA")?.sources.length, 2);
  });

  it("builds a stable hash plus identity review key", () => {
    assert.equal(
      buildPsdReviewUnitKey(base),
      `${"a".repeat(64)}|WEBA|GBA`,
    );
  });

  it("rejects a machine-authored approval", () => {
    assert.throws(() => assertMachineCannotApprove({
      reviewStatus: "approved",
      reviewer: "machine",
    }), /human reviewer/i);
  });
});
