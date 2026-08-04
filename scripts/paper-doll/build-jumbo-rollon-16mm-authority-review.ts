import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import sharp from "sharp";

import { compareExactAlphaBytes } from "../../supabase/functions/_shared/paperDollExactAlpha";
import {
  clampToAuthorityMask,
  inspectAuthorityMask,
} from "../../src/lib/paperDoll/componentPlateImage.node";
import type { PixelBounds } from "../../src/lib/paperDoll/componentPlateContract";
import {
  binarySilhouetteIou,
  normalizeReferenceSilhouette,
} from "../../src/lib/paperDoll/referenceSilhouetteAnalysis";
import {
  cleanCalibratedDetachedAlphaIslands,
  type DetachedAlphaIslandCalibration,
} from "./build-sprayer-15-415-authority-review";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DEFAULT_ARCHIVE_ROOT = "/Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Original-Photoshop-Sources";
const DEFAULT_RECIPE_PATH = path.join(workspaceRoot, "docs/paper-doll-rig/jumbo-rollon-16mm-authority-review.json");
const DEFAULT_OUTPUT_ROOT = path.join(workspaceRoot, "outputs/paper-doll-component-authority-reviews/jumbo-rollon-16mm/authority-review-v1");

interface LayerSource {
  originalFilename: string;
  archiveRelativePath: string;
  sha256: string;
}

interface PlasticAuthoritySource extends LayerSource {
  bodySceneIndex: number;
  fitmentSceneIndex: number;
  alphaCleanup: DetachedAlphaIslandCalibration;
}

interface PlasticComparisonSource extends LayerSource {
  fitmentSceneIndex: number;
  alphaCleanup: DetachedAlphaIslandCalibration;
}

interface MetalMaterialSource extends LayerSource {
  compositeSceneIndex: number;
  ballTransferRows: number;
}

interface JumboAuthorityGroup {
  groupKey: string;
  capacityMl: number;
  bodyHeightMm: number;
  bodyDiameterMm: number;
  assembledHeightMm: number;
  neckSizeMm: number;
  plasticAuthoritySource: PlasticAuthoritySource;
  plasticComparisonSource: PlasticComparisonSource;
  metalMaterialSource: MetalMaterialSource;
}

export interface JumboRollonAuthorityRecipe {
  schemaVersion: 1;
  reviewId: string;
  kitId: string;
  canonicalCanvas: { width: number; height: number };
  sourceDocumentCanvas: { width: number; height: number };
  authorityReviewState: "named-geometry-review-required";
  productionEligible: false;
  geometryLocked: false;
  groups: JumboAuthorityGroup[];
}

interface ScenePageBounds extends PixelBounds {}

interface BuildInput {
  recipe: JumboRollonAuthorityRecipe;
  archiveRoot?: string;
  outputRoot?: string;
  generatedAt?: string;
  decodePsdScene?: (sourcePath: string, sceneIndex: number) => Promise<Buffer>;
  identifyPsdScene?: (sourcePath: string, sceneIndex: number) => Promise<ScenePageBounds>;
}

