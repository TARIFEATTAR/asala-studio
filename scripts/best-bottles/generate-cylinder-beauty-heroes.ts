#!/usr/bin/env tsx

import "dotenv/config";

import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

import sharp from "sharp";

import {
  CYLINDER_BEAUTY_HEROES,
  buildClearMasterPrompt,
  buildGeminiImageRequest,
  buildVariantPrompt,
  extractGeminiImage,
  requiresExistingClearMaster,
  type CylinderBeautyHeroDefinition,
  type GeminiInlineReference,
} from "./cylinder-beauty-heroes-core";

const BEST_BOTTLES_ROOT =
  "/Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Website-02-20-2026";
const REFERENCE_ROOT = path.join(
  BEST_BOTTLES_ROOT,
  "tmp/imagegen/cylinder-beauty-gallery-v1",
);
const OUTPUT_ROOT = path.resolve(
  process.env.CYLINDER_BEAUTY_OUTPUT_DIR
    || "outputs/best-bottles/cylinder-beauty-gallery/sandstone-v1",
);
const GEOMETRY_REFERENCE = path.join(REFERENCE_ROOT, "realtime-proportion-reference.png");
const APPROVED_CLEAR_VISUAL_MASTER = path.join(
  BEST_BOTTLES_ROOT,
  "docs/reviews/cylinder-beauty-gallery-v1/nano-banana-pro-clear-sandstone-master-watermarked.png",
);
const SANDSTONE_REFERENCE =
  "/Users/jordanrichter/Downloads/Просторная светлая комната с плоскими камнями в центре.jpeg";
const MODEL = "gemini-3-pro-image";
const API_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const MAX_ATTEMPTS = 3;

type ManifestAsset = {
  glassKey: string;
  glassLabel: string;
  model: string;
  promptSha256: string;
  rawPath: string;
  rawWidth: number;
  rawHeight: number;
  finalPath: string;
  finalWidth: number;
  finalHeight: number;
  finalSha256: string;
  generatedAt: string;
};

type Manifest = {
  familyKey: "CYL-9ML";
  assetRole: "beauty-hero";
  revision: "sandstone-v1";
  model: typeof MODEL;
  canvas: { width: 2080; height: 2288 };
  reviewStatus: "programmatic-review";
  assets: ManifestAsset[];
};

const dryRun = process.argv.includes("--dry-run");
const onlyArg = (() => {
  const index = process.argv.indexOf("--only");
  return index >= 0 ? process.argv[index + 1]?.trim().toUpperCase() : undefined;
})();

function sha256(value: Buffer | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function mimeTypeForFile(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".webp") return "image/webp";
  return "image/png";
}

function loadReference(filePath: string): GeminiInlineReference {
  if (!existsSync(filePath)) throw new Error(`Missing reference image: ${filePath}`);
  return {
    mimeType: mimeTypeForFile(filePath),
    data: readFileSync(filePath).toString("base64"),
  };
}

function targetPaths(hero: CylinderBeautyHeroDefinition) {
  return {
    raw: path.join(OUTPUT_ROOT, "raw", `cylinder-${hero.outputSlug}-sandstone-${MODEL}.png`),
    final: path.join(OUTPUT_ROOT, "final", `cylinder-${hero.outputSlug}-metal-roller-matte-silver-sandstone-v1.png`),
  };
}

async function callGemini(prompt: string, references: GeminiInlineReference[]): Promise<Buffer> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured in Madison Studio");
  const request = buildGeminiImageRequest({ prompt, references });

  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(API_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify(request.body),
      });
      const responseText = await response.text();
      if (!response.ok) {
        throw new Error(`Gemini ${response.status}: ${responseText.slice(0, 800)}`);
      }
      const image = extractGeminiImage(JSON.parse(responseText));
      return Buffer.from(image.data, "base64");
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      const retryable = /Gemini (429|5\d\d)|fetch failed|timed out|ECONNRESET/i.test(message);
      if (!retryable || attempt === MAX_ATTEMPTS) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 3000));
    }
  }
  throw lastError ?? new Error("Gemini generation failed");
}

async function finishToCanonicalCanvas(raw: Buffer, outputPath: string) {
  mkdirSync(path.dirname(outputPath), { recursive: true });
  await sharp(raw)
    .rotate()
    .resize(2080, 2288, {
      fit: "cover",
      position: "centre",
      withoutEnlargement: false,
    })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(outputPath);
  const metadata = await sharp(outputPath).metadata();
  if (metadata.width !== 2080 || metadata.height !== 2288) {
    throw new Error(`Canonical canvas failed for ${outputPath}: ${metadata.width}x${metadata.height}`);
  }
  return metadata;
}

