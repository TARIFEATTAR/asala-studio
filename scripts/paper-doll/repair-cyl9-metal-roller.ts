import { createHash } from "node:crypto";
import { access, readFile, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";

import sharp from "sharp";

import { opaqueWhiteFraction, type OpaqueWhiteFractionResult } from "../../src/lib/paperDoll/qaGates";

export const CYL9_ROLLER_PLACEMENT = {
  canvasWidthPx: 2080,
  canvasHeightPx: 2288,
  targetWidthPx: 152,
  mountAxisXPx: 1041,
  seatYPx: 1002,
} as const;

interface RepairOptions {
  canvasWidthPx?: number;
  canvasHeightPx?: number;
  targetWidthPx?: number;
  mountAxisXPx?: number;
  seatYPx?: number;
}

interface PixelBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface MetalRollerRepairResult {
  png: Buffer;
  sha256: string;
  alphaBounds: PixelBounds;
  whiteJunk: OpaqueWhiteFractionResult;
  placement: Required<RepairOptions>;
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function alphaBounds(data: Uint8Array, width: number, height: number, alphaFloor = 8): PixelBounds | null {
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] < alphaFloor) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  return right < left ? null : { left, top, right, bottom };
}

export async function repairMetalRollerBuffer(
  mattedPng: Uint8Array,
  options: RepairOptions = {},
): Promise<MetalRollerRepairResult> {
  const placement: Required<RepairOptions> = { ...CYL9_ROLLER_PLACEMENT, ...options };
  const decoded = await sharp(mattedPng).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const sourceBounds = alphaBounds(decoded.data, decoded.info.width, decoded.info.height);
  if (!sourceBounds) throw new Error("ML-matted transparent PNG contains no foreground alpha.");

  let transparentPixels = 0;
  for (let i = 3; i < decoded.data.length; i += 4) {
    if (decoded.data[i] < 250) transparentPixels++;
  }
  if (transparentPixels === 0 || (
    sourceBounds.left === 0
    && sourceBounds.top === 0
    && sourceBounds.right === decoded.info.width - 1
    && sourceBounds.bottom === decoded.info.height - 1
  )) {
    throw new Error("Expected an ML-matted transparent PNG; the detected object is the image frame.");
  }

  const cropWidth = sourceBounds.right - sourceBounds.left + 1;
  const cropHeight = sourceBounds.bottom - sourceBounds.top + 1;
  const cropped = await sharp(mattedPng)
    .extract({ left: sourceBounds.left, top: sourceBounds.top, width: cropWidth, height: cropHeight })
    .resize({ width: placement.targetWidthPx, fit: "inside", withoutEnlargement: false, kernel: sharp.kernel.lanczos3 })
    .png({ compressionLevel: 9 })
    .toBuffer();
  const resizedMetadata = await sharp(cropped).metadata();
  const resizedWidth = resizedMetadata.width;
  const resizedHeight = resizedMetadata.height;
  if (!resizedWidth || !resizedHeight) throw new Error("Could not resolve repaired roller dimensions.");

  const left = Math.round(placement.mountAxisXPx - resizedWidth / 2);
  const top = placement.seatYPx - resizedHeight;
  if (left < 0 || top < 0 || left + resizedWidth > placement.canvasWidthPx || top + resizedHeight > placement.canvasHeightPx) {
    throw new Error("Locked roller placement falls outside the Paper-Doll canvas.");
  }

  const png = await sharp({
    create: {
      width: placement.canvasWidthPx,
      height: placement.canvasHeightPx,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  }).composite([{ input: cropped, left, top }]).png({ compressionLevel: 9 }).toBuffer();
  const repaired = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const repairedBounds = alphaBounds(repaired.data, repaired.info.width, repaired.info.height);
  if (!repairedBounds) throw new Error("Repaired roller contains no foreground alpha.");
  const whiteJunk = opaqueWhiteFraction({
    data: repaired.data,
    width: repaired.info.width,
    height: repaired.info.height,
    hasAlpha: true,
  });
  if (!whiteJunk.pass) throw new Error(whiteJunk.issues.join("; "));

  return { png, sha256: sha256(png), alphaBounds: repairedBounds, whiteJunk, placement };
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      matted: { type: "string" },
      source: { type: "string" },
      output: { type: "string" },
      evidence: { type: "string" },
    },
  });
  if (!values.matted || !values.source || !values.output) {
    throw new Error("Usage: repair-cyl9-metal-roller --source <recrop.png> --matted <transparent.png> --output <candidate.png> [--evidence <json>]");
  }
  await access(values.source);
  await access(values.matted);
  await assertMissing(values.output);
  if (values.evidence) await assertMissing(values.evidence);

  const [sourceBytes, mattedBytes] = await Promise.all([readFile(values.source), readFile(values.matted)]);
  const result = await repairMetalRollerBuffer(mattedBytes);
  await writeFile(values.output, result.png, { flag: "wx" });
  const evidence = {
    schemaVersion: 1,
    status: "candidate-not-approved",
    source: { path: values.source, sha256: sha256(sourceBytes) },
    matted: { path: values.matted, sha256: sha256(mattedBytes), method: "external-ml-matting-required" },
    output: { path: values.output, sha256: result.sha256, alphaBounds: result.alphaBounds },
    placement: result.placement,
    qa: { opaqueWhiteFraction: result.whiteJunk },
  };
  if (values.evidence) await writeFile(values.evidence, `${JSON.stringify(evidence, null, 2)}\n`, { flag: "wx" });
  process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
}

async function assertMissing(path: string): Promise<void> {
  try {
    await access(path);
  } catch {
    return;
  }
  throw new Error(`Refusing to overwrite existing file: ${path}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
