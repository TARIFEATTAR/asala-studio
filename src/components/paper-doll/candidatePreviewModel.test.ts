import assert from "node:assert/strict";
import test from "node:test";

import { shouldMountCandidatePreview } from "./candidatePreviewModel";

test("mounts a verified candidate in Edit Lab instead of leaving the legacy source on canvas", () => {
  assert.equal(shouldMountCandidatePreview("edit-lab", "https://private.example/candidate.png"), true);
});

test("does not replace the active source outside Edit Lab or without a candidate", () => {
  assert.equal(shouldMountCandidatePreview("release-lock", "https://private.example/candidate.png"), false);
  assert.equal(shouldMountCandidatePreview("edit-lab", null), false);
});
