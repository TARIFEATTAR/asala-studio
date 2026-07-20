#!/usr/bin/env tsx
import { createHash } from "node:crypto";
import {
  copyFile,
  mkdir,
  readFile,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { readFileSync } from "node:fs";

import sharp from "sharp";

import { inferBestBottlesBodyMaterial } from "../../src/lib/bestBottlesBodyMaterial";
import {
  buildCylinderReferenceRemediationPlan,
  selectCylinderReferenceRemediationEval,
  verifyCylinderRemediationSourceEvidence,
  type CylinderRecoveryApprovalArtifact,
  type CylinderReferenceRemediationRow,
  type CylinderRemediationGeometryOverridesArtifact,
  type CylinderRemediationReadinessArtifact,
  type CylinderRemediationTaxonomyOverridesArtifact,
} from "../../src/lib/bestBottlesCylinderReferenceRemediation";
import {
  assertCylinderRemediationPlanSeal,
  buildCylinderRemediationEvalProduct,
  buildCylinderRemediationEvalPrompt,
  CYLINDER_REMEDIATION_EVAL_WORKFLOW_VERSION,
} from "../../src/lib/bestBottlesCylinderRemediationEval";
import { parseCsv } from "../../src/lib/bestBottlesGapWorklist";
import { buildBestBottlesPromptPreflight } from "../../src/lib/bestBottlesPromptPreflight";
import { resolveCylinderDisplayScale } from "../../src/lib/bestBottlesCylinderDisplayCurve";
import { loadPromptSystem } from "../generate-prompts";

const OPENAI_MODEL = "gpt-image-2";
const OPENAI_API_BASE = "https://api.openai.com/v1";
const TARGET_CANVAS = { widthPx: 2080, heightPx: 2288 } as const;
const EXECUTE = process.argv.includes("--execute");
const COMPILE_ALL = process.argv.includes("--all");
const countArgumentIndex = process.argv.indexOf("--count");
const COUNT = COMPILE_ALL ? 96 : Number(countArgumentIndex >= 0 ? process.argv[countArgumentIndex + 1] : 8);
const CONCURRENCY = Math.max(1, Number(process.env.BB_REMEDIATION_CONCURRENCY ?? "1"));
const MAX_ATTEMPTS = Math.max(1, Number(process.env.BB_REMEDIATION_ATTEMPTS ?? "2"));

if (EXECUTE && COMPILE_ALL) {
  throw new Error("--all is compile-only. Paid execution is restricted to the sealed eight-item evaluation.");
}
if (!Number.isInteger(COUNT) || COUNT <= 0 || COUNT > (COMPILE_ALL ? 96 : 8)) {
  throw new Error("--count must be an integer from 1 through 8; use --all only for a compile-only 96-row preflight.");
}

const root = process.cwd();
const truthRoot = path.resolve(root, "docs/best-bottles-canonical-truth");
const outputRoot = path.resolve(
  process.env.BB_REMEDIATION_EVAL_OUT?.trim()
    || "tmp/best-bottles-reference-production/cylinder-reference-remediation-eval-v1",
);

function sha256(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, "utf8")) as T;
}

function loadEnvKey(): string {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
  for (const filename of [".env", ".env.local"]) {
    try {
      const value = readFileSync(filename, "utf8");
      for (const line of value.split(/\n/)) {
        const match = line.match(/^OPENAI_API_KEY\s*=\s*(.+?)\s*$/);
        if (match) return match[1].replace(/^['"]|['"]$/g, "");
      }
    } catch {
      // Optional local environment file.
    }
  }
  throw new Error("OPENAI_API_KEY not found in the environment or local env files.");
}

async function validateOpaqueOutput(file: string): Promise<{
  width: number;
  height: number;
  opaque: true;
  sha256: string;
}> {
  const bytes = await readFile(file);
  const image = sharp(bytes, { failOn: "error" });
  const metadata = await image.metadata();
  if (metadata.width !== TARGET_CANVAS.widthPx || metadata.height !== TARGET_CANVAS.heightPx) {
    throw new Error(`Output canvas is ${metadata.width}x${metadata.height}, expected 2080x2288.`);
  }
  if (metadata.hasAlpha) {
    const alpha = await image.ensureAlpha().extractChannel(3).stats();
    if (alpha.channels[0].min !== 255 || alpha.channels[0].max !== 255) {
      throw new Error("Output contains transparent or semi-transparent pixels.");
    }
  }
  return {
    width: metadata.width,
    height: metadata.height,
    opaque: true,
    sha256: sha256(bytes),
  };
}

interface EvalResult {
  websiteSku: string;
  graceSku: string;
  remediationMode: CylinderReferenceRemediationRow["remediationMode"];
  status: "compiled-dry-run" | "rendered-review-pending" | "skipped-existing-review-pending" | "failed";
  sourceReferencePath: string;
  sourceReferenceSha256: string;
  sourcePsdSha256: string;
  promptPath: string;
  promptSha256: string;
  outputPath: string;
  outputSha256?: string;
  outputDimensions?: { widthPx: number; heightPx: number };
  geometryScaleVersion: string;
  assembledTargetPct: number;
  bodyTargetPx: number;
  expectedWidthPx: number;
  reviewStatus: "review-pending";
  attempts?: number;
  elapsedMs?: number;
  warnings: string[];
  error?: string;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]!);
}

