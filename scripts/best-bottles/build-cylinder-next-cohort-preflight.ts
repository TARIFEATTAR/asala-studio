#!/usr/bin/env tsx
import { createHash } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import sharp from "sharp";

import type { CylinderDualRoleRemediationPlan } from "../../src/lib/bestBottlesCylinderDualRoleRemediation";
import type { CylinderDualRoleCanonicalProductTruthRow } from "../../src/lib/bestBottlesCylinderDualRoleRunner";
import {
  NEXT_COHORT_JOB_IDS,
  buildCylinderNextCohortPreflight,
  renderCylinderNextCohortPreflightHtml,
  serializeCylinderNextCohortPreflight,
  type CylinderNextCohortCompiledJobInput,
  type CylinderNextCohortPreflightArtifact,
  type CylinderNextCohortReferenceInput,
} from "../../src/lib/bestBottlesCylinderNextCohortPreflight";
import { parseCsv } from "../../src/lib/bestBottlesGapWorklist";

export const CYLINDER_NEXT_COHORT_PLAN_PATH =
  "tmp/best-bottles-reference-production/cylinder-dual-role-remediation-v2/cylinder-dual-role-remediation-plan.json";
export const CYLINDER_NEXT_COHORT_COMPILE_ALL_PATH =
  "tmp/best-bottles-reference-production/cylinder-dual-role-remediation-v2/runs/411f34e80f7762da48859ad7cf7056f1668055c929aebac00012ff2031ac4d35/compile-all/compiled-jobs.json";
export const CYLINDER_NEXT_COHORT_CANONICAL_PRODUCT_TRUTH_PATH =
  "docs/best-bottles-canonical-truth/best-bottles-master-truth.csv";
export const CYLINDER_NEXT_COHORT_RUN_DIRECTORY =
  "tmp/best-bottles-reference-production/cylinder-dual-role-remediation-v2/runs/411f34e80f7762da48859ad7cf7056f1668055c929aebac00012ff2031ac4d35";
export const CYLINDER_NEXT_COHORT_OUTPUT_ROOT =
  `${CYLINDER_NEXT_COHORT_RUN_DIRECTORY}/next-cohort-preflight-v1`;

export interface AddressedCylinderNextCohortWriteResult {
  outputDirectory: string;
  manifestPath: string;
  htmlPath: string;
  manifestSha256: string;
  htmlSha256: string;
}

function assertCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function sha256(value: Uint8Array | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function isInside(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function writeAddressedCylinderNextCohortPreflight(
  outputRoot: string,
  artifact: CylinderNextCohortPreflightArtifact,
): Promise<AddressedCylinderNextCohortWriteResult> {
  assertCondition(/^[a-f0-9]{64}$/.test(artifact.inputSetSha256), "Input-set SHA must be hash-addressable.");
  const resolvedRoot = path.resolve(outputRoot);
  const outputDirectory = path.resolve(resolvedRoot, artifact.inputSetSha256);
  assertCondition(isInside(resolvedRoot, outputDirectory), "Addressed output escaped the authorized output root.");
  const manifestPath = path.join(outputDirectory, "next-cohort-preflight.json");
  const htmlPath = path.join(outputDirectory, "index.html");
  const manifestBytes = serializeCylinderNextCohortPreflight(artifact);
  const htmlBytes = renderCylinderNextCohortPreflightHtml(artifact);

  if (await pathExists(outputDirectory)) {
    const [existingManifest, existingHtml] = await Promise.all([
      readFile(manifestPath, "utf8"),
      readFile(htmlPath, "utf8"),
    ]);
    assertCondition(
      existingManifest === manifestBytes,
      "Existing addressed JSON bytes do not match current validated output.",
    );
    assertCondition(
      existingHtml === htmlBytes,
      "Existing addressed HTML bytes do not match current validated output.",
    );
  } else {
    await mkdir(outputDirectory, { recursive: true });
    await Promise.all([
      writeFile(manifestPath, manifestBytes, { flag: "wx" }),
      writeFile(htmlPath, htmlBytes, { flag: "wx" }),
    ]);
  }
  return {
    outputDirectory,
    manifestPath,
    htmlPath,
    manifestSha256: sha256(manifestBytes),
    htmlSha256: sha256(htmlBytes),
  };
}

async function inspectReference(
  workspaceRoot: string,
  sourceLocator: string,
): Promise<CylinderNextCohortReferenceInput> {
  assertCondition(
    sourceLocator.startsWith(`tmp${path.sep}`) || sourceLocator.startsWith("tmp/"),
    `Reference locator ${sourceLocator} must stay within local tmp.`,
  );
  const actualPath = path.resolve(workspaceRoot, sourceLocator);
  const tmpRoot = path.resolve(workspaceRoot, "tmp");
  assertCondition(isInside(tmpRoot, actualPath), `Reference locator ${sourceLocator} escaped local tmp.`);
  const bytes = await readFile(actualPath);
  const image = sharp(bytes, { failOn: "error" });
  const metadata = await image.metadata();
  let opaque = true;
  if (metadata.hasAlpha) {
    const alphaStats = await image.ensureAlpha().extractChannel(3).stats();
    opaque = alphaStats.channels[0].min === 255 && alphaStats.channels[0].max === 255;
  }
  return {
    sourceLocator,
    actualSha256: sha256(bytes),
    format: metadata.format ?? "unknown",
    width: metadata.width ?? 0,
    height: metadata.height ?? 0,
    opaque,
  };
}

export async function buildCylinderNextCohortPreflightFromLocalFiles(
  workspaceRoot = process.cwd(),
): Promise<{
  artifact: CylinderNextCohortPreflightArtifact;
  writeResult: AddressedCylinderNextCohortWriteResult;
}> {
  const root = path.resolve(workspaceRoot);
  const planPath = path.resolve(root, CYLINDER_NEXT_COHORT_PLAN_PATH);
  const compileAllPath = path.resolve(root, CYLINDER_NEXT_COHORT_COMPILE_ALL_PATH);
  const canonicalPath = path.resolve(root, CYLINDER_NEXT_COHORT_CANONICAL_PRODUCT_TRUTH_PATH);
  const outputRoot = path.resolve(root, CYLINDER_NEXT_COHORT_OUTPUT_ROOT);
  for (const inputPath of [planPath, compileAllPath, canonicalPath]) {
    assertCondition(isInside(root, inputPath), `Authoritative input ${inputPath} escaped the workspace.`);
  }
  assertCondition(isInside(root, outputRoot), "Preflight output root escaped the workspace.");

  const [planBytes, compileAllBytes, canonicalBytes] = await Promise.all([
    readFile(planPath),
    readFile(compileAllPath),
    readFile(canonicalPath),
  ]);
  const plan = JSON.parse(planBytes.toString("utf8")) as CylinderDualRoleRemediationPlan;
  const compileAll = JSON.parse(compileAllBytes.toString("utf8")) as {
    workflowVersion: string;
    mode: string;
    planSha256: string;
    planFileSha256: string;
    canonicalProductTruthFileSha256: string;
    selectedJobCount: number;
    jobs: CylinderNextCohortCompiledJobInput[];
    externalWriteCount: number;
  };
  const selectedJobs = NEXT_COHORT_JOB_IDS.map((jobId) => {
    const matches = compileAll.jobs.filter((job) => job.jobId === jobId);
    assertCondition(matches.length === 1, `Compile-all must contain required job ${jobId} exactly once.`);
    return matches[0];
  });
  const canonicalCsv = parseCsv(canonicalBytes.toString("utf8"));
  const requiredColumns = [
    "graceSku",
    "websiteSku",
    "family",
    "color",
    "capacityMl",
    "canon_bodyHeightMm",
    "canon_heightWithCapMm",
    "canon_widthAxisMm",
    "canon_secondAxisMm",
    "capColor",
  ];
  const missingColumns = requiredColumns.filter((header) => !canonicalCsv.headers.includes(header));
  assertCondition(
    missingColumns.length === 0,
    `Canonical product truth is missing required columns: ${missingColumns.join(", ")}.`,
  );
  const sourceLocators = Array.from(new Set(selectedJobs.map((job) => job.sourceLocator)));
  assertCondition(sourceLocators.length === 4, "Exact next cohort must resolve four approved reference locators.");
  const references = await Promise.all(
    sourceLocators.map((sourceLocator) => inspectReference(root, sourceLocator)),
  );
  const artifact = buildCylinderNextCohortPreflight({
    sealedRunPlanSha256: path.basename(path.dirname(path.dirname(compileAllPath))),
    plan: {
      document: plan,
      actualFileSha256: sha256(planBytes),
    },
    compileAll: {
      actualFileSha256: sha256(compileAllBytes),
      document: { ...compileAll, jobs: selectedJobs },
    },
    canonicalProductTruth: {
      actualFileSha256: sha256(canonicalBytes),
      rows: canonicalCsv.records as CylinderDualRoleCanonicalProductTruthRow[],
    },
    references,
  });
  const writeResult = await writeAddressedCylinderNextCohortPreflight(outputRoot, artifact);
  return { artifact, writeResult };
}

async function main(): Promise<void> {
  assertCondition(process.argv.length === 2, "This sealed local-only preflight accepts no CLI arguments.");
  const result = await buildCylinderNextCohortPreflightFromLocalFiles();
  process.stdout.write(`${JSON.stringify({
    inputSetSha256: result.artifact.inputSetSha256,
    outputDirectory: result.writeResult.outputDirectory,
    manifestPath: result.writeResult.manifestPath,
    manifestSha256: result.writeResult.manifestSha256,
    htmlPath: result.writeResult.htmlPath,
    htmlSha256: result.writeResult.htmlSha256,
    identityCount: result.artifact.identityCount,
    jobCount: result.artifact.jobCount,
    generationStatus: result.artifact.generationStatus,
    humanVisualApproval: result.artifact.humanVisualApproval,
    promotionStatus: result.artifact.promotionStatus,
    externalWriteCount: result.artifact.externalWriteCount,
  }, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
