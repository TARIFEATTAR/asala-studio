import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import {
  parseParametricOvercapFamilyRecipe,
  type ParametricOvercapFamilyRecipe,
} from "../../src/lib/paperDoll/parametricOvercapFamily";
import {
  clampToAuthorityMask,
  inspectAuthorityMask,
} from "../../src/lib/paperDoll/componentPlateImage.node";

export interface ParametricOvercapRender {
  variantKey: string;
  png: Buffer;
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function resolveContained(root: string, relativePath: string): string {
  if (path.isAbsolute(relativePath)) throw new Error("Blender manifest asset paths must be relative.");
  const resolved = path.resolve(root, relativePath);
  const relative = path.relative(path.resolve(root), resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Blender manifest asset path escapes the output directory.");
  return resolved;
}

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
  })[character] ?? character);
}

async function buildReviewContactSheet(
  recipe: ParametricOvercapFamilyRecipe,
  variants: Array<{ variantKey: string; png: Buffer }>,
): Promise<Buffer> {
  const tileWidth = 360;
  const tileHeight = 480;
  const tiles = await Promise.all(variants.map(async (variant) => {
    const recipeVariant = recipe.variants.find((entry) => entry.variantKey === variant.variantKey);
    if (!recipeVariant) throw new Error(`${variant.variantKey} is missing from the recipe.`);
    const image = await sharp(variant.png)
      .resize({
        width: 300,
        height: 360,
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();
    const label = Buffer.from(`<svg width="${tileWidth}" height="${tileHeight}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#F5F3EF"/>
      <rect x="1" y="1" width="358" height="478" fill="none" stroke="#C6A15B" stroke-width="2"/>
      <text x="24" y="414" font-family="Arial, sans-serif" font-size="24" font-weight="700" fill="#151515">${escapeXml(variant.variantKey)}</text>
      <text x="24" y="442" font-family="Arial, sans-serif" font-size="15" fill="#5C574E">${escapeXml(recipeVariant.sourceIdentity)}</text>
      <text x="24" y="466" font-family="Arial, sans-serif" font-size="12" fill="#A5453C">PROFILE REVIEW · NOT GEOMETRY LOCKED</text>
    </svg>`);
    return sharp(label).composite([{ input: image, left: 30, top: 28 }]).png().toBuffer();
  }));
  return sharp({
    create: { width: 1080, height: 1440, channels: 4, background: "#151515" },
  }).composite(tiles.map((input, index) => ({
    input,
    left: (index % 3) * tileWidth,
    top: Math.floor(index / 3) * tileHeight,
  }))).png().toBuffer();
}

async function alphaBytes(png: Buffer): Promise<Buffer> {
  return sharp(png).ensureAlpha().extractChannel("alpha").raw().toBuffer();
}

export async function buildParametricOvercapCandidate(input: {
  recipe: ParametricOvercapFamilyRecipe;
  authorityMaskPng: Buffer;
  renders: ParametricOvercapRender[];
}) {
  const expectedKeys = input.recipe.variants.map((variant) => variant.variantKey);
  const actualKeys = input.renders.map((render) => render.variantKey);
  if (actualKeys.length !== expectedKeys.length || actualKeys.some((key, index) => key !== expectedKeys[index])) {
    throw new Error("Render batch must contain the exact recipe variant set in canonical order.");
  }

  await inspectAuthorityMask(input.authorityMaskPng, { expectedRegions: 1 });
  const clamped = await Promise.all(input.renders.map(async (render) => ({
    variantKey: render.variantKey,
    png: await clampToAuthorityMask(render.png, input.authorityMaskPng),
  })));
  const alphas = await Promise.all(clamped.map(async (variant) => ({
    variantKey: variant.variantKey,
    alpha: await alphaBytes(variant.png),
  })));
  let minimumPairwiseAlphaIou = 1;
  let maximumPairwiseMismatchedPixels = 0;
  for (let leftIndex = 0; leftIndex < alphas.length; leftIndex++) {
    for (let rightIndex = leftIndex + 1; rightIndex < alphas.length; rightIndex++) {
      const left = alphas[leftIndex].alpha;
      const right = alphas[rightIndex].alpha;
      if (left.length !== right.length) throw new Error("Clamped variant alpha dimensions differ.");
      let intersection = 0;
      let union = 0;
      let mismatchedPixels = 0;
      for (let index = 0; index < left.length; index++) {
        const leftOccupied = left[index] > 0;
        const rightOccupied = right[index] > 0;
        if (leftOccupied && rightOccupied) intersection++;
        if (leftOccupied || rightOccupied) union++;
        if (left[index] !== right[index]) mismatchedPixels++;
      }
      minimumPairwiseAlphaIou = Math.min(minimumPairwiseAlphaIou, union === 0 ? 1 : intersection / union);
      maximumPairwiseMismatchedPixels = Math.max(maximumPairwiseMismatchedPixels, mismatchedPixels);
    }
  }

  return {
    clamped,
    summary: {
      recipeId: input.recipe.recipeId,
      geometryFamilyId: input.recipe.geometryFamilyId,
      variantCount: clamped.length,
      physicalDimensionsVerified: input.recipe.nominalDimensionsMm.verified,
      minimumPairwiseAlphaIou,
      maximumPairwiseMismatchedPixels,
      geometryLocked: false as const,
      productionPlateEligible: false as const,
      authorityReviewRequired: true as const,
    },
  };
}

type BlenderProvenance = {
  meshRecipeHash: string;
  cameraRecipeHash: string;
  studioRecipeHash: string;
  maskRecipeHash: string;
};

type BlenderManifest = {
  schemaVersion: number;
  geometryFamilyId: string;
  blenderVersion: string;
  maskPath: string;
  sharedProvenance: BlenderProvenance;
  renders: Array<{
    variantKey: string;
    path: string;
    provenance: BlenderProvenance;
    crystals: unknown[];
  }>;
};

function validateBlenderManifest(manifest: BlenderManifest, recipe: ParametricOvercapFamilyRecipe): void {
  if (manifest.schemaVersion !== 1 || manifest.geometryFamilyId !== recipe.geometryFamilyId) {
    throw new Error("Blender manifest does not match the parametric overcap geometry family.");
  }
  const expectedKeys = recipe.variants.map((variant) => variant.variantKey);
  const actualKeys = manifest.renders.map((render) => render.variantKey);
  if (actualKeys.length !== expectedKeys.length || actualKeys.some((key, index) => key !== expectedKeys[index])) {
    throw new Error("Blender manifest must contain the exact recipe variant set in canonical order.");
  }
  const provenanceKeys: Array<keyof BlenderProvenance> = [
    "meshRecipeHash", "cameraRecipeHash", "studioRecipeHash", "maskRecipeHash",
  ];
  for (const render of manifest.renders) {
    for (const key of provenanceKeys) {
      if (!/^[a-f0-9]{64}$/.test(render.provenance[key]) || render.provenance[key] !== manifest.sharedProvenance[key]) {
        throw new Error(`${render.variantKey} ${key} differs from shared Blender provenance.`);
      }
    }
  }
}

export async function materializeParametricOvercapCandidate(input: {
  recipePath: string;
  blenderOutputDir: string;
  outputDir: string;
}) {
  const recipeBytes = await readFile(input.recipePath);
  const recipe = parseParametricOvercapFamilyRecipe(JSON.parse(recipeBytes.toString("utf8")));
  const blenderManifestBytes = await readFile(path.join(input.blenderOutputDir, "blender-manifest.json"));
  const blenderManifest = JSON.parse(blenderManifestBytes.toString("utf8")) as BlenderManifest;
  validateBlenderManifest(blenderManifest, recipe);
  const authorityMaskPath = resolveContained(input.blenderOutputDir, blenderManifest.maskPath);
  const authorityMaskPng = await readFile(authorityMaskPath);
  const renders = await Promise.all(blenderManifest.renders.map(async (render) => ({
    variantKey: render.variantKey,
    png: await readFile(resolveContained(input.blenderOutputDir, render.path)),
  })));
  const candidate = await buildParametricOvercapCandidate({ recipe, authorityMaskPng, renders });
  const clampedDirectory = path.join(input.outputDir, "clamped");
  await mkdir(clampedDirectory, { recursive: true });
  const outputRecords = [];
  for (const variant of candidate.clamped) {
    const outputPath = path.join(clampedDirectory, `${variant.variantKey}.png`);
    await writeFile(outputPath, variant.png);
    outputRecords.push({
      variantKey: variant.variantKey,
      path: path.relative(input.outputDir, outputPath),
      sha256: sha256(variant.png),
    });
  }
  const contactSheet = await buildReviewContactSheet(recipe, candidate.clamped);
  const contactSheetPath = path.join(input.outputDir, "review-contact-sheet.png");
  await writeFile(contactSheetPath, contactSheet);
  const manifest = {
    schemaVersion: 1,
    recipeId: recipe.recipeId,
    recipePath: path.relative(process.cwd(), input.recipePath),
    recipeSha256: sha256(recipeBytes),
    geometryFamilyId: recipe.geometryFamilyId,
    authorityState: recipe.authorityState,
    authorityReference: recipe.authorityReference,
    physicalTruthSource: recipe.physicalTruthSource,
    nominalDimensionsMm: recipe.nominalDimensionsMm,
    blender: {
      version: blenderManifest.blenderVersion,
      manifestPath: path.relative(process.cwd(), path.join(input.blenderOutputDir, "blender-manifest.json")),
      manifestSha256: sha256(blenderManifestBytes),
      sharedProvenance: blenderManifest.sharedProvenance,
      authorityMaskPath: path.relative(process.cwd(), authorityMaskPath),
      authorityMaskSha256: sha256(authorityMaskPng),
    },
    outputs: outputRecords,
    reviewContactSheet: {
      path: path.relative(input.outputDir, contactSheetPath),
      sha256: sha256(contactSheet),
    },
    summary: candidate.summary,
    interpretation: "Dimension-calibrated local profile-review candidate. Exact alpha is proven across variants, but geometry lock and production eligibility remain false until named authority review and family-fit placement.",
    mutationPolicy: {
      localReviewCandidateCreated: true,
      remoteWritesPerformed: false,
      currentReleaseChanged: false,
      sanityChanged: false,
    },
  };
  await mkdir(input.outputDir, { recursive: true });
  const manifestPath = path.join(input.outputDir, "candidate-manifest.json");
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return { manifestPath, contactSheetPath, manifest };
}

async function main() {
  const value = (name: string) => {
    const index = process.argv.indexOf(`--${name}`);
    return index >= 0 ? process.argv[index + 1] : undefined;
  };
  const recipePath = value("recipe");
  const blenderOutputDir = value("blender-output");
  const outputDir = value("out");
  if (!recipePath || !blenderOutputDir || !outputDir) {
    throw new Error("Usage: --recipe <path> --blender-output <path> --out <path>");
  }
  const result = await materializeParametricOvercapCandidate({ recipePath, blenderOutputDir, outputDir });
  console.log(JSON.stringify({ manifestPath: result.manifestPath, summary: result.manifest.summary, mutationPolicy: result.manifest.mutationPolicy }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
