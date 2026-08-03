import assert from "node:assert/strict";
import test from "node:test";

import {
  parseComponentCandidate,
  parsePaperDollFamilyProductionManifest,
  type ComponentCandidate,
  type PaperDollFamilyProductionManifest,
} from "./componentPlateContract";

const sha = (character: string) => character.repeat(64);

function candidateFixture(): ComponentCandidate {
  return {
    candidateId: "candidate-sprayer-silver-1",
    familyKey: "CYL-9ML",
    componentKey: "sprayer__17-415__fine-mist",
    variantKey: "SSLV",
    source: {
      originalFilename: "Spry17-415ShnSl.psd.png",
      path: "private://paper-doll-candidates/source-a.png",
      sha256: sha("a"),
      widthPx: 1024,
      heightPx: 1536,
    },
    sourceBoundsPx: { left: 29, top: 24, width: 980, height: 1461 },
    authorityBoundsPx: { left: 124, top: 187, width: 1152, height: 1681 },
    editBoundsPx: { left: 29, top: 24, width: 980, height: 1461 },
    placementBoundsPx: { left: 869, top: 500, width: 344, height: 502 },
    authorityMaskPath: "private://paper-doll-authority/sprayer-mask.png",
    authorityMaskSha256: sha("b"),
    normalizedCandidateSha256: sha("c"),
    fullCanvasLayerSha256: sha("d"),
    placementVersionId: null,
    provider: "manual",
    model: "manual-v1",
    promptSha256: null,
    estimatedCostUsd: null,
    qa: { geometryLocked: true, minIoU: 1, mismatchedPixels: 0 },
    mutationPolicy: { currentReleaseChanged: false, sanityChanged: false },
    lifecycleState: "candidate",
  };
}

function manifestFixture(): PaperDollFamilyProductionManifest {
  return {
    schemaVersion: 1,
    familyKey: "CYL-9ML",
    canvas: { widthPx: 2080, heightPx: 2288, backgroundHex: "#F5F3EF" },
    bodyPlates: [
      {
        bodyVariantKey: "AMB",
        componentVersionId: "body-amber-v1",
        imagePath: "private://paper-doll-bodies/amber.png",
        imageSha256: sha("e"),
      },
    ],
    components: [
      {
        componentKey: "closure__17-415__rollon-overcap",
        slot: "cap",
        geometryFamilyId: "closure__17-415__rollon-overcap-v1",
        source: {
          originalFilename: "CpRoll17-415ShnSl.png",
          path: "outputs/paper-doll-plates/cap-regen-sources/CpRoll17-415ShnSl.png",
          sha256: sha("9"),
          widthPx: 552,
          heightPx: 736,
        },
        authorityStatus: "approved",
        authority: {
          authorityId: "authority-cap-v1",
          maskPath: "private://paper-doll-authority/cap-mask.png",
          maskSha256: sha("f"),
          maskWidthPx: 2080,
          maskHeightPx: 2288,
          authorityBoundsPx: { left: 869, top: 500, width: 344, height: 502 },
          expectedRegions: 1,
        },
        variants: [
          { variantKey: "SSLV", materialVariant: "shiny-silver", materialClass: "mirror" },
        ],
        compatibleBodyVariantKeys: ["AMB"],
      },
    ],
    placements: [
      {
        placementVersionId: "placement-cap-v1",
        geometryFamilyId: "closure__17-415__rollon-overcap-v1",
        widthPx: 344,
        centerXPx: 1041,
        seatYPx: 1002,
        placementBoundsPx: { left: 869, top: 500, width: 344, height: 502 },
        compatibleBodyVariantKeys: ["AMB"],
        locked: true,
      },
    ],
    catalogMappings: [
      {
        mappingKey: "AMB-ROLL-SSLV-PLASTIC",
        bodyVariantKey: "AMB",
        mode: "rollon",
        componentVariantKeys: [
          "closure__17-415__rollon-overcap:SSLV",
          "roller__17-415:PLASTIC",
        ],
      },
    ],
    catalogReviewIssues: [],
    releaseTarget: {
      sanityDocumentId: "d5291f24-f02b-4fb7-aa99-78c5f63d8c9d",
    },
  };
}

test("component candidates preserve four distinct bounding boxes and the original filename", () => {
  const parsed = parseComponentCandidate(candidateFixture());

  assert.equal(parsed.source.originalFilename, "Spry17-415ShnSl.psd.png");
  assert.deepEqual(parsed.sourceBoundsPx, { left: 29, top: 24, width: 980, height: 1461 });
  assert.deepEqual(parsed.authorityBoundsPx, { left: 124, top: 187, width: 1152, height: 1681 });
  assert.deepEqual(parsed.editBoundsPx, { left: 29, top: 24, width: 980, height: 1461 });
  assert.deepEqual(parsed.placementBoundsPx, { left: 869, top: 500, width: 344, height: 502 });
  assert.equal(parsed.placementVersionId, null);
});

test("catalog mappings reject partial SKU identity", () => {
  const partialIdentity = manifestFixture();
  partialIdentity.catalogMappings[0].graceSku = "GB-CYL-AMB-9ML-ROL-SSLV";

  assert.throws(
    () => parsePaperDollFamilyProductionManifest(partialIdentity),
    /graceSku.*websiteSku|websiteSku.*graceSku|both/i,
  );
});

test("component candidates reject path-like original filenames", () => {
  const fixture = candidateFixture();
  fixture.source.originalFilename = "library/path/Spry17-415ShnSl.psd.png";

  assert.throws(() => parseComponentCandidate(fixture), /filename|separator/i);
});

test("component candidates reject source and authority bounds outside their canvases", () => {
  const invalidSource = candidateFixture();
  invalidSource.sourceBoundsPx.width = 1020;
  assert.throws(() => parseComponentCandidate(invalidSource), /sourceBoundsPx|source/i);

  const invalidAuthority = candidateFixture();
  invalidAuthority.authorityBoundsPx.height = 2200;
  assert.throws(() => parseComponentCandidate(invalidAuthority), /authorityBoundsPx|release canvas/i);
});

test("family production manifests reject duplicate component and catalog keys", () => {
  const duplicateComponent = manifestFixture();
  duplicateComponent.components.push(structuredClone(duplicateComponent.components[0]));
  assert.throws(
    () => parsePaperDollFamilyProductionManifest(duplicateComponent),
    /duplicate component/i,
  );

  const duplicateMapping = manifestFixture();
  duplicateMapping.catalogMappings.push(structuredClone(duplicateMapping.catalogMappings[0]));
  assert.throws(
    () => parsePaperDollFamilyProductionManifest(duplicateMapping),
    /duplicate catalog/i,
  );
});

test("family production manifests reject duplicate variants and placement IDs", () => {
  const duplicateVariant = manifestFixture();
  duplicateVariant.components[0].variants.push(
    structuredClone(duplicateVariant.components[0].variants[0]),
  );
  assert.throws(
    () => parsePaperDollFamilyProductionManifest(duplicateVariant),
    /duplicate variant/i,
  );

  const duplicatePlacement = manifestFixture();
  duplicatePlacement.placements.push(structuredClone(duplicatePlacement.placements[0]));
  assert.throws(
    () => parsePaperDollFamilyProductionManifest(duplicatePlacement),
    /duplicate placement/i,
  );
});
