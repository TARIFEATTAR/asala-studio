import { displayNameFromProductGroupSlug, type MadisonGenerationStudioDestination } from "./bestBottlesMadisonGenerationBatches";

export type BestBottlesStagingUiImageClassification =
  | "madison_generated"
  | "legacy_bestbottles_url"
  | "reference_import"
  | "legacy_site_reference"
  | "shopify_cdn_unknown"
  | "no_image"
  | "blocked_truth_review";

export interface BestBottlesStagingUiAuditRow {
  surface: string;
  stagingUrl: string;
  family: string;
  productGroupSlug: string;
  graceSku: string;
  websiteSku: string | null;
  renderedImageUrl: string;
  imageClassification: BestBottlesStagingUiImageClassification | string;
  needsGenerationOrFix: "yes" | "no";
  generationBucket: string;
  referenceSource: string;
  referenceUrlOrPath: string;
  existingMadisonEvidenceUrl: string;
  nextAction: string;
  qaStatus: string;
  notes: string;
}

export interface BestBottlesStagingUiAudit {
  generatedAt: string;
  source: string;
  baseUrl: string;
  summary: {
    renderedImagesChecked: number;
    flaggedRows: number;
    rowsNeedingGeneration: number;
    rowsNeedingSyncOrPush: number;
    blockedTruthReviewRows: number;
    byFamily: Record<string, number>;
    byGenerationBucket: Record<string, number>;
  };
  rows: BestBottlesStagingUiAuditRow[];
}

export interface BestBottlesStagingUiAuditSection {
  family: string;
  rowCount: number;
  generationBuckets: Record<string, number>;
  rows: BestBottlesStagingUiAuditRow[];
  studioDestinations: MadisonGenerationStudioDestination[];
}

function sortRows(a: BestBottlesStagingUiAuditRow, b: BestBottlesStagingUiAuditRow): number {
  return (
    a.productGroupSlug.localeCompare(b.productGroupSlug) ||
    a.generationBucket.localeCompare(b.generationBucket) ||
    a.graceSku.localeCompare(b.graceSku)
  );
}

function studioDestinationsForRows(
  rows: BestBottlesStagingUiAuditRow[],
): MadisonGenerationStudioDestination[] {
  const destinations = new Map<string, MadisonGenerationStudioDestination>();
  for (const row of rows) {
    const slug = row.productGroupSlug.trim();
    if (!slug) continue;
    const existing = destinations.get(slug);
    if (existing) {
      existing.count += 1;
      continue;
    }
    destinations.set(slug, {
      family: row.family || "(blank)",
      productGroupSlug: slug,
      productGroupDisplayName: displayNameFromProductGroupSlug(slug),
      count: 1,
    });
  }
  return Array.from(destinations.values()).sort(
    (a, b) =>
      b.count - a.count ||
      a.family.localeCompare(b.family) ||
      a.productGroupDisplayName.localeCompare(b.productGroupDisplayName),
  );
}

export function buildBestBottlesStagingUiAuditSections(
  audit: BestBottlesStagingUiAudit,
): BestBottlesStagingUiAuditSection[] {
  const byFamily = new Map<string, BestBottlesStagingUiAuditRow[]>();
  for (const row of audit.rows) {
    if (row.needsGenerationOrFix !== "yes") continue;
    const family = row.family || "(blank)";
    const rows = byFamily.get(family) ?? [];
    rows.push(row);
    byFamily.set(family, rows);
  }

  return Array.from(byFamily.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([family, rows]) => {
      const sortedRows = rows.slice().sort(sortRows);
      const generationBuckets: Record<string, number> = {};
      for (const row of sortedRows) {
        const bucket = row.generationBucket || "unbucketed";
        generationBuckets[bucket] = (generationBuckets[bucket] ?? 0) + 1;
      }
      return {
        family,
        rowCount: sortedRows.length,
        generationBuckets,
        rows: sortedRows,
        studioDestinations: studioDestinationsForRows(sortedRows),
      };
    });
}
