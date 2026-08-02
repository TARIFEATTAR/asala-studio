#!/usr/bin/env tsx
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import {
  mkdir,
  readFile,
  rename,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import type {
  CylinderSixRoleMaterialProduct,
  CylinderSixRoleMaterialPilotManifest,
} from "./cylinder-six-role-material-pilot";

const DEFAULT_MANIFEST =
  "tmp/best-bottles-reference-production/cylinder-six-role-pilot-v1/a256a5a4395f8116a3b35f7fba584d2f4b8b82706da85acce05d7b0d06bfe675/cylinder-six-role-material-pilot.json";
const DEFAULT_RUNS_ROOT =
  "tmp/best-bottles-reference-production/cylinder-six-role-material-pilot-v1/runs";
const OPENAI_ENDPOINT = "https://api.openai.com/v1/images/edits";
const OPENAI_MODEL = "gpt-image-2";
const BONE = { r: 245, g: 243, b: 239 } as const;

export interface LocalCylinderSixRolePilotAttempt
  extends CylinderSixRoleMaterialProduct {
  jobKey: string;
  rendererId: "openai-gpt-image-2";
  attemptOrdinal: 1;
}

export interface LocalCylinderSixRolePilotManifest {
  version: "cylinder-six-role-material-pilot-v1";
  sha256: string;
  canonicalMaster: {
    path: string;
    sha256: string;
  };
  authorization: {
    scope: string;
    paidGeneration: string;
    remoteWrites: string;
    publishing: string;
  };
  attempts: LocalCylinderSixRolePilotAttempt[];
}

export interface CylinderSixRolePilotRunnerArgs {
  command: "preflight" | "execute";
  manifestPath: string;
  runsRoot: string;
  role: "cap-on" | "sidecar" | null;
  capacities: number[];
  websiteSku: string | null;
  limit: number | null;
  authorizePaidPilot: boolean;
}

interface NativeBoneQa {
  status: "pass" | "fail";
  png: boolean;
  widthPx: number;
  heightPx: number;
  opaque: boolean;
  cornerMeanRgb: Array<{ r: number; g: number; b: number }>;
  maxCornerBoneDelta: number;
  failureReasons: string[];
}

interface LocalAttemptTelemetry {
  schemaVersion: "best-bottles-local-material-attempt-v1";
  runId: string;
  jobKey: string;
  websiteSku: string;
  graceSku: string | null;
  capacityMl: number;
  assetRole: "cap-on" | "sidecar";
  productionStatus: "ready" | "blocked";
  productionBlockers: string[];
  status: "running" | "succeeded" | "failed";
  renderer: {
    provider: "openai";
    model: "gpt-image-2";
    endpoint: "images/edits";
    size: "2080x2288";
    quality: "high";
    background: "opaque";
    outputFormat: "png";
  };
  canonicalMaster: LocalCylinderSixRolePilotManifest["canonicalMaster"];
  canonicalTruthHash: string;
  promptVersion: string;
  promptHash: string;
  scaleContract: LocalCylinderSixRolePilotAttempt["scaleContract"];
  references: Array<{
    order: number;
    kind: string;
    role: string;
    locator: string;
    sha256: string;
    verifiedSha256: string | null;
  }>;
  generationMask: null | {
    locator: string;
    sha256: string;
    verifiedSha256: string | null;
    semantics: "transparent-body-material-edit-opaque-hardware-sidecar-bone-preserve";
    appliedToReferenceOrder: 1;
  };
  authorization: {
    source: "explicit-cli-flag";
    controlledVisualTestOnly: true;
    remoteWrites: false;
    publishing: false;
  };
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  output: null | {
    path: string;
    sha256: string;
    mimeType: string;
    revisedPrompt: string | null;
  };
  nativeBoneQa: NativeBoneQa | null;
  geometryQa: {
    status: "measurement-required";
    bodyTargetPx: number;
    bodyTargetRangePx: { min: number; max: number };
    bodyWidthTargetPx: number;
    bodyWidthTargetRangePx: { min: number; max: number };
    baselineYPx: number;
  };
  semanticQa: {
    status: "pending-human-review";
    expectedRole: "cap-on" | "sidecar";
  };
  cost: {
    currency: "USD";
    estimatedUsd: number | null;
    source: "environment-price-card" | "unpriced";
  };
  providerUsage: unknown;
  failure: null | {
    stage: "reference-preflight" | "provider" | "output-validation";
    message: string;
  };
}

function sha256(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function valueAfter(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

export function parseCylinderSixRolePilotRunnerArgs(
  argv: string[],
): CylinderSixRolePilotRunnerArgs {
  const command = argv[0] === "execute" ? "execute" : "preflight";
  const roleValue = valueAfter(argv, "--role");
  if (roleValue && roleValue !== "cap-on" && roleValue !== "sidecar") {
    throw new Error("--role must be 'cap-on' or 'sidecar'.");
  }
  const capacityValue = valueAfter(argv, "--capacity");
  const capacities = capacityValue
    ? capacityValue.split(",").map((value) => Number(value.trim()))
    : [];
  if (capacities.some((value) => !Number.isFinite(value) || value <= 0)) {
    throw new Error("--capacity must contain positive comma-separated numbers.");
  }
  const limitValue = valueAfter(argv, "--limit");
  const limit = limitValue == null ? null : Number(limitValue);
  if (limit != null && (!Number.isInteger(limit) || limit <= 0)) {
    throw new Error("--limit must be a positive integer.");
  }
  return {
    command,
    manifestPath: valueAfter(argv, "--manifest") ?? DEFAULT_MANIFEST,
    runsRoot: valueAfter(argv, "--runs-root") ?? DEFAULT_RUNS_ROOT,
    role: roleValue ?? null,
    capacities,
    websiteSku: valueAfter(argv, "--website-sku") ?? null,
    limit,
    authorizePaidPilot: argv.includes("--authorize-paid-pilot"),
  };
}

export function selectCylinderSixRolePilotAttempts(
  manifest: LocalCylinderSixRolePilotManifest,
  args: CylinderSixRolePilotRunnerArgs,
): LocalCylinderSixRolePilotAttempt[] {
  const selected = manifest.attempts.filter((attempt) =>
    (!args.role || attempt.assetRole === args.role)
    && (args.capacities.length === 0 || args.capacities.includes(attempt.capacityMl))
    && (!args.websiteSku || attempt.websiteSku === args.websiteSku)
  );
  return args.limit == null ? selected : selected.slice(0, args.limit);
}

export function assertPaidPilotAuthorized(
  args: CylinderSixRolePilotRunnerArgs,
  manifest: LocalCylinderSixRolePilotManifest,
): void {
  if (args.command !== "execute") return;
  if (!args.authorizePaidPilot) {
    throw new Error(
      "Paid GPT Image 2 execution requires the explicit --authorize-paid-pilot flag.",
    );
  }
  if (manifest.authorization.remoteWrites !== "forbidden") {
    throw new Error("This local pilot requires remote writes to remain forbidden.");
  }
  if (manifest.authorization.publishing !== "forbidden") {
    throw new Error("This local pilot requires publishing to remain forbidden.");
  }
}

async function atomicWriteJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.tmp-${process.pid}`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`);
  await rename(temporary, filePath);
}

function safeFilename(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]+/g, "_");
}

