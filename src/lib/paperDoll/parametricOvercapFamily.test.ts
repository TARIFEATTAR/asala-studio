import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildParametricOvercapRenderPlan,
  parseParametricOvercapFamilyRecipe,
} from "./parametricOvercapFamily";

const recipePath = "docs/paper-doll-rig/rollon-cap-13-415-family-recipe.json";
const standardCapRecipePath = "docs/paper-doll-rig/standard-cap-13-415-family-recipe.json";
const standardCap15415RecipePath = "docs/paper-doll-rig/standard-cap-15-415-family-recipe.json";
const shortCap18415RecipePath = "docs/paper-doll-rig/short-cap-18-415-family-recipe.json";

test("13-415 roll-on recipe resolves nine catalog appearances onto one dimension-calibrated geometry candidate", async () => {
  const recipe = parseParametricOvercapFamilyRecipe(JSON.parse(await readFile(recipePath, "utf8")));
  assert.equal(recipe.geometryFamilyId, "closure__13-415__rollon-overcap__physical-v1");
  assert.deepEqual(recipe.nominalDimensionsMm, {
    outsideDiameter: 17,
    outsideDiameterTolerance: 0.5,
    height: 24,
    heightTolerance: 0.5,
    verified: true,
  });
  assert.deepEqual(recipe.variants.map((variant) => variant.sourceIdentity), [
    "CPRoll13-415BlackDot",
    "CPRoll13-415BlkSh",
    "CPRoll13-415Cu",
    "CPRoll13-415GlMt",
    "CPRoll13-415GlSh",
    "CPRoll13-415PinkDot",
    "CPRoll13-415SlDot",
    "CPRoll13-415SlMt",
    "CPRoll13-415SlSh",
  ]);
  assert.equal(new Set(recipe.variants.map((variant) => variant.geometryFamilyId)).size, 1);
});

test("render plan preserves one mesh camera mask and geometry candidate state for every finish", async () => {
  const recipe = parseParametricOvercapFamilyRecipe(JSON.parse(await readFile(recipePath, "utf8")));
  const plan = buildParametricOvercapRenderPlan(recipe);
  assert.equal(plan.variantCount, 9);
  assert.deepEqual(plan.variantKeys, ["BKDT", "SBLK", "MCPR", "MGLD", "SGLD", "PKDT", "SLDT", "MSLV", "SSLV"]);
  assert.equal(plan.authorityState, "dimension-calibrated-profile-review");
  assert.equal(plan.geometryLocked, false);
  assert.equal(plan.productionPlateEligible, false);
  assert.equal(plan.requiresExactAlphaClamp, true);
  assert.equal(plan.remoteWritesAuthorized, false);
});

test("recipe rejects duplicate catalog identities instead of silently collapsing appearances", async () => {
  const raw = JSON.parse(await readFile(recipePath, "utf8"));
  raw.variants[1].sourceIdentity = raw.variants[0].sourceIdentity;
  assert.throws(
    () => parseParametricOvercapFamilyRecipe(raw),
    /source identities must be unique/i,
  );
});

test("parametric contract accepts a different verified measured cap family", async () => {
  const raw = JSON.parse(await readFile(recipePath, "utf8"));
  raw.recipeId = "measured-cap-19x30-v1";
  raw.familyKey = "MEASURED-CAP-19X30";
  raw.neckFinish = "18-415";
  raw.geometryFamilyId = "closure__18-415__measured-overcap__physical-v1";
  raw.physicalTruthSource.websiteSku = "MEASURED-19X30";
  raw.physicalTruthSource.fields = {
    heightWithCap: "30 ±0.25 mm",
    diameter: "19 ±0.2 mm",
  };
  raw.nominalDimensionsMm = {
    outsideDiameter: 19,
    outsideDiameterTolerance: 0.2,
    height: 30,
    heightTolerance: 0.25,
    verified: true,
  };
  raw.geometryCalibration.derivedFrom = "verified-drawing-plus-source-profile-v1";
  raw.variants = raw.variants.slice(0, 1).map((variant: Record<string, unknown>) => ({
    ...variant,
    geometryFamilyId: raw.geometryFamilyId,
  }));
  raw.crystalLayout = [];
  raw.variants[0].decoration = "none";

  const recipe = parseParametricOvercapFamilyRecipe(raw);
  assert.deepEqual(recipe.nominalDimensionsMm, {
    outsideDiameter: 19,
    outsideDiameterTolerance: 0.2,
    height: 30,
    heightTolerance: 0.25,
    verified: true,
  });
  assert.equal(recipe.physicalTruthSource.fields.heightWithCap, "30 ±0.25 mm");
});

