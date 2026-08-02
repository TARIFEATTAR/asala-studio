import assert from "node:assert/strict";
import test from "node:test";

import { getLocalPaperDollPreview } from "./releasePreview";

test("getLocalPaperDollPreview requires both development mode and an explicit preview query", () => {
  const enabled = getLocalPaperDollPreview({
    familyKey: "CYL-9ML",
    isDevelopment: true,
    search: "?paperDollPreview=1",
    assetBaseUrl: "http://127.0.0.1:8084",
  });

  assert.equal(enabled?.release.familyKey, "CYL-9ML");
  assert.deepEqual(enabled?.assets.map((asset) => asset.displayName), [
    "Clear body plate",
    "Amber body plate",
    "Cobalt body plate",
    "Frosted body plate",
    "Swirl body plate",
  ]);
  assert.equal(enabled?.assets.every((asset) => asset.approvalStatus === "approved"), true);
  assert.equal(
    enabled?.assets[0].imageUrl,
    "http://127.0.0.1:8084/body__cylinder__9ml__clear__70.0x20.0mm.png",
  );
  assert.equal(getLocalPaperDollPreview({
    familyKey: "CYL-9ML",
    isDevelopment: false,
    search: "?paperDollPreview=1",
  }), null);
  assert.equal(getLocalPaperDollPreview({
    familyKey: "CYL-9ML",
    isDevelopment: true,
    search: "",
  }), null);
});
