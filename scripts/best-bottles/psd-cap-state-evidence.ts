import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import sharp from "sharp";

import type {
  PsdCapStateClassification,
  PsdCompositeEvidence,
} from "../../src/lib/bestBottlesPsdCapStateAudit";

export const PSD_EVIDENCE_EXTRACTOR_VERSION = "best-bottles-psd-evidence-v3";

const DEFAULT_EVIDENCE_CONCURRENCY = 4;
const WHITE_DIFFERENCE_THRESHOLD = 255 * 0.06;
const LARGE_COMPONENT_CANVAS_FRACTION = 0.005;
const PROPOSED_CLASSIFICATION = "ambiguous-manual-review" satisfies PsdCapStateClassification;

export interface PsdSourceInput {
  sourcePath: string;
  sourceRelativePath: string;
}

export interface PsdSourceStat {
  size: number;
  mtimeMs: number;
}

export interface PsdCornerSample {
  corner: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  x: number;
  y: number;
  rgb: [number, number, number];
  white: boolean;
}

export interface PsdPixelCompositeEvidence extends PsdCompositeEvidence {
  previewWidth: number;
  previewHeight: number;
  cornerSamples: PsdCornerSample[];
}

export interface PsdReadySourceEvidence extends PsdSourceInput {
  extractorVersion: typeof PSD_EVIDENCE_EXTRACTOR_VERSION;
  status: "ok";
  cacheStatus: "generated" | "reused";
  sourceSha256: string;
  sourceBytes: number;
  sourceMtimeBefore: number;
  sourceMtimeAfter: number;
  sourceSizeBefore: number;
  sourceSizeAfter: number;
  previewPath: string;
  evidencePath: string;
  composite: PsdPixelCompositeEvidence;
  proposedClassification: "ambiguous-manual-review";
  routingHints: string[];
  error: null;
}

export interface PsdBlockedSourceEvidence extends PsdSourceInput {
  extractorVersion: typeof PSD_EVIDENCE_EXTRACTOR_VERSION;
  status: "blocked";
  cacheStatus: "not-applicable";
  sourceSha256: string | null;
  sourceBytes: number | null;
  sourceMtimeBefore: number | null;
  sourceMtimeAfter: number | null;
  sourceSizeBefore: number | null;
  sourceSizeAfter: number | null;
  previewPath: null;
  evidencePath: null;
  composite: null;
  proposedClassification: "ambiguous-manual-review";
  routingHints: string[];
  error: string;
}

export type PsdSourceEvidence = PsdReadySourceEvidence | PsdBlockedSourceEvidence;

type ReadSource = (sourcePath: string) => Promise<Buffer>;
type StatSource = (sourcePath: string) => Promise<PsdSourceStat>;
type RunMagick = (args: readonly string[]) => Promise<Buffer>;
type WriteArtifact = (target: string, data: Buffer) => Promise<void>;
type ReadCachedEvidence = (target: string) => Promise<PsdSourceEvidence | null>;
type ReadArtifact = (target: string) => Promise<Buffer>;

export interface InspectPsdEvidenceInput extends PsdSourceInput {
  outputRoot: string;
  readSource?: ReadSource;
  statSource?: StatSource;
  runMagick?: RunMagick;
  writeArtifact?: WriteArtifact;
  readCachedEvidence?: ReadCachedEvidence;
  readArtifact?: ReadArtifact;
}

interface SceneMetadata {
  width: number;
  height: number;
  opaque: boolean;
  sceneCount: number;
}

interface PixelAnalysis {
  previewWidth: number;
  previewHeight: number;
  foregroundBounds: PsdCompositeEvidence["foregroundBounds"];
  largeForegroundComponentCount: number;
  whiteCornerCount: number;
  minimumSafeMarginPct: number | null;
  cornerSamples: PsdCornerSample[];
}

interface PartialBlockedEvidence {
  sourceSha256: string | null;
  sourceBytes: number | null;
  sourceMtimeBefore: number;
  sourceMtimeAfter: number | null;
  sourceSizeBefore: number;
  sourceSizeAfter: number | null;
}

