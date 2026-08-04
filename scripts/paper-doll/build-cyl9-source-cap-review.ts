import { execFile as execFileCallback } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { promisify } from "node:util";
import sharp from "sharp";

const execFile = promisify(execFileCallback);

const DEFAULT_CAPPED_ROOT = "/Users/jordanrichter/Projects/Clients/Nemat-International/BBUAT-Upload-Files/2. PSD Capped ";
const DEFAULT_OUTPUT_ROOT = "outputs/paper-doll-cyl9-cap-family/source-backed-v1";
const AUTHORITY_MASK_PATH = "assets/paper-doll/authority-masks/cyl9/closure__17-415__rollon-overcap__v2__mask.png";
const SHARED_PLACEMENT = { x: 0, y: -3, scale: 1 } as const;

const BODY_SOURCES = [
  { key: "AMBER", path: "assets/paper-doll/body-plates/body__cylinder__9ml__amber__70.0x20.0mm.png" },
  { key: "COBALT", path: "assets/paper-doll/body-plates/body__cylinder__9ml__cobalt__70.0x20.0mm.png" },
  { key: "CLEAR", path: "assets/paper-doll/body-plates/body__cylinder__9ml__clear__70.0x20.0mm.png" },
  { key: "FROSTED", path: "assets/paper-doll/body-plates/body__cylinder__9ml__frosted__70.0x20.0mm.png" },
  { key: "SWIRL", path: "assets/paper-doll/body-plates/body__cylinder__9ml__swirl__70.0x20.0mm.png" },
] as const;

export type Cyl9CapVariantKey = "BKDT" | "MCPR" | "MGLD" | "MSLV" | "PKDT" | "SBLK" | "SGLD" | "SLDT" | "SSLV" | "WHT";

export interface Cyl9SourceCapVariant {
  variantKey: Cyl9CapVariantKey;
  label: string;
  sourceMode: "capped-psd-layer" | "reviewed-existing-png";
  sourcePath: string;
  layerIndex?: number;
}

const SOURCE_VARIANTS = [
  { variantKey: "BKDT", label: "Black dotted", file: "12. GBCyl9RollBlkDot.psd", layerIndex: 5 },
  { variantKey: "MCPR", label: "Matte copper", file: "18. GBCyl9RollMattCu.psd", layerIndex: 4 },
  { variantKey: "MGLD", label: "Matte gold", file: "15. GBCyl9RollMattGl.psd", layerIndex: 4 },
  { variantKey: "MSLV", label: "Matte silver", file: "11. GBCyl9RollMattSl.psd", layerIndex: 4 },
  { variantKey: "PKDT", label: "Pink dotted", file: "14. GBCyl9RollPnkDot.psd", layerIndex: 5 },
  { variantKey: "SBLK", label: "Shiny black", file: "19. GBCyl9RollShBlk.psd", layerIndex: 4 },
  { variantKey: "SGLD", label: "Shiny gold", file: "16. GBCyl9RollShnGl.psd", layerIndex: 4 },
  { variantKey: "SLDT", label: "Silver dotted", file: "13. GBCyl9RollSlDot.psd", layerIndex: 4 },
  { variantKey: "SSLV", label: "Shiny silver", file: "17. GBCyl9RollShnSl.psd", layerIndex: 4 },
] as const;

const REVIEWED_WHITE_PATH = "outputs/paper-doll-cyl9-cap-family/material-calibration-v4/isolated/WHT.png";

export function planCyl9SourceCapVariants(cappedRoot = DEFAULT_CAPPED_ROOT): Cyl9SourceCapVariant[] {
  const clearCappedDirectory = join(cappedRoot, "3.  17-415 Bottles", "10. Clear  (Capped)");
  return [...SOURCE_VARIANTS.map(({ file, ...variant }) => ({
    ...variant,
    sourceMode: "capped-psd-layer" as const,
    sourcePath: join(clearCappedDirectory, file),
  })), {
    variantKey: "WHT",
    label: "White",
    sourceMode: "reviewed-existing-png" as const,
    sourcePath: REVIEWED_WHITE_PATH,
  }];
}

interface Bounds { left: number; top: number; width: number; height: number }

