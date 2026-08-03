import assert from "node:assert/strict";
import test from "node:test";

import {
  canonicalizeReleaseValue,
  parsePaperDollReleaseManifest,
  type PaperDollReleaseManifest,
} from "./releaseContract";
import { hashPaperDollRelease } from "./releaseHash.node";

const validRelease: PaperDollReleaseManifest = {
  schemaVersion: 1,
  familyKey: "CYL-9ML",
  releaseVersion: "1.0.0-draft.1",
  status: "draft",
  canvas: { widthPx: 2080, heightPx: 2288, backgroundHex: "#F5F3EF" },
  assets: [],
  assemblyRecipes: [],
  assemblyMappings: [],
  qaEvidence: [],
  blockers: [],
  provenance: { sourceGitCommit: "fixture", rendererVersion: "fixture" },
};

test("release parser accepts the locked CYL-9ML canvas", () => {
  assert.equal(parsePaperDollReleaseManifest(validRelease).familyKey, "CYL-9ML");
});

test("release parser rejects a legacy paper-doll canvas", () => {
  assert.throws(
    () => parsePaperDollReleaseManifest({
      ...validRelease,
      canvas: { widthPx: 1000, heightPx: 1300, backgroundHex: "#F5F3EF" },
    }),
    /2080|2288/,
  );
});

test("canonical JSON and manifest hash ignore object insertion order", () => {
  const reordered = {
    ...validRelease,
    provenance: { rendererVersion: "fixture", sourceGitCommit: "fixture" },
  };

  assert.equal(canonicalizeReleaseValue(validRelease), canonicalizeReleaseValue(reordered));
  assert.equal(hashPaperDollRelease(validRelease), hashPaperDollRelease(reordered));
});

test("release assets preserve optional candidate, placement, and four-box evidence", () => {
  const bounds = { left: 869, top: 500, width: 344, height: 502 };
  const parsed = parsePaperDollReleaseManifest({
    ...validRelease,
    assets: [{
      componentVersionId: "cap-v1",
      componentKey: "closure__17-415__rollon-overcap",
      geometryFamilyId: "closure__17-415__rollon-overcap-v1",
      slot: "cap",
      variantKey: "SGLD",
      materialVariant: "shiny-gold",
      imagePath: "private://paper-doll-components/cap.png",
      imageSha256: "a".repeat(64),
      geometryMaskPath: "private://paper-doll-authority/cap-mask.png",
      geometryMaskSha256: "b".repeat(64),
      widthPx: 2080,
      heightPx: 2288,
      alphaBounds: { left: 869, top: 500, right: 1212, bottom: 1001 },
      mountAxisXPx: 1041,
      seatYPx: 1002,
      approvalStatus: "approved",
      candidateId: "candidate-cap-gold-v1",
      placementVersionId: "placement-cap-v1",
      sourceBoundsPx: { left: 29, top: 24, width: 980, height: 1461 },
      authorityBoundsPx: bounds,
      editBoundsPx: { left: 29, top: 24, width: 980, height: 1461 },
      placementBoundsPx: bounds,
    }],
  });

  assert.equal(parsed.assets[0].candidateId, "candidate-cap-gold-v1");
  assert.equal(parsed.assets[0].placementVersionId, "placement-cap-v1");
  assert.deepEqual(parsed.assets[0].placementBoundsPx, bounds);
});
