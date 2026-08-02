#!/usr/bin/env tsx
import { createHash } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import type { CylinderDualRoleRemediationPlan } from "../../src/lib/bestBottlesCylinderDualRoleRemediation";
import type { CylinderDualRoleCanonicalProductTruthRow, CylinderDualRoleCompiledJob } from "../../src/lib/bestBottlesCylinderDualRoleRunner";
import { parseCylinderDualRoleCanonicalProductTruth } from "./run-cylinder-dual-role-remediation";
import {
  buildCylinderFullExecutionSchedule,
  renderCylinderFullExecutionScheduleHtml,
  serializeCylinderFullExecutionSchedule,
  validateCylinderFullExecutionSchedule,
  type CylinderFullExecutionScheduleArtifact,
  type CylinderFullExecutionScheduleBuildInput,
  type CylinderFullSchedulePilotOutputProof,
  type CylinderFullScheduleReferenceProof,
} from "../../src/lib/bestBottlesCylinderFullExecutionSchedule";
import type { CylinderNextCohortPreflightArtifact } from "../../src/lib/bestBottlesCylinderNextCohortPreflight";

export const CYLINDER_FULL_SCHEDULE_PLAN_PATH =
  "tmp/best-bottles-reference-production/cylinder-dual-role-remediation-v2/cylinder-dual-role-remediation-plan.json";
export const CYLINDER_FULL_SCHEDULE_COMPILE_ALL_PATH =
  "tmp/best-bottles-reference-production/cylinder-dual-role-remediation-v2/runs/411f34e80f7762da48859ad7cf7056f1668055c929aebac00012ff2031ac4d35/compile-all/compiled-jobs.json";
export const CYLINDER_FULL_SCHEDULE_PILOT_PATH =
  "tmp/best-bottles-reference-production/cylinder-dual-role-remediation-v2/runs/411f34e80f7762da48859ad7cf7056f1668055c929aebac00012ff2031ac4d35/execute-local-only-304a29d863ee1e5a/pilot-role-review-v1/41ce4ab7062d7d3abe3cb60ef77bde063bd38634eb8dcb1bc55eb2cb29d08312/pilot-role-review.json";
export const CYLINDER_FULL_SCHEDULE_NEXT_COHORT_PATH =
  "tmp/best-bottles-reference-production/cylinder-dual-role-remediation-v2/runs/411f34e80f7762da48859ad7cf7056f1668055c929aebac00012ff2031ac4d35/next-cohort-preflight-v1/dd3119424506238e1461c93e4daea8a33f61b2d6e8a530030303d7f5dd5707d1/next-cohort-preflight.json";
export const CYLINDER_FULL_SCHEDULE_CANONICAL_PRODUCT_TRUTH_PATH =
  "docs/best-bottles-canonical-truth/best-bottles-master-truth.csv";
export const CYLINDER_FULL_SCHEDULE_OUTPUT_ROOT =
  "tmp/best-bottles-reference-production/cylinder-dual-role-remediation-v2/runs/411f34e80f7762da48859ad7cf7056f1668055c929aebac00012ff2031ac4d35/full-execution-schedule-v1";

const SEALED_PLAN_SHA256 = "411f34e80f7762da48859ad7cf7056f1668055c929aebac00012ff2031ac4d35";
const LOCAL_REFERENCE_CACHE_ROOT = "tmp/best-bottles-reference-production/cylinder-sidecar-reconciliation-v2/exports";

interface CompileAllDocument {
  workflowVersion: string;
  mode: string;
  planSha256: string;
  planFileSha256: string;
  canonicalProductTruthFileSha256: string;
  selectedJobCount: number;
  jobs: CylinderDualRoleCompiledJob[];
  externalWriteCount: number;
}

interface PilotDocument {
  inputSetSha256: string;
  roles: Array<{
    jobId: string;
    hashes: { outputSha256: string };
    png: { relativePath: string };
  }>;
  [key: string]: unknown;
}

export interface AddressedCylinderFullScheduleWriteResult {
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

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function listFilesRecursively(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const resolved = path.join(root, entry.name);
    if (entry.isDirectory()) return listFilesRecursively(resolved);
    return entry.isFile() ? [resolved] : [];
  }));
  return nested.flat().sort();
}

async function readJsonFile<T>(root: string, relativePath: string): Promise<{
  path: string;
  actualFileSha256: string;
  document: T;
  bytes: Buffer;
}> {
  const resolved = path.resolve(root, relativePath);
  assertCondition(isInside(root, resolved), `Authoritative JSON input escaped workspace: ${relativePath}.`);
  const bytes = await readFile(resolved);
  return {
    path: relativePath,
    actualFileSha256: sha256(bytes),
    document: JSON.parse(bytes.toString("utf8")) as T,
    bytes,
  };
}

