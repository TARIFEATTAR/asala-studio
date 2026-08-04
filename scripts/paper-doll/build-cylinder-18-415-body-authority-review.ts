import sharp from "sharp";

import { inspectAuthorityMask } from "../../src/lib/paperDoll/componentPlateImage.node";
import type { PixelBounds } from "../../src/lib/paperDoll/componentPlateContract";

type ThresholdBounds = { threshold: number; bounds: PixelBounds };

function boundsAtThreshold(alpha: Buffer, width: number, height: number, threshold: number): PixelBounds {
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (alpha[y * width + x] < threshold) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  if (right < left || bottom < top) throw new Error(`Alpha threshold ${threshold} produced an empty object.`);
  return { left, top, width: right - left + 1, height: bottom - top + 1 };
}

function sides(bounds: PixelBounds) {
  return {
    left: bounds.left,
    top: bounds.top,
    right: bounds.left + bounds.width - 1,
    bottom: bounds.top + bounds.height - 1,
  };
}

function thresholdBoundsAreStable(values: ThresholdBounds[]): boolean {
  const reference = sides(values[0].bounds);
  return values.every(({ bounds }) => {
    const candidate = sides(bounds);
    return Math.abs(candidate.left - reference.left) <= 1
      && Math.abs(candidate.top - reference.top) <= 1
      && Math.abs(candidate.right - reference.right) <= 1
      && Math.abs(candidate.bottom - reference.bottom) <= 1;
  });
}

function connectedComponentCount(alpha: Buffer, width: number, height: number, threshold: number): number {
  const visited = new Uint8Array(width * height);
  let count = 0;
  const stack: number[] = [];
  for (let origin = 0; origin < alpha.length; origin += 1) {
    if (visited[origin] || alpha[origin] < threshold) continue;
    count += 1;
    visited[origin] = 1;
    stack.push(origin);
    while (stack.length > 0) {
      const index = stack.pop()!;
      const y = Math.floor(index / width);
      const x = index - y * width;
      for (const [nextX, nextY] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
        if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height) continue;
        const next = nextY * width + nextX;
        if (visited[next] || alpha[next] < threshold) continue;
        visited[next] = 1;
        stack.push(next);
      }
    }
  }
  return count;
}

function interpolateRowExtent(
  row: number,
  extents: Array<{ left: number; right: number } | null>,
): { left: number; right: number } {
  if (extents[row]) return extents[row]!;
  let previous = row - 1;
  while (previous >= 0 && !extents[previous]) previous -= 1;
  let next = row + 1;
  while (next < extents.length && !extents[next]) next += 1;
  if (previous < 0 || next >= extents.length) throw new Error("Cannot interpolate an exterior silhouette beyond measured rows.");
  const fraction = (row - previous) / (next - previous);
  return {
    left: Math.round(extents[previous]!.left + (extents[next]!.left - extents[previous]!.left) * fraction),
    right: Math.round(extents[previous]!.right + (extents[next]!.right - extents[previous]!.right) * fraction),
  };
}

export async function buildRowEnvelopeAuthorityMask(input: {
  sourcePng: Buffer;
  alphaThreshold: number;
  stableThresholds: number[];
}): Promise<{
  maskPng: Buffer;
  authorityBoundsPx: PixelBounds;
  thresholdCalibration: { chosenThreshold: number; boundsByThreshold: ThresholdBounds[]; stable: boolean };
  sourceTopology: { connectedComponentCount: number; frameContact: boolean };
}> {
  if (!Number.isInteger(input.alphaThreshold) || input.alphaThreshold < 1 || input.alphaThreshold > 255) {
    throw new Error("alphaThreshold must be an integer from 1 through 255.");
  }
  if (!input.stableThresholds.includes(input.alphaThreshold) || input.stableThresholds.length < 2) {
    throw new Error("The chosen threshold must be included in a multi-threshold calibration range.");
  }
  const { data: alpha, info } = await sharp(input.sourcePng)
    .ensureAlpha()
    .extractChannel("alpha")
    .raw()
    .toBuffer({ resolveWithObject: true });
  const boundsByThreshold = input.stableThresholds.map((threshold) => ({
    threshold,
    bounds: boundsAtThreshold(alpha, info.width, info.height, threshold),
  }));
  const stable = thresholdBoundsAreStable(boundsByThreshold);
  if (!stable) throw new Error("Real-file alpha threshold calibration is unstable; manual source cleanup is required.");
  const authorityBoundsPx = boundsAtThreshold(alpha, info.width, info.height, input.alphaThreshold);
  const measuredSides = sides(authorityBoundsPx);
  const frameContact = measuredSides.left === 0
    || measuredSides.top === 0
    || measuredSides.right === info.width - 1
    || measuredSides.bottom === info.height - 1;
  if (frameContact) throw new Error("Measured object touches the image frame and cannot become an authority candidate.");

  const rowExtents: Array<{ left: number; right: number } | null> = Array(info.height).fill(null);
  for (let y = authorityBoundsPx.top; y <= measuredSides.bottom; y += 1) {
    let left = info.width;
    let right = -1;
    for (let x = authorityBoundsPx.left; x <= measuredSides.right; x += 1) {
      if (alpha[y * info.width + x] < input.alphaThreshold) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
    }
    if (right >= left) rowExtents[y] = { left, right };
  }

  const mask = Buffer.alloc(info.width * info.height, 0);
  for (let y = authorityBoundsPx.top; y <= measuredSides.bottom; y += 1) {
    const extent = interpolateRowExtent(y, rowExtents);
    for (let x = extent.left; x <= extent.right; x += 1) mask[y * info.width + x] = 255;
  }
  const rgbaMask = Buffer.alloc(info.width * info.height * 4);
  for (let pixelIndex = 0; pixelIndex < mask.length; pixelIndex += 1) {
    const offset = pixelIndex * 4;
    rgbaMask[offset] = 255;
    rgbaMask[offset + 1] = 255;
    rgbaMask[offset + 2] = 255;
    rgbaMask[offset + 3] = mask[pixelIndex];
  }
  const maskPng = await sharp(rgbaMask, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toBuffer();
  const inspection = await inspectAuthorityMask(maskPng, { expectedRegions: 1 });
  return {
    maskPng,
    authorityBoundsPx: inspection.authorityBoundsPx,
    thresholdCalibration: { chosenThreshold: input.alphaThreshold, boundsByThreshold, stable },
    sourceTopology: {
      connectedComponentCount: connectedComponentCount(alpha, info.width, info.height, input.alphaThreshold),
      frameContact,
    },
  };
}
