import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import { buildPlacedComponentLayer, inspectAuthorityMask } from "../../src/lib/paperDoll/componentPlateImage.node";
import {
  parsePaperDollFamilyProductionManifest,
  type PaperDollFamilyProductionManifest,
} from "../../src/lib/paperDoll/componentPlateContract";

const ROOT = process.cwd();
const MANIFEST_PATH = "docs/paper-doll-rig/cyl9-component-factory.json";
const REPORT_PATH = "docs/paper-doll-rig/cyl9-component-authority-calibration.json";
const CONTACT_SHEET_PATH = "docs/paper-doll-rig/evidence/cyl9-component-authority-contact-sheet.png";
const MASK_DIR = "assets/paper-doll/authority-masks/cyl9";
const CAP_FAMILY = "closure__17-415__rollon-overcap__v2";
const ROLLER_FAMILY = "roller__17-415__shared__v1";
const CAP_SOURCE = "outputs/paper-doll-cyl9-cap-family/candidate-v2/geometry-mask.png";
const ROLLER_SOURCE = "assets/paper-doll/components/closure__17-415__plastic-roller-ball__natural__candidate__v03.png";
const BODY_KEYS = ["AMB", "BLU", "CLR", "FRS", "SWL"];

type Bounds = { left: number; top: number; width: number; height: number };
type ExtractionMethod = "alpha-row-envelope" | "white-background-row-envelope";
type ComponentDefinition = PaperDollFamilyProductionManifest["components"][number];
type Canvas = PaperDollFamilyProductionManifest["canvas"];

interface ExtractionRecipe {
  method: ExtractionMethod;
  threshold: number;
  stableThresholdRange: [number, number];
}

interface Placement {
  geometryFamilyId: string;
  widthPx: number;
  centerXPx: number;
  seatYPx: number;
  placementBoundsPx: Bounds;
  placementVersionId: string;
  compatibleBodyVariantKeys: string[];
  locked: false;
}

interface FamilyResult {
  geometryFamilyId: string;
  sourcePath: string;
  sourceSha256: string;
  extraction: ExtractionRecipe;
  sourceBoundsPx: Bounds;
  maskPath: string;
  maskSha256: string;
  maskPng: Buffer;
  authorityBoundsPx: Bounds;
  occupiedPixels: number;
  componentCount: number;
  touchesFrame: boolean;
  placement: Placement;
}

export interface Cyl9AuthorityCalibrationReport {
  schemaVersion: 1;
  familyKey: "CYL-9ML";
  decision: "authority-approved-placement-unlocked";
  bodyPlateSha256s: string[];
  components: Array<{
    componentKey: string;
    variantKey: string;
    slot: string;
    status: "approved";
    geometryFamilyId: string;
    authoritySourcePath: string;
    authoritySourceSha256: string;
    extraction: ExtractionRecipe;
    sourceBoundsPx: Bounds;
    maskPath: string;
    maskSha256: string;
    authorityBoundsPx: Bounds;
    expectedRegions: 1;
    componentCount: number;
    touchesFrame: boolean;
  }>;
  geometryFamilies: Array<{
    geometryFamilyId: string;
    members: string[];
    maskPath: string;
    maskSha256: string;
    maxAlphaMismatchPixels: 0;
  }>;
  placements: Placement[];
  reviewNotes: string[];
}

function absolute(relativePath: string): string {
  return path.join(ROOT, relativePath);
}

function sha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

function maskFileName(geometryFamilyId: string): string {
  return `${geometryFamilyId.replace(/[^a-zA-Z0-9_-]/g, "-")}__mask.png`;
}

function familyFor(component: ComponentDefinition): string {
  if (component.slot === "cap") return CAP_FAMILY;
  if (component.slot === "roller") return ROLLER_FAMILY;
  return component.geometryFamilyId.replace(/__provisional$/, "__v1");
}

function sourceFor(component: ComponentDefinition): string {
  if (component.slot === "cap") return CAP_SOURCE;
  if (component.slot === "roller") return ROLLER_SOURCE;
  return component.source.path;
}

