import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

import sharp from "sharp";

const blender = "/Applications/Blender.app/Contents/MacOS/Blender";
const renderer = path.resolve("scripts/paper-doll/render_parametric_roller_fitment.py");

test("Blender renders one shared 20-400 roller geometry with only the ball material changing", async (context) => {
  try {
    await readFile(blender);
  } catch {
    context.skip("Blender is not installed at the production path.");
    return;
  }

  const temporary = await mkdtemp(path.join(os.tmpdir(), "paper-doll-parametric-roller-"));
  const raw = JSON.parse(await readFile(
    "docs/paper-doll-rig/boston-round-roller-fitment-20-400-family-recipe.json",
    "utf8",
  ));
  raw.render.widthPx = 256;
  raw.render.heightPx = 280;
  raw.render.samples = 1;
  raw.render.targetOccupiedHeightPx = 140;
  const recipePath = path.join(temporary, "recipe.json");
  const outputPath = path.join(temporary, "output");
  await writeFile(recipePath, `${JSON.stringify(raw)}\n`, "utf8");

  const result = spawnSync(blender, [
    "--background",
    "--python", renderer,
    "--",
    "--recipe", recipePath,
    "--out", outputPath,
    "--samples", "1",
  ], { encoding: "utf8", timeout: 120_000 });
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const manifest = JSON.parse(await readFile(path.join(outputPath, "blender-manifest.json"), "utf8"));
  assert.equal(manifest.geometryFamilyId, "fitment__20-400__roller-ball__physical-v1");
  assert.deepEqual(manifest.renders.map(({ variantKey }: { variantKey: string }) => variantKey), ["PLASTIC", "METAL"]);
  assert.ok(manifest.renders.every(({ provenance }: { provenance: unknown }) => (
    JSON.stringify(provenance) === JSON.stringify(manifest.sharedProvenance)
  )));
  assert.deepEqual(manifest.renders.map(({ materialAssignment }: { materialAssignment: unknown }) => materialAssignment), [
    { housingMaterial: "natural-molded-plastic", ballMaterial: "natural-molded-plastic" },
    { housingMaterial: "natural-molded-plastic", ballMaterial: "mirror-chrome" },
  ]);
  assert.equal(manifest.geometryStats.flangeOutsideDiameterMm, raw.geometry.flangeOutsideDiameterMm);
  assert.equal(manifest.geometryStats.visibleHeightMm, raw.geometry.visibleHeightMm);
  assert.equal(manifest.geometryStats.objectCount, 4);

  const { data, info } = await sharp(path.join(outputPath, "geometry-mask.png"))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const occupied: Array<{ x: number; y: number }> = [];
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    if (data[(y * info.width + x) * info.channels + 3] > 0) occupied.push({ x, y });
  }
  assert.ok(occupied.length > 0, "Renderer produced an empty roller authority mask.");
  assert.ok(Math.min(...occupied.map(({ x }) => x)) > 0);
  assert.ok(Math.max(...occupied.map(({ x }) => x)) < info.width - 1);
  assert.ok(Math.min(...occupied.map(({ y }) => y)) > 0);
  assert.ok(Math.max(...occupied.map(({ y }) => y)) < info.height - 1);
});
