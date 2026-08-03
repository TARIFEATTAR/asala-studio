import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildParametricOvercapRenderPlan,
  parseParametricOvercapFamilyRecipe,
} from "./parametricOvercapFamily";

const recipePath = "docs/paper-doll-rig/rollon-cap-13-415-family-recipe.json";

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
