import {
  getBestBottlesCylinderProductTruthReferenceIssue,
} from "../src/lib/bestBottlesReferenceFilters.ts";

export interface ImageOpsSkuJobRow {
  id: string;
  grace_sku: string | null;
  website_sku: string | null;
  shopify_sku: string | null;
  family: string | null;
  product_group_slug: string | null;
  status: string | null;
  best_reference_candidate_path: string | null;
  expected_canonical_filename: string | null;
  reference_source?: string | null;
  reference_source_path?: string | null;
  reference_source_url?: string | null;
  reference_issue?: string | null;
  generated_image_id: string | null;
  generated_image_url: string | null;
  approved_image_id: string | null;
  approved_image_url: string | null;
  shopify_product_id: string | null;
  shopify_variant_id: string | null;
  last_error: string | null;
}

export interface DuplicateSkuKeyHit {
  key: string;
  rowIds: string[];
  graceSkus: string[];
}

export interface ImageOpsReadinessSummary {
  totalRows: number;
  missingSchemaColumns: string[];
  staleQueuedWithoutReference: ImageOpsSkuJobRow[];
  retiredReferenceHits: ImageOpsSkuJobRow[];
  duplicateSkuKeys: DuplicateSkuKeyHit[];
  generatedWithoutUrl: ImageOpsSkuJobRow[];
  approvedWithoutUrl: ImageOpsSkuJobRow[];
  missingShopifyVariantId: ImageOpsSkuJobRow[];
}

const REQUIRED_REFERENCE_METADATA_COLUMNS = [
  "reference_source",
  "reference_source_path",
  "reference_source_url",
  "reference_imported_at",
  "reference_issue",
];

const ACTIVE_GENERATION_STATUSES = new Set(["queued", "generating"]);

export function requiredReferenceMetadataColumns(): string[] {
  return [...REQUIRED_REFERENCE_METADATA_COLUMNS];
}

export function normalizeSkuKey(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function isPublicImageUrl(value: string | null | undefined): boolean {
  return /^https?:\/\//i.test(String(value ?? "").trim());
}

function rowCandidateValues(row: ImageOpsSkuJobRow): unknown[] {
  return [
    row.best_reference_candidate_path,
    row.expected_canonical_filename,
    row.reference_source,
    row.reference_source_path,
    row.reference_source_url,
    row.reference_issue,
  ];
}

export function hasRetiredReferenceSignal(row: ImageOpsSkuJobRow): boolean {
  return getBestBottlesCylinderProductTruthReferenceIssue(rowCandidateValues(row)) !== null;
}

export function hasUsableFlattenedReference(row: ImageOpsSkuJobRow): boolean {
  return isPublicImageUrl(row.best_reference_candidate_path) && !hasRetiredReferenceSignal(row);
}

export function findStaleQueuedWithoutReferenceRows(rows: ImageOpsSkuJobRow[]): ImageOpsSkuJobRow[] {
  return rows.filter((row) => {
    const status = String(row.status ?? "").trim().toLowerCase();
    if (!ACTIVE_GENERATION_STATUSES.has(status)) return false;
    if (row.generated_image_id || row.generated_image_url) return false;
    return !hasUsableFlattenedReference(row);
  });
}

export function findRetiredReferenceHits(rows: ImageOpsSkuJobRow[]): ImageOpsSkuJobRow[] {
  return rows.filter(hasRetiredReferenceSignal);
}

export function findDuplicateSkuKeys(rows: ImageOpsSkuJobRow[]): DuplicateSkuKeyHit[] {
  const byKey = new Map<string, { rowIds: Set<string>; graceSkus: Set<string> }>();
  for (const row of rows) {
    const keys = new Set(
      [row.grace_sku, row.website_sku, row.shopify_sku]
        .map(normalizeSkuKey)
        .filter(Boolean),
    );
    for (const key of keys) {
      const current = byKey.get(key) ?? { rowIds: new Set<string>(), graceSkus: new Set<string>() };
      current.rowIds.add(row.id);
      const graceSku = row.grace_sku?.trim();
      if (graceSku) current.graceSkus.add(graceSku);
      byKey.set(key, current);
    }
  }

  return Array.from(byKey.entries())
    .filter(([, hit]) => hit.rowIds.size > 1)
    .map(([key, hit]) => ({
      key,
      rowIds: Array.from(hit.rowIds).sort(),
      graceSkus: Array.from(hit.graceSkus).sort(),
    }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

export function findMissingReferenceMetadataColumns(sampleColumns: Iterable<string>): string[] {
  const present = new Set(Array.from(sampleColumns));
  return REQUIRED_REFERENCE_METADATA_COLUMNS.filter((column) => !present.has(column));
}

export function summarizeImageOpsReadiness(
  rows: ImageOpsSkuJobRow[],
  options: { missingSchemaColumns?: string[] } = {},
): ImageOpsReadinessSummary {
  return {
    totalRows: rows.length,
    missingSchemaColumns: options.missingSchemaColumns ?? [],
    staleQueuedWithoutReference: findStaleQueuedWithoutReferenceRows(rows),
    retiredReferenceHits: findRetiredReferenceHits(rows),
    duplicateSkuKeys: findDuplicateSkuKeys(rows),
    generatedWithoutUrl: rows.filter((row) =>
      String(row.status ?? "").toLowerCase() === "generated" &&
      Boolean(row.generated_image_id) &&
      !row.generated_image_url,
    ),
    approvedWithoutUrl: rows.filter((row) =>
      String(row.status ?? "").toLowerCase() === "approved" &&
      Boolean(row.approved_image_id) &&
      !row.approved_image_url,
    ),
    missingShopifyVariantId: rows.filter((row) => !row.shopify_variant_id),
  };
}
