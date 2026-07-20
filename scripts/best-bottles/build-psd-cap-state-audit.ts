import { createHash } from "node:crypto";
import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import { basename, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  groupPsdAuditRecords,
  type PsdAuditRecord,
  type PsdCanonicalReviewMetadata,
  type PsdIdentityState,
  type PsdReviewUnit,
} from "../../src/lib/bestBottlesPsdCapStateAudit";
import {
  buildCanonicalIdentityIndex,
  joinPsdSourceIdentity,
  type CanonicalIdentityIndex,
  type CanonicalTruthRow,
  type ReviewedPsdAlias,
} from "../../src/lib/bestBottlesPsdIdentityJoin";
import {
  runEvidencePool,
  type InspectPsdEvidenceInput,
  type PsdSourceEvidence,
  type PsdSourceInput,
} from "./psd-cap-state-evidence";

const DEFAULT_PSD_ARCHIVE_ROOT = "/Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Original-Photoshop-Sources";
const DEFAULT_CANONICAL_CSV = "docs/best-bottles-canonical-truth/best-bottles-master-truth.csv";
const REVIEWED_ALIAS_PATH = "docs/best-bottles-canonical-truth/best-bottles-psd-reviewed-aliases.json";
const DEFAULT_OUTPUT_ROOT = "tmp/best-bottles-reference-production/psd-cap-state-audit-v1";
const EXPECTED_CANONICAL_ROW_COUNT = 2_484;

const ARTIFACT_FILENAMES = [
  "source-inventory.json",
  "source-inventory.csv",
  "identity-join.json",
  "review-units.json",
  "review-decisions-template.csv",
  "unmatched-sources.csv",
  "ambiguous-identity.csv",
  "blocked-evidence.csv",
  "summary.json",
  "README.md",
] as const;

const DECISION_COLUMNS = [
  "reviewUnitKey",
  "sourceSha256",
  "websiteSku",
  "graceSku",
  "family",
  "representativePreviewPath",
  "proposedClassification",
  "decision",
  "reviewer",
  "reviewedAt",
  "notes",
] as const;

const SOURCE_INVENTORY_COLUMNS = [
  "sourcePath",
  "sourceRelativePath",
  "status",
  "cacheStatus",
  "sourceSha256",
  "sourceBytes",
  "sourceMtimeBefore",
  "sourceMtimeAfter",
  "sourceSizeBefore",
  "sourceSizeAfter",
  "previewPath",
  "evidencePath",
  "error",
] as const;

const RECORD_COLUMNS = [
  "sourcePath",
  "sourceRelativePath",
  "sourceSha256",
  "sourceBytes",
  "websiteSku",
  "graceSku",
  "family",
  "capacityMl",
  "applicator",
  "capStyle",
  "capColor",
  "bodyMaterial",
  "identityStatus",
  "identityReasons",
  "previewPath",
  "proposedClassification",
  "reviewStatus",
] as const;

type CsvScalar = string | number | boolean | null | undefined;
type CsvRow = Record<string, CsvScalar | readonly unknown[]>;

export interface PsdCapStateAuditSummary {
  sourceFileCount: number;
  accountedSourceCount: number;
  reviewUnitCount: number;
  exactWebsiteSkuCount: number;
  exactGraceSkuCount: number;
  reviewedAliasCount: number;
  unmatchedCount: number;
  ambiguousIdentityCount: number;
  identityConflictCount: number;
  blockedEvidenceCount: number;
  pendingHumanReviewCount: number;
  approvedCount: number;
  unchangedSourceCount: number;
  sourceMutationCount: number;
  externalWriteCount: 0;
  localArtifactCount: number;
}

export interface BuildPsdCapStateAuditInput {
  sourceFiles: readonly PsdSourceInput[];
  canonicalRows: readonly CanonicalTruthRow[];
  aliases: readonly ReviewedPsdAlias[];
  outputRoot: string;
  writeOutputs?: boolean;
  evidenceConcurrency?: number;
  inspectEvidence?: (
    input: InspectPsdEvidenceInput,
  ) => Promise<PsdSourceEvidence>;
}

