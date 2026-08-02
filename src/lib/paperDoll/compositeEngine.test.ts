import { test } from "node:test";
import assert from "node:assert/strict";

import { PAPER_DOLL_CANVAS_RGB, type RgbaImage } from "./componentRegistry";
import {
  applyChannelGain,
  checkAssembledHeight,
  compositeOver,
  computeGrayCardGain,
  deriveGeometrySpecFromPlate,
  detectAlphaForegroundBounds,
  detectPlateForegroundBounds,
  featherBottomAlpha,
  LOCKED_SHADOW_STYLE,
  measureBorderMeanRgb,
  paintContactOcclusion,
  paintContactShadow,
  resampleRgbaBilinear,
  solveClosurePlacement,
} from "./compositeEngine";

const BONE = PAPER_DOLL_CANVAS_RGB;

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

/**
 * Synthetic body plate on Bone: a 101px-wide dark bottle from y=100..399
 * (300px tall), exactly centered at x=200 (odd width → integral centerline),
 * canvas 400×520.
 */
function syntheticPlate(): RgbaImage {
  return makeImage(400, 520, (x, y) => {
    const inBottle = x >= 150 && x < 251 && y >= 100 && y < 400;
    return inBottle ? [90, 92, 95, 255] : [BONE.r, BONE.g, BONE.b, 255];
  }, false);
}

/** Synthetic cap cutout: 60×90 foreground box inside a 100×120 canvas. */
function syntheticCap(): RgbaImage {
  return makeImage(100, 120, (x, y) => {
    const inCap = x >= 20 && x < 80 && y >= 10 && y < 100;
    return inCap ? [40, 40, 45, 255] : [0, 0, 0, 0];
  });
}

// ─── geometry ────────────────────────────────────────────────────────

test("geometry spec derives px-per-mm, baseline, centerline from the plate", () => {
  // 300px body / 70mm → pxPerMm ≈ 4.2857
  const spec = deriveGeometrySpecFromPlate(syntheticPlate(), 70);
  assert.equal(spec.baselineY, 399);
  assert.equal(spec.centerlineX, 200);
  assert.ok(Math.abs(spec.pxPerMm - 300 / 70) < 1e-9);
  assert.deepEqual(spec.bodyBounds, { left: 150, right: 250, top: 100, bottom: 399 });
});

test("pure-Bone plate raises instead of guessing", () => {
  const empty = makeImage(100, 100, () => [BONE.r, BONE.g, BONE.b, 255], false);
  assert.throws(() => deriveGeometrySpecFromPlate(empty, 70), /No foreground/);
});

// ─── gray card ───────────────────────────────────────────────────────

test("gray-card gain maps an off-Bone plate back to Bone", () => {
  // Plate shot ~4% hot: border reads brighter than Bone (clamped to 255 so
  // the Uint8 store can't wrap).
  const hot = makeImage(200, 200, (x, y) => {
    const inBottle = x >= 80 && x < 120 && y >= 50 && y < 150;
    return inBottle
      ? [90, 92, 95, 255]
      : [
          Math.min(255, Math.round(BONE.r * 1.04)),
          Math.min(255, Math.round(BONE.g * 1.04)),
          Math.min(255, Math.round(BONE.b * 1.04)),
          255,
        ];
  }, false);
  const gain = computeGrayCardGain(measureBorderMeanRgb(hot));
  assert.ok(gain.r < 1 && gain.g < 1 && gain.b < 1);
  applyChannelGain(hot, gain);
  const corrected = measureBorderMeanRgb(hot);
  assert.ok(Math.abs(corrected.r - BONE.r) < 2, `r=${corrected.r}`);
  assert.ok(Math.abs(corrected.g - BONE.g) < 2, `g=${corrected.g}`);
  assert.ok(Math.abs(corrected.b - BONE.b) < 2, `b=${corrected.b}`);
});

test("gray-card gain clamps runaway corrections", () => {
  const gain = computeGrayCardGain({ r: 120, g: 120, b: 120 });
  assert.equal(gain.r, 1.12); // a plate this far off is an intake failure, not a fix
});

// ─── resample & composite ────────────────────────────────────────────

