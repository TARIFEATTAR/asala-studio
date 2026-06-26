#!/usr/bin/env tsx
import "dotenv/config";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { spawnSync } from "node:child_process";

import {
  appendBestBottlesMeasurementOverrides,
  sourceMeasurementRowsWithFirecrawl,
  type BestBottlesFirecrawlMeasurementCandidate,
  type BestBottlesMeasurementFirecrawlRow,
  type BestBottlesMeasurementOverridesPayload,
} from "../src/lib/bestBottlesMeasurementFirecrawl.ts";

interface ReadinessPayload {
  rows?: ReadinessRow[];
}

interface ReadinessRow extends BestBottlesMeasurementFirecrawlRow {
  status: string;
  issues?: string[];
  graceSku: string;
  websiteSku: string | null;
  shopifySku?: string | null;
  family: string | null;
  productGroupSlug: string;
  productGroupDisplayName: string;
  capacityMl: string | null;
  color: string | null;
  applicator: string | null;
  heightWithoutCap: string | null;
  diameter: string | null;
  measurementOverrideUrl: string | null;
}

interface CsvRow {
  [key: string]: string;
}

interface MeasurementIntakeManifest {
  generatedAt: string;
  sources: {
    readiness: string;
    measurementOverrides: string;
    liveProductsCsv: string | null;
  };
  summary: {
    readinessRows: number;
    measurementBlockedRows: number;
    productUrlsFromLiveProductsCsv: number;
    targeted: number;
    attempted: number;
    sourced: number;
    skippedNoApiKey: boolean;
    errors: number;
  };
  candidates: BestBottlesFirecrawlMeasurementCandidate[];
}

const DEFAULT_READINESS = "public/data/best-bottles-generation-readiness.json";
const DEFAULT_MEASUREMENT_OVERRIDES = "public/data/best-bottles-measurement-overrides.json";
const DEFAULT_LIVE_PRODUCTS_CSV = "tmp/best-bottles-convex-live-products.csv";
const DEFAULT_OUT_JSON = "tmp/best-bottles-measurement-intake.json";
const DEFAULT_PUBLIC_OUT_JSON = "public/data/best-bottles-measurement-intake.json";
const DEFAULT_OUT_CSV = "tmp/best-bottles-measurement-intake.csv";

