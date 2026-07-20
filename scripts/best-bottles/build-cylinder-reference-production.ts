import { constants } from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import {
  copyFile,
  mkdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { BEST_BOTTLES_CYLINDER_PRODUCTION_ROOT } from "../../src/config/bestBottlesCylinderProductionContract";
import type { CylinderApprovedCoverageManifest } from "../../src/lib/bestBottlesCylinderApprovedCoverageManifest";
import type { PsdReviewedUnit } from "../../src/lib/bestBottlesPsdReviewDecisions";
import {
  buildCylinderReferenceProductionPlan,
  type CylinderReferenceExportJob,
  type CylinderReferenceProductionPlan,
} from "../../src/lib/bestBottlesCylinderReferenceProduction";

const ARTIFACT_VERSION = "best-bottles-cylinder-reference-production-artifacts-v1" as const;
const MANIFEST_FILENAME = "cylinder-reference-production-manifest.json";
const SUMMARY_FILENAME = "cylinder-reference-production-summary.json";
const BLOCKER_FILENAME = "cylinder-reference-blocker-report.json";

type SourceStat = {
  size: number;
  mtimeMs: number;
};

type OutputPrimaryBounds = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type OutputInspection = {
  format: "PNG";
  width: number;
  height: number;
  opaque: true;
  colorspace: string;
  primaryBounds: OutputPrimaryBounds;
};

export type CylinderReferenceProductionExportRecord = {
  canonicalIdentityKey: string;
  canonical: CylinderReferenceExportJob["canonical"];
  bodyGeometry: CylinderReferenceExportJob["bodyGeometry"];
  source: CylinderReferenceExportJob["source"];
  output: {
    path: string;
    filename: string;
    sha256: string;
    bytes: number;
  } & OutputInspection;
};

export type CylinderReferenceProductionArtifactsResult = {
  summary: CylinderReferenceProductionPlan["summary"];
  artifactPaths: {
    manifest: string;
    summary: string;
    blockers: string;
  };
  createdExportCount: number;
  reusedExportCount: number;
};

type MagickResult = {
  stdout: Buffer;
  stderr: Buffer;
};

function runMagick(args: readonly string[]): Promise<MagickResult> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn("magick", [...args], { stdio: ["ignore", "pipe", "pipe"] });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let settled = false;
    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", (error) => {
      settled = true;
      reject(error);
    });
    child.on("close", (code) => {
      if (settled) return;
      const stderrBuffer = Buffer.concat(stderr);
      if (code !== 0) {
        reject(new Error(
          `ImageMagick failed (${code ?? "signal"}): ${stderrBuffer.toString("utf8").trim() || "unknown error"}`,
        ));
        return;
      }
      resolvePromise({ stdout: Buffer.concat(stdout), stderr: stderrBuffer });
    });
  });
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

async function fileSha256(path: string): Promise<string> {
  return sha256(await readFile(path));
}

async function sourceStat(path: string): Promise<SourceStat> {
  const value = await stat(path);
  return { size: value.size, mtimeMs: value.mtimeMs };
}

function sameStat(left: SourceStat, right: SourceStat): boolean {
  return left.size === right.size && left.mtimeMs === right.mtimeMs;
}

function parseOutputInspection(output: Buffer): Omit<OutputInspection, "primaryBounds"> {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(output.toString("utf8")) as Record<string, unknown>;
  } catch (error) {
    throw new Error(`Invalid ImageMagick output metadata: ${String(error)}.`);
  }
  const format = String(parsed.format ?? "");
  const width = Number(parsed.width);
  const height = Number(parsed.height);
  const opaque = String(parsed.opaque ?? "").toLowerCase() === "true";
  const colorspace = String(parsed.colorspace ?? "");
  if (
    format !== "PNG"
    || !Number.isInteger(width)
    || width <= 0
    || !Number.isInteger(height)
    || height <= 0
    || !opaque
    || colorspace.trim() === ""
  ) {
    throw new Error(`Invalid exported PNG metadata: ${output.toString("utf8")}.`);
  }
  return { format: "PNG", width, height, opaque: true, colorspace };
}

