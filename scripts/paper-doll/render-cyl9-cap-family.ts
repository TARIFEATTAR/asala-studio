import { spawnSync } from "node:child_process";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

import sharp from "sharp";

import {
  parseCyl9BlenderManifest,
  parseCyl9CapFamilyRecipe,
  solveCyl9CapPlacement,
} from "../../src/lib/paperDoll/cyl9CapFamily";
import {
  compareAlphaSilhouettes,
  type AlphaSilhouetteComparison,
} from "../../src/lib/paperDoll/closureMaterialPilot";

const RECIPE_PATH = "docs/paper-doll-rig/cyl9-cap-family-recipe.json";
const BLENDER_SCRIPT_PATH = "scripts/paper-doll/render_cyl9_cap_family.py";
const OUTPUT_DIRECTORY = "outputs/paper-doll-cyl9-cap-family/candidate-v2";
const REVIEW_DIRECTORY = `${OUTPUT_DIRECTORY}/review`;
const BLENDER_EXECUTABLE = "/Applications/Blender.app/Contents/MacOS/Blender";
const BODY_PLATES = ["amber", "cobalt", "clear", "frosted", "swirl"] as const;

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
  const image = await decodeRgba(maskPng);
  const occupied = new Uint8Array(image.width * image.height);
  let occupiedPixels = 0;
  let touchesFrame = false;

  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      const index = y * image.width + x;
      if (image.data[index * 4 + 3] === 0) continue;
      occupied[index] = 1;
      occupiedPixels++;
      if (x === 0 || y === 0 || x === image.width - 1 || y === image.height - 1) touchesFrame = true;
    }
  }
  if (occupiedPixels === 0) throw new Error("Authority mask is empty.");
  if (touchesFrame) throw new Error("Authority mask touches the image frame.");

  let componentCount = 0;
  const visited = new Uint8Array(occupied.length);
  const queue = new Int32Array(occupied.length);
  for (let start = 0; start < occupied.length; start++) {
    if (!occupied[start] || visited[start]) continue;
    componentCount++;
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    visited[start] = 1;
    while (head < tail) {
      const current = queue[head++];
      const x = current % image.width;
      const y = Math.floor(current / image.width);
      const neighbors = [
        x > 0 ? current - 1 : -1,
        x + 1 < image.width ? current + 1 : -1,
        y > 0 ? current - image.width : -1,
        y + 1 < image.height ? current + image.width : -1,
      ];
      for (const neighbor of neighbors) {
        if (neighbor < 0 || !occupied[neighbor] || visited[neighbor]) continue;
        visited[neighbor] = 1;
        queue[tail++] = neighbor;
      }
    }
  }
  if (componentCount !== 1) {
    throw new Error(`Authority mask must contain exactly 1 connected component; measured ${componentCount}.`);
  }

  const bounds = alphaBounds(image);
  if (!bounds) throw new Error("Authority mask is empty.");
  return { width: image.width, height: image.height, occupiedPixels, componentCount, touchesFrame, bounds };
}

export async function clampRenderToAuthorityMask(renderPng: Buffer, maskPng: Buffer): Promise<Buffer> {
  const [render, mask, inspection] = await Promise.all([
    decodeRgba(renderPng),
    decodeRgba(maskPng),
    inspectAuthorityMask(maskPng),
  ]);
  if (render.width !== mask.width || render.height !== mask.height) {
    throw new Error(`Render and authority mask dimensions differ: ${render.width}×${render.height} vs ${mask.width}×${mask.height}.`);
  }

  const output = Buffer.alloc(render.data.length);
  for (let index = 0; index < render.width * render.height; index++) {
    if (mask.data[index * 4 + 3] === 0) continue;
    output[index * 4] = render.data[index * 4];
    output[index * 4 + 1] = render.data[index * 4 + 1];
    output[index * 4 + 2] = render.data[index * 4 + 2];
    output[index * 4 + 3] = 255;
  }

  if (inspection.occupiedPixels === 0) throw new Error("Authority mask is empty.");
  return sharp(output, { raw: { width: render.width, height: render.height, channels: 4 } }).png().toBuffer();
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

async function placeCapOnBody(
  bodyPath: string,
  capPng: Buffer,
  recipe: ReturnType<typeof parseCyl9CapFamilyRecipe>,
): Promise<{ composite: Buffer; placement: ReturnType<typeof solveCyl9CapPlacement> }> {
  const cap = await decodeRgba(capPng);
  const bounds = alphaBounds(cap);
  if (!bounds) throw new Error("Clamped cap render has no alpha foreground.");
  const placement = solveCyl9CapPlacement(bounds.width, bounds.height, recipe);
  const trimmed = await sharp(capPng)
    .extract({ left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height })
    .resize({ width: placement.width, height: placement.height, fit: "fill" })
    .png()
    .toBuffer();
  const bodyMetadata = await sharp(bodyPath).metadata();
  if (bodyMetadata.width !== recipe.placement.canvasWidthPx || bodyMetadata.height !== recipe.placement.canvasHeightPx) {
    throw new Error(`${bodyPath} is not a ${recipe.placement.canvasWidthPx}×${recipe.placement.canvasHeightPx} locked body plate.`);
  }
  return {
    composite: await sharp(bodyPath)
      .composite([{ input: trimmed, left: placement.left, top: placement.top }])
      .png()
      .toBuffer(),
    placement,
  };
}

async function fiveBodyLineup(composites: Array<{ name: string; png: Buffer }>): Promise<Buffer> {
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

function cliValue(argv: string[], name: string, fallback: string): string {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 ? argv[index + 1] ?? fallback : fallback;
}

export async function buildCapFamilyReviewBundle(input: { stage: string; samples: number }) {
  if (input.stage !== "silver") throw new Error("Only the silver human-checkpoint stage is available before approval.");
  const blender = spawnSync(BLENDER_EXECUTABLE, [
    "--background",
    "--python", BLENDER_SCRIPT_PATH,
    "--",
    "--recipe", RECIPE_PATH,
    "--out", OUTPUT_DIRECTORY,
    "--variants", "SSLV",
    "--samples", String(input.samples),
  ], { cwd: process.cwd(), encoding: "utf8" });
  if (blender.status !== 0) {
    throw new Error(`Blender render failed.\n${blender.stdout}\n${blender.stderr}`);
  }

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

async function main() {
  const stage = cliValue(process.argv.slice(2), "stage", "silver");
  const samples = Number(cliValue(process.argv.slice(2), "samples", "32"));
  if (!Number.isInteger(samples) || samples <= 0) throw new Error("--samples must be a positive integer.");
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
