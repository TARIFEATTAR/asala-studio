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

  it("builds the same imposed rig language shape for edge prompts", () => {
    const block = buildImposedRigBlock({
      family: "Cylinder",
      capState: "assembled",
    });

    assert.ok(block);
    assert.equal(DENO_FAMILY_RIG.cylinder.fillHeightPct, 72);
    assert.match(block, /IMPOSED STUDIO RIG/);
    assert.match(block, /visible bottom contact pixels/i);
    assert.match(block, /Do not lift the bottle base above this shelf line/i);
    assert.match(block, /balanced, inspectable, CONSISTENT PDP catalog size/i);
    assert.match(block, /~72% of the canvas height and ~62% of the width/);
    assert.match(block, /FINAL ALIGNMENT QA/);
    assert.match(block, /Do NOT vary the on-canvas size by ml capacity/i);
  });

  it("builds detached Circle cap-off assembly guidance for edge prompts", () => {
    const block = buildImposedRigBlock({
      family: "Circle",
      capState: "detached",
    });

    assert.ok(block);
    assert.match(block, /CIRCLE/);
    assert.match(block, /ONE two-object assembly/);
    assert.match(block, /bottle\+cap assembly is visually centered/i);
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
    assert.match(block, /Do NOT vary the on-canvas size by ml capacity/i);
  });
});