class PsdEvidenceInspectionError extends Error {
  constructor(
    message: string,
    readonly partialEvidence: PartialBlockedEvidence,
  ) {
    super(message);
    this.name = "PsdEvidenceInspectionError";
  }
}

const defaultReadSource: ReadSource = async (sourcePath) => readFile(sourcePath);
const defaultStatSource: StatSource = async (sourcePath) => {
  const sourceStat = await stat(sourcePath);
  return { size: sourceStat.size, mtimeMs: sourceStat.mtimeMs };
};

const defaultWriteArtifact: WriteArtifact = async (target, data) => {
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, data);
};

const defaultReadCachedEvidence: ReadCachedEvidence = async (target) => {
  try {
    const raw = await readFile(target, "utf8");
    try {
      return JSON.parse(raw) as PsdSourceEvidence;
    } catch (error) {
      if (error instanceof SyntaxError) return null;
      throw error;
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
};
const defaultReadArtifact: ReadArtifact = async (target) => readFile(target);

const defaultRunMagick: RunMagick = async (args) => new Promise((resolve, reject) => {
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
    if (settled) {
      return;
    }
    if (code !== 0) {
      const detail = Buffer.concat(stderr).toString("utf8").trim() || "unknown error";
      reject(new Error(`ImageMagick failed (${code ?? "signal"}): ${detail}`));
      return;
    }
    resolve(Buffer.concat(stdout));
  });
});

function parseSceneMetadata(output: Buffer): SceneMetadata {
  const value = JSON.parse(output.toString("utf8")) as Record<string, unknown>;
  const width = Number(value.width);
  const height = Number(value.height);
  const sceneCount = Number(value.sceneCount);
  const opaqueToken = String(value.opaque).trim().toLowerCase();
  if (
    !Number.isInteger(width)
    || width <= 0
    || !Number.isInteger(height)
    || height <= 0
    || !Number.isInteger(sceneCount)
    || sceneCount <= 0
    || !["true", "false"].includes(opaqueToken)
  ) {
    throw new Error(`Invalid ImageMagick scene metadata: ${output.toString("utf8")}`);
  }
  return {
    width,
    height,
    sceneCount,
    opaque: opaqueToken === "true",
  };
}

function parseSceneCount(output: Buffer): number {
  const firstToken = output.toString("utf8").trim().split(/\s+/)[0] ?? "";
  const count = /^\d+$/.test(firstToken) ? Number(firstToken) : Number.NaN;
  if (!Number.isInteger(count) || count <= 0) {
    throw new Error(`Invalid ImageMagick scene count: ${output.toString("utf8")}`);
  }
  return count;
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0;
}

function isNonnegativeFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isNonemptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function isValidBounds(
  value: unknown,
  previewWidth: number,
  previewHeight: number,
): value is NonNullable<PsdCompositeEvidence["foregroundBounds"]> | null {
  if (value === null) return true;
  if (typeof value !== "object" || value === null) return false;
  const bounds = value as Record<string, unknown>;
  return isPositiveInteger(bounds.width)
    && isPositiveInteger(bounds.height)
    && Number.isInteger(bounds.left)
    && Number(bounds.left) >= 0
    && Number.isInteger(bounds.top)
    && Number(bounds.top) >= 0
    && Number(bounds.left) + Number(bounds.width) <= previewWidth
    && Number(bounds.top) + Number(bounds.height) <= previewHeight;
}

