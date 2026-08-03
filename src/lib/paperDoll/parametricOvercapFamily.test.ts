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
const tallCap18415RecipePath = "docs/paper-doll-rig/tall-cap-18-415-family-recipe.json";
const tallCap8425RecipePath = "docs/paper-doll-rig/tall-cap-8-425-family-recipe.json";
const shortFlutedCap8425RecipePath = "docs/paper-doll-rig/short-fluted-cap-8-425-family-recipe.json";
const tallRollonCap20400RecipePath = "docs/paper-doll-rig/tall-rollon-cap-20-400-family-recipe.json";
const fauxLeatherCap18415RecipePath = "docs/paper-doll-rig/faux-leather-cap-18-415-family-recipe.json";
const shortFlutedCap20400RecipePath = "docs/paper-doll-rig/short-fluted-cap-20-400-family-recipe.json";
const shortFlutedCap18400RecipePath = "docs/paper-doll-rig/short-fluted-cap-18-400-family-recipe.json";

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
    /source identities and aliases must be unique/i,
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

test("18-415 tall-cap recipe preserves the verified 21 by 26 mm family", async () => {
  const recipe = parseParametricOvercapFamilyRecipe(JSON.parse(await readFile(tallCap18415RecipePath, "utf8")));
  assert.equal(recipe.geometryFamilyId, "closure__18-415__tall-overcap__physical-v1");
  assert.equal(recipe.authorityReviewGroupKey, "geometry-review__cap__18-415__6137704566");
  assert.deepEqual(recipe.nominalDimensionsMm, {
    outsideDiameter: 21,
    outsideDiameterTolerance: 0.5,
    height: 26,
    heightTolerance: 0.5,
    verified: true,
  });
  assert.deepEqual(recipe.variants.map((variant) => [variant.variantKey, variant.sourceIdentity, variant.graceSku]), [
    ["MSLV", "CP18-415MtSlTall", "CMP-CAP-MSLV-18415-T"],
    ["SBLK", "CP18-415ShnBlkTall", "CMP-CAP-SBLK-18415-T"],
  ]);
});

test("8-425 tall-cap recipe preserves the verified 11 by 16 mm family", async () => {
  const recipe = parseParametricOvercapFamilyRecipe(JSON.parse(await readFile(tallCap8425RecipePath, "utf8")));
  assert.equal(recipe.geometryFamilyId, "closure__8-425__tall-overcap__physical-v1");
  assert.equal(recipe.authorityReviewGroupKey, "geometry-review__cap__8-425__840de1544d");
  assert.deepEqual(recipe.nominalDimensionsMm, {
    outsideDiameter: 11,
    outsideDiameterTolerance: 0.5,
    height: 16,
    heightTolerance: 0.5,
    verified: true,
  });
  assert.deepEqual(recipe.variants.map((variant) => [variant.variantKey, variant.sourceIdentity, variant.graceSku]), [
    ["SBLK", "CP8-425TallBlack", "CMP-CAP-BLK-8425-T"],
    ["SGLD", "CP8-425TallShnGl", "CMP-CAP-SGLD-8425-T"],
    ["SSLV", "CP8-425TallShnSl", "CMP-CAP-SSLV-8425-T"],
  ]);
});

test("8-425 short-cap recipe preserves the verified flange and source-derived recessed flutes", async () => {
  const recipe = parseParametricOvercapFamilyRecipe(JSON.parse(await readFile(shortFlutedCap8425RecipePath, "utf8")));
  assert.equal(recipe.geometryFamilyId, "closure__8-425__short-fluted-cap__physical-v1");
  assert.equal(recipe.authorityReviewGroupKey, "geometry-review__cap__8-425__b0a7b8c0cf");
  assert.deepEqual(recipe.nominalDimensionsMm, {
    outsideDiameter: 12,
    outsideDiameterTolerance: 0.5,
    height: 9,
    heightTolerance: 0.1,
    verified: true,
  });
  assert.deepEqual(recipe.surfaceProfile, {
    kind: "recessed-vertical-flutes",
    fluteCount: 32,
    fluteDepthRatio: 0.018,
    startHeightRatio: 0.12,
    endHeightRatio: 0.91,
    fadeRatio: 0.035,
    phaseDeg: 0,
    evidenceState: "source-derived-review-candidate",
  });
  assert.deepEqual(recipe.variants.map((variant) => [variant.variantKey, variant.sourceIdentity, variant.graceSku]), [
    ["BLK", "8-425CpShortBlack", "CMP-CAP-BLK-8-425"],
    ["WHT", "8-425CpShortWhite", "CMP-CAP-WHT-8-425"],
  ]);
});

