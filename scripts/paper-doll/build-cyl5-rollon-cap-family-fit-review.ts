import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import { PAPER_DOLL_CANVAS_RGB, type RgbaImage } from "../../src/lib/paperDoll/componentRegistry";
import { resolvePaperDollCatalogPresentation, type PaperDollBounds } from "../../src/lib/paperDoll/catalogPresentation";
import { detectAlphaForegroundBounds, solveClosurePlacement, type GeometrySpec } from "../../src/lib/paperDoll/compositeEngine";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const defaultBodyDirectory = path.join(workspaceRoot, "outputs/paper-doll-body-authority-reviews/CYL-5ML-13-415/53x17-clear-v1");
const defaultCapRecipePath = path.join(workspaceRoot, "docs/paper-doll-rig/rollon-cap-13-415-family-recipe.json");
const defaultCapCandidateDirectory = path.join(workspaceRoot, "outputs/paper-doll-parametric-overcaps/13-415-rollon-cap/candidate-v1");
const defaultOutputDirectory = path.join(workspaceRoot, "outputs/paper-doll-body-authority-reviews/CYL-5ML-13-415/rollon-cap-family-fit-v1");

type PixelBox = { left: number; top: number; width: number; height: number };

function sha256(value: Buffer | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function relativeWorkspacePath(absolutePath: string): string {
  return path.relative(workspaceRoot, absolutePath);
}

function escapeXml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

function alphaSha256(image: RgbaImage): string {
  const alpha = Buffer.alloc(image.width * image.height);
  for (let pixel = 0; pixel < alpha.length; pixel += 1) alpha[pixel] = image.data[pixel * 4 + 3];
  return sha256(alpha);
}

async function decodeRgba(buffer: Buffer): Promise<RgbaImage> {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: new Uint8ClampedArray(data), width: info.width, height: info.height };
}

function unionBounds(left: PixelBox, right: PixelBox): PixelBox {
  const minimumX = Math.min(left.left, right.left);
  const minimumY = Math.min(left.top, right.top);
  const maximumX = Math.max(left.left + left.width, right.left + right.width);
  const maximumY = Math.max(left.top + left.height, right.top + right.height);
  return { left: minimumX, top: minimumY, width: maximumX - minimumX, height: maximumY - minimumY };
}

async function renderCatalogPresentation(input: {
  workbenchPng: Buffer;
  sourceAssemblyBoundsPx: PaperDollBounds;
  targetAssemblyBoundsPx: PaperDollBounds;
  uniformScale: number;
}): Promise<Buffer> {
  const canvas = { width: 2080, height: 2288 };
  const margin = 80;
  const crop = {
    left: Math.max(0, input.sourceAssemblyBoundsPx.left - margin),
    top: Math.max(0, input.sourceAssemblyBoundsPx.top - margin),
    width: 0,
    height: 0,
  };
  const cropRight = Math.min(canvas.width, input.sourceAssemblyBoundsPx.left + input.sourceAssemblyBoundsPx.width + margin);
  const cropBottom = Math.min(canvas.height, input.sourceAssemblyBoundsPx.top + input.sourceAssemblyBoundsPx.height + margin);
  crop.width = cropRight - crop.left;
  crop.height = cropBottom - crop.top;
  const scaledWidth = Math.round(crop.width * input.uniformScale);
  const scaledHeight = Math.round(crop.height * input.uniformScale);
  const scaled = await sharp(input.workbenchPng)
    .extract(crop)
    .resize(scaledWidth, scaledHeight)
    .png()
    .toBuffer();
  const left = Math.round(input.targetAssemblyBoundsPx.left - (input.sourceAssemblyBoundsPx.left - crop.left) * input.uniformScale);
  const top = Math.round(input.targetAssemblyBoundsPx.top - (input.sourceAssemblyBoundsPx.top - crop.top) * input.uniformScale);
  if (left < 0 || top < 0 || left + scaledWidth > canvas.width || top + scaledHeight > canvas.height) {
    throw new Error("Catalog presentation crop exceeds the canonical canvas.");
  }
  return sharp({ create: { width: canvas.width, height: canvas.height, channels: 4, background: PAPER_DOLL_CANVAS_RGB } })
    .composite([{ input: scaled, left, top }])
    .png()
    .toBuffer();
}

