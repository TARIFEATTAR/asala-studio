import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { describe, it } from "node:test";

import {
  buildPsdReviewUnitKey,
  type PsdAuditRecord,
  type PsdReviewUnit,
} from "../../src/lib/bestBottlesPsdCapStateAudit";
import {
  applyPsdCapStateReview,
  parsePsdReviewDecisionsCsv,
} from "./apply-psd-cap-state-review";

function makeUnit(key: string): PsdReviewUnit {
  const sourceSha256 = createHash("sha256").update(key).digest("hex");
  const record = {
    sourcePath: `/archive/${key}.psd`,
    sourceRelativePath: `${key}.psd`,
    sourceSha256,
    sourceBytes: 100,
    family: "Cylinder",
    canonicalReviewMetadata: null,
    identityReasons: [],
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
    reviewUnitKey: buildPsdReviewUnitKey(record),
    sourceSha256,
    websiteSku: `WEB-${key}`,
    graceSku: null,
    family: "Cylinder",
    canonicalReviewMetadata: null,
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
      const previewBytes = Buffer.from("reviewed-preview");
      const previewRoot = join(root, "previews");
      await mkdir(previewRoot, { recursive: true });
      const previewPath = join(previewRoot, `${approved.sourceSha256}.png`);
      await writeFile(previewPath, previewBytes);
      assert.ok(approved.representative.composite);
      approved.representative.composite.previewPath = previewPath;
      approved.representative.composite.evidenceSha256 = createHash("sha256")
        .update(previewBytes).digest("hex");
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

  it("rejects an approved decision when preview bytes no longer match evidence", async () => {
    const root = await mkdtemp(join(tmpdir(), "psd-review-tampered-"));
    try {
      const approved = makeUnit("tampered");
      const previewRoot = join(root, "previews");
      await mkdir(previewRoot, { recursive: true });
      const previewPath = join(previewRoot, `${approved.sourceSha256}.png`);
      await writeFile(previewPath, "tampered bytes");
      assert.ok(approved.representative.composite);
      approved.representative.composite.previewPath = previewPath;
      approved.representative.composite.evidenceSha256 = "e".repeat(64);
      const reviewUnitsPath = join(root, "review-units.json");
      const decisionsPath = join(root, "review-decisions.csv");
      await writeFile(reviewUnitsPath, JSON.stringify([approved]), "utf8");
      await writeFile(decisionsPath, [
        columns,
        `${approved.reviewUnitKey},${approved.sourceSha256},${approved.websiteSku},,Cylinder,,ambiguous-manual-review,assembled-cap-on,Jordan Richter,2026-07-12T20:00:00-07:00,reviewed`,
      ].join("\n"), "utf8");
      await assert.rejects(
        applyPsdCapStateReview({ reviewUnitsPath, decisionsPath, outputRoot: root }),
        /preview hash/i,
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
