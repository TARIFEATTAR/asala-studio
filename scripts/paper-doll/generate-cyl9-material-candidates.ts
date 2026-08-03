import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import sharp from "sharp";

import { loadCyl9ComponentFactory } from "../../src/lib/paperDoll/cyl9ComponentFactory";
import { normalizeMaterialIntoAuthority } from "../../src/lib/paperDoll/componentPlateImage.node";
import { buildComponentCandidate } from "./build-component-candidate";
import {
  buildCyl9ComponentBatch,
  type Cyl9ComponentBatchJob,
} from "./build-cyl9-component-batch";

const CONFIRMATION = "CYL9-GPT-MATERIALS";
const DEFAULT_OUTPUT = "outputs/paper-doll-component-factory/CYL-9ML/generated";
const OPENAI_ENDPOINT = "https://api.openai.com/v1/images/edits";
const MODEL = "gpt-image-2";

type Mode = "plan" | "execute";

export interface Cyl9GenerationConditioning {
  conditioningPng: Buffer;
  editMaskPng: Buffer;
  sourceReferencePng: Buffer;
  authorityMaskPng: Buffer;
}

export interface MaterialGenerationInput extends Cyl9GenerationConditioning {
  job: Cyl9ComponentBatchJob;
  prompt: string;
}

export interface MaterialGenerationOutput {
  png: Buffer;
  usage: unknown;
  revisedPrompt: string | null;
}

export interface MaterialGenerationProvider {
  generate(input: MaterialGenerationInput): Promise<MaterialGenerationOutput>;
}

interface GeneratedArtifact {
  requestId: string;
  componentKey: string;
  variantKey: string;
  candidateId: string;
  lifecycleState: "candidate";
  geometryLocked: boolean;
  mismatchedPixels: number;
  materialClass: string;
  decorationState: "not-applicable" | "registered-layout-review-required";
  materialFillQa: AuthorityMaterialFillQa;
  paths: {
    rawPath: string;
    candidatePath: string;
    layerPath: string;
    reviewPath: string;
    manifestPath: string;
    conditioningPath: string;
    editMaskPath: string;
    attemptTelemetryPath: string;
  };
}

export interface AuthorityMaterialFillQa {
  status: "pass" | "fail" | "review-required";
  boneDeltaTolerance: 3;
  referenceBoneLikeRatio: number;
  outputBoneLikeRatio: number;
  referenceLargestBoneLikeRegionRatio: number;
  largestBoneLikeRegionRatio: number;
  calibratedMaxLargestRegionRatio: number;
  authorityPixels: number;
}

interface FailedArtifact {
  requestId: string;
  componentKey: string;
  variantKey: string;
  message: string;
  attemptTelemetryPath: string;
}

export interface Cyl9MaterialGenerationPlan {
  mode: Mode;
  jobs: Cyl9ComponentBatchJob[];
  estimatedCostUsd: number;
  mutationPolicy: {
    approvalsWritten: false;
    placementsWritten: false;
    currentReleaseChanged: false;
    sanityChanged: false;
  };
}

export interface Cyl9MaterialGenerationResult extends Cyl9MaterialGenerationPlan {
  generatedCandidates: number;
  resumedCandidates: number;
  failedCandidates: number;
  artifacts: GeneratedArtifact[];
  failures: FailedArtifact[];
  indexPath: string | null;
}

export interface GenerateCyl9MaterialOptions {
  mode: Mode;
  confirmation?: string;
  authorizePaidGeneration?: boolean;
  outputDirectory?: string;
  limit?: number;
  concurrency?: number;
  variantKeys?: string[];
}

const MUTATION_POLICY = {
  approvalsWritten: false,
  placementsWritten: false,
  currentReleaseChanged: false,
  sanityChanged: false,
} as const;

function sha256(value: Buffer | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function safeFilename(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]+/g, "_");
}

