import { createHash } from "node:crypto";

import sharp from "sharp";

export const PAPER_DOLL_CANDIDATE_CANVAS = {
  widthPx: 2080,
  heightPx: 2288,
} as const;

export interface CandidateClampResult {
  output: Buffer;
  sourceSha256: string;
  providerSha256: string;
  outputSha256: string;
  maskSha256: string;
  changedPixelCount: number;
  changedBounds: { left: number; top: number; right: number; bottom: number } | null;
  authorityBounds: { left: number; top: number; right: number; bottom: number };
  geometryLocked: true;
  canvas: { widthPx: number; heightPx: number };
  normalization: {
    mode: "contain" | "authority-bounds-contain";
    sourceWidthPx: number;
    sourceHeightPx: number;
    sourceVisibleBounds: { left: number; top: number; right: number; bottom: number } | null;
    outputWidthPx: number;
    outputHeightPx: number;
    offsetXPx: number;
    offsetYPx: number;
    scaleX: number;
    scaleY: number;
  };
  asymmetricStretchApplied: false;
}

function sha256(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

async function exactCanvasRaw(
  input: Buffer,
  label: string,
  width: number,
  height: number,
  ensureAlpha = false,
) {
  const image = ensureAlpha ? sharp(input).ensureAlpha() : sharp(input);
  const metadata = await image.metadata();
  if (metadata.width !== width || metadata.height !== height) {
    throw new Error(`${label} must be exactly ${width}x${height}; received ${metadata.width}x${metadata.height}.`);
  }
  return image.raw().toBuffer({ resolveWithObject: true });
}

async function normalizedProviderRaw(input: Buffer, width: number, height: number) {
  const metadata = await sharp(input).metadata();
  if (!metadata.width || !metadata.height) throw new Error("Provider output has no measurable canvas.");
  const scale = Math.min(width / metadata.width, height / metadata.height);
  const outputWidthPx = Math.max(1, Math.round(metadata.width * scale));
  const outputHeightPx = Math.max(1, Math.round(metadata.height * scale));
  const offsetXPx = Math.floor((width - outputWidthPx) / 2);
  const offsetYPx = Math.floor((height - outputHeightPx) / 2);
  const normalized = await sharp(input)
    .ensureAlpha()
    .resize({
      width,
      height,
      fit: "contain",
      position: "centre",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      withoutEnlargement: false,
    })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return {
    ...normalized,
    normalization: {
      mode: "contain" as const,
      sourceWidthPx: metadata.width,
      sourceHeightPx: metadata.height,
      sourceVisibleBounds: null,
      outputWidthPx,
      outputHeightPx,
      offsetXPx,
      offsetYPx,
      scaleX: scale,
      scaleY: scale,
    },
  };
}

function visibleAlphaBounds(
  data: Buffer,
  width: number,
  height: number,
  channels: number,
): { left: number; top: number; right: number; bottom: number } {
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    if (data[pixel * channels + 3] === 0) continue;
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    left = Math.min(left, x);
    top = Math.min(top, y);
    right = Math.max(right, x);
    bottom = Math.max(bottom, y);
  }
  if (right < 0) throw new Error("Manual output has no non-transparent pixels.");
  return { left, top, right, bottom };
}

async function manualProviderRaw(
  input: Buffer,
  width: number,
  height: number,
  authorityBounds: { left: number; top: number; right: number; bottom: number },
) {
  const decoded = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const sourceWidthPx = decoded.info.width;
  const sourceHeightPx = decoded.info.height;
  if (!sourceWidthPx || !sourceHeightPx) throw new Error("Manual output has no measurable canvas.");
  const sourceVisibleBounds = visibleAlphaBounds(
    decoded.data,
    sourceWidthPx,
    sourceHeightPx,
    decoded.info.channels,
  );
  const visibleWidthPx = sourceVisibleBounds.right - sourceVisibleBounds.left + 1;
  const visibleHeightPx = sourceVisibleBounds.bottom - sourceVisibleBounds.top + 1;
  const targetWidthPx = authorityBounds.right - authorityBounds.left + 1;
  const targetHeightPx = authorityBounds.bottom - authorityBounds.top + 1;
  const scale = Math.min(targetWidthPx / visibleWidthPx, targetHeightPx / visibleHeightPx);
  const outputWidthPx = Math.max(1, Math.round(visibleWidthPx * scale));
  const outputHeightPx = Math.max(1, Math.round(visibleHeightPx * scale));
  const left = authorityBounds.left + Math.floor((targetWidthPx - outputWidthPx) / 2);
  const top = authorityBounds.top + Math.floor((targetHeightPx - outputHeightPx) / 2);
  const fitted = await sharp(decoded.data, {
    raw: {
      width: sourceWidthPx,
      height: sourceHeightPx,
      channels: decoded.info.channels,
    },
  })
    .extract({
      left: sourceVisibleBounds.left,
      top: sourceVisibleBounds.top,
      width: visibleWidthPx,
      height: visibleHeightPx,
    })
    .resize({ width: outputWidthPx, height: outputHeightPx, fit: "fill" })
    .png()
    .toBuffer();
  const normalized = await sharp({
    create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: fitted, left, top }])
    .raw()
    .toBuffer({ resolveWithObject: true });
  return {
    ...normalized,
    normalization: {
      mode: "authority-bounds-contain" as const,
      sourceWidthPx,
      sourceHeightPx,
      sourceVisibleBounds,
      outputWidthPx,
      outputHeightPx,
      offsetXPx: left,
      offsetYPx: top,
      scaleX: scale,
      scaleY: scale,
    },
  };
}

