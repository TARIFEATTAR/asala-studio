import { createHash } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import type { PsdReviewUnit } from "../../src/lib/bestBottlesPsdCapStateAudit";
import {
  applyPsdReviewDecisions,
  type PsdReviewDecision,
  type PsdReviewedUnit,
} from "../../src/lib/bestBottlesPsdReviewDecisions";

const DEFAULT_AUDIT_ROOT = "tmp/best-bottles-reference-production/psd-cap-state-audit-v1";

const ARTIFACT_FILENAMES = [
  "reviewed-manifest.json",
  "approved-cap-on.csv",
  "approved-cap-off.csv",
  "approved-detached-or-sidecar.csv",
  "component-only.csv",
  "multi-product-layout.csv",
  "pending-human-review.csv",
  "blocked-review.csv",
  "review-summary.json",
] as const;

const REVIEWED_COLUMNS = [
  "reviewUnitKey",
  "sourceSha256",
  "websiteSku",
  "graceSku",
  "family",
  "identityStatus",
  "classification",
  "reviewStatus",
  "reviewer",
  "reviewedAt",
  "notes",
  "sourcePaths",
] as const;

const PENDING_COLUMNS = [
  "reviewUnitKey",
  "sourceSha256",
  "websiteSku",
  "graceSku",
  "family",
  "identityStatus",
  "proposedClassification",
  "representativePreviewPath",
] as const;

type CsvScalar = string | number | null | undefined | readonly string[];
type CsvRow = Record<string, CsvScalar>;

export interface PsdReviewSummary {
  reviewUnitCount: number;
  decisionCount: number;
  reviewedCount: number;
  approvedCount: number;
  blockedCount: number;
  pendingHumanReviewCount: number;
  approvedCapOnCount: number;
  approvedCapOffCount: number;
  approvedDetachedOrSidecarCount: number;
  componentOnlyCount: number;
  multiProductLayoutCount: number;
  externalWriteCount: 0;
  localArtifactCount: number;
}

export interface ApplyPsdCapStateReviewResult {
  summary: PsdReviewSummary;
  artifactPaths: string[];
}

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field.replace(/\r$/, ""));
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (quoted) throw new Error("Decision CSV contains an unterminated quoted field.");
  if (field !== "" || row.length > 0) {
    row.push(field.replace(/\r$/, ""));
    if (row.some((value) => value !== "")) rows.push(row);
  }
  return rows;
}

export function parsePsdReviewDecisionsCsv(text: string): PsdReviewDecision[] {
  const [header, ...rows] = parseCsvRows(text);
  if (!header) throw new Error("Decision CSV is empty.");
  const required = ["reviewUnitKey", "sourceSha256", "decision", "reviewer", "reviewedAt", "notes"];
  const indexes = new Map(header.map((column, index) => [column, index]));
  for (const column of required) {
    if (!indexes.has(column)) throw new Error(`Decision CSV is missing required column ${column}.`);
  }
  const value = (row: string[], column: string): string => row[indexes.get(column)!] ?? "";
  return rows
    .filter((row) => value(row, "decision").trim() !== "")
    .map((row) => ({
      reviewUnitKey: value(row, "reviewUnitKey").trim(),
      sourceSha256: value(row, "sourceSha256").trim(),
      decision: value(row, "decision").trim() as PsdReviewDecision["decision"],
      reviewer: value(row, "reviewer").trim(),
      reviewedAt: value(row, "reviewedAt").trim(),
      notes: value(row, "notes"),
    }));
}

