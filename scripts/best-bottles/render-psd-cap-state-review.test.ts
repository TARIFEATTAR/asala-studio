import assert from "node:assert/strict";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import sharp from "sharp";

import type {
  PsdAuditRecord,
  PsdIdentityStatus,
  PsdReviewUnit,
} from "../../src/lib/bestBottlesPsdCapStateAudit";
import {
  buildPsdReviewSheetPlan,
  renderPsdReviewSheets,
} from "./render-psd-cap-state-review";

type FixtureOptions = {
  key: string;
  family?: string | null;
  identityStatus?: PsdIdentityStatus;
  composite?: boolean;
  classification?: PsdAuditRecord["machineTriage"]["proposedClassification"];
  capacityMl?: string;
  applicator?: string;
};

function fixtureUnit(options: FixtureOptions): PsdReviewUnit {
  const identityStatus = options.identityStatus ?? "exact-website-sku";
  const websiteSku = identityStatus === "exact-grace-sku" ? null : `WEB-${options.key}`;
  const graceSku = identityStatus === "exact-website-sku" ? `GB-${options.key}` : null;
  const family = options.family === undefined ? "Cylinder" : options.family;
  const record = {
    sourcePath: `/archive/${options.key}.psd`,
    sourceRelativePath: `${family ?? "unknown"}/${options.key}.psd`,
    sourceSha256: options.key.padEnd(64, "0"),
    sourceBytes: 100,
    family,
    canonicalReviewMetadata: options.capacityMl || options.applicator ? {
      capacityMl: options.capacityMl ?? null,
      applicator: options.applicator ?? null,
      capStyle: null,
      capColor: null,
      trimColor: null,
      bodyMaterial: null,
      glassFinish: null,
      assemblyType: null,
      ballMaterial: null,
      category: null,
      shape: null,
      canonBodyHeightMm: null,
      canonWidthAxisMm: null,
      canonSecondAxisMm: null,
      canonHeightWithCapMm: null,
    } : null,
    identityReasons: [`identity:${identityStatus}`],
    composite: options.composite === false ? null : {
      width: 100,
      height: 130,
      opaque: true,
      sceneCount: 1,
      foregroundBounds: { left: 10, top: 10, width: 80, height: 110 },
      largeForegroundComponentCount: 1,
      whiteCornerCount: 4,
      minimumSafeMarginPct: 7,
      previewPath: `/previews/${options.key.padEnd(64, "0")}.png`,
      evidenceSha256: options.key.padEnd(64, "e"),
    },
    machineTriage: {
      proposedClassification: options.classification ?? "assembled-cap-on",
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
    reviewUnitKey: `${record.sourceSha256}|${websiteSku ?? "UNMATCHED"}|${graceSku ?? "UNMATCHED"}`,
    sourceSha256: record.sourceSha256,
    websiteSku,
    graceSku,
    family,
    canonicalReviewMetadata: record.canonicalReviewMetadata,
    sources: [record],
    representative: record,
    ...(options.capacityMl ? { capacityMl: options.capacityMl } : {}),
    ...(options.applicator ? { applicator: options.applicator } : {}),
  } as PsdReviewUnit;
}

const units = [
  fixtureUnit({ key: "exact-b", family: "Circle" }),
  fixtureUnit({ key: "unmatched", family: null, identityStatus: "unmatched" }),
  fixtureUnit({ key: "conflict", family: "Cylinder", identityStatus: "conflict" }),
  fixtureUnit({ key: "layout", family: "Cylinder", classification: "multi-product-layout" }),
  fixtureUnit({ key: "evidence", family: "Cylinder", composite: false }),
  fixtureUnit({ key: "exact-a", family: "Cylinder" }),
];

describe("PSD cap-state review sheet planning", () => {
  it("groups by family and emits every review unit exactly once", () => {
    const plan = buildPsdReviewSheetPlan(units, { tilesPerSheet: 20 });
    const tiles = plan.sheets.flatMap((sheet) => sheet.tiles);

    assert.equal(tiles.length, units.length);
    assert.equal(new Set(tiles.map((tile) => tile.reviewUnitKey)).size, units.length);
    assert.ok(plan.sheets.every(
      (sheet) => new Set(sheet.tiles.map((tile) => tile.family)).size === 1,
    ));
  });

  it("sorts ambiguous and conflicted identities before exact matches", () => {
    const plan = buildPsdReviewSheetPlan(units, { tilesPerSheet: 20 });

    assert.equal(plan.sheets[0].queue, "identity-blockers");
    assert.deepEqual([...new Set(plan.sheets.map((sheet) => sheet.queue))], [
      "identity-blockers",
      "evidence-blockers",
      "unmatched",
      "ambiguous-layout",
      "exact-matched",
    ]);
  });

  it("batches at the tile limit and splits exact matches by canonical cohort", () => {
    const exactUnits = [
      ...Array.from({ length: 21 }, (_, index) => fixtureUnit({
        key: `dropper-${String(index).padStart(2, "0")}`,
        family: "Cylinder",
        capacityMl: "15",
        applicator: "Dropper",
      })),
      fixtureUnit({
        key: "roller",
        family: "Cylinder",
        capacityMl: "15",
        applicator: "Roll-on",
      }),
    ];

    const plan = buildPsdReviewSheetPlan(exactUnits, { tilesPerSheet: 20 });

    assert.deepEqual(plan.sheets.map((sheet) => sheet.tiles.length), [20, 1, 1]);
    assert.deepEqual(plan.sheets.map((sheet) => sheet.cohort), [
      "15ml--dropper",
      "15ml--dropper",
      "15ml--roll-on",
    ]);
    const firstTile = plan.sheets[0].tiles[0];
    assert.equal(firstTile.capacityMl, "15");
    assert.equal(firstTile.applicator, "Dropper");
    assert.equal(firstTile.proposedClassification, "assembled-cap-on");
    assert.equal(firstTile.confidence, "low");
    assert.equal(firstTile.reviewStatus, "pending-human-review");
  });

  it("routes pending exact identities to exact-matched unless layout evidence exists", () => {
    const pendingExact = fixtureUnit({
      key: "pending-exact",
      family: "Cylinder",
      classification: "ambiguous-manual-review",
    });
    const plan = buildPsdReviewSheetPlan([pendingExact], { tilesPerSheet: 20 });
    assert.equal(plan.sheets[0].queue, "exact-matched");
  });

  it("assigns stable one-to-one filenames when distinct buckets normalize identically", () => {
    const collidingUnits = [
      fixtureUnit({ key: "slash", family: "A/B" }),
      fixtureUnit({ key: "space", family: "A B" }),
    ];

    const forward = buildPsdReviewSheetPlan(collidingUnits, { tilesPerSheet: 20 });
    const reverse = buildPsdReviewSheetPlan([...collidingUnits].reverse(), { tilesPerSheet: 20 });
    const familyFilenames = (plan: ReturnType<typeof buildPsdReviewSheetPlan>) => (
      plan.sheets.map((sheet) => [sheet.family, sheet.filename]).sort()
    );

    assert.equal(new Set(forward.sheets.map((sheet) => sheet.filename)).size, 2);
    assert.deepEqual(familyFilenames(forward), familyFilenames(reverse));
  });

  it("rejects tile counts that do not match the fixed 5 x 4 geometry", () => {
    assert.throws(
      () => buildPsdReviewSheetPlan(units, { tilesPerSheet: 19 }),
      /exactly 20/i,
    );
    assert.throws(
      () => buildPsdReviewSheetPlan(units, { tilesPerSheet: 21 }),
      /exactly 20/i,
    );
  });
});

describe("PSD cap-state review sheet rendering", () => {
  it("writes 2000 x 2400 PNG sheets, a manifest, and a read-only index", async () => {
    const root = await mkdtemp(join(tmpdir(), "psd-review-sheets-"));
    try {
      const previewPath = join(root, "preview.png");
      await sharp({
        create: { width: 120, height: 240, channels: 3, background: "rgb(209, 63, 50)" },
      }).png().toFile(previewPath);
      const unit = fixtureUnit({ key: "render", family: "Cylinder" });
      assert.ok(unit.representative.composite);
      unit.representative.composite.previewPath = previewPath;

      const outputRoot = join(root, "review");
      const result = await renderPsdReviewSheets([unit], { outputRoot });
      const metadata = await sharp(result.sheetPaths[0]).metadata();
      const manifest = JSON.parse(await readFile(result.manifestPath, "utf8"));
      const html = await readFile(result.indexPath, "utf8");

      assert.deepEqual({ width: metadata.width, height: metadata.height }, {
        width: 2_000,
        height: 2_400,
      });
      assert.equal(manifest.totalReviewUnits, 1);
      assert.equal(manifest.sheets[0].tiles[0].reviewUnitKey, unit.reviewUnitKey);
      assert.match(html, /render\.psd/);
      assert.match(html, /read-only/i);
      assert.doesNotMatch(html, /<form|<input|<button|fetch\(|approved cap-state/i);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("removes stale manifest-owned sheets on rerun while preserving unrelated files", async () => {
    const root = await mkdtemp(join(tmpdir(), "psd-review-rerun-"));
    try {
      const previewPath = join(root, "preview.png");
      await sharp({
        create: { width: 120, height: 240, channels: 3, background: "white" },
      }).png().toFile(previewPath);
      const first = fixtureUnit({ key: "first", family: "First Family" });
      const second = fixtureUnit({ key: "second", family: "Second Family" });
      assert.ok(first.representative.composite);
      assert.ok(second.representative.composite);
      first.representative.composite.previewPath = previewPath;
      second.representative.composite.previewPath = previewPath;

      const outputRoot = join(root, "review");
      const firstResult = await renderPsdReviewSheets([first], { outputRoot });
      const staleSheetPath = firstResult.sheetPaths[0];
      const unrelatedPath = join(outputRoot, "keep-me.png");
      await writeFile(unrelatedPath, "unrelated\n", "utf8");

      const secondResult = await renderPsdReviewSheets([second], { outputRoot });

      await assert.rejects(access(staleSheetPath), /ENOENT/);
      assert.equal(await readFile(unrelatedPath, "utf8"), "unrelated\n");
      await access(secondResult.sheetPaths[0]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("never deletes files named only by a foreign or corrupt manifest", async () => {
    const root = await mkdtemp(join(tmpdir(), "psd-review-foreign-manifest-"));
    try {
      const outputRoot = join(root, "review");
      await rm(outputRoot, { recursive: true, force: true });
      const previewPath = join(root, "preview.png");
      await sharp({
        create: { width: 120, height: 240, channels: 3, background: "white" },
      }).png().toFile(previewPath);
      const unit = fixtureUnit({ key: "safe", family: "Cylinder" });
      assert.ok(unit.representative.composite);
      unit.representative.composite.previewPath = previewPath;

      await writeFile(join(root, "keep-me.png"), "keep\n", "utf8");
      await rm(outputRoot, { recursive: true, force: true });
      await import("node:fs/promises").then(({ mkdir }) => mkdir(outputRoot, { recursive: true }));
      const foreignOwnedLooking = "bb-psd-review-v2--exact-matched--cylinder--p999.png";
      await writeFile(join(outputRoot, foreignOwnedLooking), "foreign\n", "utf8");
      await writeFile(join(outputRoot, "review-sheet-manifest.json"), JSON.stringify({
        owner: "foreign-renderer",
        version: "best-bottles-psd-review-sheets-v2",
        sheets: [{ filename: foreignOwnedLooking }, { filename: "../outside.png" }],
      }), "utf8");

      await renderPsdReviewSheets([unit], { outputRoot });
      assert.equal(await readFile(join(outputRoot, foreignOwnedLooking), "utf8"), "foreign\n");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