async function buildContactSheet(variants: Array<{
  variantKey: string;
  material: string;
  decoration: string;
  heroPng: Buffer;
}>): Promise<Buffer> {
  const columns = 3;
  const tileWidth = 360;
  const imageHeight = 396;
  const labelHeight = 68;
  const gap = 18;
  const margin = 44;
  const headerHeight = 150;
  const rows = Math.ceil(variants.length / columns);
  const width = margin * 2 + columns * tileWidth + (columns - 1) * gap;
  const height = headerHeight + rows * (imageHeight + labelHeight + gap) + margin;
  const layers: sharp.OverlayOptions[] = [{
    input: Buffer.from(`<svg width="${width}" height="${headerHeight}" xmlns="http://www.w3.org/2000/svg">
      <text x="${margin}" y="54" fill="#f4c46c" font-family="Arial" font-size="34" font-weight="700">CYL-5ML · 13-415 ROLL-ON CAP FAMILY FIT</text>
      <text x="${margin}" y="91" fill="#ddd6c8" font-family="monospace" font-size="18">Nine exact-alpha variants · physical 17×24 mm cap · final 5 ml target 61%</text>
      <text x="${margin}" y="126" fill="#e07b69" font-family="monospace" font-size="17">BODY + CAP ARE REVIEW CANDIDATES · NOT GEOMETRY LOCKED · NO RELEASE WRITE</text>
    </svg>`),
    left: 0,
    top: 0,
  }];
  for (const [index, variant] of variants.entries()) {
    const left = margin + (index % columns) * (tileWidth + gap);
    const top = headerHeight + Math.floor(index / columns) * (imageHeight + labelHeight + gap);
    const preview = await sharp(variant.heroPng).resize({ width: tileWidth, height: imageHeight, fit: "fill" }).png().toBuffer();
    layers.push({ input: preview, left, top });
    layers.push({
      input: Buffer.from(`<svg width="${tileWidth}" height="${labelHeight}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#1d1c19"/>
        <text x="14" y="26" fill="#f4c46c" font-family="monospace" font-size="17" font-weight="700">${escapeXml(variant.variantKey)}</text>
        <text x="14" y="51" fill="#bcb4a6" font-family="monospace" font-size="14">${escapeXml(variant.material)} · ${escapeXml(variant.decoration)}</text>
      </svg>`),
      left,
      top: top + imageHeight,
    });
  }
  return sharp({ create: { width, height, channels: 4, background: "#11110f" } }).composite(layers).png().toBuffer();
}

