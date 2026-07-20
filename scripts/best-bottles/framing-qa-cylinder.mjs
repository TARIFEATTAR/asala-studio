// Cylinder-family framing-QA: measures each SELECTED canon render (from the master
// export) against its per-SKU rig target, using the app's own framingQa engine.
// Prereqs: Vite dev server running on http://127.0.0.1:8081  +  Playwright chromium.
// Writes: <BB>/pipeline/madison-hero-sync/_cylinder-framing-scores.json
import fs from "node:fs";
import { chromium } from "playwright";

const BB = "/Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Website-02-20-2026";
const HS = `${BB}/pipeline/madison-hero-sync`;
const catalog = JSON.parse(fs.readFileSync(`${HS}/catalog-enriched.json`, "utf8"));
const master  = JSON.parse(fs.readFileSync(`${HS}/cylinder-master-full.json`, "utf8"));
const targetBackgroundHex = "#F5F3EF";
const DEV = process.argv[2] || "http://127.0.0.1:8080/";  // override: node ... <url>

const prod = new Map();
for (const p of catalog.products) {
  if (!p.graceSku) continue;
  prod.set(p.graceSku, {
    graceSku: p.graceSku, websiteSku: p.websiteSku, itemName: p.itemName,
    itemDescription: p.itemDescription, bottleCollection: p.bottleCollection,
    family: p.family, category: p.category, color: p.color, capacityMl: p.capacityMl,
    applicator: p.applicator, heightWithoutCap: p.heightWithoutCap,
    heightWithCap: p.heightWithCap, diameter: p.diameter,
  });
}
const jobs = master.filter(r => r.canonImageUrl && r.canonType !== "none" && prod.has(r.graceSku));
console.error(`Measuring ${jobs.length} cylinder renders against per-SKU rig targets...`);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto(DEV, { waitUntil: "domcontentloaded" });

const results = [];
let i = 0;
for (const job of jobs) {
  const product = prod.get(job.graceSku);
  const mode = "cap-on";
  const capState = "attached";
  try {
    const qa = await page.evaluate(async ({ imageUrl, product, targetBackgroundHex, capState }) => {
      const [{ detectStrongBounds, flattenBackgroundLikePixels }, { buildFramingQaReport, getFramingDecision }, { getFamilyRigForProduct }, { colorCorrectToTarget }] = await Promise.all([
        import("/src/lib/product-image/rigPostprocess.ts"),
        import("/src/lib/product-image/framingQa.ts"),
        import("/src/lib/product-image/familyRig.ts"),
        import("/src/lib/product-image/colorCorrect.ts"),
      ]);
      const correctedDataUrl = await colorCorrectToTarget(imageUrl, targetBackgroundHex);
      const img = await new Promise((res, rej) => { const im = new Image(); im.crossOrigin = "anonymous"; im.onload = () => res(im); im.onerror = () => rej(new Error("load fail")); im.src = correctedDataUrl; });
      const cv = document.createElement("canvas"); cv.width = img.naturalWidth; cv.height = img.naturalHeight;
      const ctx = cv.getContext("2d"); ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, cv.width, cv.height);
      const raw = targetBackgroundHex.replace(/^#/, ""); const n = parseInt(raw, 16); const bg = { r:(n>>16)&255, g:(n>>8)&255, b:n&255 };
      flattenBackgroundLikePixels(data.data, bg);
      const bounds = detectStrongBounds(data.data, cv.width, cv.height, bg);
      const rig = getFamilyRigForProduct(product);
      const fq = rig ? buildFramingQaReport({ width: cv.width, height: cv.height, rig, bounds, primaryBounds: capState === "detached" ? null : bounds, baselineYPx: bounds?.bottom ?? null, capState }) : null;
      if (!fq) return { status: "no-rig", width: cv.width, height: cv.height };
      const m = fq.measurements || {};
      return {
        status: fq.status, decision: getFramingDecision(fq),
        fillHeightPct: m.fillHeightPct ?? null, targetRange: fq.target?.fillHeightRangePct ?? null,
        targetFill: fq.target?.fillHeightPct ?? null,
        baselineDeltaPx: m.baselineDeltaPx ?? null, centerDeltaPct: m.centerDeltaPct ?? null,
        failures: fq.failures, warnings: fq.warnings,
        // --- geometry for true measurement-line overlay (image-native pixels) ---
        imgW: cv.width, imgH: cv.height,
        bounds: bounds ? { top: bounds.top, bottom: bounds.bottom, left: bounds.left, right: bounds.right } : null,
        baselineYPx: m.baselineYPx ?? (bounds?.bottom ?? null),
        targetBaselineYPx: m.targetBaselineYPx ?? null,
        centerXPct: m.centerXPct ?? null,
        targetCenterXPct: (rig.primaryObjectCenterXPct ?? 50),
        rigBaselinePct: rig.baselinePct ?? null, rigFillPct: rig.fillHeightPct ?? null,
        rigFillRange: rig.fillHeightRangePct ?? null,
      };
    }, { imageUrl: job.canonImageUrl, product, targetBackgroundHex, capState });
    results.push({ graceSku: job.graceSku, canonType: job.canonType, imageUrl: job.canonImageUrl, ...qa });
  } catch (e) {
    results.push({ graceSku: job.graceSku, canonType: job.canonType, imageUrl: job.canonImageUrl, status: "error", error: String(e).slice(0,180) });
  }
  if (++i % 25 === 0) console.error(`  ${i}/${jobs.length}`);
}
await browser.close();
fs.writeFileSync(`${HS}/_cylinder-framing-scores.json`, JSON.stringify({ measuredAt: new Date().toISOString(), count: results.length, results }, null, 2));
const ok = results.filter(r => r.status && r.status !== "error").length;
console.error(`Done. ${ok}/${results.length} measured. Wrote ${HS}/_cylinder-framing-scores.json`);
