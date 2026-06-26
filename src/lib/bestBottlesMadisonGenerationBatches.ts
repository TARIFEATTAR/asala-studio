export type MadisonGenerationBatchLane =
  | "attach_existing_cdn_before_generation"
  | "generate_from_local_reference"
  | "generate_from_legacy_reference"
  | "blocked_truth_review";

export interface MadisonGenerationBatchRow {
  batchNumber: number;
  batchLabel: string;
  batchLane: MadisonGenerationBatchLane;
  launchPriority: number;
  launchVisibility: string;
  family: string;
  productGroupSlug: string;
  graceSku: string;
  websiteSku: string | null;
  sourceIssue: string;
  referenceSource: string | null;
  referenceUrlOrPath: string | null;
  generatedOrCdnUrl: string | null;
  nextAction: string;
  guardrail: string;
}

export interface MadisonGenerationBatchSummary {
  batchNumber: number;
  batchLabel: string;
  lane: MadisonGenerationBatchLane;
  rowCount: number;
  productGroups: string[];
  families: string[];
}

export interface MadisonGenerationBatchPlan {
  generatedAt: string;
  source: {
    residualCsv: string;
    reconciliationJson: string;
    existingMediaCheckJson: string;
  };
  mantra: string;
  summary: {
    totalNoProductMedia: number;
    selectedRows: number;
    blockedRows: number;
    batchCount: number;
    byLane: Record<MadisonGenerationBatchLane, number>;
    byFamily: Record<string, number>;
  };
  batches: MadisonGenerationBatchSummary[];
  rows: MadisonGenerationBatchRow[];
}

export interface MadisonGenerationStudioDestination {
  family: string;
  productGroupSlug: string;
  productGroupDisplayName: string;
  count: number;
}

export interface MadisonGenerationBatchSection extends MadisonGenerationBatchSummary {
  laneLabel: string;
  laneTone: MadisonGenerationBatchLaneTone;
  primaryAction: string;
  rows: MadisonGenerationBatchRow[];
  studioDestinations: MadisonGenerationStudioDestination[];
}

export type MadisonGenerationBatchLaneTone =
  | "destination"
  | "generate"
  | "source"
  | "blocked";

export interface MadisonGenerationBatchLaneMeta {
  label: string;
  tone: MadisonGenerationBatchLaneTone;
  primaryAction: string;
}

export interface MadisonGenerationTruthReviewSummary {
  totalRows: number;
  launchBlockingTruthRows: number;
  componentMediaHolds: number;
}

const LANE_META: Record<MadisonGenerationBatchLane, MadisonGenerationBatchLaneMeta> = {
  attach_existing_cdn_before_generation: {
    label: "Attach existing CDN",
    tone: "destination",
    primaryAction: "QA, attach, assign, sync",
  },
  generate_from_local_reference: {
    label: "Generate from local reference",
    tone: "generate",
    primaryAction: "Generate in Madison",
  },
  generate_from_legacy_reference: {
    label: "Generate from BestBottles.com",
    tone: "source",
    primaryAction: "Verify, generate in Madison",
  },
  blocked_truth_review: {
    label: "Blocked truth review",
    tone: "blocked",
    primaryAction: "Resolve product truth",
  },
};

export function getMadisonGenerationBatchLaneMeta(
  lane: MadisonGenerationBatchLane,
): MadisonGenerationBatchLaneMeta {
  return LANE_META[lane];
}

const COMPONENT_MEDIA_HOLD_FAMILIES = new Set([
  "Cap/Closure",
  "Cap/Component",
  "Decorative",
  "Dropper",
  "Gift Bag",
  "Gift Box",
  "Lotion Pump",
  "Packaging Supply",
  "Roll-On Cap",
  "Sprayer",
  "Tool",
  "Unknown",
]);

function isComponentMediaHold(row: MadisonGenerationBatchRow): boolean {
  const sku = row.graceSku.trim().toUpperCase();
  return (
    sku.startsWith("PKG-") ||
    sku.startsWith("CMP-") ||
    COMPONENT_MEDIA_HOLD_FAMILIES.has(row.family)
  );
}

export function summarizeMadisonGenerationTruthReview(
  rows: MadisonGenerationBatchRow[],
): MadisonGenerationTruthReviewSummary {
  const blockedRows = rows.filter((row) => row.batchLane === "blocked_truth_review");
  const componentMediaHolds = blockedRows.filter(isComponentMediaHold).length;
  return {
    totalRows: blockedRows.length,
    componentMediaHolds,
    launchBlockingTruthRows: blockedRows.length - componentMediaHolds,
  };
}

export function displayNameFromProductGroupSlug(slug: string): string {
  if (slug === "atomizer-5ml-slim") return "Atomizer Slim";
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => {
      if (/^\d+(ml|mm)$/i.test(part)) return part.toLowerCase();
      if (/^\d+$/.test(part)) return part;
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" ");
}

function sortStudioDestinations(
  destinations: Map<string, MadisonGenerationStudioDestination>,
): MadisonGenerationStudioDestination[] {
  return Array.from(destinations.values()).sort(
    (a, b) =>
      b.count - a.count ||
      a.family.localeCompare(b.family) ||
      a.productGroupDisplayName.localeCompare(b.productGroupDisplayName) ||
      a.productGroupSlug.localeCompare(b.productGroupSlug),
  );
}

function studioDestinationsForRows(
  rows: MadisonGenerationBatchRow[],
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
  return sortStudioDestinations(destinations);
}

export function buildMadisonGenerationBatchSections(
  plan: MadisonGenerationBatchPlan,
): MadisonGenerationBatchSection[] {
  const rowsByBatchNumber = new Map<number, MadisonGenerationBatchRow[]>();
  for (const row of plan.rows) {
    const rows = rowsByBatchNumber.get(row.batchNumber) ?? [];
    rows.push(row);
    rowsByBatchNumber.set(row.batchNumber, rows);
  }

  return plan.batches
    .slice()
    .sort((a, b) => a.batchNumber - b.batchNumber)
    .map((batch) => {
      const rows = (rowsByBatchNumber.get(batch.batchNumber) ?? []).slice().sort((a, b) => {
        return (
          a.productGroupSlug.localeCompare(b.productGroupSlug) ||
          a.family.localeCompare(b.family) ||
          a.graceSku.localeCompare(b.graceSku)
        );
      });
      const meta = getMadisonGenerationBatchLaneMeta(batch.lane);
      return {
        ...batch,
        rowCount: rows.length || batch.rowCount,
        laneLabel: meta.label,
        laneTone: meta.tone,
        primaryAction: meta.primaryAction,
        rows,
        studioDestinations: studioDestinationsForRows(rows),
      };
    });
}
