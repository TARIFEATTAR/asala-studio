import assert from "node:assert/strict";
import test from "node:test";

import { buildCylinderSixRolePilot } from "../../src/lib/bestBottlesCylinderSixRolePilot";
import { compileCylinderSixRoleMaterialPilot } from "./cylinder-six-role-material-pilot";

const HASH = (character: string, suffix: number) =>
  character.repeat(63) + String(suffix % 10);

test("compiles twelve GPT Image 2 attempts with role-clean references and shared body geometry", async () => {
  const capacities = [3, 5, 9, 25, 50, 100] as const;
  const source = buildCylinderSixRolePilot({
    generatedAt: "2026-07-16T12:00:00.000Z",
    canonicalMaster: {
      path: "docs/best-bottles-canonical-truth/best-bottles-master-truth.csv",
      sha256: "c".repeat(64),
    },
    products: capacities.map((capacityMl) => ({
      websiteSku: `SKU${capacityMl}`,
      graceSku: capacityMl === 25 ? "" : `GRACE${capacityMl}`,
      family: "Cylinder" as const,
      capacityMl,
      bodyHeightMm: capacityMl + 20,
      widthMm: capacityMl / 2 + 10,
      depthMm: capacityMl / 2 + 10,
      heightWithCapMm: capacityMl + 40,
      references: {
        identityCapOn: {
          locator: `tmp/capped-${capacityMl}.png`,
          sha256: HASH("a", capacityMl),
          topology: "assembled-cap-on" as const,
          sourceLane: "test",
        },
        pdpCapOffSidecar: {
          locator: `tmp/sidecar-${capacityMl}.png`,
          sha256: HASH("b", capacityMl),
          topology: "fitment-attached-detached-sidecar" as const,
          sourceLane: "test",
          conditioning: {
            sourceLocator: `tmp/raw-sidecar-${capacityMl}.png`,
            sourceSha256: HASH("f", capacityMl),
            evidenceRecordLocator: `tmp/sidecar-${capacityMl}.json`,
            maskLocator: `tmp/sidecar-${capacityMl}-mask.png`,
            maskSha256: HASH("d", capacityMl),
            maskSemantics:
              "transparent-body-material-edit-opaque-hardware-sidecar-bone-preserve" as const,
            identityOverlayLocator: `tmp/sidecar-${capacityMl}-identity-overlay.png`,
            identityOverlaySha256: HASH("9", capacityMl),
            identityOverlaySemantics:
              "exact-sprayer-closure-sidecar-with-body-removed" as const,
            operation: "pre-generation-whole-role-uniform-conditioning" as const,
            postGenerationMutationAllowed: false as const,
          },
        },
      },
    })),
  });

  const manifest = await compileCylinderSixRoleMaterialPilot(source, {
    materialCalibration: {
      locator: "tmp/material/clear-glass-body-only.png",
      sha256: "e".repeat(64),
      evidenceRecordLocator: "tmp/material/clear-glass-body-only.json",
    },
  });
  assert.equal(manifest.products.length, 12);
  assert.equal(manifest.attempts.length, 12);
  assert.ok(manifest.attempts.every((row) => row.rendererId === "openai-gpt-image-2"));
  assert.ok(manifest.attempts.every((row) => row.attemptOrdinal === 1));
  assert.ok(manifest.products.every((row) => row.references.length === 2));
  assert.ok(manifest.products.every((row) => row.prompt.includes("NO POST-GENERATION BACKGROUND PAINTING")));
  assert.ok(manifest.products.every((row) => row.prompt.includes("CONTAINS NO CAP, COLLAR, SPRAYER, OVERCAP, INTERNAL HARDWARE, OR DIP TUBE")));
  assert.ok(manifest.products.every((row) => row.references[1].locator === "tmp/material/clear-glass-body-only.png"));
  assert.ok(manifest.products.every((row) => row.references[1].sha256 === "e".repeat(64)));
  assert.ok(manifest.products.every((row) => row.scaleContract.canvasWidthPx === 2080));
  assert.ok(manifest.products.every((row) => row.scaleContract.canvasHeightPx === 2288));
  assert.ok(manifest.products.filter((row) => row.assetRole === "sidecar").every((row) =>
    row.references[0].conditioning?.maskSemantics
      === "transparent-body-material-edit-opaque-hardware-sidecar-bone-preserve"
  ));

  for (const capacityMl of capacities) {
    const pair = manifest.products.filter((row) => row.capacityMl === capacityMl);
    assert.equal(pair.length, 2);
    assert.equal(pair[0].scaleContract.bodyTargetPx, pair[1].scaleContract.bodyTargetPx);
    assert.notEqual(pair[0].references[0].sha256, pair[1].references[0].sha256);
  }
});