function normalizeKey(value: string | number | null | undefined): string {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function readOptionalJson<T>(filePath: string, fallback: T): T {
  if (!existsSync(filePath)) return fallback;
  return readJson<T>(filePath);
}

function ensureParentDir(filePath: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
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
      if (char === '"' && next === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
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
  if (cell || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  const headers = rows.shift()?.map((header) => header.trim()) ?? [];
  return rows
    .filter((values) => values.some((value) => value.trim()))
    .map((values) => {
      const record: CsvRow = {};
      headers.forEach((header, index) => {
        record[header] = (values[index] ?? "").trim();
      });
      return record;
    });
}

function loadProductUrlsFromLiveProductsCsv(filePath: string | null): Map<string, string> {
  const urls = new Map<string, string>();
  if (!filePath || !existsSync(filePath)) return urls;
  const rows = parseCsv(readFileSync(filePath, "utf8"));
  for (const row of rows) {
    const productUrl = row.productUrl?.trim();
    if (!productUrl) continue;
    for (const key of [row.graceSku, row.websiteSku].map(normalizeKey).filter(Boolean)) {
      urls.set(key, productUrl);
    }
  }
  return urls;
}

function rowNeedsMeasurement(row: ReadinessRow): boolean {
  return row.status === "needs-measurement" || (row.issues ?? []).includes("missing_measurement");
}

function withProductUrls(
  rows: ReadinessRow[],
  productUrlBySku: Map<string, string>,
): BestBottlesMeasurementFirecrawlRow[] {
  return rows.map((row) => {
    const productUrl =
      productUrlBySku.get(normalizeKey(row.graceSku)) ??
      productUrlBySku.get(normalizeKey(row.websiteSku)) ??
      row.measurementOverrideUrl ??
      null;
    return {
      ...row,
      productUrl,
    };
  });
}

function csvEscape(value: unknown): string {
  const text = value == null ? "" : String(value);
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function toCsv(candidates: BestBottlesFirecrawlMeasurementCandidate[]): string {
  const headers: Array<keyof BestBottlesFirecrawlMeasurementCandidate> = [
    "graceSku",
    "websiteSku",
    "family",
    "productGroupSlug",
    "heightWithoutCap",
    "diameter",
    "diameterSourceLabel",
    "source",
    "sourceUrl",
    "note",
  ];
  return [
    headers.join(","),
    ...candidates.map((candidate) =>
      headers.map((header) => csvEscape(candidate[header])).join(","),
    ),
  ].join("\n");
}

function writeOutputs(params: {
  manifest: MeasurementIntakeManifest;
  outJsonPath: string;
  publicOutJsonPath: string;
  outCsvPath: string;
}): void {
  ensureParentDir(params.outJsonPath);
  ensureParentDir(params.publicOutJsonPath);
  ensureParentDir(params.outCsvPath);
  const json = `${JSON.stringify(params.manifest, null, 2)}\n`;
  writeFileSync(params.outJsonPath, json);
  writeFileSync(params.publicOutJsonPath, json);
  writeFileSync(params.outCsvPath, `${toCsv(params.manifest.candidates)}\n`);
}

function rerunReadiness(): void {
  const result = spawnSync("npm", ["run", "bestbottles:generation:readiness"], {
    stdio: "inherit",
  });
  if (result.status !== 0) {
    throw new Error("Failed to rerun bestbottles:generation:readiness after applying measurement overrides.");
  }
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      readiness: { type: "string", default: DEFAULT_READINESS },
      "measurement-overrides": { type: "string", default: DEFAULT_MEASUREMENT_OVERRIDES },
      "live-products-csv": { type: "string", default: DEFAULT_LIVE_PRODUCTS_CSV },
      "out-json": { type: "string", default: DEFAULT_OUT_JSON },
      "public-out-json": { type: "string", default: DEFAULT_PUBLIC_OUT_JSON },
      "out-csv": { type: "string", default: DEFAULT_OUT_CSV },
      sku: { type: "string", multiple: true, default: [] },
      apply: { type: "boolean", default: false },
      firecrawl: { type: "boolean", default: true },
      "no-firecrawl": { type: "boolean", default: false },
      limit: { type: "string", default: "50" },
      "firecrawl-timeout-ms": { type: "string", default: "15000" },
      "rerun-readiness": { type: "boolean", default: true },
      "no-rerun-readiness": { type: "boolean", default: false },
    },
  });

  const readinessPath = resolve(values.readiness as string);
  const measurementOverridesPath = resolve(values["measurement-overrides"] as string);
  const liveProductsCsvPath = values["live-products-csv"]
    ? resolve(values["live-products-csv"] as string)
    : null;
  const outJsonPath = resolve(values["out-json"] as string);
  const publicOutJsonPath = resolve(values["public-out-json"] as string);
  const outCsvPath = resolve(values["out-csv"] as string);

  const readiness = readJson<ReadinessPayload>(readinessPath);
  const readinessRows = readiness.rows ?? [];
  const productUrlBySku = loadProductUrlsFromLiveProductsCsv(liveProductsCsvPath);
  const rows = withProductUrls(readinessRows, productUrlBySku);
  const skuKeys = new Set((values.sku as string[]).map(normalizeKey).filter(Boolean));

  const result = await sourceMeasurementRowsWithFirecrawl(rows, {
    enabled: Boolean(values.firecrawl) && !Boolean(values["no-firecrawl"]),
    skuKeys,
    limit: Math.max(0, Number.parseInt(values.limit as string, 10) || 0),
    timeoutMs: Math.max(1000, Number.parseInt(values["firecrawl-timeout-ms"] as string, 10) || 15000),
  });

  const manifest: MeasurementIntakeManifest = {
    generatedAt: new Date().toISOString(),
    sources: {
      readiness: readinessPath,
      measurementOverrides: measurementOverridesPath,
      liveProductsCsv: liveProductsCsvPath,
    },
    summary: {
      readinessRows: readinessRows.length,
      measurementBlockedRows: readinessRows.filter(rowNeedsMeasurement).length,
      productUrlsFromLiveProductsCsv: productUrlBySku.size,
      targeted: result.summary.targeted,
      attempted: result.summary.attempted,
      sourced: result.summary.sourced,
      skippedNoApiKey: result.summary.skippedNoApiKey,
      errors: result.summary.errors.length,
    },
    candidates: result.candidates,
  };
  writeOutputs({ manifest, outJsonPath, publicOutJsonPath, outCsvPath });

  console.log(
    [
      `Measurement blockers: ${manifest.summary.measurementBlockedRows}`,
      `targeted: ${manifest.summary.targeted}`,
      `attempted: ${manifest.summary.attempted}`,
      `sourced: ${manifest.summary.sourced}`,
      `errors: ${manifest.summary.errors}`,
    ].join(" · "),
  );
  if (result.summary.skippedNoApiKey && result.summary.targeted > 0) {
    console.warn(
      `[measurement-intake] Firecrawl skipped for ${result.summary.targeted} measurement row${
        result.summary.targeted === 1 ? "" : "s"
      }; set FIRECRAWL_API_KEY to collect BestBottles measurements automatically.`,
    );
  }
  for (const error of result.summary.errors.slice(0, 5)) {
    console.warn(`[measurement-intake] Firecrawl ${error.graceSku} ${error.url}: ${error.message}`);
  }
  console.log(`Public JSON: ${publicOutJsonPath}`);

  if (values.apply) {
    if (result.candidates.length === 0) {
      console.log("[measurement-intake] no candidates to apply");
      return;
    }
    const existingPayload = readOptionalJson<BestBottlesMeasurementOverridesPayload>(
      measurementOverridesPath,
      { overrides: [] },
    );
    const nextPayload = appendBestBottlesMeasurementOverrides(existingPayload, result.candidates);
    ensureParentDir(measurementOverridesPath);
    writeFileSync(measurementOverridesPath, `${JSON.stringify(nextPayload, null, 2)}\n`);
    console.log(`[measurement-intake] applied ${result.candidates.length} measurement override candidate(s)`);
    if (Boolean(values["rerun-readiness"]) && !Boolean(values["no-rerun-readiness"])) {
      rerunReadiness();
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
