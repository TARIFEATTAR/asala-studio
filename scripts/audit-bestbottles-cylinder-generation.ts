import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import { createClient } from "@supabase/supabase-js";

import { getBestBottlesImageProvenance } from "../src/lib/bestBottlesImageProvenance";

type Disposition =
  | "already_live"
  | "ready_to_push"
  | "ready_to_review_existing_generation"
  | "ready_to_generate"
  | "ready_to_generate_pending_shopify_preflight"
  | "needs_reference"
  | "needs_canonical_copy_review"
  | "needs_shopify_mapping"
  | "legacy_catalog_only";

interface CatalogProduct {
  websiteSku: string | null;
  graceSku: string;
  productId: string | null;
  category: string | null;
  family: string | null;
  color: string | null;
  capacityMl: number | null;
  applicator: string | null;
  capStyle: string | null;
  capColor: string | null;
  stockStatus: string | null;
  productGroupId: string | null;
  itemName: string | null;
}

interface PipelineProduct {
  productGroupSlug: string;
  productGroupDisplayName: string;
  family: string | null;
  category: string | null;
  capacityMl: string | null;
  applicator: string | null;
  canonicalColor: string | null;
  graceSku: string;
  websiteSku: string | null;
  bestReferenceCandidatePath: string | null;
  generatedCandidateCount: number;
  reviewCandidateCount: number;
  shopifyReadyCount: number;
  hasConvexImageUrl: string | null;
  hasShopifyProductId: string | null;
  hasShopifyVariantId: string | null;
  shopifySku?: string | null;
}

interface ReadinessRow {
  status: string;
  issues: string[];
  graceSku: string;
  websiteSku: string | null;
  productGroupSlug: string;
  productGroupDisplayName: string;
  family: string | null;
  capacityMl: string | null;
  applicator: string | null;
  color: string | null;
  capStyle: string | null;
  capColor: string | null;
  hasReference: boolean;
  bestReferenceCandidatePath: string | null;
  generatedCandidateCount: number;
  reviewCandidateCount: number;
  shopifyReadyCount: number;
  hasConvexImageUrl: string | null;
}

interface RenderEntry {
  status: string;
  graceSku: string | null;
  websiteSku: string | null;
  family: string | null;
  proposedSourcePath: string | null;
  proposedCanonicalFilename: string | null;
  matchedDiskFileCount: number;
  reason: string;
  nextAction: string;
}

interface SupabaseSkuJob {
  grace_sku: string;
  website_sku: string | null;
  product_group_slug: string | null;
  product_group_display_name: string | null;
  family: string | null;
  capacity_ml: string | null;
  applicator: string | null;
  canonical_color: string | null;
  coverage_status: string | null;
  status: string | null;
  generated_image_id: string | null;
  generated_image_url: string | null;
  approved_image_id: string | null;
  approved_image_url: string | null;
  shopify_product_id: string | null;
  shopify_variant_id: string | null;
  shopify_media_id: string | null;
  shopify_image_url: string | null;
  shopify_pushed_at: string | null;
  convex_synced_at: string | null;
  last_error: string | null;
  shopify_sku: string | null;
}

interface GeneratedImageRow {
  id: string;
  image_url: string | null;
  session_name: string | null;
  goal_type: string | null;
  library_category: string | null;
  library_tags: string[] | null;
  reference_image_url: string | null;
  final_prompt: string | null;
  description: string | null;
  brand_context_used: unknown;
}

