import { createHash } from "node:crypto";

import sharp from "sharp";

import { opaqueWhiteFraction, type OpaqueWhiteFractionResult } from "./qaGates";

export interface RollerPairBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

interface DecodedRgba {
  data: Buffer;
  width: number;
  height: number;
}

export interface Cyl9RollerPairInput {
  plasticSource: Buffer;
  metalSource: Buffer;
  source: {
    alphaFloor: number;
    plasticBallBounds: RollerPairBounds;
    metalBallBounds: RollerPairBounds;
  };
  placement: {
    canvasWidthPx: number;
    canvasHeightPx: number;
    targetWidthPx: number;
    mountAxisXPx: number;
    contactYPx: number;
  };
}

interface PairAsset {
  png: Buffer;
  sha256: string;
  byteSize: number;
  alphaBounds: RollerPairBounds;
}

export interface Cyl9RollerPair {
  plastic: PairAsset;
  metal: PairAsset;
  mask: PairAsset & { bounds: RollerPairBounds; foregroundPixelCount: number };
  qa: {
    sharedAlphaExact: boolean;
    silhouetteIou: number;
    connectedComponents: number;
    metalOpaqueWhite: OpaqueWhiteFractionResult;
  };
  source: {
    plasticSha256: string;
    metalSha256: string;
    measuredPlasticBounds: RollerPairBounds;
  };
  placement: Cyl9RollerPairInput["placement"];
}

function digest(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

async function decode(bytes: Buffer): Promise<DecodedRgba> {
  const decoded = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: decoded.data, width: decoded.info.width, height: decoded.info.height };
}

function boundsForSupport(support: Uint8Array, width: number, height: number): RollerPairBounds | null {
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  for (let pixel = 0; pixel < support.length; pixel += 1) {
    if (support[pixel] === 0) continue;
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    left = Math.min(left, x);
    top = Math.min(top, y);
    right = Math.max(right, x);
    bottom = Math.max(bottom, y);
  }
  return right < 0 ? null : { left, top, right, bottom };
}

function connectedComponents(support: Uint8Array, width: number, height: number) {
  const visited = new Uint8Array(support.length);
  const components: number[][] = [];
  for (let seed = 0; seed < support.length; seed += 1) {
    if (!support[seed] || visited[seed]) continue;
    const component: number[] = [];
    const stack = [seed];
    visited[seed] = 1;
    while (stack.length) {
      const pixel = stack.pop()!;
      component.push(pixel);
      const x = pixel % width;
      const y = Math.floor(pixel / width);
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) continue;
          const nextX = x + dx;
          const nextY = y + dy;
          if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height) continue;
          const next = nextY * width + nextX;
          if (!support[next] || visited[next]) continue;
          visited[next] = 1;
          stack.push(next);
        }
      }
    }
    components.push(component);
  }
  return components.sort((left, right) => right.length - left.length);
}

function assertBoundsInside(bounds: RollerPairBounds, width: number, height: number, label: string): void {
  if (
    bounds.left < 0 || bounds.top < 0 || bounds.right < bounds.left || bounds.bottom < bounds.top
    || bounds.right >= width || bounds.bottom >= height
  ) throw new Error(`${label} bounds fall outside the source canvas.`);
}

function crop(data: Buffer, width: number, bounds: RollerPairBounds): Buffer {
  const cropWidth = bounds.right - bounds.left + 1;
  const cropHeight = bounds.bottom - bounds.top + 1;
  const output = Buffer.alloc(cropWidth * cropHeight * 4);
  for (let y = 0; y < cropHeight; y += 1) {
    const sourceStart = ((bounds.top + y) * width + bounds.left) * 4;
    data.copy(output, y * cropWidth * 4, sourceStart, sourceStart + cropWidth * 4);
  }
  return output;
}

async function resizedCrop(input: {
  data: Buffer;
  width: number;
  bounds: RollerPairBounds;
  targetWidth: number;
  targetHeight: number;
}): Promise<Buffer> {
  const width = input.bounds.right - input.bounds.left + 1;
  const height = input.bounds.bottom - input.bounds.top + 1;
  return sharp(crop(input.data, input.width, input.bounds), { raw: { width, height, channels: 4 } })
    .resize({ width: input.targetWidth, height: input.targetHeight, fit: "fill", kernel: sharp.kernel.lanczos3 })
    .raw()
    .toBuffer();
}

