import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import sharp from "sharp";

import {
  parseComponentKitDecomposition,
  type ComponentKitDecomposition,
} from "../../src/lib/paperDoll/componentKitDecomposition";

const DEFAULT_ARCHIVE_ROOT = "/Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Original-Photoshop-Sources";
const DEFAULT_RECIPE_PATH = "docs/paper-doll-rig/sprayer-15-415-component-kit-decomposition.json";
const DEFAULT_OUTPUT_ROOT = "outputs/paper-doll-component-kit-reviews/15-415-sprayer/source-extraction-v1";

export interface ScenePageBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface ComponentKitReviewExtractionJob {
  kitId: string;
  partId: string;
  responsibility: ComponentKitDecomposition["parts"][number]["responsibility"];
  outputPolicy: ComponentKitDecomposition["parts"][number]["outputPolicy"];
  reviewFraming: ComponentKitDecomposition["parts"][number]["reviewFraming"];
  productionAnchor: ComponentKitDecomposition["parts"][number]["productionAnchor"];
  sourceId: string;
  sourcePath: string;
  sourceSha256: string;
  originalFilename: string;
  sceneIndex: number;
  layerName: string;
  cutoutPath: string;
  reviewCanvasPath: string;
  productionEligible: false;
  geometryLocked: false;
}

export interface CenteredCutout {
  cutoutPng: Buffer;
  canvasPng: Buffer;
  sourceNonTransparentBounds: ScenePageBounds;
  reviewPlacementBounds: ScenePageBounds;
  scale: 1;
}

export interface ExtractedComponentKitReviewAsset extends ComponentKitReviewExtractionJob {
  sourcePageBounds: ScenePageBounds;
  sourceNonTransparentBounds: ScenePageBounds;
  reviewPlacementBounds: ScenePageBounds;
  cutoutSha256: string;
  reviewCanvasSha256: string;
}

