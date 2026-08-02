import { readFileSync } from "node:fs";
import { basename, extname } from "node:path";

import { createClient } from "@supabase/supabase-js";
import { chromium, type Page } from "playwright";
import sharp from "sharp";

import { IMAGE_PRESETS } from "../../src/config/imagePresets";
import { BEST_BOTTLES_VISUAL_TARGET_CANVAS_HEX } from "../../src/config/bestBottlesVisualTarget";
import { inferBestBottlesBodyMaterial } from "../../src/lib/bestBottlesBodyMaterial";
import { buildBestBottlesPromptPreflight } from "../../src/lib/bestBottlesPromptPreflight";
import {
  buildBestBottlesGenerationIdentity,
  getBestBottlesGenerationIdentityIssue,
} from "../../src/lib/bestBottlesGenerationIdentity";
import { getExactOutputCanvasConstraints } from "../../src/lib/product-image/exactOutputCanvas";
import { assemblePrompt } from "../../src/lib/product-image/promptAssembler";
import { loadPromptSystem } from "../generate-prompts";
import { selectCylinderSmokeTargets } from "./cylinder-smoke-targets";
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

const userId = "d4cd4ae9-a9a8-4ea6-ab6f-fd1e19078e5e";
const organizationId = "4ab1ac72-cd7e-4faf-9152-5aa5f2862411";
const preset = IMAGE_PRESETS["grid-card-2000x2200"];
if (!preset) throw new Error("Missing grid-card-2000x2200 preset.");
const smokeAiProvider = process.env.BB_SMOKE_AI_PROVIDER?.trim() || "openai-image-2";
const allowBestBottlesProviderOverride = !/^openai|^gpt-image|^dall-e/i.test(smokeAiProvider);
const skipRigPostprocess = process.env.BB_SMOKE_SKIP_RIG_POSTPROCESS === "1";
const smokePromptAddendum = getSmokePromptAddendum(process.env.BB_SMOKE_PROMPT_ADDENDUM);
const smokePromptMode = getCylinderSmokePromptMode(process.env.BB_SMOKE_PROMPT_MODE);
const smokeResolution = getCylinderSmokeResolution(process.env.BB_SMOKE_RESOLUTION);

const runId = new Date().toISOString().replace(/[:.]/g, "-");

const targets = selectCylinderSmokeTargets(process.env.BB_SMOKE_SKUS);
if (targets.length === 0) {
  throw new Error(`No smoke-test targets matched BB_SMOKE_SKUS=${process.env.BB_SMOKE_SKUS ?? ""}`);
}

function parseReferenceOverrides(value: string | undefined): Map<string, string> {
  const overrides = new Map<string, string>();
  if (!value?.trim()) return overrides;

  for (const entry of value.split(",")) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) {
      throw new Error(`Invalid BB_SMOKE_REFERENCE_OVERRIDES entry: ${trimmed}`);
    }
    const sku = trimmed.slice(0, separatorIndex).trim();
    const reference = trimmed.slice(separatorIndex + 1).trim();
    if (!sku || !reference) {
      throw new Error(`Invalid BB_SMOKE_REFERENCE_OVERRIDES entry: ${trimmed}`);
    }
    overrides.set(sku, reference);
  }

  return overrides;
}

function getReferenceContentType(referencePath: string, format: string | undefined): string {
  if (format === "jpeg" || format === "jpg") return "image/jpeg";
  if (format === "png") return "image/png";
  if (format === "webp") return "image/webp";
  const extension = extname(referencePath).toLowerCase();
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".webp") return "image/webp";
  return "image/png";
}

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

