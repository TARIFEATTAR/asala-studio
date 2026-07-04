import { getFamilyRigForProduct, type FamilyRigConfig, type RigCapState } from "@/lib/product-image/familyRig";
import {
  buildFramingQaReport,
  getFramingDecision,
  type FramingDecision,
  type FramingQaReport,
} from "@/lib/product-image/framingQa";

interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface RigBaselineNormalizeResult {
  dataUrl: string;
  shifted: boolean;
  shiftXPx: number;
  shiftYPx: number;
  scale: number;
  detectedBaselineYPx: number | null;
  targetBaselineYPx: number | null;
  maskControlled: boolean;
  qaIssues: string[];
  framingQa: FramingQaReport | null;
  framingDecision: FramingDecision | null;
}

export interface RigBaselineNormalizeOptions {
  family?: string | null;
  bottleCollection?: string | null;
  graceSku?: string | null;
  websiteSku?: string | null;
  itemName?: string | null;
  itemDescription?: string | null;
  applicator?: string | null;
  capacityMl?: number | null;
  heightWithCap?: string | null;
  heightWithoutCap?: string | null;
  diameter?: string | null;
  capState?: string | null;
  mode?: string | null;
  targetBackgroundHex?: string;
  maskReferenceUrl?: string | null;
  requireMaskControl?: boolean;
}

export interface RigStrongBounds {
  top: number;
  bottom: number;
  left?: number;
  right?: number;
}

export interface RigAlphaControlPixelInput {
  data: ArrayLike<number>;
  width: number;
  height: number;
}

export interface RigAlphaControlBounds extends RigStrongBounds {
  left: number;
  right: number;
  foregroundPixels: number;
  foregroundPixelRatio: number;
}

export interface RigFrameTransformInput {
  width: number;
  height: number;
  rig: FamilyRigConfig;
  detectedBaselineYPx: number;
  strongBounds: RigStrongBounds | null;
  capState?: RigCapState;
}

export interface RigFrameTransform {
  scale: number;
  shiftXPx: number;
  shiftYPx: number;
  detectedBaselineYPx: number;
  targetBaselineYPx: number;
  transformedTopYPx: number | null;
  transformedBottomYPx: number | null;
  transformedLeftXPx: number | null;
  transformedRightXPx: number | null;
}

export interface RigBackgroundFlattenOptions {
  creamDistance?: number;
  paleForegroundGreenDelta?: number;
  paleForegroundBlueDelta?: number;
  shadowLumaDelta?: number;
  strongForegroundDistance?: number;
}

export interface RigBackgroundFlattenResult {
  flattenedPixels: number;
  preservedPixels: number;
}

export interface RigForegroundMatteOptions {
  strongForegroundDistance?: number;
  paleForegroundDistance?: number;
  foregroundNeighborhoodPx?: number;
  shadowNeighborhoodPx?: number;
  shadowLumaDelta?: number;
  shadowStartPct?: number;
  protectedProductBounds?: RigStrongBounds | null;
}

export interface RigForegroundMatteResult {
  mattedBackgroundPixels: number;
  opaqueForegroundPixels: number;
  shadowPixels: number;
}

export interface RigMaskControlledForegroundMatteOptions {
  alphaThreshold?: number;
  foregroundHaloPx?: number;
  shadowNeighborhoodPx?: number;
  shadowLumaDelta?: number;
  controlBounds?: RigAlphaControlBounds | null;
}

export interface RigMaskControlledBoundsQaInput {
  generatedBounds: RigStrongBounds | null;
  controlBounds: RigAlphaControlBounds;
  minGeneratedHeightRatio?: number;
  minOverlapRatio?: number;
}

export interface RigMaskControlledVisualContinuityQaInput {
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
  bg: Rgb;
  controlBounds: RigAlphaControlBounds;
  strongSignalDistance?: number;
  minSignalHeightRatio?: number;
  minRowCoverageRatio?: number;
  maxInternalGapRatio?: number;
  minDetailPixelRatio?: number;
}

export interface RigVisibleMatteArtifactQaInput {
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
  bg: Rgb;
  /** Fraction of the canvas allowed to read as a pale matte wash before it is flagged. */
  maxPaleAreaRatio?: number;
  /** Absolute floor so anti-alias fringe / specks on tiny canvases never trip the check. */
  minBlotchPixels?: number;
}

