import assert from "node:assert/strict";
import { test } from "node:test";

import sharp from "sharp";

import { buildCyl9RollerPair } from "./cyl9RollerPair.node";

async function fixture(kind: "plastic" | "metal"): Promise<Buffer> {
  const width = 40;
  const height = 40;
  const rgba = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const ball = ((x - 20) ** 2 + (y - 10) ** 2) <= 8 ** 2 && y <= 10;
      const housing = x >= 10 && x <= 30 && y >= 10 && y <= 26;
      if (!ball && !housing) continue;
      const offset = (y * width + x) * 4;
      const metalBall = kind === "metal" && ball;
      rgba[offset] = metalBall ? 45 + x * 4 : 220;
      rgba[offset + 1] = metalBall ? 45 + x * 4 : 219;
      rgba[offset + 2] = metalBall ? 48 + x * 4 : 216;
      rgba[offset + 3] = 255;
    }
  }
  if (kind === "metal") rgba[(2 * width + 2) * 4 + 3] = 255;
  return sharp(rgba, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

test("roller pair inherits one plastic silhouette and transfers metal only into the ball", async () => {
  const pair = await buildCyl9RollerPair({
    plasticSource: await fixture("plastic"),
    metalSource: await fixture("metal"),
    source: {
      alphaFloor: 8,
      plasticBallBounds: { left: 12, top: 2, right: 28, bottom: 10 },
      metalBallBounds: { left: 12, top: 2, right: 28, bottom: 10 },
    },
    placement: {
      canvasWidthPx: 100,
      canvasHeightPx: 120,
      targetWidthPx: 30,
      mountAxisXPx: 50,
      contactYPx: 80,
    },
  });

  assert.equal(pair.qa.sharedAlphaExact, true);
  assert.equal(pair.qa.silhouetteIou, 1);
  assert.equal(pair.qa.connectedComponents, 1);
  assert.deepEqual(pair.plastic.alphaBounds, pair.metal.alphaBounds);
  assert.deepEqual(pair.plastic.alphaBounds, pair.mask.bounds);
  assert.equal(pair.mask.bounds.bottom, 80);
  assert.equal(pair.mask.bounds.right - pair.mask.bounds.left + 1, 30);
  assert.notEqual(pair.plastic.sha256, pair.metal.sha256);
  assert.equal(pair.qa.metalOpaqueWhite.pass, true);

  const [plastic, metal] = await Promise.all([
    sharp(pair.plastic.png).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(pair.metal.png).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
  ]);
  for (let pixel = 0; pixel < plastic.info.width * plastic.info.height; pixel += 1) {
    assert.equal(plastic.data[pixel * 4 + 3], metal.data[pixel * 4 + 3]);
  }
  const housingPixel = (70 * plastic.info.width + 50) * 4;
  assert.deepEqual(
    [...plastic.data.subarray(housingPixel, housingPixel + 3)],
    [...metal.data.subarray(housingPixel, housingPixel + 3)],
  );
});

test("roller pair refuses a plastic authority that is the frame", async () => {
  const fullFrame = await sharp({
    create: { width: 20, height: 20, channels: 4, background: { r: 220, g: 220, b: 220, alpha: 1 } },
  }).png().toBuffer();
  await assert.rejects(() => buildCyl9RollerPair({
    plasticSource: fullFrame,
    metalSource: fullFrame,
    source: {
      alphaFloor: 8,
      plasticBallBounds: { left: 5, top: 2, right: 14, bottom: 8 },
      metalBallBounds: { left: 5, top: 2, right: 14, bottom: 8 },
    },
    placement: {
      canvasWidthPx: 100,
      canvasHeightPx: 120,
      targetWidthPx: 30,
      mountAxisXPx: 50,
      contactYPx: 80,
    },
  }), /image frame/i);
});
