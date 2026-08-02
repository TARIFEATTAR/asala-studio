import assert from "node:assert/strict";
import { test } from "node:test";

import type {
  PaperDollReleaseAsset,
  PaperDollReleaseManifest,
} from "./releaseContract";
import {
  buildReleaseInventory,
  buildWorkbenchLineup,
  deriveReleaseLifecycleCounts,
  getGeometryVerification,
  isCyl9ReleaseWorkbenchGroup,
  resolveWorkbenchAssembly,
} from "./workbenchModel";

const BODY_VARIANTS = ["CLR", "AMB", "BLU", "FRS", "SWL"] as const;
const CAP_VARIANTS = [
  ["SHN-SL", "mirror-chrome", "approved"],
  ["WHT", "matte-white", "approved"],
  ["SHN-BLK", "glossy-black", "approved"],
  ["TRNS-FRS", "translucent-frosted", "blocked"],
] as const;
const HASH = {
  body: "a".repeat(64),
  cap: "b".repeat(64),
  mask: "c".repeat(64),
};

function asset(input: Partial<PaperDollReleaseAsset> & Pick<PaperDollReleaseAsset, "slot" | "variantKey">): PaperDollReleaseAsset {
  const isBody = input.slot === "body";
  return {
    componentVersionId: `${input.slot}:${input.variantKey}@fixture`,
    componentKey: `${input.slot}:fixture`,
    geometryFamilyId: isBody ? "body__cylinder__9ml__70x20__v1" : "closure__17-415__rollon-overcap__v1",
    materialVariant: isBody ? `${input.variantKey.toLowerCase()}-glass` : "mirror-chrome",
    imagePath: `layers/${input.slot}/${input.variantKey}.png`,
    imageSha256: isBody ? HASH.body : HASH.cap,
    geometryMaskPath: isBody ? null : "geometry/cap-mask.png",
    geometryMaskSha256: isBody ? null : HASH.mask,
    widthPx: 2080,
    heightPx: 2288,
    alphaBounds: isBody
      ? { left: 860, top: 750, right: 1225, bottom: 2089 }
      : { left: 860, top: 494, right: 1222, bottom: 1001 },
    mountAxisXPx: 1041,
    seatYPx: isBody ? 2090 : 1002,
    approvalStatus: "approved",
    ...input,
  };
}

function fixtureManifest(): PaperDollReleaseManifest {
  const bodies = BODY_VARIANTS.map((variantKey) => asset({ slot: "body", variantKey }));
  const caps = CAP_VARIANTS.map(([variantKey, materialVariant, approvalStatus]) => asset({
    slot: "cap",
    variantKey,
    materialVariant,
    approvalStatus,
  }));
  const approvedCaps = CAP_VARIANTS.filter(([, , status]) => status === "approved");
  return {
    schemaVersion: 1,
    familyKey: "CYL-9ML",
    releaseVersion: "1.0.0-draft.1",
    status: "blocked",
    canvas: { widthPx: 2080, heightPx: 2288, backgroundHex: "#F5F3EF" },
    assets: [...bodies, ...caps],
    assemblyRecipes: [{ recipeKey: "rollon-capped", mode: "rollon", layerOrder: ["body", "cap"] }],
    assemblyMappings: BODY_VARIANTS.flatMap((bodyVariantKey) =>
      approvedCaps.map(([closureVariantKey]) => ({
        mappingKey: `CYL-9ML:${bodyVariantKey}:ROLLON:${closureVariantKey}`,
        websiteSku: `WEB:${bodyVariantKey}:${closureVariantKey}`,
        graceSku: `GRACE:${bodyVariantKey}:${closureVariantKey}`,
        recipeKey: "rollon-capped",
        bodyVariantKey,
        fitmentVariantKey: null,
        closureVariantKey,
        overcapVariantKey: null,
      }))),
    qaEvidence: [
      {
        evidenceId: "closure-shared-geometry-v1",
        subjectId: "closure__17-415__rollon-overcap__v1",
        gateKey: "shared-geometry-mask",
        gateVersion: "1",
        status: "passed",
        blocking: true,
        calibratedWith: ["silver", "matte-white", "glossy-black"],
        measurements: { minIoU: 1, exactBinarySilhouette: true, maskSha256: HASH.mask },
        issues: [],
      },
      {
        evidenceId: "closure-translucent-context-v1",
        subjectId: "cap:TRNS-FRS@fixture",
        gateKey: "translucent-assembly-context",
        gateVersion: "1",
        status: "blocked",
        blocking: true,
        calibratedWith: ["translucent-frosted"],
        measurements: { isolatedLayer: true },
        issues: ["assembly_context_required"],
      },
    ],
    blockers: ["assembly_context_required:cap:TRNS-FRS@fixture"],
    provenance: { sourceGitCommit: "fixture", rendererVersion: "fixture" },
  };
}

