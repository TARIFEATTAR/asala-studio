import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import sharp from "sharp";

import { clampCandidate } from "./candidateClamp.node";

const sha256 = (value: Buffer) => createHash("sha256").update(value).digest("hex");

async function rgba(
  width: number,
  height: number,
  color: { r: number; g: number; b: number; alpha: number },
) {
  return sharp({ create: { width, height, channels: 4, background: color } }).png().toBuffer();
}

async function mask(width: number, height: number, pixels: number[]) {
  return sharp(Buffer.from(pixels), { raw: { width, height, channels: 1 } }).png().toBuffer();
}

test("hostile provider pixels are restored outside both edit and object masks", async () => {
  const width = 4;
  const height = 3;
  const sourceRaw = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      if (x === 1 || x === 2) {
        sourceRaw.set([20, 40, 60, 255], offset);
      }
    }
  }
  const source = await sharp(sourceRaw, { raw: { width, height, channels: 4 } }).png().toBuffer();
  const provider = await rgba(width, height, { r: 255, g: 0, b: 255, alpha: 1 });
  const objectMask = await mask(width, height, [
    0, 255, 255, 0,
    0, 255, 255, 0,
    0, 255, 255, 0,
  ]);
  const editMask = await mask(width, height, [
    255, 255, 0, 255,
    255, 255, 0, 255,
    255, 255, 0, 255,
  ]);

  const result = await clampCandidate({
    source,
    provider,
    editMask,
    authoritativeMask: objectMask,
    canvas: { widthPx: width, heightPx: height },
  });
  const { data } = await sharp(result.output).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  const pixel = (x: number, y: number) => [...data.subarray((y * width + x) * 4, (y * width + x + 1) * 4)];
  assert.deepEqual(pixel(1, 1), [255, 0, 255, 255], "provider may change the selected object pixel");
  assert.deepEqual(pixel(2, 1), [20, 40, 60, 255], "source is restored outside the edit mask");
  assert.deepEqual(pixel(0, 1), [0, 0, 0, 0], "authority clears hostile pixels outside the object");
  assert.equal(result.maskSha256, sha256(objectMask));
  assert.equal(result.geometryLocked, true);
  assert.equal(result.changedPixelCount, 3);
  assert.deepEqual(result.changedBounds, { left: 1, top: 0, right: 1, bottom: 2 });
  assert.deepEqual(result.authorityBounds, { left: 1, top: 0, right: 2, bottom: 2 });
});

test("dimension mismatch uses contain normalization without asymmetric stretching", async () => {
  const source = await rgba(20, 22, { r: 60, g: 60, b: 60, alpha: 1 });
  const provider = await rgba(10, 10, { r: 100, g: 100, b: 100, alpha: 1 });
  const authoritativeMask = await mask(20, 22, new Array(20 * 22).fill(255));
  const editMask = await mask(20, 22, new Array(20 * 22).fill(255));

  const result = await clampCandidate({
    source,
    provider,
    editMask,
    authoritativeMask,
    canvas: { widthPx: 20, heightPx: 22 },
  });

  assert.deepEqual(result.canvas, { widthPx: 20, heightPx: 22 });
  assert.equal(result.normalization.mode, "contain");
  assert.equal(result.normalization.scaleX, result.normalization.scaleY);
  assert.equal(result.asymmetricStretchApplied, false);
  assert.equal((await sharp(result.output).metadata()).width, 20);
  assert.equal((await sharp(result.output).metadata()).height, 22);
});

test("authority mask dimensions fail closed instead of being rescaled", async () => {
  const source = await rgba(4, 4, { r: 1, g: 2, b: 3, alpha: 1 });
  await assert.rejects(
    clampCandidate({
      source,
      provider: source,
      editMask: await mask(4, 4, new Array(16).fill(255)),
      authoritativeMask: await mask(2, 2, new Array(4).fill(255)),
      canvas: { widthPx: 4, heightPx: 4 },
    }),
    /authority mask.*4x4/i,
  );
});
