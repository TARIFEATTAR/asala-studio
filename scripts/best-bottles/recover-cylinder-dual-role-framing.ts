#!/usr/bin/env tsx

/**
 * Bounded, local-only geometry recovery for retained Task 2 failed-framing PNGs.
 *
 * This command never calls an image model, uploads, deploys, promotes roles, or
 * writes outside the selected sealed Task 2 run. Raw model outputs are read-only.
 * Default mode is plan-only; add --execute to write normalized review candidates.
 */
import { createHash } from "node:crypto";
import {
  access,
  mkdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium, type Browser, type Page } from "playwright";
import sharp from "sharp";

import type { CylinderDualRoleRemediationPlan } from "../../src/lib/bestBottlesCylinderDualRoleRemediation";
import type { CylinderDualRoleCompileResult } from "../../src/lib/bestBottlesCylinderDualRoleRunner";
import {
  buildCylinderFramingRecoveryPlan,
  isAllowedCylinderFramingRecoveryResourceUrl,
  parseCylinderFramingRecoveryArgs,
  validateCylinderFramingRecoveryPass,
  type CylinderFramingRecoveryJob,
  type CylinderFramingRecoveryPassResult,
  type CylinderFramingRecoveryPlan,
} from "../../src/lib/bestBottlesCylinderFramingRecovery";

const REPO_ROOT = process.cwd();
const CANONICAL_TRUTH_PATH = path.join(
  REPO_ROOT,
  "docs/best-bottles-canonical-truth/best-bottles-master-truth.csv",
);
const LOCAL_VITE_URL = "http://127.0.0.1:8080/";

interface CompileArtifactWithPlanFileSha extends CylinderDualRoleCompileResult {
  planFileSha256: string;
}

interface StoredResultArtifact {
  planFileSha256: string;
  planSha256: string;
  canonicalProductTruthFileSha256: string;
  results: Array<Record<string, unknown>>;
}

interface RecoveryJobRecord {
  workflowVersion: string;
  jobId: string;
  canonicalIdentityKey: string;
  websiteSku: string;
  graceSku: string;
  role: string;
  topology: string;
  planSha256: string;
  planFileSha256: string;
  canonicalProductTruthFileSha256: string;
  canonicalProductTruthRecordSha256: string;
  canonicalGeometrySha256: string;
  sourceSha256: string | null;
  referenceSha256: string;
  promptSha256: string | null;
  rawOutputRelativePath: string;
  rawOutputSha256Before: string;
  rawOutputSha256After: string;
  rawOutputPreserved: true;
  passes: CylinderFramingRecoveryPassResult[];
  finalStatus: "normalized-review-pending" | "normalized-shadow-review-required" | "normalized-rejected";
  reviewStatus: "review-pending" | "shadow-review-required" | "framing-rejected";
  promotionStatus: "not-promoted";
  generationCallCount: 0;
  externalWriteCount: 0;
  uploadCount: 0;
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

async function fileSha256(filePath: string): Promise<string> {
  return sha256(await readFile(filePath));
}

function resolvePlanArtifactPath(runDirectory: string): string {
  const normalized = path.resolve(REPO_ROOT, runDirectory);
  const marker = `${path.sep}runs${path.sep}`;
  const index = normalized.indexOf(marker);
  if (index < 0) throw new Error("--run-dir must point inside the sealed Task 2 runs directory.");
  return path.join(
    normalized.slice(0, index),
    "cylinder-dual-role-remediation-plan.json",
  );
}

async function collectRawHashes(
  runDirectory: string,
  compiled: CompileArtifactWithPlanFileSha,
): Promise<Record<string, string>> {
  const hashes: Record<string, string> = {};
  for (const job of compiled.jobs) {
    const candidatePath = path.resolve(runDirectory, job.outputRelativePath);
    const relative = path.relative(path.resolve(runDirectory), candidatePath);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error(`Raw output escapes sealed run directory: ${job.outputRelativePath}.`);
    }
    hashes[job.outputRelativePath] = await fileSha256(candidatePath);
  }
  return hashes;
}

