import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

export const DEFAULT_CYL9_ROLLON_SCENE = fileURLToPath(new URL(
  "../../workers/paper-doll-renderer/fixtures/cyl9-rollon-scene.json",
  import.meta.url,
));
export const DEFAULT_CYL9_STONE_LAYOUT = fileURLToPath(new URL(
  "../../docs/paper-doll-rig/cyl9-rollon-stone-layout.json",
  import.meta.url,
));
const DEFAULT_BLENDER_SCRIPT = fileURLToPath(new URL(
  "../../workers/paper-doll-renderer/blender/cyl9_rollon_overcap.py",
  import.meta.url,
));

interface SceneConfig {
  rendererVersion: string;
  geometryKey: string;
  canvas: { widthPx: number; heightPx: number; backgroundHex: string; transparent: boolean };
  placement: { targetWidthPx: number; mountAxisXPx: number; seatYPx: number };
  imageContract: Record<string, unknown>;
  physicalEvidence: Record<string, unknown>;
  geometry: Record<string, unknown>;
  camera: Record<string, unknown>;
  lighting: Record<string, unknown>;
  variants: Array<{
    variantKey: string;
    geometryKey: string;
    materialKey: string;
    stoneColor: string | null;
  }>;
}

interface RenderManifestAsset {
  variantKey: string;
  materialKey: string;
  beautyPath: string;
  beautySha256: string;
  maskPath: string;
  maskSha256: string;
  stoneMaskPath: string | null;
  stoneMaskSha256: string | null;
  geometryRecipeSha256: string;
  mountAxisXPx: number;
  seatYPx: number;
}

interface RenderManifest {
  schemaVersion: 1;
  rendererVersion: string;
  blenderVersion: string;
  canvas: SceneConfig["canvas"];
  geometryKey: string;
  geometryRecipeSha256: string;
  stoneLayoutSha256: string;
  maskPath: string;
  maskSha256: string;
  stoneMaskPath: string;
  stoneMaskSha256: string;
  assets: RenderManifestAsset[];
}

export interface InspectedRenderPack {
  rendererVersion: string;
  geometryKey: string;
  geometryLocked: true;
  assets: Array<RenderManifestAsset & {
    widthPx: number;
    heightPx: number;
    clippingMassRatio: number;
  }>;
  mask: {
    sha256: string;
    foregroundPixelCount: number;
    coverageRatio: number;
    bounds: { left: number; top: number; right: number; bottom: number };
    isBinary: boolean;
    touchesFrame: boolean;
  };
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, sortValue(child)]),
    );
  }
  return value;
}

function sha256(buffer: Buffer | string): string {
  return createHash("sha256").update(buffer).digest("hex");
}

function canonicalSha256(value: unknown): string {
  return sha256(JSON.stringify(sortValue(value)));
}

async function spawnBlender(args: string[]): Promise<void> {
  const executable = process.env.BLENDER_BIN || "blender";
  await new Promise<void>((resolve, reject) => {
    const child = spawn(executable, args, { stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`Blender failed with ${signal ?? `exit ${code}`}.`));
    });
  });
}

async function binaryMask(sourcePath: string, outputPath: string): Promise<void> {
  await sharp(sourcePath)
    .ensureAlpha()
    .extractChannel(3)
    .threshold(127)
    .png({ compressionLevel: 9, palette: false })
    .toFile(outputPath);
}

