import { basename } from "node:path";

import type { PsdCapStateClassification } from "./bestBottlesPsdCapStateAudit";
import type { ReviewedPsdAlias } from "./bestBottlesPsdIdentityJoin";
import type { PsdReviewDecision } from "./bestBottlesPsdReviewDecisions";

export const BEST_BOTTLES_CYLINDER_RECOVERY_APPROVAL_VERSION =
  "best-bottles-cylinder-recovery-approval-v1" as const;

type SheetCohort =
  | "exact-high-resolution"
  | "exact-low-resolution"
  | "legacy-alias-high-resolution"
  | "legacy-alias-low-resolution";

export interface CylinderRecoveryApprovalSheet {
  cohort: SheetCohort;
  path: string;
  sha256: string;
}

export interface CylinderExactRecoveryExport {
  websiteSku: string;
  graceSku: string;
  sourcePath: string;
  sourceRelativePath: string;
  sourceSha256: string;
  outputPath: string;
  outputSha256: string;
  width: number;
  height: number;
}

export interface CylinderAliasRecoveryExport {
  targetWebsiteSku: string;
  targetGraceSku: string;
  sourcePath: string;
  sourceRelativePath: string;
  sourceSha256: string;
  outputPath: string;
  outputSha256: string;
  sourceCompositeWidth: number;
  sourceCompositeHeight: number;
}

export type CylinderRecoveryProductionDisposition =
  | "production-gate-candidate"
  | "regeneration-required-low-resolution"
  | "regeneration-required-detached-topology";

export interface CylinderRecoveryApprovalDecision {
  identitySource: "exact-archive-name" | "reviewed-legacy-alias";
  websiteSku: string;
  graceSku: string;
  sourcePath: string;
  sourceRelativePath: string;
  sourceSha256: string;
  outputPath: string;
  outputSha256: string;
  width: number;
  height: number;
  pixelCount: number;
  resolutionStatus: "high-resolution" | "low-resolution";
  classification: Extract<
    PsdCapStateClassification,
    "assembled-cap-on" | "detached-cap-or-sidecar"
  >;
  identityDecision: "approved-exact-product";
  productionDisposition: CylinderRecoveryProductionDisposition;
  reviewer: string;
  reviewedAt: string;
  approvalStatement: string;
}

export interface CylinderRecoveryApprovalArtifact {
  version: typeof BEST_BOTTLES_CYLINDER_RECOVERY_APPROVAL_VERSION;
  reviewer: string;
  reviewedAt: string;
  approvalStatement: string;
  minimumPixels: number;
  sheets: CylinderRecoveryApprovalSheet[];
  aliases: ReviewedPsdAlias[];
  decisions: CylinderRecoveryApprovalDecision[];
  summary: {
    approvedIdentityCount: number;
    approvedAliasCount: number;
    highResolutionCount: number;
    lowResolutionCount: number;
    assembledCapOnCount: number;
    detachedCapOrSidecarCount: number;
    productionGateCandidateCount: number;
    regenerationRequiredCount: number;
  };
}

type RecoveryReviewUnitIdentity = {
  reviewUnitKey: string;
  sourceSha256: string;
  websiteSku: string | null;
  graceSku: string | null;
};

