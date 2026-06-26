#!/usr/bin/env tsx
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import sharp from "sharp";

type WorkflowLane =
  | "quarantine_or_exclude"
  | "needs_sku_key_correction"
  | "needs_shopify_mapping"
  | "needs_reference"
  | "needs_canonical_reference_choice"
  | "approved_reference_needs_regeneration"
  | "approved_unknown_needs_provenance_review"
  | "ready_to_generate_after_shopify_preflight"
  | "ready_to_generate"
  | "generated_needs_visual_review"
  | "approved_generated_ready_to_push"
  | "live_needs_convex_sync"
  | "live_needs_provenance_spot_check"
  | "complete_generated";

type PrepStatus =
  | "ready_for_madison_import"
  | "ready_for_madison_import_with_review"
  | "needs_background_removal"
  | "needs_alpha_edge_review"
  | "needs_source_match"
  | "needs_manual_duplicate_choice"
  | "needs_sku_key_correction"
  | "needs_cap_state";

interface WorkflowPayload {
  rows: WorkflowRow[];
}

interface WorkflowRow {
  graceSku: string;
  websiteSku: string | null;
  shopifySku?: string | null;
  family: string | null;
  productGroupSlug: string | null;
  productGroupDisplayName: string | null;
  workflowLane: WorkflowLane;
  gate: string;
  sourceCapState: "cap-on" | "cap-off" | null;
  proposedSourcePath: string | null;
  skuNamingState: string;
}

interface SourceImageCandidate {
  absolutePath: string;
  relativePath: string;
  extension: string;
  keys: string[];
}

interface AlphaInspection {
  width: number;
  height: number;
  hasAlpha: boolean;
  transparentPixels: number;
  semiTransparentPixels: number;
  opaquePixels: number;
  foregroundPixels: number;
  transparentPct: number;
  semiTransparentForegroundPct: number;
  foregroundTouchesEdge: boolean;
}

interface PrepRow {
  status: PrepStatus;
  graceSku: string;
  websiteSku: string | null;
  family: string | null;
  productGroupSlug: string | null;
  workflowLane: WorkflowLane;
  sourcePath: string | null;
  sourceMatchCount: number;
  targetPath: string | null;
  capState: "cap-on" | "cap-off" | null;
  width: number | null;
  height: number | null;
  hasAlpha: boolean | null;
  transparentPct: number | null;
  semiTransparentForegroundPct: number | null;
  foregroundTouchesEdge: boolean | null;
  copied: boolean;
  issues: string[];
}

interface PrepPayload {
  generatedAt: string;
  dryRun: boolean;
  source: {
    workflow: string;
    inputRoot: string;
    outputRoot: string;
  };
  policy: {
    filename: string;
    capStates: string;
    alphaGuardrail: string;
    rgbGuardrail: string;
  };
  summary: {
    totalRows: number;
    readyForMadisonImport: number;
    readyForMadisonImportWithReview: number;
    needsBackgroundRemoval: number;
    needsAlphaEdgeReview: number;
    needsSourceMatch: number;
    needsManualDuplicateChoice: number;
    needsSkuKeyCorrection: number;
    needsCapState: number;
    capOn: number;
    capOff: number;
    capStateMissing: number;
    readyCapOn: number;
    readyCapOff: number;
    copied: number;
  };
  rows: PrepRow[];
}

const BEST_BOTTLES_REPO =
  "/Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Website-02-20-2026";
const DEFAULT_WORKFLOW = "tmp/best-bottles-family-workflow-sequence-cylinder.json";
const DEFAULT_INPUT_ROOT = path.join(
  BEST_BOTTLES_REPO,
  "pipeline/aios-shopify-pdp-images/00-input/reference-flattened",
);
const DEFAULT_OUTPUT_ROOT = path.join(
  BEST_BOTTLES_REPO,
  "pipeline/aios-shopify-pdp-images/00-input/reference-transparent/cylinder",
);
const DEFAULT_OUT_JSON = "tmp/best-bottles-cylinder-transparent-reference-prep.json";
const DEFAULT_OUT_CSV = "tmp/best-bottles-cylinder-transparent-reference-prep.csv";
const DEFAULT_PUBLIC_OUT_JSON = "public/data/best-bottles-cylinder-reference-rig-readiness.json";
const DEFAULT_REPORT = "docs/best-bottles-cylinder-transparent-reference-prep.md";
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);
const TARGET_LANES = new Set<WorkflowLane>([
  "needs_reference",
  "needs_canonical_reference_choice",
  "approved_reference_needs_regeneration",
  "ready_to_generate_after_shopify_preflight",
  "ready_to_generate",
]);