function buildStrongForegroundDistanceMap(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  bg: Rgb,
  options: {
    strongForegroundDistance: number;
    shadowLumaDelta: number;
    shadowStartY: number;
  },
): Uint16Array {
  const maxDistance = width + height + 1;
  const distances = new Uint16Array(width * height);
  const bgLuma = luma(bg);

  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    const pixelRow = row * 4;
    for (let x = 0; x < width; x += 1) {
      const p = row + x;
      const i = pixelRow + x * 4;
      if (pixels[i + 3] === 0) {
        distances[p] = maxDistance;
        continue;
      }

      const current = { r: pixels[i], g: pixels[i + 1], b: pixels[i + 2] };
      const distance = Math.abs(current.r - bg.r) + Math.abs(current.g - bg.g) + Math.abs(current.b - bg.b);
      const currentLuma = luma(current);
      const isPaleBackgroundLike =
        current.r >= bg.r + 6 &&
        current.g >= bg.g + 10 &&
        current.b >= bg.b + 14;
      const isLikelyShadowSeed =
        y >= options.shadowStartY &&
        currentLuma <= bgLuma - options.shadowLumaDelta &&
        distance < options.strongForegroundDistance * 4;

      distances[p] = distance >= options.strongForegroundDistance &&
        !isPaleBackgroundLike &&
        !isLikelyShadowSeed
        ? 0
        : maxDistance;
    }
  }

  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    for (let x = 0; x < width; x += 1) {
      const p = row + x;
      let best = distances[p];
      if (x > 0) best = Math.min(best, distances[p - 1] + 1);
      if (y > 0) best = Math.min(best, distances[p - width] + 1);
      distances[p] = best;
    }
  }

  for (let y = height - 1; y >= 0; y -= 1) {
    const row = y * width;
    for (let x = width - 1; x >= 0; x -= 1) {
      const p = row + x;
      let best = distances[p];
      if (x < width - 1) best = Math.min(best, distances[p + 1] + 1);
      if (y < height - 1) best = Math.min(best, distances[p + width] + 1);
      distances[p] = best;
    }
  }

  return distances;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
}

