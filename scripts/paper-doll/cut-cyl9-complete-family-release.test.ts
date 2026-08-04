import assert from "node:assert/strict";
import test from "node:test";

import { loadCyl9ComponentFactory } from "../../src/lib/paperDoll/cyl9ComponentFactory";

const sha = (character: string) => character.repeat(64);

function asset(slot: string, variantKey: string, index: number) {
  return {
    componentVersionId: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    componentKey: `${slot}__${variantKey}`,
    geometryFamilyId: `${slot}__geometry__v1`,
    slot,
    variantKey,
    materialVariant: variantKey.toLowerCase(),
    imagePath: `approved/${slot}/${variantKey}.png`,
    imageSha256: sha((index % 10).toString()),
    geometryMaskPath: slot === "body" ? null : `approved/${slot}/mask.png`,
    geometryMaskSha256: slot === "body" ? null : sha("a"),
    widthPx: 2080,
    heightPx: 2288,
    alphaBounds: { left: 1, top: 1, right: 2, bottom: 2 },
    mountAxisXPx: 1040,
    seatYPx: 1000,
    approvalStatus: "approved",
    ...(slot === "body" ? {} : { placementVersionId: `10000000-0000-4000-8000-${String(index).padStart(12, "0")}` }),
  };
}

test("builds one ready 26-asset CYL-9ML release with every catalog mapping complete", async () => {
  let module: typeof import("./cut-cyl9-complete-family-release") | null = null;
  try {
    module = await import("./cut-cyl9-complete-family-release");
  } catch {
    // The first TDD run proves the release-completion module is absent.
  }
  assert.ok(module, "Expected the CYL-9ML completion release module.");

  const currentAssets = [
    ...["AMB", "BLU", "CLR", "FRS", "SWL"].map((key, index) => asset("body", key, index + 1)),
    ...["METAL", "PLASTIC"].map((key, index) => asset("roller", key, index + 6)),
    ...["BLK", "GLD", "MSLV", "RED", "SSLV", "TUR"].map((key, index) => asset("sprayer", key, index + 8)),
    ...["BLK", "GLD", "MSLV"].map((key, index) => asset("pump", key, index + 14)),
  ];
  for (const roller of currentAssets.filter(({ slot }) => slot === "roller")) {
    delete roller.placementVersionId;
  }
  const capAssets = ["BKDT", "MCPR", "MGLD", "MSLV", "PKDT", "SBLK", "SGLD", "SLDT", "SSLV", "WHT"]
    .map((key, index) => ({ ...asset("cap", key, index + 17), placementVersionId: "64099824-4079-43f2-8219-8afa6cb18dd6" }));

  const result = module.buildCompleteCyl9ReleasePlan({
    currentManifest: {
      schemaVersion: 1,
      familyKey: "CYL-9ML",
      releaseVersion: "1.2.0-capped-dispensers.1",
      status: "blocked",
      canvas: { widthPx: 2080, heightPx: 2288, backgroundHex: "#F5F3EF" },
      assets: currentAssets,
      assemblyRecipes: [],
      assemblyMappings: [],
      qaEvidence: [],
      blockers: ["missing_asset:cap:WHT"],
      provenance: { sourceGitCommit: "before", rendererVersion: "before" },
    },
    capAssets,
    mappings: module.buildReleaseAssemblyMappings(loadCyl9ComponentFactory()),
    releaseVersion: "1.3.0-complete-family.1",
    sourceGitCommit: "c4c2180",
    rendererVersion: "paper-doll-complete-family-v1",
    capPlacementVersionId: "64099824-4079-43f2-8219-8afa6cb18dd6",
    capAuthoritySha256: sha("a"),
    placementVersionIdsByGeometryFamily: {
      roller__geometry__v1: "fbe551b9-19ca-4202-842c-06634fdae2da",
    },
  });

  assert.equal(result.manifest.assets.length, 26);
  assert.deepEqual(
    Object.fromEntries(["body", "roller", "cap", "sprayer", "pump"].map((slot) => [slot, result.manifest.assets.filter((row) => row.slot === slot).length])),
    { body: 5, roller: 2, cap: 10, sprayer: 6, pump: 3 },
  );
  assert.equal(result.manifest.status, "ready");
  assert.deepEqual(result.manifest.blockers, []);
  assert.equal(result.readiness.length, 145);
  assert.equal(result.readiness.filter(({ status }) => status === "ready").length, 145);
  assert.equal(result.selectedComponents.length, 10);
  assert.ok(result.selectedComponents.every(({ placementVersionId }) => placementVersionId === "64099824-4079-43f2-8219-8afa6cb18dd6"));
  assert.ok(result.manifest.assets.filter(({ slot }) => slot === "roller")
    .every(({ placementVersionId }) => placementVersionId === "fbe551b9-19ca-4202-842c-06634fdae2da"));
});