async function buildReferenceProofs(
  root: string,
  jobs: CylinderDualRoleCompiledJob[],
): Promise<CylinderFullScheduleReferenceProof[]> {
  const authority = new Map<string, string>();
  for (const job of jobs) {
    const prior = authority.get(job.sourceLocator);
    assertCondition(!prior || prior === job.referenceSha256, `Source locator ${job.sourceLocator} crosses multiple reference hashes.`);
    authority.set(job.sourceLocator, job.referenceSha256);
  }
  const remoteHashes = new Set(Array.from(authority.entries()).filter(([locator]) => /^https:\/\//i.test(locator)).map(([, hash]) => hash));
  const cachedByHash = new Map<string, string[]>();
  if (remoteHashes.size > 0) {
    const cacheRoot = path.resolve(root, LOCAL_REFERENCE_CACHE_ROOT);
    assertCondition(isInside(root, cacheRoot) && await exists(cacheRoot), "Required local sidecar byte cache is missing.");
    const files = (await listFilesRecursively(cacheRoot)).filter((filePath) => filePath.toLowerCase().endsWith(".png"));
    for (const filePath of files) {
      const bytes = await readFile(filePath);
      const hash = sha256(bytes);
      if (!remoteHashes.has(hash)) continue;
      const relative = path.relative(root, filePath).split(path.sep).join("/");
      cachedByHash.set(hash, [...(cachedByHash.get(hash) ?? []), relative]);
    }
  }
  const proofs: CylinderFullScheduleReferenceProof[] = [];
  for (const [sourceLocator, expectedSha256] of Array.from(authority.entries()).sort(([left], [right]) => left.localeCompare(right))) {
    if (/^https:\/\//i.test(sourceLocator)) {
      const matches = cachedByHash.get(expectedSha256) ?? [];
      assertCondition(matches.length >= 1, `No cached local bytes match sealed HTTPS reference ${sourceLocator}.`);
      const resolvedLocalLocator = [...matches].sort()[0];
      const bytes = await readFile(path.resolve(root, resolvedLocalLocator));
      proofs.push({
        sourceLocator,
        resolvedLocalLocator,
        expectedSha256,
        actualSha256: sha256(bytes),
        verificationMode: "cached-local-byte-proof-for-sealed-https-locator",
      });
    } else {
      assertCondition(!sourceLocator.startsWith("/") && !sourceLocator.split(/[\\/]/).includes(".."), `Reference locator must be workspace-relative: ${sourceLocator}.`);
      const resolved = path.resolve(root, sourceLocator);
      assertCondition(isInside(path.resolve(root, "tmp"), resolved), `Reference locator escaped authorized local tmp: ${sourceLocator}.`);
      const bytes = await readFile(resolved);
      proofs.push({
        sourceLocator,
        resolvedLocalLocator: sourceLocator.split(path.sep).join("/"),
        expectedSha256,
        actualSha256: sha256(bytes),
        verificationMode: "direct-local-locator-bytes",
      });
    }
  }
  return proofs;
}

async function buildPilotOutputProofs(
  root: string,
  pilotPath: string,
  pilot: PilotDocument,
): Promise<CylinderFullSchedulePilotOutputProof[]> {
  const executeRunRoot = path.resolve(root, path.dirname(pilotPath), "../..");
  assertCondition(isInside(root, executeRunRoot), "Pilot execute-run root escaped workspace.");
  return Promise.all(pilot.roles.map(async (role) => {
    const resolved = path.resolve(executeRunRoot, role.png.relativePath);
    assertCondition(isInside(executeRunRoot, resolved), `Pilot output ${role.jobId} escaped execute-run root.`);
    const bytes = await readFile(resolved);
    return {
      jobId: role.jobId,
      resolvedLocalLocator: path.relative(root, resolved).split(path.sep).join("/"),
      expectedSha256: role.hashes.outputSha256,
      actualSha256: sha256(bytes),
    };
  }));
}

export async function loadCylinderFullExecutionScheduleInputFromLocalFiles(
  workspaceRoot = process.cwd(),
): Promise<CylinderFullExecutionScheduleBuildInput> {
  const root = path.resolve(workspaceRoot);
  const [plan, compileAll, pilot, nextCohort] = await Promise.all([
    readJsonFile<CylinderDualRoleRemediationPlan>(root, CYLINDER_FULL_SCHEDULE_PLAN_PATH),
    readJsonFile<CompileAllDocument>(root, CYLINDER_FULL_SCHEDULE_COMPILE_ALL_PATH),
    readJsonFile<PilotDocument>(root, CYLINDER_FULL_SCHEDULE_PILOT_PATH),
    readJsonFile<CylinderNextCohortPreflightArtifact>(root, CYLINDER_FULL_SCHEDULE_NEXT_COHORT_PATH),
  ]);
  const canonicalPath = path.resolve(root, CYLINDER_FULL_SCHEDULE_CANONICAL_PRODUCT_TRUTH_PATH);
  assertCondition(isInside(root, canonicalPath), "Canonical product-truth input escaped workspace.");
  const canonicalBytes = await readFile(canonicalPath);
  const canonical = parseCylinderDualRoleCanonicalProductTruth(
    canonicalBytes,
    compileAll.document.canonicalProductTruthFileSha256,
  );
  const [references, pilotOutputProofs] = await Promise.all([
    buildReferenceProofs(root, compileAll.document.jobs),
    buildPilotOutputProofs(root, CYLINDER_FULL_SCHEDULE_PILOT_PATH, pilot.document),
  ]);
  return {
    sealedRunPlanSha256: SEALED_PLAN_SHA256,
    plan: { path: plan.path, actualFileSha256: plan.actualFileSha256, document: plan.document },
    compileAll: { path: compileAll.path, actualFileSha256: compileAll.actualFileSha256, document: compileAll.document },
    pilot: { path: pilot.path, actualFileSha256: pilot.actualFileSha256, document: pilot.document as any },
    nextCohort: { path: nextCohort.path, actualFileSha256: nextCohort.actualFileSha256, document: nextCohort.document },
    canonicalProductTruth: {
      path: CYLINDER_FULL_SCHEDULE_CANONICAL_PRODUCT_TRUTH_PATH,
      actualFileSha256: canonical.fileSha256,
      rawText: canonicalBytes.toString("utf8"),
      rows: canonical.rows as CylinderDualRoleCanonicalProductTruthRow[],
    },
    references,
    pilotOutputProofs,
  };
}

export async function writeAddressedCylinderFullExecutionSchedule(
  workspaceRoot: string,
  artifact: CylinderFullExecutionScheduleArtifact,
): Promise<AddressedCylinderFullScheduleWriteResult> {
  const root = path.resolve(workspaceRoot);
  const outputRoot = path.resolve(root, CYLINDER_FULL_SCHEDULE_OUTPUT_ROOT);
  assertCondition(isInside(root, outputRoot), "Full schedule output root escaped workspace.");
  const outputDirectory = path.resolve(outputRoot, artifact.inputSetSha256);
  assertCondition(isInside(outputRoot, outputDirectory), "Addressed full schedule output escaped authorized root.");
  const manifestPath = path.join(outputDirectory, "full-execution-schedule.json");
  const htmlPath = path.join(outputDirectory, "index.html");
  const manifestBytes = serializeCylinderFullExecutionSchedule(artifact);
  const htmlBytes = renderCylinderFullExecutionScheduleHtml(artifact);
  if (await exists(outputDirectory)) {
    const [existingManifest, existingHtml] = await Promise.all([
      readFile(manifestPath, "utf8"),
      readFile(htmlPath, "utf8"),
    ]);
    assertCondition(existingManifest === manifestBytes, "Existing addressed JSON bytes do not match recomputed schedule.");
    assertCondition(existingHtml === htmlBytes, "Existing addressed HTML bytes do not match recomputed schedule.");
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

export async function buildCylinderFullExecutionScheduleFromLocalFiles(
  workspaceRoot = process.cwd(),
): Promise<{ artifact: CylinderFullExecutionScheduleArtifact; writeResult: AddressedCylinderFullScheduleWriteResult }> {
  const input = await loadCylinderFullExecutionScheduleInputFromLocalFiles(workspaceRoot);
  const artifact = buildCylinderFullExecutionSchedule(input);
  validateCylinderFullExecutionSchedule(input, artifact);
  const writeResult = await writeAddressedCylinderFullExecutionSchedule(workspaceRoot, artifact);
  return { artifact, writeResult };
}

async function main(): Promise<void> {
  assertCondition(process.argv.length === 2, "This sealed local-only schedule builder accepts no CLI arguments.");
  const result = await buildCylinderFullExecutionScheduleFromLocalFiles();
  process.stdout.write(`${JSON.stringify({
    inputSetSha256: result.artifact.inputSetSha256,
    outputDirectory: result.writeResult.outputDirectory,
    manifestPath: result.writeResult.manifestPath,
    manifestSha256: result.writeResult.manifestSha256,
    htmlPath: result.writeResult.htmlPath,
    htmlSha256: result.writeResult.htmlSha256,
    summary: result.artifact.summary,
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
