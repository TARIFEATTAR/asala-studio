import assert from "node:assert/strict";
import test from "node:test";

import type {
  PaperDollQaEvidence,
  PaperDollReleaseAsset,
  PaperDollReleaseManifest,
} from "./releaseContract";
import {
  resolvePaperDollAssembly,
  validatePaperDollRelease,
} from "./releaseValidator";

const SHA_A = "a".repeat(64);
const SHA_B = "b".repeat(64);
const MASK_SHA = "c".repeat(64);

function approvedAsset(
  overrides: Partial<PaperDollReleaseAsset> = {},
): PaperDollReleaseAsset {
  return {
    componentVersionId: "cap-version-shn-sl",
    componentKey: "closure__17-415__rollon-overcap",
    geometryFamilyId: "closure__17-415__rollon-overcap__v1",
    slot: "cap",
    variantKey: "SHN-SL",
    materialVariant: "mirror-chrome",
    imagePath: "layers/cap/SHN-SL.png",
    imageSha256: SHA_A,
    geometryMaskPath: "geometry/cap-mask.png",
    geometryMaskSha256: MASK_SHA,
    widthPx: 2080,
    heightPx: 2288,
    alphaBounds: { left: 860, top: 494, right: 1222, bottom: 1001 },
    mountAxisXPx: 1041,
    seatYPx: 1002,
    approvalStatus: "approved",
    ...overrides,
  };
}

function bodyAsset(overrides: Partial<PaperDollReleaseAsset> = {}): PaperDollReleaseAsset {
  return approvedAsset({
    componentVersionId: "body-version-clr",
    componentKey: "body__cylinder__9ml__clear",
    geometryFamilyId: "body__cylinder__9ml__70x20__v1",
    slot: "body",
    variantKey: "CLR",
    materialVariant: "clear-glass",
    imagePath: "layers/body/CLR.png",
    imageSha256: SHA_B,
    geometryMaskPath: null,
    geometryMaskSha256: null,
    alphaBounds: { left: 850, top: 760, right: 1230, bottom: 2100 },
    mountAxisXPx: 1041,
    seatYPx: 2101,
    ...overrides,
  });
}

function qa(overrides: Partial<PaperDollQaEvidence> = {}): PaperDollQaEvidence {
  return {
    evidenceId: "qa-shared-mask",
    subjectId: "closure__17-415__rollon-overcap__v1",
    gateKey: "shared-geometry-mask",
    gateVersion: "1",
    status: "passed",
    blocking: true,
    calibratedWith: ["closure-material-pilot:silver"],
    measurements: { minIoU: 1 },
    issues: [],
    ...overrides,
  };
}

function release(overrides: Partial<PaperDollReleaseManifest> = {}): PaperDollReleaseManifest {
  return {
    schemaVersion: 1,
    familyKey: "CYL-9ML",
    releaseVersion: "1.0.0-draft.1",
    status: "draft",
    canvas: { widthPx: 2080, heightPx: 2288, backgroundHex: "#F5F3EF" },
    assets: [bodyAsset(), approvedAsset()],
    assemblyRecipes: [{ recipeKey: "rollon-capped", mode: "rollon", layerOrder: ["body", "cap"] }],
    assemblyMappings: [{
      mappingKey: "CYL-9ML:CLR:ROLLON:SHN-SL",
      websiteSku: "fixture-web-sku",
      graceSku: "fixture-grace-sku",
      recipeKey: "rollon-capped",
      bodyVariantKey: "CLR",
      fitmentVariantKey: null,
      closureVariantKey: "SHN-SL",
      overcapVariantKey: null,
    }],
    qaEvidence: [qa()],
    blockers: [],
    provenance: { sourceGitCommit: "fixture", rendererVersion: "fixture" },
    ...overrides,
  };
}

test("duplicate slot and variant keys block a release", () => {
  const asset = approvedAsset();
  const result = validatePaperDollRelease(release({
    assets: [bodyAsset(), asset, { ...asset, componentVersionId: "cap-version-duplicate" }],
  }));

  assert.equal(result.ready, false);
  assert.match(result.blockers.join("\n"), /duplicate_asset:cap:SHN-SL/);
});

test("blocking QA without calibration fixtures blocks readiness", () => {
  const result = validatePaperDollRelease(release({
    qaEvidence: [qa({ calibratedWith: [] })],
  }));

  assert.equal(result.ready, false);
  assert.match(result.blockers.join("\n"), /uncalibrated_gate:shared-geometry-mask/);
});

test("isolated translucent plastic remains blocked", () => {
  const result = validatePaperDollRelease(release({
    assets: [
      bodyAsset(),
      approvedAsset({
        componentVersionId: "cap-version-translucent",
        variantKey: "TRNS-FRS",
        materialVariant: "translucent-frosted",
        approvalStatus: "approved",
      }),
    ],
    assemblyMappings: [],
  }));

  assert.equal(result.ready, false);
  assert.match(result.blockers.join("\n"), /assembly_context_required:cap-version-translucent/);
});

test("unknown assembly mapping fails closed", () => {
  assert.throws(
    () => resolvePaperDollAssembly(release(), "missing"),
    /No assembly mapping 'missing'/,
  );
});

test("assembly resolver returns recipe order and never array order", () => {
  const result = resolvePaperDollAssembly(release({
    assets: [approvedAsset(), bodyAsset()],
  }), "CYL-9ML:CLR:ROLLON:SHN-SL");

  assert.deepEqual(result.layers.map((asset) => `${asset.slot}:${asset.variantKey}`), [
    "body:CLR",
    "cap:SHN-SL",
  ]);
});

test("missing selected component blocks validation and resolution", () => {
  const manifest = release({ assets: [bodyAsset()] });
  const validation = validatePaperDollRelease(manifest);

  assert.match(validation.blockers.join("\n"), /missing_asset:cap:SHN-SL/);
  assert.throws(
    () => resolvePaperDollAssembly(manifest, "CYL-9ML:CLR:ROLLON:SHN-SL"),
    /Missing asset 'cap:SHN-SL'/,
  );
});
