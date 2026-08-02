import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
for (const f of [".env", ".env.local"]) {
  try { for (const l of readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Za-z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, ""); } } catch { /* */ }
}
(async () => {
  const ORG = "4ab1ac72-cd7e-4faf-9152-5aa5f2862411";
  const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data } = await sb.from("generated_images").select("id,image_url,library_tags,created_at").eq("organization_id", ORG).order("created_at", { ascending: false }).limit(500);
  const rows = data ?? [];
  const skuOf = (t: unknown) => { const arr = Array.isArray(t) ? t : []; const s = arr.find((x: string) => typeof x === "string" && x.startsWith("sku:")); return s ? s.slice(4) : null; };
  const byS: Record<string, { n: number; urls: string[] }> = {};
  let cyl = 0;
  for (const r of rows) {
    const tags = r.library_tags;
    const isCyl = Array.isArray(tags) && tags.some((x: string) => x === "family:cylinder" || (typeof x === "string" && (x.startsWith("sku:GB-CYL") || x.startsWith("sku:GB-SPR"))));
    if (!isCyl) continue;
    cyl++;
    const s = skuOf(tags) || "?";
    (byS[s] ??= { n: 0, urls: [] }).n++;
    if (byS[s].urls.length < 1) byS[s].urls.push(r.image_url as string);
  }
  const dupes = Object.entries(byS).filter(([, v]) => v.n > 1).sort((a, b) => b[1].n - a[1].n);
  console.log(`recent cylinder generated_images rows (of last 500): ${cyl}`);
  console.log(`distinct SKUs: ${Object.keys(byS).length}`);
  console.log(`SKUs with duplicate renders: ${dupes.length}`);
  console.log("top duplicated:", dupes.slice(0, 14).map(([k, v]) => `${k}x${v.n}`).join("  "));
  const amber = Object.entries(byS).filter(([k]) => k.includes("AMB")).slice(0, 3);
  console.log("\namber sample URLs:");
  for (const [k, v] of amber) console.log(k, v.urls[0]);
})();