export interface PsdCapStateAuditResult {
  sourceInventory: PsdSourceEvidence[];
  records: PsdAuditRecord[];
  reviewUnits: PsdReviewUnit[];
  summary: PsdCapStateAuditSummary;
  artifactPaths: string[];
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function normalizeIdentityKey(value: unknown): string {
  return String(value ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function sourceIdentityToken(sourceRelativePath: string): string {
  return basename(sourceRelativePath)
    .replace(/\.psd$/i, "")
    .replace(/^\s*\d+\s*[.)_-]\s*/, "")
    .replace(/[.\s]+$/g, "")
    .trim();
}

function parseCsvRows(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    if (inQuotes) {
      if (character === '"') {
        if (csv[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"' && field === "") {
      inQuotes = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n" || character === "\r") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      if (character === "\r" && csv[index + 1] === "\n") {
        index += 1;
      }
    } else {
      field += character;
    }
  }

  if (inQuotes) {
    throw new Error("Canonical CSV contains an unterminated quoted field.");
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((cells) => cells.some((cell) => cell !== ""));
}

export function parseCanonicalTruthCsv(csv: string): CanonicalTruthRow[] {
  const rows = parseCsvRows(csv);
  if (rows.length === 0) {
    throw new Error("Canonical truth CSV is empty.");
  }
  const headers = rows[0].map((header, index) => (
    index === 0 ? header.replace(/^\uFEFF/, "") : header
  ));
  const requiredHeaders = ["graceSku", "websiteSku", "family"];
  for (const header of requiredHeaders) {
    if (!headers.includes(header)) {
      throw new Error(`Canonical truth CSV is missing required column ${header}.`);
    }
  }

  return rows.slice(1).map((cells, rowIndex) => {
    if (cells.length !== headers.length) {
      throw new Error(
        `Canonical truth CSV row ${rowIndex + 2} has ${cells.length} fields; expected ${headers.length}.`,
      );
    }
    const raw = Object.fromEntries(headers.map((header, index) => [header, cells[index]]));
    return {
      ...raw,
      website_sku: raw.websiteSku,
      grace_sku: raw.graceSku,
      family: raw.family,
    } as CanonicalTruthRow;
  });
}

function isNodeErrorWithCode(error: unknown, code: string): boolean {
  return error instanceof Error
    && "code" in error
    && (error as NodeJS.ErrnoException).code === code;
}

export async function loadReviewedPsdAliases(
  aliasPath: string,
): Promise<ReviewedPsdAlias[]> {
  let json: string;
  try {
    json = await readFile(aliasPath, "utf8");
  } catch (error) {
    if (isNodeErrorWithCode(error, "ENOENT")) {
      return [];
    }
    throw error;
  }

  const parsed: unknown = JSON.parse(json);
  const aliases = Array.isArray(parsed)
    ? parsed
    : typeof parsed === "object" && parsed !== null && Array.isArray((parsed as { aliases?: unknown }).aliases)
      ? (parsed as { aliases: unknown[] }).aliases
      : null;
  if (aliases === null) {
    throw new Error("Reviewed PSD aliases must be a JSON array or an object with an aliases array.");
  }
  return aliases.map((value, index) => {
    if (typeof value !== "object" || value === null) {
      throw new Error(`Reviewed PSD alias ${index + 1} must be an object.`);
    }
    const alias = value as Record<string, unknown>;
    for (const field of ["sourceToken", "websiteSku", "graceSku", "reviewedBy", "reviewedAt"]) {
      if (typeof alias[field] !== "string") {
        throw new Error(`Reviewed PSD alias ${index + 1} has invalid ${field}.`);
      }
    }
    return alias as unknown as ReviewedPsdAlias;
  });
}

export async function listPsdSourceFiles(
  sourceRoot: string,
  limit?: number,
): Promise<PsdSourceInput[]> {
  const absoluteRoot = resolve(sourceRoot);
  const sources: PsdSourceInput[] = [];

  async function visit(directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => compareText(left.name, right.name));
    for (const entry of entries) {
      const sourcePath = join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(sourcePath);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".psd")) {
        sources.push({
          sourcePath,
          sourceRelativePath: relative(absoluteRoot, sourcePath),
        });
      }
    }
  }

  await visit(absoluteRoot);
  sources.sort((left, right) => compareText(left.sourceRelativePath, right.sourceRelativePath));
  if (limit === undefined) {
    return sources;
  }
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new Error(`PSD audit limit must be a positive integer, received ${limit}.`);
  }
  return sources.slice(0, limit);
}