function parsePrimaryBounds(output: Buffer): OutputPrimaryBounds {
  const geometry = output.toString("utf8").trim();
  const match = /^(\d+)x(\d+)([+-]\d+)([+-]\d+)$/.exec(geometry);
  if (!match) {
    throw new Error(`Invalid exported PNG primary bounds: ${geometry || "(empty)"}.`);
  }
  const [, widthText, heightText, leftText, topText] = match;
  const bounds = {
    left: Number(leftText),
    top: Number(topText),
    width: Number(widthText),
    height: Number(heightText),
  };
  if (
    bounds.left < 0
    || bounds.top < 0
    || bounds.width <= 0
    || bounds.height <= 0
  ) {
    throw new Error(`Exported PNG has unusable primary bounds: ${geometry}.`);
  }
  return bounds;
}

async function inspectOutput(path: string): Promise<OutputInspection> {
  const metadata = parseOutputInspection((await runMagick([
    "identify",
    "-format",
    '{"format":"%m","width":%w,"height":%h,"opaque":"%[opaque]","colorspace":"%[colorspace]"}',
    path,
  ])).stdout);
  const primaryBounds = parsePrimaryBounds((await runMagick([
    path,
    "-fuzz", "3%",
    "-trim",
    "-format", "%@",
    "info:",
  ])).stdout);
  if (
    primaryBounds.left + primaryBounds.width > metadata.width
    || primaryBounds.top + primaryBounds.height > metadata.height
  ) {
    throw new Error(`Exported PNG primary bounds exceed its ${metadata.width}x${metadata.height} canvas.`);
  }
  return { ...metadata, primaryBounds };
}

function artifactJson(value: unknown): Buffer {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
}

