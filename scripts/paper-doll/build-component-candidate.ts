import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import sharp from "sharp";

import {
  parseComponentCandidate,
  parsePaperDollFamilyProductionManifest,
  type ComponentCandidate,
  type PaperDollFamilyProductionManifest,
  type PixelBounds,
} from "../../src/lib/paperDoll/componentPlateContract";
import {
  buildPlacedComponentLayer,
  normalizeMaterialIntoAuthority,
} from "../../src/lib/paperDoll/componentPlateImage.node";

export interface CandidateArtifactPaths {
  rawPath: string;
  candidatePath: string;
  layerPath: string;
  reviewPath: string;
  manifestPath: string;
}

export interface BuildComponentCandidateInput {
  manifest: PaperDollFamilyProductionManifest;
  componentKey: string;
  variantKey: string;
  sourcePath: string;
  originalFilename: string;
  sourceBoundsPx: PixelBounds;
  editBoundsPx: PixelBounds;
  provider: ComponentCandidate["provider"];
  model: string;
  prompt: string | null;
  estimatedCostUsd?: number | null;
  outputDirectory: string;
}

function sha256(bytes: Buffer | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function sameBounds(left: PixelBounds, right: PixelBounds): boolean {
  return left.left === right.left && left.top === right.top &&
    left.width === right.width && left.height === right.height;
}

function requireOriginalFilename(value: string): string {
  if (!value || /[\\/]/.test(value) || basename(value) !== value) {
    throw new Error("Original filename is required and must not contain path separators.");
  }
  return value;
}

export async function buildComponentCandidate(
  input: BuildComponentCandidateInput,
): Promise<{ record: ComponentCandidate; paths: CandidateArtifactPaths }> {
  const manifest = parsePaperDollFamilyProductionManifest(input.manifest);
  const originalFilename = requireOriginalFilename(input.originalFilename);
  const component = manifest.components.find(({ componentKey }) => componentKey === input.componentKey);
  if (!component) throw new Error(`Unknown component: ${input.componentKey}`);
  const variant = component.variants.find(({ variantKey }) => variantKey === input.variantKey);
  if (!variant) throw new Error(`Unknown variant ${input.variantKey} for ${input.componentKey}.`);
  if (component.authorityStatus !== "approved" || !component.authority) {
    throw new Error(`Component ${input.componentKey} does not have approved authority-mask evidence.`);
  }
  const placement = manifest.placements.find(
    ({ geometryFamilyId }) => geometryFamilyId === component.geometryFamilyId,
  );
  if (!placement) {
    throw new Error(`Component ${input.componentKey} has no family placement calibration.`);
  }

  const [sourcePng, authorityMaskPng] = await Promise.all([
    readFile(input.sourcePath),
    readFile(component.authority.maskPath),
  ]);
  const actualAuthoritySha = sha256(authorityMaskPng);
  if (actualAuthoritySha !== component.authority.maskSha256) {
    throw new Error(
      `Authority-mask hash mismatch for ${component.authority.authorityId}: expected ${component.authority.maskSha256}, measured ${actualAuthoritySha}.`,
    );
  }
  const sourceMetadata = await sharp(sourcePng).metadata();
  if (!sourceMetadata.width || !sourceMetadata.height) {
    throw new Error("Candidate source image dimensions could not be decoded.");
  }

  const normalized = await normalizeMaterialIntoAuthority({
    materialPng: sourcePng,
    sourceBoundsPx: input.sourceBoundsPx,
    authorityMaskPng,
    expectedRegions: component.authority.expectedRegions,
  });
  if (!sameBounds(normalized.authorityBoundsPx, component.authority.authorityBoundsPx)) {
    throw new Error("Measured authority-mask bounds differ from the registered authority bounds.");
  }
  if (!normalized.qa.geometryLocked) {
    throw new Error("Exact authority-mask clamp did not earn geometry lock.");
  }

  const placed = await buildPlacedComponentLayer({
    componentPng: normalized.png,
    canvas: manifest.canvas,
    transform: {
      widthPx: placement.widthPx,
      centerXPx: placement.centerXPx,
      seatYPx: placement.seatYPx,
    },
  });
  const sourceSha = sha256(sourcePng);
  const promptSha = input.prompt === null ? null : sha256(input.prompt);
  const normalizedSha = sha256(normalized.png);
  const layerSha = sha256(placed.layerPng);
  const candidateId = sha256(JSON.stringify({
    familyKey: manifest.familyKey,
    componentKey: component.componentKey,
    variantKey: variant.variantKey,
    sourceSha,
    authorityMaskSha256: actualAuthoritySha,
    placementVersionId: placement.locked ? placement.placementVersionId : null,
    provider: input.provider,
    model: input.model,
    promptSha,
  }));

  const paths: CandidateArtifactPaths = {
    rawPath: join(input.outputDirectory, "raw", sourceSha),
    candidatePath: join(input.outputDirectory, "candidates", `${candidateId}.png`),
    layerPath: join(input.outputDirectory, "layers", `${candidateId}.png`),
    reviewPath: join(input.outputDirectory, "review", `${candidateId}.png`),
    manifestPath: join(input.outputDirectory, "candidates", `${candidateId}.json`),
  };
  await Promise.all([
    mkdir(join(input.outputDirectory, "raw"), { recursive: true }),
    mkdir(join(input.outputDirectory, "candidates"), { recursive: true }),
    mkdir(join(input.outputDirectory, "layers"), { recursive: true }),
    mkdir(join(input.outputDirectory, "review"), { recursive: true }),
  ]);

  const record = parseComponentCandidate({
    candidateId,
    familyKey: manifest.familyKey,
    componentKey: component.componentKey,
    variantKey: variant.variantKey,
    source: {
      originalFilename,
      path: paths.rawPath,
      sha256: sourceSha,
      widthPx: sourceMetadata.width,
      heightPx: sourceMetadata.height,
    },
    sourceBoundsPx: input.sourceBoundsPx,
    editBoundsPx: input.editBoundsPx,
    authorityBoundsPx: normalized.authorityBoundsPx,
    placementBoundsPx: placed.placementBoundsPx,
    authorityMaskPath: component.authority.maskPath,
    authorityMaskSha256: actualAuthoritySha,
    normalizedCandidateSha256: normalizedSha,
    fullCanvasLayerSha256: layerSha,
    placementVersionId: placement.locked ? placement.placementVersionId : null,
    provider: input.provider,
    model: input.model,
    promptSha256: promptSha,
    estimatedCostUsd: input.estimatedCostUsd ?? null,
    qa: normalized.qa,
    mutationPolicy: { currentReleaseChanged: false, sanityChanged: false },
    lifecycleState: "candidate",
  });

  const reviewPng = await sharp({
    create: {
      width: manifest.canvas.widthPx,
      height: manifest.canvas.heightPx,
      channels: 4,
      background: manifest.canvas.backgroundHex,
    },
  }).composite([{ input: placed.layerPng, left: 0, top: 0 }]).png().toBuffer();

  await Promise.all([
    copyFile(input.sourcePath, paths.rawPath),
    writeFile(paths.candidatePath, normalized.png),
    writeFile(paths.layerPath, placed.layerPng),
    writeFile(paths.reviewPath, reviewPng),
    writeFile(paths.manifestPath, `${JSON.stringify(record, null, 2)}\n`),
  ]);
  return { record, paths };
}

function parseBounds(value: string, flag: string): PixelBounds {
  const values = value.split(",").map(Number);
  if (values.length !== 4 || values.some((item) => !Number.isInteger(item))) {
    throw new Error(`${flag} must be left,top,width,height using integers.`);
  }
  return { left: values[0], top: values[1], width: values[2], height: values[3] };
}

function parseFlags(argv: string[]): Map<string, string> {
  const flags = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!flag?.startsWith("--") || value === undefined) {
      throw new Error(`Expected --flag value pairs; received ${flag ?? "end of input"}.`);
    }
    flags.set(flag.slice(2), value);
  }
  return flags;
}

function requireFlag(flags: Map<string, string>, name: string): string {
  const value = flags.get(name);
  if (!value) throw new Error(`Missing required flag --${name}.`);
  return value;
}

async function main(): Promise<void> {
  const flags = parseFlags(process.argv.slice(2));
  const manifestPath = requireFlag(flags, "manifest");
  const promptFile = flags.get("prompt-file");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const result = await buildComponentCandidate({
    manifest,
    componentKey: requireFlag(flags, "component"),
    variantKey: requireFlag(flags, "variant"),
    sourcePath: requireFlag(flags, "source"),
    originalFilename: requireFlag(flags, "original-filename"),
    sourceBoundsPx: parseBounds(requireFlag(flags, "source-bounds"), "--source-bounds"),
    editBoundsPx: parseBounds(requireFlag(flags, "edit-bounds"), "--edit-bounds"),
    provider: requireFlag(flags, "provider") as ComponentCandidate["provider"],
    model: requireFlag(flags, "model"),
    prompt: promptFile ? await readFile(promptFile, "utf8") : null,
    outputDirectory: requireFlag(flags, "output"),
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

const invokedUrl = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (import.meta.url === invokedUrl) {
  main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
