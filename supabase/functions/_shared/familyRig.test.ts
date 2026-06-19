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

  it("normalizes Tall Cylinder, enables Circle, and skips non-rig families", () => {
    assert.equal(getFamilyRig("Tall Cylinder"), DENO_FAMILY_RIG.cylinder);
    assert.equal(hasFamilyRig("Cylinder"), true);
    assert.deepEqual(getFamilyRig("Circle"), DENO_FAMILY_RIG.circle);
    assert.equal(hasFamilyRig("Circle"), true);
    assert.equal(hasFamilyRig("Boston Round"), false);
  });

  it("builds the same imposed rig language shape for edge prompts", () => {
    const block = buildImposedRigBlock({
      family: "Cylinder",
      capState: "assembled",
    });

    assert.ok(block);
    assert.match(block, /IMPOSED STUDIO RIG/);
    assert.match(block, /SAME generous size/i);
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
});
