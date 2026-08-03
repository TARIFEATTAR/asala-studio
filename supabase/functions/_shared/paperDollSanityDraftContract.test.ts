import assert from "node:assert/strict";
import test from "node:test";

import { buildPaperDollSanityDraftDocument } from "./paperDollSanityDraftContract.ts";

test("partial release creates the stable 2080x2288 draft but cannot become storefront-ready", () => {
  const document = buildPaperDollSanityDraftDocument({
    publicDocumentId: "d5291f24-f02b-4fb7-aa99-78c5f63d8c9d",
    familyKey: "CYL-9ML", releaseId: "release-1", releaseCutId: "cut-1", releaseVersion: "1.1.0",
    manifestSha256: "a".repeat(64), rendererVersion: "paper-doll-release-cut-v1", syncedAt: "2026-08-03T00:00:00.000Z",
    placement: { roller: { x: 27, y: -134, scale: 0.974 } },
    readiness: [{ mappingKey: "amber-matte-gold", websiteSku: "WEB", graceSku: "GRACE", status: "incomplete", missingReasons: ["cap:MAT-GL"] }],
    layers: [{ componentVersionId: "body-1", slot: "body", variantKey: "AMBER-GLASS", imageAssetId: "image-abc-2080x2288-png", sourceFilename: "amber.png" }],
  });
  assert.equal(document._id, "drafts.d5291f24-f02b-4fb7-aa99-78c5f63d8c9d");
  assert.equal(document.canvasPreset, "pdp-2080x2288");
  assert.equal(document.canvasWidth, 2080);
  assert.equal(document.canvasHeight, 2288);
  assert.equal(document.storefrontReady, false);
  assert.deepEqual(document.layerOrderRollon, ["body", "roller", "cap"]);
  assert.deepEqual(document.readinessSummary, { ready: 0, incomplete: 1, total: 1 });
});

test("Sanity configuration prefers the Best Bottles scoped credential", async () => {
  const contract = await import("./paperDollSanityDraftContract.ts") as Record<string, unknown>;
  const resolveConfig = contract.resolvePaperDollSanityConfig;
  assert.equal(typeof resolveConfig, "function");

  const values: Record<string, string> = {
    BESTBOTTLES_SANITY_PROJECT_ID: "best-bottles-project",
    BESTBOTTLES_SANITY_DATASET: "production",
    BESTBOTTLES_SANITY_WRITE_TOKEN: "best-bottles-token",
    SANITY_PROJECT_ID: "generic-project",
    SANITY_DATASET: "generic-dataset",
    SANITY_WRITE_TOKEN: "stale-generic-token",
  };
  const resolved = (resolveConfig as (get: (key: string) => string | undefined) => unknown)((key) => values[key]);

  assert.deepEqual(resolved, {
    projectId: "best-bottles-project",
    dataset: "production",
    token: "best-bottles-token",
  });
});
