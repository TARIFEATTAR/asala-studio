import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import sharp from "sharp";

import type {
  PsdAuditRecord,
  PsdReviewUnit,
} from "../../src/lib/bestBottlesPsdCapStateAudit";

export const PSD_REVIEW_QUEUE_ORDER = [
  "identity-blockers",
  "evidence-blockers",
  "unmatched",
  "ambiguous-layout",
  "exact-matched",
] as const;

export type PsdReviewQueue = (typeof PSD_REVIEW_QUEUE_ORDER)[number];

export interface PsdReviewSheetTile {
  reviewUnitKey: string;
  reviewUnitKeySuffix: string;
  sourceSha256: string;
  websiteSku: string | null;
  graceSku: string | null;
  family: string | null;
  sourceRelativeBasename: string;
  sourceRelativePath: string;
  identityStatus: PsdAuditRecord["identityStatus"];
  machineRoutingHints: string[];
  previewPath: string | null;
}

export interface PsdReviewSheet {
  id: string;
  queue: PsdReviewQueue;
  family: string | null;
  cohort: string | null;
  page: number;
  filename: string;
  tiles: PsdReviewSheetTile[];
}

export interface PsdReviewSheetPlan {
  tilesPerSheet: number;
  sheets: PsdReviewSheet[];
}

export interface BuildPsdReviewSheetPlanOptions {
  tilesPerSheet?: number;
}

export interface RenderPsdReviewSheetsOptions extends BuildPsdReviewSheetPlanOptions {
  outputRoot: string;
}

export interface RenderPsdReviewSheetsResult {
  plan: PsdReviewSheetPlan;
  sheetPaths: string[];
  manifestPath: string;
  indexPath: string;
}

const SHEET_WIDTH = 2_000;
const SHEET_HEIGHT = 2_400;
const SHEET_COLUMNS = 5;
const SHEET_ROWS = 4;
const TILE_WIDTH = SHEET_WIDTH / SHEET_COLUMNS;
const TILE_HEIGHT = SHEET_HEIGHT / SHEET_ROWS;
const DEFAULT_AUDIT_ROOT = "tmp/best-bottles-reference-production/psd-cap-state-audit-v1";

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function queueForUnit(unit: PsdReviewUnit): PsdReviewQueue {
  const representative = unit.representative;
  if (["ambiguous", "conflict"].includes(representative.identityStatus)) {
    return "identity-blockers";
  }
  if (representative.composite === null || !representative.composite.previewPath) {
    return "evidence-blockers";
  }
  if (representative.identityStatus === "unmatched") {
    return "unmatched";
  }
  if (["ambiguous-manual-review", "multi-product-layout"].includes(
    representative.machineTriage.proposedClassification,
  )) {
    return "ambiguous-layout";
  }
  return "exact-matched";
}

function optionalCanonicalValue(unit: PsdReviewUnit, keys: readonly string[]): string | null {
  const candidates = [
    unit as unknown as Record<string, unknown>,
    unit.representative as unknown as Record<string, unknown>,
  ];
  for (const candidate of candidates) {
    for (const key of keys) {
      const value = candidate[key];
      if ((typeof value === "string" || typeof value === "number") && String(value).trim() !== "") {
        return String(value).trim();
      }
    }
  }
  return null;
}