function chooseIdentityInput(
  token: string,
  index: CanonicalIdentityIndex,
): { websiteSku: string | null; graceSku: string | null } {
  const normalized = normalizeIdentityKey(token);
  if ((index.byWebsiteSku.get(normalized) ?? []).length > 0) {
    return { websiteSku: token, graceSku: null };
  }
  if ((index.byGraceSku.get(normalized) ?? []).length > 0) {
    return { websiteSku: null, graceSku: token };
  }
  return { websiteSku: null, graceSku: null };
}

function reviewedAliasProvenance(
  token: string,
  row: CanonicalTruthRow,
  aliases: readonly ReviewedPsdAlias[],
): Extract<PsdIdentityState, { identityStatus: "reviewed-alias" }>["aliasProvenance"] {
  const alias = aliases.find((candidate) => (
    normalizeIdentityKey(candidate.sourceToken) === normalizeIdentityKey(token)
    && normalizeIdentityKey(candidate.websiteSku) === normalizeIdentityKey(row.website_sku)
    && normalizeIdentityKey(candidate.graceSku) === normalizeIdentityKey(row.grace_sku)
  ));
  if (!alias) {
    throw new Error(`Reviewed alias ${token} resolved without matching provenance.`);
  }
  return {
    observedAliasToken: alias.sourceToken,
    canonicalWebsiteSku: row.website_sku,
    canonicalGraceSku: row.grace_sku,
    reviewer: { kind: "human", identity: alias.reviewedBy },
    reviewedAt: alias.reviewedAt,
  };
}

function buildIdentityState(input: {
  token: string;
  status: ReturnType<typeof joinPsdSourceIdentity>["status"];
  row: CanonicalTruthRow | null;
  aliases: readonly ReviewedPsdAlias[];
}): PsdIdentityState {
  if (input.status === "reviewed-alias") {
    if (!input.row) {
      throw new Error("Reviewed alias identity is missing its canonical row.");
    }
    return {
      identityStatus: "reviewed-alias",
      websiteSku: input.row.website_sku,
      graceSku: input.row.grace_sku,
      aliasProvenance: reviewedAliasProvenance(input.token, input.row, input.aliases),
    };
  }
  if (input.status === "exact-website-sku") {
    if (!input.row) {
      throw new Error("Exact website identity is missing its canonical row.");
    }
    return {
      identityStatus: "exact-website-sku",
      websiteSku: input.row.website_sku,
      graceSku: input.row.grace_sku || null,
      aliasProvenance: null,
    };
  }
  if (input.status === "exact-grace-sku") {
    if (!input.row) {
      throw new Error("Exact Grace identity is missing its canonical row.");
    }
    return {
      identityStatus: "exact-grace-sku",
      websiteSku: input.row.website_sku || null,
      graceSku: input.row.grace_sku,
      aliasProvenance: null,
    };
  }
  return {
    identityStatus: input.status,
    websiteSku: null,
    graceSku: null,
    aliasProvenance: null,
  };
}

function blockedSourceKey(evidence: PsdSourceEvidence): string {
  return `UNAVAILABLE:${createHash("sha256")
    .update(`${evidence.sourceRelativePath}\0${evidence.sourcePath}`)
    .digest("hex")}`;
}

function buildRecord(input: {
  evidence: PsdSourceEvidence;
  identityState: PsdIdentityState;
  identityReasons: string[];
  family: string | null;
  canonicalReviewMetadata: PsdCanonicalReviewMetadata | null;
}): PsdAuditRecord {
  const identityBlocked = ["ambiguous", "conflict"].includes(input.identityState.identityStatus);
  const machineReasons = input.evidence.status === "ok"
    ? input.evidence.routingHints
    : [`evidence_blocked:${input.evidence.error}`];
  return {
    sourcePath: input.evidence.sourcePath,
    sourceRelativePath: input.evidence.sourceRelativePath,
    sourceSha256: input.evidence.sourceSha256 ?? blockedSourceKey(input.evidence),
    sourceBytes: input.evidence.sourceBytes ?? input.evidence.sourceSizeBefore ?? 0,
    family: input.family,
    canonicalReviewMetadata: input.canonicalReviewMetadata,
    identityReasons: input.identityReasons,
    composite: input.evidence.composite,
    machineTriage: {
      proposedClassification: identityBlocked
        ? "blocked-identity-conflict"
        : input.evidence.proposedClassification,
      confidence: "low",
      reasons: machineReasons.length > 0 ? machineReasons : ["visual_review_required"],
    },
    ...input.identityState,
    reviewStatus: "pending-human-review",
    reviewer: null,
    reviewedAt: null,
  };
}