test("parametric contract rejects a fluted surface whose fade zones overlap", async () => {
  const raw = JSON.parse(await readFile(shortFlutedCap8425RecipePath, "utf8"));
  raw.surfaceProfile.startHeightRatio = 0.4;
  raw.surfaceProfile.endHeightRatio = 0.5;
  raw.surfaceProfile.fadeRatio = 0.06;
  assert.throws(() => parseParametricOvercapFamilyRecipe(raw), /fade zones must fit/i);
});

test("20-400 tall roll-on recipe preserves six verified 23 by 35 mm appearances", async () => {
  const recipe = parseParametricOvercapFamilyRecipe(JSON.parse(await readFile(tallRollonCap20400RecipePath, "utf8")));
  assert.equal(recipe.geometryFamilyId, "closure__20-400__tall-rollon-overcap__physical-v1");
  assert.equal(recipe.authorityReviewGroupKey, "geometry-review__cap__20-400__50b30653ff");
  assert.deepEqual(recipe.nominalDimensionsMm, {
    outsideDiameter: 23,
    outsideDiameterTolerance: 0.5,
    height: 35,
    heightTolerance: 0.5,
    verified: true,
  });
  assert.deepEqual(recipe.variants.map((variant) => [variant.variantKey, variant.sourceIdentity, variant.graceSku, variant.material]), [
    ["MBLK", "CPRoll20-400TallMattBlk", "CMP-ROC-MBLK-20400-T", "matte-black"],
    ["MGLD", "CPRoll20-400TallMattGl", "CMP-ROC-MGLD-20400-T", "matte-gold"],
    ["MSLV", "CPRoll20-400TallMattSl", "CMP-ROC-MSLV-20400-T", "matte-silver"],
    ["SBLK", "CPRoll20-400TallShnBlk", "CMP-ROC-SBLK-20400-T", "glossy-black"],
    ["SGLD", "CPRoll20-400TallShnGl", "CMP-ROC-SGLD-20400-T", "mirror-gold"],
    ["SSLV", "CPRoll20-400TallShnSl", "CMP-ROC-SSLV-20400-T", "mirror-silver"],
  ]);
  assert.equal(recipe.surfaceProfile.kind, "smooth");
  assert.equal(recipe.mutationPolicy.remoteWritesPerformed, false);
});

