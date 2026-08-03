import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import sharp from "sharp";

import { compareExactAlphaBytes } from "../../supabase/functions/_shared/paperDollExactAlpha";
import {
  clampToAuthorityMask,
  inspectAuthorityMask,
} from "../../src/lib/paperDoll/componentPlateImage.node";
import type { PixelBounds } from "../../src/lib/paperDoll/componentPlateContract";

const VARIANT_ORDER = ["SBLK", "MGLD", "MSLV", "SGLD", "SSLV"] as const;
type VariantKey = typeof VARIANT_ORDER[number];

const SOURCE_VARIANTS: Record<string, VariantKey> = {
  "psd-head-black": "SBLK",
  "psd-head-matte-gold": "MGLD",
  "psd-head-matte-silver": "MSLV",
  "psd-head-shiny-gold": "SGLD",
  "psd-head-shiny-silver": "SSLV",
  "assembly-clear30-black": "SBLK",
  "assembly-clear30-matte-gold": "MGLD",
  "assembly-clear30-matte-silver": "MSLV",
  "assembly-clear30-shiny-gold": "SGLD",
  "assembly-clear30-shiny-silver": "SSLV",
};

const HEAD_AUTHORITY_SOURCE_ID = "psd-head-shiny-silver";

interface ExtractedAsset {
  partId: string;
  sourceId: string;
  cutoutPath: string;
  cutoutSha256: string;
  originalFilename: string;
  sourceSha256: string;
  variantKey?: string;
}

interface ExtractionManifest {
  assets: ExtractedAsset[];
}

export interface AuthorityCalibration {
  pxPerMm: number;
  outsideDiameterMm: number;
  outsideDiameterToleranceMm: number;
  heightMm: number;
  heightToleranceMm: number;
  centerXPx: number;
  seatYPx: number;
}

export interface SourceAspectHeightCalibration {
  heightMm: number;
  toleranceMm: number;
  basis: string;
}

export interface DetachedAlphaIslandCalibration {
  expectedSourceComponents: number;
  maxDiscardedComponentPixels: number;
  maxDiscardedTotalPixels: number;
}

export interface DetachedAlphaIslandReport {
  measuredSourceComponents: number;
  retainedComponentPixels: number;
  discardedComponentPixels: number[];
  discardedTotalPixels: number;
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

async function alphaBounds(png: Buffer): Promise<PixelBounds> {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let left = info.width;
  let top = info.height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (data[(y * info.width + x) * info.channels + 3] === 0) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  if (right < left || bottom < top) throw new Error("Source contains no non-transparent pixels.");
  return { left, top, width: right - left + 1, height: bottom - top + 1 };
}

async function alphaBytes(png: Buffer): Promise<Buffer> {
  return sharp(png).ensureAlpha().extractChannel("alpha").raw().toBuffer();
}

export async function cleanCalibratedDetachedAlphaIslands(input: {
  sourcePng: Buffer;
  calibration: DetachedAlphaIslandCalibration;
}): Promise<{ png: Buffer; report: DetachedAlphaIslandReport }> {
  const { data, info } = await sharp(input.sourcePng).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const pixelCount = info.width * info.height;
  const visited = new Uint8Array(pixelCount);
  const components: number[][] = [];
  const offsets = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const origin = y * info.width + x;
      if (visited[origin] || data[origin * info.channels + 3] === 0) continue;
      visited[origin] = 1;
      const stack = [origin];
      const component: number[] = [];
      while (stack.length > 0) {
        const index = stack.pop()!;
        component.push(index);
        const componentY = Math.floor(index / info.width);
        const componentX = index - componentY * info.width;
        for (const [dx, dy] of offsets) {
          const nextX = componentX + dx;
          const nextY = componentY + dy;
          if (nextX < 0 || nextY < 0 || nextX >= info.width || nextY >= info.height) continue;
          const nextIndex = nextY * info.width + nextX;
          if (visited[nextIndex] || data[nextIndex * info.channels + 3] === 0) continue;
          visited[nextIndex] = 1;
          stack.push(nextIndex);
        }
      }
      components.push(component);
    }
  }
  components.sort((left, right) => right.length - left.length);
  if (components.length !== input.calibration.expectedSourceComponents) {
    throw new Error(
      `Measured ${components.length} source alpha components; calibrated source contract requires ${input.calibration.expectedSourceComponents}.`,
    );
  }
  if (components.length < 1) throw new Error("Source contains no non-transparent pixels.");
  const discardedComponentPixels = components.slice(1).map((component) => component.length);
  const discardedTotalPixels = discardedComponentPixels.reduce((total, pixels) => total + pixels, 0);
  const oversized = discardedComponentPixels.find((pixels) => pixels > input.calibration.maxDiscardedComponentPixels);
  if (oversized !== undefined) {
    throw new Error(
      `Detached alpha component of ${oversized}px exceeds calibrated maximum ${input.calibration.maxDiscardedComponentPixels}px.`,
    );
  }
  if (discardedTotalPixels > input.calibration.maxDiscardedTotalPixels) {
    throw new Error(
      `Detached alpha total ${discardedTotalPixels}px exceeds calibrated maximum ${input.calibration.maxDiscardedTotalPixels}px.`,
    );
  }
  for (const component of components.slice(1)) {
    for (const pixelIndex of component) data[pixelIndex * info.channels + 3] = 0;
  }
  return {
    png: await sharp(data, {
      raw: { width: info.width, height: info.height, channels: info.channels },
    }).png().toBuffer(),
    report: {
      measuredSourceComponents: components.length,
      retainedComponentPixels: components[0].length,
      discardedComponentPixels,
      discardedTotalPixels,
    },
  };
}

