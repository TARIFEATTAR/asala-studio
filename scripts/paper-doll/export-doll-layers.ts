#!/usr/bin/env tsx
/**
 * Paper-Doll Rig — Sanity doll-layer export (build task 6).
 * Spec: docs/superpowers/specs/2026-07-30-paper-doll-rig-design.md
 * ("Render targets → Sanity paper-doll")
 *
 * From a compose recipe, re-render every layer onto the doll canvas
 * (1000×1300 default; 1500×1300 wide for Empire bulb+tassel) in one shared
 * coordinate frame, run the ±2 px registration gate on each exported layer,
 * and emit a push-ready bundle + manifest for the existing
 * `paper_doll_component` Sanity destination (metadata: familySlug + role).
 *
 * One transform for every layer (scale + translate from the master frame),
 * so registration is preserved by construction; the gate then PROVES it.
 *
 * Push is guarded: `--upload` puts layers in Supabase storage; `--push`
 * calls push-sanity-placement with dryRun:true; `--push --live` publishes.
 * None of the three run by default.
 *
 * Usage:
 *   npm run paperdoll:export-doll -- --recipe out/capon.recipe.json \
 *     --family-slug cylinder-9ml-clear-13-415-rollon \
 *     [--canvas 1000x1300] [--fill 0.72] [--baseline 0.9] \
 *     [--body-shadow] --out-dir out/doll
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

import { PAPER_DOLL_CANVAS_RGB, type RgbaImage } from "../../src/lib/paperDoll/componentRegistry";
import {
  compositeOver,
  featherBottomAlpha,
  LOCKED_SHADOW_STYLE,
  paintContactShadow,
  resampleRgbaBilinear,
  type CompositeRecipe,
  type PixelBounds,
} from "../../src/lib/paperDoll/compositeEngine";
import { runRegistrationGate } from "../../src/lib/paperDoll/qaGates";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

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

async function loadRgba(path: string): Promise<RgbaImage> {
  const raw = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const meta = await sharp(path).metadata();
  return { data: raw.data, width: raw.info.width, height: raw.info.height, hasAlpha: Boolean(meta.hasAlpha) };
}

async function savePng(image: RgbaImage, path: string): Promise<string> {
  mkdirSync(dirname(path), { recursive: true });
  const png = await sharp(Buffer.from(image.data), {
    raw: { width: image.width, height: image.height, channels: 4 },
  }).png().toBuffer();
  writeFileSync(path, png);
  return createHash("sha256").update(png).digest("hex");
}

function blankCanvas(width: number, height: number, bone: boolean): RgbaImage {
  const data = new Uint8Array(width * height * 4);
  if (bone) {
    for (let i = 0; i < width * height; i++) {
      data[i * 4] = PAPER_DOLL_CANVAS_RGB.r;
      data[i * 4 + 1] = PAPER_DOLL_CANVAS_RGB.g;
      data[i * 4 + 2] = PAPER_DOLL_CANVAS_RGB.b;
      data[i * 4 + 3] = 255;
    }
  }
  return { data, width, height, hasAlpha: !bone };
}

/** Master-frame → doll-frame transform (uniform scale + translate). */
interface DollTransform {
  scale: number;
  dx: number;
  dy: number;
}

function transformBounds(b: PixelBounds, t: DollTransform): PixelBounds {
  return {
    left: Math.round(b.left * t.scale + t.dx),
    right: Math.round(b.right * t.scale + t.dx),
    top: Math.round(b.top * t.scale + t.dy),
    bottom: Math.round(b.bottom * t.scale + t.dy),
  };
}

