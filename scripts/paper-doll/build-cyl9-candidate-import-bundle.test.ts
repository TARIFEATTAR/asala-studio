import assert from "node:assert/strict";
import { test } from "node:test";

import { buildCyl9CandidateImportBundle } from "./build-cyl9-candidate-import-bundle";

test("candidate import bundle excludes standalone translucent overcap source authorities", async () => {
  const bundle = await buildCyl9CandidateImportBundle();
  assert.equal(bundle.candidateCount, 21);
  assert.equal(bundle.candidates.length, 21);
  assert.equal(new Set(bundle.candidates.map((item) => `${item.componentKey}:${item.variantKey}`)).size, 21);
  assert.equal(bundle.candidates.filter((item) => item.reviewState === "registered-rhinestone-review").length, 3);
  assert.equal(bundle.candidates.filter((item) => item.reviewState === "translucent-five-body-review").length, 0);
  assert.ok(bundle.candidates.every((item) => !item.componentKey.startsWith("overcap__17-415__")));
  assert.equal(bundle.candidates.every((item) => item.candidate.qa.geometryLocked && item.candidate.qa.mismatchedPixels === 0), true);
  assert.deepEqual(bundle.mutationPolicy, {
    remoteWritesPerformed: false,
    approvalsWritten: false,
    placementsWritten: false,
    currentReleaseChanged: false,
    sanityChanged: false,
  });
});
