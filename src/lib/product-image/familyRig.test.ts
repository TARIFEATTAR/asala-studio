import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  FAMILY_RIG,
  buildImposedRigBlock,
  computeRigFitScale,
  getFamilyRig,
  getFamilyRigForProduct,
  hasFamilyRig,
} from "./familyRig";
import { computeRigFrameTransform } from "./rigPostprocess";

const approx = (a: number, b: number) => Math.abs(a - b) < 1e-6;

describe("family rig (profile-aware fit-to-box)", () => {
  const W = 2080;
  const H = 2288;

  it("fit-to-box binds on height for a tall, narrow assembly", () => {
    const cfg = FAMILY_RIG.cylinder; // fillHeightPct 76, fillWidthPct 62
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

  it("resolves roller applicator SKUs before generic cylinder dimensions", () => {
    const rig = getFamilyRigForProduct({
      family: "Cylinder",
      bottleCollection: "Cylinder",
      graceSku: "GB-CYL-CLR-28ML-MRL-01",
      websiteSku: "GBMtlRoll28Blk",
      itemName: "Cylinder style 28 ml bottle with metal roller ball plug and black cap.",
      applicator: "Metal Roller Ball",
      capacityMl: 28,
      heightWithCap: "100 ±1 mm",
      heightWithoutCap: "81 ±1 mm",
      diameter: "31 ±0.5 mm",
    });

    assert.ok(rig);
    assert.equal(rig.profileId, "roller-bottle");
    assert.equal(rig.fillHeightRangePct?.min, 65);
    assert.equal(rig.fillHeightRangePct?.max, 70);
  });

  it("builds a profile-capable imposed rig block with composition authority", () => {
    const block = buildImposedRigBlock({ family: "Cylinder", capState: "assembled" });

    assert.ok(block);
    assert.equal(FAMILY_RIG.cylinder.fillHeightPct, 76);
    assert.match(block, /IMPOSED STUDIO RIG/);
    assert.match(block, /SUPERSEDES/);
    assert.match(block, /8.?10% up from the canvas bottom/);
    assert.match(block, /visible bottom contact pixels/i);
    assert.match(block, /Do not lift the bottle base above this shelf line/i);
    assert.match(block, /FINAL ALIGNMENT QA/);
    assert.match(block, /resolved Cylinder PDP framing target/i);
    assert.match(block, /~76% of the canvas height and ~62% of the width/);
    assert.doesNotMatch(block, /Do NOT vary the on-canvas size by ml capacity/i);
  });

  it("places a detached cap to the right for cap-off composition", () => {
    const block = buildImposedRigBlock({ family: "Cylinder", capState: "detached" });

    assert.ok(block);
    assert.match(block, /DETACHED cap upright in the right sidecar zone/);
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

  it("computes a horizontal centering shift for assembled off-center outputs", () => {
    const result = computeRigFrameTransform({
      width: 2080,
      height: 2288,
      rig: FAMILY_RIG.cylinder,
      detectedBaselineYPx: 2082,
      strongBounds: { top: 343, bottom: 2082, left: 700, right: 900 },
      capState: "assembled",
    });

    assert.equal(result.scale, 1);
    assert.equal(result.shiftXPx, 240);
    assert.equal(result.transformedLeftXPx, 940);
    assert.equal(result.transformedRightXPx, 1140);
  });

  it("does not center the full foreground group for detached cap outputs", () => {
    const result = computeRigFrameTransform({
      width: 2080,
      height: 2288,
      rig: FAMILY_RIG.cylinder,
      detectedBaselineYPx: 2082,
      strongBounds: { top: 343, bottom: 2082, left: 700, right: 1200 },
      capState: "detached",
    });

    assert.equal(result.scale, 1);
    assert.equal(result.shiftXPx, 0);
  });

  it("builds a universal PDP rig for families without a custom override", () => {
    const block = buildImposedRigBlock({ family: "Decorative", capState: "assembled" });

    assert.ok(block);
    assert.equal(FAMILY_RIG.defaultPdp.fillHeightPct, 67);
    assert.match(block, /IMPOSED STUDIO RIG/);
    assert.match(block, /UNIVERSAL PDP/);
    assert.match(block, /~67% of the canvas height and ~60% of the width/);
    assert.doesNotMatch(block, /Do NOT vary the on-canvas size by ml capacity/i);
  });
});