function getArg(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  if (index < 0) return fallback;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) return fallback;
  return value;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(path.resolve(filePath), "utf8")) as T;
}

function ensureParent(filePath: string): void {
  fs.mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true });
}

function normalizeKey(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function isCanonicalGraceSku(value: string | null | undefined): boolean {
  return /^[A-Z]{2}-[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(value?.trim() ?? "");
}

function safeSegment(value: string | null | undefined): string {
  return String(value ?? "unknown")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96) || "unknown";
}

function csvEscape(value: unknown): string {
  if (value == null) return "";
  const text = Array.isArray(value) ? value.join("; ") : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function walkImages(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const filePath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(filePath);
      } else if (entry.isFile() && IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        out.push(filePath);
      }
    }
  };
  walk(root);
  return out;
}

function filenameKeys(filePath: string): string[] {
  const stem = path.basename(filePath, path.extname(filePath));
  const parts = stem.split("__").filter(Boolean);
  const keys = new Set<string>([normalizeKey(stem)]);
  for (const part of parts) {
    if (!/^(legacy-reference|pdp-main|v\d+|cap-on|cap-off|transparent|cutout)$/i.test(part)) {
      keys.add(normalizeKey(part));
    }
  }
  return Array.from(keys).filter(Boolean);
}

function scanSourceImages(inputRoot: string): SourceImageCandidate[] {
  const root = path.resolve(inputRoot);
  return walkImages(root)
    .filter((filePath) => /cyl|cylinder/i.test(path.relative(root, filePath)))
    .map((absolutePath) => ({
      absolutePath,
      relativePath: path.relative(root, absolutePath),
      extension: path.extname(absolutePath).toLowerCase(),
      keys: filenameKeys(absolutePath),
    }));
}

function buildCandidateIndex(candidates: SourceImageCandidate[]): Map<string, SourceImageCandidate[]> {
  const index = new Map<string, SourceImageCandidate[]>();
  for (const candidate of candidates) {
    for (const key of candidate.keys) {
      const values = index.get(key) ?? [];
      values.push(candidate);
      index.set(key, values);
    }
  }
  return index;
}

function scoreCandidate(candidate: SourceImageCandidate): number {
  let score = 0;
  if (candidate.extension === ".png") score += 100;
  if (/reference-flattened/i.test(candidate.absolutePath)) score += 20;
  if (/transparent|cutout|alpha|png/i.test(candidate.relativePath)) score += 10;
  return score;
}

function findMatches(row: WorkflowRow, index: Map<string, SourceImageCandidate[]>): SourceImageCandidate[] {
  const keys = [row.graceSku, row.websiteSku, row.shopifySku].map(normalizeKey).filter(Boolean);
  const matches = new Map<string, SourceImageCandidate>();
  for (const key of keys) {
    for (const candidate of index.get(key) ?? []) {
      matches.set(candidate.absolutePath, candidate);
    }
  }
  return Array.from(matches.values()).sort(
    (a, b) => scoreCandidate(b) - scoreCandidate(a) || a.absolutePath.localeCompare(b.absolutePath),
  );
}

function inferCapState(row: WorkflowRow, candidate: SourceImageCandidate | null): "cap-on" | "cap-off" | null {
  const text = [row.sourceCapState, row.proposedSourcePath, candidate?.relativePath, candidate?.absolutePath]
    .filter(Boolean)
    .join(" ");
  if (/(^|[^a-z])cap[-_\s]?off([^a-z]|$)|exploded|detached|uncapped|cap[-_\s]?side/i.test(text)) return "cap-off";
  if (/(^|[^a-z])cap[-_\s]?on([^a-z]|$)/i.test(text)) return "cap-on";
  return row.sourceCapState ?? null;
}

