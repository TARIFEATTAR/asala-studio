import assert from "node:assert/strict";
import test from "node:test";

import sharp from "sharp";

import { inspectAuthorityMask } from "../../src/lib/paperDoll/componentPlateImage.node";
import { buildRowEnvelopeAuthorityMask } from "./build-cylinder-18-415-body-authority-review";

test("turns fragmented transparent-glass edge pixels into one reviewable exterior silhouette", async () => {
  const width = 20;
  const height = 24;
  const rgba = Buffer.alloc(width * height * 4);
  const setAlpha = (x: number, y: number, alpha: number) => {
    rgba[(y * width + x) * 4 + 3] = alpha;
  };

  // Two disconnected glass rails, a neck, and a base emulate a transparent
  // photographic extraction. Faint pollution above the bottle must not enter
  // the calibrated silhouette.
  setAlpha(2, 1, 2);
  for (let y = 4; y <= 6; y += 1) {
    for (let x = 8; x <= 11; x += 1) setAlpha(x, y, 255);
  }
  for (let y = 7; y <= 20; y += 1) {
    setAlpha(5, y, 255);
    setAlpha(14, y, 255);
  }
  for (let x = 5; x <= 14; x += 1) setAlpha(x, 21, 255);

  const sourcePng = await sharp(rgba, { raw: { width, height, channels: 4 } }).png().toBuffer();
  const result = await buildRowEnvelopeAuthorityMask({
    sourcePng,
    alphaThreshold: 8,
    stableThresholds: [8, 16, 32],
  });

  assert.deepEqual(result.authorityBoundsPx, { left: 5, top: 4, width: 10, height: 18 });
  assert.deepEqual(result.thresholdCalibration.boundsByThreshold, [
    { threshold: 8, bounds: { left: 5, top: 4, width: 10, height: 18 } },
    { threshold: 16, bounds: { left: 5, top: 4, width: 10, height: 18 } },
    { threshold: 32, bounds: { left: 5, top: 4, width: 10, height: 18 } },
  ]);
  assert.equal(result.thresholdCalibration.stable, true);
  assert.equal(result.sourceTopology.connectedComponentCount, 2);
  assert.equal(result.sourceTopology.frameContact, false);

  const inspection = await inspectAuthorityMask(result.maskPng, { expectedRegions: 1 });
  assert.deepEqual(inspection.authorityBoundsPx, result.authorityBoundsPx);
});

test("rejects thresholds whose measured object bounds are not stable on the real file", async () => {
  const alpha = Buffer.from([
    0, 0, 0, 0, 0, 0, 0, 0,
    0, 9, 9, 9, 9, 9, 9, 0,
    0, 9, 9, 9, 9, 9, 9, 0,
    0, 9, 9, 255, 255, 9, 9, 0,
    0, 9, 9, 255, 255, 9, 9, 0,
    0, 9, 9, 9, 9, 9, 9, 0,
    0, 9, 9, 9, 9, 9, 9, 0,
    0, 0, 0, 0, 0, 0, 0, 0,
  ]);
  const rgba = Buffer.alloc(8 * 8 * 4);
  for (let index = 0; index < alpha.length; index += 1) rgba[index * 4 + 3] = alpha[index];
  const sourcePng = await sharp(rgba, { raw: { width: 8, height: 8, channels: 4 } }).png().toBuffer();

  await assert.rejects(
    () => buildRowEnvelopeAuthorityMask({
      sourcePng,
      alphaThreshold: 8,
      stableThresholds: [8, 16, 32],
    }),
    /threshold calibration is unstable/i,
  );
});
