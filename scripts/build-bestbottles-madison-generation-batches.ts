#!/usr/bin/env tsx
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const BEST_BOTTLES_REPO =
  "/Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Website-02-20-2026";
const AUDIT_ROOT = join(BEST_BOTTLES_REPO, "data/audits/stage-in-sight-image-sync-2026-06-15");
const DEFAULT_RESIDUAL_CSV = join(
  AUDIT_ROOT,
  "cleanup/remaining_missing_shopify_variant_images_after_cleanup.csv",
);
const DEFAULT_RECONCILIATION_JSON = join(
  AUDIT_ROOT,
  "cleanup/launch_image_reconciliation_manifest.json",
);
const DEFAULT_EXISTING_MEDIA_CHECK_JSON = join(
  AUDIT_ROOT,
  "cleanup/shopify_existing_media_live_check.json",
);
const DEFAULT_OUT_DIR = join(AUDIT_ROOT, "cleanup/madison-generation-batches");
const DEFAULT_PUBLIC_JSON = "public/data/best-bottles-madison-generation-batches.json";
const DEFAULT_BATCH_SIZE = 30;

type BatchLane =
  | "attach_existing_cdn_before_generation"
  | "generate_from_local_reference"
  | "generate_from_legacy_reference"
  | "blocked_truth_review";

interface CsvRow {
  [key: string]: string;
}

interface ResidualRow extends CsvRow {
  family: string;
  product_group_slug: string;
  sku: string;
  website_sku: string;
  product_media_count: string;
  issue: string;
  recommended_next_action: string;
  convex_image_url: string;
}

interface ReconciliationRow {
  graceSku: string;
  websiteSku: string | null;
  family: string | null;
  productGroupSlug: string | null;
  actionBucket: string;
  referenceSource: string;
  referenceUrlOrPath: string | null;
  generatedImagePathOrShopifyCdnUrl: string | null;
  qaStatus: string;
  notes: string;
}

interface ExistingMediaCheckRow {
  graceSku: string;
  status: string;
  candidateUrl: string | null;
  candidateCdnHttpStatus: number | null;
}

interface BatchRow {
  batchNumber: number;
  batchLabel: string;
  batchLane: BatchLane;
  launchPriority: number;
  launchVisibility: string;
  family: string;
  productGroupSlug: string;
  graceSku: string;
  websiteSku: string | null;
  sourceIssue: string;
  referenceSource: string | null;
  referenceUrlOrPath: string | null;
  generatedOrCdnUrl: string | null;
  nextAction: string;
  guardrail: string;
}

interface BatchPayload {
  generatedAt: string;
  source: {
    residualCsv: string;
    reconciliationJson: string;
    existingMediaCheckJson: string;
  };
  mantra: string;
  summary: {
    totalNoProductMedia: number;
    selectedRows: number;
    blockedRows: number;
    batchCount: number;
    byLane: Record<BatchLane, number>;
    byFamily: Record<string, number>;
  };
  batches: Array<{
    batchNumber: number;
    batchLabel: string;
    lane: BatchLane;
    rowCount: number;
    productGroups: string[];
    families: string[];
  }>;
  rows: BatchRow[];
}

const MANTRA = "Generate by product truth; write by Grace SKU.";

const FAMILY_PRIORITY = new Map<string, number>([
  // Top nav: Bottles mega menu design families.
  ["Slim", 10],
  ["Sleek", 11],
  ["Diva", 12],
  ["Circle", 13],
  ["Empire", 14],
  ["Elegant", 15],
  ["Cylinder", 16],
  ["Boston Round", 17],
  // Top nav: Closures mega menu/search-driven component paths.
  ["Sprayer", 20],
  ["Dropper", 21],
  ["Roll-On Cap", 22],
  ["Cap/Closure", 23],
  ["Lotion Pump", 24],
  // Top nav: Specialty mega menu.
  ["Atomizer", 30],
  ["Plastic Bottle", 31],
  ["Apothecary", 32],
  ["Decorative", 33],
  ["Vial", 34],
  ["Gift Bag", 35],
  ["Gift Box", 36],
  ["Packaging Supply", 37],
]);

