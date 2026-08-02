import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const BEST_BOTTLES_REPO_ROOT =
  "/Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Website-02-20-2026";
const DEFAULT_READINESS = "public/data/best-bottles-generation-readiness.json";
const DEFAULT_OUT_DIR = "tmp/best-bottles-cap-on-generation-cycles";
const DEFAULT_REPORT = "docs/best-bottles-cap-on-generation-cycles.md";
const PIPELINE_LANE_ID = "grid-card-2000x2200";
const CYCLE_COUNT = 4;

type CliArgs = {
  readiness?: string;
  outDir?: string;
  report?: string;
  allowMissingReferences?: boolean;
};

type ReadinessPayload = {
  generatedAt?: string;
  sourceOfTruthDate?: string | null;
  rows?: ReadinessRow[];
};

type ValidReadinessPayload = ReadinessPayload & {
  sourceOfTruthDate: string | null;
  rows: ReadinessRow[];
};

type ReadinessRow = {
  status: string;
  issues: string[];
  graceSku: string;
  websiteSku: string | null;
  productId: string | null;
  sourceId: string | null;
  productGroupId: string | null;
  productGroupSlug: string;
  productGroupDisplayName: string;
  family: string | null;
  category: string | null;
  capacityMl: string | null;
  color: string | null;
  applicator: string | null;
  capStyle: string | null;
  capColor: string | null;
  heightWithoutCap: string | null;
  diameter: string | null;
  measurementSource: string;
  bestReferenceCandidatePath: string | null;
  expectedCanonicalFilename: string | null;
  generatedCandidateCount: number;
};

type ManifestRow = {
  cycleId: string;
  launchOrder: number;
  pipelineLaneId: typeof PIPELINE_LANE_ID;
  mode: "cap-on";
  graceSku: string;
  websiteSku: string | null;
  family: string | null;
  productGroupSlug: string;
  productGroupDisplayName: string;
  applicator: string | null;
  capacityMl: string | null;
  color: string | null;
  bestReferenceCandidatePath: string;
  absoluteReferencePath: string;
  expectedCanonicalFilename: string | null;
};

type CycleManifest = {
  generatedAt: string;
  sourceReadiness: string;
  sourceReadinessGeneratedAt: string | null;
  sourceOfTruthDate: string | null;
  pipelineLaneId: typeof PIPELINE_LANE_ID;
  mode: "cap-on";
  cycleId: string;
  launchOrder: number;
  totalRows: number;
  rows: ManifestRow[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string") throw new Error(`${field} must be a string`);
  return value;
}

function nullableString(value: unknown, field: string): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw new Error(`${field} must be a string or null`);
  return value;
}

function requireNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${field} must be a finite number`);
  }
  return value;
}

function rowLabel(index: number): string {
  return `rows[${index}]`;
}

function isEligibleShape(row: ReadinessRow): boolean {
  return (
    row.status === "ready" &&
    row.generatedCandidateCount === 0 &&
    Boolean(row.graceSku.trim()) &&
    Boolean(row.bestReferenceCandidatePath?.trim())
  );
}

function validateReadinessPayload(payload: unknown): ValidReadinessPayload {
  if (!isRecord(payload)) throw new Error("Readiness payload must be an object");
  if (!Array.isArray(payload.rows)) throw new Error("Readiness payload rows must be an array");
  if (payload.rows.length === 0) throw new Error("Readiness payload rows must not be empty");

  const rows = payload.rows.map((rawRow, index): ReadinessRow => {
    const label = rowLabel(index);
    if (!isRecord(rawRow)) throw new Error(`${label} must be an object`);

    const row: ReadinessRow = {
      status: requireString(rawRow.status, `${label}.status`),
      issues: Array.isArray(rawRow.issues) ? rawRow.issues.map((issue) => String(issue)) : [],
      graceSku: typeof rawRow.graceSku === "string" ? rawRow.graceSku : "",
      websiteSku: nullableString(rawRow.websiteSku, `${label}.websiteSku`),
      productId: nullableString(rawRow.productId, `${label}.productId`),
      sourceId: nullableString(rawRow.sourceId, `${label}.sourceId`),
      productGroupId: nullableString(rawRow.productGroupId, `${label}.productGroupId`),
      productGroupSlug: typeof rawRow.productGroupSlug === "string" ? rawRow.productGroupSlug : "",
      productGroupDisplayName:
        typeof rawRow.productGroupDisplayName === "string" ? rawRow.productGroupDisplayName : "",
      family: nullableString(rawRow.family, `${label}.family`),
      category: nullableString(rawRow.category, `${label}.category`),
      capacityMl: nullableString(rawRow.capacityMl, `${label}.capacityMl`),
      color: nullableString(rawRow.color, `${label}.color`),
      applicator: nullableString(rawRow.applicator, `${label}.applicator`),
      capStyle: nullableString(rawRow.capStyle, `${label}.capStyle`),
      capColor: nullableString(rawRow.capColor, `${label}.capColor`),
      heightWithoutCap: nullableString(rawRow.heightWithoutCap, `${label}.heightWithoutCap`),
      diameter: nullableString(rawRow.diameter, `${label}.diameter`),
      measurementSource:
        typeof rawRow.measurementSource === "string" ? rawRow.measurementSource : "",
      bestReferenceCandidatePath:
        typeof rawRow.bestReferenceCandidatePath === "string"
          ? rawRow.bestReferenceCandidatePath
          : null,
      expectedCanonicalFilename: nullableString(
        rawRow.expectedCanonicalFilename,
        `${label}.expectedCanonicalFilename`,
      ),
      generatedCandidateCount: requireNumber(
        rawRow.generatedCandidateCount,
        `${label}.generatedCandidateCount`,
      ),
    };

    if (isEligibleShape(row)) {
      if (!row.productGroupSlug.trim()) {
        throw new Error(`${label}.productGroupSlug must be a non-empty string for eligible rows`);
      }
      if (!row.productGroupDisplayName.trim()) {
        throw new Error(
          `${label}.productGroupDisplayName must be a non-empty string for eligible rows`,
        );
      }
    }

    return row;
  });

  return {
    generatedAt: nullableString(payload.generatedAt, "generatedAt") ?? undefined,
    sourceOfTruthDate: nullableString(payload.sourceOfTruthDate, "sourceOfTruthDate"),
    rows,
  };
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {};

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (arg === "--allow-missing-references") {
      args.allowMissingReferences = true;
      continue;
    }

    if (!arg.startsWith("--")) throw new Error(`Unexpected positional argument ${arg}`);
    if (!next || next.startsWith("--")) throw new Error(`Missing value for ${arg}`);

    i += 1;
    if (arg === "--readiness") args.readiness = next;
    else if (arg === "--out-dir") args.outDir = next;
    else if (arg === "--report") args.report = next;
    else throw new Error(`Unknown argument ${arg}`);
  }

  return args;
}

function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown;
}

function ensureParentDir(filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function referenceToAbsolute(referencePath: string): string {
  if (path.isAbsolute(referencePath)) return referencePath;
  return path.join(BEST_BOTTLES_REPO_ROOT, referencePath);
}

function stableKey(row: ReadinessRow): string {
  return [
    row.family ?? "",
    row.productGroupSlug ?? "",
    row.capacityMl ?? "",
    row.applicator ?? "",
    row.color ?? "",
    row.graceSku,
  ].join("|");
}

function eligibleRows(rows: ReadinessRow[]): ReadinessRow[] {
  return rows
    .filter((row) => row.status === "ready")
    .filter((row) => row.generatedCandidateCount === 0)
    .filter((row) => Boolean(row.graceSku?.trim()))
    .filter((row) => Boolean(row.bestReferenceCandidatePath?.trim()))
    .sort((a, b) => stableKey(a).localeCompare(stableKey(b)));
}

function splitBalanced(rows: ReadinessRow[]): ReadinessRow[][] {
  const cycles = Array.from({ length: CYCLE_COUNT }, () => [] as ReadinessRow[]);
  const byFamily = new Map<string, ReadinessRow[]>();

  for (const row of rows) {
    const key = row.family ?? "(none)";
    const bucket = byFamily.get(key) ?? [];
    bucket.push(row);
    byFamily.set(key, bucket);
  }

  const families = [...byFamily.keys()].sort((a, b) => {
    const diff = (byFamily.get(b)?.length ?? 0) - (byFamily.get(a)?.length ?? 0);
    return diff || a.localeCompare(b);
  });

  let assigned = 0;
  while (assigned < rows.length) {
    let madeProgress = false;

    for (const family of families) {
      const row = byFamily.get(family)?.shift();
      if (!row) continue;

      const targetCycle = cycles
        .map((cycle, index) => ({ index, size: cycle.length }))
        .sort((a, b) => a.size - b.size || a.index - b.index)[0].index;

      cycles[targetCycle].push(row);
      assigned += 1;
      madeProgress = true;
    }

    if (!madeProgress) break;
  }

  return cycles;
}

function toManifestRow(row: ReadinessRow, cycleId: string, launchOrder: number): ManifestRow {
  const referencePath = row.bestReferenceCandidatePath?.trim();
  if (!referencePath) throw new Error(`Missing reference path for ${row.graceSku}`);

  return {
    cycleId,
    launchOrder,
    pipelineLaneId: PIPELINE_LANE_ID,
    mode: "cap-on",
    graceSku: row.graceSku,
    websiteSku: row.websiteSku ?? null,
    family: row.family ?? null,
    productGroupSlug: row.productGroupSlug,
    productGroupDisplayName: row.productGroupDisplayName,
    applicator: row.applicator ?? null,
    capacityMl: row.capacityMl ?? null,
    color: row.color ?? null,
    bestReferenceCandidatePath: referencePath,
    absoluteReferencePath: referenceToAbsolute(referencePath),
    expectedCanonicalFilename: row.expectedCanonicalFilename ?? null,
  };
}

function csvEscape(value: unknown): string {
  const text = value == null ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(rows: ManifestRow[]): string {
  const headers: Array<keyof ManifestRow> = [
    "cycleId",
    "launchOrder",
    "pipelineLaneId",
    "mode",
    "graceSku",
    "websiteSku",
    "family",
    "productGroupSlug",
    "productGroupDisplayName",
    "applicator",
    "capacityMl",
    "color",
    "bestReferenceCandidatePath",
    "absoluteReferencePath",
    "expectedCanonicalFilename",
  ];

  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(",")),
  ].join("\n");
}

function buildReport(params: {
  generatedAt: string;
  readinessPath: string;
  outDir: string;
  readiness: ReadinessPayload;
  manifests: CycleManifest[];
  missingReferences: ManifestRow[];
}): string {
  const totalRows = params.manifests.reduce((sum, manifest) => sum + manifest.totalRows, 0);
  const familyCounts = new Map<string, number>();

  for (const manifest of params.manifests) {
    for (const row of manifest.rows) {
      const family = row.family ?? "(none)";
      familyCounts.set(family, (familyCounts.get(family) ?? 0) + 1);
    }
  }

  return [
    "# Best Bottles Cap-On Generation Cycles",
    "",
    `Generated: ${params.generatedAt}`,
    "",
    "## Sources",
    "",
    `- Readiness JSON: ${params.readinessPath}`,
    `- Readiness generated at: ${params.readiness.generatedAt ?? "unknown"}`,
    `- Source-of-truth date: ${params.readiness.sourceOfTruthDate ?? "unknown"}`,
    `- Output directory: ${params.outDir}`,
    `- Pipeline lane: ${PIPELINE_LANE_ID}`,
    "",
    "## Summary",
    "",
    `- Eligible cap-on rows: ${totalRows}`,
    `- Cycles: ${params.manifests.length}`,
    `- Missing reference files on disk: ${params.missingReferences.length}`,
    "",
    "## Cycles",
    "",
    "| Cycle | Rows | Manifest |",
    "| --- | ---: | --- |",
    ...params.manifests.map(
      (manifest) => `| ${manifest.cycleId} | ${manifest.totalRows} | ${manifest.cycleId}.json |`,
    ),
    "",
    "## Families",
    "",
    "| Family | Rows |",
    "| --- | ---: |",
    ...[...familyCounts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([family, count]) => `| ${family} | ${count} |`),
    "",
  ].join("\n");
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const readinessPath = path.resolve(ROOT, args.readiness ?? DEFAULT_READINESS);
  const outDir = path.resolve(ROOT, args.outDir ?? DEFAULT_OUT_DIR);
  const reportPath = path.resolve(ROOT, args.report ?? DEFAULT_REPORT);
  const readiness = validateReadinessPayload(readJson(readinessPath));
  const rows = eligibleRows(readiness.rows);
  const cycles = splitBalanced(rows);
  const generatedAt = new Date().toISOString();

  fs.mkdirSync(outDir, { recursive: true });

  const manifests = cycles.map((cycleRows, index): CycleManifest => {
    const launchOrder = index + 1;
    const cycleId = `cycle-${String(launchOrder).padStart(2, "0")}`;
    const manifestRows = cycleRows.map((row) => toManifestRow(row, cycleId, launchOrder));

    return {
      generatedAt,
      sourceReadiness: readinessPath,
      sourceReadinessGeneratedAt: readiness.generatedAt ?? null,
      sourceOfTruthDate: readiness.sourceOfTruthDate ?? null,
      pipelineLaneId: PIPELINE_LANE_ID,
      mode: "cap-on",
      cycleId,
      launchOrder,
      totalRows: manifestRows.length,
      rows: manifestRows,
    };
  });

  const allRows = manifests.flatMap((manifest) => manifest.rows);
  const missingReferences = allRows.filter((row) => !fs.existsSync(row.absoluteReferencePath));

  if (missingReferences.length > 0 && !args.allowMissingReferences) {
    const examples = missingReferences
      .slice(0, 10)
      .map((row) => `${row.graceSku}: ${row.absoluteReferencePath}`)
      .join("\n");
    throw new Error(`Missing ${missingReferences.length} reference files.\n${examples}`);
  }

  for (const manifest of manifests) {
    fs.writeFileSync(
      path.join(outDir, `${manifest.cycleId}.json`),
      `${JSON.stringify(manifest, null, 2)}\n`,
    );
  }

  fs.writeFileSync(
    path.join(outDir, "index.json"),
    `${JSON.stringify(
      {
        generatedAt,
        pipelineLaneId: PIPELINE_LANE_ID,
        mode: "cap-on",
        totalRows: allRows.length,
        cycles: manifests.map((manifest) => ({
          cycleId: manifest.cycleId,
          launchOrder: manifest.launchOrder,
          totalRows: manifest.totalRows,
          manifestPath: path.join(outDir, `${manifest.cycleId}.json`),
        })),
      },
      null,
      2,
    )}\n`,
  );

  fs.writeFileSync(path.join(outDir, "cycles.csv"), `${toCsv(allRows)}\n`);
  ensureParentDir(reportPath);
  fs.writeFileSync(
    reportPath,
    buildReport({ generatedAt, readinessPath, outDir, readiness, manifests, missingReferences }),
  );

  console.log(`Wrote ${allRows.length} cap-on rows across ${manifests.length} cycles.`);
  for (const manifest of manifests) console.log(`${manifest.cycleId}: ${manifest.totalRows}`);
  console.log(`Report: ${reportPath}`);
}

main();