async function inspectAlpha(filePath: string): Promise<AlphaInspection> {
  const image = sharp(filePath, { animated: false }).ensureAlpha();
  const metadata = await sharp(filePath, { animated: false }).metadata();
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  let transparentPixels = 0;
  let semiTransparentPixels = 0;
  let opaquePixels = 0;
  let foregroundPixels = 0;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const alpha = data[(y * info.width + x) * info.channels + 3] ?? 255;
      if (alpha <= 2) {
        transparentPixels += 1;
        continue;
      }
      foregroundPixels += 1;
      if (alpha >= 253) opaquePixels += 1;
      else semiTransparentPixels += 1;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  const totalPixels = info.width * info.height;
  const foregroundTouchesEdge =
    foregroundPixels > 0 && (minX <= 0 || minY <= 0 || maxX >= info.width - 1 || maxY >= info.height - 1);

  return {
    width: info.width,
    height: info.height,
    hasAlpha: Boolean(metadata.hasAlpha),
    transparentPixels,
    semiTransparentPixels,
    opaquePixels,
    foregroundPixels,
    transparentPct: totalPixels > 0 ? transparentPixels / totalPixels : 0,
    semiTransparentForegroundPct: foregroundPixels > 0 ? semiTransparentPixels / foregroundPixels : 0,
    foregroundTouchesEdge,
  };
}

function statusFor(row: WorkflowRow, candidate: SourceImageCandidate | null, matchCount: number, alpha: AlphaInspection | null, capState: string | null): PrepStatus {
  if (!isCanonicalGraceSku(row.graceSku)) return "needs_sku_key_correction";
  if (matchCount === 0 || !candidate) return "needs_source_match";
  if (matchCount > 1) return "needs_manual_duplicate_choice";
  if (!capState) return "needs_cap_state";
  if (!alpha || candidate.extension !== ".png" || !alpha.hasAlpha || alpha.transparentPct < 0.05) {
    return "needs_background_removal";
  }
  if (alpha.semiTransparentForegroundPct < 0.002) return "needs_alpha_edge_review";
  if (alpha.foregroundTouchesEdge) return "ready_for_madison_import_with_review";
  return "ready_for_madison_import";
}

function issuesFor(params: {
  row: WorkflowRow;
  candidate: SourceImageCandidate | null;
  matchCount: number;
  alpha: AlphaInspection | null;
  capState: string | null;
}): string[] {
  const issues: string[] = [];
  if (!isCanonicalGraceSku(params.row.graceSku)) issues.push("Grace SKU key is not canonical Convex/Grace format.");
  if (params.matchCount === 0) issues.push("No local Cylinder source image matched Grace/website/Shopify SKU.");
  if (params.matchCount > 1) issues.push("Multiple local source images matched; choose one manually.");
  if (!params.capState) issues.push("Cap state is not explicit. Use only cap-on or cap-off.");
  if (params.candidate && params.candidate.extension !== ".png") issues.push("Source is not PNG; export PNG-32 with alpha before import.");
  if (params.alpha && !params.alpha.hasAlpha) issues.push("PNG has no alpha channel.");
  if (params.alpha && params.alpha.transparentPct < 0.05) issues.push("Too little transparency; background was probably not removed.");
  if (params.alpha && params.alpha.semiTransparentForegroundPct < 0.002) {
    issues.push("Very few semi-transparent edge pixels; RGB/threshold removal may have damaged glass edges.");
  }
  if (params.alpha?.foregroundTouchesEdge) issues.push("Foreground touches image edge; verify product is not cropped.");
  return issues;
}

function buildTargetPath(outputRoot: string, row: WorkflowRow, capState: "cap-on" | "cap-off" | null): string | null {
  if (!capState || !isCanonicalGraceSku(row.graceSku)) return null;
  return path.join(path.resolve(outputRoot), safeSegment(row.productGroupSlug), capState, `${row.graceSku}.png`);
}

async function toPrepRow(params: {
  row: WorkflowRow;
  index: Map<string, SourceImageCandidate[]>;
  outputRoot: string;
  apply: boolean;
}): Promise<PrepRow> {
  const matches = findMatches(params.row, params.index);
  const candidate = matches[0] ?? null;
  const capState = inferCapState(params.row, candidate);
  const alpha = candidate ? await inspectAlpha(candidate.absolutePath) : null;
  const status = statusFor(params.row, candidate, matches.length, alpha, capState);
  const targetPath = buildTargetPath(params.outputRoot, params.row, capState);
  let copied = false;

  if (params.apply && status === "ready_for_madison_import" && candidate && targetPath) {
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.copyFileSync(candidate.absolutePath, targetPath);
    copied = true;
  }

  return {
    status,
    graceSku: params.row.graceSku,
    websiteSku: params.row.websiteSku,
    family: params.row.family,
    productGroupSlug: params.row.productGroupSlug,
    workflowLane: params.row.workflowLane,
    sourcePath: candidate?.absolutePath ?? null,
    sourceMatchCount: matches.length,
    targetPath,
    capState,
    width: alpha?.width ?? null,
    height: alpha?.height ?? null,
    hasAlpha: alpha?.hasAlpha ?? null,
    transparentPct: alpha ? Number(alpha.transparentPct.toFixed(4)) : null,
    semiTransparentForegroundPct: alpha ? Number(alpha.semiTransparentForegroundPct.toFixed(4)) : null,
    foregroundTouchesEdge: alpha?.foregroundTouchesEdge ?? null,
    copied,
    issues: issuesFor({ row: params.row, candidate, matchCount: matches.length, alpha, capState }),
  };
}

