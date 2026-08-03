import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

import sharp from "sharp";

import {
  CYL9_CAP_VARIANT_KEYS,
  parseCyl9BlenderManifest,
  parseCyl9CapFamilyRecipe,
  solveCyl9CapPlacement,
  type Cyl9BlenderManifest,
  type Cyl9CapFamilyRecipe,
} from "../../src/lib/paperDoll/cyl9CapFamily";
import {
  compareAlphaSilhouettes,
  type AlphaSilhouetteComparison,
} from "../../src/lib/paperDoll/closureMaterialPilot";
import {
  buildPlacedComponentLayer,
  clampToAuthorityMask,
  composeComponentAssembly,
  inspectAuthorityMask as inspectGenericAuthorityMask,
  normalizeMaterialIntoAuthority,
} from "../../src/lib/paperDoll/componentPlateImage.node";

const RECIPE_PATH = "docs/paper-doll-rig/cyl9-cap-family-recipe.json";
const BLENDER_SCRIPT_PATH = "scripts/paper-doll/render_cyl9_cap_family.py";
const OUTPUT_DIRECTORY = "outputs/paper-doll-cyl9-cap-family/candidate-v2";
const REVIEW_DIRECTORY = `${OUTPUT_DIRECTORY}/review`;
const BLENDER_EXECUTABLE = "/Applications/Blender.app/Contents/MacOS/Blender";
const BODY_PLATES = ["amber", "cobalt", "clear", "frosted", "swirl"] as const;

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

interface DecodedRgba {
  data: Buffer;
  width: number;
  height: number;
}

export interface AuthorityMaskInspection {
  width: number;
  height: number;
  occupiedPixels: number;
  componentCount: number;
  touchesFrame: boolean;
  bounds: { left: number; top: number; right: number; bottom: number; width: number; height: number };
}

export interface AuthorityDifference {
  iou: number;
  mismatchedPixels: number;
  offsetsPx: { left: number; right: number; top: number; bottom: number };
  authorityAspectRatio: number;
  maskAspectRatio: number;
  topArcObservation: string;
  differencePng: Buffer;
}

export interface MaterialPixelBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface GeometryLockedMaterialPlate {
  png: Buffer;
  authorityBounds: AuthorityMaskInspection["bounds"];
  materialBounds: MaterialPixelBounds;
  qa: {
    geometryLocked: boolean;
    minIoU: number;
    mismatchedPixels: number;
  };
}

export function validateCompleteCapFamilyManifest(
  manifest: Cyl9BlenderManifest,
  recipe: Cyl9CapFamilyRecipe,
): void {
  const keys = manifest.renders.map(({ variantKey }) => variantKey);
  if (
    keys.length !== CYL9_CAP_VARIANT_KEYS.length ||
    keys.some((key, index) => key !== CYL9_CAP_VARIANT_KEYS[index])
  ) {
    throw new Error("Blender manifest must contain the exact ten catalog variants in canonical order.");
  }
  const expectedCrystals = JSON.stringify(recipe.crystalLayout);
  for (const render of manifest.renders) {
    const variant = recipe.variants.find(({ variantKey }) => variantKey === render.variantKey);
    if (!variant) throw new Error(`${render.variantKey} is missing from the cap recipe.`);
    if (variant.decoration === "crystal-v1") {
      if (JSON.stringify(render.crystals) !== expectedCrystals) {
        throw new Error(`${render.variantKey} crystal transforms differ from the deterministic family layout.`);
      }
    } else if (render.crystals.length !== 0) {
      throw new Error(`${render.variantKey} must not contain crystal transforms.`);
    }
  }
}

async function decodeRgba(input: Buffer): Promise<DecodedRgba> {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

function alphaBounds(image: DecodedRgba) {
  let left = image.width;
  let top = image.height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      if (image.data[(y * image.width + x) * 4 + 3] === 0) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }
  if (right < left || bottom < top) return null;
  return { left, top, right, bottom, width: right - left + 1, height: bottom - top + 1 };
}

