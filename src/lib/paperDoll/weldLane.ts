/**
 * Paper-Doll Rig — weld lane core (build task 3).
 * Spec: docs/superpowers/specs/2026-07-30-paper-doll-rig-design.md
 * ("Dip-tube accounting" + "Closure classes / Class B")
 *
 * The weld is the ONLY generative step in the composite path, and it is
 * scoped to a mask the model cannot escape: the collar-seat band where a
 * sprayer/pump meets the neck, plus the tube column where the dip tube must
 * read *through* the glass. Everything outside the mask is restored
 * byte-for-byte by the clamp — identity failure is architecturally
 * impossible regardless of provider behavior.
 *
 * Assembled-only (no sidecar, decided 2026-07-31). Pure pixel/math module —
 * the weld CLI does I/O, the provider call, and ledger writes.
 *
 * Mask convention (OpenAI /images/edits): TRANSPARENT pixels mark the
 * editable region; OPAQUE pixels are preserved-by-request. The clamp does
 * not trust that request — it enforces it.
 */

import type { RgbaImage } from "./componentRegistry";
import type { GeometrySpec, PixelBounds } from "./compositeEngine";
import { resampleRgbaBilinear } from "./compositeEngine";

// ─── Weld regions ────────────────────────────────────────────────────

export interface WeldRegionOptions {
  /** Padding around the fitment's seat line, in mm (band half-height). */
  collarBandMm: number;
  /** Dip-tube half-width in mm (tube radius as seen through glass). */
  tubeRadiusMm: number;
  /** Tube stops this far above the interior base. */
  tubeBottomMarginMm: number;
  /** Horizontal padding beyond the fitment bounds for the collar band, mm. */
  collarPadMm: number;
}

export const DEFAULT_WELD_REGIONS: WeldRegionOptions = {
  collarBandMm: 2.5,
  tubeRadiusMm: 2.2, // fine-mist sprayer; lotion pumps pass a fatter radius
  tubeBottomMarginMm: 2.0,
  collarPadMm: 1.5,
};

export interface WeldRegions {
  collarBand: PixelBounds;
  tubeColumn: PixelBounds;
}

/**
 * Derive the two editable regions from geometry — never hand-drawn:
 * the collar band brackets the fitment's bottom seat line; the tube column
 * runs down the bottle centerline from the seat to near the base.
 */
export function deriveWeldRegions(
  spec: GeometrySpec,
  fitmentBounds: PixelBounds,
  options: WeldRegionOptions = DEFAULT_WELD_REGIONS,
): WeldRegions {
  const mm = (v: number) => v * spec.pxPerMm;
  const seatY = fitmentBounds.bottom;
  const collarBand: PixelBounds = {
    left: Math.max(0, Math.round(fitmentBounds.left - mm(options.collarPadMm))),
    right: Math.min(spec.canvasWidthPx - 1, Math.round(fitmentBounds.right + mm(options.collarPadMm))),
    top: Math.max(0, Math.round(seatY - mm(options.collarBandMm))),
    bottom: Math.min(spec.canvasHeightPx - 1, Math.round(seatY + mm(options.collarBandMm))),
  };
  const tubeRadiusPx = Math.max(2, Math.round(mm(options.tubeRadiusMm)));
  const tubeColumn: PixelBounds = {
    left: Math.max(0, spec.centerlineX - tubeRadiusPx),
    right: Math.min(spec.canvasWidthPx - 1, spec.centerlineX + tubeRadiusPx),
    top: collarBand.bottom + 1,
    bottom: Math.min(
      spec.canvasHeightPx - 1,
      Math.round(spec.baselineY - mm(options.tubeBottomMarginMm)),
    ),
  };
  if (tubeColumn.bottom <= tubeColumn.top) {
    throw new Error("Tube column collapsed — fitment seat is below the usable body interior.");
  }
  return { collarBand, tubeColumn };
}

// ─── Mask ────────────────────────────────────────────────────────────

/**
 * Build the reviewed-mask PNG buffer: opaque everywhere, transparent inside
 * the weld regions, with a feathered alpha ramp at region edges so the clamp
 * blends instead of cutting.
 */