function hexToRgb(hex: string): Rgb | null {
  const raw = hex.replace(/^#/, "");
  const full = raw.length === 3
    ? raw.split("").map((c) => c + c).join("")
    : raw;
  if (!/^[0-9a-f]{6}$/i.test(full)) return null;
  const n = parseInt(full, 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

function colorDistance(pixels: Uint8ClampedArray, i: number, bg: Rgb): number {
  return Math.abs(pixels[i] - bg.r) + Math.abs(pixels[i + 1] - bg.g) + Math.abs(pixels[i + 2] - bg.b);
}

function luma(color: Rgb): number {
  return color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722;
}

export function detectAlphaControlBounds(
  input: RigAlphaControlPixelInput,
  options: { alphaThreshold?: number; minForegroundPixels?: number } = {},
): RigAlphaControlBounds | null {
  const totalPixels = input.width * input.height;
  const expectedLength = totalPixels * 4;
  if (input.width <= 0 || input.height <= 0 || input.data.length < expectedLength) {
    return null;
  }

  const alphaThreshold = options.alphaThreshold ?? 8;
  const minForegroundPixels = options.minForegroundPixels ?? 16;
  let left = input.width;
  let right = -1;
  let top = input.height;
  let bottom = -1;
  let foregroundPixels = 0;

  for (let y = 0; y < input.height; y += 1) {
    const row = y * input.width;
    for (let x = 0; x < input.width; x += 1) {
      const alpha = input.data[(row + x) * 4 + 3] ?? 0;
      if (alpha <= alphaThreshold) continue;
      foregroundPixels += 1;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }

  if (foregroundPixels < minForegroundPixels || bottom < 0) return null;

  return {
    left,
    right,
    top,
    bottom,
    foregroundPixels,
    foregroundPixelRatio: foregroundPixels / totalPixels,
  };
}

function boundsHeight(bounds: RigStrongBounds): number {
  return bounds.bottom - bounds.top + 1;
}

function boundsArea(bounds: RigStrongBounds): number {
  const width = typeof bounds.left === "number" && typeof bounds.right === "number"
    ? bounds.right - bounds.left + 1
    : 1;
  return Math.max(1, width) * Math.max(1, boundsHeight(bounds));
}

function boundsIntersectionArea(a: RigStrongBounds, b: RigStrongBounds): number {
  if (
    typeof a.left !== "number" ||
    typeof a.right !== "number" ||
    typeof b.left !== "number" ||
    typeof b.right !== "number"
  ) {
    const top = Math.max(a.top, b.top);
    const bottom = Math.min(a.bottom, b.bottom);
    return Math.max(0, bottom - top + 1);
  }

  const left = Math.max(a.left, b.left);
  const right = Math.min(a.right, b.right);
  const top = Math.max(a.top, b.top);
  const bottom = Math.min(a.bottom, b.bottom);
  return Math.max(0, right - left + 1) * Math.max(0, bottom - top + 1);
}

export function getMaskControlledBoundsQaIssues({
  generatedBounds,
  controlBounds,
  minGeneratedHeightRatio = 0.55,
  minOverlapRatio = 0.35,
}: RigMaskControlledBoundsQaInput): string[] {
  if (!generatedBounds) {
    return ["Generated product foreground was not detectable against the mask/control reference."];
  }

  const issues: string[] = [];
  const generatedHeight = boundsHeight(generatedBounds);
  const controlHeight = boundsHeight(controlBounds);
  if (generatedHeight < controlHeight * minGeneratedHeightRatio) {
    issues.push("Generated product foreground is too small for the mask/control envelope.");
  }

  const intersectionArea = boundsIntersectionArea(generatedBounds, controlBounds);
  const overlapRatio = intersectionArea / Math.min(boundsArea(generatedBounds), boundsArea(controlBounds));
  if (overlapRatio < minOverlapRatio) {
    issues.push("Generated product foreground does not overlap the mask/control envelope enough to recanvas safely.");
  }

  return issues;
}

export function getMaskControlledVisualContinuityQaIssues({
  pixels,
  width,
  height,
  bg,
  controlBounds,
  strongSignalDistance = 34,
  minSignalHeightRatio = 0.52,
  minRowCoverageRatio = 0.16,
  maxInternalGapRatio = 0.34,
  minDetailPixelRatio = 0.045,
}: RigMaskControlledVisualContinuityQaInput): string[] {
  const expectedLength = width * height * 4;
  if (width <= 0 || height <= 0 || pixels.length < expectedLength) {
    return ["Generated image pixels could not be read for mask/control continuity QA."];
  }

  const left = Math.max(0, controlBounds.left - Math.round(width * 0.035));
  const right = Math.min(width - 1, controlBounds.right + Math.round(width * 0.035));
  const top = Math.max(0, controlBounds.top - Math.round(height * 0.02));
  const bottom = Math.min(height - 1, controlBounds.bottom + Math.round(height * 0.02));
  const controlHeight = Math.max(1, controlBounds.bottom - controlBounds.top + 1);
  const rowSignalThreshold = Math.max(2, Math.min(8, Math.round((right - left + 1) * 0.008)));
  const signalWindowArea = Math.max(1, (right - left + 1) * (bottom - top + 1));
  const significantRows: number[] = [];
  const bgLuma = luma(bg);
  let signalTop = height;
  let signalBottom = -1;
  let detailSignalPixels = 0;

  for (let y = top; y <= bottom; y += 1) {
    let rowSignal = 0;
    const row = y * width;
    for (let x = left; x <= right; x += 1) {
      const i = (row + x) * 4;
      if ((pixels[i + 3] ?? 0) <= 8) continue;

      const current = { r: pixels[i], g: pixels[i + 1], b: pixels[i + 2] };
      const currentLuma = luma(current);
      const distance = colorDistance(pixels, i, bg);
      const isPaleMatteLike =
        current.r >= bg.r + 6 &&
        current.g >= bg.g + 10 &&
        current.b >= bg.b + 14;
      const isProductDetailSignal =
        currentLuma <= bgLuma - 28 ||
        (distance >= strongSignalDistance * 2 && !isPaleMatteLike);
      const isVisibleProductSignal =
        (distance >= strongSignalDistance && !isPaleMatteLike) ||
        currentLuma <= bgLuma - 22;

      if (isProductDetailSignal) detailSignalPixels += 1;
      if (!isVisibleProductSignal) continue;
      rowSignal += 1;
      signalTop = Math.min(signalTop, y);
      signalBottom = Math.max(signalBottom, y);
    }

    if (rowSignal >= rowSignalThreshold) {
      significantRows.push(y);
    }
  }

  const issues: string[] = [];
  if (signalBottom < 0 || significantRows.length === 0) {
    return ["Generated product has too little visible foreground inside the mask/control envelope."];
  }

  const signalHeight = signalBottom - signalTop + 1;
  if (signalHeight < controlHeight * minSignalHeightRatio) {
    issues.push("Generated product has too little visible foreground inside the mask/control envelope.");
  }

  if (detailSignalPixels < Math.max(12, Math.floor(signalWindowArea * minDetailPixelRatio))) {
    issues.push("Generated product lacks enough product edge/detail signal inside the mask/control envelope.");
  }

  if (significantRows.length < controlHeight * minRowCoverageRatio) {
    issues.push("Generated product foreground is too sparse inside the mask/control envelope.");
  }

  let maxInternalGap = 0;
  for (let i = 1; i < significantRows.length; i += 1) {
    maxInternalGap = Math.max(maxInternalGap, significantRows[i] - significantRows[i - 1] - 1);
  }
  if (maxInternalGap > controlHeight * maxInternalGapRatio) {
    issues.push("Generated product foreground is discontinuous inside the mask/control envelope.");
  }

  return issues;
}

export function getVisibleMatteArtifactQaIssues({
  pixels,
  width,
  height,
  bg,
  maxPaleAreaRatio = 0.02,
  minBlotchPixels = 64,
}: RigVisibleMatteArtifactQaInput): string[] {
  const expectedLength = width * height * 4;
  if (width <= 0 || height <= 0 || pixels.length < expectedLength) {
    return ["Generated image pixels could not be read for matte-artifact QA."];
  }

  // A leftover generation matte reads as a pale wash that is lighter than the
  // warm Bone background on every channel (the same signature the foreground
  // matte treats as "pale background-like"). A darker contact shadow fails this
  // test, so legitimate grounding is preserved.
  let paleMattePixels = 0;
  for (let i = 0; i < expectedLength; i += 4) {
    if ((pixels[i + 3] ?? 0) <= 8) continue;
    const isPaleMatteLike =
      pixels[i] >= bg.r + 6 &&
      pixels[i + 1] >= bg.g + 10 &&
      pixels[i + 2] >= bg.b + 14;
    if (isPaleMatteLike) paleMattePixels += 1;
  }

  const area = width * height;
  const limit = Math.max(minBlotchPixels, Math.floor(area * maxPaleAreaRatio));
  if (paleMattePixels <= limit) {
    return [];
  }

  const pct = ((paleMattePixels / area) * 100).toFixed(1);
  return [
    `Visible matte artifact: a pale blotch covers ~${pct}% of the canvas (leftover generation matte against the Bone background).`,
  ];
}

function buildAlphaForegroundDistanceMap(
  mask: RigAlphaControlPixelInput,
  alphaThreshold: number,
): Uint16Array {
  const { width, height } = mask;
  const maxDistance = width + height + 1;
  const distances = new Uint16Array(width * height);

  for (let p = 0; p < distances.length; p += 1) {
    const alpha = mask.data[p * 4 + 3] ?? 0;
    distances[p] = alpha > alphaThreshold ? 0 : maxDistance;
  }

  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    for (let x = 0; x < width; x += 1) {
      const p = row + x;
      let best = distances[p];
      if (x > 0) best = Math.min(best, distances[p - 1] + 1);
      if (y > 0) best = Math.min(best, distances[p - width] + 1);
      distances[p] = best;
    }
  }

  for (let y = height - 1; y >= 0; y -= 1) {
    const row = y * width;
    for (let x = width - 1; x >= 0; x -= 1) {
      const p = row + x;
      let best = distances[p];
      if (x < width - 1) best = Math.min(best, distances[p + 1] + 1);
      if (y < height - 1) best = Math.min(best, distances[p + width] + 1);
      distances[p] = best;
    }
  }

  return distances;
}

export function applyMaskControlledForegroundMatte(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  bg: Rgb,
  mask: RigAlphaControlPixelInput,
  options: RigMaskControlledForegroundMatteOptions = {},
): RigForegroundMatteResult {
  const alphaThreshold = options.alphaThreshold ?? 8;
  const controlBounds =
    options.controlBounds ?? detectAlphaControlBounds(mask, { alphaThreshold });
  if (!controlBounds || mask.width !== width || mask.height !== height) {
    return applyRigForegroundMatte(pixels, width, height, bg);
  }

  const distanceToMask = buildAlphaForegroundDistanceMap(mask, alphaThreshold);
  const foregroundHaloPx =
    options.foregroundHaloPx ?? Math.max(2, Math.round(Math.min(width, height) * 0.006));
  const shadowNeighborhoodPx =
    options.shadowNeighborhoodPx ?? Math.max(foregroundHaloPx + 2, Math.round(Math.min(width, height) * 0.055));
  const shadowLumaDelta = options.shadowLumaDelta ?? 24;
  const bgLuma = luma(bg);
  const shadowStartY = Math.max(
    Math.round(height * 0.58),
    controlBounds.bottom - Math.round(height * 0.035),
  );
  const shadowMaxY = Math.min(height - 1, controlBounds.bottom + Math.round(height * 0.045));
  const shadowLeft = Math.max(0, controlBounds.left - Math.round(width * 0.035));
  const shadowRight = Math.min(width - 1, controlBounds.right + Math.round(width * 0.18));
  let mattedBackgroundPixels = 0;
  let opaqueForegroundPixels = 0;
  let shadowPixels = 0;

  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    const pixelRow = row * 4;
    for (let x = 0; x < width; x += 1) {
      const p = row + x;
      const i = pixelRow + x * 4;
      if (pixels[i + 3] === 0) {
        mattedBackgroundPixels += 1;
        continue;
      }

      const maskAlpha = mask.data[p * 4 + 3] ?? 0;
      const distance = colorDistance(pixels, i, bg);
      const current = { r: pixels[i], g: pixels[i + 1], b: pixels[i + 2] };
      const currentLuma = luma(current);
      const isPaleMatteLike =
        current.r >= bg.r + 6 &&
        current.g >= bg.g + 10 &&
        current.b >= bg.b + 14;
      const nearMask = distanceToMask[p] <= foregroundHaloPx;
      const isStrongEdge = distance >= 58 && !isPaleMatteLike;
      const isWithinShadowLane =
        y >= shadowStartY &&
        y <= shadowMaxY &&
        x >= shadowLeft &&
        x <= shadowRight &&
        distanceToMask[p] <= shadowNeighborhoodPx;
      const isContactShadow =
        isWithinShadowLane &&
        currentLuma <= bgLuma - shadowLumaDelta &&
        distance >= shadowLumaDelta + 10 &&
        distance < 260;

      if (maskAlpha > alphaThreshold || (nearMask && isStrongEdge)) {
        pixels[i + 3] = 255;
        opaqueForegroundPixels += 1;
        continue;
      }

      if (isContactShadow) {
        const shadowStrength = clamp((bgLuma - currentLuma) / 58, 0.2, 0.62);
        pixels[i + 3] = Math.round(255 * shadowStrength);
        shadowPixels += 1;
        continue;
      }

      pixels[i] = bg.r;
      pixels[i + 1] = bg.g;
      pixels[i + 2] = bg.b;
      pixels[i + 3] = 0;
      mattedBackgroundPixels += 1;
    }
  }

  return {
    mattedBackgroundPixels,
    opaqueForegroundPixels,
    shadowPixels,
  };
}

export function flattenBackgroundLikePixels(
  pixels: Uint8ClampedArray,
  bg: Rgb,
  options: RigBackgroundFlattenOptions = {},
): RigBackgroundFlattenResult {
  const creamDistance = options.creamDistance ?? 32;
  const paleForegroundGreenDelta = options.paleForegroundGreenDelta ?? 10;
  const paleForegroundBlueDelta = options.paleForegroundBlueDelta ?? 14;
  const shadowLumaDelta = options.shadowLumaDelta ?? 28;
  const strongForegroundDistance = options.strongForegroundDistance ?? 72;
  const bgLuma = luma(bg);
  let flattenedPixels = 0;
  let preservedPixels = 0;

  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] === 0) {
      preservedPixels += 1;
      continue;
    }

    const current = { r: pixels[i], g: pixels[i + 1], b: pixels[i + 2] };
    const distance = Math.abs(current.r - bg.r) + Math.abs(current.g - bg.g) + Math.abs(current.b - bg.b);
    const currentLuma = luma(current);
    const isWhiteOrPaleForeground =
      current.r >= bg.r + 6 &&
      current.g >= bg.g + paleForegroundGreenDelta &&
      current.b >= bg.b + paleForegroundBlueDelta;
    const isShadowOrDarkDetail = currentLuma <= bgLuma - shadowLumaDelta;
    const isStrongForeground = distance >= strongForegroundDistance;

    if (
      distance <= creamDistance &&
      !isWhiteOrPaleForeground &&
      !isShadowOrDarkDetail &&
      !isStrongForeground
    ) {
      pixels[i] = bg.r;
      pixels[i + 1] = bg.g;
      pixels[i + 2] = bg.b;
      flattenedPixels += 1;
    } else {
      preservedPixels += 1;
    }
  }

  return { flattenedPixels, preservedPixels };
}

