#!/usr/bin/env tsx
import { isDeepStrictEqual } from "node:util";
import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

import sharp from "sharp";

import {
  parsePaperDollReleaseManifest,
} from "../../src/lib/paperDoll/releaseContract";
import { hashPaperDollRelease } from "../../src/lib/paperDoll/releaseHash.node";
import {
  validatePaperDollRelease,
  type PaperDollReleaseValidation,
} from "../../src/lib/paperDoll/releaseValidator";

export interface ExportWorkbenchReleaseInput {
  repositoryRoot: string;
  releaseDirectory: string;
  outputTsPath: string;
  componentAssetDirectory: string;
  canonicalBodyPathsBySha: Record<string, string>;
}

export interface ExportWorkbenchReleaseResult {
  familyKey: string;
  releaseVersion: string;
  manifestSha256: string;
  assetCount: number;
  copiedComponentFileCount: number;
}

interface VerifiedFile {
  releasePath: string;
  sourcePath: string;
  outputPath: string | null;
  sha256: string;
}

const CYL9_BODY_FILES = [
  "body__cylinder__9ml__clear__70.0x20.0mm.png",
  "body__cylinder__9ml__amber__70.0x20.0mm.png",
  "body__cylinder__9ml__cobalt__70.0x20.0mm.png",
  "body__cylinder__9ml__frosted__70.0x20.0mm.png",
  "body__cylinder__9ml__swirl__70.0x20.0mm.png",
] as const;

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function absoluteFrom(root: string, path: string): string {
  return isAbsolute(path) ? path : resolve(root, path);
}

function toImportPath(fromFile: string, targetFile: string): string {
  const raw = relative(dirname(fromFile), targetFile).split(sep).join("/");
  return raw.startsWith(".") ? raw : `./${raw}`;
}

function variableName(index: number): string {
  return `releaseAsset${String(index).padStart(2, "0")}Url`;
}

async function verifyReleaseFile(
  sourcePath: string,
  expectedSha: string,
  expectedDimensions: { widthPx: number; heightPx: number },
  label: string,
): Promise<void> {
  const bytes = await readFile(sourcePath);
  const actualSha = sha256(bytes);
  if (actualSha !== expectedSha) {
    throw new Error(`SHA-256 mismatch for '${label}': expected ${expectedSha}, received ${actualSha}.`);
  }
  const metadata = await sharp(bytes).metadata();
  if (metadata.width !== expectedDimensions.widthPx || metadata.height !== expectedDimensions.heightPx) {
    throw new Error(
      `Canvas mismatch for '${label}': expected ${expectedDimensions.widthPx}x${expectedDimensions.heightPx}, received ${metadata.width ?? "?"}x${metadata.height ?? "?"}.`,
    );
  }
}

function renderGeneratedModule(input: {
  outputTsPath: string;
  manifest: ReturnType<typeof parsePaperDollReleaseManifest>;
  validation: PaperDollReleaseValidation;
  manifestSha256: string;
  files: VerifiedFile[];
}): string {
  const files = [...input.files].sort((left, right) => left.releasePath.localeCompare(right.releasePath));
  const imports = files.map((file, index) =>
    `import ${variableName(index)} from ${JSON.stringify(`${toImportPath(input.outputTsPath, file.outputPath ?? file.sourcePath)}?url`)};`
  );
  const urlEntries = files.map((file, index) =>
    `  ${JSON.stringify(file.releasePath)}: ${variableName(index)},`
  );

  return [
    "// GENERATED FILE — DO NOT EDIT.",
    `// Source: ${input.manifest.familyKey}/${input.manifest.releaseVersion}`,
    `// Manifest SHA-256: ${input.manifestSha256}`,
    "",
    'import { parsePaperDollReleaseManifest } from "../../lib/paperDoll/releaseContract";',
    'import type { PaperDollReleaseValidation } from "../../lib/paperDoll/releaseValidator";',
    ...imports,
    "",
    `export const workbenchReleaseManifest = parsePaperDollReleaseManifest(${JSON.stringify(input.manifest, null, 2)});`,
    "",
    `export const workbenchReleaseValidation: PaperDollReleaseValidation = ${JSON.stringify(input.validation, null, 2)};`,
    "",
    `export const workbenchReleaseManifestSha256 = ${JSON.stringify(input.manifestSha256)};`,
    "",
    "export const workbenchReleaseAssetUrlsByPath: Readonly<Record<string, string>> = {",
    ...urlEntries,
    "};",
    "",
  ].join("\n");
}

