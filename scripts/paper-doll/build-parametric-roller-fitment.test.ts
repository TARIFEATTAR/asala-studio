import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import sharp from "sharp";

import { materializeParametricRollerFitmentCandidate } from "./build-parametric-roller-fitment";

async function samplePng(input: {
  width: number;
  height: number;
  occupied: Array<{ x: number; y: number }>;
  color: [number, number, number, number];
  extra?: Array<{ x: number; y: number; color: [number, number, number, number] }>;
}) {
  const data = Buffer.alloc(input.width * input.height * 4);
  for (const { x, y } of input.occupied) data.set(input.color, (y * input.width + x) * 4);
  for (const { x, y, color } of input.extra ?? []) data.set(color, (y * input.width + x) * 4);
  return sharp(data, { raw: { width: input.width, height: input.height, channels: 4 } }).png().toBuffer();
}

test("materializes plastic and metal roller candidates with byte-identical authority alpha", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "paper-doll-roller-materialize-"));
  const recipePath = path.join(temporary, "recipe.json");
  const blenderOutputDir = path.join(temporary, "blender");
  const outputDir = path.join(temporary, "candidate");
  const raw = JSON.parse(await readFile(
    "docs/paper-doll-rig/boston-round-roller-fitment-20-400-family-recipe.json",
    "utf8",
  ));
  raw.render.widthPx = 2080;
  raw.render.heightPx = 2288;
  await writeFile(recipePath, `${JSON.stringify(raw)}\n`, "utf8");
  await mkdir(path.join(blenderOutputDir, "isolated"), { recursive: true });

  const occupied = [];
  for (let y = 1142; y <= 1146; y++) for (let x = 1038; x <= 1042; x++) occupied.push({ x, y });
  const mask = await samplePng({ width: 2080, height: 2288, occupied, color: [255, 255, 255, 255] });
  await writeFile(path.join(blenderOutputDir, "geometry-mask.png"), mask);
  const provenance = {
    meshRecipeHash: "a".repeat(64),
    cameraRecipeHash: "b".repeat(64),
    studioRecipeHash: "c".repeat(64),
    maskRecipeHash: "d".repeat(64),
  };
  const renders = [];
  for (const [index, variant] of raw.variants.entries()) {
    const relativePath = `isolated/${variant.variantKey}.png`;
    await writeFile(path.join(blenderOutputDir, relativePath), await samplePng({
      width: 2080,
      height: 2288,
      occupied,
      color: [70 + index * 90, 80 + index * 60, 90 + index * 30, 255],
      extra: [{ x: 2079, y: 2287, color: [255, 0, 0, 255] }],
    }));
    renders.push({
      variantKey: variant.variantKey,
      componentId: variant.componentId,
      path: relativePath,
      provenance,
      materialAssignment: {
        housingMaterial: variant.housingMaterial,
        ballMaterial: variant.ballMaterial,
      },
    });
  }
  await writeFile(path.join(blenderOutputDir, "blender-manifest.json"), `${JSON.stringify({
    schemaVersion: 1,
    recipeId: raw.recipeId,
    geometryFamilyId: raw.geometryFamilyId,
    authorityState: raw.authorityState,
    blenderVersion: "test",
    maskPath: "geometry-mask.png",
    sharedProvenance: provenance,
    geometryStats: { objectCount: 4 },
    renders,
    mutationPolicy: raw.mutationPolicy,
  })}\n`, "utf8");

  const result = await materializeParametricRollerFitmentCandidate({ recipePath, blenderOutputDir, outputDir });
  assert.equal(result.manifest.summary.variantCount, 2);
  assert.equal(result.manifest.summary.minimumPairwiseAlphaIou, 1);
  assert.equal(result.manifest.summary.maximumPairwiseMismatchedPixels, 0);
  assert.equal(result.manifest.summary.geometryLocked, false);
  assert.equal(result.manifest.summary.productionPlateEligible, false);
  assert.equal(result.manifest.gptMaterialPlan.model, "gpt-image-2");
  assert.equal(result.manifest.gptMaterialPlan.paidGenerationAuthorized, false);
  assert.deepEqual(result.manifest.gptMaterialPlan.jobs.map(({ variantKey }: { variantKey: string }) => variantKey), ["PLASTIC", "METAL"]);
  assert.equal(result.manifest.mutationPolicy.remoteWritesPerformed, false);

  const authorityAlpha = await sharp(mask).ensureAlpha().extractChannel("alpha").raw().toBuffer();
  for (const variant of raw.variants) {
    const output = await readFile(path.join(outputDir, "clamped", `${variant.variantKey}.png`));
    const alpha = await sharp(output).ensureAlpha().extractChannel("alpha").raw().toBuffer();
    assert.deepEqual(alpha, authorityAlpha);
  }
});