async function clampBeautyToAuthority(beautyPath: string, maskPath: string): Promise<void> {
  const [{ data: beauty, info }, { data: mask, info: maskInfo }] = await Promise.all([
    sharp(beautyPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(maskPath).raw().toBuffer({ resolveWithObject: true }),
  ]);
  if (info.width !== maskInfo.width || info.height !== maskInfo.height) {
    throw new Error("Cannot clamp beauty and mask with different canvases.");
  }
  for (let pixel = 0; pixel < info.width * info.height; pixel += 1) {
    const alpha = mask[pixel * maskInfo.channels];
    const offset = pixel * info.channels;
    beauty[offset + 3] = alpha;
    if (alpha === 0) {
      beauty[offset] = 0;
      beauty[offset + 1] = 0;
      beauty[offset + 2] = 0;
    }
  }
  await sharp(beauty, { raw: info })
    .png({ compressionLevel: 9 })
    .toFile(beautyPath);
}

export async function renderCyl9RollonPack(input: {
  outputDir: string;
  scenePath?: string;
  stoneLayoutPath?: string;
  blenderScriptPath?: string;
  reportPath?: string;
}): Promise<InspectedRenderPack> {
  const outputDir = path.resolve(input.outputDir);
  const scenePath = path.resolve(input.scenePath ?? DEFAULT_CYL9_ROLLON_SCENE);
  const stoneLayoutPath = path.resolve(input.stoneLayoutPath ?? DEFAULT_CYL9_STONE_LAYOUT);
  const blenderScriptPath = path.resolve(input.blenderScriptPath ?? DEFAULT_BLENDER_SCRIPT);
  await mkdir(outputDir, { recursive: true });

  await spawnBlender([
    "--background",
    "--factory-startup",
    "--python",
    blenderScriptPath,
    "--",
    "--config",
    scenePath,
    "--stone-layout",
    stoneLayoutPath,
    "--output",
    outputDir,
  ]);

  const scene = JSON.parse(await readFile(scenePath, "utf8")) as SceneConfig;
  const stoneLayoutBuffer = await readFile(stoneLayoutPath);
  const rendererResult = JSON.parse(
    await readFile(path.join(outputDir, "renderer-result.json"), "utf8"),
  ) as {
    blenderVersion: string;
    beautyFiles: Record<string, string>;
    authoritativeMaskRaw: string;
    stoneMaskRaw: string;
  };
  const maskPath = "authoritative-mask.png";
  const stoneMaskPath = "stone-mask.png";
  await binaryMask(path.join(outputDir, rendererResult.authoritativeMaskRaw), path.join(outputDir, maskPath));
  await binaryMask(path.join(outputDir, rendererResult.stoneMaskRaw), path.join(outputDir, stoneMaskPath));
  const maskSha256 = sha256(await readFile(path.join(outputDir, maskPath)));
  const stoneMaskSha256 = sha256(await readFile(path.join(outputDir, stoneMaskPath)));
  const geometryRecipeSha256 = canonicalSha256({
    canvas: scene.canvas,
    placement: scene.placement,
    imageContract: scene.imageContract,
    physicalEvidence: scene.physicalEvidence,
    geometry: scene.geometry,
    camera: scene.camera,
  });

  const assets: RenderManifestAsset[] = [];
  for (const variant of scene.variants) {
    const beautyPath = rendererResult.beautyFiles[variant.variantKey];
    if (!beautyPath) throw new Error(`Blender omitted ${variant.variantKey}.`);
    await clampBeautyToAuthority(path.join(outputDir, beautyPath), path.join(outputDir, maskPath));
    assets.push({
      variantKey: variant.variantKey,
      materialKey: variant.materialKey,
      beautyPath,
      beautySha256: sha256(await readFile(path.join(outputDir, beautyPath))),
      maskPath,
      maskSha256,
      stoneMaskPath: variant.stoneColor ? stoneMaskPath : null,
      stoneMaskSha256: variant.stoneColor ? stoneMaskSha256 : null,
      geometryRecipeSha256,
      mountAxisXPx: scene.placement.mountAxisXPx,
      seatYPx: scene.placement.seatYPx,
    });
  }

  const manifest: RenderManifest = {
    schemaVersion: 1,
    rendererVersion: scene.rendererVersion,
    blenderVersion: rendererResult.blenderVersion,
    canvas: scene.canvas,
    geometryKey: scene.geometryKey,
    geometryRecipeSha256,
    stoneLayoutSha256: sha256(stoneLayoutBuffer),
    maskPath,
    maskSha256,
    stoneMaskPath,
    stoneMaskSha256,
    assets,
  };
  await writeFile(path.join(outputDir, "render-pack.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  const inspected = await inspectRenderPack(outputDir);

  if (input.reportPath) {
    await writeFile(path.resolve(input.reportPath), `${JSON.stringify({
      schemaVersion: 1,
      rendererVersion: inspected.rendererVersion,
      geometryKey: inspected.geometryKey,
      geometryRecipeSha256,
      stoneLayoutSha256: manifest.stoneLayoutSha256,
      canvas: scene.canvas,
      placement: scene.placement,
      imageContract: scene.imageContract,
      physicalEvidence: scene.physicalEvidence,
      qualification: {
        geometryLocked: inspected.geometryLocked,
        geometryGate: "exact-authoritative-mask-alpha",
        visualStatus: "candidate-not-approved",
        catalogApproval: false,
        assemblyContext: "reviewed against the locked CYL-9ML clear body plate",
        findings: [
          "Fitment, center axis, baseline, shared silhouette, and alpha clamp passed.",
          "Mirror banding still requires catalog art-direction approval.",
          "Matte gold is too ochre/flat and glossy white reads gray in assembly context.",
          "Rhinestone variants currently read as small studs rather than final faceted stones.",
        ],
      },
      mask: inspected.mask,
      assets: inspected.assets.map((asset) => ({
        variantKey: asset.variantKey,
        materialKey: asset.materialKey,
        beautySha256: asset.beautySha256,
        clippingMassRatio: asset.clippingMassRatio,
      })),
    }, null, 2)}\n`);
  }
  return inspected;
}

async function inspectMask(maskFile: string, expectedWidth: number, expectedHeight: number) {
  const { data, info } = await sharp(maskFile).raw().toBuffer({ resolveWithObject: true });
  if (info.width !== expectedWidth || info.height !== expectedHeight) {
    throw new Error(`Authority mask is ${info.width}x${info.height}; expected ${expectedWidth}x${expectedHeight}.`);
  }
  let foregroundPixelCount = 0;
  let isBinary = true;
  let left = info.width;
  let top = info.height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const value = data[(y * info.width + x) * info.channels];
      if (value !== 0 && value !== 255) isBinary = false;
      if (value > 0) {
        foregroundPixelCount += 1;
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x);
        bottom = Math.max(bottom, y);
      }
    }
  }
  if (foregroundPixelCount === 0) throw new Error("Authority mask is empty.");
  const bounds = { left, top, right, bottom };
  return {
    foregroundPixelCount,
    coverageRatio: foregroundPixelCount / (info.width * info.height),
    bounds,
    isBinary,
    touchesFrame: left === 0 || top === 0 || right === info.width - 1 || bottom === info.height - 1,
  };
}

