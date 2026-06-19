import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  FAMILY_RIG,
  buildImposedRigBlock,
  computeRigFitScale,
  getFamilyRig,
  hasFamilyRig,
} from "./familyRig";

const approx = (a: number, b: number) => Math.abs(a - b) < 1e-6;

describe("family rig (size-agnostic, fit-to-box)", () => {
  const W = 2080;
  const H = 2288;

  it("fit-to-box binds on height for a tall, narrow assembly", () => {
    const cfg = FAMILY_RIG.cylinder; // fillHeightPct 80, fillWidthPct 60
    const scale = computeRigFitScale(cfg, 200, 1000, W, H);
    assert.ok(approx(scale, (cfg.fillHeightPct / 100) * H / 1000));
  });

  it("fit-to-box binds on width for a short, wide assembly", () => {
    const cfg = FAMILY_RIG.cylinder;
    const scale = computeRigFitScale(cfg, 1500, 300, W, H);
    assert.ok(approx(scale, (cfg.fillWidthPct / 100) * W / 1500));
  });

  it("fit-to-box always contains (takes the smaller scale)", () => {
    const cfg = FAMILY_RIG.cylinder;
    const scale = computeRigFitScale(cfg, 1500, 1000, W, H);
    const sH = (cfg.fillHeightPct / 100) * H / 1000;
    const sW = (cfg.fillWidthPct / 100) * W / 1500;
    assert.ok(approx(scale, Math.min(sH, sW)));
  });

  it("normalizes Tall Cylinder to the Cylinder rig and enables Circle", () => {
    assert.equal(getFamilyRig("Tall Cylinder"), FAMILY_RIG.cylinder);
    assert.equal(hasFamilyRig("Tall Cylinder"), true);
    assert.deepEqual(getFamilyRig("Circle"), FAMILY_RIG.circle);
    assert.equal(hasFamilyRig("Circle"), true);
    assert.equal(hasFamilyRig("Boston Round"), false);
  });

  it("builds a size-agnostic imposed rig block with composition authority", () => {
    const block = buildImposedRigBlock({ family: "Cylinder", capState: "assembled" });

    assert.ok(block);
    assert.match(block, /IMPOSED STUDIO RIG/);
    assert.match(block, /SUPERSEDES/);
    assert.match(block, /12.?14% up from the canvas bottom/);
    assert.match(block, /FINAL ALIGNMENT QA/);
    // Size is NOT encoded by capacity — that's the display layer's job.
    assert.match(block, /Do NOT vary the on-canvas size by ml capacity/i);
  });

  it("places a detached cap to the right for cap-off composition", () => {
    const block = buildImposedRigBlock({ family: "Cylinder", capState: "detached" });

    assert.ok(block);
    assert.match(block, /DETACHED cap upright to the RIGHT/);
    assert.match(block, /ONE two-object assembly/);
    assert.match(block, /bottle\+cap assembly is visually centered/i);
    assert.match(block, /same horizontal baseline/i);
    assert.match(block, /no sibling variant may float higher/i);
    assert.match(block, /6-10% of canvas width/i);
    assert.match(block, /roller ball plug seated on the bottle neck centerline/i);
    assert.match(block, /over-cap upright to the right/i);
  });

  it("builds a Circle rig with a wider round-bottle envelope", () => {
    const block = buildImposedRigBlock({ family: "Circle", capState: "detached" });

    assert.ok(block);
    assert.match(block, /IMPOSED STUDIO RIG/);
    assert.match(block, /CIRCLE/);
    assert.match(block, /~78% of the canvas height and ~68% of the width/);
  });
});
