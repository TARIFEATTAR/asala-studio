import "dotenv/config";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type ReconciliationRow = {
  image_id: string;
  grace_sku: string | null;
  website_sku: string | null;
  family: string | null;
  reconciliation_status: string;
  lifecycle_state: string;
  is_reconciled: boolean;
  requires_pipeline_reconciliation: boolean;
  baseline_delta_px: number | null;
  fill_height_pct: number | null;
  center_delta_pct: number | null;
  catalog_truth: Record<string, unknown> | null;
  assignment_count: number;
  assignments: Array<Record<string, unknown>>;
  all_shopify_writes_recorded: boolean;
  all_shopify_verified: boolean;
  all_convex_writes_recorded: boolean;
  all_convex_verified: boolean;
  any_destination_mismatch: boolean;
  qa_issues: string[] | null;
  last_error: string | null;
  updated_at: string;
};

function argValue(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  if (index < 0) return null;
  return process.argv[index + 1] ?? null;
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

async function fetchAllRows(
  client: SupabaseClient,
  organizationId: string | null,
): Promise<ReconciliationRow[]> {
  const rows: ReconciliationRow[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    let query = client
      .from("best_bottles_image_reconciliation_status")
      .select(
        "image_id,grace_sku,website_sku,family,reconciliation_status,lifecycle_state,is_reconciled,requires_pipeline_reconciliation,baseline_delta_px,fill_height_pct,center_delta_pct,catalog_truth,assignment_count,assignments,all_shopify_writes_recorded,all_shopify_verified,all_convex_writes_recorded,all_convex_verified,any_destination_mismatch,qa_issues,last_error,updated_at",
      )
      .order("updated_at", { ascending: false })
      .range(from, from + pageSize - 1);
    if (organizationId) query = query.eq("organization_id", organizationId);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    const page = (data ?? []) as ReconciliationRow[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

async function main() {
  if (process.argv.includes("--help")) {
    console.log("Usage: npm run bestbottles:images:audit-reconciliation -- [--organization-id UUID] [--json] [--strict]");
    console.log("Read-only. --strict exits 2 when any PDP-primary image has a reconciliation exception.");
    return;
  }
  const url = requiredEnv("VITE_SUPABASE_URL");
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const organizationId = argValue("--organization-id");
  const json = process.argv.includes("--json");
  const strict = process.argv.includes("--strict");
  const client = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const rows = await fetchAllRows(client, organizationId);
  const counts = rows.reduce<Record<string, number>>((result, row) => {
    result[row.reconciliation_status] = (result[row.reconciliation_status] ?? 0) + 1;
    return result;
  }, {});
  const pipelineRows = rows.filter((row) => row.requires_pipeline_reconciliation);
  const exceptions = pipelineRows.filter((row) => !row.is_reconciled);
  const summary = {
    generatedAt: new Date().toISOString(),
    organizationId,
    trackedImages: rows.length,
    pipelineImages: pipelineRows.length,
    libraryOnlyImages: rows.length - pipelineRows.length,
    reconciledImages: pipelineRows.length - exceptions.length,
    exceptionImages: exceptions.length,
    counts,
    exceptions: exceptions.map((row) => ({
      imageId: row.image_id,
      graceSku: row.grace_sku,
      websiteSku: row.website_sku,
      family: row.family,
      status: row.reconciliation_status,
      lifecycle: row.lifecycle_state,
      baselineDeltaPx: row.baseline_delta_px,
      fillHeightPct: row.fill_height_pct,
      centerDeltaPct: row.center_delta_pct,
      websiteTruthStatus: row.catalog_truth?.websiteTruthStatus ?? null,
      identityStatus: row.catalog_truth?.identityStatus ?? null,
      assignmentCount: row.assignment_count,
      assignments: row.assignments,
      shopifyWriteComplete: row.all_shopify_writes_recorded,
      shopifyVerificationComplete: row.all_shopify_verified,
      convexWriteComplete: row.all_convex_writes_recorded,
      convexVerificationComplete: row.all_convex_verified,
      destinationMismatch: row.any_destination_mismatch,
      qaIssues: row.qa_issues ?? [],
      lastError: row.last_error,
      updatedAt: row.updated_at,
    })),
  };

  if (json) {
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  } else {
    console.log("Best Bottles image reconciliation audit");
    console.log(`Tracked: ${summary.trackedImages}`);
    console.log(`PDP pipeline: ${summary.pipelineImages}`);
    console.log(`Library-only: ${summary.libraryOnlyImages}`);
    console.log(`Reconciled: ${summary.reconciledImages}`);
    console.log(`Exceptions: ${summary.exceptionImages}`);
    for (const [status, count] of Object.entries(counts).sort()) {
      console.log(`  ${status}: ${count}`);
    }
    if (exceptions.length > 0) {
      console.log("\nException queue:");
      for (const row of summary.exceptions) {
        console.log(
          `  ${row.graceSku ?? row.websiteSku ?? row.imageId} · ${row.status} · baseline ${row.baselineDeltaPx ?? "missing"}px${row.lastError ? ` · ${row.lastError}` : ""}`,
        );
      }
    }
  }

  if (strict && exceptions.length > 0) process.exitCode = 2;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
