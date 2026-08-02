import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import sharp from "sharp";

import {
  cropGlassOnlyMaterialCalibration,
  GLASS_ONLY_MATERIAL_CROP,
} from "./build-glass-only-material-calibration";

test("uses the reviewed sidewall-only production crop", () => {
  assert.deepEqual(GLASS_ONLY_MATERIAL_CROP, {
    left: 795,
    top: 1420,
    width: 65,
    height: 560,
  });
});

test("creates a pixel-preserving glass-only crop with durable evidence", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "bb-glass-crop-"));
  try {
    const sourcePath = path.join(directory, "source.png");
    const outputPath = path.join(directory, "glass-only.png");
    const recordPath = path.join(directory, "glass-only.json");
    const source = await sharp({
      create: {
        width: 100,
        height: 80,
        channels: 3,
        background: { r: 245, g: 243, b: 239 },
      },
    }).png().toBuffer();
    await writeFile(sourcePath, source);

    const record = await cropGlassOnlyMaterialCalibration({
      sourcePath,
      sourceSha256: createHash("sha256").update(source).digest("hex"),
      outputPath,
      recordPath,
      crop: { left: 10, top: 20, width: 30, height: 40 },
    });

    const metadata = await sharp(outputPath).metadata();
    assert.equal(metadata.width, 30);
    assert.equal(metadata.height, 40);
    assert.equal(record.operation, "pixel-preserving-glass-only-crop");
    assert.equal(record.postGenerationMutationAllowed, false);
    assert.deepEqual(record.crop, { left: 10, top: 20, width: 30, height: 40 });
    assert.deepEqual(JSON.parse(await readFile(recordPath, "utf8")), record);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
