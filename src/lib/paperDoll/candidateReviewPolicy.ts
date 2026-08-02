import { authorityMaskBlocker } from "./authorityMaskPolicy";

interface ReviewCandidateLike {
  job: { status: string };
  candidateVersion: Record<string, unknown> | null;
  qa: Array<Record<string, unknown>>;
}

export function candidateAuditReason(entry: ReviewCandidateLike): string | null {
  if (entry.job.status !== "candidate_ready" || !entry.candidateVersion) return "not ready";
  const maskSha = entry.candidateVersion.geometry_mask_sha256;
  const revoked = authorityMaskBlocker(typeof maskSha === "string" ? maskSha : null);
  if (revoked) return "revoked authority · audit only";
  if (entry.candidateVersion.approval_status === "blocked" || entry.candidateVersion.approval_status === "rejected") {
    return `${entry.candidateVersion.approval_status} · audit only`;
  }
  if (entry.qa.some((row) => row.blocking === true && row.qa_status !== "passed")) {
    return "blocking QA failed · audit only";
  }
  return null;
}

export function selectCandidateForReview<T extends ReviewCandidateLike>(entries: readonly T[]): T | null {
  return entries.find((entry) => candidateAuditReason(entry) === null) ?? null;
}

export function candidateAuthorityBlocker(entry: ReviewCandidateLike | null): string | null {
  if (!entry?.candidateVersion) return null;
  const sha = entry.candidateVersion.geometry_mask_sha256;
  return authorityMaskBlocker(typeof sha === "string" ? sha : null);
}

export function candidatePreviewDetails(entry: {
  candidateVersion: Record<string, unknown> | null;
  candidateImageUrl: string | null;
}) {
  if (!entry.candidateVersion || !entry.candidateImageUrl) return null;
  const sha = entry.candidateVersion.image_sha256;
  const rawBounds = entry.candidateVersion.alpha_bounds;
  if (typeof sha !== "string" || !rawBounds || typeof rawBounds !== "object" || Array.isArray(rawBounds)) return null;
  const bounds = rawBounds as Record<string, unknown>;
  const left = Number(bounds.left);
  const top = Number(bounds.top);
  const right = Number(bounds.right);
  const bottom = Number(bounds.bottom);
  if (![left, top, right, bottom].every(Number.isFinite) || right < left || bottom < top) return null;
  return {
    imageUrl: entry.candidateImageUrl,
    candidateSha256: sha,
    alphaBounds: { left, top, right, bottom },
  };
}

export interface ApprovedCandidateDetails {
  componentVersionId: string;
  imageUrl: string;
  imageSha256: string;
  authorityMaskSha256: string;
  alphaBounds: { left: number; top: number; right: number; bottom: number };
}

export function approvedCandidateDetails(entry: {
  candidateVersion: Record<string, unknown> | null;
  approvedVersion: Record<string, unknown> | null;
  approvedImageUrl: string | null;
  approval: Record<string, unknown> | null;
} | null): ApprovedCandidateDetails | null {
  if (!entry?.candidateVersion || !entry.approvedVersion || !entry.approvedImageUrl || !entry.approval) return null;
  const approvedId = entry.approvedVersion.id;
  const approvedSha = entry.approvedVersion.image_sha256;
  const candidateSha = entry.candidateVersion.image_sha256;
  const authorityMaskSha = entry.approvedVersion.geometry_mask_sha256;
  const approvalResultId = entry.approval.resulting_approved_component_version_id;
  const rawBounds = entry.approvedVersion.alpha_bounds;
  if (
    entry.approval.decision !== "approved"
    || entry.approvedVersion.approval_status !== "approved"
    || typeof approvedId !== "string"
    || approvalResultId !== approvedId
    || typeof approvedSha !== "string"
    || candidateSha !== approvedSha
    || typeof authorityMaskSha !== "string"
    || !/^[a-f0-9]{64}$/.test(authorityMaskSha)
    || !rawBounds
    || typeof rawBounds !== "object"
    || Array.isArray(rawBounds)
  ) return null;
  const bounds = rawBounds as Record<string, unknown>;
  const left = Number(bounds.left);
  const top = Number(bounds.top);
  const right = Number(bounds.right);
  const bottom = Number(bounds.bottom);
  if (![left, top, right, bottom].every(Number.isFinite) || right < left || bottom < top) return null;
  return {
    componentVersionId: approvedId,
    imageUrl: entry.approvedImageUrl,
    imageSha256: approvedSha,
    authorityMaskSha256: authorityMaskSha,
    alphaBounds: { left, top, right, bottom },
  };
}