const PRODUCT_GROUP_PRIORITY: Array<[RegExp, number]> = [
  [/atomizer-5ml-slim/i, 1],
  [/bell-10ml-clear-13-415-rollon/i, 2],
  [/dropper-/i, 40],
  [/roll-on-fitment-/i, 41],
  [/cap-closure-/i, 42],
  [/fine-mist-sprayer-/i, 43],
  [/lotion-pump-/i, 44],
  [/slim-/i, 50],
  [/sleek-/i, 51],
  [/cylinder-/i, 52],
  [/rectangle-/i, 80],
  [/royal-/i, 81],
  [/bell-/i, 82],
  [/decorative|heart-|tola-|genie-|marble-|pear-|teardrop-/i, 90],
];

const LANE_PRIORITY = new Map<BatchLane, number>([
  ["attach_existing_cdn_before_generation", 0],
  ["generate_from_local_reference", 1],
  ["generate_from_legacy_reference", 2],
  ["blocked_truth_review", 3],
]);

function readArg(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] || fallback;
}

function parseCsv(text: string): CsvRow[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (quoted) {
      if (char === "\"" && next === "\"") {
        cell += "\"";
        index += 1;
      } else if (char === "\"") {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === "\"") quoted = true;
    else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }

  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }

  const header = rows.shift() ?? [];
  return rows
    .filter((values) => values.some((value) => value.trim()))
    .map((values) => Object.fromEntries(header.map((key, index) => [key, values[index] ?? ""])));
}

function csvEscape(value: unknown): string {
  const text = value == null ? "" : String(value);
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function toCsv(rows: BatchRow[]): string {
  const headers = [
    "batchNumber",
    "batchLabel",
    "batchLane",
    "launchPriority",
    "launchVisibility",
    "family",
    "productGroupSlug",
    "graceSku",
    "websiteSku",
    "sourceIssue",
    "referenceSource",
    "referenceUrlOrPath",
    "generatedOrCdnUrl",
    "nextAction",
    "guardrail",
  ] as const;

  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(",")),
  ].join("\n");
}

function loadRows<T>(filePath: string): T[] {
  const payload = JSON.parse(readFileSync(filePath, "utf8"));
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.rows)) return payload.rows;
  throw new Error(`Expected array or payload.rows in ${filePath}`);
}

function productGroupPriority(slug: string): number {
  for (const [pattern, priority] of PRODUCT_GROUP_PRIORITY) {
    if (pattern.test(slug)) return priority;
  }
  return 999;
}

function launchPriority(row: ResidualRow): number {
  return Math.min(FAMILY_PRIORITY.get(row.family) ?? 900, productGroupPriority(row.product_group_slug));
}

function launchVisibility(row: ResidualRow): string {
  if (/atomizer-5ml-slim|bell-10ml-clear-13-415-rollon/i.test(row.product_group_slug)) {
    return "smoke-test PDP/product group";
  }
  if (["Slim", "Sleek", "Diva", "Circle", "Empire", "Elegant", "Cylinder", "Boston Round"].includes(row.family)) {
    return "top nav Bottles design family";
  }
  if (["Sprayer", "Dropper", "Roll-On Cap", "Cap/Closure", "Lotion Pump"].includes(row.family)) {
    return "top nav Closures/component path";
  }
  if (["Atomizer", "Plastic Bottle", "Apothecary", "Decorative", "Vial", "Gift Bag", "Gift Box", "Packaging Supply"].includes(row.family)) {
    return "top nav Specialty path";
  }
  return "catalog path";
}

function batchLane(row: ResidualRow, reconciliation?: ReconciliationRow, existing?: ExistingMediaCheckRow): BatchLane {
  if (reconciliation?.actionBucket === "blocked_truth_review") return "blocked_truth_review";
  if (existing?.status === "cdn_exists_not_product_media" || existing?.status === "product_media_present_candidate_not_attached") {
    return "attach_existing_cdn_before_generation";
  }
  if (reconciliation?.actionBucket === "generate_from_legacy_reference") return "generate_from_legacy_reference";
  return "generate_from_local_reference";
}

function nextActionForLane(lane: BatchLane): string {
  if (lane === "attach_existing_cdn_before_generation") {
    return "Visual QA the existing CDN image, attach/upload it to the Shopify product media gallery, assign exact variant, then sync Convex by graceSku.";
  }
  if (lane === "generate_from_local_reference") {
    return "Generate Madison PDP image from local reference, upload to Shopify, assign exact variant, then sync Convex by graceSku.";
  }
  if (lane === "generate_from_legacy_reference") {
    return "Use bestbottles.com as evidence only, verify identity, generate Madison PDP image, upload to Shopify, assign exact variant, then sync Convex by graceSku.";
  }
  return "Hold until product-truth evidence is resolved or explicitly waived.";
}