function summarize(rows: PrepRow[]): PrepPayload["summary"] {
  const readyRows = rows.filter((row) =>
    row.status === "ready_for_madison_import" || row.status === "ready_for_madison_import_with_review",
  );
  return {
    totalRows: rows.length,
    readyForMadisonImport: rows.filter((row) => row.status === "ready_for_madison_import").length,
    readyForMadisonImportWithReview: rows.filter((row) => row.status === "ready_for_madison_import_with_review").length,
    needsBackgroundRemoval: rows.filter((row) => row.status === "needs_background_removal").length,
    needsAlphaEdgeReview: rows.filter((row) => row.status === "needs_alpha_edge_review").length,
    needsSourceMatch: rows.filter((row) => row.status === "needs_source_match").length,
    needsManualDuplicateChoice: rows.filter((row) => row.status === "needs_manual_duplicate_choice").length,
    needsSkuKeyCorrection: rows.filter((row) => row.status === "needs_sku_key_correction").length,
    needsCapState: rows.filter((row) => row.status === "needs_cap_state").length,
    capOn: rows.filter((row) => row.capState === "cap-on").length,
    capOff: rows.filter((row) => row.capState === "cap-off").length,
    capStateMissing: rows.filter((row) => !row.capState).length,
    readyCapOn: readyRows.filter((row) => row.capState === "cap-on").length,
    readyCapOff: readyRows.filter((row) => row.capState === "cap-off").length,
    copied: rows.filter((row) => row.copied).length,
  };
}

function toCsv(rows: PrepRow[]): string {
  const headers: Array<keyof PrepRow> = [
    "status",
    "graceSku",
    "websiteSku",
    "family",
    "productGroupSlug",
    "workflowLane",
    "sourcePath",
    "sourceMatchCount",
    "targetPath",
    "capState",
    "width",
    "height",
    "hasAlpha",
    "transparentPct",
    "semiTransparentForegroundPct",
    "foregroundTouchesEdge",
    "copied",
    "issues",
  ];
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(",")),
  ].join("\n");
}

function markdownTable(rows: Array<Array<string | number>>): string {
  const header = rows[0];
  const body = rows.slice(1);
  return [
    `| ${header.join(" | ")} |`,
    `| ${header.map(() => "---").join(" | ")} |`,
    ...body.map((row) => `| ${row.join(" | ")} |`),
  ].join("\n");
}

