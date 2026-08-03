import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  CYL9_CAP_VARIANT_KEYS,
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
