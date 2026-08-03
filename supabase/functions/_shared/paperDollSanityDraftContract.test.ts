import assert from "node:assert/strict";
import test from "node:test";

import { buildPaperDollSanityDraftDocument } from "./paperDollSanityDraftContract.ts";

test("partial release creates the stable 2080x2288 draft but cannot become storefront-ready", () => {
  const document = buildPaperDollSanityDraftDocument({
    familyKey: "CYL-9ML", releaseId: "release-1", releaseCutId: "cut-1", releaseVersion: "1.1.0",
    manifestSha256: "a".repeat(64), rendererVersion: "paper-doll-release-cut-v1", syncedAt: "2026-08-03T00:00:00.000Z",
    placement: { roller: { x: 27, y: -134, scale: 0.974 } },
    readiness: [{ mappingKey: "amber-matte-gold", websiteSku: "WEB", graceSku: "GRACE", status: "incomplete", missingReasons: ["cap:MAT-GL"] }],
    layers: [{ componentVersionId: "body-1", slot: "body", variantKey: "AMBER-GLASS", imageAssetId: "image-abc-2080x2288-png", sourceFilename: "amber.png" }],
  });
  assert.equal(document._id, "drafts.paperDollFamily.CYL-9ML");
  assert.equal(document.canvasPreset, "pdp-2080x2288");
  assert.equal(document.canvasWidth, 2080);
  assert.equal(document.canvasHeight, 2288);
  assert.equal(document.storefrontReady, false);
  assert.deepEqual(document.layerOrderRollon, ["body", "roller", "cap"]);
  assert.deepEqual(document.readinessSummary, { ready: 0, incomplete: 1, total: 1 });
});
