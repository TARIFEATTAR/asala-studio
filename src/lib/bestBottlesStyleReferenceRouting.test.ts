import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveBestBottlesStyleReferenceUrl } from "./bestBottlesStyleReferenceRouting";

describe("Best Bottles style-reference routing", () => {
  it("does not auto-attach the Cylinder calibration reference to a Dropper master", () => {
    const routed = resolveBestBottlesStyleReferenceUrl({
      isBestBottlesStudioMasterRequest: true,
      family: "Dropper",
      fallbackCylinderStyleReferenceUrl: "https://cdn.example.test/cylinder-calibration.png",
    });

    assert.equal(routed, "");
  });

  it("preserves an explicit non-Cylinder style reference on the prior general path", () => {
    const routed = resolveBestBottlesStyleReferenceUrl({
      isBestBottlesStudioMasterRequest: true,
      family: "Dropper",
      explicitStyleReferenceUrl: "https://cdn.example.test/dropper-style.png",
      fallbackCylinderStyleReferenceUrl: "https://cdn.example.test/cylinder-calibration.png",
    });

    assert.equal(routed, "https://cdn.example.test/dropper-style.png");
  });

  it("uses the automatic calibration reference for Cylinder aliases only", () => {
    for (const family of ["Cylinder", "Tall Cylinder", "tall-cylinder", "tall_cylinder"]) {
      assert.equal(resolveBestBottlesStyleReferenceUrl({
        isBestBottlesStudioMasterRequest: true,
        family,
        fallbackCylinderStyleReferenceUrl: "https://cdn.example.test/cylinder-calibration.png",
      }), "https://cdn.example.test/cylinder-calibration.png", family);
    }
  });
});
