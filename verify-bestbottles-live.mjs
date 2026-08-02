// verify-bestbottles-live.mjs
// GO-LIVE VERIFIER — does every APPROVED Best Bottles image actually reach the customer?
//
// The customer-facing PDP reads its image from CONVEX (products.imageUrl of the
// variant), NOT from Shopify directly. When Madison pushes, the Shopify CDN URL is
// written to BOTH the sku-job's `shopify_image_url` AND to Convex. So the true
// "is it live?" check per SKU is:  Convex.imageUrl  ==  job.shopify_image_url
// (a naive compare against Madison's Supabase image_url would falsely fail everything,
//  because the push re-hosts the bytes on the Shopify CDN.)
//
// This script is READ-ONLY. It writes nothing to Supabase, Shopify, or Convex.
// It reads keys from the Madison repo .env; nothing secret is printed.
// Node 18+ (global fetch).
//
//   node verify-bestbottles-live.mjs                # Cylinder family (default)
//   node verify-bestbottles-live.mjs --family Empire
//   node verify-bestbottles-live.mjs --all          # every approved BB image
//
import { readFileSync } from "node:fs";

// ---- config / env ----------------------------------------------------------
const args = process.argv.slice(2);
const ALL = args.includes("--all");
const FAMILY = (() => {
  const i = args.indexOf("--family");
  return i >= 0 && args[i + 1] ? args[i + 1] : "Cylinder";
})();

const MADISON_ENV =
  process.env.MADISON_ENV ||
  "/Users/jordanrichter/Projects/Madison Studio/madison-app/.env";
const WEBSITE_ENV =
  process.env.WEBSITE_ENV ||
  "/Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Website-02-20-2026/.env.local";
const ORG_ID =
  process.env.MADISON_BEST_BOTTLES_ORG_ID ||
  "4ab1ac72-cd7e-4faf-9152-5aa5f2862411";

function readEnvFile(path) {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}
function grab(text, key) {
  const m = text.match(new RegExp("^" + key + '="?(.+?)"?$', "m"));
  return m && m[1].trim();
}

const madEnv = readEnvFile(MADISON_ENV);
const webEnv = readEnvFile(WEBSITE_ENV);

const SUPABASE_URL = grab(madEnv, "SUPABASE_URL") || grab(madEnv, "VITE_SUPABASE_URL");
const SUPABASE_KEY =
  grab(madEnv, "SUPABASE_SERVICE_ROLE_KEY") ||
  grab(madEnv, "SUPABASE_ANON_KEY") ||
  grab(madEnv, "VITE_SUPABASE_PUBLISHABLE_KEY");
const CONVEX_URL = (
  grab(madEnv, "BESTBOTTLES_CONVEX_URL") ||
  grab(webEnv, "NEXT_PUBLIC_CONVEX_URL") ||
  grab(webEnv, "CONVEX_URL") ||
  ""
).replace(/\/+$/, "");

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(`Could not read SUPABASE_URL / key from ${MADISON_ENV}`);
  process.exit(1);
}
if (!CONVEX_URL) {
  console.error(
    `Could not read Convex URL. Set BESTBOTTLES_CONVEX_URL in the Madison .env ` +
      `or NEXT_PUBLIC_CONVEX_URL in ${WEBSITE_ENV}, or export CONVEX_URL=...`,
  );
  process.exit(1);
}

// ---- helpers ---------------------------------------------------------------
const APPROVED_TAG = "status:approved-keep";
const tagVal = (tags, prefix) => {
  const t = (tags || []).find((x) => String(x).startsWith(prefix));
  return t ? String(t).slice(prefix.length) : null;
};
const isSanity = (u) => !!u && /cdn\.sanity\.io/i.test(u);
const isShopifyCdn = (u) => !!u && /cdn\.shopify\.com/i.test(u);
const stripV = (u) => (u ? String(u).split(/[?#]/)[0] : u); // drop ?v=… version param
const eqUrl = (a, b) => !!a && !!b && a === b;
const eqBase = (a, b) => !!a && !!b && stripV(a) === stripV(b);

function matchesFamily(fam, graceSku) {
  if (ALL) return true;
  const target = FAMILY.toLowerCase();
  if (fam) return fam.toLowerCase() === target; // family tag is authoritative
  const hint = { cylinder: "CYL", empire: "EMP", "boston round": "BOS", royal: "ROY", flair: "FLA", atomizer: "ATO", diva: "DIV" }[target];
  return hint ? graceSku.toUpperCase().includes(hint) : false; // fallback when no family tag
}

async function pool(items, size, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx], idx);
      }
    }),
  );
  return out;
}

