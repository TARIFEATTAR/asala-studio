import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { inferBestBottlesBodyMaterial } from "./bestBottlesBodyMaterial";

describe("inferBestBottlesBodyMaterial", () => {
  it("keeps clear glass roller bottles as glass when the cap text mentions plastic", () => {
    assert.equal(
      inferBestBottlesBodyMaterial({
        graceSku: "GB-CYL-CLR-9ML-T-11",
        itemName: "9 ml Clear Glass Bottle with Black Plastic Cap",
        itemDescription: "Clear glass roll-on bottle with black plastic cap.",
        family: "Cylinder",
        category: "Glass Bottles",
        bottleCollection: "Cylinder",
        color: "Clear",
      }),
      "glass",
    );
  });

  it("keeps aluminum and metal atomizer bodies on their existing material paths", () => {
    assert.equal(
      inferBestBottlesBodyMaterial({
        graceSku: "AB-ALU-100ML-BLK",
        itemName: "100 ml Aluminum Bottle",
        family: "Aluminum",
      }),
      "opaque brushed/satin aluminum",
    );

    assert.equal(
      inferBestBottlesBodyMaterial({
        graceSku: "GB-CYL-10ML-ATM-BLK",
        itemName: "10 ml Metal Atomizer",
        family: "Atomizer",
      }),
      "opaque colored/anodized metal atomizer casing",
    );
  });
});
