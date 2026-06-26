import fs from "node:fs";
import path from "node:path";
import process from "node:process";

type ReferenceDisposition =
  | "ready_to_index"
  | "needs_legacy_download"
  | "needs_legacy_scrape"
  | "needs_grace_sku"
  | "missing_source_image"
  | "possible_duplicate";

interface CatalogProduct {
  websiteSku: string | null;
  graceSku: string | null;
  productId: string | null;
  family: string | null;
  category: string | null;
  color: string | null;
  capacityMl: number | string | null;
  applicator: string | null;
  capStyle: string | null;
  capColor: string | null;
  itemName: string | null;
  imageUrl: string | null;
  productGroupId: string | null;
}

interface PipelineProduct {
  action: string | null;
  coverageStatus: string | null;
  productId: string | null;
  productGroupSlug: string | null;
  productGroupDisplayName: string | null;
  family: string | null;
  category: string | null;
  capacityMl: string | null;
  applicator: string | null;
  canonicalColor: string | null;
  graceSku: string | null;
  websiteSku: string | null;
  expectedCanonicalFilename: string | null;
  bestReferenceCandidatePath: string | null;
  generatedCandidateCount: number;
  reviewCandidateCount: number;
  shopifyReadyCount: number;
  hasConvexImageUrl: string | null;
  hasShopifyProductId: string | null;
  hasShopifyVariantId: string | null;
}

interface ReadinessRow {
  status: string;
  issues: string[];
  graceSku: string | null;
  websiteSku: string | null;
  productId: string | null;
  productGroupSlug: string | null;
  productGroupDisplayName: string | null;
  family: string | null;
  category: string | null;
  capacityMl: string | null;
  color: string | null;
  applicator: string | null;
  capStyle: string | null;
  capColor: string | null;
  hasReference: boolean;
  bestReferenceCandidatePath: string | null;
  coverageStatus: string | null;
  generatedCandidateCount: number;
  reviewCandidateCount: number;
  shopifyReadyCount: number;
  hasConvexImageUrl: string | null;
  expectedCanonicalFilename: string | null;
}

interface RenderManifestEntry {
  status: string;
  graceSku: string | null;
  websiteSku: string | null;
  family: string | null;
  productGroupSlug: string | null;
  currentReferencePath: string | null;
  proposedSourcePath: string | null;
  proposedCanonicalFilename: string | null;
  matchedDiskFileCount: number;
  duplicatePaths: string[];
  reason: string;
  nextAction: string;
}

interface AuditRow {
  disposition: ReferenceDisposition;
  graceSku: string | null;
  websiteSku: string | null;
  productId: string | null;
  productGroupSlug: string | null;
  productGroupDisplayName: string | null;
  family: string | null;
  capacityMl: string | null;
  applicator: string | null;
  color: string | null;
  capStyle: string | null;
  capColor: string | null;
  catalogImageUrl: string | null;
  localReferencePath: string | null;
  renderManifestStatus: string | null;
  renderManifestReason: string | null;
  matchedDiskFileCount: number;
  duplicatePaths: string[];
  likelyLegacySearchUrl: string | null;
  expectedCanonicalFilename: string | null;
  nextAction: string;
}

const ROOT = process.cwd();
const BEST_BOTTLES_ROOT =
  "/Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Website-02-20-2026";
const RENDER_ROOT = path.join(BEST_BOTTLES_ROOT, "pipeline/madison-hero-sync/renders");
const CATALOG_PATH = "public/data/best-bottles-catalog-lite.json";
const PIPELINE_PATH = "public/data/best-bottles-madison-pipeline-ui.json";
const READINESS_PATH = "public/data/best-bottles-generation-readiness.json";
const RENDER_MANIFEST_PATH = "tmp/best-bottles-render-reconciliation-manifest.json";
const OUT_JSON = "tmp/best-bottles-boston-round-reference-audit.json";
const OUT_CSV = "tmp/best-bottles-boston-round-reference-audit.csv";
const OUT_REPORT = "docs/best-bottles-boston-round-reference-audit.md";

function readRows<T>(relativePath: string): T[] {
  const absolutePath = path.resolve(ROOT, relativePath);
  if (!fs.existsSync(absolutePath)) return [];
  const json = JSON.parse(fs.readFileSync(absolutePath, "utf8"));
  if (Array.isArray(json)) return json as T[];
  return (json.rows ?? json.products ?? json.items ?? json.entries ?? []) as T[];
}

