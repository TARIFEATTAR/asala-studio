import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildCylinderBlockedRecoveryQueue } from "./bestBottlesCylinderBlockedRecovery";

const blocked = (websiteSku: string, graceSku: string, blockers = ["no-approved-exact-reference"]) => ({
  canonicalIdentityKey: `${websiteSku.toUpperCase()}|${graceSku.toUpperCase().replaceAll("-", "")}`,
  websiteSku,
  graceSku,
  status: "blocked" as const,
  blockers,
  blockerLane: "source-evidence",
  canonical: { websiteSku, graceSku, family: "Cylinder" },
  reference: null,
});

const candidate = (input: {
  websiteSku: string;
  graceSku: string;
  width: number;
  height: number;
  path: string;
}) => ({
  websiteSku: input.websiteSku,
  graceSku: input.graceSku,
  family: "Cylinder",
  sourcePath: `/archive/${input.path}`,
  sourceRelativePath: input.path,
  sourceSha256: "a".repeat(64),
  sourceBytes: 123,
  reviewStatus: "pending-human-review",
  composite: {
    width: input.width,
    height: input.height,
    opaque: true,
    previewPath: `/previews/${input.path}.png`,
    evidenceSha256: "b".repeat(64),
  },
});

describe("Cylinder blocked-reference recovery queue", () => {
  it("partitions exact high-resolution, exact low-resolution, and missing candidates", () => {
    const rows = [
      blocked("WebHigh", "Grace-High"),
      blocked("WebLow", "Grace-Low"),
      blocked("WebMissing", "Grace-Missing", [
        "no-approved-exact-reference",
        "ambiguous-canonical-body-geometry",
      ]),
    ];
    const result = buildCylinderBlockedRecoveryQueue({
      blockedRows: rows,
      psdRecords: [
        candidate({ websiteSku: "web-high", graceSku: "grace high", width: 1000, height: 1200, path: "high.psd" }),
        candidate({ websiteSku: "WebLow", graceSku: "Grace-Low", width: 600, height: 900, path: "low.psd" }),
      ],
      minimumPixels: 1_000_000,
    });

    assert.deepEqual(result.summary, {
      blockedIdentityCount: 3,
      exactHighResolutionPendingReviewCount: 1,
      exactLowResolutionOnlyCount: 1,
      noExactPsdCandidateCount: 1,
      geometryBlockedCount: 1,
      promotableNowCount: 0,
    });
    assert.deepEqual(
      result.rows.map((row) => [row.websiteSku, row.recoveryStatus]),
      [
        ["WebHigh", "exact-high-resolution-pending-review"],
        ["WebLow", "exact-low-resolution-only"],
        ["WebMissing", "no-exact-psd-candidate"],
      ],
    );
    assert.equal(result.rows[1].selectedCandidate?.sourceRelativePath, "low.psd");
  });

  it("selects the largest exact candidate deterministically but retains every candidate", () => {
    const result = buildCylinderBlockedRecoveryQueue({
      blockedRows: [blocked("Web", "Grace")],
      psdRecords: [
        candidate({ websiteSku: "Web", graceSku: "Grace", width: 1200, height: 1200, path: "z.psd" }),
        candidate({ websiteSku: "Web", graceSku: "Grace", width: 2000, height: 1200, path: "b.psd" }),
        candidate({ websiteSku: "Web", graceSku: "Grace", width: 2000, height: 1200, path: "a.psd" }),
      ],
      minimumPixels: 1_000_000,
    });

    assert.equal(result.rows[0].candidates.length, 3);
    assert.equal(result.rows[0].selectedCandidate?.sourceRelativePath, "a.psd");
    assert.equal(result.rows[0].promotionState, "blocked-pending-human-review");
  });

  it("never treats a one-SKU or cross-family match as exact evidence", () => {
    const result = buildCylinderBlockedRecoveryQueue({
      blockedRows: [blocked("Web", "Grace")],
      psdRecords: [
        candidate({ websiteSku: "Web", graceSku: "Other", width: 2000, height: 2000, path: "wrong-grace.psd" }),
        { ...candidate({ websiteSku: "Web", graceSku: "Grace", width: 2000, height: 2000, path: "wrong-family.psd" }), family: "Boston Round" },
      ],
      minimumPixels: 1_000_000,
    });

    assert.equal(result.rows[0].recoveryStatus, "no-exact-psd-candidate");
    assert.equal(result.rows[0].candidates.length, 0);
  });
});
