import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import sharp from "sharp";

import {
  buildJumboRollon16mmAuthorityReview,
  type JumboRollonAuthorityRecipe,
} from "./build-jumbo-rollon-16mm-authority-review";

const recipePath = "docs/paper-doll-rig/jumbo-rollon-16mm-authority-review.json";

test("builds separate 28 and 50 mL plastic/metal authority candidates without neck contamination", async () => {
  const outputRoot = await mkdtemp(path.join(os.tmpdir(), "jumbo-rollon-authority-"));
  try {
    const recipe = JSON.parse(await readFile(recipePath, "utf8")) as JumboRollonAuthorityRecipe;
    const result = await buildJumboRollon16mmAuthorityReview({ recipe, outputRoot, generatedAt: "2026-08-04T00:00:00.000Z" });
    assert.equal(result.manifest.summary.authorityGroupCount, 2);
    assert.equal(result.manifest.summary.candidateCount, 4);
    assert.equal(result.manifest.summary.exactAlphaWithinEveryGroup, true);
    assert.equal(result.manifest.geometryLocked, false);
    assert.equal(result.manifest.productionEligible, false);
    assert.deepEqual(result.manifest.mutationPolicy, { approvalsWritten: false, placementLockWritten: false, remoteWritesPerformed: false, currentReleaseChanged: false, sanityChanged: false });
    assert.deepEqual(result.manifest.groups.map((group) => group.physicalContract.capacityMl), [28, 50]);
    for (const group of result.manifest.groups) {
      assert.equal(group.candidates.length, 2);
      assert.ok(group.candidates.every((candidate) => candidate.qa.exactAlpha && candidate.qa.mismatchedAlphaBytes === 0));
      assert.ok(group.candidates.every((candidate) => candidate.boxes.placementBoundsPx === null));
      assert.equal(group.separateFamilyPlacementRequired, true);
      const [plastic, metal] = await Promise.all(group.candidates.map((candidate) => readFile(path.resolve(candidate.path))));
      const [plasticAlpha, metalAlpha] = await Promise.all([plastic, metal].map((png) => sharp(png).extractChannel("alpha").raw().toBuffer()));
      assert.deepEqual(plasticAlpha, metalAlpha);
      assert.notDeepEqual(plastic, metal);
    }
    assert.ok((await readFile(result.contactSheetPath)).length > 1000);
  } finally {
    await rm(outputRoot, { recursive: true, force: true });
  }
});

test("rejects a mutated Photoshop authority before writing candidates", async () => {
  const recipe = JSON.parse(await readFile(recipePath, "utf8")) as JumboRollonAuthorityRecipe;
  recipe.groups[0].plasticAuthoritySource.sha256 = "0".repeat(64);
  await assert.rejects(
    buildJumboRollon16mmAuthorityReview({ recipe, outputRoot: path.join(os.tmpdir(), "jumbo-rollon-authority-rejected") }),
    /SHA-256 mismatch/,
  );
});
