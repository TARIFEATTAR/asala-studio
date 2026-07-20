import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

import { conditionMaterialPilotReference } from "./material-pilot-reference-conditioning.ts";

const SOURCE = new URL(
  "../../tmp/best-bottles-reference-production/cylinder-blocked-recovery-v1/review-candidates/GBCYLBLU5SPRYBLKSH__GBCYLBLU5MLSPRSBLK__1018fed6bb8a.png",
  import.meta.url,
);

describe("material-pilot product-truth reference conditioning", () => {
  it("places the approved 5 mL source on native Bone at the canonical body box and baseline", async () => {
    const dir = mkdtempSync(join(tmpdir(), "bb-material-rig-"));
    const outputPath = join(dir, "conditioned.png");
    const recordPath = join(dir, "conditioned.json");
    try {
      const record = await conditionMaterialPilotReference({
        sourcePath: fileURLToPath(SOURCE),
        outputPath,
        recordPath,
        websiteSku: "GBCylBlu5SpryBlkSh",
        sourceSha256:
          "b43d74266a311c17e0181f5b70b954f14e97e4f1de8ddb25d8f1d3405766622a",
        sourceBodyBounds: { left: 74, top: 446, right: 274, bottom: 936 },
        sourceClosureBounds: { left: 74, top: 118, right: 274, bottom: 445 },
        sourceSidecarBounds: { left: 352, top: 559, right: 551, bottom: 936 },
        scaleContract: {
          version: "best-bottles-catalog-scale-v1",
          canvasWidthPx: 2080,
          canvasHeightPx: 2288,
          baselinePct: 9,
          baselineYPx: 2082,
          assembledTargetPct: 61,
          assembledTargetPx: 1396,
          bodyTargetPx: 1027,
          bodyTargetRangePx: { min: 994, max: 1061 },
          bodyWidthTargetPx: 329,
          bodyWidthTargetRangePx: { min: 319, max: 340 },
          canonicalBodyHeightMm: 53,
          canonicalBodyWidthMm: 17,
          canonicalAssembledHeightMm: 72,
          qaStatus: "measurement-required",
        },
      });

      const image = sharp(outputPath);
      const metadata = await image.metadata();
      assert.equal(metadata.width, 2080);
      assert.equal(metadata.height, 2288);
      assert.equal(metadata.hasAlpha, false);
      assert.deepEqual(record.targetBodyBounds, {
        left: 876,
        top: 1056,
        right: 1204,
        bottom: 2082,
      });
      assert.equal(record.targetClosureBounds.bottom, 1055);
      assert.equal(record.targetClosureBounds.top, 687);
      assert.equal(record.targetSidecarBounds.bottom, 2082);
      assert.equal(record.backgroundHex, "#F5F3EF");
      assert.equal(record.postGenerationMutationAllowed, false);
      assert.match(record.outputSha256, /^[a-f0-9]{64}$/);
      assert.deepEqual(
        JSON.parse(readFileSync(recordPath, "utf8")),
        record,
      );

      const { data, info } = await image.removeAlpha().raw().toBuffer({
        resolveWithObject: true,
      });
      const corner = [...data.subarray(0, info.channels)];
      assert.deepEqual(corner, [245, 243, 239]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("can precompensate a measured renderer baseline drift without changing product scale", async () => {
    const dir = mkdtempSync(join(tmpdir(), "bb-material-rig-offset-"));
    try {
      const record = await conditionMaterialPilotReference({
        sourcePath: fileURLToPath(SOURCE),
        outputPath: join(dir, "conditioned.png"),
        recordPath: join(dir, "conditioned.json"),
        websiteSku: "GBCylBlu5SpryBlkSh",
        sourceSha256:
          "b43d74266a311c17e0181f5b70b954f14e97e4f1de8ddb25d8f1d3405766622a",
        sourceBodyBounds: { left: 74, top: 446, right: 274, bottom: 936 },
        sourceClosureBounds: { left: 74, top: 118, right: 274, bottom: 445 },
        sourceSidecarBounds: { left: 352, top: 559, right: 551, bottom: 936 },
        rendererBaselinePrecompensationPx: 44,
        scaleContract: {
          version: "best-bottles-catalog-scale-v1",
          canvasWidthPx: 2080,
          canvasHeightPx: 2288,
          baselinePct: 9,
          baselineYPx: 2082,
          assembledTargetPct: 61,
          assembledTargetPx: 1396,
          bodyTargetPx: 1027,
          bodyTargetRangePx: { min: 994, max: 1061 },
          bodyWidthTargetPx: 329,
          bodyWidthTargetRangePx: { min: 319, max: 340 },
          canonicalBodyHeightMm: 53,
          canonicalBodyWidthMm: 17,
          canonicalAssembledHeightMm: 72,
          qaStatus: "measurement-required",
        },
      });
      assert.equal(record.rendererBaselinePrecompensationPx, 44);
      assert.equal(record.targetBodyBounds.bottom, 2126);
      assert.equal(record.targetBodyBounds.top, 1100);
      assert.equal(record.targetSidecarBounds.bottom, 2126);
      assert.equal(record.scaleContractBaselineYPx, 2082);
      assert.equal(record.targetBodyBounds.right - record.targetBodyBounds.left + 1, 329);
      assert.equal(record.targetBodyBounds.bottom - record.targetBodyBounds.top + 1, 1027);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