export async function inspectAuthorityMask(maskPng: Buffer): Promise<AuthorityMaskInspection> {
  const inspection = await inspectGenericAuthorityMask(maskPng, { expectedRegions: 1 });
  const { left, top, width, height } = inspection.authorityBoundsPx;
  return {
    width: inspection.width,
    height: inspection.height,
    occupiedPixels: inspection.occupiedPixels,
    componentCount: inspection.componentCount,
    touchesFrame: inspection.touchesFrame,
    bounds: {
      left,
      top,
      right: left + width - 1,
      bottom: top + height - 1,
      width,
      height,
    },
  };
}

export async function clampRenderToAuthorityMask(renderPng: Buffer, maskPng: Buffer): Promise<Buffer> {
  return clampToAuthorityMask(renderPng, maskPng);
}

export async function buildGeometryLockedMaterialPlate(input: {
  materialPng: Buffer;
  authorityMaskPng: Buffer;
  materialBounds: MaterialPixelBounds;
}): Promise<GeometryLockedMaterialPlate> {
  const result = await normalizeMaterialIntoAuthority({
    materialPng: input.materialPng,
    authorityMaskPng: input.authorityMaskPng,
    sourceBoundsPx: input.materialBounds,
  });
  const { left, top, width, height } = result.authorityBoundsPx;
  return {
    png: result.png,
    authorityBounds: {
      left,
      top,
      right: left + width - 1,
      bottom: top + height - 1,
      width,
      height,
    },
    materialBounds: input.materialBounds,
    qa: result.qa,
  };
}

export async function compareClampedVariantAlpha(
  variants: Array<{ name: string; png: Buffer }>,
): Promise<AlphaSilhouetteComparison> {
  const decoded = await Promise.all(variants.map(async ({ name, png }) => {
    const image = await decodeRgba(png);
    const alpha = new Uint8Array(image.width * image.height);
    for (let index = 0; index < alpha.length; index++) alpha[index] = image.data[index * 4 + 3];
    return { name, image: { width: image.width, height: image.height, alpha } };
  }));
  return compareAlphaSilhouettes(decoded, 1);
}

