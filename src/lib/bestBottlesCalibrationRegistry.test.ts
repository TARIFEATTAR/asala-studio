import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  resolveBestBottlesCapStateEligibility,
  validateBestBottlesCalibrationRow,
  type BestBottlesCalibrationRegistryRow,
} from "./bestBottlesCalibrationRegistry";

const validRow: BestBottlesCalibrationRegistryRow = {
  scaleContractVersion: "best-bottles-catalog-scale-v1",
  registryKey: "cylinder:100:standard-cap",
  graceSku: "GB-CYL-CLR-100ML-S",
  websiteSku: "GBCyl100ShortCap",
  productGroupId: "group-cylinder-100",
  family: "Cylinder",
  capacityMl: 100,
  bodyMaterial: "Clear glass",
  shapeClass: "cylinder",
  heightWithCapMm: 150,
  heightWithoutCapMm: 130,
  diameterMm: 42,
  measurementStatus: "reconciled",
  measurementSources: ["convex", "bestbottles.com"],
  capOnReferenceId: "opaque-cap-on-psd-export",
  capOffReferenceId: null,
  topologyReferenceId: null,
  capStateEligibility: "cap-off-unavailable",
  globalTargetPct: 79,
  familyCorrectionPct: 0,
  finalAssembledTargetPct: 79,
  bodyTargetPx: 1567,
  promptVersion: "best-bottles-reference-locked-v6.1",
};

describe("Best Bottles calibration evidence", () => {
  it("does not infer cap-off from heightWithoutCap", () => {
    assert.equal(resolveBestBottlesCapStateEligibility({
      capOnReferenceId: "opaque-cap-on-psd-export",
      capOffReferenceId: null,
      topologyReferenceId: null,
      heightWithoutCap: "130 ±2 mm",
      isMultiComponent: false,
    }), "cap-off-unavailable");
  });

  it("allows cap-off only with an approved PSD reference", () => {
    assert.equal(resolveBestBottlesCapStateEligibility({
      capOnReferenceId: "opaque-cap-on-psd-export",
      capOffReferenceId: "approved-cap-off-psd-export",
      topologyReferenceId: null,
      heightWithoutCap: "130 ±2 mm",
      isMultiComponent: false,
    }), "cap-off-confirmed");
  });

  it("requires topology evidence for multi-component products", () => {
    assert.equal(resolveBestBottlesCapStateEligibility({
      capOnReferenceId: "opaque-cap-on-psd-export",
      capOffReferenceId: null,
      topologyReferenceId: null,
      heightWithoutCap: "130 ±2 mm",
      isMultiComponent: true,
    }), "needs-psd-review");
    assert.equal(resolveBestBottlesCapStateEligibility({
      capOnReferenceId: "opaque-cap-on-psd-export",
      capOffReferenceId: null,
      topologyReferenceId: "approved-vintage-bulb-topology-psd",
      heightWithoutCap: "130 ±2 mm",
      isMultiComponent: true,
    }), "multi-component-confirmed");
  });

  it("rejects disputed measurement anchors", () => {
    assert.throws(() => validateBestBottlesCalibrationRow({
      ...validRow,
      measurementStatus: "disputed",
    }), /reconciled/);
  });

  it("rejects invalid measurements and correction rails", () => {
    assert.throws(() => validateBestBottlesCalibrationRow({
      ...validRow,
      diameterMm: 0,
    }), /positive measurements/);
    assert.throws(() => validateBestBottlesCalibrationRow({
      ...validRow,
      familyCorrectionPct: 2.1,
    }), /±2/);
  });

  it("accepts a reconciled, cap-on-confirmed registry row", () => {
    assert.equal(validateBestBottlesCalibrationRow(validRow), validRow);
  });
});