export function buildWeldMask(
  widthPx: number,
  heightPx: number,
  regions: WeldRegions,
  featherPx = 6,
): RgbaImage {
  const data = new Uint8Array(widthPx * heightPx * 4);
  // Opaque white base (color is irrelevant to the API; alpha carries meaning).
  for (let i = 0; i < widthPx * heightPx; i++) {
    data[i * 4] = 255;
    data[i * 4 + 1] = 255;
    data[i * 4 + 2] = 255;
    data[i * 4 + 3] = 255;
  }
  const punch = (b: PixelBounds) => {
    const x0 = Math.max(0, b.left - featherPx);
    const x1 = Math.min(widthPx - 1, b.right + featherPx);
    const y0 = Math.max(0, b.top - featherPx);
    const y1 = Math.min(heightPx - 1, b.bottom + featherPx);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        // Distance outside the hard region (0 inside).
        const dx = x < b.left ? b.left - x : x > b.right ? x - b.right : 0;
        const dy = y < b.top ? b.top - y : y > b.bottom ? y - b.bottom : 0;
        const d = Math.max(dx, dy);
        const editability = d >= featherPx ? 0 : 1 - d / featherPx;
        const i = (y * widthPx + x) * 4 + 3;
        const alpha = Math.round(255 * (1 - editability));
        if (alpha < data[i]) data[i] = alpha; // regions may overlap — most editable wins
      }
    }
  };
  punch(regions.collarBand);
  punch(regions.tubeColumn);
  return { data, width: widthPx, height: heightPx, hasAlpha: true };
}

// ─── Clamp ───────────────────────────────────────────────────────────

/**
 * The non-negotiable step: outside the mask's editable region, restore the
 * original pixels byte-for-byte; inside, take the weld; at feathered edges,
 * blend. If the provider returned different dimensions, resample the weld
 * back onto the original canvas first.
 */
export function clampOutsideMask(original: RgbaImage, welded: RgbaImage, mask: RgbaImage): RgbaImage {
  if (mask.width !== original.width || mask.height !== original.height) {
    throw new Error("Mask dimensions must match the original canvas.");
  }
  const weld = welded.width === original.width && welded.height === original.height
    ? welded
    : resampleRgbaBilinear(welded, original.width, original.height);
  const out = new Uint8Array(original.data.length);
  for (let i = 0; i < original.width * original.height; i++) {
    const editability = 1 - mask.data[i * 4 + 3] / 255;
    if (editability <= 0) {
      out[i * 4] = original.data[i * 4];
      out[i * 4 + 1] = original.data[i * 4 + 1];
      out[i * 4 + 2] = original.data[i * 4 + 2];
      out[i * 4 + 3] = 255;
    } else if (editability >= 1) {
      out[i * 4] = weld.data[i * 4];
      out[i * 4 + 1] = weld.data[i * 4 + 1];
      out[i * 4 + 2] = weld.data[i * 4 + 2];
      out[i * 4 + 3] = 255;
    } else {
      out[i * 4] = Math.round(weld.data[i * 4] * editability + original.data[i * 4] * (1 - editability));
      out[i * 4 + 1] = Math.round(weld.data[i * 4 + 1] * editability + original.data[i * 4 + 1] * (1 - editability));
      out[i * 4 + 2] = Math.round(weld.data[i * 4 + 2] * editability + original.data[i * 4 + 2] * (1 - editability));
      out[i * 4 + 3] = 255;
    }
  }
  return { data: out, width: original.width, height: original.height, hasAlpha: false };
}

// ─── QA ──────────────────────────────────────────────────────────────

export interface WeldQaReport {
  /** Mean |ΔRGB| inside the tube column — the weld must have drawn SOMETHING. */
  tubeColumnDelta: number;
  tubePresent: boolean;
  /** Sampled bit-identity outside the editable region (clamp proof). */
  outsideIdentical: boolean;
  issues: string[];
  passed: boolean;
}

