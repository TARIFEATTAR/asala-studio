#!/usr/bin/env tsx
/**
 * READ-ONLY diagnostic: classify the live Cylinder jobs' current
 * best_reference_candidate_path so we can safely reconcile the accidental
 * re-introduction of retired transparent references. No writes.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const ORG_ID = process.env.MADISON_BEST_BOTTLES_ORG_ID || "4ab1ac72-cd7e-4faf-9152-5aa5f2862411";

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
  "reference-imports/background-removed", "reference-imports/bg-removed",
  "transparent", "background-removed", "bg-removed", "removed-background",
];
function classify(p: string | null): string {
  if (!p || !p.trim()) return "null";
  const s = p.toLowerCase();
  if (RETIRED_TOKENS.some((t) => s.includes(t))) return "retired-transparent";
  if (/reference-imports|madison-hero-sync|renders/.test(s)) return "other-legacy(flattened?)";
  return "other";
}

async function main(): Promise<void> {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.");
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { data, error } = await supabase
    .from("best_bottles_pipeline_sku_jobs")
    .select("grace_sku,coverage_status,best_reference_candidate_path")
    .eq("organization_id", ORG_ID)
    .eq("family", "Cylinder");
  if (error) throw new Error(error.message);
  const rows = data ?? [];

  const byPathClass: Record<string, number> = {};
  const byCoverage: Record<string, number> = {};
  const byCross: Record<string, number> = {};
  const flattenedSamples: string[] = [];
  for (const r of rows) {
    const pc = classify(r.best_reference_candidate_path as string | null);
    const cs = (r.coverage_status as string) || "(null)";
    byPathClass[pc] = (byPathClass[pc] ?? 0) + 1;
    byCoverage[cs] = (byCoverage[cs] ?? 0) + 1;
    const cross = `${cs} | ${pc}`;
    byCross[cross] = (byCross[cross] ?? 0) + 1;
    if (pc === "other-legacy(flattened?)" || pc === "other") {
      if (flattenedSamples.length < 12) flattenedSamples.push(`${r.grace_sku}  ->  ${r.best_reference_candidate_path}`);
    }
  }

  console.log(`Total live Cylinder jobs: ${rows.length}`);
  console.log("\nby best_reference_candidate_path class:", byPathClass);
  console.log("\nby coverage_status:", byCoverage);
  console.log("\ncross (coverage | pathClass):");
  for (const [k, v] of Object.entries(byCross).sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(4)}  ${k}`);
  if (flattenedSamples.length) {
    console.log("\nNON-transparent, NON-null reference samples (would be LOST by a blanket null-restore):");
    for (const s of flattenedSamples) console.log("  " + s);
  } else {
    console.log("\nNo non-transparent, non-null references present — every set path is a retired-transparent one I re-introduced.");
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
