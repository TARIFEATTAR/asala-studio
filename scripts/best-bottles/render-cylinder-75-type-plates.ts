import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import {
  BEST_BOTTLES_CATALOG_SCALE_VERSION,
  deriveBestBottlesBodyTargetPx,
  resolveBestBottlesGlobalScalePct,
} from "../../src/config/bestBottlesCatalogScale";

const PLATE_IDS = ["01", "02", "03", "04", "05", "06", "07", "08"] as const;
const DEFAULT_CANVAS_WIDTH_PX = 3840;
const DEFAULT_CANVAS_HEIGHT_PX = 2160;
const DEFAULT_MINIMUM_SLOT_WIDTH_PX = 360;
const ANNOTATION_HEIGHT_PX = 220;
const BACKGROUND_HEX = "#F5F3EF";

type PlateId = (typeof PLATE_IDS)[number];
type UnknownRecord = Record<string, any>;

export interface Cylinder75TypePlateSlot {
  physicalTypeKey: string;
  plateId: PlateId;
  websiteSku: string;
  graceSku: string;
  capacityMl: number;
  material: string;
  status: "ready" | "blocked";
  reasons: string[];
  referenceStatus: string;
  sourceChecksum: string | null;
  layerPath: string | null;
  primaryBounds: { left: number; top: number; width: number; height: number } | null;
  fullForegroundBounds: { left: number; top: number; width: number; height: number } | null;
  sidecarCount: number;
  resolvedAssembledTargetPct: number | null;
  resolvedAssembledTargetPx: number | null;
  resolvedBodyTargetPx: number | null;
  primaryScale: number | null;
  slotIndex: number;
  slotWidthPx: number;
  slotCenterX: number;
  baselineY: number;
  primaryPlacement: {
    left: number;
    top: number;
    width: number;
    height: number;
  } | null;
}

export interface Cylinder75TypePlatePlan {
  plateId: PlateId;
  canvasWidthPx: number;
  canvasHeightPx: number;
  annotatedHeightPx: number;
  baselineY: number;
  slotWidthPx: number;
  slots: Cylinder75TypePlateSlot[];
  cleanOrder: string[];
  annotatedOrder: string[];
}

export interface Cylinder75TypePlateRenderPlan {
  version: "best-bottles-cylinder-75-type-plate-render-plan-v1";
  backgroundHex: typeof BACKGROUND_HEX;
  canvasWidthPx: number;
  canvasHeightPx: number;
  annotatedHeightPx: number;
  baselineY: number;
  scaleContractVersion: typeof BEST_BOTTLES_CATALOG_SCALE_VERSION;
  sourceCurveVersion: string;
  summary: {
    physicalTypeCount: number;
    readyCount: number;
    blockedCount: number;
    plateCount: number;
  };
  plates: Cylinder75TypePlatePlan[];
}

export interface RenderedCylinder75TypePlate {
  plateId: PlateId;
  cleanPath: string;
  annotatedPath: string;
  slotCount: number;
  readyCount: number;
  blockedCount: number;
}

export interface Cylinder75TypePlateRenderResult {
  renderedPlateCount: number;
  plates: RenderedCylinder75TypePlate[];
  manifestPath: string;
  renderBlockers: Array<{
    plateId: PlateId;
    physicalTypeKey: string;
    websiteSku: string;
    reasons: string[];
  }>;
}