async function normalizedAuthorityAlpha(authorityPng: Buffer, maskPng: Buffer): Promise<Buffer> {
  const [authority, maskInspection] = await Promise.all([
    decodeRgba(authorityPng),
    inspectAuthorityMask(maskPng),
  ]);
  const bounds = alphaBounds(authority);
  if (!bounds) throw new Error("Photographic authority has no alpha foreground.");
  const authorityCrop = await sharp(authorityPng)
    .extract({ left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height })
    .ensureAlpha()
    .extractChannel("alpha")
    .resize({
      width: maskInspection.bounds.width,
      height: maskInspection.bounds.height,
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .threshold(0)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const left = maskInspection.bounds.left + Math.floor((maskInspection.bounds.width - authorityCrop.info.width) / 2);
  const top = maskInspection.bounds.top + Math.floor((maskInspection.bounds.height - authorityCrop.info.height) / 2);
  const cropRgba = Buffer.alloc(authorityCrop.info.width * authorityCrop.info.height * 4);
  for (let index = 0; index < authorityCrop.info.width * authorityCrop.info.height; index++) {
    cropRgba[index * 4] = 255;
    cropRgba[index * 4 + 1] = 255;
    cropRgba[index * 4 + 2] = 255;
    cropRgba[index * 4 + 3] = authorityCrop.data[index];
  }
  const cropPng = await sharp(cropRgba, {
    raw: { width: authorityCrop.info.width, height: authorityCrop.info.height, channels: 4 },
  }).png().toBuffer();
  return sharp({
    create: {
      width: maskInspection.width,
      height: maskInspection.height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  }).composite([{ input: cropPng, left, top }]).png().toBuffer();
}

export async function measureAuthorityDifference(
  authorityPng: Buffer,
  maskPng: Buffer,
): Promise<AuthorityDifference> {
  const [authority, mask, maskInspection] = await Promise.all([
    normalizedAuthorityAlpha(authorityPng, maskPng),
    sharp(maskPng).ensureAlpha().extractChannel("alpha").threshold(0).raw().toBuffer({ resolveWithObject: true }),
    inspectAuthorityMask(maskPng),
  ]);
  const normalized = await decodeRgba(authority);
  const xor = Buffer.alloc(mask.info.width * mask.info.height * 4);
  let intersection = 0;
  let union = 0;
  let mismatchedPixels = 0;
  for (let index = 0; index < mask.info.width * mask.info.height; index++) {
    const authorityOccupied = normalized.data[index * 4 + 3] > 0;
    const maskOccupied = mask.data[index] > 0;
    if (authorityOccupied && maskOccupied) intersection++;
    if (authorityOccupied || maskOccupied) union++;
    if (authorityOccupied !== maskOccupied) mismatchedPixels++;
    const value = authorityOccupied !== maskOccupied ? 255 : 0;
    xor[index * 4] = value;
    xor[index * 4 + 1] = value;
    xor[index * 4 + 2] = value;
    xor[index * 4 + 3] = 255;
  }
  const normalizedBounds = alphaBounds(normalized);
  if (!normalizedBounds) throw new Error("Normalized authority is empty.");
  const offsetsPx = {
    left: normalizedBounds.left - maskInspection.bounds.left,
    right: maskInspection.bounds.right - normalizedBounds.right,
    top: normalizedBounds.top - maskInspection.bounds.top,
    bottom: maskInspection.bounds.bottom - normalizedBounds.bottom,
  };
  return {
    iou: union === 0 ? 1 : intersection / union,
    mismatchedPixels,
    offsetsPx,
    authorityAspectRatio: normalizedBounds.width / normalizedBounds.height,
    maskAspectRatio: maskInspection.bounds.width / maskInspection.bounds.height,
    topArcObservation: "Photographic alpha normalized without aspect distortion; top contour remains a human-review checkpoint.",
    differencePng: await sharp(xor, {
      raw: { width: mask.info.width, height: mask.info.height, channels: 4 },
    }).png().toBuffer(),
  };
}

export async function buildPlacedCapLayer(
  capPng: Buffer,
  recipe: ReturnType<typeof parseCyl9CapFamilyRecipe>,
): Promise<{ layer: Buffer; placement: ReturnType<typeof solveCyl9CapPlacement> }> {
  const cap = await decodeRgba(capPng);
  const bounds = alphaBounds(cap);
  if (!bounds) throw new Error("Clamped cap render has no alpha foreground.");
  const placement = solveCyl9CapPlacement(bounds.width, bounds.height, recipe);
  const generic = await buildPlacedComponentLayer({
    componentPng: capPng,
    canvas: {
      widthPx: recipe.placement.canvasWidthPx,
      heightPx: recipe.placement.canvasHeightPx,
    },
    transform: {
      widthPx: recipe.placement.widthPx,
      centerXPx: recipe.placement.centerX,
      seatYPx: recipe.placement.bottomY,
    },
  });
  return { layer: generic.layerPng, placement };
}

export async function placeCapOnBody(
  bodyPath: string,
  capPng: Buffer,
  recipe: ReturnType<typeof parseCyl9CapFamilyRecipe>,
): Promise<{ composite: Buffer; layer: Buffer; placement: ReturnType<typeof solveCyl9CapPlacement> }> {
  const placed = await buildPlacedCapLayer(capPng, recipe);
  const bodyMetadata = await sharp(bodyPath).metadata();
  if (bodyMetadata.width !== recipe.placement.canvasWidthPx || bodyMetadata.height !== recipe.placement.canvasHeightPx) {
    throw new Error(`${bodyPath} is not a ${recipe.placement.canvasWidthPx}×${recipe.placement.canvasHeightPx} locked body plate.`);
  }
  return {
    composite: await composeComponentAssembly({
      bodyPng: await readFile(bodyPath),
      layerPng: placed.layer,
    }),
    ...placed,
  };
}

export async function fiveBodyLineup(composites: Array<{ name: string; png: Buffer }>): Promise<Buffer> {
  const tileWidth = 400;
  const imageHeight = 440;
  const labelHeight = 46;
  const gap = 16;
  const padding = 24;
  const width = padding * 2 + composites.length * tileWidth + (composites.length - 1) * gap;
  const height = padding * 2 + imageHeight + labelHeight;
  const layers: sharp.OverlayOptions[] = [];
  for (let index = 0; index < composites.length; index++) {
    const item = composites[index];
    const x = padding + index * (tileWidth + gap);
    const image = await sharp(item.png)
      .resize({ width: tileWidth, height: imageHeight, fit: "fill" })
      .png()
      .toBuffer();
    const label = Buffer.from(`<svg width="${tileWidth}" height="${labelHeight}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${tileWidth}" height="${labelHeight}" fill="#11100f"/>
      <text x="14" y="29" fill="#d9b36b" font-family="monospace" font-size="16" letter-spacing="2">${item.name.toUpperCase()}</text>
    </svg>`);
    layers.push({ input: image, left: x, top: padding });
    layers.push({ input: label, left: x, top: padding + imageHeight });
  }
  return sharp({ create: { width, height, channels: 4, background: { r: 7, g: 7, b: 6, alpha: 1 } } })
    .composite(layers)
    .png()
    .toBuffer();
}

function escapeXml(value: string): string {
  return value.replace(/[<>&"']/g, (character) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    "\"": "&quot;",
    "'": "&apos;",
  })[character] ?? character);
}

function runBlender(variants: string[], samples: number): void {
  const blender = spawnSync(BLENDER_EXECUTABLE, [
    "--background",
    "--python", BLENDER_SCRIPT_PATH,
    "--",
    "--recipe", RECIPE_PATH,
    "--out", OUTPUT_DIRECTORY,
    "--variants", variants.join(","),
    "--samples", String(samples),
  ], { cwd: process.cwd(), encoding: "utf8" });
  if (blender.status !== 0) {
    throw new Error(`Blender render failed.\n${blender.stdout}\n${blender.stderr}`);
  }
}

async function measureToneFixture(png: Buffer) {
  const image = await decodeRgba(png);
  const luminance: number[] = [];
  for (let index = 0; index < image.width * image.height; index++) {
    if (image.data[index * 4 + 3] === 0) continue;
    luminance.push(
      image.data[index * 4] * 0.2126 +
      image.data[index * 4 + 1] * 0.7152 +
      image.data[index * 4 + 2] * 0.0722,
    );
  }
  luminance.sort((left, right) => left - right);
  const percentile = (ratio: number) => luminance[Math.min(luminance.length - 1, Math.floor(luminance.length * ratio))] ?? 0;
  const mean = luminance.reduce((sum, value) => sum + value, 0) / Math.max(1, luminance.length);
  return {
    occupiedPixels: luminance.length,
    meanLuminance: Number(mean.toFixed(4)),
    p05Luminance: Number(percentile(0.05).toFixed(4)),
    p95Luminance: Number(percentile(0.95).toFixed(4)),
    contrastSpan: Number(((percentile(0.95) - percentile(0.05)) / 255).toFixed(6)),
    reviewRequired: true,
  };
}

async function materialContactSheet(
  variants: Array<{ variantKey: string; material: string; decoration: string; composite: Buffer }>,
): Promise<Buffer> {
  const columns = 5;
  const tileWidth = 360;
  const imageHeight = 396;
  const labelHeight = 58;
  const gap = 14;
  const padding = 24;
  const rows = Math.ceil(variants.length / columns);
  const width = padding * 2 + columns * tileWidth + (columns - 1) * gap;
  const height = padding * 2 + rows * (imageHeight + labelHeight) + (rows - 1) * gap;
  const layers: sharp.OverlayOptions[] = [];
  for (let index = 0; index < variants.length; index++) {
    const variant = variants[index];
    const column = index % columns;
    const row = Math.floor(index / columns);
    const left = padding + column * (tileWidth + gap);
    const top = padding + row * (imageHeight + labelHeight + gap);
    const preview = await sharp(variant.composite)
      .resize({ width: tileWidth, height: imageHeight, fit: "fill" })
      .png()
      .toBuffer();
    const label = Buffer.from(`<svg width="${tileWidth}" height="${labelHeight}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${tileWidth}" height="${labelHeight}" fill="#11100f"/>
      <text x="14" y="25" fill="#d9b36b" font-family="monospace" font-size="16" font-weight="700">${escapeXml(variant.variantKey)}</text>
      <text x="14" y="45" fill="#d8d2c7" font-family="sans-serif" font-size="13">${escapeXml(variant.material)} · ${escapeXml(variant.decoration)}</text>
    </svg>`);
    layers.push({ input: preview, left, top });
    layers.push({ input: label, left, top: top + imageHeight });
  }
  return sharp({ create: { width, height, channels: 4, background: { r: 7, g: 7, b: 6, alpha: 1 } } })
    .composite(layers)
    .png()
    .toBuffer();
}

async function fiftyAssemblyMatrix(
  rows: Array<{ variantKey: string; composites: Array<{ body: string; png: Buffer }> }>,
): Promise<Buffer> {
  const labelWidth = 112;
  const tileWidth = 180;
  const tileHeight = 198;
  const headerHeight = 42;
  const gap = 8;
  const padding = 18;
  const rowHeight = tileHeight + gap;
  const width = padding * 2 + labelWidth + gap + BODY_PLATES.length * tileWidth + (BODY_PLATES.length - 1) * gap;
  const height = padding * 2 + headerHeight + rows.length * rowHeight;
  const layers: sharp.OverlayOptions[] = [];
  for (let column = 0; column < BODY_PLATES.length; column++) {
    const left = padding + labelWidth + gap + column * (tileWidth + gap);
    layers.push({
      input: Buffer.from(`<svg width="${tileWidth}" height="${headerHeight}" xmlns="http://www.w3.org/2000/svg">
        <text x="8" y="27" fill="#d9b36b" font-family="monospace" font-size="15">${BODY_PLATES[column].toUpperCase()}</text>
      </svg>`),
      left,
      top: padding,
    });
  }
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    const top = padding + headerHeight + rowIndex * rowHeight;
    layers.push({
      input: Buffer.from(`<svg width="${labelWidth}" height="${tileHeight}" xmlns="http://www.w3.org/2000/svg">
        <rect width="${labelWidth}" height="${tileHeight}" fill="#11100f"/>
        <text x="12" y="32" fill="#d9b36b" font-family="monospace" font-size="16" font-weight="700">${escapeXml(row.variantKey)}</text>
      </svg>`),
      left: padding,
      top,
    });
    for (let column = 0; column < row.composites.length; column++) {
      const preview = await sharp(row.composites[column].png)
        .resize({ width: tileWidth, height: tileHeight, fit: "fill" })
        .png()
        .toBuffer();
      layers.push({
        input: preview,
        left: padding + labelWidth + gap + column * (tileWidth + gap),
        top,
      });
    }
  }
  return sharp({ create: { width, height, channels: 4, background: { r: 7, g: 7, b: 6, alpha: 1 } } })
    .composite(layers)
    .png()
    .toBuffer();
}

function cliValue(argv: string[], name: string, fallback: string): string {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 ? argv[index + 1] ?? fallback : fallback;
}

export async function buildCapFamilyReviewBundle(input: { stage: string; samples: number }) {
  if (input.stage !== "silver") throw new Error("Only the silver human-checkpoint stage is available before approval.");
  runBlender(["SSLV"], input.samples);

  const recipe = parseCyl9CapFamilyRecipe(JSON.parse(await readFile(RECIPE_PATH, "utf8")));
  const manifest = parseCyl9BlenderManifest(JSON.parse(await readFile(`${OUTPUT_DIRECTORY}/blender-manifest.json`, "utf8")));
  const silverRecord = manifest.renders.find(({ variantKey }) => variantKey === "SSLV");
  if (!silverRecord) throw new Error("Blender manifest does not include SSLV.");
  const [renderPng, maskPng, authorityPng] = await Promise.all([
    readFile(`${OUTPUT_DIRECTORY}/${silverRecord.path}`),
    readFile(`${OUTPUT_DIRECTORY}/${manifest.maskPath}`),
    readFile(recipe.authorityImagePath),
  ]);
  const maskInspection = await inspectAuthorityMask(maskPng);
  const clampedSilver = await clampRenderToAuthorityMask(renderPng, maskPng);
  const exactAlpha = await compareClampedVariantAlpha([
    { name: "SSLV", png: clampedSilver },
    { name: "authority-mask", png: await clampRenderToAuthorityMask(maskPng, maskPng) },
  ]);
  const authorityDifference = await measureAuthorityDifference(authorityPng, maskPng);
  const clearBodyPath = "assets/paper-doll/body-plates/body__cylinder__9ml__clear__70.0x20.0mm.png";
  const clear = await placeCapOnBody(clearBodyPath, clampedSilver, recipe);
  const bodyComposites = await Promise.all(BODY_PLATES.map(async (name) => ({
    name,
    png: (await placeCapOnBody(
      `assets/paper-doll/body-plates/body__cylinder__9ml__${name}__70.0x20.0mm.png`,
      clampedSilver,
      recipe,
    )).composite,
  })));

  await mkdir(REVIEW_DIRECTORY, { recursive: true });
  await Promise.all([
    copyFile(recipe.authorityImagePath, `${REVIEW_DIRECTORY}/01-authority.png`),
    writeFile(`${REVIEW_DIRECTORY}/02-blender-silver-isolated.png`, clampedSilver),
    writeFile(`${REVIEW_DIRECTORY}/03-silhouette-difference.png`, authorityDifference.differencePng),
    writeFile(`${REVIEW_DIRECTORY}/04-clear-bottle-silver.png`, clear.composite),
    writeFile(`${REVIEW_DIRECTORY}/05-five-body-lineup.png`, await fiveBodyLineup(bodyComposites)),
  ]);
  const report = {
    schemaVersion: 1,
    stage: "silver-human-checkpoint",
    geometryFamilyId: recipe.geometryFamilyId,
    sources: {
      authority: recipe.authorityImagePath,
      blenderRender: `${OUTPUT_DIRECTORY}/${silverRecord.path}`,
      authorityMask: `${OUTPUT_DIRECTORY}/${manifest.maskPath}`,
      clearBody: clearBodyPath,
    },
    placement: clear.placement,
    mask: maskInspection,
    exactAlpha: {
      minIoU: exactAlpha.minIoU,
      mismatchedPixels: exactAlpha.pairs.reduce((sum, pair) => sum + Math.max(0, pair.mismatchedPixels), 0),
      geometryLocked: exactAlpha.minIoU === 1 && exactAlpha.pairs.every(({ mismatchedPixels }) => mismatchedPixels === 0),
    },
    authorityDifference: {
      iou: authorityDifference.iou,
      mismatchedPixels: authorityDifference.mismatchedPixels,
      offsetsPx: authorityDifference.offsetsPx,
      authorityAspectRatio: authorityDifference.authorityAspectRatio,
      maskAspectRatio: authorityDifference.maskAspectRatio,
      topArcObservation: authorityDifference.topArcObservation,
    },
    provenance: manifest.sharedProvenance,
    outputs: {
      authority: `${REVIEW_DIRECTORY}/01-authority.png`,
      isolated: `${REVIEW_DIRECTORY}/02-blender-silver-isolated.png`,
      difference: `${REVIEW_DIRECTORY}/03-silhouette-difference.png`,
      clearComposite: `${REVIEW_DIRECTORY}/04-clear-bottle-silver.png`,
      lineup: `${REVIEW_DIRECTORY}/05-five-body-lineup.png`,
    },
    mutationPolicy: {
      currentReleaseChanged: false,
      sanityWritten: false,
      publicationChanged: false,
    },
    humanDecisionRequired: ["geometry-fit-approved", "revise-profile", "revise-placement", "revise-lighting"],
  };
  await writeFile(`${REVIEW_DIRECTORY}/silver-review.json`, `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

export async function buildCompleteCapFamilyBundle(input: { samples: number }) {
  runBlender([...CYL9_CAP_VARIANT_KEYS], input.samples);
  const recipe = parseCyl9CapFamilyRecipe(JSON.parse(await readFile(RECIPE_PATH, "utf8")));
  const manifest = parseCyl9BlenderManifest(JSON.parse(await readFile(`${OUTPUT_DIRECTORY}/blender-manifest.json`, "utf8")));
  validateCompleteCapFamilyManifest(manifest, recipe);
  const maskPng = await readFile(`${OUTPUT_DIRECTORY}/${manifest.maskPath}`);
  const maskInspection = await inspectAuthorityMask(maskPng);
  const clampedDirectory = `${OUTPUT_DIRECTORY}/clamped`;
  const layersDirectory = `${OUTPUT_DIRECTORY}/layers`;
  await Promise.all([
    mkdir(clampedDirectory, { recursive: true }),
    mkdir(layersDirectory, { recursive: true }),
    mkdir(REVIEW_DIRECTORY, { recursive: true }),
  ]);

  const bodySources = await Promise.all(BODY_PLATES.map(async (body) => ({
    body,
    path: `assets/paper-doll/body-plates/body__cylinder__9ml__${body}__70.0x20.0mm.png`,
  })));
  const clampedVariants: Array<{ name: string; png: Buffer }> = [];
  const reviewVariants: Array<{ variantKey: string; material: string; decoration: string; composite: Buffer }> = [];
  const matrixRows: Array<{ variantKey: string; composites: Array<{ body: string; png: Buffer }> }> = [];
  const variantRecords = [];

  for (const render of manifest.renders) {
    const variant = recipe.variants.find(({ variantKey }) => variantKey === render.variantKey);
    if (!variant) throw new Error(`${render.variantKey} is missing from the cap recipe.`);
    const renderPng = await readFile(`${OUTPUT_DIRECTORY}/${render.path}`);
    const clamped = await clampRenderToAuthorityMask(renderPng, maskPng);
    const placed = await buildPlacedCapLayer(clamped, recipe);
    const clampedPath = `${clampedDirectory}/${render.variantKey}.png`;
    const layerPath = `${layersDirectory}/${render.variantKey}.png`;
    await Promise.all([
      writeFile(clampedPath, clamped),
      writeFile(layerPath, placed.layer),
    ]);
    const composites = [];
    for (const bodySource of bodySources) {
      const composite = await sharp(bodySource.path)
        .composite([{ input: placed.layer, left: 0, top: 0 }])
        .png()
        .toBuffer();
      composites.push({ body: bodySource.body, png: composite });
    }
    const clearComposite = composites.find(({ body }) => body === "clear")?.png;
    if (!clearComposite) throw new Error("Clear body composite was not produced.");
    clampedVariants.push({ name: render.variantKey, png: clamped });
    reviewVariants.push({
      variantKey: render.variantKey,
      material: variant.material,
      decoration: variant.decoration,
      composite: clearComposite,
    });
    matrixRows.push({ variantKey: render.variantKey, composites });
    variantRecords.push({
      variantKey: render.variantKey,
      material: variant.material,
      decoration: variant.decoration,
      isolatedPath: clampedPath,
      isolatedSha256: sha256(clamped),
      layerPath,
      layerSha256: sha256(placed.layer),
      placement: placed.placement,
      crystals: render.crystals,
      toneFixture: await measureToneFixture(clamped),
    });
  }

  const exactAlpha = await compareClampedVariantAlpha(clampedVariants);
  const exactBinarySilhouette = exactAlpha.minIoU === 1 && exactAlpha.pairs.every(({ mismatchedPixels }) => mismatchedPixels === 0);
  if (!exactBinarySilhouette) {
    throw new Error(`Cap-family mask clamp failed: min IoU ${exactAlpha.minIoU}.`);
  }
  const materialSheetPath = `${REVIEW_DIRECTORY}/06-ten-finish-contact-sheet.png`;
  const assemblyMatrixPath = `${REVIEW_DIRECTORY}/07-fifty-assembly-matrix.png`;
  await Promise.all([
    writeFile(materialSheetPath, await materialContactSheet(reviewVariants)),
    writeFile(assemblyMatrixPath, await fiftyAssemblyMatrix(matrixRows)),
  ]);

  const report = {
    schemaVersion: 1,
    stage: "ten-finish-candidate",
    geometryFamilyId: recipe.geometryFamilyId,
    authorityMaskPath: `${OUTPUT_DIRECTORY}/${manifest.maskPath}`,
    authorityMaskSha256: sha256(maskPng),
    mask: maskInspection,
    placement: recipe.placement,
    provenance: manifest.sharedProvenance,
    variants: variantRecords,
    qa: {
      minIoU: exactAlpha.minIoU,
      exactBinarySilhouette,
      pairCount: exactAlpha.pairs.length,
      mismatchedPixels: exactAlpha.pairs.reduce((sum, pair) => sum + Math.max(0, pair.mismatchedPixels), 0),
      pairs: exactAlpha.pairs,
      tonePolicy: "Per-material measurements are evidence for named visual review; no shared luminance threshold approves unlike finishes.",
    },
    assemblyCoverage: {
      bodyCount: BODY_PLATES.length,
      capCount: CYL9_CAP_VARIANT_KEYS.length,
      explicitAssemblyCount: BODY_PLATES.length * CYL9_CAP_VARIANT_KEYS.length,
    },
    review: { materialSheetPath, assemblyMatrixPath },
    mutationPolicy: {
      currentReleaseChanged: false,
      sanityWritten: false,
      publicationChanged: false,
    },
    approvalsRequired: ["approve-pixels", "family-fit", "lock-shared-placement"],
  };
  const manifestPath = `${OUTPUT_DIRECTORY}/cap-family-manifest.json`;
  await writeFile(manifestPath, `${JSON.stringify(report, null, 2)}\n`);
  return { ...report, manifestPath };
}

async function main() {
  const stage = cliValue(process.argv.slice(2), "stage", "silver");
  const samples = Number(cliValue(process.argv.slice(2), "samples", "32"));
  if (!Number.isInteger(samples) || samples <= 0) throw new Error("--samples must be a positive integer.");
  if (stage === "all") {
    const report = await buildCompleteCapFamilyBundle({ samples });
    console.log(JSON.stringify({
      status: "cap-family-candidate-ready",
      stage: report.stage,
      variantCount: report.variants.length,
      explicitAssemblyCount: report.assemblyCoverage.explicitAssemblyCount,
      exactBinarySilhouette: report.qa.exactBinarySilhouette,
      minIoU: report.qa.minIoU,
      manifestPath: report.manifestPath,
      currentReleaseChanged: false,
      sanityWritten: false,
    }, null, 2));
    return;
  }
  const report = await buildCapFamilyReviewBundle({ stage, samples });
  console.log(JSON.stringify({
    status: "review-ready",
    stage: report.stage,
    geometryLocked: report.exactAlpha.geometryLocked,
    placement: report.placement,
    reviewDirectory: REVIEW_DIRECTORY,
    currentReleaseChanged: false,
    sanityWritten: false,
  }, null, 2));
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (import.meta.url === invokedPath) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack : error);
    process.exitCode = 1;
  });
}
