/**
 * Rig-and-save pass for already-approved Cylinder "Good" renders that only have
 * a RAW (unframed) version. Mirrors rigPostprocessOutput() in generate-family-batch.ts
 * exactly: colorCorrectToTarget(#F5F3EF) -> normalizeBestBottlesRigBaseline -> upload
 * rigged PNG to the generated-images bucket -> patch generated_images.image_url.
 *
 * Prereqs: Vite dev server on http://127.0.0.1:8080  +  Playwright chromium  +
 *          SUPABASE_SERVICE_ROLE_KEY in madison-app/.env.
 *
 * Usage (from madison-app):
 *   node scripts/best-bottles/rig-and-save-cylinder.mjs            # DRY RUN (rig in browser, no upload/db write)
 *   node scripts/best-bottles/rig-and-save-cylinder.mjs --execute  # rig + upload + patch image_url
 *   node scripts/best-bottles/rig-and-save-cylinder.mjs http://127.0.0.1:5173/ --execute   # custom dev port
 *
 * Outputs (into pipeline/madison-hero-sync/):
 *   _cylinder-rigged-selections.json  -> feed to apply-gallery-selections.ts (approve)
 *   _cylinder-rig-report.json         -> per-SKU status; rig-failed SKUs need regeneration
 */
import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const BB = "/Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Website-02-20-2026";
const HS = `${BB}/pipeline/madison-hero-sync`;
const ENV = "/Users/jordanrichter/Projects/Madison Studio/madison-app/.env";
const ORG_ID = "4ab1ac72-cd7e-4faf-9152-5aa5f2862411";
const USER_ID = "d4cd4ae9-a9a8-4ea6-ab6f-fd1e19078e5e";
const BG = "#F5F3EF";
const args = process.argv.slice(2);
const EXECUTE = args.includes("--execute");
const RELAX = args.includes("--relax");                         // accept near-miss QA (wide-bottle height undershoot / small centerline)
const RELAX_FILL = Number((args.find((a)=>a.startsWith("--relax-fill="))||"").split("=")[1]) || 10;   // pct-points allowed under range min
const RELAX_CENTER = Number((args.find((a)=>a.startsWith("--relax-center="))||"").split("=")[1]) || 5;
const DEV = args.find((a) => a.startsWith("http")) || "http://127.0.0.1:8080/";

