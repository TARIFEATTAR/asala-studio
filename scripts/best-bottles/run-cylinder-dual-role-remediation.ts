#!/usr/bin/env tsx
import { createHash } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import {
  access,
  mkdir,
  readFile,
  rename,
  rm,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import type { CylinderDualRoleRemediationPlan } from "../../src/lib/bestBottlesCylinderDualRoleRemediation";
import {
  assertCylinderDualRoleResumeCompatible,
  buildSuccessfulCylinderDualRoleResult,
  compileCylinderDualRoleRun,
  computeCanonicalProductTruthRecordSha256,
  parseCylinderDualRoleRunnerArgs,
  type CylinderDualRoleCanonicalProductTruthInput,
  type CylinderDualRoleCanonicalProductTruthRow,
  type CylinderDualRoleCompiledJob,
  type CylinderDualRoleSuccessfulResult,
} from "../../src/lib/bestBottlesCylinderDualRoleRunner";
import { parseCsv } from "../../src/lib/bestBottlesGapWorklist";
import { getFamilyRigForProduct } from "../../src/lib/product-image/familyRig";
import { buildFramingQaReport, type FramingQaReport } from "../../src/lib/product-image/framingQa";
import {
  detectStrongBounds,
  flattenBackgroundLikePixels,
} from "../../src/lib/product-image/rigPostprocess";
import { loadPromptSystem } from "../generate-prompts";

export const CYLINDER_DUAL_ROLE_PLAN_PATH =
  "tmp/best-bottles-reference-production/cylinder-dual-role-remediation-v2/cylinder-dual-role-remediation-plan.json";

export const CYLINDER_DUAL_ROLE_RUNS_ROOT =
  "tmp/best-bottles-reference-production/cylinder-dual-role-remediation-v2/runs";

export const CYLINDER_DUAL_ROLE_CANONICAL_PRODUCT_TRUTH_PATH =
  "docs/best-bottles-canonical-truth/best-bottles-master-truth.csv";

export const EXPECTED_CYLINDER_DUAL_ROLE_PLAN_SHA256 =
  "411f34e80f7762da48859ad7cf7056f1668055c929aebac00012ff2031ac4d35";

export const EXPECTED_CYLINDER_DUAL_ROLE_PLAN_FILE_SHA256 =
  "6d9c40b786defe0e34ea6163bfebbda6d9a70bcb0b1e41c28c07a716e4f0f332";

export const EXPECTED_CYLINDER_DUAL_ROLE_CANONICAL_PRODUCT_TRUTH_FILE_SHA256 =
  "f2b25bbe4ffe51a3cc98a1b392fb73b4a5715a9c0e911ef2bb672d3e9e0f72c7";

const OPENAI_MODEL = "gpt-image-2";
const OPENAI_API_URL = "https://api.openai.com/v1/images/edits";
const BEST_BOTTLES_BONE = { r: 245, g: 243, b: 239 } as const; // #F5F3EF

function sha256(value: Uint8Array | string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function parseCylinderDualRoleCanonicalProductTruth(
  bytes: Uint8Array,
  expectedFileSha256: string,
): CylinderDualRoleCanonicalProductTruthInput {
  const fileSha256 = sha256(bytes);
  if (fileSha256 !== expectedFileSha256.toLowerCase()) {
    throw new Error(
      `Canonical product-truth file SHA mismatch: expected ${expectedFileSha256}, received ${fileSha256}.`,
    );
  }
  const parsed = parseCsv(Buffer.from(bytes).toString("utf8"));
  const required = [
    "graceSku",
    "websiteSku",
    "productGroupSlug",
    "family",
    "category",
    "bottleCollection",
    "color",
    "capacityMl",
    "material",
    "glassFinish",
    "canon_bodyHeightMm",
    "canon_widthAxisMm",
    "canon_secondAxisMm",
    "canon_heightWithCapMm",
    "applicator",
    "capStyle",
    "capColor",
    "trimColor",
    "itemName",
  ];
  const missing = required.filter((header) => !parsed.headers.includes(header));
  if (missing.length > 0) {
    throw new Error(`Canonical product truth is missing required columns: ${missing.join(", ")}.`);
  }
  return {
    fileSha256,
    rows: parsed.records as CylinderDualRoleCanonicalProductTruthRow[],
  };
}

function safeFilename(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]+/g, "_");
}