export interface ExtractComponentKitReviewInput {
  recipe: unknown;
  archiveRoot: string;
  outputRoot: string;
  decodePsdScene?: (sourcePath: string, sceneIndex: number) => Promise<Buffer>;
  identifyPsdScene?: (sourcePath: string, sceneIndex: number) => Promise<ScenePageBounds>;
  generatedAt?: string;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function hashBuffer(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

function safeToken(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function resolveInside(root: string, relativePath: string): string {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, relativePath);
  if (resolved !== resolvedRoot && !resolved.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error(`Component-kit source escapes the archive root: ${relativePath}`);
  }
  return resolved;
}

export function planComponentKitReviewExtraction(
  value: unknown,
  archiveRoot: string,
  outputRoot: string,
): ComponentKitReviewExtractionJob[] {
  const recipe = parseComponentKitDecomposition(value);
  const sourceById = new Map(recipe.sources.map((source) => [source.sourceId, source]));
  const jobs: ComponentKitReviewExtractionJob[] = [];
  for (const part of recipe.parts) {
    for (const selector of part.sourceSelectors) {
      if (selector.method !== "psd-layer-scene") continue;
      const source = sourceById.get(selector.sourceId);
      if (
        !source
        || source.sourceType !== "photoshop-layered-source"
        || !source.archiveRelativePath
        || !source.sha256
      ) {
        throw new Error(`PSD selector ${selector.sourceId} has no verified Photoshop source.`);
      }
      const stem = `${safeToken(source.sourceId)}__scene-${selector.sceneIndex}`;
      const partRoot = path.resolve(outputRoot, safeToken(part.partId));
      jobs.push({
        kitId: recipe.kitId,
        partId: part.partId,
        responsibility: part.responsibility,
        outputPolicy: part.outputPolicy,
        reviewFraming: part.reviewFraming,
        productionAnchor: part.productionAnchor,
        sourceId: source.sourceId,
        sourcePath: resolveInside(archiveRoot, source.archiveRelativePath),
        sourceSha256: source.sha256,
        originalFilename: source.originalFilename,
        sceneIndex: selector.sceneIndex,
        layerName: selector.layerName,
        cutoutPath: path.join(partRoot, `${stem}__cutout.png`),
        reviewCanvasPath: path.join(partRoot, `${stem}__review-canvas.png`),
        productionEligible: false,
        geometryLocked: false,
      });
    }
  }
  return jobs;
}

export async function centerCutoutOnCanonicalCanvas(
  png: Buffer,
  canvasWidth: number,
  canvasHeight: number,
): Promise<CenteredCutout> {
  const decoded = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = decoded.info;
  let left = width;
  let right = -1;
  let top = height;
  let bottom = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = decoded.data[(y * width + x) * channels + 3];
      if (alpha === 0) continue;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  }
  if (right < left || bottom < top) {
    throw new Error("Photoshop scene contains no non-transparent pixels.");
  }
  const sourceNonTransparentBounds = {
    left,
    top,
    width: right - left + 1,
    height: bottom - top + 1,
  };
  if (
    sourceNonTransparentBounds.width > canvasWidth
    || sourceNonTransparentBounds.height > canvasHeight
  ) {
    throw new Error("Photoshop scene exceeds the canonical review canvas; implicit scaling is forbidden.");
  }
  const cutoutPng = await sharp(png)
    .extract(sourceNonTransparentBounds)
    .png()
    .toBuffer();
  const reviewPlacementBounds = {
    left: Math.floor((canvasWidth - sourceNonTransparentBounds.width) / 2),
    top: Math.floor((canvasHeight - sourceNonTransparentBounds.height) / 2),
    width: sourceNonTransparentBounds.width,
    height: sourceNonTransparentBounds.height,
  };
  const canvasPng = await sharp({
    create: {
      width: canvasWidth,
      height: canvasHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  }).composite([{
    input: cutoutPng,
    left: reviewPlacementBounds.left,
    top: reviewPlacementBounds.top,
  }]).png().toBuffer();
  return {
    cutoutPng,
    canvasPng,
    sourceNonTransparentBounds,
    reviewPlacementBounds,
    scale: 1,
  };
}

async function runMagick(args: readonly string[]): Promise<Buffer> {
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

const defaultDecodePsdScene = async (sourcePath: string, sceneIndex: number): Promise<Buffer> => (
  runMagick(["-background", "none", `${sourcePath}[${sceneIndex}]`, "png:-"])
);

const defaultIdentifyPsdScene = async (
  sourcePath: string,
  sceneIndex: number,
): Promise<ScenePageBounds> => {
  const output = await runMagick([
    "identify",
    "-format",
    "%w %h %X %Y",
    `${sourcePath}[${sceneIndex}]`,
  ]);
  const match = output.toString("utf8").trim().match(/^(\d+) (\d+) ([+-]\d+) ([+-]\d+)$/);
  if (!match) {
    throw new Error(`Unable to parse Photoshop scene bounds: ${output.toString("utf8")}`);
  }
  return {
    width: Number(match[1]),
    height: Number(match[2]),
    left: Number(match[3]),
    top: Number(match[4]),
  };
};

async function renderResponsibilityContactSheet(
  assets: ExtractedComponentKitReviewAsset[],
  outputPath: string,
): Promise<void> {
  const tileWidth = 460;
  const tileHeight = 600;
  const columns = Math.min(5, assets.length);
  const rows = Math.ceil(assets.length / columns);
  const composites: sharp.OverlayOptions[] = [];
  for (let index = 0; index < assets.length; index += 1) {
    const asset = assets[index];
    const column = index % columns;
    const row = Math.floor(index / columns);
    const tileLeft = column * tileWidth;
    const tileTop = row * tileHeight;
    const image = await sharp(asset.cutoutPath)
      .resize({
        width: 380,
        height: 430,
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();
    composites.push({ input: image, left: tileLeft + 40, top: tileTop + 24 });
    const label = Buffer.from(`
      <svg width="${tileWidth}" height="146" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#171714"/>
        <text x="24" y="35" fill="#d5b16a" font-family="Arial, sans-serif" font-size="18" font-weight="700">${escapeXml(asset.sourceId)}</text>
        <text x="24" y="65" fill="#f2efe9" font-family="Arial, sans-serif" font-size="15">${escapeXml(asset.originalFilename)}</text>
        <text x="24" y="91" fill="#aaa59b" font-family="Arial, sans-serif" font-size="14">scene ${asset.sceneIndex} · ${escapeXml(asset.layerName)}</text>
        <text x="24" y="119" fill="#79d8ce" font-family="Arial, sans-serif" font-size="13">SOURCE EXTRACTION · REVIEW ONLY</text>
      </svg>
    `);
    composites.push({ input: label, left: tileLeft, top: tileTop + 454 });
  }
  for (let column = 1; column < columns; column += 1) {
    composites.push({
      input: Buffer.from(`<svg width="2" height="${rows * tileHeight}" xmlns="http://www.w3.org/2000/svg"><rect width="2" height="100%" fill="#b89a5a"/></svg>`),
      left: column * tileWidth - 1,
      top: 0,
    });
  }
  await mkdir(path.dirname(outputPath), { recursive: true });
  await sharp({
    create: {
      width: columns * tileWidth,
      height: rows * tileHeight,
      channels: 4,
      background: { r: 245, g: 242, b: 236, alpha: 1 },
    },
  }).composite(composites).png().toFile(outputPath);
}

export async function extractComponentKitReview(
  input: ExtractComponentKitReviewInput,
): Promise<{
  manifestPath: string;
  assets: ExtractedComponentKitReviewAsset[];
  contactSheetPaths: string[];
}> {
  const recipe = parseComponentKitDecomposition(input.recipe);
  const jobs = planComponentKitReviewExtraction(recipe, input.archiveRoot, input.outputRoot);
  const decodePsdScene = input.decodePsdScene ?? defaultDecodePsdScene;
  const identifyPsdScene = input.identifyPsdScene ?? defaultIdentifyPsdScene;
  const sourceHashes = new Map<string, string>();
  for (const job of jobs) {
    if (sourceHashes.has(job.sourcePath)) continue;
    const actual = hashBuffer(await readFile(job.sourcePath));
    if (actual !== job.sourceSha256) {
      throw new Error(
        `Photoshop source SHA-256 mismatch for ${job.originalFilename}: expected ${job.sourceSha256}, received ${actual}.`,
      );
    }
    sourceHashes.set(job.sourcePath, actual);
  }

  const assets: ExtractedComponentKitReviewAsset[] = [];
  for (const job of jobs) {
    const [scenePng, sourcePageBounds] = await Promise.all([
      decodePsdScene(job.sourcePath, job.sceneIndex),
      identifyPsdScene(job.sourcePath, job.sceneIndex),
    ]);
    const centered = await centerCutoutOnCanonicalCanvas(
      scenePng,
      recipe.canonicalCanvas.width,
      recipe.canonicalCanvas.height,
    );
    await mkdir(path.dirname(job.cutoutPath), { recursive: true });
    await Promise.all([
      writeFile(job.cutoutPath, centered.cutoutPng),
      writeFile(job.reviewCanvasPath, centered.canvasPng),
    ]);
    assets.push({
      ...job,
      sourcePageBounds,
      sourceNonTransparentBounds: centered.sourceNonTransparentBounds,
      reviewPlacementBounds: centered.reviewPlacementBounds,
      cutoutSha256: hashBuffer(centered.cutoutPng),
      reviewCanvasSha256: hashBuffer(centered.canvasPng),
    });
  }

  const contactSheetPaths: string[] = [];
  for (const part of recipe.parts) {
    const partAssets = assets.filter((asset) => asset.partId === part.partId);
    if (partAssets.length === 0) continue;
    const contactSheetPath = path.resolve(
      input.outputRoot,
      safeToken(part.partId),
      "contact-sheet.png",
    );
    await renderResponsibilityContactSheet(partAssets, contactSheetPath);
    contactSheetPaths.push(contactSheetPath);
  }

  const manifestPath = path.resolve(input.outputRoot, "manifest.json");
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, `${JSON.stringify({
    schemaVersion: 1,
    kitId: recipe.kitId,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    status: "source-extraction-review-only",
    canonicalCanvas: recipe.canonicalCanvas,
    sourceCompositeProductionEligible: false,
    productionEligible: false,
    geometryLocked: false,
    currentReleaseChanged: false,
    sanityChanged: false,
    contactSheetPaths,
    assets,
  }, null, 2)}\n`);
  return { manifestPath, assets, contactSheetPaths };
}

function readArg(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1] ?? null;
}

async function main(): Promise<void> {
  const recipePath = path.resolve(readArg("--recipe") ?? DEFAULT_RECIPE_PATH);
  const archiveRoot = path.resolve(readArg("--archive-root") ?? DEFAULT_ARCHIVE_ROOT);
  const outputRoot = path.resolve(readArg("--output-root") ?? DEFAULT_OUTPUT_ROOT);
  const recipe = JSON.parse(await readFile(recipePath, "utf8"));
  const result = await extractComponentKitReview({ recipe, archiveRoot, outputRoot });
  process.stdout.write(`${JSON.stringify({
    manifestPath: result.manifestPath,
    assetCount: result.assets.length,
    contactSheetPaths: result.contactSheetPaths,
    outputRoot,
    productionEligible: false,
    geometryLocked: false,
  }, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
