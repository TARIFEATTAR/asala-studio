import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  resolveBestBottlesReadinessCatalogJoin,
  type BestBottlesCatalogJoinCatalogProduct,
  type BestBottlesCatalogJoinPipelineProduct,
} from "./bestBottlesGenerationReadinessCatalogJoin.ts";

function pipeline(
  overrides: Partial<BestBottlesCatalogJoinPipelineProduct>,
): BestBottlesCatalogJoinPipelineProduct {
  return {
    graceSku: "GB-CIR-CLR-50ML-RDC-MSLV-01",
    websiteSku: "GBCrcl50RdcrMtSl",
    productId: "BB-GB-050-0026",
    family: "Circle",
    capacityMl: "50",
    canonicalColor: "Clear",
    applicator: "Reducer",
    ...overrides,
  };
}

function catalog(
  overrides: Partial<BestBottlesCatalogJoinCatalogProduct>,
): BestBottlesCatalogJoinCatalogProduct {
  return {
    graceSku: "GB-CIR-CLR-50ML-RDC-MSLV",
    websiteSku: "GBCrcl50RdcrMtSl",
    productId: "BB-GB-050-0026",
    family: "Circle",
    capacityMl: 50,
    color: "Clear",
    applicator: "Reducer",
    heightWithoutCap: "87 ±1 mm",
    diameter: "72 ±1 mm",
    productGroupId: "catalog-group",
    ...overrides,
  };
}

describe("Best Bottles generation readiness catalog join", () => {
  it("prefers exact Grace SKU matches before fallback evidence", () => {
    const exact = catalog({
      graceSku: "GB-CIR-CLR-50ML-RDC-MSLV-01",
      productId: "BB-OTHER",
      heightWithoutCap: "90",
      diameter: "70",
    });
    const fallback = catalog({});

    const result = resolveBestBottlesReadinessCatalogJoin(pipeline({}), [fallback, exact]);

    assert.equal(result.matchKind, "graceSku");
    assert.equal(result.catalogProduct, exact);
  });

  it("uses product ID when Grace SKU drifted but product identity is exact", () => {
    const matched = catalog({
      graceSku: "GB-CIR-CLR-50ML-RDC-MSLV",
      productId: "BB-GB-050-0026",
    });

    const result = resolveBestBottlesReadinessCatalogJoin(pipeline({}), [matched]);

    assert.equal(result.matchKind, "productId");
    assert.equal(result.catalogProduct?.heightWithoutCap, "87 ±1 mm");
    assert.equal(result.catalogProduct?.diameter, "72 ±1 mm");
    assert.equal(result.issue, null);
  });

  it("uses website SKU only when the candidate is unique and identity-compatible", () => {
    const matched = catalog({
      productId: "BB-CATALOG-ONLY",
      websiteSku: "GBAtom5Blk",
      family: "Atomizer",
      capacityMl: 5,
      color: "Black",
      applicator: "Atomizer",
      heightWithoutCap: "76 ±1 mm",
      diameter: "18 ±0.5 mm",
    });

    const result = resolveBestBottlesReadinessCatalogJoin(
      pipeline({
        graceSku: "GB-CYL-BLK-5ML-ATM-BLK-01",
        websiteSku: "GBAtom5Blk",
        productId: null,
        family: "Atomizer",
        capacityMl: "5",
        canonicalColor: "Black",
        applicator: "Atomizer",
      }),
      [matched],
    );

    assert.equal(result.matchKind, "websiteSku");
    assert.equal(result.catalogProduct, matched);
  });

  it("refuses duplicate website SKU fallback when measurements conflict", () => {
    const product = pipeline({
      graceSku: "CMP-DUP-A",
      websiteSku: "SharedWebsiteSku",
      productId: null,
      family: "Cap/Component",
      capacityMl: "0",
      canonicalColor: "Black",
      applicator: "Cap",
    });
    const result = resolveBestBottlesReadinessCatalogJoin(product, [
      catalog({
        graceSku: "CMP-DUP-ONE",
        websiteSku: "SharedWebsiteSku",
        productId: "one",
        family: "Cap/Component",
        capacityMl: 0,
        color: "Black",
        applicator: "Cap",
        heightWithoutCap: "20",
        diameter: "10",
      }),
      catalog({
        graceSku: "CMP-DUP-TWO",
        websiteSku: "SharedWebsiteSku",
        productId: "two",
        family: "Cap/Component",
        capacityMl: 0,
        color: "Black",
        applicator: "Cap",
        heightWithoutCap: "35",
        diameter: "12",
      }),
    ]);

    assert.equal(result.catalogProduct, undefined);
    assert.equal(result.matchKind, "none");
    assert.equal(result.issue, "ambiguous_website_sku");
  });

  it("refuses website SKU fallback when product identity conflicts", () => {
    const result = resolveBestBottlesReadinessCatalogJoin(
      pipeline({
        graceSku: "GB-CYL-WHT-9ML-WHT-S",
        websiteSku: "GBTallCyl9WhtSht",
        productId: null,
        family: "Cylinder",
        capacityMl: "9",
        canonicalColor: "White",
        applicator: "Cap/Closure",
      }),
      [
        catalog({
          graceSku: "GB-TCYL-CLR-9ML-WHT-S",
          websiteSku: "GBTallCyl9WhtSht",
          productId: "tall-cylinder",
          family: "Tall Cylinder",
          capacityMl: 9,
          color: "Clear",
          applicator: "Cap/Closure",
          heightWithoutCap: "65",
          diameter: "18",
        }),
      ],
    );

    assert.equal(result.catalogProduct, undefined);
    assert.equal(result.matchKind, "none");
    assert.equal(result.issue, "identity_conflict_website_sku");
  });
});
