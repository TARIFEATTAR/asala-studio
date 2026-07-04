#!/usr/bin/env tsx
/**
 * Best Bottles — production family-parametrized bulk generation runner.
 *
 * This is the batch sibling of `scripts/best-bottles/live-cylinder-smoke.ts`.
 * It drives REAL image generation for an entire product family (Cylinder first,
 * ~113 SKUs with a live https reference today) through the live pipeline. It
 * spends real money and writes to Supabase, so correctness matters.
 *
 * WHAT IT SHARES WITH live-cylinder-smoke.ts (byte-for-byte identical request):
 *   - buildBestBottlesPromptPreflight → precompiledPromptRecord via
 *     buildCylinderSmokePromptRecord (canon-framing default; no cap/volume cues).
 *   - buildBestBottlesGenerationIdentity + getBestBottlesGenerationIdentityIssue.
 *   - The exact `generate-madison-image` request body shape (prompt,
 *     referenceImages, productContext, extraLibraryTags, precompiledPromptRecord,
 *     imageConstraints, aiProvider, resolution, proModeControls, …).
 *   - The rig postprocess step in a Playwright page
 *     (colorCorrectToTarget → normalizeBestBottlesRigBaseline) and the patch of
 *     generated_images.image_url to the rigged URL.
 *
 * WHAT DIFFERS (the point of this runner):
 *   1. Targets are sourced DYNAMICALLY from the live
 *      `best_bottles_pipeline_sku_jobs` table (family arg), filtered to rows that
 *      carry a usable https `best_reference_candidate_path` (a public reference
 *      URL in Supabase Storage). Product metadata is joined from the Convex
 *      snapshot. The reference URL is passed straight through — the pipeline
 *      already consumes `best_reference_candidate_path`, so we do NOT re-upload a
 *      local file (unlike the smoke script, which uploads local flattened PNGs).
 *   2. Resilience: each SKU is wrapped in try/catch with N retries (default 2)
 *      on transient failures INCLUDING rig-QA failures and edge errors. One SKU
 *      failing never aborts the batch.
 *   3. Bounded concurrency (default 2; env BB_GEN_CONCURRENCY). One Playwright
 *      page per concurrent slot so the rig step is safe under concurrency.
 *   4. An incrementally-updated manifest JSON is written after every SKU, so a
 *      killed run is resumable and idempotent (already-`rendered` SKUs skip).
 *   5. --family / --limit / --dry-run flags.
 *
 * Usage:
 *   # DRY RUN — resolve targets, build preflight/prompt, no generation, no rig:
 *   npm run bestbottles:generation:run-family -- --dry-run --family Cylinder
 *
 *   # REAL batch (spends money, writes to Supabase):
 *   npm run bestbottles:generation:run-family -- --family Cylinder
 *
 *   # Bounded/limited real batch:
 *   BB_GEN_CONCURRENCY=3 npm run bestbottles:generation:run-family -- --family Cylinder --limit 25
 *
 * Resume: re-running with the same --family + manifest path skips SKUs already
 * marked `rendered` in the manifest. Pass --manifest <path> to pin the file.
 *
 * Env (mirrors live-cylinder-smoke.ts where noted):
 *   BB_GEN_AI_PROVIDER        default openai-image-2   (smoke: BB_SMOKE_AI_PROVIDER)
 *   BB_GEN_PROMPT_MODE        canon-framing | canon-only
 *   BB_GEN_RESOLUTION         standard | high | 4k
 *   BB_GEN_PROMPT_ADDENDUM    (optional smoke addendum id)
 *   BB_GEN_SKIP_RIG_POSTPROCESS=1   skip the Playwright rig step
 *   BB_GEN_CONCURRENCY        default 2
 *   BB_GEN_MAX_ATTEMPTS       default 2
 *   MADISON_BEST_BOTTLES_ORG_ID / MADISON_BEST_BOTTLES_USER_ID  (defaults below)
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";
import { chromium, type Browser, type Page } from "playwright";

import { IMAGE_PRESETS } from "../../src/config/imagePresets";
import { inferBestBottlesBodyMaterial } from "../../src/lib/bestBottlesBodyMaterial";
import { buildBestBottlesPromptPreflight } from "../../src/lib/bestBottlesPromptPreflight";
import {
  buildBestBottlesGenerationIdentity,
  getBestBottlesGenerationIdentityIssue,
} from "../../src/lib/bestBottlesGenerationIdentity";
import { getBestBottlesReferenceUrlIssue } from "../../src/lib/bestBottlesReferenceValidation";
import { getExactOutputCanvasConstraints } from "../../src/lib/product-image/exactOutputCanvas";
import { loadPromptSystem } from "../generate-prompts";
import {
  buildCylinderSmokePromptRecord,
  getCylinderSmokePromptMode,
  getCylinderSmokeResolution,
} from "./cylinder-smoke-prompt-mode";
import {
  applySmokePromptAddendum,
  getSmokePromptAddendum,
} from "./smoke-prompt-addendums";

type ProductRow = Record<string, unknown>;

const ROOT =
  "/Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Website-02-20-2026";
const convexSnapshotPath = `${ROOT}/data/audits/2026-06-27-framing-profiles/convex_snapshot.json`;

const ORG_ID =
  process.env.MADISON_BEST_BOTTLES_ORG_ID || "4ab1ac72-cd7e-4faf-9152-5aa5f2862411";
const USER_ID =
  process.env.MADISON_BEST_BOTTLES_USER_ID || "d4cd4ae9-a9a8-4ea6-ab6f-fd1e19078e5e";

const preset = IMAGE_PRESETS["grid-card-2000x2200"];
if (!preset) throw new Error("Missing grid-card-2000x2200 preset.");

const aiProvider = process.env.BB_GEN_AI_PROVIDER?.trim() || "openai-image-2";
const allowBestBottlesProviderOverride = !/^openai|^gpt-image|^dall-e/i.test(aiProvider);
const skipRigPostprocess = process.env.BB_GEN_SKIP_RIG_POSTPROCESS === "1";
const promptAddendum = getSmokePromptAddendum(process.env.BB_GEN_PROMPT_ADDENDUM);
const promptMode = getCylinderSmokePromptMode(process.env.BB_GEN_PROMPT_MODE);
const resolution = getCylinderSmokeResolution(process.env.BB_GEN_RESOLUTION);
const concurrency = Math.max(1, Number(process.env.BB_GEN_CONCURRENCY || "2") || 2);
const maxAttempts = Math.max(1, Number(process.env.BB_GEN_MAX_ATTEMPTS || "2") || 2);

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
function getArg(name: string, fallback = ""): string {
  const i = process.argv.indexOf(name);
  if (i < 0) return fallback;
  const v = process.argv[i + 1];
  if (!v || v.startsWith("--")) return fallback;
  return v;
}
const family = getArg("--family", "Cylinder");
const dryRun = process.argv.includes("--dry-run");
const limitArg = getArg("--limit", "");
const limit = limitArg ? Math.max(0, Number(limitArg) || 0) : null;

const runId = new Date().toISOString().replace(/[:.]/g, "-");
const familySlug = family.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "unknown";
const manifestPath = path.resolve(
  getArg("--manifest", `tmp/bestbottles-generation/${familySlug}-family-batch.json`),
);

// ---------------------------------------------------------------------------
// env + Supabase
// ---------------------------------------------------------------------------
function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const file of [".env", ".env.local"]) {
    try {
      for (const line of readFileSync(file, "utf8").split(/\n/)) {
        const match = line.match(/^\s*([A-Za-z0-9_]+)=(.*)$/);
        if (!match) continue;
        env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
      }
    } catch {
      // Optional env files.
    }
  }
  return env;
}
const env = loadEnv();
const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) {
  throw new Error("Missing Supabase URL or service role key.");
}
const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
});

// ---------------------------------------------------------------------------
// Convex snapshot → product (mirrors live-cylinder-smoke.ts productFromSnapshot)
// ---------------------------------------------------------------------------
function getText(row: ProductRow, key: string): string | null {
  const value = row[key];
  return typeof value === "string" ? value : value == null ? null : String(value);
}
function getNumber(row: ProductRow, key: string): number | null {
  const value = row[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
function productFromSnapshot(row: ProductRow) {
  return {
    graceSku: getText(row, "graceSku"),
    websiteSku: getText(row, "websiteSku"),
    itemName: getText(row, "itemName"),
    itemDescription: getText(row, "itemDescription"),
    bottleCollection: getText(row, "bottleCollection"),
    family: getText(row, "family"),
    category: getText(row, "category"),
    color: getText(row, "color"),
    capacityMl: getNumber(row, "capacityMl"),
    applicator: getText(row, "applicator"),
    capColor: getText(row, "capColor"),
    trimColor: getText(row, "trimColor"),
    capStyle: getText(row, "capStyle"),
    heightWithoutCap: getText(row, "heightWithoutCap"),
    heightWithCap: getText(row, "heightWithCap"),
    diameter: getText(row, "diameter"),
  };
}
type BBProduct = ReturnType<typeof productFromSnapshot>;

function promptHeader(prompt: string): string | null {
  return prompt
    .split("\n")
    .find((line) => /FRAMING PROFILE \(CANVAS COMPOSITION AUTHORITY\):/.test(line)) ?? null;
}

// ---------------------------------------------------------------------------
// Target = live sku-job row + joined product + resolved reference URL
// ---------------------------------------------------------------------------
interface SkuJobRow {
  grace_sku: string;
  website_sku: string | null;
  family: string;
  product_group_slug: string | null;
  best_reference_candidate_path: string | null;
  coverage_status: string | null;
  status: string | null;
}
interface FamilyTarget {
  sku: string;
  productGroupSlug: string;
  referenceUrl: string;
  product: BBProduct;
}
interface Skip {
  sku: string;
  productGroupSlug: string | null;
  reason: string;
}

// ---------------------------------------------------------------------------
// Manifest (resume + inspectability)
// ---------------------------------------------------------------------------
type RunStatus = "rendered" | "skipped" | "failed";
interface ManifestEntry {
  graceSku: string;
  websiteSku: string | null;
  productGroupSlug: string;
  status: RunStatus;
  attempts: number;
  savedImageId: string | null;
  imageUrl: string | null;
  rawImageUrl: string | null;
  qaIssues: string[];
  error: string | null;
  elapsedMs: number;
  updatedAt: string;
}
interface Manifest {
  runId: string;
  family: string;
  provider: string;
  promptMode: string;
  resolution: string;
  entries: Record<string, ManifestEntry>;
}

function loadManifest(): Manifest {
  try {
    const parsed = JSON.parse(readFileSync(manifestPath, "utf8")) as Manifest;
    if (parsed && parsed.entries && parsed.family === family) return parsed;
  } catch {
    // fresh
  }
  return {
    runId,
    family,
    provider: aiProvider,
    promptMode,
    resolution,
    entries: {},
  };
}
const manifest = loadManifest();
let manifestDirty = false;
function persistManifest(): void {
  mkdirSync(path.dirname(manifestPath), { recursive: true });
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  manifestDirty = false;
}
function recordManifest(entry: ManifestEntry): void {
  manifest.entries[entry.graceSku] = entry;
  manifestDirty = true;
  persistManifest();
}

// ---------------------------------------------------------------------------
// Rig postprocess — identical semantics to live-cylinder-smoke.ts
// (upload to generated-images, patch generated_images.image_url to rigged URL).
// Cap/mode are always null for family batch (no per-SKU cap-off staging list);
// the smoke script's cap-off cases are hand-curated and out of scope here.
// ---------------------------------------------------------------------------
async function rigPostprocessOutput(input: {
  page: Page;
  imageUrl: string;
  savedImageId: string;
  product: BBProduct;
  sku: string;
}): Promise<{ imageUrl: string; qaIssues: string[] }> {
  const rigged = await input.page.evaluate(
    async ({ imageUrl, product }) => {
      const [{ colorCorrectToTarget }, { normalizeBestBottlesRigBaseline }] = await Promise.all([
        import("/src/lib/product-image/colorCorrect.ts"),
        import("/src/lib/product-image/rigPostprocess.ts"),
      ]);
      const correctedDataUrl = await colorCorrectToTarget(imageUrl, "#F5F3EF");
      return normalizeBestBottlesRigBaseline(correctedDataUrl, {
        family: product.family,
        bottleCollection: product.bottleCollection,
        graceSku: product.graceSku,
        websiteSku: product.websiteSku,
        itemName: product.itemName,
        itemDescription: product.itemDescription,
        applicator: product.applicator,
        capacityMl: product.capacityMl,
        heightWithCap: product.heightWithCap,
        heightWithoutCap: product.heightWithoutCap,
        diameter: product.diameter,
        capState: null,
        mode: null,
        targetBackgroundHex: "#F5F3EF",
        maskReferenceUrl: null,
        requireMaskControl: false,
      });
    },
    { imageUrl: input.imageUrl, product: input.product },
  );

  if (rigged.detectedBaselineYPx === null || rigged.targetBaselineYPx === null) {
    throw new Error(`${input.sku} rig postprocess failed: baseline was not detectable.`);
  }
  if (rigged.qaIssues.length > 0) {
    // Surface QA failures to the retry loop so they trigger a regeneration.
    throw new Error(`${input.sku} rig postprocess failed: ${rigged.qaIssues.join(" ")}`);
  }

  const base64 = rigged.dataUrl.replace(/^data:image\/png;base64,/, "");
  const bytes = Buffer.from(base64, "base64");
  const riggedPath =
    `${ORG_ID}/${USER_ID}/family-batch/${familySlug}-${runId}/rigged/${input.sku}__rigged.png`;
  const upload = await supabase.storage
    .from("generated-images")
    .upload(riggedPath, bytes, {
      contentType: "image/png",
      cacheControl: "3600",
      upsert: true,
    });
  if (upload.error) {
    throw new Error(`${input.sku} rigged upload failed: ${upload.error.message}`);
  }
  const { data: publicUrlData } = supabase.storage.from("generated-images").getPublicUrl(riggedPath);
  if (!publicUrlData.publicUrl) throw new Error(`${input.sku} rigged upload returned no URL.`);

  const { error: updateError } = await supabase
    .from("generated_images")
    .update({ image_url: publicUrlData.publicUrl })
    .eq("id", input.savedImageId);
  if (updateError) {
    throw new Error(`${input.sku} rigged row update failed: ${updateError.message}`);
  }

  return { imageUrl: publicUrlData.publicUrl, qaIssues: rigged.qaIssues };
}

// ---------------------------------------------------------------------------
// Per-SKU generation — one attempt. Throws on any failure (caught by retry).
// Body shape is IDENTICAL to live-cylinder-smoke.ts.
// ---------------------------------------------------------------------------
const system = loadPromptSystem(process.cwd());

interface GenerationOutcome {
  savedImageId: string;
  rawImageUrl: string;
  finalImageUrl: string;
  qaIssues: string[];
}

function buildBodyForTarget(target: FamilyTarget) {
  const product = target.product;
  const referenceUrl = target.referenceUrl;
  const bodyMaterial = inferBestBottlesBodyMaterial(product);

  const promptPreflight = buildBestBottlesPromptPreflight({
    product,
    referenceImagePath: referenceUrl,
    bodyMaterial,
    canvas: preset.canvas,
    system,
  });
  if (promptPreflight.status === "error" || !promptPreflight.record) {
    throw new Error(`${target.sku} prompt preflight blocked: ${promptPreflight.issue ?? "missing record"}`);
  }
  if (!promptPreflight.sku) {
    throw new Error(`${target.sku} prompt preflight returned no SKU record.`);
  }
  const promptRecord = buildCylinderSmokePromptRecord({
    record: promptPreflight.record,
    sku: promptPreflight.sku,
    mode: promptMode,
  });
  const finalPrompt = applySmokePromptAddendum(promptRecord.final_prompt, promptAddendum);
  const precompiledPromptRecord = promptAddendum
    ? {
        ...promptRecord,
        final_prompt: finalPrompt,
        qa_checklist: [...promptRecord.qa_checklist, `smoke_prompt_addendum:${promptAddendum.id}`],
      }
    : promptRecord;

  const identity = buildBestBottlesGenerationIdentity(product, {
    bodyMaterial,
    sourceReference: referenceUrl,
  });
  const identityIssue = getBestBottlesGenerationIdentityIssue(identity);
  if (identityIssue) throw new Error(`${target.sku} identity blocked: ${identityIssue}`);

  const extraLibraryTags = [
    "sku-preset",
    `preset:${preset.id}`,
    `canvas:${preset.canvas.widthPx}x${preset.canvas.heightPx}`,
    "brand:best-bottles",
    "studio-master",
    "prompt-source:json-precompiler",
    "family-batch:live",
    `family-run:${runId}`,
    `prompt-family:${promptPreflight.sku?.product_family}`,
    `prompt-material:${promptPreflight.sku?.body_material}`,
    `prompt-closure:${promptPreflight.sku?.closure_type}`,
    `prompt-frame:${promptPreflight.sku?.frame_class}`,
    `prompt-qa:${promptPreflight.status}`,
    `smoke-prompt-mode:${promptMode}`,
    `smoke-resolution:${resolution}`,
    `family:${String(product.family ?? "unknown").toLowerCase().replace(/\s+/g, "-")}`,
    `sku:${target.sku}`,
    product.websiteSku ? `websiteSku:${product.websiteSku}` : null,
    `product-group:${target.productGroupSlug}`,
    "reference-lineage:job-table-candidate",
    "truth-ref:best-reference-candidate-path",
    `model:${aiProvider}`,
    promptAddendum ? `prompt-addendum:${promptAddendum.id}` : null,
    "reference-source:sku-job",
    `prompt:${identity.promptVersion}`,
    `rig:${identity.rigVersion}`,
    `identity:${identity.identityHash}`,
    `qa:${identity.qaStatus}`,
  ].filter((tag): tag is string => Boolean(tag));

  const body = {
    prompt: finalPrompt,
    userId: USER_ID,
    organizationId: ORG_ID,
    goalType: "product_photography",
    aspectRatio: preset.aspectRatio,
    outputFormat: "png",
    referenceImages: [
      {
        url: referenceUrl,
        label: "Product Reference",
        description: [
          "Use this image as an exact product-identity lock: preserve the bottle geometry, camera angle, scale relationships, body material/substrate",
          `(${bodyMaterial}), cap texture, fitment, applicator, body color, hose/bulb/tassel color, collar/ring details, reducer finish, trim metal, and all surface details.`,
          "Do not redesign, restyle, recolor, rotate, or reinterpret the product components.",
          "Do allow luxury catalog staging, lighting, background replacement, shadow, and refined PDP canvas placement as instructed by the server prompt.",
        ].join(" "),
      },
    ],
    proModeControls: { productAccuracy: "strict" },
    aiProvider,
    allowBestBottlesProviderOverride,
    resolution,
    imageConstraints: getExactOutputCanvasConstraints(preset.canvas),
    extraLibraryTags,
    productContext: {
      name: product.itemName,
      websiteSku: product.websiteSku ?? null,
      itemDescription: product.itemDescription ?? null,
      collection: product.bottleCollection ?? undefined,
      family: product.family,
      category: product.category,
      presetId: preset.id,
      capState: null,
      mode: null,
      bodyMaterial,
      color: product.color ?? null,
      sku: product.graceSku,
      capacityMl: product.capacityMl,
      heightWithoutCap: product.heightWithoutCap,
      heightWithCap: product.heightWithCap,
      diameter: product.diameter,
      capColor: identity.capColor,
      trimColor: product.trimColor ?? null,
      applicator: product.applicator ?? null,
      tasselColor: identity.tasselColor,
      bulbColor: identity.bulbColor,
      hoseColor: identity.hoseColor,
      collarFinish: identity.collarFinish,
      ringPresent: identity.ringPresent,
      accessoryCode: identity.accessoryCode,
      reducerFinish: identity.reducerFinish,
      sourceReference: identity.sourceReference,
      referenceWorkflow: "single-flattened-product-truth",
      maskReference: null,
      maskQcStatus: null,
      identityStatus: identity.identityStatus,
      identityBlockers: identity.identityBlockers,
      identityHash: identity.identityHash,
      promptVersion: identity.promptVersion,
      rigVersion: identity.rigVersion,
      qaStatus: identity.qaStatus,
      canvas: identity.canvas,
    },
    precompiledPromptRecord,
  };

  return { body, finalPrompt, precompiledPromptRecord };
}

async function generateOnce(target: FamilyTarget, page: Page | null): Promise<GenerationOutcome> {
  const { body } = buildBodyForTarget(target);

  const { data, error } = await supabase.functions.invoke("generate-madison-image", { body });
  if (error) {
    let bodyText = "";
    const context = (error as unknown as { context?: { json?: () => Promise<unknown>; text?: () => Promise<string> } }).context;
    try {
      if (context?.json) bodyText = JSON.stringify(await context.json());
      else if (context?.text) bodyText = await context.text();
    } catch {
      bodyText = "";
    }
    throw new Error(
      `${target.sku} generation failed: ${error.message ?? JSON.stringify(error)}${bodyText ? ` body=${bodyText.slice(0, 1000)}` : ""}`,
    );
  }
  // Heartbeat-streaming responses report post-defer failures as HTTP 200 with an
  // `error` field in the body — treat those as hard failures.
  if (typeof data?.error === "string" && data.error.trim()) {
    throw new Error(`${target.sku} generation failed (streamed error): ${data.error}`);
  }
  if (!data?.imageUrl || !data?.savedImageId) {
    throw new Error(`${target.sku} generation returned incomplete response: ${JSON.stringify(data)}`);
  }

  const rawImageUrl = data.imageUrl as string;
  const savedImageId = data.savedImageId as string;

  const rigged = page
    ? await rigPostprocessOutput({ page, imageUrl: rawImageUrl, savedImageId, product: target.product, sku: target.sku })
    : null;

  return {
    savedImageId,
    rawImageUrl,
    finalImageUrl: rigged?.imageUrl ?? rawImageUrl,
    qaIssues: rigged?.qaIssues ?? [],
  };
}

async function generateWithRetry(target: FamilyTarget, page: Page | null): Promise<ManifestEntry> {
  const startedAt = Date.now();
  let attempts = 0;
  let lastError: string | null = null;
  while (attempts < maxAttempts) {
    attempts += 1;
    try {
      const outcome = await generateOnce(target, page);
      return {
        graceSku: target.sku,
        websiteSku: target.product.websiteSku,
        productGroupSlug: target.productGroupSlug,
        status: "rendered",
        attempts,
        savedImageId: outcome.savedImageId,
        imageUrl: outcome.finalImageUrl,
        rawImageUrl: outcome.rawImageUrl,
        qaIssues: outcome.qaIssues,
        error: null,
        elapsedMs: Date.now() - startedAt,
        updatedAt: new Date().toISOString(),
      };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      console.error(`  [${target.sku}] attempt ${attempts}/${maxAttempts} failed: ${lastError}`);
      if (attempts < maxAttempts) {
        await new Promise((r) => setTimeout(r, 1500 * attempts));
      }
    }
  }
  return {
    graceSku: target.sku,
    websiteSku: target.product.websiteSku,
    productGroupSlug: target.productGroupSlug,
    status: "failed",
    attempts,
    savedImageId: null,
    imageUrl: null,
    rawImageUrl: null,
    qaIssues: [],
    error: lastError,
    elapsedMs: Date.now() - startedAt,
    updatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Target resolution
// ---------------------------------------------------------------------------
async function resolveTargets(): Promise<{ targets: FamilyTarget[]; skips: Skip[] }> {
  const { data: jobRows, error } = await supabase
    .from("best_bottles_pipeline_sku_jobs")
    .select("grace_sku,website_sku,family,product_group_slug,best_reference_candidate_path,coverage_status,status")
    .eq("organization_id", ORG_ID)
    .eq("family", family);
  if (error) throw new Error(`Failed to read sku jobs: ${error.message}`);

  const snapshot = JSON.parse(readFileSync(convexSnapshotPath, "utf8")) as { products: ProductRow[] };
  const productBySku = new Map<string, ProductRow>();
  for (const row of snapshot.products) {
    const sku = getText(row, "graceSku");
    if (sku) productBySku.set(sku, row);
  }

  const targets: FamilyTarget[] = [];
  const skips: Skip[] = [];

  for (const job of (jobRows ?? []) as SkuJobRow[]) {
    const sku = job.grace_sku;
    const productGroupSlug = job.product_group_slug ?? "unknown";
    const referenceUrl = String(job.best_reference_candidate_path ?? "").trim();

    // Skip SKUs already rendered in an existing manifest (idempotent resume).
    if (manifest.entries[sku]?.status === "rendered") {
      skips.push({ sku, productGroupSlug, reason: "already-rendered (manifest resume)" });
      continue;
    }

    // Resolve the reference: must be a usable public https image URL.
    const refIssue = getBestBottlesReferenceUrlIssue(referenceUrl);
    if (refIssue) {
      skips.push({ sku, productGroupSlug, reason: `no usable reference: ${refIssue}` });
      continue;
    }

    const productRow = productBySku.get(sku);
    if (!productRow) {
      skips.push({ sku, productGroupSlug, reason: "no Convex product metadata (snapshot join miss)" });
      continue;
    }
    const product = productFromSnapshot(productRow);

    // Exclude identity-blocked SKUs (same gate the runner enforces per attempt).
    const bodyMaterial = inferBestBottlesBodyMaterial(product);
    const identity = buildBestBottlesGenerationIdentity(product, { bodyMaterial, sourceReference: referenceUrl });
    const identityIssue = getBestBottlesGenerationIdentityIssue(identity);
    if (identityIssue) {
      skips.push({ sku, productGroupSlug, reason: `identity blocked: ${identityIssue}` });
      continue;
    }

    targets.push({ sku, productGroupSlug, referenceUrl, product });
  }

  targets.sort((a, b) => a.sku.localeCompare(b.sku));
  return { targets, skips };
}

function groupCounts<T>(items: T[], key: (item: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of items) {
    const k = key(item);
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Concurrency runner (one Playwright page per slot)
// ---------------------------------------------------------------------------
async function runBatch(targets: FamilyTarget[], pages: (Page | null)[]): Promise<void> {
  let cursor = 0;
  let rendered = 0;
  let failed = 0;
  const total = targets.length;
  const workers = pages.map(async (page) => {
    while (cursor < targets.length) {
      const index = cursor++;
      const target = targets[index];
      console.log(`[${index + 1}/${total}] ${target.sku} (${target.productGroupSlug}) …`);
      const entry = await generateWithRetry(target, page);
      recordManifest(entry);
      if (entry.status === "rendered") {
        rendered += 1;
        console.log(`  ✓ ${target.sku} → ${entry.imageUrl} (${entry.attempts} attempt(s), ${entry.elapsedMs}ms)`);
      } else {
        failed += 1;
        console.log(`  ✗ ${target.sku} FAILED after ${entry.attempts} attempt(s): ${entry.error}`);
      }
    }
  });
  await Promise.all(workers);
  console.log(`\nBatch complete: rendered=${rendered} failed=${failed} total=${total}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  console.log(`=== Best Bottles family batch — family="${family}" run=${runId} ===`);
  console.log(`provider=${aiProvider} promptMode=${promptMode} resolution=${resolution} concurrency=${concurrency} maxAttempts=${maxAttempts}`);
  console.log(`manifest: ${path.relative(process.cwd(), manifestPath)}`);
  console.log(`dryRun=${dryRun} limit=${limit ?? "none"} rig=${skipRigPostprocess ? "SKIPPED" : "on"}`);

  const { targets: allTargets, skips } = await resolveTargets();
  const targets = limit != null ? allTargets.slice(0, limit) : allTargets;

  const perGroup = groupCounts(targets, (t) => t.productGroupSlug);
  const skipReasons = groupCounts(skips, (s) => s.reason.replace(/:.*/, ""));

  console.log(`\n=== RESOLUTION ===`);
  console.log(`ready-to-generate targets : ${targets.length}${limit != null && allTargets.length > targets.length ? ` (of ${allTargets.length}, limited)` : ""}`);
  console.log(`skips                     : ${skips.length}`);
  console.log(`product groups            : ${Object.keys(perGroup).length}`);
  console.log(`\nper-product-group counts:`);
  for (const [group, count] of Object.entries(perGroup).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${count.toString().padStart(3)}  ${group}`);
  }
  console.log(`\nskip reasons:`);
  for (const [reason, count] of Object.entries(skipReasons).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${count.toString().padStart(3)}  ${reason}`);
  }

  if (dryRun) {
    // Build the prompt for one sample target to prove canon markers + no cap/vol cues.
    const sample = targets[0];
    if (sample) {
      const { finalPrompt } = buildBodyForTarget(sample);
      const hasEnhanceMarker = /You are enhancing the attached product reference image/.test(finalPrompt);
      const framingHeader = promptHeader(finalPrompt);
      // Cap/volume cue lines were removed today — assert none survive.
      const capVolumeCue = finalPrompt
        .split("\n")
        .find((line) => /\bcap[- ]?(on|off)\b|\bvolume cue\b|\bfill line\b|\bml of\b/i.test(line)) ?? null;
      console.log(`\n=== SAMPLE PROMPT CHECK (${sample.sku}) ===`);
      console.log(`enhance marker present       : ${hasEnhanceMarker}`);
      console.log(`FRAMING PROFILE block present: ${Boolean(framingHeader)}`);
      if (framingHeader) console.log(`  ${framingHeader.trim()}`);
      console.log(`cap/volume cue line present  : ${capVolumeCue ? `YES → ${capVolumeCue.trim()}` : "no"}`);
    } else {
      console.log(`\n(no targets resolved — nothing to sample)`);
    }
    console.log(`\nDRY RUN — no generation, no rig, no Supabase writes.`);
    return;
  }

  if (targets.length === 0) {
    console.log(`\nNothing to generate.`);
    return;
  }

  // Real run — persist an initial manifest, then run bounded concurrency.
  persistManifest();

  let browser: Browser | null = null;
  const pages: (Page | null)[] = [];
  try {
    if (!skipRigPostprocess) {
      browser = await chromium.launch({ headless: true });
      for (let i = 0; i < concurrency; i++) {
        const page = await browser.newPage();
        await page.goto("http://127.0.0.1:8081/", { waitUntil: "domcontentloaded" });
        pages.push(page);
      }
    } else {
      for (let i = 0; i < concurrency; i++) pages.push(null);
    }

    await runBatch(targets, pages);
  } finally {
    await browser?.close();
    if (manifestDirty) persistManifest();
    console.log(`\nManifest written: ${path.relative(process.cwd(), manifestPath)}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
