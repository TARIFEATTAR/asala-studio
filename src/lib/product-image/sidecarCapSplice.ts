/**
 * Reference-cap splice for detached-sidecar renders (Jordan-approved 2026-07-19).
 *
 * gpt-image-2 relights metallic sidecar caps on the Bone canvas (measured
 * ΔRGB 36 on copper, 13 on gold vs byte-locked reference truth) and no prompt
 * language prevents it. The detached cap is a freestanding component on a flat
 * background — the easiest possible case of the adopted hero/collar-splice
 * doctrine — so the deterministic fix is to replace the rendered cap outright
 * with the reference's own cap pixels: keyed onto Bone, scaled to the rendered
 * bottle's proportions, seated on the shared baseline, grounded with a
 * rig-painted contact shadow. Cap beauty then comes from Jordan's photo by
 * construction; the model never touches it.
 *
 * Pure pixel functions — no DOM — so the whole path is Node-testable and was
 * validated offline against the real failed copper/gold renders before wiring.
 */

export interface SpliceRgb {
  r: number;
  g: number;
  b: number;
}

export interface SpliceComponentBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface ReferenceCapExtraction {
  /** RGBA crop of the reference cap, background already normalized to Bone. */
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
  /** Cap pixel height ÷ bottle pixel height in the same reference photo. */
  capToBottleHeightRatio: number;
  /** Gap between bottle right edge and cap left edge ÷ bottle width. */
  gapToBottleWidthRatio: number;
  /** Mean interior RGB of the reference cap — the color-fidelity truth. */
  meanRgb: SpliceRgb;
  /**
   * Fraction of the cap crop classified as solid foreground. Translucent and
   * clear overcaps read mostly background-like; below ~0.35 the splice must
   * decline (keying would eat the cap) and the model's cap stays, gated.
   */
  foregroundFraction: number;
  /** Cap body position within the crop (crop rows also hold its real shadow). */
  capTopInCrop: number;
  capBottomInCrop: number;
  capLeftInCrop: number;
  capRightInCrop: number;
}

/**
 * Low color threshold + tall-occupancy requirement: shiny silver interiors sit
 * only ~15-30 delta from a white/Bone plate (threshold 40 fragmented them into
 * dark reflection stripes — the SSLV Δ130 incident), while shadows are short
 * horizontal bands. Requiring a column to be occupied over 5% of the frame
 * height admits bright metal columns and rejects shadow-only columns.
 */
const FOREGROUND_DELTA_THRESHOLD = 14;

/**
 * Silver-proof component detection, exported for aspect-truth measurement.
 * The rig's threshold-40 tallest-component detector reads bare clear-glass
 * bottles as two thin side-wall slivers (2026-07-20: refs measured 7.34:1
 * against a real ~3.1:1, failing good renders); this detector's low threshold
 * + tall-occupancy + same-extent merging keeps transparent and bright-metal
 * objects whole.
 */
export function detectSilverProofComponents(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  bg: SpliceRgb,
  maxBottomYPx?: number | null,
): SpliceComponentBounds[] {
  return columnComponents(pixels, width, height, bg, maxBottomYPx);
}