function loadOpenAiKey(): string {
  if (process.env.OPENAI_API_KEY?.trim()) return process.env.OPENAI_API_KEY.trim();
  for (const envFile of [".env", ".env.local"]) {
    if (!existsSync(envFile)) continue;
    const text = readFileSync(envFile, "utf8");
    const match = text.match(/^OPENAI_API_KEY\s*=\s*(.+?)\s*$/m);
    if (match) return match[1].replace(/^['"]|['"]$/g, "");
  }
  throw new Error("OPENAI_API_KEY is required for paid pilot execution.");
}

async function loadAndVerifyReference(reference: {
  locator: string;
  sha256: string;
}): Promise<{ bytes: Uint8Array; mimeType: string; verifiedSha256: string }> {
  let bytes: Uint8Array;
  let mimeType = "image/png";
  if (/^https:\/\//i.test(reference.locator)) {
    const response = await fetch(reference.locator);
    if (!response.ok) {
      throw new Error(`Reference fetch failed ${response.status}: ${reference.locator}`);
    }
    bytes = new Uint8Array(await response.arrayBuffer());
    mimeType = response.headers.get("content-type")?.split(";")[0] || mimeType;
  } else {
    bytes = new Uint8Array(await readFile(reference.locator));
    const extension = path.extname(reference.locator).toLowerCase();
    if (extension === ".jpg" || extension === ".jpeg") mimeType = "image/jpeg";
    if (extension === ".gif") mimeType = "image/gif";
  }
  const verifiedSha256 = sha256(bytes);
  if (verifiedSha256 !== reference.sha256.toLowerCase()) {
    throw new Error(
      `Reference SHA mismatch for ${reference.locator}: expected ${reference.sha256}, received ${verifiedSha256}.`,
    );
  }
  return { bytes, mimeType, verifiedSha256 };
}

async function analyzeNativeBonePng(bytes: Uint8Array): Promise<NativeBoneQa> {
  const image = sharp(bytes, { failOn: "error" });
  const metadata = await image.metadata();
  const png = metadata.format === "png";
  const widthPx = metadata.width ?? 0;
  const heightPx = metadata.height ?? 0;
  let opaque = true;
  if (metadata.hasAlpha) {
    const alpha = await image.ensureAlpha().extractChannel(3).stats();
    opaque = alpha.channels[0].min === 255 && alpha.channels[0].max === 255;
  }
  const cornerSize = 48;
  const corners = [
    { left: 0, top: 0 },
    { left: Math.max(0, widthPx - cornerSize), top: 0 },
    { left: 0, top: Math.max(0, heightPx - cornerSize) },
    {
      left: Math.max(0, widthPx - cornerSize),
      top: Math.max(0, heightPx - cornerSize),
    },
  ];
  const cornerMeanRgb = [];
  for (const corner of corners) {
    const stats = await image.clone().extract({
      ...corner,
      width: Math.min(cornerSize, widthPx),
      height: Math.min(cornerSize, heightPx),
    }).removeAlpha().stats();
    cornerMeanRgb.push({
      r: stats.channels[0].mean,
      g: stats.channels[1].mean,
      b: stats.channels[2].mean,
    });
  }
  const maxCornerBoneDelta = Math.max(...cornerMeanRgb.flatMap((mean) => [
    Math.abs(mean.r - BONE.r),
    Math.abs(mean.g - BONE.g),
    Math.abs(mean.b - BONE.b),
  ]));
  const failureReasons = [];
  if (!png) failureReasons.push(`format:${metadata.format ?? "unknown"}`);
  if (widthPx !== 2080 || heightPx !== 2288) {
    failureReasons.push(`dimensions:${widthPx}x${heightPx}`);
  }
  if (!opaque) failureReasons.push("non-opaque-alpha");
  if (maxCornerBoneDelta > 18) {
    failureReasons.push(`bone-corner-delta:${maxCornerBoneDelta.toFixed(2)}`);
  }
  return {
    status: failureReasons.length === 0 ? "pass" : "fail",
    png,
    widthPx,
    heightPx,
    opaque,
    cornerMeanRgb,
    maxCornerBoneDelta,
    failureReasons,
  };
}

function costRecord(): LocalAttemptTelemetry["cost"] {
  const raw = process.env.PILOT_OPENAI_ESTIMATED_COST_USD_PER_ATTEMPT?.trim();
  const value = raw ? Number(raw) : Number.NaN;
  return Number.isFinite(value) && value >= 0
    ? { currency: "USD", estimatedUsd: value, source: "environment-price-card" }
    : { currency: "USD", estimatedUsd: null, source: "unpriced" };
}

async function executeAttempt(input: {
  runId: string;
  runDir: string;
  manifest: LocalCylinderSixRolePilotManifest;
  attempt: LocalCylinderSixRolePilotAttempt;
  apiKey: string;
}): Promise<LocalAttemptTelemetry> {
  const { runId, runDir, manifest, attempt, apiKey } = input;
  const startedAtMs = Date.now();
  const startedAt = new Date(startedAtMs).toISOString();
  const attemptName = `${String(attempt.capacityMl).padStart(3, "0")}ml__${safeFilename(attempt.websiteSku)}__${attempt.assetRole}`;
  const telemetryPath = path.join(runDir, "attempts", `${attemptName}.json`);
  const outputPath = path.join(runDir, "outputs", `${attemptName}.png`);
  const telemetry: LocalAttemptTelemetry = {
    schemaVersion: "best-bottles-local-material-attempt-v1",
    runId,
    jobKey: attempt.jobKey,
    websiteSku: attempt.websiteSku,
    graceSku: attempt.graceSku,
    capacityMl: attempt.capacityMl,
    assetRole: attempt.assetRole,
    productionStatus: attempt.productionStatus,
    productionBlockers: attempt.productionBlockers,
    status: "running",
    renderer: {
      provider: "openai",
      model: OPENAI_MODEL,
      endpoint: "images/edits",
      size: "2080x2288",
      quality: "high",
      background: "opaque",
      outputFormat: "png",
    },
    canonicalMaster: manifest.canonicalMaster,
    canonicalTruthHash: attempt.canonicalTruthHash,
    promptVersion: attempt.promptVersion,
    promptHash: attempt.promptHash,
    scaleContract: attempt.scaleContract,
    references: attempt.references.map((reference, index) => ({
      order: index + 1,
      kind: reference.kind,
      role: reference.role,
      locator: reference.locator,
      sha256: reference.sha256,
      verifiedSha256: null,
    })),
    generationMask: attempt.references[0]?.conditioning
      ? {
        locator: attempt.references[0].conditioning.maskLocator,
        sha256: attempt.references[0].conditioning.maskSha256,
        verifiedSha256: null,
        semantics: attempt.references[0].conditioning.maskSemantics,
        appliedToReferenceOrder: 1,
      }
      : null,
    authorization: {
      source: "explicit-cli-flag",
      controlledVisualTestOnly: true,
      remoteWrites: false,
      publishing: false,
    },
    startedAt,
    completedAt: null,
    durationMs: null,
    output: null,
    nativeBoneQa: null,
    geometryQa: {
      status: "measurement-required",
      bodyTargetPx: attempt.scaleContract.bodyTargetPx,
      bodyTargetRangePx: attempt.scaleContract.bodyTargetRangePx,
      bodyWidthTargetPx: attempt.scaleContract.bodyWidthTargetPx,
      bodyWidthTargetRangePx: attempt.scaleContract.bodyWidthTargetRangePx,
      baselineYPx: attempt.scaleContract.baselineYPx,
    },
    semanticQa: {
      status: "pending-human-review",
      expectedRole: attempt.assetRole,
    },
    cost: costRecord(),
    providerUsage: null,
    failure: null,
  };
  await atomicWriteJson(telemetryPath, telemetry);

  let failureStage: LocalAttemptTelemetry["failure"] extends infer T
    ? T extends { stage: infer S } ? S : never
    : never = "reference-preflight";
  try {
    const prepared = [];
    for (let index = 0; index < attempt.references.length; index += 1) {
      const reference = attempt.references[index];
      const verified = await loadAndVerifyReference(reference);
      telemetry.references[index].verifiedSha256 = verified.verifiedSha256;
      prepared.push({ ...verified, role: reference.role });
    }
    const preparedMask = telemetry.generationMask
      ? await loadAndVerifyReference(telemetry.generationMask)
      : null;
    if (preparedMask && telemetry.generationMask) {
      telemetry.generationMask.verifiedSha256 = preparedMask.verifiedSha256;
    }
    await atomicWriteJson(telemetryPath, telemetry);

    failureStage = "provider";
    const form = new FormData();
    form.append("model", OPENAI_MODEL);
    form.append("prompt", attempt.prompt);
    form.append("size", "2080x2288");
    form.append("quality", "high");
    form.append("background", "opaque");
    form.append("output_format", "png");
    for (let index = 0; index < prepared.length; index += 1) {
      const reference = prepared[index];
      const extension = reference.mimeType.includes("jpeg") ? "jpg" : "png";
      form.append(
        "image[]",
        new Blob([reference.bytes], { type: reference.mimeType }),
        `${String(index + 1).padStart(2, "0")}-${safeFilename(reference.role)}.${extension}`,
      );
    }
    if (preparedMask) {
      form.append(
        "mask",
        new Blob([preparedMask.bytes], { type: "image/png" }),
        "geometry-cage-mask.png",
      );
    }
    const response = await fetch(OPENAI_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
    if (!response.ok) {
      throw new Error(`OpenAI ${response.status}: ${(await response.text()).slice(0, 800)}`);
    }
    const payload = await response.json() as {
      data?: Array<{ b64_json?: string; url?: string; revised_prompt?: string }>;
      usage?: unknown;
    };
    const first = payload.data?.[0];
    let outputBytes: Uint8Array;
    if (first?.b64_json) {
      outputBytes = new Uint8Array(Buffer.from(first.b64_json, "base64"));
    } else if (first?.url) {
      const download = await fetch(first.url);
      if (!download.ok) throw new Error(`Output download failed ${download.status}.`);
      outputBytes = new Uint8Array(await download.arrayBuffer());
    } else {
      throw new Error("OpenAI response contained no image payload.");
    }

    failureStage = "output-validation";
    const nativeBoneQa = await analyzeNativeBonePng(outputBytes);
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, outputBytes);
    telemetry.output = {
      path: outputPath,
      sha256: sha256(outputBytes),
      mimeType: "image/png",
      revisedPrompt: first?.revised_prompt ?? null,
    };
    telemetry.nativeBoneQa = nativeBoneQa;
    telemetry.providerUsage = payload.usage ?? null;
    telemetry.status = nativeBoneQa.status === "pass" ? "succeeded" : "failed";
    if (nativeBoneQa.status === "fail") {
      telemetry.failure = {
        stage: "output-validation",
        message: nativeBoneQa.failureReasons.join("; "),
      };
    }
  } catch (error) {
    telemetry.status = "failed";
    telemetry.failure = {
      stage: failureStage,
      message: error instanceof Error ? error.message : String(error),
    };
  }
  telemetry.completedAt = new Date().toISOString();
  telemetry.durationMs = Date.now() - startedAtMs;
  await atomicWriteJson(telemetryPath, telemetry);
  return telemetry;
}

async function main(): Promise<void> {
  const args = parseCylinderSixRolePilotRunnerArgs(process.argv.slice(2));
  const manifest = JSON.parse(
    await readFile(args.manifestPath, "utf8"),
  ) as CylinderSixRoleMaterialPilotManifest & LocalCylinderSixRolePilotManifest;
  assertPaidPilotAuthorized(args, manifest);
  const selected = selectCylinderSixRolePilotAttempts(manifest, args);
  if (selected.length === 0) throw new Error("No attempts matched the requested filters.");

  const manifestBytes = await readFile(args.manifestPath);
  const manifestFileSha256 = sha256(manifestBytes);
  if (args.command === "preflight") {
    console.log(JSON.stringify({
      command: "preflight",
      manifestPath: args.manifestPath,
      manifestFileSha256,
      manifestSemanticSha256: manifest.sha256,
      canonicalMaster: manifest.canonicalMaster,
      selected: selected.map((attempt) => ({
        jobKey: attempt.jobKey,
        capacityMl: attempt.capacityMl,
        role: attempt.assetRole,
        productionStatus: attempt.productionStatus,
        productionBlockers: attempt.productionBlockers,
        bodyTargetPx: attempt.scaleContract.bodyTargetPx,
        bodyWidthTargetPx: attempt.scaleContract.bodyWidthTargetPx,
        baselineYPx: attempt.scaleContract.baselineYPx,
        referenceOrder: attempt.references.map((reference) => reference.role),
        generationMask: attempt.references[0]?.conditioning
          ? {
            locator: attempt.references[0].conditioning.maskLocator,
            sha256: attempt.references[0].conditioning.maskSha256,
            semantics: attempt.references[0].conditioning.maskSemantics,
            appliedToReferenceOrder: 1,
          }
          : null,
      })),
      remoteWrites: false,
      publishing: false,
    }, null, 2));
    return;
  }

  const runId = `${new Date().toISOString().replace(/[:.]/g, "-")}__${manifest.sha256.slice(0, 12)}`;
  const runDir = path.join(args.runsRoot, runId);
  await mkdir(runDir, { recursive: true });
  await writeFile(path.join(runDir, "source-manifest.json"), manifestBytes);
  await atomicWriteJson(path.join(runDir, "run.json"), {
    schemaVersion: "best-bottles-local-material-run-v1",
    runId,
    status: "running",
    manifestPath: args.manifestPath,
    manifestFileSha256,
    manifestSemanticSha256: manifest.sha256,
    canonicalMaster: manifest.canonicalMaster,
    selectedJobKeys: selected.map((attempt) => attempt.jobKey),
    authorization: {
      source: "explicit-cli-flag",
      controlledVisualTestOnly: true,
      remoteWrites: false,
      publishing: false,
    },
    startedAt: new Date().toISOString(),
  });

  const apiKey = loadOpenAiKey();
  const results: LocalAttemptTelemetry[] = [];
  for (const attempt of selected) {
    console.error(`→ ${attempt.capacityMl} mL ${attempt.assetRole}: ${attempt.websiteSku}`);
    const result = await executeAttempt({ runId, runDir, manifest, attempt, apiKey });
    results.push(result);
    console.error(`${result.status === "succeeded" ? "✓" : "✗"} ${attempt.jobKey} (${result.durationMs ?? 0} ms)`);
  }
  const succeeded = results.filter((result) => result.status === "succeeded").length;
  const summary = {
    schemaVersion: "best-bottles-local-material-run-v1",
    runId,
    status: succeeded === results.length ? "completed" : "completed-with-failures",
    runDir,
    manifestPath: args.manifestPath,
    manifestFileSha256,
    manifestSemanticSha256: manifest.sha256,
    canonicalMaster: manifest.canonicalMaster,
    attempted: results.length,
    succeeded,
    failed: results.length - succeeded,
    measurementRequired: results.filter((result) => result.status === "succeeded").length,
    humanSemanticReviewRequired: results.filter((result) => result.status === "succeeded").length,
    estimatedCostUsd: results.some((result) => result.cost.estimatedUsd == null)
      ? null
      : results.reduce((sum, result) => sum + (result.cost.estimatedUsd ?? 0), 0),
    outputPaths: results.flatMap((result) => result.output ? [result.output.path] : []),
    productionBlockedAttempts: results.filter((result) => result.productionStatus === "blocked")
      .map((result) => ({
        jobKey: result.jobKey,
        blockers: result.productionBlockers,
      })),
    remoteWrites: false,
    publishing: false,
    completedAt: new Date().toISOString(),
  };
  await atomicWriteJson(path.join(runDir, "run.json"), summary);
  console.log(JSON.stringify(summary, null, 2));
}

const isMain = process.argv[1]
  && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
