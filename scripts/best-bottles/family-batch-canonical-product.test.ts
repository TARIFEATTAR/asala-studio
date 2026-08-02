import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { CylinderProductionReadinessRow } from "../../src/lib/bestBottlesCylinderProductionCutover";
import { applyCanonicalCylinderGeometry } from "./family-batch-canonical-product";

function readiness(overrides: Partial<CylinderProductionReadinessRow> = {}): CylinderProductionReadinessRow {
  return {
    canonicalIdentityKey: "WEBSKU|GBCYLCLR9MLMRL01",
    websiteSku: "WebSku",
    graceSku: "GB-CYL-CLR-9ML-MRL-01",
    status: "production-qualified",
    blockers: [],
    blockerLane: null,
    canonical: {
      websiteSku: "WebSku",
      graceSku: "GB-CYL-CLR-9ML-MRL-01",
      family: "Cylinder",
      productGroupSlug: "cylinder-9ml-clear-17-415-rollon",
      capacityMl: "9",
      canon_bodyHeightMm: "70",
      canon_widthAxisMm: "20",
      canon_secondAxisMm: "20",
      canon_heightWithCapMm: "96",
    },
    reference: {
      filename: "WEBSKU__GBCYLCLR9MLMRL01__hash.png",
      sourceSha256: "a".repeat(64),
      exportSha256: "b".repeat(64),
      width: 1000,
      height: 1300,
      pixelCount: 1_300_000,
      opaque: true,
      capState: "assembled-cap-on",
      reviewer: "Reviewer",
      reviewedAt: "2026-07-13T00:00:00.000Z",
    },
    ...overrides,
  };
}

const staleProduct = {
  graceSku: "GB-CYL-CLR-9ML-MRL-01",
  websiteSku: "WebSku",
  family: "Cylinder",
  capacityMl: 9,
  heightWithoutCap: "63",
  heightWithCap: "75",
  diameter: "21",
};

describe("family batch canonical product overlay", () => {
  it("replaces stale snapshot measurements with exact canonical axes", () => {
    const product = applyCanonicalCylinderGeometry(staleProduct, readiness());
    assert.equal(product.heightWithoutCap, "70");
    assert.equal(product.heightWithCap, "96");
    assert.equal(product.diameter, "20");
    assert.equal(product.canonicalWidthAxisMm, 20);
    assert.equal(product.canonicalSecondAxisMm, 20);
    assert.equal(product.measurementSource, "best-bottles-canonical-truth-2026-07-12");
  });

  it("preserves distinct canonical bodies instead of using family or capacity consensus", () => {
    const frosted = readiness();
    frosted.canonical.canon_bodyHeightMm = "74";
    frosted.canonical.canon_widthAxisMm = "21";
    frosted.canonical.canon_secondAxisMm = "21";
    frosted.canonical.canon_heightWithCapMm = "87";
    const product = applyCanonicalCylinderGeometry(staleProduct, frosted);
    assert.equal(product.heightWithoutCap, "74");
    assert.equal(product.heightWithCap, "87");
    assert.equal(product.diameter, "21");
  });

  it("fails closed unless Website and Grace SKU both match the qualified row", () => {
    assert.throws(
      () => applyCanonicalCylinderGeometry(
        { ...staleProduct, websiteSku: "DifferentWebsiteSku" },
        readiness(),
      ),
      /exact Website \+ Grace SKU/i,
    );
    assert.throws(
      () => applyCanonicalCylinderGeometry(
        staleProduct,
        readiness({ status: "blocked", blockers: ["reference-below-minimum-pixels"] }),
      ),
      /not production-qualified/i,
    );
  });
});
