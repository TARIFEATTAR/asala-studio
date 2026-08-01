import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveBestBottlesDottedCapComponentSku } from "./bestBottlesDottedCapReference";

describe("resolveBestBottlesDottedCapComponentSku", () => {
  it("resolves an exact black dotted 13-415 roll-on cap", () => {
    assert.equal(resolveBestBottlesDottedCapComponentSku({
      graceSku: "GB-CYL-CLR-9ML-ROL-BKDT-02",
      websiteSku: "GBTallCyl9RollBlkDot",
      applicator: "Plastic Roller Ball",
      neckThreadSize: "13-415",
      capColor: "Black",
    }), "CMP-ROC-BLK-13415-DOT");
  });

  it("resolves exact pink and silver 17-415 dotted caps", () => {
    assert.equal(resolveBestBottlesDottedCapComponentSku({
      graceSku: "GB-CYL-CLR-9ML-ROL-PKDT",
      applicator: "Roll On",
      neckThreadSize: "17-415",
      capColor: "Pink",
    }), "CMP-ROC-PNK-17415-DOT");
    assert.equal(resolveBestBottlesDottedCapComponentSku({
      graceSku: "GB-CYL-CLR-9ML-ROL-SLDT",
      applicator: "Roll On",
      neckThreadSize: "17-415",
      capColor: "Silver",
    }), "CMP-ROC-SLV-17415-DOT");
  });

  it("fails closed for a non-dotted, non-roll-on, unsupported-thread, or ambiguous finish", () => {
    assert.equal(resolveBestBottlesDottedCapComponentSku({ graceSku: "GB-CYL-CLR-9ML-ROL-SBLK", applicator: "Roll On", neckThreadSize: "13-415", capColor: "Black" }), null);
    assert.equal(resolveBestBottlesDottedCapComponentSku({ graceSku: "GB-CYL-CLR-9ML-SPR-BKDT", applicator: "Fine Mist Sprayer", neckThreadSize: "13-415", capColor: "Black" }), null);
    assert.equal(resolveBestBottlesDottedCapComponentSku({ graceSku: "GB-CYL-CLR-9ML-ROL-BKDT", applicator: "Roll On", neckThreadSize: "20-400", capColor: "Black" }), null);
    assert.equal(resolveBestBottlesDottedCapComponentSku({ graceSku: "GB-CYL-CLR-9ML-ROL-DOT", applicator: "Roll On", neckThreadSize: "13-415", capColor: null }), null);
  });
});
