import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import sharp from "sharp";

import { clampToAuthorityMask, inspectAuthorityMask } from "../../src/lib/paperDoll/componentPlateImage.node";

interface PixelBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface Rgb {
  r: number;
  g: number;
  b: number;
}

interface ClosedAssemblyInput {
  sourcePng: Buffer;
  sourceBoundsPx: PixelBounds;
  backgroundRgb: Rgb;
  backgroundDistanceThreshold: number;
  targetWidthPx: number;
  centerXPx: number;
  seatYPx: number;
  canvas: { widthPx: number; heightPx: number };
}

export interface ClosedAssemblySwatchResult {
  candidatePng: Buffer;
  authorityMaskPng: Buffer;
  qa: {
    sourceBoundsPx: PixelBounds;
    placementBoundsPx: PixelBounds;
    occupiedPixels: number;
    componentCount: number;
    alphaMismatchedPixels: number;
  };
}

function sha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

function backgroundDistance(data: Buffer, offset: number, background: Rgb): number {
  return Math.max(
    Math.abs(data[offset] - background.r),
    Math.abs(data[offset + 1] - background.g),
    Math.abs(data[offset + 2] - background.b),
  );
}

async function exactAlphaMismatchCount(leftPng: Buffer, rightPng: Buffer): Promise<number> {
  const [left, right] = await Promise.all([
    sharp(leftPng).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(rightPng).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
  ]);
  if (left.info.width !== right.info.width || left.info.height !== right.info.height) return -1;
  let mismatches = 0;
  for (let pixel = 0; pixel < left.info.width * left.info.height; pixel += 1) {
    if (left.data[(pixel * 4) + 3] !== right.data[(pixel * 4) + 3]) mismatches += 1;
  }
  return mismatches;
}

