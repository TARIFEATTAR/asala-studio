import sharp from "sharp";

import {
  compareExactAlphaBytes,
  copyAuthorityAlpha,
  type ExactAlphaComparison,
} from "../../../supabase/functions/_shared/paperDollExactAlpha";
import type { PixelBounds } from "./componentPlateContract";

interface DecodedRgba {
  data: Buffer;
  width: number;
  height: number;
}

export interface AuthorityMaskInspection {
  width: number;
  height: number;
  occupiedPixels: number;
  componentCount: number;
  touchesFrame: boolean;
  authorityBoundsPx: PixelBounds;
}

export interface AuthorityInspectionOptions {
  expectedRegions: number;
}

async function decodeRgba(input: Buffer): Promise<DecodedRgba> {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

function extractAlpha(image: DecodedRgba): Uint8Array {
  const alpha = new Uint8Array(image.width * image.height);
  for (let index = 0; index < alpha.length; index++) {
    alpha[index] = image.data[index * 4 + 3];
  }
  return alpha;
}

function occupiedBounds(image: DecodedRgba): PixelBounds | null {
  let left = image.width;
  let top = image.height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      if (image.data[(y * image.width + x) * 4 + 3] === 0) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  if (right < left || bottom < top) return null;
  return { left, top, width: right - left + 1, height: bottom - top + 1 };
}

export async function inspectAuthorityMask(
  maskPng: Buffer,
  options: AuthorityInspectionOptions = { expectedRegions: 1 },
): Promise<AuthorityMaskInspection> {
  if (!Number.isInteger(options.expectedRegions) || options.expectedRegions < 1) {
    throw new Error("Expected authority-mask connected regions must be a positive integer.");
  }
  const image = await decodeRgba(maskPng);
  const occupied = new Uint8Array(image.width * image.height);
  let occupiedPixels = 0;
  let touchesFrame = false;

  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      const index = y * image.width + x;
      if (image.data[index * 4 + 3] === 0) continue;
      occupied[index] = 1;
      occupiedPixels++;
      if (x === 0 || y === 0 || x === image.width - 1 || y === image.height - 1) {
        touchesFrame = true;
      }
    }
  }

  if (occupiedPixels === 0) throw new Error("Authority mask is empty.");
  if (touchesFrame) throw new Error("Authority mask touches the image frame.");

  let componentCount = 0;
  const visited = new Uint8Array(occupied.length);
  const queue = new Int32Array(occupied.length);
  for (let start = 0; start < occupied.length; start++) {
    if (!occupied[start] || visited[start]) continue;
    componentCount++;
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    visited[start] = 1;
    while (head < tail) {
      const current = queue[head++];
      const x = current % image.width;
      const y = Math.floor(current / image.width);
      const neighbors = [
        x > 0 ? current - 1 : -1,
        x + 1 < image.width ? current + 1 : -1,
        y > 0 ? current - image.width : -1,
        y + 1 < image.height ? current + image.width : -1,
      ];
      for (const neighbor of neighbors) {
        if (neighbor < 0 || !occupied[neighbor] || visited[neighbor]) continue;
        visited[neighbor] = 1;
        queue[tail++] = neighbor;
      }
    }
  }

  if (componentCount !== options.expectedRegions) {
    throw new Error(
      `Authority mask must contain exactly ${options.expectedRegions} connected component${options.expectedRegions === 1 ? "" : "s"}; measured ${componentCount}.`,
    );
  }

  const authorityBoundsPx = occupiedBounds(image);
  if (!authorityBoundsPx) throw new Error("Authority mask is empty.");
  return {
    width: image.width,
    height: image.height,
    occupiedPixels,
    componentCount,
    touchesFrame,
    authorityBoundsPx,
  };
}

export async function clampToAuthorityMask(
  materialPng: Buffer,
  authorityMaskPng: Buffer,
): Promise<Buffer> {
  const [material, authority] = await Promise.all([
    decodeRgba(materialPng),
    decodeRgba(authorityMaskPng),
  ]);
  if (material.width !== authority.width || material.height !== authority.height) {
    throw new Error(
      `Material and authority-mask dimensions differ: ${material.width}×${material.height} vs ${authority.width}×${authority.height}.`,
    );
  }
  const output = copyAuthorityAlpha(material.data, extractAlpha(authority));
  return sharp(output, {
    raw: { width: material.width, height: material.height, channels: 4 },
  }).png().toBuffer();
}