function isValidCornerSamples(
  value: unknown,
  previewWidth: number,
  previewHeight: number,
): value is PsdCornerSample[] {
  if (!Array.isArray(value) || value.length !== 4) return false;
  const expected = [
    { corner: "top-left", x: 0, y: 0 },
    { corner: "top-right", x: previewWidth - 1, y: 0 },
    { corner: "bottom-left", x: 0, y: previewHeight - 1 },
    { corner: "bottom-right", x: previewWidth - 1, y: previewHeight - 1 },
  ] as const;
  return value.every((sample, index) => {
    if (typeof sample !== "object" || sample === null) return false;
    const candidate = sample as Record<string, unknown>;
    const rgb = candidate.rgb;
    return candidate.corner === expected[index].corner
      && candidate.x === expected[index].x
      && candidate.y === expected[index].y
      && Array.isArray(rgb)
      && rgb.length === 3
      && rgb.every((channel) => Number.isInteger(channel) && channel >= 0 && channel <= 255)
      && typeof candidate.white === "boolean"
      && candidate.white === isWhiteSample(rgb as number[]);
  });
}

function expectedMinimumSafeMarginPct(
  bounds: NonNullable<PsdCompositeEvidence["foregroundBounds"]>,
  previewWidth: number,
  previewHeight: number,
): number {
  return Number((Math.min(
    bounds.left / previewWidth,
    bounds.top / previewHeight,
    (previewWidth - bounds.left - bounds.width) / previewWidth,
    (previewHeight - bounds.top - bounds.height) / previewHeight,
  ) * 100).toFixed(4));
}

async function isReusableCachedEvidence(input: {
  cached: PsdSourceEvidence | null;
  sourceSha256: string;
  sourceBytes: number;
  previewPath: string;
  evidencePath: string;
  readArtifact: ReadArtifact;
}): Promise<boolean> {
  const cached = input.cached;
  const composite = cached?.status === "ok" ? cached.composite : null;
  const previewWidth = composite?.previewWidth;
  const previewHeight = composite?.previewHeight;
  if (
    cached === null
    || cached.extractorVersion !== PSD_EVIDENCE_EXTRACTOR_VERSION
    || cached.status !== "ok"
    || !["generated", "reused"].includes(cached.cacheStatus)
    || !isNonemptyString(cached.sourcePath)
    || !isNonemptyString(cached.sourceRelativePath)
    || cached.sourceSha256 !== input.sourceSha256
    || cached.sourceBytes !== input.sourceBytes
    || !isPositiveInteger(cached.sourceBytes)
    || !isNonnegativeFiniteNumber(cached.sourceMtimeBefore)
    || !isNonnegativeFiniteNumber(cached.sourceMtimeAfter)
    || cached.sourceMtimeBefore !== cached.sourceMtimeAfter
    || cached.sourceSizeBefore !== input.sourceBytes
    || cached.sourceSizeAfter !== input.sourceBytes
    || cached.previewPath !== input.previewPath
    || cached.evidencePath !== input.evidencePath
    || cached.error !== null
    || cached.proposedClassification !== PROPOSED_CLASSIFICATION
    || !Array.isArray(cached.routingHints)
    || !cached.routingHints.every(isNonemptyString)
    || new Set(cached.routingHints).size !== cached.routingHints.length
    || cached.composite === null
    || cached.composite.previewPath !== input.previewPath
    || !isPositiveInteger(cached.composite.width)
    || !isPositiveInteger(cached.composite.height)
    || !isPositiveInteger(cached.composite.previewWidth)
    || !isPositiveInteger(cached.composite.previewHeight)
    || cached.composite.previewWidth > cached.composite.width
    || cached.composite.previewHeight > cached.composite.height
    || cached.composite.previewWidth > 900
    || cached.composite.previewHeight > 1_200
    || !isPositiveInteger(cached.composite.sceneCount)
    || typeof cached.composite.opaque !== "boolean"
    || !Number.isInteger(cached.composite.largeForegroundComponentCount)
    || cached.composite.largeForegroundComponentCount < 0
    || !Number.isInteger(cached.composite.whiteCornerCount)
    || cached.composite.whiteCornerCount < 0
    || cached.composite.whiteCornerCount > 4
    || !isPositiveInteger(previewWidth)
    || !isPositiveInteger(previewHeight)
    || !isValidBounds(cached.composite.foregroundBounds, previewWidth, previewHeight)
    || (cached.composite.foregroundBounds === null
      ? cached.composite.minimumSafeMarginPct !== null
      : !isNonnegativeFiniteNumber(cached.composite.minimumSafeMarginPct)
        || cached.composite.minimumSafeMarginPct > 100
        || cached.composite.minimumSafeMarginPct !== expectedMinimumSafeMarginPct(
          cached.composite.foregroundBounds,
          previewWidth,
          previewHeight,
        ))
    || !isValidCornerSamples(cached.composite.cornerSamples, previewWidth, previewHeight)
    || cached.composite.whiteCornerCount
      !== cached.composite.cornerSamples.filter((sample) => sample.white).length
    || cached.composite.largeForegroundComponentCount > previewWidth * previewHeight
    || JSON.stringify(cached.routingHints) !== JSON.stringify(buildRoutingHints(
      cached.sourceRelativePath,
      cached.composite.largeForegroundComponentCount,
    ))
    || !/^[a-f0-9]{64}$/i.test(cached.composite.evidenceSha256)
  ) {
    return false;
  }
  try {
    const preview = await input.readArtifact(input.previewPath);
    if (
      createHash("sha256").update(preview).digest("hex")
      !== cached.composite.evidenceSha256.toLowerCase()
    ) {
      return false;
    }
    const metadata = await sharp(preview, { animated: false, failOn: "error" }).metadata();
    return metadata.format === "png"
      && metadata.width === cached.composite.previewWidth
      && metadata.height === cached.composite.previewHeight
      && (metadata.pages ?? 1) === 1;
  } catch {
    return false;
  }
}

