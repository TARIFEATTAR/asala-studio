import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { CylinderApprovedCoverageManifest } from "../../src/lib/bestBottlesCylinderApprovedCoverageManifest";
import {
  buildCylinderCanonicalTypeReview,
  type CylinderCanonicalMasterRecord,
  type CylinderCanonicalTypeReviewManifest,
  type CylinderCanonicalTypeReviewProvenance,
} from "../../src/lib/bestBottlesCylinderCanonicalTypeReview";
import type { PsdReviewedUnit } from "../../src/lib/bestBottlesPsdReviewDecisions";

const ARTIFACT_FILENAMES = {
  manifest: "cylinder-81-type-review-manifest.json",
  blockerReport: "cylinder-216-blocker-report.json",
  collapseCandidates: "cylinder-six-collapse-candidates.json",
} as const;

const EXPECTED_REAL_SUMMARY = {
  canonicalIdentityCount: 377,
  typeCount: 81,
  readyTypeCount: 41,
  blockedTypeCount: 40,
  blockedIdentityCount: 216,
  collapseCandidateCount: 6,
  appliedCollapseCount: 0,
  externalWriteCount: 0,
} as const;

type CsvRecord = Record<string, string>;

type CoverageArtifact = {
  version: "best-bottles-cylinder-approved-coverage-artifacts-v1";
  manifest: CylinderApprovedCoverageManifest;
};

export type Cylinder81TypeReviewArtifactsInput = {
  coverageArtifactPath: string;
  canonicalMasterPath: string;
  reviewedManifestPath: string;
  outputRoot: string;
};

