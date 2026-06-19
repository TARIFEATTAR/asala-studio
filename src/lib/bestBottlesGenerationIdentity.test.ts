import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildBestBottlesGenerationIdentity,
  getBestBottlesGenerationIdentityIssue,
} from "./bestBottlesGenerationIdentity";

describe("buildBestBottlesGenerationIdentity", () => {
  it("blocks generic Diva tassel SKUs when color evidence conflicts", () => {
    const identity = buildBestBottlesGenerationIdentity({
      graceSku: "GB-DVA-CLR-46ML-T-20",
      websiteSku: "GBDivaFrst46AnSpTslBlk",
      productId: "example",
      productGroupId: "diva-46ml-frosted-18-415-tassel",
      family: "Diva",
      capacityMl: 46,
      color: "Clear",
      applicator: "Vintage Bulb Sprayer with Tassel",
      trimColor: "Shiny Silver",
      itemName: "Diva Frosted 46ml Antique Spray Tassel Black",
    });

    assert.equal(identity.identityStatus, "blocked");
    assert.equal(identity.tasselColor, "Black");
    assert.equal(identity.collarFinish, "Shiny Silver");
    assert.match(getBestBottlesGenerationIdentityIssue(identity) ?? "", /Frosted/);
  });

  it("allows corrected tassel identities and emits accessory truth", () => {
    const identity = buildBestBottlesGenerationIdentity({
      graceSku: "GB-DVA-FRS-46ML-AST-BLK",
      websiteSku: "GBDivaFrst46AnSpTslBlk",
      family: "Diva",
      capacityMl: 46,
      color: "Frosted",
      applicator: "Vintage Bulb Sprayer with Tassel",
      trimColor: "Shiny Silver",
      itemName: "Diva Frosted 46ml Antique Spray Tassel Black",
    });

    assert.equal(identity.identityStatus, "ready");
    assert.equal(identity.tasselColor, "Black");
    assert.equal(identity.bulbColor, "Black");
    assert.equal(identity.hoseColor, "Black");
    assert.equal(identity.collarFinish, "Shiny Silver");
    assert.equal(identity.canvas, "2080x2288");
    assert.match(identity.rigVersion, /2080x2288/);
  });

  it("infers reducer leather finish when encoded in product truth", () => {
    const identity = buildBestBottlesGenerationIdentity({
      graceSku: "GB-CYL-CLR-50ML-RDC-BKLT",
      websiteSku: "GBCyl50RdcrBlkLthr",
      family: "Cylinder",
      capacityMl: 50,
      color: "Clear",
      applicator: "Reducer",
      capColor: "Black Leather",
      itemName: "Cylinder 50ml Reducer Black Leather",
    });

    assert.equal(identity.identityStatus, "ready");
    assert.equal(identity.reducerFinish, "Black Leather");
  });
});
