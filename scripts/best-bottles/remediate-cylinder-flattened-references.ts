#!/usr/bin/env tsx
/**
 * Remediate the 2026-07-04 accidental re-introduction of RETIRED transparent
 * Cylinder references, and cut the family over to the SANCTIONED flattened
 * product-truth reference lane in one idempotent pass.
 *
 * Background:
 *   - 2026-06-22: transparent/background-removed Cylinder references were
 *     deliberately retired (rows nulled, storage deleted, edge function
 *     `generate-madison-image` hard-rejects `clean-references/cylinder/` and
 *     `transparent` tokens). Contract since then: ONE flattened Photoshop
 *     export with the original/source background (`…__pdp-main__v001.png`).
 *   - 2026-07-04: the stale `bestbottles-reference-cutover` skill re-uploaded
 *     the 333 transparent PNGs and repointed the 333 jobs back at them,
 *     undoing the retirement. Generation rejects all of them.
 *
 * This script, Cylinder-only, org-scoped:
 *   PHASE A (undo): null `best_reference_candidate_path` on every Cylinder job
 *     pointing into the retired `best-bottles/clean-references/cylinder/`
 *     prefix, then delete those re-uploaded objects from the
 *     `reference-images` bucket.
 *   PHASE B (flattened sync): for each Cylinder job, look for the local
 *     flattened export `reference-flattened/<product_group_slug>/
 *     <grace_sku>__*__pdp-main__*.png` in the Best-Bottles repo, upload it to
 *     the sanctioned prefix `generated-images/<org>/best-bottles/
 *     reference-images/<filename>` (idempotent upsert — the same location the
 *     41 already-working rows use), and repoint the job to that public URL
 *     where the value differs.
 *   PHASE C (verify): reclassify all live Cylinder rows; expect
 *     retired-transparent = 0. Sample-fetch repointed URLs.
 *
 * Default is DRY RUN. Pass --execute to write. Report:
 *   tmp/bestbottles-generation/cylinder-flattened-remediation-report.json
 * Pre-write backup of all rows already exists at
 *   tmp/bestbottles-generation/cylinder-jobs-prewrite-backup-2026-07-04-post-bad-cutover.json
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const ORG_ID = process.env.MADISON_BEST_BOTTLES_ORG_ID || "4ab1ac72-cd7e-4faf-9152-5aa5f2862411";
const FAMILY = "Cylinder";
const RETIRED_PREFIX = "best-bottles/clean-references/cylinder/";
const RETIRED_BUCKET = "reference-images";
const FLATTENED_BUCKET = "generated-images";
const FLATTENED_STORAGE_PREFIX = `${ORG_ID}/best-bottles/reference-images`;
const FLATTENED_LOCAL_ROOT =
  "/Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Website-02-20-2026/pipeline/aios-shopify-pdp-images/00-input/reference-flattened";
const MAX_BYTES = 5 * 1024 * 1024;
const REPORT_PATH = path.resolve("tmp/bestbottles-generation/cylinder-flattened-remediation-report.json");

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

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (cursor < items.length) {
        const i = cursor++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

async function main(): Promise<void> {
  const execute = process.argv.includes("--execute");
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.");
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const publicFlattenedUrl = (filename: string): string =>
    `${url.replace(/\/$/, "")}/storage/v1/object/public/${FLATTENED_BUCKET}/${FLATTENED_STORAGE_PREFIX}/${filename}`;

  console.log(`=== Cylinder flattened-reference remediation (${execute ? "EXECUTE" : "DRY RUN"}) ===`);

  // ---- Read live rows --------------------------------------------------------
  const { data: rows, error } = await supabase
    .from("best_bottles_pipeline_sku_jobs")
    .select("grace_sku,product_group_slug,coverage_status,best_reference_candidate_path")
    .eq("organization_id", ORG_ID)
    .eq("family", FAMILY);
  if (error) throw new Error(error.message);
  const jobs = rows ?? [];
  console.log(`live ${FAMILY} jobs: ${jobs.length}`);

  // ---- PHASE A plan: undo retired-transparent rows --------------------------
  const retiredRows = jobs.filter((r) =>
    String(r.best_reference_candidate_path ?? "").toLowerCase().includes(RETIRED_PREFIX),
  );
  console.log(`\nPHASE A — rows on retired transparent refs to NULL: ${retiredRows.length}`);

  // ---- PHASE B plan: flattened local exports ---------------------------------
  interface FlattenedPlan {
    graceSku: string;
    groupSlug: string;
    filename: string;
    localPath: string;
    sizeBytes: number;
    publicUrl: string;
    currentPath: string | null;
    action: "repoint" | "already-at-target";
  }
  const plan: FlattenedPlan[] = [];
  const noLocalFlattened: Array<{ graceSku: string; groupSlug: string | null }> = [];
  const planIssues: Array<{ graceSku: string; issue: string }> = [];

  for (const job of jobs) {
    const sku = job.grace_sku as string;
    const groupSlug = (job.product_group_slug as string | null) ?? null;
    const dir = groupSlug ? path.join(FLATTENED_LOCAL_ROOT, groupSlug) : null;
    let filename: string | null = null;
    if (dir && existsSync(dir)) {
      const match = readdirSync(dir).find(
        (f) => f.startsWith(`${sku}__`) && f.includes("pdp-main") && f.endsWith(".png"),
      );
      filename = match ?? null;
    }
    if (!filename || !dir) {
      noLocalFlattened.push({ graceSku: sku, groupSlug });
      continue;
    }
    const localPath = path.join(dir, filename);
    const sizeBytes = statSync(localPath).size;
    if (sizeBytes > MAX_BYTES) {
      planIssues.push({ graceSku: sku, issue: `flattened export ${(sizeBytes / 1048576).toFixed(1)}MB > 5MB cap` });
      continue;
    }
    const target = publicFlattenedUrl(filename);
    const current = (job.best_reference_candidate_path as string | null) ?? null;
    plan.push({
      graceSku: sku,
      groupSlug: groupSlug ?? "unknown",
      filename,
      localPath,
      sizeBytes,
      publicUrl: target,
      currentPath: current,
      action: current === target ? "already-at-target" : "repoint",
    });
  }
  const toRepoint = plan.filter((p) => p.action === "repoint");
  console.log(`\nPHASE B — flattened exports found locally : ${plan.length}`);
  console.log(`  would repoint (value differs)           : ${toRepoint.length}`);
  console.log(`  already at flattened target             : ${plan.length - toRepoint.length}`);
  console.log(`  no local flattened export               : ${noLocalFlattened.length} (left null / untouched)`);
  console.log(`  plan issues                             : ${planIssues.length}`);
  if (planIssues.length) console.log(planIssues.slice(0, 10));
  // Rows that end up null after both phases:
  const flattenedSkus = new Set(plan.map((p) => p.graceSku));
  const endsNull = jobs.filter((r) => {
    const p = String(r.best_reference_candidate_path ?? "");
    const isRetired = p.toLowerCase().includes(RETIRED_PREFIX);
    return (isRetired || !p) && !flattenedSkus.has(r.grace_sku as string);
  });
  console.log(`  rows ending with NULL reference          : ${endsNull.length} (await Cowork flattened exports)`);

  if (!execute) {
    console.log(`\nDRY RUN — no writes. Sample flattened target:\n  ${plan[0]?.publicUrl ?? "(none)"}`);
    return;
  }

  // ---- PHASE A execute -------------------------------------------------------
  let nulled = 0;
  const nullFailures: Array<{ graceSku: string; error: string }> = [];
  await mapPool(retiredRows, 8, async (row) => {
    const { error: e } = await supabase
      .from("best_bottles_pipeline_sku_jobs")
      .update({ best_reference_candidate_path: null })
      .eq("organization_id", ORG_ID)
      .eq("family", FAMILY)
      .eq("grace_sku", row.grace_sku as string);
    if (e) nullFailures.push({ graceSku: row.grace_sku as string, error: e.message });
    else nulled += 1;
  });
  console.log(`\nPHASE A — nulled retired refs: ${nulled}/${retiredRows.length}`);
  if (nullFailures.length) console.log("null failures:", nullFailures.slice(0, 10));

  // Delete the re-uploaded transparent objects (paged list + batch remove).
  let deleted = 0;
  const deleteErrors: string[] = [];
  for (;;) {
    const { data: objs, error: listErr } = await supabase.storage
      .from(RETIRED_BUCKET)
      .list(RETIRED_PREFIX.replace(/\/$/, ""), { limit: 100 });
    if (listErr) { deleteErrors.push(listErr.message); break; }
    if (!objs || objs.length === 0) break;
    const paths = objs.map((o) => `${RETIRED_PREFIX}${o.name}`);
    const { data: removed, error: rmErr } = await supabase.storage.from(RETIRED_BUCKET).remove(paths);
    if (rmErr) { deleteErrors.push(rmErr.message); break; }
    deleted += removed?.length ?? 0;
    if (objs.length < 100) break;
  }
  console.log(`PHASE A — deleted retired transparent objects: ${deleted}`);
  if (deleteErrors.length) console.log("delete errors:", deleteErrors);

  // ---- PHASE B execute -------------------------------------------------------
  let uploaded = 0;
  const uploadFailures: Array<{ graceSku: string; error: string }> = [];
  await mapPool(plan, 8, async (item) => {
    const bytes = readFileSync(item.localPath);
    const res = await supabase.storage
      .from(FLATTENED_BUCKET)
      .upload(`${FLATTENED_STORAGE_PREFIX}/${item.filename}`, bytes, { contentType: "image/png", upsert: true });
    if (res.error) uploadFailures.push({ graceSku: item.graceSku, error: res.error.message });
    else uploaded += 1;
  });
  console.log(`\nPHASE B — uploaded flattened exports: ${uploaded}/${plan.length}`);
  if (uploadFailures.length) console.log("upload failures:", uploadFailures.slice(0, 10));

  const failedUploads = new Set(uploadFailures.map((f) => f.graceSku));
  let repointed = 0;
  const repointFailures: Array<{ graceSku: string; error: string }> = [];
  await mapPool(toRepoint.filter((p) => !failedUploads.has(p.graceSku)), 8, async (item) => {
    const { error: e } = await supabase
      .from("best_bottles_pipeline_sku_jobs")
      .update({ best_reference_candidate_path: item.publicUrl })
      .eq("organization_id", ORG_ID)
      .eq("family", FAMILY)
      .eq("grace_sku", item.graceSku);
    if (e) repointFailures.push({ graceSku: item.graceSku, error: e.message });
    else repointed += 1;
  });
  console.log(`PHASE B — repointed to flattened refs: ${repointed}/${toRepoint.length}`);
  if (repointFailures.length) console.log("repoint failures:", repointFailures.slice(0, 10));

  // ---- PHASE C verify --------------------------------------------------------
  const { data: after } = await supabase
    .from("best_bottles_pipeline_sku_jobs")
    .select("grace_sku,coverage_status,best_reference_candidate_path")
    .eq("organization_id", ORG_ID)
    .eq("family", FAMILY);
  let retired = 0, flattened = 0, nullPath = 0, other = 0;
  for (const r of after ?? []) {
    const p = String(r.best_reference_candidate_path ?? "").toLowerCase();
    if (!p) nullPath++;
    else if (p.includes(RETIRED_PREFIX) || p.includes("transparent")) retired++;
    else if (p.includes(`/${FLATTENED_BUCKET}/${FLATTENED_STORAGE_PREFIX.toLowerCase()}/`)) flattened++;
    else other++;
  }
  console.log(`\nPHASE C — post-remediation classification:`);
  console.log({ total: after?.length ?? 0, retiredTransparent: retired, flattened, nullPath, other });

  const sample = toRepoint.slice(0, 5);
  const verify = await Promise.all(
    sample.map(async (p) => {
      try {
        const r = await fetch(p.publicUrl, { method: "HEAD" });
        return { graceSku: p.graceSku, status: r.status, contentType: r.headers.get("content-type") };
      } catch (e) {
        return { graceSku: p.graceSku, status: "ERR", contentType: String((e as Error).message) };
      }
    }),
  );
  console.log("verify sample:", verify);

  mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  writeFileSync(REPORT_PATH, JSON.stringify({
    generatedAt: new Date().toISOString(),
    org: ORG_ID,
    family: FAMILY,
    phaseA: { nulled, retiredRowsTargeted: retiredRows.length, storageDeleted: deleted, nullFailures, deleteErrors },
    phaseB: {
      localFlattenedFound: plan.length,
      uploaded,
      repointed,
      alreadyAtTarget: plan.length - toRepoint.length,
      noLocalFlattened: noLocalFlattened.length,
      planIssues,
      uploadFailures,
      repointFailures,
      noLocalFlattenedSkus: noLocalFlattened,
    },
    phaseC: { total: after?.length ?? 0, retiredTransparent: retired, flattened, nullPath, other, verify },
  }, null, 2));
  console.log(`\nReport written: ${path.relative(process.cwd(), REPORT_PATH)}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