function columnComponents(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  bg: SpliceRgb,
  maxBottomYPx?: number | null,
): SpliceComponentBounds[] {
  const yLimit = Math.min(
    height,
    typeof maxBottomYPx === "number" && Number.isFinite(maxBottomYPx)
      ? Math.max(1, Math.round(maxBottomYPx) + 1)
      : height,
  );
  const minColumnPixels = Math.max(12, Math.round(height * 0.05));
  const colTop = new Array<number | null>(width).fill(null);
  const colBottom = new Array<number | null>(width).fill(null);
  for (let x = 0; x < width; x += 1) {
    let occupied = 0;
    let top: number | null = null;
    let bottom: number | null = null;
    for (let y = 0; y < yLimit; y += 1) {
      const i = (y * width + x) * 4;
      const delta = Math.max(
        Math.abs(pixels[i] - bg.r),
        Math.abs(pixels[i + 1] - bg.g),
        Math.abs(pixels[i + 2] - bg.b),
      );
      if (delta > FOREGROUND_DELTA_THRESHOLD) {
        occupied += 1;
        if (top === null) top = y;
        bottom = y;
      }
    }
    if (occupied >= minColumnPixels) {
      colTop[x] = top;
      colBottom[x] = bottom;
    }
  }
  const minGap = Math.max(4, Math.round(width * 0.01));
  const runs: Array<{ left: number; right: number }> = [];
  let runStart: number | null = null;
  let gap = 0;
  for (let x = 0; x < width; x += 1) {
    if (colTop[x] != null) {
      if (runStart === null) runStart = x;
      gap = 0;
    } else if (runStart !== null) {
      gap += 1;
      if (gap >= minGap) {
        runs.push({ left: runStart, right: x - gap });
        runStart = null;
        gap = 0;
      }
    }
  }
  if (runStart !== null) runs.push({ left: runStart, right: width - 1 - gap });

  const bounded: SpliceComponentBounds[] = [];
  for (const run of runs) {
    let top = Number.POSITIVE_INFINITY;
    let bottom = -1;
    for (let x = run.left; x <= run.right; x += 1) {
      const t = colTop[x];
      const b = colBottom[x];
      if (t != null && t < top) top = t;
      if (b != null && b > bottom) bottom = b;
    }
    if (bottom >= 0) bounded.push({ left: run.left, right: run.right, top, bottom });
  }

  // Merge fragments of one solid object: a shiny silver cap reads as two dark
  // silhouette stripes with a background-bright middle, splitting into two
  // runs that share almost identical vertical extent. Distinct objects
  // (bottle vs cap) differ strongly in top/height, so extent similarity is a
  // safe merge key; the gap must also be small relative to the fragments.
  bounded.sort((a, b) => a.left - b.left);
  const merged: SpliceComponentBounds[] = [];
  for (const run of bounded) {
    const previous = merged[merged.length - 1];
    if (previous) {
      const gap = run.left - previous.right;
      const heightA = previous.bottom - previous.top + 1;
      const heightB = run.bottom - run.top + 1;
      const widthA = previous.right - previous.left + 1;
      const widthB = run.right - run.left + 1;
      const sameExtent =
        Math.abs(previous.top - run.top) <= height * 0.08 &&
        Math.abs(previous.bottom - run.bottom) <= height * 0.04 &&
        Math.min(heightA, heightB) / Math.max(heightA, heightB) >= 0.8;
      if (sameExtent && gap >= 0 && gap <= Math.max(widthA, widthB) * 2) {
        previous.right = run.right;
        previous.top = Math.min(previous.top, run.top);
        previous.bottom = Math.max(previous.bottom, run.bottom);
        continue;
      }
    }
    merged.push({ ...run });
  }
  return merged.filter((c) => c.right - c.left >= width * 0.02);
}

function componentHeight(c: SpliceComponentBounds): number {
  return c.bottom - c.top + 1;
}

function meanInteriorRgb(
  pixels: Uint8ClampedArray,
  width: number,
  c: SpliceComponentBounds,
): SpliceRgb {
  const x0 = Math.round(c.left + (c.right - c.left) * 0.25);
  const x1 = Math.round(c.left + (c.right - c.left) * 0.75);
  const y0 = Math.round(c.top + (c.bottom - c.top) * 0.25);
  const y1 = Math.round(c.top + (c.bottom - c.top) * 0.75);
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      const i = (y * width + x) * 4;
      r += pixels[i];
      g += pixels[i + 1];
      b += pixels[i + 2];
      n += 1;
    }
  }
  return n > 0
    ? { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) }
    : { r: 0, g: 0, b: 0 };
}

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/**
 * Extract the sidecar cap from a byte-locked reference photo. The cap is the
 * second-tallest column component (tallest = bottle, the pilot-proven rule).
 * The crop's background is normalized to the target Bone continuously — the
 * same technique as prepareUnmaskedRigRecanvasPixels — so white specular
 * highlights inside the cap survive while the surrounding plate becomes Bone.
 */