export function applyRigForegroundMatte(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  bg: Rgb,
  options: RigForegroundMatteOptions = {},
): RigForegroundMatteResult {
  const strongForegroundDistance = options.strongForegroundDistance ?? 52;
  const paleForegroundDistance = options.paleForegroundDistance ?? 32;
  const shadowLumaDelta = options.shadowLumaDelta ?? 24;
  const shadowStartY = Math.round(height * (options.shadowStartPct ?? 0.62));
  const foregroundNeighborhoodPx =
    options.foregroundNeighborhoodPx ?? Math.max(4, Math.round(Math.min(width, height) * 0.06));
  const shadowNeighborhoodPx =
    options.shadowNeighborhoodPx ?? Math.max(foregroundNeighborhoodPx + 1, Math.round(Math.min(width, height) * 0.075));
  const protectedProductBounds = options.protectedProductBounds ?? null;
  const distanceToStrongForeground = buildStrongForegroundDistanceMap(pixels, width, height, bg, {
    strongForegroundDistance,
    shadowLumaDelta,
    shadowStartY,
  });
  const bgLuma = luma(bg);
  let mattedBackgroundPixels = 0;
  let opaqueForegroundPixels = 0;
  let shadowPixels = 0;

  for (let y = 0; y < height; y += 1) {
    const row = y * width * 4;
    for (let x = 0; x < width; x += 1) {
      const i = row + x * 4;
      if (pixels[i + 3] === 0) {
        mattedBackgroundPixels += 1;
        continue;
      }

      const current = { r: pixels[i], g: pixels[i + 1], b: pixels[i + 2] };
      const distance = Math.abs(current.r - bg.r) + Math.abs(current.g - bg.g) + Math.abs(current.b - bg.b);
      const currentLuma = luma(current);
      const isPaleBackgroundLike =
        current.r >= bg.r + 6 &&
        current.g >= bg.g + 10 &&
        current.b >= bg.b + 14;
      const isProtectedPalePollutionColor =
        current.r >= bg.r + 3 &&
        current.g >= bg.g + 3 &&
        current.b >= bg.b + 3 &&
        currentLuma >= bgLuma + 5;
      const foregroundDistance = distanceToStrongForeground[y * width + x];
      const protectedPaleDetailHaloPx = Math.max(1, Math.round(foregroundNeighborhoodPx * 0.08));
      const isInsideProtectedProduct =
        protectedProductBounds !== null &&
        y >= protectedProductBounds.top &&
        y <= protectedProductBounds.bottom &&
        (
          typeof protectedProductBounds.left !== "number" ||
          x >= protectedProductBounds.left
        ) &&
        (
          typeof protectedProductBounds.right !== "number" ||
          x <= protectedProductBounds.right
        );
      if (isInsideProtectedProduct) {
        const isPaleInteriorPollution =
          isProtectedPalePollutionColor &&
          foregroundDistance > protectedPaleDetailHaloPx;
        if (isPaleInteriorPollution) {
          pixels[i] = bg.r;
          pixels[i + 1] = bg.g;
          pixels[i + 2] = bg.b;
          pixels[i + 3] = 0;
          mattedBackgroundPixels += 1;
          continue;
        }
        pixels[i + 3] = 255;
        opaqueForegroundPixels += 1;
        continue;
      }

      const isLikelyShadowPixel =
        y >= shadowStartY &&
        currentLuma <= bgLuma - shadowLumaDelta &&
        distance < strongForegroundDistance * 4;
      const isStrongForeground =
        distance >= strongForegroundDistance && !isPaleBackgroundLike && !isLikelyShadowPixel;
      const isNearStrongForeground =
        foregroundDistance <= foregroundNeighborhoodPx;
      const isNearShadowSource =
        foregroundDistance <= shadowNeighborhoodPx;
      const isPaleForeground =
        isNearStrongForeground &&
        distance >= paleForegroundDistance &&
        current.r >= bg.r + 6 &&
        current.g >= bg.g + 10 &&
        current.b >= bg.b + 14;
      const isContactShadow =
        y >= shadowStartY &&
        isNearShadowSource &&
        currentLuma <= bgLuma - shadowLumaDelta &&
        distance >= shadowLumaDelta + 12 &&
        distance < strongForegroundDistance * 4;

      if (isContactShadow) {
        const shadowStrength = clamp((bgLuma - currentLuma) / 56, 0.22, 0.68);
        pixels[i + 3] = Math.round(255 * shadowStrength);
        shadowPixels += 1;
        continue;
      }

      if (isStrongForeground || isPaleForeground) {
        pixels[i + 3] = 255;
        opaqueForegroundPixels += 1;
        continue;
      }

      pixels[i] = bg.r;
      pixels[i + 1] = bg.g;
      pixels[i + 2] = bg.b;
      pixels[i + 3] = 0;
      mattedBackgroundPixels += 1;
    }
  }

  return {
    mattedBackgroundPixels,
    opaqueForegroundPixels,
    shadowPixels,
  };
}