function normalizeCohortToken(value: string): string {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function exactCohort(unit: PsdReviewUnit): string | null {
  const capacity = optionalCanonicalValue(unit, ["capacityMl", "capacity_ml"]);
  const applicator = optionalCanonicalValue(unit, ["applicator", "applicatorType"]);
  if (capacity === null && applicator === null) {
    return null;
  }
  const capacityToken = capacity === null ? "capacity-unspecified" : `${normalizeCohortToken(capacity)}ml`;
  const applicatorToken = applicator === null ? "applicator-unspecified" : normalizeCohortToken(applicator);
  return `${capacityToken}--${applicatorToken}`;
}

function filenameToken(value: string | null, fallback: string): string {
  const token = normalizeCohortToken(value ?? "");
  return token || fallback;
}

function toTile(unit: PsdReviewUnit): PsdReviewSheetTile {
  const representative = unit.representative;
  return {
    reviewUnitKey: unit.reviewUnitKey,
    reviewUnitKeySuffix: unit.reviewUnitKey.slice(-16),
    sourceSha256: unit.sourceSha256,
    websiteSku: unit.websiteSku,
    graceSku: unit.graceSku,
    family: unit.family,
    sourceRelativeBasename: basename(representative.sourceRelativePath),
    sourceRelativePath: representative.sourceRelativePath,
    identityStatus: representative.identityStatus,
    machineRoutingHints: [...representative.machineTriage.reasons],
    previewPath: representative.composite?.previewPath ?? null,
  };
}

export function buildPsdReviewSheetPlan(
  units: readonly PsdReviewUnit[],
  options: BuildPsdReviewSheetPlanOptions = {},
): PsdReviewSheetPlan {
  const tilesPerSheet = options.tilesPerSheet ?? 20;
  if (!Number.isInteger(tilesPerSheet) || tilesPerSheet <= 0) {
    throw new Error("tilesPerSheet must be a positive integer.");
  }
  const reviewUnitKeys = units.map((unit) => unit.reviewUnitKey);
  if (new Set(reviewUnitKeys).size !== reviewUnitKeys.length) {
    throw new Error("Review units contain duplicate reviewUnitKey values.");
  }

  const buckets = new Map<string, {
    queue: PsdReviewQueue;
    family: string | null;
    cohort: string | null;
    tiles: PsdReviewSheetTile[];
  }>();
  for (const unit of units) {
    const queue = queueForUnit(unit);
    const cohort = queue === "exact-matched" ? exactCohort(unit) : null;
    const bucketKey = JSON.stringify([queue, unit.family, cohort]);
    const bucket = buckets.get(bucketKey) ?? { queue, family: unit.family, cohort, tiles: [] };
    bucket.tiles.push(toTile(unit));
    buckets.set(bucketKey, bucket);
  }

  const orderedBuckets = [...buckets.values()].sort((left, right) => (
    PSD_REVIEW_QUEUE_ORDER.indexOf(left.queue) - PSD_REVIEW_QUEUE_ORDER.indexOf(right.queue)
    || compareText(left.family ?? "", right.family ?? "")
    || compareText(left.cohort ?? "", right.cohort ?? "")
  ));

  const sheets: PsdReviewSheet[] = [];
  for (const bucket of orderedBuckets) {
    const tiles = [...bucket.tiles].sort((left, right) => compareText(
      left.reviewUnitKey,
      right.reviewUnitKey,
    ));
    for (let offset = 0; offset < tiles.length; offset += tilesPerSheet) {
      const page = Math.floor(offset / tilesPerSheet) + 1;
      const id = [
        bucket.queue,
        filenameToken(bucket.family, "unassigned"),
        ...(bucket.cohort ? [filenameToken(bucket.cohort, "cohort-unspecified")] : []),
        `p${String(page).padStart(3, "0")}`,
      ].join("--");
      sheets.push({
        id,
        queue: bucket.queue,
        family: bucket.family,
        cohort: bucket.cohort,
        page,
        filename: `${id}.png`,
        tiles: tiles.slice(offset, offset + tilesPerSheet),
      });
    }
  }

  return { tilesPerSheet, sheets };
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function escapeHtml(value: string): string {
  return escapeXml(value);
}

function shorten(value: string, length: number): string {
  return value.length <= length ? value : `${value.slice(0, Math.max(0, length - 1))}…`;
}

function tileLabelSvg(tile: PsdReviewSheetTile, queue: PsdReviewQueue): Buffer {
  const routingHints = tile.machineRoutingHints.length > 0
    ? tile.machineRoutingHints.join(", ")
    : "none";
  const lines = [
    `${tile.websiteSku ?? "—"} | ${tile.graceSku ?? "—"}`,
    `${tile.family ?? "Unassigned"} | ${tile.sourceRelativeBasename}`,
    `${tile.identityStatus} | ${routingHints}`,
    `review unit …${tile.reviewUnitKeySuffix}`,
  ].map((line) => escapeXml(shorten(line, 44)));
  const borderColor: Record<PsdReviewQueue, string> = {
    "identity-blockers": "rgb(155, 28, 28)",
    "evidence-blockers": "rgb(180, 83, 9)",
    unmatched: "rgb(107, 33, 168)",
    "ambiguous-layout": "rgb(29, 78, 216)",
    "exact-matched": "rgb(22, 101, 52)",
  };
  return Buffer.from(`
    <svg width="${TILE_WIDTH}" height="${TILE_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="${TILE_WIDTH - 2}" height="${TILE_HEIGHT - 2}" fill="none" stroke="${borderColor[queue]}" stroke-width="3"/>
      <rect x="0" y="430" width="${TILE_WIDTH}" height="170" fill="#ffffff"/>
      ${lines.map((line, index) => (
        `<text x="18" y="${462 + index * 33}" fill="#111827" font-family="Arial, Helvetica, sans-serif" font-size="19" font-weight="${index === 0 ? 700 : 400}">${line}</text>`
      )).join("\n")}
    </svg>
  `);
}

async function previewBuffer(tile: PsdReviewSheetTile): Promise<Buffer> {
  if (tile.previewPath === null) {
    return Buffer.from(`
      <svg width="360" height="398" xmlns="http://www.w3.org/2000/svg">
        <rect width="360" height="398" fill="#f3f4f6"/>
        <text x="180" y="190" text-anchor="middle" fill="#6b7280" font-family="Arial, Helvetica, sans-serif" font-size="22">Preview unavailable</text>
      </svg>
    `);
  }
  return sharp(tile.previewPath, { animated: false, failOn: "error" })
    .resize({
      width: 360,
      height: 398,
      fit: "contain",
      position: "centre",
      background: { r: 248, g: 250, b: 252, alpha: 1 },
    })
    .png()
    .toBuffer();
}

async function renderSheet(sheet: PsdReviewSheet, outputPath: string): Promise<void> {
  const previews = await Promise.all(sheet.tiles.map(previewBuffer));
  const overlays: sharp.OverlayOptions[] = [];
  sheet.tiles.forEach((tile, index) => {
    const column = index % SHEET_COLUMNS;
    const row = Math.floor(index / SHEET_COLUMNS);
    const left = column * TILE_WIDTH;
    const top = row * TILE_HEIGHT;
    overlays.push(
      { input: previews[index], left: left + 20, top: top + 16 },
      { input: tileLabelSvg(tile, sheet.queue), left, top },
    );
  });
  await sharp({
    create: {
      width: SHEET_WIDTH,
      height: SHEET_HEIGHT,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  }).composite(overlays).png().toFile(outputPath);
}

function buildReadOnlyIndex(plan: PsdReviewSheetPlan): string {
  const sections = plan.sheets.map((sheet) => {
    const tileList = sheet.tiles.map((tile) => (
      `<li>${escapeHtml(tile.websiteSku ?? "—")} | ${escapeHtml(tile.graceSku ?? "—")} · ${escapeHtml(tile.sourceRelativeBasename)} · …${escapeHtml(tile.reviewUnitKeySuffix)}</li>`
    )).join("\n");
    return `
    <section>
      <h2>${escapeHtml(sheet.queue)} · ${escapeHtml(sheet.family ?? "Unassigned")}${sheet.cohort ? ` · ${escapeHtml(sheet.cohort)}` : ""}</h2>
      <p>${sheet.tiles.length} review unit${sheet.tiles.length === 1 ? "" : "s"}; page ${sheet.page}</p>
      <a href="${escapeHtml(sheet.filename)}"><img src="${escapeHtml(sheet.filename)}" alt="${escapeHtml(sheet.id)} review sheet"></a>
      <ul>${tileList}</ul>
    </section>
  `;
  }).join("\n");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Best Bottles PSD cap-state review sheets</title>
  <style>
    body { max-width: 1200px; margin: 0 auto; padding: 32px; color: #111827; background: #f8fafc; font: 16px/1.5 Arial, sans-serif; }
    h1, h2 { line-height: 1.2; }
    section { margin: 28px 0; padding: 20px; background: white; border: 1px solid #d1d5db; }
    img { display: block; width: 100%; height: auto; border: 1px solid #9ca3af; }
  </style>
</head>
<body>
  <h1>Best Bottles PSD cap-state review sheets</h1>
  <p>This read-only index links to deterministic review sheets. Record human decisions through the separate decision workflow.</p>
  <p><a href="review-sheet-manifest.json">Review sheet manifest</a></p>
  ${sections}
</body>
</html>
`;
}

export async function renderPsdReviewSheets(
  units: readonly PsdReviewUnit[],
  options: RenderPsdReviewSheetsOptions,
): Promise<RenderPsdReviewSheetsResult> {
  const plan = buildPsdReviewSheetPlan(units, options);
  await mkdir(options.outputRoot, { recursive: true });
  const sheetPaths = plan.sheets.map((sheet) => join(options.outputRoot, sheet.filename));
  for (let index = 0; index < plan.sheets.length; index += 1) {
    await renderSheet(plan.sheets[index], sheetPaths[index]);
  }

  const manifestPath = join(options.outputRoot, "review-sheet-manifest.json");
  const indexPath = join(options.outputRoot, "index.html");
  const manifest = {
    version: "best-bottles-psd-review-sheets-v1",
    sheetWidth: SHEET_WIDTH,
    sheetHeight: SHEET_HEIGHT,
    columns: SHEET_COLUMNS,
    rows: SHEET_ROWS,
    tilesPerSheet: plan.tilesPerSheet,
    totalReviewUnits: units.length,
    sheets: plan.sheets,
  };
  await Promise.all([
    writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8"),
    writeFile(indexPath, buildReadOnlyIndex(plan), "utf8"),
  ]);
  return { plan, sheetPaths, manifestPath, indexPath };
}

function argumentValue(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

async function main(): Promise<void> {
  const auditRoot = resolve(argumentValue("--audit-root") ?? DEFAULT_AUDIT_ROOT);
  const inputPath = resolve(argumentValue("--input") ?? join(auditRoot, "review-units.json"));
  const outputRoot = resolve(argumentValue("--output") ?? join(auditRoot, "review-sheets"));
  const parsed: unknown = JSON.parse(await readFile(inputPath, "utf8"));
  if (!Array.isArray(parsed)) {
    throw new Error(`Expected a review-unit array in ${inputPath}.`);
  }
  const result = await renderPsdReviewSheets(parsed as PsdReviewUnit[], { outputRoot });
  process.stdout.write(`${JSON.stringify({
    inputPath,
    outputRoot,
    reviewUnitCount: parsed.length,
    sheetCount: result.plan.sheets.length,
    manifestPath: result.manifestPath,
    indexPath: result.indexPath,
  }, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
