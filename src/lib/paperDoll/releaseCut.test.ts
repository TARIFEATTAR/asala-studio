import assert from "node:assert/strict";
import { test } from "node:test";

import type { PaperDollReleaseManifest } from "./releaseContract";
import { advanceReleaseHead, buildReleaseCut } from "./releaseCut";

const box = { left: 860, top: 494, width: 344, height: 502 };

function fixtureManifest(): PaperDollReleaseManifest {
  return {
    schemaVersion: 1,
    familyKey: "CYL-9ML",
    releaseVersion: "1.0.0-caps.1",
    status: "ready",
    canvas: { widthPx: 2080, heightPx: 2288, backgroundHex: "#F5F3EF" },
    assets: [
      {
        componentVersionId: "body-clear@v1",
        componentKey: "body__cylinder__9ml__clear",
        geometryFamilyId: "body__cylinder__9ml__70x20__v1",
        slot: "body",
        variantKey: "CLR",
        materialVariant: "clear-glass",
        imagePath: "layers/body/CLR.png",
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
      {
        componentVersionId: "cap-shiny-silver@v1",
        candidateId: "candidate-cap-shiny-silver-v1",
        placementVersionId: "placement-cap-17-415-v1",
        componentKey: "cap__17-415__rollon",
        geometryFamilyId: "cap__17-415__rollon__v1",
        slot: "cap",
        variantKey: "SHN-SL",
        materialVariant: "mirror-chrome",
        imagePath: "layers/cap/SHN-SL.png",
        imageSha256: "b".repeat(64),
        geometryMaskPath: "authority/cap-mask.png",
        geometryMaskSha256: "c".repeat(64),
        widthPx: 2080,
        heightPx: 2288,
        alphaBounds: { left: 860, top: 494, right: 1203, bottom: 995 },
        mountAxisXPx: 1041,
        seatYPx: 1002,
        approvalStatus: "approved",
        sourceBoundsPx: box,
        editBoundsPx: box,
        authorityBoundsPx: box,
        placementBoundsPx: box,
      },
    ],
    assemblyRecipes: [{ recipeKey: "rollon-capped", mode: "rollon", layerOrder: ["body", "cap"] }],
    assemblyMappings: [{
      mappingKey: "CYL-9ML:CLR:ROLLON:SHN-SL",
      websiteSku: "WEB-CYL-9ML-CLR-SHNSL",
      graceSku: "GB-CYL-CLR-9ML-ROL-SSLV",
      recipeKey: "rollon-capped",
      bodyVariantKey: "CLR",
      fitmentVariantKey: null,
      closureVariantKey: "SHN-SL",
      overcapVariantKey: null,
    }],
    qaEvidence: [],
    blockers: [],
    provenance: { sourceGitCommit: "fixture", rendererVersion: "fixture" },
  };
}

test("release cuts are content-addressed and advance the head idempotently", async () => {
  const first = await buildReleaseCut({ manifest: fixtureManifest() });
  const second = await buildReleaseCut({ manifest: fixtureManifest() });
  assert.equal(first.cutId, second.cutId);
  assert.equal(first.manifestSha256, second.manifestSha256);
  assert.deepEqual(first.componentVersionIds, ["body-clear@v1", "cap-shiny-silver@v1"]);
  assert.deepEqual(first.placementVersionIds, ["placement-cap-17-415-v1"]);

  const created = advanceReleaseHead(null, first, 0);
  const repeated = advanceReleaseHead(created, first, created.revision);
  assert.deepEqual(repeated, created);
});

test("release cuts reject mutable candidates and mixed placement truth", async () => {
  const mutable = fixtureManifest();
  mutable.assets[1].approvalStatus = "candidate";
  await assert.rejects(() => buildReleaseCut({ manifest: mutable }), /approved immutable/i);

  const mixed = fixtureManifest();
  mixed.assets.push({
    ...mixed.assets[1],
    componentVersionId: "cap-white@v1",
    candidateId: "candidate-cap-white-v1",
    variantKey: "WHT",
    materialVariant: "white-gloss",
    placementVersionId: "placement-cap-17-415-v2",
    imageSha256: "d".repeat(64),
  });
  await assert.rejects(() => buildReleaseCut({ manifest: mixed }), /mixed placement/i);
});

test("incremental cuts report unresolved catalog mappings without inventing assets", async () => {
  const incremental = fixtureManifest();
  incremental.assemblyMappings.push({
    ...incremental.assemblyMappings[0],
    mappingKey: "CYL-9ML:CLR:ROLLON:WHT",
    websiteSku: "WEB-CYL-9ML-CLR-WHT",
    graceSku: "GB-CYL-CLR-9ML-ROL-WHT",
    closureVariantKey: "WHT",
  });
  const cut = await buildReleaseCut({ manifest: incremental });
  assert.deepEqual(cut.resolvedCatalogMappingKeys, ["CYL-9ML:CLR:ROLLON:SHN-SL"]);
  assert.deepEqual(cut.unresolvedCatalogMappings.map((row) => row.mappingKey), ["CYL-9ML:CLR:ROLLON:WHT"]);
});
