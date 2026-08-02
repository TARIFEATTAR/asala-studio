import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyBestBottlesFamilyScaleCorrection,
  BEST_BOTTLES_GLOBAL_SCALE_KNOTS,
  deriveBestBottlesBodyTargetPx,
  resolveBestBottlesGlobalScalePct,
} from "./bestBottlesCatalogScale";

describe("Best Bottles global catalog scale", () => {
  it("pins every approved calibration knot", () => {
    for (const knot of BEST_BOTTLES_GLOBAL_SCALE_KNOTS) {
      assert.equal(resolveBestBottlesGlobalScalePct(knot.capacityMl), knot.assembledHeightPct);
    }
  });

  it("interpolates monotonically between knots", () => {
    const values = [1, 2, 3, 4, 5, 7, 9, 20, 28, 30, 50, 100, 118, 227, 454]
      .map(resolveBestBottlesGlobalScalePct);
    assert.ok(values.every((value, index) => index === 0 || value >= values[index - 1]));
  });

  it("clamps capacities outside the calibrated range", () => {
    assert.equal(resolveBestBottlesGlobalScalePct(0.5), 54);
    assert.equal(resolveBestBottlesGlobalScalePct(500), 84);
  });

  it("rejects corrections outside the approved rail", () => {
    assert.throws(() => applyBestBottlesFamilyScaleCorrection(69, 2.01), /±2/);
    assert.equal(applyBestBottlesFamilyScaleCorrection(69, -2), 67);
  });

  it("derives a reusable cap-state body target", () => {
    assert.equal(deriveBestBottlesBodyTargetPx({
      canvasHeightPx: 2288,
      assembledHeightPct: 79,
      verifiedBodyHeightMm: 130,
      verifiedAssembledHeightMm: 150,
    }), 1567);
  });

  it("rejects invalid capacity and measurement inputs", () => {
    assert.throws(() => resolveBestBottlesGlobalScalePct(0), /positive capacity/i);
    assert.throws(() => deriveBestBottlesBodyTargetPx({
      canvasHeightPx: 2288,
      assembledHeightPct: 79,
      verifiedBodyHeightMm: 0,
      verifiedAssembledHeightMm: 150,
    }), /verified positive/i);
  });
});