test("parametric contract rejects physical-truth text that disagrees with nominal dimensions", async () => {
  const raw = JSON.parse(await readFile(recipePath, "utf8"));
  raw.physicalTruthSource.fields.diameter = "19 ±0.5 mm";

  assert.throws(
    () => parseParametricOvercapFamilyRecipe(raw),
    /diameter field must match nominal dimensions/i,
  );
});

test("13-415 standard-cap recipe preserves its two catalog identities as a separate geometry candidate", async () => {
  const recipe = parseParametricOvercapFamilyRecipe(JSON.parse(await readFile(standardCapRecipePath, "utf8")));
  assert.equal(recipe.geometryFamilyId, "closure__13-415__standard-overcap__physical-v1");
  assert.equal(recipe.authorityReviewGroupKey, "geometry-review__cap__13-415__bd7f336278");
  assert.deepEqual(recipe.variants.map((variant) => [variant.variantKey, variant.sourceIdentity, variant.graceSku]), [
    ["SGLD", "CP13-415Gl", "CMP-CAP-SGLD-13-415-01"],
    ["SSLV", "CP13-415Sl", "CMP-CAP-SLV-13-415-01"],
  ]);
  assert.equal(new Set(recipe.variants.map((variant) => variant.geometryFamilyId)).size, 1);
  assert.equal(recipe.mutationPolicy.remoteWritesPerformed, false);
});

test("15-415 standard-cap recipe preserves the verified 19 by 32 mm family", async () => {
  const recipe = parseParametricOvercapFamilyRecipe(JSON.parse(await readFile(standardCap15415RecipePath, "utf8")));
  assert.equal(recipe.geometryFamilyId, "closure__15-415__standard-overcap__physical-v1");
  assert.equal(recipe.authorityReviewGroupKey, "geometry-review__cap__15-415__6962075287");
  assert.deepEqual(recipe.nominalDimensionsMm, {
    outsideDiameter: 19,
    outsideDiameterTolerance: 0.5,
    height: 32,
    heightTolerance: 0.5,
    verified: true,
  });
  assert.deepEqual(recipe.variants.map((variant) => [variant.variantKey, variant.sourceIdentity, variant.graceSku]), [
    ["SGLD", "CP15-415ShnGl", "CMP-CAP-SGLD-15-415"],
    ["SSLV", "CP15-415ShnSl", "CMP-CAP-SSLV-15-415"],
  ]);
  assert.equal(recipe.mutationPolicy.remoteWritesPerformed, false);
});

test("18-415 short-cap recipe preserves the verified 21 by 19 mm family", async () => {
  const recipe = parseParametricOvercapFamilyRecipe(JSON.parse(await readFile(shortCap18415RecipePath, "utf8")));
  assert.equal(recipe.geometryFamilyId, "closure__18-415__short-overcap__physical-v1");
  assert.equal(recipe.authorityReviewGroupKey, "geometry-review__cap__18-415__5ef8879454");
  assert.deepEqual(recipe.nominalDimensionsMm, {
    outsideDiameter: 21,
    outsideDiameterTolerance: 0.5,
    height: 19,
    heightTolerance: 0.5,
    verified: true,
  });
  assert.deepEqual(recipe.variants.map((variant) => [variant.variantKey, variant.sourceIdentity, variant.graceSku]), [
    ["MSLV", "CP18-415MtSl", "CMP-CAP-MSLV-18415-S"],
    ["SGLD", "CP18-415ShnGl", "CMP-CAP-SGLD-18415-S"],
    ["SSLV", "CP18-415ShnSl", "CMP-CAP-SSLV-18415-S"],
  ]);
});
