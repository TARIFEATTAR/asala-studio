#!/usr/bin/env tsx
/**
 * Sync a Best Bottles clean-reference cutover into the live pipeline, per family.
 *
 * Background (see docs/BEST-BOTTLES-IMAGE-PIPELINE-BRIEF.md §2 + §6):
 * The reference-intake.json rebuild repoints each cut family's `covered_canonical`
 * rows' `referenceSourcePath` at the NEW clean transparent PNGs in the separate
 * Best Bottles repo (`pipeline/best-bottles-reference-images-clean/
 * 01-transparent-png-candidates/**`). BUT the pipeline UI + generate-madison-image
 * read each variant's reference from the Supabase `best_bottles_pipeline_sku_jobs`
 * table (`best_reference_candidate_path`), which still points at the OLD
 * legacy-render reference imports. This app cannot serve files from the separate
 * repo, and the reference validator (`src/lib/bestBottlesReferenceValidation.ts`)
 * rejects non-http app paths, so a `public/data/...` copy would never reach
 * generation. The only form that satisfies (a) browser <img> display, (b) the
 * https/.png validator, and (c) the edge function's server-side `fetch(url)` →
 * base64 "Image 1" is a public Supabase Storage URL.
 *
 * This script therefore, for ONE family at a time:
 *   1. Reads the rebuilt intake, selects family=<FAMILY> + coverageStatus=
 *      covered_canonical rows (only the cut families — never re-derives lanes).
 *   2. Uploads each clean `{graceSku}.png` (from referenceSourcePath) to the
 *      public `reference-images` bucket at a deterministic, idempotent path.
 *   3. Repoints best_bottles_pipeline_sku_jobs.best_reference_candidate_path
 *      for the matching jobs (join by graceSku) to that public URL.
 *
 * Idempotent: re-running uploads with upsert and writes the same deterministic
 * URL, so it converges. Default is DRY RUN; pass --execute to apply. Only the
 * named family is touched — uncut families are never modified.
 *
 * Usage:
 *   tsx scripts/sync-bestbottles-clean-references.ts --family Cylinder            # dry run
 *   tsx scripts/sync-bestbottles-clean-references.ts --family Cylinder --execute  # apply
 *   tsx scripts/sync-bestbottles-clean-references.ts --family "Boston Round" --execute --verify
 *
 * Valid --family values are the intake display names: Cylinder, Tulip,
 * "Boston Round", Elegant, Diva, Circle, Sleek, Round, Slim, Empire, etc.
 * (must match the `family` field in the intake and the jobs table exactly).
 */
