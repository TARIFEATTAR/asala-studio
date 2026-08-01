import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateFilledHoverTwinQa,
  type FilledHoverTwinPixelPlane,
} from "./bestBottlesFilledHoverTwinQa.ts";

const WIDTH = 14;
const HEIGHT = 14;

function plane(width = WIDTH, height = HEIGHT, value = 240): FilledHoverTwinPixelPlane {
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    rgba[i * 4] = value;
    rgba[i * 4 + 1] = value;
    rgba[i * 4 + 2] = value;
    rgba[i * 4 + 3] = 255;
  }
  return { width, height, rgba };
}

function reviewedCavityMask(): FilledHoverTwinPixelPlane {
  const mask = plane(WIDTH, HEIGHT, 255);
  for (let y = 2; y <= 11; y += 1) {
    for (let x = 5; x <= 8; x += 1) {
      mask.rgba[(y * WIDTH + x) * 4 + 3] = 0;
    }
  }
  return mask;
}

function filledChild(fillTopY = 5): FilledHoverTwinPixelPlane {
  const child = plane();
  for (let y = fillTopY; y <= 11; y += 1) {
    for (let x = 5; x <= 8; x += 1) {
      const index = (y * WIDTH + x) * 4;
      child.rgba[index] = y === fillTopY ? 154 : 174;
      child.rgba[index + 1] = y === fillTopY ? 87 : 104;
      child.rgba[index + 2] = 38;
    }
  }
  return child;
}

test("passes an exact-size 70 percent fill contained by the reviewed cavity", () => {
  const result = evaluateFilledHoverTwinQa({
    parent: plane(),
    child: filledChild(),
    mask: reviewedCavityMask(),
    targetFillPercent: 70,
    fillTolerancePercent: 3,
  });

  assert.equal(result.status, "pass");
  assert.equal(result.observed.fillPercent, 70);
  assert.equal(result.observed.outsideMaskChangedPixels, 0);
  assert.equal(result.observed.meniscusDetected, true);
  assert.deepEqual(result.failures, []);
});

test("rejects a child with different pixel dimensions", () => {
  const result = evaluateFilledHoverTwinQa({
    parent: plane(),
    child: plane(13, 14),
    mask: reviewedCavityMask(),
    targetFillPercent: 70,
  });

  assert.equal(result.status, "fail");
  assert.ok(result.failures.includes("dimension_mismatch"));
});

test("rejects any material exterior, platform, background, or shadow change outside the mask", () => {
  const child = filledChild();
  const outsideIndex = (12 * WIDTH + 1) * 4;
  child.rgba[outsideIndex] = 0;
  child.rgba[outsideIndex + 1] = 0;
  child.rgba[outsideIndex + 2] = 0;

  const result = evaluateFilledHoverTwinQa({
    parent: plane(),
    child,
    mask: reviewedCavityMask(),
    targetFillPercent: 70,
  });

  assert.equal(result.status, "fail");
  assert.ok(result.failures.includes("outside_mask_pixels_changed"));
  assert.equal(result.observed.outsideMaskChangedPixels, 1);
});

test("rejects a fill outside 70 percent plus or minus 3 percent", () => {
  const result = evaluateFilledHoverTwinQa({
    parent: plane(),
    child: filledChild(7),
    mask: reviewedCavityMask(),
    targetFillPercent: 70,
    fillTolerancePercent: 3,
  });

  assert.equal(result.status, "fail");
  assert.equal(result.observed.fillPercent, 50);
  assert.ok(result.failures.includes("fill_level_out_of_range"));
});

test("rejects a diffuse interior edit without a coherent meniscus boundary", () => {
  const child = plane();
  for (let y = 5; y <= 11; y += 1) {
    const x = y % 2 === 0 ? 5 : 8;
    const index = (y * WIDTH + x) * 4;
    child.rgba[index] = 170;
    child.rgba[index + 1] = 100;
    child.rgba[index + 2] = 40;
  }

  const result = evaluateFilledHoverTwinQa({
    parent: plane(),
    child,
    mask: reviewedCavityMask(),
    targetFillPercent: 70,
  });

  assert.equal(result.status, "fail");
  assert.ok(result.failures.includes("meniscus_not_detected"));
});
