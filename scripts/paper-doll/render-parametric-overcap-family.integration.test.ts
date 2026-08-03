import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

import sharp from "sharp";

const blender = "/Applications/Blender.app/Contents/MacOS/Blender";
const renderer = path.resolve("scripts/paper-doll/render_cyl9_cap_family.py");

test("Blender mesh provenance changes when the recipe-owned overcap profile changes", async (context) => {
  try {
    await readFile(blender);
  } catch {
    context.skip("Blender is not installed at the production path.");
    return;
  }
  const temporary = await mkdtemp(path.join(os.tmpdir(), "paper-doll-parametric-overcap-"));
  const raw = JSON.parse(await readFile("docs/paper-doll-rig/rollon-cap-13-415-family-recipe.json", "utf8"));
  raw.render.widthPx = 128;
  raw.render.heightPx = 160;
  raw.render.samples = 1;
  raw.variants = raw.variants.filter((variant: { variantKey: string }) => variant.variantKey === "SBLK");
  const profiles = [
    raw.profileNormalized,
    raw.profileNormalized.map((point: [number, number], index: number) => index === 4 ? [0.47, point[1]] : point),
  ];
  const hashes: string[] = [];
  for (const [index, profile] of profiles.entries()) {
    const recipe = { ...raw, profileNormalized: profile };
    const recipePath = path.join(temporary, `recipe-${index}.json`);
    const outputPath = path.join(temporary, `output-${index}`);
    await writeFile(recipePath, `${JSON.stringify(recipe)}\n`, "utf8");
    const result = spawnSync(blender, [
      "--background",
      "--python", renderer,
      "--",
      "--recipe", recipePath,
      "--out", outputPath,
      "--variants", "SBLK",
      "--samples", "1",
    ], { encoding: "utf8", timeout: 120_000 });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const manifest = JSON.parse(await readFile(path.join(outputPath, "blender-manifest.json"), "utf8"));
    assert.equal(manifest.geometryFamilyId, "closure__13-415__rollon-overcap__physical-v1");
    hashes.push(manifest.sharedProvenance.meshRecipeHash);
  }
  assert.notEqual(hashes[0], hashes[1], "Renderer ignored recipe.profileNormalized and reused hard-coded CYL-9ML geometry.");
});

test("Blender camera preserves transparent side padding for a cap wider than it is tall", async (context) => {
  try {
    await readFile(blender);
  } catch {
    context.skip("Blender is not installed at the production path.");
    return;
  }
  const temporary = await mkdtemp(path.join(os.tmpdir(), "paper-doll-parametric-short-cap-"));
  const raw = JSON.parse(await readFile("docs/paper-doll-rig/short-cap-18-415-family-recipe.json", "utf8"));
  raw.render.widthPx = 128;
  raw.render.heightPx = 160;
  raw.render.samples = 1;
  raw.variants = raw.variants.filter((variant: { variantKey: string }) => variant.variantKey === "SSLV");
  const recipePath = path.join(temporary, "recipe.json");
  const outputPath = path.join(temporary, "output");
  await writeFile(recipePath, `${JSON.stringify(raw)}\n`, "utf8");
  const result = spawnSync(blender, [
    "--background",
    "--python", renderer,
    "--",
    "--recipe", recipePath,
    "--out", outputPath,
    "--variants", "SSLV",
    "--samples", "1",
  ], { encoding: "utf8", timeout: 120_000 });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const { data, info } = await sharp(path.join(outputPath, "geometry-mask.png")).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const occupiedX: number[] = [];
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * info.channels + 3] > 0) occupiedX.push(x);
    }
  }
  assert.ok(occupiedX.length > 0, "Renderer produced an empty authority mask.");
  assert.ok(Math.min(...occupiedX) > 0, "Wide cap touches the left frame edge.");
  assert.ok(Math.max(...occupiedX) < info.width - 1, "Wide cap touches the right frame edge.");
});

test("Blender builds real recessed flute geometry for the 8-425 short-cap review recipe", async (context) => {
  try {
    await readFile(blender);
  } catch {
    context.skip("Blender is not installed at the production path.");
    return;
  }
  const temporary = await mkdtemp(path.join(os.tmpdir(), "paper-doll-parametric-fluted-cap-"));
  const raw = JSON.parse(await readFile("docs/paper-doll-rig/short-fluted-cap-8-425-family-recipe.json", "utf8"));
  raw.render.widthPx = 128;
  raw.render.heightPx = 160;
  raw.render.samples = 1;
  raw.variants = raw.variants.slice(0, 1);
  const recipePath = path.join(temporary, "recipe.json");
  const outputPath = path.join(temporary, "output");
  await writeFile(recipePath, `${JSON.stringify(raw)}\n`, "utf8");
  const result = spawnSync(blender, [
    "--background",
    "--python", renderer,
    "--",
    "--recipe", recipePath,
    "--out", outputPath,
    "--variants", raw.variants[0].variantKey,
    "--samples", "1",
  ], { encoding: "utf8", timeout: 120_000 });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const manifest = JSON.parse(await readFile(path.join(outputPath, "blender-manifest.json"), "utf8"));
  assert.equal(manifest.geometryStats.surfaceProfileKind, "recessed-vertical-flutes");
  assert.equal(manifest.geometryStats.fluteCount, 32);
  assert.ok(manifest.geometryStats.recessedVertexCount > 0, "Fluted recipe produced no recessed mesh vertices.");
  assert.ok(manifest.geometryStats.minimumRadialDeltaMm < 0, "Fluted recipe never moved the wall inward.");
  assert.ok(manifest.geometryStats.maximumRadiusMm <= 6, "Fluted recipe exceeded the verified 12 mm outside diameter.");
});
