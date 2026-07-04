import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEFAULT_PAPER_DOLL_PLATE_ID,
  getEnvironmentPlate,
} from "./productImageEnvironment";

describe("product image environment plate", () => {
  it("defaults to Best Bottles Bone instead of retired parchment", () => {
    const plate = getEnvironmentPlate(DEFAULT_PAPER_DOLL_PLATE_ID);

    assert.equal(plate.backgroundHex, "#F5F3EF");
    assert.doesNotMatch(
      [plate.id, plate.name, plate.backgroundHex, plate.texture].join(" "),
      /#EEE6D4|parchment/i,
    );
  });
});
