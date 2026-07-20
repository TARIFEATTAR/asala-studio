#!/usr/bin/env tsx
import { createHash, randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import {
  buildCylinderSidecarReconciliation,
  type CylinderSidecarIdentityJoinRow,
  type CylinderSidecarReadinessRow,
  type CylinderSidecarReconciliationRow,
} from "../../src/lib/bestBottlesCylinderSidecarReconciliation";

const ROOT = process.cwd();
const OUTPUT_ROOT = path.resolve(
  ROOT,
  "tmp/best-bottles-reference-production/cylinder-sidecar-reconciliation-v2",
);
const EXPORTS_ROOT = path.join(OUTPUT_ROOT, "exports");
const REVIEW_ROOT = path.join(OUTPUT_ROOT, "review-sheets");
const CONCURRENCY = Math.max(1, Number(process.env.BB_SIDECAR_RECONCILIATION_CONCURRENCY ?? "4"));
const EXPECTED = {
  targetCount: 228,
  exactPsdSidecarCount: 145,
  exactLivePdpSidecarCount: 56,
  liveTopologyExceptionCount: 27,
  blockedCount: 0,
} as const;

function sha256(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function normalizedIdentity(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function runMagick(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("magick", args, { stdio: ["ignore", "ignore", "pipe"] });
    const stderr: Buffer[] = [];
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ImageMagick failed (${code}): ${Buffer.concat(stderr).toString("utf8").trim()}`));
    });
  });
}

async function validateOpaquePng(file: string): Promise<{
  width: number;
  height: number;
  sha256: string;
  bytes: number;
}> {
  const bytes = await readFile(file);
  const image = sharp(bytes, { failOn: "error" });
  const metadata = await image.metadata();
  if (metadata.format !== "png" || !metadata.width || !metadata.height) {
    throw new Error(`${file} is not a valid PNG.`);
  }
  if (metadata.hasAlpha) {
    const alpha = await image.ensureAlpha().extractChannel(3).stats();
    if (alpha.channels[0].min !== 255 || alpha.channels[0].max !== 255) {
      throw new Error(`${file} is not fully opaque.`);
    }
  }
  return { width: metadata.width, height: metadata.height, sha256: sha256(bytes), bytes: bytes.length };
}

async function immutableFinalize(temporary: string, output: string): Promise<"created" | "reused"> {
  const candidate = await readFile(temporary);
  try {
    await writeFile(output, candidate, { flag: "wx" });
    await rm(temporary, { force: true });
    return "created";
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
  const existing = await readFile(output);
  if (sha256(existing) !== sha256(candidate)) {
    throw new Error(`Immutable output conflict at ${output}.`);
  }
  await rm(temporary, { force: true });
  return "reused";
}

async function exportPsd(row: CylinderSidecarReconciliationRow, output: string): Promise<{
  sourceKind: "psd";
  sourcePath: string;
  sourceUrl: null;
  sourceSha256: string;
  outputStatus: "created" | "reused";
}> {
  if (!row.source) throw new Error(`${row.graceSku} has no PSD source.`);
  const sourceStat = await stat(row.source.sourcePath);
  if (sourceStat.size !== row.source.sourceBytes) {
    throw new Error(`${row.graceSku} PSD byte-size mismatch.`);
  }
  const sourceBytes = await readFile(row.source.sourcePath);
  if (sha256(sourceBytes) !== row.source.sourceSha256) {
    throw new Error(`${row.graceSku} PSD SHA-256 mismatch.`);
  }
  const temporary = `${output}.tmp-${process.pid}-${randomBytes(5).toString("hex")}.png`;
  await runMagick([
    `${row.source.sourcePath}[0]`,
    "-alpha", "off",
    "-colorspace", "sRGB",
    "-define", "png:exclude-chunks=date,time",
    `PNG24:${temporary}`,
  ]);
  const rendered = await sharp(temporary).metadata();
  if (
    rendered.width !== row.source.composite?.width
    || rendered.height !== row.source.composite?.height
  ) {
    await rm(temporary, { force: true });
    throw new Error(`${row.graceSku} native PSD dimensions changed during export.`);
  }
  return {
    sourceKind: "psd",
    sourcePath: row.source.sourcePath,
    sourceUrl: null,
    sourceSha256: row.source.sourceSha256,
    outputStatus: await immutableFinalize(temporary, output),
  };
}

async function exportLivePdp(row: CylinderSidecarReconciliationRow, output: string): Promise<{
  sourceKind: "live-pdp";
  sourcePath: null;
  sourceUrl: string;
  sourceSha256: string;
  outputStatus: "created" | "reused";
}> {
  if (!row.liveSourceUrl) throw new Error(`${row.graceSku} has no live PDP source URL.`);
  const response = await fetch(row.liveSourceUrl, { redirect: "follow" });
  if (!response.ok) throw new Error(`${row.graceSku} live PDP returned HTTP ${response.status}.`);
  const sourceBytes = Buffer.from(await response.arrayBuffer());
  const metadata = await sharp(sourceBytes, { failOn: "error" }).metadata();
  if (!metadata.width || !metadata.height) throw new Error(`${row.graceSku} live PDP image is invalid.`);
  const temporary = `${output}.tmp-${process.pid}-${randomBytes(5).toString("hex")}.png`;
  await sharp(sourceBytes, { failOn: "error" })
    .flatten({ background: "#ffffff" })
    .toColorspace("srgb")
    .png({ compressionLevel: 9 })
    .toFile(temporary);
  return {
    sourceKind: "live-pdp",
    sourcePath: null,
    sourceUrl: row.liveSourceUrl,
    sourceSha256: sha256(sourceBytes),
    outputStatus: await immutableFinalize(temporary, output),
  };
}

type ExportRecord = CylinderSidecarReconciliationRow & {
  evidence: Awaited<ReturnType<typeof exportPsd>> | Awaited<ReturnType<typeof exportLivePdp>>;
  output: {
    path: string;
    filename: string;
    width: number;
    height: number;
    sha256: string;
    bytes: number;
    opaque: true;
  };
};

async function renderCard(record: ExportRecord): Promise<Buffer> {
  const cardWidth = 340;
  const cardHeight = 500;
  const image = await sharp(record.output.path)
    .resize({ width: 300, height: 390, fit: "contain", background: "#f5f3ef" })
    .png()
    .toBuffer();
  const route = record.route === "live-topology-exception" ? "LIVE TOPOLOGY EXCEPTION" : "CAP OFF + RIGHT SIDECAR";
  const label = Buffer.from(`<svg width="${cardWidth}" height="${cardHeight}">
    <rect width="100%" height="100%" fill="#f5f3ef" stroke="#b8b1a8" stroke-width="2"/>
    <text x="18" y="24" font-family="Arial,sans-serif" font-size="12" font-weight="700" fill="#174f3f">${record.websiteSku}</text>
    <text x="18" y="43" font-family="Arial,sans-serif" font-size="10" fill="#333">${record.graceSku}</text>
    <text x="18" y="480" font-family="Arial,sans-serif" font-size="11" font-weight="700" fill="${record.route === "live-topology-exception" ? "#7a4b16" : "#174f3f"}">${route}</text>
  </svg>`);
  return sharp(label).composite([{ input: image, left: 20, top: 58 }]).png().toBuffer();
}

async function buildReviewSheets(records: ExportRecord[]): Promise<string[]> {
  const pageSize = 30;
  const columns = 6;
  const cardWidth = 340;
  const cardHeight = 500;
  const paths: string[] = [];
  for (let offset = 0; offset < records.length; offset += pageSize) {
    const page = records.slice(offset, offset + pageSize);
    const cards = await Promise.all(page.map(renderCard));
    const rows = Math.ceil(page.length / columns);
    const output = path.join(REVIEW_ROOT, `cylinder-sidecar-review-${String(paths.length + 1).padStart(2, "0")}.png`);
    await sharp({
      create: { width: columns * cardWidth, height: rows * cardHeight, channels: 3, background: "#111111" },
    }).composite(cards.map((input, index) => ({
      input,
      left: (index % columns) * cardWidth,
      top: Math.floor(index / columns) * cardHeight,
    }))).png().toFile(output);
    paths.push(output);
  }
  return paths;
}

async function mapConcurrent<T, R>(items: T[], worker: (item: T) => Promise<R>): Promise<R[]> {
  const queue = [...items];
  const results: R[] = [];
  const workers = Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
    for (;;) {
      const item = queue.shift();
      if (!item) return;
      results.push(await worker(item));
    }
  });
  await Promise.all(workers);
  return results;
}

const [readiness, identityJoin] = await Promise.all([
  readFile(path.join(ROOT, "public/data/best-bottles-cylinder-production-readiness.json"), "utf8")
    .then((value) => JSON.parse(value) as { rows: CylinderSidecarReadinessRow[] }),
  readFile(path.join(ROOT, "tmp/best-bottles-reference-production/psd-cap-state-audit-v1/identity-join.json"), "utf8")
    .then((value) => JSON.parse(value) as CylinderSidecarIdentityJoinRow[]),
]);
const plan = buildCylinderSidecarReconciliation({
  readinessRows: readiness.rows,
  identityJoinRows: identityJoin,
});
if (JSON.stringify(plan.summary) !== JSON.stringify(EXPECTED)) {
  throw new Error(`Cylinder sidecar reconciliation count drift: ${JSON.stringify(plan.summary)}.`);
}

await Promise.all([mkdir(EXPORTS_ROOT, { recursive: true }), mkdir(REVIEW_ROOT, { recursive: true })]);
const records = await mapConcurrent(plan.rows, async (row): Promise<ExportRecord> => {
  if (row.route === "blocked") throw new Error(`${row.graceSku} is blocked: ${row.blockers.join(", ")}.`);
  const filename = `${normalizedIdentity(row.websiteSku)}__${normalizedIdentity(row.graceSku)}__${row.route}.png`;
  const outputPath = path.join(EXPORTS_ROOT, filename);
  const evidence = row.route === "exact-psd-sidecar"
    ? await exportPsd(row, outputPath)
    : await exportLivePdp(row, outputPath);
  const output = await validateOpaquePng(outputPath);
  return {
    ...row,
    evidence,
    output: { path: outputPath, filename, ...output, opaque: true },
  };
});
records.sort((left, right) => left.graceSku.localeCompare(right.graceSku));
const reviewSheets = await buildReviewSheets(records);
const reviewIndexPath = path.join(OUTPUT_ROOT, "index.html");
await writeFile(reviewIndexPath, `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Best Bottles Cylinder sidecar reconciliation v2</title>
<style>body{margin:0;background:#111;color:#f5f3ef;font:15px/1.4 Arial,sans-serif}header{position:sticky;top:0;z-index:1;padding:18px 24px;background:#111;border-bottom:1px solid #444}h1{margin:0 0 6px;font-size:22px}.summary{color:#b9d7ca}.sheets{padding:18px}.sheets img{display:block;width:100%;height:auto;margin:0 0 18px;border:1px solid #555}</style>
</head><body><header><h1>Cylinder sidecar reconciliation v2 — 228 exact identities</h1>
<div class="summary">145 exact PSD sidecars · 56 exact live-PDP sidecars · 27 live topology exceptions · 0 blocked</div></header>
<main class="sheets">${reviewSheets.map((sheet) => `<img src="review-sheets/${path.basename(sheet)}" alt="${path.basename(sheet)}">`).join("\n")}</main></body></html>\n`);
const artifact = {
  ...plan,
  generatedAt: new Date().toISOString(),
  contract: {
    standard: "fitment-attached-cap-right-sidecar",
    exception: "assembled-live-site-exception",
    canvasPolicy: "native-source-resolution-opaque-png-no-resize-no-ai",
    externalWrites: { supabase: false, reconciliation: false, shopify: false },
  },
  records,
  reviewSheets,
  reviewIndexPath,
};
const manifestPath = path.join(OUTPUT_ROOT, "cylinder-sidecar-reconciliation-manifest.json");
await writeFile(manifestPath, `${JSON.stringify(artifact, null, 2)}\n`);
console.log(JSON.stringify({
  summary: plan.summary,
  manifestPath,
  reviewSheets,
  reviewIndexPath,
  outputRoot: OUTPUT_ROOT,
  externalWrites: artifact.contract.externalWrites,
}, null, 2));
