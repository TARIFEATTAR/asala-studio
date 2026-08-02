import {
  PSD_CAP_STATE_CLASSIFICATIONS,
  assertMachineCannotApprove,
  buildPsdReviewUnitKey,
  type PsdAuditRecord,
  type PsdCapStateClassification,
  type PsdHumanReviewer,
  type PsdReviewUnit,
} from "./bestBottlesPsdCapStateAudit";

export const PSD_REVIEW_DECISIONS = [
  ...PSD_CAP_STATE_CLASSIFICATIONS,
  "blocked",
] as const;

export type PsdReviewDecisionValue = (typeof PSD_REVIEW_DECISIONS)[number];
export type PsdApprovedClassification = Exclude<
  PsdCapStateClassification,
  "ambiguous-manual-review" | "blocked-identity-conflict"
>;

export interface PsdReviewDecision {
  reviewUnitKey: string;
  sourceSha256: string;
  decision: PsdReviewDecisionValue;
  reviewer: string;
  reviewedAt: string;
  notes: string;
}

export type PsdReviewedAuditRecord = Omit<
  PsdAuditRecord,
  "reviewStatus" | "reviewer" | "reviewedAt"
> & {
  humanClassification: PsdReviewDecisionValue;
  reviewStatus: "approved" | "blocked";
  reviewer: PsdHumanReviewer;
  reviewedAt: string;
};

export interface PsdReviewedUnit extends Omit<PsdReviewUnit, "sources" | "representative"> {
  identityStatus: PsdAuditRecord["identityStatus"];
  classification: PsdReviewDecisionValue;
  reviewStatus: "approved" | "blocked";
  reviewer: PsdHumanReviewer;
  reviewedAt: string;
  notes: string;
  sources: PsdReviewedAuditRecord[];
  representative: PsdReviewedAuditRecord;
}

export interface ApplyPsdReviewDecisionsResult {
  reviewed: PsdReviewedUnit[];
  approved: PsdReviewedUnit[];
  pending: PsdReviewUnit[];
  blocked: PsdReviewedUnit[];
}

const APPROVED_CLASSIFICATIONS = new Set<PsdReviewDecisionValue>([
  "assembled-cap-on",
  "cap-off-applicator-exposed",
  "detached-cap-or-sidecar",
  "component-only",
  "multi-product-layout",
]);

const APPROVABLE_IDENTITY_STATUSES = new Set<PsdAuditRecord["identityStatus"]>([
  "exact-website-sku",
  "exact-grace-sku",
  "reviewed-alias",
]);

const BLOCKING_DECISIONS = new Set<PsdReviewDecisionValue>([
  "ambiguous-manual-review",
  "blocked-identity-conflict",
  "blocked",
]);

function isValidIsoDateTime(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|([+-])(\d{2}):(\d{2}))$/.exec(value);
  if (!match) return false;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, , offsetHourText, offsetMinuteText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return month >= 1
    && month <= 12
    && day >= 1
    && day <= daysInMonth[month - 1]
    && Number(hourText) <= 23
    && Number(minuteText) <= 59
    && Number(secondText) <= 59
    && (offsetHourText === undefined || Number(offsetHourText) <= 23)
    && (offsetMinuteText === undefined || Number(offsetMinuteText) <= 59)
    && !Number.isNaN(Date.parse(value));
}

function isDecision(value: unknown): value is PsdReviewDecisionValue {
  return typeof value === "string"
    && (PSD_REVIEW_DECISIONS as readonly string[]).includes(value);
}

