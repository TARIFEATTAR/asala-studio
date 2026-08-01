/**
 * Paper-Doll Rig — composite engine core (build task 2).
 * Spec: docs/superpowers/specs/2026-07-30-paper-doll-rig-design.md
 *
 * Generalizes the shipped sidecarCapSplice doctrine: real component pixels,
 * placed by canonical millimetres, harmonized against Bone, grounded by
 * painted (never model-owned) occlusion and shadow. Class A finishes here at
 * $0; Class B hands the junction band to the weld lane (task 3) afterwards.
 *
 * Pure pixel/math module — no sharp, no fs, no DOM. The compose CLI
 * (scripts/paper-doll/compose.ts) handles decode/encode and registry I/O.
 *
 * v1 scope notes:
 *  - Plate-side gray-card correction only. Components carry no Bone region
 *    (they're cutouts), so their photometric baseline is enforced at intake
 *    (edge-halo gate) and can be nudged via an explicit per-layer gain.
 *  - Grain/sharpness matching is deferred to a later pass.
 *  - Foreground detection on opaque plates is a ΔRGB-vs-Bone threshold; the
 *    rig's full detector replaces it in task 4 if drift shows up.
 */

import { PAPER_DOLL_CANVAS_RGB, type RgbaImage } from "./componentRegistry";

// ─── Geometry ────────────────────────────────────────────────────────

export interface PixelBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface GeometrySpec {
  canvasWidthPx: number;
  canvasHeightPx: number;
  pxPerMm: number;
  /** Bottle base (foreground bottom) in plate pixels. */
  baselineY: number;
  /** Bottle vertical axis in plate pixels. */
  centerlineX: number;
  bodyBounds: PixelBounds;
}

/**
 * Foreground bounds on an opaque plate — material-independent.
 *
 * A fixed ΔRGB threshold assumes the subject is much darker than the canvas.
 * That holds for amber and cobalt, is marginal for clear, and FAILS for
 * frosted: frosted white glass sits only ~15–40 below Bone, so a fixed
 * threshold either misses it entirely or latches onto background gradient
 * (measured 2026-08-01: a real frosted plate reported a nonsense 1150×1276
 * body, aspect 1.11).
 *
 * Instead: measure the plate's own background from its border, then require a
 * SUSTAINED vertical run of differing pixels in a column. Product bodies are
 * tall and continuous; gradient noise and stray marks are not. This is the
 * same lesson as the silhouette and neck-crest fixes — never let a threshold
 * assume a material.
 */
export function detectPlateForegroundBounds(
  plate: RgbaImage,
  deltaThreshold?: number,
  options: { minRunFraction?: number } = {},
): PixelBounds | null {
  const { data, width, height } = plate;
  const border = measureBorderMeanRgb(plate);
  // Noise floor of the background itself, from the border ring.
  let noiseSum = 0, noiseN = 0;
  const ring = Math.min(12, Math.floor(Math.min(width, height) / 4));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (x < ring || x >= width - ring || y < ring || y >= height - ring) {
        const i = (y * width + x) * 4;
        noiseSum += (
          Math.abs(data[i] - border.r) +
          Math.abs(data[i + 1] - border.g) +
          Math.abs(data[i + 2] - border.b)
        ) / 3;
        noiseN++;
      }
    }
  }
  const noise = noiseN ? noiseSum / noiseN : 1;
  // Explicit threshold wins; otherwise sit well clear of background noise.
  const threshold = deltaThreshold ?? Math.max(4, noise * 3);
  // A body must occupy a meaningful vertical run — filters gradient and specks.
  //
  // Raise minRunFraction to ~0.4 on SHADOWED plates: a contact shadow is a
  // short (~200px) horizontal spread while the bottle is a ~1340px column, and
  // no intensity threshold can separate them — frosted's body signal (Δ~15) is
  // WEAKER than its shadow's (Δ~22). Run length is the only reliable
  // discriminator (2026-08-01).
  const minRun = Math.max(8, Math.round(height * (options.minRunFraction ?? 0.05)));

  let left = width, right = -1, top = height, bottom = -1, found = false;
  for (let x = 0; x < width; x++) {
    let run = 0, colTop = -1, colBottom = -1, best = 0, bestTop = -1, bestBottom = -1;
    for (let y = 0; y < height; y++) {
      const i = (y * width + x) * 4;
      const delta = (
        Math.abs(data[i] - border.r) +
        Math.abs(data[i + 1] - border.g) +
        Math.abs(data[i + 2] - border.b)
      ) / 3;
      if (delta > threshold) {
        if (run === 0) colTop = y;
        run++;
        colBottom = y;
        if (run > best) {
          best = run;
          bestTop = colTop;
          bestBottom = colBottom;
        }
      } else {
        run = 0;
      }
    }
    if (best >= minRun) {
      found = true;
      if (x < left) left = x;
      if (x > right) right = x;
      if (bestTop < top) top = bestTop;
      if (bestBottom > bottom) bottom = bestBottom;
    }
  }
  return found ? { left, right, top, bottom } : null;
}