test("premultiplied resample preserves color and halves foreground size", () => {
  const cap = syntheticCap();
  const half = resampleRgbaBilinear(cap, 50, 60);
  const fg = detectAlphaForegroundBounds(half);
  assert.ok(fg, "resampled cap keeps a foreground");
  const w = fg!.right - fg!.left + 1;
  const h = fg!.bottom - fg!.top + 1;
  assert.ok(Math.abs(w - 30) <= 1, `w=${w}`);
  assert.ok(Math.abs(h - 45) <= 1, `h=${h}`);
  // Interior color survives premultiplied round-trip.
  const cx = Math.round((fg!.left + fg!.right) / 2);
  const cy = Math.round((fg!.top + fg!.bottom) / 2);
  const i = (cy * half.width + cx) * 4;
  assert.ok(Math.abs(half.data[i] - 40) <= 2);
  assert.equal(half.data[i + 3], 255);
});

test("compositeOver blends by alpha and ignores transparent pixels", () => {
  const dst = makeImage(10, 10, () => [BONE.r, BONE.g, BONE.b, 255], false);
  const src = makeImage(2, 2, (x, y) => (x === 0 && y === 0 ? [0, 0, 0, 255] : x === 1 && y === 0 ? [0, 0, 0, 128] : [255, 0, 0, 0]));
  compositeOver(dst, src, 4, 4);
  const at = (x: number, y: number) => (y * 10 + x) * 4;
  assert.equal(dst.data[at(4, 4)], 0); // opaque src wins
  const half = dst.data[at(5, 4)];
  assert.ok(half > 100 && half < 140, `half=${half}`); // 50% blend toward black
  assert.equal(dst.data[at(4, 5)], BONE.r); // fully transparent src leaves Bone
});

test("compositeOver onto a TRANSPARENT canvas preserves content and alpha", () => {
  const dst = makeImage(10, 10, () => [0, 0, 0, 0]);
  const src = makeImage(2, 2, () => [176, 138, 74, 255]);
  compositeOver(dst, src, 4, 4);
  const i = (4 * 10 + 4) * 4;
  assert.deepEqual([dst.data[i], dst.data[i + 1], dst.data[i + 2], dst.data[i + 3]], [176, 138, 74, 255]);
  // Untouched pixels stay fully transparent.
  assert.equal(dst.data[3], 0);
});

test("featherBottomAlpha ramps the last rows toward transparent", () => {
  const cap = syntheticCap();
  featherBottomAlpha(cap, 4);
  const alphaAt = (y: number) => cap.data[(y * cap.width + 50) * 4 + 3];
  assert.ok(alphaAt(99) < alphaAt(96)); // bottom-most row most feathered
  assert.equal(alphaAt(50), 255); // interior untouched
});

// ─── placement ───────────────────────────────────────────────────────

test("assembled placement scales by mm and seats on the neck with overlap", () => {
  const spec = deriveGeometrySpecFromPlate(syntheticPlate(), 70); // pxPerMm ≈ 4.2857
  const placement = solveClosurePlacement(syntheticCap(), spec, {
    mode: "assembled",
    heightMm: 21, // → 90px target foreground height (21 × 4.2857)
    overlapMm: 3.5, // → 15px drop over the neck
  });
  const fgH = placement.placedBounds.bottom - placement.placedBounds.top + 1;
  assert.ok(Math.abs(fgH - 90) <= 1, `fgH=${fgH}`);
  // Bottom of cap = body top (100) + 15px overlap.
  assert.ok(Math.abs(placement.placedBounds.bottom - 115) <= 1, `bottom=${placement.placedBounds.bottom}`);
  // Centered on the bottle axis.
  const cx = (placement.placedBounds.left + placement.placedBounds.right) / 2;
  assert.ok(Math.abs(cx - spec.centerlineX) <= 1, `cx=${cx}`);
});

