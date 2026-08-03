import assert from "node:assert/strict";
import test from "node:test";

import {
  binarySilhouetteIou,
  extractAdaptiveReferenceSilhouette,
  normalizeReferenceSilhouette,
} from "./referenceSilhouetteAnalysis";

function rectangleImage(width: number, height: number, bounds: { x: number; y: number; width: number; height: number }) {
  const rgb = new Uint8Array(width * height * 3).fill(255);
  for (let y = bounds.y; y < bounds.y + bounds.height; y += 1) for (let x = bounds.x; x < bounds.x + bounds.width; x += 1) {
    const offset = (y * width + x) * 3;
    rgb[offset] = 20;
    rgb[offset + 1] = 25;
    rgb[offset + 2] = 30;
  }
  return rgb;
}

test("adaptive silhouette calibration derives background and largest connected bounds", () => {
  const extraction = extractAdaptiveReferenceSilhouette(rectangleImage(40, 50, { x: 10, y: 8, width: 20, height: 30 }), 40, 50);
  assert.deepEqual(extraction.backgroundRgb, [255, 255, 255]);
  assert.equal(extraction.foregroundDistanceThreshold, 3);
  assert.deepEqual(extraction.bounds, { x: 10, y: 8, width: 20, height: 30 });
  assert.equal(extraction.largestComponentPixels, 600);
  assert.equal(extraction.outerEnvelopePixels, 600);
});

test("normalization compares shape independently of source crop and scale", () => {
  const first = extractAdaptiveReferenceSilhouette(rectangleImage(60, 80, { x: 15, y: 10, width: 30, height: 50 }), 60, 80);
  const second = extractAdaptiveReferenceSilhouette(rectangleImage(120, 160, { x: 30, y: 20, width: 60, height: 100 }), 120, 160);
  const firstNormalized = normalizeReferenceSilhouette(first, 60, 64);
  const secondNormalized = normalizeReferenceSilhouette(second, 120, 64);
  assert.equal(binarySilhouetteIou(firstNormalized, secondNormalized), 1);
});
