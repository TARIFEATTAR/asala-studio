import assert from "node:assert/strict";
import test from "node:test";

import * as previewModel from "./candidatePreviewModel";

const { shouldMountCandidatePreview } = previewModel;

test("mounts a verified candidate in Edit Lab instead of leaving the legacy source on canvas", () => {
  assert.equal(shouldMountCandidatePreview("edit-lab", "https://private.example/candidate.png"), true);
});

test("does not replace the active source outside Edit Lab or without a candidate", () => {
  assert.equal(shouldMountCandidatePreview("release-lock", "https://private.example/candidate.png"), false);
  assert.equal(shouldMountCandidatePreview("edit-lab", null), false);
});

test("keeps the selected review candidate mounted while fitting it to the five bodies", () => {
  assert.equal(shouldMountCandidatePreview("family-fit", "https://private.example/candidate.png"), true);
});

test("terminal candidate history stops polling so signed URLs do not blank and reload the canvas", () => {
  const refreshInterval = (previewModel as typeof previewModel & {
    candidateHistoryRefreshInterval?: (
      jobs: Array<{ job: { status: string; updatedAt?: string } }> | undefined,
      nowEpochMs?: number,
    ) => number | false;
  }).candidateHistoryRefreshInterval;

  assert.equal(refreshInterval?.([
    { job: { status: "candidate_ready" } },
    { job: { status: "failed" } },
  ]), false);
  assert.equal(refreshInterval?.([
    { job: { status: "running", updatedAt: "2026-08-02T20:00:00.000Z" } },
  ], Date.parse("2026-08-02T20:00:30.000Z")), 5_000);
  assert.equal(refreshInterval?.([
    { job: { status: "queued", updatedAt: "2026-08-02T12:00:00.000Z" } },
  ], Date.parse("2026-08-02T20:00:30.000Z")), false);
});

test("changing the inspected bottle preserves the selected roller layer", () => {
  const selectBody = (previewModel as typeof previewModel & {
    selectWorkbenchBody?: (currentLayerId: string | null, bodyId: string) => {
      selectedBodyId: string;
      selectedLayerId: string | null;
    };
  }).selectWorkbenchBody;

  assert.deepEqual(selectBody?.("roller-plastic", "body-cobalt"), {
    selectedBodyId: "body-cobalt",
    selectedLayerId: "roller-plastic",
  });
});

test("candidate preview keeps release identity while using candidate pixels and measured bounds", () => {
  const applyPreview = (previewModel as typeof previewModel & {
    applyCandidateAssetPreview?: <T>(asset: T, preview: {
      imageUrl: string;
      alphaBounds: { left: number; top: number; right: number; bottom: number };
    }) => T;
  }).applyCandidateAssetPreview;
  const source = {
    componentVersionId: "release-roller-v1",
    imageUrl: "signed://revoked-source",
    alphaBounds: { left: 1, top: 2, right: 3, bottom: 4 },
  };

  assert.deepEqual(applyPreview?.(source, {
    imageUrl: "signed://clean-candidate",
    alphaBounds: { left: 907, top: 668, right: 1175, bottom: 918 },
  }), {
    componentVersionId: "release-roller-v1",
    imageUrl: "signed://clean-candidate",
    alphaBounds: { left: 907, top: 668, right: 1175, bottom: 918 },
  });
});
