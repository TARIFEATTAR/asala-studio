import assert from "node:assert/strict";
import { test } from "node:test";

import type { PaperDollReleaseManifest } from "./releaseContract";
import {
  buildPaperDollSanityProjection,
  parseManifestFromPaperDollSanityDocument,
} from "./sanityProjection";

function fixtureManifest(status: PaperDollReleaseManifest["status"] = "blocked"): PaperDollReleaseManifest {
  return {
    schemaVersion: 1,
    familyKey: "CYL-9ML",
    releaseVersion: "1.0.0-draft.1",
    status,
    canvas: { widthPx: 2080, heightPx: 2288, backgroundHex: "#F5F3EF" },
    assets: [
      {
        componentVersionId: "body__cylinder__9ml__clear@aaaaaaaaaaaa",
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
        componentVersionId: "closure__17-415__silver@bbbbbbbbbbbb",
        componentKey: "closure__17-415",
        geometryFamilyId: "closure__17-415__v1",
        slot: "cap",
        variantKey: "SHN-SL",
        materialVariant: "mirror-chrome",
        imagePath: "layers/cap/SHN-SL.png",
        imageSha256: "b".repeat(64),
        geometryMaskPath: "geometry/cap-mask.png",
        geometryMaskSha256: "c".repeat(64),
        widthPx: 2080,
        heightPx: 2288,
        alphaBounds: { left: 860, top: 494, right: 1222, bottom: 1001 },
        mountAxisXPx: 1041,
        seatYPx: 1002,
        approvalStatus: "approved",
      },
    ],
    assemblyRecipes: [{ recipeKey: "rollon-capped", mode: "rollon", layerOrder: ["body", "cap"] }],
    assemblyMappings: [{
      mappingKey: "CYL-9ML:CLR:ROLLON:SHN-SL",
      websiteSku: "WEB-SKU",
      graceSku: "GRACE-SKU",
      recipeKey: "rollon-capped",
      bodyVariantKey: "CLR",
      fitmentVariantKey: null,
      closureVariantKey: "SHN-SL",
      overcapVariantKey: null,
    }],
    qaEvidence: [{
      evidenceId: "closure-shared-geometry-v1",
      subjectId: "closure__17-415__v1",
      gateKey: "shared-geometry-mask",
      gateVersion: "1",
      status: "passed",
      blocking: true,
      calibratedWith: ["silver", "white", "black"],
      measurements: { minIoU: 1, exactBinarySilhouette: true },
      issues: [],
    }],
    blockers: status === "blocked" ? ["catalog_incomplete"] : [],
    provenance: { sourceGitCommit: "fixture-commit", rendererVersion: "fixture-renderer" },
  };
}

test("projection preserves release truth with stable array keys and exact target", async () => {
  const manifest = fixtureManifest();
  const projection = await buildPaperDollSanityProjection(manifest, {
    projectId: "project123",
    dataset: "staging",
    documentId: "paperDollFamily.CYL-9ML",
    documentType: "paperDollFamily",
  });

  assert.deepEqual(projection.target, {
    projectId: "project123",
    dataset: "staging",
    documentId: "paperDollFamily.CYL-9ML",
    documentType: "paperDollFamily",
  });
  assert.equal(projection.document.schemaVersion, 1);
  assert.equal(projection.document.releaseVersion, manifest.releaseVersion);
  assert.equal(projection.document.manifestSha256, projection.manifestSha256);
  assert.deepEqual(projection.document.canvas, manifest.canvas);
  assert.deepEqual(projection.document.blockers, manifest.blockers);
  assert.equal(projection.document.assets.length, 2);
  assert.equal(projection.document.qaEvidence.length, 1);
  assert.deepEqual(projection.document.assemblyRecipes[0].layerOrder, ["body", "cap"]);
  assert.equal(projection.document.assemblyMappings[0].mappingKey, manifest.assemblyMappings[0].mappingKey);
  assert.ok(projection.document.assets.every((item) => item._key.length > 8));
  assert.equal(new Set(projection.document.assets.map((item) => item._key)).size, 2);
  assert.match(projection.payloadSha256, /^[a-f0-9]{64}$/);

  const repeated = await buildPaperDollSanityProjection(manifest, projection.target);
  assert.equal(repeated.payloadSha256, projection.payloadSha256);
  assert.deepEqual(
    repeated.document.assets.map((item) => item._key),
    projection.document.assets.map((item) => item._key),
  );
});

test("projected document round-trips to the Release v1 manifest", async () => {
  const manifest = fixtureManifest();
  const projection = await buildPaperDollSanityProjection(manifest);
  assert.equal(projection.roundTrip.passed, true);
  assert.deepEqual(parseManifestFromPaperDollSanityDocument(projection.document), manifest);
});

test("blocked projection proves zero writes and contains no mutation or credential fields", async () => {
  const projection = await buildPaperDollSanityProjection(fixtureManifest("blocked"));
  assert.deepEqual(projection.target, {
    projectId: "unconfigured",
    dataset: "unconfigured",
    documentId: "unconfigured",
    documentType: "paperDollFamily",
  });
  assert.equal(projection.validation.ready, false);
  assert.equal(projection.publishEligible, false);
  assert.equal(projection.writeCount, 0);
  assert.equal(projection.mode, "no-write-preview");
  assert.deepEqual(projection.assetPlan, { upload: 0, reuse: 0, unresolved: 2 });
  assert.doesNotMatch(JSON.stringify(projection), /mutation|token|secret|credential/i);
});