function isForegroundPixel(data: Buffer, offset: number): boolean {
  return (
    255 - data[offset] > WHITE_DIFFERENCE_THRESHOLD
    || 255 - data[offset + 1] > WHITE_DIFFERENCE_THRESHOLD
    || 255 - data[offset + 2] > WHITE_DIFFERENCE_THRESHOLD
  );
}

function getPixelRgb(
  data: Buffer,
  width: number,
  channels: number,
  x: number,
  y: number,
): [number, number, number] {
  const offset = (y * width + x) * channels;
  return [data[offset], data[offset + 1], data[offset + 2]];
}

function isWhiteSample(rgb: readonly number[]): boolean {
  return rgb.every((channel) => 255 - channel <= WHITE_DIFFERENCE_THRESHOLD);
}

function countLargeComponents(
  foreground: Uint8Array,
  width: number,
  height: number,
): number {
  const visited = new Uint8Array(foreground.length);
  const queue = new Int32Array(foreground.length);
  const minimumSize = width * height * LARGE_COMPONENT_CANVAS_FRACTION;
  let largeComponentCount = 0;

  for (let start = 0; start < foreground.length; start += 1) {
    if (foreground[start] === 0 || visited[start] === 1) {
      continue;
    }

    let head = 0;
    let tail = 1;
    let componentSize = 0;
    queue[0] = start;
    visited[start] = 1;

    while (head < tail) {
      const index = queue[head];
      head += 1;
      componentSize += 1;
      const x = index % width;
      const y = Math.floor(index / width);
      const neighbors = [
        x > 0 ? index - 1 : -1,
        x + 1 < width ? index + 1 : -1,
        y > 0 ? index - width : -1,
        y + 1 < height ? index + width : -1,
      ];
      for (const neighbor of neighbors) {
        if (neighbor >= 0 && foreground[neighbor] === 1 && visited[neighbor] === 0) {
          visited[neighbor] = 1;
          queue[tail] = neighbor;
          tail += 1;
        }
      }
    }

    if (componentSize > minimumSize) {
      largeComponentCount += 1;
    }
  }

  return largeComponentCount;
}

