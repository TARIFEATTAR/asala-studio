import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { BEST_BOTTLES_CYLINDER_PRODUCTION_CONTRACT } from "./bestBottlesCylinderProductionContract";

describe("Cylinder production contract", () => {
  it("partitions all canonical identities into the approved 228/149 cutover", () => {
    assert.equal(
      BEST_BOTTLES_CYLINDER_PRODUCTION_CONTRACT.productionQualifiedCount
        + BEST_BOTTLES_CYLINDER_PRODUCTION_CONTRACT.totalBlockedCount,
      BEST_BOTTLES_CYLINDER_PRODUCTION_CONTRACT.canonicalIdentityCount,
    );
    assert.equal(
      BEST_BOTTLES_CYLINDER_PRODUCTION_CONTRACT.localReferenceExportCount
        - BEST_BOTTLES_CYLINDER_PRODUCTION_CONTRACT.belowMinimumPixelsCount,
      BEST_BOTTLES_CYLINDER_PRODUCTION_CONTRACT.productionQualifiedCount,
    );
  });
});