async function atomicWriteJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.tmp-${process.pid}-${randomUUID()}`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, filePath);
}

function loadOpenAiKey(): string {
  if (process.env.OPENAI_API_KEY?.trim()) return process.env.OPENAI_API_KEY.trim();
  for (const envFile of [".env", ".env.local"]) {
    if (!existsSync(envFile)) continue;
    const text = readFileSync(envFile, "utf8");
    const match = text.match(/^OPENAI_API_KEY\s*=\s*(.+?)\s*$/m);
    if (match) return match[1].replace(/^[\"']|[\"']$/g, "");
  }
  throw new Error("OPENAI_API_KEY is required for paid CYL-9ML material generation.");
}

function providerPrompt(job: Cyl9ComponentBatchJob): string {
  const decoration = job.rhinestoneLayout
    ? [
      "DECORATION REGISTRATION:",
      "The eight rhinestones visible in Image 1 are registered detail, not freeform decoration.",
      "Do not add or remove stones. Final stone placement will be checked against the registered deterministic layout before approval.",
    ].join("\n")
    : "";
  return [
    job.prompt,
    "",
    "MASK-AND-CLAMP CONTRACT:",
    "Image 1 is the exact canonical conditioning plate on the 2080 x 2288 Best Bottles canvas.",
    "Image 1 already contains the material and lighting evidence from the registered source reference.",
    "The supplied edit mask is the only editable region. Do not move, resize, crop, rotate, or reinterpret the component.",
    "The complete editable silhouette is one continuous manufactured component. Fill every editable pixel with believable component material.",
    "Do not leave a Bone-colored patch, white rectangle, uncoated void, missing top, missing edge, or background-colored hole anywhere inside the editable silhouette.",
    "Keep the Bone environment outside the editable silhouette unchanged.",
    "The result will be clamped to the registered authority alpha after generation.",
    decoration,
  ].filter(Boolean).join("\n");
}

export async function planCyl9MaterialGeneration(): Promise<Cyl9MaterialGenerationPlan> {
  const batch = await buildCyl9ComponentBatch({ mode: "plan" });
  const jobs = batch.jobs.filter(({ provider }) => provider === "openai");
  return {
    mode: "plan",
    jobs,
    estimatedCostUsd: Number(
      jobs.reduce((sum, job) => sum + (job.estimatedCostUsd ?? 0), 0).toFixed(2),
    ),
    mutationPolicy: MUTATION_POLICY,
  };
}

export async function buildCyl9GenerationConditioning(
  job: Cyl9ComponentBatchJob,
): Promise<Cyl9GenerationConditioning> {
  const [sourceReferencePng, authorityMaskPng] = await Promise.all([
    readFile(job.sourceReferencePath),
    readFile(job.authorityMaskPath),
  ]);
  const normalized = await normalizeMaterialIntoAuthority({
    materialPng: sourceReferencePng,
    sourceBoundsPx: job.sourceBoundsPx,
    authorityMaskPng,
  });
  const authority = await sharp(authorityMaskPng)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const conditioningPng = await sharp({
    create: {
      width: authority.info.width,
      height: authority.info.height,
      channels: 4,
      background: "#F5F3EF",
    },
  }).composite([{ input: normalized.png, left: 0, top: 0 }]).png().toBuffer();
  const editMaskRgba = Buffer.alloc(authority.info.width * authority.info.height * 4);
  for (let index = 0; index < authority.info.width * authority.info.height; index++) {
    editMaskRgba[index * 4] = 255;
    editMaskRgba[index * 4 + 1] = 255;
    editMaskRgba[index * 4 + 2] = 255;
    editMaskRgba[index * 4 + 3] = 255 - authority.data[index * 4 + 3];
  }
  const editMaskPng = await sharp(editMaskRgba, {
    raw: { width: authority.info.width, height: authority.info.height, channels: 4 },
  }).png().toBuffer();
  return { conditioningPng, editMaskPng, sourceReferencePng, authorityMaskPng };
}

export async function measureAuthorityMaterialFill(input: {
  outputPng: Buffer;
  conditioningPng: Buffer;
  authorityMaskPng: Buffer;
  materialClass?: string;
}): Promise<AuthorityMaterialFillQa> {
  const [output, conditioning, authority] = await Promise.all([
    sharp(input.outputPng).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(input.conditioningPng).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(input.authorityMaskPng).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
  ]);
  const dimensions = [output.info, conditioning.info, authority.info]
    .map(({ width, height }) => `${width}x${height}`);
  if (new Set(dimensions).size !== 1) {
    throw new Error(`Material-fill inputs must share dimensions; received ${dimensions.join(", ")}.`);
  }
  const boneLike = (data: Buffer, index: number) => {
    const offset = index * 4;
    return Math.max(
      Math.abs(data[offset] - 245),
      Math.abs(data[offset + 1] - 243),
      Math.abs(data[offset + 2] - 239),
    ) <= 3;
  };
  let authorityPixels = 0;
  let referenceBoneLike = 0;
  let outputBoneLike = 0;
  const referenceBoneOccupancy = new Uint8Array(authority.info.width * authority.info.height);
  const boneOccupancy = new Uint8Array(authority.info.width * authority.info.height);
  for (let index = 0; index < authority.info.width * authority.info.height; index++) {
    if (authority.data[index * 4 + 3] === 0) continue;
    authorityPixels++;
    if (boneLike(conditioning.data, index)) {
      referenceBoneLike++;
      referenceBoneOccupancy[index] = 1;
    }
    if (boneLike(output.data, index)) {
      outputBoneLike++;
      boneOccupancy[index] = 1;
    }
  }
  if (authorityPixels === 0) throw new Error("Material-fill QA received an empty authority mask.");
  const referenceBoneLikeRatio = referenceBoneLike / authorityPixels;
  const outputBoneLikeRatio = outputBoneLike / authorityPixels;
  const largestRegion = (occupancy: Uint8Array) => {
    const visited = new Uint8Array(occupancy.length);
    const queue = new Int32Array(occupancy.length);
    let largest = 0;
    for (let start = 0; start < occupancy.length; start++) {
      if (!occupancy[start] || visited[start]) continue;
      let head = 0;
      let tail = 0;
      let regionSize = 0;
      queue[tail++] = start;
      visited[start] = 1;
      while (head < tail) {
        const current = queue[head++];
        regionSize++;
        const x = current % authority.info.width;
        const y = Math.floor(current / authority.info.width);
        const neighbors = [
          x > 0 ? current - 1 : -1,
          x + 1 < authority.info.width ? current + 1 : -1,
          y > 0 ? current - authority.info.width : -1,
          y + 1 < authority.info.height ? current + authority.info.width : -1,
        ];
        for (const neighbor of neighbors) {
          if (neighbor < 0 || !occupancy[neighbor] || visited[neighbor]) continue;
          visited[neighbor] = 1;
          queue[tail++] = neighbor;
        }
      }
      largest = Math.max(largest, regionSize);
    }
    return largest;
  };
  const referenceLargestBoneLikeRegion = largestRegion(referenceBoneOccupancy);
  const largestBoneLikeRegion = largestRegion(boneOccupancy);
  const referenceLargestBoneLikeRegionRatio = referenceLargestBoneLikeRegion / authorityPixels;
  const largestBoneLikeRegionRatio = largestBoneLikeRegion / authorityPixels;
  // Real-file calibration, 2026-08-03: accepted opaque candidates topped out
  // at 1.72%, copper at 2.01%, and translucent at 3.10%. The two known broken
  // cap fills formed single regions of 11.73% and 26.30%. This gate therefore
  // measures the topology of the defect, not a material-wide luminance rule.
  const calibratedMaxLargestRegionRatio = Math.max(
    0.04,
    referenceLargestBoneLikeRegionRatio * 1.25,
  );
  const topologyPass = largestBoneLikeRegionRatio <= calibratedMaxLargestRegionRatio;
  return {
    status: !topologyPass
      ? "fail"
      : input.materialClass === "translucent" ? "review-required" : "pass",
    boneDeltaTolerance: 3,
    referenceBoneLikeRatio: Number(referenceBoneLikeRatio.toFixed(6)),
    outputBoneLikeRatio: Number(outputBoneLikeRatio.toFixed(6)),
    referenceLargestBoneLikeRegionRatio: Number(referenceLargestBoneLikeRegionRatio.toFixed(6)),
    largestBoneLikeRegionRatio: Number(largestBoneLikeRegionRatio.toFixed(6)),
    calibratedMaxLargestRegionRatio: Number(calibratedMaxLargestRegionRatio.toFixed(6)),
    authorityPixels,
  };
}

function createOpenAiProvider(apiKey: string): MaterialGenerationProvider {
  return {
    async generate(input) {
      const form = new FormData();
      form.append("model", MODEL);
      form.append("prompt", input.prompt);
      form.append("size", "2080x2288");
      form.append("quality", "high");
      form.append("background", "opaque");
      form.append("output_format", "png");
      form.append(
        "image[]",
        new Blob([input.conditioningPng], { type: "image/png" }),
        "01-canonical-conditioning.png",
      );
      form.append(
        "mask",
        new Blob([input.editMaskPng], { type: "image/png" }),
        "authority-edit-mask.png",
      );
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
      let png: Buffer;
      if (first?.b64_json) {
        png = Buffer.from(first.b64_json, "base64");
      } else if (first?.url) {
        const download = await fetch(first.url);
        if (!download.ok) throw new Error(`OpenAI output download failed ${download.status}.`);
        png = Buffer.from(await download.arrayBuffer());
      } else {
        throw new Error("OpenAI response contained no image payload.");
      }
      return {
        png,
        usage: payload.usage ?? null,
        revisedPrompt: first?.revised_prompt ?? null,
      };
    },
  };
}

async function validateProviderOutput(png: Buffer): Promise<void> {
  const metadata = await sharp(png, { failOn: "error" }).metadata();
  if (metadata.format !== "png") throw new Error(`Provider output must be PNG; received ${metadata.format}.`);
  if (metadata.width !== 2080 || metadata.height !== 2288) {
    throw new Error(`Provider output must be 2080x2288; received ${metadata.width}x${metadata.height}.`);
  }
}

async function readSuccessfulResult(
  resultPath: string,
  job: Cyl9ComponentBatchJob,
): Promise<GeneratedArtifact | null> {
  try {
    const value = JSON.parse(await readFile(resultPath, "utf8")) as { artifact?: GeneratedArtifact };
    if (!value.artifact?.paths.manifestPath || !existsSync(value.artifact.paths.manifestPath)) return null;
    if (
      !value.artifact.materialFillQa ||
      value.artifact.materialFillQa.largestBoneLikeRegionRatio === undefined
    ) {
      const materialFillQa = await measureAuthorityMaterialFill({
        outputPng: await readFile(value.artifact.paths.rawPath),
        conditioningPng: await readFile(value.artifact.paths.conditioningPath),
        authorityMaskPng: await readFile(job.authorityMaskPath),
        materialClass: job.materialClass,
      });
      if (materialFillQa.status !== "pass") return null;
      value.artifact.materialFillQa = materialFillQa;
      await atomicWriteJson(resultPath, { artifact: value.artifact, mutationPolicy: MUTATION_POLICY });
    }
    if (value.artifact.materialFillQa.status === "fail") return null;
    return value.artifact;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function materializeProviderOutput(input: {
  job: Cyl9ComponentBatchJob;
  outputDirectory: string;
  providerPath: string;
  prompt: string;
  conditioningPath: string;
  editMaskPath: string;
  attemptTelemetryPath: string;
  materialFillQa: AuthorityMaterialFillQa;
}): Promise<GeneratedArtifact> {
  const manifest = loadCyl9ComponentFactory();
  const candidate = await buildComponentCandidate({
    manifest,
    componentKey: input.job.componentKey,
    variantKey: input.job.variantKey,
    sourcePath: input.providerPath,
    originalFilename: `${safeFilename(input.job.componentKey)}__${path.basename(input.providerPath)}`,
    sourceBoundsPx: input.job.authorityBoundsPx,
    editBoundsPx: input.job.authorityBoundsPx,
    provider: "openai",
    model: MODEL,
    prompt: input.prompt,
    estimatedCostUsd: input.job.estimatedCostUsd,
    outputDirectory: input.outputDirectory,
  });
  return {
    requestId: input.job.requestId,
    componentKey: input.job.componentKey,
    variantKey: input.job.variantKey,
    candidateId: candidate.record.candidateId,
    lifecycleState: "candidate",
    geometryLocked: candidate.record.qa.geometryLocked,
    mismatchedPixels: candidate.record.qa.mismatchedPixels,
    materialClass: input.job.materialClass,
    decorationState: input.job.rhinestoneLayout
      ? "registered-layout-review-required"
      : "not-applicable",
    materialFillQa: input.materialFillQa,
    paths: {
      ...candidate.paths,
      conditioningPath: input.conditioningPath,
      editMaskPath: input.editMaskPath,
      attemptTelemetryPath: input.attemptTelemetryPath,
    },
  };
}

async function recoverOutputFromSupersededGate(input: {
  job: Cyl9ComponentBatchJob;
  jobDirectory: string;
  outputDirectory: string;
  prompt: string;
  prepared: Cyl9GenerationConditioning;
  conditioningPath: string;
  editMaskPath: string;
  resultPath: string;
}): Promise<GeneratedArtifact | null> {
  const attemptsDirectory = path.join(input.jobDirectory, "attempts");
  let names: string[];
  try {
    names = (await readdir(attemptsDirectory)).filter((name) => name.endsWith(".json")).sort().reverse();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
  for (const name of names) {
    const attemptTelemetryPath = path.join(attemptsDirectory, name);
    const telemetry = JSON.parse(await readFile(attemptTelemetryPath, "utf8")) as {
      output?: null | { path?: string };
    };
    const providerPath = telemetry.output?.path;
    if (!providerPath || !existsSync(providerPath)) continue;
    const materialFillQa = await measureAuthorityMaterialFill({
      outputPng: await readFile(providerPath),
      conditioningPng: input.prepared.conditioningPng,
      authorityMaskPng: input.prepared.authorityMaskPng,
      materialClass: input.job.materialClass,
    });
    if (materialFillQa.status === "fail") continue;
    const artifact = await materializeProviderOutput({
      job: input.job,
      outputDirectory: input.outputDirectory,
      providerPath,
      prompt: input.prompt,
      conditioningPath: input.conditioningPath,
      editMaskPath: input.editMaskPath,
      attemptTelemetryPath,
      materialFillQa,
    });
    await atomicWriteJson(input.resultPath, {
      artifact,
      recoveredFromSupersededGate: true,
      mutationPolicy: MUTATION_POLICY,
    });
    return artifact;
  }
  return null;
}

async function executeJob(input: {
  job: Cyl9ComponentBatchJob;
  outputDirectory: string;
  provider: MaterialGenerationProvider;
}): Promise<{ artifact?: GeneratedArtifact; failure?: FailedArtifact; resumed: boolean }> {
  const { job, outputDirectory, provider } = input;
  const jobDirectory = path.join(outputDirectory, "jobs", job.requestId);
  const resultPath = path.join(jobDirectory, "result.json");
  const resumed = await readSuccessfulResult(resultPath, job);
  if (resumed) return { artifact: resumed, resumed: true };

  await mkdir(jobDirectory, { recursive: true });
  const prepared = await buildCyl9GenerationConditioning(job);
  const conditioningPath = path.join(jobDirectory, "conditioning.png");
  const editMaskPath = path.join(jobDirectory, "edit-mask.png");
  await Promise.all([
    writeFile(conditioningPath, prepared.conditioningPng),
    writeFile(editMaskPath, prepared.editMaskPng),
  ]);
  const prompt = providerPrompt(job);
  const recoveredArtifact = await recoverOutputFromSupersededGate({
    job,
    jobDirectory,
    outputDirectory,
    prompt,
    prepared,
    conditioningPath,
    editMaskPath,
    resultPath,
  });
  if (recoveredArtifact) return { artifact: recoveredArtifact, resumed: true };
  const attemptId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID()}`;
  const attemptTelemetryPath = path.join(jobDirectory, "attempts", `${attemptId}.json`);
  const startedAt = new Date().toISOString();
  const telemetry = {
    schemaVersion: 1,
    attemptId,
    requestId: job.requestId,
    componentKey: job.componentKey,
    variantKey: job.variantKey,
    status: "running",
    provider: "openai",
    model: MODEL,
    endpoint: "images/edits",
    promptSha256: sha256(prompt),
    sourceReferencePath: job.sourceReferencePath,
    sourceReferenceSha256: sha256(prepared.sourceReferencePng),
    authorityMaskPath: job.authorityMaskPath,
    authorityMaskSha256: sha256(prepared.authorityMaskPng),
    conditioningPath,
    conditioningSha256: sha256(prepared.conditioningPng),
    editMaskPath,
    editMaskSha256: sha256(prepared.editMaskPng),
    estimatedCostUsd: job.estimatedCostUsd,
    startedAt,
    completedAt: null as string | null,
    output: null as null | { path: string; sha256: string; revisedPrompt: string | null },
    usage: null as unknown,
    failure: null as null | string,
    mutationPolicy: MUTATION_POLICY,
  };
  await atomicWriteJson(attemptTelemetryPath, telemetry);

  try {
    const generated = await provider.generate({ ...prepared, job, prompt });
    await validateProviderOutput(generated.png);
    const providerPath = path.join(jobDirectory, "provider", `${attemptId}.png`);
    await mkdir(path.dirname(providerPath), { recursive: true });
    await writeFile(providerPath, generated.png);
    telemetry.output = {
      path: providerPath,
      sha256: sha256(generated.png),
      revisedPrompt: generated.revisedPrompt,
    };
    telemetry.usage = generated.usage;
    const materialFillQa = await measureAuthorityMaterialFill({
      outputPng: generated.png,
      conditioningPng: prepared.conditioningPng,
      authorityMaskPng: prepared.authorityMaskPng,
      materialClass: job.materialClass,
    });
    if (materialFillQa.status !== "pass") {
      throw new Error(
        `Incomplete authority material fill: largest Bone-like region ratio ${materialFillQa.largestBoneLikeRegionRatio} exceeds calibrated maximum ${materialFillQa.calibratedMaxLargestRegionRatio}.`,
      );
    }
    const artifact = await materializeProviderOutput({
      job,
      outputDirectory,
      providerPath,
      prompt,
      conditioningPath,
      editMaskPath,
      attemptTelemetryPath,
      materialFillQa,
    });
    telemetry.status = "succeeded";
    telemetry.completedAt = new Date().toISOString();
    await atomicWriteJson(attemptTelemetryPath, telemetry);
    await atomicWriteJson(resultPath, { artifact, mutationPolicy: MUTATION_POLICY });
    return { artifact, resumed: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    telemetry.status = "failed";
    telemetry.completedAt = new Date().toISOString();
    telemetry.failure = message;
    await atomicWriteJson(attemptTelemetryPath, telemetry);
    return {
      failure: {
        requestId: job.requestId,
        componentKey: job.componentKey,
        variantKey: job.variantKey,
        message,
        attemptTelemetryPath,
      },
      resumed: false,
    };
  }
}