export function extractReferenceSidecarCap(
  refPixels: Uint8ClampedArray,
  refWidth: number,
  refHeight: number,
  targetBg: SpliceRgb,
): ReferenceCapExtraction | null {
  const sourceBg: SpliceRgb = { r: refPixels[0], g: refPixels[1], b: refPixels[2] };
  const components = columnComponents(refPixels, refWidth, refHeight, sourceBg);
  if (components.length < 2) return null;
  const sorted = [...components].sort((a, b) => componentHeight(b) - componentHeight(a));
  const bottle = sorted[0];
  const cap = sorted[1];
  const margin = 4;
  const cropLeft = Math.max(0, cap.left - margin);
  const cropRight = Math.min(refWidth - 1, cap.right + margin);
  const cropTop = Math.max(0, cap.top - margin);
  const cropBottom = Math.min(refHeight - 1, cap.bottom + margin);
  const width = cropRight - cropLeft + 1;
  const height = cropBottom - cropTop + 1;
  const pixels = new Uint8ClampedArray(width * height * 4);
  let foregroundCount = 0;
  let capAreaCount = 0;

  // Pass 1: classify pixels and derive a GEOMETRIC solid matte. Bright metallic
  // caps (shiny silver) have interiors color-close to the white reference plate,
  // so color-based keying bleaches them toward Bone (measured dRGB 47 on SSLV).
  // An opaque cap is a solid object: every pixel between a column's first and
  // last edge-detected row IS cap — keep it raw, no color test inside.
  const colFirst = new Array<number | null>(width).fill(null);
  const colLast = new Array<number | null>(width).fill(null);
  const edgeThreshold = 24;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const src = ((cropTop + y) * refWidth + (cropLeft + x)) * 4;
      const dr = Math.abs(refPixels[src] - sourceBg.r);
      const dg = Math.abs(refPixels[src + 1] - sourceBg.g);
      const db = Math.abs(refPixels[src + 2] - sourceBg.b);
      const sourceDistance = dr + dg + db;
      const insideCap =
        cropLeft + x >= cap.left &&
        cropLeft + x <= cap.right &&
        cropTop + y >= cap.top &&
        cropTop + y <= cap.bottom;
      if (insideCap) {
        capAreaCount += 1;
        const isForeground =
          sourceDistance >= 52 ||
          (sourceDistance >= 16 &&
            refPixels[src] >= sourceBg.r &&
            refPixels[src + 1] >= sourceBg.g &&
            refPixels[src + 2] >= sourceBg.b);
        if (isForeground) foregroundCount += 1;
        if (sourceDistance >= edgeThreshold) {
          if (colFirst[x] === null) colFirst[x] = y;
          colLast[x] = y;
        }
      }
    }
  }

  // Repair implausible columns before bridging: a pure-specular chrome column
  // can catch only a few rim pixels above the edge threshold, collapsing
  // colLast to the cap top — pasting that matte leaves see-through vertical
  // bands (the 2026-07-19 SSLV artifact: spans of 5-6px against a median of
  // 294). An opaque cap's bottom edge is continuous, so a column whose span
  // craters or whose bottom edge leaps away from the consensus is a sensor
  // miss, not geometry — null it so the neighbor interpolation rebuilds it.
  const detectedSpans: number[] = [];
  const detectedLasts: number[] = [];
  for (let x = 0; x < width; x += 1) {
    if (colFirst[x] !== null && colLast[x] !== null) {
      detectedSpans.push(colLast[x]! - colFirst[x]! + 1);
      detectedLasts.push(colLast[x]!);
    }
  }
  const repairNulled = new Array<boolean>(width).fill(false);
  if (detectedSpans.length > 0) {
    const medianOf = (values: number[]): number => {
      const sorted = [...values].sort((a, b) => a - b);
      return sorted[Math.floor(sorted.length / 2)];
    };
    const medianSpan = medianOf(detectedSpans);
    const medianLast = medianOf(detectedLasts);
    for (let x = 0; x < width; x += 1) {
      if (colFirst[x] === null || colLast[x] === null) continue;
      const span = colLast[x]! - colFirst[x]! + 1;
      const lastDrift = Math.abs(colLast[x]! - medianLast);
      if (span < medianSpan * 0.6 || lastDrift > height * 0.08) {
        colFirst[x] = null;
        colLast[x] = null;
        repairNulled[x] = true;
      }
    }
  }

  // Bridge bright columns: inside a solid cap, columns whose pixels all sit
  // within the edge threshold of the plate (shiny silver centers) found no
  // silhouette edges — interpolate their first/last rows from the nearest
  // detected neighbors so the solid matte stays contiguous.
  let lastValid: number | null = null;
  for (let x = 0; x < width; x += 1) {
    if (colFirst[x] !== null) { lastValid = x; continue; }
    let nextValid: number | null = null;
    for (let nx = x + 1; nx < width; nx += 1) {
      if (colFirst[nx] !== null) { nextValid = nx; break; }
    }
    if (lastValid !== null && nextValid !== null) {
      const t = (x - lastValid) / (nextValid - lastValid);
      colFirst[x] = Math.round(colFirst[lastValid]! * (1 - t) + colFirst[nextValid]! * t);
      colLast[x] = Math.round(colLast[lastValid]! * (1 - t) + colLast[nextValid]! * t);
    } else if (repairNulled[x]) {
      // A repair-nulled silhouette-edge column has a neighbor on one side
      // only — clamp-copy it rather than dropping the cap's outermost column
      // to transparency. Never-detected margin columns stay transparent.
      const donor = lastValid ?? nextValid;
      if (donor !== null) {
        colFirst[x] = colFirst[donor];
        colLast[x] = colLast[donor];
      }
    }
  }

  // Pass 2: solid silhouette matte carried in the ALPHA channel — the paste
  // composites only cap pixels over the render's own canvas, so no background
  // rectangle can appear regardless of plate-tone differences.
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const src = ((cropTop + y) * refWidth + (cropLeft + x)) * 4;
      const dst = (y * width + x) * 4;
      const first = colFirst[x];
      const last = colLast[x];
      let keep = 0;
      if (first !== null && last !== null && y >= first && y <= last) {
        keep = 1;
      } else if (first !== null && last !== null && (y === first - 1 || y === last + 1)) {
        keep = 0.5;
      }
      pixels[dst] = refPixels[src];
      pixels[dst + 1] = refPixels[src + 1];
      pixels[dst + 2] = refPixels[src + 2];
      pixels[dst + 3] = Math.round(keep * 255);
    }
  }
  return {
    pixels,
    width,
    height,
    capToBottleHeightRatio: componentHeight(cap) / Math.max(1, componentHeight(bottle)),
    gapToBottleWidthRatio:
      (cap.left - bottle.right) / Math.max(1, bottle.right - bottle.left + 1),
    meanRgb: meanInteriorRgb(refPixels, refWidth, cap),
    foregroundFraction: capAreaCount > 0 ? foregroundCount / capAreaCount : 0,
    capTopInCrop: cap.top - cropTop,
    capBottomInCrop: cap.bottom - cropTop,
    capLeftInCrop: cap.left - cropLeft,
    capRightInCrop: cap.right - cropLeft,
  };
}