export async function normalizeMaterialIntoAuthority(input: {
  materialPng: Buffer;
  sourceBoundsPx: PixelBounds;
  authorityMaskPng: Buffer;
  expectedRegions?: number;
}): Promise<{
  png: Buffer;
  authorityBoundsPx: PixelBounds;
  qa: ExactAlphaComparison;
}> {
  const [materialMetadata, inspection] = await Promise.all([
    sharp(input.materialPng).metadata(),
    inspectAuthorityMask(input.authorityMaskPng, {
      expectedRegions: input.expectedRegions ?? 1,
    }),
  ]);
  const materialWidth = materialMetadata.width ?? 0;
  const materialHeight = materialMetadata.height ?? 0;
  const bounds = input.sourceBoundsPx;
  if (
    bounds.left + bounds.width > materialWidth ||
    bounds.top + bounds.height > materialHeight
  ) {
    throw new Error(
      `Source bounds are outside the generated material image (${materialWidth}×${materialHeight}).`,
    );
  }

  const normalizedCrop = await sharp(input.materialPng)
    .extract(bounds)
    .resize({
      width: inspection.authorityBoundsPx.width,
      height: inspection.authorityBoundsPx.height,
      fit: "fill",
    })
    .ensureAlpha()
    .png()
    .toBuffer();
  const normalizedCanvas = await sharp({
    create: {
      width: inspection.width,
      height: inspection.height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  }).composite([{
    input: normalizedCrop,
    left: inspection.authorityBoundsPx.left,
    top: inspection.authorityBoundsPx.top,
  }]).png().toBuffer();
  const png = await clampToAuthorityMask(normalizedCanvas, input.authorityMaskPng);
  const [candidate, authority] = await Promise.all([
    decodeRgba(png),
    decodeRgba(input.authorityMaskPng),
  ]);
  return {
    png,
    authorityBoundsPx: inspection.authorityBoundsPx,
    qa: compareExactAlphaBytes(extractAlpha(candidate), extractAlpha(authority)),
  };
}

export async function buildPlacedComponentLayer(input: {
  componentPng: Buffer;
  canvas: { widthPx: number; heightPx: number };
  transform: { widthPx: number; centerXPx: number; seatYPx: number };
}): Promise<{ layerPng: Buffer; placementBoundsPx: PixelBounds }> {
  const component = await decodeRgba(input.componentPng);
  const bounds = occupiedBounds(component);
  if (!bounds) throw new Error("Component has no alpha foreground.");
  if (!Number.isInteger(input.transform.widthPx) || input.transform.widthPx < 1) {
    throw new Error("Placed component width must be a positive integer.");
  }
  const scale = input.transform.widthPx / bounds.width;
  const height = Math.max(1, Math.round(bounds.height * scale));
  const left = Math.round(input.transform.centerXPx - input.transform.widthPx / 2);
  const top = Math.round(input.transform.seatYPx - height);
  const placementBoundsPx = {
    left,
    top,
    width: input.transform.widthPx,
    height,
  };
  if (
    left < 0 ||
    top < 0 ||
    left + placementBoundsPx.width > input.canvas.widthPx ||
    top + placementBoundsPx.height > input.canvas.heightPx
  ) {
    throw new Error("Placed component bounds fall outside the canvas.");
  }

  const trimmed = await sharp(input.componentPng)
    .extract(bounds)
    .resize({ width: placementBoundsPx.width, height, fit: "fill" })
    .png()
    .toBuffer();
  const layerPng = await sharp({
    create: {
      width: input.canvas.widthPx,
      height: input.canvas.heightPx,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  }).composite([{ input: trimmed, left, top }]).png().toBuffer();
  return { layerPng, placementBoundsPx };
}

export async function composeComponentAssembly(input: {
  bodyPng: Buffer;
  layerPng: Buffer;
}): Promise<Buffer> {
  const [body, layer] = await Promise.all([
    sharp(input.bodyPng).metadata(),
    sharp(input.layerPng).metadata(),
  ]);
  if (body.width !== layer.width || body.height !== layer.height) {
    throw new Error(
      `Body and component-layer canvas dimensions differ: ${body.width}×${body.height} vs ${layer.width}×${layer.height}.`,
    );
  }
  return sharp(input.bodyPng)
    .composite([{ input: input.layerPng, left: 0, top: 0 }])
    .png()
    .toBuffer();
}