function buildReport(payload: PrepPayload, outJson: string, outCsv: string): string {
  const statusRows: Array<[string, number]> = [
    ["Ready for Madison import", payload.summary.readyForMadisonImport],
    ["Ready with crop review", payload.summary.readyForMadisonImportWithReview],
    ["Needs background removal", payload.summary.needsBackgroundRemoval],
    ["Needs alpha edge review", payload.summary.needsAlphaEdgeReview],
    ["Needs source match", payload.summary.needsSourceMatch],
    ["Needs duplicate choice", payload.summary.needsManualDuplicateChoice],
    ["Needs SKU key correction", payload.summary.needsSkuKeyCorrection],
    ["Needs cap state", payload.summary.needsCapState],
  ];
  const sampleRows = payload.rows.slice(0, 25).map((row) => [
    row.status,
    row.graceSku,
    row.websiteSku ?? "",
    row.productGroupSlug ?? "",
    row.capState ?? "",
    row.issues.join("; "),
  ]);

  return `# Best Bottles Cylinder Transparent Reference Prep

Generated: ${payload.generatedAt}
Mode: ${payload.dryRun ? "dry run" : "apply"}
Workflow source: \`${payload.source.workflow}\`
Input root: \`${payload.source.inputRoot}\`
Output root: \`${payload.source.outputRoot}\`
Outputs: \`${outJson}\`, \`${outCsv}\`

## Operating Decision

Use this as the gate between Photoshop/background-removal work and Madison import. The script is intentionally conservative: it does not remove backgrounds automatically, and it does not copy anything unless \`--apply\` is passed. When it does copy, it preserves the original PNG bytes and only renames/places files that already pass the transparent PNG checks.

## Summary

- Targeted Cylinder workflow rows: ${payload.summary.totalRows}
- Ready for Madison import: ${payload.summary.readyForMadisonImport}
- Ready but needs crop review: ${payload.summary.readyForMadisonImportWithReview}
- Needs background removal / PNG-32 alpha export: ${payload.summary.needsBackgroundRemoval}
- Needs alpha edge review: ${payload.summary.needsAlphaEdgeReview}
- Needs source match: ${payload.summary.needsSourceMatch}
- Needs manual duplicate choice: ${payload.summary.needsManualDuplicateChoice}
- Needs SKU key correction: ${payload.summary.needsSkuKeyCorrection}
- Needs explicit cap state: ${payload.summary.needsCapState}
- Cap-on references: ${payload.summary.capOn} (${payload.summary.readyCapOn} ready)
- Cap-off references: ${payload.summary.capOff} (${payload.summary.readyCapOff} ready)
- Copied this run: ${payload.summary.copied}

## Statuses

${markdownTable([["Status", "Rows"], ...statusRows])}

## Background Removal Guardrails

- Export transparent PNG-32 with alpha. Do not flatten to RGB.
- Do not use a hard white-threshold cutout on glass, frosted edges, sprayers, caps, shadows, tubes, or transparent reducers.
- Preserve semi-transparent pixels around the glass and component edges; if edge alpha is nearly all hard 0/255, review before import.
- Preserve the original file as the source of truth; the prepared folder is a named import staging area, not the only copy.
- Final import filename must be exactly \`{graceSku}.png\`.
- Cap state must be only \`cap-on\` or \`cap-off\`; \`cap-off\` means the cap is visible beside the bottle.

## First 25 Rows

${markdownTable([["Status", "Grace SKU", "Website SKU", "Product group", "Cap state", "Issues"], ...sampleRows])}
`;
}

async function main(): Promise<void> {
  const workflowPath = getArg("--workflow", DEFAULT_WORKFLOW);
  const inputRoot = getArg("--input-root", DEFAULT_INPUT_ROOT);
  const outputRoot = getArg("--output-root", DEFAULT_OUTPUT_ROOT);
  const outJson = getArg("--out-json", DEFAULT_OUT_JSON);
  const outCsv = getArg("--out-csv", DEFAULT_OUT_CSV);
  const publicOutJson = getArg("--public-out-json", DEFAULT_PUBLIC_OUT_JSON);
  const report = getArg("--report", DEFAULT_REPORT);
  const apply = hasFlag("--apply");
  const workflow = readJson<WorkflowPayload>(workflowPath);
  const candidates = scanSourceImages(inputRoot);
  const index = buildCandidateIndex(candidates);
  const targetRows = workflow.rows
    .filter((row) => /cylinder/i.test(row.family ?? ""))
    .filter((row) => TARGET_LANES.has(row.workflowLane));
  const rows: PrepRow[] = [];
  for (const row of targetRows) {
    rows.push(await toPrepRow({ row, index, outputRoot, apply }));
  }
  rows.sort((a, b) => a.status.localeCompare(b.status) || a.graceSku.localeCompare(b.graceSku));

  const payload: PrepPayload = {
    generatedAt: new Date().toISOString(),
    dryRun: !apply,
    source: {
      workflow: workflowPath,
      inputRoot: path.resolve(inputRoot),
      outputRoot: path.resolve(outputRoot),
    },
    policy: {
      filename: "{graceSku}.png",
      capStates: "cap-on or cap-off only",
      alphaGuardrail: "Transparent PNG must have an alpha channel and preserve semi-transparent edge pixels.",
      rgbGuardrail: "Do not flatten to RGB or use hard threshold removal for glass references.",
    },
    summary: summarize(rows),
    rows,
  };

  for (const filePath of [outJson, outCsv, publicOutJson, report]) ensureParent(filePath);
  fs.writeFileSync(path.resolve(outJson), `${JSON.stringify(payload, null, 2)}\n`);
  fs.writeFileSync(path.resolve(outCsv), `${toCsv(rows)}\n`);
  fs.writeFileSync(path.resolve(publicOutJson), `${JSON.stringify(payload, null, 2)}\n`);
  fs.writeFileSync(path.resolve(report), buildReport(payload, outJson, outCsv));

  console.log(`Wrote ${outJson}`);
  console.log(`Wrote ${outCsv}`);
  console.log(`Wrote ${publicOutJson}`);
  console.log(`Wrote ${report}`);
  console.log(JSON.stringify(payload.summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