function canonicalIdentityKey(websiteSku: string, graceSku: string): string {
  const normalize = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return `${normalize(websiteSku)}|${normalize(graceSku)}`;
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

export class CylinderDualRoleFramingError extends Error {
  constructor(
    message: string,
    readonly framingQa: FramingQaReport,
    readonly outputSha256: string,
  ) {
    super(message);
    this.name = "CylinderDualRoleFramingError";
  }
}

export async function validateCylinderDualRolePng(
  bytes: Uint8Array,
  context: {
    job: CylinderDualRoleCompiledJob;
    productTruth: CylinderDualRoleCanonicalProductTruthRow;
  },
): Promise<{
  width: 2080;
  height: 2288;
  opaque: true;
  outputSha256: string;
  framingQa: FramingQaReport;
}> {
  const image = sharp(bytes, { failOn: "error" });
  const metadata = await image.metadata();
  if (metadata.format !== "png") throw new Error(`Candidate format must be PNG, received ${metadata.format ?? "unknown"}.`);
  if (metadata.width !== 2080 || metadata.height !== 2288) {
    throw new Error(`Candidate must be exactly 2080x2288, received ${metadata.width ?? 0}x${metadata.height ?? 0}.`);
  }
  if (metadata.hasAlpha) {
    const alpha = await image.ensureAlpha().extractChannel(3).stats();
    if (alpha.channels[0].min !== 255 || alpha.channels[0].max !== 255) {
      throw new Error("Candidate must be fully opaque.");
    }
  }
  if (!context?.job || !context.productTruth) {
    throw new Error("Exact canonical product truth and compiled role are required for framing QA.");
  }
  if (
    context.productTruth.websiteSku !== context.job.websiteSku
    || context.productTruth.graceSku !== context.job.graceSku
    || computeCanonicalProductTruthRecordSha256(context.productTruth)
      !== context.job.canonicalProductTruthRecordSha256
  ) {
    throw new Error(`Canonical product truth does not match compiled job ${context.job.jobId}.`);
  }
  const product = {
    graceSku: context.productTruth.graceSku,
    websiteSku: context.productTruth.websiteSku,
    family: context.productTruth.family,
    bottleCollection: context.productTruth.bottleCollection,
    itemName: context.productTruth.itemName,
    category: context.productTruth.category,
    color: context.productTruth.color,
    capacityMl: Number(context.productTruth.capacityMl),
    applicator: context.productTruth.applicator,
    capStyle: context.productTruth.capStyle,
    capColor: context.productTruth.capColor,
    trimColor: context.productTruth.trimColor,
    heightWithoutCap: `${context.productTruth.canon_bodyHeightMm} mm`,
    heightWithCap: `${context.productTruth.canon_heightWithCapMm} mm`,
    diameter: `${context.productTruth.canon_widthAxisMm} mm`,
  };
  const rig = getFamilyRigForProduct(product);
  if (!rig) throw new Error(`No family rig resolved for ${context.job.jobId}.`);
  const raw = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const pixels = new Uint8ClampedArray(
    raw.data.buffer,
    raw.data.byteOffset,
    raw.data.byteLength,
  );
  // Analysis-only flattening matches the app framing-QA lane. The candidate
  // bytes themselves remain untouched and are never repainted after render.
  flattenBackgroundLikePixels(pixels, BEST_BOTTLES_BONE);
  const bounds = detectStrongBounds(pixels, 2080, 2288, BEST_BOTTLES_BONE);
  const capState = context.job.role === "pdp-cap-off-sidecar" ? "detached" : "assembled";
  const framingQa = buildFramingQaReport({
    width: 2080,
    height: 2288,
    rig,
    // Detached QA intentionally uses the complete-product envelope for fill
    // and shared baseline. No cap box is synthesized, and primary centerline
    // remains unavailable rather than being guessed from group geometry.
    bounds,
    primaryBounds: capState === "detached" ? null : bounds,
    baselineYPx: bounds?.bottom ?? null,
    capState,
  });
  const outputSha256 = sha256(bytes);
  if (framingQa.status === "fail") {
    throw new CylinderDualRoleFramingError(
      `${context.job.jobId} framing QA failed: ${framingQa.failures.join(" ")}`,
      framingQa,
      outputSha256,
    );
  }
  return {
    width: 2080,
    height: 2288,
    opaque: true,
    outputSha256,
    framingQa,
  };
}

async function readSourceBytes(root: string, job: CylinderDualRoleCompiledJob): Promise<Buffer> {
  let bytes: Buffer;
  if (/^https:\/\//i.test(job.sourceLocator)) {
    const response = await fetch(job.sourceLocator);
    if (!response.ok) throw new Error(`Source fetch failed with HTTP ${response.status}.`);
    bytes = Buffer.from(await response.arrayBuffer());
  } else {
    const sourcePath = path.resolve(root, job.sourceLocator);
    bytes = await readFile(sourcePath);
  }
  const actual = sha256(bytes);
  if (actual !== job.referenceSha256) {
    throw new Error(
      `${job.jobId} source/reference SHA mismatch: expected ${job.referenceSha256}, received ${actual}.`,
    );
  }
  return bytes;
}

function requireOpenAiKey(): string {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error("OPENAI_API_KEY is required for --execute prompt jobs.");
  return key;
}

async function renderPromptJob(
  job: CylinderDualRoleCompiledJob,
  referenceBytes: Buffer,
  apiKey: string,
): Promise<Buffer> {
  if (!job.prompt || !job.promptSha256) throw new Error(`${job.jobId} is missing its sealed prompt.`);
  const form = new FormData();
  form.append("model", OPENAI_MODEL);
  form.append("prompt", job.prompt);
  form.append("size", "2080x2288");
  form.append("quality", "high");
  form.append("background", "opaque");
  form.append(
    "image[]",
    new Blob([new Uint8Array(referenceBytes)], { type: "image/png" }),
    `${safeFilename(job.graceSku)}__reference.png`,
  );
  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!response.ok) {
    throw new Error(`OpenAI image edit failed with HTTP ${response.status}: ${(await response.text()).slice(0, 500)}`);
  }
  const payload = await response.json() as { data?: Array<{ b64_json?: string }> };
  const encoded = payload.data?.[0]?.b64_json;
  if (!encoded) throw new Error("OpenAI image edit response did not contain b64_json image data.");
  return Buffer.from(encoded, "base64");
}