function resolveCapState(options: RigBaselineNormalizeOptions): RigCapState {
  const text = `${options.capState ?? ""} ${options.mode ?? ""}`.toLowerCase();
  return /\b(?:detached|cap[-_\s]?off|exploded)\b/.test(text) ? "detached" : "assembled";
}

function detectStrongBottomY(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  bg: Rgb,
  capState: RigCapState,
): number | null {
  const x0 = Math.round(width * (capState === "detached" ? 0.16 : 0.18));
  const x1 = Math.round(width * (capState === "detached" ? 0.62 : 0.82));
  const xStep = 2;
  const minRowHits = Math.max(10, Math.floor(((x1 - x0) / xStep) * 0.012));
  const strongThreshold = 52;

  for (let y = height - 1; y >= Math.round(height * 0.42); y -= 1) {
    let rowHits = 0;
    const row = y * width * 4;
    for (let x = x0; x < x1; x += xStep) {
      if (colorDistance(pixels, row + x * 4, bg) >= strongThreshold) {
        rowHits += 1;
        if (rowHits >= minRowHits) return y;
      }
    }
  }
  return null;
}

export function detectStrongBounds(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  bg: Rgb,
): RigStrongBounds | null {
  const strongThreshold = 52;
  const paleForegroundThreshold = 16;
  const xStep = 2;
  const minRowHits = Math.max(6, Math.floor((width / xStep) * 0.02));
  let top = height;
  let bottom = -1;
  let left = width;
  let right = -1;

  for (let y = 0; y < height; y += 2) {
    const row = y * width * 4;
    let rowHits = 0;
    let rowLeft = width;
    let rowRight = -1;
    for (let x = 0; x < width; x += xStep) {
      const i = row + x * 4;
      const distance = colorDistance(pixels, i, bg);
      const isPaleForeground =
        distance >= paleForegroundThreshold &&
        pixels[i] >= bg.r &&
        pixels[i + 1] >= bg.g &&
        pixels[i + 2] >= bg.b;
      if (distance >= strongThreshold || isPaleForeground) {
        rowHits += 1;
        rowLeft = Math.min(rowLeft, x);
        rowRight = Math.max(rowRight, x);
      }
    }
    if (rowHits >= minRowHits) {
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
      left = Math.min(left, rowLeft);
      right = Math.max(right, rowRight);
    }
  }

  return bottom >= 0 ? { top, bottom, left, right } : null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function computeRigFrameTransform(input: RigFrameTransformInput): RigFrameTransform {
  const targetBaseline = Math.round(input.height * (1 - input.rig.baselinePct / 100));
  const bounds = input.strongBounds;
  const baselineToTop = bounds ? input.detectedBaselineYPx - bounds.top : 0;
  const targetFillHeight = input.height * (input.rig.fillHeightPct / 100);
  const idealScale = baselineToTop > 0 ? targetFillHeight / baselineToTop : 1;
  const scaleNeedsCorrection = Math.abs(idealScale - 1) > 0.025;
  let scale = scaleNeedsCorrection ? clamp(idealScale, 0.5, 2.5) : 1;

  if (bounds) {
    if (typeof bounds.left === "number" && typeof bounds.right === "number" && bounds.right > bounds.left) {
      const boundsWidth = bounds.right - bounds.left + 1;
      const targetFillWidth = input.width * (input.rig.fillWidthPct / 100);
      const widthScale = boundsWidth > 0 ? targetFillWidth / boundsWidth : scale;
      if (Number.isFinite(widthScale) && widthScale > 0) {
        scale = Math.min(scale, widthScale);
      }
    }
    const minTopAir = Math.round(input.height * 0.06);
    const topLimitScale = baselineToTop > 0
      ? (targetBaseline - minTopAir) / baselineToTop
      : scale;
    const baselineToBottom = Math.max(0, bounds.bottom - input.detectedBaselineYPx);
    const bottomLimitScale = baselineToBottom > 0
      ? (input.height - 12 - targetBaseline) / baselineToBottom
      : scale;
    scale = Math.min(scale, topLimitScale, bottomLimitScale);
    scale = clamp(scale, 0.5, 2.5);
  }

  let shiftY = targetBaseline - input.detectedBaselineYPx * scale;
  if (Math.abs(scale - 1) <= 0.005 && Math.abs(shiftY) <= 8) {
    scale = 1;
    shiftY = 0;
  }

  let shiftX = 0;
  if (
    input.capState !== "detached" &&
    bounds &&
    typeof bounds.left === "number" &&
    typeof bounds.right === "number" &&
    bounds.right > bounds.left
  ) {
    const baseDrawX = (input.width - input.width * scale) / 2;
    const boundsCenter = (bounds.left + bounds.right + 1) / 2;
    const targetCenter = input.width / 2;
    const requestedShiftX = targetCenter - (boundsCenter * scale + baseDrawX);
    const minSideAir = Math.round(input.width * 0.06);
    const transformedLeftWithoutShift = bounds.left * scale + baseDrawX;
    const transformedRightWithoutShift = bounds.right * scale + baseDrawX;
    const minShift = minSideAir - transformedLeftWithoutShift;
    const maxShift = input.width - minSideAir - transformedRightWithoutShift;
    shiftX = clamp(requestedShiftX, minShift, maxShift);
    if (Math.abs(shiftX) <= 8) shiftX = 0;
  }

  const transformedTop = bounds ? bounds.top * scale + shiftY : null;
  const transformedBottom = bounds ? bounds.bottom * scale + shiftY : null;
  const baseDrawX = (input.width - input.width * scale) / 2;
  const transformedLeft = bounds && typeof bounds.left === "number"
    ? bounds.left * scale + baseDrawX + shiftX
    : null;
  const transformedRight = bounds && typeof bounds.right === "number"
    ? bounds.right * scale + baseDrawX + shiftX
    : null;

  return {
    scale,
    shiftXPx: Math.round(shiftX),
    shiftYPx: Math.round(shiftY),
    detectedBaselineYPx: input.detectedBaselineYPx,
    targetBaselineYPx: targetBaseline,
    transformedTopYPx: transformedTop == null ? null : Math.round(transformedTop),
    transformedBottomYPx: transformedBottom == null ? null : Math.round(transformedBottom),
    transformedLeftXPx: transformedLeft == null ? null : Math.round(transformedLeft),
    transformedRightXPx: transformedRight == null ? null : Math.round(transformedRight),
  };
}

export async function normalizeBestBottlesRigBaseline(
  imageUrl: string,
  options: RigBaselineNormalizeOptions,
): Promise<RigBaselineNormalizeResult> {
  const rig = getFamilyRigForProduct(options);
  const bg = hexToRgb(options.targetBackgroundHex ?? "#F5F3EF");
  if (!rig || !bg) {
    const img = await loadImage(imageUrl);
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Unable to acquire 2d canvas context");
    ctx.drawImage(img, 0, 0);
    return {
      dataUrl: canvas.toDataURL("image/png"),
      shifted: false,
      shiftXPx: 0,
      shiftYPx: 0,
      scale: 1,
      detectedBaselineYPx: null,
      targetBaselineYPx: null,
      maskControlled: false,
      qaIssues: [],
      framingQa: null,
      framingDecision: null,
    };
  }

  const img = await loadImage(imageUrl);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Unable to acquire 2d canvas context");
  ctx.drawImage(img, 0, 0);

  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  flattenBackgroundLikePixels(imageData.data, bg);
  const capState = resolveCapState(options);
  let maskImageData: ImageData | null = null;
  let maskBounds: RigAlphaControlBounds | null = null;
  const maskReferenceUrl = options.maskReferenceUrl?.trim();

  if (maskReferenceUrl) {
    try {
      const maskImg = await loadImage(maskReferenceUrl);
      const maskCanvas = document.createElement("canvas");
      maskCanvas.width = width;
      maskCanvas.height = height;
      const maskCtx = maskCanvas.getContext("2d");
      if (!maskCtx) throw new Error("Unable to acquire mask control canvas context");
      maskCtx.drawImage(maskImg, 0, 0, width, height);
      maskImageData = maskCtx.getImageData(0, 0, width, height);
      maskBounds = detectAlphaControlBounds({
        data: maskImageData.data,
        width,
        height,
      });
    } catch (error) {
      if (options.requireMaskControl) {
        throw new Error(
          `Mask/control reference could not drive recanvas: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  } else if (options.requireMaskControl) {
    throw new Error("Mask/control reference is required for deterministic recanvas.");
  }

  if (options.requireMaskControl && (!maskImageData || !maskBounds)) {
    throw new Error("Mask/control reference did not contain usable transparent foreground bounds.");
  }

  if (maskImageData && maskBounds) {
    const generatedBounds = detectStrongBounds(imageData.data, width, height, bg);
    const qaIssues = [
      ...getMaskControlledBoundsQaIssues({
        generatedBounds,
        controlBounds: maskBounds,
      }),
      ...getMaskControlledVisualContinuityQaIssues({
        pixels: imageData.data,
        width,
        height,
        bg,
        controlBounds: maskBounds,
      }),
    ];
    const detectedBaseline = maskBounds.bottom;
    const transform = computeRigFrameTransform({
      width,
      height,
      rig,
      detectedBaselineYPx: detectedBaseline,
      strongBounds: maskBounds,
      capState,
    });

    applyMaskControlledForegroundMatte(
      imageData.data,
      width,
      height,
      bg,
      { data: maskImageData.data, width, height },
      { controlBounds: maskBounds },
    );
    ctx.putImageData(imageData, 0, 0);

    const out = document.createElement("canvas");
    out.width = width;
    out.height = height;
    const outCtx = out.getContext("2d");
    if (!outCtx) throw new Error("Unable to acquire 2d canvas context");
    outCtx.fillStyle = options.targetBackgroundHex ?? "#F5F3EF";
    outCtx.fillRect(0, 0, width, height);
    const scaledWidth = Math.round(width * transform.scale);
    const scaledHeight = Math.round(height * transform.scale);
    const drawX = Math.round((width - scaledWidth) / 2 + transform.shiftXPx);
    outCtx.drawImage(canvas, drawX, transform.shiftYPx, scaledWidth, scaledHeight);
    const finalImageData = outCtx.getImageData(0, 0, width, height);
    const finalBounds = detectStrongBounds(finalImageData.data, width, height, bg);
    const finalBaseline = detectStrongBottomY(finalImageData.data, width, height, bg, capState);
    const framingQa = buildFramingQaReport({
      width,
      height,
      rig,
      bounds: finalBounds,
      baselineYPx: finalBaseline,
      capState,
    });
    const framingDecision = getFramingDecision(framingQa);
    qaIssues.push(...framingQa.failures);

    const targetFillHeight = height * (rig.fillHeightPct / 100);
    const transformedHeight =
      transform.transformedTopYPx != null && transform.transformedBottomYPx != null
        ? transform.transformedBottomYPx - transform.transformedTopYPx
        : null;
    if (transformedHeight != null && transformedHeight < targetFillHeight * 0.78) {
      qaIssues.push("Mask-controlled product envelope is too small for the family rig.");
    }

    return {
      dataUrl: out.toDataURL("image/png"),
      shifted: transform.scale !== 1 || transform.shiftXPx !== 0 || transform.shiftYPx !== 0,
      shiftXPx: transform.shiftXPx,
      shiftYPx: transform.shiftYPx,
      scale: transform.scale,
      detectedBaselineYPx: detectedBaseline,
      targetBaselineYPx: transform.targetBaselineYPx,
      maskControlled: true,
      qaIssues,
      framingQa,
      framingDecision,
    };
  }

  const detectedBaseline = detectStrongBottomY(imageData.data, width, height, bg, capState);
  const targetBaseline = Math.round(height * (1 - rig.baselinePct / 100));

  if (detectedBaseline === null) {
    applyRigForegroundMatte(imageData.data, width, height, bg);
    ctx.putImageData(imageData, 0, 0);
    const fallbackOut = document.createElement("canvas");
    fallbackOut.width = width;
    fallbackOut.height = height;
    const fallbackCtx = fallbackOut.getContext("2d");
    if (!fallbackCtx) throw new Error("Unable to acquire 2d canvas context");
    fallbackCtx.fillStyle = options.targetBackgroundHex ?? "#F5F3EF";
    fallbackCtx.fillRect(0, 0, width, height);
    fallbackCtx.drawImage(canvas, 0, 0);
    const framingQa = buildFramingQaReport({
      width,
      height,
      rig,
      bounds: detectStrongBounds(imageData.data, width, height, bg),
      baselineYPx: null,
      capState,
    });

    return {
      dataUrl: fallbackOut.toDataURL("image/png"),
      shifted: false,
      shiftXPx: 0,
      shiftYPx: 0,
      scale: 1,
      detectedBaselineYPx: null,
      targetBaselineYPx: targetBaseline,
      maskControlled: false,
      qaIssues: ["Product baseline was not detectable for framing QA."],
      framingQa,
      framingDecision: getFramingDecision(framingQa),
    };
  }

  const strongBounds = detectStrongBounds(imageData.data, width, height, bg);
  const transform = computeRigFrameTransform({
    width,
    height,
    rig,
    detectedBaselineYPx: detectedBaseline,
    strongBounds,
    capState,
  });

  applyRigForegroundMatte(imageData.data, width, height, bg, {
    protectedProductBounds: strongBounds,
  });
  ctx.putImageData(imageData, 0, 0);

  const out = document.createElement("canvas");
  out.width = width;
  out.height = height;
  const outCtx = out.getContext("2d");
  if (!outCtx) throw new Error("Unable to acquire 2d canvas context");
  outCtx.fillStyle = options.targetBackgroundHex ?? "#F5F3EF";
  outCtx.fillRect(0, 0, width, height);
  const scaledWidth = Math.round(width * transform.scale);
  const scaledHeight = Math.round(height * transform.scale);
  const drawX = Math.round((width - scaledWidth) / 2 + transform.shiftXPx);
  outCtx.drawImage(canvas, drawX, transform.shiftYPx, scaledWidth, scaledHeight);
  const finalImageData = outCtx.getImageData(0, 0, width, height);
  const finalBounds = detectStrongBounds(finalImageData.data, width, height, bg);
  const finalBaseline = detectStrongBottomY(finalImageData.data, width, height, bg, capState);
  const framingQa = buildFramingQaReport({
    width,
    height,
    rig,
    bounds: finalBounds,
    baselineYPx: finalBaseline,
    capState,
  });
  const framingDecision = getFramingDecision(framingQa);

  return {
    dataUrl: out.toDataURL("image/png"),
    shifted: transform.scale !== 1 || transform.shiftXPx !== 0 || transform.shiftYPx !== 0,
    shiftXPx: transform.shiftXPx,
    shiftYPx: transform.shiftYPx,
    scale: transform.scale,
    detectedBaselineYPx: finalBaseline,
    targetBaselineYPx: targetBaseline,
    maskControlled: false,
    qaIssues: framingQa.failures,
    framingQa,
    framingDecision,
  };
}
