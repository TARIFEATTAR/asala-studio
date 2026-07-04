import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  FAMILY_RIG as NODE_FAMILY_RIG,
  computeRigFitScale as computeNodeRigFitScale,
} from "../../../src/lib/product-image/familyRig";
import {
  FAMILY_RIG as DENO_FAMILY_RIG,
  buildImposedRigBlock,
  computeRigFitScale,
  getFamilyRig,
  getFamilyRigForProduct,
  hasFamilyRig,
} from "./familyRig";

describe("Deno familyRig twin", () => {
  it("keeps family constants numerically identical to the Node rig", () => {
    assert.deepEqual(DENO_FAMILY_RIG.cylinder, NODE_FAMILY_RIG.cylinder);
    assert.deepEqual(DENO_FAMILY_RIG.circle, NODE_FAMILY_RIG.circle);
  });

  it("computes the same Cylinder fit scale as the Node rig", () => {
    const denoScale = computeRigFitScale(DENO_FAMILY_RIG.cylinder, 200, 1000, 2080, 2288);
    const nodeScale = computeNodeRigFitScale(NODE_FAMILY_RIG.cylinder, 200, 1000, 2080, 2288);

    assert.deepEqual(denoScale, nodeScale);
  });

  it("normalizes Tall Cylinder, enables Circle, and falls back to the universal PDP rig", () => {
    assert.equal(getFamilyRig("Tall Cylinder"), DENO_FAMILY_RIG.cylinder);
    assert.equal(hasFamilyRig("Cylinder"), true);
    assert.deepEqual(getFamilyRig("Circle"), DENO_FAMILY_RIG.circle);
    assert.equal(hasFamilyRig("Circle"), true);
    assert.deepEqual(getFamilyRig("Boston Round"), DENO_FAMILY_RIG.defaultPdp);
    assert.equal(hasFamilyRig("Boston Round"), true);
  });

  it("uses measured slim height, not just 9ml capacity, for 13-415 slim 9ml Cylinder sprayers", () => {
    const rig = getFamilyRigForProduct({
      family: "Cylinder",
      bottleCollection: "Cylinder",
      capacityMl: 9,
      heightWithCap: "118 ±2 mm",
      heightWithoutCap: "106 ±2 mm",
      diameter: "18 ±0.5 mm",
      applicator: "Fine Mist Sprayer",
      name: "Tall cylinder design 9ml, 1/3oz Clear glass bottle with shiny black spray.",
      websiteSku: "GBTallCyl9SpryBlkSh",
      sku: "GB-CYL-CLR-9ML-SPR-SBLK",
    });

    assert.ok(rig);
    assert.equal(rig.profileId, "cylinder-standard");
    assert.equal(rig.relativeScaleZoneId, "standard-cylinder");
    assert.equal(rig.fillHeightPct, 76);
    assert.equal(rig.fillHeightRangePct?.min, 72);
    assert.equal(rig.fillHeightRangePct?.max, 78);
  });

  it("keeps 5ml short Cylinder sprayers below regular 9ml roll-ons and slim 9ml sprayers", () => {
    const fiveMl = getFamilyRigForProduct({
      family: "Cylinder",
      bottleCollection: "Cylinder",
      capacityMl: 5,
      heightWithCap: "72 ±1 mm",
      heightWithoutCap: "53 ±1 mm",
      diameter: "17 ±0.5 mm",
      applicator: "Fine Mist Sprayer",
      name: "Cylinder design 5ml clear glass bottle with shiny black spray.",
      websiteSku: "GBCyl5SpryBlkSh",
      sku: "GB-CYL-CLR-5ML-SPR-SBLK",
    });
    const regular9Ml = getFamilyRigForProduct({
      family: "Cylinder",
      bottleCollection: "Cylinder",
      capacityMl: 9,
      heightWithCap: "83 ±1 mm",
      heightWithoutCap: "70 ±1 mm",
      diameter: "20 ±0.5 mm",
      applicator: "Plastic Roller Ball",
      name: "Cylinder design 9ml clear glass bottle with plastic roller ball plug and black dot cap.",
      websiteSku: "GBCyl9RollBlkDot",
      sku: "GB-CYL-CLR-9ML-T-11",
    });
    const slim9Ml = getFamilyRigForProduct({
      family: "Cylinder",
      bottleCollection: "Cylinder",
      capacityMl: 9,
      heightWithCap: "126 ±2 mm",
      heightWithoutCap: "106 ±2 mm",
      diameter: "18 ±0.5 mm",
      applicator: "Fine Mist Sprayer",
      name: "Tall cylinder design 9ml clear glass bottle with shiny black spray.",
      websiteSku: "GBTallCyl9SpryBlkSh",
      sku: "GB-CYL-CLR-9ML-SPR-SBLK",
    });

    assert.ok(fiveMl);
    assert.ok(regular9Ml);
    assert.ok(slim9Ml);
    assert.equal(fiveMl.relativeScaleZoneId, "small-cylinder");
    assert.equal(fiveMl.fillHeightRangePct?.min, 60);
    assert.equal(fiveMl.fillHeightRangePct?.max, 64);
    assert.equal(fiveMl.fillHeightPct, 62);
    assert.ok(fiveMl.fillHeightPct < regular9Ml.fillHeightPct);
    assert.ok(regular9Ml.fillHeightPct < slim9Ml.fillHeightPct);
  });

  it("builds the same imposed rig language shape for edge prompts", () => {
    const block = buildImposedRigBlock({
      family: "Cylinder",
      capState: "assembled",
    });

    assert.ok(block);
    assert.equal(DENO_FAMILY_RIG.cylinder.fillHeightPct, 76);
    assert.match(block, /IMPOSED STUDIO RIG/);
    assert.match(block, /visible bottom contact pixels/i);
    assert.match(block, /Do not lift the bottle base above this shelf line/i);
    assert.match(block, /resolved Cylinder PDP framing target/i);
    assert.match(block, /~76% of the canvas height and ~62% of the width/);
    assert.match(block, /FINAL ALIGNMENT QA/);
    assert.doesNotMatch(block, /Do NOT vary the on-canvas size by ml capacity/i);
  });

  it("builds detached Circle cap-off assembly guidance for edge prompts", () => {
    const block = buildImposedRigBlock({
      family: "Circle",
      capState: "detached",
    });

    assert.ok(block);
    assert.match(block, /CIRCLE/);
    assert.match(block, /primary bottle BODY centered on the canvas vertical centerline/i);
    assert.match(block, /sidecar zone/i);
    assert.match(block, /does not shift the primary bottle/i);
    assert.match(block, /detached pump, applicator, wand, dropper, or closure outside the bottle/i);
    assert.match(block, /must not be duplicated inside the bottle/i);
    assert.match(block, /same horizontal baseline/i);
    assert.match(block, /no sibling variant may float higher/i);
    assert.match(block, /6-10% of canvas width/i);
    assert.match(block, /roller ball plug seated on the bottle neck centerline/i);
    assert.match(block, /over-cap upright to the right/i);
  });

  it("guards edge cap-off sprayers against duplicate loose caps", () => {
    const block = buildImposedRigBlock({
      family: "Cylinder",
      capState: "detached",
    });

    assert.ok(block);
    assert.match(block, /bottle top is the exposed sprayer/i);
    assert.match(block, /only detached object is the matching over-cap/i);
    assert.match(block, /Do not render a second loose cap/i);
  });

  it("builds universal PDP rig language for non-custom families on the edge", () => {
    const block = buildImposedRigBlock({
      family: "Decorative",
      capState: "assembled",
    });

    assert.ok(block);
    assert.equal(DENO_FAMILY_RIG.defaultPdp.fillHeightPct, 67);
    assert.match(block, /UNIVERSAL PDP/);
    assert.match(block, /~67% of the canvas height and ~60% of the width/);
    assert.doesNotMatch(block, /Do NOT vary the on-canvas size by ml capacity/i);
  });
});
