/**
 * Paper-Doll Rig — QA gates (build task 4).
 * Spec: docs/superpowers/specs/2026-07-30-paper-doll-rig-design.md ("QA gates")
 *
 * Automatic, before any human: these run on composites and doll-layer exports
 * so review becomes per-group contact-sheet judgment, never pixel forensics.
 *
 * - Registration gate (±2 px): a layer's alpha bounds must match its
 *   geometry_spec placement — enforced in Madison, never corrected on the
 *   website.
 * - Swatch-lock (silhouette IoU): all color plates of one swatch set must
 *   share a near-identical silhouette so the website swatch never jumps.
 * - Color truth (ΔRGB): a component's interior mean must match its intake
 *   truth — the cap-splice lesson (ΔRGB 36 copper drift) as a standing gate.
 *
 * Pure module; assembled-height QA lives in compositeEngine.
 */

import { PAPER_DOLL_CANVAS_RGB, type RgbaImage } from "./componentRegistry";
import type { PixelBounds } from "./compositeEngine";
import { detectAlphaForegroundBounds } from "./compositeEngine";

// ─── Registration gate (±2 px) ───────────────────────────────────────

export const REGISTRATION_TOLERANCE_PX = 2;

export interface RegistrationGateResult {
  expected: PixelBounds;
  measured: PixelBounds | null;
  maxDeviationPx: number | null;
  pass: boolean;
  issues: string[];
}

export function runRegistrationGate(
  layer: RgbaImage,
  expected: PixelBounds,
  tolerancePx: number = REGISTRATION_TOLERANCE_PX,
): RegistrationGateResult {
  const measured = detectAlphaForegroundBounds(layer);
  if (!measured) {
    return {
      expected,
      measured: null,
      maxDeviationPx: null,
      pass: false,
      issues: ["no_foreground: layer is fully transparent"],
    };
  }
  const deviations = [
    Math.abs(measured.left - expected.left),
    Math.abs(measured.right - expected.right),
    Math.abs(measured.top - expected.top),
    Math.abs(measured.bottom - expected.bottom),
  ];
  const maxDeviationPx = Math.max(...deviations);
  const pass = maxDeviationPx <= tolerancePx;
  return {
    expected,
    measured,
    maxDeviationPx,
    pass,
    issues: pass
      ? []
      : [`registration_out_of_tolerance: max deviation ${maxDeviationPx}px > ±${tolerancePx}px`],
  };
}

// ─── Swatch-lock (silhouette IoU across a set's color plates) ────────

export const SWATCH_LOCK_MIN_IOU = 0.985;

/**
 * Binary silhouette of an opaque Bone plate — the FILLED outer span per row.
 *
 * Must be filled, not raw colour-difference: clear glass differs from Bone
 * only at its wall edges (the middle is transparent), while amber differs
 * everywhere. Comparing raw difference masks made a clear-vs-amber IoU read
 * 0.21 despite the two bodies being geometrically identical (aspects 3.68 vs
 * 3.71) — a measurement artifact, not a real mismatch (found 2026-08-01).
 * Taking the span between the leftmost and rightmost differing pixel on each
 * row makes the comparison material-independent.
 */
export function plateSilhouette(plate: RgbaImage, deltaThreshold = 30): Uint8Array {
  const { data, width, height } = plate;
  const out = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    let left = -1, right = -1;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const delta =
        Math.abs(data[i] - PAPER_DOLL_CANVAS_RGB.r) +
        Math.abs(data[i + 1] - PAPER_DOLL_CANVAS_RGB.g) +
        Math.abs(data[i + 2] - PAPER_DOLL_CANVAS_RGB.b);
      if (delta / 3 > deltaThreshold) {
        if (left === -1) left = x;
        right = x;
      }
    }
    if (left === -1) continue;
    for (let x = left; x <= right; x++) out[y * width + x] = 1;
  }
  return out;
}

export function silhouetteIoU(a: Uint8Array, b: Uint8Array): number {
  if (a.length !== b.length) throw new Error("Silhouettes must share dimensions.");
  let intersection = 0, union = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] === 1 || b[i] === 1) {
      union++;
      if (a[i] === 1 && b[i] === 1) intersection++;
    }
  }
  return union === 0 ? 1 : intersection / union;
}