async function immutableWrite(path: string, bytes: Uint8Array): Promise<"created" | "reused"> {
  await mkdir(dirname(path), { recursive: true });
  try {
    await writeFile(path, bytes, { flag: "wx" });
    return "created";
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
  const existing = await readFile(path);
  if (sha256(existing) !== sha256(bytes)) {
    throw new Error(`Immutable output conflict at ${path}; existing bytes differ.`);
  }
  return "reused";
}

async function parseInputs(input: {
  coverageManifestPath: string;
  reviewedManifestPath: string;
}): Promise<{
  coverageManifest: CylinderApprovedCoverageManifest;
  reviewedUnits: PsdReviewedUnit[];
  provenance: {
    inputs: {
      coverageManifest: { path: string; sha256: string };
      reviewedManifest: { path: string; sha256: string };
    };
  };
}> {
  const coverageManifestPath = resolve(input.coverageManifestPath);
  const reviewedManifestPath = resolve(input.reviewedManifestPath);
  const [coverageBytes, reviewedBytes] = await Promise.all([
    readFile(coverageManifestPath),
    readFile(reviewedManifestPath),
  ]);
  let coverageParsed: unknown;
  let reviewedParsed: unknown;
  try {
    coverageParsed = JSON.parse(coverageBytes.toString("utf8"));
    reviewedParsed = JSON.parse(reviewedBytes.toString("utf8"));
  } catch (error) {
    throw new Error(`Cylinder reference production input is not valid JSON: ${String(error)}.`);
  }
  const coverageContainer = coverageParsed as { manifest?: CylinderApprovedCoverageManifest };
  const coverageManifest = coverageContainer.manifest
    ?? coverageParsed as CylinderApprovedCoverageManifest;
  if (!Array.isArray(coverageManifest?.rows)) {
    throw new Error("Cylinder coverage input has no manifest rows.");
  }
  if (!Array.isArray(reviewedParsed)) {
    throw new Error("Cylinder reviewed PSD input must be an array.");
  }
  return {
    coverageManifest,
    reviewedUnits: reviewedParsed as PsdReviewedUnit[],
    provenance: {
      inputs: {
        coverageManifest: { path: coverageManifestPath, sha256: sha256(coverageBytes) },
        reviewedManifest: { path: reviewedManifestPath, sha256: sha256(reviewedBytes) },
      },
    },
  };
}

async function preflightSources(jobs: readonly CylinderReferenceExportJob[]): Promise<Map<string, SourceStat>> {
  const result = new Map<string, SourceStat>();
  for (const job of jobs) {
    const before = await sourceStat(job.source.sourcePath);
    if (before.size !== job.source.sourceBytes) {
      throw new Error(
        `PSD source byte size changed for ${job.source.sourcePath}: expected ${job.source.sourceBytes}, got ${before.size}.`,
      );
    }
    const actualHash = await fileSha256(job.source.sourcePath);
    if (actualHash !== job.source.sourceSha256) {
      throw new Error(
        `PSD source SHA-256 changed for ${job.source.sourcePath}: expected ${job.source.sourceSha256}, got ${actualHash}.`,
      );
    }
    const after = await sourceStat(job.source.sourcePath);
    if (!sameStat(before, after)) {
      throw new Error(`PSD source changed during preflight: ${job.source.sourcePath}.`);
    }
    result.set(job.canonicalIdentityKey, before);
  }
  return result;
}

async function renderJob(input: {
  job: CylinderReferenceExportJob;
  exportsRoot: string;
  preflightStat: SourceStat;
}): Promise<{ record: CylinderReferenceProductionExportRecord; status: "created" | "reused" }> {
  const outputPath = resolve(input.exportsRoot, input.job.outputFilename);
  const temporaryPath = `${outputPath}.tmp-${process.pid}-${randomBytes(6).toString("hex")}.png`;
  await mkdir(input.exportsRoot, { recursive: true });
  try {
    await runMagick([
      `${input.job.source.sourcePath}[0]`,
      "-alpha", "off",
      "-colorspace", "sRGB",
      "-define", "png:exclude-chunks=date,time",
      `PNG24:${temporaryPath}`,
    ]);
    const inspection = await inspectOutput(temporaryPath);
    if (
      inspection.width !== input.job.source.composite.width
      || inspection.height !== input.job.source.composite.height
    ) {
      throw new Error(
        `Native-dimension mismatch for ${input.job.canonicalIdentityKey}: expected `
        + `${input.job.source.composite.width}x${input.job.source.composite.height}, got `
        + `${inspection.width}x${inspection.height}.`,
      );
    }
    const temporaryBytes = await readFile(temporaryPath);
    let status: "created" | "reused";
    try {
      await copyFile(temporaryPath, outputPath, constants.COPYFILE_EXCL);
      status = "created";
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      const existingBytes = await readFile(outputPath);
      if (sha256(existingBytes) !== sha256(temporaryBytes)) {
        throw new Error(`Immutable output conflict at ${outputPath}; existing bytes differ.`);
      }
      const existingInspection = await inspectOutput(outputPath);
      if (JSON.stringify(existingInspection) !== JSON.stringify(inspection)) {
        throw new Error(`Immutable output conflict at ${outputPath}; existing metadata differs.`);
      }
      status = "reused";
    }

    const afterStat = await sourceStat(input.job.source.sourcePath);
    if (!sameStat(input.preflightStat, afterStat)) {
      throw new Error(`PSD source changed during export: ${input.job.source.sourcePath}.`);
    }
    const afterHash = await fileSha256(input.job.source.sourcePath);
    if (afterHash !== input.job.source.sourceSha256) {
      throw new Error(`PSD source SHA-256 changed during export: ${input.job.source.sourcePath}.`);
    }
    return {
      status,
      record: {
        canonicalIdentityKey: input.job.canonicalIdentityKey,
        canonical: { ...input.job.canonical },
        bodyGeometry: { ...input.job.bodyGeometry },
        source: input.job.source,
        output: {
          path: outputPath,
          filename: input.job.outputFilename,
          sha256: sha256(temporaryBytes),
          bytes: temporaryBytes.length,
          ...inspection,
        },
      },
    };
  } finally {
    await rm(temporaryPath, { force: true });
  }
}

export async function buildCylinderReferenceProductionArtifacts(input: {
  coverageManifestPath: string;
  reviewedManifestPath: string;
  outputRoot: string;
}): Promise<CylinderReferenceProductionArtifactsResult> {
  const outputRoot = resolve(input.outputRoot);
  const exportsRoot = resolve(outputRoot, "exports");
  const parsed = await parseInputs(input);
  const plan = buildCylinderReferenceProductionPlan({
    coverageManifest: parsed.coverageManifest,
    reviewedUnits: parsed.reviewedUnits,
  });
  const preflight = await preflightSources(plan.exportJobs);
  await mkdir(exportsRoot, { recursive: true });

  const exports: CylinderReferenceProductionExportRecord[] = [];
  let createdExportCount = 0;
  let reusedExportCount = 0;
  for (const job of plan.exportJobs) {
    const preflightStat = preflight.get(job.canonicalIdentityKey);
    if (preflightStat === undefined) {
      throw new Error(`Missing preflight state for ${job.canonicalIdentityKey}.`);
    }
    const rendered = await renderJob({ job, exportsRoot, preflightStat });
    exports.push(rendered.record);
    if (rendered.status === "created") createdExportCount += 1;
    else reusedExportCount += 1;
  }

  const artifactPaths = {
    manifest: resolve(outputRoot, MANIFEST_FILENAME),
    summary: resolve(outputRoot, SUMMARY_FILENAME),
    blockers: resolve(outputRoot, BLOCKER_FILENAME),
  };
  const base = {
    version: ARTIFACT_VERSION,
    provenance: parsed.provenance,
    summary: plan.summary,
  };
  const manifestArtifact = {
    ...base,
    planVersion: plan.version,
    exports,
  };
  const summaryArtifact = {
    ...base,
    outputRoot,
    exportCount: exports.length,
    blockerCount: plan.blockedIdentities.length,
    artifactPaths,
  };
  const blockerArtifact = {
    ...base,
    planVersion: plan.version,
    blockedIdentities: plan.blockedIdentities,
  };
  await Promise.all([
    immutableWrite(artifactPaths.manifest, artifactJson(manifestArtifact)),
    immutableWrite(artifactPaths.summary, artifactJson(summaryArtifact)),
    immutableWrite(artifactPaths.blockers, artifactJson(blockerArtifact)),
  ]);
  return {
    summary: plan.summary,
    artifactPaths,
    createdExportCount,
    reusedExportCount,
  };
}

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DEFAULT_COVERAGE_MANIFEST_PATH = resolve(
  projectRoot,
  "tmp/best-bottles-reference-production/cylinder-coverage-manifest-v2/cylinder-approved-coverage-manifest.json",
);
const DEFAULT_REVIEWED_MANIFEST_PATH = resolve(
  projectRoot,
  "tmp/best-bottles-reference-production/psd-cap-state-audit-v1/reviewed-manifest.json",
);
const DEFAULT_OUTPUT_ROOT = resolve(
  projectRoot,
  BEST_BOTTLES_CYLINDER_PRODUCTION_ROOT,
);

async function main(): Promise<void> {
  const result = await buildCylinderReferenceProductionArtifacts({
    coverageManifestPath: DEFAULT_COVERAGE_MANIFEST_PATH,
    reviewedManifestPath: DEFAULT_REVIEWED_MANIFEST_PATH,
    outputRoot: DEFAULT_OUTPUT_ROOT,
  });
  console.log(JSON.stringify({
    outputRoot: DEFAULT_OUTPUT_ROOT,
    ...result.summary,
    createdExportCount: result.createdExportCount,
    reusedExportCount: result.reusedExportCount,
    artifactPaths: result.artifactPaths,
  }, null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
