import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildCylinderApprovedCoverageManifest,
  type CanonicalBodyGeometryRow,
  type CanonicalCylinderCoverageRow,
  type CylinderApprovedCoverageManifest,
} from "../../src/lib/bestBottlesCylinderApprovedCoverageManifest";
import type { PsdReviewedUnit } from "../../src/lib/bestBottlesPsdReviewDecisions";

const ARTIFACT_VERSION = "best-bottles-cylinder-approved-coverage-artifacts-v2" as const;
const ARTIFACT_FILENAMES = [
  "cylinder-approved-coverage-manifest.json",
  "cylinder-approved-coverage-summary.json",
] as const;
const CYLINDER_FAMILIES = new Set(["Cylinder", "Tall Cylinder"]);

export type CoverageInputProvenance = {
  path: string;
  sha256: string;
};

export type CylinderApprovedCoverageArtifactProvenance = {
  inputs: {
    canonicalMaster: CoverageInputProvenance;
    bodyGeometry: CoverageInputProvenance;
    reviewedManifest: CoverageInputProvenance;
  };
};

export type CylinderApprovedCoverageArtifactsResult = {
  manifest: CylinderApprovedCoverageManifest;
  provenance: CylinderApprovedCoverageArtifactProvenance;
  summary: CylinderApprovedCoverageManifest["summary"];
  artifactPaths: {
    manifest: string;
    summary: string;
  };
};