const env = readFileSync(ENV, "utf8");
const gv = (k) => { const m = env.match(new RegExp("^" + k + '="?(.+?)"?$', "m")); return m && m[1].trim(); };
const SUPABASE_URL = gv("SUPABASE_URL") || gv("VITE_SUPABASE_URL");
const SERVICE_KEY = gv("SUPABASE_SERVICE_ROLE_KEY");
if (!SUPABASE_URL || !SERVICE_KEY) { console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env"); process.exit(1); }
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const cat = JSON.parse(readFileSync(`${HS}/catalog-enriched.json`, "utf8"));
const prod = new Map();
for (const p of cat.products) if (p.graceSku) prod.set(p.graceSku, {
  family: p.family, bottleCollection: p.bottleCollection, graceSku: p.graceSku, websiteSku: p.websiteSku,
  itemName: p.itemName, itemDescription: p.itemDescription, applicator: p.applicator, capacityMl: p.capacityMl,
  heightWithCap: p.heightWithCap, heightWithoutCap: p.heightWithoutCap, diameter: p.diameter });
const decisions = JSON.parse(readFileSync(`${HS}/cylinder-decisions-FINAL.json`, "utf8"));
const goods = decisions.finalize_and_push;
const master = JSON.parse(readFileSync(`${HS}/cylinder-master-full.json`, "utf8"));
const urlOf = {}; for (const r of master) if (r.graceSku) urlOf[r.graceSku] = r.canonImageUrl;

const runId = new Date().toISOString().replace(/[:.]/g, "-");
const familySlug = "cylinder";
const isRigged = (u) => typeof u === "string" && (u.includes("/rigged/") || u.includes("__rigged"));

console.error(`Rig-and-save: ${goods.length} Goods · ${EXECUTE ? "EXECUTE" : "DRY-RUN"} · dev ${DEV}`);
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto(DEV, { waitUntil: "domcontentloaded" });

const selections = [], report = [];
let riggedN = 0, already = 0, failed = 0, skipped = 0, i = 0;
for (const sku of goods) {
  i++;
  const product = prod.get(sku); const url = urlOf[sku];
  if (!product || !url) { report.push({ sku, status: "no-source" }); skipped++; continue; }
  if (isRigged(url)) { selections.push({ sku, url }); report.push({ sku, status: "already-rigged", url }); already++; continue; }
  try {
    const { data: rows, error: qErr } = await supabase.from("generated_images")
      .select("id,library_tags").eq("organization_id", ORG_ID).eq("image_url", url).limit(1);
    if (qErr) throw new Error("query: " + qErr.message);
    if (!rows || !rows.length) { report.push({ sku, status: "row-not-found", url }); failed++; continue; }
    const row = rows[0];
    const rig = await page.evaluate(async ({ imageUrl, product, BG }) => {
      const [{ colorCorrectToTarget }, { normalizeBestBottlesRigBaseline }] = await Promise.all([
        import("/src/lib/product-image/colorCorrect.ts"),
        import("/src/lib/product-image/rigPostprocess.ts")]);
      const corrected = await colorCorrectToTarget(imageUrl, BG);
      const r = await normalizeBestBottlesRigBaseline(corrected, {
        family: product.family, bottleCollection: product.bottleCollection, graceSku: product.graceSku,
        websiteSku: product.websiteSku, itemName: product.itemName, itemDescription: product.itemDescription,
        applicator: product.applicator, capacityMl: product.capacityMl, heightWithCap: product.heightWithCap,
        heightWithoutCap: product.heightWithoutCap, diameter: product.diameter,
        capState: null, mode: null, targetBackgroundHex: BG, maskReferenceUrl: null, requireMaskControl: false });
      return { dataUrl: r.dataUrl, qaIssues: r.qaIssues, detectedBaselineYPx: r.detectedBaselineYPx, targetBaselineYPx: r.targetBaselineYPx };
    }, { imageUrl: url, product, BG });
    if (rig.detectedBaselineYPx === null || rig.targetBaselineYPx === null) {
      report.push({ sku, status: "rig-failed", issues: ["baseline not detectable"], url }); failed++; continue;
    }
    let relaxed = false;
    const issues = rig.qaIssues || [];
    if (issues.length) {
      if (!RELAX) { report.push({ sku, status: "rig-failed", issues, url }); failed++; continue; }
      let ok = true;
      for (const msg of issues) {
        const f = msg.match(/fill height ([\d.]+)% is below target range (\d+)/);
        const c = msg.match(/centerline is ([\d.]+)% from target/);
        if (f) { if ((Number(f[2]) - Number(f[1])) > RELAX_FILL) ok = false; }
        else if (c) { if (Number(c[1]) > RELAX_CENTER) ok = false; }
        else { ok = false; }   // any other issue type is not auto-acceptable
      }
      if (!ok) { report.push({ sku, status: "rig-failed", issues, url }); failed++; continue; }
      relaxed = true;
    }
    if (!EXECUTE) { report.push({ sku, status: relaxed ? "would-rig-relaxed" : "would-rig", url }); riggedN++; }
    else {
      const bytes = Buffer.from(rig.dataUrl.replace(/^data:image\/png;base64,/, ""), "base64");
      const riggedPath = `${ORG_ID}/${USER_ID}/family-batch/${familySlug}-${runId}/rigged/${sku}__rigged.png`;
      const up = await supabase.storage.from("generated-images").upload(riggedPath, bytes, { contentType: "image/png", cacheControl: "3600", upsert: true });
      if (up.error) throw new Error("upload: " + up.error.message);
      const { data: pub } = supabase.storage.from("generated-images").getPublicUrl(riggedPath);
      const riggedUrl = pub.publicUrl;
      const tags = Array.isArray(row.library_tags) ? row.library_tags : [];
      const newTags = Array.from(new Set([...tags, "canvas:2080x2288", "studio-master"]));
      const { error: uErr } = await supabase.from("generated_images").update({ image_url: riggedUrl, library_tags: newTags }).eq("id", row.id);
      if (uErr) throw new Error("update: " + uErr.message);
      selections.push({ sku, url: riggedUrl }); report.push({ sku, status: relaxed ? "rigged-relaxed" : "rigged", url: riggedUrl, issues: relaxed ? issues : undefined }); riggedN++;
    }
  } catch (e) { report.push({ sku, status: "error", error: String(e).slice(0, 200) }); failed++; }
  if (i % 20 === 0) console.error(`  ${i}/${goods.length} · rigged ${riggedN} already ${already} failed ${failed}`);
}
await browser.close();
let mergedItems = selections;
try {
  const prev = JSON.parse(readFileSync(`${HS}/_cylinder-rigged-selections.json`, "utf8")).items || [];
  const bySku = new Map();
  for (const it of prev) bySku.set(it.sku, it);
  for (const it of selections) bySku.set(it.sku, it);   // this run wins on conflict
  mergedItems = [...bySku.values()];
} catch { /* first run: no prior file */ }
writeFileSync(`${HS}/_cylinder-rigged-selections.json`, JSON.stringify({ items: mergedItems }, null, 1));
writeFileSync(`${HS}/_cylinder-rig-report.json`, JSON.stringify({ runId, mode: EXECUTE ? "execute" : "dry-run", rigged: riggedN, already, failed, skipped, report }, null, 1));
console.error(`\nDone (${EXECUTE ? "EXECUTE" : "DRY-RUN"}). rigged ${riggedN} · already-rigged ${already} · failed ${failed} · skipped ${skipped}`);
console.error(`Approve input : ${HS}/_cylinder-rigged-selections.json (${mergedItems.length} items)`);
console.error(`Report / failures: ${HS}/_cylinder-rig-report.json`);
