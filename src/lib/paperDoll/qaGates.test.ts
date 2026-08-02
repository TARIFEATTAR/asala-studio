import { test } from "node:test";
import assert from "node:assert/strict";

import type { RgbaImage } from "./componentRegistry";
import { countSignificantForegroundRegions } from "./componentRegistry";
import {
  measureForegroundMeanRgb,
  measureFinishSignals,
  opaqueWhiteFraction,
  plateSilhouette,
  runColorTruthGate,
  runRegistrationGate,
  runFinishStructureGate,
  runSwatchLockGate,
  silhouetteIoU,
} from "./qaGates";

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

function alphaBox(
  width: number,
  height: number,
  box: { left: number; top: number; right: number; bottom: number },
  rgb: [number, number, number] = [80, 80, 85],
): RgbaImage {
  return makeImage(width, height, (x, y) => {
    const inside = x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
    return inside ? [rgb[0], rgb[1], rgb[2], 255] : [0, 0, 0, 0];
  });
}

function bonePlate(
  width: number,
  height: number,
  box: { left: number; top: number; right: number; bottom: number },
  rgb: [number, number, number] = [110, 60, 30],
): RgbaImage {
  return makeImage(width, height, (x, y) => {
    const inside = x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
    return inside ? [rgb[0], rgb[1], rgb[2], 255] : [BONE.r, BONE.g, BONE.b, 255];
  }, false);
}

// ─── registration ────────────────────────────────────────────────────

test("registration gate passes within ±2px and fails beyond", () => {
  const expected = { left: 100, top: 50, right: 199, bottom: 249 };
  const exact = alphaBox(300, 300, expected);
  assert.equal(runRegistrationGate(exact, expected).pass, true);

  const shifted1 = alphaBox(300, 300, { left: 102, top: 50, right: 201, bottom: 249 });
  const r1 = runRegistrationGate(shifted1, expected);
  assert.equal(r1.pass, true); // exactly at tolerance
  assert.equal(r1.maxDeviationPx, 2);

  const shifted2 = alphaBox(300, 300, { left: 104, top: 50, right: 203, bottom: 249 });
  const r2 = runRegistrationGate(shifted2, expected);
  assert.equal(r2.pass, false);
  assert.equal(r2.maxDeviationPx, 4);

  const empty = makeImage(300, 300, () => [0, 0, 0, 0]);
  assert.equal(runRegistrationGate(empty, expected).pass, false);
});

// ─── swatch-lock ─────────────────────────────────────────────────────

test("swatch-lock passes identical silhouettes across colors and fails a drifted body", () => {
  const box = { left: 120, top: 80, right: 220, bottom: 380 };
  const clear = bonePlate(400, 460, box, [200, 205, 208]);
  const amber = bonePlate(400, 460, box, [150, 96, 32]);
  const cobalt = bonePlate(400, 460, box, [40, 70, 160]);
  const locked = runSwatchLockGate([clear, amber, cobalt]);
  assert.equal(locked.pass, true, `minIoU=${locked.minIoU}`);
  assert.ok(locked.minIoU > 0.999);

  // A body 4mm-equivalent taller (like Frosted/Swirl) breaks the lock…
  const taller = bonePlate(400, 460, { ...box, top: 62 }, [225, 223, 218]);
  const broken = runSwatchLockGate([clear, taller]);
  assert.equal(broken.pass, false);
  assert.ok(broken.minIoU < 0.985, `minIoU=${broken.minIoU}`);
});

test("swatch-lock refuses mismatched canvases outright", () => {
  const a = bonePlate(400, 460, { left: 100, top: 100, right: 200, bottom: 400 });
  const b = bonePlate(400, 520, { left: 100, top: 100, right: 200, bottom: 400 });
  const result = runSwatchLockGate([a, b]);
  assert.equal(result.pass, false);
  assert.ok(result.issues[0].startsWith("canvas_mismatch"));
});

test("silhouette + IoU primitives behave", () => {
  const plateA = bonePlate(10, 10, { left: 2, top: 2, right: 5, bottom: 5 });
  const silhouette = plateSilhouette(plateA);
  assert.equal(silhouette.reduce((s, v) => s + v, 0), 16);
  assert.equal(silhouetteIoU(silhouette, silhouette), 1);
});

// ─── color truth ─────────────────────────────────────────────────────

test("color truth passes matching interiors and catches splice-lesson drift", () => {
  const gold = alphaBox(200, 200, { left: 50, top: 50, right: 149, bottom: 149 }, [176, 138, 74]);
  const truth = { r: 176, g: 138, b: 74 };
  assert.equal(runColorTruthGate(gold, truth).pass, true);

  // The measured copper drift from the splice era: ΔRGB ≈ 36 must fail.
  const drifted = alphaBox(200, 200, { left: 50, top: 50, right: 149, bottom: 149 }, [212, 174, 110]);
  const result = runColorTruthGate(drifted, truth);
  assert.equal(result.pass, false);
  assert.ok(result.delta !== null && Math.abs(result.delta - 36) < 1);
});