export function deriveGeometrySpecFromPlate(
  plate: RgbaImage,
  canonBodyHeightMm: number,
  deltaThreshold = 30,
): GeometrySpec {
  const bounds = detectPlateForegroundBounds(plate, deltaThreshold);
  if (!bounds) throw new Error("No foreground detected on the body plate (plate reads as pure Bone).");
  const bodyHeightPx = bounds.bottom - bounds.top + 1;
  if (canonBodyHeightMm <= 0) throw new Error("canonBodyHeightMm must be positive.");
  return {
    canvasWidthPx: plate.width,
    canvasHeightPx: plate.height,
    pxPerMm: bodyHeightPx / canonBodyHeightMm,
    baselineY: bounds.bottom,
    centerlineX: Math.round((bounds.left + bounds.right) / 2),
    bodyBounds: bounds,
  };
}

// ─── Alpha foreground (components) ───────────────────────────────────

export function detectAlphaForegroundBounds(image: RgbaImage, alphaFloor = 8): PixelBounds | null {
  const { data, width, height } = image;
  let left = width, right = -1, top = height, bottom = -1, found = false;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > alphaFloor) {
        found = true;
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }
  return found ? { left, right, top, bottom } : null;
}

// ─── Harmonization: Bone as gray card ────────────────────────────────

export interface ChannelGain {
  r: number;
  g: number;
  b: number;
}

export function measureBorderMeanRgb(plate: RgbaImage, ringPx = 12): { r: number; g: number; b: number } {
  const { data, width, height } = plate;
  const ring = Math.min(ringPx, Math.floor(Math.min(width, height) / 4));
  let r = 0, g = 0, b = 0, n = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (x < ring || x >= width - ring || y < ring || y >= height - ring) {
        const i = (y * width + x) * 4;
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
        n++;
      }
    }
  }
  return n === 0 ? { r: 0, g: 0, b: 0 } : { r: r / n, g: g / n, b: b / n };
}

/**
 * Gain that maps the plate's measured Bone region onto canonical Bone.
 * Clamped: a plate needing more than ±12% per channel isn't a Bone plate —
 * that's an intake failure, not a correction target.
 */
export function computeGrayCardGain(
  measured: { r: number; g: number; b: number },
  clampLo = 0.88,
  clampHi = 1.12,
): ChannelGain {
  const gain = (target: number, m: number) =>
    Math.min(clampHi, Math.max(clampLo, m > 0 ? target / m : 1));
  return {
    r: gain(PAPER_DOLL_CANVAS_RGB.r, measured.r),
    g: gain(PAPER_DOLL_CANVAS_RGB.g, measured.g),
    b: gain(PAPER_DOLL_CANVAS_RGB.b, measured.b),
  };
}