async function alphaBounds(png: Buffer): Promise<Bounds> {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const alphaChannel = info.channels - 1;
  let minX = info.width;
  let minY = info.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (data[(y * info.width + x) * info.channels + alphaChannel] === 0) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (maxX < minX || maxY < minY) throw new Error("Image contains no non-transparent pixels.");
  return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

export async function normalizeCapMaterialToAuthority(input: {
  materialPng: Buffer;
  authorityMaskPng: Buffer;
}): Promise<Buffer> {
  const [materialBounds, maskBounds, maskMetadata] = await Promise.all([
    alphaBounds(input.materialPng),
    alphaBounds(input.authorityMaskPng),
    sharp(input.authorityMaskPng).metadata(),
  ]);
  if (!maskMetadata.width || !maskMetadata.height) throw new Error("Authority mask dimensions are missing.");

  const materialCrop = await sharp(input.materialPng)
    .extract(materialBounds)
    .resize({ width: maskBounds.width, height: maskBounds.height, fit: "fill", kernel: sharp.kernel.lanczos3 })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const materialCanvas = await sharp({
    create: {
      width: maskMetadata.width,
      height: maskMetadata.height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  }).composite([{
    input: await sharp(materialCrop.data, { raw: materialCrop.info }).png().toBuffer(),
    left: maskBounds.left,
    top: maskBounds.top,
  }]).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const maskAlpha = await sharp(input.authorityMaskPng).ensureAlpha().extractChannel("alpha").raw().toBuffer();

  for (let pixel = 0; pixel < maskAlpha.length; pixel += 1) {
    materialCanvas.data[pixel * 4 + 3] = maskAlpha[pixel];
  }
  return sharp(materialCanvas.data, { raw: materialCanvas.info }).png().toBuffer();
}

export async function translateFullCanvasLayer(
  layerPng: Buffer,
  transform: { x: number; y: number },
): Promise<Buffer> {
  const { data, info } = await sharp(layerPng).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const output = Buffer.alloc(data.length);
  for (let sourceY = 0; sourceY < info.height; sourceY += 1) {
    const targetY = sourceY + transform.y;
    if (targetY < 0 || targetY >= info.height) continue;
    for (let sourceX = 0; sourceX < info.width; sourceX += 1) {
      const targetX = sourceX + transform.x;
      if (targetX < 0 || targetX >= info.width) continue;
      const sourceOffset = (sourceY * info.width + sourceX) * 4;
      const targetOffset = (targetY * info.width + targetX) * 4;
      data.copy(output, targetOffset, sourceOffset, sourceOffset + 4);
    }
  }
  return sharp(output, { raw: info }).png().toBuffer();
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function labelSvg(width: number, height: number, primary: string, secondary: string): Buffer {
  const escape = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  return Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#11110f"/>
    <text x="18" y="30" font-family="Arial,Helvetica,sans-serif" font-size="18" font-weight="700" fill="#e8c77d">${escape(primary)}</text>
    <text x="18" y="52" font-family="Arial,Helvetica,sans-serif" font-size="13" fill="#a5aaa5">${escape(secondary)}</text>
  </svg>`);
}

async function makeContactSheet(rows: Array<{
  variantKey: string;
  label: string;
  assemblies: Array<{ bodyKey: string; png: Buffer }>;
}>): Promise<Buffer> {
  const tileWidth = 300;
  const imageHeight = 330;
  const labelHeight = 66;
  const tiles: Buffer[] = [];
  for (const row of rows) {
    for (const assembly of row.assemblies) {
      const preview = await sharp(assembly.png)
        .resize({ width: tileWidth, height: imageHeight, fit: "contain", background: "#f5f3ef" })
        .png()
        .toBuffer();
      tiles.push(await sharp({
        create: { width: tileWidth, height: imageHeight + labelHeight, channels: 4, background: "#11110f" },
      }).composite([
        { input: preview, left: 0, top: 0 },
        { input: labelSvg(tileWidth, labelHeight, `${row.variantKey} · ${row.label}`, assembly.bodyKey), left: 0, top: imageHeight },
      ]).png().toBuffer());
    }
  }
  return sharp({
    create: { width: tileWidth * BODY_SOURCES.length, height: (imageHeight + labelHeight) * rows.length, channels: 4, background: "#11110f" },
  }).composite(tiles.map((input, index) => ({
    input,
    left: (index % BODY_SOURCES.length) * tileWidth,
    top: Math.floor(index / BODY_SOURCES.length) * (imageHeight + labelHeight),
  }))).png().toBuffer();
}

export async function buildCyl9SourceCapReview(input: {
  cappedRoot?: string;
  outputRoot?: string;
} = {}) {
  const outputRoot = resolve(input.outputRoot ?? DEFAULT_OUTPUT_ROOT);
  const rawDirectory = join(outputRoot, "raw-cap-layers");
  const layerDirectory = join(outputRoot, "layers");
  const assemblyDirectory = join(outputRoot, "assemblies");
  await Promise.all([rawDirectory, layerDirectory, assemblyDirectory].map((directory) => mkdir(directory, { recursive: true })));

  const authorityMaskPng = await readFile(resolve(AUTHORITY_MASK_PATH));
  const variants = planCyl9SourceCapVariants(input.cappedRoot);
  const rows: Array<{ variantKey: string; label: string; assemblies: Array<{ bodyKey: string; png: Buffer }> }> = [];
  const records = [];

  for (const variant of variants) {
    const rawPath = join(rawDirectory, `${variant.variantKey}.png`);
    let rawCap: Buffer;
    if (variant.sourceMode === "capped-psd-layer") {
      await execFile("magick", [`${variant.sourcePath}[${variant.layerIndex}]`, rawPath]);
      rawCap = await readFile(rawPath);
    } else {
      rawCap = await readFile(resolve(variant.sourcePath));
      await writeFile(rawPath, rawCap);
    }
    const layer = await normalizeCapMaterialToAuthority({ materialPng: rawCap, authorityMaskPng });
    const layerPath = join(layerDirectory, `${variant.variantKey}.png`);
    await writeFile(layerPath, layer);

    const [layerAlpha, maskAlpha] = await Promise.all([
      sharp(layer).ensureAlpha().extractChannel("alpha").raw().toBuffer(),
      sharp(authorityMaskPng).ensureAlpha().extractChannel("alpha").raw().toBuffer(),
    ]);
    if (!layerAlpha.equals(maskAlpha)) throw new Error(`${variant.variantKey} failed exact authority-alpha verification.`);
    const placedLayer = await translateFullCanvasLayer(layer, SHARED_PLACEMENT);

    const assemblies = [];
    for (const body of BODY_SOURCES) {
      const png = await sharp(resolve(body.path)).composite([{ input: placedLayer, left: 0, top: 0 }]).png().toBuffer();
      const assemblyPath = join(assemblyDirectory, `${variant.variantKey}__${body.key}.png`);
      await writeFile(assemblyPath, png);
      assemblies.push({ bodyKey: body.key, png });
    }
    rows.push({ variantKey: variant.variantKey, label: variant.label, assemblies });
    records.push({
      variantKey: variant.variantKey,
      label: variant.label,
      sourceMode: variant.sourceMode,
      sourcePath: variant.sourcePath,
      sourceLayerIndex: variant.layerIndex ?? null,
      sourceLayerSha256: sha256(rawCap),
      authorityMaskPath: AUTHORITY_MASK_PATH,
      authorityMaskSha256: sha256(authorityMaskPng),
      layerPath,
      layerSha256: sha256(layer),
      alphaAuthorityMatch: true,
      assemblyCount: assemblies.length,
      approvalState: "needs-review",
    });
  }

  const contactSheet = await makeContactSheet(rows);
  const contactSheetPath = join(outputRoot, "contact-sheet.png");
  await writeFile(contactSheetPath, contactSheet);
  const manifestPath = join(outputRoot, "manifest.json");
  await writeFile(manifestPath, `${JSON.stringify({
    schemaVersion: 1,
    familyKey: "CYL-9ML",
    sourceType: "capped-psd-layer",
    geometryFamilyId: "closure__17-415__rollon-overcap__v2",
    sharedPlacement: SHARED_PLACEMENT,
    canvas: { width: 2080, height: 2288 },
    bodyKeys: BODY_SOURCES.map(({ key }) => key),
    variantCount: records.length,
    assemblyCount: records.reduce((total, record) => total + record.assemblyCount, 0),
    releaseMutation: false,
    sanityMutation: false,
    records,
    contactSheetPath,
  }, null, 2)}\n`);

  return { outputRoot, contactSheetPath, manifestPath, records };
}

if (process.argv[1]?.endsWith(basename(import.meta.url))) {
  buildCyl9SourceCapReview().then((result) => {
    process.stdout.write(`Built ${result.records.length} source-backed cap candidates at ${result.contactSheetPath}\n`);
  });
}
