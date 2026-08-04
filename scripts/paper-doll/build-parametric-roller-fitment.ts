import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import {
  parseParametricRollerFitmentRecipe,
  type ParametricRollerFitmentRecipe,
} from "../../src/lib/paperDoll/parametricRollerFitment";
import {
  clampToAuthorityMask,
  inspectAuthorityMask,
} from "../../src/lib/paperDoll/componentPlateImage.node";

type BlenderProvenance = {
  meshRecipeHash: string;
  cameraRecipeHash: string;
  studioRecipeHash: string;
  maskRecipeHash: string;
};

type BlenderManifest = {
  schemaVersion: number;
  recipeId: string;
  geometryFamilyId: string;
  authorityState: string;
  blenderVersion: string;
  maskPath: string;
  sharedProvenance: BlenderProvenance;
  geometryStats: Record<string, unknown>;
  renders: Array<{
    variantKey: "PLASTIC" | "METAL";
    componentId: string;
    path: string;
    provenance: BlenderProvenance;
    materialAssignment: {
      housingMaterial: "natural-molded-plastic";
      ballMaterial: "natural-molded-plastic" | "mirror-chrome";
    };
  }>;
};

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

function validateBlenderManifest(manifest: BlenderManifest, recipe: ParametricRollerFitmentRecipe): void {
  if (
    manifest.schemaVersion !== 1
    || manifest.recipeId !== recipe.recipeId
    || manifest.geometryFamilyId !== recipe.geometryFamilyId
    || manifest.authorityState !== recipe.authorityState
  ) {
    throw new Error("Blender manifest does not match the parametric roller recipe.");
  }
  const expectedKeys = recipe.variants.map(({ variantKey }) => variantKey);
  const actualKeys = manifest.renders.map(({ variantKey }) => variantKey);
  if (actualKeys.length !== expectedKeys.length || actualKeys.some((key, index) => key !== expectedKeys[index])) {
    throw new Error("Blender manifest must contain PLASTIC then METAL in canonical order.");
  }
  const provenanceKeys: Array<keyof BlenderProvenance> = [
    "meshRecipeHash", "cameraRecipeHash", "studioRecipeHash", "maskRecipeHash",
  ];
  for (const [index, render] of manifest.renders.entries()) {
    const expectedVariant = recipe.variants[index];
    if (
      render.componentId !== expectedVariant.componentId
      || render.materialAssignment.housingMaterial !== expectedVariant.housingMaterial
      || render.materialAssignment.ballMaterial !== expectedVariant.ballMaterial
    ) {
      throw new Error(`${render.variantKey} material assignment differs from the recipe.`);
    }
    for (const key of provenanceKeys) {
      if (!/^[a-f0-9]{64}$/.test(render.provenance[key]) || render.provenance[key] !== manifest.sharedProvenance[key]) {
        throw new Error(`${render.variantKey} ${key} differs from shared Blender provenance.`);
      }
    }
  }
}

async function alphaBytes(png: Buffer): Promise<Buffer> {
  return sharp(png).ensureAlpha().extractChannel("alpha").raw().toBuffer();
}

async function compareAlpha(pngs: Buffer[]) {
  const alphas = await Promise.all(pngs.map(alphaBytes));
  let minimumPairwiseAlphaIou = 1;
  let maximumPairwiseMismatchedPixels = 0;
  for (let leftIndex = 0; leftIndex < alphas.length; leftIndex++) {
    for (let rightIndex = leftIndex + 1; rightIndex < alphas.length; rightIndex++) {
      const left = alphas[leftIndex];
      const right = alphas[rightIndex];
      if (left.length !== right.length) throw new Error("Clamped roller alpha dimensions differ.");
      let intersection = 0;
      let union = 0;
      let mismatched = 0;
      for (let index = 0; index < left.length; index++) {
        const leftOccupied = left[index] > 0;
        const rightOccupied = right[index] > 0;
        if (leftOccupied && rightOccupied) intersection++;
        if (leftOccupied || rightOccupied) union++;
        if (left[index] !== right[index]) mismatched++;
      }
      minimumPairwiseAlphaIou = Math.min(minimumPairwiseAlphaIou, union === 0 ? 1 : intersection / union);
      maximumPairwiseMismatchedPixels = Math.max(maximumPairwiseMismatchedPixels, mismatched);
    }
  }
  return { minimumPairwiseAlphaIou, maximumPairwiseMismatchedPixels };
}