export async function exportWorkbenchRelease(
  input: ExportWorkbenchReleaseInput,
): Promise<ExportWorkbenchReleaseResult> {
  const repositoryRoot = resolve(input.repositoryRoot);
  const releaseDirectory = absoluteFrom(repositoryRoot, input.releaseDirectory);
  const outputTsPath = absoluteFrom(repositoryRoot, input.outputTsPath);
  const componentAssetDirectory = absoluteFrom(repositoryRoot, input.componentAssetDirectory);
  const manifest = parsePaperDollReleaseManifest(
    JSON.parse(await readFile(resolve(releaseDirectory, "manifest.json"), "utf8")),
  );
  const recordedValidation = JSON.parse(
    await readFile(resolve(releaseDirectory, "validation.json"), "utf8"),
  ) as unknown;
  const computedValidation = validatePaperDollRelease(manifest);
  if (!isDeepStrictEqual(recordedValidation, computedValidation)) {
    throw new Error("validation.json does not match a fresh Release v1 validation result.");
  }

  const filesByReleasePath = new Map<string, VerifiedFile>();
  const registerFile = async (file: VerifiedFile, dimensions: { widthPx: number; heightPx: number }) => {
    const existing = filesByReleasePath.get(file.releasePath);
    if (existing) {
      if (existing.sha256 !== file.sha256 || existing.sourcePath !== file.sourcePath) {
        throw new Error(`Release path '${file.releasePath}' resolves to conflicting bytes.`);
      }
      return;
    }
    await verifyReleaseFile(file.sourcePath, file.sha256, dimensions, file.releasePath);
    filesByReleasePath.set(file.releasePath, file);
  };

  for (const asset of manifest.assets) {
    const dimensions = { widthPx: asset.widthPx, heightPx: asset.heightPx };
    if (asset.slot === "body") {
      const canonicalPath = input.canonicalBodyPathsBySha[asset.imageSha256];
      if (!canonicalPath) {
        throw new Error(`Unknown frozen body SHA-256 '${asset.imageSha256}' for '${asset.componentVersionId}'.`);
      }
      await registerFile({
        releasePath: asset.imagePath,
        sourcePath: absoluteFrom(repositoryRoot, canonicalPath),
        outputPath: null,
        sha256: asset.imageSha256,
      }, dimensions);
    } else {
      await registerFile({
        releasePath: asset.imagePath,
        sourcePath: resolve(releaseDirectory, asset.imagePath),
        outputPath: resolve(componentAssetDirectory, asset.imagePath),
        sha256: asset.imageSha256,
      }, dimensions);
    }
    if (asset.geometryMaskPath && asset.geometryMaskSha256) {
      await registerFile({
        releasePath: asset.geometryMaskPath,
        sourcePath: resolve(releaseDirectory, asset.geometryMaskPath),
        outputPath: resolve(componentAssetDirectory, asset.geometryMaskPath),
        sha256: asset.geometryMaskSha256,
      }, dimensions);
    }
  }

  const files = [...filesByReleasePath.values()];
  const copiedFiles = files.filter((file) => file.outputPath !== null);
  for (const file of copiedFiles) {
    await mkdir(dirname(file.outputPath!), { recursive: true });
    await copyFile(file.sourcePath, file.outputPath!);
  }

  const manifestSha256 = hashPaperDollRelease(manifest);
  const generated = renderGeneratedModule({
    outputTsPath,
    manifest,
    validation: computedValidation,
    manifestSha256,
    files,
  });
  await mkdir(dirname(outputTsPath), { recursive: true });
  await writeFile(outputTsPath, generated);

  return {
    familyKey: manifest.familyKey,
    releaseVersion: manifest.releaseVersion,
    manifestSha256,
    assetCount: manifest.assets.length,
    copiedComponentFileCount: copiedFiles.length,
  };
}

function readArg(argv: string[], name: string): string {
  const index = argv.indexOf(name);
  const value = index >= 0 ? argv[index + 1]?.trim() : "";
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

async function buildCanonicalBodyMap(repositoryRoot: string): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  for (const filename of CYL9_BODY_FILES) {
    const path = resolve(repositoryRoot, "assets", "paper-doll", "body-plates", filename);
    result[sha256(await readFile(path))] = path;
  }
  return result;
}

async function main(): Promise<void> {
  const repositoryRoot = resolve(process.cwd());
  const argv = process.argv.slice(2);
  const result = await exportWorkbenchRelease({
    repositoryRoot,
    releaseDirectory: readArg(argv, "--release-dir"),
    outputTsPath: readArg(argv, "--output-ts"),
    componentAssetDirectory: readArg(argv, "--component-asset-dir"),
    canonicalBodyPathsBySha: await buildCanonicalBodyMap(repositoryRoot),
  });
  console.log(`Family: ${result.familyKey}`);
  console.log(`Release: ${result.releaseVersion}`);
  console.log(`Manifest SHA-256: ${result.manifestSha256}`);
  console.log(`Assets: ${result.assetCount}`);
  console.log(`Copied component files: ${result.copiedComponentFileCount}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : error);
    process.exitCode = 1;
  });
}
