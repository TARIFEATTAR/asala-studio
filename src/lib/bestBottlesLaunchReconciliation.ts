export type BestBottlesLaunchActionBucket =
  | "assign_existing_media"
  | "generate_from_local_reference"
  | "generate_from_legacy_reference"
  | "blocked_truth_review";

export type BestBottlesLaunchReferenceSource =
  | "local_repo"
  | "legacy_site"
  | "shopify_existing_media"
  | "blocked";

export type BestBottlesLaunchQaStatus =
  | "pass"
  | "needs_visual_review"
  | "blocked";

export interface BestBottlesLaunchResidualRow {
  family?: string | null;
  product_group_slug?: string | null;
  sku?: string | null;
  website_sku?: string | null;
  shopify_variant_id?: string | null;
  convex_product_id?: string | null;
  business_product_id?: string | null;
  product_media_count?: string | number | null;
  issue?: string | null;
  recommended_next_action?: string | null;
  convex_image_url?: string | null;
  product_media_sample?: string | null;
}

export interface BestBottlesLaunchCoverageRow {
  graceSku?: string | null;
  websiteSku?: string | null;
  family?: string | null;
  productGroupSlug?: string | null;
  itemName?: string | null;
  capacity?: string | null;
  capacityMl?: string | number | null;
  color?: string | null;
  materialBucket?: string | null;
  applicator?: string | null;
  capStyle?: string | null;
  capColor?: string | null;
  currentImageUrl?: string | null;
  coverageEvidenceUrl?: string | null;
  referenceSource?: string | null;
  referencePath?: string | null;
  referenceUrl?: string | null;
  productUrl?: string | null;
  generationBucket?: string | null;
  coverageStatus?: string | null;
}

export interface BestBottlesLaunchReferenceManifestRow {
  graceSku?: string | null;
  websiteSku?: string | null;
  family?: string | null;
  productGroupSlug?: string | null;
  productGroupDisplayName?: string | null;
  applicator?: string | null;
  capacityMl?: string | number | null;
  color?: string | null;
  referenceSource?: string | null;
  bestReferenceCandidatePath?: string | null;
  absoluteReferencePath?: string | null;
  liveReferenceUrl?: string | null;
  expectedCanonicalFilename?: string | null;
}

export interface BestBottlesLaunchBlockerRow {
  sku?: string | null;
  graceSku?: string | null;
  website_sku?: string | null;
  websiteSku?: string | null;
  family?: string | null;
  product_group_slug?: string | null;
  productGroupSlug?: string | null;
  issue?: string | null;
  recommended_next_action?: string | null;
  recommendedAction?: string | null;
  notes?: string | null;
}

export interface BestBottlesLaunchReconciliationInput {
  residualRows: BestBottlesLaunchResidualRow[];
  coverageRows?: BestBottlesLaunchCoverageRow[];
  localReferenceRows?: BestBottlesLaunchReferenceManifestRow[];
  legacyReferenceRows?: BestBottlesLaunchReferenceManifestRow[];
  blockerRows?: BestBottlesLaunchBlockerRow[];
  generatedAt?: string;
  source?: Partial<BestBottlesLaunchReconciliationManifest["source"]>;
}

export interface BestBottlesLaunchReconciliationRow {
  graceSku: string;
  websiteSku: string | null;
  productGroupSlug: string | null;
  family: string | null;
  actionBucket: BestBottlesLaunchActionBucket;
  referenceSource: BestBottlesLaunchReferenceSource;
  referenceUrlOrPath: string | null;
  generatedImagePathOrShopifyCdnUrl: string | null;
  shopifyMediaId: string | null;
  shopifyVariantId: string | null;
  variantImageAssigned: "yes" | "no";
  convexSyncedByGraceSku: "yes" | "no";
  qaStatus: BestBottlesLaunchQaStatus;
  productMediaCount: number;
  issue: string | null;
  recommendedNextAction: string | null;
  identityCapacity: string | null;
  identityColor: string | null;
  identityMaterialBucket: string | null;
  identityApplicator: string | null;
  identityCapStyle: string | null;
  identityCapColor: string | null;
  identityItemName: string | null;
  legacyProductUrl: string | null;
  notes: string;
}

