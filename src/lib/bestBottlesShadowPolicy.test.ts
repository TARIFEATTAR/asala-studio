import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  resolveBestBottlesReconciliationPromptVersion,
  resolveBestBottlesShadowPolicy,
} from "./bestBottlesShadowPolicy";

describe("resolveBestBottlesShadowPolicy", () => {
  it("selects canonical V6.1 model ownership for every reviewed Cylinder context", () => {
    for (const product of [
      { graceSku: "GB-CYL-CLR-3ML-SPR-BLK", family: "Cylinder" },
      { graceSku: "GB-CYL-AMB-9ML-ROL-BLK", family: "Cylinder" },
      { graceSku: "GB-CYL-CBL-9ML-ROL-WHT", bottleCollection: "Cylinder" },
      { graceSku: "GB-CYL-FRS-50ML-SPR-MSLV", family: "Cylinder" },
      { graceSku: "GB-CYL-WHT-9ML-MRL-WHT", family: "Cylinder" },
      { graceSku: "GB-CYL-PLS-250ML-LPM-BLK", family: "Cylinder" },
      { graceSku: "GBTallCyl9WhtSht", family: "Tall Cylinder" },
    ]) {
      assert.deepEqual(resolveBestBottlesShadowPolicy(product), {
        promptVersion: "best-bottles-reference-locked-v6.1",
        owner: "model",
        contract: "contact-back-right-v1",
        rollout: "cylinder-family",
      });
    }
  });

  it("keeps non-Cylinder and string-only historical calls on V6.0 rig ownership", () => {
    for (const input of [
      { graceSku: "GB-CIR-CLR-9ML-ROL-WHT", family: "Circle" },
      "GB-CYL-CLR-9ML-T-03",
      null,
    ]) {
      assert.deepEqual(resolveBestBottlesShadowPolicy(input), {
        promptVersion: "best-bottles-reference-locked-v6.0",
        owner: "rig",
        contract: "deterministic-contact-v1",
        rollout: null,
      });
    }
  });

  it("canonicalizes persisted reconciliation prompt lineage from SKU policy", () => {
    assert.equal(
      resolveBestBottlesReconciliationPromptVersion(
        { graceSku: "GB-CYL-CLR-3ML-WHT", family: "Cylinder" },
        true,
        "best-bottles-reference-locked-v6.0",
      ),
      "best-bottles-reference-locked-v6.1",
    );
    assert.equal(
      resolveBestBottlesReconciliationPromptVersion(
        { graceSku: "GB-CIR-CLR-9ML-ROL-WHT", family: "Circle" },
        true,
        null,
      ),
      "best-bottles-reference-locked-v6.0",
    );
    assert.equal(
      resolveBestBottlesReconciliationPromptVersion("OTHER", false, "caller-v1"),
      "caller-v1",
    );
  });
});