export function runWeldQa(
  original: RgbaImage,
  clamped: RgbaImage,
  mask: RgbaImage,
  regions: WeldRegions,
  options: { tubePresenceMinDelta?: number; expectTube?: boolean } = {},
): WeldQaReport {
  const minDelta = options.tubePresenceMinDelta ?? 5;
  const expectTube = options.expectTube ?? true;
  const issues: string[] = [];

  // Tube presence: mean delta inside the tube column.
  let sum = 0, n = 0;
  for (let y = regions.tubeColumn.top; y <= regions.tubeColumn.bottom; y++) {
    for (let x = regions.tubeColumn.left; x <= regions.tubeColumn.right; x++) {
      const i = (y * original.width + x) * 4;
      sum += (
        Math.abs(clamped.data[i] - original.data[i]) +
        Math.abs(clamped.data[i + 1] - original.data[i + 1]) +
        Math.abs(clamped.data[i + 2] - original.data[i + 2])
      ) / 3;
      n++;
    }
  }
  const tubeColumnDelta = n === 0 ? 0 : sum / n;
  const tubePresent = tubeColumnDelta >= minDelta;
  if (expectTube && !tubePresent) {
    issues.push(`tube_not_drawn: mean Δ ${tubeColumnDelta.toFixed(2)} inside tube column (< ${minDelta})`);
  }

  // Clamp proof: every fully-opaque-mask pixel must be bit-identical.
  let outsideIdentical = true;
  const stride = Math.max(1, Math.floor((original.width * original.height) / 20000));
  for (let i = 0; i < original.width * original.height; i += stride) {
    if (mask.data[i * 4 + 3] === 255) {
      if (
        clamped.data[i * 4] !== original.data[i * 4] ||
        clamped.data[i * 4 + 1] !== original.data[i * 4 + 1] ||
        clamped.data[i * 4 + 2] !== original.data[i * 4 + 2]
      ) {
        outsideIdentical = false;
        break;
      }
    }
  }
  if (!outsideIdentical) issues.push("clamp_violation: pixels changed outside the editable region");

  return { tubeColumnDelta, tubePresent, outsideIdentical, issues, passed: issues.length === 0 };
}

// ─── Welded-layer extraction ─────────────────────────────────────────

/**
 * Crop the fitment + welded regions out of the clamped composite into a
 * full-canvas, body-contextualized layer: opaque inside the union of the
 * fitment bounds and both weld regions, transparent elsewhere. Carrying
 * glass pixels is legitimate ONLY because the body plate is SHA-frozen —
 * the strip lands over byte-identical glass forever.
 */
export function extractWeldedLayer(
  clamped: RgbaImage,
  fitmentBounds: PixelBounds,
  regions: WeldRegions,
  edgeFeatherPx = 3,
): RgbaImage {
  const { width, height } = clamped;
  const out = new Uint8Array(width * height * 4);
  const boxes = [fitmentBounds, regions.collarBand, regions.tubeColumn];
  const alphaAt = (x: number, y: number): number => {
    let best = 0;
    for (const b of boxes) {
      const dx = x < b.left ? b.left - x : x > b.right ? x - b.right : 0;
      const dy = y < b.top ? b.top - y : y > b.bottom ? y - b.bottom : 0;
      const d = Math.max(dx, dy);
      const a = d === 0 ? 255 : d >= edgeFeatherPx ? 0 : Math.round(255 * (1 - d / edgeFeatherPx));
      if (a > best) best = a;
    }
    return best;
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const a = alphaAt(x, y);
      if (a === 0) continue;
      const i = (y * width + x) * 4;
      out[i] = clamped.data[i];
      out[i + 1] = clamped.data[i + 1];
      out[i + 2] = clamped.data[i + 2];
      out[i + 3] = a;
    }
  }
  return { data: out, width, height, hasAlpha: true };
}

// ─── Weld prompt (constrained, never creative) ───────────────────────

export interface WeldPromptInput {
  applicator: string; //      "Fine Mist Sprayer" | "Lotion Pump" | …
  bodyColor: string; //       "Clear" | "Amber" | …
  tubeReachMm: number; //     interior length the tube spans
  tubeDiameterMm: number;
}

export function buildWeldPrompt(input: WeldPromptInput): string {
  return [
    `Seat the ${input.applicator.toLowerCase()} collar naturally on the bottle neck inside the editable band: blend the junction, keep the collar's material, color, and finish exactly as shown.`,
    `Inside the vertical editable column, draw the ${input.applicator.toLowerCase()}'s dip tube visible through the ${input.bodyColor.toLowerCase()} glass: a straight translucent plastic tube about ${input.tubeDiameterMm.toFixed(1)} mm wide descending ${input.tubeReachMm.toFixed(0)} mm from the collar to just above the interior base, rendered BEHIND the front glass wall with natural refraction, slight optical displacement, and the glass wall highlights passing in front of it.`,
    "Match the existing studio lighting exactly. Change nothing outside the editable regions. Do not add liquid, labels, props, reflections of new objects, or any other elements.",
  ].join("\n");
}
