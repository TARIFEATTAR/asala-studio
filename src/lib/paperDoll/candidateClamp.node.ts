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
    mode: "contain";
    sourceWidthPx: number;
    sourceHeightPx: number;
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
      outputWidthPx,
      outputHeightPx,
      offsetXPx,
      offsetYPx,
      scaleX: scale,
      scaleY: scale,
    },
  };
}

function channelValue(data: Buffer, channels: number, pixel: number): number {
  return data[pixel * channels];
}

export async function clampCandidate(input: {
  source: Buffer;
  provider: Buffer;
  editMask: Buffer;
  authoritativeMask: Buffer;
  canvas?: { widthPx: number; heightPx: number };
}): Promise<CandidateClampResult> {
  const canvas = input.canvas ?? PAPER_DOLL_CANDIDATE_CANVAS;
  const { widthPx: width, heightPx: height } = canvas;
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0) {
    throw new Error("Candidate canvas dimensions must be positive integers.");
  }

  const [source, provider, authority, edit] = await Promise.all([
    exactCanvasRaw(input.source, "Source", width, height, true),
    normalizedProviderRaw(input.provider, width, height),
    exactCanvasRaw(input.authoritativeMask, "Authority mask", width, height),
    exactCanvasRaw(input.editMask, "Edit mask", width, height),
  ]);

  const output = Buffer.alloc(width * height * 4);
  let changedPixelCount = 0;
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  let authorityLeft = width;
  let authorityTop = height;
  let authorityRight = -1;
  let authorityBottom = -1;

  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const objectAlpha = channelValue(authority.data, authority.info.channels, pixel);
    if (objectAlpha !== 0 && objectAlpha !== 255) {
      throw new Error("Authority mask must be binary before it can earn geometry lock.");
    }
    if (objectAlpha === 255) {
      const x = pixel % width;
      const y = Math.floor(pixel / width);
      authorityLeft = Math.min(authorityLeft, x);
      authorityTop = Math.min(authorityTop, y);
      authorityRight = Math.max(authorityRight, x);
      authorityBottom = Math.max(authorityBottom, y);
    }
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
  if (authorityRight < 0) throw new Error("Authority mask cannot be empty.");

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
