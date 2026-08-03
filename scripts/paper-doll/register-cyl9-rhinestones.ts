import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import sharp from "sharp";

import type { PixelBounds } from "../../src/lib/paperDoll/componentPlateContract";
import { loadCyl9ComponentFactory } from "../../src/lib/paperDoll/cyl9ComponentFactory";
import {
  buildRhinestoneLayout,
  type RhinestoneLayoutPoint,
  type RhinestoneRecipePoint,
} from "../../src/lib/paperDoll/rhinestoneLayout";
import { buildComponentCandidate } from "./build-component-candidate";

const DEFAULT_GENERATED = "outputs/paper-doll-component-factory/CYL-9ML/generated";
const DEFAULT_MATERIALIZED = "outputs/paper-doll-component-factory/CYL-9ML/materialized";
const DEFAULT_OUTPUT = "outputs/paper-doll-component-factory/CYL-9ML/registered-rhinestones";
const RECIPE_PATH = "docs/paper-doll-rig/cyl9-component-material-recipes.json";
const REGISTERED_VARIANTS = ["SLDT", "BKDT", "PKDT"] as const;
const MODEL = "registered-rhinestone-composite-v1";

type MutationPolicy = {
  approvalsWritten: false;
  placementsWritten: false;
  currentReleaseChanged: false;
  sanityChanged: false;
};

type CandidateArtifact = {
  requestId: string;
  componentKey: string;
  variantKey: string;
  candidateId: string;
  lifecycleState: "candidate";
  geometryLocked: boolean;
  mismatchedPixels: number;
  materialClass: string;
  decorationState: string;
  materialFillQa: unknown;
  paths: {
    rawPath: string;
    candidatePath: string;
    layerPath: string;
    reviewPath: string;
    manifestPath: string;
    [key: string]: string;
  };
  rhinestoneRegistration?: {
    policy: typeof MODEL;
    sourceCandidateId: string;
    sourceCandidateSha256: string;
    materialSourceVariantKey: string;
    supersededGeneratedCandidateId: string;
    layoutSha256: string;
    stones: RegisteredStone[];
  };
};

type GenerationIndex = {
  schemaVersion: number;
  familyKey: "CYL-9ML";
  artifacts: CandidateArtifact[];
  [key: string]: unknown;
};

export type RegisteredStone = {
  id: string;
  order: number;
  centerXPx: number;
  centerYPx: number;
  radiusXPx: number;
  radiusYPx: number;
};

const MUTATION_POLICY: MutationPolicy = {
  approvalsWritten: false,
  placementsWritten: false,
  currentReleaseChanged: false,
  sanityChanged: false,
};