async function analyzePreview(preview: Buffer): Promise<PixelAnalysis> {
  const { data, info } = await sharp(preview, { animated: false, failOn: "error" })
    .toColourspace("srgb")
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  if (channels < 3) {
    throw new Error(`Expected an RGB preview, received ${channels} channels.`);
  }

  const foreground = new Uint8Array(width * height);
  let minimumX = width;
  let minimumY = height;
  let maximumX = -1;
  let maximumY = -1;
  for (let pixel = 0; pixel < foreground.length; pixel += 1) {
    if (!isForegroundPixel(data, pixel * channels)) {
      continue;
    }
    foreground[pixel] = 1;
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    minimumX = Math.min(minimumX, x);
    minimumY = Math.min(minimumY, y);
    maximumX = Math.max(maximumX, x);
    maximumY = Math.max(maximumY, y);
  }

  const foregroundBounds = maximumX < 0
    ? null
    : {
        left: minimumX,
        top: minimumY,
        width: maximumX - minimumX + 1,
        height: maximumY - minimumY + 1,
      };
  const cornerDefinitions: Array<Pick<PsdCornerSample, "corner" | "x" | "y">> = [
    { corner: "top-left", x: 0, y: 0 },
    { corner: "top-right", x: width - 1, y: 0 },
    { corner: "bottom-left", x: 0, y: height - 1 },
    { corner: "bottom-right", x: width - 1, y: height - 1 },
  ];
  const cornerSamples = cornerDefinitions.map((sample) => {
    const rgb = getPixelRgb(data, width, channels, sample.x, sample.y);
    return { ...sample, rgb, white: isWhiteSample(rgb) };
  });
  const minimumSafeMarginPct = foregroundBounds === null
    ? null
    : Number((Math.min(
        foregroundBounds.left / width,
        foregroundBounds.top / height,
        (width - foregroundBounds.left - foregroundBounds.width) / width,
        (height - foregroundBounds.top - foregroundBounds.height) / height,
      ) * 100).toFixed(4));

  return {
    previewWidth: width,
    previewHeight: height,
    foregroundBounds,
    largeForegroundComponentCount: countLargeComponents(foreground, width, height),
    whiteCornerCount: cornerSamples.filter((sample) => sample.white).length,
    minimumSafeMarginPct,
    cornerSamples,
  };
}

function buildRoutingHints(
  sourceRelativePath: string,
  largeForegroundComponentCount: number,
): string[] {
  const normalizedPath = sourceRelativePath.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const hints: string[] = [];
  const uncapped = /\b(?:uncapped|cap off|caps off|without cap|without caps|no cap|no caps)\b/.test(normalizedPath);
  if (uncapped) {
    hints.push("folder_hint:uncapped");
  } else if (/\b(?:capped|cap on|caps on|with cap|with caps)\b/.test(normalizedPath)) {
    hints.push("folder_hint:capped");
  }
  if (largeForegroundComponentCount > 1) {
    hints.push("multiple_large_components");
  }
  if (/\b(?:component|components|applicator|applicators|dropper|droppers|closure|closures)\b/.test(normalizedPath)) {
    hints.push("component_path_hint");
  }
  return hints;
}

const PATH_DERIVED_ROUTING_HINTS = new Set([
  "folder_hint:capped",
  "folder_hint:uncapped",
  "component_path_hint",
]);

function rebindRoutingHints(
  cachedHints: readonly string[],
  sourceRelativePath: string,
): string[] {
  const currentPathHints = buildRoutingHints(sourceRelativePath, 0);
  const folderHints = currentPathHints.filter((hint) => hint.startsWith("folder_hint:"));
  const componentHints = currentPathHints.filter((hint) => hint === "component_path_hint");
  const pixelHints = cachedHints.filter((hint) => !PATH_DERIVED_ROUTING_HINTS.has(hint));
  return [...new Set([...folderHints, ...pixelHints, ...componentHints])];
}

function assertSourceUnchanged(
  sourcePath: string,
  before: PsdSourceStat,
  after: PsdSourceStat,
): void {
  if (before.size !== after.size || before.mtimeMs !== after.mtimeMs) {
    throw new Error(`Source changed during PSD evidence extraction: ${sourcePath}`);
  }
}