interface AuditRow {
  disposition: Disposition;
  graceSku: string;
  websiteSku: string | null;
  family: string | null;
  productGroupSlug: string | null;
  productGroupDisplayName: string | null;
  capacityMl: string | null;
  applicator: string | null;
  color: string | null;
  capStyle: string | null;
  capColor: string | null;
  catalogProductId: string | null;
  catalogStockStatus: string | null;
  presentInCatalog: boolean;
  presentInPipeline: boolean;
  presentInSupabase: boolean;
  hasReference: boolean;
  readinessStatus: string | null;
  readinessIssues: string[];
  renderStatus: string | null;
  proposedSourcePath: string | null;
  generatedCandidateCount: number;
  reviewCandidateCount: number;
  shopifyReadyCount: number;
  hasGeneratedImage: boolean;
  generatedImageId: string | null;
  generatedImageProvenanceKind: string | null;
  generatedImageProvenanceLabel: string | null;
  generatedImageIsRegenerated: boolean;
  generatedImageIsReferenceLike: boolean;
  hasApprovedImage: boolean;
  approvedImageId: string | null;
  approvedImageProvenanceKind: string | null;
  approvedImageProvenanceLabel: string | null;
  approvedImageIsRegenerated: boolean;
  approvedImageIsReferenceLike: boolean;
  hasShopifyProductId: boolean;
  hasShopifyVariantId: boolean;
  hasShopifyMediaId: boolean;
  hasShopifyCdnUrl: boolean;
  convexSynced: boolean;
  lastError: string | null;
  nextAction: string;
}

const ROOT = process.cwd();
const CYLINDER_FAMILIES = new Set(["Cylinder", "Tall Cylinder"]);
const DEFAULT_CATALOG = "public/data/best-bottles-catalog-lite.json";
const DEFAULT_PIPELINE = "public/data/best-bottles-madison-pipeline-ui.json";
const DEFAULT_READINESS = "tmp/best-bottles-generation-readiness.json";
const DEFAULT_RENDER_MANIFEST = "tmp/best-bottles-render-reconciliation-manifest.json";
const DEFAULT_OUT_JSON = "tmp/best-bottles-cylinder-generation-audit.json";
const DEFAULT_OUT_CSV = "tmp/best-bottles-cylinder-generation-audit.csv";
const DEFAULT_REPORT = "docs/best-bottles-cylinder-generation-audit.md";

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(path.resolve(ROOT, filePath), "utf8")) as T;
}

function readOptionalJson<T>(filePath: string, fallback: T): T {
  const absolutePath = path.resolve(ROOT, filePath);
  if (!fs.existsSync(absolutePath)) return fallback;
  return readJson<T>(filePath);
}

function ensureParent(filePath: string): void {
  fs.mkdirSync(path.dirname(path.resolve(ROOT, filePath)), { recursive: true });
}

function skuKey(value: string | null | undefined): string {
  return value?.trim().toUpperCase() ?? "";
}

function boolish(value: string | boolean | null | undefined): boolean {
  if (typeof value === "boolean") return value;
  return typeof value === "string" && ["yes", "true", "1"].includes(value.trim().toLowerCase());
}

