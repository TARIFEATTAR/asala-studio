#!/usr/bin/env tsx
import "dotenv/config";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";

import {
  buildShopifyPublishPreflightRows,
  deriveLegacyMediaCleanupDisposition,
  type ShopifyPublishPreflightPushItem,
  type ShopifyPublishPreflightSkuJobRow,
} from "./bestBottlesShopifyPublishPreflightCore.ts";

const DEFAULT_BEST_BOTTLES_ORG_ID = "4ab1ac72-cd7e-4faf-9152-5aa5f2862411";
const DEFAULT_OUT_JSON = "tmp/bb-shopify-publish-preflight.json";
const DEFAULT_OUT_CSV = "tmp/bb-shopify-publish-preflight.csv";
const EDGE_BATCH_LIMIT = 50;

type GeneratedImageTagRow = {
  id: string;
  library_tags: string[] | null;
};

type EdgeDryRunResult = {
  imageId?: string | null;
  sku?: string | null;
  status?: string | null;
  message?: string | null;
  matchedShopifySku?: string | null;
  actualShopifySku?: string | null;
  shopifyProductId?: string | null;
  shopifyVariantId?: string | null;
  productTitle?: string | null;
  productHandle?: string | null;
  variantTitle?: string | null;
  existingVariantMedia?: Array<{ id?: string | null; alt?: string | null; imageUrl?: string | null }>;
  legacyMediaCleanupDisposition?: string | null;
};

type ReportRow = {
  id: string;
  graceSku: string;
  websiteSku: string;
  shopifySku: string;
  family: string;
  productGroupSlug: string;
  productGroupDisplayName: string;
  preflightStatus: "eligible" | "blocked";
  approvalStatus: string | null;
  blockReasons: string[];
  dryRunStatus: string | null;
  dryRunMessage: string | null;
  matchedShopifySku: string | null;
  actualShopifySku: string | null;
  shopifyProductId: string | null;
  shopifyVariantId: string | null;
  productTitle: string | null;
  productHandle: string | null;
  variantTitle: string | null;
  existingVariantMediaCount: number;
  legacyMediaCleanupDisposition: string;
  backfillApplied: boolean;
};

function env(name: string): string {
  return String(process.env[name] ?? "").trim();
}