export async function buildCalibratedAuthorityMask(input: {
  sourcePng: Buffer;
  canvas: { widthPx: number; heightPx: number };
  targetWidthPx: number;
  centerXPx: number;
  seatYPx: number;
  allowedHeightPx: { minimum: number; maximum: number };
  sourceAlphaCleanup?: DetachedAlphaIslandCalibration;
}): Promise<{
  maskPng: Buffer;
  sourceBoundsPx: PixelBounds;
  authorityBoundsPx: PixelBounds;
  uniformScale: number;
  sourceAlphaCleanupReport: DetachedAlphaIslandReport | null;
}> {
  const cleaned = input.sourceAlphaCleanup
    ? await cleanCalibratedDetachedAlphaIslands({
      sourcePng: input.sourcePng,
      calibration: input.sourceAlphaCleanup,
    })
    : { png: input.sourcePng, report: null };
  const sourceBoundsPx = await alphaBounds(cleaned.png);
  if (!Number.isInteger(input.targetWidthPx) || input.targetWidthPx < 1) {
    throw new Error("Target physical width must be a positive integer.");
  }
  const sourceCrop = await sharp(cleaned.png).extract(sourceBoundsPx).png().toBuffer();
  const resized = await sharp(sourceCrop)
    // Lanczos3 rings around high-contrast alpha edges and produced detached
    // 1–20px islands on the real Blender mask. Lanczos2 preserves the same
    // antialiased silhouette while keeping the procedural mask connected.
    .resize({ width: input.targetWidthPx, kernel: "lanczos2" })
    .ensureAlpha()
    .png()
    .toBuffer();
  const resizedMetadata = await sharp(resized).metadata();
  const resizedHeight = resizedMetadata.height ?? 0;
  if (resizedHeight < input.allowedHeightPx.minimum || resizedHeight > input.allowedHeightPx.maximum) {
    throw new Error(
      `Uniform physical calibration produced ${resizedHeight}px height outside ${input.allowedHeightPx.minimum}..${input.allowedHeightPx.maximum}px.`,
    );
  }
  const left = Math.round(input.centerXPx - input.targetWidthPx / 2);
  const top = input.seatYPx - resizedHeight;
  const authorityBoundsPx = { left, top, width: input.targetWidthPx, height: resizedHeight };
  if (
    left < 0
    || top < 0
    || left + input.targetWidthPx > input.canvas.widthPx
    || top + resizedHeight > input.canvas.heightPx
  ) {
    throw new Error("Calibrated authority bounds fall outside the canonical canvas.");
  }
  const alpha = await sharp(resized).extractChannel("alpha").png().toBuffer();
  const whiteWithAlpha = await sharp({
    create: {
      width: input.targetWidthPx,
      height: resizedHeight,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  }).joinChannel(alpha).png().toBuffer();
  const maskPng = await sharp({
    create: {
      width: input.canvas.widthPx,
      height: input.canvas.heightPx,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  }).composite([{ input: whiteWithAlpha, left, top }]).png().toBuffer();
  const inspection = await inspectAuthorityMask(maskPng, { expectedRegions: 1 });
  return {
    maskPng,
    sourceBoundsPx,
    authorityBoundsPx: inspection.authorityBoundsPx,
    uniformScale: input.targetWidthPx / sourceBoundsPx.width,
    sourceAlphaCleanupReport: cleaned.report,
  };
}

export async function normalizeSourceMaterialToAuthority(input: {
  sourcePng: Buffer;
  authorityMaskPng: Buffer;
}): Promise<{
  png: Buffer;
  sourceBoundsPx: PixelBounds;
  authorityBoundsPx: PixelBounds;
  qa: ReturnType<typeof compareExactAlphaBytes>;
}> {
  const [sourceBoundsPx, inspection] = await Promise.all([
    alphaBounds(input.sourcePng),
    inspectAuthorityMask(input.authorityMaskPng, { expectedRegions: 1 }),
  ]);
  const crop = await sharp(input.sourcePng).extract(sourceBoundsPx).png().toBuffer();
  const material = await sharp(crop).resize({
    width: inspection.authorityBoundsPx.width,
    height: inspection.authorityBoundsPx.height,
    fit: "cover",
    position: "centre",
  }).ensureAlpha().png().toBuffer();
  const materialCanvas = await sharp({
    create: {
      width: inspection.width,
      height: inspection.height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  }).composite([{
    input: material,
    left: inspection.authorityBoundsPx.left,
    top: inspection.authorityBoundsPx.top,
  }]).png().toBuffer();
  const png = await clampToAuthorityMask(materialCanvas, input.authorityMaskPng);
  const [candidateAlpha, authorityAlpha] = await Promise.all([
    alphaBytes(png),
    alphaBytes(input.authorityMaskPng),
  ]);
  return {
    png,
    sourceBoundsPx,
    authorityBoundsPx: inspection.authorityBoundsPx,
    qa: compareExactAlphaBytes(candidateAlpha, authorityAlpha),
  };
}

function variantForAsset(asset: ExtractedAsset): VariantKey | null {
  const value = asset.variantKey ?? SOURCE_VARIANTS[asset.sourceId];
  return VARIANT_ORDER.includes(value as VariantKey) ? value as VariantKey : null;
}

async function renderCandidateContactSheet(input: {
  title: string;
  candidates: Array<{ variantKey: VariantKey; png: Buffer }>;
}): Promise<Buffer> {
  const tileWidth = 340;
  const tileHeight = 460;
  const tiles = await Promise.all(input.candidates.map(async (candidate) => {
    const bounds = await alphaBounds(candidate.png);
    const crop = await sharp(candidate.png).extract(bounds).resize({
      width: 260,
      height: 330,
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    }).png().toBuffer();
    const base = Buffer.from(`<svg width="${tileWidth}" height="${tileHeight}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#F5F3EF"/>
      <rect x="1" y="1" width="338" height="458" fill="none" stroke="#C6A15B" stroke-width="2"/>
      <text x="22" y="398" font-family="Arial" font-size="22" font-weight="700" fill="#171714">${candidate.variantKey}</text>
      <text x="22" y="426" font-family="Arial" font-size="13" fill="#4B918A">EXACT ALPHA · REVIEW ONLY</text>
    </svg>`);
    return sharp(base).composite([{ input: crop, left: 40, top: 34 }]).png().toBuffer();
  }));
  return sharp({
    create: {
      width: tileWidth * tiles.length,
      height: tileHeight,
      channels: 4,
      background: "#171714",
    },
  }).composite(tiles.map((tile, index) => ({ input: tile, left: index * tileWidth, top: 0 }))).png().toBuffer();
}

async function renderFamilyFitContactSheet(input: {
  bodyPlates: Array<{ bodyId: string; path: string }>;
  componentPng: Buffer;
}): Promise<Buffer> {
  const tileWidth = 340;
  const tileHeight = 460;
  const tiles = await Promise.all(input.bodyPlates.map(async (body) => {
    const assembled = await sharp(body.path).composite([{ input: input.componentPng, left: 0, top: 0 }]).png().toBuffer();
    const preview = await sharp(assembled).resize({ width: 300, height: 390, fit: "contain" }).png().toBuffer();
    const label = Buffer.from(`<svg width="${tileWidth}" height="${tileHeight}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#171714"/>
      <text x="22" y="438" font-family="Arial" font-size="18" font-weight="700" fill="#D5B16A">${body.bodyId.toUpperCase()}</text>
    </svg>`);
    return sharp(label).composite([{ input: preview, left: 20, top: 18 }]).png().toBuffer();
  }));
  return sharp({
    create: {
      width: tileWidth * tiles.length,
      height: tileHeight,
      channels: 4,
      background: "#171714",
    },
  }).composite(tiles.map((tile, index) => ({ input: tile, left: index * tileWidth, top: 0 }))).png().toBuffer();
}

export async function buildSprayerAuthorityReview(input: {
  extractionManifestPath: string;
  overcapBlenderMaskPath: string;
  outputRoot: string;
  canvas: { widthPx: number; heightPx: number };
  calibration: AuthorityCalibration;
  headAuthoritySourceAlphaCleanup?: DetachedAlphaIslandCalibration;
  headAuthorityHeightCalibration?: SourceAspectHeightCalibration;
  bodyPlates: Array<{ bodyId: string; path: string }>;
}): Promise<{ manifestPath: string; contactSheetPaths: string[] }> {
  const extractionBytes = await readFile(input.extractionManifestPath);
  const extraction = JSON.parse(extractionBytes.toString("utf8")) as ExtractionManifest;
  const requiredParts = ["sprayer-head", "protective-overcap"] as const;
  const assetsByPart = new Map(requiredParts.map((partId) => [
    partId,
    extraction.assets.filter((asset) => asset.partId === partId),
  ]));
  for (const partId of requiredParts) {
    const assets = assetsByPart.get(partId) ?? [];
    const variants = assets.map(variantForAsset).filter(Boolean);
    if (variants.length !== VARIANT_ORDER.length || VARIANT_ORDER.some((key) => !variants.includes(key))) {
      throw new Error(`${partId} must contain the exact five 15-415 appearance sources.`);
    }
  }
  const sourceBuffers = new Map<string, Buffer>();
  for (const asset of extraction.assets.filter((value) => requiredParts.includes(value.partId as typeof requiredParts[number]))) {
    const bytes = await readFile(asset.cutoutPath);
    if (sha256(bytes) !== asset.cutoutSha256) throw new Error(`Extracted source SHA-256 mismatch: ${asset.sourceId}.`);
    sourceBuffers.set(asset.sourceId, bytes);
  }
  const targetWidthPx = Math.round(input.calibration.outsideDiameterMm * input.calibration.pxPerMm);
  const allowedHeightPx = {
    minimum: Math.floor((input.calibration.heightMm - input.calibration.heightToleranceMm) * input.calibration.pxPerMm),
    maximum: Math.ceil((input.calibration.heightMm + input.calibration.heightToleranceMm) * input.calibration.pxPerMm),
  };
  const headHeightCalibration = input.headAuthorityHeightCalibration ?? {
    heightMm: input.calibration.heightMm,
    toleranceMm: input.calibration.heightToleranceMm,
    basis: "catalog-physical-envelope",
  };
  const headAllowedHeightPx = {
    minimum: Math.floor((headHeightCalibration.heightMm - headHeightCalibration.toleranceMm) * input.calibration.pxPerMm),
    maximum: Math.ceil((headHeightCalibration.heightMm + headHeightCalibration.toleranceMm) * input.calibration.pxPerMm),
  };
  const headAuthorityAsset = extraction.assets.find((asset) => asset.sourceId === HEAD_AUTHORITY_SOURCE_ID)
    ?? extraction.assets.find((asset) => asset.partId === "sprayer-head" && variantForAsset(asset) === "SSLV");
  if (!headAuthorityAsset) throw new Error("Shiny-silver sprayer-head authority source is missing.");
  const headAuthority = await buildCalibratedAuthorityMask({
    sourcePng: sourceBuffers.get(headAuthorityAsset.sourceId)!,
    canvas: input.canvas,
    targetWidthPx,
    centerXPx: input.calibration.centerXPx,
    seatYPx: input.calibration.seatYPx,
    allowedHeightPx: headAllowedHeightPx,
    sourceAlphaCleanup: input.headAuthoritySourceAlphaCleanup,
  });
  const overcapBlenderMask = await readFile(input.overcapBlenderMaskPath);
  const overcapAuthority = await buildCalibratedAuthorityMask({
    sourcePng: overcapBlenderMask,
    canvas: input.canvas,
    targetWidthPx,
    centerXPx: input.calibration.centerXPx,
    seatYPx: input.calibration.seatYPx,
    allowedHeightPx,
  });
  const authorities = [
    {
      partId: "sprayer-head",
      sourceId: headAuthorityAsset.sourceId,
      value: headAuthority,
      heightContract: { ...headHeightCalibration, allowedHeightPx: headAllowedHeightPx },
    },
    {
      partId: "protective-overcap",
      sourceId: "blender-geometry-mask",
      value: overcapAuthority,
      heightContract: {
        heightMm: input.calibration.heightMm,
        toleranceMm: input.calibration.heightToleranceMm,
        basis: "catalog-physical-envelope",
        allowedHeightPx,
      },
    },
  ] as const;
  const authorityDirectory = path.join(input.outputRoot, "authority");
  await mkdir(authorityDirectory, { recursive: true });
  for (const authority of authorities) {
    await writeFile(path.join(authorityDirectory, `${authority.partId}.png`), authority.value.maskPng);
  }
  const qa: Array<{ partId: string; variantKey: VariantKey; exactAlpha: boolean; mismatchedPixels: number }> = [];
  const candidateFamilies: Array<{
    partId: "sprayer-head" | "protective-overcap";
    candidates: Array<{ variantKey: VariantKey; png: Buffer; sourceId: string; sourceSha256: string; originalFilename: string }>;
  }> = [];
  for (const authority of authorities) {
    const candidates = [];
    for (const variantKey of VARIANT_ORDER) {
      const asset = (assetsByPart.get(authority.partId) ?? []).find((value) => variantForAsset(value) === variantKey);
      if (!asset) throw new Error(`${authority.partId} ${variantKey} source is missing.`);
      const normalized = await normalizeSourceMaterialToAuthority({
        sourcePng: sourceBuffers.get(asset.sourceId)!,
        authorityMaskPng: authority.value.maskPng,
      });
      const outputPath = path.join(input.outputRoot, "candidates", authority.partId, `${variantKey}.png`);
      await mkdir(path.dirname(outputPath), { recursive: true });
      await writeFile(outputPath, normalized.png);
      qa.push({
        partId: authority.partId,
        variantKey,
        exactAlpha: normalized.qa.geometryLocked,
        mismatchedPixels: normalized.qa.mismatchedPixels,
      });
      candidates.push({
        variantKey,
        png: normalized.png,
        sourceId: asset.sourceId,
        sourceSha256: asset.sourceSha256,
        originalFilename: asset.originalFilename,
      });
    }
    candidateFamilies.push({ partId: authority.partId, candidates });
  }
  const reviewDirectory = path.join(input.outputRoot, "review");
  await mkdir(reviewDirectory, { recursive: true });
  const contactSheetPaths: string[] = [];
  for (const family of candidateFamilies) {
    const materialPath = path.join(reviewDirectory, `${family.partId}-materials.png`);
    const fitPath = path.join(reviewDirectory, `${family.partId}-five-body-fit.png`);
    const material = await renderCandidateContactSheet({ title: family.partId, candidates: family.candidates });
    const referenceCandidate = family.candidates.find((candidate) => candidate.variantKey === "SSLV")!;
    const fit = await renderFamilyFitContactSheet({ bodyPlates: input.bodyPlates, componentPng: referenceCandidate.png });
    await Promise.all([writeFile(materialPath, material), writeFile(fitPath, fit)]);
    contactSheetPaths.push(materialPath, fitPath);
  }
  const manifest = {
    schemaVersion: 1,
    familyKey: "SPRAYER-15-415",
    state: "dimension-calibrated-authority-review",
    extractionManifestPath: input.extractionManifestPath,
    extractionManifestSha256: sha256(extractionBytes),
    physicalTruth: {
      outsideDiameterMm: input.calibration.outsideDiameterMm,
      outsideDiameterToleranceMm: input.calibration.outsideDiameterToleranceMm,
      heightMm: input.calibration.heightMm,
      heightToleranceMm: input.calibration.heightToleranceMm,
    },
    placementCalibration: {
      pxPerMm: input.calibration.pxPerMm,
      centerXPx: input.calibration.centerXPx,
      seatYPx: input.calibration.seatYPx,
      targetWidthPx,
      allowedHeightPx,
    },
    responsibilities: authorities.map((authority) => ({
      partId: authority.partId,
      authoritySourceId: authority.sourceId,
      authorityBoundsPx: authority.value.authorityBoundsPx,
      authorityMaskPath: path.join(authorityDirectory, `${authority.partId}.png`),
      authorityMaskSha256: sha256(authority.value.maskPng),
      heightContract: authority.heightContract,
      candidateCount: VARIANT_ORDER.length,
      exactAlphaAcrossCandidates: qa.filter((value) => value.partId === authority.partId).every((value) => value.exactAlpha),
      sourceAlphaCleanup: authority.value.sourceAlphaCleanupReport,
    })),
    bodyContextualResponsibilities: [{
      partId: "dip-tube",
      route: "body-contextual-weld",
      catalogLengthMm: 93.8,
      productionPlateEligible: false,
    }],
    contactSheetPaths,
    qa,
    geometryLocked: false,
    productionEligible: false,
    namedAuthorityReviewRequired: true,
    familyFitApprovalRequired: true,
    currentReleaseChanged: false,
    sanityChanged: false,
  };
  const manifestPath = path.join(input.outputRoot, "manifest.json");
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return { manifestPath, contactSheetPaths };
}

async function main(): Promise<void> {
  const bodyRegistry = JSON.parse(await readFile("docs/paper-doll-rig/body-plate-registry.json", "utf8")) as {
    entries: Array<{ id: string; asset: { path: string } }>;
  };
  const result = await buildSprayerAuthorityReview({
    extractionManifestPath: path.resolve("outputs/paper-doll-component-kit-reviews/15-415-sprayer/source-extraction-v1/manifest.json"),
    overcapBlenderMaskPath: path.resolve("outputs/paper-doll-sprayer-15-415/protective-overcap/blender-v1/geometry-mask.png"),
    outputRoot: path.resolve("outputs/paper-doll-sprayer-15-415/authority-review-v1"),
    canvas: { widthPx: 2080, heightPx: 2288 },
    calibration: {
      pxPerMm: 18.15,
      outsideDiameterMm: 20,
      outsideDiameterToleranceMm: 0.5,
      heightMm: 41,
      heightToleranceMm: 0.5,
      centerXPx: 1041,
      seatYPx: 1002,
    },
    headAuthoritySourceAlphaCleanup: {
      expectedSourceComponents: 10,
      maxDiscardedComponentPixels: 13,
      maxDiscardedTotalPixels: 71,
    },
    headAuthorityHeightCalibration: {
      heightMm: 40.1,
      toleranceMm: 0.25,
      basis: "cleaned-shiny-silver-source-aspect-at-catalog-20mm-width",
    },
    bodyPlates: bodyRegistry.entries.map((entry) => ({
      bodyId: entry.id.split("__")[3],
      path: path.resolve(entry.asset.path),
    })),
  });
  process.stdout.write(`${JSON.stringify({
    manifestPath: result.manifestPath,
    contactSheetPaths: result.contactSheetPaths,
    geometryLocked: false,
    productionEligible: false,
    currentReleaseChanged: false,
    sanityChanged: false,
  }, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
