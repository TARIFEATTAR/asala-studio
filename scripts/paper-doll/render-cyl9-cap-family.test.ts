import assert from "node:assert/strict";
import test from "node:test";

import sharp from "sharp";

import {
  clampRenderToAuthorityMask,
  compareClampedVariantAlpha,
  inspectAuthorityMask,
} from "./render-cyl9-cap-family";

async function rgbaPng(
  width: number,
  height: number,
  pixel: (x: number, y: number) => [number, number, number, number],
): Promise<Buffer> {
  const data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4;
      const value = pixel(x, y);
      data.set(value, offset);
    }
  }
  return sharp(data, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

async function alphaBytes(png: Buffer): Promise<number[]> {
  return Array.from(await sharp(png).ensureAlpha().extractChannel("alpha").raw().toBuffer());
}

test("clamp removes islands and copies exact binary mask alpha", async () => {
  const render = await rgbaPng(5, 5, (x, y) => (
    (x >= 1 && x <= 3 && y >= 1 && y <= 3) || (x === 4 && y === 4)
      ? [40 + x, 80 + y, 120, 255]
      : [0, 0, 0, 0]
  ));
  const mask = await rgbaPng(5, 5, (x, y) => (
    x >= 1 && x <= 3 && y >= 1 && y <= 3
      ? [255, 255, 255, 255]
      : [0, 0, 0, 0]
  ));

  const result = await clampRenderToAuthorityMask(render, mask);

  assert.deepEqual(await alphaBytes(result), await alphaBytes(mask));
  const rgba = await sharp(result).ensureAlpha().raw().toBuffer();
  assert.deepEqual(Array.from(rgba.subarray((4 * 5 + 4) * 4, (4 * 5 + 4) * 4 + 4)), [0, 0, 0, 0]);
});

test("all clamped variants have IoU 1 and zero mismatched pixels", async () => {
  const mask = await rgbaPng(7, 7, (x, y) => (
    x >= 2 && x <= 4 && y >= 1 && y <= 5
      ? [255, 255, 255, 255]
      : [0, 0, 0, 0]
  ));
  const render = await rgbaPng(7, 7, () => [180, 170, 160, 255]);
  const [silver, matte, dotted] = await Promise.all([
    clampRenderToAuthorityMask(render, mask),
    clampRenderToAuthorityMask(render, mask),
    clampRenderToAuthorityMask(render, mask),
  ]);

  const report = await compareClampedVariantAlpha([
    { name: "silver", png: silver },
    { name: "matte", png: matte },
    { name: "dotted", png: dotted },
  ]);

  assert.equal(report.minIoU, 1);
  assert.ok(report.pairs.every(({ mismatchedPixels }) => mismatchedPixels === 0));
});

test("mask inspection rejects frame occupancy and detached regions", async () => {
  const frameMask = await rgbaPng(5, 5, (x, y) => (
    x <= 1 && y <= 1 ? [255, 255, 255, 255] : [0, 0, 0, 0]
  ));
  const islandsMask = await rgbaPng(7, 7, (x, y) => (
    (x >= 1 && x <= 2 && y >= 1 && y <= 2) || (x >= 4 && x <= 5 && y >= 4 && y <= 5)
      ? [255, 255, 255, 255]
      : [0, 0, 0, 0]
  ));

  await assert.rejects(() => inspectAuthorityMask(frameMask), /touches the image frame/i);
  await assert.rejects(() => inspectAuthorityMask(islandsMask), /1 connected component/i);
});