export interface BestBottlesLaunchReconciliationManifest {
  generatedAt: string;
  source: {
    residualCsv: string;
    coverageManifest: string;
    localReferenceManifest: string;
    legacyReferenceManifest: string;
    blockerCsv: string;
  };
  summary: {
    totalRows: number;
    byActionBucket: Record<BestBottlesLaunchActionBucket, number>;
    byReferenceSource: Record<BestBottlesLaunchReferenceSource, number>;
    byFamily: Record<string, number>;
    noProductMedia: number;
    productMediaPresent: number;
    duplicateWebsiteSkuKeys: number;
    needsVisualReview: number;
    blockedTruthReview: number;
  };
  rows: BestBottlesLaunchReconciliationRow[];
}

const ACTION_BUCKETS: BestBottlesLaunchActionBucket[] = [
  "assign_existing_media",
  "generate_from_local_reference",
  "generate_from_legacy_reference",
  "blocked_truth_review",
];

const REFERENCE_SOURCES: BestBottlesLaunchReferenceSource[] = [
  "local_repo",
  "legacy_site",
  "shopify_existing_media",
  "blocked",
];

function clean(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

function skuKey(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toUpperCase();
}

function looseKey(value: unknown): string {
  return skuKey(value).replace(/[^A-Z0-9]/g, "");
}

function lowerClean(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function numberValue(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function byGraceSku<T extends { graceSku?: string | null; sku?: string | null }>(rows: T[] = []): Map<string, T> {
  const index = new Map<string, T>();
  for (const row of rows) {
    const key = skuKey(row.graceSku ?? row.sku);
    if (key && !index.has(key)) index.set(key, row);
  }
  return index;
}

function basenameFromUrlOrPath(value: string): string {
  try {
    const url = new URL(value);
    return decodeURIComponent(url.pathname.split("/").pop() ?? value);
  } catch {
    return value.split("/").pop() ?? value;
  }
}

function extensionlessFilename(value: string): string {
  return basenameFromUrlOrPath(value).replace(/\.(png|jpe?g|webp|gif)(\?.*)?$/i, "");
}

function splitMediaSample(sample: string | null | undefined): string[] {
  return String(sample ?? "")
    .split("|")
    .map((value) => value.trim())
    .filter(Boolean);
}

function exactSkuInImageReference(value: string, sku: string): boolean {
  const filename = extensionlessFilename(value).toUpperCase();
  const target = skuKey(sku);
  return (
    filename === target ||
    filename.startsWith(`${target}__`) ||
    filename.startsWith(`${target}_`) ||
    filename.startsWith(`${target}.`)
  );
}

export function productMediaSampleHasExactSku(
  sample: string | null | undefined,
  sku: string | null | undefined,
): boolean {
  const target = clean(sku);
  if (!target) return false;
  return splitMediaSample(sample).some((mediaUrl) => exactSkuInImageReference(mediaUrl, target));
}

function firstExactMediaSample(
  sample: string | null | undefined,
  sku: string | null | undefined,
): string | null {
  const target = clean(sku);
  if (!target) return null;
  return splitMediaSample(sample).find((mediaUrl) => exactSkuInImageReference(mediaUrl, target)) ?? null;
}

function isShopifyCdn(value: string | null | undefined): boolean {
  return lowerClean(value).includes("cdn.shopify.com/");
}

function isLegacyBestBottlesReference(value: string | null | undefined): boolean {
  return lowerClean(value).includes("bestbottles.com/images/");
}

function isBlockingAuditRow(row: BestBottlesLaunchBlockerRow | undefined): boolean {
  if (!row) return false;
  const issue = lowerClean(row.issue);
  const text = lowerClean(
    `${row.issue ?? ""} ${row.recommended_next_action ?? row.recommendedAction ?? ""} ${row.notes ?? ""}`,
  );
  if (text.includes("no critical/high sku mapping blocker")) return false;
  if (/^(critical|high)\b/.test(issue)) return true;
  return /\b(blocked|truth review|identity conflict|wrong family|wrong applicator|wrong sku|mapping conflict)\b/.test(
    text,
  );
}

function fieldMismatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = looseKey(a);
  const right = looseKey(b);
  return Boolean(left && right && left !== right);
}

function identityIssues(params: {
  residual: BestBottlesLaunchResidualRow;
  coverage?: BestBottlesLaunchCoverageRow;
  localReference?: BestBottlesLaunchReferenceManifestRow;
  legacyReference?: BestBottlesLaunchReferenceManifestRow;
  blocker?: BestBottlesLaunchBlockerRow;
}): string[] {
  const issues: string[] = [];
  const graceSku = clean(params.residual.sku);
  if (!graceSku) issues.push("Missing Grace SKU.");
  if (!clean(params.residual.family)) issues.push("Missing family.");
  if (!clean(params.residual.product_group_slug)) issues.push("Missing product_group_slug.");
  if (!clean(params.residual.website_sku)) issues.push("Missing websiteSku evidence.");
  if (isBlockingAuditRow(params.blocker)) {
    issues.push(`Product-truth audit blocker: ${clean(params.blocker?.issue) ?? "review required"}.`);
  }

  const sources = [
    { label: "coverage", row: params.coverage },
    { label: "local reference", row: params.localReference },
    { label: "legacy reference", row: params.legacyReference },
  ];
  for (const source of sources) {
    if (!source.row) continue;
    if (fieldMismatch(params.residual.family, source.row.family)) {
      issues.push(`Family conflicts with ${source.label} evidence.`);
    }
    const sourceProductGroup =
      "productGroupSlug" in source.row ? source.row.productGroupSlug : undefined;
    if (fieldMismatch(params.residual.product_group_slug, sourceProductGroup)) {
      issues.push(`Product group conflicts with ${source.label} evidence.`);
    }
    const sourceWebsiteSku = "websiteSku" in source.row ? source.row.websiteSku : undefined;
    if (fieldMismatch(params.residual.website_sku, sourceWebsiteSku)) {
      issues.push(`Website SKU conflicts with ${source.label} evidence.`);
    }
  }

  return issues;
}

function referencePathForLocal(row: BestBottlesLaunchReferenceManifestRow | undefined): string | null {
  return clean(row?.absoluteReferencePath) ?? clean(row?.bestReferenceCandidatePath);
}

function referencePathForLegacy(
  legacy: BestBottlesLaunchReferenceManifestRow | undefined,
  coverage: BestBottlesLaunchCoverageRow | undefined,
  residual: BestBottlesLaunchResidualRow,
): string | null {
  return (
    clean(legacy?.liveReferenceUrl) ??
    clean(coverage?.referenceUrl) ??
    (isLegacyBestBottlesReference(residual.convex_image_url) ? clean(residual.convex_image_url) : null) ??
    clean(coverage?.productUrl)
  );
}

function generatedOrCdnEvidence(
  residual: BestBottlesLaunchResidualRow,
  coverage: BestBottlesLaunchCoverageRow | undefined,
): string | null {
  return (
    (isShopifyCdn(residual.convex_image_url) ? clean(residual.convex_image_url) : null) ??
    (isShopifyCdn(coverage?.coverageEvidenceUrl) ? clean(coverage?.coverageEvidenceUrl) : null) ??
    (isShopifyCdn(coverage?.currentImageUrl) ? clean(coverage?.currentImageUrl) : null)
  );
}

function chooseAction(params: {
  residual: BestBottlesLaunchResidualRow;
  coverage?: BestBottlesLaunchCoverageRow;
  localReference?: BestBottlesLaunchReferenceManifestRow;
  legacyReference?: BestBottlesLaunchReferenceManifestRow;
  identityIssues: string[];
}): Pick<
  BestBottlesLaunchReconciliationRow,
  | "actionBucket"
  | "referenceSource"
  | "referenceUrlOrPath"
  | "generatedImagePathOrShopifyCdnUrl"
  | "qaStatus"
  | "notes"
> {
  const { residual, coverage, localReference, legacyReference } = params;
  if (params.identityIssues.length > 0) {
    return {
      actionBucket: "blocked_truth_review",
      referenceSource: "blocked",
      referenceUrlOrPath: null,
      generatedImagePathOrShopifyCdnUrl: null,
      qaStatus: "blocked",
      notes: params.identityIssues.join(" "),
    };
  }

  const graceSku = clean(residual.sku);
  const productMediaCount = numberValue(residual.product_media_count);
  const exactMedia = firstExactMediaSample(residual.product_media_sample, graceSku);
  const generatedEvidence = generatedOrCdnEvidence(residual, coverage);
  const localReferencePath = referencePathForLocal(localReference);
  const legacyReferencePath = referencePathForLegacy(legacyReference, coverage, residual);

  if (productMediaCount > 0) {
    return {
      actionBucket: "assign_existing_media",
      referenceSource: "shopify_existing_media",
      referenceUrlOrPath: exactMedia ?? clean(residual.product_media_sample),
      generatedImagePathOrShopifyCdnUrl: exactMedia ?? generatedEvidence,
      qaStatus: exactMedia ? "pass" : "needs_visual_review",
      notes: exactMedia
        ? "Existing Shopify product media filename has an exact Grace SKU token; assign to the exact variant, then sync Convex by graceSku."
        : "Shopify product media exists, but the sampled filenames do not prove an exact SKU match. Visually verify against the SKU identity before assigning; generate instead if no exact product media is present.",
    };
  }

  if (generatedEvidence) {
    return {
      actionBucket: "assign_existing_media",
      referenceSource: "shopify_existing_media",
      referenceUrlOrPath: generatedEvidence,
      generatedImagePathOrShopifyCdnUrl: generatedEvidence,
      qaStatus: "needs_visual_review",
      notes:
        "No Shopify product media is attached, but Convex/coverage already points at a Shopify CDN image. Visually verify it is the exact SKU, attach/upload it to the Shopify product, assign the variant, then sync Convex by graceSku.",
    };
  }

  if (localReferencePath) {
    return {
      actionBucket: "generate_from_local_reference",
      referenceSource: "local_repo",
      referenceUrlOrPath: localReferencePath,
      generatedImagePathOrShopifyCdnUrl: null,
      qaStatus: "needs_visual_review",
      notes:
        "Generate one Madison catalog PDP image from the local repo reference, upload to Shopify, assign to the exact variant, then sync Convex by graceSku.",
    };
  }

  if (legacyReferencePath) {
    return {
      actionBucket: "generate_from_legacy_reference",
      referenceSource: "legacy_site",
      referenceUrlOrPath: legacyReferencePath,
      generatedImagePathOrShopifyCdnUrl: null,
      qaStatus: "needs_visual_review",
      notes:
        "Use legacy bestbottles.com only as reference evidence. Verify SKU identity, generate one Madison catalog PDP image, upload to Shopify, assign to the exact variant, then sync Convex by graceSku.",
    };
  }

  return {
    actionBucket: "blocked_truth_review",
    referenceSource: "blocked",
    referenceUrlOrPath: null,
    generatedImagePathOrShopifyCdnUrl: null,
    qaStatus: "blocked",
    notes:
      "No exact local reference, legacy-site reference, or generated CDN evidence was found by Grace SKU. Source with Firecrawl/live-site search or manual product-truth review before generation.",
  };
}

function emptyActionCounts(): Record<BestBottlesLaunchActionBucket, number> {
  return Object.fromEntries(ACTION_BUCKETS.map((bucket) => [bucket, 0])) as Record<
    BestBottlesLaunchActionBucket,
    number
  >;
}

function emptyReferenceCounts(): Record<BestBottlesLaunchReferenceSource, number> {
  return Object.fromEntries(REFERENCE_SOURCES.map((source) => [source, 0])) as Record<
    BestBottlesLaunchReferenceSource,
    number
  >;
}

function duplicateWebsiteSkuCount(rows: BestBottlesLaunchResidualRow[]): number {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = looseKey(row.website_sku);
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.values()).filter((count) => count > 1).length;
}

export function buildBestBottlesLaunchReconciliation(
  input: BestBottlesLaunchReconciliationInput,
): BestBottlesLaunchReconciliationManifest {
  const coverageBySku = byGraceSku(input.coverageRows);
  const localBySku = byGraceSku(input.localReferenceRows);
  const legacyBySku = byGraceSku(input.legacyReferenceRows);
  const blockerBySku = byGraceSku(input.blockerRows);

  const rows = input.residualRows
    .map((residual): BestBottlesLaunchReconciliationRow => {
      const graceSku = clean(residual.sku) ?? "";
      const coverage = coverageBySku.get(skuKey(graceSku));
      const localReference = localBySku.get(skuKey(graceSku));
      const legacyReference = legacyBySku.get(skuKey(graceSku));
      const blocker = blockerBySku.get(skuKey(graceSku));
      const issues = identityIssues({
        residual,
        coverage,
        localReference,
        legacyReference,
        blocker,
      });
      const action = chooseAction({
        residual,
        coverage,
        localReference,
        legacyReference,
        identityIssues: issues,
      });

      return {
        graceSku,
        websiteSku: clean(residual.website_sku),
        productGroupSlug: clean(residual.product_group_slug),
        family: clean(residual.family),
        actionBucket: action.actionBucket,
        referenceSource: action.referenceSource,
        referenceUrlOrPath: action.referenceUrlOrPath,
        generatedImagePathOrShopifyCdnUrl: action.generatedImagePathOrShopifyCdnUrl,
        shopifyMediaId: null,
        shopifyVariantId: clean(residual.shopify_variant_id),
        variantImageAssigned: "no",
        convexSyncedByGraceSku: "no",
        qaStatus: action.qaStatus,
        productMediaCount: numberValue(residual.product_media_count),
        issue: clean(residual.issue),
        recommendedNextAction: clean(residual.recommended_next_action),
        identityCapacity: clean(coverage?.capacity) ?? clean(coverage?.capacityMl),
        identityColor: clean(coverage?.color),
        identityMaterialBucket: clean(coverage?.materialBucket),
        identityApplicator:
          clean(coverage?.applicator) ?? clean(localReference?.applicator) ?? clean(legacyReference?.applicator),
        identityCapStyle: clean(coverage?.capStyle),
        identityCapColor: clean(coverage?.capColor),
        identityItemName: clean(coverage?.itemName) ?? clean(localReference?.productGroupDisplayName),
        legacyProductUrl: clean(coverage?.productUrl),
        notes: action.notes,
      };
    })
    .sort(
      (a, b) =>
        (a.family ?? "").localeCompare(b.family ?? "") ||
        (a.productGroupSlug ?? "").localeCompare(b.productGroupSlug ?? "") ||
        a.graceSku.localeCompare(b.graceSku),
    );

  const byActionBucket = emptyActionCounts();
  const byReferenceSource = emptyReferenceCounts();
  const byFamily: Record<string, number> = {};
  let noProductMedia = 0;
  let productMediaPresent = 0;
  let needsVisualReview = 0;
  let blockedTruthReview = 0;

  for (const row of rows) {
    byActionBucket[row.actionBucket] += 1;
    byReferenceSource[row.referenceSource] += 1;
    byFamily[row.family ?? "Unknown"] = (byFamily[row.family ?? "Unknown"] ?? 0) + 1;
    if (row.productMediaCount > 0) productMediaPresent += 1;
    else noProductMedia += 1;
    if (row.qaStatus === "needs_visual_review") needsVisualReview += 1;
    if (row.actionBucket === "blocked_truth_review") blockedTruthReview += 1;
  }

  return {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    source: {
      residualCsv:
        input.source?.residualCsv ??
        "data/audits/stage-in-sight-image-sync-2026-06-15/cleanup/remaining_missing_shopify_variant_images_after_cleanup.csv",
      coverageManifest:
        input.source?.coverageManifest ??
        "data/audits/stage-in-sight-image-sync-2026-06-15/agent-2/image-generation-coverage/image_generation_coverage.json",
      localReferenceManifest:
        input.source?.localReferenceManifest ??
        "data/audits/stage-in-sight-image-sync-2026-06-15/agent-2/image-generation-coverage/madison_manifest_local_reference.json",
      legacyReferenceManifest:
        input.source?.legacyReferenceManifest ??
        "data/audits/stage-in-sight-image-sync-2026-06-15/agent-2/image-generation-coverage/madison_manifest_legacy_reference.json",
      blockerCsv:
        input.source?.blockerCsv ??
        "data/audits/stage-in-sight-image-sync-2026-06-15/coordinator/product_truth_sku_mapping_blockers.csv",
    },
    summary: {
      totalRows: rows.length,
      byActionBucket,
      byReferenceSource,
      byFamily,
      noProductMedia,
      productMediaPresent,
      duplicateWebsiteSkuKeys: duplicateWebsiteSkuCount(input.residualRows),
      needsVisualReview,
      blockedTruthReview,
    },
    rows,
  };
}