function rebindReadyEvidence(input: {
  evidence: PsdReadySourceEvidence;
  source: PsdSourceInput;
  sourceSha256: string;
  sourceBytes: number;
  sourceStatBefore: PsdSourceStat;
  sourceStatAfter: PsdSourceStat;
  previewPath: string;
  evidencePath: string;
}): PsdReadySourceEvidence {
  return {
    ...input.evidence,
    cacheStatus: "reused",
    sourcePath: input.source.sourcePath,
    sourceRelativePath: input.source.sourceRelativePath,
    sourceSha256: input.sourceSha256,
    sourceBytes: input.sourceBytes,
    sourceMtimeBefore: input.sourceStatBefore.mtimeMs,
    sourceMtimeAfter: input.sourceStatAfter.mtimeMs,
    sourceSizeBefore: input.sourceStatBefore.size,
    sourceSizeAfter: input.sourceStatAfter.size,
    previewPath: input.previewPath,
    evidencePath: input.evidencePath,
    composite: {
      ...input.evidence.composite,
      previewPath: input.previewPath,
    },
    proposedClassification: PROPOSED_CLASSIFICATION,
    routingHints: rebindRoutingHints(
      input.evidence.routingHints ?? [],
      input.source.sourceRelativePath,
    ),
    error: null,
  };
}

