/**
 * READ-ONLY characterization + local backup of the generated_images library
 * ahead of a clean-slate purge. NO deletes. Writes a full backup of the
 * candidate render rows so any purge is reversible.
 *
 * Classification per row:
 *   - reference  : image_url points into a reference prefix — PRESERVE (never delete)
 *   - bb-render  : Best Bottles render output (brand/family/sku tags) — purge candidate
 *   - other      : anything else (non-Best-Bottles) — PRESERVE
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
for (const f of [".env", ".env.local"]) {
  try { for (const l of readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Za-z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, ""); } } catch { /* */ }
}

const ORG = "4ab1ac72-cd7e-4faf-9152-5aa5f2862411";
const REFERENCE_PREFIXES = ["/best-bottles/reference-images/", "/reference-images/", "/clean-references/", "/reference-imports/"];

function isReference(url: string): boolean {
  const u = (url || "").toLowerCase();
  return REFERENCE_PREFIXES.some((p) => u.includes(p));
}
function tagsOf(t: unknown): string[] { return Array.isArray(t) ? (t as string[]).filter((x) => typeof x === "string") : []; }
function isBestBottles(tags: string[]): boolean {
  return tags.some((x) => x === "brand:best-bottles" || x.startsWith("family:") || x.startsWith("sku:GB-CYL") || x.startsWith("sku:GB-SPR"));
}
function familyOf(tags: string[]): string {
  const f = tags.find((x) => x.startsWith("family:"));
  if (f) return f.slice(7);
  const s = tags.find((x) => x.startsWith("sku:"));
  if (s?.startsWith("sku:GB-CYL") || s?.startsWith("sku:GB-SPR")) return "cylinder(sku-inferred)";
  return "unknown";
}
function skuOf(tags: string[]): string | null { const s = tags.find((x) => x.startsWith("sku:")); return s ? s.slice(4) : null; }

(async () => {
  const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

  // Paginate the whole table for the org.
  const all: Array<Record<string, unknown>> = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await sb.from("generated_images").select("id,image_url,library_tags,created_at").eq("organization_id", ORG).order("created_at", { ascending: false }).range(from, from + page - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < page) break;
  }

  let refs = 0, other = 0;
  const bbByFamily: Record<string, number> = {};
  const bbBySku: Record<string, number> = {};
  const purgeRows: Array<Record<string, unknown>> = [];
  for (const r of all) {
    const tags = tagsOf(r.library_tags);
    if (isReference(r.image_url as string)) { refs++; continue; }
    if (!isBestBottles(tags)) { other++; continue; }
    const fam = familyOf(tags);
    bbByFamily[fam] = (bbByFamily[fam] ?? 0) + 1;
    const sku = skuOf(tags) || "?";
    bbBySku[sku] = (bbBySku[sku] ?? 0) + 1;
    purgeRows.push(r);
  }

  const cylKeys = ["cylinder", "cylinder(sku-inferred)", "tall cylinder"];
  const cylCount = Object.entries(bbByFamily).filter(([k]) => cylKeys.includes(k)).reduce((a, [, v]) => a + v, 0);

  console.log(`=== generated_images characterization (org ${ORG}) ===`);
  console.log(`total rows                : ${all.length}`);
  console.log(`  reference rows (PRESERVE): ${refs}`);
  console.log(`  non-BB rows   (PRESERVE): ${other}`);
  console.log(`  Best Bottles renders    : ${purgeRows.length}  <-- purge candidates`);
  console.log(`\nBest Bottles renders by family:`);
  for (const [k, v] of Object.entries(bbByFamily).sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(4)}  ${k}`);
  console.log(`\ncylinder-only render rows : ${cylCount}`);
  console.log(`distinct BB SKUs          : ${Object.keys(bbBySku).length}`);
  const topDup = Object.entries(bbBySku).filter(([, v]) => v > 1).sort((a, b) => b[1] - a[1]).slice(0, 10);
  console.log(`most-duplicated SKUs      :`, topDup.map(([k, v]) => `${k}x${v}`).join("  "));

  const outDir = path.resolve("tmp/bestbottles-generation");
  mkdirSync(outDir, { recursive: true });
  const backupPath = path.join(outDir, "generated-images-BB-render-backup.json");
  writeFileSync(backupPath, JSON.stringify({ capturedFor: "pre-purge", org: ORG, totalRows: all.length, referencesPreserved: refs, nonBBPreserved: other, purgeCandidates: purgeRows.length, byFamily: bbByFamily, rows: purgeRows }, null, 2));
  console.log(`\nBackup of ${purgeRows.length} purge-candidate rows written: ${path.relative(process.cwd(), backupPath)}`);
  console.log(`(NO deletes performed — this is characterization only.)`);
})();