function assignBatchNumbers(rows: Omit<BatchRow, "batchNumber" | "batchLabel">[], batchSize: number): BatchRow[] {
  const grouped = new Map<string, Omit<BatchRow, "batchNumber" | "batchLabel">[]>();
  for (const row of rows) {
    const key = `${row.batchLane}::${row.launchPriority}::${row.productGroupSlug}`;
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }

  const groups = Array.from(grouped.values()).sort((a, b) => {
    const firstA = a[0];
    const firstB = b[0];
    return (
      (LANE_PRIORITY.get(firstA.batchLane) ?? 99) - (LANE_PRIORITY.get(firstB.batchLane) ?? 99) ||
      firstA.launchPriority - firstB.launchPriority ||
      firstA.productGroupSlug.localeCompare(firstB.productGroupSlug)
    );
  });

  const out: BatchRow[] = [];
  let batchNumber = 1;
  let current: Omit<BatchRow, "batchNumber" | "batchLabel">[] = [];
  let currentLane: BatchLane | null = null;

  const flush = () => {
    if (!current.length) return;
    const batchLabel = `batch-${String(batchNumber).padStart(2, "0")}-${current[0].batchLane}`;
    for (const row of current) out.push({ ...row, batchNumber, batchLabel });
    batchNumber += 1;
    current = [];
    currentLane = null;
  };

  for (const group of groups) {
    const lane = group[0].batchLane;
    if (currentLane && lane !== currentLane) flush();
    if (current.length && current.length + group.length > batchSize) flush();
    current.push(...group);
    currentLane = lane;
  }
  flush();

  return out;
}

function buildReport(payload: BatchPayload): string {
  const laneRows = Object.entries(payload.summary.byLane)
    .map(([lane, count]) => `- \`${lane}\`: ${count}`)
    .join("\n");
  const batchRows = payload.batches
    .map((batch) => `| ${batch.batchLabel} | ${batch.lane} | ${batch.rowCount} | ${batch.families.join(", ")} | ${batch.productGroups.join(", ")} |`)
    .join("\n");
  return `# Best Bottles Madison Generation Batch Plan

Generated: ${payload.generatedAt}

## Rule

${payload.mantra}

## Summary

- Fresh residual \`no_product_media\` rows: ${payload.summary.totalNoProductMedia}
- Selected rows: ${payload.summary.selectedRows}
- Blocked rows held out: ${payload.summary.blockedRows}
- Batch count: ${payload.summary.batchCount}

## Lanes

${laneRows}

## Batches

| Batch | Lane | Rows | Families | Product groups |
| --- | --- | ---: | --- | --- |
${batchRows}
`;
}

function cleanGeneratedOutputs(outputDir: string): void {
  mkdirSync(outputDir, { recursive: true });
  for (const entry of readdirSync(outputDir)) {
    if (/^(batch-\d+-.*\.csv|blocked-truth-review\.csv|madison_generation_batch_plan\.(csv|json|md))$/.test(entry)) {
      rmSync(join(outputDir, entry), { force: true });
    }
  }
}

const residualCsv = resolve(readArg("--residual-csv", DEFAULT_RESIDUAL_CSV));
const reconciliationJson = resolve(readArg("--reconciliation-json", DEFAULT_RECONCILIATION_JSON));
const existingMediaCheckJson = resolve(readArg("--existing-media-check-json", DEFAULT_EXISTING_MEDIA_CHECK_JSON));
const outDir = resolve(readArg("--out-dir", DEFAULT_OUT_DIR));
const publicJson = resolve(readArg("--public-json", DEFAULT_PUBLIC_JSON));
const batchSize = Number(readArg("--batch-size", String(DEFAULT_BATCH_SIZE))) || DEFAULT_BATCH_SIZE;

const residualRows = parseCsv(readFileSync(residualCsv, "utf8")) as ResidualRow[];
const reconciliationRows = loadRows<ReconciliationRow>(reconciliationJson);
const existingRows = loadRows<ExistingMediaCheckRow>(existingMediaCheckJson);
const reconciliationBySku = new Map(reconciliationRows.map((row) => [row.graceSku.toUpperCase(), row]));
const existingBySku = new Map(existingRows.map((row) => [row.graceSku.toUpperCase(), row]));

