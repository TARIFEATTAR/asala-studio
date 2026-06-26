import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatBestBottlesBodyMaterialSkuLock } from "./bestBottlesBodyMaterialPrompt";

describe("formatBestBottlesBodyMaterialSkuLock", () => {
  it("uses the resolved glass material when upstream context says plastic", () => {
    assert.equal(
      formatBestBottlesBodyMaterialSkuLock("glass", "plastic"),
      "Body material: glass",
    );
  });

  it("preserves resolved opaque material locks", () => {
    assert.equal(
      formatBestBottlesBodyMaterialSkuLock("aluminum", "plastic"),
      "Body material: opaque brushed/satin aluminum",
    );
    assert.equal(
      formatBestBottlesBodyMaterialSkuLock("atomizer-metal", "plastic"),
      "Body material: opaque colored/anodized metal atomizer casing",
    );
  });
});
