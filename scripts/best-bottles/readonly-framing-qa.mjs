import fs from "node:fs";

import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const ROOT =
  "/Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Website-02-20-2026";
const convexSnapshotPath = `${ROOT}/data/audits/2026-06-27-framing-profiles/convex_snapshot.json`;
const organizationId = "4ab1ac72-cd7e-4faf-9152-5aa5f2862411";
const targetBackgroundHex = "#F5F3EF";

const runId = process.argv[2];
if (!runId) {
  throw new Error("Usage: node scripts/best-bottles/readonly-framing-qa.mjs <smoke-run-id>");
}

function loadEnv() {
  const env = {};
  for (const file of [".env", ".env.local"]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split(/\n/)) {
      const match = line.match(/^\s*([A-Za-z0-9_]+)=(.*)$/);
      if (match) env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
    }
  }
  return env;
}

function getText(row, key) {
  const value = row[key];
  return typeof value === "string" ? value : value == null ? null : String(value);
}

function getNumber(row, key) {
  const value = row[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function tagValue(tags, prefix) {
  const tag = Array.isArray(tags) ? tags.find((item) => item.startsWith(prefix)) : null;
  return tag ? tag.slice(prefix.length) : null;
}

function productFromSnapshot(row) {
  return {
    graceSku: getText(row, "graceSku"),
    websiteSku: getText(row, "websiteSku"),
    itemName: getText(row, "itemName"),
    itemDescription: getText(row, "itemDescription"),
    bottleCollection: getText(row, "bottleCollection"),
    family: getText(row, "family"),
    category: getText(row, "category"),
    color: getText(row, "color"),
    capacityMl: getNumber(row, "capacityMl"),
    applicator: getText(row, "applicator"),
    heightWithoutCap: getText(row, "heightWithoutCap"),
    heightWithCap: getText(row, "heightWithCap"),
    diameter: getText(row, "diameter"),
  };
}

const env = loadEnv();
const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) throw new Error("Missing Supabase URL/service role key.");

const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
const snapshot = JSON.parse(fs.readFileSync(convexSnapshotPath, "utf8"));
const productsBySku = new Map(
  snapshot.products
    .map((row) => [getText(row, "graceSku"), productFromSnapshot(row)])
    .filter(([sku]) => sku),
);

const { data: rows, error } = await supabase
  .from("generated_images")
  .select("id,image_url,library_tags,generation_provider,created_at")
  .eq("organization_id", organizationId)
  .contains("library_tags", [`smoke-run:${runId}`])
  .order("created_at", { ascending: true });
if (error) throw error;
if (!rows?.length) throw new Error(`No generated_images rows found for smoke run ${runId}.`);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto("http://127.0.0.1:8081/", { waitUntil: "domcontentloaded" });

const results = [];

for (const row of rows) {
  const sku = tagValue(row.library_tags, "sku:");
  if (!sku) throw new Error(`Could not infer SKU from tags for ${row.id}.`);
  const product = productsBySku.get(sku);
  if (!product) throw new Error(`Missing product snapshot row for ${sku}.`);
  const mode = tagValue(row.library_tags, "mode:");
  const capState = tagValue(row.library_tags, "cap-state:");

  const qa = await page.evaluate(
    async ({ imageUrl, product, targetBackgroundHex, mode, capState }) => {
      const [
        { colorCorrectToTarget },
        {
          detectStrongBounds,
          flattenBackgroundLikePixels,
          normalizeBestBottlesRigBaseline,
        },
        { buildFramingQaReport, getFramingDecision },
        { getFamilyRigForProduct },
      ] = await Promise.all([
        import("/src/lib/product-image/colorCorrect.ts"),
        import("/src/lib/product-image/rigPostprocess.ts"),
        import("/src/lib/product-image/framingQa.ts"),
        import("/src/lib/product-image/familyRig.ts"),
      ]);
      const correctedDataUrl = await colorCorrectToTarget(imageUrl, targetBackgroundHex);
      const rawImage = await new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Failed to load corrected image: ${correctedDataUrl}`));
        img.src = correctedDataUrl;
      });
      const rawCanvas = document.createElement("canvas");
      rawCanvas.width = rawImage.naturalWidth;
      rawCanvas.height = rawImage.naturalHeight;
      const rawCtx = rawCanvas.getContext("2d");
      if (!rawCtx) throw new Error("Unable to acquire raw QA canvas context");
      rawCtx.drawImage(rawImage, 0, 0);
      const rawImageData = rawCtx.getImageData(0, 0, rawCanvas.width, rawCanvas.height);
      const bg = (() => {
        const raw = targetBackgroundHex.replace(/^#/, "");
        const n = Number.parseInt(raw, 16);
        return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
      })();
      flattenBackgroundLikePixels(rawImageData.data, bg);
      const rawBounds = detectStrongBounds(
        rawImageData.data,
        rawCanvas.width,
        rawCanvas.height,
        bg,
      );
      const rig = getFamilyRigForProduct({
        family: product.family,
        bottleCollection: product.bottleCollection,
        graceSku: product.graceSku,
        websiteSku: product.websiteSku,
        itemName: product.itemName,
        itemDescription: product.itemDescription,
        applicator: product.applicator,
        capacityMl: product.capacityMl,
        heightWithCap: product.heightWithCap,
        heightWithoutCap: product.heightWithoutCap,
        diameter: product.diameter,
      });
      const rawFramingQa = rig
        ? buildFramingQaReport({
            width: rawCanvas.width,
            height: rawCanvas.height,
            rig,
            bounds: rawBounds,
            primaryBounds: capState === "detached" ? null : rawBounds,
            baselineYPx: rawBounds?.bottom ?? null,
            capState,
          })
        : null;
      const rigged = await normalizeBestBottlesRigBaseline(correctedDataUrl, {
        family: product.family,
        bottleCollection: product.bottleCollection,
        graceSku: product.graceSku,
        websiteSku: product.websiteSku,
        itemName: product.itemName,
        itemDescription: product.itemDescription,
        applicator: product.applicator,
        capacityMl: product.capacityMl,
        heightWithCap: product.heightWithCap,
        heightWithoutCap: product.heightWithoutCap,
        diameter: product.diameter,
        capState,
        mode,
        targetBackgroundHex,
        maskReferenceUrl: null,
        requireMaskControl: false,
      });
      return {
        rawFramingQa,
        rawDecision: rawFramingQa ? getFramingDecision(rawFramingQa) : null,
        rawBounds,
        qaIssues: rigged.qaIssues,
        shifted: rigged.shifted,
        shiftXPx: rigged.shiftXPx,
        shiftYPx: rigged.shiftYPx,
        scale: rigged.scale,
        detectedBaselineYPx: rigged.detectedBaselineYPx,
        targetBaselineYPx: rigged.targetBaselineYPx,
        framingQa: rigged.framingQa,
        framingDecision: rigged.framingDecision,
      };
    },
    {
      imageUrl: row.image_url,
      product,
      targetBackgroundHex,
      mode,
      capState,
    },
  );

  results.push({
    runId,
    imageId: row.id,
    sku,
    caseId: tagValue(row.library_tags, "smoke-case:"),
    websiteSku: product.websiteSku,
    provider: row.generation_provider,
    modelTag: tagValue(row.library_tags, "model:"),
    promptFrame: tagValue(row.library_tags, "prompt-frame:"),
    mode,
    capState,
    rawQa: qa.rawFramingQa
      ? {
          status: qa.rawFramingQa.status,
          decision: qa.rawDecision,
          fillHeightPct: qa.rawFramingQa.measurements?.fillHeightPct ?? null,
          targetRange: qa.rawFramingQa.target?.fillHeightRangePct ?? null,
          targetFill: qa.rawFramingQa.target?.fillHeightPct ?? null,
          baselineDeltaPx: qa.rawFramingQa.measurements?.baselineDeltaPx ?? null,
          centerDeltaPct: qa.rawFramingQa.measurements?.centerDeltaPct ?? null,
          failures: qa.rawFramingQa.failures,
          warnings: qa.rawFramingQa.warnings,
        }
      : null,
    normalizedQa: qa.framingQa
      ? {
          status: qa.framingQa.status,
          decision: qa.framingDecision,
          fillHeightPct: qa.framingQa.measurements?.fillHeightPct ?? null,
          targetRange: qa.framingQa.target?.fillHeightRangePct ?? null,
          targetFill: qa.framingQa.target?.fillHeightPct ?? null,
          baselineDeltaPx: qa.framingQa.measurements?.baselineDeltaPx ?? null,
          centerDeltaPct: qa.framingQa.measurements?.centerDeltaPct ?? null,
          failures: qa.framingQa.failures,
          warnings: qa.framingQa.warnings,
        }
      : null,
    status: qa.rawFramingQa?.status ?? qa.framingQa?.status ?? null,
    decision: qa.rawDecision ?? qa.framingDecision ?? null,
    fillHeightPct: qa.rawFramingQa?.measurements?.fillHeightPct ?? null,
    targetRange: qa.rawFramingQa?.target?.fillHeightRangePct ?? null,
    targetFill: qa.rawFramingQa?.target?.fillHeightPct ?? null,
    baselineDeltaPx: qa.rawFramingQa?.measurements?.baselineDeltaPx ?? null,
    centerDeltaPct: qa.rawFramingQa?.measurements?.centerDeltaPct ?? null,
    scale: qa.scale,
    shiftXPx: qa.shiftXPx,
    shiftYPx: qa.shiftYPx,
    issues: qa.qaIssues,
    imageUrl: row.image_url,
  });
}

await browser.close();

console.log(JSON.stringify({ runId, results }, null, 2));