async function inspectPsdEvidenceInternal(
  input: InspectPsdEvidenceInput,
  singleFlight?: Map<string, Promise<PsdReadySourceEvidence>>,
): Promise<PsdReadySourceEvidence> {
  const readSource = input.readSource ?? defaultReadSource;
  const statSource = input.statSource ?? defaultStatSource;
  const runMagick = input.runMagick ?? defaultRunMagick;
  const writeArtifact = input.writeArtifact ?? defaultWriteArtifact;
  const readCachedEvidence = input.readCachedEvidence ?? defaultReadCachedEvidence;
  const readArtifact = input.readArtifact ?? defaultReadArtifact;

  const sourceStatBefore = await statSource(input.sourcePath);
  let sourceBytes: Buffer;
  try {
    sourceBytes = await readSource(input.sourcePath);
  } catch (error) {
    let sourceStatAfter: PsdSourceStat | null = null;
    let failure = error;
    try {
      sourceStatAfter = await statSource(input.sourcePath);
      assertSourceUnchanged(input.sourcePath, sourceStatBefore, sourceStatAfter);
    } catch (afterError) {
      failure = afterError;
    }
    throw new PsdEvidenceInspectionError(exactError(failure), {
      sourceSha256: null,
      sourceBytes: null,
      sourceMtimeBefore: sourceStatBefore.mtimeMs,
      sourceMtimeAfter: sourceStatAfter?.mtimeMs ?? null,
      sourceSizeBefore: sourceStatBefore.size,
      sourceSizeAfter: sourceStatAfter?.size ?? null,
    });
  }
  const sourceSha256 = createHash("sha256").update(sourceBytes).digest("hex");
  const previewPath = join(input.outputRoot, "previews", `${sourceSha256}.png`);
  const evidencePath = join(input.outputRoot, "evidence", `${sourceSha256}.json`);
  let sourceStatAfter: PsdSourceStat | null = null;

  try {
    const cached = await readCachedEvidence(evidencePath);
    if (await isReusableCachedEvidence({
      cached,
      sourceSha256,
      sourceBytes: sourceBytes.length,
      previewPath,
      evidencePath,
      readArtifact,
    })) {
      sourceStatAfter = await statSource(input.sourcePath);
      assertSourceUnchanged(input.sourcePath, sourceStatBefore, sourceStatAfter);
      return rebindReadyEvidence({
        evidence: cached as PsdReadySourceEvidence,
        source: input,
        sourceSha256,
        sourceBytes: sourceBytes.length,
        sourceStatBefore,
        sourceStatAfter,
        previewPath,
        evidencePath,
      });
    }

    const existingFlight = singleFlight?.get(evidencePath);
    if (existingFlight !== undefined) {
      let sharedEvidence: PsdReadySourceEvidence;
      try {
        sharedEvidence = await existingFlight;
      } catch {
        if (singleFlight?.get(evidencePath) === existingFlight) {
          singleFlight.delete(evidencePath);
        }
        return await inspectPsdEvidenceInternal(input, singleFlight);
      }
      sourceStatAfter = await statSource(input.sourcePath);
      assertSourceUnchanged(input.sourcePath, sourceStatBefore, sourceStatAfter);
      return rebindReadyEvidence({
        evidence: sharedEvidence,
        source: input,
        sourceSha256,
        sourceBytes: sourceBytes.length,
        sourceStatBefore,
        sourceStatAfter,
        previewPath,
        evidencePath,
      });
    }

    const generation = (async (): Promise<PsdReadySourceEvidence> => {
      const scenePath = `${input.sourcePath}[0]`;
      const metadataOutput = await runMagick([
        "identify",
        "-format",
        '{"width":%w,"height":%h,"opaque":"%[opaque]","sceneCount":1}',
        scenePath,
      ]);
      const metadata = parseSceneMetadata(metadataOutput);
      const sceneCount = parseSceneCount(await runMagick([
        "identify",
        "-format",
        "%n\n",
        input.sourcePath,
      ]));
      const preview = await runMagick([
        scenePath,
        "-background", "white",
        "-alpha", "remove",
        "-alpha", "off",
        "-colorspace", "sRGB",
        "-resize", "900x1200>",
        "png:-",
      ]);
      const pixelAnalysis = await analyzePreview(preview);
      sourceStatAfter = await statSource(input.sourcePath);
      assertSourceUnchanged(input.sourcePath, sourceStatBefore, sourceStatAfter);

      const composite: PsdPixelCompositeEvidence = {
        width: metadata.width,
        height: metadata.height,
        opaque: metadata.opaque,
        sceneCount,
        foregroundBounds: pixelAnalysis.foregroundBounds,
        largeForegroundComponentCount: pixelAnalysis.largeForegroundComponentCount,
        whiteCornerCount: pixelAnalysis.whiteCornerCount,
        minimumSafeMarginPct: pixelAnalysis.minimumSafeMarginPct,
        previewPath,
        evidenceSha256: createHash("sha256").update(preview).digest("hex"),
        previewWidth: pixelAnalysis.previewWidth,
        previewHeight: pixelAnalysis.previewHeight,
        cornerSamples: pixelAnalysis.cornerSamples,
      };
      const evidence: PsdReadySourceEvidence = {
        extractorVersion: PSD_EVIDENCE_EXTRACTOR_VERSION,
        status: "ok",
        cacheStatus: "generated",
        sourcePath: input.sourcePath,
        sourceRelativePath: input.sourceRelativePath,
        sourceSha256,
        sourceBytes: sourceBytes.length,
        sourceMtimeBefore: sourceStatBefore.mtimeMs,
        sourceMtimeAfter: sourceStatAfter.mtimeMs,
        sourceSizeBefore: sourceStatBefore.size,
        sourceSizeAfter: sourceStatAfter.size,
        previewPath,
        evidencePath,
        composite,
        proposedClassification: PROPOSED_CLASSIFICATION,
        routingHints: buildRoutingHints(
          input.sourceRelativePath,
          composite.largeForegroundComponentCount,
        ),
        error: null,
      };

      await writeArtifact(previewPath, preview);
      await writeArtifact(evidencePath, Buffer.from(`${JSON.stringify(evidence, null, 2)}\n`));
      return evidence;
    })();
    const publishedFlight = generation.catch((error: unknown) => {
      if (singleFlight?.get(evidencePath) === publishedFlight) {
        singleFlight.delete(evidencePath);
      }
      throw error;
    });
    singleFlight?.set(evidencePath, publishedFlight);
    return await publishedFlight;
  } catch (error) {
    let failure = error;
    if (sourceStatAfter === null) {
      try {
        sourceStatAfter = await statSource(input.sourcePath);
      } catch (statError) {
        failure = new Error(
          `Unable to verify source after evidence failure (${exactError(error)}): ${exactError(statError)}`,
        );
      }
    }
    if (sourceStatAfter !== null) {
      try {
        assertSourceUnchanged(input.sourcePath, sourceStatBefore, sourceStatAfter);
      } catch (sourceChangeError) {
        failure = sourceChangeError;
      }
    }
    throw new PsdEvidenceInspectionError(exactError(failure), {
      sourceSha256,
      sourceBytes: sourceBytes.length,
      sourceMtimeBefore: sourceStatBefore.mtimeMs,
      sourceMtimeAfter: sourceStatAfter?.mtimeMs ?? null,
      sourceSizeBefore: sourceStatBefore.size,
      sourceSizeAfter: sourceStatAfter?.size ?? null,
    });
  }
}