function loadManifest(): Manifest {
  const manifestPath = path.join(OUTPUT_ROOT, "manifest.json");
  if (existsSync(manifestPath)) return JSON.parse(readFileSync(manifestPath, "utf8")) as Manifest;
  return {
    familyKey: "CYL-9ML",
    assetRole: "beauty-hero",
    revision: "sandstone-v1",
    model: MODEL,
    canvas: { width: 2080, height: 2288 },
    reviewStatus: "programmatic-review",
    assets: [],
  };
}

function saveManifest(manifest: Manifest) {
  mkdirSync(OUTPUT_ROOT, { recursive: true });
  writeFileSync(path.join(OUTPUT_ROOT, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
}

async function generateHero(hero: CylinderBeautyHeroDefinition, manifest: Manifest) {
  const paths = targetPaths(hero);
  const prompt = hero.glassKey === "CLR" ? buildClearMasterPrompt() : buildVariantPrompt(hero);
  const clearMaster = targetPaths(CYLINDER_BEAUTY_HEROES[0]).final;

  if (dryRun) {
    console.log(JSON.stringify({
      glassKey: hero.glassKey,
      model: MODEL,
      references: hero.glassKey === "CLR" ? 4 : 2,
      raw: paths.raw,
      final: paths.final,
      promptSha256: sha256(prompt),
    }));
    return;
  }

  const references = hero.glassKey === "CLR"
    ? [
      loadReference(APPROVED_CLEAR_VISUAL_MASTER),
      loadReference(GEOMETRY_REFERENCE),
      loadReference(path.join(REFERENCE_ROOT, hero.referenceFilename)),
      loadReference(SANDSTONE_REFERENCE),
    ]
    : [
      loadReference(clearMaster),
      loadReference(path.join(REFERENCE_ROOT, hero.referenceFilename)),
    ];

  console.log(`[${hero.glassKey}] generating with ${MODEL} (${references.length} references)`);
  const raw = await callGemini(prompt, references);
  mkdirSync(path.dirname(paths.raw), { recursive: true });
  writeFileSync(paths.raw, raw);
  const rawMetadata = await sharp(raw).metadata();
  const finalMetadata = await finishToCanonicalCanvas(raw, paths.final);
  const finalBytes = readFileSync(paths.final);

  const asset: ManifestAsset = {
    glassKey: hero.glassKey,
    glassLabel: hero.glassLabel,
    model: MODEL,
    promptSha256: sha256(prompt),
    rawPath: paths.raw,
    rawWidth: rawMetadata.width ?? 0,
    rawHeight: rawMetadata.height ?? 0,
    finalPath: paths.final,
    finalWidth: finalMetadata.width ?? 0,
    finalHeight: finalMetadata.height ?? 0,
    finalSha256: sha256(finalBytes),
    generatedAt: new Date().toISOString(),
  };
  manifest.assets = [
    ...manifest.assets.filter((candidate) => candidate.glassKey !== hero.glassKey),
    asset,
  ].sort((a, b) =>
    CYLINDER_BEAUTY_HEROES.findIndex((hero) => hero.glassKey === a.glassKey)
    - CYLINDER_BEAUTY_HEROES.findIndex((hero) => hero.glassKey === b.glassKey)
  );
  saveManifest(manifest);
  console.log(`[${hero.glassKey}] saved ${paths.final} (${asset.finalWidth}x${asset.finalHeight})`);
}

async function main() {
  const selected = onlyArg
    ? CYLINDER_BEAUTY_HEROES.filter((hero) => hero.glassKey === onlyArg)
    : CYLINDER_BEAUTY_HEROES;
  if (selected.length === 0) {
    throw new Error(`Unknown --only glass key: ${onlyArg}. Use CLR, AMB, BLU, FRS, or SWL.`);
  }
  if (
    requiresExistingClearMaster(selected.map((hero) => hero.glassKey))
    && !existsSync(targetPaths(CYLINDER_BEAUTY_HEROES[0]).final)
  ) {
    throw new Error("Generate CLR first; material variants require the clean locked Clear master.");
  }

  const manifest = loadManifest();
  for (const hero of selected) {
    await generateHero(hero, manifest);
  }
}

await main();