import { existsSync, readFileSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import process from "node:process";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const ORG_ID = process.env.MADISON_BEST_BOTTLES_ORG_ID || "4ab1ac72-cd7e-4faf-9152-5aa5f2862411";
const BUCKET = process.env.MADISON_REFERENCE_IMAGES_BUCKET || "reference-images";
const INTAKE_PATH = path.resolve("public/data/best-bottles-reference-intake.json");
const MAX_BYTES = 5 * 1024 * 1024; // bucket + edge function per-image cap

interface IntakeRow {
  graceSku: string;
  family: string;
  coverageStatus: string;
  referenceSourcePath?: string | null;
  bestReferenceCandidatePath?: string | null;
}

interface PlanItem {
  graceSku: string;
  sourcePath: string;
  sizeBytes: number;
  storagePath: string;
  publicUrl: string;
}

function getArg(name: string, fallback = ""): string {
  const i = process.argv.indexOf(name);
  if (i < 0) return fallback;
  const v = process.argv[i + 1];
  if (!v || v.startsWith("--")) return fallback;
  return v;
}

function familySlug(family: string): string {
  return family.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "unknown";
}

function loadEnvFile(filePath: string): void {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx < 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

async function main(): Promise<void> {
  loadEnvFile(path.resolve(".env"));
  loadEnvFile(path.resolve(".env.local"));

  const family = getArg("--family", "Cylinder");
  const slug = familySlug(family);
  const storagePrefix = `best-bottles/clean-references/${slug}`;
  const reportPath = path.resolve(`tmp/bestbottles-clean-${slug}-reference-sync-report.json`);
  const execute = process.argv.includes("--execute");
  const verify = process.argv.includes("--verify");

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in env (.env).");
  }

  const publicUrlFor = (storagePath: string): string =>
    `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/${BUCKET}/${storagePath}`;

  console.log(`=== Best Bottles clean-reference sync — family="${family}" (slug=${slug}) ===`);

  // 1. Build the plan from the rebuilt intake (this family + covered_canonical only).
  const intake = JSON.parse(readFileSync(INTAKE_PATH, "utf8")) as { rows: IntakeRow[] };
  const families = [...new Set(intake.rows.map((r) => r.family))].sort();
  const canonicalRows = intake.rows.filter(
    (r) => r.family === family && r.coverageStatus === "covered_canonical",
  );
  if (canonicalRows.length === 0) {
    console.log(`No covered_canonical rows for family "${family}". Known families: ${families.join(", ")}`);
    console.log("If this family's clean lane has not landed yet, there is nothing to cut.");
    return;
  }

  const plan: PlanItem[] = [];
  const planIssues: Array<{ graceSku: string; issue: string }> = [];
  for (const row of canonicalRows) {
    const sourcePath = row.referenceSourcePath ?? "";
    if (!sourcePath) {
      planIssues.push({ graceSku: row.graceSku, issue: "no referenceSourcePath in intake" });
      continue;
    }
    if (!existsSync(sourcePath)) {
      planIssues.push({ graceSku: row.graceSku, issue: `source missing on disk: ${sourcePath}` });
      continue;
    }
    const sizeBytes = statSync(sourcePath).size;
    if (sizeBytes > MAX_BYTES) {
      planIssues.push({ graceSku: row.graceSku, issue: `source ${(sizeBytes / 1048576).toFixed(1)}MB > 5MB cap` });
      continue;
    }
    if (path.basename(sourcePath, ".png") !== row.graceSku) {
      planIssues.push({ graceSku: row.graceSku, issue: `source basename != graceSku (${path.basename(sourcePath)})` });
    }
    const storagePath = `${storagePrefix}/${row.graceSku}.png`;
    plan.push({ graceSku: row.graceSku, sourcePath, sizeBytes, storagePath, publicUrl: publicUrlFor(storagePath) });
  }

  console.log("=== PLAN ===");
  console.log(`intake ${family} covered_canonical rows : ${canonicalRows.length}`);
  console.log(`uploadable references                  : ${plan.length}`);
  console.log(`plan issues                            : ${planIssues.length}`);
  if (planIssues.length) console.log(planIssues.slice(0, 20));

  const client: SupabaseClient = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

  const { data: jobRows, error: jobErr } = await client
    .from("best_bottles_pipeline_sku_jobs")
    .select("grace_sku,best_reference_candidate_path,coverage_status")
    .eq("organization_id", ORG_ID)
    .eq("family", family);
  if (jobErr) throw new Error(`Failed to read jobs: ${jobErr.message}`);
  const jobBySku = new Map((jobRows ?? []).map((r) => [r.grace_sku as string, r]));
  console.log(`live ${family} jobs                    : ${jobRows?.length ?? 0}`);

  const planSkusMissingJob = plan.filter((p) => !jobBySku.has(p.graceSku)).map((p) => p.graceSku);
  if (planSkusMissingJob.length) {
    console.log(`WARNING: ${planSkusMissingJob.length} canonical SKUs have no job row`, planSkusMissingJob.slice(0, 10));
  }

  if (!execute) {
    const wouldChange = plan.filter((p) => jobBySku.get(p.graceSku)?.best_reference_candidate_path !== p.publicUrl).length;
    console.log("\nDRY RUN — pass --execute to upload + repoint. No changes made.");
    console.log(`would repoint (value differs)          : ${wouldChange}`);
    console.log(`already at target                      : ${plan.length - wouldChange}`);
    console.log(`sample target URL                      : ${plan[0]?.publicUrl ?? "(none)"}`);
    return;
  }

  // 2. Upload clean PNGs to the public reference-images bucket (idempotent upsert).
  let uploaded = 0;
  const uploadFailures: Array<{ graceSku: string; error: string }> = [];
  await mapPool(plan, 8, async (item) => {
    const bytes = readFileSync(item.sourcePath);
    const res = await client.storage.from(BUCKET).upload(item.storagePath, bytes, {
      contentType: "image/png",
      upsert: true,
    });
    if (res.error) uploadFailures.push({ graceSku: item.graceSku, error: res.error.message });
    else uploaded += 1;
  });
  console.log(`\nuploaded to ${BUCKET}                  : ${uploaded}/${plan.length}`);
  if (uploadFailures.length) console.log("upload failures:", uploadFailures.slice(0, 20));

  // 3. Repoint the jobs table (this family only, join by graceSku). Only update
  //    rows whose value actually differs, so the count reflects real changes.
  const uploadedSkus = new Set(plan.filter((p) => !uploadFailures.some((f) => f.graceSku === p.graceSku)).map((p) => p.graceSku));
  const toUpdate = plan.filter(
    (p) => uploadedSkus.has(p.graceSku) && jobBySku.has(p.graceSku) && jobBySku.get(p.graceSku)?.best_reference_candidate_path !== p.publicUrl,
  );
  let repointed = 0;
  const updateFailures: Array<{ graceSku: string; error: string }> = [];
  await mapPool(toUpdate, 8, async (item) => {
    const { error } = await client
      .from("best_bottles_pipeline_sku_jobs")
      .update({ best_reference_candidate_path: item.publicUrl })
      .eq("organization_id", ORG_ID)
      .eq("family", family)
      .eq("grace_sku", item.graceSku);
    if (error) updateFailures.push({ graceSku: item.graceSku, error: error.message });
    else repointed += 1;
  });
  const alreadyCorrect = plan.length - toUpdate.length - uploadFailures.length;
  console.log(`repointed best_reference_candidate_path : ${repointed}`);
  console.log(`already at target (skipped)            : ${alreadyCorrect}`);
  if (updateFailures.length) console.log("update failures:", updateFailures.slice(0, 20));

  // Post-check: re-read this family's jobs and classify what each now resolves to.
  const { data: after } = await client
    .from("best_bottles_pipeline_sku_jobs")
    .select("grace_sku,coverage_status,best_reference_candidate_path")
    .eq("organization_id", ORG_ID)
    .eq("family", family);
  let cleanRef = 0, oldRender = 0, nullPath = 0, otherRef = 0;
  const stillOld: string[] = [];
  for (const r of after ?? []) {
    const p = (r.best_reference_candidate_path as string) || "";
    if (!p) nullPath++;
    else if (p.includes(`/${BUCKET}/${storagePrefix}/`)) cleanRef++;
    else if (/reference-imports|reference-images|madison-hero-sync|renders/.test(p)) { oldRender++; stillOld.push(r.grace_sku as string); }
    else otherRef++;
  }
  console.log(`\n=== POST-SYNC ${family} reference resolution ===`);
  console.log({ total: after?.length ?? 0, cleanRef, oldRender, nullPath, otherRef });
  if (stillOld.length) console.log(`still resolving to OLD references (${stillOld.length}):`, stillOld.slice(0, 30));

  let verifyResult: unknown = "skipped";
  if (verify) {
    const sample = plan.slice(0, 5);
    verifyResult = await Promise.all(
      sample.map(async (p) => {
        try {
          const r = await fetch(p.publicUrl);
          return { graceSku: p.graceSku, status: r.status, contentType: r.headers.get("content-type") };
        } catch (e) {
          return { graceSku: p.graceSku, status: "ERR", contentType: String((e as Error).message) };
        }
      }),
    );
    console.log("\n=== VERIFY sample public URLs ===");
    console.log(verifyResult);
  }

  mkdirSync(path.dirname(reportPath), { recursive: true });
  writeFileSync(
    reportPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        org: ORG_ID,
        family,
        slug,
        bucket: BUCKET,
        storagePrefix,
        intakeCanonical: canonicalRows.length,
        uploadable: plan.length,
        uploaded,
        repointed,
        alreadyCorrect,
        planIssues,
        uploadFailures,
        updateFailures,
        postSync: { cleanRef, oldRender, nullPath, otherRef, stillOld },
        verify: verifyResult,
      },
      null,
      2,
    ),
  );
  console.log(`\nReport written: ${path.relative(process.cwd(), reportPath)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
