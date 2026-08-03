import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  CYL9_CAP_VARIANT_KEYS,
  parseCyl9BlenderManifest,
  parseCyl9CapFamilyRecipe,
  solveCyl9CapPlacement,
} from "./cyl9CapFamily";

const RECIPE_PATH = "docs/paper-doll-rig/cyl9-cap-family-recipe.json";

async function loadRecipe() {
  return parseCyl9CapFamilyRecipe(JSON.parse(await readFile(RECIPE_PATH, "utf8")));
}

test("recipe contains the exact ten catalog cap keys", async () => {
  const recipe = await loadRecipe();

  assert.deepEqual(
    recipe.variants.map(({ variantKey }) => variantKey),
    CYL9_CAP_VARIANT_KEYS,
  );
  assert.equal(new Set(recipe.variants.map(({ variantKey }) => variantKey)).size, 10);
});

test("silver calibration is one uniform pixel narrower with the seat unchanged", async () => {
  const recipe = await loadRecipe();
  const placed = solveCyl9CapPlacement(1400, 2050, recipe);

  assert.equal(placed.width, 362);
  assert.equal(placed.left + placed.rightExclusive, 2082);
  assert.equal(placed.bottomExclusive, 1002);
});

test("recipe rejects duplicate or missing catalog variants", async () => {
  const recipe = await loadRecipe();
  const invalid = {
    ...recipe,
    variants: [...recipe.variants.slice(0, -1), recipe.variants[0]],
  };

  assert.throws(
    () => parseCyl9CapFamilyRecipe(invalid),
    /exact ten catalog variant keys/i,
  );
});

test("recipe rejects non-canonical placement values", async () => {
  const recipe = await loadRecipe();

  assert.throws(
    () => parseCyl9CapFamilyRecipe({
      ...recipe,
      placement: { ...recipe.placement, widthPx: 363 },
    }),
    /362 px/i,
  );
});

function blenderManifestFixture() {
  const provenance = {
    meshRecipeHash: "a".repeat(64),
    cameraRecipeHash: "b".repeat(64),
    studioRecipeHash: "c".repeat(64),
    maskRecipeHash: "d".repeat(64),
  };
  return {
    schemaVersion: 1,
    geometryFamilyId: "closure__17-415__rollon-overcap__v2",
    blenderVersion: "5.2.0",
    maskPath: "geometry-mask.png",
    sharedProvenance: provenance,
    renders: [
      { variantKey: "SSLV", path: "isolated/SSLV.png", provenance, crystals: [] },
      { variantKey: "MSLV", path: "isolated/MSLV.png", provenance, crystals: [] },
    ],
  };
}

test("renderer provenance accepts cap renders from one shared authority", () => {
  const manifest = parseCyl9BlenderManifest(blenderManifestFixture());

  assert.equal(manifest.renders.length, 2);
  assert.equal(manifest.renders[0].provenance.meshRecipeHash, "a".repeat(64));
});

test("renderer provenance rejects any camera drift from SSLV", () => {
  const fixture = blenderManifestFixture();
  fixture.renders[1] = {
    ...fixture.renders[1],
    provenance: {
      ...fixture.renders[1].provenance,
      cameraRecipeHash: "e".repeat(64),
    },
  };

  assert.throws(
    () => parseCyl9BlenderManifest(fixture),
    /MSLV.*cameraRecipeHash.*SSLV/i,
  );
});