/** Below this solid-foreground fraction the cap is translucent — never splice. */
export const SIDECAR_CAP_SPLICE_MIN_FOREGROUND_FRACTION = 0.35;

function bilinearSample(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  fx: number,
  fy: number,
  channel: number,
): number {
  const x0 = Math.max(0, Math.min(width - 1, Math.floor(fx)));
  const y0 = Math.max(0, Math.min(height - 1, Math.floor(fy)));
  const x1 = Math.min(width - 1, x0 + 1);
  const y1 = Math.min(height - 1, y0 + 1);
  const tx = clamp01(fx - x0);
  const ty = clamp01(fy - y0);
  const p00 = pixels[(y0 * width + x0) * 4 + channel];
  const p10 = pixels[(y0 * width + x1) * 4 + channel];
  const p01 = pixels[(y1 * width + x0) * 4 + channel];
  const p11 = pixels[(y1 * width + x1) * 4 + channel];
  const top = p00 * (1 - tx) + p10 * tx;
  const bottom = p01 * (1 - tx) + p11 * tx;
  return Math.round(top * (1 - ty) + bottom * ty);
}

export interface SidecarCapSpliceResult {
  spliced: boolean;
  reason: string | null;
  renderedCapMeanRgbBefore: SpliceRgb | null;
  targetCapBounds: SpliceComponentBounds | null;
  /**
   * Bottle bounds from the splice's own silver-proof component detection —
   * more reliable than window-based primary detection for bright metal, and
   * the correct basis for per-contact shadow lanes.
   */
  bottleBounds: SpliceComponentBounds | null;
}

/**
 * Replace the rendered sidecar cap with the reference cap:
 * erase the rendered cap (and its below-baseline shadow), paste the keyed
 * reference cap scaled to the rendered bottle's height ratio, seat it on the
 * shared baseline, and paint a soft rig-owned contact shadow.
 */