export function applyChannelGain(image: RgbaImage, gain: ChannelGain): void {
  const { data, width, height } = image;
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = Math.min(255, Math.round(data[i * 4] * gain.r));
    data[i * 4 + 1] = Math.min(255, Math.round(data[i * 4 + 1] * gain.g));
    data[i * 4 + 2] = Math.min(255, Math.round(data[i * 4 + 2] * gain.b));
  }
}

// ─── Tone harmonization ──────────────────────────────────────────────

/**
 * Endpoints a harvested part is remapped onto so it stops reading as a
 * different photograph. Bone-born plates never reach 0 or 255; a PSD cutout
 * shot under hard studio light routinely clips at both ends, and THAT — not
 * key direction — is what makes a composited part look pasted on.
 *
 * Measured 2026-08-01 on the 17-415 family: the shiny-silver over-cap spans
 * the full 0..255 with both ends clipped, while the five bodies span 34..210
 * and clip nowhere. Its key highlight sits at 75% across, against 74–86% for
 * amber/cobalt/frosted/swirl — so the light DIRECTION already agrees. Only the
 * transfer curve was foreign.
 */
export const TONE_CONTRACT = { blackPoint: 26, whitePoint: 244 } as const;

/**
 * Remap an alpha-keyed part's transfer curve toward the plate tone contract.
 * `strength` 0 leaves it untouched, 1 lands it fully on the contract; 0.7 is
 * the pilot setting — enough to kill the clipping without flattening polished
 * metal into plastic (metal legitimately carries more range than glass).
 *
 * This is rung 1 of the spec's lighting-clash ladder (harmonize → better layer
 * → mirror → regenerate-once). It is deterministic and free; only escalate
 * past it on measured evidence, since regeneration risks silhouette drift.
 */
export function harmonizeToneRange(
  image: RgbaImage,
  strength = 0.7,
  contract: { blackPoint: number; whitePoint: number } = TONE_CONTRACT,
): void {
  const s = Math.min(1, Math.max(0, strength));
  const lo = contract.blackPoint * s;
  const hi = 255 - (255 - contract.whitePoint) * s;
  const { data, width, height } = image;
  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    if (data[o + 3] === 0) continue;
    for (let k = 0; k < 3; k++) {
      data[o + k] = Math.round(lo + (data[o + k] / 255) * (hi - lo));
    }
  }
}

/** p1/p50/p99 luminance of the opaque region — the tone signature to compare. */
export function measureToneSignature(
  image: RgbaImage,
  alphaFloor = 200,
): { p1: number; p50: number; p99: number; range: number } | null {
  const { data, width, height } = image;
  const lum: number[] = [];
  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    if (data[o + 3] < alphaFloor) continue;
    lum.push(data[o] * 0.299 + data[o + 1] * 0.587 + data[o + 2] * 0.114);
  }
  if (lum.length === 0) return null;
  lum.sort((a, b) => a - b);
  const q = (p: number) => lum[Math.floor(p * (lum.length - 1))];
  return { p1: q(0.01), p50: q(0.5), p99: q(0.99), range: q(0.99) - q(0.01) };
}

// ─── Resampling & compositing ────────────────────────────────────────

