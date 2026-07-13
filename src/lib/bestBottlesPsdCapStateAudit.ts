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

export interface PsdHumanReviewer {
  kind: "human";
  identity: string;
}

export interface PsdReviewedAliasProvenance {
  observedAliasToken: string;
  canonicalWebsiteSku: string;
  canonicalGraceSku: string;
  reviewer: PsdHumanReviewer;
  reviewedAt: string;
}

export type PsdIdentityState =
  | {
      identityStatus: "reviewed-alias";
      websiteSku: string;
      graceSku: string;
      aliasProvenance: PsdReviewedAliasProvenance;
    }
  | {
      identityStatus: "exact-website-sku";
      websiteSku: string;
      graceSku: string | null;
      aliasProvenance: null;
    }
  | {
      identityStatus: "exact-grace-sku";
      websiteSku: string | null;
      graceSku: string;
      aliasProvenance: null;
    }
  | {
      identityStatus: "unmatched" | "ambiguous" | "conflict";
      websiteSku: string | null;
      graceSku: string | null;
      aliasProvenance: null;
    };

export type PsdReviewState =
  | {
      reviewStatus: "pending-human-review";
      reviewer: null;
      reviewedAt: null;
    }
  | {
      reviewStatus: "blocked";
      reviewer: PsdHumanReviewer;
      reviewedAt: string;
    }
  | {
      reviewStatus: "approved";
      reviewer: PsdHumanReviewer;
      reviewedAt: string;
    };

export interface PsdAuditRecordFields {
  sourcePath: string;
  sourceRelativePath: string;
  sourceSha256: string;
  sourceBytes: number;
  family: string | null;
  canonicalReviewMetadata: PsdCanonicalReviewMetadata | null;
  identityReasons: string[];
  composite: PsdCompositeEvidence | null;
  machineTriage: {
    proposedClassification: PsdCapStateClassification;
    confidence: "low" | "medium" | "high";
    reasons: string[];
  };
}

export interface PsdCanonicalReviewMetadata {
  capacityMl: string | null;
  applicator: string | null;
  capStyle: string | null;
  capColor: string | null;
  trimColor: string | null;
  bodyMaterial: string | null;
  glassFinish: string | null;
  assemblyType: string | null;
  ballMaterial: string | null;
  category: string | null;
  shape: string | null;
  canonBodyHeightMm: string | null;
  canonWidthAxisMm: string | null;
  canonSecondAxisMm: string | null;
  canonHeightWithCapMm: string | null;
}

export type PsdAuditRecord = PsdAuditRecordFields & PsdIdentityState & PsdReviewState;

export interface PsdReviewUnit {
  reviewUnitKey: string;
  sourceSha256: string;
  websiteSku: string | null;
  graceSku: string | null;
  family: string | null;
  canonicalReviewMetadata: PsdCanonicalReviewMetadata | null;
  sources: PsdAuditRecord[];
  representative: PsdAuditRecord;
}

function identityToken(value: string | null): string {
  return String(value ?? "UNMATCHED").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function buildPsdReviewUnitKey(record: PsdAuditRecord): string {
  const canonicalIdentityKey = [
    record.sourceSha256,
    identityToken(record.websiteSku),
    identityToken(record.graceSku),
  ].join("|");

  if (["unmatched", "ambiguous", "conflict"].includes(record.identityStatus)) {
    const sourceIdentity = [record.sourceRelativePath, record.sourcePath]
      .map((value) => encodeURIComponent(value))
      .join("|");
    return `${canonicalIdentityKey}|SOURCE:${sourceIdentity}`;
  }

  return canonicalIdentityKey;
}

export function groupPsdAuditRecords(records: readonly PsdAuditRecord[]): PsdReviewUnit[] {
  const groups = new Map<string, PsdAuditRecord[]>();
  for (const record of records) {
    assertPsdAuditRecordInvariants(record);
    const key = buildPsdReviewUnitKey(record);
    groups.set(key, [...(groups.get(key) ?? []), record]);
  }
  return [...groups.entries()].map(([reviewUnitKey, sources]) => ({
    reviewUnitKey,
    sourceSha256: sources[0].sourceSha256,
    websiteSku: sources[0].websiteSku,
    graceSku: sources[0].graceSku,
    family: sources[0].family,
    canonicalReviewMetadata: sources[0].canonicalReviewMetadata,
    sources,
    representative: [...sources].sort((a, b) =>
      a.sourceRelativePath.localeCompare(b.sourceRelativePath)
      || a.sourcePath.localeCompare(b.sourcePath)
    )[0],
  })).sort((a, b) => a.reviewUnitKey.localeCompare(b.reviewUnitKey));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNamedHumanReviewer(value: unknown): value is PsdHumanReviewer {
  return isRecord(value)
    && value.kind === "human"
    && typeof value.identity === "string"
    && value.identity.trim() !== ""
    && value.identity.trim().toLowerCase() !== "machine";
}

function isValidReviewedAt(value: unknown): value is string {
  return typeof value === "string"
    && value !== ""
    && !Number.isNaN(Date.parse(value))
    && new Date(value).toISOString() === value;
}

function assertReviewedAliasHasProvenance(record: PsdAuditRecord): void {
  if (record.identityStatus !== "reviewed-alias") {
    return;
  }

  const provenance: unknown = record.aliasProvenance;
  if (
    !isRecord(provenance)
    || typeof provenance.observedAliasToken !== "string"
    || provenance.observedAliasToken.trim() === ""
    || typeof provenance.canonicalWebsiteSku !== "string"
    || provenance.canonicalWebsiteSku.trim() === ""
    || typeof provenance.canonicalGraceSku !== "string"
    || provenance.canonicalGraceSku.trim() === ""
    || !isNamedHumanReviewer(provenance.reviewer)
    || !isValidReviewedAt(provenance.reviewedAt)
    || provenance.canonicalWebsiteSku !== record.websiteSku
    || provenance.canonicalGraceSku !== record.graceSku
  ) {
    throw new Error("A reviewed alias requires structured provenance with canonical identities and human review.");
  }
}

function assertPsdAuditRecordInvariants(record: PsdAuditRecord): void {
  assertMachineCannotApprove(record);
  assertExactIdentityHasCanonicalSku(record);
  assertReviewedAliasHasProvenance(record);
}

function isValidSku(value: unknown): value is string {
  return typeof value === "string" && identityToken(value) !== "";
}

function assertExactIdentityHasCanonicalSku(record: PsdAuditRecord): void {
  if (record.identityStatus === "exact-website-sku" && !isValidSku(record.websiteSku)) {
    throw new Error("An exact website identity requires a valid website SKU.");
  }
  if (record.identityStatus === "exact-grace-sku" && !isValidSku(record.graceSku)) {
    throw new Error("An exact Grace identity requires a valid Grace SKU.");
  }
}

export function assertMachineCannotApprove(input: {
  reviewStatus: PsdAuditRecord["reviewStatus"];
  reviewer: { kind: string; identity?: unknown } | string | null;
  reviewedAt?: unknown;
}): void {
  if (input.reviewStatus === "pending-human-review") {
    return;
  }

  const decisionLabel = input.reviewStatus === "blocked"
    ? "A blocked cap-state decision"
    : "Cap-state approval";

  if (!isNamedHumanReviewer(input.reviewer)) {
    throw new Error(`${decisionLabel} requires a named human reviewer.`);
  }

  if (!isValidReviewedAt(input.reviewedAt)) {
    throw new Error(`${decisionLabel} requires a valid reviewed-at timestamp.`);
  }
}