function canonicalValue(row: CanonicalTruthRow, key: string): string | null {
  const value = row[key];
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function buildCanonicalReviewMetadata(
  row: CanonicalTruthRow | null,
): PsdCanonicalReviewMetadata | null {
  if (row === null) return null;
  return {
    capacityMl: canonicalValue(row, "capacityMl"),
    applicator: canonicalValue(row, "applicator"),
    capStyle: canonicalValue(row, "capStyle"),
    capColor: canonicalValue(row, "capColor"),
    trimColor: canonicalValue(row, "trimColor"),
    bodyMaterial: canonicalValue(row, "material"),
    glassFinish: canonicalValue(row, "glassFinish"),
    assemblyType: canonicalValue(row, "assemblyType"),
    ballMaterial: canonicalValue(row, "ballMaterial"),
    category: canonicalValue(row, "category"),
    shape: canonicalValue(row, "shape"),
    canonBodyHeightMm: canonicalValue(row, "canon_bodyHeightMm"),
    canonWidthAxisMm: canonicalValue(row, "canon_widthAxisMm"),
    canonSecondAxisMm: canonicalValue(row, "canon_secondAxisMm"),
    canonHeightWithCapMm: canonicalValue(row, "canon_heightWithCapMm"),
  };
}

function isSourceMetadataUnchanged(evidence: PsdSourceEvidence): boolean {
  return evidence.sourceMtimeBefore !== null
    && evidence.sourceMtimeAfter !== null
    && evidence.sourceSizeBefore !== null
    && evidence.sourceSizeAfter !== null
    && evidence.sourceMtimeBefore === evidence.sourceMtimeAfter
    && evidence.sourceSizeBefore === evidence.sourceSizeAfter;
}

function isSourceMetadataChanged(evidence: PsdSourceEvidence): boolean {
  return evidence.sourceMtimeBefore !== null
    && evidence.sourceMtimeAfter !== null
    && evidence.sourceSizeBefore !== null
    && evidence.sourceSizeAfter !== null
    && (
      evidence.sourceMtimeBefore !== evidence.sourceMtimeAfter
      || evidence.sourceSizeBefore !== evidence.sourceSizeAfter
    );
}

function csvValue(value: CsvRow[string]): string {
  if (value === null || value === undefined) {
    return "";
  }
  const text = Array.isArray(value) ? JSON.stringify(value) : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(columns: readonly string[], rows: readonly CsvRow[]): string {
  return `${[
    columns.join(","),
    ...rows.map((row) => columns.map((column) => csvValue(row[column])).join(",")),
  ].join("\n")}\n`;
}

function inventoryCsvRows(evidence: readonly PsdSourceEvidence[]): CsvRow[] {
  return evidence.map((row) => ({
    sourcePath: row.sourcePath,
    sourceRelativePath: row.sourceRelativePath,
    status: row.status,
    cacheStatus: row.cacheStatus,
    sourceSha256: row.sourceSha256,
    sourceBytes: row.sourceBytes,
    sourceMtimeBefore: row.sourceMtimeBefore,
    sourceMtimeAfter: row.sourceMtimeAfter,
    sourceSizeBefore: row.sourceSizeBefore,
    sourceSizeAfter: row.sourceSizeAfter,
    previewPath: row.previewPath,
    evidencePath: row.evidencePath,
    error: row.error,
  }));
}

function recordCsvRows(records: readonly PsdAuditRecord[]): CsvRow[] {
  return records.map((row) => ({
    sourcePath: row.sourcePath,
    sourceRelativePath: row.sourceRelativePath,
    sourceSha256: row.sourceSha256,
    sourceBytes: row.sourceBytes,
    websiteSku: row.websiteSku,
    graceSku: row.graceSku,
    family: row.family,
    capacityMl: row.canonicalReviewMetadata?.capacityMl ?? null,
    applicator: row.canonicalReviewMetadata?.applicator ?? null,
    capStyle: row.canonicalReviewMetadata?.capStyle ?? null,
    capColor: row.canonicalReviewMetadata?.capColor ?? null,
    bodyMaterial: row.canonicalReviewMetadata?.bodyMaterial ?? null,
    identityStatus: row.identityStatus,
    identityReasons: row.identityReasons,
    previewPath: row.composite?.previewPath ?? null,
    proposedClassification: row.machineTriage.proposedClassification,
    reviewStatus: row.reviewStatus,
  }));
}

function decisionCsvRows(units: readonly PsdReviewUnit[]): CsvRow[] {
  return units.map((unit) => ({
    reviewUnitKey: unit.reviewUnitKey,
    sourceSha256: unit.sourceSha256,
    websiteSku: unit.websiteSku,
    graceSku: unit.graceSku,
    family: unit.family,
    representativePreviewPath: unit.representative.composite?.previewPath ?? null,
    proposedClassification: unit.representative.machineTriage.proposedClassification,
    decision: "",
    reviewer: "",
    reviewedAt: "",
    notes: "",
  }));
}

function auditReadme(summary: PsdCapStateAuditSummary): string {
  return `# Best Bottles PSD cap-state audit\n\nThis directory contains local, read-only audit evidence. Machine triage never approves a cap state. Complete \`review-decisions-template.csv\` only through the human-review workflow.\n\n- Source files: ${summary.sourceFileCount}\n- Accounted sources: ${summary.accountedSourceCount}\n- Review units: ${summary.reviewUnitCount}\n- Pending human review: ${summary.pendingHumanReviewCount}\n- Approved: ${summary.approvedCount}\n- Evidence blockers: ${summary.blockedEvidenceCount}\n- External writes: ${summary.externalWriteCount}\n`;
}

async function writeAuditArtifacts(input: {
  outputRoot: string;
  sourceInventory: readonly PsdSourceEvidence[];
  records: readonly PsdAuditRecord[];
  reviewUnits: readonly PsdReviewUnit[];
  summary: PsdCapStateAuditSummary;
}): Promise<string[]> {
  await mkdir(input.outputRoot, { recursive: true });
  const artifactPaths = ARTIFACT_FILENAMES.map((filename) => join(input.outputRoot, filename));
  const unmatched = input.records.filter((row) => row.identityStatus === "unmatched");
  const ambiguous = input.records.filter((row) => (
    row.identityStatus === "ambiguous" || row.identityStatus === "conflict"
  ));
  const blocked = input.sourceInventory.filter((row) => row.status === "blocked");
  const contentByFilename: Record<(typeof ARTIFACT_FILENAMES)[number], string> = {
    "source-inventory.json": `${JSON.stringify(input.sourceInventory, null, 2)}\n`,
    "source-inventory.csv": toCsv(SOURCE_INVENTORY_COLUMNS, inventoryCsvRows(input.sourceInventory)),
    "identity-join.json": `${JSON.stringify(input.records, null, 2)}\n`,
    "review-units.json": `${JSON.stringify(input.reviewUnits, null, 2)}\n`,
    "review-decisions-template.csv": toCsv(DECISION_COLUMNS, decisionCsvRows(input.reviewUnits)),
    "unmatched-sources.csv": toCsv(RECORD_COLUMNS, recordCsvRows(unmatched)),
    "ambiguous-identity.csv": toCsv(RECORD_COLUMNS, recordCsvRows(ambiguous)),
    "blocked-evidence.csv": toCsv(SOURCE_INVENTORY_COLUMNS, inventoryCsvRows(blocked)),
    "summary.json": `${JSON.stringify(input.summary, null, 2)}\n`,
    "README.md": auditReadme(input.summary),
  };
  await Promise.all(ARTIFACT_FILENAMES.map((filename) => (
    writeFile(join(input.outputRoot, filename), contentByFilename[filename], "utf8")
  )));
  return artifactPaths;
}

export async function buildPsdCapStateAudit(
  input: BuildPsdCapStateAuditInput,
): Promise<PsdCapStateAuditResult> {
  const sourceFiles = [...input.sourceFiles].sort((left, right) => (
    compareText(left.sourceRelativePath, right.sourceRelativePath)
    || compareText(left.sourcePath, right.sourcePath)
  ));
  const sourceInventory = await runEvidencePool({
    sources: sourceFiles,
    outputRoot: input.outputRoot,
    concurrency: input.evidenceConcurrency,
    inspectEvidence: input.inspectEvidence,
  });
  if (sourceInventory.length !== sourceFiles.length) {
    throw new Error(`Evidence extraction accounted for ${sourceInventory.length} of ${sourceFiles.length} sources.`);
  }

  const identityIndex = buildCanonicalIdentityIndex(input.canonicalRows);
  const records = sourceInventory.map((evidence) => {
    const token = sourceIdentityToken(evidence.sourceRelativePath);
    const identityInput = chooseIdentityInput(token, identityIndex);
    const joined = joinPsdSourceIdentity({
      ...identityInput,
      sourceToken: token,
      index: identityIndex,
      aliases: input.aliases,
    });
    return buildRecord({
      evidence,
      identityState: buildIdentityState({
        token,
        status: joined.status,
        row: joined.row,
        aliases: input.aliases,
      }),
      identityReasons: joined.reasons,
      family: joined.row?.family || null,
      canonicalReviewMetadata: buildCanonicalReviewMetadata(joined.row),
    });
  });
  const reviewUnits = groupPsdAuditRecords(records);
  const writeOutputs = input.writeOutputs ?? true;
  const summary: PsdCapStateAuditSummary = {
    sourceFileCount: sourceFiles.length,
    accountedSourceCount: records.length,
    reviewUnitCount: reviewUnits.length,
    exactWebsiteSkuCount: records.filter((row) => row.identityStatus === "exact-website-sku").length,
    exactGraceSkuCount: records.filter((row) => row.identityStatus === "exact-grace-sku").length,
    reviewedAliasCount: records.filter((row) => row.identityStatus === "reviewed-alias").length,
    unmatchedCount: records.filter((row) => row.identityStatus === "unmatched").length,
    ambiguousIdentityCount: records.filter((row) => row.identityStatus === "ambiguous").length,
    identityConflictCount: records.filter((row) => row.identityStatus === "conflict").length,
    blockedEvidenceCount: sourceInventory.filter((row) => row.status === "blocked").length,
    pendingHumanReviewCount: records.filter((row) => row.reviewStatus === "pending-human-review").length,
    approvedCount: records.filter((row) => row.reviewStatus === "approved").length,
    unchangedSourceCount: sourceInventory.filter(isSourceMetadataUnchanged).length,
    sourceMutationCount: sourceInventory.filter(isSourceMetadataChanged).length,
    externalWriteCount: 0,
    localArtifactCount: writeOutputs ? ARTIFACT_FILENAMES.length : 0,
  };
  if (summary.accountedSourceCount !== summary.sourceFileCount) {
    throw new Error(`PSD audit accounted for ${summary.accountedSourceCount} of ${summary.sourceFileCount} sources.`);
  }
  if (summary.approvedCount !== 0) {
    throw new Error(`Machine-built PSD audit contains ${summary.approvedCount} approvals.`);
  }
  if (summary.sourceMutationCount !== 0) {
    throw new Error(`PSD audit detected ${summary.sourceMutationCount} source metadata mutations.`);
  }

  const artifactPaths = writeOutputs
    ? await writeAuditArtifacts({
      outputRoot: input.outputRoot,
      sourceInventory,
      records,
      reviewUnits,
      summary,
    })
    : [];
  return { sourceInventory, records, reviewUnits, summary, artifactPaths };
}

function parseAuditLimit(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === "") {
    return undefined;
  }
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new Error(`BEST_BOTTLES_PSD_AUDIT_LIMIT must be a positive integer, received ${value}.`);
  }
  return limit;
}