function ensureParent(relativePath: string): void {
  fs.mkdirSync(path.dirname(path.resolve(ROOT, relativePath)), { recursive: true });
}

function clean(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

function skuKey(value: string | null | undefined): string {
  return clean(value).toUpperCase();
}

function isBostonRound(row: {
  family?: string | null;
  productGroupSlug?: string | null;
  productGroupDisplayName?: string | null;
  websiteSku?: string | null;
  graceSku?: string | null;
  itemName?: string | null;
}): boolean {
  const text = [
    row.family,
    row.productGroupSlug,
    row.productGroupDisplayName,
    row.websiteSku,
    row.graceSku,
    row.itemName,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return row.family === "Boston Round" || text.includes("boston-round") || text.includes("boston round");
}

function likelySearchUrl(row: Pick<AuditRow, "websiteSku" | "productGroupDisplayName" | "graceSku">): string | null {
  const query = clean(row.websiteSku) || clean(row.productGroupDisplayName) || clean(row.graceSku);
  if (!query) return null;
  return `https://www.bestbottles.com/all-bottles/all-items/search-products.php?search_name=${encodeURIComponent(query)}`;
}

function csvEscape(value: unknown): string {
  const text = Array.isArray(value) ? value.join("; ") : String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function countBy<T extends string>(rows: AuditRow[], getter: (row: AuditRow) => T | null | undefined): Record<T, number> {
  const counts = {} as Record<T, number>;
  for (const row of rows) {
    const key = getter(row);
    if (!key) continue;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function topCounts(counts: Record<string, number>): [string, number][] {
  return Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function markdownTable(rows: string[][]): string {
  if (rows.length === 0) return "";
  const widths = rows[0].map((_, col) => Math.max(...rows.map((row) => row[col]?.length ?? 0)));
  const format = (row: string[]) => `| ${row.map((cell, col) => cell.padEnd(widths[col])).join(" | ")} |`;
  return [format(rows[0]), format(widths.map((width) => "-".repeat(Math.max(width, 3)))), ...rows.slice(1).map(format)].join("\n");
}

function chooseDisposition(params: {
  graceSku: string | null;
  localReferencePath: string | null;
  catalogImageUrl: string | null;
  renderEntry: RenderManifestEntry | undefined;
}): { disposition: ReferenceDisposition; nextAction: string } {
  if (!clean(params.graceSku)) {
    return {
      disposition: "needs_grace_sku",
      nextAction: "Do not scrape or index yet. Resolve a canonical Grace SKU first.",
    };
  }
  if ((params.renderEntry?.matchedDiskFileCount ?? 0) > 1 || (params.renderEntry?.duplicatePaths?.length ?? 0) > 1) {
    return {
      disposition: "possible_duplicate",
      nextAction: "Review duplicate local matches and choose one canonical source image before indexing.",
    };
  }
  if (params.localReferencePath) {
    return {
      disposition: "ready_to_index",
      nextAction: "Local reference exists. Index or copy into canonical Grace SKU format after visual review.",
    };
  }
  if (params.catalogImageUrl) {
    return {
      disposition: "needs_legacy_download",
      nextAction: "Download the catalog image URL, verify it is the correct Boston Round source, then copy into canonical Grace SKU format.",
    };
  }
  if (params.renderEntry?.status === "missing_source_image") {
    return {
      disposition: "missing_source_image",
      nextAction: "No local source image exists in the render archive. Scrape Best Bottles legacy pages or source a reference before generation.",
    };
  }
  return {
    disposition: "needs_legacy_scrape",
    nextAction: "Scrape/search the legacy Best Bottles Boston Round pages for the product image before generation.",
  };
}

function main(): void {
  const catalog = readRows<CatalogProduct>(CATALOG_PATH);
  const pipeline = readRows<PipelineProduct>(PIPELINE_PATH);
  const readiness = readRows<ReadinessRow>(READINESS_PATH);
  const renderManifest = readRows<RenderManifestEntry>(RENDER_MANIFEST_PATH);

  const catalogByGrace = new Map(catalog.filter(isBostonRound).map((row) => [skuKey(row.graceSku), row]));
  const catalogByWebsite = new Map(catalog.filter(isBostonRound).map((row) => [skuKey(row.websiteSku), row]));
  const pipelineByGrace = new Map(pipeline.filter(isBostonRound).map((row) => [skuKey(row.graceSku), row]));
  const readinessByGrace = new Map(readiness.filter(isBostonRound).map((row) => [skuKey(row.graceSku), row]));
  const renderByGrace = new Map(renderManifest.filter(isBostonRound).map((row) => [skuKey(row.graceSku), row]));

  const keys = new Set<string>();
  for (const row of catalog.filter(isBostonRound)) keys.add(skuKey(row.graceSku));
  for (const row of pipeline.filter(isBostonRound)) keys.add(skuKey(row.graceSku));
  for (const row of readiness.filter(isBostonRound)) keys.add(skuKey(row.graceSku));
  for (const row of renderManifest.filter(isBostonRound)) keys.add(skuKey(row.graceSku));
  keys.delete("");

  const renderRootExists = fs.existsSync(RENDER_ROOT);

  const rows = [...keys].sort().map((key): AuditRow => {
    const readinessRow = readinessByGrace.get(key);
    const pipelineRow = pipelineByGrace.get(key);
    const renderEntry = renderByGrace.get(key);
    const catalogRow =
      catalogByGrace.get(key) ??
      catalogByWebsite.get(skuKey(readinessRow?.websiteSku ?? pipelineRow?.websiteSku ?? renderEntry?.websiteSku));
    const localReferencePath =
      clean(readinessRow?.bestReferenceCandidatePath) ||
      clean(pipelineRow?.bestReferenceCandidatePath) ||
      clean(renderEntry?.currentReferencePath) ||
      clean(renderEntry?.proposedSourcePath) ||
      null;
    const catalogImageUrl = clean(catalogRow?.imageUrl) || null;

    const base = {
      graceSku: catalogRow?.graceSku ?? readinessRow?.graceSku ?? pipelineRow?.graceSku ?? renderEntry?.graceSku ?? key,
      websiteSku: catalogRow?.websiteSku ?? readinessRow?.websiteSku ?? pipelineRow?.websiteSku ?? renderEntry?.websiteSku ?? null,
      productId: catalogRow?.productId ?? readinessRow?.productId ?? pipelineRow?.productId ?? null,
      productGroupSlug: readinessRow?.productGroupSlug ?? pipelineRow?.productGroupSlug ?? renderEntry?.productGroupSlug ?? null,
      productGroupDisplayName: readinessRow?.productGroupDisplayName ?? pipelineRow?.productGroupDisplayName ?? null,
      family: catalogRow?.family ?? readinessRow?.family ?? pipelineRow?.family ?? renderEntry?.family ?? null,
      capacityMl:
        (catalogRow?.capacityMl == null ? null : String(catalogRow.capacityMl)) ??
        readinessRow?.capacityMl ??
        pipelineRow?.capacityMl ??
        null,
      applicator: catalogRow?.applicator ?? readinessRow?.applicator ?? pipelineRow?.applicator ?? null,
      color: catalogRow?.color ?? readinessRow?.color ?? pipelineRow?.canonicalColor ?? null,
      capStyle: catalogRow?.capStyle ?? readinessRow?.capStyle ?? null,
      capColor: catalogRow?.capColor ?? readinessRow?.capColor ?? null,
      catalogImageUrl,
      localReferencePath,
      renderManifestStatus: renderEntry?.status ?? null,
      renderManifestReason: renderEntry?.reason ?? null,
      matchedDiskFileCount: renderEntry?.matchedDiskFileCount ?? 0,
      duplicatePaths: renderEntry?.duplicatePaths ?? [],
      likelyLegacySearchUrl: null,
      expectedCanonicalFilename:
        readinessRow?.expectedCanonicalFilename ?? pipelineRow?.expectedCanonicalFilename ?? renderEntry?.proposedCanonicalFilename ?? null,
      nextAction: "",
    };
    const { disposition, nextAction } = chooseDisposition({
      graceSku: base.graceSku,
      localReferencePath,
      catalogImageUrl,
      renderEntry,
    });
    return {
      ...base,
      disposition,
      likelyLegacySearchUrl: likelySearchUrl(base),
      nextAction: renderRootExists ? nextAction : `${nextAction} Render root was not found at ${RENDER_ROOT}.`,
    };
  });

  const summary = {
    generatedAt: new Date().toISOString(),
    dryRun: true,
    renderRoot: RENDER_ROOT,
    renderRootExists,
    totalRows: rows.length,
    byDisposition: countBy(rows, (row) => row.disposition),
    byCapacityMl: countBy(rows, (row) => row.capacityMl ?? "unknown"),
    byApplicator: countBy(rows, (row) => row.applicator ?? "Bottle only"),
    withLocalReference: rows.filter((row) => row.localReferencePath).length,
    withCatalogImageUrl: rows.filter((row) => row.catalogImageUrl).length,
  };

  ensureParent(OUT_JSON);
  fs.writeFileSync(path.resolve(ROOT, OUT_JSON), `${JSON.stringify({ summary, rows }, null, 2)}\n`);

  const headers = [
    "disposition",
    "graceSku",
    "websiteSku",
    "productId",
    "productGroupSlug",
    "productGroupDisplayName",
    "capacityMl",
    "applicator",
    "color",
    "capStyle",
    "capColor",
    "catalogImageUrl",
    "localReferencePath",
    "renderManifestStatus",
    "matchedDiskFileCount",
    "likelyLegacySearchUrl",
    "expectedCanonicalFilename",
    "nextAction",
  ];
  ensureParent(OUT_CSV);
  fs.writeFileSync(
    path.resolve(ROOT, OUT_CSV),
    [headers.join(","), ...rows.map((row) => headers.map((header) => csvEscape(row[header as keyof AuditRow])).join(","))].join(
      "\n",
    ) + "\n",
  );

  const blockers = rows.filter((row) => row.disposition !== "ready_to_index");
  const report = [
    "# Best Bottles Boston Round Reference Audit",
    "",
    `Generated: ${summary.generatedAt}`,
    "",
    "Dry-run only. No files were downloaded, moved, renamed, uploaded, pushed to Shopify, or written to Convex.",
    "",
    "## Summary",
    "",
    `- Boston Round rows accounted for: ${summary.totalRows}`,
    `- Local reference images already indexed: ${summary.withLocalReference}`,
    `- Catalog rows with direct image URLs: ${summary.withCatalogImageUrl}`,
    `- Render root scanned: ${summary.renderRoot}`,
    "",
    "## By Disposition",
    "",
    markdownTable([["Disposition", "Count"], ...topCounts(summary.byDisposition).map(([key, count]) => [key, String(count)])]),
    "",
    "## By Applicator",
    "",
    markdownTable([["Applicator", "Count"], ...topCounts(summary.byApplicator).map(([key, count]) => [key, String(count)])]),
    "",
    "## By Capacity",
    "",
    markdownTable([["Capacity ml", "Count"], ...topCounts(summary.byCapacityMl).map(([key, count]) => [key, String(count)])]),
    "",
    "## Missing Source Preview",
    "",
    markdownTable([
      ["Disposition", "Grace SKU", "Website SKU", "Group", "Legacy Search", "Next Action"],
      ...blockers.slice(0, 80).map((row) => [
        row.disposition,
        row.graceSku ?? "",
        row.websiteSku ?? "",
        row.productGroupSlug ?? "",
        row.likelyLegacySearchUrl ?? "",
        row.nextAction,
      ]),
    ]),
    "",
    "## Recommended Next Step",
    "",
    "Build a legacy Boston Round scraper/downloader against the `likelyLegacySearchUrl` values, then write a second dry-run copy plan that renames approved source files into the `expectedCanonicalFilename` format.",
    "",
    `Full JSON: ${path.resolve(ROOT, OUT_JSON)}`,
    `Full CSV: ${path.resolve(ROOT, OUT_CSV)}`,
    "",
  ].join("\n");
  ensureParent(OUT_REPORT);
  fs.writeFileSync(path.resolve(ROOT, OUT_REPORT), report);

  console.log(`Boston Round audit rows: ${rows.length}`);
  for (const [disposition, count] of topCounts(summary.byDisposition)) console.log(`${disposition}: ${count}`);
  console.log(`Local references: ${summary.withLocalReference}`);
  console.log(`Catalog image URLs: ${summary.withCatalogImageUrl}`);
  console.log(`Report: ${path.resolve(ROOT, OUT_REPORT)}`);
}

main();
