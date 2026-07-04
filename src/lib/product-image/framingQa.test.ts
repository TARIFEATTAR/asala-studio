import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildFramingQaReport, getFramingDecision } from "./framingQa";
import type { FamilyRigConfig, RigCapState } from "./familyRig";

const canvas = { width: 2080, height: 2288 };

function rig(overrides: Partial<FamilyRigConfig> = {}): FamilyRigConfig {
  return {
    family: "cylinder",
    fillHeightPct: 56,
    fillHeightRangePct: { min: 55, max: 60 },
    fillWidthPct: 58,
    baselinePct: 9,
    primaryObjectCenterXPct: 50,
    ...overrides,
  };
}

function boundsForFillHeight(fillHeightPct: number, baselineYPx = 2082) {
  const heightPx = Math.round(canvas.height * (fillHeightPct / 100));
  return {
    top: baselineYPx - heightPx + 1,
    bottom: baselineYPx,
    left: 850,
    right: 1230,
  };
}

describe("buildFramingQaReport", () => {
  it("passes an assembled product inside its fill-height range on the shared baseline", () => {
    const report = buildFramingQaReport({
      width: canvas.width,
      height: canvas.height,
      rig: rig(),
      bounds: boundsForFillHeight(56),
      baselineYPx: 2082,
      capState: "assembled",
    });

    assert.equal(report.status, "pass");
    assert.equal(report.failures.length, 0);
    assert.equal(report.measurements.fillHeightPct, 56);
    assert.equal(report.measurements.baselineDeltaPx, 0);
    assert.ok(Math.abs((report.measurements.centerDeltaPct ?? 0)) < 0.1);
  });

  it("fails an undersized sample vial against the Convex-derived profile range", () => {
    const report = buildFramingQaReport({
      width: canvas.width,
      height: canvas.height,
      rig: rig(),
      bounds: boundsForFillHeight(49.6),
      baselineYPx: 2082,
      capState: "assembled",
    });

    assert.equal(report.status, "fail");
    assert.match(report.failures.join(" "), /below target range/i);
    assert.equal(report.measurements.fillHeightPct, 49.6);
  });

  it("fails an oversized 9ml cylinder against the standard-cylinder target range", () => {
    const report = buildFramingQaReport({
      width: canvas.width,
      height: canvas.height,
      rig: rig({
        fillHeightPct: 72,
        fillHeightRangePct: { min: 72, max: 78 },
        fillWidthPct: 60,
      }),
      bounds: boundsForFillHeight(90.4),
      baselineYPx: 2082,
      capState: "assembled",
    });

    assert.equal(report.status, "fail");
    assert.match(report.failures.join(" "), /above target range/i);
    assert.equal(report.measurements.fillHeightPct, 90.4);
  });

  it("fails a product that misses the shared catalog baseline", () => {
    const report = buildFramingQaReport({
      width: canvas.width,
      height: canvas.height,
      rig: rig(),
      bounds: boundsForFillHeight(56, 2040),
      baselineYPx: 2040,
      capState: "assembled",
    });

    assert.equal(report.status, "fail");
    assert.match(report.failures.join(" "), /baseline/i);
    assert.equal(report.measurements.targetBaselineYPx, 2082);
    assert.equal(report.measurements.baselineDeltaPx, -42);
  });

  it("warns when detached-cap outputs lack primary-bottle bounds for centerline QA", () => {
    const report = buildFramingQaReport({
      width: canvas.width,
      height: canvas.height,
      rig: rig(),
      bounds: {
        ...boundsForFillHeight(56),
        right: 1500,
      },
      baselineYPx: 2082,
      capState: "detached" satisfies RigCapState,
    });

    assert.equal(report.status, "warn");
    assert.deepEqual(report.failures, []);
    assert.match(report.warnings.join(" "), /Primary bottle bounds unavailable/i);
  });
});

describe("getFramingDecision", () => {
  it("passes framing reports that satisfy the rig", () => {
    const report = buildFramingQaReport({
      width: canvas.width,
      height: canvas.height,
      rig: rig(),
      bounds: boundsForFillHeight(56),
      baselineYPx: 2082,
      capState: "assembled",
    });

    assert.equal(getFramingDecision(report), "pass");
  });

  it("normalizes generated products that are near the target but need correction", () => {
    const report = buildFramingQaReport({
      width: canvas.width,
      height: canvas.height,
      rig: rig(),
      bounds: boundsForFillHeight(61.1),
      baselineYPx: 2082,
      capState: "assembled",
    });

    assert.equal(report.status, "fail");
    assert.equal(getFramingDecision(report), "normalize");
  });

  it("rejects generated cylinders that are far below target fill height", () => {
    const report = buildFramingQaReport({
      width: canvas.width,
      height: canvas.height,
      rig: rig({
        fillHeightPct: 76,
        fillHeightRangePct: { min: 72, max: 78 },
        fillWidthPct: 60,
      }),
      bounds: boundsForFillHeight(30.6),
      baselineYPx: 2082,
      capState: "assembled",
    });

    assert.equal(report.status, "fail");
    assert.equal(getFramingDecision(report), "reject");
  });

  it("rejects reports with undetectable product bounds", () => {
    const report = buildFramingQaReport({
      width: canvas.width,
      height: canvas.height,
      rig: rig(),
      bounds: null,
      baselineYPx: 2082,
      capState: "assembled",
    });

    assert.equal(getFramingDecision(report), "reject");
  });
});
