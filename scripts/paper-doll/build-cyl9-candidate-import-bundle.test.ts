import assert from "node:assert/strict";
import { test } from "node:test";

import { buildCyl9CandidateImportBundle } from "./build-cyl9-candidate-import-bundle";

test("candidate import bundle selects one exact-alpha plate for every CYL-9ML component", async () => {
  const bundle = await buildCyl9CandidateImportBundle();
  assert.equal(bundle.candidateCount, 23);
  assert.equal(bundle.candidates.length, 23);
  assert.equal(new Set(bundle.candidates.map((item) => `${item.componentKey}:${item.variantKey}`)).size, 23);
  assert.equal(bundle.candidates.filter((item) => item.reviewState === "registered-rhinestone-review").length, 3);
  assert.equal(bundle.candidates.filter((item) => item.reviewState === "translucent-five-body-review").length, 2);
  assert.equal(bundle.candidates.every((item) => item.candidate.qa.geometryLocked && item.candidate.qa.mismatchedPixels === 0), true);
  assert.deepEqual(bundle.mutationPolicy, {
    remoteWritesPerformed: false,
    approvalsWritten: false,
    placementsWritten: false,
    currentReleaseChanged: false,
    sanityChanged: false,
  });
});