function getSupabase(): SupabaseClient {
  const url = env("SUPABASE_URL") || env("VITE_SUPABASE_URL");
  const serviceRoleKey = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRoleKey) {
    throw new Error("SUPABASE_URL/VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  }
  return createClient(url, serviceRoleKey, { auth: { persistSession: false } });
}

function csvEscape(value: unknown): string {
  const text = value == null ? "" : String(value);
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function normalizedSku(value: unknown): string {
  return String(value ?? "").trim().toUpperCase();
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function parseSkuFilter(value: unknown): Set<string> {
  return new Set(
    String(value ?? "")
      .split(",")
      .map((sku) => normalizedSku(sku))
      .filter(Boolean),
  );
}

async function fetchSkuJobs(
  supabase: SupabaseClient,
  params: {
    organizationId: string;
    family?: string | null;
    productGroupSlug?: string | null;
    skuFilter?: Set<string>;
  },
): Promise<ShopifyPublishPreflightSkuJobRow[]> {
  const rows: ShopifyPublishPreflightSkuJobRow[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    let query = supabase
      .from("best_bottles_pipeline_sku_jobs")
      .select(
        [
          "id",
          "product_group_slug",
          "product_group_display_name",
          "family",
          "category",
          "capacity_ml",
          "applicator",
          "canonical_color",
          "grace_sku",
          "website_sku",
          "shopify_sku",
          "status",
          "approved_image_id",
          "approved_image_url",
          "generated_image_id",
          "generated_image_url",
          "shopify_product_id",
          "shopify_variant_id",
          "shopify_media_id",
          "shopify_image_url",
          "shopify_pushed_at",
          "convex_synced_at",
          "last_error",
        ].join(","),
      )
      .eq("organization_id", params.organizationId)
      .order("grace_sku", { ascending: true })
      .range(from, from + pageSize - 1);

    if (params.family) query = query.eq("family", params.family);
    if (params.productGroupSlug) query = query.eq("product_group_slug", params.productGroupSlug);

    const { data, error } = await query;
    if (error) throw error;
    const page = (data ?? []) as ShopifyPublishPreflightSkuJobRow[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }

  if (!params.skuFilter || params.skuFilter.size === 0) return rows;
  return rows.filter((row) =>
    [row.grace_sku, row.website_sku, row.shopify_sku]
      .map(normalizedSku)
      .some((sku) => params.skuFilter?.has(sku)),
  );
}

async function fetchImageTagsById(
  supabase: SupabaseClient,
  imageIds: string[],
): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  const uniqueIds = Array.from(new Set(imageIds.map((id) => id.trim()).filter(Boolean)));
  for (const ids of chunk(uniqueIds, 1000)) {
    const { data, error } = await supabase
      .from("generated_images")
      .select("id, library_tags")
      .in("id", ids);
    if (error) throw error;
    for (const row of (data ?? []) as GeneratedImageTagRow[]) {
      out.set(row.id, row.library_tags ?? []);
    }
  }
  return out;
}

async function invokeShopifyDryRun(
  supabase: SupabaseClient,
  params: {
    organizationId: string;
    pushItems: ShopifyPublishPreflightPushItem[];
    includeExistingVariantMedia: boolean;
  },
): Promise<EdgeDryRunResult[]> {
  const results: EdgeDryRunResult[] = [];
  for (const items of chunk(params.pushItems, EDGE_BATCH_LIMIT)) {
    const { data, error } = await supabase.functions.invoke("push-shopify-product-images", {
      body: {
        organizationId: params.organizationId,
        items,
        attachToVariant: true,
        syncBestBottlesConvex: true,
        enforceBestBottlesFinishMatch: true,
        dryRun: true,
        includeExistingVariantMedia: params.includeExistingVariantMedia,
      },
    });
    if (error) throw error;
    if (data?.error) throw new Error(String(data.error));
    const batchResults = Array.isArray(data?.results) ? data.results as EdgeDryRunResult[] : [];
    results.push(...batchResults);
  }
  return results;
}

async function applyVariantIdBackfill(
  supabase: SupabaseClient,
  params: {
    organizationId: string;
    rows: ReportRow[];
  },
): Promise<Set<string>> {
  const applied = new Set<string>();
  for (const row of params.rows) {
    if (
      row.preflightStatus !== "eligible" ||
      row.dryRunStatus !== "dry-run" ||
      !row.shopifyProductId ||
      !row.shopifyVariantId
    ) {
      continue;
    }

    const { error } = await supabase
      .from("best_bottles_pipeline_sku_jobs")
      .update({
        shopify_product_id: row.shopifyProductId,
        shopify_variant_id: row.shopifyVariantId,
        shopify_sku: row.actualShopifySku || row.matchedShopifySku || row.shopifySku,
        last_error: null,
      })
      .eq("organization_id", params.organizationId)
      .eq("id", row.id)
      .eq("status", "approved");
    if (error) throw error;
    applied.add(row.id);
  }
  return applied;
}

function buildReportRows(
  preflight: ReturnType<typeof buildShopifyPublishPreflightRows>,
  dryRunResults: EdgeDryRunResult[],
): ReportRow[] {
  const resultBySku = new Map<string, EdgeDryRunResult>();
  for (const result of dryRunResults) {
    const key = normalizedSku(result.sku);
    if (key) resultBySku.set(key, result);
  }

  return preflight.rows.map((row) => {
    const result = row.pushItem ? resultBySku.get(normalizedSku(row.pushItem.sku)) ?? null : null;
    const existingVariantMediaCount = result?.existingVariantMedia?.length ?? 0;
    const legacyMediaCleanupDisposition =
      result?.legacyMediaCleanupDisposition ??
      deriveLegacyMediaCleanupDisposition({
        eligibleForPush: row.status === "eligible",
        dryRunStatus: result?.status ?? (row.status === "eligible" ? "not-run" : "blocked"),
        existingVariantMediaCount,
      });

    return {
      id: row.id,
      graceSku: row.graceSku,
      websiteSku: row.websiteSku,
      shopifySku: row.shopifySku,
      family: row.family,
      productGroupSlug: row.productGroupSlug,
      productGroupDisplayName: row.productGroupDisplayName,
      preflightStatus: row.status,
      approvalStatus: row.approvalStatus,
      blockReasons: row.blockReasons,
      dryRunStatus: result?.status ?? null,
      dryRunMessage: result?.message ?? null,
      matchedShopifySku: result?.matchedShopifySku ?? null,
      actualShopifySku: result?.actualShopifySku ?? null,
      shopifyProductId: result?.shopifyProductId ?? null,
      shopifyVariantId: result?.shopifyVariantId ?? null,
      productTitle: result?.productTitle ?? null,
      productHandle: result?.productHandle ?? null,
      variantTitle: result?.variantTitle ?? null,
      existingVariantMediaCount,
      legacyMediaCleanupDisposition,
      backfillApplied: false,
    };
  });
}

function writeCsv(filePath: string, rows: ReportRow[]): void {
  const headers = [
    "preflightStatus",
    "dryRunStatus",
    "graceSku",
    "websiteSku",
    "shopifySku",
    "matchedShopifySku",
    "actualShopifySku",
    "shopifyProductId",
    "shopifyVariantId",
    "family",
    "productGroupSlug",
    "approvalStatus",
    "blockReasons",
    "dryRunMessage",
    "existingVariantMediaCount",
    "legacyMediaCleanupDisposition",
    "backfillApplied",
  ];
  const lines = [
    headers.join(","),
    ...rows.map((row) =>
      headers.map((header) => {
        const value = row[header as keyof ReportRow];
        return csvEscape(Array.isArray(value) ? value.join("|") : value);
      }).join(","),
    ),
  ];
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${lines.join("\n")}\n`);
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      "organization-id": {
        type: "string",
        default: env("MADISON_BEST_BOTTLES_ORG_ID") || DEFAULT_BEST_BOTTLES_ORG_ID,
      },
      family: { type: "string" },
      "product-group-slug": { type: "string" },
      sku: { type: "string" },
      "out-json": { type: "string", default: DEFAULT_OUT_JSON },
      "out-csv": { type: "string", default: DEFAULT_OUT_CSV },
      "skip-edge-dry-run": { type: "boolean", default: false },
      "include-existing-variant-media": { type: "boolean", default: true },
      "apply-backfill-ids": { type: "boolean", default: false },
    },
  });

  const supabase = getSupabase();
  const organizationId = String(values["organization-id"]);
  const jobs = await fetchSkuJobs(supabase, {
    organizationId,
    family: values.family ? String(values.family) : null,
    productGroupSlug: values["product-group-slug"] ? String(values["product-group-slug"]) : null,
    skuFilter: parseSkuFilter(values.sku),
  });
  const imageIds = jobs.flatMap((job) => [job.approved_image_id, job.generated_image_id])
    .map((id) => id?.trim() ?? "")
    .filter(Boolean);
  const imageTagsById = await fetchImageTagsById(supabase, imageIds);
  const preflight = buildShopifyPublishPreflightRows({ jobs, imageTagsById });

  const dryRunResults = values["skip-edge-dry-run"] || preflight.pushItems.length === 0
    ? []
    : await invokeShopifyDryRun(supabase, {
        organizationId,
        pushItems: preflight.pushItems,
        includeExistingVariantMedia: values["include-existing-variant-media"] !== false,
      });
  const rows = buildReportRows(preflight, dryRunResults);
  const appliedBackfills = values["apply-backfill-ids"]
    ? await applyVariantIdBackfill(supabase, { organizationId, rows })
    : new Set<string>();
  for (const row of rows) {
    row.backfillApplied = appliedBackfills.has(row.id);
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    organizationId,
    family: values.family ?? null,
    productGroupSlug: values["product-group-slug"] ?? null,
    skuFilter: values.sku ?? null,
    totalRows: preflight.summary.totalRows,
    eligible: preflight.summary.eligible,
    blocked: preflight.summary.blocked,
    duplicateSkuKeys: preflight.summary.duplicateSkuKeys,
    edgeDryRunRequested: !values["skip-edge-dry-run"] && preflight.pushItems.length > 0,
    edgeDryRunResults: dryRunResults.length,
    edgeDryRunSuccess: dryRunResults.filter((result) => result.status === "dry-run").length,
    edgeDryRunFailed: dryRunResults.filter((result) => result.status !== "dry-run").length,
    existingVariantMediaRows: rows.filter((row) => row.existingVariantMediaCount > 0).length,
    detachAfterSuccessfulReplacement: rows.filter(
      (row) => row.legacyMediaCleanupDisposition === "detach-after-successful-replacement",
    ).length,
    backfillApplied: appliedBackfills.size,
    outputs: {
      json: resolve(String(values["out-json"])),
      csv: resolve(String(values["out-csv"])),
    },
  };

  const payload = {
    ...summary,
    duplicateSkuKeyRows: preflight.duplicateSkuKeys,
    rows,
  };
  const outJson = resolve(String(values["out-json"]));
  const outCsv = resolve(String(values["out-csv"]));
  mkdirSync(dirname(outJson), { recursive: true });
  writeFileSync(outJson, `${JSON.stringify(payload, null, 2)}\n`);
  writeCsv(outCsv, rows);
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
