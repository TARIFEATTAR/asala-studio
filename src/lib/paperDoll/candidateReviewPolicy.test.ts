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

test("a clean selected candidate downgrades a revoked ancestor to an audit notice", () => {
  assert.deepEqual(reviewPolicy.resolveAncestorNotice({
    parentMaskBlocker: "revoked ancestor",
    candidateMaskBlocker: null,
    hasCandidate: true,
  }), {
    tone: "warning",
    message: "Old release ancestor is audit-only. Clean geometry authority active.",
  });
  assert.deepEqual(reviewPolicy.resolveAncestorNotice({
    parentMaskBlocker: "revoked ancestor",
    candidateMaskBlocker: "revoked candidate",
    hasCandidate: true,
  }), { tone: "error", message: "revoked ancestor" });
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

test("approved details require the exact immutable approved child", () => {
  const details = (reviewPolicy as typeof reviewPolicy & {
    approvedCandidateDetails?: (candidate: Record<string, unknown> | null) => unknown;
  }).approvedCandidateDetails;
  const approvedVersion = {
    id: "44444444-4444-4444-8444-444444444444",
    approval_status: "approved",
    image_sha256: "b".repeat(64),
    geometry_mask_sha256: cleanMask,
    alpha_bounds: { left: 907, top: 668, right: 1175, bottom: 918 },
  };

  assert.deepEqual(details?.({
    candidateVersion: { image_sha256: "b".repeat(64) },
    approvedVersion,
    approvedImageUrl: "signed://approved-roller",
    approval: { decision: "approved", resulting_approved_component_version_id: approvedVersion.id },
  }), {
    componentVersionId: approvedVersion.id,
    imageUrl: "signed://approved-roller",
    imageSha256: "b".repeat(64),
    authorityMaskSha256: cleanMask,
    alphaBounds: { left: 907, top: 668, right: 1175, bottom: 918 },
  });
});

test("plastic and metal approvals sharing one exact mask are both placement inheritors", () => {
  const approvedEntry = (variantKey: "PLASTIC" | "METAL", id: string, imageSha: string) => ({
    job: { status: "candidate_ready", requirementKey: `CYL-9ML:ROLLER:${variantKey}` },
    candidateVersion: { image_sha256: imageSha, geometry_mask_sha256: cleanMask },
    approvedVersion: {
      id,
      approval_status: "approved",
      image_sha256: imageSha,
      geometry_mask_sha256: cleanMask,
      alpha_bounds: { left: 907, top: 668, right: 1175, bottom: 918 },
    },
    approvedImageUrl: `signed://${variantKey.toLowerCase()}`,
    approval: { decision: "approved", resulting_approved_component_version_id: id },
    qa: [{ blocking: true, qa_status: "passed" }],
  });

  assert.deepEqual(reviewPolicy.approvedCandidateVariants([
    approvedEntry("PLASTIC", "02161d6f-fb7c-4b44-ba98-a61500181529", "b".repeat(64)),
    approvedEntry("METAL", "e7a6636a-b2db-4bfe-bbb9-fde0458fe407", "c".repeat(64)),
  ]).map((variant) => ({
    variantKey: variant.variantKey,
    authorityMaskSha256: variant.authorityMaskSha256,
  })), [
    { variantKey: "PLASTIC", authorityMaskSha256: cleanMask },
    { variantKey: "METAL", authorityMaskSha256: cleanMask },
  ]);
});

test("rejected and SHA-drifted approvals cannot unlock Family Fit", () => {
  const details = (reviewPolicy as typeof reviewPolicy & {
    approvedCandidateDetails?: (candidate: Record<string, unknown> | null) => unknown;
  }).approvedCandidateDetails;
  const base = {
    candidateVersion: { image_sha256: "b".repeat(64) },
    approvedVersion: {
      id: "44444444-4444-4444-8444-444444444444",
      approval_status: "approved",
      image_sha256: "c".repeat(64),
      geometry_mask_sha256: cleanMask,
      alpha_bounds: { left: 907, top: 668, right: 1175, bottom: 918 },
    },
    approvedImageUrl: "signed://approved-roller",
  };

  assert.equal(details?.({ ...base, approval: { decision: "approved" } }), null);
  assert.equal(details?.({
    ...base,
    candidateVersion: { image_sha256: "c".repeat(64) },
    approval: { decision: "rejected" },
  }), null);
});
