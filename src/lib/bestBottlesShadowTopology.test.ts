import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildModelOwnedShadowPrompt,
  resolveBestBottlesShadowTopology,
} from "./bestBottlesShadowTopology";

const assembledSku = {
  sku: "GB-CYL-CLR-9ML-ROL-BLK",
  detached_components: [] as string[],
  closure_type: "roller",
  applicator_type: "plastic_roller",
};

describe("Best Bottles Cylinder shadow topology", () => {
  it("resolves assembled, detached-sidecar, and complex-contact compositions", () => {
    assert.equal(
      resolveBestBottlesShadowTopology(
        { family: "Cylinder", capState: "assembled" },
        assembledSku,
      ).kind,
      "assembled",
    );
    assert.equal(
      resolveBestBottlesShadowTopology(
        { family: "Cylinder", capState: "detached" },
        { ...assembledSku, detached_components: ["cap"] },
      ).kind,
      "detached-sidecar",
    );
    assert.equal(
      resolveBestBottlesShadowTopology(
        {
          family: "Cylinder",
          applicator: "Vintage Bulb Sprayer with Tassel",
          accessoryCode: "AST-BLK",
        },
        assembledSku,
      ).kind,
      "complex-contact",
    );
  });

  it("compiles contact-specific model-owned shadow instructions", () => {
    const detached = resolveBestBottlesShadowTopology(
      { family: "Cylinder", capState: "detached" },
      { ...assembledSku, detached_components: ["cap"] },
    );
    const prompt = buildModelOwnedShadowPrompt(detached);

    assert.match(prompt, /bottle base and detached cap/i);
    assert.match(prompt, /32–42% opacity/);
    assert.match(prompt, /20–30% of the primary bottle's width/);
    assert.match(prompt, /camera-right/);
    assert.doesNotMatch(prompt, /deterministic/i);
  });
});