function normalizedIdentity(value: string | null): string {
  return String(value ?? "UNMATCHED").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function samePersistedRecord(left: PsdAuditRecord, right: PsdAuditRecord): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function hasUsableCompositeEvidence(record: PsdAuditRecord): boolean {
  const composite = record.composite;
  return composite !== null
    && Number.isInteger(composite.width)
    && composite.width > 0
    && Number.isInteger(composite.height)
    && composite.height > 0
    && Number.isInteger(composite.sceneCount)
    && composite.sceneCount > 0
    && typeof composite.previewPath === "string"
    && composite.previewPath.trim() !== ""
    && /^[a-f0-9]{64}$/i.test(composite.evidenceSha256);
}

export function assertValidPersistedPsdReviewUnit(unit: PsdReviewUnit): void {
  if (!unit || typeof unit !== "object" || !Array.isArray(unit.sources) || unit.sources.length === 0) {
    throw new Error("A persisted PSD review unit requires at least one source.");
  }
  if (!unit.representative || typeof unit.representative !== "object") {
    throw new Error(`Review unit ${unit.reviewUnitKey} requires a representative source.`);
  }
  for (const source of unit.sources) {
    const recomputedKey = buildPsdReviewUnitKey(source);
    if (recomputedKey !== unit.reviewUnitKey) {
      throw new Error(`Review unit ${unit.reviewUnitKey} contains a source with mismatched review-unit key ${recomputedKey}.`);
    }
    if (source.sourceSha256 !== unit.sourceSha256) {
      throw new Error(`Review unit ${unit.reviewUnitKey} contains a source with a mismatched hash.`);
    }
    if (
      normalizedIdentity(source.websiteSku) !== normalizedIdentity(unit.websiteSku)
      || normalizedIdentity(source.graceSku) !== normalizedIdentity(unit.graceSku)
    ) {
      throw new Error(`Review unit ${unit.reviewUnitKey} contains mixed canonical identities.`);
    }
    if (
      source.family !== unit.family
      || source.identityStatus !== unit.representative.identityStatus
      || JSON.stringify(source.canonicalReviewMetadata ?? null)
        !== JSON.stringify(unit.canonicalReviewMetadata ?? null)
    ) {
      throw new Error(`Review unit ${unit.reviewUnitKey} contains mixed canonical metadata or identity status.`);
    }
  }
  if (!unit.sources.some((source) => samePersistedRecord(source, unit.representative))) {
    throw new Error(`Review unit ${unit.reviewUnitKey} representative is not a member of its sources.`);
  }
  if (
    buildPsdReviewUnitKey(unit.representative) !== unit.reviewUnitKey
    || unit.representative.sourceSha256 !== unit.sourceSha256
    || normalizedIdentity(unit.representative.websiteSku) !== normalizedIdentity(unit.websiteSku)
    || normalizedIdentity(unit.representative.graceSku) !== normalizedIdentity(unit.graceSku)
    || unit.representative.family !== unit.family
    || JSON.stringify(unit.representative.canonicalReviewMetadata ?? null)
      !== JSON.stringify(unit.canonicalReviewMetadata ?? null)
  ) {
    throw new Error(`Review unit ${unit.reviewUnitKey} top-level fields do not match its representative.`);
  }
}

export function validatePsdReviewDecision(
  decision: PsdReviewDecision,
): PsdReviewDecision {
  if (typeof decision.reviewUnitKey !== "string" || decision.reviewUnitKey.trim() === "") {
    throw new Error("A PSD review decision requires a review-unit key.");
  }
  if (!isDecision(decision.decision)) {
    throw new Error(`Unsupported PSD review decision: ${String(decision.decision)}.`);
  }
  if (
    typeof decision.reviewer !== "string"
    || decision.reviewer.trim() === ""
    || decision.reviewer.trim().toLowerCase() === "machine"
  ) {
    throw new Error("A completed PSD review decision requires a named human reviewer.");
  }
  if (typeof decision.reviewedAt !== "string" || !isValidIsoDateTime(decision.reviewedAt)) {
    throw new Error("A completed PSD review decision requires a valid ISO date-time timestamp.");
  }
  if (
    typeof decision.sourceSha256 !== "string"
    || !/^[a-f0-9]{64}$/i.test(decision.sourceSha256)
  ) {
    throw new Error("A completed PSD review decision requires a valid SHA-256 source hash.");
  }
  if (
    BLOCKING_DECISIONS.has(decision.decision)
    && (typeof decision.notes !== "string" || decision.notes.trim() === "")
  ) {
    throw new Error("Every blocked PSD review outcome requires nonempty string reason notes.");
  }
  return decision;
}

function mergeDecision(unit: PsdReviewUnit, decision: PsdReviewDecision): PsdReviewedUnit {
  const identityStatus = unit.representative.identityStatus;
  const approved = APPROVED_CLASSIFICATIONS.has(decision.decision);
  if (approved && !APPROVABLE_IDENTITY_STATUSES.has(identityStatus)) {
    throw new Error(
      `Review unit ${unit.reviewUnitKey} cannot be approved because its canonical identity is ${identityStatus}.`,
    );
  }
  if (approved && !unit.sources.every(hasUsableCompositeEvidence)) {
    throw new Error(
      `Review unit ${unit.reviewUnitKey} cannot be approved because usable composite preview evidence is missing or invalid.`,
    );
  }

  const reviewStatus = approved ? "approved" : "blocked";
  const reviewer: PsdHumanReviewer = {
    kind: "human",
    identity: decision.reviewer.trim(),
  };
  const reviewedAt = new Date(decision.reviewedAt).toISOString();
  assertMachineCannotApprove({ reviewStatus, reviewer, reviewedAt });

  const mergeRecord = (record: PsdAuditRecord): PsdReviewedAuditRecord => ({
    ...record,
    humanClassification: decision.decision,
    reviewStatus,
    reviewer,
    reviewedAt,
  });
  const sources = unit.sources.map(mergeRecord);
  const representativeIndex = unit.sources.findIndex((source) => (
    samePersistedRecord(source, unit.representative)
  ));
  const representative = representativeIndex >= 0
    ? sources[representativeIndex]
    : mergeRecord(unit.representative);
  return {
    ...unit,
    identityStatus,
    classification: decision.decision,
    reviewStatus,
    reviewer,
    reviewedAt,
    notes: decision.notes ?? "",
    sources,
    representative,
  };
}

export function applyPsdReviewDecisions(input: {
  reviewUnits: readonly PsdReviewUnit[];
  decisions: readonly PsdReviewDecision[];
}): ApplyPsdReviewDecisionsResult {
  const unitsByKey = new Map<string, PsdReviewUnit>();
  for (const unit of input.reviewUnits) {
    assertValidPersistedPsdReviewUnit(unit);
    if (unitsByKey.has(unit.reviewUnitKey)) {
      throw new Error(`Review units contain duplicate key ${unit.reviewUnitKey}.`);
    }
    unitsByKey.set(unit.reviewUnitKey, unit);
  }

  const decisionsByKey = new Map<string, PsdReviewDecision>();
  for (const rawDecision of input.decisions) {
    const decision = validatePsdReviewDecision(rawDecision);
    if (decisionsByKey.has(decision.reviewUnitKey)) {
      throw new Error(`Duplicate decision rows for review unit ${decision.reviewUnitKey}.`);
    }
    const unit = unitsByKey.get(decision.reviewUnitKey);
    if (!unit) {
      throw new Error(`Decision references unknown review-unit key ${decision.reviewUnitKey}.`);
    }
    if (decision.sourceSha256 !== unit.sourceSha256) {
      throw new Error(`Decision source hash does not match review unit ${decision.reviewUnitKey}.`);
    }
    decisionsByKey.set(decision.reviewUnitKey, decision);
  }

  const reviewed: PsdReviewedUnit[] = [];
  const pending: PsdReviewUnit[] = [];
  for (const unit of input.reviewUnits) {
    const decision = decisionsByKey.get(unit.reviewUnitKey);
    if (!decision) {
      pending.push(unit);
      continue;
    }
    reviewed.push(mergeDecision(unit, decision));
  }

  return {
    reviewed,
    approved: reviewed.filter((unit) => unit.reviewStatus === "approved"),
    pending,
    blocked: reviewed.filter((unit) => unit.reviewStatus === "blocked"),
  };
}
