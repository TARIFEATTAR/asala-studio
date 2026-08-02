import assert from "node:assert/strict";
import { test } from "node:test";

import type { PaperDollReleaseManifest } from "@/lib/paperDoll/releaseContract";
import {
  boundsToCanvasPercent,
  buildAssemblyCanvasModel,
  canvasPointToPercent,
} from "./assemblyCanvasModel";

const manifest: PaperDollReleaseManifest = {
  schemaVersion: 1,
  familyKey: "TEST",
  releaseVersion: "1.0.0",
  status: "ready",
  canvas: { widthPx: 2080, heightPx: 2288, backgroundHex: "#F5F3EF" },
  assets: [
    {
      componentVersionId: "cap@fixture",
      componentKey: "cap",
      geometryFamilyId: "cap-v1",
      slot: "cap",
      variantKey: "SILVER",
      materialVariant: "mirror-chrome",
      imagePath: "layers/cap/SILVER.png",
      imageSha256: "b".repeat(64),
      geometryMaskPath: "geometry/cap.png",
      geometryMaskSha256: "c".repeat(64),
      widthPx: 2080,
      heightPx: 2288,
      alphaBounds: { left: 860, top: 494, right: 1222, bottom: 1001 },
      mountAxisXPx: 1041,
      seatYPx: 1002,
      approvalStatus: "approved",
    },
    {
      componentVersionId: "body@fixture",
      componentKey: "body",
      geometryFamilyId: "body-v1",
      slot: "body",
      variantKey: "CLEAR",
      materialVariant: "clear-glass",
      imagePath: "layers/body/CLEAR.png",
      imageSha256: "a".repeat(64),
      geometryMaskPath: null,
      geometryMaskSha256: null,
      widthPx: 2080,
      heightPx: 2288,
      alphaBounds: { left: 860, top: 750, right: 1225, bottom: 2089 },
      mountAxisXPx: 1041,
      seatYPx: 2090,
      approvalStatus: "approved",
    },
  ],
  assemblyRecipes: [{ recipeKey: "capped", mode: "rollon", layerOrder: ["body", "cap"] }],
  assemblyMappings: [{
    mappingKey: "TEST:CLEAR:SILVER",
    websiteSku: "WEB",
    graceSku: "GRACE",
    recipeKey: "capped",
    bodyVariantKey: "CLEAR",
    fitmentVariantKey: null,
    closureVariantKey: "SILVER",
    overcapVariantKey: null,
  }],
  qaEvidence: [],
  blockers: [],
  provenance: { sourceGitCommit: "fixture", rendererVersion: "fixture" },
};

test("canvas model resolves exact mapping order, URLs, and overlays", () => {
  const model = buildAssemblyCanvasModel(manifest, "TEST:CLEAR:SILVER", {
    "layers/body/CLEAR.png": "/body.png",
    "layers/cap/SILVER.png": "/cap.png",
    "geometry/cap.png": "/mask.png",
  });
  assert.deepEqual(model.layers.map((layer) => layer.slot), ["body", "cap"]);
  assert.deepEqual(model.layers.map((layer) => layer.imageUrl), ["/body.png", "/cap.png"]);
  assert.equal(model.layers[1].geometryMaskUrl, "/mask.png");
  assert.equal(model.centerlinePct, (1041 / 2080) * 100);
  assert.equal(model.baselinePct, (2090 / 2288) * 100);
  assert.equal(model.mapping.websiteSku, "WEB");
});

test("canvas model fails closed when an image or geometry URL is missing", () => {
  assert.throws(
    () => buildAssemblyCanvasModel(manifest, "TEST:CLEAR:SILVER", {
      "layers/body/CLEAR.png": "/body.png",
      "layers/cap/SILVER.png": "/cap.png",
    }),
    /missing browser URL.*geometry\/cap\.png/i,
  );
});

test("canvas coordinates convert directly from manifest dimensions", () => {
  assert.deepEqual(canvasPointToPercent({ x: 1040, y: 1144 }, manifest.canvas), { x: 50, y: 50 });
  assert.deepEqual(
    boundsToCanvasPercent({ left: 0, top: 0, right: 2079, bottom: 2287 }, manifest.canvas),
    { left: 0, top: 0, width: 100, height: 100 },
  );
});
