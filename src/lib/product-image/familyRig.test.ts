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
    const cfg = FAMILY_RIG.cylinder; // fillHeightPct 72, fillWidthPct 62
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

  it("normalizes Tall Cylinder to the Cylinder rig, enables Circle, and falls back to the universal PDP rig", () => {
    assert.equal(getFamilyRig("Tall Cylinder"), FAMILY_RIG.cylinder);
    assert.equal(hasFamilyRig("Tall Cylinder"), true);
    assert.deepEqual(getFamilyRig("Circle"), FAMILY_RIG.circle);
    assert.equal(hasFamilyRig("Circle"), true);
    assert.deepEqual(getFamilyRig("Boston Round"), FAMILY_RIG.defaultPdp);
    assert.deepEqual(getFamilyRig("Decorative"), FAMILY_RIG.defaultPdp);
    assert.equal(hasFamilyRig("Boston Round"), true);
  });

  it("builds a size-agnostic imposed rig block with composition authority", () => {
    const block = buildImposedRigBlock({ family: "Cylinder", capState: "assembled" });

    assert.ok(block);
    assert.equal(FAMILY_RIG.cylinder.fillHeightPct, 72);
    assert.match(block, /IMPOSED STUDIO RIG/);
    assert.match(block, /SUPERSEDES/);
    assert.match(block, /8.?10% up from the canvas bottom/);
    assert.match(block, /visible bottom contact pixels/i);
    assert.match(block, /Do not lift the bottle base above this shelf line/i);
    assert.match(block, /FINAL ALIGNMENT QA/);
    // Size is NOT encoded by capacity — that's the display layer's job.
    assert.match(block, /balanced, inspectable, CONSISTENT PDP catalog size/i);
    assert.match(block, /~72% of the canvas height and ~62% of the width/);
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

  it("guards cap-off sprayers against duplicate loose caps", () => {
    const block = buildImposedRigBlock({ family: "Cylinder", capState: "detached" });

    assert.ok(block);
    assert.match(block, /bottle top is the exposed sprayer/i);
    assert.match(block, /only detached object is the matching over-cap/i);
    assert.match(block, /Do not render a second loose cap/i);
  });

  it("builds a Circle rig with a wider round-bottle envelope", () => {
    const block = buildImposedRigBlock({ family: "Circle", capState: "detached" });

    assert.ok(block);
    assert.match(block, /IMPOSED STUDIO RIG/);
    assert.match(block, /CIRCLE/);
    assert.match(block, /~78% of the canvas height and ~68% of the width/);
  });

  it("builds a universal PDP rig for families without a custom override", () => {
    const block = buildImposedRigBlock({ family: "Decorative", capState: "assembled" });

    assert.ok(block);
    assert.equal(FAMILY_RIG.defaultPdp.fillHeightPct, 67);
    assert.match(block, /IMPOSED STUDIO RIG/);
    assert.match(block, /UNIVERSAL PDP/);
    assert.match(block, /~67% of the canvas height and ~60% of the width/);
    assert.match(block, /Do NOT vary the on-canvas size by ml capacity/i);
  });
});
