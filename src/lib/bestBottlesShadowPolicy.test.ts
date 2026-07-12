import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  resolveBestBottlesReconciliationPromptVersion,
  resolveBestBottlesShadowPolicy,
} from "./bestBottlesShadowPolicy";

describe("resolveBestBottlesShadowPolicy", () => {
  it("selects model ownership only for the black 3 ml smoke SKU", () => {
    assert.deepEqual(resolveBestBottlesShadowPolicy("GB-SPR-CLR-3ML-BLK"), {
      promptVersion: "best-bottles-reference-locked-v6.1-shadow-smoke",
      owner: "model",
      contract: "contact-back-right-v1",
      smokeSku: "GB-SPR-CLR-3ML-BLK",
    });
  });

  it("keeps every other SKU on V6.0 rig ownership", () => {
    for (const sku of ["GB-SPR-CLR-3ML-WHT", "GB-CYL-CLR-9ML-T-03", null]) {
      assert.deepEqual(resolveBestBottlesShadowPolicy(sku), {
        promptVersion: "best-bottles-reference-locked-v6.0",
        owner: "rig",
        contract: "deterministic-contact-v1",
        smokeSku: null,
      });
    }
  });

  it("canonicalizes persisted reconciliation prompt lineage from SKU policy", () => {
    assert.equal(
      resolveBestBottlesReconciliationPromptVersion(
        "GB-SPR-CLR-3ML-WHT",
        true,
        "best-bottles-reference-locked-v6.1-shadow-smoke",
      ),
      "best-bottles-reference-locked-v6.0",
    );
    assert.equal(
      resolveBestBottlesReconciliationPromptVersion(
        "GB-SPR-CLR-3ML-BLK",
        true,
        null,
      ),
      "best-bottles-reference-locked-v6.1-shadow-smoke",
    );
    assert.equal(
      resolveBestBottlesReconciliationPromptVersion("OTHER", false, "caller-v1"),
      "caller-v1",
    );
  });
});