export async function inspectPsdEvidence(
  input: InspectPsdEvidenceInput,
): Promise<PsdReadySourceEvidence> {
  return inspectPsdEvidenceInternal(input);
}

export interface RunEvidencePoolInput {
  sources: readonly PsdSourceInput[];
  outputRoot: string;
  concurrency?: number;
  inspectEvidence?: (input: InspectPsdEvidenceInput) => Promise<PsdSourceEvidence>;
  readSource?: ReadSource;
  statSource?: StatSource;
  runMagick?: RunMagick;
  writeArtifact?: WriteArtifact;
  readCachedEvidence?: ReadCachedEvidence;
  readArtifact?: ReadArtifact;
}

function exactError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function runEvidencePool(
  input: RunEvidencePoolInput,
): Promise<PsdSourceEvidence[]> {
  if (input.sources.length === 0) {
    return [];
  }
  const requestedConcurrency = input.concurrency ?? DEFAULT_EVIDENCE_CONCURRENCY;
  if (!Number.isInteger(requestedConcurrency) || requestedConcurrency <= 0) {
    throw new Error(`Evidence concurrency must be a positive integer, received ${requestedConcurrency}.`);
  }

  const results = new Array<PsdSourceEvidence>(input.sources.length);
  const singleFlight = new Map<string, Promise<PsdReadySourceEvidence>>();
  const inspectEvidence = input.inspectEvidence
    ?? ((inspectInput: InspectPsdEvidenceInput) => inspectPsdEvidenceInternal(inspectInput, singleFlight));
  let nextIndex = 0;
  const workerCount = Math.min(requestedConcurrency, input.sources.length);
  const workers = Array.from({ length: workerCount }, async () => {
    while (nextIndex < input.sources.length) {
      const index = nextIndex;
      nextIndex += 1;
      const source = input.sources[index];
      try {
        const result = await inspectEvidence({
          ...source,
          outputRoot: input.outputRoot,
          readSource: input.readSource,
          statSource: input.statSource,
          runMagick: input.runMagick,
          writeArtifact: input.writeArtifact,
          readCachedEvidence: input.readCachedEvidence,
          readArtifact: input.readArtifact,
        });
        results[index] = {
          ...result,
          proposedClassification: PROPOSED_CLASSIFICATION,
        };
      } catch (error) {
        const partialEvidence = error instanceof PsdEvidenceInspectionError
          ? error.partialEvidence
          : null;
        results[index] = {
          extractorVersion: PSD_EVIDENCE_EXTRACTOR_VERSION,
          status: "blocked",
          cacheStatus: "not-applicable",
          sourcePath: source.sourcePath,
          sourceRelativePath: source.sourceRelativePath,
          sourceSha256: partialEvidence?.sourceSha256 ?? null,
          sourceBytes: partialEvidence?.sourceBytes ?? null,
          sourceMtimeBefore: partialEvidence?.sourceMtimeBefore ?? null,
          sourceMtimeAfter: partialEvidence?.sourceMtimeAfter ?? null,
          sourceSizeBefore: partialEvidence?.sourceSizeBefore ?? null,
          sourceSizeAfter: partialEvidence?.sourceSizeAfter ?? null,
          previewPath: null,
          evidencePath: null,
          composite: null,
          proposedClassification: PROPOSED_CLASSIFICATION,
          routingHints: [],
          error: exactError(error),
        };
      }
    }
  });
  await Promise.all(workers);
  return results;
}
