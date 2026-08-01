#!/usr/bin/env tsx
/**
 * Real closure-material pilot: one frozen Blender mesh, four material presets,
 * one locked bottle plate, one locked pixel-placement recipe.
 *
 * This is deliberately isolated from the approved component registry. It
 * writes review artifacts only; nothing is uploaded or marked approved.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

import {
  compareAlphaSilhouettes,
  resizeContainTransparent,
  solveLockedPixelPlacement,
  type AlphaImage,
} from "../../src/lib/paperDoll/closureMaterialPilot";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const OUTPUT_DIR = resolve(REPO_ROOT, "outputs/paper-doll-closure-material-pilot");
const RENDER_DIR = resolve(OUTPUT_DIR, "renders");
const COMPOSITE_DIR = resolve(OUTPUT_DIR, "composites");
const BODY_PATH = resolve(
  REPO_ROOT,
  "assets/paper-doll/body-plates/body__cylinder__9ml__clear__70.0x20.0mm.png",
);
const RECIPE_PATH = resolve(REPO_ROOT, "docs/paper-doll-rig/closure-placement-recipe.json");
const RENDERER_PATH = resolve(REPO_ROOT, "scripts/paper-doll/render_closure.py");

const VARIANTS = [
  { id: "silver", label: "Mirror chrome" },
  { id: "matte-white", label: "Matte white coating" },
  { id: "glossy-black", label: "Glossy black plastic" },
  { id: "translucent-frosted", label: "Translucent frosted plastic" },
] as const;

interface AlphaBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
  occupiedPixels: number;
  coverage: number;
}

interface LoadedRender {
  id: string;
  label: string;
  path: string;
  rgba: Buffer;
  image: AlphaImage;
  bounds: AlphaBounds;
}

function numberArg(name: string, fallback: number): number {
  const index = process.argv.indexOf(`--${name}`);
  if (index < 0) return fallback;
  const value = Number(process.argv[index + 1]);
  if (!Number.isFinite(value) || value <= 0) throw new Error(`--${name} must be positive`);
  return value;
}

function findAlphaBounds(image: AlphaImage): AlphaBounds {
  let left = image.width;
  let right = -1;
  let top = image.height;
  let bottom = -1;
  let occupiedPixels = 0;
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      if (image.alpha[y * image.width + x] === 0) continue;
      occupiedPixels++;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }
  if (right < left || bottom < top) throw new Error("render contains no non-zero alpha pixels");
  return {
    left,
    top,
    right,
    bottom,
    width: right - left + 1,
    height: bottom - top + 1,
    occupiedPixels,
    coverage: occupiedPixels / (image.width * image.height),
  };
}

async function loadRender(id: string, label: string): Promise<LoadedRender> {
  const path = resolve(RENDER_DIR, `cap_17-415_${id}.png`);
  const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const alpha = new Uint8Array(info.width * info.height);
  for (let i = 0; i < alpha.length; i++) alpha[i] = data[i * 4 + 3];
  const image = { width: info.width, height: info.height, alpha };
  return { id, label, path, rgba: data, image, bounds: findAlphaBounds(image) };
}

function renderVariant(id: string, samples: number): string {
  const result = spawnSync(
    "blender",
    [
      "--background",
      "--python",
      RENDERER_PATH,
      "--",
      "--out",
      RENDER_DIR,
      "--samples",
      String(samples),
      "--only",
      id,
    ],
    { cwd: REPO_ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  if (result.status !== 0) throw new Error(`Blender failed for ${id}:\n${output}`);
  if (!output.includes(`RENDERED ${id}`) || !output.includes("FRAME_CHECK")) {
    throw new Error(`Blender did not confirm the requested render for ${id}`);
  }
  return output;
}

async function compositeVariant(
  render: LoadedRender,
  targetWidth: number,
  centerX: number,
  bottomY: number,
): Promise<{ path: string; placement: ReturnType<typeof solveLockedPixelPlacement> }> {
  const trimmed = await sharp(render.path)
    .extract({
      left: render.bounds.left,
      top: render.bounds.top,
      width: render.bounds.width,
      height: render.bounds.height,
    })
    .resize({ width: targetWidth })
    .png()
    .toBuffer({ resolveWithObject: true });
  const placement = solveLockedPixelPlacement({
    sourceWidth: render.bounds.width,
    sourceHeight: render.bounds.height,
    targetWidth,
    centerX,
    bottomY,
  });
  if (trimmed.info.width !== placement.width || trimmed.info.height !== placement.height) {
    throw new Error(`resize/placement disagreement for ${render.id}`);
  }
  const path = resolve(COMPOSITE_DIR, `cylinder-9ml-clear__${render.id}.png`);
  await sharp(BODY_PATH)
    .composite([{ input: trimmed.data, left: placement.left, top: placement.top }])
    .png()
    .toFile(path);
  return { path, placement };
}

function escapeXml(value: string): string {
  return value.replace(/[<>&"']/g, (char) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    '"': "&quot;",
    "'": "&apos;",
  })[char] ?? char);
}

async function makeContactSheet(
  renders: LoadedRender[],
  composites: Array<{ path: string; placement: ReturnType<typeof solveLockedPixelPlacement> }>,
  minIoU: number,
): Promise<string> {
  const width = 2200;
  const height = 1320;
  const panelWidth = 510;
  const panelHeight = 1100;
  const gap = 24;
  const startX = 56;
  const panelY = 150;
  const layers: sharp.OverlayOptions[] = [];

  const header = Buffer.from(`<svg width="${width}" height="150" xmlns="http://www.w3.org/2000/svg">
    <text x="56" y="56" fill="#B8956A" font-family="monospace" font-size="18" font-weight="700">BEST BOTTLES / PAPER-DOLL MATERIAL PILOT</text>
    <text x="56" y="104" fill="#E8E6E3" font-family="sans-serif" font-size="34" font-weight="700">One geometry master. Four physical finishes. Silhouette IoU ${minIoU.toFixed(4)}.</text>
  </svg>`);
  layers.push({ input: header, left: 0, top: 0 });

  for (let i = 0; i < renders.length; i++) {
    const render = renders[i];
    const x = startX + i * (panelWidth + gap);
    const cap = await resizeContainTransparent(readFileSync(render.path), { width: 420, height: 470 });
    const bottle = await resizeContainTransparent(readFileSync(composites[i].path), { width: 420, height: 500 });
    const panel = Buffer.from(`<svg width="${panelWidth}" height="${panelHeight}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0.5" y="0.5" width="${panelWidth - 1}" height="${panelHeight - 1}" rx="14" fill="#F5F3EF" stroke="#D8D2C7"/>
      <text x="24" y="42" fill="#1B1916" font-family="sans-serif" font-size="24" font-weight="700">${escapeXml(render.label)}</text>
      <text x="24" y="70" fill="#6F675E" font-family="monospace" font-size="13">${escapeXml(render.id)}</text>
      <line x1="24" y1="574" x2="486" y2="574" stroke="#D8D2C7"/>
      <text x="24" y="1080" fill="#6F675E" font-family="monospace" font-size="12">363 px locked width · bottom y=1002</text>
    </svg>`);
    layers.push({ input: panel, left: x, top: panelY });
    layers.push({ input: cap, left: x + 45, top: panelY + 86 });
    layers.push({ input: bottle, left: x + 45, top: panelY + 590 });
  }

  const path = resolve(OUTPUT_DIR, "CONTACT-SHEET.png");
  await sharp({ create: { width, height, channels: 4, background: "#050505" } })
    .composite(layers)
    .png()
    .toFile(path);
  return path;
}

async function main(): Promise<void> {
  const samples = numberArg("samples", 64);
  const skipRender = process.argv.includes("--skip-render");
  mkdirSync(RENDER_DIR, { recursive: true });
  mkdirSync(COMPOSITE_DIR, { recursive: true });

  const renderLogs: Record<string, string> = {};
  if (!skipRender) {
    for (const variant of VARIANTS) {
      console.log(`Rendering ${variant.label}…`);
      renderLogs[variant.id] = renderVariant(variant.id, samples);
    }
  }

  const renders = await Promise.all(VARIANTS.map((variant) => loadRender(variant.id, variant.label)));
  const silhouette = compareAlphaSilhouettes(
    renders.map((render) => ({ name: render.id, image: render.image })),
  );

  const recipe = JSON.parse(readFileSync(RECIPE_PATH, "utf8")) as {
    placements: { "roll-on-over-cap": { widthPx: number; anchor: { bottomY: number; centerX: number } } };
  };
  const locked = recipe.placements["roll-on-over-cap"];
  const composites = [];
  for (const render of renders) {
    composites.push(await compositeVariant(render, locked.widthPx, locked.anchor.centerX, locked.anchor.bottomY));
  }
  const contactSheet = await makeContactSheet(renders, composites, silhouette.minIoU);

  const manifest = {
    generatedAt: new Date().toISOString(),
    isolatedPilot: true,
    registryMutation: false,
    blender: { samples, renderer: RENDERER_PATH, logs: renderLogs },
    geometryAuthority: {
      mesh: "over_cap",
      diameterMm: 19.5,
      heightMm: 28.5,
      topArcTarget: 0.062,
      renderCanvas: "1400x2050",
    },
    placementAuthority: { source: RECIPE_PATH, ...locked },
    qa: {
      requiredMinIoU: 0.985,
      binaryAlphaRule: "occupied iff alpha > 0; opacity is deliberately ignored for translucent material",
      ...silhouette,
      exactBinarySilhouette: silhouette.pairs.every((pair) => pair.mismatchedPixels === 0),
      renders: renders.map((render) => ({
        id: render.id,
        label: render.label,
        path: render.path,
        alphaBounds: render.bounds,
      })),
    },
    composites: composites.map((composite, index) => ({
      id: renders[index].id,
      path: composite.path,
      placement: composite.placement,
    })),
    contactSheet,
    verdict: silhouette.pass ? "AUTOMATIC GEOMETRY GATE PASSED — requires human material review" : "FAILED",
  };
  writeFileSync(resolve(OUTPUT_DIR, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

  console.log(`Silhouette gate: ${silhouette.pass ? "PASS" : "FAIL"} — min IoU ${silhouette.minIoU.toFixed(4)}`);
  console.log(`Exact binary silhouette: ${manifest.qa.exactBinarySilhouette ? "YES" : "NO"}`);
  console.log(`Contact sheet: ${contactSheet}`);
  if (!silhouette.pass) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
