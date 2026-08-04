import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildParametricRollerFitmentPlan,
  parseParametricRollerFitmentRecipe,
} from "./parametricRollerFitment";

const recipePath = "docs/paper-doll-rig/boston-round-roller-fitment-20-400-family-recipe.json";

test("the Boston Round roller recipe records assembly-derived dimensions without claiming supplier CAD", async () => {
  const recipe = parseParametricRollerFitmentRecipe(JSON.parse(await readFile(recipePath, "utf8")));

  assert.equal(recipe.neckFinish, "20-400");
  assert.equal(recipe.authorityState, "assembly-calibrated-profile-review");
  assert.equal(recipe.geometryCalibration.evidenceState, "assembly-derived-estimate-not-supplier-cad");
  assert.equal(recipe.geometryCalibration.sourceBodyDiameterMm, 33);
  assert.equal(recipe.geometryCalibration.measuredBodyWidthPx, 386);
  assert.ok(Math.abs(recipe.geometryCalibration.pixelsPerMm - (386 / 33)) < 1e-9);
  assert.ok(Math.abs(recipe.geometry.flangeOutsideDiameterMm - (210 / (386 / 33))) < 0.01);
  assert.ok(Math.abs(recipe.geometry.visibleHeightMm - (166 / (386 / 33))) < 0.01);
  assert.deepEqual(recipe.variants.map(({ variantKey }) => variantKey), ["PLASTIC", "METAL"]);
  assert.ok(recipe.variants.every(({ housingMaterial }) => housingMaterial === "natural-molded-plastic"));
  assert.deepEqual(recipe.variants.map(({ ballMaterial }) => ballMaterial), ["natural-molded-plastic", "mirror-chrome"]);

  assert.deepEqual(buildParametricRollerFitmentPlan(recipe), {
    recipeId: "boston-round-roller-fitment-20-400-family-v1",
    geometryFamilyId: "fitment__20-400__roller-ball__physical-v1",
    variantKeys: ["PLASTIC", "METAL"],
    authorityState: "assembly-calibrated-profile-review",
    geometryLocked: false,
    productionPlateEligible: false,
    requiresExactAlphaClamp: true,
    paidGenerationAuthorized: false,
    remoteWritesAuthorized: false,
  });
});
test("the roller recipe rejects a material variant that silently changes housing geometry identity", async () => {
  const raw = JSON.parse(await readFile(recipePath, "utf8"));
  raw.variants[1].geometryFamilyId = "fitment__20-400__different";
  assert.throws(() => parseParametricRollerFitmentRecipe(raw), /geometry family/i);
});
