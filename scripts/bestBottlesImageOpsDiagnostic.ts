#!/usr/bin/env tsx
import "dotenv/config";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { parseArgs } from "node:util";

import {
  findMissingReferenceMetadataColumns,
  summarizeImageOpsReadiness,
  type ImageOpsSkuJobRow,
} from "./bestBottlesImageOpsCore.ts";

const DEFAULT_BEST_BOTTLES_ORG_ID = "4ab1ac72-cd7e-4faf-9152-5aa5f2862411";

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

async function fetchSchemaColumns(supabase: SupabaseClient): Promise<string[]> {
  const { data, error } = await supabase
    .from("best_bottles_pipeline_sku_jobs")
    .select("*")
    .limit(1);
  if (error) throw error;
  return Object.keys((data?.[0] ?? {}) as Record<string, unknown>);
}

async function fetchSkuJobs(
  supabase: SupabaseClient,
  params: { organizationId: string; family?: string | null; productGroupSlug?: string | null },
): Promise<ImageOpsSkuJobRow[]> {
  const rows: ImageOpsSkuJobRow[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    let query = supabase
      .from("best_bottles_pipeline_sku_jobs")
      .select("*")
      .eq("organization_id", params.organizationId)
      .order("grace_sku", { ascending: true })
      .range(from, from + pageSize - 1);

    if (params.family) query = query.eq("family", params.family);
    if (params.productGroupSlug) query = query.eq("product_group_slug", params.productGroupSlug);

    const { data, error } = await query;
    if (error) throw error;
    const page = (data ?? []) as ImageOpsSkuJobRow[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

function compactRows(rows: ImageOpsSkuJobRow[]): Array<Record<string, unknown>> {
  return rows.map((row) => ({
    id: row.id,
    graceSku: row.grace_sku,
    websiteSku: row.website_sku,
    shopifySku: row.shopify_sku,
    family: row.family,
    productGroupSlug: row.product_group_slug,
    status: row.status,
    reference: row.best_reference_candidate_path,
    generatedImageUrl: row.generated_image_url,
    approvedImageUrl: row.approved_image_url,
    shopifyVariantId: row.shopify_variant_id,
    lastError: row.last_error,
  }));
}

function printHuman(summary: ReturnType<typeof summarizeImageOpsReadiness>, params: {
  organizationId: string;
  family: string | null;
  productGroupSlug: string | null;
}): void {
  console.log("Best Bottles image ops diagnostic");
  console.log(`organization: ${params.organizationId}`);
  console.log(`scope: ${[params.family, params.productGroupSlug].filter(Boolean).join(" / ") || "all"}`);
  console.log(`rows: ${summary.totalRows}`);
  console.log(`missing schema columns: ${summary.missingSchemaColumns.length}`);
  console.log(`stale queued/generating without flattened reference: ${summary.staleQueuedWithoutReference.length}`);
  console.log(`retired transparent/reference hits: ${summary.retiredReferenceHits.length}`);
  console.log(`duplicate SKU keys: ${summary.duplicateSkuKeys.length}`);
  console.log(`generated without URL: ${summary.generatedWithoutUrl.length}`);
  console.log(`approved without URL: ${summary.approvedWithoutUrl.length}`);
  console.log(`missing Shopify variant ID: ${summary.missingShopifyVariantId.length}`);

  const topStale = compactRows(summary.staleQueuedWithoutReference).slice(0, 10);
  if (topStale.length > 0) {
    console.log("\nstale queued sample:");
    console.log(JSON.stringify(topStale, null, 2));
  }
  const topRetired = compactRows(summary.retiredReferenceHits).slice(0, 10);
  if (topRetired.length > 0) {
    console.log("\nretired reference sample:");
    console.log(JSON.stringify(topRetired, null, 2));
  }
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      "organization-id": {
        type: "string",
        default: env("MADISON_BEST_BOTTLES_ORG_ID") || DEFAULT_BEST_BOTTLES_ORG_ID,
      },
      family: { type: "string", default: "Cylinder" },
      "product-group-slug": { type: "string" },
      json: { type: "boolean", default: false },
      strict: { type: "boolean", default: false },
    },
  });

  const supabase = getSupabase();
  const organizationId = values["organization-id"] as string;
  const family = values.family ? String(values.family) : null;
  const productGroupSlug = values["product-group-slug"] ? String(values["product-group-slug"]) : null;

  const [columns, rows] = await Promise.all([
    fetchSchemaColumns(supabase),
    fetchSkuJobs(supabase, { organizationId, family, productGroupSlug }),
  ]);
  const summary = summarizeImageOpsReadiness(rows, {
    missingSchemaColumns: findMissingReferenceMetadataColumns(columns),
  });

  if (values.json) {
    console.log(JSON.stringify({
      generatedAt: new Date().toISOString(),
      organizationId,
      family,
      productGroupSlug,
      summary: {
        totalRows: summary.totalRows,
        missingSchemaColumns: summary.missingSchemaColumns,
        staleQueuedWithoutReference: compactRows(summary.staleQueuedWithoutReference),
        retiredReferenceHits: compactRows(summary.retiredReferenceHits),
        duplicateSkuKeys: summary.duplicateSkuKeys,
        generatedWithoutUrl: compactRows(summary.generatedWithoutUrl),
        approvedWithoutUrl: compactRows(summary.approvedWithoutUrl),
        missingShopifyVariantIdCount: summary.missingShopifyVariantId.length,
      },
    }, null, 2));
  } else {
    printHuman(summary, { organizationId, family, productGroupSlug });
  }

  if (
    values.strict &&
    (
      summary.missingSchemaColumns.length > 0 ||
      summary.staleQueuedWithoutReference.length > 0 ||
      summary.retiredReferenceHits.length > 0 ||
      summary.duplicateSkuKeys.length > 0 ||
      summary.generatedWithoutUrl.length > 0 ||
      summary.approvedWithoutUrl.length > 0
    )
  ) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
