export type BestBottlesGenerationGapStageId =
  | "audit-staging-ui"
  | "truth-and-measurements"
  | "source-references"
  | "launch-batches"
  | "ready-to-generate"
  | "queued-running"
  | "review-generated"
  | "push-shopify"
  | "sync-convex"
  | "complete";

export type BestBottlesGenerationGapStageStatus =
  | "not-run"
  | "blocked"
  | "needs-work"
  | "active"
  | "waiting"
  | "complete";

export interface BestBottlesGenerationGapInput {
  totalSkuJobs: number;
  convexSynced: number;
  stagingUiFlaggedRows: number | null;
  stagingUiRowsNeedingGeneration: number;
  stagingUiRowsNeedingSyncOrPush: number;
  stagingUiBlockedRows: number;
  needsMeasurement: number;
  needsPromptPolicy: number;
  blockedTruthReview: number;
  importLocalReference: number;
  sourceWebsiteReference: number;
  needsSourceMatch: number;
  launchBatchRows: number;
  launchBatchAttachExistingCdn: number;
  launchBatchLocalGeneration: number;
  launchBatchLegacyGeneration: number;
  readyToGenerate: number;
  queued: number;
  generating: number;
  reviewGenerated: number;
  pushToShopify: number;
  syncConvex: number;
}

export interface BestBottlesGenerationGapBreakdownItem {
  label: string;
  value: number;
}

export interface BestBottlesGenerationGapStage {
  id: BestBottlesGenerationGapStageId;
  order: number;
  label: string;
  count: number;
  status: BestBottlesGenerationGapStageStatus;
  primaryAction: string;
  description: string;
  breakdown: BestBottlesGenerationGapBreakdownItem[];
}

function cleanCount(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value));
}

function breakdown(
  items: BestBottlesGenerationGapBreakdownItem[],
): BestBottlesGenerationGapBreakdownItem[] {
  return items.filter((item) => item.value > 0);
}

