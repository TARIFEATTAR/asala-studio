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

test("manual component uploads are fitted into the authority bounds instead of the whole canvas", async () => {
  const source = await rgba(20, 22, { r: 60, g: 60, b: 60, alpha: 1 });
  const providerRaw = Buffer.alloc(10 * 10 * 4);
  for (let y = 2; y < 8; y += 1) {
    for (let x = 2; x < 8; x += 1) providerRaw.set([220, 20, 20, 255], (y * 10 + x) * 4);
  }
  const provider = await sharp(providerRaw, { raw: { width: 10, height: 10, channels: 4 } }).png().toBuffer();
  const pixels = new Array(20 * 22).fill(0);
  for (let y = 8; y < 14; y += 1) for (let x = 7; x < 13; x += 1) pixels[y * 20 + x] = 255;

  const result = await clampCandidate({
    source,
    provider,
    editMask: await mask(20, 22, new Array(20 * 22).fill(255)),
    authoritativeMask: await mask(20, 22, pixels),
    manualPlacement: true,
    canvas: { widthPx: 20, heightPx: 22 },
  });
  const { data } = await sharp(result.output).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const pixel = (x: number, y: number) => [...data.subarray((y * 20 + x) * 4, (y * 20 + x + 1) * 4)];

  assert.deepEqual(pixel(9, 10), [220, 20, 20, 255]);
  assert.deepEqual(pixel(2, 2), [0, 0, 0, 0]);
  assert.equal(result.normalization.mode, "authority-bounds-contain");
});

test("manual placement ignores transparent padding and records exact non-transparent bounds", async () => {
  const width = 20;
  const height = 22;
  const source = await rgba(width, height, { r: 40, g: 50, b: 60, alpha: 1 });
  const visibleRaw = Buffer.alloc(4 * 6 * 4);
  for (let pixel = 0; pixel < 4 * 6; pixel += 1) visibleRaw.set([30, 180, 220, 255], pixel * 4);
  const tight = await sharp(visibleRaw, { raw: { width: 4, height: 6, channels: 4 } }).png().toBuffer();
  const padded = await sharp({
    create: { width: 10, height: 12, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  }).composite([{ input: tight, left: 3, top: 2 }]).png().toBuffer();
  const authorityPixels = new Array(width * height).fill(0);
  for (let y = 6; y < 18; y += 1) for (let x = 4; x < 16; x += 1) authorityPixels[y * width + x] = 255;
  const input = {
    source,
    editMask: await mask(width, height, new Array(width * height).fill(255)),
    authoritativeMask: await mask(width, height, authorityPixels),
    manualPlacement: true,
    canvas: { widthPx: width, heightPx: height },
  } as const;

  const [tightResult, paddedResult] = await Promise.all([
    clampCandidate({ ...input, provider: tight }),
    clampCandidate({ ...input, provider: padded }),
  ]);

  assert.deepEqual(paddedResult.output, tightResult.output);
  assert.deepEqual(paddedResult.normalization.sourceVisibleBounds, { left: 3, top: 2, right: 6, bottom: 7 });
  assert.deepEqual(tightResult.normalization.sourceVisibleBounds, { left: 0, top: 0, right: 3, bottom: 5 });
  assert.equal(paddedResult.normalization.scaleX, paddedResult.normalization.scaleY);
  assert.equal(paddedResult.normalization.outputWidthPx, 8);
  assert.equal(paddedResult.normalization.outputHeightPx, 12);
  assert.equal(paddedResult.normalization.offsetXPx, 6);
  assert.equal(paddedResult.normalization.offsetYPx, 6);
});

test("manual placement treats alpha one as visible instead of applying a trim threshold", async () => {
  const width = 8;
  const height = 8;
  const providerRaw = Buffer.alloc(4 * 4 * 4);
  providerRaw.set([255, 0, 0, 1], 0);
  providerRaw.set([255, 0, 0, 255], (2 * 4 + 2) * 4);
  const provider = await sharp(providerRaw, { raw: { width: 4, height: 4, channels: 4 } }).png().toBuffer();

  const result = await clampCandidate({
    source: await rgba(width, height, { r: 30, g: 30, b: 30, alpha: 1 }),
    provider,
    editMask: await mask(width, height, new Array(width * height).fill(255)),
    authoritativeMask: await mask(width, height, new Array(width * height).fill(255)),
    manualPlacement: true,
    canvas: { widthPx: width, heightPx: height },
  });

  assert.deepEqual(result.normalization.sourceVisibleBounds, { left: 0, top: 0, right: 2, bottom: 2 });
});

test("manual placement rejects a fully transparent upload", async () => {
  const width = 8;
  const height = 8;
  await assert.rejects(
    clampCandidate({
      source: await rgba(width, height, { r: 30, g: 30, b: 30, alpha: 1 }),
      provider: await rgba(4, 4, { r: 0, g: 0, b: 0, alpha: 0 }),
      editMask: await mask(width, height, new Array(width * height).fill(255)),
      authoritativeMask: await mask(width, height, new Array(width * height).fill(255)),
      manualPlacement: true,
      canvas: { widthPx: width, heightPx: height },
    }),
    /no non-transparent pixels/i,
  );
});

test("clamping never mutates source or authority input bytes", async () => {
  const width = 8;
  const height = 8;
  const source = await rgba(width, height, { r: 30, g: 30, b: 30, alpha: 1 });
  const authority = await mask(width, height, new Array(width * height).fill(255));
  const sourceBefore = sha256(source);
  const authorityBefore = sha256(authority);

  const result = await clampCandidate({
    source,
    provider: await rgba(4, 6, { r: 200, g: 100, b: 10, alpha: 1 }),
    editMask: authority,
    authoritativeMask: authority,
    manualPlacement: true,
    canvas: { widthPx: width, heightPx: height },
  });

  assert.equal(sha256(source), sourceBefore);
  assert.equal(sha256(authority), authorityBefore);
  assert.equal(result.maskSha256, authorityBefore);
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
