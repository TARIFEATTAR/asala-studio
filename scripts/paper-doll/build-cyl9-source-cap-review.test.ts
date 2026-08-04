import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";

import {
  normalizeCapMaterialToAuthority,
  planCyl9SourceCapVariants,
  translateFullCanvasLayer,
} from "./build-cyl9-source-cap-review";

test("uses nine real capped PSD layers and the clean reviewed white material", () => {
  const variants = planCyl9SourceCapVariants("/capped");

  assert.deepEqual(
    variants.map(({ variantKey }) => variantKey),
    ["BKDT", "MCPR", "MGLD", "MSLV", "PKDT", "SBLK", "SGLD", "SLDT", "SSLV", "WHT"],
  );
  const psdVariants = variants.filter(({ sourceMode }) => sourceMode === "capped-psd-layer");
  assert.equal(psdVariants.length, 9);
  assert.equal(new Set(psdVariants.map(({ sourcePath }) => sourcePath)).size, 9);
  assert.ok(psdVariants.every(({ sourcePath }) => sourcePath.startsWith("/capped/3.  17-415 Bottles/10. Clear  (Capped)/")));
  assert.deepEqual(
    variants.find(({ variantKey }) => variantKey === "WHT"),
    {
      variantKey: "WHT",
      label: "White",
      sourceMode: "reviewed-existing-png",
      sourcePath: "outputs/paper-doll-cyl9-cap-family/material-calibration-v4/isolated/WHT.png",
    },
  );
  assert.deepEqual(
    variants.filter(({ variantKey }) => variantKey === "BKDT" || variantKey === "PKDT").map(({ layerIndex }) => layerIndex),
    [5, 5],
  );
  assert.ok(psdVariants.filter(({ variantKey }) => variantKey !== "BKDT" && variantKey !== "PKDT").every(({ layerIndex }) => layerIndex === 4));
});

test("clamps every cap material to the exact authority alpha", async () => {
  const material = await sharp({
    create: { width: 8, height: 12, channels: 4, background: { r: 180, g: 80, b: 40, alpha: 1 } },
  }).png().toBuffer();
  const authorityMask = await sharp({
    create: { width: 20, height: 24, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 0 } },
  }).composite([{
    input: await sharp({
      create: { width: 6, height: 10, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
    }).png().toBuffer(),
    left: 7,
    top: 5,
  }]).png().toBuffer();

  const normalized = await normalizeCapMaterialToAuthority({ materialPng: material, authorityMaskPng: authorityMask });
  const [actualAlpha, expectedAlpha, metadata] = await Promise.all([
    sharp(normalized).ensureAlpha().extractChannel("alpha").raw().toBuffer(),
    sharp(authorityMask).ensureAlpha().extractChannel("alpha").raw().toBuffer(),
    sharp(normalized).metadata(),
  ]);

  assert.deepEqual({ width: metadata.width, height: metadata.height }, { width: 20, height: 24 });
  assert.deepEqual(actualAlpha, expectedAlpha);
});

test("replays the approved cap family placement two pixels higher without resizing", async () => {
  const pixel = await sharp({
    create: { width: 1, height: 1, channels: 4, background: { r: 220, g: 40, b: 20, alpha: 1 } },
  }).png().toBuffer();
  const layer = await sharp({
    create: { width: 6, height: 6, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  }).composite([{ input: pixel, left: 3, top: 3 }]).png().toBuffer();

  const translated = await translateFullCanvasLayer(layer, { x: 0, y: -2 });
  const { data, info } = await sharp(translated).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const alphaAt = (x: number, y: number) => data[(y * info.width + x) * 4 + 3];

  assert.deepEqual({ width: info.width, height: info.height }, { width: 6, height: 6 });
  assert.equal(alphaAt(3, 1), 255);
  assert.equal(alphaAt(3, 3), 0);
});