function normalizedIdentity(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function assertNonempty(value: string, label: string): void {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} must be a nonempty string.`);
  }
}

function assertSha256(value: string, label: string): void {
  if (!/^[a-f0-9]{64}$/i.test(value)) {
    throw new Error(`${label} must be a SHA-256 hash.`);
  }
}

export function sourceTokenFromRelativePath(sourceRelativePath: string): string {
  return basename(sourceRelativePath)
    .replace(/\.psd$/i, "")
    .replace(/^\s*\d+\s*[.)_-]\s*/, "")
    .replace(/[.\s]+$/g, "")
    .trim();
}

export function classifyApprovedCylinderReference(
  websiteSku: string,
): CylinderRecoveryApprovalDecision["classification"] {
  const normalized = normalizedIdentity(websiteSku);
  if (
    normalized.includes("ANSP")
    || normalized.includes("RDCR")
    || normalized.endsWith("WHTSHT")
    || normalized.endsWith("BLKSHT")
    || normalized === "GB09BLACKCAPAPP"
    || (/SWRL9.*ROLLWHT$/.test(normalized))
  ) {
    return "assembled-cap-on";
  }
  return "detached-cap-or-sidecar";
}

function toDecision(input: {
  identitySource: CylinderRecoveryApprovalDecision["identitySource"];
  websiteSku: string;
  graceSku: string;
  sourcePath: string;
  sourceRelativePath: string;
  sourceSha256: string;
  outputPath: string;
  outputSha256: string;
  width: number;
  height: number;
  minimumPixels: number;
  reviewer: string;
  reviewedAt: string;
  approvalStatement: string;
}): CylinderRecoveryApprovalDecision {
  for (const [label, value] of Object.entries({
    websiteSku: input.websiteSku,
    graceSku: input.graceSku,
    sourcePath: input.sourcePath,
    sourceRelativePath: input.sourceRelativePath,
    outputPath: input.outputPath,
  })) {
    assertNonempty(value, label);
  }
  assertSha256(input.sourceSha256, "sourceSha256");
  assertSha256(input.outputSha256, "outputSha256");
  if (!Number.isInteger(input.width) || input.width <= 0 || !Number.isInteger(input.height) || input.height <= 0) {
    throw new Error(`Approved recovery source ${input.websiteSku} requires positive integer dimensions.`);
  }
  const pixelCount = input.width * input.height;
  const resolutionStatus = pixelCount >= input.minimumPixels ? "high-resolution" : "low-resolution";
  const classification = classifyApprovedCylinderReference(input.websiteSku);
  const productionDisposition: CylinderRecoveryProductionDisposition = resolutionStatus === "low-resolution"
    ? "regeneration-required-low-resolution"
    : classification === "assembled-cap-on"
      ? "production-gate-candidate"
      : "regeneration-required-detached-topology";
  return {
    identitySource: input.identitySource,
    websiteSku: input.websiteSku,
    graceSku: input.graceSku,
    sourcePath: input.sourcePath,
    sourceRelativePath: input.sourceRelativePath,
    sourceSha256: input.sourceSha256.toLowerCase(),
    outputPath: input.outputPath,
    outputSha256: input.outputSha256.toLowerCase(),
    width: input.width,
    height: input.height,
    pixelCount,
    resolutionStatus,
    classification,
    identityDecision: "approved-exact-product",
    productionDisposition,
    reviewer: input.reviewer,
    reviewedAt: input.reviewedAt,
    approvalStatement: input.approvalStatement,
  };
}

export function buildCylinderRecoveryApproval(input: {
  reviewer: string;
  reviewedAt: string;
  approvalStatement: string;
  minimumPixels: number;
  sheets: readonly CylinderRecoveryApprovalSheet[];
  exactExports: readonly CylinderExactRecoveryExport[];
  aliasExports: readonly CylinderAliasRecoveryExport[];
}): CylinderRecoveryApprovalArtifact {
  assertNonempty(input.reviewer, "reviewer");
  assertNonempty(input.approvalStatement, "approvalStatement");
  if (Number.isNaN(Date.parse(input.reviewedAt))) {
    throw new Error("reviewedAt must be a valid ISO date-time.");
  }
  const reviewedAt = new Date(input.reviewedAt).toISOString();
  if (!Number.isInteger(input.minimumPixels) || input.minimumPixels <= 0) {
    throw new Error("minimumPixels must be a positive integer.");
  }
  for (const sheet of input.sheets) {
    assertNonempty(sheet.path, "sheet path");
    assertSha256(sheet.sha256, "sheet sha256");
  }

  const exactDecisions = input.exactExports.map((entry) => toDecision({
    identitySource: "exact-archive-name",
    websiteSku: entry.websiteSku,
    graceSku: entry.graceSku,
    sourcePath: entry.sourcePath,
    sourceRelativePath: entry.sourceRelativePath,
    sourceSha256: entry.sourceSha256,
    outputPath: entry.outputPath,
    outputSha256: entry.outputSha256,
    width: entry.width,
    height: entry.height,
    minimumPixels: input.minimumPixels,
    reviewer: input.reviewer.trim(),
    reviewedAt,
    approvalStatement: input.approvalStatement,
  }));
  const aliasDecisions = input.aliasExports.map((entry) => toDecision({
    identitySource: "reviewed-legacy-alias",
    websiteSku: entry.targetWebsiteSku,
    graceSku: entry.targetGraceSku,
    sourcePath: entry.sourcePath,
    sourceRelativePath: entry.sourceRelativePath,
    sourceSha256: entry.sourceSha256,
    outputPath: entry.outputPath,
    outputSha256: entry.outputSha256,
    width: entry.sourceCompositeWidth,
    height: entry.sourceCompositeHeight,
    minimumPixels: input.minimumPixels,
    reviewer: input.reviewer.trim(),
    reviewedAt,
    approvalStatement: input.approvalStatement,
  }));
  const decisions = [...exactDecisions, ...aliasDecisions];
  const identityKeys = new Set<string>();
  const sourceHashes = new Set<string>();
  for (const decision of decisions) {
    const identityKey = `${normalizedIdentity(decision.websiteSku)}|${normalizedIdentity(decision.graceSku)}`;
    if (identityKeys.has(identityKey)) {
      throw new Error(`Recovery approval contains duplicate target identity ${identityKey}.`);
    }
    identityKeys.add(identityKey);
    if (sourceHashes.has(decision.sourceSha256)) {
      throw new Error(`Recovery approval contains duplicate source hash ${decision.sourceSha256}.`);
    }
    sourceHashes.add(decision.sourceSha256);
  }
  decisions.sort((left, right) => (
    left.websiteSku.localeCompare(right.websiteSku)
    || left.graceSku.localeCompare(right.graceSku)
  ));
  const aliases = aliasDecisions.map((decision): ReviewedPsdAlias => ({
    sourceToken: sourceTokenFromRelativePath(decision.sourceRelativePath),
    websiteSku: decision.websiteSku,
    graceSku: decision.graceSku,
    reviewedBy: input.reviewer.trim(),
    reviewedAt,
  })).sort((left, right) => (
    left.sourceToken.localeCompare(right.sourceToken)
    || left.websiteSku.localeCompare(right.websiteSku)
    || left.graceSku.localeCompare(right.graceSku)
  ));

  const highResolutionCount = decisions.filter((decision) => decision.resolutionStatus === "high-resolution").length;
  const assembledCapOnCount = decisions.filter((decision) => decision.classification === "assembled-cap-on").length;
  const productionGateCandidateCount = decisions.filter((decision) => (
    decision.productionDisposition === "production-gate-candidate"
  )).length;
  return {
    version: BEST_BOTTLES_CYLINDER_RECOVERY_APPROVAL_VERSION,
    reviewer: input.reviewer.trim(),
    reviewedAt,
    approvalStatement: input.approvalStatement,
    minimumPixels: input.minimumPixels,
    sheets: input.sheets.map((sheet) => ({ ...sheet, sha256: sheet.sha256.toLowerCase() })),
    aliases,
    decisions,
    summary: {
      approvedIdentityCount: decisions.length,
      approvedAliasCount: aliases.length,
      highResolutionCount,
      lowResolutionCount: decisions.length - highResolutionCount,
      assembledCapOnCount,
      detachedCapOrSidecarCount: decisions.length - assembledCapOnCount,
      productionGateCandidateCount,
      regenerationRequiredCount: decisions.length - productionGateCandidateCount,
    },
  };
}

export function buildCylinderRecoveryReviewDecisions(input: {
  approval: CylinderRecoveryApprovalArtifact;
  reviewUnits: readonly RecoveryReviewUnitIdentity[];
}): PsdReviewDecision[] {
  const byIdentity = new Map<string, RecoveryReviewUnitIdentity[]>();
  for (const unit of input.reviewUnits) {
    const key = [
      unit.sourceSha256.toLowerCase(),
      normalizedIdentity(unit.websiteSku ?? ""),
      normalizedIdentity(unit.graceSku ?? ""),
    ].join("|");
    byIdentity.set(key, [...(byIdentity.get(key) ?? []), unit]);
  }
  const decisions = input.approval.decisions.map((approval): PsdReviewDecision => {
    const key = [
      approval.sourceSha256.toLowerCase(),
      normalizedIdentity(approval.websiteSku),
      normalizedIdentity(approval.graceSku),
    ].join("|");
    const matches = byIdentity.get(key) ?? [];
    if (matches.length !== 1) {
      throw new Error(
        `Approved recovery identity ${approval.websiteSku} expected one review unit; found ${matches.length}.`,
      );
    }
    const dispositionNote = approval.productionDisposition === "production-gate-candidate"
      ? "High-resolution assembled reference may proceed through the remaining production gates."
      : approval.productionDisposition === "regeneration-required-low-resolution"
        ? "Approved identity evidence is low-resolution; controlled canonical-geometry regeneration is required before production promotion."
        : "Approved identity evidence shows a detached cap or sidecar; controlled assembled-product regeneration is required before production promotion.";
    return {
      reviewUnitKey: matches[0].reviewUnitKey,
      sourceSha256: approval.sourceSha256,
      decision: approval.classification,
      reviewer: input.approval.reviewer,
      reviewedAt: input.approval.reviewedAt,
      notes: `Exact product identity approved from the hash-locked Cylinder recovery sheets. ${dispositionNote}`,
    };
  });
  decisions.sort((left, right) => left.reviewUnitKey.localeCompare(right.reviewUnitKey));
  return decisions;
}
