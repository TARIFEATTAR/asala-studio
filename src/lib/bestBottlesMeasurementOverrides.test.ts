import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { applyBestBottlesMeasurementOverrides } from "./bestBottlesMeasurementOverrides";

describe("Best Bottles measurement overrides", () => {
  it("applies explicit Bell overrides over incomplete catalog measurements", () => {
    const products = [
      {
        graceSku: "GB-BEL-CLR-10ML-SPR-SBLK",
        heightWithoutCap: null,
        diameter: "22",
      },
    ];

    const hydrated = applyBestBottlesMeasurementOverrides(products, [
      {
        graceSku: "GB-BEL-CLR-10ML-SPR-SBLK",
        heightWithoutCap: "55",
        diameter: "27",
        source: "BestBottles product page",
        sourceUrl: "https://www.bestbottles.com/product/bell-design-10-ml-glass-bottle-shiny-black-spray",
        note: "Exact website SKU page lists 55 mm body height and 27 mm diameter.",
      },
    ]);

    assert.equal(hydrated[0].heightWithoutCap, "55");
    assert.equal(hydrated[0].diameter, "27");
    assert.equal(products[0].heightWithoutCap, null);
    assert.equal(products[0].diameter, "22");
  });

  it("leaves products without override rows unchanged", () => {
    const products = [
      {
        graceSku: "GB-BEL-CLR-10ML-SHT-SBLK",
        heightWithoutCap: "55 ±1 mm",
        diameter: "27 ±0.5 mm",
      },
    ];

    const hydrated = applyBestBottlesMeasurementOverrides(products, []);

    assert.deepEqual(hydrated, products);
    assert.notEqual(hydrated[0], products[0]);
  });
});