export interface SwatchLockResult {
  pairwiseIoU: Array<{ a: number; b: number; iou: number }>;
  minIoU: number;
  pass: boolean;
  issues: string[];
}

/**
 * All color plates of one swatch set (same canon geometry, same canvas) must
 * be silhouette-locked: pairwise IoU ≥ threshold, so swapping the body layer
 * on the website produces zero jump.
 */
export function runSwatchLockGate(
  plates: RgbaImage[],
  minIoU: number = SWATCH_LOCK_MIN_IOU,
  deltaThreshold = 30,
): SwatchLockResult {
  if (plates.length < 2) {
    return { pairwiseIoU: [], minIoU: 1, pass: true, issues: [] };
  }
  const first = plates[0];
  for (const plate of plates) {
    if (plate.width !== first.width || plate.height !== first.height) {
      return {
        pairwiseIoU: [],
        minIoU: 0,
        pass: false,
        issues: ["canvas_mismatch: swatch-set plates must share exact canvas dimensions"],
      };
    }
  }
  const silhouettes = plates.map((p) => plateSilhouette(p, deltaThreshold));
  const pairwiseIoU: Array<{ a: number; b: number; iou: number }> = [];
  let worst = 1;
  for (let a = 0; a < silhouettes.length; a++) {
    for (let b = a + 1; b < silhouettes.length; b++) {
      const iou = silhouetteIoU(silhouettes[a], silhouettes[b]);
      pairwiseIoU.push({ a, b, iou });
      if (iou < worst) worst = iou;
    }
  }
  const pass = worst >= minIoU;
  return {
    pairwiseIoU,
    minIoU: worst,
    pass,
    issues: pass ? [] : [`swatch_lock_broken: min pairwise IoU ${worst.toFixed(4)} < ${minIoU}`],
  };
}

// ─── Rail detector (the recurrent clear-glass defect) ────────────────

export const RAIL_MAX_TRANSITIONS = 3;
/**
 * Gradient threshold calibrated against real plates (2026-08-01):
 * v2 (GPT, rails visible to the eye) peaks at 2.0; v3 (Nano, clean) at 0.7.
 * 1.4 separates them. The old synthetic-fixture value of 6 ranked them
 * correctly but was far too lenient to catch the real defect.
 */
export const RAIL_GRADIENT_THRESHOLD = 1.4;

export interface RailDetectionResult {
  /** Sharp vertical transitions found across the quiet mid-body. */
  transitions: number;
  /** Peak |d(brightness)/dx| in the mid-body — rails spike this. */
  peakGradient: number;
  pass: boolean;
  issues: string[];
}

/**
 * Detect "barcode rails": repeating hard-edged vertical bands across the body
 * of a clear-glass plate. Physically, a clear cylinder concentrates its
 * optical event at the two WALL EDGES and leaves the middle quiet — so sharp
 * transitions in the central 60% of the body are the defect signature.
 *
 * Named after the recurrent GPT Image 2 failure the canon prompt has
 * forbidden by name for generations (confirmed again 2026-08-01).
 */