test("only the canonical CYL-9ML group opts into the release workbench", () => {
  assert.equal(isCyl9ReleaseWorkbenchGroup("cylinder-9ml-frosted-17-415-rollon"), true);
  assert.equal(isCyl9ReleaseWorkbenchGroup("cylinder-9ml-clear-17-415-rollon"), false);
  assert.equal(isCyl9ReleaseWorkbenchGroup(undefined), false);
});

test("inventory separates body materials from component systems and retains blocked assets", () => {
  const inventory = buildReleaseInventory(fixtureManifest());
  assert.equal(inventory.bodies.length, 5);
  assert.deepEqual(inventory.bodies.map((item) => item.variantKey), BODY_VARIANTS);
  assert.deepEqual(inventory.systems.map((system) => system.key), ["rollon"]);
  assert.equal(inventory.systems[0].components.length, 4);
  assert.equal(
    inventory.systems[0].components.find((item) => item.variantKey === "TRNS-FRS")?.approvalStatus,
    "blocked",
  );
});

test("lifecycle counts preserve truthful asset and assembly denominators", () => {
  const counts = deriveReleaseLifecycleCounts(fixtureManifest());
  assert.deepEqual(counts.assets, {
    required: 9,
    approved: 8,
    blocked: 1,
    candidate: 0,
    rejected: 0,
    published: 0,
  });
  assert.deepEqual(counts.assemblies, {
    required: 15,
    resolvable: 15,
    blocked: 0,
    published: 0,
  });
});

test("blocked or missing selections fail instead of falling back", () => {
  const manifest = fixtureManifest();
  const blocked = {
    ...manifest,
    assemblyMappings: [{
      ...manifest.assemblyMappings[0],
      mappingKey: "BLOCKED",
      closureVariantKey: "TRNS-FRS",
    }],
  };
  assert.throws(() => resolveWorkbenchAssembly(blocked, "BLOCKED"), /blocked.*not approved/i);

  const missing = {
    ...manifest,
    assemblyMappings: [{
      ...manifest.assemblyMappings[0],
      mappingKey: "MISSING",
      closureVariantKey: "DOES-NOT-EXIST",
    }],
  };
  assert.throws(() => resolveWorkbenchAssembly(missing, "MISSING"), /missing asset/i);
});

test("geometry locked requires calibrated passing mask evidence", () => {
  const manifest = fixtureManifest();
  const silver = manifest.assets.find((item) => item.variantKey === "SHN-SL")!;
  assert.equal(getGeometryVerification(manifest, silver), "geometry-locked");
  assert.equal(
    getGeometryVerification({ ...manifest, qaEvidence: [] }, silver),
    "shared-mask",
  );
  assert.equal(getGeometryVerification(manifest, manifest.assets[0]), "not-verified");
});

test("lineup resolves five explicit mappings with one scale and manifest layer order", () => {
  const manifest = fixtureManifest();
  const mappingKeys = BODY_VARIANTS.map((body) => `CYL-9ML:${body}:ROLLON:SHN-SL`);
  const lineup = buildWorkbenchLineup(manifest, mappingKeys);
  assert.equal(lineup.length, 5);
  assert.deepEqual(lineup.map((item) => item.mappingKey), mappingKeys);
  assert.ok(lineup.every((item) => item.layers.map((layer) => layer.slot).join(",") === "body,cap"));
  assert.ok(lineup.every((item) => item.overlay.canvasWidthPx === 2080));
  assert.equal(lineup[0].overlay.centerlinePct, (1041 / 2080) * 100);
  assert.equal(lineup[0].layers[0].boundsPct.left, (860 / 2080) * 100);
});