test("foreground mean ignores anti-aliased fringe", () => {
  const layer = makeImage(50, 50, (x, y) => {
    const inside = x >= 10 && x <= 39 && y >= 10 && y <= 39;
    const edge = inside && (x === 10 || x === 39 || y === 10 || y === 39);
    if (!inside) return [0, 0, 0, 0];
    if (edge) return [255, 255, 255, 120]; // semi-transparent bright fringe
    return [100, 100, 100, 255];
  });
  const mean = measureForegroundMeanRgb(layer);
  assert.ok(mean && Math.abs(mean.r - 100) < 1, `r=${mean?.r}`);
});

test("opaque-white fraction catches contiguous white junk that region counting misses", () => {
  const defectiveMetalRoller = makeImage(100, 1, (x) => x < 73
    ? [255, 255, 255, 255]
    : [124, 128, 132, 255]);

  assert.equal(countSignificantForegroundRegions(defectiveMetalRoller), 1);
  const result = opaqueWhiteFraction(defectiveMetalRoller);
  assert.ok(Math.abs(result.fraction - 0.73) < 0.001, `fraction=${result.fraction}`);
  assert.equal(result.pass, false);
});

test("opaque-white fraction accepts the plastic roller calibration range", () => {
  const plasticRoller = makeImage(100, 1, (x) => x === 0
    ? [255, 255, 255, 249]
    : [232, 232, 230, 255]);

  const result = opaqueWhiteFraction(plasticRoller);
  assert.equal(result.fraction, 0);
  assert.equal(result.pass, true);
});

test("finish structure separates crisp mirror bands from a diffuse matte gradient", () => {
  const mirror = makeImage(120, 80, (x) => {
    const bands = [18, 145, 52, 188, 76, 156];
    const value = bands[Math.min(bands.length - 1, Math.floor(x / 20))];
    return [value, value, value, 255];
  });
  const matte = makeImage(120, 80, (x) => {
    const value = Math.round(78 + (x / 119) * 26);
    return [value, value, value, 255];
  });

  assert.equal(runFinishStructureGate(mirror, "mirror").pass, true);
  assert.equal(runFinishStructureGate(matte, "matte").pass, true);
  assert.equal(runFinishStructureGate(mirror, "matte").pass, false);
  assert.ok(measureFinishSignals(mirror).sharpHorizontalGradientMass > measureFinishSignals(matte).sharpHorizontalGradientMass);
});

test("finish structure preserves readable highlights on glossy black and white", () => {
  const glossyBlack = makeImage(120, 80, (x) => {
    const value = x >= 70 && x < 82 ? 105 : 22;
    return [value, value, value, 255];
  });
  const glossyWhite = makeImage(120, 80, (x) => {
    const value = x >= 70 && x < 82 ? 178 : 142;
    return [value, value, value, 255];
  });

  assert.equal(runFinishStructureGate(glossyBlack, "glossy-black").pass, true);
  assert.equal(runFinishStructureGate(glossyWhite, "glossy-white").pass, true);
});

// ─── rail detector ───────────────────────────────────────────────────

test("rail detector flags barcode banding and passes quiet glass", async () => {
  const { detectVerticalRails } = await import("./qaGates");
  const bounds = { left: 100, top: 100, right: 300, bottom: 700 };

  // Quiet glass: dense wall edges, near-uniform transparent middle.
  const quiet = makeImage(400, 800, (x, y) => {
    const inside = x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom;
    if (!inside) return [BONE.r, BONE.g, BONE.b, 255];
    const edge = x < bounds.left + 20 || x > bounds.right - 20;
    const v = edge ? 150 : 235;
    return [v, v, v, 255];
  }, false);
  const quietResult = detectVerticalRails(quiet, bounds);
  assert.equal(quietResult.pass, true, `transitions=${quietResult.transitions}`);

  // Rails: repeating hard vertical bands across the mid-body.
  const railed = makeImage(400, 800, (x, y) => {
    const inside = x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom;
    if (!inside) return [BONE.r, BONE.g, BONE.b, 255];
    const v = Math.floor((x - bounds.left) / 12) % 2 === 0 ? 190 : 240;
    return [v, v, v, 255];
  }, false);
  const railedResult = detectVerticalRails(railed, bounds);
  assert.equal(railedResult.pass, false);
  assert.ok(railedResult.transitions > 3, `transitions=${railedResult.transitions}`);
  assert.ok(railedResult.issues[0].startsWith("vertical_rails_detected"));
});