type StoredResult = CylinderDualRoleSuccessfulResult | (Omit<CylinderDualRoleCompiledJob, "status"> & {
  status: "failed";
  error: string;
}) | (Omit<CylinderDualRoleCompiledJob, "status" | "reviewStatus"> & {
  status: "failed-framing";
  reviewStatus: "framing-rejected";
  error: string;
  outputSha256: string;
  outputDimensions: { width: 2080; height: 2288 };
  opaque: true;
  framingQa: FramingQaReport;
});

interface StoredRun {
  planFileSha256: string;
  planSha256: string;
  canonicalProductTruthFileSha256: string;
  results: StoredResult[];
}

interface StoredCompiledRun {
  planFileSha256: string;
  planSha256: string;
  canonicalProductTruthFileSha256: string;
  jobs: CylinderDualRoleCompiledJob[];
}

async function readStoredRun(resultsPath: string): Promise<StoredRun | null> {
  if (!(await pathExists(resultsPath))) return null;
  return JSON.parse(await readFile(resultsPath, "utf8")) as StoredRun;
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function writeJsonAtomically(filePath: string, value: unknown): Promise<void> {
  const partialPath = `${filePath}.partial`;
  await writeJson(partialPath, value);
  await rename(partialPath, filePath);
}

function runId(options: ReturnType<typeof parseCylinderDualRoleRunnerArgs>): string {
  if (options.mode === "compile-only" && options.all) return "compile-all";
  return `${options.mode}-${sha256(JSON.stringify(options)).slice(0, 16)}`;
}

export async function writeCylinderDualRoleCompileRecords(
  runDir: string,
  jobs: CylinderDualRoleCompiledJob[],
): Promise<void> {
  const promptsDir = path.join(runDir, "prompts");
  const operationsDir = path.join(runDir, "operations");
  await Promise.all([
    rm(promptsDir, { recursive: true, force: true }),
    rm(operationsDir, { recursive: true, force: true }),
  ]);
  await Promise.all([
    mkdir(promptsDir, { recursive: true }),
    mkdir(operationsDir, { recursive: true }),
    mkdir(path.join(runDir, "outputs"), { recursive: true }),
  ]);
  await Promise.all(jobs.map(async (job) => {
    const basename = safeFilename(job.jobId);
    if (job.prompt) {
      await writeJson(path.join(promptsDir, `${basename}.json`), job);
    } else {
      await writeJson(path.join(operationsDir, `${basename}.json`), job);
    }
  }));
}

export async function executeCylinderDualRoleJob(input: {
  root: string;
  runDir: string;
  job: CylinderDualRoleCompiledJob;
  prior: StoredResult | undefined;
  apiKey: string | null;
  productTruth: CylinderDualRoleCanonicalProductTruthRow;
}): Promise<{ result: StoredResult; openAiGenerationCalls: number }> {
  const outputPath = path.resolve(input.runDir, input.job.outputRelativePath);
  if (!isInside(input.runDir, outputPath)) throw new Error(`${input.job.jobId} output escaped the run directory.`);

  if (input.prior) {
    assertCylinderDualRoleResumeCompatible(input.job, input.prior);
    if (
      input.prior.status === "rendered-review-pending"
      || input.prior.status === "skipped-existing-review-pending"
      || input.prior.status === "failed-framing"
    ) {
      const bytes = await readFile(outputPath);
      let validation: Awaited<ReturnType<typeof validateCylinderDualRolePng>>;
      try {
        validation = await validateCylinderDualRolePng(bytes, {
          job: input.job,
          productTruth: input.productTruth,
        });
      } catch (error) {
        if (error instanceof CylinderDualRoleFramingError) {
          if (error.outputSha256 !== input.prior.outputSha256) {
            throw new Error(`Stale resume metadata for ${input.job.jobId}; output SHA changed.`);
          }
          return {
            result: {
              ...input.job,
              status: "failed-framing",
              reviewStatus: "framing-rejected",
              error: error.message,
              outputSha256: error.outputSha256,
              outputDimensions: { width: 2080, height: 2288 },
              opaque: true,
              framingQa: error.framingQa,
            },
            openAiGenerationCalls: 0,
          };
        }
        throw error;
      }
      if (validation.outputSha256 !== input.prior.outputSha256) {
        throw new Error(`Stale resume metadata for ${input.job.jobId}; output SHA changed.`);
      }
      return {
        result: buildSuccessfulCylinderDualRoleResult(input.job, {
          disposition: "existing",
          ...validation,
        }),
        openAiGenerationCalls: 0,
      };
    }
  } else if (await pathExists(outputPath)) {
    throw new Error(`Untracked existing output cannot be resumed for ${input.job.jobId}.`);
  }

  try {
    const referenceBytes = await readSourceBytes(input.root, input.job);
    const outputBytes = input.job.deterministicOperation
      ? referenceBytes
      : await renderPromptJob(input.job, referenceBytes, input.apiKey ?? requireOpenAiKey());
    let validation: Awaited<ReturnType<typeof validateCylinderDualRolePng>>;
    try {
      validation = await validateCylinderDualRolePng(outputBytes, {
        job: input.job,
        productTruth: input.productTruth,
      });
    } catch (error) {
      if (error instanceof CylinderDualRoleFramingError) {
        await mkdir(path.dirname(outputPath), { recursive: true });
        await writeFile(outputPath, outputBytes);
        return {
          result: {
            ...input.job,
            status: "failed-framing",
            reviewStatus: "framing-rejected",
            error: error.message,
            outputSha256: error.outputSha256,
            outputDimensions: { width: 2080, height: 2288 },
            opaque: true,
            framingQa: error.framingQa,
          },
          openAiGenerationCalls: input.job.deterministicOperation ? 0 : 1,
        };
      }
      throw error;
    }
    const partialPath = `${outputPath}.partial`;
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(partialPath, outputBytes);
    await rename(partialPath, outputPath);
    return {
      result: buildSuccessfulCylinderDualRoleResult(input.job, {
        disposition: "rendered",
        ...validation,
      }),
      openAiGenerationCalls: input.job.deterministicOperation ? 0 : 1,
    };
  } catch (error) {
    await unlink(`${outputPath}.partial`).catch(() => undefined);
    return {
      result: {
        ...input.job,
        status: "failed",
        reviewStatus: "review-pending",
        error: error instanceof Error ? error.message : String(error),
      },
      openAiGenerationCalls: 0,
    };
  }
}

/**
 * Re-runs only local validation for an existing sealed run. It never reads an
 * API key, calls a generation endpoint, normalizes pixels, or deletes output
 * candidates. This exists so framing-policy upgrades can fail closed while
 * retaining the original candidate bytes as review evidence.
 */
export async function revalidateCylinderDualRoleStoredRun(input: {
  runDirectory: string;
  root?: string;
}): Promise<Record<string, unknown>> {
  const root = path.resolve(input.root ?? process.cwd());
  const runsRoot = path.resolve(root, CYLINDER_DUAL_ROLE_RUNS_ROOT);
  const sealedPlanRunsRoot = path.join(runsRoot, EXPECTED_CYLINDER_DUAL_ROLE_PLAN_SHA256);
  const runDir = path.resolve(root, input.runDirectory);
  if (!isInside(sealedPlanRunsRoot, runDir) || runDir === sealedPlanRunsRoot) {
    throw new Error("Stored-run revalidation is restricted to a run directory under the sealed Task 1 plan SHA.");
  }

  const planPath = path.resolve(root, CYLINDER_DUAL_ROLE_PLAN_PATH);
  const canonicalProductTruthPath = path.resolve(root, CYLINDER_DUAL_ROLE_CANONICAL_PRODUCT_TRUTH_PATH);
  const resultsPath = path.join(runDir, "results.json");
  const compiledPath = path.join(runDir, "compiled-jobs.json");
  const summaryPath = path.join(runDir, "summary.json");
  const [planBytes, canonicalProductTruthBytes, stored, compiled, priorSummary] = await Promise.all([
    readFile(planPath),
    readFile(canonicalProductTruthPath),
    readStoredRun(resultsPath),
    readFile(compiledPath, "utf8").then((value) => JSON.parse(value) as StoredCompiledRun),
    readFile(summaryPath, "utf8").then((value) => JSON.parse(value) as Record<string, unknown>),
  ]);
  if (!stored) throw new Error(`Stored run has no results.json: ${path.relative(root, runDir)}.`);

  const planFileSha256 = sha256(planBytes);
  const plan = JSON.parse(planBytes.toString("utf8")) as CylinderDualRoleRemediationPlan;
  if (
    planFileSha256 !== EXPECTED_CYLINDER_DUAL_ROLE_PLAN_FILE_SHA256
    || plan.sha256 !== EXPECTED_CYLINDER_DUAL_ROLE_PLAN_SHA256
  ) {
    throw new Error("Stored-run revalidation refused an unsealed Task 1 plan.");
  }
  const canonicalProductTruth = parseCylinderDualRoleCanonicalProductTruth(
    canonicalProductTruthBytes,
    EXPECTED_CYLINDER_DUAL_ROLE_CANONICAL_PRODUCT_TRUTH_FILE_SHA256,
  );
  for (const metadata of [stored, compiled]) {
    if (
      metadata.planFileSha256 !== planFileSha256
      || metadata.planSha256 !== plan.sha256
      || metadata.canonicalProductTruthFileSha256 !== canonicalProductTruth.fileSha256
    ) {
      throw new Error("Stored-run revalidation refused stale plan or canonical product-truth metadata.");
    }
  }

  const productTruthByIdentity = new Map(
    canonicalProductTruth.rows
      .filter((row) => row.websiteSku && row.graceSku)
      .map((row) => [canonicalIdentityKey(row.websiteSku, row.graceSku), row]),
  );
  const priorById = new Map(stored.results.map((result) => [result.jobId, result]));
  if (priorById.size !== stored.results.length || compiled.jobs.length !== stored.results.length) {
    throw new Error("Stored-run revalidation requires a one-to-one compiled-job/result set.");
  }

  const results: StoredResult[] = [];
  for (const job of compiled.jobs) {
    const prior = priorById.get(job.jobId);
    if (!prior) throw new Error(`Stored-run revalidation is missing result ${job.jobId}.`);
    assertCylinderDualRoleResumeCompatible(job, prior);
    if (
      prior.status !== "rendered-review-pending"
      && prior.status !== "skipped-existing-review-pending"
      && prior.status !== "failed-framing"
    ) {
      results.push(prior);
      continue;
    }
    const productTruth = productTruthByIdentity.get(job.canonicalIdentityKey);
    if (!productTruth) throw new Error(`Missing validated product truth for ${job.jobId}.`);
    const outputPath = path.resolve(runDir, job.outputRelativePath);
    if (!isInside(runDir, outputPath)) throw new Error(`${job.jobId} output escaped the run directory.`);
    const outputBytes = await readFile(outputPath);
    try {
      const validation = await validateCylinderDualRolePng(outputBytes, { job, productTruth });
      if (validation.outputSha256 !== prior.outputSha256) {
        throw new Error(`Stale resume metadata for ${job.jobId}; output SHA changed.`);
      }
      results.push(buildSuccessfulCylinderDualRoleResult(job, {
        disposition: "existing",
        ...validation,
      }));
    } catch (error) {
      if (!(error instanceof CylinderDualRoleFramingError)) throw error;
      if (error.outputSha256 !== prior.outputSha256) {
        throw new Error(`Stale resume metadata for ${job.jobId}; output SHA changed.`);
      }
      results.push({
        ...job,
        status: "failed-framing",
        reviewStatus: "framing-rejected",
        error: error.message,
        outputSha256: error.outputSha256,
        outputDimensions: { width: 2080, height: 2288 },
        opaque: true,
        framingQa: error.framingQa,
      });
    }
  }

  const renderedReviewPendingCount = results.filter((result) => result.status === "rendered-review-pending").length;
  const skippedExistingReviewPendingCount = results.filter(
    (result) => result.status === "skipped-existing-review-pending",
  ).length;
  const failedFramingCount = results.filter((result) => result.status === "failed-framing").length;
  const failedCount = results.filter(
    (result) => result.status === "failed" || result.status === "failed-framing",
  ).length;
  const updatedSummary = {
    ...priorSummary,
    renderedReviewPendingCount,
    skippedExistingReviewPendingCount,
    failedFramingCount,
    failedCount,
    latestOperation: "local-framing-revalidation",
    latestOperationExternalGenerationCallCount: 0,
    externalWrites: { supabase: 0, shopify: 0, remotePersistence: 0 },
    externalWriteCount: 0,
  };
  await writeJsonAtomically(resultsPath, {
    planFileSha256,
    planSha256: plan.sha256,
    canonicalProductTruthFileSha256: canonicalProductTruth.fileSha256,
    results,
  });
  await writeJsonAtomically(summaryPath, updatedSummary);
  return updatedSummary;
}

export async function runCylinderDualRoleRunnerCli(input: {
  argv: string[];
  root?: string;
}): Promise<Record<string, unknown>> {
  const root = path.resolve(input.root ?? process.cwd());
  const options = parseCylinderDualRoleRunnerArgs(input.argv);
  const planPath = path.resolve(root, CYLINDER_DUAL_ROLE_PLAN_PATH);
  const canonicalProductTruthPath = path.resolve(root, CYLINDER_DUAL_ROLE_CANONICAL_PRODUCT_TRUTH_PATH);
  const [planBytes, canonicalProductTruthBytes] = await Promise.all([
    readFile(planPath),
    readFile(canonicalProductTruthPath),
  ]);
  const planFileSha256 = sha256(planBytes);
  if (planFileSha256 !== EXPECTED_CYLINDER_DUAL_ROLE_PLAN_FILE_SHA256) {
    throw new Error(
      `Task 1 artifact file SHA mismatch: expected ${EXPECTED_CYLINDER_DUAL_ROLE_PLAN_FILE_SHA256}, received ${planFileSha256}.`,
    );
  }
  const plan = JSON.parse(planBytes.toString("utf8")) as CylinderDualRoleRemediationPlan;
  const canonicalProductTruth = parseCylinderDualRoleCanonicalProductTruth(
    canonicalProductTruthBytes,
    EXPECTED_CYLINDER_DUAL_ROLE_CANONICAL_PRODUCT_TRUTH_FILE_SHA256,
  );
  const productTruthByIdentity = new Map(
    canonicalProductTruth.rows
      .filter((row) => row.websiteSku && row.graceSku)
      .map((row) => [canonicalIdentityKey(row.websiteSku, row.graceSku), row]),
  );
  const compiled = compileCylinderDualRoleRun({
    plan,
    expectedPlanSha256: EXPECTED_CYLINDER_DUAL_ROLE_PLAN_SHA256,
    options,
    promptSystem: loadPromptSystem(root),
    canonicalProductTruth,
  });

  const runsRoot = path.resolve(root, CYLINDER_DUAL_ROLE_RUNS_ROOT);
  const runDir = path.resolve(runsRoot, plan.sha256, runId(options));
  if (!isInside(runsRoot, runDir)) throw new Error("Resolved run directory escaped the authorized runs root.");
  await mkdir(runDir, { recursive: true });
  await writeCylinderDualRoleCompileRecords(runDir, compiled.jobs);
  await writeJson(path.join(runDir, "compiled-jobs.json"), {
    ...compiled,
    planFileSha256,
  });

  let results: StoredResult[] = [...compiled.jobs];
  let openAiGenerationCalls = 0;
  if (options.mode === "execute-local-only") {
    const resultsPath = path.join(runDir, "results.json");
    const stored = await readStoredRun(resultsPath);
    if (stored && (
      stored.planSha256 !== plan.sha256
      || stored.planFileSha256 !== planFileSha256
      || stored.canonicalProductTruthFileSha256 !== canonicalProductTruth.fileSha256
    )) {
      throw new Error("Stale resume metadata: stored Task 1 or canonical product-truth hashes do not match this run.");
    }
    const priorById = new Map((stored?.results ?? []).map((result) => [result.jobId, result]));
    const executed: StoredResult[] = [];
    const apiKey = compiled.jobs.some((job) => job.prompt) ? requireOpenAiKey() : null;
    for (const job of compiled.jobs) {
      const productTruth = productTruthByIdentity.get(job.canonicalIdentityKey);
      if (!productTruth) throw new Error(`Missing validated product truth for ${job.jobId}.`);
      const outcome = await executeCylinderDualRoleJob({
        root,
        runDir,
        job,
        prior: priorById.get(job.jobId),
        apiKey,
        productTruth,
      });
      executed.push(outcome.result);
      openAiGenerationCalls += outcome.openAiGenerationCalls;
      await writeJson(resultsPath, {
        planFileSha256,
        planSha256: plan.sha256,
        canonicalProductTruthFileSha256: canonicalProductTruth.fileSha256,
        results: executed,
      });
    }
    results = executed;
  }

  const summary = {
    workflowVersion: compiled.workflowVersion,
    mode: compiled.mode,
    planPath: CYLINDER_DUAL_ROLE_PLAN_PATH,
    planFileSha256,
    planSha256: plan.sha256,
    canonicalProductTruthPath: CYLINDER_DUAL_ROLE_CANONICAL_PRODUCT_TRUTH_PATH,
    canonicalProductTruthFileSha256: canonicalProductTruth.fileSha256,
    runDirectory: path.relative(root, runDir),
    selectedJobCount: compiled.selectedJobCount,
    compiledJobCount: compiled.jobs.length,
    promptJobCount: compiled.jobs.filter((job) => job.promptSha256).length,
    deterministicOperationJobCount: compiled.jobs.filter((job) => job.deterministicOperationSha256).length,
    renderedReviewPendingCount: results.filter((result) => result.status === "rendered-review-pending").length,
    skippedExistingReviewPendingCount: results.filter((result) => result.status === "skipped-existing-review-pending").length,
    failedFramingCount: results.filter((result) => result.status === "failed-framing").length,
    failedCount: results.filter((result) => (
      result.status === "failed" || result.status === "failed-framing"
    )).length,
    outputContract: { format: "png", width: 2080, height: 2288, opaque: true, reviewStatus: "review-pending" },
    externalGenerationCallCount: openAiGenerationCalls,
    externalWrites: { supabase: 0, shopify: 0, remotePersistence: 0 },
    externalWriteCount: 0,
  };
  await writeJson(path.join(runDir, "summary.json"), summary);
  return summary;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const summary = argv[0] === "--revalidate-stored-run"
    ? await (() => {
      if (argv.length !== 2 || !argv[1]) {
        throw new Error("--revalidate-stored-run requires exactly one local run-directory argument.");
      }
      return revalidateCylinderDualRoleStoredRun({ runDirectory: argv[1] });
    })()
    : await runCylinderDualRoleRunnerCli({ argv });
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  if ((summary.failedCount as number) > 0) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