function asPositiveNumber(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function positiveBounds(value: unknown): { left: number; top: number; width: number; height: number } | null {
  if (!value || typeof value !== "object") return null;
  const bounds = value as UnknownRecord;
  const left = Number(bounds.left);
  const top = Number(bounds.top);
  const width = Number(bounds.width);
  const height = Number(bounds.height);
  return [left, top, width, height].every((number) => Number.isFinite(number) && number >= 0)
    && width > 0 && height > 0
    ? { left, top, width, height }
    : null;
}

function relativePathFromCwd(value: string): string {
  return path.isAbsolute(value) ? path.relative(process.cwd(), value) : value;
}

function resolvedLayerPath(value: string): string {
  return path.isAbsolute(value) ? value : path.resolve(process.cwd(), value);
}

function blockerReasons(row: UnknownRecord, blockerByKey: Map<string, string[]>): string[] {
  const reasons = Array.isArray(row.reasons) ? row.reasons.map(text).filter(Boolean) : [];
  return reasons.length > 0 ? reasons : blockerByKey.get(text(row.physicalTypeKey)) ?? ["evidence_blocked"];
}

function rowScale(row: UnknownRecord, canvasHeightPx: number): {
  assembledTargetPct: number;
  assembledTargetPx: number;
  bodyTargetPx: number;
} | null {
  const capacityMl = asPositiveNumber(row.capacityMl);
  const heightWithCapMm = asPositiveNumber(row.measurements?.heightWithCapMm);
  const heightWithoutCapMm = asPositiveNumber(row.measurements?.heightWithoutCapMm);
  if (capacityMl == null || heightWithCapMm == null || heightWithoutCapMm == null) return null;
  const assembledTargetPct = resolveBestBottlesGlobalScalePct(capacityMl);
  const assembledTargetPx = canvasHeightPx * (assembledTargetPct / 100);
  const bodyTargetPx = deriveBestBottlesBodyTargetPx({
    canvasHeightPx,
    assembledHeightPct: assembledTargetPct,
    verifiedBodyHeightMm: heightWithoutCapMm,
    verifiedAssembledHeightMm: heightWithCapMm,
  });
  return { assembledTargetPct, assembledTargetPx, bodyTargetPx };
}

function makeSlot(
  row: UnknownRecord,
  layer: UnknownRecord | undefined,
  blockerByKey: Map<string, string[]>,
  plateId: PlateId,
  slotIndex: number,
  slotCount: number,
  canvasWidthPx: number,
  baselineY: number,
  minimumSlotWidthPx: number,
  canvasHeightPx: number,
  eligibleKeys: Set<string>,
): Cylinder75TypePlateSlot {
  const physicalTypeKey = text(row.physicalTypeKey);
  const primaryBounds = positiveBounds(layer?.primaryBounds);
  const fullForegroundBounds = positiveBounds(layer?.fullForegroundBounds);
  const isEligible = eligibleKeys.has(physicalTypeKey);
  const hasPreparedLayer = layer?.status === "prepared" && primaryBounds != null && text(layer.reviewLayerPath).length > 0;
  const ready = isEligible && hasPreparedLayer;
  const scale = ready ? rowScale(row, canvasHeightPx) : null;
  const slotWidthPx = Math.max(minimumSlotWidthPx, canvasWidthPx / slotCount);
  const slotCenterX = slotIndex * slotWidthPx + slotWidthPx / 2;
  const primaryScale = ready && primaryBounds && scale
    ? Number((scale.assembledTargetPx / primaryBounds.height).toFixed(8))
    : null;
  const primaryPlacement = ready && primaryBounds && primaryScale
    ? {
      left: Number((slotCenterX - (primaryBounds.width * primaryScale) / 2).toFixed(3)),
      top: Number((baselineY - primaryBounds.height * primaryScale).toFixed(3)),
      width: Number((primaryBounds.width * primaryScale).toFixed(3)),
      height: Number((primaryBounds.height * primaryScale).toFixed(3)),
    }
    : null;
  const reasons = ready
    ? []
    : [
      ...blockerReasons(row, blockerByKey),
      ...(isEligible && !hasPreparedLayer ? ["prepared_layer_missing"] : []),
    ].filter((reason, index, all) => all.indexOf(reason) === index);

  return {
    physicalTypeKey,
    plateId,
    websiteSku: text(row.websiteSku),
    graceSku: text(row.graceSku),
    capacityMl: Number(row.capacityMl) || 0,
    material: text(row.material) || "unknown",
    status: ready ? "ready" : "blocked",
    reasons,
    referenceStatus: text(row.referenceStatus) || "missing",
    sourceChecksum: text(row.primarySourceChecksum) || null,
    layerPath: ready ? relativePathFromCwd(text(layer.reviewLayerPath)) : null,
    primaryBounds,
    fullForegroundBounds,
    sidecarCount: Array.isArray(layer?.sidecars) ? layer.sidecars.length : 0,
    resolvedAssembledTargetPct: scale?.assembledTargetPct ?? null,
    resolvedAssembledTargetPx: scale?.assembledTargetPx ?? null,
    resolvedBodyTargetPx: scale?.bodyTargetPx ?? null,
    primaryScale,
    slotIndex,
    slotWidthPx,
    slotCenterX,
    baselineY,
    primaryPlacement,
  };
}

export function buildCylinder75TypePlateRenderPlan(input: {
  manifest: UnknownRecord;
  layerManifest: UnknownRecord;
  canvasWidthPx?: number;
  canvasHeightPx?: number;
  minimumSlotWidthPx?: number;
  /** Fixture/test alias retained for callers that size the whole canvas by a minimum width. */
  minimumCanvasWidthPx?: number;
}): Cylinder75TypePlateRenderPlan {
  const canvasWidthPx = input.canvasWidthPx ?? input.minimumCanvasWidthPx ?? DEFAULT_CANVAS_WIDTH_PX;
  const canvasHeightPx = input.canvasHeightPx ?? DEFAULT_CANVAS_HEIGHT_PX;
  const minimumSlotWidthPx = input.minimumSlotWidthPx ?? DEFAULT_MINIMUM_SLOT_WIDTH_PX;
  if (![canvasWidthPx, canvasHeightPx, minimumSlotWidthPx].every((value) => Number.isFinite(value) && value > 0)) {
    throw new Error("Plate canvas and slot dimensions must be positive finite numbers.");
  }

  const rows = Array.isArray(input.manifest.coverageRows) ? input.manifest.coverageRows as UnknownRecord[] : [];
  const eligibleRows = Array.isArray(input.manifest.eligibleRows) ? input.manifest.eligibleRows as UnknownRecord[] : [];
  const layers = Array.isArray(input.layerManifest.layers) ? input.layerManifest.layers as UnknownRecord[] : [];
  const eligibleKeys = new Set(eligibleRows.map((row) => text(row.physicalTypeKey)).filter(Boolean));
  const layerByKey = new Map(layers.map((layer) => [text(layer.physicalTypeKey), layer]));
  const blockerByKey = new Map<string, string[]>();
  for (const blocker of Array.isArray(input.manifest.blockers) ? input.manifest.blockers as UnknownRecord[] : []) {
    const key = text(blocker.physicalTypeKey);
    if (key) blockerByKey.set(key, Array.isArray(blocker.reasons) ? blocker.reasons.map(text).filter(Boolean) : []);
  }

  const duplicateKeys = rows.map((row) => text(row.physicalTypeKey)).filter((key, index, all) => all.indexOf(key) !== index);
  if (duplicateKeys.length > 0) throw new Error(`Cylinder lineup physical keys must be unique: ${duplicateKeys.join(", ")}`);
  const baselineY = Math.round(canvasHeightPx * 0.9);
  const plates = PLATE_IDS.map((plateId) => {
    const plateRows = rows.filter((row) => text(row.plateId) === plateId);
    const slotCount = plateRows.length;
    const slots = plateRows.map((row, slotIndex) => makeSlot(
      row,
      layerByKey.get(text(row.physicalTypeKey)),
      blockerByKey,
      plateId,
      slotIndex,
      Math.max(1, slotCount),
      canvasWidthPx,
      baselineY,
      minimumSlotWidthPx,
      canvasHeightPx,
      eligibleKeys,
    ));
    const order = slots.map((slot) => slot.physicalTypeKey);
    return {
      plateId,
      canvasWidthPx,
      canvasHeightPx,
      annotatedHeightPx: canvasHeightPx + ANNOTATION_HEIGHT_PX,
      baselineY,
      slotWidthPx: slots[0]?.slotWidthPx ?? Math.max(minimumSlotWidthPx, canvasWidthPx),
      slots,
      cleanOrder: order,
      annotatedOrder: [...order],
    };
  });

  const allSlots = plates.flatMap((plate) => plate.slots);
  return {
    version: "best-bottles-cylinder-75-type-plate-render-plan-v1",
    backgroundHex: BACKGROUND_HEX,
    canvasWidthPx,
    canvasHeightPx,
    annotatedHeightPx: canvasHeightPx + ANNOTATION_HEIGHT_PX,
    baselineY,
    scaleContractVersion: BEST_BOTTLES_CATALOG_SCALE_VERSION,
    sourceCurveVersion: text(input.manifest.curveVersion) || "unknown",
    summary: {
      physicalTypeCount: allSlots.length,
      readyCount: allSlots.filter((slot) => slot.status === "ready").length,
      blockedCount: allSlots.filter((slot) => slot.status === "blocked").length,
      plateCount: plates.filter((plate) => plate.slots.length > 0).length,
    },
    plates,
  };
}

interface RawLayerOptions {
  path: string;
  bounds: { left: number; top: number; width: number; height: number };
}

/**
 * Catalog references are opaque white-background PNGs. Convert only the white
 * background to transparency for the visual-test plate; the source bytes and
 * manifest checksum remain untouched. A soft key preserves gray glass edges.
 */
async function prepareLayerBuffer(options: RawLayerOptions): Promise<Buffer> {
  const { data, info } = await sharp(options.path)
    .extract({
      left: Math.floor(options.bounds.left),
      top: Math.floor(options.bounds.top),
      width: Math.floor(options.bounds.width),
      height: Math.floor(options.bounds.height),
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (let offset = 0; offset < data.length; offset += info.channels) {
    const whiteness = Math.min(data[offset], data[offset + 1], data[offset + 2]);
    const alpha = Math.max(0, Math.min(255, Math.round((255 - whiteness - 8) * 4.5)));
    data[offset + 3] = Math.min(data[offset + 3], alpha);
  }
  return sharp(data, { raw: info }).png().toBuffer();
}

function annotationSvg(
  plate: Cylinder75TypePlatePlan,
  renderBlockerByKey: Map<string, string[]>,
): Buffer {
  const width = plate.canvasWidthPx;
  const height = ANNOTATION_HEIGHT_PX;
  const slotLines = plate.slots.map((slot) => {
    const x = slot.slotIndex * slot.slotWidthPx;
    const renderBlockerReasons = renderBlockerByKey.get(slot.physicalTypeKey) ?? [];
    const renderBlocked = renderBlockerReasons.length > 0;
    const effectiveReady = slot.status === "ready" && !renderBlocked;
    const statusColor = effectiveReady ? "#82776d" : "#b85e4b";
    const title = effectiveReady
      ? `${slot.websiteSku} · ${slot.capacityMl} ml`
      : `${renderBlocked ? "RENDER BLOCKED" : "BLOCKED"} · ${slot.websiteSku}`;
    const detail = effectiveReady
      ? `target ${slot.resolvedAssembledTargetPct?.toFixed(1)}% · body ${slot.resolvedBodyTargetPx?.toFixed(0)} px · ${slot.referenceStatus}`
      : (renderBlocked ? renderBlockerReasons : slot.reasons).join(", ");
    return `
      <line x1="${x.toFixed(2)}" y1="0" x2="${x.toFixed(2)}" y2="${height}" stroke="#d8cec6" stroke-width="2" />
      <rect x="${(x + 10).toFixed(2)}" y="16" width="${Math.max(0, plate.slotWidthPx - 20).toFixed(2)}" height="${height - 30}" fill="none" stroke="${statusColor}" stroke-width="2" stroke-dasharray="8 8" opacity="${effectiveReady ? "0.28" : "0.72"}" />
      <text x="${(x + plate.slotWidthPx / 2).toFixed(2)}" y="54" text-anchor="middle" class="title">${escapeXml(title)}</text>
      <text x="${(x + plate.slotWidthPx / 2).toFixed(2)}" y="84" text-anchor="middle" class="meta">${escapeXml(slot.graceSku)}</text>
      <text x="${(x + plate.slotWidthPx / 2).toFixed(2)}" y="116" text-anchor="middle" class="meta">${escapeXml(detail)}</text>
      <text x="${(x + plate.slotWidthPx / 2).toFixed(2)}" y="148" text-anchor="middle" class="meta">${escapeXml(slot.material)} · sidecars ${slot.sidecarCount}</text>`;
  }).join("");
  return Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <style>
      .title { font: 600 24px -apple-system, BlinkMacSystemFont, sans-serif; fill: #302b27; }
      .meta { font: 16px -apple-system, BlinkMacSystemFont, sans-serif; fill: #665e57; }
    </style>${slotLines}
  </svg>`);
}

async function renderPlate(
  plate: Cylinder75TypePlatePlan,
  outputDirectory: string,
  renderBlockers: Cylinder75TypePlateRenderResult["renderBlockers"],
): Promise<RenderedCylinder75TypePlate> {
  const composites: sharp.OverlayOptions[] = [];
  for (const slot of plate.slots) {
    if (slot.status !== "ready" || !slot.layerPath || !slot.primaryBounds || !slot.primaryScale || !slot.primaryPlacement) continue;
    try {
      const cropBounds = slot.fullForegroundBounds ?? slot.primaryBounds;
      const expectedWidth = Math.max(1, Math.round(cropBounds.width * slot.primaryScale));
      const expectedHeight = Math.max(1, Math.round(cropBounds.height * slot.primaryScale));
      if (expectedWidth * expectedHeight > 100_000_000) {
        renderBlockers.push({
          plateId: plate.plateId,
          physicalTypeKey: slot.physicalTypeKey,
          websiteSku: slot.websiteSku,
          reasons: ["primary_bounds_geometry_exceeds_render_limit"],
        });
        continue;
      }
      const layer = await prepareLayerBuffer({
        path: resolvedLayerPath(slot.layerPath),
        bounds: cropBounds,
      });
      const layerMeta = await sharp(layer).metadata();
      const relativePrimaryLeft = slot.primaryBounds.left - cropBounds.left;
      const relativePrimaryTop = slot.primaryBounds.top - cropBounds.top;
      const resized = await sharp(layer)
        .resize({ width: expectedWidth, height: expectedHeight, fit: "fill" })
        .png()
        .toBuffer();
      const resizedMeta = await sharp(resized).metadata();
      const resizedWidth = resizedMeta.width ?? layerMeta.width ?? 0;
      const resizedHeight = resizedMeta.height ?? layerMeta.height ?? 0;
      let left = Math.round(slot.primaryPlacement.left - relativePrimaryLeft * slot.primaryScale);
      let top = Math.round(slot.primaryPlacement.top - relativePrimaryTop * slot.primaryScale);
      const cropLeft = Math.max(0, -left);
      const cropTop = Math.max(0, -top);
      const cropRight = Math.min(resizedWidth, plate.canvasWidthPx - left);
      const cropBottom = Math.min(resizedHeight, plate.canvasHeightPx - top);
      if (cropRight <= cropLeft || cropBottom <= cropTop) continue;
      let compositedLayer = resized;
      if (cropLeft > 0 || cropTop > 0 || cropRight < resizedWidth || cropBottom < resizedHeight) {
        compositedLayer = await sharp(resized)
          .extract({
            left: cropLeft,
            top: cropTop,
            width: cropRight - cropLeft,
            height: cropBottom - cropTop,
          })
          .png()
          .toBuffer();
        left += cropLeft;
        top += cropTop;
      }
      composites.push({ input: compositedLayer, left, top });
    } catch (error) {
      renderBlockers.push({
        plateId: plate.plateId,
        physicalTypeKey: slot.physicalTypeKey,
        websiteSku: slot.websiteSku,
        reasons: [`layer_render_failed:${error instanceof Error ? error.message : String(error)}`],
      });
    }
  }

  const cleanPath = path.join(outputDirectory, `${plate.plateId}-clean.png`);
  const annotatedPath = path.join(outputDirectory, `${plate.plateId}-annotated.png`);
  const createBase = () => sharp({
    create: {
      width: Math.ceil(plate.canvasWidthPx),
      height: Math.ceil(plate.canvasHeightPx),
      channels: 4,
      background: BACKGROUND_HEX,
    },
  }).composite(composites);
  try {
    await createBase().png().toFile(cleanPath);
    await sharp({
      create: {
        width: Math.ceil(plate.canvasWidthPx),
        height: Math.ceil(plate.annotatedHeightPx),
        channels: 4,
        background: BACKGROUND_HEX,
      },
    })
      .composite([
        ...composites,
        {
          input: annotationSvg(
            plate,
            new Map(renderBlockers.filter((blocker) => blocker.plateId === plate.plateId)
              .map((blocker) => [blocker.physicalTypeKey, blocker.reasons])),
          ),
          left: 0,
          top: plate.canvasHeightPx,
        },
      ])
      .png()
      .toFile(annotatedPath);
  } catch (error) {
    throw new Error(`${plate.plateId}: plate composite failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  return {
    plateId: plate.plateId,
    cleanPath,
    annotatedPath,
    slotCount: plate.slots.length,
    readyCount: plate.slots.filter((slot) => slot.status === "ready").length,
    blockedCount: plate.slots.filter((slot) => slot.status === "blocked").length,
  };
}

export async function renderCylinder75TypePlates(input: {
  plan: Cylinder75TypePlateRenderPlan;
  outputRoot: string;
}): Promise<Cylinder75TypePlateRenderResult> {
  const outputDirectory = path.join(input.outputRoot, "source-plates");
  await mkdir(outputDirectory, { recursive: true });
  const plates: RenderedCylinder75TypePlate[] = [];
  const renderBlockers: Cylinder75TypePlateRenderResult["renderBlockers"] = [];
  for (const plate of input.plan.plates) {
    if (plate.slots.length === 0) continue;
    plates.push(await renderPlate(plate, outputDirectory, renderBlockers));
  }
  const manifestPath = path.join(outputDirectory, "plate-render-manifest.json");
  await writeFile(manifestPath, `${JSON.stringify({
    ...input.plan,
    outputDirectory,
    plates: input.plan.plates.map((plate) => ({
      ...plate,
      cleanOrder: plate.cleanOrder,
      annotatedOrder: plate.annotatedOrder,
      rendered: plate.slots.length > 0,
      cleanPath: plate.slots.length > 0 ? path.join(outputDirectory, `${plate.plateId}-clean.png`) : null,
      annotatedPath: plate.slots.length > 0 ? path.join(outputDirectory, `${plate.plateId}-annotated.png`) : null,
    })),
    renderBlockers,
  }, null, 2)}\n`);
  return { renderedPlateCount: plates.length, plates, manifestPath, renderBlockers };
}

async function runCli(): Promise<void> {
  const root = process.cwd();
  const manifest = JSON.parse(await readFile(
    path.join(root, "public/data/best-bottles-cylinder-75-type-lineup-manifest.json"),
    "utf8",
  )) as UnknownRecord;
  const layerManifest = JSON.parse(await readFile(
    path.join(root, "tmp/best-bottles-cylinder-75/layers.json"),
    "utf8",
  )) as UnknownRecord;
  const plan = buildCylinder75TypePlateRenderPlan({ manifest, layerManifest });
  const result = await renderCylinder75TypePlates({
    plan,
    outputRoot: path.join(root, "tmp/best-bottles-cylinder-75"),
  });
  console.log(JSON.stringify({
    outputRoot: path.join(root, "tmp/best-bottles-cylinder-75"),
    manifestPath: result.manifestPath,
    renderedPlateCount: result.renderedPlateCount,
    renderBlockers: result.renderBlockers,
    summary: plan.summary,
    externalWrites: false,
  }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
