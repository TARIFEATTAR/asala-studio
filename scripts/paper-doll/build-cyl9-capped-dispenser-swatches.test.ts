import assert from "node:assert/strict";
import test from "node:test";

import sharp from "sharp";

import {
  keepAuthorityUpperAndSwapBand,
  planCyl9CappedDispenserSources,
} from "./build-cyl9-capped-dispenser-swatches";

test("plans the exact six sprayer and three pump swatches from the capped PSD archive", () => {
  const sources = planCyl9CappedDispenserSources("/capped");
  assert.equal(sources.length, 9);
  assert.deepEqual(
    sources.filter(({ lane }) => lane === "sprayer").map(({ variantKey }) => variantKey),
    ["GLD", "MSLV", "BLK", "SSLV", "RED", "TUR"],
  );
  assert.deepEqual(
    sources.filter(({ lane }) => lane === "pump").map(({ variantKey }) => variantKey),
    ["MSLV", "GLD", "BLK"],
  );
  assert.equal(sources.filter(({ lane, authorityVariant }) => lane === "sprayer" && authorityVariant)[0]?.variantKey, "SSLV");
  assert.equal(sources.filter(({ lane, authorityVariant }) => lane === "pump" && authorityVariant)[0]?.variantKey, "GLD");
  assert.ok(sources.every(({ sourcePath }) => sourcePath.startsWith("/capped/")));
});

test("changes only the band pixels while copying the exact authority alpha", async () => {
  const authority = await sharp({
    create: { width: 4, height: 4, channels: 4, background: { r: 220, g: 220, b: 220, alpha: 1 } },
  }).png().toBuffer();
  const variant = await sharp({
    create: { width: 4, height: 4, channels: 4, background: { r: 10, g: 20, b: 30, alpha: 1 } },
  }).png().toBuffer();
  const mask = await sharp({
    create: { width: 4, height: 4, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
  }).png().toBuffer();
  const result = await keepAuthorityUpperAndSwapBand({
    authorityPng: authority,
    variantPng: variant,
    authorityMaskPng: mask,
    bandTopYPx: 2,
  });
  const decoded = await sharp(result).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.deepEqual([...decoded.data.subarray(0, 4)], [220, 220, 220, 255]);
  const lowerOffset = (2 * decoded.info.width) * 4;
  assert.deepEqual([...decoded.data.subarray(lowerOffset, lowerOffset + 4)], [10, 20, 30, 255]);
  for (let pixel = 0; pixel < decoded.info.width * decoded.info.height; pixel += 1) {
    assert.equal(decoded.data[pixel * 4 + 3], 255);
  }
});