type CsvRecord = Record<string, string>;

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function normalizedIdentity(value: string | null | undefined): string {
  return String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function parseCsvRows(text: string, label: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (inQuotes) {
      if (character === '"') {
        if (text[index + 1] === '"') {
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
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = [];
      field = "";
      if (character === "\r" && text[index + 1] === "\n") index += 1;
    } else {
      field += character;
    }
  }

  if (inQuotes) throw new Error(`${label} contains an unterminated quoted CSV cell.`);
  if (field !== "" || row.length > 0) {
    row.push(field);
    if (row.some((cell) => cell !== "")) rows.push(row);
  }
  return rows;
}

function parseCsvRecords(input: {
  bytes: Uint8Array;
  label: string;
  requiredHeaders: readonly string[];
}): CsvRecord[] {
  const rows = parseCsvRows(Buffer.from(input.bytes).toString("utf8"), input.label);
  const headers = rows[0]?.map((header, index) => (
    index === 0 ? header.replace(/^\uFEFF/, "") : header
  ));
  if (!headers) throw new Error(`${input.label} is empty.`);
  for (const header of input.requiredHeaders) {
    if (!headers.includes(header)) {
      throw new Error(`${input.label} is missing required column ${header}.`);
    }
  }

  return rows.slice(1).map((cells, rowIndex) => {
    if (cells.length !== headers.length) {
      throw new Error(
        `${input.label} row ${rowIndex + 2} has ${cells.length} fields; expected ${headers.length}.`,
      );
    }
    return Object.fromEntries(headers.map((header, index) => [header, cells[index]]));
  });
}

function canonicalRow(row: CsvRecord): CanonicalCylinderCoverageRow {
  const family = row.family?.trim();
  if (family !== "Cylinder" && family !== "Tall Cylinder") {
    throw new Error(`Unsupported canonical Cylinder coverage family: ${String(row.family)}.`);
  }
  const required = [
    "websiteSku",
    "graceSku",
    "productGroupSlug",
    "capacityMl",
    "canon_bodyHeightMm",
    "canon_widthAxisMm",
    "canon_secondAxisMm",
    "canon_heightWithCapMm",
  ] as const;
  for (const field of required) {
    if (typeof row[field] !== "string") {
      throw new Error(`Canonical master row is missing ${field}.`);
    }
  }
  if (!row.websiteSku.trim() || !row.graceSku.trim()) {
    throw new Error("Canonical Cylinder coverage rows require both Website and Grace SKU identities.");
  }
  return {
    websiteSku: row.websiteSku,
    graceSku: row.graceSku,
    family,
    productGroupSlug: row.productGroupSlug,
    capacityMl: row.capacityMl,
    canon_bodyHeightMm: row.canon_bodyHeightMm,
    canon_widthAxisMm: row.canon_widthAxisMm,
    canon_secondAxisMm: row.canon_secondAxisMm,
    canon_heightWithCapMm: row.canon_heightWithCapMm,
  };
}

function bodyGeometryRow(row: CsvRecord): CanonicalBodyGeometryRow {
  const family = row.family?.trim();
  if (family !== "Cylinder" && family !== "Tall Cylinder") {
    throw new Error(`Unsupported canonical Cylinder body family: ${String(row.family)}.`);
  }
  const required = [
    "capacityMl",
    "bodyHeightMm",
    "widthAxisMm",
    "depthAxisMm",
    "productGroupSlugs",
  ] as const;
  for (const field of required) {
    if (typeof row[field] !== "string") {
      throw new Error(`Canonical body geometry row is missing ${field}.`);
    }
  }
  return {
    family,
    capacityMl: row.capacityMl,
    bodyHeightMm: row.bodyHeightMm,
    widthAxisMm: row.widthAxisMm,
    depthAxisMm: row.depthAxisMm,
    productGroupSlugs: row.productGroupSlugs,
  };
}

function canonicalSelectionScore(row: CanonicalCylinderCoverageRow): [number, number] {
  return [
    /-\d+$/i.test(row.graceSku.trim()) ? 1 : 0,
    row.graceSku.includes("-") ? 0 : 1,
  ];
}

function selectCanonicalIdentities(rows: readonly CanonicalCylinderCoverageRow[]): CanonicalCylinderCoverageRow[] {
  const byWebsiteSku = new Map<string, CanonicalCylinderCoverageRow[]>();
  for (const row of rows) {
    const websiteSku = normalizedIdentity(row.websiteSku);
    if (!websiteSku) throw new Error("Canonical Cylinder coverage row has no Website SKU.");
    byWebsiteSku.set(websiteSku, [...(byWebsiteSku.get(websiteSku) ?? []), row]);
  }

  return [...byWebsiteSku.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, candidates]) => candidates
      .map((candidate, index) => ({ candidate, index, score: canonicalSelectionScore(candidate) }))
      .sort((left, right) => (
        left.score[0] - right.score[0]
        || left.score[1] - right.score[1]
        || left.index - right.index
      ))[0].candidate);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertExactReviewedSourceIdentities(input: {
  reviewedUnits: readonly PsdReviewedUnit[];
  canonicalRows: readonly CanonicalCylinderCoverageRow[];
}): void {
  const canonicalByWebsiteSku = new Map(
    input.canonicalRows.map((row) => [normalizedIdentity(row.websiteSku), row]),
  );
  const canonicalByGraceSku = new Map(
    input.canonicalRows.map((row) => [normalizedIdentity(row.graceSku), row]),
  );

  for (const unit of input.reviewedUnits) {
    if (!isRecord(unit) || !Array.isArray(unit.sources)) {
      throw new Error("Reviewed manifest contains a unit without a sources array.");
    }
    for (const source of unit.sources) {
      if (!isRecord(source) || !["exact-website-sku", "reviewed-alias"].includes(String(source.identityStatus))) {
        throw new Error("Reviewed source identityStatus must be exact-website-sku or reviewed-alias.");
      }
      const websiteSku = normalizedIdentity(typeof source.websiteSku === "string" ? source.websiteSku : null);
      const graceSku = normalizedIdentity(typeof source.graceSku === "string" ? source.graceSku : null);
      if (source.identityStatus === "reviewed-alias") {
        const provenance = source.aliasProvenance;
        if (
          !isRecord(provenance)
          || typeof provenance.observedAliasToken !== "string"
          || provenance.observedAliasToken.trim() === ""
          || normalizedIdentity(provenance.canonicalWebsiteSku) !== websiteSku
          || normalizedIdentity(provenance.canonicalGraceSku) !== graceSku
          || !isRecord(provenance.reviewer)
          || provenance.reviewer.kind !== "human"
          || typeof provenance.reviewer.identity !== "string"
          || provenance.reviewer.identity.trim() === ""
          || typeof provenance.reviewedAt !== "string"
          || Number.isNaN(Date.parse(provenance.reviewedAt))
        ) {
          throw new Error("Reviewed alias source requires complete hash-bound human provenance.");
        }
      }
      const canonicalByWebsite = canonicalByWebsiteSku.get(websiteSku);
      const canonicalByGrace = canonicalByGraceSku.get(graceSku);
      if (!canonicalByWebsite && !canonicalByGrace) continue;
      if (
        canonicalByWebsite === undefined
        || canonicalByGrace === undefined
        || canonicalByWebsite !== canonicalByGrace
      ) {
        throw new Error(
          `Reviewed source ${String(source.sourcePath ?? "(unknown)")} conflicts with canonical identity.`,
        );
      }
    }
  }
}

function parseReviewedUnits(bytes: Uint8Array, path: string): PsdReviewedUnit[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(bytes).toString("utf8"));
  } catch (error) {
    throw new Error(`Reviewed manifest ${path} is not valid JSON: ${String(error)}.`);
  }
  if (!Array.isArray(parsed)) {
    throw new Error(`Reviewed manifest ${path} must contain an array of reviewed units.`);
  }
  return parsed as PsdReviewedUnit[];
}

function artifactJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export async function buildCylinderApprovedCoverageArtifacts(input: {
  canonicalMasterPath: string;
  bodyGeometryPath: string;
  reviewedManifestPath: string;
  outputRoot: string;
}): Promise<CylinderApprovedCoverageArtifactsResult> {
  const canonicalMasterPath = resolve(input.canonicalMasterPath);
  const bodyGeometryPath = resolve(input.bodyGeometryPath);
  const reviewedManifestPath = resolve(input.reviewedManifestPath);
  const outputRoot = resolve(input.outputRoot);
  const [canonicalMasterBytes, bodyGeometryBytes, reviewedManifestBytes] = await Promise.all([
    readFile(canonicalMasterPath),
    readFile(bodyGeometryPath),
    readFile(reviewedManifestPath),
  ]);
  const provenance: CylinderApprovedCoverageArtifactProvenance = {
    inputs: {
      canonicalMaster: { path: canonicalMasterPath, sha256: sha256(canonicalMasterBytes) },
      bodyGeometry: { path: bodyGeometryPath, sha256: sha256(bodyGeometryBytes) },
      reviewedManifest: { path: reviewedManifestPath, sha256: sha256(reviewedManifestBytes) },
    },
  };
  const canonicalRows = selectCanonicalIdentities(parseCsvRecords({
    bytes: canonicalMasterBytes,
    label: "Canonical master CSV",
    requiredHeaders: [
      "graceSku", "websiteSku", "productGroupSlug", "family", "capacityMl",
      "canon_bodyHeightMm", "canon_widthAxisMm", "canon_secondAxisMm", "canon_heightWithCapMm",
    ],
  })
    .filter((row) => CYLINDER_FAMILIES.has(row.family?.trim()))
    .map(canonicalRow));
  const bodyGeometryRows = parseCsvRecords({
    bytes: bodyGeometryBytes,
    label: "Canonical body geometry CSV",
    requiredHeaders: [
      "family", "capacityMl", "bodyHeightMm", "widthAxisMm", "depthAxisMm", "productGroupSlugs",
    ],
  })
    .filter((row) => CYLINDER_FAMILIES.has(row.family?.trim()))
    .map(bodyGeometryRow);
  const reviewedUnits = parseReviewedUnits(reviewedManifestBytes, reviewedManifestPath);
  assertExactReviewedSourceIdentities({ reviewedUnits, canonicalRows });

  const manifest = buildCylinderApprovedCoverageManifest({ canonicalRows, bodyGeometryRows, reviewedUnits });
  const artifactPaths = {
    manifest: resolve(outputRoot, ARTIFACT_FILENAMES[0]),
    summary: resolve(outputRoot, ARTIFACT_FILENAMES[1]),
  };
  const manifestArtifact = {
    version: ARTIFACT_VERSION,
    provenance,
    summary: manifest.summary,
    manifest,
  };
  const summaryArtifact = {
    version: ARTIFACT_VERSION,
    provenance,
    summary: manifest.summary,
    uncoveredCanonicalIdentityKeys: manifest.rows
      .filter((row) => !row.referenceReady)
      .map((row) => row.canonicalIdentityKey),
  };

  await mkdir(outputRoot, { recursive: true });
  await Promise.all([
    writeFile(artifactPaths.manifest, artifactJson(manifestArtifact), "utf8"),
    writeFile(artifactPaths.summary, artifactJson(summaryArtifact), "utf8"),
  ]);
  return { manifest, provenance, summary: manifest.summary, artifactPaths };
}

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DEFAULT_CANONICAL_MASTER_PATH = resolve(
  projectRoot,
  "docs/best-bottles-canonical-truth/best-bottles-master-truth.csv",
);
const DEFAULT_BODY_GEOMETRY_PATH = resolve(
  projectRoot,
  "docs/best-bottles-canonical-truth/best-bottles-body-geometry.csv",
);
const DEFAULT_REVIEWED_MANIFEST_PATH = resolve(
  projectRoot,
  "tmp/best-bottles-reference-production/psd-cap-state-audit-v1/reviewed-manifest.json",
);
const DEFAULT_OUTPUT_ROOT = resolve(
  projectRoot,
  "tmp/best-bottles-reference-production/cylinder-coverage-manifest-v2",
);

async function main(): Promise<void> {
  const result = await buildCylinderApprovedCoverageArtifacts({
    canonicalMasterPath: DEFAULT_CANONICAL_MASTER_PATH,
    bodyGeometryPath: DEFAULT_BODY_GEOMETRY_PATH,
    reviewedManifestPath: DEFAULT_REVIEWED_MANIFEST_PATH,
    outputRoot: DEFAULT_OUTPUT_ROOT,
  });
  console.log(JSON.stringify({
    outputRoot: DEFAULT_OUTPUT_ROOT,
    ...result.summary,
    artifactPaths: result.artifactPaths,
  }, null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
