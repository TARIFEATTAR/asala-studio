import assert from "node:assert/strict";
import { test } from "node:test";

import * as reviewPolicy from "./candidateReviewPolicy";

const { selectCandidateForReview } = reviewPolicy;

const cleanMask = "a".repeat(64);
const revokedMask = "d2d1bd4a29e949c2dd824c95f60607ee36954381084fe5bb5e7570000c65cbfa";

function entry(input: {
  id: string;
  maskSha: string;
  qaStatus?: string;
  approval?: object | null;
}) {
  return {
    job: { id: input.id, status: "candidate_ready" },
    candidateVersion: { geometry_mask_sha256: input.maskSha },
    qa: [{ blocking: true, qa_status: input.qaStatus ?? "passed" }],
    approval: input.approval ?? null,
  };
}

test("revoked and blocking-failed candidates are audit-only", () => {
  const selected = selectCandidateForReview([
    entry({ id: "failed-newest", maskSha: cleanMask, qaStatus: "failed" }),
    entry({ id: "polluted", maskSha: revokedMask }),
    entry({ id: "clean", maskSha: cleanMask }),
  ]);
  assert.equal(selected?.job.id, "clean");
});

test("a clean authority replacement remains reviewable when its parent mask was revoked", () => {
  const selected = selectCandidateForReview([
    entry({ id: "replacement", maskSha: cleanMask }),
  ]);
  assert.equal(selected?.job.id, "replacement");
});

test("review details expose candidate identity and measured alpha bounds", () => {
  const details = (reviewPolicy as typeof reviewPolicy & {
    candidatePreviewDetails?: (candidate: {
      candidateVersion: Record<string, unknown> | null;
      candidateImageUrl: string | null;
    }) => unknown;
  }).candidatePreviewDetails;

  assert.deepEqual(details?.({
    candidateImageUrl: "signed://clean-roller",
    candidateVersion: {
      image_sha256: "b".repeat(64),
      alpha_bounds: { left: 907, top: 668, right: 1175, bottom: 918 },
    },
  }), {
    imageUrl: "signed://clean-roller",
    candidateSha256: "b".repeat(64),
    alphaBounds: { left: 907, top: 668, right: 1175, bottom: 918 },
  });
});
