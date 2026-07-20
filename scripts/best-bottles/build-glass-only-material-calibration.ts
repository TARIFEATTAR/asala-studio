#!/usr/bin/env tsx
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

export const GLASS_ONLY_MATERIAL_CROP = {
  left: 795,
  top: 1420,
  width: 65,
  height: 560,
} as const;

export interface GlassOnlyMaterialCalibrationRecord {
  version: "best-bottles-glass-only-material-calibration-v2";
  sourcePath: string;
  sourceSha256: string;
  sourceWidthPx: number;
  sourceHeightPx: number;
  outputPath: string;
  outputSha256: string;
  outputWidthPx: number;
  outputHeightPx: number;
  crop: { left: number; top: number; width: number; height: number };
  operation: "pixel-preserving-glass-only-crop";
  excludedIdentityRegions: [
    "closure",
    "sprayer",
    "overcap",
    "internal-hardware",
    "dip-tube",
  ];
  postGenerationMutationAllowed: false;
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export async function cropGlassOnlyMaterialCalibration(input: {
  sourcePath: string;
  sourceSha256: string;
  outputPath: string;
  recordPath: string;
  crop: { left: number; top: number; width: number; height: number };
}): Promise<GlassOnlyMaterialCalibrationRecord> {
  const sourceBytes = new Uint8Array(await readFile(input.sourcePath));
  const observedSourceSha256 = sha256(sourceBytes);
  if (observedSourceSha256 !== input.sourceSha256.toLowerCase()) {
    throw new Error(
      `Material source SHA mismatch: expected ${input.sourceSha256}, received ${observedSourceSha256}.`,
    );
  }
  const image = sharp(sourceBytes, { failOn: "error" });
  const metadata = await image.metadata();
  const sourceWidthPx = metadata.width ?? 0;
  const sourceHeightPx = metadata.height ?? 0;
  const { left, top, width, height } = input.crop;
  if (
    left < 0 || top < 0 || width <= 0 || height <= 0
    || left + width > sourceWidthPx || top + height > sourceHeightPx
  ) {
    throw new Error("Glass-only material crop exceeds the source canvas.");
  }
  const outputBytes = await image.extract(input.crop).png().toBuffer();
  await sharp(outputBytes, { failOn: "error" }).metadata();
  await writeFile(input.outputPath, outputBytes);
  const record: GlassOnlyMaterialCalibrationRecord = {
    version: "best-bottles-glass-only-material-calibration-v2",
    sourcePath: input.sourcePath,
    sourceSha256: observedSourceSha256,
    sourceWidthPx,
    sourceHeightPx,
    outputPath: input.outputPath,
    outputSha256: sha256(outputBytes),
    outputWidthPx: width,
    outputHeightPx: height,
    crop: input.crop,
    operation: "pixel-preserving-glass-only-crop",
    excludedIdentityRegions: [
      "closure",
      "sprayer",
      "overcap",
      "internal-hardware",
      "dip-tube",
    ],
    postGenerationMutationAllowed: false,
  };
  await writeFile(input.recordPath, `${JSON.stringify(record, null, 2)}\n`);
  return record;
}

async function main(): Promise<void> {
  const canonicalHash =
    "a256a5a4395f8116a3b35f7fba584d2f4b8b82706da85acce05d7b0d06bfe675";
  const outputDirectory = path.resolve(
    `tmp/best-bottles-reference-production/cylinder-six-role-pilot-v1/${canonicalHash}/material-calibration`,
  );
  await import("node:fs/promises").then(({ mkdir }) => mkdir(outputDirectory, { recursive: true }));
  const record = await cropGlassOnlyMaterialCalibration({
    sourcePath: "/Users/jordanrichter/Downloads/madison-studio-54f5c6c1.png",
    sourceSha256:
      "e2443ec95d9856105cd187c305f10785d4233d4fe0480ce2a8b521f83b462708",
    outputPath: path.join(outputDirectory, "clear-glass-sidewall-only-v2.png"),
    recordPath: path.join(outputDirectory, "clear-glass-sidewall-only-v2.json"),
    // Narrow left-sidewall swatch: physical glass edge, transmission and Bone
    // interaction only. It excludes all closure and internal hardware pixels.
    crop: GLASS_ONLY_MATERIAL_CROP,
  });
  console.log(JSON.stringify(record, null, 2));
}

const isMain = process.argv[1]
  && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