function canvasAsset(input: {
  resized: Buffer;
  resizedWidth: number;
  resizedHeight: number;
  mask: Uint8Array;
  canvasWidth: number;
  canvasHeight: number;
  left: number;
  top: number;
}): Buffer {
  const canvas = Buffer.alloc(input.canvasWidth * input.canvasHeight * 4);
  for (let y = 0; y < input.resizedHeight; y += 1) {
    for (let x = 0; x < input.resizedWidth; x += 1) {
      const sourcePixel = y * input.resizedWidth + x;
      if (!input.mask[sourcePixel]) continue;
      const sourceOffset = sourcePixel * 4;
      const targetOffset = ((input.top + y) * input.canvasWidth + input.left + x) * 4;
      canvas[targetOffset] = input.resized[sourceOffset];
      canvas[targetOffset + 1] = input.resized[sourceOffset + 1];
      canvas[targetOffset + 2] = input.resized[sourceOffset + 2];
      canvas[targetOffset + 3] = 255;
    }
  }
  return canvas;
}

async function pngAsset(rgba: Buffer, width: number, height: number, bounds: RollerPairBounds): Promise<PairAsset> {
  const png = await sharp(rgba, { raw: { width, height, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toBuffer();
  return { png, sha256: digest(png), byteSize: png.byteLength, alphaBounds: bounds };
}

export async function buildCyl9RollerPair(input: Cyl9RollerPairInput): Promise<Cyl9RollerPair> {
  const [plastic, metal] = await Promise.all([decode(input.plasticSource), decode(input.metalSource)]);
  assertBoundsInside(input.source.plasticBallBounds, plastic.width, plastic.height, "Plastic ball");
  assertBoundsInside(input.source.metalBallBounds, metal.width, metal.height, "Metal ball");

  const support = new Uint8Array(plastic.width * plastic.height);
  for (let pixel = 0; pixel < support.length; pixel += 1) {
    if (plastic.data[pixel * 4 + 3] >= input.source.alphaFloor) support[pixel] = 1;
  }
  const components = connectedComponents(support, plastic.width, plastic.height);
  if (!components.length) throw new Error("Plastic geometry master contains no measurable foreground.");
  const authority = new Uint8Array(support.length);
  for (const pixel of components[0]) authority[pixel] = 1;
  const measuredPlasticBounds = boundsForSupport(authority, plastic.width, plastic.height);
  if (!measuredPlasticBounds) throw new Error("Plastic geometry master contains no authority silhouette.");
  if (
    measuredPlasticBounds.left === 0 || measuredPlasticBounds.top === 0
    || measuredPlasticBounds.right === plastic.width - 1 || measuredPlasticBounds.bottom === plastic.height - 1
  ) throw new Error("Plastic authority resolves to the image frame, not the roller object.");

  const plasticCanonical = Buffer.alloc(plastic.data.length);
  for (let pixel = 0; pixel < authority.length; pixel += 1) {
    if (!authority[pixel]) continue;
    const offset = pixel * 4;
    plasticCanonical[offset] = plastic.data[offset];
    plasticCanonical[offset + 1] = plastic.data[offset + 1];
    plasticCanonical[offset + 2] = plastic.data[offset + 2];
    plasticCanonical[offset + 3] = 255;
  }
  const metalCanonical = Buffer.from(plasticCanonical);
  const plasticBallWidth = input.source.plasticBallBounds.right - input.source.plasticBallBounds.left + 1;
  const plasticBallHeight = input.source.plasticBallBounds.bottom - input.source.plasticBallBounds.top + 1;
  const metalBall = await resizedCrop({
    data: metal.data,
    width: metal.width,
    bounds: input.source.metalBallBounds,
    targetWidth: plasticBallWidth,
    targetHeight: plasticBallHeight,
  });
  for (let y = 0; y < plasticBallHeight; y += 1) {
    for (let x = 0; x < plasticBallWidth; x += 1) {
      const targetX = input.source.plasticBallBounds.left + x;
      const targetY = input.source.plasticBallBounds.top + y;
      const targetPixel = targetY * plastic.width + targetX;
      const sourceOffset = (y * plasticBallWidth + x) * 4;
      if (!authority[targetPixel] || metalBall[sourceOffset + 3] < input.source.alphaFloor) continue;
      const targetOffset = targetPixel * 4;
      metalCanonical[targetOffset] = metalBall[sourceOffset];
      metalCanonical[targetOffset + 1] = metalBall[sourceOffset + 1];
      metalCanonical[targetOffset + 2] = metalBall[sourceOffset + 2];
    }
  }

  const sourceWidth = measuredPlasticBounds.right - measuredPlasticBounds.left + 1;
  const sourceHeight = measuredPlasticBounds.bottom - measuredPlasticBounds.top + 1;
  const targetHeight = Math.round(sourceHeight * input.placement.targetWidthPx / sourceWidth);
  const [plasticResized, metalResized] = await Promise.all([
    resizedCrop({ data: plasticCanonical, width: plastic.width, bounds: measuredPlasticBounds, targetWidth: input.placement.targetWidthPx, targetHeight }),
    resizedCrop({ data: metalCanonical, width: plastic.width, bounds: measuredPlasticBounds, targetWidth: input.placement.targetWidthPx, targetHeight }),
  ]);
  const normalizedMask = new Uint8Array(input.placement.targetWidthPx * targetHeight);
  for (let pixel = 0; pixel < normalizedMask.length; pixel += 1) {
    if (plasticResized[pixel * 4 + 3] >= 128) normalizedMask[pixel] = 1;
  }
  const normalizedComponents = connectedComponents(normalizedMask, input.placement.targetWidthPx, targetHeight);
  if (normalizedComponents.length !== 1) {
    throw new Error(`Normalized authority must be one connected component; measured ${normalizedComponents.length}.`);
  }

  const left = input.placement.mountAxisXPx - Math.floor(input.placement.targetWidthPx / 2);
  const top = input.placement.contactYPx - targetHeight + 1;
  if (
    left < 0 || top < 0
    || left + input.placement.targetWidthPx > input.placement.canvasWidthPx
    || top + targetHeight > input.placement.canvasHeightPx
  ) throw new Error("Normalized roller falls outside the canonical canvas.");
  const normalizedBounds = {
    left,
    top,
    right: left + input.placement.targetWidthPx - 1,
    bottom: input.placement.contactYPx,
  };
  const plasticCanvas = canvasAsset({
    resized: plasticResized,
    resizedWidth: input.placement.targetWidthPx,
    resizedHeight: targetHeight,
    mask: normalizedMask,
    canvasWidth: input.placement.canvasWidthPx,
    canvasHeight: input.placement.canvasHeightPx,
    left,
    top,
  });
  const metalCanvas = canvasAsset({
    resized: metalResized,
    resizedWidth: input.placement.targetWidthPx,
    resizedHeight: targetHeight,
    mask: normalizedMask,
    canvasWidth: input.placement.canvasWidthPx,
    canvasHeight: input.placement.canvasHeightPx,
    left,
    top,
  });
  const maskCanvas = Buffer.alloc(plasticCanvas.length);
  let foregroundPixelCount = 0;
  let sharedAlphaExact = true;
  for (let pixel = 0; pixel < input.placement.canvasWidthPx * input.placement.canvasHeightPx; pixel += 1) {
    const offset = pixel * 4;
    const alpha = plasticCanvas[offset + 3];
    if (alpha !== metalCanvas[offset + 3]) sharedAlphaExact = false;
    if (!alpha) continue;
    foregroundPixelCount += 1;
    maskCanvas[offset] = 255;
    maskCanvas[offset + 1] = 255;
    maskCanvas[offset + 2] = 255;
    maskCanvas[offset + 3] = 255;
  }
  if (!sharedAlphaExact) throw new Error("Plastic and metal alphas diverged after normalization.");

  const [plasticAsset, metalAsset, maskAsset] = await Promise.all([
    pngAsset(plasticCanvas, input.placement.canvasWidthPx, input.placement.canvasHeightPx, normalizedBounds),
    pngAsset(metalCanvas, input.placement.canvasWidthPx, input.placement.canvasHeightPx, normalizedBounds),
    pngAsset(maskCanvas, input.placement.canvasWidthPx, input.placement.canvasHeightPx, normalizedBounds),
  ]);
  const metalOpaqueWhite = opaqueWhiteFraction({
    data: metalCanvas,
    width: input.placement.canvasWidthPx,
    height: input.placement.canvasHeightPx,
    hasAlpha: true,
  });
  if (!metalOpaqueWhite.pass) throw new Error(metalOpaqueWhite.issues.join("; "));

  return {
    plastic: plasticAsset,
    metal: metalAsset,
    mask: { ...maskAsset, bounds: normalizedBounds, foregroundPixelCount },
    qa: { sharedAlphaExact, silhouetteIou: 1, connectedComponents: normalizedComponents.length, metalOpaqueWhite },
    source: {
      plasticSha256: digest(input.plasticSource),
      metalSha256: digest(input.metalSource),
      measuredPlasticBounds,
    },
    placement: input.placement,
  };
}