async function writeImmutable(filePath: string, bytes: Uint8Array): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  try {
    await writeFile(filePath, bytes, { flag: "wx" });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "EEXIST") throw error;
    const existing = await readFile(filePath);
    if (sha256(existing) !== sha256(bytes)) {
      throw new Error(`Refusing to overwrite existing non-identical recovery artifact ${filePath}.`);
    }
  }
}

async function inspectOpaquePng(bytes: Uint8Array): Promise<{
  width: number;
  height: number;
  opaque: boolean;
}> {
  const image = sharp(bytes, { failOn: "error" });
  const metadata = await image.metadata();
  if (metadata.format !== "png" || !metadata.width || !metadata.height) {
    throw new Error("Framing recovery output must be a readable PNG.");
  }
  const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let opaque = true;
  for (let index = 3; index < data.length; index += info.channels) {
    if (data[index] !== 255) {
      opaque = false;
      break;
    }
  }
  return { width: metadata.width, height: metadata.height, opaque };
}

async function ensureLocalVite(page: Page): Promise<void> {
  await page.route("**/*", async (route) => {
    if (isAllowedCylinderFramingRecoveryResourceUrl(route.request().url())) {
      await route.continue();
    } else {
      await route.abort("blockedbyclient");
    }
  });
  try {
    await page.goto(LOCAL_VITE_URL, { waitUntil: "domcontentloaded", timeout: 20_000 });
  } catch (error) {
    throw new Error(
      `Local Vite app is required at ${LOCAL_VITE_URL}; no remote browser target is permitted. ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

async function normalizePass(
  page: Page,
  imageBytes: Uint8Array,
  job: CylinderFramingRecoveryJob,
): Promise<{
  bytes: Buffer;
  normalization: CylinderFramingRecoveryPassResult["normalization"];
}> {
  const imageUrl = `data:image/png;base64,${Buffer.from(imageBytes).toString("base64")}`;
  const result = await page.evaluate(
    async ({ imageUrl, normalizer }) => {
      const [
        { normalizeBestBottlesRigBaseline },
        { resolveBestBottlesShadowTopology },
        { analyzeDetachedSidecarLaneFloor },
      ] =
        await Promise.all([
          import("/src/lib/product-image/rigPostprocess.ts"),
          import("/src/lib/bestBottlesShadowTopology.ts"),
          import("/src/lib/product-image/detachedSidecarLaneQa.ts"),
        ]);
      const shadowTopology = resolveBestBottlesShadowTopology(normalizer, {});
      const normalized = await normalizeBestBottlesRigBaseline(imageUrl, {
        ...normalizer,
        shadowTopology,
      });
      let detachedSidecarLaneFloorQa = null;
      if (normalizer.mode === "detached-sidecar") {
        const rendered = new Image();
        await new Promise<void>((resolve, reject) => {
          rendered.onload = () => resolve();
          rendered.onerror = () => reject(new Error("Normalized sidecar PNG could not be decoded for lane QA."));
          rendered.src = normalized.dataUrl;
        });
        const canvas = document.createElement("canvas");
        canvas.width = rendered.naturalWidth;
        canvas.height = rendered.naturalHeight;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) throw new Error("Canvas 2D context is required for detached sidecar lane QA.");
        context.drawImage(rendered, 0, 0);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        const hex = normalizer.targetBackgroundHex.replace(/^#/, "");
        detachedSidecarLaneFloorQa = analyzeDetachedSidecarLaneFloor({
          pixels,
          width: canvas.width,
          height: canvas.height,
          background: {
            r: Number.parseInt(hex.slice(0, 2), 16),
            g: Number.parseInt(hex.slice(2, 4), 16),
            b: Number.parseInt(hex.slice(4, 6), 16),
          },
          primaryBounds: normalized.framingQa?.primaryBounds ?? null,
          groupBounds: normalized.objectBounds,
          primaryBaselineYPx: normalized.framingQa?.measurements.baselineYPx ?? null,
          sharedGroupBaselineYPx: normalized.objectBounds?.bottom ?? null,
          baselineTolerancePx: 8,
        });
      }
      return {
        dataUrl: normalized.dataUrl,
        scale: normalized.scale,
        shiftXPx: normalized.shiftXPx,
        shiftYPx: normalized.shiftYPx,
        detectedBaselineYPx: normalized.detectedBaselineYPx,
        targetBaselineYPx: normalized.targetBaselineYPx,
        framingQa: normalized.framingQa,
        framingDecision: normalized.framingDecision,
        qaIssues: normalized.qaIssues,
        preTransformBaselineYPx: normalized.preTransformBaselineYPx,
        preTransformObjectBounds: normalized.preTransformObjectBounds,
        transformControlBounds: normalized.transformControlBounds,
        objectBounds: normalized.objectBounds,
        detachedSidecarLaneFloorQa,
        shadowOwner: normalized.shadowOwner,
        shadowQa: normalized.shadowQa,
      };
    },
    { imageUrl, normalizer: job.normalizer },
  );
  const bytes = Buffer.from(result.dataUrl.replace(/^data:image\/png;base64,/, ""), "base64");
  return {
    bytes,
    normalization: {
      scale: result.scale,
      shiftXPx: result.shiftXPx,
      shiftYPx: result.shiftYPx,
      detectedBaselineYPx: result.detectedBaselineYPx,
      targetBaselineYPx: result.targetBaselineYPx,
      framingQa: result.framingQa,
      framingDecision: result.framingDecision,
      qaIssues: result.qaIssues,
      // Preserve complete deterministic transform/QA evidence without expanding
      // the pure validator's acceptance surface.
      preTransformBaselineYPx: result.preTransformBaselineYPx,
      preTransformObjectBounds: result.preTransformObjectBounds,
      transformControlBounds: result.transformControlBounds,
      objectBounds: result.objectBounds,
      detachedSidecarLaneFloorQa: result.detachedSidecarLaneFloorQa,
      shadowOwner: result.shadowOwner,
      shadowQa: result.shadowQa,
    } as CylinderFramingRecoveryPassResult["normalization"],
  };
}

async function executeJob(
  page: Page,
  runDirectory: string,
  job: CylinderFramingRecoveryJob,
): Promise<RecoveryJobRecord> {
  const rawPath = path.resolve(runDirectory, job.rawOutputRelativePath);
  const rawBytes = await readFile(rawPath);
  const rawBefore = sha256(rawBytes);
  if (rawBefore !== job.rawOutputSha256) throw new Error(`${job.jobId} raw output changed before recovery.`);

  const passes: CylinderFramingRecoveryPassResult[] = [];
  let inputBytes: Uint8Array = rawBytes;
  let inputSha = rawBefore;
  for (let passNumber = 1 as 1 | 2; passNumber <= 2; passNumber = (passNumber + 1) as 1 | 2) {
    const normalized = await normalizePass(page, inputBytes, job);
    const outputSha = sha256(normalized.bytes);
    const inspection = await inspectOpaquePng(normalized.bytes);
    const pass = validateCylinderFramingRecoveryPass({
      job,
      passNumber,
      inputSha256: inputSha,
      outputSha256: outputSha,
      ...inspection,
      normalization: normalized.normalization,
    });
    await writeImmutable(
      path.resolve(runDirectory, pass.outputRelativePath),
      normalized.bytes,
    );
    passes.push(pass);
    // Stop when geometry passes. A shadow-only failure is retained for explicit
    // human exception review; another recanvas cannot invent a better shadow.
    if (pass.status !== "normalized-rejected") break;
    inputBytes = normalized.bytes;
    inputSha = outputSha;
  }

  const rawAfter = await fileSha256(rawPath);
  if (rawAfter !== rawBefore) throw new Error(`${job.jobId} raw output changed during recovery.`);
  const finalPassStatus = passes.at(-1)?.status ?? "normalized-rejected";
  const accepted = finalPassStatus === "normalized-review-pending";
  const shadowReviewRequired = finalPassStatus === "normalized-shadow-review-required";
  const record: RecoveryJobRecord = {
    workflowVersion: job.workflowVersion,
    jobId: job.jobId,
    canonicalIdentityKey: job.canonicalIdentityKey,
    websiteSku: job.websiteSku,
    graceSku: job.graceSku,
    role: job.role,
    topology: job.topology,
    planSha256: job.planSha256,
    planFileSha256: job.planFileSha256,
    canonicalProductTruthFileSha256: job.canonicalProductTruthFileSha256,
    canonicalProductTruthRecordSha256: job.canonicalProductTruthRecordSha256,
    canonicalGeometrySha256: job.canonicalGeometrySha256,
    sourceSha256: job.sourceSha256,
    referenceSha256: job.referenceSha256,
    promptSha256: job.promptSha256,
    rawOutputRelativePath: job.rawOutputRelativePath,
    rawOutputSha256Before: rawBefore,
    rawOutputSha256After: rawAfter,
    rawOutputPreserved: true,
    passes,
    finalStatus: accepted
      ? "normalized-review-pending"
      : shadowReviewRequired
        ? "normalized-shadow-review-required"
        : "normalized-rejected",
    reviewStatus: accepted
      ? "review-pending"
      : shadowReviewRequired
        ? "shadow-review-required"
        : "framing-rejected",
    promotionStatus: "not-promoted",
    generationCallCount: 0,
    externalWriteCount: 0,
    uploadCount: 0,
  };
  await writeImmutable(
    path.resolve(runDirectory, job.recordRelativePath),
    Buffer.from(`${JSON.stringify(record, null, 2)}\n`),
  );
  return record;
}

async function loadRecoveryPlan(options: ReturnType<typeof parseCylinderFramingRecoveryArgs>): Promise<CylinderFramingRecoveryPlan> {
  const runDirectory = path.resolve(REPO_ROOT, options.runDirectory);
  await access(runDirectory);
  const compilePath = path.join(runDirectory, "compiled-jobs.json");
  const resultsPath = path.join(runDirectory, "results.json");
  const planPath = resolvePlanArtifactPath(runDirectory);
  const [compileArtifact, resultArtifact, sealedPlan, actualPlanFileSha256, actualCanonicalTruthFileSha256] =
    await Promise.all([
      readJson<CompileArtifactWithPlanFileSha>(compilePath),
      readJson<StoredResultArtifact>(resultsPath),
      readJson<CylinderDualRoleRemediationPlan>(planPath),
      fileSha256(planPath),
      fileSha256(CANONICAL_TRUTH_PATH),
    ]);
  const rawOutputSha256ByRelativePath = await collectRawHashes(runDirectory, compileArtifact);
  return buildCylinderFramingRecoveryPlan({
    mode: options.mode,
    runDirectory: path.relative(REPO_ROOT, runDirectory),
    allowlist: options.allowlist,
    count: options.count,
    actualPlanFileSha256,
    actualCanonicalTruthFileSha256,
    compileArtifact,
    resultArtifact: resultArtifact as never,
    sealedPlan,
    rawOutputSha256ByRelativePath,
  });
}

async function main(): Promise<void> {
  const options = parseCylinderFramingRecoveryArgs(process.argv.slice(2));
  const plan = await loadRecoveryPlan(options);
  if (plan.mode === "plan-only") {
    console.log(JSON.stringify(plan, null, 2));
    return;
  }

  let browser: Browser | null = null;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await ensureLocalVite(page);
    const runDirectory = path.resolve(REPO_ROOT, plan.runDirectory);
    const records: RecoveryJobRecord[] = [];
    for (const job of plan.jobs) records.push(await executeJob(page, runDirectory, job));
    console.log(JSON.stringify({
      workflowVersion: plan.workflowVersion,
      planSha256: plan.planSha256,
      selectedJobCount: plan.jobs.length,
      acceptedReviewPendingCount: records.filter((record) => record.finalStatus === "normalized-review-pending").length,
      shadowReviewRequiredCount: records.filter(
        (record) => record.finalStatus === "normalized-shadow-review-required",
      ).length,
      rejectedCount: records.filter((record) => record.finalStatus === "normalized-rejected").length,
      rawOutputsPreservedCount: records.filter((record) => record.rawOutputPreserved).length,
      generationCallCount: 0,
      externalWriteCount: 0,
      uploadCount: 0,
      promotionCount: 0,
    }, null, 2));
  } finally {
    await browser?.close();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
  });
}