export type Cylinder81TypeReviewArtifactsResult = {
  manifest: CylinderCanonicalTypeReviewManifest;
  provenance: CylinderCanonicalTypeReviewProvenance;
  summary: CylinderCanonicalTypeReviewManifest["summary"];
  artifactPaths: {
    manifest: string;
    blockerReport: string;
    collapseCandidates: string;
  };
};

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
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
  for (const requiredHeader of input.requiredHeaders) {
    if (!headers.includes(requiredHeader)) {
      throw new Error(`${input.label} is missing required column ${requiredHeader}.`);
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

function canonicalRecord(row: CsvRecord): CylinderCanonicalMasterRecord {
  const required = [
    "websiteSku",
    "graceSku",
    "productGroupSlug",
    "family",
    "capacityMl",
    "canon_bodyHeightMm",
    "canon_widthAxisMm",
    "canon_secondAxisMm",
    "canon_heightWithCapMm",
    "neckThreadSize",
    "applicator",
    "capStyle",
  ] as const;
  for (const field of required) {
    if (typeof row[field] !== "string") {
      throw new Error(`Canonical master row is missing ${field}.`);
    }
  }
  return Object.fromEntries(required.map((field) => [field, row[field]])) as CylinderCanonicalMasterRecord;
}

function parseJson(bytes: Uint8Array, path: string): unknown {
  try {
    return JSON.parse(Buffer.from(bytes).toString("utf8"));
  } catch (error) {
    throw new Error(`Input ${path} is not valid JSON: ${String(error)}.`);
  }
}

function parseCoverageArtifact(bytes: Uint8Array, path: string): CoverageArtifact {
  const parsed = parseJson(bytes, path) as Partial<CoverageArtifact>;
  if (
    !parsed
    || parsed.version !== "best-bottles-cylinder-approved-coverage-artifacts-v1"
    || !parsed.manifest
  ) {
    throw new Error(`Coverage artifact ${path} does not use the approved coverage artifact schema.`);
  }
  return parsed as CoverageArtifact;
}

function parseReviewedUnits(bytes: Uint8Array, path: string): PsdReviewedUnit[] {
  const parsed = parseJson(bytes, path);
  if (!Array.isArray(parsed)) {
    throw new Error(`Reviewed manifest ${path} must contain a reviewed-unit array.`);
  }
  return parsed as PsdReviewedUnit[];
}

function assertExpectedRealSummary(summary: CylinderCanonicalTypeReviewManifest["summary"]): void {
  for (const [field, expected] of Object.entries(EXPECTED_REAL_SUMMARY)) {
    const actual = summary[field as keyof typeof summary];
    if (actual !== expected) {
      throw new Error(`Cylinder 81-type review expected ${field}=${expected}; received ${actual}.`);
    }
  }
}

function artifactJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export async function buildCylinder81TypeReviewArtifacts(
  input: Cylinder81TypeReviewArtifactsInput,
): Promise<Cylinder81TypeReviewArtifactsResult> {
  const coverageArtifactPath = resolve(input.coverageArtifactPath);
  const canonicalMasterPath = resolve(input.canonicalMasterPath);
  const reviewedManifestPath = resolve(input.reviewedManifestPath);
  const outputRoot = resolve(input.outputRoot);
  if (outputRoot.split("/").at(-1) !== "cylinder-81-type-review-v1") {
    throw new Error("Cylinder 81-type review output root must be the versioned cylinder-81-type-review-v1 directory.");
  }

  const [coverageArtifactBytes, canonicalMasterBytes, reviewedManifestBytes] = await Promise.all([
    readFile(coverageArtifactPath),
    readFile(canonicalMasterPath),
    readFile(reviewedManifestPath),
  ]);
  const provenance: CylinderCanonicalTypeReviewProvenance = {
    inputs: {
      coverageArtifact: { path: coverageArtifactPath, sha256: sha256(coverageArtifactBytes) },
      canonicalMaster: { path: canonicalMasterPath, sha256: sha256(canonicalMasterBytes) },
      reviewedManifest: { path: reviewedManifestPath, sha256: sha256(reviewedManifestBytes) },
    },
  };
  const coverageArtifact = parseCoverageArtifact(coverageArtifactBytes, coverageArtifactPath);
  const canonicalRecords = parseCsvRecords({
    bytes: canonicalMasterBytes,
    label: "Canonical master CSV",
    requiredHeaders: [
      "websiteSku",
      "graceSku",
      "productGroupSlug",
      "family",
      "capacityMl",
      "canon_bodyHeightMm",
      "canon_widthAxisMm",
      "canon_secondAxisMm",
      "canon_heightWithCapMm",
      "neckThreadSize",
      "applicator",
      "capStyle",
    ],
  })
    .filter((row) => row.family === "Cylinder" || row.family === "Tall Cylinder")
    .map(canonicalRecord);
  const reviewedUnits = parseReviewedUnits(reviewedManifestBytes, reviewedManifestPath);
  const manifest = buildCylinderCanonicalTypeReview({
    coverageManifest: coverageArtifact.manifest,
    canonicalRecords,
    reviewedUnits,
    provenance,
  });
  assertExpectedRealSummary(manifest.summary);

  const artifactPaths = {
    manifest: resolve(outputRoot, ARTIFACT_FILENAMES.manifest),
    blockerReport: resolve(outputRoot, ARTIFACT_FILENAMES.blockerReport),
    collapseCandidates: resolve(outputRoot, ARTIFACT_FILENAMES.collapseCandidates),
  };
  const blockerReport = {
    version: "best-bottles-cylinder-216-blocker-report-v1",
    provenance,
    summary: manifest.summary,
    blockedIdentities: manifest.blockedIdentities,
  };
  const collapseCandidates = {
    version: "best-bottles-cylinder-six-collapse-candidates-v1",
    provenance,
    summary: manifest.summary,
    collapseCandidates: manifest.collapseCandidates,
  };
  await mkdir(outputRoot, { recursive: true });
  await Promise.all([
    writeFile(artifactPaths.manifest, artifactJson(manifest), "utf8"),
    writeFile(artifactPaths.blockerReport, artifactJson(blockerReport), "utf8"),
    writeFile(artifactPaths.collapseCandidates, artifactJson(collapseCandidates), "utf8"),
  ]);
  return { manifest, provenance, summary: manifest.summary, artifactPaths };
}

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const defaults: Cylinder81TypeReviewArtifactsInput = {
  coverageArtifactPath: resolve(
    projectRoot,
    "tmp/best-bottles-reference-production/cylinder-coverage-manifest-v1/cylinder-approved-coverage-manifest.json",
  ),
  canonicalMasterPath: resolve(
    projectRoot,
    "docs/best-bottles-canonical-truth/best-bottles-master-truth.csv",
  ),
  reviewedManifestPath: resolve(
    projectRoot,
    "tmp/best-bottles-reference-production/psd-cap-state-audit-v1/reviewed-manifest.json",
  ),
  outputRoot: resolve(
    projectRoot,
    "tmp/best-bottles-reference-production/cylinder-81-type-review-v1",
  ),
};

function parseArgs(args: readonly string[]): Cylinder81TypeReviewArtifactsInput {
  const parsed = { ...defaults };
  const flags: Record<string, keyof Cylinder81TypeReviewArtifactsInput> = {
    "--coverage-artifact": "coverageArtifactPath",
    "--canonical-master": "canonicalMasterPath",
    "--reviewed-manifest": "reviewedManifestPath",
    "--output-root": "outputRoot",
  };
  for (let index = 0; index < args.length; index += 2) {
    const field = flags[args[index]];
    const value = args[index + 1];
    if (!field || !value) throw new Error(`Unsupported or incomplete CLI argument ${String(args[index])}.`);
    parsed[field] = value;
  }
  return parsed;
}

async function main(): Promise<void> {
  const result = await buildCylinder81TypeReviewArtifacts(parseArgs(process.argv.slice(2)));
  console.log(JSON.stringify({
    outputRoot: resolve(parseArgs(process.argv.slice(2)).outputRoot),
    ...result.summary,
    artifactPaths: result.artifactPaths,
    provenance: result.provenance,
  }, null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