function channelValue(data: Buffer, channels: number, pixel: number): number {
  return data[pixel * channels];
}

function assertSingleConnectedAuthority(
  data: Buffer,
  channels: number,
  width: number,
  height: number,
): void {
  const pixelCount = width * height;
  let seed = -1;
  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    if (channelValue(data, channels, pixel) === 255) {
      seed = pixel;
      break;
    }
  }
  if (seed < 0) throw new Error("Authority mask cannot be empty.");

  const visited = new Uint8Array(pixelCount);
  const stack = [seed];
  visited[seed] = 1;
  while (stack.length > 0) {
    const pixel = stack.pop()!;
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    for (let yOffset = -1; yOffset <= 1; yOffset += 1) {
      for (let xOffset = -1; xOffset <= 1; xOffset += 1) {
        if (xOffset === 0 && yOffset === 0) continue;
        const nextX = x + xOffset;
        const nextY = y + yOffset;
        if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height) continue;
        const next = nextY * width + nextX;
        if (visited[next] || channelValue(data, channels, next) !== 255) continue;
        visited[next] = 1;
        stack.push(next);
      }
    }
  }

  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    if (channelValue(data, channels, pixel) === 255 && !visited[pixel]) {
      throw new Error("Authority mask must be a single 8-connected silhouette; detached islands cannot earn geometry lock.");
    }
  }
}

export async function clampCandidate(input: {
  source: Buffer;
  provider: Buffer;
  editMask: Buffer;
  authoritativeMask: Buffer;
  /** Raw desktop component assets are fitted to the registered component mask. */
  manualPlacement?: boolean;
  canvas?: { widthPx: number; heightPx: number };
}): Promise<CandidateClampResult> {
  const canvas = input.canvas ?? PAPER_DOLL_CANDIDATE_CANVAS;
  const { widthPx: width, heightPx: height } = canvas;
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0) {
    throw new Error("Candidate canvas dimensions must be positive integers.");
  }

  const [source, authority, edit] = await Promise.all([
    exactCanvasRaw(input.source, "Source", width, height, true),
    exactCanvasRaw(input.authoritativeMask, "Authority mask", width, height),
    exactCanvasRaw(input.editMask, "Edit mask", width, height),
  ]);

  let authorityLeft = width;
  let authorityTop = height;
  let authorityRight = -1;
  let authorityBottom = -1;
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const objectAlpha = channelValue(authority.data, authority.info.channels, pixel);
    if (objectAlpha !== 0 && objectAlpha !== 255) throw new Error("Authority mask must be binary before it can earn geometry lock.");
    if (objectAlpha === 255) {
      const x = pixel % width;
      const y = Math.floor(pixel / width);
      authorityLeft = Math.min(authorityLeft, x);
      authorityTop = Math.min(authorityTop, y);
      authorityRight = Math.max(authorityRight, x);
      authorityBottom = Math.max(authorityBottom, y);
    }
  }
  if (authorityRight < 0) throw new Error("Authority mask cannot be empty.");
  assertSingleConnectedAuthority(authority.data, authority.info.channels, width, height);
  const provider = input.manualPlacement
    ? await manualProviderRaw(input.provider, width, height, { left: authorityLeft, top: authorityTop, right: authorityRight, bottom: authorityBottom })
    : await normalizedProviderRaw(input.provider, width, height);

  const output = Buffer.alloc(width * height * 4);
  let changedPixelCount = 0;
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;

  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const objectAlpha = channelValue(authority.data, authority.info.channels, pixel);
    const editAlpha = channelValue(edit.data, edit.info.channels, pixel) / 255;
    const sourceOffset = pixel * source.info.channels;
    const providerOffset = pixel * provider.info.channels;
    const outputOffset = pixel * 4;
    const providerCoverage = provider.data[providerOffset + 3] / 255;
    const mix = objectAlpha === 255 ? editAlpha * providerCoverage : 0;

    if (objectAlpha === 0) {
      output.fill(0, outputOffset, outputOffset + 4);
    } else {
      for (let channel = 0; channel < 3; channel += 1) {
        output[outputOffset + channel] = Math.round(
          source.data[sourceOffset + channel] * (1 - mix)
          + provider.data[providerOffset + channel] * mix,
        );
      }
      output[outputOffset + 3] = objectAlpha;
    }

    const changed = (
      output[outputOffset] !== source.data[sourceOffset]
      || output[outputOffset + 1] !== source.data[sourceOffset + 1]
      || output[outputOffset + 2] !== source.data[sourceOffset + 2]
      || output[outputOffset + 3] !== source.data[sourceOffset + 3]
    );
    if (changed) {
      changedPixelCount += 1;
      const x = pixel % width;
      const y = Math.floor(pixel / width);
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }

  const outputPng = await sharp(output, {
    raw: { width, height, channels: 4 },
  }).png({ compressionLevel: 9 }).toBuffer();
  return {
    output: outputPng,
    sourceSha256: sha256(input.source),
    providerSha256: sha256(input.provider),
    outputSha256: sha256(outputPng),
    maskSha256: sha256(input.authoritativeMask),
    changedPixelCount,
    changedBounds: changedPixelCount > 0 ? { left, top, right, bottom } : null,
    authorityBounds: {
      left: authorityLeft,
      top: authorityTop,
      right: authorityRight,
      bottom: authorityBottom,
    },
    geometryLocked: true,
    canvas,
    normalization: provider.normalization,
    asymmetricStretchApplied: false,
  };
}