test("asymmetric components align on the declared mount axis, not the bbox center", () => {
  const spec = deriveGeometrySpecFromPlate(syntheticPlate(), 70);
  // "Bulb assembly": wide foreground (x=20..179) whose mounting collar sits at
  // x=150 — far right of the bbox center (~100).
  const bulb = makeImage(200, 120, (x, y) => {
    const inside = x >= 20 && x < 180 && y >= 20 && y < 100;
    return inside ? [70, 70, 75, 255] : [0, 0, 0, 0];
  });
  const placement = solveClosurePlacement(bulb, spec, {
    mode: "assembled",
    heightMm: 14, // 80px src fg → 60px target → scale 0.75
    overlapMm: 2,
    mountAxisXPx: 150,
  });
  // The mount axis (150 × 0.75 + offsetX) must land on the bottle centerline…
  const axisOnCanvas = 150 * placement.scale + placement.offsetX;
  assert.ok(Math.abs(axisOnCanvas - spec.centerlineX) <= 1, `axis=${axisOnCanvas}`);
  // …which means the bbox center must NOT be centered (that's the old bug).
  const bboxCx = (placement.placedBounds.left + placement.placedBounds.right) / 2;
  assert.ok(Math.abs(bboxCx - spec.centerlineX) > 10, `bboxCx=${bboxCx}`);
});

test("detached placement seats on the baseline beside the body", () => {
  const spec = deriveGeometrySpecFromPlate(syntheticPlate(), 70);
  const placement = solveClosurePlacement(syntheticCap(), spec, {
    mode: "detached",
    heightMm: 21,
    gapMm: 7, // → 30px gap
  });
  assert.ok(Math.abs(placement.placedBounds.bottom - spec.baselineY) <= 1);
  assert.ok(Math.abs(placement.placedBounds.left - (spec.bodyBounds.right + 30)) <= 1,
    `left=${placement.placedBounds.left}`);
});

// ─── painters ────────────────────────────────────────────────────────

test("contact shadow darkens at contact and dies within the falloff", () => {
  const plate = syntheticPlate();
  const spec = deriveGeometrySpecFromPlate(plate, 70);
  const halfWidth = (spec.bodyBounds.right - spec.bodyBounds.left + 1) / 2;
  paintContactShadow(plate, spec.centerlineX, spec.baselineY + 2, halfWidth);
  const at = (x: number, y: number) => plate.data[(y * plate.width + x) * 4];
  // Just outside the bottle base, at floor level: visibly darkened Bone.
  const nearContact = at(spec.bodyBounds.right + 2, spec.baselineY + 2);
  assert.ok(nearContact < BONE.r - 10, `near=${nearContact}`);
  // Beyond the falloff radius: untouched Bone.
  const far = at(spec.bodyBounds.right + Math.round(halfWidth), spec.baselineY + 2);
  assert.equal(far, BONE.r);
  // Symmetric — no directional cast (locked art direction).
  const leftSide = at(spec.bodyBounds.left - 2, spec.baselineY + 2);
  assert.ok(Math.abs(leftSide - nearContact) <= 2, `${leftSide} vs ${nearContact}`);
});

test("occlusion band fades vertically and at its horizontal ends", () => {
  const plate = syntheticPlate();
  paintContactOcclusion(plate, 150, 249, 100, 8, 0.2);
  const at = (x: number, y: number) => plate.data[(y * plate.width + x) * 4];
  assert.ok(at(200, 100) < 90); // center of band darkened
  assert.ok(at(200, 100) < at(200, 106)); // fades with depth
  assert.ok(at(152, 100) > at(200, 100)); // fades at the ends
});

// ─── QA ──────────────────────────────────────────────────────────────

test("assembled-height QA passes truth and fails drift", () => {
  const spec = deriveGeometrySpecFromPlate(syntheticPlate(), 70);
  // Cap top at y=25 → assembled 375px ≈ 87.5mm at 4.2857 px/mm.
  const ok = checkAssembledHeight(spec, 25, 87.5);
  assert.ok(ok.pass, `delta=${ok.deltaPct}`);
  const drifted = checkAssembledHeight(spec, 25, 80);
  assert.equal(drifted.pass, false);
  assert.ok(drifted.deltaPct > 2);
});

test("locked shadow style matches the art-direction spec", () => {
  assert.ok(LOCKED_SHADOW_STYLE.peakOpacity >= 0.2 && LOCKED_SHADOW_STYLE.peakOpacity <= 0.25);
  assert.ok(LOCKED_SHADOW_STYLE.falloffRatio >= 0.12 && LOCKED_SHADOW_STYLE.falloffRatio <= 0.15);
});
