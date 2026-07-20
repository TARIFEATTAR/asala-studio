import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCylinderSixRolePilot,
  type CylinderSixRolePilotInput,
} from "./bestBottlesCylinderSixRolePilot";

const SHA_A = "a".repeat(64);
const SHA_B = "b".repeat(64);
const CANON_SHA = "c".repeat(64);

function fixture(): CylinderSixRolePilotInput {
  const sizes = [3, 5, 9, 25, 50, 100] as const;
  return {
    generatedAt: "2026-07-16T12:00:00.000Z",
    canonicalMaster: {
      path: "docs/best-bottles-canonical-truth/best-bottles-master-truth.csv",
      sha256: CANON_SHA,
    },
    products: sizes.map((capacityMl) => ({
      websiteSku: `SKU${capacityMl}`,
      graceSku: capacityMl === 25 ? "" : `GRACE${capacityMl}`,
      family: "Cylinder",
      capacityMl,
      bodyHeightMm: capacityMl,
      widthMm: Math.max(1, capacityMl / 2),
      depthMm: Math.max(1, capacityMl / 2),
      heightWithCapMm: capacityMl + 10,
      references: {
        identityCapOn: {
          locator: `https://example.com/capped/SKU${capacityMl}.png`,
          sha256: SHA_A.slice(0, 63) + String(capacityMl % 10),
          topology: "assembled-cap-on",
          sourceLane: "role-aware-readiness",
        },
        pdpCapOffSidecar: {
          locator: `https://example.com/enlarged_pics/SKU${capacityMl}.png`,
          sha256: SHA_B.slice(0, 63) + String(capacityMl % 10),
          topology: "fitment-attached-detached-sidecar",
          sourceLane: "role-aware-readiness",
        },
      },
    })),
  };
}

test("builds the six-size, two-role pilot without cross-lane substitution", () => {
  const artifact = buildCylinderSixRolePilot(fixture());

  assert.equal(artifact.summary.productCount, 6);
  assert.equal(artifact.summary.roleSlotCount, 12);
  assert.equal(artifact.summary.visualTestReadySlotCount, 12);
  assert.equal(artifact.summary.productionReadyProductCount, 5);
  assert.equal(artifact.summary.identityBlockedProductCount, 1);
  assert.equal(artifact.products.find((row) => row.capacityMl === 25)?.productionStatus, "blocked");
  assert.match(
    artifact.products.find((row) => row.capacityMl === 25)?.blockers.join(" ") ?? "",
    /missing-grace-sku/,
  );
  for (const row of artifact.products) {
    assert.notEqual(row.roles.identityCapOn.sha256, row.roles.pdpCapOffSidecar.sha256);
  }
});

test("rejects a shared reference hash across cap-on and sidecar roles", () => {
  const input = fixture();
  input.products[0].references.pdpCapOffSidecar.sha256 =
    input.products[0].references.identityCapOn.sha256;

  assert.throws(
    () => buildCylinderSixRolePilot(input),
    /cross-lane reference reuse/,
  );
});

test("rejects a role with the wrong topology", () => {
  const input = fixture();
  input.products[0].references.identityCapOn.topology =
    "fitment-attached-detached-sidecar";

  assert.throws(
    () => buildCylinderSixRolePilot(input),
    /identity-cap-on requires assembled-cap-on/,
  );
});
