import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { describe, it } from "node:test";

import type { PsdAuditRecord, PsdReviewUnit } from "../../src/lib/bestBottlesPsdCapStateAudit";
import {
  applyPsdCapStateReview,
  parsePsdReviewDecisionsCsv,
} from "./apply-psd-cap-state-review";

function makeUnit(key: string): PsdReviewUnit {
  const sourceSha256 = key.padEnd(64, "a").slice(0, 64);
  const record = {
    sourcePath: `/archive/${key}.psd`,
    sourceRelativePath: `${key}.psd`,
    sourceSha256,
    sourceBytes: 100,
    family: "Cylinder",
    identityReasons: [],
    composite: null,
    machineTriage: {
      proposedClassification: "ambiguous-manual-review",
      confidence: "low",
      reasons: [],
    },
    identityStatus: "exact-website-sku",
    websiteSku: `WEB-${key}`,
    graceSku: null,
    aliasProvenance: null,
    reviewStatus: "pending-human-review",
    reviewer: null,
    reviewedAt: null,
  } as PsdAuditRecord;
  return {
    reviewUnitKey: key,
    sourceSha256,
    websiteSku: `WEB-${key}`,
    graceSku: null,
    family: "Cylinder",
    sources: [record],
    representative: record,
  };
}

const columns = "reviewUnitKey,sourceSha256,websiteSku,graceSku,family,representativePreviewPath,proposedClassification,decision,reviewer,reviewedAt,notes";

describe("apply PSD cap-state review CLI", () => {
  it("treats an untouched decision template as zero decisions", () => {
    const csv = [
      columns,
      'unit-a,hash,WEB-A,,Cylinder,/tmp/a.png,ambiguous-manual-review,,,,""',
    ].join("\n");
    assert.deepEqual(parsePsdReviewDecisionsCsv(csv), []);
  });

  it("writes only the nine required local review artifacts", async () => {
    const root = await mkdtemp(join(tmpdir(), "psd-review-"));
    try {
      const units = [makeUnit("unit-a"), makeUnit("unit-b")];
      const reviewUnitsPath = join(root, "review-units.json");
      const decisionsPath = join(root, "review-decisions.csv");
      const outputRoot = join(root, "output");
      await writeFile(reviewUnitsPath, `${JSON.stringify(units)}\n`, "utf8");
      await writeFile(decisionsPath, `${columns}\n${units.map((unit) => (
        `${unit.reviewUnitKey},${unit.sourceSha256},${unit.websiteSku},,Cylinder,,ambiguous-manual-review,,,,`
      )).join("\n")}\n`, "utf8");

      const result = await applyPsdCapStateReview({ reviewUnitsPath, decisionsPath, outputRoot });
      assert.deepEqual(result.artifactPaths.map((path) => basename(path)).sort(), [
        "approved-cap-off.csv",
        "approved-cap-on.csv",
        "approved-detached-or-sidecar.csv",
        "blocked-review.csv",
        "component-only.csv",
        "multi-product-layout.csv",
        "pending-human-review.csv",
        "review-summary.json",
        "reviewed-manifest.json",
      ].sort());
      assert.equal(result.summary.approvedCount, 0);
      assert.equal(result.summary.pendingHumanReviewCount, units.length);
      assert.equal(result.summary.externalWriteCount, 0);
      assert.equal(JSON.parse(await readFile(join(outputRoot, "reviewed-manifest.json"), "utf8")).length, 0);
      assert.match(await readFile(join(outputRoot, "pending-human-review.csv"), "utf8"), /unit-a/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("parses quoted notes and routes approved and blocked decisions", async () => {
    const root = await mkdtemp(join(tmpdir(), "psd-review-routing-"));
    try {
      const approved = makeUnit("approved");
      const blocked = makeUnit("blocked");
      const reviewUnitsPath = join(root, "review-units.json");
      const decisionsPath = join(root, "review-decisions.csv");
      await writeFile(reviewUnitsPath, JSON.stringify([approved, blocked]), "utf8");
      await writeFile(decisionsPath, [
        columns,
        `${approved.reviewUnitKey},${approved.sourceSha256},${approved.websiteSku},,Cylinder,,ambiguous-manual-review,cap-off-applicator-exposed,Jordan Richter,2026-07-12T20:00:00-07:00,"cap, verified"`,
        `${blocked.reviewUnitKey},${blocked.sourceSha256},${blocked.websiteSku},,Cylinder,,ambiguous-manual-review,blocked,Jordan Richter,2026-07-12T20:00:00-07:00,identity blocked`,
      ].join("\n"), "utf8");

      const result = await applyPsdCapStateReview({ reviewUnitsPath, decisionsPath, outputRoot: root });
      assert.equal(result.summary.approvedCount, 1);
      assert.equal(result.summary.blockedCount, 1);
      assert.match(await readFile(join(root, "approved-cap-off.csv"), "utf8"), /cap, verified/);
      assert.match(await readFile(join(root, "blocked-review.csv"), "utf8"), /identity blocked/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
