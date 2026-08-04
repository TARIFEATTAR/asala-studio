import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import sharp from "sharp";

import {
  inspectAuthorityMask,
  normalizeMaterialIntoAuthority,
} from "../../src/lib/paperDoll/componentPlateImage.node";
import type { PixelBounds } from "../../src/lib/paperDoll/componentPlateContract";

const DETECTION_THRESHOLDS = [8, 12, 16, 24, 32] as const;
const SELECTED_THRESHOLD = 16;

type VariantKey = "PLASTIC" | "METAL";

interface MaterialJob {
  variantKey: VariantKey;
  componentId: string;
  authorityMaskPath: string;
  prompt: string;
}

interface CandidateManifest {
  recipeId: string;
  geometryFamilyId: string;
  authorityState: string;
  blender: { authorityMaskSha256: string };
  gptMaterialPlan: {
    provider: "openai";
    model: "gpt-image-2";
    quality: "high";
    size: "2080x2288";
    jobs: MaterialJob[];
  };
}

function sha256(value: Buffer | string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function detectBrightBounds(png: Buffer, threshold: number): Promise<PixelBounds> {
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let left = info.width;
  let top = info.height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const offset = (y * info.width + x) * 3;
      if (Math.max(data[offset], data[offset + 1], data[offset + 2]) <= threshold) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  if (right < left || bottom < top) throw new Error(`No material foreground found at threshold ${threshold}.`);
  return { left, top, width: right - left + 1, height: bottom - top + 1 };
}

function assertStableCalibration(rows: Array<{ threshold: number; bounds: PixelBounds }>): void {
  const widths = rows.map(({ bounds }) => bounds.width);
  const heights = rows.map(({ bounds }) => bounds.height);
  const lefts = rows.map(({ bounds }) => bounds.left);
  const tops = rows.map(({ bounds }) => bounds.top);
  const spread = (values: number[]) => Math.max(...values) - Math.min(...values);
  if (spread(widths) > 4 || spread(heights) > 3 || spread(lefts) > 4 || spread(tops) > 3) {
    throw new Error(`Material foreground bounds are not stable across calibrated thresholds: ${JSON.stringify(rows)}.`);
  }
}

async function exactAlphaMismatch(left: Buffer, right: Buffer): Promise<number> {
  const [leftAlpha, rightAlpha] = await Promise.all([
    sharp(left).ensureAlpha().extractChannel("alpha").raw().toBuffer(),
    sharp(right).ensureAlpha().extractChannel("alpha").raw().toBuffer(),
  ]);
  if (leftAlpha.length !== rightAlpha.length) throw new Error("Alpha dimensions differ.");
  let mismatched = 0;
  for (let index = 0; index < leftAlpha.length; index++) {
    if (leftAlpha[index] !== rightAlpha[index]) mismatched++;
  }
  return mismatched;
}

async function buildContactSheet(variants: Array<{ variantKey: VariantKey; png: Buffer }>): Promise<Buffer> {
  const tileWidth = 720;
  const tileHeight = 760;
  const tiles = await Promise.all(variants.map(async ({ variantKey, png }) => {
    const component = await sharp(png)
      .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .resize({ width: 590, height: 570, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    const frame = Buffer.from(`<svg width="${tileWidth}" height="${tileHeight}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#F5F3EF"/>
      <rect x="1" y="1" width="718" height="758" fill="none" stroke="#C6A15B" stroke-width="2"/>
      <text x="48" y="650" font-family="Arial, sans-serif" font-size="32" font-weight="700" fill="#151515">${variantKey}</text>
      <text x="48" y="694" font-family="Arial, sans-serif" font-size="18" fill="#166B5E">GPT MATERIAL · EXACT-ALPHA CLAMP PASS</text>
      <text x="48" y="728" font-family="Arial, sans-serif" font-size="16" fill="#A5453C">PIXEL CANDIDATE · HUMAN MATERIAL REVIEW REQUIRED</text>
    </svg>`);
    return sharp(frame).composite([{ input: component, left: 65, top: 40 }]).png().toBuffer();
  }));
  return sharp({
    create: { width: tileWidth * tiles.length, height: tileHeight, channels: 4, background: "#151515" },
  }).composite(tiles.map((input, index) => ({ input, left: index * tileWidth, top: 0 }))).png().toBuffer();
}

export async function materializeParametricRollerMaterials(input: {
  candidateDir: string;
  rawDir: string;
  outputDir: string;
}) {
  const candidateManifestPath = path.join(input.candidateDir, "candidate-manifest.json");
  const candidateManifestBytes = await readFile(candidateManifestPath);
  const candidateManifest = JSON.parse(candidateManifestBytes.toString("utf8")) as CandidateManifest;
  const jobs = candidateManifest.gptMaterialPlan.jobs;
  if (jobs.length !== 2 || jobs[0].variantKey !== "PLASTIC" || jobs[1].variantKey !== "METAL") {
    throw new Error("Expected canonical PLASTIC then METAL material jobs.");
  }
  const authorityMaskPath = path.resolve(input.candidateDir, jobs[0].authorityMaskPath);
  if (jobs.some((job) => path.resolve(input.candidateDir, job.authorityMaskPath) !== authorityMaskPath)) {
    throw new Error("Roller variants must share one authority mask.");
  }
  const authorityMaskPng = await readFile(authorityMaskPath);
  if (sha256(authorityMaskPng) !== candidateManifest.blender.authorityMaskSha256) {
    throw new Error("Authority-mask hash differs from the candidate manifest.");
  }
  const authorityInspection = await inspectAuthorityMask(authorityMaskPng, { expectedRegions: 1 });

  await mkdir(path.join(input.outputDir, "clamped"), { recursive: true });
  const materialized = [];
  for (const job of jobs) {
    const rawPath = path.join(input.rawDir, `${job.variantKey}.png`);
    const rawPng = await readFile(rawPath);
    const metadata = await sharp(rawPng, { failOn: "error" }).metadata();
    if (metadata.width !== 2080 || metadata.height !== 2288 || metadata.format !== "png") {
      throw new Error(`${job.variantKey} provider output must be a 2080x2288 PNG.`);
    }
    const calibration = await Promise.all(DETECTION_THRESHOLDS.map(async (threshold) => ({
      threshold,
      bounds: await detectBrightBounds(rawPng, threshold),
    })));
    assertStableCalibration(calibration);
    const sourceBoundsPx = calibration.find(({ threshold }) => threshold === SELECTED_THRESHOLD)!.bounds;
    const normalized = await normalizeMaterialIntoAuthority({
      materialPng: rawPng,
      sourceBoundsPx,
      authorityMaskPng,
      expectedRegions: 1,
    });
    const outputPath = path.join(input.outputDir, "clamped", `${job.variantKey}.png`);
    await writeFile(outputPath, normalized.png);
    materialized.push({
      variantKey: job.variantKey,
      componentId: job.componentId,
      png: normalized.png,
      raw: { path: rawPath, sha256: sha256(rawPng) },
      output: { path: outputPath, sha256: sha256(normalized.png) },
      promptSha256: sha256(job.prompt),
      sourceBoundsPx,
      foregroundCalibration: {
        method: "maximum-rgb-above-black-background",
        thresholds: calibration,
        selectedThreshold: SELECTED_THRESHOLD,
      },
      exactAlpha: normalized.qa,
    });
  }
  const pairwiseAlphaMismatch = await exactAlphaMismatch(materialized[0].png, materialized[1].png);
  if (pairwiseAlphaMismatch !== 0) throw new Error(`Variant alpha differs at ${pairwiseAlphaMismatch} pixels.`);
  const contactSheet = await buildContactSheet(materialized);
  const contactSheetPath = path.join(input.outputDir, "review-contact-sheet.png");
  await writeFile(contactSheetPath, contactSheet);
  const manifest = {
    schemaVersion: 1,
    recipeId: candidateManifest.recipeId,
    geometryFamilyId: candidateManifest.geometryFamilyId,
    authorityState: candidateManifest.authorityState,
    provider: candidateManifest.gptMaterialPlan.provider,
    model: candidateManifest.gptMaterialPlan.model,
    quality: candidateManifest.gptMaterialPlan.quality,
    size: candidateManifest.gptMaterialPlan.size,
    paidGenerationAuthorized: true,
    candidateManifest: { path: candidateManifestPath, sha256: sha256(candidateManifestBytes) },
    authorityMask: {
      path: authorityMaskPath,
      sha256: sha256(authorityMaskPng),
      inspection: authorityInspection,
    },
    variants: materialized.map(({ png: _png, ...variant }) => variant),
    qa: {
      pairwiseAlphaMismatch,
      geometryLockedToRegisteredReviewMask: true,
      materialReviewRequired: true,
      familyFitRequired: ["boston-round-30ml-20-400", "boston-round-60ml-20-400"],
      productionPlateEligible: false,
    },
    reviewContactSheet: { path: contactSheetPath, sha256: sha256(contactSheet) },
    mutationPolicy: {
      paidGenerationPerformed: true,
      generationLedgerWrites: "performed-by-generate-plate-runner",
      pixelApprovalsWritten: false,
      placementWritesPerformed: false,
      currentReleaseChanged: false,
      sanityChanged: false,
    },
  };
  const manifestPath = path.join(input.outputDir, "material-manifest.json");
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return { manifestPath, contactSheetPath, manifest };
}

function valueAfter(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const candidateDir = valueAfter(args, "--candidate-dir");
  const rawDir = valueAfter(args, "--raw-dir");
  const outputDir = valueAfter(args, "--out");
  if (!candidateDir || !rawDir || !outputDir) {
    throw new Error("Usage: --candidate-dir <path> --raw-dir <path> --out <path>.");
  }
  const result = await materializeParametricRollerMaterials({ candidateDir, rawDir, outputDir });
  process.stdout.write(`${JSON.stringify({
    manifestPath: result.manifestPath,
    contactSheetPath: result.contactSheetPath,
    qa: result.manifest.qa,
    mutationPolicy: result.manifest.mutationPolicy,
  }, null, 2)}\n`);
}

const invokedUrl = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (import.meta.url === invokedUrl) {
  main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