// ---- 1. Supabase: approved images + their sku-job rows ---------------------
async function sbGet(pathAndQuery) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY },
  });
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

async function pullApprovedImages() {
  const PAGE = 1000;
  const rows = [];
  for (let offset = 0; ; offset += PAGE) {
    const page = await sbGet(
      `generated_images?select=id,image_url,library_tags,created_at,is_archived` +
        `&organization_id=eq.${ORG_ID}&is_archived=eq.false` +
        `&order=created_at.desc&limit=${PAGE}&offset=${offset}`,
    );
    rows.push(...page);
    if (page.length < PAGE) break;
  }
  // keep only approved-keep, newest row per graceSku
  const bySku = new Map();
  for (const r of rows) {
    const tags = r.library_tags || [];
    if (!tags.includes(APPROVED_TAG)) continue;
    const graceSku = tagVal(tags, "sku:");
    if (!graceSku) continue;
    const fam = tagVal(tags, "family:") || "";
    if (!matchesFamily(fam, graceSku)) continue;
    if (!bySku.has(graceSku)) {
      bySku.set(graceSku, {
        graceSku,
        websiteSku: tagVal(tags, "websiteSku:"),
        family: fam || null,
        madisonImageUrl: r.image_url, // Supabase-hosted rigged PNG (pre-push)
      });
    }
  }
  return [...bySku.values()];
}

async function pullJobs() {
  const famClause = ALL ? "" : `&family=eq.${encodeURIComponent(FAMILY)}`;
  const rows = await sbGet(
    `best_bottles_pipeline_sku_jobs?select=grace_sku,website_sku,shopify_sku,status,` +
      `approved_image_url,shopify_image_url,shopify_media_id,shopify_product_id,shopify_variant_id` +
      `&organization_id=eq.${ORG_ID}${famClause}&limit=5000`,
  );
  const byGrace = new Map();
  for (const j of rows) if (j.grace_sku) byGrace.set(j.grace_sku, j);
  return byGrace;
}