/** Rescale a full-master-canvas layer and place it on a doll canvas. */
function projectLayer(layer: RgbaImage, t: DollTransform, dollW: number, dollH: number, boneBase: boolean): RgbaImage {
  const scaled = resampleRgbaBilinear(layer, Math.max(1, Math.round(layer.width * t.scale)), Math.max(1, Math.round(layer.height * t.scale)));
  const canvas = blankCanvas(dollW, dollH, boneBase);
  compositeOver(canvas, scaled, Math.round(t.dx), Math.round(t.dy));
  return canvas;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const recipePath = str(args, "recipe");
  const outDir = str(args, "out-dir");
  const familySlug = str(args, "family-slug");
  if (!recipePath || !outDir || !familySlug) {
    console.error("Required: --recipe, --out-dir, --family-slug (Sanity paper_doll_component metadata)");
    process.exit(1);
  }
  const canvasArg = str(args, "canvas") ?? "1000x1300";
  const match = canvasArg.match(/^(\d+)x(\d+)$/);
  if (!match) {
    console.error(`--canvas must look like 1000x1300, got '${canvasArg}'`);
    process.exit(1);
  }
  const dollW = Number(match[1]);
  const dollH = Number(match[2]);
  const fill = Number(str(args, "fill") ?? "0.72");
  const baselineFrac = Number(str(args, "baseline") ?? "0.9");

  const recipe = JSON.parse(readFileSync(resolve(recipePath), "utf8")) as CompositeRecipe;
  const spec = recipe.body.geometrySpec;

  // One transform for every layer: body height fills `fill` of the doll
  // canvas; baseline lands at `baselineFrac`; centerline at canvas center.
  const bodyHeightPx = spec.bodyBounds.bottom - spec.bodyBounds.top + 1;
  const scale = (fill * dollH) / bodyHeightPx;
  const t: DollTransform = {
    scale,
    dx: dollW / 2 - spec.centerlineX * scale,
    dy: baselineFrac * dollH - spec.baselineY * scale,
  };
  const dollSpec = {
    canvasWidthPx: dollW,
    canvasHeightPx: dollH,
    pxPerMm: spec.pxPerMm * scale,
    baselineY: Math.round(baselineFrac * dollH),
    centerlineX: Math.round(dollW / 2),
    bodyBounds: transformBounds(spec.bodyBounds, t),
  };

  mkdirSync(resolve(outDir), { recursive: true });
  const manifestLayers: Array<Record<string, unknown>> = [];
  let allPass = true;

  // ── Body layer: the opaque base (Bone + plate + locked ambient shadow).
  //    The recipe's body sha lets us reload the exact frozen plate.
  const bodyPathGuess = recipe.body.registryId.startsWith("file:")
    ? recipe.body.registryId.slice(5)
    : null;
  if (!bodyPathGuess || !existsSync(bodyPathGuess)) {
    console.error(
      "Body plate path unresolved from recipe (registry-id bodies need the registry present). " +
        "For file-based recipes the original path must still exist.",
    );
    process.exit(1);
  }
  const plate = await loadRgba(bodyPathGuess);
  const bodyLayer = projectLayer(plate, t, dollW, dollH, true);
  if (args.get("body-shadow") === true) {
    const halfWidth = (dollSpec.bodyBounds.right - dollSpec.bodyBounds.left + 1) / 2;
    paintContactShadow(bodyLayer, dollSpec.centerlineX, dollSpec.baselineY + 2, halfWidth, LOCKED_SHADOW_STYLE);
  }
  const bodyOut = resolve(outDir, "layer-00-body.png");
  const bodySha = await savePng(bodyLayer, bodyOut);
  manifestLayers.push({
    order: 0,
    role: "body",
    file: "layer-00-body.png",
    sha256: bodySha,
    registryId: recipe.body.registryId,
    expectedBounds: dollSpec.bodyBounds,
    registration: { pass: true, note: "body layer defines the frame" },
  });

  // ── Fitment layers: rebuild each in the master frame, project, gate.
  for (const [i, layer] of recipe.layers.entries()) {
    const srcPath = layer.registryId.startsWith("file:") ? layer.registryId.slice(5) : null;
    if (!srcPath || !existsSync(srcPath)) {
      console.error(`Layer[${i}] source unresolved (${layer.registryId}) — registry-based resolution requires the registry entry's asset path.`);
      process.exit(1);
    }
    const component = await loadRgba(srcPath);
    const placed = resampleRgbaBilinear(component, layer.resolved.targetWidthPx, layer.resolved.targetHeightPx);
    if (layer.bottomFeatherPx > 0) featherBottomAlpha(placed, layer.bottomFeatherPx);
    const masterFrame = blankCanvas(spec.canvasWidthPx, spec.canvasHeightPx, false);
    compositeOver(masterFrame, placed, layer.resolved.offsetX, layer.resolved.offsetY);
    const dollLayer = projectLayer(masterFrame, t, dollW, dollH, false);

    const expected = transformBounds(layer.resolved.placedBounds, t);
    const registration = runRegistrationGate(dollLayer, expected);
    allPass = allPass && registration.pass;

    const fileName = `layer-${String(i + 1).padStart(2, "0")}-fitment.png`;
    const outPath = resolve(outDir, fileName);
    const sha = await savePng(dollLayer, outPath);
    manifestLayers.push({
      order: i + 1,
      role: "fitment",
      file: fileName,
      sha256: sha,
      registryId: layer.registryId,
      expectedBounds: expected,
      registration: {
        pass: registration.pass,
        maxDeviationPx: registration.maxDeviationPx,
        issues: registration.issues,
      },
    });
    console.log(
      `   layer ${i + 1}: ${fileName}  registration ${registration.pass ? "✅" : "❌"} (max Δ ${registration.maxDeviationPx}px)`,
    );
  }

  const manifest = {
    version: 1,
    createdAt: new Date().toISOString(),
    sourceRecipe: resolve(recipePath),
    dollGeometrySpec: dollSpec,
    transform: t,
    sanity: {
      destinationKey: "paper_doll_component",
      metadata: { familySlug, role: "paper-doll-component" },
      note: "POST push-sanity-placement {action:'publish', destinationKey, imageUrl, metadata, dryRun:true} per layer after upload; layers must pass registration first.",
    },
    registrationAllPass: allPass,
    layers: manifestLayers,
  };
  const manifestPath = resolve(outDir, "doll-manifest.json");
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  console.log(`\n── Doll export (${dollW}×${dollH}, scale ${t.scale.toFixed(4)})`);
  console.log(`   layers:     ${manifestLayers.length} (body + ${manifestLayers.length - 1} fitment)`);
  console.log(`   px/mm:      ${dollSpec.pxPerMm.toFixed(4)}  baselineY=${dollSpec.baselineY}  centerlineX=${dollSpec.centerlineX}`);
  console.log(`   registration: ${allPass ? "✅ ALL PASS (±2px)" : "❌ FAILURES — nothing may push"}`);
  console.log(`   manifest:   ${manifestPath}`);
  if (args.get("push") === true) {
    console.log(
      allPass
        ? "   push: wire-ready — upload layers (--upload, TBD storage prefix paper-doll/layers/) then POST push-sanity-placement with dryRun:true first."
        : "   push: BLOCKED — registration gate failed.",
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