function promptHeader(prompt: string): string | null {
  return prompt
    .split("\n")
    .find((line) => /FRAMING PROFILE \(CANVAS COMPOSITION AUTHORITY\):/.test(line)) ?? null;
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

async function rigPostprocessSmokeOutput(input: {
  page: Page;
  imageUrl: string;
  savedImageId: string;
  product: ReturnType<typeof productFromSnapshot>;
  target: (typeof targets)[number];
}): Promise<{
  imageUrl: string;
  rigged: {
    shifted: boolean;
    shiftXPx: number;
    shiftYPx: number;
    scale: number;
    detectedBaselineYPx: number | null;
    targetBaselineYPx: number | null;
    maskControlled: boolean;
    qaIssues: string[];
    framingQa: unknown;
    framingDecision: unknown;
  };
}> {
  const rigged = await input.page.evaluate(
    async ({ imageUrl, product, capState, mode, targetBackgroundHex }) => {
      const { normalizeBestBottlesRigBaseline } = await import(
        "/src/lib/product-image/rigPostprocess.ts"
      );
      return normalizeBestBottlesRigBaseline(imageUrl, {
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
        capState,
        mode,
        targetBackgroundHex,
        maskReferenceUrl: null,
        requireMaskControl: false,
      });
    },
    {
      imageUrl: input.imageUrl,
      product: input.product,
      capState: input.target.capState ?? null,
      mode: input.target.mode ?? null,
      targetBackgroundHex: BEST_BOTTLES_VISUAL_TARGET_CANVAS_HEX,
    },
  );

  if (rigged.detectedBaselineYPx === null || rigged.targetBaselineYPx === null) {
    throw new Error(`${input.target.sku} rig postprocess failed: baseline was not detectable.`);
  }
  if (rigged.qaIssues.length > 0) {
    throw new Error(`${input.target.sku} rig postprocess failed: ${rigged.qaIssues.join(" ")}`);
  }

  const base64 = rigged.dataUrl.replace(/^data:image\/png;base64,/, "");
  const bytes = Buffer.from(base64, "base64");
  const riggedPath =
    `${organizationId}/${userId}/smoke-tests/cylinder-family-${runId}/rigged/${input.target.sku}__rigged.png`;
  const upload = await supabase.storage
    .from("generated-images")
    .upload(riggedPath, bytes, {
      contentType: "image/png",
      cacheControl: "3600",
      upsert: false,
    });
  if (upload.error) {
    throw new Error(`${input.target.sku} rigged upload failed: ${upload.error.message}`);
  }
  const { data: publicUrlData } = supabase.storage.from("generated-images").getPublicUrl(riggedPath);
  if (!publicUrlData.publicUrl) throw new Error(`${input.target.sku} rigged upload returned no URL.`);

  const { error: updateError } = await supabase
    .from("generated_images")
    .update({ image_url: publicUrlData.publicUrl })
    .eq("id", input.savedImageId);
  if (updateError) {
    throw new Error(`${input.target.sku} rigged row update failed: ${updateError.message}`);
  }

  return {
    imageUrl: publicUrlData.publicUrl,
    rigged: {
      shifted: rigged.shifted,
      shiftXPx: rigged.shiftXPx,
      shiftYPx: rigged.shiftYPx,
      scale: rigged.scale,
      detectedBaselineYPx: rigged.detectedBaselineYPx,
      targetBaselineYPx: rigged.targetBaselineYPx,
      maskControlled: rigged.maskControlled,
      qaIssues: rigged.qaIssues,
      framingQa: rigged.framingQa,
      framingDecision: rigged.framingDecision,
    },
  };
}

const snapshot = JSON.parse(readFileSync(convexSnapshotPath, "utf8")) as {
  products: ProductRow[];
};
const system = loadPromptSystem(process.cwd());
const referenceOverrides = parseReferenceOverrides(process.env.BB_SMOKE_REFERENCE_OVERRIDES);
const browser = skipRigPostprocess ? null : await chromium.launch({ headless: true });
const page = browser ? await browser.newPage() : null;
if (page) {
  await page.goto("http://127.0.0.1:8081/", { waitUntil: "domcontentloaded" });
}

const results = [];

try {
for (const target of targets) {
  const row = snapshot.products.find((product) => getText(product, "graceSku") === target.sku);
  if (!row) throw new Error(`Missing Convex product for ${target.sku}`);
  const referenceFile = referenceOverrides.get(target.sku) ?? target.reference;
  const referenceSource = referenceOverrides.has(target.sku) ? "override" : "flattened-png";
  const product = {
    ...productFromSnapshot(row),
    capState: target.capState ?? null,
    mode: target.mode ?? null,
    capOffReferenceId: target.capState === "detached" ? referenceFile : null,
    componentTopology:
      target.capState === "detached"
        ? "fitment-attached-cap-right-sidecar" as const
        : "assembled" as const,
  };
  const bodyMaterial = inferBestBottlesBodyMaterial(product);

  const referenceBuffer = readFileSync(referenceFile);
  const referenceMeta = await sharp(referenceBuffer).metadata();
  const referencePath =
    `${organizationId}/${userId}/smoke-tests/cylinder-family-${runId}/references/${target.sku}__${basename(referenceFile)}`;
  const upload = await supabase.storage
    .from("generated-images")
    .upload(referencePath, referenceBuffer, {
      contentType: getReferenceContentType(referenceFile, referenceMeta.format),
      cacheControl: "3600",
      upsert: false,
    });
  if (upload.error) throw new Error(`${target.sku} reference upload failed: ${upload.error.message}`);
  const { data: publicUrlData } = supabase.storage.from("generated-images").getPublicUrl(referencePath);
  const referenceUrl = publicUrlData.publicUrl;
  if (!referenceUrl) throw new Error(`${target.sku} reference upload returned no public URL.`);

  const promptPreflight = buildBestBottlesPromptPreflight({
    product,
    referenceImagePath: referenceFile,
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
  const smokePromptRecord = buildCylinderSmokePromptRecord({
    record: promptPreflight.record,
    sku: promptPreflight.sku,
    mode: smokePromptMode,
  });
  const finalPrompt = applySmokePromptAddendum(
    smokePromptRecord.final_prompt,
    smokePromptAddendum,
  );
  const precompiledPromptRecord = smokePromptAddendum
    ? {
        ...smokePromptRecord,
        final_prompt: finalPrompt,
        qa_checklist: [
          ...smokePromptRecord.qa_checklist,
          `smoke_prompt_addendum:${smokePromptAddendum.id}`,
        ],
      }
    : smokePromptRecord;

  const identity = buildBestBottlesGenerationIdentity(product, {
    bodyMaterial,
    sourceReference: referenceUrl,
  });
  const identityIssue = getBestBottlesGenerationIdentityIssue(identity);
  if (identityIssue) throw new Error(`${target.sku} identity blocked: ${identityIssue}`);

  const assembled = assemblePrompt({
    presetId: preset.id,
    sku: product,
    liquid: null,
  });

  const extraLibraryTags = [
    "sku-preset",
    `preset:${preset.id}`,
    `canvas:${preset.canvas.widthPx}x${preset.canvas.heightPx}`,
    "brand:best-bottles",
    "studio-master",
    "prompt-source:json-precompiler",
    "smoke-test:cylinder-family-live",
    `smoke-run:${runId}`,
    `smoke-case:${target.caseId}`,
    `prompt-family:${promptPreflight.sku?.product_family}`,
    `prompt-material:${promptPreflight.sku?.body_material}`,
    `prompt-closure:${promptPreflight.sku?.closure_type}`,
    `prompt-frame:${promptPreflight.sku?.frame_class}`,
    `prompt-qa:${promptPreflight.status}`,
    `smoke-prompt-mode:${smokePromptMode}`,
    `smoke-resolution:${smokeResolution}`,
    `family:${String(product.family ?? "unknown").toLowerCase().replace(/\s+/g, "-")}`,
    `sku:${target.sku}`,
    product.websiteSku ? `websiteSku:${product.websiteSku}` : null,
    "reference-lineage:flattened-single-source",
    "truth-ref:flattened-png",
    `model:${smokeAiProvider}`,
    smokePromptAddendum ? `prompt-addendum:${smokePromptAddendum.id}` : null,
    `reference-source:${referenceSource}`,
    target.mode ? `mode:${target.mode}` : null,
    target.capState ? `cap-state:${target.capState}` : null,
    `prompt:${identity.promptVersion}`,
    `rig:${identity.rigVersion}`,
    `identity:${identity.identityHash}`,
    `qa:${identity.qaStatus}`,
  ].filter((tag): tag is string => Boolean(tag));

  const body = {
    prompt: finalPrompt,
    userId,
    organizationId,
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
    aiProvider: smokeAiProvider,
    allowBestBottlesProviderOverride,
    resolution: smokeResolution,
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
      capState: target.capState ?? null,
      mode: target.mode ?? null,
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

  const startedAt = Date.now();
  const { data, error } = await supabase.functions.invoke("generate-madison-image", { body });
  const elapsedMs = Date.now() - startedAt;
  if (error) {
    let bodyText = "";
    const context = (error as unknown as { context?: { json?: () => Promise<unknown>; text?: () => Promise<string> } })
      .context;
    try {
      if (context?.json) {
        bodyText = JSON.stringify(await context.json());
      } else if (context?.text) {
        bodyText = await context.text();
      }
    } catch {
      bodyText = "";
    }
    throw new Error(
      `${target.sku} generation failed: ${error.message ?? JSON.stringify(error)}${bodyText ? ` body=${bodyText.slice(0, 1000)}` : ""}`,
    );
  }
  // Heartbeat-streaming responses report post-defer failures as HTTP 200 with
  // an `error` field in the body — treat those as hard failures.
  if (typeof data?.error === "string" && data.error.trim()) {
    throw new Error(`${target.sku} generation failed (streamed error): ${data.error}`);
  }
  if (!data?.imageUrl || !data?.savedImageId) {
    throw new Error(`${target.sku} generation returned incomplete response: ${JSON.stringify(data)}`);
  }

  const rawImageUrl = data.imageUrl;
  const riggedOutput = page
    ? await rigPostprocessSmokeOutput({
        page,
        imageUrl: rawImageUrl,
        savedImageId: data.savedImageId,
        product,
        target,
      })
    : null;
  const finalImageUrl = riggedOutput?.imageUrl ?? rawImageUrl;

  const imageRes = await fetch(finalImageUrl);
  if (!imageRes.ok) throw new Error(`${target.sku} output URL fetch failed: ${imageRes.status}`);
  const imageBytes = Buffer.from(await imageRes.arrayBuffer());
  const outputMeta = await sharp(imageBytes).metadata();

  const { data: savedRows, error: savedError } = await supabase
    .from("generated_images")
    .select("id,created_at,image_url,reference_image_url,final_prompt,generation_provider,library_tags,reference_images")
    .eq("id", data.savedImageId)
    .limit(1);
  if (savedError) throw savedError;
  const saved = savedRows?.[0] ?? null;

  results.push({
    caseId: target.caseId,
    capacity: target.capacity,
    sku: target.sku,
    websiteSku: product.websiteSku,
    mode: target.mode ?? null,
    capState: target.capState ?? null,
    savedImageId: data.savedImageId,
    imageUrl: finalImageUrl,
    rawImageUrl,
    outputWidth: outputMeta.width,
    outputHeight: outputMeta.height,
    provider: data.usedProvider ?? saved?.generation_provider ?? null,
    rigged: riggedOutput?.rigged ?? null,
    elapsedMs,
    promptMode: data.promptMode,
    smokePromptMode,
    smokeResolution,
    promptAddendum: smokePromptAddendum?.id ?? null,
    promptHeader: promptHeader(data.finalPrompt ?? saved?.final_prompt ?? ""),
    preflightStatus: promptPreflight.status,
    qa: precompiledPromptRecord.qa_checklist.filter((tag) =>
      tag.startsWith("canvas_") ||
      tag.startsWith("cylinder_family_profile") ||
      tag.startsWith("primary_object") ||
      tag.startsWith("detached_component") ||
      tag.startsWith("smoke-prompt-mode") ||
      tag.startsWith("smoke-resolution"),
    ),
    warnings: promptPreflight.warnings,
    referenceUrl,
    referenceFile,
    referenceSource,
    referenceWidth: referenceMeta.width,
    referenceHeight: referenceMeta.height,
    savedLibraryTags: saved?.library_tags ?? null,
  });
}

console.log(JSON.stringify({ runId, results }, null, 2));
} finally {
  await browser?.close();
}