export function spliceSidecarCapIntoRender(params: {
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
  bg: SpliceRgb;
  baselineYPx: number;
  cap: ReferenceCapExtraction;
}): SidecarCapSpliceResult {
  const { pixels, width, height, bg, cap } = params;
  const baseline = Math.max(0, Math.min(height - 1, Math.round(params.baselineYPx)));
  const components = columnComponents(pixels, width, height, bg, baseline);
  if (components.length === 0) {
    return { spliced: false, reason: "no components detected in render", renderedCapMeanRgbBefore: null, targetCapBounds: null, bottleBounds: null };
  }
  const sorted = [...components].sort((a, b) => componentHeight(b) - componentHeight(a));
  const bottle = sorted[0];
  const renderedCap = sorted[1] ?? null;
  const renderedCapMeanRgbBefore = renderedCap
    ? meanInteriorRgb(pixels, width, renderedCap)
    : null;

  const bottleHeight = componentHeight(bottle);
  const bottleWidth = bottle.right - bottle.left + 1;
  const targetCapHeight = Math.max(8, Math.round(bottleHeight * cap.capToBottleHeightRatio));
  const targetCapWidth = Math.max(
    8,
    Math.round(cap.width * (targetCapHeight / cap.height)),
  );

  // Where the cap sits: keep the rendered cap slot's center when the model
  // provided one; otherwise reproduce the reference's own gap ratio.
  const targetCenterX = renderedCap
    ? Math.round((renderedCap.left + renderedCap.right) / 2)
    : Math.round(
        bottle.right + cap.gapToBottleWidthRatio * bottleWidth + targetCapWidth / 2,
      );
  const targetLeft = Math.max(0, Math.round(targetCenterX - targetCapWidth / 2));
  const targetTop = baseline - targetCapHeight + 1;
  if (targetTop < 0 || targetLeft + targetCapWidth >= width) {
    return { spliced: false, reason: "target cap slot exceeds canvas", renderedCapMeanRgbBefore, targetCapBounds: null, bottleBounds: { ...bottle } };
  }

  // 1) Locally erase the rendered cap AND its below-baseline shadow only —
  // the bottle keeps the model's own photographic shadow untouched (Jordan
  // 2026-07-19: no painted shadows, no canvas normalization strips). Fill tone
  // is sampled per column from below the shadow reach so it matches the
  // render's own canvas exactly, with feathered edges.
  if (renderedCap) {
    const margin = Math.max(6, Math.round(width * 0.012));
    const eraseLeft = Math.max(bottle.right + 2, renderedCap.left - margin);
    const eraseRight = Math.min(width - 1, renderedCap.right + margin * 3);
    const eraseTop = Math.max(0, renderedCap.top - margin);
    const eraseBottom = baseline;
    const sampleRow = Math.max(0, eraseTop - 8);
    const belowRow = Math.min(height - 1, baseline + 2);
    const feather = 16;
    // The erase box stops at the baseline; the rows below it are the model's
    // untouched canvas. A constant fill tone sampled far above the cap meets
    // those rows in a visible pale seam (the canvas has a gentle vertical
    // brightness gradient), so the fill must arrive at the baseline already
    // matching the pixel it meets. Per column: when the below-baseline tone is
    // background-close to the above tone, blend the whole column height (this
    // reproduces the canvas gradient); when it differs strongly (old-cap
    // shadow remnant below the baseline), keep the above tone and only ramp
    // the final rows so no hard line forms. This samples the render's own
    // pixels for background continuity — it never fabricates shadow tone.
    const seamRamp = 14;
    for (let x = eraseLeft; x <= eraseRight; x += 1) {
      const aboveIdx = (sampleRow * width + x) * 4;
      const belowIdx = (belowRow * width + x) * 4;
      const toneDelta = Math.max(
        Math.abs(pixels[aboveIdx] - pixels[belowIdx]),
        Math.abs(pixels[aboveIdx + 1] - pixels[belowIdx + 1]),
        Math.abs(pixels[aboveIdx + 2] - pixels[belowIdx + 2]),
      );
      const fullGradient = toneDelta <= 12;
      const above = [pixels[aboveIdx], pixels[aboveIdx + 1], pixels[aboveIdx + 2]];
      const below = [pixels[belowIdx], pixels[belowIdx + 1], pixels[belowIdx + 2]];
      for (let y = eraseTop; y <= eraseBottom; y += 1) {
        const t = fullGradient
          ? clamp01((y - eraseTop) / Math.max(1, eraseBottom - eraseTop))
          : clamp01((y - (eraseBottom - seamRamp)) / seamRamp);
        // No bottom feather: the erase holds full strength down to the
        // baseline so the old cap can't ghost through the final rows.
        const edgeDistance = Math.min(x - eraseLeft, eraseRight - x, y - eraseTop);
        const strength = clamp01((edgeDistance + 1) / feather);
        const i = (y * width + x) * 4;
        for (let c = 0; c < 3; c += 1) {
          const fill = above[c] * (1 - t) + below[c] * t;
          pixels[i + c] = Math.round(pixels[i + c] * (1 - strength) + fill * strength);
        }
        pixels[i + 3] = 255;
      }
    }
  }

  // 3) Alpha-composite the reference cap AND its own photographed shadow,
  // bilinear-scaled, cap base aligned to the shared baseline (shadow rows land
  // naturally below it). Only alpha-bearing pixels touch the canvas.
  const capOnlyHeight = Math.max(1, cap.capBottomInCrop - cap.capTopInCrop + 1);
  const scale = targetCapHeight / capOnlyHeight;
  const pasteHeight = Math.round(cap.height * scale);
  const pasteWidth = Math.round(cap.width * scale);
  const capCenterInCrop = (cap.capLeftInCrop + cap.capRightInCrop) / 2;
  const pasteLeft = Math.max(0, Math.round(targetCenterX - capCenterInCrop * scale));
  const pasteTop = baseline - Math.round((cap.capBottomInCrop + 1) * scale) + 1;
  for (let y = 0; y < pasteHeight; y += 1) {
    const destY = pasteTop + y;
    if (destY < 0 || destY >= height) continue;
    const fy = (y / Math.max(1, pasteHeight - 1)) * (cap.height - 1);
    for (let x = 0; x < pasteWidth; x += 1) {
      const destX = pasteLeft + x;
      if (destX < 0 || destX >= width) continue;
      const fx = (x / Math.max(1, pasteWidth - 1)) * (cap.width - 1);
      const alpha = bilinearSample(cap.pixels, cap.width, cap.height, fx, fy, 3) / 255;
      if (alpha <= 0.01) continue;
      const dst = (destY * width + destX) * 4;
      const r = bilinearSample(cap.pixels, cap.width, cap.height, fx, fy, 0);
      const g = bilinearSample(cap.pixels, cap.width, cap.height, fx, fy, 1);
      const b = bilinearSample(cap.pixels, cap.width, cap.height, fx, fy, 2);
      pixels[dst] = Math.round(r * alpha + pixels[dst] * (1 - alpha));
      pixels[dst + 1] = Math.round(g * alpha + pixels[dst + 1] * (1 - alpha));
      pixels[dst + 2] = Math.round(b * alpha + pixels[dst + 2] * (1 - alpha));
      pixels[dst + 3] = 255;
    }
  }

  return {
    spliced: true,
    reason: null,
    renderedCapMeanRgbBefore,
    targetCapBounds: {
      left: targetLeft,
      right: targetLeft + targetCapWidth - 1,
      top: targetTop,
      bottom: baseline,
    },
    bottleBounds: { ...bottle },
  };
}

/**
 * Post-splice (or splice-disabled) color fidelity check: mean interior RGB of
 * the rendered sidecar cap vs the reference cap. Euclidean ΔRGB above the
 * tolerance is a hard failure — measured drift on tonight's renders was 36 on
 * copper (visibly wrong) and 13 on gold (acceptable), so 20 splits them.
 */
export function measureSidecarCapColorDrift(params: {
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
  bg: SpliceRgb;
  baselineYPx: number;
  referenceCapMeanRgb: SpliceRgb;
}): number | null {
  const components = columnComponents(
    params.pixels,
    params.width,
    params.height,
    params.bg,
    params.baselineYPx,
  );
  if (components.length < 2) return null;
  const sorted = [...components].sort((a, b) => componentHeight(b) - componentHeight(a));
  const mean = meanInteriorRgb(params.pixels, params.width, sorted[1]);
  const ref = params.referenceCapMeanRgb;
  return Math.round(
    Math.sqrt((mean.r - ref.r) ** 2 + (mean.g - ref.g) ** 2 + (mean.b - ref.b) ** 2),
  );
}
