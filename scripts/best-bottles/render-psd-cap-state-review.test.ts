import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
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
  fixtureUnit({ key: "layout", family: "Cylinder", classification: "ambiguous-manual-review" }),
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
});