function csvValue(value: CsvScalar): string {
  if (value === null || value === undefined) return "";
  const text = Array.isArray(value) ? JSON.stringify(value) : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(columns: readonly string[], rows: readonly CsvRow[]): string {
  return `${[
    columns.join(","),
    ...rows.map((row) => columns.map((column) => csvValue(row[column])).join(",")),
  ].join("\n")}\n`;
}

function reviewedRow(unit: PsdReviewedUnit): CsvRow {
  return {
    reviewUnitKey: unit.reviewUnitKey,
    sourceSha256: unit.sourceSha256,
    websiteSku: unit.websiteSku,
    graceSku: unit.graceSku,
    family: unit.family,
    identityStatus: unit.identityStatus,
    classification: unit.classification,
    reviewStatus: unit.reviewStatus,
    reviewer: unit.reviewer.identity,
    reviewedAt: unit.reviewedAt,
    notes: unit.notes,
    sourcePaths: unit.sources.map((source) => source.sourcePath),
  };
}

function pendingRow(unit: PsdReviewUnit): CsvRow {
  return {
    reviewUnitKey: unit.reviewUnitKey,
    sourceSha256: unit.sourceSha256,
    websiteSku: unit.websiteSku,
    graceSku: unit.graceSku,
    family: unit.family,
    identityStatus: unit.representative.identityStatus,
    proposedClassification: unit.representative.machineTriage.proposedClassification,
    representativePreviewPath: unit.representative.composite?.previewPath,
  };
}

export async function applyPsdCapStateReview(input: {
  reviewUnitsPath: string;
  decisionsPath: string;
  outputRoot: string;
}): Promise<ApplyPsdCapStateReviewResult> {
  const parsedUnits: unknown = JSON.parse(await readFile(input.reviewUnitsPath, "utf8"));
  if (!Array.isArray(parsedUnits)) throw new Error("Review-units JSON must contain an array.");
  const reviewUnits = parsedUnits as PsdReviewUnit[];
  const decisions = parsePsdReviewDecisionsCsv(await readFile(input.decisionsPath, "utf8"));
  const result = applyPsdReviewDecisions({ reviewUnits, decisions });
  for (const unit of result.approved) {
    for (const source of unit.sources) {
      const composite = source.composite;
      if (composite === null) {
        throw new Error(`Approved review unit ${unit.reviewUnitKey} is missing composite evidence.`);
      }
      if (basename(composite.previewPath) !== `${source.sourceSha256}.png`) {
        throw new Error(`Approved review unit ${unit.reviewUnitKey} has a non-hash-keyed preview path.`);
      }
      let preview: Buffer;
      try {
        preview = await readFile(composite.previewPath);
      } catch (error) {
        throw new Error(
          `Approved review unit ${unit.reviewUnitKey} preview cannot be read: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      const actualHash = createHash("sha256").update(preview).digest("hex");
      if (actualHash !== composite.evidenceSha256.toLowerCase()) {
        throw new Error(`Approved review unit ${unit.reviewUnitKey} preview hash does not match evidence.`);
      }
    }
  }

  const approvedCapOn = result.approved.filter((unit) => unit.classification === "assembled-cap-on");
  const approvedCapOff = result.approved.filter((unit) => unit.classification === "cap-off-applicator-exposed");
  const approvedDetached = result.approved.filter((unit) => unit.classification === "detached-cap-or-sidecar");
  const componentOnly = result.approved.filter((unit) => unit.classification === "component-only");
  const multiProduct = result.approved.filter((unit) => unit.classification === "multi-product-layout");
  const summary: PsdReviewSummary = {
    reviewUnitCount: reviewUnits.length,
    decisionCount: decisions.length,
    reviewedCount: result.reviewed.length,
    approvedCount: result.approved.length,
    blockedCount: result.blocked.length,
    pendingHumanReviewCount: result.pending.length,
    approvedCapOnCount: approvedCapOn.length,
    approvedCapOffCount: approvedCapOff.length,
    approvedDetachedOrSidecarCount: approvedDetached.length,
    componentOnlyCount: componentOnly.length,
    multiProductLayoutCount: multiProduct.length,
    externalWriteCount: 0,
    localArtifactCount: ARTIFACT_FILENAMES.length,
  };

  await mkdir(input.outputRoot, { recursive: true });
  const content: Record<(typeof ARTIFACT_FILENAMES)[number], string> = {
    "reviewed-manifest.json": `${JSON.stringify(result.reviewed, null, 2)}\n`,
    "approved-cap-on.csv": toCsv(REVIEWED_COLUMNS, approvedCapOn.map(reviewedRow)),
    "approved-cap-off.csv": toCsv(REVIEWED_COLUMNS, approvedCapOff.map(reviewedRow)),
    "approved-detached-or-sidecar.csv": toCsv(REVIEWED_COLUMNS, approvedDetached.map(reviewedRow)),
    "component-only.csv": toCsv(REVIEWED_COLUMNS, componentOnly.map(reviewedRow)),
    "multi-product-layout.csv": toCsv(REVIEWED_COLUMNS, multiProduct.map(reviewedRow)),
    "pending-human-review.csv": toCsv(PENDING_COLUMNS, result.pending.map(pendingRow)),
    "blocked-review.csv": toCsv(REVIEWED_COLUMNS, result.blocked.map(reviewedRow)),
    "review-summary.json": `${JSON.stringify(summary, null, 2)}\n`,
  };
  await Promise.all(ARTIFACT_FILENAMES.map((filename) => (
    writeFile(join(input.outputRoot, filename), content[filename], "utf8")
  )));
  return {
    summary,
    artifactPaths: ARTIFACT_FILENAMES.map((filename) => join(input.outputRoot, filename)),
  };
}

function argumentValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const outputRoot = resolve(argumentValue("--output") ?? DEFAULT_AUDIT_ROOT);
  const reviewUnitsPath = resolve(argumentValue("--review-units") ?? join(outputRoot, "review-units.json"));
  const explicitDecisions = argumentValue("--decisions");
  const completedDecisionsPath = resolve(join(outputRoot, "review-decisions.csv"));
  const decisionsPath = resolve(explicitDecisions ?? (
    await exists(completedDecisionsPath)
      ? completedDecisionsPath
      : join(outputRoot, "review-decisions-template.csv")
  ));
  const result = await applyPsdCapStateReview({ reviewUnitsPath, decisionsPath, outputRoot });
  process.stdout.write(`${JSON.stringify({
    reviewUnitsPath,
    decisionsPath,
    outputRoot,
    summary: result.summary,
  }, null, 2)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
