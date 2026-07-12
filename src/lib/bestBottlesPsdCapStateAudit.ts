export const PSD_CAP_STATE_CLASSIFICATIONS = [
  "assembled-cap-on",
  "cap-off-applicator-exposed",
  "detached-cap-or-sidecar",
  "component-only",
  "multi-product-layout",
  "ambiguous-manual-review",
  "blocked-identity-conflict",
] as const;

export type PsdCapStateClassification =
  (typeof PSD_CAP_STATE_CLASSIFICATIONS)[number];
export type PsdIdentityStatus =
  | "exact-website-sku"
  | "exact-grace-sku"
  | "reviewed-alias"
  | "unmatched"
  | "ambiguous"
  | "conflict";

export interface PsdCompositeEvidence {
  width: number;
  height: number;
  opaque: boolean;
  sceneCount: number;
  foregroundBounds: { left: number; top: number; width: number; height: number } | null;
  largeForegroundComponentCount: number;
  whiteCornerCount: number;
  minimumSafeMarginPct: number | null;
  previewPath: string;
  evidenceSha256: string;
}

export interface PsdAuditRecord {
  sourcePath: string;
  sourceRelativePath: string;
  sourceSha256: string;
  sourceBytes: number;
  websiteSku: string | null;
  graceSku: string | null;
  family: string | null;
  identityStatus: PsdIdentityStatus;
  identityReasons: string[];
  composite: PsdCompositeEvidence | null;
  machineTriage: {
    proposedClassification: PsdCapStateClassification;
    confidence: "low" | "medium" | "high";
    reasons: string[];
  };
  reviewStatus: "pending-human-review" | "approved" | "blocked";
}

export interface PsdReviewUnit {
  reviewUnitKey: string;
  sourceSha256: string;
  websiteSku: string | null;
  graceSku: string | null;
  family: string | null;
  sources: PsdAuditRecord[];
  representative: PsdAuditRecord;
}

function identityToken(value: string | null): string {
  return String(value ?? "UNMATCHED").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function buildPsdReviewUnitKey(record: PsdAuditRecord): string {
  return [record.sourceSha256, identityToken(record.websiteSku), identityToken(record.graceSku)].join("|");
}

export function groupPsdAuditRecords(records: readonly PsdAuditRecord[]): PsdReviewUnit[] {
  const groups = new Map<string, PsdAuditRecord[]>();
  for (const record of records) {
    const key = buildPsdReviewUnitKey(record);
    groups.set(key, [...(groups.get(key) ?? []), record]);
  }
  return [...groups.entries()].map(([reviewUnitKey, sources]) => ({
    reviewUnitKey,
    sourceSha256: sources[0].sourceSha256,
    websiteSku: sources[0].websiteSku,
    graceSku: sources[0].graceSku,
    family: sources[0].family,
    sources,
    representative: [...sources].sort((a, b) =>
      a.sourceRelativePath.localeCompare(b.sourceRelativePath)
    )[0],
  })).sort((a, b) => a.reviewUnitKey.localeCompare(b.reviewUnitKey));
}

export function assertMachineCannotApprove(input: {
  reviewStatus: PsdAuditRecord["reviewStatus"];
  reviewer: string;
}): void {
  if (input.reviewStatus === "approved" && input.reviewer.trim().toLowerCase() === "machine") {
    throw new Error("Cap-state approval requires a named human reviewer.");
  }
}