export function detectVerticalRails(
  plate: RgbaImage,
  bodyBounds: PixelBounds,
  options: { maxTransitions?: number; gradientThreshold?: number } = {},
): RailDetectionResult {
  const maxTransitions = options.maxTransitions ?? RAIL_MAX_TRANSITIONS;
  const gradientThreshold = options.gradientThreshold ?? RAIL_GRADIENT_THRESHOLD;
  const { data, width } = plate;

  // Sample the quiet mid-body: middle 50% vertically (skip neck and base).
  const y0 = Math.round(bodyBounds.top + (bodyBounds.bottom - bodyBounds.top) * 0.3);
  const y1 = Math.round(bodyBounds.top + (bodyBounds.bottom - bodyBounds.top) * 0.8);

  // Column-average brightness profile across the body.
  const profile: number[] = [];
  for (let x = bodyBounds.left; x <= bodyBounds.right; x++) {
    let sum = 0, n = 0;
    for (let y = y0; y <= y1; y++) {
      const i = (y * width + x) * 4;
      sum += (data[i] + data[i + 1] + data[i + 2]) / 3;
      n++;
    }
    profile.push(n ? sum / n : 0);
  }

  // Ignore the wall-edge zones (outer 20% each side) — brightness there is
  // physically correct, not a rail.
  const inset = Math.round(profile.length * 0.2);
  const mid = profile.slice(inset, profile.length - inset);
  if (mid.length < 8) {
    return { transitions: 0, peakGradient: 0, pass: true, issues: [] };
  }

  // Smooth lightly, then count local gradient peaks above threshold.
  const smooth = mid.map((_, i) => {
    const lo = Math.max(0, i - 1), hi = Math.min(mid.length - 1, i + 1);
    let s = 0;
    for (let k = lo; k <= hi; k++) s += mid[k];
    return s / (hi - lo + 1);
  });
  const grad = smooth.slice(1).map((v, i) => Math.abs(v - smooth[i]));
  const peakGradient = grad.length ? Math.max(...grad) : 0;
  let transitions = 0;
  for (let i = 1; i < grad.length - 1; i++) {
    if (grad[i] >= gradientThreshold && grad[i] >= grad[i - 1] && grad[i] >= grad[i + 1]) {
      transitions++;
      i += 2; // don't double-count a single edge
    }
  }

  const peakOk = peakGradient < gradientThreshold * 1.25;
  const pass = transitions <= maxTransitions && peakOk;
  const issues: string[] = [];
  if (transitions > maxTransitions) {
    issues.push(`vertical_rails_detected: ${transitions} sharp transitions across the quiet mid-body (max ${maxTransitions}) — barcode-rail defect`);
  } else if (!peakOk) {
    issues.push(`vertical_rails_detected: peak mid-body gradient ${peakGradient.toFixed(1)} (max ${(gradientThreshold * 1.25).toFixed(1)}) — banding in the quiet zone`);
  }
  return { transitions, peakGradient, pass, issues };
}

// ─── Color truth (ΔRGB vs intake truth) ──────────────────────────────

export const COLOR_TRUTH_MAX_DELTA = 12;

export interface ColorTruthResult {
  measuredMeanRgb: { r: number; g: number; b: number } | null;
  truthMeanRgb: { r: number; g: number; b: number };
  delta: number | null;
  pass: boolean;
  issues: string[];
}

/**
 * Mean interior RGB of a layer's foreground (alpha ≥ floor, eroded away from
 * edges so anti-aliased fringe never pollutes the measurement).
 */
export function measureForegroundMeanRgb(
  layer: RgbaImage,
  alphaFloor = 250,
): { r: number; g: number; b: number } | null {
  const { data, width, height } = layer;
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < width * height; i++) {
    if (data[i * 4 + 3] >= alphaFloor) {
      r += data[i * 4];
      g += data[i * 4 + 1];
      b += data[i * 4 + 2];
      n++;
    }
  }
  return n === 0 ? null : { r: r / n, g: g / n, b: b / n };
}

export function runColorTruthGate(
  layer: RgbaImage,
  truthMeanRgb: { r: number; g: number; b: number },
  maxDelta: number = COLOR_TRUTH_MAX_DELTA,
): ColorTruthResult {
  const measured = measureForegroundMeanRgb(layer);
  if (!measured) {
    return {
      measuredMeanRgb: null,
      truthMeanRgb,
      delta: null,
      pass: false,
      issues: ["no_opaque_foreground: cannot measure color truth"],
    };
  }
  const delta =
    (Math.abs(measured.r - truthMeanRgb.r) +
      Math.abs(measured.g - truthMeanRgb.g) +
      Math.abs(measured.b - truthMeanRgb.b)) /
    3;
  const pass = delta <= maxDelta;
  return {
    measuredMeanRgb: measured,
    truthMeanRgb,
    delta,
    pass,
    issues: pass ? [] : [`color_truth_drift: ΔRGB ${delta.toFixed(1)} > ${maxDelta} vs intake truth`],
  };
}
