import assert from "node:assert/strict";
import test from "node:test";

import sharp from "sharp";

import {
  buildPlacedComponentLayer,
  clampToAuthorityMask,
  composeComponentAssembly,
  inspectAuthorityMask,
  normalizeMaterialIntoAuthority,
} from "./componentPlateImage.node";

async function rgbaPng(
  width: number,
  height: number,
  pixel: (x: number, y: number) => [number, number, number, number],
): Promise<Buffer> {
  const data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      data.set(pixel(x, y), (y * width + x) * 4);
    }
  }
  return sharp(data, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

async function alphaBytes(png: Buffer): Promise<number[]> {
  return Array.from(await sharp(png).ensureAlpha().extractChannel("alpha").raw().toBuffer());
}

test("generated material is normalized into the mask and copies exact alpha bytes", async () => {
  const materialPng = await rgbaPng(8, 8, (x, y) => [20 + x * 10, 40 + y * 10, 80, 255]);
  const authorityMaskPng = await rgbaPng(10, 10, (x, y) => {
    if (x < 2 || x > 7 || y < 1 || y > 8) return [0, 0, 0, 0];
    return [255, 255, 255, x === 2 || x === 7 ? 128 : 255];
  });

  const result = await normalizeMaterialIntoAuthority({
    materialPng,
    sourceBoundsPx: { left: 1, top: 2, width: 6, height: 4 },
    authorityMaskPng,
  });

  assert.deepEqual(await alphaBytes(result.png), await alphaBytes(authorityMaskPng));
  assert.deepEqual(result.authorityBoundsPx, { left: 2, top: 1, width: 6, height: 8 });
  assert.deepEqual(result.qa, { geometryLocked: true, minIoU: 1, mismatchedPixels: 0 });
});

test("clamp clears generated pixels outside the authority", async () => {
  const material = await rgbaPng(5, 5, () => [90, 100, 110, 255]);
  const mask = await rgbaPng(5, 5, (x, y) => (
    x >= 1 && x <= 3 && y >= 1 && y <= 3
      ? [255, 255, 255, 255]
      : [0, 0, 0, 0]
  ));

  const output = await clampToAuthorityMask(material, mask);
  const rgba = await sharp(output).ensureAlpha().raw().toBuffer();

  assert.deepEqual(Array.from(rgba.subarray(0, 4)), [0, 0, 0, 0]);
  assert.deepEqual(await alphaBytes(output), await alphaBytes(mask));
});

test("authority inspection rejects frame, empty, and undeclared island masks", async () => {
  const emptyMask = await rgbaPng(5, 5, () => [0, 0, 0, 0]);
  const frameMask = await rgbaPng(5, 5, (x, y) => (
    x === 0 && y === 2 ? [255, 255, 255, 255] : [0, 0, 0, 0]
  ));
  const islandMask = await rgbaPng(7, 7, (x, y) => (
    (x >= 1 && x <= 2 && y >= 1 && y <= 2) || (x >= 4 && x <= 5 && y >= 4 && y <= 5)
      ? [255, 255, 255, 255]
      : [0, 0, 0, 0]
  ));

  await assert.rejects(() => inspectAuthorityMask(emptyMask, { expectedRegions: 1 }), /empty/i);
  await assert.rejects(() => inspectAuthorityMask(frameMask, { expectedRegions: 1 }), /frame/i);
  await assert.rejects(() => inspectAuthorityMask(islandMask, { expectedRegions: 1 }), /connected/i);
  assert.equal((await inspectAuthorityMask(islandMask, { expectedRegions: 2 })).componentCount, 2);
});

test("placement uses one uniform scale and derives exact full-canvas bounds", async () => {
  const componentPng = await rgbaPng(8, 8, (x, y) => (
    x >= 3 && x <= 4 && y >= 2 && y <= 5
      ? [160, 150, 140, 255]
      : [0, 0, 0, 0]
  ));

  const result = await buildPlacedComponentLayer({
    componentPng,
    canvas: { widthPx: 20, heightPx: 24 },
    transform: { widthPx: 4, centerXPx: 10, seatYPx: 18 },
  });

  assert.deepEqual(result.placementBoundsPx, { left: 8, top: 10, width: 4, height: 8 });
  assert.deepEqual(await sharp(result.layerPng).metadata().then(({ width, height }) => ({ width, height })), {
    width: 20,
    height: 24,
  });
});

test("assembly composition rejects a non-canonical layer canvas", async () => {
  const bodyPng = await rgbaPng(20, 24, () => [245, 243, 239, 255]);
  const layerPng = await rgbaPng(10, 12, () => [0, 0, 0, 0]);

  await assert.rejects(
    () => composeComponentAssembly({ bodyPng, layerPng }),
    /dimensions|canvas/i,
  );
});

test("assembly composition overlays the component without changing canvas dimensions", async () => {
  const bodyPng = await rgbaPng(20, 24, () => [245, 243, 239, 255]);
  const layerPng = await rgbaPng(20, 24, (x, y) => (
    x === 10 && y === 4 ? [10, 20, 30, 255] : [0, 0, 0, 0]
  ));

  const composite = await composeComponentAssembly({ bodyPng, layerPng });
  const { data, info } = await sharp(composite).ensureAlpha().raw().toBuffer({
    resolveWithObject: true,
  });
  const offset = (4 * info.width + 10) * 4;

  assert.equal(info.width, 20);
  assert.equal(info.height, 24);
  assert.deepEqual(Array.from(data.subarray(offset, offset + 4)), [10, 20, 30, 255]);
});