export async function extractClosedAssemblySwatch(
  input: ClosedAssemblyInput,
): Promise<ClosedAssemblySwatchResult> {
  const metadata = await sharp(input.sourcePng).metadata();
  const sourceWidth = metadata.width ?? 0;
  const sourceHeight = metadata.height ?? 0;
  const bounds = input.sourceBoundsPx;
  if (
    bounds.left < 0 || bounds.top < 0 || bounds.width < 1 || bounds.height < 1
    || bounds.left + bounds.width > sourceWidth
    || bounds.top + bounds.height > sourceHeight
  ) {
    throw new Error("Closed assembly source bounds must remain inside the source image.");
  }
  if (!Number.isFinite(input.backgroundDistanceThreshold) || input.backgroundDistanceThreshold <= 0) {
    throw new Error("Background distance threshold must be positive and calibrated on the source image.");
  }

  const crop = await sharp(input.sourcePng)
    .extract(bounds)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const support = Buffer.alloc(crop.info.width * crop.info.height * 4);
  const material = Buffer.alloc(crop.info.width * crop.info.height * 4);

  for (let y = 0; y < crop.info.height; y += 1) {
    let rowLeft = crop.info.width;
    let rowRight = -1;
    for (let x = 0; x < crop.info.width; x += 1) {
      const sourceOffset = ((y * crop.info.width) + x) * 3;
      if (backgroundDistance(crop.data, sourceOffset, input.backgroundRgb) <= input.backgroundDistanceThreshold) continue;
      rowLeft = Math.min(rowLeft, x);
      rowRight = Math.max(rowRight, x);
    }
    if (rowRight < rowLeft) continue;
    for (let x = rowLeft; x <= rowRight; x += 1) {
      const sourceOffset = ((y * crop.info.width) + x) * 3;
      const outputOffset = ((y * crop.info.width) + x) * 4;
      material[outputOffset] = crop.data[sourceOffset];
      material[outputOffset + 1] = crop.data[sourceOffset + 1];
      material[outputOffset + 2] = crop.data[sourceOffset + 2];
      material[outputOffset + 3] = 255;
      support[outputOffset] = 255;
      support[outputOffset + 1] = 255;
      support[outputOffset + 2] = 255;
      support[outputOffset + 3] = 255;
    }
  }

  const targetHeightPx = Math.max(1, Math.round((bounds.height / bounds.width) * input.targetWidthPx));
  const placementBoundsPx = {
    left: Math.round(input.centerXPx - (input.targetWidthPx / 2)),
    top: input.seatYPx - targetHeightPx,
    width: input.targetWidthPx,
    height: targetHeightPx,
  };
  if (
    placementBoundsPx.left < 0 || placementBoundsPx.top < 0
    || placementBoundsPx.left + placementBoundsPx.width > input.canvas.widthPx
    || placementBoundsPx.top + placementBoundsPx.height > input.canvas.heightPx
  ) {
    throw new Error("Closed assembly placement must remain inside the canonical canvas.");
  }

  const rawCrop = { width: crop.info.width, height: crop.info.height, channels: 4 as const };
  const [resizedMaterial, resizedSupport] = await Promise.all([
    sharp(material, { raw: rawCrop }).resize({
      width: placementBoundsPx.width,
      height: placementBoundsPx.height,
      fit: "fill",
      kernel: sharp.kernel.lanczos3,
    }).png().toBuffer(),
    sharp(support, { raw: rawCrop }).resize({
      width: placementBoundsPx.width,
      height: placementBoundsPx.height,
      fit: "fill",
      kernel: sharp.kernel.nearest,
    }).png().toBuffer(),
  ]);
  const emptyCanvas = {
    create: {
      width: input.canvas.widthPx,
      height: input.canvas.heightPx,
      channels: 4 as const,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  };
  const [materialCanvas, authorityMaskPng] = await Promise.all([
    sharp(emptyCanvas).composite([{
      input: resizedMaterial,
      left: placementBoundsPx.left,
      top: placementBoundsPx.top,
    }]).png().toBuffer(),
    sharp(emptyCanvas).composite([{
      input: resizedSupport,
      left: placementBoundsPx.left,
      top: placementBoundsPx.top,
    }]).png().toBuffer(),
  ]);
  const candidatePng = await clampToAuthorityMask(materialCanvas, authorityMaskPng);
  const inspection = await inspectAuthorityMask(authorityMaskPng, { expectedRegions: 1 });
  const alphaMismatchedPixels = await exactAlphaMismatchCount(candidatePng, authorityMaskPng);

  return {
    candidatePng,
    authorityMaskPng,
    qa: {
      sourceBoundsPx: bounds,
      placementBoundsPx,
      occupiedPixels: inspection.occupiedPixels,
      componentCount: inspection.componentCount,
      alphaMismatchedPixels,
    },
  };
}

interface ReviewLane {
  lane: "sprayer" | "pump";
  variantKey: "SSLV" | "MSLV";
  sourcePath: string;
  sourceBoundsPx: PixelBounds;
}

async function buildLineup(
  candidatePng: Buffer,
  bodyPlates: Array<{ bodyId: string; path: string }>,
): Promise<Buffer> {
  const panelWidth = 416;
  const panelHeight = 510;
  const previewHeight = 458;
  const panels = await Promise.all(bodyPlates.map(async ({ bodyId, path: bodyPath }) => {
    const assembly = await sharp(await readFile(bodyPath))
      .composite([{ input: candidatePng }])
      .png()
      .toBuffer();
    const preview = await sharp(assembly).resize({ width: panelWidth, height: previewHeight, fit: "fill" }).png().toBuffer();
    const label = Buffer.from(`<svg width="${panelWidth}" height="52" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#11110f"/><text x="16" y="32" fill="#f4c46c" font-size="20" font-family="monospace">${bodyId.toUpperCase()}</text></svg>`);
    return sharp({
      create: { width: panelWidth, height: panelHeight, channels: 4, background: "#F5F3EF" },
    }).composite([{ input: preview, top: 0, left: 0 }, { input: label, top: previewHeight, left: 0 }]).png().toBuffer();
  }));
  return sharp({
    create: { width: panelWidth * panels.length, height: panelHeight, channels: 4, background: "#F5F3EF" },
  }).composite(panels.map((input, index) => ({ input, left: index * panelWidth, top: 0 }))).png().toBuffer();
}

async function main(): Promise<void> {
  const outputRoot = path.resolve("outputs/paper-doll-dispenser-17-415/closed-assembly-review-v1");
  const lanes: ReviewLane[] = [
    {
      lane: "sprayer",
      variantKey: "SSLV",
      sourcePath: "outputs/paper-doll-plates/cap-regen-sources/_harvest-candidates/CAPPED-spray-shnsl.png",
      sourceBoundsPx: { left: 236, top: 327, width: 233, height: 453 },
    },
    {
      lane: "pump",
      variantKey: "MSLV",
      sourcePath: "outputs/paper-doll-plates/cap-regen-sources/_harvest-candidates/CAPPED-lotion-mattsl.png",
      sourceBoundsPx: { left: 230, top: 322, width: 235, height: 461 },
    },
  ];
  const bodyRegistry = JSON.parse(await readFile("docs/paper-doll-rig/body-plate-registry.json", "utf8")) as {
    entries: Array<{ id: string; asset: { path: string } }>;
  };
  const bodyPlates = bodyRegistry.entries.map((entry) => ({
    bodyId: entry.id.split("__")[3],
    path: path.resolve(entry.asset.path),
  }));
  await Promise.all([
    mkdir(path.join(outputRoot, "authority"), { recursive: true }),
    mkdir(path.join(outputRoot, "candidates"), { recursive: true }),
    mkdir(path.join(outputRoot, "review"), { recursive: true }),
  ]);

  const results = [];
  for (const lane of lanes) {
    const sourcePng = await readFile(lane.sourcePath);
    const result = await extractClosedAssemblySwatch({
      sourcePng,
      sourceBoundsPx: lane.sourceBoundsPx,
      backgroundRgb: { r: 255, g: 255, b: 255 },
      backgroundDistanceThreshold: 12,
      targetWidthPx: 344,
      centerXPx: 1041,
      seatYPx: 1002,
      canvas: { widthPx: 2080, heightPx: 2288 },
    });
    const authorityPath = path.join(outputRoot, "authority", `${lane.lane}-closed-assembly.png`);
    const candidatePath = path.join(outputRoot, "candidates", `${lane.lane}-${lane.variantKey}-closed.png`);
    const lineupPath = path.join(outputRoot, "review", `${lane.lane}-${lane.variantKey}-closed-five-body.png`);
    const lineup = await buildLineup(result.candidatePng, bodyPlates);
    await Promise.all([
      writeFile(authorityPath, result.authorityMaskPng),
      writeFile(candidatePath, result.candidatePng),
      writeFile(lineupPath, lineup),
    ]);
    results.push({
      lane: lane.lane,
      variantKey: lane.variantKey,
      state: "source-calibrated-review-candidate",
      sourcePath: lane.sourcePath,
      sourceSha256: sha256(sourcePng),
      sourceBoundsPx: lane.sourceBoundsPx,
      authorityPath,
      authoritySha256: sha256(result.authorityMaskPng),
      candidatePath,
      candidateSha256: sha256(result.candidatePng),
      lineupPath,
      qa: result.qa,
    });
  }

  const manifest = {
    schemaVersion: 1,
    familyKey: "DISPENSER-17-415-CLOSED-ASSEMBLIES",
    state: "named-visual-review-required",
    architectureDecision: {
      approvedBy: "Jordan Richter",
      approvedAt: "2026-08-03",
      openState: "exposed dispenser exterior swatch",
      closedState: "dispenser plus translucent overcap baked into one compound swatch",
      independentTranslucentOverlayAllowed: false,
    },
    calibration: {
      basis: "measured directly from the two real capped catalog source files",
      backgroundRgb: { r: 255, g: 255, b: 255 },
      backgroundDistanceThreshold: 12,
      targetWidthPx: 344,
      centerXPx: 1041,
      seatYPx: 1002,
    },
    closedAssemblySwatches: results,
    remainingVariantGeneration: {
      sprayer: ["GLD", "MSLV", "BLK", "RED", "TUR"],
      pump: ["GLD", "BLK"],
      policy: "generate material variants inside the approved closed-assembly authority, then mask-and-clamp",
    },
    qa: {
      fiveBodyAssemblyContextRendered: true,
      geometryLocked: false,
      productionEligible: false,
      reason: "source-calibrated closed silhouettes require named five-body visual approval before geometry lock",
    },
    currentReleaseChanged: false,
    sanityChanged: false,
  };
  const manifestPath = path.join(outputRoot, "manifest.json");
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ manifestPath, reviewPaths: results.map((result) => result.lineupPath) }, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