function gptPrompt(variantKey: "PLASTIC" | "METAL"): string {
  const ballInstruction = variantKey === "METAL"
    ? "Change only the roller ball to bright mirror-polished chrome stainless-steel appearance. The housing remains the same natural molded plastic."
    : "Render the roller ball and housing as the same clean natural molded plastic, with believable dielectric highlights and slight edge density.";
  return [
    "SOURCE OF TRUTH: Image 1 and its registered mask define the exact geometry, silhouette, scale, camera, perspective, component position, and manufactured edges.",
    "TASK: Reconstruct the 20-400 roller fitment as a premium commercial studio product image while preserving the supplied geometry exactly.",
    ballInstruction,
    "Improve only material fidelity, physically believable reflections, highlight rolloff, edge clarity, and premium studio-lighting quality.",
    "Do not move, resize, crop, rotate, widen, narrow, tilt, or reinterpret the flange, housing, shoulder, or ball.",
    "Do not add a bottle, cap, background object, plug below the flange, thread, shadow, label, text, dust, seam, or detached island.",
    "The output will be clamped to the exact authority alpha. Generated framing, background, shadow, and alpha are discarded.",
  ].join("\n");
}

async function buildContactSheet(input: Array<{ variantKey: string; png: Buffer }>): Promise<Buffer> {
  const tileWidth = 620;
  const tileHeight = 720;
  const tiles = await Promise.all(input.map(async ({ variantKey, png }) => {
    const component = await sharp(png)
      .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .resize({ width: 520, height: 560, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    const label = Buffer.from(`<svg width="${tileWidth}" height="${tileHeight}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#F5F3EF"/>
      <rect x="1" y="1" width="618" height="718" fill="none" stroke="#C6A15B" stroke-width="2"/>
      <text x="42" y="630" font-family="Arial, sans-serif" font-size="30" font-weight="700" fill="#151515">${variantKey}</text>
      <text x="42" y="670" font-family="Arial, sans-serif" font-size="17" fill="#A5453C">ASSEMBLY-CALIBRATED PROFILE REVIEW · NOT GEOMETRY LOCKED</text>
    </svg>`);
    return sharp(label).composite([{ input: component, left: 50, top: 34 }]).png().toBuffer();
  }));
  return sharp({
    create: { width: tileWidth * tiles.length, height: tileHeight, channels: 4, background: "#151515" },
  }).composite(tiles.map((input, index) => ({ input, left: index * tileWidth, top: 0 }))).png().toBuffer();
}

export async function materializeParametricRollerFitmentCandidate(input: {
  recipePath: string;
  blenderOutputDir: string;
  outputDir: string;
}) {
  const recipeBytes = await readFile(input.recipePath);
  const recipe = parseParametricRollerFitmentRecipe(JSON.parse(recipeBytes.toString("utf8")));
  const blenderManifestPath = path.join(input.blenderOutputDir, "blender-manifest.json");
  const blenderManifestBytes = await readFile(blenderManifestPath);
  const blenderManifest = JSON.parse(blenderManifestBytes.toString("utf8")) as BlenderManifest;
  validateBlenderManifest(blenderManifest, recipe);

  const authorityMaskPath = resolveContained(input.blenderOutputDir, blenderManifest.maskPath);
  const authorityMaskPng = await readFile(authorityMaskPath);
  const maskMetadata = await sharp(authorityMaskPng).metadata();
  if (maskMetadata.width !== recipe.canvas.widthPx || maskMetadata.height !== recipe.canvas.heightPx) {
    throw new Error(`Roller authority mask must be ${recipe.canvas.widthPx}x${recipe.canvas.heightPx}.`);
  }
  await inspectAuthorityMask(authorityMaskPng, { expectedRegions: 1 });

  const clamped = [];
  for (const render of blenderManifest.renders) {
    const renderPng = await readFile(resolveContained(input.blenderOutputDir, render.path));
    const renderMetadata = await sharp(renderPng).metadata();
    if (renderMetadata.width !== recipe.canvas.widthPx || renderMetadata.height !== recipe.canvas.heightPx) {
      throw new Error(`${render.variantKey} render must be ${recipe.canvas.widthPx}x${recipe.canvas.heightPx}.`);
    }
    clamped.push({
      variantKey: render.variantKey,
      componentId: render.componentId,
      png: await clampToAuthorityMask(renderPng, authorityMaskPng),
    });
  }
  const alphaSummary = await compareAlpha(clamped.map(({ png }) => png));

  const clampedDirectory = path.join(input.outputDir, "clamped");
  await mkdir(clampedDirectory, { recursive: true });
  const outputs = [];
  for (const variant of clamped) {
    const outputPath = path.join(clampedDirectory, `${variant.variantKey}.png`);
    await writeFile(outputPath, variant.png);
    outputs.push({
      variantKey: variant.variantKey,
      componentId: variant.componentId,
      path: path.relative(input.outputDir, outputPath),
      sha256: sha256(variant.png),
    });
  }
  const contactSheet = await buildContactSheet(clamped);
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
    geometryCalibration: recipe.geometryCalibration,
    geometry: recipe.geometry,
    blender: {
      version: blenderManifest.blenderVersion,
      manifestPath: path.relative(process.cwd(), blenderManifestPath),
      manifestSha256: sha256(blenderManifestBytes),
      sharedProvenance: blenderManifest.sharedProvenance,
      geometryStats: blenderManifest.geometryStats,
      authorityMaskPath: path.relative(process.cwd(), authorityMaskPath),
      authorityMaskSha256: sha256(authorityMaskPng),
    },
    outputs,
    reviewContactSheet: {
      path: path.relative(input.outputDir, contactSheetPath),
      sha256: sha256(contactSheet),
    },
    summary: {
      variantCount: clamped.length,
      ...alphaSummary,
      geometryLocked: false as const,
      productionPlateEligible: false as const,
      authorityReviewRequired: true as const,
      familyFitRequired: ["boston-round-30ml-20-400", "boston-round-60ml-20-400"],
    },
    gptMaterialPlan: {
      provider: "openai",
      model: "gpt-image-2",
      endpoint: "images/edits",
      quality: "high",
      size: "2080x2288",
      paidGenerationAuthorized: false as const,
      jobs: clamped.map(({ variantKey, componentId }, index) => ({
        variantKey,
        componentId,
        geometryInputPath: outputs[index].path,
        authorityMaskPath: path.relative(input.outputDir, authorityMaskPath),
        prompt: gptPrompt(variantKey),
        outputLifecycleState: "candidate",
        approvalWrites: false,
        placementWrites: false,
        releaseWrites: false,
        sanityWrites: false,
      })),
    },
    interpretation: "The local Blender profile is an assembly-calibrated geometry review candidate. Plastic and metal share byte-identical clamped alpha. GPT Image 2 may regenerate material pixels only after explicit paid authorization; it cannot promote this mask or earn geometry lock.",
    mutationPolicy: {
      localReviewCandidateCreated: true,
      paidGenerationPerformed: false,
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
  const result = await materializeParametricRollerFitmentCandidate({ recipePath, blenderOutputDir, outputDir });
  console.log(JSON.stringify({
    manifestPath: result.manifestPath,
    summary: result.manifest.summary,
    gptMaterialPlan: {
      model: result.manifest.gptMaterialPlan.model,
      jobCount: result.manifest.gptMaterialPlan.jobs.length,
      paidGenerationAuthorized: result.manifest.gptMaterialPlan.paidGenerationAuthorized,
    },
    mutationPolicy: result.manifest.mutationPolicy,
  }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