async function writeReviewSheet(results: EvalResult[], reviewDir: string): Promise<void> {
  const cards = results.map((result) => {
    const sourceName = `${result.graceSku}__source.png`;
    const outputName = `${result.graceSku}.png`;
    return `<article>
      <h2>${escapeHtml(result.graceSku)}</h2>
      <p>${escapeHtml(result.websiteSku)} · ${escapeHtml(result.remediationMode)} · <strong>${escapeHtml(result.status)}</strong></p>
      <div class="pair"><figure><img src="sources/${encodeURIComponent(sourceName)}"><figcaption>Approved PSD-derived evidence</figcaption></figure><figure><img src="outputs/${encodeURIComponent(outputName)}"><figcaption>Local remediation candidate — REVIEW PENDING</figcaption></figure></div>
      <p>Measured assembled target ${result.assembledTargetPct.toFixed(2)}% · body ${Math.round(result.bodyTargetPx)} px · expected width ${Math.round(result.expectedWidthPx)} px</p>
    </article>`;
  }).join("\n");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Cylinder remediation eval</title><style>
    body{margin:0;background:#111;color:#eee;font:15px/1.45 system-ui;padding:24px}header{max-width:1200px;margin:auto auto 24px}article{max-width:1200px;margin:0 auto 28px;background:#1b1b1b;border:1px solid #444;border-radius:12px;padding:18px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:16px}figure{margin:0;background:#f6efe8;padding:12px;color:#222}img{display:block;width:100%;height:640px;object-fit:contain}figcaption{margin-top:8px;font-weight:700}@media(max-width:800px){.pair{grid-template-columns:1fr}img{height:480px}}
  </style></head><body><header><h1>Best Bottles Cylinder — 8-reference remediation evaluation</h1><p>All outputs are local, review-pending, and unpromoted. No Supabase, reconciliation, Shopify, or publishing writes.</p></header>${cards}</body></html>`;
  await writeFile(path.join(reviewDir, "index.html"), html);
}

const [approval, overrides, readiness, taxonomyOverrides, masterCsv] = await Promise.all([
  readJson<CylinderRecoveryApprovalArtifact>(path.join(truthRoot, "best-bottles-cylinder-recovery-approval.json")),
  readJson<CylinderRemediationGeometryOverridesArtifact>(path.join(truthRoot, "best-bottles-cylinder-remediation-geometry-overrides.json")),
  readJson<CylinderRemediationReadinessArtifact>(path.resolve(root, "public/data/best-bottles-cylinder-production-readiness.json")),
  readJson<CylinderRemediationTaxonomyOverridesArtifact>(path.join(truthRoot, "best-bottles-family-taxonomy-overrides.json")),
  readFile(path.join(truthRoot, "best-bottles-master-truth.csv"), "utf8"),
]);
const plan = buildCylinderReferenceRemediationPlan({ approval, readiness, geometryOverrides: overrides, taxonomyOverrides });
assertCylinderRemediationPlanSeal(plan);
const canonicalMasterRows = parseCsv(masterCsv).records;
const evalRows = COMPILE_ALL
  ? [...plan.rows].sort((left, right) => left.graceSku.localeCompare(right.graceSku))
  : selectCylinderReferenceRemediationEval(plan.rows, 8).slice(0, COUNT);
if (evalRows.length !== COUNT) throw new Error(`Expected ${COUNT} representative eval rows; found ${evalRows.length}.`);

const runDir = path.join(outputRoot, plan.sha256);
const promptsDir = path.join(runDir, "prompts");
const outputsDir = path.join(runDir, "outputs");
const sourcesDir = path.join(runDir, "sources");
const resultsFilename = EXECUTE ? "results.json" : "dry-run-results.json";
const summaryFilename = EXECUTE ? "summary.json" : "dry-run-summary.json";
await Promise.all([mkdir(promptsDir, { recursive: true }), mkdir(outputsDir, { recursive: true }), mkdir(sourcesDir, { recursive: true })]);
const system = loadPromptSystem(root);
const apiKey = EXECUTE ? loadEnvKey() : null;

async function compileAndRender(row: CylinderReferenceRemediationRow): Promise<EvalResult> {
  const product = buildCylinderRemediationEvalProduct(row, canonicalMasterRows);
  await verifyCylinderRemediationSourceEvidence(row);
  const scale = resolveCylinderDisplayScale({
    canvasHeightPx: TARGET_CANVAS.heightPx,
    heightWithCapMm: row.canonicalGeometry.assembledHeightMm,
    heightWithoutCapMm: row.canonicalGeometry.bodyHeightMm!,
    diameterMm: row.canonicalGeometry.widthAxisMm,
  });
  const bodyMaterial = inferBestBottlesBodyMaterial(product);
  const preflight = buildBestBottlesPromptPreflight({
    product,
    referenceImagePath: row.sourceReferencePath,
    bodyMaterial,
    canvas: TARGET_CANVAS,
    system,
  });
  if (preflight.status === "error" || !preflight.record) {
    throw new Error(`${row.graceSku} prompt preflight blocked: ${preflight.issue ?? "missing record"}.`);
  }
  const finalPrompt = buildCylinderRemediationEvalPrompt(preflight.record.final_prompt, row);
  if (!finalPrompt.includes(`approximately ${scale.assembledTargetPct}%`)) {
    throw new Error(`${row.graceSku} compiled prompt does not contain its measured assembled target.`);
  }
  const assembledScaleTags = preflight.record.qa_checklist.filter((tag) =>
    tag.startsWith("scale-assembled-target:"));
  if (
    assembledScaleTags.length !== 1
    || assembledScaleTags[0] !== `scale-assembled-target:${scale.assembledTargetPct}`
    || !preflight.record.qa_checklist.includes(`geometry-scale:${scale.version}`)
  ) {
    throw new Error(`${row.graceSku} QA metadata does not contain exactly one measured Cylinder scale target.`);
  }
  const promptPath = path.join(promptsDir, `${row.graceSku}.prompt.txt`);
  const outputPath = path.join(outputsDir, `${row.graceSku}.png`);
  const sourceCopyPath = path.join(sourcesDir, `${row.graceSku}__source.png`);
  await Promise.all([
    writeFile(promptPath, finalPrompt),
    copyFile(row.sourceReferencePath, sourceCopyPath),
  ]);
  const base: Omit<EvalResult, "status"> = {
    websiteSku: row.websiteSku,
    graceSku: row.graceSku,
    remediationMode: row.remediationMode,
    sourceReferencePath: row.sourceReferencePath,
    sourceReferenceSha256: row.sourceReferenceSha256,
    sourcePsdSha256: row.sourcePsdSha256,
    promptPath,
    promptSha256: sha256(finalPrompt),
    outputPath,
    geometryScaleVersion: scale.version,
    assembledTargetPct: scale.assembledTargetPct,
    bodyTargetPx: scale.bodyTargetPx,
    expectedWidthPx: scale.expectedWidthPx,
    reviewStatus: "review-pending",
    warnings: preflight.warnings,
  };
  if (!EXECUTE) return { ...base, status: "compiled-dry-run" };

  try {
    const existing = await validateOpaqueOutput(outputPath);
    return {
      ...base,
      status: "skipped-existing-review-pending",
      outputSha256: existing.sha256,
      outputDimensions: { widthPx: existing.width, heightPx: existing.height },
    };
  } catch {
    // No valid existing local output; render a new review candidate.
  }

  const referenceBytes = await readFile(row.sourceReferencePath);
  let lastError = "";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const startedAt = Date.now();
    const partialPath = `${outputPath}.partial`;
    try {
      const form = new FormData();
      form.append("model", OPENAI_MODEL);
      form.append("prompt", finalPrompt);
      form.append("size", "2080x2288");
      form.append("quality", "high");
      form.append("background", "opaque");
      form.append("image[]", new Blob([referenceBytes], { type: "image/png" }), path.basename(row.sourceReferencePath));
      const response = await fetch(`${OPENAI_API_BASE}/images/edits`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
      });
      if (!response.ok) {
        lastError = `HTTP ${response.status}: ${(await response.text()).slice(0, 500)}`;
        continue;
      }
      const payload = await response.json() as { data?: Array<{ b64_json?: string }> };
      const encoded = payload.data?.[0]?.b64_json;
      if (!encoded) {
        lastError = "OpenAI response did not contain b64_json image data.";
        continue;
      }
      await writeFile(partialPath, Buffer.from(encoded, "base64"));
      const validation = await validateOpaqueOutput(partialPath);
      await rename(partialPath, outputPath);
      return {
        ...base,
        status: "rendered-review-pending",
        outputSha256: validation.sha256,
        outputDimensions: { widthPx: validation.width, heightPx: validation.height },
        attempts: attempt,
        elapsedMs: Date.now() - startedAt,
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      await unlink(partialPath).catch(() => undefined);
    }
  }
  return { ...base, status: "failed", attempts: MAX_ATTEMPTS, error: lastError };
}

const queue = [...evalRows];
const results: EvalResult[] = [];
async function worker(): Promise<void> {
  for (;;) {
    const row = queue.shift();
    if (!row) return;
    console.error(`→ ${row.graceSku} ${EXECUTE ? "rendering" : "compiling"}`);
    try {
      results.push(await compileAndRender(row));
    } catch (error) {
      results.push({
        websiteSku: row.websiteSku,
        graceSku: row.graceSku,
        remediationMode: row.remediationMode,
        status: "failed",
        sourceReferencePath: row.sourceReferencePath,
        sourceReferenceSha256: row.sourceReferenceSha256,
        sourcePsdSha256: row.sourcePsdSha256,
        promptPath: path.join(promptsDir, `${row.graceSku}.prompt.txt`),
        promptSha256: "",
        outputPath: path.join(outputsDir, `${row.graceSku}.png`),
        geometryScaleVersion: "",
        assembledTargetPct: 0,
        bodyTargetPx: 0,
        expectedWidthPx: 0,
        reviewStatus: "review-pending",
        warnings: [],
        error: error instanceof Error ? error.message : String(error),
      });
    }
    results.sort((left, right) => left.graceSku.localeCompare(right.graceSku));
    await writeFile(path.join(runDir, resultsFilename), `${JSON.stringify({
      workflowVersion: CYLINDER_REMEDIATION_EVAL_WORKFLOW_VERSION,
      planSha256: plan.sha256,
      mode: EXECUTE ? "execute-local-only" : "compile-dry-run",
      noExternalPersistence: true,
      results,
    }, null, 2)}\n`);
  }
}
await Promise.all(Array.from({ length: Math.min(CONCURRENCY, COUNT) }, () => worker()));
await writeReviewSheet(results.filter((result) => result.status !== "compiled-dry-run"), runDir);

const summary = {
  workflowVersion: CYLINDER_REMEDIATION_EVAL_WORKFLOW_VERSION,
  planSha256: plan.sha256,
  mode: EXECUTE ? "execute-local-only" : "compile-dry-run",
  outputRoot: runDir,
  requested: COUNT,
  rendered: results.filter((result) => result.status === "rendered-review-pending").length,
  skippedExisting: results.filter((result) => result.status === "skipped-existing-review-pending").length,
  compiled: results.filter((result) => result.status === "compiled-dry-run").length,
  failed: results.filter((result) => result.status === "failed").length,
  reviewSheet: path.join(runDir, "index.html"),
  externalWrites: { openAiGenerationCalls: EXECUTE, supabase: false, reconciliation: false, shopify: false },
};
await writeFile(path.join(runDir, summaryFilename), `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify(summary, null, 2));
if (summary.failed > 0) process.exitCode = 1;
