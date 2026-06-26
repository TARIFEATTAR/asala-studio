import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildProductSpecBlock, type ConvexProductLike } from "./skuInjector";

const cylinder5Ml: ConvexProductLike = {
  websiteSku: "GBCyl5WhtSht",
  graceSku: "GB-CYL-CLR-5ML-CAP-WHT",
  family: "Cylinder",
  color: "Clear",
  capacityMl: 5,
  heightWithoutCap: "42 mm",
  heightWithCap: "52 mm",
  diameter: "16 mm",
  neckThreadSize: "13-415",
  applicator: "Cap/Closure",
  capStyle: "Ribbed cap",
  capColor: "White",
};

describe("buildProductSpecBlock", () => {
  it("uses measurements as proportion truth without making PDP masters tiny by capacity", () => {
    const block = buildProductSpecBlock(cylinder5Ml);

    assert.match(block, /Height \(body, without cap\): 42 mm/);
    assert.match(block, /Height \(assembled, with cap\): 52 mm/);
    assert.match(block, /Height-to-diameter ratio: 2\.63:1/);
    assert.doesNotMatch(block, /Do NOT enlarge smaller capacities/i);
    assert.doesNotMatch(block, /real physical scale within the fixed catalog frame/i);
    assert.match(block, /measurements define physical proportions/i);
  });
});