function sha256(value: Buffer | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function safeToken(value: string): string {
  return value.normalize("NFKD").toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
}

function escapeXml(value: string): string {
  return value.replace(/[<>&'\"]/g, (character) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", "\"": "&quot;" })[character] ?? character);
}

function resolveInside(root: string, relativePath: string): string {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, relativePath);
  if (resolved !== resolvedRoot && !resolved.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error(`Jumbo roll-on source escapes the declared archive root: ${relativePath}`);
  }
  return resolved;
}

function validateRecipe(recipe: JumboRollonAuthorityRecipe): void {
  if (recipe.schemaVersion !== 1) throw new Error("Unsupported jumbo roll-on authority review schema.");
  if (recipe.productionEligible !== false || recipe.geometryLocked !== false) {
    throw new Error("Jumbo roll-on review must begin non-production and unlocked.");
  }
  if (recipe.groups.length !== 2 || new Set(recipe.groups.map((group) => group.groupKey)).size !== recipe.groups.length) {
    throw new Error("The jumbo authority review requires unique 28 mL and 50 mL groups.");
  }
  for (const group of recipe.groups) {
    if (group.neckSizeMm !== 16 || group.capacityMl <= 0 || group.bodyHeightMm <= 0 || group.bodyDiameterMm <= 0) {
      throw new Error(`${group.groupKey} has an invalid physical contract.`);
    }
    for (const source of [group.plasticAuthoritySource, group.plasticComparisonSource, group.metalMaterialSource]) {
      if (!/^[a-f0-9]{64}$/.test(source.sha256)) throw new Error(`${source.originalFilename} has an invalid SHA-256.`);
      if (/[\\/]/.test(source.originalFilename)) throw new Error("Original filenames cannot contain path separators.");
    }
    if (!Number.isInteger(group.metalMaterialSource.ballTransferRows) || group.metalMaterialSource.ballTransferRows < 1) {
      throw new Error(`${group.groupKey} requires a calibrated positive metal ball transfer height.`);
    }
    for (const cleanup of [group.plasticAuthoritySource.alphaCleanup, group.plasticComparisonSource.alphaCleanup]) {
      if (!Number.isInteger(cleanup.expectedSourceComponents) || cleanup.expectedSourceComponents < 1
        || !Number.isInteger(cleanup.maxDiscardedComponentPixels) || cleanup.maxDiscardedComponentPixels < 0
        || !Number.isInteger(cleanup.maxDiscardedTotalPixels) || cleanup.maxDiscardedTotalPixels < 0) {
        throw new Error(`${group.groupKey} has an invalid source-calibrated alpha cleanup contract.`);
      }
    }
  }
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

const defaultDecodePsdScene = (sourcePath: string, sceneIndex: number) => (
  runMagick(["-background", "none", `${sourcePath}[${sceneIndex}]`, "png:-"])
);

const defaultIdentifyPsdScene = async (sourcePath: string, sceneIndex: number): Promise<ScenePageBounds> => {
  const output = await runMagick(["identify", "-format", "%w %h %X %Y", `${sourcePath}[${sceneIndex}]`]);
  const match = output.toString("utf8").trim().match(/^(\d+) (\d+) ([+-]\d+) ([+-]\d+)$/);
  if (!match) throw new Error(`Unable to parse Photoshop scene bounds: ${output.toString("utf8")}`);
  return { width: Number(match[1]), height: Number(match[2]), left: Number(match[3]), top: Number(match[4]) };
};

async function alphaBounds(png: Buffer): Promise<PixelBounds> {
  const decoded = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let left = decoded.info.width;
  let top = decoded.info.height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < decoded.info.height; y += 1) for (let x = 0; x < decoded.info.width; x += 1) {
    if (decoded.data[(y * decoded.info.width + x) * decoded.info.channels + 3] === 0) continue;
    left = Math.min(left, x);
    top = Math.min(top, y);
    right = Math.max(right, x);
    bottom = Math.max(bottom, y);
  }
  if (right < left || bottom < top) throw new Error("Source scene has no non-transparent pixels.");
  return { left, top, width: right - left + 1, height: bottom - top + 1 };
}

async function alphaBytes(png: Buffer): Promise<Buffer> {
  return sharp(png).ensureAlpha().extractChannel("alpha").raw().toBuffer();
}

async function placeSceneOnDocument(png: Buffer, bounds: ScenePageBounds, canvas: { width: number; height: number }): Promise<Buffer> {
  const metadata = await sharp(png).metadata();
  if (metadata.width !== bounds.width || metadata.height !== bounds.height) {
    throw new Error("Decoded Photoshop scene dimensions differ from identified page bounds.");
  }
  if (bounds.left < 0 || bounds.top < 0 || bounds.left + bounds.width > canvas.width || bounds.top + bounds.height > canvas.height) {
    throw new Error("Photoshop scene escapes its declared document canvas.");
  }
  return sharp({ create: { width: canvas.width, height: canvas.height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: png, left: bounds.left, top: bounds.top }]).png().toBuffer();
}

async function centerCropOnCanonicalCanvas(crop: Buffer, canvas: { width: number; height: number }): Promise<{ png: Buffer; bounds: PixelBounds }> {
  const metadata = await sharp(crop).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (width < 1 || height < 1 || width > canvas.width || height > canvas.height) throw new Error("Authority crop does not fit canonical canvas.");
  const bounds = { left: Math.floor((canvas.width - width) / 2), top: Math.floor((canvas.height - height) / 2), width, height };
  const png = await sharp({ create: { width: canvas.width, height: canvas.height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: crop, left: bounds.left, top: bounds.top }]).png().toBuffer();
  return { png, bounds };
}

async function buildAuthorityMask(materialCanvas: Buffer, canvas: { width: number; height: number }): Promise<Buffer> {
  const alpha = await sharp(materialCanvas).extractChannel("alpha").png().toBuffer();
  return sharp({ create: { width: canvas.width, height: canvas.height, channels: 3, background: { r: 255, g: 255, b: 255 } } })
    .joinChannel(alpha).png().toBuffer();
}

async function sourceSilhouetteIou(leftPng: Buffer, rightPng: Buffer): Promise<number> {
  const masks: Uint8Array[] = [];
  for (const png of [leftPng, rightPng]) {
    const decoded = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const mask = new Uint8Array(decoded.info.width * decoded.info.height);
    for (let index = 0; index < mask.length; index += 1) mask[index] = decoded.data[index * decoded.info.channels + 3] > 0 ? 255 : 0;
    const bounds = await alphaBounds(png);
    masks.push(normalizeReferenceSilhouette({ bounds: { x: bounds.left, y: bounds.top, width: bounds.width, height: bounds.height }, mask }, decoded.info.width, 256));
  }
  return binarySilhouetteIou(masks[0], masks[1]);
}

async function buildContactSheet(input: Array<{ groupKey: string; material: string; candidate: Buffer; assembly: Buffer }>, outputPath: string): Promise<void> {
  const tileWidth = 520;
  const tileHeight = 740;
  const composites: sharp.OverlayOptions[] = [];
  for (let index = 0; index < input.length; index += 1) {
    const item = input[index];
    const component = await sharp(item.candidate)
      .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .resize({ width: 220, height: 330, fit: "contain", background: { r: 245, g: 243, b: 239, alpha: 1 } })
      .png()
      .toBuffer();
    const assembly = await sharp(item.assembly).resize({ width: 250, height: 550, fit: "contain", background: { r: 245, g: 243, b: 239, alpha: 1 } }).png().toBuffer();
    const label = Buffer.from(`<svg width="${tileWidth}" height="130"><rect width="100%" height="100%" fill="#171714"/><text x="22" y="36" fill="#E4BC68" font-family="Arial" font-size="20" font-weight="700">${escapeXml(item.groupKey)}</text><text x="22" y="68" fill="#F2EFE9" font-family="Arial" font-size="18">${escapeXml(item.material)}</text><text x="22" y="101" fill="#73E0D1" font-family="Arial" font-size="13">EXACT GROUP ALPHA · REVIEW ONLY</text></svg>`);
    composites.push({ input: component, left: index * tileWidth + 18, top: 45 });
    composites.push({ input: assembly, left: index * tileWidth + 255, top: 12 });
    composites.push({ input: label, left: index * tileWidth, top: 610 });
  }
  await mkdir(path.dirname(outputPath), { recursive: true });
  await sharp({ create: { width: tileWidth * input.length, height: tileHeight, channels: 4, background: { r: 245, g: 243, b: 239, alpha: 1 } } })
    .composite(composites).png().toFile(outputPath);
}

export async function buildJumboRollon16mmAuthorityReview(input: BuildInput) {
  validateRecipe(input.recipe);
  const archiveRoot = path.resolve(input.archiveRoot ?? DEFAULT_ARCHIVE_ROOT);
  const outputRoot = path.resolve(input.outputRoot ?? DEFAULT_OUTPUT_ROOT);
  const decodePsdScene = input.decodePsdScene ?? defaultDecodePsdScene;
  const identifyPsdScene = input.identifyPsdScene ?? defaultIdentifyPsdScene;
  await mkdir(outputRoot, { recursive: true });
  const reviewTiles: Array<{ groupKey: string; material: string; candidate: Buffer; assembly: Buffer }> = [];
  const groups = [];

  for (const group of input.recipe.groups) {
    const verified = new Map<string, { path: string; sha256: string }>();
    for (const source of [group.plasticAuthoritySource, group.plasticComparisonSource, group.metalMaterialSource]) {
      const sourcePath = resolveInside(archiveRoot, source.archiveRelativePath);
      const sourceBytes = await readFile(sourcePath);
      const actualSha256 = sha256(sourceBytes);
      if (actualSha256 !== source.sha256) throw new Error(`SHA-256 mismatch for ${source.originalFilename}: expected ${source.sha256}, received ${actualSha256}.`);
      verified.set(source.archiveRelativePath, { path: sourcePath, sha256: actualSha256 });
    }

    const authorityPath = verified.get(group.plasticAuthoritySource.archiveRelativePath)!.path;
    const comparisonPath = verified.get(group.plasticComparisonSource.archiveRelativePath)!.path;
    const metalPath = verified.get(group.metalMaterialSource.archiveRelativePath)!.path;
    const [authorityScene, authoritySceneBounds, comparisonScene, bodyScene, bodySceneBounds, metalScene, metalSceneBounds] = await Promise.all([
      decodePsdScene(authorityPath, group.plasticAuthoritySource.fitmentSceneIndex),
      identifyPsdScene(authorityPath, group.plasticAuthoritySource.fitmentSceneIndex),
      decodePsdScene(comparisonPath, group.plasticComparisonSource.fitmentSceneIndex),
      decodePsdScene(authorityPath, group.plasticAuthoritySource.bodySceneIndex),
      identifyPsdScene(authorityPath, group.plasticAuthoritySource.bodySceneIndex),
      decodePsdScene(metalPath, group.metalMaterialSource.compositeSceneIndex),
      identifyPsdScene(metalPath, group.metalMaterialSource.compositeSceneIndex),
    ]);
    if (group.metalMaterialSource.ballTransferRows > metalSceneBounds.height) throw new Error(`${group.groupKey} metal ball transfer exceeds the source scene.`);
    const [cleanedAuthority, cleanedComparison] = await Promise.all([
      cleanCalibratedDetachedAlphaIslands({ sourcePng: authorityScene, calibration: group.plasticAuthoritySource.alphaCleanup }),
      cleanCalibratedDetachedAlphaIslands({ sourcePng: comparisonScene, calibration: group.plasticComparisonSource.alphaCleanup }),
    ]);
    const authorityDocument = await placeSceneOnDocument(cleanedAuthority.png, authoritySceneBounds, input.recipe.sourceDocumentCanvas);
    const authoritySourceBoundsPx = await alphaBounds(authorityDocument);
    const authorityCrop = await sharp(authorityDocument).extract(authoritySourceBoundsPx).png().toBuffer();
    const centeredPlastic = await centerCropOnCanonicalCanvas(authorityCrop, input.recipe.canonicalCanvas);
    const authorityMaskPng = await buildAuthorityMask(centeredPlastic.png, input.recipe.canonicalCanvas);
    const authorityInspection = await inspectAuthorityMask(authorityMaskPng, { expectedRegions: 1 });
    const plasticCandidate = await clampToAuthorityMask(centeredPlastic.png, authorityMaskPng);

    const metalDocument = await placeSceneOnDocument(metalScene, metalSceneBounds, input.recipe.sourceDocumentCanvas);
    const metalBallTransferBottom = metalSceneBounds.top + group.metalMaterialSource.ballTransferRows;
    const metalBallStrip = await sharp(metalDocument).extract({ left: 0, top: 0, width: input.recipe.sourceDocumentCanvas.width, height: metalBallTransferBottom }).png().toBuffer();
    const hybridDocument = await sharp(authorityDocument).composite([{ input: metalBallStrip, left: 0, top: 0 }]).png().toBuffer();
    const hybridCrop = await sharp(hybridDocument).extract(authoritySourceBoundsPx).png().toBuffer();
    const centeredMetal = await centerCropOnCanonicalCanvas(hybridCrop, input.recipe.canonicalCanvas);
    const metalCandidate = await clampToAuthorityMask(centeredMetal.png, authorityMaskPng);

    const authorityAlpha = await alphaBytes(authorityMaskPng);
    const plasticAlphaQa = compareExactAlphaBytes(await alphaBytes(plasticCandidate), authorityAlpha);
    const metalAlphaQa = compareExactAlphaBytes(await alphaBytes(metalCandidate), authorityAlpha);
    if (!plasticAlphaQa.geometryLocked || !metalAlphaQa.geometryLocked) throw new Error(`${group.groupKey} exact-alpha clamp failed.`);

    const comparisonIou = await sourceSilhouetteIou(cleanedAuthority.png, cleanedComparison.png);
    const groupDir = path.join(outputRoot, safeToken(group.groupKey));
    await mkdir(groupDir, { recursive: true });
    const authorityMaskPath = path.join(groupDir, "authority-mask-review-candidate.png");
    const plasticPath = path.join(groupDir, "jumbo-roller__plastic__candidate-v1.png");
    const metalCandidatePath = path.join(groupDir, "jumbo-roller__metal__candidate-v1.png");
    await Promise.all([
      writeFile(authorityMaskPath, authorityMaskPng),
      writeFile(plasticPath, plasticCandidate),
      writeFile(metalCandidatePath, metalCandidate),
    ]);

    const bodyDocument = await placeSceneOnDocument(bodyScene, bodySceneBounds, input.recipe.sourceDocumentCanvas);
    const plasticMaterialDocument = await sharp({ create: { width: input.recipe.sourceDocumentCanvas.width, height: input.recipe.sourceDocumentCanvas.height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: authorityCrop, left: authoritySourceBoundsPx.left, top: authoritySourceBoundsPx.top }]).png().toBuffer();
    const metalMaterialDocument = await sharp({ create: { width: input.recipe.sourceDocumentCanvas.width, height: input.recipe.sourceDocumentCanvas.height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: await sharp(hybridCrop).png().toBuffer(), left: authoritySourceBoundsPx.left, top: authoritySourceBoundsPx.top }]).png().toBuffer();
    const makeAssembly = (component: Buffer) => sharp({ create: { width: input.recipe.sourceDocumentCanvas.width, height: input.recipe.sourceDocumentCanvas.height, channels: 4, background: { r: 245, g: 243, b: 239, alpha: 1 } } })
      .composite([{ input: bodyDocument, left: 0, top: 0 }, { input: component, left: 0, top: 0 }]).png().toBuffer();
    const [plasticAssembly, metalAssembly] = await Promise.all([makeAssembly(plasticMaterialDocument), makeAssembly(metalMaterialDocument)]);
    reviewTiles.push({ groupKey: group.groupKey, material: "NATURAL PLASTIC", candidate: plasticCandidate, assembly: plasticAssembly });
    reviewTiles.push({ groupKey: group.groupKey, material: "METAL BALL · PLASTIC HOUSING", candidate: metalCandidate, assembly: metalAssembly });

    groups.push({
      groupKey: group.groupKey,
      physicalContract: { capacityMl: group.capacityMl, bodyHeightMm: group.bodyHeightMm, bodyDiameterMm: group.bodyDiameterMm, assembledHeightMm: group.assembledHeightMm, neckSizeMm: group.neckSizeMm },
      authoritySource: { ...group.plasticAuthoritySource, actualSha256: verified.get(group.plasticAuthoritySource.archiveRelativePath)!.sha256, sourceSceneBoundsPx: authoritySceneBounds, sourceBoundsPx: authoritySourceBoundsPx, alphaCleanupReport: cleanedAuthority.report },
      comparisonSource: { ...group.plasticComparisonSource, actualSha256: verified.get(group.plasticComparisonSource.archiveRelativePath)!.sha256, alphaCleanupReport: cleanedComparison.report, normalizedSilhouetteIou: comparisonIou, interpretation: "Diagnostic only; it does not create cross-size authority." },
      metalMaterialSource: { ...group.metalMaterialSource, actualSha256: verified.get(group.metalMaterialSource.archiveRelativePath)!.sha256, sourceSceneBoundsPx: metalSceneBounds, transferredDocumentRows: { top: metalSceneBounds.top, bottomExclusive: metalBallTransferBottom }, interpretation: "Only the visible ball-region material is transferred; duplicated glass-neck pixels remain excluded." },
      authorityMaskReviewCandidate: { path: path.relative(workspaceRoot, authorityMaskPath), sha256: sha256(authorityMaskPng), authorityBoundsPx: authorityInspection.authorityBoundsPx, exactRegionCount: 1 },
      candidates: [
        { material: "natural-plastic", path: path.relative(workspaceRoot, plasticPath), sha256: sha256(plasticCandidate), boxes: { sourceBoundsPx: authoritySourceBoundsPx, editBoundsPx: authoritySourceBoundsPx, authorityBoundsPx: authorityInspection.authorityBoundsPx, placementBoundsPx: null }, qa: { exactAlpha: true, mismatchedAlphaBytes: plasticAlphaQa.mismatchedPixels, binaryIou: plasticAlphaQa.minIoU } },
        { material: "metal-ball-plastic-housing", path: path.relative(workspaceRoot, metalCandidatePath), sha256: sha256(metalCandidate), boxes: { sourceBoundsPx: { left: metalSceneBounds.left, top: metalSceneBounds.top, width: metalSceneBounds.width, height: group.metalMaterialSource.ballTransferRows }, editBoundsPx: authoritySourceBoundsPx, authorityBoundsPx: authorityInspection.authorityBoundsPx, placementBoundsPx: null }, qa: { exactAlpha: true, mismatchedAlphaBytes: metalAlphaQa.mismatchedPixels, binaryIou: metalAlphaQa.minIoU } },
      ],
      namedGeometryReviewRequired: true,
      separateFamilyPlacementRequired: true,
      geometryLocked: false,
      productionEligible: false,
    });
  }

  const contactSheetPath = path.join(outputRoot, "contact-sheet.png");
  await buildContactSheet(reviewTiles, contactSheetPath);
  const manifest = {
    schemaVersion: 1,
    reviewId: input.recipe.reviewId,
    kitId: input.recipe.kitId,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    lifecycleState: "authority-review-required",
    canonicalCanvas: input.recipe.canonicalCanvas,
    groups,
    summary: { authorityGroupCount: groups.length, candidateCount: groups.length * 2, exactAlphaWithinEveryGroup: true, namedGeometryReviewRequired: true, familyFitRequired: true },
    geometryLocked: false,
    productionEligible: false,
    mutationPolicy: { approvalsWritten: false, placementLockWritten: false, remoteWritesPerformed: false, currentReleaseChanged: false, sanityChanged: false },
  };
  const manifestPath = path.join(outputRoot, "review-manifest.json");
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return { manifestPath, contactSheetPath, manifest };
}

async function main(): Promise<void> {
  const recipePath = path.resolve(process.argv[2] ?? DEFAULT_RECIPE_PATH);
  const recipe = JSON.parse(await readFile(recipePath, "utf8")) as JumboRollonAuthorityRecipe;
  const result = await buildJumboRollon16mmAuthorityReview({ recipe });
  process.stdout.write(`${JSON.stringify({ manifestPath: result.manifestPath, contactSheetPath: result.contactSheetPath, summary: result.manifest.summary, geometryLocked: result.manifest.geometryLocked, productionEligible: result.manifest.productionEligible, mutationPolicy: result.manifest.mutationPolicy }, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 1; });
}
