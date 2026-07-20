#!/usr/bin/env tsx
/**
 * READ-ONLY audit + local backup ahead of remediating the accidental
 * re-introduction of retired transparent Cylinder references.
 *
 *  1. Snapshots ALL live Cylinder job rows (grace_sku, coverage_status,
 *     best_reference_candidate_path, status) to a timestamped local JSON so any
 *     subsequent remediation write is itself reversible.
 *  2. Lists the sanctioned flattened-reference storage prefix
 *     (generated-images/<org>/best-bottles/reference-images/) and derives, per
 *     SKU, whether a flattened `__pdp-main__` product-truth reference exists.
 *  3. For the 333 intake-covered_canonical SKUs the bad cutover repointed,
 *     reports how many have a flattened reference available (=> restore to it)
 *     vs none (=> null / needs_reference).
 *
 * No table writes. Only a local backup file is written.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const ORG_ID = process.env.MADISON_BEST_BOTTLES_ORG_ID || "4ab1ac72-cd7e-4faf-9152-5aa5f2862411";
const STAMP = process.env.BACKUP_STAMP || "manual";

function loadEnv(): void {
  for (const file of [".env", ".env.local"]) {
    try {
      for (const line of readFileSync(path.resolve(file), "utf8").split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Za-z0-9_]+)=(.*)$/);
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
      }
    } catch { /* optional */ }
  }
}
loadEnv();

const RETIRED_TOKENS = [
  "best-bottles/clean-references/cylinder/", "clean-references/cylinder/",
  "transparent", "background-removed", "bg-removed", "removed-background",
];
function isRetired(p: string | null): boolean {
  if (!p) return false;
  const s = p.toLowerCase();
  return RETIRED_TOKENS.some((t) => s.includes(t));
}
function skuFromFlattenedName(name: string): string | null {
  // Pattern: {graceSku}__{websiteSku}__pdp-main__v001.png
  const m = name.match(/^([A-Z0-9-]+)__.*pdp-main/i);
  return m ? m[1] : null;
}

async function main(): Promise<void> {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.");
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  // --- 1. Backup current live Cylinder job rows --------------------------------
  const { data: rows, error } = await supabase
    .from("best_bottles_pipeline_sku_jobs")
    .select("grace_sku,coverage_status,best_reference_candidate_path,status,product_group_slug")
    .eq("organization_id", ORG_ID)
    .eq("family", "Cylinder");
  if (error) throw new Error(error.message);
  const jobs = rows ?? [];

  const backupDir = path.resolve("tmp/bestbottles-generation");
  mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, `cylinder-jobs-prewrite-backup-${STAMP}.json`);
  writeFileSync(backupPath, JSON.stringify({ capturedFor: "pre-remediation", org: ORG_ID, family: "Cylinder", count: jobs.length, rows: jobs }, null, 2));
  console.log(`Backup written: ${path.relative(process.cwd(), backupPath)} (${jobs.length} rows)`);

  // --- 2. Enumerate sanctioned flattened references in storage -----------------
  const flattenedSkus = new Set<string>();
  const prefix = `${ORG_ID}/best-bottles/reference-images`;
  let offset = 0;
  const pageSize = 100;
  for (;;) {
    const { data: files, error: listErr } = await supabase.storage
      .from("generated-images")
      .list(prefix, { limit: pageSize, offset });
    if (listErr) { console.log(`  storage list error: ${listErr.message}`); break; }
    if (!files || files.length === 0) break;
    for (const f of files) {
      const sku = skuFromFlattenedName(f.name);
      if (sku) flattenedSkus.add(sku);
    }
    if (files.length < pageSize) break;
    offset += pageSize;
  }
  console.log(`Flattened product-truth references found in storage: ${flattenedSkus.size} SKUs`);

  // --- 3. The 333 SKUs the bad cutover repointed (intake covered_canonical) ----
  const intake = JSON.parse(readFileSync(path.resolve("public/data/best-bottles-reference-intake.json"), "utf8")) as { rows: Array<Record<string, unknown>> };
  const touched = intake.rows
    .filter((r) => r.family === "Cylinder" && r.coverageStatus === "covered_canonical")
    .map((r) => String(r.graceSku));
  const touchedSet = new Set(touched);

  const jobBySku = new Map(jobs.map((j) => [j.grace_sku as string, j]));
  let nowRetired = 0, hasFlattened = 0, noFlattened = 0;
  const restoreToFlattened: string[] = [];
  const nullOut: Array<{ sku: string; coverage: string }> = [];
  for (const sku of touched) {
    const job = jobBySku.get(sku);
    if (job && isRetired(job.best_reference_candidate_path as string | null)) nowRetired++;
    if (flattenedSkus.has(sku)) { hasFlattened++; restoreToFlattened.push(sku); }
    else { noFlattened++; nullOut.push({ sku, coverage: (job?.coverage_status as string) || "(missing job)" }); }
  }

  console.log(`\n=== The 333 cutover-touched SKUs ===`);
  console.log(`touched (intake covered_canonical) : ${touched.length}`);
  console.log(`currently retired-transparent live : ${nowRetired}`);
  console.log(`have a flattened ref available     : ${hasFlattened}  (=> restore to flattened)`);
  console.log(`no flattened ref                   : ${noFlattened}  (=> null / needs_reference)`);
  if (restoreToFlattened.length) console.log(`  restore-to-flattened SKUs (sample):`, restoreToFlattened.slice(0, 15));
  // coverage breakdown of the null-out set
  const cov: Record<string, number> = {};
  for (const n of nullOut) cov[n.coverage] = (cov[n.coverage] ?? 0) + 1;
  console.log(`  null-out coverage_status breakdown:`, cov);

  writeFileSync(path.join(backupDir, `cylinder-remediation-plan-${STAMP}.json`), JSON.stringify({
    touchedCount: touched.length, nowRetired, hasFlattened, noFlattened,
    restoreToFlattened, nullOut, flattenedSkusAll: [...flattenedSkus].sort(),
  }, null, 2));
  console.log(`\nRemediation plan written: tmp/bestbottles-generation/cylinder-remediation-plan-${STAMP}.json`);
}

main().catch((e) => { console.error(e); process.exit(1); });