/** Premultiplied bilinear resample — avoids background halos at alpha edges. */
export function resampleRgbaBilinear(src: RgbaImage, targetWidth: number, targetHeight: number): RgbaImage {
  const out = new Uint8Array(targetWidth * targetHeight * 4);
  const { data, width, height } = src;
  const xRatio = width / targetWidth;
  const yRatio = height / targetHeight;
  for (let ty = 0; ty < targetHeight; ty++) {
    const sy = Math.min(height - 1.001, Math.max(0, (ty + 0.5) * yRatio - 0.5));
    const y0 = Math.floor(sy);
    const fy = sy - y0;
    const y1 = Math.min(height - 1, y0 + 1);
    for (let tx = 0; tx < targetWidth; tx++) {
      const sx = Math.min(width - 1.001, Math.max(0, (tx + 0.5) * xRatio - 0.5));
      const x0 = Math.floor(sx);
      const fx = sx - x0;
      const x1 = Math.min(width - 1, x0 + 1);
      let pr = 0, pg = 0, pb = 0, pa = 0;
      const corners: Array<[number, number, number]> = [
        [x0, y0, (1 - fx) * (1 - fy)],
        [x1, y0, fx * (1 - fy)],
        [x0, y1, (1 - fx) * fy],
        [x1, y1, fx * fy],
      ];
      for (const [cx, cy, w] of corners) {
        const i = (cy * width + cx) * 4;
        const a = data[i + 3] / 255;
        pr += data[i] * a * w;
        pg += data[i + 1] * a * w;
        pb += data[i + 2] * a * w;
        pa += a * w;
      }
      const o = (ty * targetWidth + tx) * 4;
      if (pa > 0.002) {
        out[o] = Math.round(Math.min(255, pr / pa));
        out[o + 1] = Math.round(Math.min(255, pg / pa));
        out[o + 2] = Math.round(Math.min(255, pb / pa));
        out[o + 3] = Math.round(Math.min(255, pa * 255));
      }
    }
  }
  return { data: out, width: targetWidth, height: targetHeight, hasAlpha: true };
}

/**
 * Straight-alpha OVER, in place. Correct for BOTH opaque plates and
 * transparent layer canvases (doll-layer export): destination alpha is
 * blended too, so content composited onto a transparent canvas survives.
 */
export function compositeOver(dst: RgbaImage, src: RgbaImage, offsetX: number, offsetY: number): void {
  for (let sy = 0; sy < src.height; sy++) {
    const dy = offsetY + sy;
    if (dy < 0 || dy >= dst.height) continue;
    for (let sx = 0; sx < src.width; sx++) {
      const dx = offsetX + sx;
      if (dx < 0 || dx >= dst.width) continue;
      const si = (sy * src.width + sx) * 4;
      const a = src.data[si + 3] / 255;
      if (a <= 0) continue;
      const di = (dy * dst.width + dx) * 4;
      const dstA = dst.data[di + 3] / 255;
      const outA = a + dstA * (1 - a);
      if (outA <= 0) continue;
      dst.data[di] = Math.round((src.data[si] * a + dst.data[di] * dstA * (1 - a)) / outA);
      dst.data[di + 1] = Math.round((src.data[si + 1] * a + dst.data[di + 1] * dstA * (1 - a)) / outA);
      dst.data[di + 2] = Math.round((src.data[si + 2] * a + dst.data[di + 2] * dstA * (1 - a)) / outA);
      dst.data[di + 3] = Math.round(outA * 255);
    }
  }
}

/** Feather the bottom rows of a component's alpha so the junction blends. */
export function featherBottomAlpha(image: RgbaImage, featherPx: number): void {
  const bounds = detectAlphaForegroundBounds(image);
  if (!bounds || featherPx <= 0) return;
  for (let step = 0; step < featherPx; step++) {
    const y = bounds.bottom - step;
    if (y < 0) break;
    const keep = (step + 1) / (featherPx + 1);
    for (let x = 0; x < image.width; x++) {
      const i = (y * image.width + x) * 4 + 3;
      image.data[i] = Math.round(image.data[i] * keep);
    }
  }
}

// ─── Placement ───────────────────────────────────────────────────────

export type PlacementMode = "assembled" | "detached";

export interface PlacementRequest {
  mode: PlacementMode;
  /** Physical height of the component's visible extent. */
  heightMm: number;
  /** assembled: how far the closure drops over/onto the neck. */
  overlapMm?: number;
  /** detached (legacy view — not part of the swatch architecture): gap between body right edge and component left edge. */
  gapMm?: number;
  /**
   * Mounting axis in SOURCE component pixels. Defaults to the foreground
   * bounding-box center — correct for symmetric caps, wrong for asymmetric
   * assemblies (Empire bulb + tassel: the collar mounts on the neck while the
   * bulb hangs left). Measured once at intake, stored in the registry.
   */
  mountAxisXPx?: number;
}