function loadEnv(): void {
  for (const envFile of [".env.local", ".env"]) {
    const absolutePath = path.resolve(ROOT, envFile);
    if (!fs.existsSync(absolutePath)) continue;
    for (const rawLine of fs.readFileSync(absolutePath, "utf8").split(/\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const separator = line.indexOf("=");
      if (separator < 0) continue;
      const key = line.slice(0, separator);
      const value = line.slice(separator + 1).replace(/^['"]|['"]$/g, "");
      if (!process.env[key]) process.env[key] = value;
    }
  }
}

async function fetchSupabaseCylinderRows(): Promise<SupabaseSkuJob[]> {
  loadEnv();
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return [];

  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const allRows: SupabaseSkuJob[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from("best_bottles_pipeline_sku_jobs")
      .select(
        [
          "grace_sku",
          "website_sku",
          "product_group_slug",
          "product_group_display_name",
          "family",
          "capacity_ml",
          "applicator",
          "canonical_color",
          "coverage_status",
          "status",
          "generated_image_id",
          "generated_image_url",
          "approved_image_id",
          "approved_image_url",
          "shopify_product_id",
          "shopify_variant_id",
          "shopify_media_id",
          "shopify_image_url",
          "shopify_pushed_at",
          "convex_synced_at",
          "last_error",
          "shopify_sku",
        ].join(","),
      )
      .in("family", Array.from(CYLINDER_FAMILIES))
      .range(from, to);

    if (error) throw new Error(`Supabase audit query failed: ${error.message}`);
    allRows.push(...((data ?? []) as SupabaseSkuJob[]));
    if (!data || data.length < pageSize) break;
  }
  return allRows;
}

async function fetchGeneratedImageRows(ids: string[]): Promise<Map<string, GeneratedImageRow>> {
  loadEnv();
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return new Map();

  const uniqueIds = Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
  if (uniqueIds.length === 0) return new Map();

  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const rows: GeneratedImageRow[] = [];
  for (let i = 0; i < uniqueIds.length; i += 100) {
    const chunk = uniqueIds.slice(i, i + 100);
    const { data, error } = await supabase
      .from("generated_images")
      .select(
        "id,image_url,session_name,goal_type,library_category,library_tags,reference_image_url,final_prompt,description,brand_context_used",
      )
      .in("id", chunk);
    if (error) throw new Error(`Generated image provenance query failed: ${error.message}`);
    rows.push(...((data ?? []) as GeneratedImageRow[]));
  }

  return new Map(rows.map((row) => [row.id, row]));
}

function imageProvenance(row: GeneratedImageRow | null | undefined) {
  if (!row) return null;
  return getBestBottlesImageProvenance({
    imageUrl: row.image_url,
    sessionName: row.session_name,
    goalType: row.goal_type,
    libraryCategory: row.library_category,
    libraryTags: row.library_tags,
    referenceImageUrl: row.reference_image_url,
    finalPrompt: row.final_prompt,
    description: row.description,
    brandContextUsed: row.brand_context_used,
  });
}

function determineDisposition(row: Omit<AuditRow, "disposition" | "nextAction">): {
  disposition: Disposition;
  nextAction: string;
} {
  if (!row.presentInPipeline && !row.presentInSupabase && !row.catalogProductId) {
    return {
      disposition: "legacy_catalog_only",
      nextAction:
        "Do not include in bulk generation yet. This is a legacy catalog-only Cylinder SKU without a product id or Madison pipeline row.",
    };
  }
  if (row.hasShopifyCdnUrl && row.convexSynced) {
    return {
      disposition: "already_live",
      nextAction: "No generation needed. Spot-check Best Bottles UI if this product family is part of the launch set.",
    };
  }
  if (row.hasApprovedImage && !row.hasShopifyCdnUrl) {
    return {
      disposition: "ready_to_push",
      nextAction: "Approved image exists. Push this SKU to Shopify, then reconcile Convex from the returned Shopify CDN URL.",
    };
  }
  if (row.generatedCandidateCount > 0 || row.reviewCandidateCount > 0 || row.shopifyReadyCount > 0 || row.hasGeneratedImage) {
    return {
      disposition: "ready_to_review_existing_generation",
      nextAction: "Review/approve the existing generated candidate before generating a replacement.",
    };
  }
  if (row.renderStatus === "possible_duplicate") {
    return {
      disposition: "needs_canonical_copy_review",
      nextAction:
        "Review duplicate disk renders and choose the canonical source before indexing or generating against this SKU.",
    };
  }
  if (!row.hasReference || row.readinessStatus === "needs-reference" || row.renderStatus === "missing_source_image") {
    return {
      disposition: "needs_reference",
      nextAction:
        "Find or create the missing reference/source image before placing this SKU into the mass-generation queue.",
    };
  }
  if (!row.hasShopifyProductId || !row.hasShopifyVariantId) {
    return {
      disposition: "ready_to_generate_pending_shopify_preflight",
      nextAction:
        "Reference coverage exists, so this can enter generation. Before bulk push, run Shopify SKU preflight/backfill so product/variant ids are cached instead of relying only on runtime SKU lookup.",
    };
  }
  return {
    disposition: "ready_to_generate",
    nextAction:
      "Ready for Cylinder family generation. Generate in grouped batches by capacity/applicator/finish to preserve framing consistency.",
  };
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

function topCounts<T extends string>(counts: Record<T, number>, limit = 20): [T, number][] {
  return Object.entries(counts).sort((a, b) => Number(b[1]) - Number(a[1]) || a[0].localeCompare(b[0])) as [T, number][];
}

function markdownTable(rows: string[][]): string {
  if (rows.length === 0) return "";
  const widths = rows[0].map((_, col) => Math.max(...rows.map((row) => row[col]?.length ?? 0)));
  const format = (row: string[]) => `| ${row.map((cell, col) => cell.padEnd(widths[col])).join(" | ")} |`;
  return [format(rows[0]), format(widths.map((width) => "-".repeat(Math.max(width, 3)))), ...rows.slice(1).map(format)].join("\n");
}

function writeOutputs(rows: AuditRow[], outJson: string, outCsv: string, report: string): void {
  const alreadyLiveRows = rows.filter((row) => row.disposition === "already_live");
  const readyToPushRows = rows.filter((row) => row.disposition === "ready_to_push");
  const summary = {
    totalRows: rows.length,
    byDisposition: countBy(rows, (row) => row.disposition),
    byFamily: countBy(rows, (row) => row.family),
    byCapacityMl: countBy(rows, (row) => row.capacityMl),
    byApplicator: countBy(rows, (row) => row.applicator ?? "Bottle only"),
    byApprovedImageProvenance: countBy(rows, (row) => row.approvedImageProvenanceLabel ?? "No approved image"),
    alreadyLiveRegenerated: alreadyLiveRows.filter((row) => row.approvedImageIsRegenerated).length,
    alreadyLiveReferenceLike: alreadyLiveRows.filter((row) => row.approvedImageIsReferenceLike).length,
    alreadyLiveUnknownProvenance: alreadyLiveRows.filter(
      (row) => row.hasApprovedImage && !row.approvedImageIsRegenerated && !row.approvedImageIsReferenceLike,
    ).length,
    readyToPushRegenerated: readyToPushRows.filter((row) => row.approvedImageIsRegenerated).length,
    readyToPushReferenceLike: readyToPushRows.filter((row) => row.approvedImageIsReferenceLike).length,
    readyToPushUnknownProvenance: readyToPushRows.filter(
      (row) => row.hasApprovedImage && !row.approvedImageIsRegenerated && !row.approvedImageIsReferenceLike,
    ).length,
  };

  ensureParent(outJson);
  fs.writeFileSync(
    path.resolve(ROOT, outJson),
    `${JSON.stringify({ generatedAt: new Date().toISOString(), dryRun: true, summary, rows }, null, 2)}\n`,
  );

  const csvHeaders = [
    "disposition",
    "graceSku",
    "websiteSku",
    "family",
    "productGroupSlug",
    "capacityMl",
    "applicator",
    "color",
    "capStyle",
    "capColor",
    "presentInPipeline",
    "presentInSupabase",
    "hasReference",
    "readinessStatus",
    "renderStatus",
    "generatedCandidateCount",
    "reviewCandidateCount",
    "shopifyReadyCount",
    "hasApprovedImage",
    "approvedImageId",
    "approvedImageProvenanceKind",
    "approvedImageProvenanceLabel",
    "approvedImageIsRegenerated",
    "approvedImageIsReferenceLike",
    "generatedImageId",
    "generatedImageProvenanceKind",
    "generatedImageProvenanceLabel",
    "generatedImageIsRegenerated",
    "generatedImageIsReferenceLike",
    "hasShopifyVariantId",
    "hasShopifyCdnUrl",
    "convexSynced",
    "nextAction",
  ];
  ensureParent(outCsv);
  fs.writeFileSync(
    path.resolve(ROOT, outCsv),
    [
      csvHeaders.join(","),
      ...rows.map((row) => csvHeaders.map((header) => csvEscape(row[header as keyof AuditRow])).join(",")),
    ].join("\n") + "\n",
  );

  const dispositionRows = topCounts(summary.byDisposition as Record<string, number>).map(([key, count]) => [
    key,
    String(count),
  ]);
  const applicatorRows = topCounts(summary.byApplicator as Record<string, number>).map(([key, count]) => [
    key,
    String(count),
  ]);
  const capacityRows = topCounts(summary.byCapacityMl as Record<string, number>).map(([key, count]) => [
    key,
    String(count),
  ]);
  const blockers = rows.filter((row) =>
    ["needs_reference", "needs_canonical_copy_review", "needs_shopify_mapping", "legacy_catalog_only"].includes(
      row.disposition,
    ),
  );
  const ready = rows.filter((row) =>
    ["ready_to_generate", "ready_to_generate_pending_shopify_preflight", "ready_to_push"].includes(row.disposition),
  );

  const reportBody = [
    "# Best Bottles Cylinder Generation Audit",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "Dry-run only. No files were moved and no Shopify/Convex writes were made.",
    "",
    "## Summary",
    "",
    `- Total Cylinder/Tall Cylinder rows accounted for: ${rows.length}`,
    `- Already live in Shopify + Convex: ${summary.byDisposition.already_live ?? 0}`,
    `- Already live and confirmed regenerated output: ${summary.alreadyLiveRegenerated}`,
    `- Already live but approved image is reference/keeper import: ${summary.alreadyLiveReferenceLike}`,
    `- Already live with unknown approved-image provenance: ${summary.alreadyLiveUnknownProvenance}`,
    `- Ready to generate now: ${summary.byDisposition.ready_to_generate ?? 0}`,
    `- Ready to generate after Shopify SKU preflight/backfill: ${summary.byDisposition.ready_to_generate_pending_shopify_preflight ?? 0}`,
    `- Approved and ready to push: ${summary.byDisposition.ready_to_push ?? 0}`,
    `- Approved and ready to push from regenerated output: ${summary.readyToPushRegenerated}`,
    `- Approved and ready to push from reference/keeper import: ${summary.readyToPushReferenceLike}`,
    `- Approved and ready to push with unknown provenance: ${summary.readyToPushUnknownProvenance}`,
    `- Existing generation needs review: ${summary.byDisposition.ready_to_review_existing_generation ?? 0}`,
    `- Needs reference/source cleanup: ${(summary.byDisposition.needs_reference ?? 0) + (summary.byDisposition.needs_canonical_copy_review ?? 0)}`,
    `- Needs Shopify mapping before any safe push: ${summary.byDisposition.needs_shopify_mapping ?? 0}`,
    `- Legacy catalog-only rows excluded from bulk generation: ${summary.byDisposition.legacy_catalog_only ?? 0}`,
    "",
    "## By Disposition",
    "",
    markdownTable([["Disposition", "Count"], ...dispositionRows]),
    "",
    "## By Applicator",
    "",
    markdownTable([["Applicator", "Count"], ...applicatorRows]),
    "",
    "## By Capacity",
    "",
    markdownTable([["Capacity ml", "Count"], ...capacityRows]),
    "",
    "## Ready Queue Preview",
    "",
    markdownTable([
      ["Disposition", "Grace SKU", "Website SKU", "Group", "Next Action"],
      ...ready.slice(0, 40).map((row) => [
        row.disposition,
        row.graceSku,
        row.websiteSku ?? "",
        row.productGroupSlug ?? "",
        row.nextAction,
      ]),
    ]),
    "",
    "## Blocker Preview",
    "",
    markdownTable([
      ["Disposition", "Grace SKU", "Website SKU", "Group", "Reason / Next Action"],
      ...blockers.slice(0, 80).map((row) => [
        row.disposition,
        row.graceSku,
        row.websiteSku ?? "",
        row.productGroupSlug ?? "",
        row.nextAction,
      ]),
    ]),
    "",
    "## Recommended Batch Order",
    "",
    "1. Exclude `legacy_catalog_only` rows unless Best Bottles confirms they should be imported as active products.",
    "2. Run Shopify SKU preflight/backfill for `ready_to_generate_pending_shopify_preflight`; these can be generated, but cached product/variant ids should be resolved before bulk push.",
    "3. Review `needs_canonical_copy_review` duplicates and pick the canonical source.",
    "4. Generate ready rows by product group, then by capacity and applicator, so baseline and zoom stay consistent.",
    "5. Push in small Shopify batches and let the automatic Convex reconcile step verify CDN URLs before the next group.",
    "",
    `Full JSON: ${path.resolve(ROOT, outJson)}`,
    `Full CSV: ${path.resolve(ROOT, outCsv)}`,
    "",
  ].join("\n");

  ensureParent(report);
  fs.writeFileSync(path.resolve(ROOT, report), reportBody);
}

async function main(): Promise<void> {
  const catalog = readJson<{ products?: CatalogProduct[] }>(DEFAULT_CATALOG).products ?? [];
  const pipeline = readJson<{ products?: PipelineProduct[] }>(DEFAULT_PIPELINE).products ?? [];
  const readiness = readOptionalJson<{ rows?: ReadinessRow[] }>(DEFAULT_READINESS, { rows: [] }).rows ?? [];
  const renderManifest = readOptionalJson<{ entries?: RenderEntry[] }>(DEFAULT_RENDER_MANIFEST, { entries: [] }).entries ?? [];
  const supabaseRows = await fetchSupabaseCylinderRows();
  const imageIds = supabaseRows.flatMap((row) => [
    row.generated_image_id,
    row.approved_image_id,
  ]).filter((id): id is string => Boolean(id));
  const generatedImagesById = await fetchGeneratedImageRows(imageIds);

  const catalogBySku = new Map(catalog.map((row) => [skuKey(row.graceSku), row]));
  const pipelineBySku = new Map(pipeline.map((row) => [skuKey(row.graceSku), row]));
  const readinessBySku = new Map(readiness.map((row) => [skuKey(row.graceSku), row]));
  const renderBySku = new Map(renderManifest.filter((row) => row.graceSku).map((row) => [skuKey(row.graceSku), row]));
  const supabaseBySku = new Map(supabaseRows.map((row) => [skuKey(row.grace_sku), row]));

  const skuKeys = new Set<string>();
  for (const row of catalog) {
    if (CYLINDER_FAMILIES.has(row.family ?? "")) skuKeys.add(skuKey(row.graceSku));
  }
  for (const row of pipeline) {
    if (CYLINDER_FAMILIES.has(row.family ?? "")) skuKeys.add(skuKey(row.graceSku));
  }
  for (const row of supabaseRows) skuKeys.add(skuKey(row.grace_sku));

  const rows: AuditRow[] = [];
  for (const key of [...skuKeys].sort()) {
    const catalogRow = catalogBySku.get(key);
    const pipelineRow = pipelineBySku.get(key);
    const readinessRow = readinessBySku.get(key);
    const renderRow = renderBySku.get(key);
    const supabaseRow = supabaseBySku.get(key);
    const generatedImageId = supabaseRow?.generated_image_id ?? null;
    const approvedImageId = supabaseRow?.approved_image_id ?? null;
    const generatedImageProvenance = imageProvenance(
      generatedImageId ? generatedImagesById.get(generatedImageId) : null,
    );
    const approvedImageProvenance = imageProvenance(
      approvedImageId ? generatedImagesById.get(approvedImageId) : null,
    );

    const base = {
      graceSku: catalogRow?.graceSku ?? pipelineRow?.graceSku ?? supabaseRow?.grace_sku ?? key,
      websiteSku: catalogRow?.websiteSku ?? pipelineRow?.websiteSku ?? supabaseRow?.website_sku ?? null,
      family: catalogRow?.family ?? pipelineRow?.family ?? supabaseRow?.family ?? null,
      productGroupSlug: pipelineRow?.productGroupSlug ?? supabaseRow?.product_group_slug ?? readinessRow?.productGroupSlug ?? null,
      productGroupDisplayName:
        pipelineRow?.productGroupDisplayName ??
        supabaseRow?.product_group_display_name ??
        readinessRow?.productGroupDisplayName ??
        null,
      capacityMl:
        (catalogRow?.capacityMl == null ? null : String(catalogRow.capacityMl)) ??
        pipelineRow?.capacityMl ??
        supabaseRow?.capacity_ml ??
        readinessRow?.capacityMl ??
        null,
      applicator: catalogRow?.applicator ?? pipelineRow?.applicator ?? supabaseRow?.applicator ?? readinessRow?.applicator ?? null,
      color: catalogRow?.color ?? pipelineRow?.canonicalColor ?? supabaseRow?.canonical_color ?? readinessRow?.color ?? null,
      capStyle: catalogRow?.capStyle ?? readinessRow?.capStyle ?? null,
      capColor: catalogRow?.capColor ?? readinessRow?.capColor ?? null,
      catalogProductId: catalogRow?.productId ?? null,
      catalogStockStatus: catalogRow?.stockStatus ?? null,
      presentInCatalog: Boolean(catalogRow),
      presentInPipeline: Boolean(pipelineRow),
      presentInSupabase: Boolean(supabaseRow),
      hasReference: Boolean(
        readinessRow?.hasReference ||
          pipelineRow?.bestReferenceCandidatePath ||
          supabaseRow?.coverage_status === "covered_needs_canonical_copy",
      ),
      readinessStatus: readinessRow?.status ?? null,
      readinessIssues: readinessRow?.issues ?? [],
      renderStatus: renderRow?.status ?? null,
      proposedSourcePath: renderRow?.proposedSourcePath ?? null,
      generatedCandidateCount:
        readinessRow?.generatedCandidateCount ?? pipelineRow?.generatedCandidateCount ?? (supabaseRow?.generated_image_url ? 1 : 0),
      reviewCandidateCount: readinessRow?.reviewCandidateCount ?? pipelineRow?.reviewCandidateCount ?? 0,
      shopifyReadyCount: readinessRow?.shopifyReadyCount ?? pipelineRow?.shopifyReadyCount ?? 0,
      hasGeneratedImage: Boolean(supabaseRow?.generated_image_url),
      generatedImageId,
      generatedImageProvenanceKind: generatedImageProvenance?.kind ?? null,
      generatedImageProvenanceLabel: generatedImageProvenance?.label ?? null,
      generatedImageIsRegenerated: generatedImageProvenance?.isRegeneratedOutput ?? false,
      generatedImageIsReferenceLike: generatedImageProvenance?.isReferenceLike ?? false,
      hasApprovedImage: Boolean(supabaseRow?.approved_image_url),
      approvedImageId,
      approvedImageProvenanceKind: approvedImageProvenance?.kind ?? null,
      approvedImageProvenanceLabel: approvedImageProvenance?.label ?? null,
      approvedImageIsRegenerated: approvedImageProvenance?.isRegeneratedOutput ?? false,
      approvedImageIsReferenceLike: approvedImageProvenance?.isReferenceLike ?? false,
      hasShopifyProductId: Boolean(
        supabaseRow?.shopify_product_id || boolish(pipelineRow?.hasShopifyProductId),
      ),
      hasShopifyVariantId: Boolean(
        supabaseRow?.shopify_variant_id || boolish(pipelineRow?.hasShopifyVariantId),
      ),
      hasShopifyMediaId: Boolean(supabaseRow?.shopify_media_id),
      hasShopifyCdnUrl: Boolean(supabaseRow?.shopify_image_url),
      convexSynced: Boolean(supabaseRow?.convex_synced_at),
      lastError: supabaseRow?.last_error ?? null,
    };

    const { disposition, nextAction } = determineDisposition(base);
    rows.push({ disposition, nextAction, ...base });
  }

  writeOutputs(rows, DEFAULT_OUT_JSON, DEFAULT_OUT_CSV, DEFAULT_REPORT);

  const counts = countBy(rows, (row) => row.disposition);
  console.log(`Cylinder audit rows: ${rows.length}`);
  for (const [disposition, count] of topCounts(counts)) {
    console.log(`${disposition}: ${count}`);
  }
  const generatedLive = rows.filter(
    (row) => row.disposition === "already_live" && row.approvedImageIsRegenerated,
  ).length;
  const unknownLive = rows.filter(
    (row) =>
      row.disposition === "already_live" &&
      row.hasApprovedImage &&
      !row.approvedImageIsRegenerated &&
      !row.approvedImageIsReferenceLike,
  ).length;
  const referenceReadyToPush = rows.filter(
    (row) => row.disposition === "ready_to_push" && row.approvedImageIsReferenceLike,
  ).length;
  console.log(`already_live_regenerated: ${generatedLive}`);
  console.log(`already_live_unknown_provenance: ${unknownLive}`);
  console.log(`ready_to_push_reference_or_keeper: ${referenceReadyToPush}`);
  console.log(`Report: ${path.resolve(ROOT, DEFAULT_REPORT)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