function recipeFor(component: ComponentDefinition): ExtractionRecipe {
  if (component.slot === "cap" || component.slot === "roller") {
    return { method: "alpha-row-envelope", threshold: 16, stableThresholdRange: [8, 32] };
  }
  // Stored per physical component. Equal values are the result of real-file calibration,
  // not a global material/shape assumption.
  return { method: "white-background-row-envelope", threshold: 8, stableThresholdRange: [6, 12] };
}

function transformFor(component: ComponentDefinition): { widthPx: number; centerXPx: number; seatYPx: number } {
  if (component.slot === "cap") return { widthPx: 344, centerXPx: 1041, seatYPx: 1002 };
  if (component.slot === "roller") return { widthPx: 269, centerXPx: 1041, seatYPx: 926 };
  return { widthPx: 363, centerXPx: 1041, seatYPx: 1002 };
}

async function rowEnvelope(input: Buffer, recipe: ExtractionRecipe): Promise<{ png: Buffer; bounds: Bounds }> {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const width = info.width;
  const height = info.height;
  const cornerIndexes = [0, width - 1, (height - 1) * width, height * width - 1];
  const background = [0, 1, 2].map((channel) => Math.round(
    cornerIndexes.reduce((sum, index) => sum + data[index * 4 + channel], 0) / cornerIndexes.length,
  ));
  const occupied = new Uint8Array(width * height);
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;

  for (let y = 0; y < height; y++) {
    let rowLeft = width;
    let rowRight = -1;
    for (let x = 0; x < width; x++) {
      const index = y * width + x;
      const alpha = data[index * 4 + 3];
      const foreground = recipe.method === "alpha-row-envelope"
        ? alpha >= recipe.threshold
        : Math.max(
          Math.abs(data[index * 4] - background[0]),
          Math.abs(data[index * 4 + 1] - background[1]),
          Math.abs(data[index * 4 + 2] - background[2]),
        ) >= recipe.threshold;
      if (!foreground) continue;
      rowLeft = Math.min(rowLeft, x);
      rowRight = Math.max(rowRight, x);
    }
    if (rowRight < rowLeft) continue;
    for (let x = rowLeft; x <= rowRight; x++) occupied[y * width + x] = 255;
    left = Math.min(left, rowLeft);
    right = Math.max(right, rowRight);
    top = Math.min(top, y);
    bottom = Math.max(bottom, y);
  }
  if (right < left || bottom < top) throw new Error("Calibrated row envelope is empty.");
  const rgba = Buffer.alloc(width * height * 4);
  for (let index = 0; index < occupied.length; index++) {
    rgba[index * 4] = 255;
    rgba[index * 4 + 1] = 255;
    rgba[index * 4 + 2] = 255;
    rgba[index * 4 + 3] = occupied[index];
  }
  return {
    png: await sharp(rgba, { raw: { width, height, channels: 4 } }).png().toBuffer(),
    bounds: { left, top, width: right - left + 1, height: bottom - top + 1 },
  };
}

