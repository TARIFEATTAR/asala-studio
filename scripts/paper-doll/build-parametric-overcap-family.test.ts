import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import sharp from "sharp";

import { parseParametricOvercapFamilyRecipe } from "../../src/lib/paperDoll/parametricOvercapFamily";
import {
  buildParametricOvercapCandidate,
  materializeParametricOvercapCandidate,
} from "./build-parametric-overcap-family";

async function png(width: number, height: number, pixels: Array<{ x: number; y: number; rgba: [number, number, number, number] }>) {
  const data = Buffer.alloc(width * height * 4);
  for (const pixel of pixels) {
    const offset = (pixel.y * width + pixel.x) * 4;
    data.set(pixel.rgba, offset);
  }
  return sharp(data, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

test("clamps every 13-415 finish to one exact authority alpha without promoting the review candidate", async () => {
  const recipe = parseParametricOvercapFamilyRecipe(JSON.parse(await readFile(
    "docs/paper-doll-rig/rollon-cap-13-415-family-recipe.json",
    "utf8",
  )));
  const maskPixels = [];
  for (let y = 2; y <= 5; y++) for (let x = 2; x <= 5; x++) {
    maskPixels.push({ x, y, rgba: [255, 255, 255, 255] as [number, number, number, number] });
  }
  const authorityMaskPng = await png(8, 8, maskPixels);
  const renders = await Promise.all(recipe.variants.map(async (variant, index) => ({
    variantKey: variant.variantKey,
    png: await png(8, 8, [
      ...maskPixels.map(({ x, y }) => ({ x, y, rgba: [20 + index, 40 + index, 60 + index, 255] as [number, number, number, number] })),
      { x: 7, y: 7, rgba: [255, 0, 0, 255] },
    ]),
  })));

  const result = await buildParametricOvercapCandidate({ recipe, authorityMaskPng, renders });
  assert.equal(result.summary.variantCount, 9);
  assert.equal(result.summary.minimumPairwiseAlphaIou, 1);
  assert.equal(result.summary.maximumPairwiseMismatchedPixels, 0);
  assert.equal(result.summary.physicalDimensionsVerified, true);
  assert.equal(result.summary.geometryLocked, false);
  assert.equal(result.summary.productionPlateEligible, false);
  assert.equal(result.summary.authorityReviewRequired, true);
  assert.equal(result.clamped.length, 9);

  for (const variant of result.clamped) {
    const alpha = await sharp(variant.png).ensureAlpha().extractChannel("alpha").raw().toBuffer();
    const maskAlpha = await sharp(authorityMaskPng).ensureAlpha().extractChannel("alpha").raw().toBuffer();
    assert.deepEqual(alpha, maskAlpha);
  }
});

test("rejects an incomplete render batch before candidate artifacts are created", async () => {
  const recipe = parseParametricOvercapFamilyRecipe(JSON.parse(await readFile(
    "docs/paper-doll-rig/rollon-cap-13-415-family-recipe.json",
    "utf8",
  )));
  const authorityMaskPng = await png(8, 8, [{ x: 3, y: 3, rgba: [255, 255, 255, 255] }]);
  await assert.rejects(
    () => buildParametricOvercapCandidate({ recipe, authorityMaskPng, renders: [] }),
    /exact recipe variant set/i,
  );
});

test("materializes a review-only candidate manifest and clamped files from a Blender batch", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "paper-doll-overcap-materialize-"));
  const recipePath = path.join(temporary, "recipe.json");
  const blenderOutputDir = path.join(temporary, "blender");
  const outputDir = path.join(temporary, "candidate");
  const raw = JSON.parse(await readFile("docs/paper-doll-rig/rollon-cap-13-415-family-recipe.json", "utf8"));
  await writeFile(recipePath, `${JSON.stringify(raw)}\n`, "utf8");
  await mkdir(path.join(blenderOutputDir, "isolated"), { recursive: true });
  const maskPixels = [];
  for (let y = 2; y <= 5; y++) for (let x = 2; x <= 5; x++) {
    maskPixels.push({ x, y, rgba: [255, 255, 255, 255] as [number, number, number, number] });
  }
  await writeFile(path.join(blenderOutputDir, "geometry-mask.png"), await png(8, 8, maskPixels));
  const provenance = {
    meshRecipeHash: "a".repeat(64),
    cameraRecipeHash: "b".repeat(64),
    studioRecipeHash: "c".repeat(64),
    maskRecipeHash: "d".repeat(64),
  };
  const renders = [];
  for (const [index, variant] of raw.variants.entries()) {
    const relativePath = `isolated/${variant.variantKey}.png`;
    await writeFile(path.join(blenderOutputDir, relativePath), await png(8, 8, maskPixels.map(({ x, y }) => ({
      x, y, rgba: [40 + index, 60 + index, 80 + index, 255],
    }))));
    renders.push({ variantKey: variant.variantKey, path: relativePath, provenance, crystals: variant.decoration === "crystal-v1" ? raw.crystalLayout : [] });
  }
  await writeFile(path.join(blenderOutputDir, "blender-manifest.json"), `${JSON.stringify({
    schemaVersion: 1,
    geometryFamilyId: raw.geometryFamilyId,
    blenderVersion: "test",
    maskPath: "geometry-mask.png",
    sharedProvenance: provenance,
    renders,
  })}\n`, "utf8");

  const result = await materializeParametricOvercapCandidate({ recipePath, blenderOutputDir, outputDir });
  assert.equal(result.manifest.summary.minimumPairwiseAlphaIou, 1);
  assert.equal(result.manifest.summary.geometryLocked, false);
  assert.equal(result.manifest.mutationPolicy.remoteWritesPerformed, false);
  const contactSheet = await sharp(result.contactSheetPath).metadata();
  assert.equal(contactSheet.width, 1080);
  assert.equal(contactSheet.height, 1440);
  for (const variant of raw.variants) {
    const bytes = await readFile(path.join(outputDir, "clamped", `${variant.variantKey}.png`));
    assert.ok(bytes.length > 0);
  }
});