export async function generateCyl9MaterialCandidates(
  options: GenerateCyl9MaterialOptions,
  dependencies: Partial<MaterialGenerationProvider> = {},
): Promise<Cyl9MaterialGenerationResult> {
  const plan = await planCyl9MaterialGeneration();
  let jobs = plan.jobs;
  if (options.variantKeys?.length) {
    const selected = new Set(options.variantKeys);
    jobs = jobs.filter(({ variantKey }) => selected.has(variantKey));
  }
  if (options.limit !== undefined) {
    if (!Number.isInteger(options.limit) || options.limit < 1) throw new Error("--limit must be a positive integer.");
    jobs = jobs.slice(0, options.limit);
  }
  const scopedPlan = {
    ...plan,
    mode: options.mode,
    jobs,
    estimatedCostUsd: Number(
      jobs.reduce((sum, job) => sum + (job.estimatedCostUsd ?? 0), 0).toFixed(2),
    ),
  };
  const base: Cyl9MaterialGenerationResult = {
    ...scopedPlan,
    generatedCandidates: 0,
    resumedCandidates: 0,
    failedCandidates: 0,
    artifacts: [],
    failures: [],
    indexPath: null,
  };
  if (options.mode === "plan") return base;
  if (options.confirmation !== CONFIRMATION) {
    throw new Error(`Execute requires confirmation token ${CONFIRMATION}.`);
  }
  if (!options.authorizePaidGeneration) {
    throw new Error("Paid generation requires the explicit --authorize-paid-generation flag.");
  }
  const concurrency = options.concurrency ?? 2;
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 4) {
    throw new Error("Concurrency must be an integer from 1 through 4.");
  }
  const outputDirectory = path.resolve(options.outputDirectory ?? DEFAULT_OUTPUT);
  await mkdir(outputDirectory, { recursive: true });
  const provider: MaterialGenerationProvider = dependencies.generate
    ? { generate: dependencies.generate }
    : createOpenAiProvider(loadOpenAiKey());
  const results: Array<Awaited<ReturnType<typeof executeJob>>> = [];
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, async () => {
    while (cursor < jobs.length) {
      const job = jobs[cursor++];
      results.push(await executeJob({ job, outputDirectory, provider }));
    }
  }));
  for (const result of results) {
    if (result.artifact) base.artifacts.push(result.artifact);
    if (result.failure) base.failures.push(result.failure);
    if (result.artifact && result.resumed) base.resumedCandidates++;
    if (result.artifact && !result.resumed) base.generatedCandidates++;
  }
  base.failedCandidates = base.failures.length;
  const indexPath = path.join(outputDirectory, "generation-index.json");
  await atomicWriteJson(indexPath, {
    schemaVersion: 1,
    familyKey: "CYL-9ML",
    provider: "openai",
    model: MODEL,
    estimatedCostUsd: base.estimatedCostUsd,
    artifacts: base.artifacts,
    failures: base.failures,
    mutationPolicy: MUTATION_POLICY,
    approvalsRequired: ["approve-pixels", "family-fit", "lock-shared-placement"],
  });
  base.indexPath = indexPath;
  return base;
}

function valueAfter(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const limitValue = valueAfter(args, "--limit");
  const concurrencyValue = valueAfter(args, "--concurrency");
  const variantsValue = valueAfter(args, "--variants");
  const result = await generateCyl9MaterialCandidates({
    mode: args.includes("--execute") ? "execute" : "plan",
    confirmation: valueAfter(args, "--confirmation"),
    authorizePaidGeneration: args.includes("--authorize-paid-generation"),
    outputDirectory: valueAfter(args, "--output"),
    limit: limitValue ? Number(limitValue) : undefined,
    concurrency: concurrencyValue ? Number(concurrencyValue) : undefined,
    variantKeys: variantsValue ? variantsValue.split(",").map((value) => value.trim()) : undefined,
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

const invokedUrl = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (import.meta.url === invokedUrl) {
  main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