function sha256(value: Buffer | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function registeredStone(
  point: RhinestoneLayoutPoint,
  bounds: PixelBounds,
): RegisteredStone {
  const radiusYPx = Math.max(2, Math.round(bounds.width * point.scaleRatio));
  const foreshortening = Math.max(0.72, Math.cos(point.angleDeg * Math.PI / 180));
  return {
    id: point.id,
    order: point.order,
    centerXPx: bounds.left + Math.round(point.xRatio * (bounds.width - 1)),
    centerYPx: bounds.top + Math.round((1 - point.heightRatio) * (bounds.height - 1)),
    radiusXPx: Math.max(2, Math.round(radiusYPx * foreshortening)),
    radiusYPx,
  };
}

function eraseGeneratedStonePixels(
  rgba: Buffer,
  width: number,
  height: number,
  stone: RegisteredStone,
): void {
  const eraseRadiusX = stone.radiusXPx + 3;
  const eraseRadiusY = stone.radiusYPx + 3;
  for (let y = Math.max(0, stone.centerYPx - eraseRadiusY); y <= Math.min(height - 1, stone.centerYPx + eraseRadiusY); y++) {
    const normalizedY = (y - stone.centerYPx) / eraseRadiusY;
    const rowRadius = Math.round(eraseRadiusX * Math.sqrt(Math.max(0, 1 - normalizedY * normalizedY)));
    const left = Math.max(0, stone.centerXPx - rowRadius);
    const right = Math.min(width - 1, stone.centerXPx + rowRadius);
    const sampleLeftX = Math.max(0, stone.centerXPx - eraseRadiusX - 2);
    const sampleRightX = Math.min(width - 1, stone.centerXPx + eraseRadiusX + 2);
    const leftOffset = (y * width + sampleLeftX) * 4;
    const rightOffset = (y * width + sampleRightX) * 4;
    for (let x = left; x <= right; x++) {
      const t = sampleRightX === sampleLeftX ? 0.5 : (x - sampleLeftX) / (sampleRightX - sampleLeftX);
      const offset = (y * width + x) * 4;
      for (let channel = 0; channel < 3; channel++) {
        rgba[offset + channel] = Math.round(
          rgba[leftOffset + channel] * (1 - t) + rgba[rightOffset + channel] * t,
        );
      }
    }
  }
}

function stoneSvg(stone: RegisteredStone): Buffer {
  const width = stone.radiusXPx * 2 + 5;
  const height = stone.radiusYPx * 2 + 5;
  const cx = width / 2;
  const cy = height / 2;
  const rx = stone.radiusXPx;
  const ry = stone.radiusYPx;
  const safeId = stone.id.replace(/[^a-zA-Z0-9]/g, "");
  return Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="crystal${safeId}" cx="38%" cy="30%" r="72%">
        <stop offset="0" stop-color="#ffffff"/>
        <stop offset="0.28" stop-color="#f8fbff"/>
        <stop offset="0.55" stop-color="#aeb8c3"/>
        <stop offset="0.76" stop-color="#ffffff"/>
        <stop offset="1" stop-color="#38414b"/>
      </radialGradient>
      <linearGradient id="bezel${safeId}" x1="0" x2="1">
        <stop offset="0" stop-color="#4a4f55"/>
        <stop offset="0.35" stop-color="#ffffff"/>
        <stop offset="0.7" stop-color="#8c939b"/>
        <stop offset="1" stop-color="#252a2f"/>
      </linearGradient>
    </defs>
    <ellipse cx="${cx}" cy="${cy}" rx="${rx + 1.2}" ry="${ry + 1.2}" fill="none" stroke="url(#bezel${safeId})" stroke-width="2"/>
    <ellipse cx="${cx}" cy="${cy}" rx="${rx - 1}" ry="${ry - 1}" fill="url(#crystal${safeId})"/>
    <path d="M ${cx - rx + 2} ${cy} L ${cx} ${cy - ry + 2} L ${cx + rx - 2} ${cy} L ${cx} ${cy + ry - 2} Z" fill="none" stroke="#ffffff" stroke-opacity="0.72" stroke-width="0.8"/>
    <path d="M ${cx - rx + 3} ${cy - ry / 2} L ${cx + rx - 3} ${cy + ry / 2} M ${cx + rx - 3} ${cy - ry / 2} L ${cx - rx + 3} ${cy + ry / 2}" stroke="#636e79" stroke-opacity="0.7" stroke-width="0.65"/>
  </svg>`);
}

export async function applyRegisteredRhinestones(input: {
  basePng: Buffer;
  authorityBoundsPx: PixelBounds;
  layout: RhinestoneLayoutPoint[];
  eraseExisting?: boolean;
}): Promise<{ png: Buffer; stones: RegisteredStone[] }> {
  if (input.layout.length !== 8 || new Set(input.layout.map(({ id }) => id)).size !== 8) {
    throw new Error("CYL-9ML rhinestone registration requires eight unique stone IDs.");
  }
  const { data, info } = await sharp(input.basePng).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (
    input.authorityBoundsPx.left < 0 || input.authorityBoundsPx.top < 0 ||
    input.authorityBoundsPx.left + input.authorityBoundsPx.width > info.width ||
    input.authorityBoundsPx.top + input.authorityBoundsPx.height > info.height
  ) {
    throw new Error("Rhinestone authority bounds do not fit the source canvas.");
  }
  const stones = input.layout.map((point) => registeredStone(point, input.authorityBoundsPx));
  if (input.eraseExisting !== false) {
    for (const stone of stones) eraseGeneratedStonePixels(data, info.width, info.height, stone);
  }
  const cleanBase = await sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  }).png().toBuffer();
  const overlays = stones.map((stone) => ({
    input: stoneSvg(stone),
    left: stone.centerXPx - stone.radiusXPx - 2,
    top: stone.centerYPx - stone.radiusYPx - 2,
  }));
  return {
    png: await sharp(cleanBase).composite(overlays).png().toBuffer(),
    stones,
  };
}

export async function recolorMatteCapPink(input: {
  basePng: Buffer;
  authorityBoundsPx: PixelBounds;
}): Promise<Buffer> {
  const { data, info } = await sharp(input.basePng).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const target = [232, 155, 169] as const;
  const right = input.authorityBoundsPx.left + input.authorityBoundsPx.width;
  const bottom = input.authorityBoundsPx.top + input.authorityBoundsPx.height;
  for (let y = input.authorityBoundsPx.top; y < bottom; y++) {
    for (let x = input.authorityBoundsPx.left; x < right; x++) {
      const offset = (y * info.width + x) * 4;
      if (data[offset + 3] === 0) continue;
      const luminance = data[offset] * 0.2126 + data[offset + 1] * 0.7152 + data[offset + 2] * 0.0722;
      const shade = 0.56 + 0.66 * (luminance / 255);
      for (let channel = 0; channel < 3; channel++) {
        const neutralDetail = (data[offset + channel] - luminance) * 0.12;
        data[offset + channel] = Math.max(0, Math.min(255, Math.round(target[channel] * shade + neutralDetail)));
      }
    }
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

export async function registerCyl9RhinestoneCandidates(input: {
  generatedDirectory?: string;
  materializedDirectory?: string;
  outputDirectory?: string;
}) {
  const generatedDirectory = path.resolve(input.generatedDirectory ?? DEFAULT_GENERATED);
  const materializedDirectory = path.resolve(input.materializedDirectory ?? DEFAULT_MATERIALIZED);
  const outputDirectory = path.resolve(input.outputDirectory ?? DEFAULT_OUTPUT);
  const manifest = loadCyl9ComponentFactory();
  const [index, deterministicIndex, recipes] = await Promise.all([
    readFile(path.join(generatedDirectory, "generation-index.json"), "utf8").then(JSON.parse) as Promise<GenerationIndex>,
    readFile(path.join(materializedDirectory, "materialization-index.json"), "utf8").then(JSON.parse) as Promise<GenerationIndex>,
    readFile(path.resolve(RECIPE_PATH), "utf8").then(JSON.parse) as Promise<{ rhinestoneLayout: RhinestoneRecipePoint[] }>,
  ]);
  if (index.familyKey !== "CYL-9ML" || index.artifacts.length !== 16) {
    throw new Error("Rhinestone registration requires the complete sixteen-candidate generation index.");
  }
  if (deterministicIndex.familyKey !== "CYL-9ML" || deterministicIndex.artifacts.length !== 7) {
    throw new Error("Rhinestone registration requires the complete seven-candidate deterministic index.");
  }
  const allSources = [...deterministicIndex.artifacts, ...index.artifacts];
  const materialSourceByVariant: Record<typeof REGISTERED_VARIANTS[number], string> = {
    SLDT: "SSLV",
    BKDT: "SBLK",
    PKDT: "MSLV",
  };
  const layout = buildRhinestoneLayout(recipes.rhinestoneLayout);
  const layoutSha256 = sha256(JSON.stringify(layout));
  const artifacts: CandidateArtifact[] = [];
  await mkdir(path.join(outputDirectory, "registered-sources"), { recursive: true });

  for (const artifact of index.artifacts) {
    if (!REGISTERED_VARIANTS.includes(artifact.variantKey as typeof REGISTERED_VARIANTS[number])) {
      artifacts.push(artifact);
      continue;
    }
    const component = manifest.components.find(({ componentKey }) => componentKey === artifact.componentKey);
    if (!component?.authority) throw new Error(`Missing approved authority for ${artifact.componentKey}.`);
    const materialSourceVariantKey = materialSourceByVariant[artifact.variantKey as typeof REGISTERED_VARIANTS[number]];
    const materialSource = allSources.find(({ variantKey }) => variantKey === materialSourceVariantKey);
    if (!materialSource) throw new Error(`Missing stone-free material source ${materialSourceVariantKey}.`);
    let sourceCandidate = await readFile(materialSource.paths.candidatePath);
    if (artifact.variantKey === "PKDT") {
      sourceCandidate = await recolorMatteCapPink({
        basePng: sourceCandidate,
        authorityBoundsPx: component.authority.authorityBoundsPx,
      });
    }
    const decorated = await applyRegisteredRhinestones({
      basePng: sourceCandidate,
      authorityBoundsPx: component.authority.authorityBoundsPx,
      layout,
      eraseExisting: false,
    });
    const registeredSourcePath = path.join(outputDirectory, "registered-sources", `${artifact.variantKey}.png`);
    await writeFile(registeredSourcePath, decorated.png);
    const prompt = [
      `Deterministic CYL-9ML rhinestone registration ${MODEL}.`,
      `Stone-free material source: ${materialSource.candidateId} (${materialSourceVariantKey}).`,
      `Superseded generated decoration candidate: ${artifact.candidateId}.`,
      `Layout: ${layoutSha256}.`,
      `Stone IDs: ${decorated.stones.map(({ id }) => id).join(", ")}.`,
    ].join("\n");
    const candidate = await buildComponentCandidate({
      manifest,
      componentKey: artifact.componentKey,
      variantKey: artifact.variantKey,
      sourcePath: registeredSourcePath,
      originalFilename: `${artifact.variantKey}__registered-rhinestones-v1.png`,
      sourceBoundsPx: component.authority.authorityBoundsPx,
      editBoundsPx: component.authority.authorityBoundsPx,
      provider: "deterministic",
      model: MODEL,
      prompt,
      estimatedCostUsd: 0,
      outputDirectory,
    });
    artifacts.push({
      ...artifact,
      candidateId: candidate.record.candidateId,
      lifecycleState: "candidate",
      geometryLocked: candidate.record.qa.geometryLocked,
      mismatchedPixels: candidate.record.qa.mismatchedPixels,
      decorationState: "registered-layout-locked",
      paths: {
        ...artifact.paths,
        ...candidate.paths,
        registeredSourcePath,
      },
      rhinestoneRegistration: {
        policy: MODEL,
        sourceCandidateId: materialSource.candidateId,
        sourceCandidateSha256: sha256(sourceCandidate),
        materialSourceVariantKey,
        supersededGeneratedCandidateId: artifact.candidateId,
        layoutSha256,
        stones: decorated.stones,
      },
    });
  }
  const order = new Map(index.artifacts.map(({ componentKey }, position) => [componentKey, position]));
  artifacts.sort((left, right) => (order.get(left.componentKey) ?? 0) - (order.get(right.componentKey) ?? 0));
  const output = {
    ...index,
    schemaVersion: 2,
    artifacts,
    registrationPolicy: MODEL,
    registeredVariantKeys: [...REGISTERED_VARIANTS],
    replacedCandidates: REGISTERED_VARIANTS.length,
    mutationPolicy: MUTATION_POLICY,
  };
  const indexPath = path.join(outputDirectory, "generation-index.json");
  await writeFile(indexPath, `${JSON.stringify(output, null, 2)}\n`);
  return { ...output, indexPath };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const valueAfter = (flag: string) => {
    const index = args.indexOf(flag);
    return index >= 0 ? args[index + 1] : undefined;
  };
  const result = await registerCyl9RhinestoneCandidates({
    generatedDirectory: valueAfter("--generated"),
    materializedDirectory: valueAfter("--materialized"),
    outputDirectory: valueAfter("--output"),
  });
  process.stdout.write(`${JSON.stringify({
    artifacts: result.artifacts.length,
    replacedCandidates: result.replacedCandidates,
    registeredVariantKeys: result.registeredVariantKeys,
    indexPath: result.indexPath,
    mutationPolicy: result.mutationPolicy,
  }, null, 2)}\n`);
}

const invokedUrl = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (import.meta.url === invokedUrl) {
  main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