async function runCli(): Promise<void> {
  const projectRoot = process.cwd();
  const canonicalRows = parseCanonicalTruthCsv(
    await readFile(resolve(projectRoot, DEFAULT_CANONICAL_CSV), "utf8"),
  );
  if (canonicalRows.length !== EXPECTED_CANONICAL_ROW_COUNT) {
    throw new Error(
      `Expected ${EXPECTED_CANONICAL_ROW_COUNT} canonical rows, received ${canonicalRows.length}.`,
    );
  }
  const aliases = await loadReviewedPsdAliases(resolve(projectRoot, REVIEWED_ALIAS_PATH));
  const sourceFiles = await listPsdSourceFiles(
    DEFAULT_PSD_ARCHIVE_ROOT,
    parseAuditLimit(process.env.BEST_BOTTLES_PSD_AUDIT_LIMIT),
  );
  const result = await buildPsdCapStateAudit({
    sourceFiles,
    canonicalRows,
    aliases,
    outputRoot: resolve(projectRoot, DEFAULT_OUTPUT_ROOT),
    writeOutputs: true,
  });
  process.stdout.write(`${JSON.stringify(result.summary, null, 2)}\n`);
}

const isDirectExecution = process.argv[1]
  ? import.meta.url === pathToFileURL(resolve(process.argv[1])).href
  : false;
if (isDirectExecution) {
  runCli().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
