import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import sharp from "sharp";

import { inspectAuthorityMask } from "../../src/lib/paperDoll/componentPlateImage.node";
import type { PixelBounds } from "../../src/lib/paperDoll/componentPlateContract";
import {
  cleanCalibratedDetachedAlphaIslands,
  normalizeSourceMaterialToAuthority,
  type DetachedAlphaIslandCalibration,
} from "./build-sprayer-15-415-authority-review";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const defaultExtractionManifestPath = path.join(workspaceRoot, "outputs/paper-doll-component-kit-reviews/13-415-sprayer/source-extraction-v1/manifest.json");
const defaultOutputRoot = path.join(workspaceRoot, "outputs/paper-doll-component-authority-reviews/sprayer-13-415/opaque-overcap-v1");

interface ExtractionAsset {
  partId: string;
  sourceId: string;
  cutoutPath: string;
  cutoutSha256: string;
  originalFilename: string;
  sourceSha256: string;
}

interface ExtractionManifest { assets: ExtractionAsset[] }

export interface OvercapVariantRecipe {
  sourceId: string;
  variantKey: string;
  finish: string;
  alphaCleanup: DetachedAlphaIslandCalibration;
}

export interface BuildSprayer13OvercapReviewInput {
  extractionManifestPath: string;
  outputRoot: string;
  canvas: { width: number; height: number };
  authoritySourceId: string;
  variants: OvercapVariantRecipe[];
}

const sha256 = (value: Buffer) => createHash("sha256").update(value).digest("hex");

async function alphaBounds(png: Buffer): Promise<PixelBounds> {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let left = info.width;
  let top = info.height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < info.height; y += 1) for (let x = 0; x < info.width; x += 1) {
    if (data[(y * info.width + x) * info.channels + 3] === 0) continue;
    left = Math.min(left, x);
    top = Math.min(top, y);
    right = Math.max(right, x);
    bottom = Math.max(bottom, y);
  }
  if (right < left || bottom < top) throw new Error("Overcap source contains no alpha foreground.");
  return { left, top, width: right - left + 1, height: bottom - top + 1 };
}

async function centeredAuthority(sourcePng: Buffer, canvas: { width: number; height: number }) {
  const sourceBoundsPx = await alphaBounds(sourcePng);
  const crop = await sharp(sourcePng).extract(sourceBoundsPx).png().toBuffer();
  const authorityBoundsPx = {
    left: Math.floor((canvas.width - sourceBoundsPx.width) / 2),
    top: Math.floor((canvas.height - sourceBoundsPx.height) / 2),
    width: sourceBoundsPx.width,
    height: sourceBoundsPx.height,
  };
  const alpha = await sharp(crop).extractChannel("alpha").png().toBuffer();
  const maskCrop = await sharp({
    create: {
      width: sourceBoundsPx.width,
      height: sourceBoundsPx.height,
      channels: 3,
      background: "white",
    },
  }).joinChannel(alpha).png().toBuffer();
  const maskPng = await sharp({ create: { width: canvas.width, height: canvas.height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: maskCrop, left: authorityBoundsPx.left, top: authorityBoundsPx.top }]).png().toBuffer();
  const inspection = await inspectAuthorityMask(maskPng, { expectedRegions: 1 });
  return { maskPng, sourceBoundsPx, authorityBoundsPx: inspection.authorityBoundsPx };
}

async function contactSheet(candidates: Array<{ variantKey: string; finish: string; path: string }>, outputPath: string) {
  const tileWidth = 380;
  const tileHeight = 540;
  const columns = 4;
  const composites: sharp.OverlayOptions[] = [];
  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    const left = (index % columns) * tileWidth;
    const top = Math.floor(index / columns) * tileHeight;
    const candidatePng = await readFile(candidate.path);
    const bounds = await alphaBounds(candidatePng);
    const preview = await sharp(candidatePng).extract(bounds).resize({ width: 260, height: 390, fit: "contain", background: "#F5F3EF" }).extend({ top: 20, bottom: 20, left: 30, right: 30, background: "#F5F3EF" }).png().toBuffer();
    const label = Buffer.from(`<svg width="${tileWidth}" height="80"><rect width="100%" height="100%" fill="#171714"/><text x="20" y="30" font-family="Arial" font-size="20" fill="#e4bc68">${candidate.variantKey}</text><text x="20" y="58" font-family="Arial" font-size="15" fill="white">${candidate.finish}</text></svg>`);
    composites.push({ input: preview, left: left + 30, top: top + 10 }, { input: label, left, top: top + 450 });
  }
  await sharp({ create: { width: columns * tileWidth, height: Math.ceil(candidates.length / columns) * tileHeight, channels: 4, background: "#F5F3EF" } })
    .composite(composites).png().toFile(outputPath);
}