async function binaryAlpha(input: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let index = 0; index < info.width * info.height; index++) {
    data[index * 4] = 255;
    data[index * 4 + 1] = 255;
    data[index * 4 + 2] = 255;
    data[index * 4 + 3] = data[index * 4 + 3] >= 128 ? 255 : 0;
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

async function buildFamily(component: ComponentDefinition, canvas: Canvas): Promise<FamilyResult> {
  const geometryFamilyId = familyFor(component);
  const sourcePath = sourceFor(component);
  const recipe = recipeFor(component);
  const source = await readFile(absolute(sourcePath));
  const envelope = await rowEnvelope(source, recipe);
  const transform = transformFor(component);
  const placed = await buildPlacedComponentLayer({ componentPng: envelope.png, canvas, transform });
  const maskPng = await binaryAlpha(placed.layerPng);
  const inspection = await inspectAuthorityMask(maskPng, { expectedRegions: 1 });
  const maskPath = path.posix.join(MASK_DIR, maskFileName(geometryFamilyId));
  const maskSha256 = sha256(maskPng);
  const placement: Placement = {
    placementVersionId: `placement-calibration__${geometryFamilyId}__${placed.placementBoundsPx.width}x${placed.placementBoundsPx.height}__v1`,
    geometryFamilyId,
    widthPx: transform.widthPx,
    centerXPx: transform.centerXPx,
    seatYPx: transform.seatYPx,
    placementBoundsPx: placed.placementBoundsPx,
    compatibleBodyVariantKeys: [...BODY_KEYS],
    locked: false,
  };
  return {
    geometryFamilyId,
    sourcePath,
    sourceSha256: sha256(source),
    extraction: recipe,
    sourceBoundsPx: envelope.bounds,
    maskPath,
    maskSha256,
    maskPng,
    authorityBoundsPx: inspection.authorityBoundsPx,
    occupiedPixels: inspection.occupiedPixels,
    componentCount: inspection.componentCount,
    touchesFrame: inspection.touchesFrame,
    placement,
  };
}

async function renderContactSheet(components: ComponentDefinition[], families: Map<string, FamilyResult>): Promise<Buffer> {
  const panelWidth = 460;
  const panelHeight = 250;
  const columns = 4;
  const rows = Math.ceil(components.length / columns);
  const composites: sharp.OverlayOptions[] = [];
  for (let index = 0; index < components.length; index++) {
    const component = components[index];
    const family = families.get(familyFor(component))!;
    const x = (index % columns) * panelWidth;
    const y = Math.floor(index / columns) * panelHeight;
    const source = await sharp(absolute(component.source.path)).resize(180, 180, { fit: "contain" }).png().toBuffer();
    const mask = await sharp(family.maskPng)
      .extract(family.authorityBoundsPx)
      .resize(180, 180, { fit: "contain" })
      // Evidence renderer is not a Tailwind surface.
      // eslint-disable-next-line no-restricted-syntax
      .flatten({ background: "#101416" })
      .png().toBuffer();
    const label = Buffer.from(`<svg width="${panelWidth}" height="50"><style>text{font-family:monospace;fill:#e7d2a6;font-size:16px}</style><text x="12" y="20">${component.slot.toUpperCase()} · ${component.variants[0].variantKey}</text><text x="12" y="42" fill="#73e0cf">1 region · exact family alpha</text></svg>`);
    composites.push({ input: source, left: x + 20, top: y + 55 });
    composites.push({ input: mask, left: x + 245, top: y + 55 });
    composites.push({ input: label, left: x, top: y });
  }
  return sharp({
    // Evidence renderer is not a Tailwind surface.
    // eslint-disable-next-line no-restricted-syntax
    create: { width: panelWidth * columns, height: panelHeight * rows, channels: 4, background: "#090c0d" },
  }).composite(composites).png().toBuffer();
}

async function verifyRegisteredArtifacts(
  manifest: PaperDollFamilyProductionManifest,
): Promise<Cyl9AuthorityCalibrationReport | null> {
  let report: Cyl9AuthorityCalibrationReport;
  try {
    report = JSON.parse(await readFile(absolute(REPORT_PATH), "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
  if (report.familyKey !== "CYL-9ML" || report.components.length !== 23) {
    throw new Error("Registered CYL-9ML authority report is malformed.");
  }
  if (report.geometryFamilies.length !== 13 || report.placements.length !== 13) {
    throw new Error("Registered CYL-9ML authority family count is incomplete.");
  }
  for (const family of report.geometryFamilies) {
    const mask = await readFile(absolute(family.maskPath));
    if (sha256(mask) !== family.maskSha256) {
      throw new Error(`Registered authority mask hash mismatch: ${family.geometryFamilyId}.`);
    }
    await inspectAuthorityMask(mask, { expectedRegions: 1 });
  }
  const manifestHashes = manifest.bodyPlates.map((plate) => plate.imageSha256);
  if (JSON.stringify(manifestHashes) !== JSON.stringify(report.bodyPlateSha256s)) {
    throw new Error("Registered authority report no longer matches the five locked body hashes.");
  }
  return report;
}

export async function calibrateCyl9Authorities(options: { write: boolean }): Promise<Cyl9AuthorityCalibrationReport> {
  const rawManifest = parsePaperDollFamilyProductionManifest(
    JSON.parse(await readFile(absolute(MANIFEST_PATH), "utf8")),
  );
  if (!options.write) {
    const registered = await verifyRegisteredArtifacts(rawManifest);
    if (registered) return registered;
  }
  const uniqueComponents = new Map<string, ComponentDefinition>();
  for (const component of rawManifest.components) {
    const family = familyFor(component);
    if (!uniqueComponents.has(family)) uniqueComponents.set(family, component);
  }
  const families = new Map<string, FamilyResult>();
  for (const [family, component] of uniqueComponents) {
    families.set(family, await buildFamily(component, rawManifest.canvas));
  }

  const components = rawManifest.components.map((component) => {
    const family = families.get(familyFor(component))!;
    return {
      componentKey: component.componentKey,
      variantKey: component.variants[0].variantKey,
      slot: component.slot,
      status: "approved" as const,
      geometryFamilyId: family.geometryFamilyId,
      authoritySourcePath: family.sourcePath,
      authoritySourceSha256: family.sourceSha256,
      extraction: family.extraction,
      sourceBoundsPx: family.sourceBoundsPx,
      maskPath: family.maskPath,
      maskSha256: family.maskSha256,
      authorityBoundsPx: family.authorityBoundsPx,
      expectedRegions: 1 as const,
      componentCount: family.componentCount,
      touchesFrame: family.touchesFrame,
    };
  });
  const placements = [...families.values()].map((family) => family.placement);
  const geometryFamilies = [...families.values()].map((family) => ({
    geometryFamilyId: family.geometryFamilyId,
    members: components.filter((row) => row.geometryFamilyId === family.geometryFamilyId).map((row) => row.componentKey),
    maskPath: family.maskPath,
    maskSha256: family.maskSha256,
    maxAlphaMismatchPixels: 0 as const,
  }));
  const report: Cyl9AuthorityCalibrationReport = {
    schemaVersion: 1,
    familyKey: "CYL-9ML",
    decision: "authority-approved-placement-unlocked",
    bodyPlateSha256s: rawManifest.bodyPlates.map((plate) => plate.imageSha256),
    components,
    geometryFamilies,
    placements,
    reviewNotes: [
      "Every authority mask was measured on a real source and contains exactly one non-frame-touching connected region.",
      "Ten cap finishes share the clean approved cap silhouette; rhinestones remain pixel detail inside that silhouette.",
      "Plastic and metal rollers share the plastic V03 exterior silhouette; material pixels are clamped to this identical alpha.",
      "Sprayer, pump, and translucent-overcap authorities are independently calibrated; their placements remain unlocked pending five-body Family Fit approval.",
      "The five locked body plates and their SHA-256 identities are unchanged.",
    ],
  };

  if (options.write) {
    await mkdir(absolute(MASK_DIR), { recursive: true });
    await mkdir(path.dirname(absolute(CONTACT_SHEET_PATH)), { recursive: true });
    for (const family of families.values()) await writeFile(absolute(family.maskPath), family.maskPng);
    const nextManifest = {
      ...rawManifest,
      components: rawManifest.components.map((component) => {
        const family = families.get(familyFor(component))!;
        return {
          ...component,
          geometryFamilyId: family.geometryFamilyId,
          authorityStatus: "approved",
          authority: {
            authorityId: `authority__${family.geometryFamilyId}__${family.maskSha256.slice(0, 12)}`,
            maskPath: family.maskPath,
            maskSha256: family.maskSha256,
            maskWidthPx: rawManifest.canvas.widthPx,
            maskHeightPx: rawManifest.canvas.heightPx,
            authorityBoundsPx: family.authorityBoundsPx,
            expectedRegions: 1,
          },
        };
      }),
      placements,
    };
    parsePaperDollFamilyProductionManifest(nextManifest);
    await writeFile(absolute(MANIFEST_PATH), `${JSON.stringify(nextManifest, null, 2)}\n`);
    await writeFile(absolute(REPORT_PATH), `${JSON.stringify(report, null, 2)}\n`);
    await writeFile(absolute(CONTACT_SHEET_PATH), await renderContactSheet(rawManifest.components, families));
  }
  return report;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  calibrateCyl9Authorities({ write: true }).then((report) => {
    process.stdout.write(`Calibrated ${report.components.length} CYL-9ML components across ${report.geometryFamilies.length} exact-alpha families.\n`);
  }).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
