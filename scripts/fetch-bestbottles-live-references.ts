#!/usr/bin/env tsx
/**
 * Fetch bestbottles.com live reference GIFs for every SKU that has NO local
 * reference PNG, convert them to flattened PNGs, and emit chunked cap-on
 * generation manifests for the prompt-ready rows.
 *
 * Source rows: tmp/best-bottles-reference-backed-cap-on-all-audit.json
 *   (referenceStatus === "live-site-fallback", liveReferenceUrl present)
 *
 * Outputs:
 *   BB repo  renders/live-reference-refs-2026-06-11/cap-on/{graceSku}.png
 *   tmp/best-bottles-live-reference-batch-00N.json   (prompt-ready only)
 *   tmp/best-bottles-live-reference-fetch-report.csv
 *
 * Resume-safe: existing PNGs are skipped. Re-run freely.
 *
 *   npx tsx scripts/fetch-bestbottles-live-references.ts            # fetch + manifests
 *   npx tsx scripts/fetch-bestbottles-live-references.ts --dry-run  # plan only
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import sharp from "sharp";

const BB_REPO_ROOT =
  "/Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Website-02-20-2026";
const STAMP = "2026-06-11";
const PIPELINE_LANE_ID = "grid-card-2000x2200";
const CHUNK_SIZE = 150;

const { values } = parseArgs({
  options: {
    audit: { type: "string", default: "tmp/best-bottles-reference-backed-cap-on-all-audit.json" },
    "out-root": {
      type: "string",
      default: `${BB_REPO_ROOT}/pipeline/madison-hero-sync/renders/live-reference-refs-${STAMP}`,
    },
    "manifest-prefix": { type: "string", default: "tmp/best-bottles-live-reference-batch" },
    "dry-run": { type: "boolean", default: false },
    concurrency: { type: "string", default: "6" },
  },
});

type AuditRow = {
  graceSku: string;
  websiteSku: string | null;
  family: string | null;
  materialBucket: string | null;
  promptReady: boolean;
  referenceStatus: string;
  referenceSource: string | null;
  absoluteReferencePath: string | null;
  liveReferenceUrl: string | null;
  missingPromptFields: string[];
};

const auditPath = resolve(values.audit as string);
const outRoot = resolve(values["out-root"] as string);
const capOnDir = join(outRoot, "cap-on");
const dryRun = values["dry-run"] as boolean;
const concurrency = Math.max(1, parseInt(values.concurrency as string, 10) || 6);

const audit = JSON.parse(readFileSync(auditPath, "utf-8"));
const rows: AuditRow[] = (audit.rows ?? []).filter(
  (r: AuditRow) => r.referenceStatus === "live-site-fallback" && r.liveReferenceUrl,
);
const ready = rows.filter((r) => r.promptReady);
const blocked = rows.filter((r) => !r.promptReady);

console.log(`Live-fallback rows with URL: ${rows.length}`);
console.log(`  prompt-ready (will get manifests): ${ready.length}`);
console.log(`  prompt-incomplete (refs downloaded anyway, generation blocked): ${blocked.length}`);
console.log(`Reference output: ${capOnDir}`);

if (dryRun) {
  for (const r of rows.slice(0, 10)) {
    console.log(`  ${r.graceSku}  ←  ${r.liveReferenceUrl}`);
  }
  console.log(`  … and ${Math.max(0, rows.length - 10)} more`);
  process.exit(0);
}

mkdirSync(capOnDir, { recursive: true });

type FetchResult = {
  graceSku: string;
  status: "ok" | "skipped" | "error";
  outPath: string;
  width?: number;
  height?: number;
  upscaled?: boolean;
  error?: string;
};

async function fetchOne(row: AuditRow): Promise<FetchResult> {
  const outPath = join(capOnDir, `${row.graceSku}.png`);
  if (existsSync(outPath)) {
    return { graceSku: row.graceSku, status: "skipped", outPath };
  }
  try {
    const res = await fetch(row.liveReferenceUrl!, {
      headers: { "User-Agent": "Mozilla/5.0 (BestBottles internal asset sync)" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());

    // GIF → PNG, flatten onto white (legacy refs are white-background
    // catalog shots; transparency or dithering edges get cleaned up).
    let img = sharp(buf, { animated: false }).flatten({
      background: { r: 255, g: 255, b: 255 },
    });
    const meta = await sharp(buf).metadata();
    const maxDim = Math.max(meta.width ?? 0, meta.height ?? 0);
    let upscaled = false;
    // Legacy enlarged_pics GIFs are small (~300-600px). Give gpt-image-2 a
    // cleaner conditioning signal with a 2x lanczos upscale when under 1000px.
    if (maxDim > 0 && maxDim < 1000) {
      img = img.resize({
        width: (meta.width ?? 0) * 2,
        height: (meta.height ?? 0) * 2,
        kernel: "lanczos3",
        fit: "fill",
      });
      upscaled = true;
    }
    const png = await img.png().toBuffer();
    writeFileSync(outPath, png);
    const outMeta = await sharp(png).metadata();
    return {
      graceSku: row.graceSku,
      status: "ok",
      outPath,
      width: outMeta.width,
      height: outMeta.height,
      upscaled,
    };
  } catch (err) {
    return {
      graceSku: row.graceSku,
      status: "error",
      outPath,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function run() {
  const results: FetchResult[] = [];
  let idx = 0;
  async function worker() {
    while (idx < rows.length) {
      const row = rows[idx++];
      const r = await fetchOne(row);
      results.push(r);
      const tag = `[${results.length}/${rows.length}] ${r.graceSku}`;
      if (r.status === "ok") {
        console.log(`${tag} ✓ ${r.width}x${r.height}${r.upscaled ? " (2x upscaled)" : ""}`);
      } else if (r.status === "skipped") {
        console.log(`${tag} ◦ skip (exists)`);
      } else {
        console.log(`${tag} ✗ ${r.error}`);
      }
      // polite pacing against the legacy site
      await new Promise((s) => setTimeout(s, 150));
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));

  // Report CSV
  const reportPath = resolve("tmp/best-bottles-live-reference-fetch-report.csv");
  const csv = [
    "graceSku,status,outPath,width,height,upscaled,error",
    ...results.map((r) =>
      [r.graceSku, r.status, r.outPath, r.width ?? "", r.height ?? "", r.upscaled ?? "", JSON.stringify(r.error ?? "")].join(","),
    ),
  ].join("\n");
  writeFileSync(reportPath, csv + "\n");
  console.log(`\nFetch report: ${reportPath}`);

  const okSet = new Set(
    results.filter((r) => r.status === "ok" || r.status === "skipped").map((r) => r.graceSku),
  );

  // Manifests — prompt-ready rows whose reference downloaded successfully.
  const manifestRows = ready
    .filter((r) => okSet.has(r.graceSku))
    .map((r, i) => ({
      cycleId: `best-bottles-live-reference-${STAMP}`,
      launchOrder: i + 1,
      pipelineLaneId: PIPELINE_LANE_ID,
      mode: "cap-on" as const,
      graceSku: r.graceSku,
      websiteSku: r.websiteSku,
      family: r.family,
      materialBucket: r.materialBucket,
      referenceSource: "bestbottles.com-live-downloaded",
      liveReferenceUrl: r.liveReferenceUrl,
      absoluteReferencePath: join(capOnDir, `${r.graceSku}.png`),
      expectedCanonicalFilename: `${r.graceSku}.png`,
    }));

  const prefix = resolve(values["manifest-prefix"] as string);
  const chunkCount = Math.ceil(manifestRows.length / CHUNK_SIZE);
  for (let c = 0; c < chunkCount; c++) {
    const chunk = manifestRows.slice(c * CHUNK_SIZE, (c + 1) * CHUNK_SIZE);
    const n = String(c + 1).padStart(3, "0");
    const payload = {
      generatedAt: new Date().toISOString(),
      source: "fetch-bestbottles-live-references.ts",
      sourceCandidateMode: "cap-on",
      referenceScope: "bestbottles.com-live-downloaded",
      pipelineLaneId: PIPELINE_LANE_ID,
      mode: "cap-on",
      cycleId: `best-bottles-live-reference-batch-${n}-${STAMP}`,
      launchOrder: 1,
      totalRows: chunk.length,
      chunkIndex: c + 1,
      chunkCount,
      rows: chunk,
    };
    writeFileSync(`${prefix}-${n}.json`, JSON.stringify(payload, null, 2));
    console.log(`Manifest: ${prefix}-${n}.json (${chunk.length} rows)`);
  }

  const errors = results.filter((r) => r.status === "error");
  console.log(
    `\nDone — ${results.filter((r) => r.status === "ok").length} fetched, ` +
      `${results.filter((r) => r.status === "skipped").length} skipped, ${errors.length} errors, ` +
      `${manifestRows.length} generation-ready rows across ${chunkCount} manifests.`,
  );
  if (errors.length) process.exitCode = 2;
}

run();
