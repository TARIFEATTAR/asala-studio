#!/usr/bin/env tsx
/**
 * Paper-Doll Rig — weld CLI (build task 3).
 * Spec: docs/superpowers/specs/2026-07-30-paper-doll-rig-design.md
 *
 * Takes a Class-B composite (from paperdoll:compose) plus its recipe, derives
 * the geometry-locked weld mask (collar band + tube column), optionally calls
 * gpt-image-2 /images/edits (SPENDS MONEY — requires --call), CLAMPS the
 * result outside the mask, runs weld QA, extracts the body-contextualized
 * welded fitment layer, and registers it SHA-pinned in
 * docs/paper-doll-rig/welded-layer-registry.json.
 *
 * Deterministic dry paths (no spend):
 *   --mask-only            build + save the mask, print regions, stop
 *   --welded <png>         clamp+QA+extract against an EXISTING welded image
 *                          (simulation or a previous provider result)
 *
 * Usage:
 *   npm run paperdoll:weld -- --composite out/capoff.png \
 *     --recipe out/capoff.recipe.json \
 *     --applicator "Fine Mist Sprayer" --body-color Clear \
 *     [--tube-radius-mm 2.2] [--expect-tube|--no-expect-tube] \
 *     [--mask-only | --welded sim.png | --call] \
 *     --out out/welded
 *
 * Every provider call writes a generation_attempts ledger row
 * (lane: paper-doll-weld) via the service-role client.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

import type { RgbaImage } from "../../src/lib/paperDoll/componentRegistry";
import type { CompositeRecipe } from "../../src/lib/paperDoll/compositeEngine";
import {
  buildWeldMask,
  buildWeldPrompt,
  clampOutsideMask,
  DEFAULT_WELD_REGIONS,
  deriveWeldRegions,
  extractWeldedLayer,
  runWeldQa,
  type WeldRegions,
} from "../../src/lib/paperDoll/weldLane";
import {
  beginGenerationAttempt,
  completeGenerationAttempt,
} from "../../supabase/functions/_shared/generationAttemptLedger";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
dotenv.config({ path: resolve(REPO_ROOT, ".env") });
const REGISTRY_PATH = resolve(REPO_ROOT, "docs/paper-doll-rig/welded-layer-registry.json");

function parseArgs(argv: string[]): Map<string, string | boolean> {
  const out = new Map<string, string | boolean>();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) out.set(key, true);
    else {
      out.set(key, next);
      i++;
    }
  }
  return out;
}

function str(args: Map<string, string | boolean>, key: string): string | null {
  const v = args.get(key);
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

async function loadRgba(path: string): Promise<{ image: RgbaImage; sha256: string }> {
  const bytes = readFileSync(path);
  const raw = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const meta = await sharp(path).metadata();
  return {
    image: { data: raw.data, width: raw.info.width, height: raw.info.height, hasAlpha: Boolean(meta.hasAlpha) },
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

async function savePng(image: RgbaImage, path: string): Promise<string> {
  mkdirSync(dirname(path), { recursive: true });
  const png = await sharp(Buffer.from(image.data), {
    raw: { width: image.width, height: image.height, channels: 4 },
  }).png().toBuffer();
  writeFileSync(path, png);
  return createHash("sha256").update(png).digest("hex");
}

const OPENAI_SIZES = new Set(["1024x1024", "1024x1536", "1536x1024", "2080x2288", "2048x2048"]);

async function callOpenAiEdit(
  compositePngPath: string,
  maskPngPath: string,
  prompt: string,
  widthPx: number,
  heightPx: number,
): Promise<Buffer> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set — cannot --call.");
  const sizeKey = `${widthPx}x${heightPx}`;
  const size = OPENAI_SIZES.has(sizeKey) ? sizeKey : "auto";
  const form = new FormData();
  form.append("model", "gpt-image-2");
  form.append("prompt", prompt);
  form.append("n", "1");
  form.append("size", size);
  form.append("quality", "high");
  form.append("output_format", "png");
  form.append("image[]", new Blob([readFileSync(compositePngPath)], { type: "image/png" }), "composite.png");
  form.append("mask", new Blob([readFileSync(maskPngPath)], { type: "image/png" }), "weld-mask.png");
  const res = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!res.ok) throw new Error(`OpenAI images/edits ${res.status}: ${(await res.text()).slice(0, 500)}`);
  const data = await res.json() as { data?: Array<{ b64_json?: string }> };
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error("OpenAI response contained no image data.");
  return Buffer.from(b64, "base64");
}

interface WeldedLayerRegistryFile {
  version: number;
  updatedAt: string;
  entries: Array<Record<string, unknown>>;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const compositePath = str(args, "composite");
  const recipePath = str(args, "recipe");
  const outBase = str(args, "out");
  if (!compositePath || !recipePath || !outBase) {
    console.error("Required: --composite, --recipe, --out");
    process.exit(1);
  }
  const applicator = str(args, "applicator") ?? "Fine Mist Sprayer";
  const bodyColor = str(args, "body-color") ?? "Clear";
  const expectTube = args.get("no-expect-tube") !== true;

  const recipe = JSON.parse(readFileSync(resolve(recipePath), "utf8")) as CompositeRecipe;
  const spec = recipe.body.geometrySpec;
  const fitmentLayer = recipe.layers[recipe.layers.length - 1];
  if (!fitmentLayer) {
    console.error("Recipe has no layers — weld needs the composed fitment's placement.");
    process.exit(1);
  }
  const fitmentBounds = fitmentLayer.resolved.placedBounds;

  const regionOptions = {
    ...DEFAULT_WELD_REGIONS,
    tubeRadiusMm: Number(str(args, "tube-radius-mm") ?? DEFAULT_WELD_REGIONS.tubeRadiusMm),
  };
  const regions: WeldRegions = deriveWeldRegions(spec, fitmentBounds, regionOptions);
  const mask = buildWeldMask(spec.canvasWidthPx, spec.canvasHeightPx, regions);
  const maskPath = `${resolve(outBase)}.mask.png`;
  const maskSha = await savePng(mask, maskPath);

  const tubeReachMm = (regions.tubeColumn.bottom - regions.tubeColumn.top + 1) / spec.pxPerMm;
  const prompt = buildWeldPrompt({
    applicator,
    bodyColor,
    tubeReachMm,
    tubeDiameterMm: regionOptions.tubeRadiusMm * 2,
  });

  console.log(`\n── Paper-Doll weld (${applicator} on ${bodyColor})`);
  console.log(`   collar band: [${regions.collarBand.left},${regions.collarBand.top}→${regions.collarBand.right},${regions.collarBand.bottom}]`);
  console.log(`   tube column: [${regions.tubeColumn.left},${regions.tubeColumn.top}→${regions.tubeColumn.right},${regions.tubeColumn.bottom}] (${tubeReachMm.toFixed(0)}mm reach)`);
  console.log(`   mask:        ${maskPath}`);

  if (args.get("mask-only") === true) {
    console.log("   (mask-only — no weld performed)");
    return;
  }

  const original = await loadRgba(resolve(compositePath));

  // ── Obtain the welded image: provider call, or a supplied file.
  let weldedBuffer: Buffer;
  let providerUsed = false;
  const suppliedWelded = str(args, "welded");
  if (suppliedWelded) {
    weldedBuffer = readFileSync(resolve(suppliedWelded));
  } else if (args.get("call") === true) {
    providerUsed = true;
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const ledgerClient = supabaseUrl && serviceKey ? createClient(supabaseUrl, serviceKey) : null;
    const tracker = ledgerClient
      ? await beginGenerationAttempt(ledgerClient, {
          lane: "paper-doll-weld",
          provider: "openai",
          model: "gpt-image-2",
          endpoint: "edits",
          requestSize: `${spec.canvasWidthPx}x${spec.canvasHeightPx}`,
          requestResolution: "high",
          prompt,
          referenceFingerprintSources: [original.sha256, maskSha],
          codeCommit: process.env.MADISON_GIT_COMMIT ?? null,
          requestParams: { weld: true, applicator, bodyColor, regions },
        })
      : null;
    try {
      console.log("   💸 calling gpt-image-2 /images/edits (masked)…");
      weldedBuffer = await callOpenAiEdit(
        resolve(compositePath),
        maskPath,
        prompt,
        spec.canvasWidthPx,
        spec.canvasHeightPx,
      );
      if (ledgerClient && tracker) {
        await completeGenerationAttempt(ledgerClient, tracker, { status: "succeeded" });
      }
    } catch (error) {
      if (ledgerClient && tracker) {
        await completeGenerationAttempt(ledgerClient, tracker, {
          status: "failed",
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      }
      throw error;
    }
  } else {
    console.error("Pick one: --call (spends money), --welded <png> (existing result), or --mask-only.");
    process.exit(1);
  }

  const weldedRaw = await sharp(weldedBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const welded: RgbaImage = {
    data: weldedRaw.data,
    width: weldedRaw.info.width,
    height: weldedRaw.info.height,
    hasAlpha: true,
  };

  // ── Clamp, QA, extract, register.
  const clamped = clampOutsideMask(original.image, welded, mask);
  const qa = runWeldQa(original.image, clamped, mask, regions, { expectTube });
  const clampedPath = `${resolve(outBase)}.clamped.png`;
  await savePng(clamped, clampedPath);
  const layer = extractWeldedLayer(clamped, fitmentBounds, regions);
  const layerPath = `${resolve(outBase)}.layer.png`;
  const layerSha = await savePng(layer, layerPath);

  const registry: WeldedLayerRegistryFile = existsSync(REGISTRY_PATH)
    ? JSON.parse(readFileSync(REGISTRY_PATH, "utf8"))
    : { version: 1, updatedAt: new Date().toISOString(), entries: [] };
  const entryId = `welded__${basename(String(fitmentLayer.registryId)).replace(/[^a-z0-9_-]+/gi, "-")}__on__${basename(String(recipe.body.registryId)).replace(/[^a-z0-9_-]+/gi, "-")}`;
  const entry = {
    id: entryId,
    componentRegistryId: fitmentLayer.registryId,
    bodyRegistryId: recipe.body.registryId,
    bodySha256: recipe.body.sha256,
    asset: { path: layerPath, sha256: layerSha, widthPx: layer.width, heightPx: layer.height, hasAlpha: true },
    weld: {
      maskSha256: maskSha,
      regions,
      prompt,
      provider: providerUsed ? "openai/gpt-image-2" : "supplied",
      calledAt: new Date().toISOString(),
    },
    qa,
    status: "pending-review",
  };
  const existing = registry.entries.findIndex((e) => e.id === entryId);
  if (existing >= 0) registry.entries[existing] = entry;
  else registry.entries.push(entry);
  registry.updatedAt = new Date().toISOString();
  mkdirSync(dirname(REGISTRY_PATH), { recursive: true });
  writeFileSync(REGISTRY_PATH, `${JSON.stringify(registry, null, 2)}\n`);

  console.log(`   clamped:     ${clampedPath}`);
  console.log(`   layer:       ${layerPath}`);
  console.log(`   tube Δ:      ${qa.tubeColumnDelta.toFixed(2)}  present=${qa.tubePresent}  outsideIdentical=${qa.outsideIdentical}`);
  console.log(`   QA:          ${qa.passed ? "✅ PASS" : "❌ FAIL"}${qa.issues.length ? ` — ${qa.issues.join("; ")}` : ""}`);
  console.log(`   registered:  ${entryId} (pending-review)`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