const noProductMedia = residualRows.filter((row) => row.issue === "no_product_media");
const selected = noProductMedia
  .map((row) => {
    const reconciliation = reconciliationBySku.get(row.sku.toUpperCase());
    const existing = existingBySku.get(row.sku.toUpperCase());
    const lane = batchLane(row, reconciliation, existing);
    return {
      batchLane: lane,
      launchPriority: launchPriority(row),
      launchVisibility: launchVisibility(row),
      family: row.family,
      productGroupSlug: row.product_group_slug,
      graceSku: row.sku,
      websiteSku: row.website_sku || null,
      sourceIssue: row.issue,
      referenceSource: reconciliation?.referenceSource ?? null,
      referenceUrlOrPath: reconciliation?.referenceUrlOrPath ?? null,
      generatedOrCdnUrl: existing?.candidateUrl ?? reconciliation?.generatedImagePathOrShopifyCdnUrl ?? row.convex_image_url,
      nextAction: nextActionForLane(lane),
      guardrail: MANTRA,
    };
  });

const batchedRows = assignBatchNumbers(
  selected.filter((row) => row.batchLane !== "blocked_truth_review"),
  batchSize,
);
const blockedRows = selected.filter((row) => row.batchLane === "blocked_truth_review");
const finalRows: BatchRow[] = [
  ...batchedRows,
  ...blockedRows.map((row) => ({
    ...row,
    batchNumber: 999,
    batchLabel: "blocked-truth-review",
  })),
];

const byLane = {
  attach_existing_cdn_before_generation: 0,
  generate_from_local_reference: 0,
  generate_from_legacy_reference: 0,
  blocked_truth_review: 0,
} satisfies Record<BatchLane, number>;
const byFamily: Record<string, number> = {};
for (const row of finalRows) {
  byLane[row.batchLane] += 1;
  byFamily[row.family] = (byFamily[row.family] ?? 0) + 1;
}

const batchSummaries = Array.from(new Set(finalRows.filter((row) => row.batchNumber !== 999).map((row) => row.batchNumber)))
  .sort((a, b) => a - b)
  .map((batchNumber) => {
    const rows = finalRows.filter((row) => row.batchNumber === batchNumber);
    return {
      batchNumber,
      batchLabel: rows[0].batchLabel,
      lane: rows[0].batchLane,
      rowCount: rows.length,
      productGroups: Array.from(new Set(rows.map((row) => row.productGroupSlug))),
      families: Array.from(new Set(rows.map((row) => row.family))),
    };
  });

const payload: BatchPayload = {
  generatedAt: new Date().toISOString(),
  source: {
    residualCsv,
    reconciliationJson,
    existingMediaCheckJson,
  },
  mantra: MANTRA,
  summary: {
    totalNoProductMedia: noProductMedia.length,
    selectedRows: finalRows.length,
    blockedRows: blockedRows.length,
    batchCount: batchSummaries.length,
    byLane,
    byFamily,
  },
  batches: batchSummaries,
  rows: finalRows,
};

cleanGeneratedOutputs(outDir);
writeFileSync(join(outDir, "madison_generation_batch_plan.json"), `${JSON.stringify(payload, null, 2)}\n`);
writeFileSync(join(outDir, "madison_generation_batch_plan.csv"), `${toCsv(finalRows)}\n`);
writeFileSync(join(outDir, "madison_generation_batch_plan.md"), buildReport(payload));
mkdirSync(dirname(publicJson), { recursive: true });
writeFileSync(publicJson, `${JSON.stringify(payload, null, 2)}\n`);

for (const batch of batchSummaries) {
  const rows = finalRows.filter((row) => row.batchNumber === batch.batchNumber);
  writeFileSync(join(outDir, `${batch.batchLabel}.csv`), `${toCsv(rows)}\n`);
}
if (blockedRows.length) {
  writeFileSync(
    join(outDir, "blocked-truth-review.csv"),
    `${toCsv(finalRows.filter((row) => row.batchNumber === 999))}\n`,
  );
}

console.log(`Madison no_product_media rows: ${payload.summary.totalNoProductMedia}`);
console.log(
  Object.entries(payload.summary.byLane)
    .map(([lane, count]) => `${lane}: ${count}`)
    .join(" · "),
);
console.log(`Batches: ${payload.summary.batchCount}`);
console.log(`Wrote ${join(outDir, "madison_generation_batch_plan.md")}`);
console.log(`Wrote ${publicJson}`);