test("18-415 faux-leather recipe preserves one 25 by 30 mm shell with five material and trim combinations", async () => {
  const recipe = parseParametricOvercapFamilyRecipe(JSON.parse(await readFile(fauxLeatherCap18415RecipePath, "utf8")));
  assert.equal(recipe.geometryFamilyId, "closure__18-415__faux-leather-cap__physical-v1");
  assert.equal(recipe.authorityReviewGroupKey, "geometry-review__cap__18-415__a49d784871");
  assert.deepEqual(recipe.nominalDimensionsMm, {
    outsideDiameter: 25,
    outsideDiameterTolerance: 0.5,
    height: 30,
    heightTolerance: 0.5,
    verified: true,
  });
  assert.deepEqual(recipe.trimBands, [
    { startHeightRatio: 0, endHeightRatio: 0.18, evidenceState: "source-derived-review-candidate" },
    { startHeightRatio: 0.82, endHeightRatio: 1, evidenceState: "source-derived-review-candidate" },
  ]);
  assert.deepEqual(recipe.variants.map((variant) => [
    variant.variantKey,
    variant.sourceIdentity,
    variant.graceSku,
    variant.material,
    variant.trimMaterial,
  ]), [
    ["BLKL", "CP18-415BlkLthr", "CMP-CAP-BLK-18415-LTR", "faux-leather-black", "mirror-silver"],
    ["BRNL", "CP18-415BrwnLthr", "CMP-CAP-BRN-18415-LTR", "faux-leather-brown", "mirror-silver"],
    ["LBRL", "CP18-415LBrwnLthr", "CMP-CAP-LBRN-18415-LTR", "faux-leather-light-brown", "mirror-silver"],
    ["IVYL", "CP18-415LIvyLthr", "CMP-CAP-IVY-18415-LTR", "faux-leather-ivory", "mirror-gold"],
    ["PNKL", "CP18-415LPnkLthr", "CMP-CAP-PNK-18415-LTR", "faux-leather-pink", "mirror-gold"],
  ]);
});

test("parametric contract rejects trim materials without declared trim geometry", async () => {
  const raw = JSON.parse(await readFile(tallRollonCap20400RecipePath, "utf8"));
  raw.variants[0].trimMaterial = "mirror-silver";
  assert.throws(() => parseParametricOvercapFamilyRecipe(raw), /trim material requires declared trim bands/i);
});

test("20-400 short-cap recipe preserves two source identities as aliases of one 23 by 12 mm output", async () => {
  const recipe = parseParametricOvercapFamilyRecipe(JSON.parse(await readFile(shortFlutedCap20400RecipePath, "utf8")));
  assert.equal(recipe.geometryFamilyId, "closure__20-400__short-fluted-cap__physical-v1");
  assert.equal(recipe.authorityReviewGroupKey, "geometry-review__cap__20-400__75550d33bd");
  assert.deepEqual(recipe.nominalDimensionsMm, {
    outsideDiameter: 23,
    outsideDiameterTolerance: 0.5,
    height: 12,
    heightTolerance: 0.5,
    verified: true,
  });
  assert.equal(recipe.variants.length, 1);
  assert.deepEqual(recipe.variants[0].sourceIdentityAliases, ["20-400cp1ozShortBlk"]);
  assert.equal(recipe.surfaceProfile.kind, "recessed-vertical-flutes");
  assert.equal(buildParametricOvercapRenderPlan(recipe).variantCount, 1);
});

test("18-400 short-cap recipe preserves the measured 21 by 11 mm fluted profile", async () => {
  const recipe = parseParametricOvercapFamilyRecipe(JSON.parse(await readFile(shortFlutedCap18400RecipePath, "utf8")));
  assert.equal(recipe.geometryFamilyId, "closure__18-400__short-fluted-cap__physical-v1");
  assert.equal(recipe.authorityReviewGroupKey, "geometry-review__cap__18-400__075c71e858");
  assert.deepEqual(recipe.nominalDimensionsMm, {
    outsideDiameter: 21,
    outsideDiameterTolerance: 0.5,
    height: 11,
    heightTolerance: 0.5,
    verified: true,
  });
  assert.deepEqual(recipe.variants.map((variant) => [variant.variantKey, variant.sourceIdentity, variant.graceSku]), [
    ["BLK", "18-400CpShortBlk", "CMP-CAP-BLK-18-400"],
  ]);
  assert.equal(recipe.surfaceProfile.kind, "recessed-vertical-flutes");
  assert.equal(buildParametricOvercapRenderPlan(recipe).variantCount, 1);
});

test("parametric contract rejects a source identity repeated through an alias", async () => {
  const raw = JSON.parse(await readFile(fauxLeatherCap18415RecipePath, "utf8"));
  raw.variants[1].sourceIdentityAliases = [raw.variants[0].sourceIdentity];
  assert.throws(() => parseParametricOvercapFamilyRecipe(raw), /source identities and aliases must be unique/i);
});