export interface ResolvedPlacement {
  scale: number;
  targetWidthPx: number;
  targetHeightPx: number;
  /** Canvas offset of the resampled component's (0,0). */
  offsetX: number;
  offsetY: number;
  /** Canvas-space foreground box after placement. */
  placedBounds: PixelBounds;
}

export function solveClosurePlacement(
  component: RgbaImage,
  spec: GeometrySpec,
  request: PlacementRequest,
): ResolvedPlacement {
  const fg = detectAlphaForegroundBounds(component);
  if (!fg) throw new Error("Component has no alpha foreground to place.");
  const srcH = fg.bottom - fg.top + 1;
  const srcW = fg.right - fg.left + 1;
  if (request.heightMm <= 0) throw new Error("Placement heightMm must be positive.");
  const targetFgH = request.heightMm * spec.pxPerMm;
  const scale = targetFgH / srcH;
  const targetWidthPx = Math.max(1, Math.round(component.width * scale));
  const targetHeightPx = Math.max(1, Math.round(component.height * scale));

  // Foreground box inside the resampled component.
  const fgLeft = fg.left * scale;
  const fgTop = fg.top * scale;
  const fgW = srcW * scale;
  const fgH = srcH * scale;

  // The horizontal anchor inside the (scaled) component that must land on the
  // alignment target: the declared mount axis when present, else the bbox center.
  const anchorX = request.mountAxisXPx != null ? request.mountAxisXPx * scale : fgLeft + fgW / 2;

  let anchorXTarget: number;
  let fgBottomTarget: number;
  if (request.mode === "assembled") {
    const overlapPx = (request.overlapMm ?? 0) * spec.pxPerMm;
    anchorXTarget = spec.centerlineX;
    fgBottomTarget = spec.bodyBounds.top + overlapPx;
  } else {
    const gapPx = (request.gapMm ?? 0) * spec.pxPerMm;
    fgBottomTarget = spec.baselineY;
    anchorXTarget = spec.bodyBounds.right + gapPx + (anchorX - fgLeft);
  }

  const offsetX = Math.round(anchorXTarget - anchorX);
  const offsetY = Math.round(fgBottomTarget - (fgTop + fgH));
  return {
    scale,
    targetWidthPx,
    targetHeightPx,
    offsetX,
    offsetY,
    placedBounds: {
      left: Math.round(offsetX + fgLeft),
      right: Math.round(offsetX + fgLeft + fgW - 1),
      top: Math.round(offsetY + fgTop),
      bottom: Math.round(offsetY + fgTop + fgH - 1),
    },
  };
}

// ─── Painters (deterministic grounding) ──────────────────────────────

export interface ShadowStyle {
  /** Locked art direction: ambient contact, no directional cast. */
  peakOpacity: number; //   0.20–0.25 per spec
  /** Shadow reaches zero within this fraction of object width beyond it. */
  falloffRatio: number; //  0.12–0.15 per spec
  /** ry as a fraction of rx. */
  aspect: number;
  color: { r: number; g: number; b: number };
}

export const LOCKED_SHADOW_STYLE: ShadowStyle = {
  peakOpacity: 0.22,
  falloffRatio: 0.13,
  aspect: 0.16,
  color: { r: 0x6e, g: 0x67, b: 0x5e },
};

/**
 * Symmetric elliptical ambient-contact shadow, painted into the plate.
 * Opacity profile matches the locked spec literally: ~peak everywhere under
 * the object footprint ("at contact"), then a smooth fade to zero across the
 * falloff margin (12–15% of object width beyond the silhouette).
 */
