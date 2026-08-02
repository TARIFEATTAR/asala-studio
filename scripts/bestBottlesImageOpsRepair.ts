#!/usr/bin/env tsx
import "dotenv/config";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { parseArgs } from "node:util";

import {
  findStaleQueuedWithoutReferenceRows,
  type ImageOpsSkuJobRow,
} from "./bestBottlesImageOpsCore.ts";

const DEFAULT_BEST_BOTTLES_ORG_ID = "4ab1ac72-cd7e-4faf-9152-5aa5f2862411";
const STALE_REFERENCE_REPAIR_ERROR =
  "Flattened product-truth reference required before generation. Import a source-background PNG/JPG named by exact Grace SKU.";

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

function isMissingReferenceMetadataColumn(error: unknown): boolean {
  const maybe = error as { code?: string; message?: string } | null | undefined;
  return Boolean(
    (maybe?.code === "42703" || maybe?.code === "PGRST204") &&
      /reference_(source|source_path|source_url|imported_at|issue)/i.test(maybe.message ?? ""),
  );
}

async function fetchRepairCandidates(
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
      .in("status", ["queued", "generating"])
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
  return findStaleQueuedWithoutReferenceRows(rows);
}

function printCandidates(candidates: ImageOpsSkuJobRow[], apply: boolean): void {
  console.log(
    `[image-ops-repair] ${apply ? "applying" : "dry-run"} stale queued reference repair for ` +
      `${candidates.length} row${candidates.length === 1 ? "" : "s"}`,
  );
  console.log(JSON.stringify(
    candidates.map((row) => ({
      id: row.id,
      graceSku: row.grace_sku,
      websiteSku: row.website_sku,
      family: row.family,
      productGroupSlug: row.product_group_slug,
      status: row.status,
      reference: row.best_reference_candidate_path,
      lastError: row.last_error,
    })),
    null,
    2,
  ));
  if (!apply && candidates.length > 0) {
    console.log("[image-ops-repair] dry-run only. Re-run with --apply to move these rows to needs-reference.");
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
      apply: { type: "boolean", default: false },
      limit: { type: "string", default: "1000" },
    },
  });

  const supabase = getSupabase();
  const organizationId = values["organization-id"] as string;
  const family = values.family ? String(values.family) : null;
  const productGroupSlug = values["product-group-slug"] ? String(values["product-group-slug"]) : null;
  const limit = Math.max(0, Number.parseInt(values.limit as string, 10) || 0);
  const apply = values.apply === true;
  const candidates = (await fetchRepairCandidates(supabase, { organizationId, family, productGroupSlug })).slice(0, limit);

  printCandidates(candidates, apply);
  if (!apply || candidates.length === 0) return;

  for (const row of candidates) {
    const patch = {
      status: "needs-reference",
      reference_issue: "flattened-product-truth-required",
      last_error: STALE_REFERENCE_REPAIR_ERROR,
    };
    const { error } = await supabase
      .from("best_bottles_pipeline_sku_jobs")
      .update(patch)
      .eq("id", row.id);
    if (error) {
      if (!isMissingReferenceMetadataColumn(error)) throw error;
      const { error: retryError } = await supabase
        .from("best_bottles_pipeline_sku_jobs")
        .update({
          status: "needs-reference",
          last_error: STALE_REFERENCE_REPAIR_ERROR,
        })
        .eq("id", row.id);
      if (retryError) throw retryError;
    }
  }
  console.log(`[image-ops-repair] repaired ${candidates.length} row${candidates.length === 1 ? "" : "s"}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
