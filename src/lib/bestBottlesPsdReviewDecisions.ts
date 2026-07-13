import {
  PSD_CAP_STATE_CLASSIFICATIONS,
  assertMachineCannotApprove,
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
  sourceSha256?: string;
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
  if (decision.sourceSha256 !== undefined && decision.sourceSha256.trim() === "") {
    throw new Error("A supplied decision source hash cannot be empty.");
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
  const representativeIndex = unit.sources.indexOf(unit.representative);
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