export function paintContactShadow(
  image: RgbaImage,
  centerX: number,
  floorY: number,
  objectHalfWidthPx: number,
  style: ShadowStyle = LOCKED_SHADOW_STYLE,
): void {
  const rx = objectHalfWidthPx * (1 + style.falloffRatio);
  const ry = Math.max(2, rx * style.aspect);
  const inner = objectHalfWidthPx / rx; // normalized radius where the fade begins
  const y0 = Math.max(0, Math.floor(floorY - ry));
  const y1 = Math.min(image.height - 1, Math.ceil(floorY + ry));
  const x0 = Math.max(0, Math.floor(centerX - rx));
  const x1 = Math.min(image.width - 1, Math.ceil(centerX + rx));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = (x - centerX) / rx;
      const dy = (y - floorY) / ry;
      const r = Math.sqrt(dx * dx + dy * dy);
      if (r >= 1) continue;
      const fade = r <= inner ? 1 : (1 - (r - inner) / (1 - inner));
      const w = style.peakOpacity * fade * fade;
      const i = (y * image.width + x) * 4;
      image.data[i] = Math.round(image.data[i] * (1 - w) + style.color.r * w);
      image.data[i + 1] = Math.round(image.data[i + 1] * (1 - w) + style.color.g * w);
      image.data[i + 2] = Math.round(image.data[i + 2] * (1 - w) + style.color.b * w);
    }
  }
}

/** Soft occlusion band where the closure seats on the shoulder. */
export function paintContactOcclusion(
  image: RgbaImage,
  left: number,
  right: number,
  contactY: number,
  depthPx: number,
  strength = 0.12,
): void {
  const width = right - left + 1;
  if (width <= 0 || depthPx <= 0) return;
  for (let step = 0; step < depthPx; step++) {
    const y = contactY + step;
    if (y < 0 || y >= image.height) continue;
    const vertical = 1 - step / depthPx;
    for (let x = Math.max(0, left); x <= Math.min(image.width - 1, right); x++) {
      const t = (x - left) / width; // fade at the horizontal ends
      const horizontal = Math.sin(Math.PI * Math.min(1, Math.max(0, t)));
      const w = strength * vertical * horizontal;
      const i = (y * image.width + x) * 4;
      image.data[i] = Math.round(image.data[i] * (1 - w));
      image.data[i + 1] = Math.round(image.data[i + 1] * (1 - w));
      image.data[i + 2] = Math.round(image.data[i + 2] * (1 - w));
    }
  }
}

// ─── Assembled-height QA (self-checking placement) ───────────────────

export interface AssembledHeightQa {
  expectedPx: number;
  measuredPx: number;
  deltaPct: number;
  pass: boolean;
}

export function checkAssembledHeight(
  spec: GeometrySpec,
  assembledTopY: number,
  heightWithCapMm: number,
  tolerancePct = 2,
): AssembledHeightQa {
  const expectedPx = heightWithCapMm * spec.pxPerMm;
  const measuredPx = spec.baselineY - assembledTopY + 1;
  const deltaPct = ((measuredPx - expectedPx) / expectedPx) * 100;
  return { expectedPx, measuredPx, deltaPct, pass: Math.abs(deltaPct) <= tolerancePct };
}

// ─── Recipe ──────────────────────────────────────────────────────────

export interface CompositeRecipeLayer {
  registryId: string;
  sha256: string;
  mode: PlacementMode;
  request: PlacementRequest;
  resolved: ResolvedPlacement;
  bottomFeatherPx: number;
}

export interface CompositeRecipe {
  version: 1;
  createdAt: string;
  codeCommit: string | null;
  canvas: { widthPx: number; heightPx: number };
  body: {
    registryId: string;
    sha256: string;
    canonBodyHeightMm: number;
    geometrySpec: GeometrySpec;
  };
  layers: CompositeRecipeLayer[];
  harmonization: { plateGain: ChannelGain; boneTarget: string };
  shadow: { style: ShadowStyle; centerX: number; floorY: number; halfWidthPx: number } | null;
  occlusion: { left: number; right: number; contactY: number; depthPx: number; strength: number } | null;
  qa: { assembledHeight: AssembledHeightQa | null };
  output: { sha256: string | null; widthPx: number; heightPx: number };
}
