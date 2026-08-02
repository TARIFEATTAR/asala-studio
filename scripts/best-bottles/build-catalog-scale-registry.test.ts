import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildBestBottlesCatalogScaleRegistry } from "./build-catalog-scale-registry";

const product = (overrides: Record<string, unknown> = {}) => ({
  graceSku: "GB-CYL-CLR-100ML-S",
  websiteSku: "GBCyl100ShortCap",
  productGroupId: "group-cylinder-100",
  family: "Cylinder",
  category: "Glass Bottle",
  bottleCollection: "Cylinder",
  capacityMl: 100,
  heightWithCap: "150 ±2 mm",
  heightWithoutCap: "130 ±2 mm",
  diameter: "42 ±0.5 mm",
  itemName: "Clear Cylinder bottle with short cap",
  applicator: null,
  ...overrides,
});

const readiness = (overrides: Record<string, unknown> = {}) => ({
  graceSku: "GB-CYL-CLR-100ML-S",
  websiteSku: "GBCyl100ShortCap",
  family: "Cylinder",
  status: "ready",
  issues: [],
  measurementSource: "catalog",
  catalogJoinIssue: null,
  hasReference: true,
  ...overrides,
});

const reference = (overrides: Record<string, unknown> = {}) => ({
  graceSku: "GB-CYL-CLR-100ML-S",
  websiteSku: "GBCyl100ShortCap",
  approvedReplacement: {
    localPath: "/approved/GB-CYL-CLR-100ML-S.psd-export.png",
    sha256: "cap-on-100-sha",
    pixelAlphaState: "opaque; RGB/TrueColor with no alpha channel",
  },
  ...overrides,
});

describe("catalog scale registry builder", () => {
  it("keeps reconciled cap-on-only products eligible without inventing cap-off", () => {
    const result = buildBestBottlesCatalogScaleRegistry({
      products: [product()],
      readinessRows: [readiness()],
      referenceObjects: [reference()],
    });

    assert.equal(result.registry.length, 1);
    assert.equal(result.registry[0].capStateEligibility, "cap-off-unavailable");
    assert.equal(result.registry[0].finalAssembledTargetPct, 79);
    assert.equal(result.registry[0].bodyTargetPx, 1567);
  });

  it("accepts cap-off only when the reference inventory explicitly names its PSD evidence", () => {
    const result = buildBestBottlesCatalogScaleRegistry({
      products: [product()],
      readinessRows: [readiness()],
      referenceObjects: [reference({ capOffReferenceId: "approved-cap-off-100-psd" })],
    });

    assert.equal(result.registry[0].capStateEligibility, "cap-off-confirmed");
    assert.equal(result.registry[0].capOffReferenceId, "approved-cap-off-100-psd");
  });

  it("excludes vintage bulb products when topology PSD evidence is missing", () => {
    const result = buildBestBottlesCatalogScaleRegistry({
      products: [product({
        graceSku: "GB-CYL-CLR-100ML-AST-BLK",
        websiteSku: "GBCyl100AntiqueBulbBlack",
        itemName: "Vintage antique bulb sprayer with tassel",
        applicator: "Vintage Bulb Sprayer with Tassel",
      })],
      readinessRows: [readiness({
        graceSku: "GB-CYL-CLR-100ML-AST-BLK",
        websiteSku: "GBCyl100AntiqueBulbBlack",
      })],
      referenceObjects: [reference({
        graceSku: "GB-CYL-CLR-100ML-AST-BLK",
        websiteSku: "GBCyl100AntiqueBulbBlack",
      })],
    });

    assert.equal(result.registry.length, 0);
    assert.match(result.excluded[0].reasons.join(" "), /topology PSD/i);
  });

  it("excludes disputed measurements instead of silently correcting them", () => {
    const result = buildBestBottlesCatalogScaleRegistry({
      products: [product({ heightWithCap: "130 mm", heightWithoutCap: "150 mm" })],
      readinessRows: [readiness()],
      referenceObjects: [reference()],
    });

    assert.equal(result.registry.length, 0);
    assert.match(result.excluded[0].reasons.join(" "), /measurement/i);
  });
});
