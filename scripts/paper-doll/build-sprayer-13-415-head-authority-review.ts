import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import sharp from "sharp";

import { compareExactAlphaBytes } from "../../supabase/functions/_shared/paperDollExactAlpha";
import { inspectAuthorityMask } from "../../src/lib/paperDoll/componentPlateImage.node";
import type { PixelBounds } from "../../src/lib/paperDoll/componentPlateContract";
import {
  cleanCalibratedDetachedAlphaIslands,
  normalizeSourceMaterialToAuthority,
  type DetachedAlphaIslandCalibration,
} from "./build-sprayer-15-415-authority-review";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DEFAULT_ARCHIVE_ROOT = "/Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Original-Photoshop-Sources";
const DEFAULT_RECIPE_PATH = path.join(
  workspaceRoot,
  "docs/paper-doll-rig/sprayer-13-415-head-authority-review.json",
);
const DEFAULT_OUTPUT_ROOT = path.join(
  workspaceRoot,
  "outputs/paper-doll-component-authority-reviews/sprayer-13-415/head-authority-v1",
);

interface ApprovedSourceRecipe {
  repositoryRelativePath: string;
  originalFilename: string;
  sha256: string;
  reviewedBy: string;
  reviewedAt: string;
  approvalScope: string;
  alphaCleanup: DetachedAlphaIslandCalibration;
}

interface SceneSourceRecipe {
  variantKey: string;
  finish: string;
  originalFilename: string;
  archiveRelativePath: string;
  sha256: string;
  sceneIndex: number;
  layerName: string;
  alphaCleanup: DetachedAlphaIslandCalibration;
}

export interface Sprayer13HeadAuthorityRecipe {
  schemaVersion: 1;
  reviewId: string;
  kitId: string;
  canonicalCanvas: { width: number; height: number };
  approvedSource: ApprovedSourceRecipe;
  sceneSources: SceneSourceRecipe[];
  authorityReviewState: "named-geometry-review-required";
  productionEligible: false;
  geometryLocked: false;
}

interface DecodePsdScene {
  (sourcePath: string, sceneIndex: number): Promise<Buffer>;
}

export interface BuildSprayer13HeadAuthorityReviewInput {
  recipe: Sprayer13HeadAuthorityRecipe;
  repositoryRoot?: string;
  archiveRoot?: string;
  outputRoot?: string;
  generatedAt?: string;
  decodePsdScene?: DecodePsdScene;
}

function sha256(value: Buffer | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function resolveInside(root: string, relativePath: string): string {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, relativePath);
  if (resolved !== resolvedRoot && !resolved.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error(`Sprayer source escapes the declared root: ${relativePath}`);
  }
  return resolved;
}

function safeToken(value: string): string {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function alphaBounds(png: Buffer): Promise<PixelBounds> {
  const decoded = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let left = decoded.info.width;
  let top = decoded.info.height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < decoded.info.height; y += 1) {
    for (let x = 0; x < decoded.info.width; x += 1) {
      if (decoded.data[(y * decoded.info.width + x) * decoded.info.channels + 3] === 0) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  if (right < left || bottom < top) throw new Error("Sprayer source has no non-transparent pixels.");
  return { left, top, width: right - left + 1, height: bottom - top + 1 };
}

async function alphaBytes(png: Buffer): Promise<Buffer> {
  return sharp(png).ensureAlpha().extractChannel("alpha").raw().toBuffer();
}

function runMagick(args: readonly string[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn("magick", [...args], { stdio: ["ignore", "pipe", "pipe"] });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`ImageMagick failed (${code ?? "signal"}): ${Buffer.concat(stderr).toString("utf8").trim()}`));
        return;
      }
      resolve(Buffer.concat(stdout));
    });
  });
}

const defaultDecodePsdScene: DecodePsdScene = (sourcePath, sceneIndex) => (
  runMagick([`${sourcePath}[${sceneIndex}]`, "png:-"])
);

