export const BEST_BOTTLES_SHADOW_REVIEW_EXCEPTION_VERSION =
  "best-bottles-shadow-review-exception-v1" as const;

export type BestBottlesShadowReviewReasonCode =
  | "extension-ratio-boundary"
  | "contact-density-boundary"
  | "vertical-depth-boundary"
  | "detector-sensitivity";

export interface BestBottlesShadowReviewException {
  policyVersion: typeof BEST_BOTTLES_SHADOW_REVIEW_EXCEPTION_VERSION;
  status: "active" | "revoked";
  reasonCode: BestBottlesShadowReviewReasonCode;
  reason: string;
  imageId: string;
  pipelineSkuJobId: string;
  finalImageHash: string;
  sourceReferenceHash: string;
  promptHash: string;
  shadowReportHash: string;
  shadowTopologyHash: string;
  shadowContract: "contact-back-right-v1";
  shadowTopologyKind: string;
  expectedContacts: string[];
  reviewerId: string;
  createdAt: string;
  revokedAt: string | null;
}

export interface BestBottlesShadowReviewEvidence {
  imageId: string;
  pipelineSkuJobId: string;
  finalImageHash: string;
  sourceReferenceHash: string;
  promptHash: string;
  shadowReportHash: string;
  shadowTopologyHash: string;
  geometryReady: boolean;
  identityReady: boolean;
  shadowTopology: {
    kind: string;
    expectedContacts: string[];
  };
  shadowQa: {
    status: "pass" | "review" | "fail";
    contract: string;
    contacts: Array<{
      contact: string;
      status: "pass" | "review" | "fail";
      bounds: { left: number; right: number; top: number; bottom: number } | null;
      shadowPixelCount: number;
      failures: string[];
    }>;
  };
}

const ALLOWED_REASONS = new Set<BestBottlesShadowReviewReasonCode>([
  "extension-ratio-boundary",
  "contact-density-boundary",
  "vertical-depth-boundary",
  "detector-sensitivity",
]);

const DISALLOWED_FAILURE =
  /\b(missing|absent|unresolved|duplicate|second product|unexpected contact|no (?:visible )?(?:contact )?shadow)\b/i;

function isSha256(value: string): boolean {
  return /^[a-f0-9]{64}$/i.test(value);
}

function sameContacts(left: string[], right: string[]): boolean {
  return left.length === right.length &&
    [...left].sort().every((value, index) => value === [...right].sort()[index]);
}

/**
 * Validate a deliberately narrow cosmetic shadow exception. This can never
 * waive product identity, canonical geometry, missing-contact, topology, or
 * provenance failures. Every immutable input is bound by SHA-256.
 */
export function isBestBottlesShadowReviewExceptionValid(
  exception: BestBottlesShadowReviewException | null | undefined,
  evidence: BestBottlesShadowReviewEvidence,
): boolean {
  if (!exception || exception.policyVersion !== BEST_BOTTLES_SHADOW_REVIEW_EXCEPTION_VERSION) {
    return false;
  }
  if (
    exception.status !== "active" ||
    exception.revokedAt !== null ||
    !ALLOWED_REASONS.has(exception.reasonCode) ||
    !exception.reason.trim() ||
    !exception.reviewerId.trim() ||
    !evidence.geometryReady ||
    !evidence.identityReady ||
    evidence.shadowQa.status === "pass"
  ) {
    return false;
  }

  const exactFields = [
    [exception.imageId, evidence.imageId],
    [exception.pipelineSkuJobId, evidence.pipelineSkuJobId],
    [exception.finalImageHash, evidence.finalImageHash],
    [exception.sourceReferenceHash, evidence.sourceReferenceHash],
    [exception.promptHash, evidence.promptHash],
    [exception.shadowReportHash, evidence.shadowReportHash],
    [exception.shadowTopologyHash, evidence.shadowTopologyHash],
  ] as const;
  if (exactFields.some(([expected, actual]) => expected !== actual)) return false;
  if (
    ![
      exception.finalImageHash,
      exception.sourceReferenceHash,
      exception.promptHash,
      exception.shadowReportHash,
      exception.shadowTopologyHash,
    ].every(isSha256)
  ) {
    return false;
  }

  if (
    exception.shadowContract !== "contact-back-right-v1" ||
    evidence.shadowQa.contract !== exception.shadowContract ||
    exception.shadowTopologyKind !== evidence.shadowTopology.kind ||
    exception.expectedContacts.length === 0 ||
    !sameContacts(exception.expectedContacts, evidence.shadowTopology.expectedContacts)
  ) {
    return false;
  }

  const contacts = evidence.shadowQa.contacts;
  if (!sameContacts(contacts.map((contact) => contact.contact), exception.expectedContacts)) {
    return false;
  }
  return contacts.every((contact) => {
    const bounds = contact.bounds;
    return Boolean(
      bounds &&
      Number.isFinite(bounds.left) &&
      Number.isFinite(bounds.right) &&
      Number.isFinite(bounds.top) &&
      Number.isFinite(bounds.bottom) &&
      bounds.right > bounds.left &&
      bounds.bottom > bounds.top &&
      contact.shadowPixelCount > 0 &&
      !contact.failures.some((failure) => DISALLOWED_FAILURE.test(failure)),
    );
  });
}
