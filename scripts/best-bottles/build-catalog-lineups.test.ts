import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildCatalogLineupRenderPlan } from "./build-catalog-lineups";
import type { BestBottlesCalibrationRegistryRow } from "../../src/lib/bestBottlesCalibrationRegistry";

const registryRow: BestBottlesCalibrationRegistryRow = {
  scaleContractVersion: "best-bottles-catalog-scale-v1",
  registryKey: "cylinder:100:group-cylinder-100",
  graceSku: "GB-CYL-CLR-100ML-S",
  websiteSku: "GBCyl100ShortCap",
  productGroupId: "group-cylinder-100",
  family: "Cylinder",
  capacityMl: 100,
  bodyMaterial: "Clear glass",
  shapeClass: "cylinder-standard",
  heightWithCapMm: 150,
  heightWithoutCapMm: 130,
  diameterMm: 42,
  measurementStatus: "reconciled",
  measurementSources: ["convex", "bestbottles.com"],
  capOnReferenceId: "cap-on-100-sha",
  capOffReferenceId: null,
  topologyReferenceId: null,
  capStateEligibility: "cap-off-unavailable",
  globalTargetPct: 79,
  familyCorrectionPct: 0,
  finalAssembledTargetPct: 79,
  bodyTargetPx: 1567,
  promptVersion: "best-bottles-reference-locked-v6.1",
};

describe("catalog lineup render plan", () => {
  it("uses identical actual-product selection and scale for technical and hero outputs", () => {
    const result = buildCatalogLineupRenderPlan([{
      registryRow,
      productLayerPath: "/approved-psd-layers/GB-CYL-CLR-100ML-S.png",
      productLayerReferenceId: "cap-on-100-sha",
      primaryBottleBounds: { top: 120, bottom: 1900, left: 710, right: 1310 },
    }]);

    assert.deepEqual(result.technicalItems, result.heroItems);
    assert.equal(result.manifest[0].graceSku, registryRow.graceSku);
    assert.equal(result.manifest[0].resolvedAssembledTargetPct, 79);
    assert.equal(result.manifest[0].scaleContractVersion, "best-bottles-catalog-scale-v1");
  });

  it("rejects a product layer that does not match the approved reference", () => {
    assert.throws(() => buildCatalogLineupRenderPlan([{
      registryRow,
      productLayerPath: "/approved-psd-layers/GB-CYL-CLR-100ML-S.png",
      productLayerReferenceId: "wrong-reference-sha",
      primaryBottleBounds: { top: 120, bottom: 1900, left: 710, right: 1310 },
    }]), /reference lineage/i);
  });

  it("rejects missing product layers and primary-bottle QA bounds", () => {
    assert.throws(() => buildCatalogLineupRenderPlan([{
      registryRow,
      productLayerPath: "",
      productLayerReferenceId: "cap-on-100-sha",
      primaryBottleBounds: null,
    }]), /product layer/i);
  });
});