async function clippingMass(beautyFile: string, maskFile: string): Promise<number> {
  const [{ data: beauty, info }, { data: mask, info: maskInfo }] = await Promise.all([
    sharp(beautyFile).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(maskFile).raw().toBuffer({ resolveWithObject: true }),
  ]);
  if (info.width !== maskInfo.width || info.height !== maskInfo.height) {
    throw new Error("Beauty and authority mask dimensions disagree.");
  }
  let foreground = 0;
  let clipped = 0;
  for (let pixel = 0; pixel < info.width * info.height; pixel += 1) {
    const authorityAlpha = mask[pixel * maskInfo.channels];
    const offset = pixel * info.channels;
    if (beauty[offset + 3] !== authorityAlpha) {
      throw new Error("Beauty alpha does not exactly match the authoritative mask.");
    }
    if (authorityAlpha === 0) continue;
    foreground += 1;
    const luminance = beauty[offset] * 0.2126 + beauty[offset + 1] * 0.7152 + beauty[offset + 2] * 0.0722;
    if (luminance <= 1 || luminance >= 254) clipped += 1;
  }
  return foreground === 0 ? 1 : clipped / foreground;
}

export async function inspectRenderPack(fixtureDir: string): Promise<InspectedRenderPack> {
  const root = path.resolve(fixtureDir);
  const manifest = JSON.parse(await readFile(path.join(root, "render-pack.json"), "utf8")) as RenderManifest;
  if (manifest.schemaVersion !== 1 || manifest.assets.length !== 10) {
    throw new Error("Render pack must contain exactly ten v1 assets.");
  }
  if (new Set(manifest.assets.map(({ geometryRecipeSha256 }) => geometryRecipeSha256)).size !== 1) {
    throw new Error("Render pack contains multiple geometry recipes.");
  }
  if (new Set(manifest.assets.map(({ maskSha256 }) => maskSha256)).size !== 1) {
    throw new Error("Render pack contains multiple authority masks.");
  }

  const maskFile = path.join(root, manifest.maskPath);
  const actualMaskSha = sha256(await readFile(maskFile));
  if (actualMaskSha !== manifest.maskSha256) throw new Error("Authority mask SHA does not match bytes.");
  const mask = await inspectMask(maskFile, manifest.canvas.widthPx, manifest.canvas.heightPx);
  if (!mask.isBinary || mask.touchesFrame || mask.coverageRatio >= 0.5) {
    throw new Error("Authority mask failed binary/object-not-frame calibration.");
  }
  const measuredWidth = mask.bounds.right - mask.bounds.left + 1;
  if (Math.abs(measuredWidth - 363) > 2 || Math.abs(mask.bounds.bottom - 1002) > 2) {
    throw new Error(`Authority mask placement drifted: width ${measuredWidth}, bottom ${mask.bounds.bottom}.`);
  }

  const assets = await Promise.all(manifest.assets.map(async (asset) => {
    if (
      asset.geometryRecipeSha256 !== manifest.geometryRecipeSha256
      || asset.maskSha256 !== manifest.maskSha256
      || asset.mountAxisXPx !== 1041
      || asset.seatYPx !== 1002
    ) {
      throw new Error(`${asset.variantKey} violates the shared placement/geometry contract.`);
    }
    const beautyFile = path.join(root, asset.beautyPath);
    const beautyBytes = await readFile(beautyFile);
    if (sha256(beautyBytes) !== asset.beautySha256) {
      throw new Error(`${asset.variantKey} beauty SHA does not match bytes.`);
    }
    const metadata = await sharp(beautyBytes).metadata();
    if (metadata.width !== manifest.canvas.widthPx || metadata.height !== manifest.canvas.heightPx) {
      throw new Error(`${asset.variantKey} canvas dimensions drifted.`);
    }
    return {
      ...asset,
      widthPx: metadata.width,
      heightPx: metadata.height,
      clippingMassRatio: await clippingMass(beautyFile, maskFile),
    };
  }));

  return {
    rendererVersion: manifest.rendererVersion,
    geometryKey: manifest.geometryKey,
    geometryLocked: true,
    assets,
    mask: { sha256: actualMaskSha, ...mask },
  };
}

function cliArg(name: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

async function main(): Promise<void> {
  const outputDir = cliArg("--output", "tmp/paper-doll-cyl9-rollon-pack") as string;
  const reportPath = cliArg("--report", "docs/paper-doll-rig/cyl9-rollon-render-report.json");
  const pack = await renderCyl9RollonPack({ outputDir, reportPath });
  process.stdout.write(`${JSON.stringify({
    assets: pack.assets.length,
    geometryLocked: pack.geometryLocked,
    mask: pack.mask,
    maxClippingMassRatio: Math.max(...pack.assets.map(({ clippingMassRatio }) => clippingMassRatio)),
  }, null, 2)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