export function buildBestBottlesGenerationGapStages(
  input: BestBottlesGenerationGapInput,
): BestBottlesGenerationGapStage[] {
  const stagingUiFlaggedRows =
    input.stagingUiFlaggedRows == null ? null : cleanCount(input.stagingUiFlaggedRows);
  const stagingUiRowsNeedingGeneration = cleanCount(input.stagingUiRowsNeedingGeneration);
  const stagingUiRowsNeedingSyncOrPush = cleanCount(input.stagingUiRowsNeedingSyncOrPush);
  const stagingUiBlockedRows = cleanCount(input.stagingUiBlockedRows);
  const needsMeasurement = cleanCount(input.needsMeasurement);
  const needsPromptPolicy = cleanCount(input.needsPromptPolicy);
  const blockedTruthReview = cleanCount(input.blockedTruthReview);
  const importLocalReference = cleanCount(input.importLocalReference);
  const sourceWebsiteReference = cleanCount(input.sourceWebsiteReference);
  const needsSourceMatch = cleanCount(input.needsSourceMatch);
  const launchBatchRows = cleanCount(input.launchBatchRows);
  const launchBatchAttachExistingCdn = cleanCount(input.launchBatchAttachExistingCdn);
  const launchBatchLocalGeneration = cleanCount(input.launchBatchLocalGeneration);
  const launchBatchLegacyGeneration = cleanCount(input.launchBatchLegacyGeneration);
  const readyToGenerate = cleanCount(input.readyToGenerate);
  const queued = cleanCount(input.queued);
  const generating = cleanCount(input.generating);
  const reviewGenerated = cleanCount(input.reviewGenerated);
  const pushToShopify = cleanCount(input.pushToShopify);
  const syncConvex = cleanCount(input.syncConvex);
  const convexSynced = cleanCount(input.convexSynced);
  const totalSkuJobs = cleanCount(input.totalSkuJobs);

  const truthBlockers = needsMeasurement + needsPromptPolicy + blockedTruthReview + stagingUiBlockedRows;
  const sourceReferenceWork = importLocalReference + sourceWebsiteReference + needsSourceMatch;
  const queuedRunning = queued + generating;

  return [
    {
      id: "audit-staging-ui",
      order: 1,
      label: "Audit staging UI",
      count: stagingUiFlaggedRows ?? 0,
      status:
        stagingUiFlaggedRows == null
          ? "not-run"
          : stagingUiFlaggedRows > 0
            ? "needs-work"
            : "complete",
      primaryAction: stagingUiFlaggedRows == null ? "Run UI audit" : "Open UI refs",
      description: "Find rendered legacy/reference images before they hide in staging.",
      breakdown: breakdown([
        { label: "Need generation", value: stagingUiRowsNeedingGeneration },
        { label: "Sync/push only", value: stagingUiRowsNeedingSyncOrPush },
        { label: "Truth blocked", value: stagingUiBlockedRows },
      ]),
    },
    {
      id: "truth-and-measurements",
      order: 2,
      label: "Resolve blockers",
      count: truthBlockers,
      status: truthBlockers > 0 ? "blocked" : "complete",
      primaryAction: needsMeasurement > 0 ? "Scrape measurements" : "Open blockers",
      description:
        needsMeasurement > 0
          ? "Use Firecrawl on bestbottles.com to collect missing body measurements before prompt or truth holds."
          : "Clear missing measurements, prompt policy, and product-truth holds.",
      breakdown: breakdown([
        { label: "Measurements", value: needsMeasurement },
        { label: "Prompt policy", value: needsPromptPolicy },
        { label: "Truth review", value: blockedTruthReview },
        { label: "UI truth blocked", value: stagingUiBlockedRows },
      ]),
    },
    {
      id: "source-references",
      order: 3,
      label: "Source references",
      count: sourceReferenceWork,
      status: sourceReferenceWork > 0 ? "needs-work" : "complete",
      primaryAction: "Open reference work",
      description: "Import local refs first, then source bestbottles.com for gaps.",
      breakdown: breakdown([
        { label: "Import local", value: importLocalReference },
        { label: "Source website", value: sourceWebsiteReference },
        { label: "Needs source match", value: needsSourceMatch },
      ]),
    },
    {
      id: "launch-batches",
      order: 4,
      label: "Work launch batches",
      count: launchBatchRows,
      status: launchBatchRows > 0 ? "active" : "waiting",
      primaryAction: "Open batches",
      description: "Generate by product truth, then write and sync by Grace SKU.",
      breakdown: breakdown([
        { label: "Attach CDN", value: launchBatchAttachExistingCdn },
        { label: "Local gen", value: launchBatchLocalGeneration },
        { label: "Website gen", value: launchBatchLegacyGeneration },
      ]),
    },
    {
      id: "ready-to-generate",
      order: 5,
      label: "Queue generation",
      count: readyToGenerate,
      status: readyToGenerate > 0 ? "active" : "waiting",
      primaryAction: "Open ready rows",
      description: "Queue persisted SKU jobs with usable public PNG/JPG/WebP references.",
      breakdown: breakdown([{ label: "Ready rows", value: readyToGenerate }]),
    },
    {
      id: "queued-running",
      order: 6,
      label: "Run generation",
      count: queuedRunning,
      status: queuedRunning > 0 ? "active" : "waiting",
      primaryAction: "Open creation lane",
      description: "Track queued and running SKU images until outputs land.",
      breakdown: breakdown([
        { label: "Queued", value: queued },
        { label: "Running", value: generating },
      ]),
    },
    {
      id: "review-generated",
      order: 7,
      label: "Review outputs",
      count: reviewGenerated,
      status: reviewGenerated > 0 ? "needs-work" : "waiting",
      primaryAction: "Open review",
      description: "Approve exact product images or reject drift before publishing.",
      breakdown: breakdown([{ label: "Review rows", value: reviewGenerated }]),
    },
    {
      id: "push-shopify",
      order: 8,
      label: "Push Shopify",
      count: pushToShopify,
      status: pushToShopify > 0 ? "needs-work" : "waiting",
      primaryAction: "Open push work",
      description: "Attach approved images to the exact Shopify variant.",
      breakdown: breakdown([{ label: "Pending push", value: pushToShopify }]),
    },
    {
      id: "sync-convex",
      order: 9,
      label: "Sync Convex",
      count: syncConvex,
      status: syncConvex > 0 ? "needs-work" : "waiting",
      primaryAction: "Open sync work",
      description: "Mirror Shopify image URLs back into Convex by Grace SKU.",
      breakdown: breakdown([{ label: "Pending sync", value: syncConvex }]),
    },
    {
      id: "complete",
      order: 10,
      label: "Complete coverage",
      count: convexSynced,
      status: totalSkuJobs > 0 && convexSynced >= totalSkuJobs ? "complete" : "waiting",
      primaryAction: "Open synced rows",
      description: "Fully synced rows are hidden from Needs Work.",
      breakdown: breakdown([
        { label: "Synced", value: convexSynced },
        { label: "Total jobs", value: totalSkuJobs },
      ]),
    },
  ];
}

export function getBestBottlesGenerationGapNextStage(
  stages: BestBottlesGenerationGapStage[],
): BestBottlesGenerationGapStage | null {
  return (
    stages.find(
      (stage) =>
        stage.id !== "complete" &&
        (stage.status === "not-run" ||
          stage.status === "blocked" ||
          stage.status === "needs-work" ||
          stage.status === "active"),
    ) ??
    stages.find((stage) => stage.id === "complete") ??
    null
  );
}
