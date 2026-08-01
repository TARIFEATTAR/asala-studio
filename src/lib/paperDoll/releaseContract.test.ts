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