async function buildCenteredAuthorityMask(input: {
  sourcePng: Buffer;
  canvas: { width: number; height: number };
  cleanup: DetachedAlphaIslandCalibration;
}) {
  const cleaned = await cleanCalibratedDetachedAlphaIslands({
    sourcePng: input.sourcePng,
    calibration: input.cleanup,
  });
  const sourceBoundsPx = await alphaBounds(cleaned.png);
  const sourceCrop = await sharp(cleaned.png).extract(sourceBoundsPx).png().toBuffer();
  if (sourceBoundsPx.width > input.canvas.width || sourceBoundsPx.height > input.canvas.height) {
    throw new Error("Approved sprayer source exceeds the canonical canvas; implicit authority scaling is forbidden.");
  }
  const authorityBoundsPx = {
    left: Math.floor((input.canvas.width - sourceBoundsPx.width) / 2),
    top: Math.floor((input.canvas.height - sourceBoundsPx.height) / 2),
    width: sourceBoundsPx.width,
    height: sourceBoundsPx.height,
  };
  const alpha = await sharp(sourceCrop).extractChannel("alpha").png().toBuffer();
  const whiteWithAlpha = await sharp({
    create: {
      width: sourceBoundsPx.width,
      height: sourceBoundsPx.height,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  }).joinChannel(alpha).png().toBuffer();
  const maskPng = await sharp({
    create: {
      width: input.canvas.width,
      height: input.canvas.height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  }).composite([{ input: whiteWithAlpha, left: authorityBoundsPx.left, top: authorityBoundsPx.top }])
    .png()
    .toBuffer();
  const inspection = await inspectAuthorityMask(maskPng, { expectedRegions: 1 });
  return {
    maskPng,
    sourceBoundsPx,
    authorityBoundsPx: inspection.authorityBoundsPx,
    cleanupReport: cleaned.report,
  };
}

async function renderContactSheet(input: {
  candidates: Array<{ variantKey: string; finish: string; path: string }>;
  outputPath: string;
}): Promise<void> {
  const tileWidth = 450;
  const tileHeight = 610;
  const columns = 4;
  const rows = Math.ceil(input.candidates.length / columns);
  const composites: sharp.OverlayOptions[] = [];
  for (let index = 0; index < input.candidates.length; index += 1) {
    const candidate = input.candidates[index];
    const left = (index % columns) * tileWidth;
    const top = Math.floor(index / columns) * tileHeight;
    const image = await sharp(candidate.path)
      .resize({ width: 390, height: 480, fit: "contain", background: { r: 245, g: 242, b: 236, alpha: 1 } })
      .png()
      .toBuffer();
    const label = Buffer.from(`<svg width="${tileWidth}" height="110" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#171714"/>
      <text x="22" y="34" fill="#e4bc68" font-family="Arial, sans-serif" font-size="21" font-weight="700">${escapeXml(candidate.variantKey)}</text>
      <text x="22" y="63" fill="#f2efe9" font-family="Arial, sans-serif" font-size="16">${escapeXml(candidate.finish)}</text>
      <text x="22" y="91" fill="#79d8ce" font-family="Arial, sans-serif" font-size="13">EXACT SHARED ALPHA · REVIEW ONLY</text>
    </svg>`);
    composites.push({ input: image, left: left + 30, top: top + 15 });
    composites.push({ input: label, left, top: top + 500 });
  }
  await mkdir(path.dirname(input.outputPath), { recursive: true });
  await sharp({
    create: {
      width: columns * tileWidth,
      height: rows * tileHeight,
      channels: 4,
      background: { r: 245, g: 242, b: 236, alpha: 1 },
    },
  }).composite(composites).png().toFile(input.outputPath);
}

function validateRecipe(recipe: Sprayer13HeadAuthorityRecipe): void {
  if (recipe.schemaVersion !== 1) throw new Error("Unsupported 13-415 sprayer authority review schema.");
  if (recipe.productionEligible !== false || recipe.geometryLocked !== false) {
    throw new Error("The 13-415 sprayer source review cannot begin as production eligible or geometry locked.");
  }
  if (recipe.canonicalCanvas.width < 1 || recipe.canonicalCanvas.height < 1) {
    throw new Error("A positive canonical canvas is required.");
  }
  const variants = recipe.sceneSources.map((source) => source.variantKey);
  if (variants.length < 1 || new Set(variants).size !== variants.length) {
    throw new Error("Sprayer scene sources require unique variant keys.");
  }
  for (const source of [recipe.approvedSource, ...recipe.sceneSources]) {
    if (!/^[a-f0-9]{64}$/.test(source.sha256)) throw new Error(`Invalid source SHA-256 for ${source.originalFilename}.`);
    if (/[\\/]/.test(source.originalFilename)) throw new Error("Original filenames cannot contain path separators.");
  }
}

export async function buildSprayer13HeadAuthorityReview(
  input: BuildSprayer13HeadAuthorityReviewInput,
) {
  validateRecipe(input.recipe);
  const repositoryRoot = path.resolve(input.repositoryRoot ?? workspaceRoot);
  const archiveRoot = path.resolve(input.archiveRoot ?? DEFAULT_ARCHIVE_ROOT);
  const outputRoot = path.resolve(input.outputRoot ?? DEFAULT_OUTPUT_ROOT);
  const decodePsdScene = input.decodePsdScene ?? defaultDecodePsdScene;
  await mkdir(outputRoot, { recursive: true });

  const approvedPath = resolveInside(repositoryRoot, input.recipe.approvedSource.repositoryRelativePath);
  const approvedBytes = await readFile(approvedPath);
  const approvedSha = sha256(approvedBytes);
  if (approvedSha !== input.recipe.approvedSource.sha256) {
    throw new Error(
      `Approved sprayer source SHA-256 mismatch: expected ${input.recipe.approvedSource.sha256}, received ${approvedSha}.`,
    );
  }
  const authority = await buildCenteredAuthorityMask({
    sourcePng: approvedBytes,
    canvas: input.recipe.canonicalCanvas,
    cleanup: input.recipe.approvedSource.alphaCleanup,
  });
  const authorityMaskPath = path.join(outputRoot, "authority-mask-review-candidate.png");
  await writeFile(authorityMaskPath, authority.maskPng);
  const authorityAlpha = await alphaBytes(authority.maskPng);

  const candidates = [];
  for (const source of input.recipe.sceneSources) {
    const sourcePath = resolveInside(archiveRoot, source.archiveRelativePath);
    const sourceFile = await readFile(sourcePath);
    const sourceSha = sha256(sourceFile);
    if (sourceSha !== source.sha256) {
      throw new Error(
        `Sprayer Photoshop SHA-256 mismatch for ${source.originalFilename}: expected ${source.sha256}, received ${sourceSha}.`,
      );
    }
    const scenePng = await decodePsdScene(sourcePath, source.sceneIndex);
    const sceneMetadata = await sharp(scenePng).metadata();
    const sceneBoundsBeforeCleanup = await alphaBounds(scenePng);
    const cleaned = await cleanCalibratedDetachedAlphaIslands({
      sourcePng: scenePng,
      calibration: source.alphaCleanup,
    });
    const normalized = await normalizeSourceMaterialToAuthority({
      sourcePng: cleaned.png,
      authorityMaskPng: authority.maskPng,
    });
    const exactAlphaComparison = compareExactAlphaBytes(
      await alphaBytes(normalized.png),
      authorityAlpha,
    );
    if (!exactAlphaComparison.geometryLocked) {
      throw new Error(`Exact alpha clamp failed for ${source.variantKey}.`);
    }
    const candidatePath = path.join(outputRoot, `sprayer-head__13-415__${safeToken(source.finish)}__candidate-v1.png`);
    await writeFile(candidatePath, normalized.png);
    candidates.push({
      variantKey: source.variantKey,
      finish: source.finish,
      path: candidatePath,
      pathRelativeToWorkspace: path.relative(workspaceRoot, candidatePath),
      sha256: sha256(normalized.png),
      originalFilename: source.originalFilename,
      sourceSha256: sourceSha,
      sourceScene: {
        sceneIndex: source.sceneIndex,
        layerName: source.layerName,
        width: sceneMetadata.width ?? null,
        height: sceneMetadata.height ?? null,
      },
      sourceAlphaCleanupReport: cleaned.report,
      boxes: {
        sourceBoundsPx: sceneBoundsBeforeCleanup,
        editBoundsPx: normalized.sourceBoundsPx,
        authorityBoundsPx: normalized.authorityBoundsPx,
        placementBoundsPx: null,
      },
      qa: {
        exactAlpha: exactAlphaComparison.geometryLocked,
        changedAlphaBytes: exactAlphaComparison.mismatchedPixels,
        binaryIou: exactAlphaComparison.minIoU,
      },
      lifecycleState: "candidate-review-required",
      productionEligible: false,
      geometryLocked: false,
    });
  }

  const contactSheetPath = path.join(outputRoot, "contact-sheet.png");
  await renderContactSheet({ candidates, outputPath: contactSheetPath });
  const manifest = {
    schemaVersion: 1,
    reviewId: input.recipe.reviewId,
    kitId: input.recipe.kitId,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    lifecycleState: "authority-review-required",
    canonicalCanvas: input.recipe.canonicalCanvas,
    approvedSourceEvidence: {
      ...input.recipe.approvedSource,
      actualSha256: approvedSha,
      sourceBoundsPx: authority.sourceBoundsPx,
      centeredAuthorityBoundsPx: authority.authorityBoundsPx,
      alphaCleanupReport: authority.cleanupReport,
      interpretation: "Previously approved source appearance and silhouette evidence; not yet a named geometry authority.",
    },
    authorityMaskReviewCandidate: {
      path: path.relative(workspaceRoot, authorityMaskPath),
      sha256: sha256(authority.maskPng),
      authorityBoundsPx: authority.authorityBoundsPx,
      exactRegionCount: 1,
    },
    summary: {
      variantCount: candidates.length,
      exactAlphaAcrossVariants: candidates.every((candidate) => candidate.qa.exactAlpha),
      namedGeometryReviewRequired: true,
      familyFitRequired: true,
    },
    candidates,
    excludedResponsibilities: ["opaque-protective-overcap", "sprayer-dip-tube"],
    exclusionsReason: "The reusable exterior head, independently reusable opaque cap, and body-contextual dip tube are separate physical responsibilities.",
    geometryLocked: false,
    productionEligible: false,
    mutationPolicy: {
      approvalsWritten: false,
      placementLockWritten: false,
      remoteWritesPerformed: false,
      currentReleaseChanged: false,
      sanityChanged: false,
    },
  };
  const manifestPath = path.join(outputRoot, "review-manifest.json");
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return { manifestPath, contactSheetPath, authorityMaskPath, manifest };
}

async function main(): Promise<void> {
  const recipePath = path.resolve(process.argv[2] ?? DEFAULT_RECIPE_PATH);
  const recipe = JSON.parse(await readFile(recipePath, "utf8")) as Sprayer13HeadAuthorityRecipe;
  const result = await buildSprayer13HeadAuthorityReview({ recipe });
  process.stdout.write(`${JSON.stringify({
    reviewId: result.manifest.reviewId,
    lifecycleState: result.manifest.lifecycleState,
    summary: result.manifest.summary,
    excludedResponsibilities: result.manifest.excludedResponsibilities,
    contactSheetPath: result.contactSheetPath,
    manifestPath: result.manifestPath,
    geometryLocked: result.manifest.geometryLocked,
    productionEligible: result.manifest.productionEligible,
    mutationPolicy: result.manifest.mutationPolicy,
  }, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