export async function buildSprayer13OvercapReview(input: BuildSprayer13OvercapReviewInput) {
  const extractionBytes = await readFile(input.extractionManifestPath);
  const extraction = JSON.parse(extractionBytes.toString("utf8")) as ExtractionManifest;
  const assets = new Map(extraction.assets.filter((asset) => asset.partId === "opaque-protective-overcap").map((asset) => [asset.sourceId, asset]));
  if (input.variants.length < 1 || new Set(input.variants.map((variant) => variant.variantKey)).size !== input.variants.length) {
    throw new Error("Opaque-overcap review requires unique variants.");
  }
  const cleaned = new Map<string, Awaited<ReturnType<typeof cleanCalibratedDetachedAlphaIslands>>>();
  for (const variant of input.variants) {
    const asset = assets.get(variant.sourceId);
    if (!asset) throw new Error(`Missing extracted overcap source: ${variant.sourceId}`);
    const bytes = await readFile(asset.cutoutPath);
    if (sha256(bytes) !== asset.cutoutSha256) throw new Error(`Extracted overcap SHA mismatch: ${variant.sourceId}`);
    cleaned.set(variant.sourceId, await cleanCalibratedDetachedAlphaIslands({ sourcePng: bytes, calibration: variant.alphaCleanup }));
  }
  const authoritySource = cleaned.get(input.authoritySourceId);
  if (!authoritySource) throw new Error("Opaque-overcap authority review source is missing.");
  const authority = await centeredAuthority(authoritySource.png, input.canvas);
  await mkdir(path.join(input.outputRoot, "candidates"), { recursive: true });
  await writeFile(path.join(input.outputRoot, "authority-review-mask.png"), authority.maskPng);
  const candidates = [];
  for (const variant of input.variants) {
    const asset = assets.get(variant.sourceId)!;
    const normalized = await normalizeSourceMaterialToAuthority({ sourcePng: cleaned.get(variant.sourceId)!.png, authorityMaskPng: authority.maskPng });
    const outputPath = path.join(input.outputRoot, "candidates", `${variant.variantKey}.png`);
    await writeFile(outputPath, normalized.png);
    candidates.push({
      variantKey: variant.variantKey,
      finish: variant.finish,
      sourceId: variant.sourceId,
      sourceSha256: asset.sourceSha256,
      originalFilename: asset.originalFilename,
      candidatePath: outputPath,
      candidateSha256: sha256(normalized.png),
      sourceBoundsPx: await alphaBounds(cleaned.get(variant.sourceId)!.png),
      authorityBoundsPx: authority.authorityBoundsPx,
      placementBoundsPx: null,
      cleanup: cleaned.get(variant.sourceId)!.report,
      qa: normalized.qa,
    });
  }
  const contactSheetPath = path.join(input.outputRoot, "contact-sheet.png");
  await contactSheet(candidates.map((candidate) => ({ variantKey: candidate.variantKey, finish: candidate.finish, path: candidate.candidatePath })), contactSheetPath);
  const manifest = {
    schemaVersion: 1,
    familyKey: "SPRAYER-13-415-OPAQUE-PROTECTIVE-OVERCAP",
    state: "exact-alpha-profile-review",
    physicalTruth: { outsideDiameterMm: 17, cappedAssemblyHeightMm: 32, interpretation: "catalog envelope evidence; not an approved overcap-only geometry authority" },
    authorityReviewSourceId: input.authoritySourceId,
    sourceBoundsPx: authority.sourceBoundsPx,
    editBoundsPx: null,
    authorityBoundsPx: authority.authorityBoundsPx,
    placementBoundsPx: null,
    candidates,
    summary: { variantCount: candidates.length, exactAlphaAcrossCandidates: candidates.every((candidate) => candidate.qa.geometryLocked) },
    geometryLocked: false,
    productionEligible: false,
    namedGeometryReviewRequired: true,
    excludedVariant: { variantKey: "MCPR", reason: "No equivalent layered 5 mL matte-copper overcap source is present." },
    mutationPolicy: { remoteWritesPerformed: false, currentReleaseChanged: false, sanityChanged: false },
  };
  const manifestPath = path.join(input.outputRoot, "manifest.json");
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return { manifest, manifestPath, contactSheetPath };
}

const actualVariants: OvercapVariantRecipe[] = [
  { sourceId: "assembly-clear5-black-matte", variantKey: "MBLK", finish: "matte-black", alphaCleanup: { expectedSourceComponents: 1, maxDiscardedComponentPixels: 0, maxDiscardedTotalPixels: 0 } },
  { sourceId: "assembly-clear5-black-shiny", variantKey: "SBLK", finish: "glossy-black", alphaCleanup: { expectedSourceComponents: 8, maxDiscardedComponentPixels: 8, maxDiscardedTotalPixels: 34 } },
  { sourceId: "assembly-clear5-blue-matte", variantKey: "MBLU", finish: "matte-blue", alphaCleanup: { expectedSourceComponents: 3, maxDiscardedComponentPixels: 4, maxDiscardedTotalPixels: 8 } },
  { sourceId: "assembly-clear5-gold-shiny", variantKey: "SGLD", finish: "mirror-gold", alphaCleanup: { expectedSourceComponents: 11, maxDiscardedComponentPixels: 6, maxDiscardedTotalPixels: 36 } },
  { sourceId: "assembly-clear5-gold-matte", variantKey: "MGLD", finish: "matte-gold", alphaCleanup: { expectedSourceComponents: 1, maxDiscardedComponentPixels: 0, maxDiscardedTotalPixels: 0 } },
  { sourceId: "assembly-clear5-silver-matte", variantKey: "MSLV", finish: "matte-silver", alphaCleanup: { expectedSourceComponents: 2, maxDiscardedComponentPixels: 1, maxDiscardedTotalPixels: 1 } },
  { sourceId: "assembly-clear5-silver-shiny", variantKey: "SSLV", finish: "mirror-silver", alphaCleanup: { expectedSourceComponents: 10, maxDiscardedComponentPixels: 5, maxDiscardedTotalPixels: 31 } },
];

async function main() {
  const result = await buildSprayer13OvercapReview({ extractionManifestPath: defaultExtractionManifestPath, outputRoot: defaultOutputRoot, canvas: { width: 2080, height: 2288 }, authoritySourceId: "assembly-clear5-black-matte", variants: actualVariants });
  process.stdout.write(`${JSON.stringify({ manifestPath: path.relative(workspaceRoot, result.manifestPath), contactSheetPath: path.relative(workspaceRoot, result.contactSheetPath), summary: result.manifest.summary, geometryLocked: false, productionEligible: false }, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 1; });