test("contact-sheet contain padding stays transparent over the Bone review tile", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "paper-doll-overcap-contact-sheet-"));
  const recipePath = path.join(temporary, "recipe.json");
  const blenderOutputDir = path.join(temporary, "blender");
  const outputDir = path.join(temporary, "candidate");
  const raw = JSON.parse(await readFile("docs/paper-doll-rig/rollon-cap-13-415-family-recipe.json", "utf8"));
  raw.variants = raw.variants.slice(0, 2);
  await writeFile(recipePath, `${JSON.stringify(raw)}\n`, "utf8");
  await mkdir(path.join(blenderOutputDir, "isolated"), { recursive: true });
  const maskPixels = [];
  for (let y = 1; y <= 14; y++) for (let x = 2; x <= 5; x++) {
    maskPixels.push({ x, y, rgba: [255, 255, 255, 255] as [number, number, number, number] });
  }
  await writeFile(path.join(blenderOutputDir, "geometry-mask.png"), await png(8, 16, maskPixels));
  const provenance = {
    meshRecipeHash: "a".repeat(64),
    cameraRecipeHash: "b".repeat(64),
    studioRecipeHash: "c".repeat(64),
    maskRecipeHash: "d".repeat(64),
  };
  const renders = [];
  for (const variant of raw.variants) {
    const relativePath = `isolated/${variant.variantKey}.png`;
    await writeFile(path.join(blenderOutputDir, relativePath), await png(8, 16, maskPixels.map(({ x, y }) => ({
      x, y, rgba: [30, 90, 140, 255],
    }))));
    renders.push({ variantKey: variant.variantKey, path: relativePath, provenance, crystals: [] });
  }
  await writeFile(path.join(blenderOutputDir, "blender-manifest.json"), `${JSON.stringify({
    schemaVersion: 1,
    geometryFamilyId: raw.geometryFamilyId,
    blenderVersion: "test",
    maskPath: "geometry-mask.png",
    sharedProvenance: provenance,
    renders,
  })}\n`, "utf8");

  const result = await materializeParametricOvercapCandidate({ recipePath, blenderOutputDir, outputDir });
  const { data, info } = await sharp(result.contactSheetPath).raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.width, 720);
  assert.equal(info.height, 480);
  const pixel = (x: number, y: number) => Array.from(data.subarray((y * info.width + x) * info.channels, (y * info.width + x) * info.channels + 3));
  assert.deepEqual(pixel(35, 200), [245, 243, 239], "contain padding rendered as an opaque black bar instead of the Bone tile background");
});