// ---- 2. Convex: what the storefront actually serves ------------------------
async function convexQuery(path, qArgs) {
  const r = await fetch(`${CONVEX_URL}/api/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, args: qArgs, format: "json" }),
  });
  const body = await r.json().catch(() => null);
  if (!r.ok || !body || body.status === "error") {
    throw new Error(`Convex ${path} ${r.status}: ${body?.errorMessage || "error"}`);
  }
  return body.value; // product doc or null
}
async function convexProduct(graceSku, websiteSku) {
  try {
    let p = await convexQuery("products:getBySku", { graceSku });
    if (!p && websiteSku) p = await convexQuery("products:getByWebsiteSku", { websiteSku });
    return p || null;
  } catch (e) {
    return { __error: String(e.message || e) };
  }
}

// ---- 3. classify -----------------------------------------------------------
function classify(row) {
  const job = row.job;
  const conv = row.convex;
  const pushed =
    job && (job.status === "shopify-pushed" || job.status === "synced" || !!job.shopify_image_url);
  const shopUrl = job?.shopify_image_url || null;

  if (conv && conv.__error) return { verdict: "CONVEX_ERROR", note: conv.__error };
  if (!conv) return { verdict: "NO_CONVEX_PRODUCT", note: "SKU not found in storefront catalog (identity/mapping gap)" };

  const cImg = conv.imageUrl || null;
  if (cImg && isSanity(cImg))
    return { verdict: "DRIFT_STALE", note: "Convex imageUrl is a Sanity URL — storefront rejects it → placeholder" };

  if (!pushed) {
    return {
      verdict: "APPROVED_NOT_PUSHED",
      note: cImg ? "approved in Madison, not yet pushed; Convex still holds a prior image" : "approved in Madison, not yet pushed; Convex empty",
    };
  }

  // pushed:
  if (!cImg) return { verdict: "DRIFT_STALE", note: "pushed to Shopify but Convex imageUrl is EMPTY (Convex write failed)" };
  if (eqUrl(cImg, shopUrl)) return { verdict: "LIVE_MATCH", note: "Convex serves the pushed Shopify image" };
  if (eqBase(cImg, shopUrl)) return { verdict: "LIVE_MATCH", note: "Convex serves the pushed image (differs only by ?v= version param)" };
  return {
    verdict: "DRIFT_STALE",
    note: "pushed, but Convex imageUrl != job.shopify_image_url (Convex holds a DIFFERENT/older image)",
  };
}

// ---- run -------------------------------------------------------------------
console.log(`\n=== Best Bottles GO-LIVE verifier — ${ALL ? "ALL families" : FAMILY} ===`);
console.log(`org ${ORG_ID}`);
console.log(`Convex ${CONVEX_URL}`);

const approved = await pullApprovedImages();
console.log(`\napproved-keep SKUs to verify: ${approved.length}`);
if (approved.length === 0) {
  console.log(`(none tagged ${APPROVED_TAG} for this scope — run apply-gallery-selections first, or use --all)`);
  process.exit(0);
}

const jobs = await pullJobs();
console.log(`sku-job rows loaded: ${jobs.size}`);

process.stdout.write(`querying Convex for ${approved.length} SKUs …`);
const rows = await pool(approved, 6, async (a) => {
  const job = jobs.get(a.graceSku) || null;
  const convex = await convexProduct(a.graceSku, a.websiteSku);
  const row = { ...a, job, convex };
  row.result = classify(row);
  return row;
});
console.log(" done");

// ---- report ----------------------------------------------------------------
const order = ["LIVE_MATCH", "DRIFT_STALE", "APPROVED_NOT_PUSHED", "NO_CONVEX_PRODUCT", "CONVEX_ERROR"];
const counts = {};
for (const r of rows) counts[r.result.verdict] = (counts[r.result.verdict] || 0) + 1;

const ICON = {
  LIVE_MATCH: "✅",
  DRIFT_STALE: "❌",
  APPROVED_NOT_PUSHED: "⏳",
  NO_CONVEX_PRODUCT: "❓",
  CONVEX_ERROR: "⚠️ ",
};
console.log(`\n=== VERDICT SUMMARY (${rows.length} approved SKUs) ===`);
for (const k of order) if (counts[k]) console.log(`  ${ICON[k]} ${String(counts[k]).padStart(4)}  ${k}`);

const live = counts.LIVE_MATCH || 0;
console.log(
  `\n  → ${live}/${rows.length} approved images are confirmed LIVE for the customer` +
    ` (${Math.round((live / rows.length) * 100)}%).`,
);

// actionable worklists
const problems = rows.filter((r) => r.result.verdict !== "LIVE_MATCH");
if (problems.length) {
  console.log(`\n=== NEEDS ATTENTION (${problems.length}) ===`);
  for (const k of order.filter((v) => v !== "LIVE_MATCH")) {
    const grp = problems.filter((r) => r.result.verdict === k);
    if (!grp.length) continue;
    console.log(`\n${ICON[k]} ${k} — ${grp.length}`);
    for (const r of grp.slice(0, 40)) {
      console.log(`   ${r.graceSku.padEnd(28)} ${r.result.note}`);
    }
    if (grp.length > 40) console.log(`   … +${grp.length - 40} more (see JSON)`);
  }
}

// full JSON for follow-up tooling
const outPath = `bestbottles-live-verify-${ALL ? "all" : FAMILY}.json`;
const { writeFileSync } = await import("node:fs");
writeFileSync(
  outPath,
  JSON.stringify(
    {
      generatedFor: ALL ? "all" : FAMILY,
      org: ORG_ID,
      convexUrl: CONVEX_URL,
      total: rows.length,
      counts,
      rows: rows.map((r) => ({
        graceSku: r.graceSku,
        websiteSku: r.websiteSku,
        family: r.family,
        verdict: r.result.verdict,
        note: r.result.note,
        jobStatus: r.job?.status ?? null,
        jobShopifyImageUrl: r.job?.shopify_image_url ?? null,
        convexImageUrl: r.convex && !r.convex.__error ? r.convex.imageUrl ?? null : null,
        convexImageUrlCapOff: r.convex && !r.convex.__error ? r.convex.imageUrlCapOff ?? null : null,
        madisonImageUrl: r.madisonImageUrl,
      })),
    },
    null,
    2,
  ),
);
console.log(`\nFull per-SKU detail written: ${outPath}`);
console.log(
  `\nLegend:\n` +
    `  ✅ LIVE_MATCH          customer sees the approved image (Convex == pushed Shopify URL)\n` +
    `  ❌ DRIFT_STALE         pushed but Convex serves a DIFFERENT/empty/Sanity image → customer sees wrong/placeholder\n` +
    `  ⏳ APPROVED_NOT_PUSHED  approved in Madison but never published to Shopify/Convex yet\n` +
    `  ❓ NO_CONVEX_PRODUCT    SKU isn't in the storefront catalog at all (identity/mapping gap)\n` +
    `\nNote: this checks each variant's own imageUrl. The PDP *hero* shows the group's PRIMARY\n` +
    `variant — a non-primary SKU can be LIVE_MATCH yet not be the big image until its group's\n` +
    `primary pointer is set. That's a separate check we can add if needed.\n`,
);
