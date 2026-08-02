import { test } from "node:test";
import assert from "node:assert/strict";

import type { RgbaImage } from "./componentRegistry";
import { deriveGeometrySpecFromPlate } from "./compositeEngine";
import {
  buildWeldMask,
  buildWeldPrompt,
  clampOutsideMask,
  deriveWeldRegions,
  extractWeldedLayer,
  runWeldQa,
} from "./weldLane";

const BONE = { r: 0xf5, g: 0xf3, b: 0xef };

function makeImage(
  width: number,
  height: number,
  fill: (x: number, y: number) => [number, number, number, number],
  hasAlpha = true,
): RgbaImage {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = fill(x, y);
      const i = (y * width + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = a;
    }
  }
  return { data, width, height, hasAlpha };
}

/** Plate 400×520: bottle x=150..250, y=100..399 (300px = 70mm). */
function plate(): RgbaImage {
  return makeImage(400, 520, (x, y) => {
    const inBottle = x >= 150 && x < 251 && y >= 100 && y < 400;
    return inBottle ? [92, 94, 97, 255] : [BONE.r, BONE.g, BONE.b, 255];
  }, false);
}

const FITMENT_BOUNDS = { left: 176, top: 60, right: 224, bottom: 117 };

test("weld regions derive from geometry: collar brackets the seat, tube runs to near-base", () => {
  const spec = deriveGeometrySpecFromPlate(plate(), 70); // pxPerMm ≈ 4.2857
  const regions = deriveWeldRegions(spec, FITMENT_BOUNDS);
  // Collar band centered on the seat line (y=117), ±2.5mm ≈ ±10.7px.
  assert.ok(Math.abs(regions.collarBand.top - (117 - 11)) <= 1);
  assert.ok(Math.abs(regions.collarBand.bottom - (117 + 11)) <= 1);
  assert.ok(regions.collarBand.left < FITMENT_BOUNDS.left);
  // Tube column: centered on centerline (200) ± ~9px, ending ~2mm above base.
  assert.ok(Math.abs((regions.tubeColumn.left + regions.tubeColumn.right) / 2 - spec.centerlineX) <= 1);
  assert.ok(Math.abs(regions.tubeColumn.bottom - (spec.baselineY - Math.round(2 * spec.pxPerMm))) <= 1);
  assert.equal(regions.tubeColumn.top, regions.collarBand.bottom + 1);
});

test("mask is transparent inside regions, opaque outside, feathered between", () => {
  const spec = deriveGeometrySpecFromPlate(plate(), 70);
  const regions = deriveWeldRegions(spec, FITMENT_BOUNDS);
  const mask = buildWeldMask(400, 520, regions, 6);
  const alphaAt = (x: number, y: number) => mask.data[(y * 400 + x) * 4 + 3];
  // Inside the tube column: fully editable (transparent).
  assert.equal(alphaAt(spec.centerlineX, 300), 0);
  // Far outside: fully preserved (opaque).
  assert.equal(alphaAt(20, 20), 255);
  // In the feather ring just outside the column: intermediate.
  const fringe = alphaAt(regions.tubeColumn.right + 3, 300);
  assert.ok(fringe > 0 && fringe < 255, `fringe=${fringe}`);
});

test("clamp restores originals outside the mask no matter what the provider did", () => {
  const original = plate();
  const spec = deriveGeometrySpecFromPlate(original, 70);
  const regions = deriveWeldRegions(spec, FITMENT_BOUNDS);
  const mask = buildWeldMask(400, 520, regions, 4);
  // Hostile provider: returns solid magenta everywhere.
  const hostile = makeImage(400, 520, () => [255, 0, 255, 255], false);
  const clamped = clampOutsideMask(original, hostile, mask);
  const at = (x: number, y: number) => [
    clamped.data[(y * 400 + x) * 4],
    clamped.data[(y * 400 + x) * 4 + 1],
    clamped.data[(y * 400 + x) * 4 + 2],
  ];
  // Outside: byte-identical Bone.
  assert.deepEqual(at(20, 20), [BONE.r, BONE.g, BONE.b]);
  // Bottle glass outside the regions: untouched.
  assert.deepEqual(at(160, 350), [92, 94, 97]);
  // Inside the tube column: the provider's pixels.
  assert.deepEqual(at(spec.centerlineX, 300), [255, 0, 255]);
});

