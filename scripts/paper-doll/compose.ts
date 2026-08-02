#!/usr/bin/env tsx
/**
 * Paper-Doll Rig — composite CLI (build task 2; stacks added 2026-07-31).
 * Spec: docs/superpowers/specs/2026-07-30-paper-doll-rig-design.md
 *
 * Deterministic Class-A composition: a body plate + an assembled STACK of
 * component layers (fitment, overcap, …), each placed from canonical
 * millimetres, harmonized against Bone, grounded with painted occlusion and
 * shadow, and persisted with a recipe JSON sidecar so any output re-renders
 * forever. Cap states are layer subsets of the same stack: cap-on = all
 * layers, cap-off = stack minus the overcap. Class B runs this first, then
 * the weld lane (task 3) over the junction band.
 *
 * There is NO sidecar in this architecture (decided 2026-07-31): closures
 * always seat ON the bottle; the website swatches through cap colorways.
 * `--mode detached` is retained only as a legacy export capability.
 *
 * Usage — single layer:
 *   npm run paperdoll:compose -- \
 *     --body <registry-id|path> [--body-height-mm 70] \
 *     --closure <registry-id|path> --height-mm 21 --overlap-mm 3.5 \
 *     [--height-with-cap-mm 87.5] [--feather-px 2] [--no-occlusion] \
 *     [--body-shadow] [--no-shadow] --out out/composite.png
 *
 * Usage — multi-layer stack (3-part bottles):
 *   npm run paperdoll:compose -- --body … --stack stack.json \
 *     [--height-with-cap-mm 87.5] [--body-shadow] --out out/capon.png
 *
 *   stack.json: { "layers": [
 *     { "ref": "<registry-id|path>", "heightMm": 7,  "overlapMm": 2 },
 *     { "ref": "<registry-id|path>", "heightMm": 21, "overlapMm": 3.5,
 *       "featherPx": 2, "mountAxisXPx": 120, "occlusion": true }
 *   ]}
 *   Layers composite bottom-up in order (fitment first, overcap last); every
 *   layer places against the BODY frame (mm from body top). Occlusion defaults
 *   to the last (outermost) layer only — the one visible seam.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

import type { RegistryFile, RgbaImage } from "../../src/lib/paperDoll/componentRegistry";
import {
  applyChannelGain,
  checkAssembledHeight,
  compositeOver,
  computeGrayCardGain,
  deriveGeometrySpecFromPlate,
  featherBottomAlpha,
  LOCKED_SHADOW_STYLE,
  measureBorderMeanRgb,
  paintContactOcclusion,
  paintContactShadow,
  resampleRgbaBilinear,
  solveClosurePlacement,
  type CompositeRecipe,
  type CompositeRecipeLayer,
  type PlacementMode,
} from "../../src/lib/paperDoll/compositeEngine";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const REGISTRY_DIR = resolve(REPO_ROOT, "docs/paper-doll-rig");

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

function num(args: Map<string, string | boolean>, key: string): number | null {
  const v = str(args, key);
  if (v === null) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) {
    console.error(`--${key} must be a number, got '${v}'`);
    process.exit(1);
  }
  return n;
}

interface StackLayerSpec {
  ref: string;
  heightMm: number;
  overlapMm?: number;
  gapMm?: number;
  featherPx?: number;
  mountAxisXPx?: number;
  occlusion?: boolean;
}

interface ResolvedAsset {
  path: string;
  registryId: string;
  sha256FromRegistry: string | null;
  canonBodyHeightMm: number | null;
}

function resolveAsset(ref: string, registryFileName: string): ResolvedAsset {
  const registryPath = resolve(REGISTRY_DIR, registryFileName);
  if (existsSync(registryPath)) {
    const registry = JSON.parse(readFileSync(registryPath, "utf8")) as RegistryFile;
    const entry = registry.entries.find((e) => e.id === ref);
    if (entry) {
      if (entry.status === "rejected") {
        console.error(`Registry entry '${ref}' is rejected — refusing to compose from it.`);
        process.exit(1);
      }
      if (entry.status !== "approved") {
        console.warn(`⚠️ Registry entry '${ref}' is ${entry.status} (not approved) — pilot-only composition.`);
      }
      return {
        // Registry paths are repo-relative (machine-portable) — resolve here.
        path: entry.asset.path.startsWith("/") ? entry.asset.path : resolve(REPO_ROOT, entry.asset.path),
        registryId: entry.id,
        sha256FromRegistry: entry.asset.sha256,
        canonBodyHeightMm: entry.bodyPlateKey?.bodyHeightMm ?? null,
      };
    }
  }
  return { path: resolve(ref), registryId: `file:${ref}`, sha256FromRegistry: null, canonBodyHeightMm: null };
}

async function loadRgba(path: string): Promise<{ image: RgbaImage; sha256: string }> {
  if (!existsSync(path)) {
    console.error(`File not found: ${path}`);
    process.exit(1);
  }
  const bytes = readFileSync(path);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const meta = await sharp(path).metadata();
  const raw = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return {
    image: { data: raw.data, width: raw.info.width, height: raw.info.height, hasAlpha: Boolean(meta.hasAlpha) },
    sha256,
  };
}

function verifyRegistrySha(label: string, asset: ResolvedAsset, actual: string): void {
  if (asset.sha256FromRegistry && asset.sha256FromRegistry !== actual) {
    console.error(
      `${label} bytes do not match the registry SHA (${asset.sha256FromRegistry.slice(0, 12)}… vs ${actual.slice(0, 12)}…). ` +
        `The registry pin is the truth — re-intake if the asset legitimately changed.`,
    );
    process.exit(1);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const bodyRef = str(args, "body");
  const outPath = str(args, "out");
  if (!bodyRef || !outPath) {
    console.error("Required: --body, --out, and either --stack or --closure/--height-mm");
    process.exit(1);
  }
  const mode = (str(args, "mode") ?? "assembled") as PlacementMode;
  if (mode !== "assembled" && mode !== "detached") {
    console.error(`--mode must be 'assembled' or 'detached' (legacy), got '${mode}'`);
    process.exit(1);
  }
  if (mode === "detached") {
    console.warn("⚠️ detached is a LEGACY view — the paper-doll architecture is assembled-only (no sidecar).");
  }

  // ── Build the layer list: stack file, or single-closure flags.
  let layerSpecs: StackLayerSpec[];
  const stackPath = str(args, "stack");
  if (stackPath) {
    const parsed = JSON.parse(readFileSync(resolve(stackPath), "utf8")) as { layers?: StackLayerSpec[] };
    if (!Array.isArray(parsed.layers) || parsed.layers.length === 0) {
      console.error(`--stack file must contain a non-empty 'layers' array.`);
      process.exit(1);
    }
    layerSpecs = parsed.layers;
  } else {
    const closureRef = str(args, "closure");
    const heightMm = num(args, "height-mm");
    if (!closureRef || heightMm === null) {
      console.error("Required: --stack, or --closure with --height-mm");
      process.exit(1);
    }
    layerSpecs = [
      {
        ref: closureRef,
        heightMm,
        overlapMm: num(args, "overlap-mm") ?? 0,
        gapMm: num(args, "gap-mm") ?? 0,
        featherPx: num(args, "feather-px") ?? undefined,
        occlusion: args.get("no-occlusion") !== true,
      },
    ];
  }
  for (const [i, layer] of layerSpecs.entries()) {
    if (!layer.ref || !(Number(layer.heightMm) > 0)) {
      console.error(`Stack layer ${i} needs 'ref' and a positive 'heightMm'.`);
      process.exit(1);
    }
  }
  // Occlusion default: the outermost layer only — the one visible seam.
  const occlusionDefaults = layerSpecs.map((l, i) => l.occlusion ?? (i === layerSpecs.length - 1));

  // ── Body plate
  const bodyAsset = resolveAsset(bodyRef, "body-plate-registry.json");
  const bodyHeightMm = num(args, "body-height-mm") ?? bodyAsset.canonBodyHeightMm;
  if (bodyHeightMm === null) {
    console.error("Body height unknown: pass --body-height-mm or use a registry id carrying canon geometry.");
    process.exit(1);
  }
  const body = await loadRgba(bodyAsset.path);
  verifyRegistrySha("body", bodyAsset, body.sha256);

  const plateGain = computeGrayCardGain(measureBorderMeanRgb(body.image));
  applyChannelGain(body.image, plateGain);
  const spec = deriveGeometrySpecFromPlate(body.image, bodyHeightMm);

  // ── Layers, bottom-up
  const recipeLayers: CompositeRecipeLayer[] = [];
  let assembledTop = spec.bodyBounds.top;
  let recipeOcclusion: CompositeRecipe["occlusion"] = null;
  for (const [i, layerSpec] of layerSpecs.entries()) {
    const asset = resolveAsset(layerSpec.ref, "component-registry.json");
    const loaded = await loadRgba(asset.path);
    verifyRegistrySha(`layer[${i}] '${layerSpec.ref}'`, asset, loaded.sha256);
    if (!loaded.image.hasAlpha) {
      console.error(`Layer[${i}] '${layerSpec.ref}' has no alpha channel — only intake-passing cutouts can compose.`);
      process.exit(1);
    }
    const request = {
      mode,
      heightMm: layerSpec.heightMm,
      overlapMm: layerSpec.overlapMm ?? 0,
      gapMm: layerSpec.gapMm ?? 0,
      mountAxisXPx: layerSpec.mountAxisXPx,
    };
    const placement = solveClosurePlacement(loaded.image, spec, request);
    const placed = resampleRgbaBilinear(loaded.image, placement.targetWidthPx, placement.targetHeightPx);
    const featherPx = layerSpec.featherPx ?? (mode === "assembled" ? 2 : 0);
    if (featherPx > 0) featherBottomAlpha(placed, featherPx);

    if (mode === "assembled" && occlusionDefaults[i]) {
      const occlusion = {
        left: placement.placedBounds.left,
        right: placement.placedBounds.right,
        contactY: placement.placedBounds.bottom + 1,
        depthPx: Math.max(2, Math.round(1.5 * spec.pxPerMm)),
        strength: 0.12,
      };
      paintContactOcclusion(body.image, occlusion.left, occlusion.right, occlusion.contactY, occlusion.depthPx, occlusion.strength);
      recipeOcclusion = occlusion;
    }

    compositeOver(body.image, placed, placement.offsetX, placement.offsetY);
    assembledTop = Math.min(assembledTop, placement.placedBounds.top);
    recipeLayers.push({
      registryId: asset.registryId,
      sha256: loaded.sha256,
      mode,
      request,
      resolved: placement,
      bottomFeatherPx: featherPx,
    });
  }

  // ── Shadow last, in the locked ambient-contact style.
  let shadow: CompositeRecipe["shadow"] = null;
  if (args.get("no-shadow") !== true) {
    if (mode === "detached" && recipeLayers.length > 0) {
      const last = recipeLayers[recipeLayers.length - 1].resolved.placedBounds;
      const halfWidth = (last.right - last.left + 1) / 2;
      const centerX = Math.round((last.left + last.right) / 2);
      paintContactShadow(body.image, centerX, spec.baselineY + 2, halfWidth);
      shadow = { style: LOCKED_SHADOW_STYLE, centerX, floorY: spec.baselineY + 2, halfWidthPx: halfWidth };
    }
    if (args.get("body-shadow") === true) {
      const halfWidth = (spec.bodyBounds.right - spec.bodyBounds.left + 1) / 2;
      paintContactShadow(body.image, spec.centerlineX, spec.baselineY + 2, halfWidth);
      shadow = { style: LOCKED_SHADOW_STYLE, centerX: spec.centerlineX, floorY: spec.baselineY + 2, halfWidthPx: halfWidth };
    }
  }

  // ── Assembled-height QA (self-checking placement)
  const heightWithCapMm = num(args, "height-with-cap-mm");
  const heightQa = mode === "assembled" && heightWithCapMm !== null
    ? checkAssembledHeight(spec, assembledTop, heightWithCapMm)
    : null;

  // ── Encode + recipe
  const outAbs = resolve(outPath);
  mkdirSync(dirname(outAbs), { recursive: true });
  const png = await sharp(Buffer.from(body.image.data), {
    raw: { width: body.image.width, height: body.image.height, channels: 4 },
  }).png().toBuffer();
  writeFileSync(outAbs, png);
  const outputSha = createHash("sha256").update(png).digest("hex");

  const recipe: CompositeRecipe = {
    version: 1,
    createdAt: new Date().toISOString(),
    codeCommit: process.env.MADISON_GIT_COMMIT ?? null,
    canvas: { widthPx: body.image.width, heightPx: body.image.height },
    body: {
      registryId: bodyAsset.registryId,
      sha256: body.sha256,
      canonBodyHeightMm: bodyHeightMm,
      geometrySpec: spec,
    },
    layers: recipeLayers,
    harmonization: { plateGain, boneTarget: "#F5F3EF" },
    shadow,
    occlusion: recipeOcclusion,
    qa: { assembledHeight: heightQa },
    output: { sha256: outputSha, widthPx: body.image.width, heightPx: body.image.height },
  };
  const recipePath = outAbs.replace(/\.png$/i, "") + ".recipe.json";
  writeFileSync(recipePath, `${JSON.stringify(recipe, null, 2)}\n`);

  // ── Report
  console.log(`\n── Paper-Doll composite (${mode}, ${recipeLayers.length} layer${recipeLayers.length === 1 ? "" : "s"})`);
  console.log(`   body:      ${bodyAsset.registryId}`);
  console.log(`   px/mm:     ${spec.pxPerMm.toFixed(4)}  baselineY=${spec.baselineY}  centerlineX=${spec.centerlineX}`);
  console.log(`   plate gain: r=${plateGain.r.toFixed(3)} g=${plateGain.g.toFixed(3)} b=${plateGain.b.toFixed(3)}`);
  for (const layer of recipeLayers) {
    const b = layer.resolved.placedBounds;
    console.log(`   layer:     ${layer.registryId}  scale=${layer.resolved.scale.toFixed(4)}  fg=[${b.left},${b.top}→${b.right},${b.bottom}]`);
  }
  if (heightQa) {
    console.log(
      `   height QA: expected=${heightQa.expectedPx.toFixed(1)}px measured=${heightQa.measuredPx}px ` +
        `Δ=${heightQa.deltaPct.toFixed(2)}% → ${heightQa.pass ? "✅ PASS" : "❌ FAIL"}`,
    );
  }
  console.log(`   output:    ${outAbs}`);
  console.log(`   recipe:    ${recipePath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
