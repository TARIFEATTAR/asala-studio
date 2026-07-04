import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyBestBottlesCapColorOverride,
  getBestBottlesCapColorOverride,
} from "./bestBottlesCapColorOverrides";
import {
  buildBestBottlesGenerationIdentity,
  getBestBottlesGenerationIdentityIssue,
} from "./bestBottlesGenerationIdentity";

// Mirrors the Convex snapshot rows whose capColor contradicts the product.
const pinkDotMetalRoller = {
  graceSku: "GB-CYL-CLR-9ML-T-05",
  websiteSku: "GBCyl9MtlRollPnkDot",
  itemName:
    "Cylinder design 9ml,1/3 oz clear glass bottle with metal roller ball plug and pink dot cap.",
  itemDescription:
    "Cylinder design 9ml clear glass bottle with metal roller ball plug and pink dot cap.",
  family: "Cylinder",
  color: "Clear",
  capacityMl: 9,
  applicator: "Metal Roller Ball",
  capColor: "Clear",
  trimColor: null,
};

describe("Best Bottles cap color overrides", () => {
  it("registers corrections for the two conflicted pink-dot rollers only", () => {
    assert.equal(getBestBottlesCapColorOverride("GB-CYL-CLR-9ML-T-05")?.capColor, "Pink Dotted");
    assert.equal(getBestBottlesCapColorOverride("GB-CYL-CLR-9ML-T-15")?.capColor, "Pink Dotted");
    // Correct rows must NOT be overridden.
    assert.equal(getBestBottlesCapColorOverride("GB-CYL-AMB-9ML-MRL-PKDT"), null);
    assert.equal(getBestBottlesCapColorOverride("GB-CYL-CLR-9ML-T-02"), null);
    assert.equal(getBestBottlesCapColorOverride(null), null);
  });

  it("applies without mutating the input product", () => {
    const patched = applyBestBottlesCapColorOverride(pinkDotMetalRoller);
    assert.equal(patched.capColor, "Pink Dotted");
    assert.equal(pinkDotMetalRoller.capColor, "Clear");
  });

  it("unblocks the pink-dot metal roller end to end through generation identity", () => {
    const identity = buildBestBottlesGenerationIdentity(pinkDotMetalRoller, {
      bodyMaterial: "clear glass",
      sourceReference: "https://example.com/ref.png",
    });

    assert.equal(getBestBottlesGenerationIdentityIssue(identity), null);
    assert.equal(identity.identityStatus, "ready");
    assert.equal(identity.capColor, "Pink Dotted");
    // Body color stays Clear (the glass), not misattributed from the pink cap.
    assert.equal(identity.bodyColor, "Clear");
    assert.equal(identity.inferredBodyColor, null);
  });

  it("does not treat 'pink dot cap' wording as a pink glass body", () => {
    // Even WITHOUT the capColor override, the body-color inference must not
    // misread the cap description as the bottle color (the root-cause fix).
    const identity = buildBestBottlesGenerationIdentity({
      ...pinkDotMetalRoller,
      graceSku: "GB-CYL-CLR-9ML-T-99",
    });
    const issue = getBestBottlesGenerationIdentityIssue(identity) ?? "";
    assert.doesNotMatch(issue, /color code says Clear, but product evidence says Pink/);
    assert.doesNotMatch(issue, /row color says Clear, but product evidence says Pink/);
  });

  it("keeps genuinely pink bottles inferring Pink", () => {
    const identity = buildBestBottlesGenerationIdentity({
      graceSku: "GB-CYL-PNK-5ML-ATM-PNK",
      websiteSku: "GBAtom5PnkDot",
      itemName: "5 ml pink atomizer bottle",
      family: "Atomizer",
      color: "Pink",
      capacityMl: 5,
      applicator: "Fine Mist Sprayer",
      capColor: "Pink",
    });

    assert.equal(identity.identityStatus, "ready");
    assert.equal(identity.bodyColor, "Pink");
  });
});
