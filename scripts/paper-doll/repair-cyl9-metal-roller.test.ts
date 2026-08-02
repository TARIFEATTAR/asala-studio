import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import sharp from "sharp";

import { repairMetalRollerBuffer } from "./repair-cyl9-metal-roller";

async function mattedFixture(): Promise<Buffer> {
  const width = 60;
  const height = 40;
  const pixels = Buffer.alloc(width * height * 4);
  for (let y = 5; y <= 34; y++) {
    for (let x = 10; x <= 49; x++) {
      const offset = (y * width + x) * 4;
      pixels[offset] = x === 30 && y < 10 ? 255 : 118;
      pixels[offset + 1] = x === 30 && y < 10 ? 255 : 124;
      pixels[offset + 2] = x === 30 && y < 10 ? 255 : 132;
      pixels[offset + 3] = 255;
    }
  }
  return sharp(pixels, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

test("repair crops from alpha and places the roller on the locked axis and seat", async () => {
  const result = await repairMetalRollerBuffer(await mattedFixture(), {
    canvasWidthPx: 200,
    canvasHeightPx: 220,
    targetWidthPx: 80,
    mountAxisXPx: 100,
    seatYPx: 150,
  });

  assert.deepEqual(result.alphaBounds, { left: 60, top: 90, right: 139, bottom: 149 });
  assert.equal(result.whiteJunk.pass, true);
  assert.equal(result.sha256, createHash("sha256").update(result.png).digest("hex"));
});

test("repair rejects a fully opaque white background instead of treating the frame as the object", async () => {
  const flattened = await sharp({
    create: { width: 60, height: 40, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
  }).png().toBuffer();

  await assert.rejects(
    repairMetalRollerBuffer(flattened),
    /ML-matted transparent PNG|opaque-white/i,
  );
});