export async function buildCyl5RollonCapFamilyFitReview(input: {
  bodyReviewDirectory?: string;
  capRecipePath?: string;
  capCandidateDirectory?: string;
  outputDirectory?: string;
  assembledHeightMm?: number;
} = {}) {
  const bodyReviewDirectory = path.resolve(input.bodyReviewDirectory ?? defaultBodyDirectory);
  const capRecipePath = path.resolve(input.capRecipePath ?? defaultCapRecipePath);
  const capCandidateDirectory = path.resolve(input.capCandidateDirectory ?? defaultCapCandidateDirectory);
  const outputDirectory = path.resolve(input.outputDirectory ?? defaultOutputDirectory);
  const assembledHeightMm = input.assembledHeightMm ?? 65;
  const [bodyManifestText, recipeText, capManifestText] = await Promise.all([
    readFile(path.join(bodyReviewDirectory, "review-manifest.json"), "utf8"),
    readFile(capRecipePath, "utf8"),
    readFile(path.join(capCandidateDirectory, "candidate-manifest.json"), "utf8"),
  ]);
  const bodyManifest = JSON.parse(bodyManifestText) as any;
  const recipe = JSON.parse(recipeText) as any;
  const capManifest = JSON.parse(capManifestText) as any;
  if (bodyManifest.lifecycleState !== "candidate" || bodyManifest.geometryLocked !== false || bodyManifest.productionPlateEligible !== false) {
    throw new Error("CYL-5ML Family Fit accepts the review-only body candidate, not a mislabeled authority.");
  }
  if (recipe.neckFinish !== "13-415" || recipe.nominalDimensionsMm?.verified !== true) {
    throw new Error("Family Fit requires the verified 13-415 roll-on cap recipe.");
  }
  if (capManifest.recipeId !== recipe.recipeId || capManifest.geometryFamilyId !== recipe.geometryFamilyId) {
    throw new Error("Cap candidate manifest does not match its physical recipe.");
  }
  if (capManifest.summary?.geometryLocked !== false
    || capManifest.summary?.productionPlateEligible !== false
    || capManifest.summary?.authorityReviewRequired !== true) {
    throw new Error("Cap inputs must remain dimension-calibrated review candidates.");
  }
  if (recipe.variants.length !== capManifest.outputs.length) throw new Error("Cap candidate batch is incomplete.");

  const bodyCandidatePath = path.join(bodyReviewDirectory, bodyManifest.artifacts.canonicalCandidate.path);
  const bodyPng = await readFile(bodyCandidatePath);
  if (sha256(bodyPng) !== bodyManifest.artifacts.canonicalCandidate.sha256) throw new Error("CYL-5ML body candidate SHA mismatch.");
  const bodyBounds: PixelBox = bodyManifest.placementBoundsPx;
  const bodyHeightMm = bodyManifest.dimensionsMm.bodyHeight;
  const capHeightMm = recipe.nominalDimensionsMm.height;
  const visibleAddedHeightMm = assembledHeightMm - bodyHeightMm;
  const physicalOverlapMm = capHeightMm - visibleAddedHeightMm;
  if (visibleAddedHeightMm <= 0 || physicalOverlapMm < 0 || physicalOverlapMm >= capHeightMm) {
    throw new Error("Verified body, cap, and assembled heights do not produce a valid overlap.");
  }
  const geometrySpec: GeometrySpec = {
    canvasWidthPx: bodyManifest.workbenchScale.canvas.width,
    canvasHeightPx: bodyManifest.workbenchScale.canvas.height,
    pxPerMm: bodyManifest.workbenchScale.pixelsPerMm,
    baselineY: bodyManifest.workbenchScale.baselineY,
    centerlineX: bodyManifest.workbenchScale.centerX,
    bodyBounds: {
      left: bodyBounds.left,
      right: bodyBounds.left + bodyBounds.width - 1,
      top: bodyBounds.top,
      bottom: bodyBounds.top + bodyBounds.height - 1,
    },
  };
  await Promise.all([
    mkdir(path.join(outputDirectory, "workbench"), { recursive: true }),
    mkdir(path.join(outputDirectory, "catalog"), { recursive: true }),
  ]);

  const variants = [];
  let sharedAlphaSha256: string | null = null;
  let sharedPlacement: ReturnType<typeof solveClosurePlacement> | null = null;
  for (const recipeVariant of recipe.variants) {
    const output = capManifest.outputs.find((candidate: any) => candidate.variantKey === recipeVariant.variantKey);
    if (!output) throw new Error(`Missing cap candidate ${recipeVariant.variantKey}.`);
    const capPath = path.join(capCandidateDirectory, output.path);
    const capPng = await readFile(capPath);
    if (sha256(capPng) !== output.sha256) throw new Error(`Cap SHA mismatch for ${recipeVariant.variantKey}.`);
    const capRgba = await decodeRgba(capPng);
    const currentAlphaSha256 = alphaSha256(capRgba);
    if (sharedAlphaSha256 === null) sharedAlphaSha256 = currentAlphaSha256;
    if (currentAlphaSha256 !== sharedAlphaSha256) throw new Error("Cap family alpha changed between variants.");
    if (!detectAlphaForegroundBounds(capRgba)) throw new Error(`Cap ${recipeVariant.variantKey} has no alpha foreground.`);
    const placement = solveClosurePlacement(capRgba, geometrySpec, {
      mode: "assembled",
      heightMm: capHeightMm,
      overlapMm: physicalOverlapMm,
    });
    if (sharedPlacement && JSON.stringify(placement) !== JSON.stringify(sharedPlacement)) {
      throw new Error("Exact-alpha cap variants resolved to different placements.");
    }
    sharedPlacement ??= placement;
    const resizedCap = await sharp(capPng).resize(placement.targetWidthPx, placement.targetHeightPx).png().toBuffer();
    const workbenchPng = await sharp(bodyPng)
      .composite([{ input: resizedCap, left: placement.offsetX, top: placement.offsetY }])
      .png()
      .toBuffer();
    const capBounds: PixelBox = {
      left: placement.placedBounds.left,
      top: placement.placedBounds.top,
      width: placement.placedBounds.right - placement.placedBounds.left + 1,
      height: placement.placedBounds.bottom - placement.placedBounds.top + 1,
    };
    const sourceAssemblyBoundsPx = unionBounds(bodyBounds, capBounds);
    const catalogPresentation = resolvePaperDollCatalogPresentation({
      capacityMl: 5,
      canvas: { widthPx: 2080, heightPx: 2288 },
      sourceAssemblyBoundsPx,
      targetCenterXPx: geometrySpec.centerlineX,
      targetBaselineYPx: geometrySpec.baselineY,
    });
    const catalogPng = await renderCatalogPresentation({
      workbenchPng,
      sourceAssemblyBoundsPx,
      targetAssemblyBoundsPx: catalogPresentation.targetAssemblyBoundsPx,
      uniformScale: catalogPresentation.uniformScale,
    });
    const workbenchRelativePath = `workbench/${recipeVariant.variantKey}.png`;
    const catalogRelativePath = `catalog/${recipeVariant.variantKey}.png`;
    await Promise.all([
      writeFile(path.join(outputDirectory, workbenchRelativePath), workbenchPng),
      writeFile(path.join(outputDirectory, catalogRelativePath), catalogPng),
    ]);
    variants.push({
      variantKey: recipeVariant.variantKey,
      sourceIdentity: recipeVariant.sourceIdentity,
      material: recipeVariant.material,
      decoration: recipeVariant.decoration,
      sourceCandidate: { path: relativeWorkspacePath(capPath), sha256: output.sha256 },
      exactFamilyAlphaSha256: currentAlphaSha256,
      placementBoundsPx: capBounds,
      sourceAssemblyBoundsPx,
      catalogPresentation,
      workbenchArtifact: { path: workbenchRelativePath, sha256: sha256(workbenchPng) },
      catalogArtifact: { path: catalogRelativePath, sha256: sha256(catalogPng) },
      heroPng: catalogPng,
    });
  }
  const contactSheet = await buildContactSheet(variants);
  const contactSheetPath = "contact-sheet.png";
  await writeFile(path.join(outputDirectory, contactSheetPath), contactSheet);
  const manifest = {
    schemaVersion: 1,
    reviewId: "family-fit__CYL-5ML-13-415__rollon-cap-v1",
    lifecycleState: "family-fit-review-required" as const,
    body: {
      geometryKey: bodyManifest.geometryKey,
      sourceManifestPath: relativeWorkspacePath(path.join(bodyReviewDirectory, "review-manifest.json")),
      sourceManifestSha256: sha256(bodyManifestText),
      candidatePath: relativeWorkspacePath(bodyCandidatePath),
      candidateSha256: sha256(bodyPng),
      geometryLocked: false,
    },
    capFamily: {
      recipeId: recipe.recipeId,
      geometryFamilyId: recipe.geometryFamilyId,
      sourceRecipePath: relativeWorkspacePath(capRecipePath),
      sourceRecipeSha256: sha256(recipeText),
      sourceCandidateManifestPath: relativeWorkspacePath(path.join(capCandidateDirectory, "candidate-manifest.json")),
      sourceCandidateManifestSha256: sha256(capManifestText),
      exactFamilyAlphaSha256: sharedAlphaSha256,
      geometryLocked: false,
    },
    placement: {
      bodyHeightMm,
      capHeightMm,
      assembledHeightMm,
      visibleAddedHeightMm,
      physicalOverlapMm,
      workbenchPixelsPerMm: geometrySpec.pxPerMm,
      resolved: sharedPlacement,
      rule: "One physical placement is shared by all exact-alpha cap variants; no per-finish nudge is permitted.",
    },
    catalogPresentation: variants[0].catalogPresentation,
    variants: variants.map(({ heroPng: _heroPng, ...variant }) => variant),
    summary: {
      variantCount: variants.length,
      workbenchAssemblyCount: variants.length,
      catalogPresentationCount: variants.length,
      exactAlphaAcrossVariants: true,
      namedBodyAuthorityReviewRequired: true,
      namedCapAuthorityReviewRequired: true,
    },
    geometryLocked: false,
    productionPlateEligible: false,
    contactSheet: { path: contactSheetPath, sha256: sha256(contactSheet) },
    mutationPolicy: {
      candidatePixelsChanged: false,
      approvalWritten: false,
      placementLockWritten: false,
      remoteWritesPerformed: false,
      currentReleaseChanged: false,
      sanityChanged: false,
    },
  };
  await writeFile(path.join(outputDirectory, "family-fit-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return manifest;
}

async function main() {
  const manifest = await buildCyl5RollonCapFamilyFitReview();
  console.log(JSON.stringify({
    reviewId: manifest.reviewId,
    lifecycleState: manifest.lifecycleState,
    summary: manifest.summary,
    placement: manifest.placement,
    catalogPresentation: manifest.catalogPresentation,
    contactSheet: path.join(defaultOutputDirectory, manifest.contactSheet.path),
    geometryLocked: manifest.geometryLocked,
    productionPlateEligible: manifest.productionPlateEligible,
    mutationPolicy: manifest.mutationPolicy,
  }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
