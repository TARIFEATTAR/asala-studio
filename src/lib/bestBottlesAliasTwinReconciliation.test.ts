import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { reconcileAliasTwinResiduals } from "./bestBottlesAliasTwinReconciliation";

describe("Best Bottles alias-twin reconciliation", () => {
  it("removes a residual only when its normalized website SKU has exactly one sibling", () => {
    const result = reconcileAliasTwinResiduals({
      residuals: [
        { graceSku: "GB-DVA-FRS-46ML-01", websiteSku: "GBDivaFrst46SpryCu", family: "Diva" },
        { graceSku: "GB-UNIQUE", websiteSku: "Unique", family: "Vial" },
      ],
      catalog: [
        { graceSku: "GB-DVA-FRS-46ML-01", websiteSku: "GBDivaFrst46SpryCu", family: "Diva" },
        { graceSku: "GB-DVA-CLR-46ML-01", websiteSku: "gb-diva-frst-46-spry-cu", family: "Diva" },
        { graceSku: "GB-UNIQUE", websiteSku: "Unique", family: "Vial" },
      ],
    });

    assert.deepEqual(result.remaining.map((row) => row.graceSku), ["GB-UNIQUE"]);
    assert.deepEqual(result.twins.map((row) => [row.missingGraceSku, row.siblingGraceSku]), [
      ["GB-DVA-FRS-46ML-01", "GB-DVA-CLR-46ML-01"],
    ]);
  });

  it("fails closed when a website SKU maps to more than one possible sibling", () => {
    const residual = { graceSku: "GB-A", websiteSku: "Twin", family: "Diva" };
    const result = reconcileAliasTwinResiduals({
      residuals: [residual],
      catalog: [
        residual,
        { graceSku: "GB-B", websiteSku: "Twin", family: "Diva" },
        { graceSku: "GB-C", websiteSku: "Twin", family: "Diva" },
      ],
    });

    assert.equal(result.twins.length, 0);
    assert.deepEqual(result.remaining, [residual]);
    assert.deepEqual(result.ambiguous.map((row) => row.candidateGraceSkus), [["GB-B", "GB-C"]]);
  });
});