test("clamp resamples a provider result that came back at different dimensions", () => {
  const original = plate();
  const spec = deriveGeometrySpecFromPlate(original, 70);
  const regions = deriveWeldRegions(spec, FITMENT_BOUNDS);
  const mask = buildWeldMask(400, 520, regions, 4);
  const differentSize = makeImage(200, 260, () => [10, 200, 10, 255], false);
  const clamped = clampOutsideMask(original, differentSize, mask);
  const i = (300 * 400 + spec.centerlineX) * 4;
  assert.deepEqual([clamped.data[i], clamped.data[i + 1], clamped.data[i + 2]], [10, 200, 10]);
});

test("weld QA detects a drawn tube and proves the clamp", () => {
  const original = plate();
  const spec = deriveGeometrySpecFromPlate(original, 70);
  const regions = deriveWeldRegions(spec, FITMENT_BOUNDS);
  const mask = buildWeldMask(400, 520, regions, 4);
  // Simulated good weld: darker tube down the column, junction blended.
  const welded = makeImage(400, 520, (x, y) => {
    const inTube = x >= spec.centerlineX - 4 && x <= spec.centerlineX + 4 &&
      y >= regions.tubeColumn.top && y <= regions.tubeColumn.bottom;
    if (inTube) return [70, 72, 76, 255];
    const inBottle = x >= 150 && x < 251 && y >= 100 && y < 400;
    return inBottle ? [92, 94, 97, 255] : [BONE.r, BONE.g, BONE.b, 255];
  }, false);
  const clamped = clampOutsideMask(original, welded, mask);
  const qa = runWeldQa(original, clamped, mask, regions);
  assert.ok(qa.tubePresent, `delta=${qa.tubeColumnDelta}`);
  assert.equal(qa.outsideIdentical, true);
  assert.equal(qa.passed, true, qa.issues.join("; "));

  // A lazy weld that drew nothing fails tube presence…
  const lazy = clampOutsideMask(original, plate(), mask);
  const lazyQa = runWeldQa(original, lazy, mask, regions);
  assert.equal(lazyQa.passed, false);
  // …unless the color legitimately shows no tube (dark amber/cobalt).
  const darkGlass = runWeldQa(original, lazy, mask, regions, { expectTube: false });
  assert.equal(darkGlass.passed, true);
});

test("welded layer carries fitment + regions, transparent elsewhere", () => {
  const original = plate();
  const spec = deriveGeometrySpecFromPlate(original, 70);
  const regions = deriveWeldRegions(spec, FITMENT_BOUNDS);
  const layer = extractWeldedLayer(original, FITMENT_BOUNDS, regions);
  const alphaAt = (x: number, y: number) => layer.data[(y * 400 + x) * 4 + 3];
  assert.equal(alphaAt(200, 80), 255); //   inside fitment bounds
  assert.equal(alphaAt(spec.centerlineX, 300), 255); // inside tube column
  assert.equal(alphaAt(20, 20), 0); //      far background transparent
  assert.equal(alphaAt(160, 350), 0); //    body glass outside strip transparent
});

test("weld prompt is constrained by data, never creative", () => {
  const prompt = buildWeldPrompt({
    applicator: "Fine Mist Sprayer",
    bodyColor: "Clear",
    tubeReachMm: 64,
    tubeDiameterMm: 4.4,
  });
  assert.match(prompt, /fine mist sprayer/);
  assert.match(prompt, /4\.4 mm/);
  assert.match(prompt, /64 mm/);
  assert.match(prompt, /BEHIND the front glass wall/);
  assert.match(prompt, /Change nothing outside the editable regions/);
});
