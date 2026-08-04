import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";

import {
  normalizeCapMaterialToAuthority,
  planCyl9SourceCapVariants,
} from "./build-cyl9-source-cap-review";

test("plans the ten real clear-body capped PSD cap layers", () => {
  const variants = planCyl9SourceCapVariants("/capped");

  assert.deepEqual(
    variants.map(({ variantKey }) => variantKey),
    ["BKDT", "MCPR", "MGLD", "MSLV", "PKDT", "SBLK", "SGLD", "SLDT", "SSLV", "WHT"],
  );
  assert.equal(new Set(variants.map(({ sourcePsdPath }) => sourcePsdPath)).size, 10);
  assert.ok(variants.every(({ sourcePsdPath }) => sourcePsdPath.startsWith("/capped/3.  17-415 Bottles/10. Clear  (Capped)/")));
  assert.deepEqual(
    variants.filter(({ variantKey }) => variantKey === "BKDT" || variantKey === "PKDT").map(({ layerIndex }) => layerIndex),
    [5, 5],
  );
  assert.ok(variants.filter(({ variantKey }) => variantKey !== "BKDT" && variantKey !== "PKDT").every(({ layerIndex }) => layerIndex === 4));
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
