import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import {
  BEST_BOTTLES_CATALOG_SCALE_VERSION,
  resolveBestBottlesGlobalScalePct,
} from "../../src/config/bestBottlesCatalogScale";
import { PAPER_DOLL_CANVAS_RGB } from "../../src/lib/paperDoll/componentRegistry";
import { extractAdaptiveReferenceSilhouette } from "../../src/lib/paperDoll/referenceSilhouetteAnalysis";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const defaultOutputRoot = path.join(workspaceRoot, "outputs/paper-doll-body-authority-reviews/CYL-5ML-13-415/53x17-clear-v1");

const CANVAS = { width: 2080, height: 2288 } as const;
const CENTER_X = 1040;
const BASELINE_Y = 2082;
const REFERENCE_BODY_HEIGHT_MM = 70;
const REFERENCE_FILL_FRACTION = 0.585;

type PixelBounds = { left: number; top: number; width: number; height: number };
type DimensionsMm = { bodyHeight: number; widthAxis: number; depthAxis: number };

type ReviewOptions = {
  sourcePath: string;
  outputRoot?: string;
  capacityMl: number;
  geometryKey: string;
  dimensionsMm: DimensionsMm;
  sourceBoundsPx: PixelBounds;
  editBoundsPx: PixelBounds;
  calibrationRoiPx?: PixelBounds;
  calibration: { method: string; rationale: string };
};

function sha256(value: Buffer | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function relativeWorkspacePath(absolutePath: string): string {
  return path.relative(workspaceRoot, absolutePath);
}

function escapeXml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

function assertBounds(label: string, bounds: PixelBounds, width: number, height: number): void {
  if (!Number.isInteger(bounds.left) || !Number.isInteger(bounds.top)
    || !Number.isInteger(bounds.width) || !Number.isInteger(bounds.height)
    || bounds.left < 0 || bounds.top < 0 || bounds.width <= 0 || bounds.height <= 0
    || bounds.left + bounds.width > width || bounds.top + bounds.height > height) {
    throw new Error(`${label} is outside the ${width}×${height} source.`);
  }
}

function contains(outer: PixelBounds, inner: PixelBounds): boolean {
  return inner.left >= outer.left && inner.top >= outer.top
    && inner.left + inner.width <= outer.left + outer.width
    && inner.top + inner.height <= outer.top + outer.height;
}

export function deriveCylinderWorkbenchScale(targetBodyHeightMm: number) {
  if (!Number.isFinite(targetBodyHeightMm) || targetBodyHeightMm <= 0) throw new Error("targetBodyHeightMm must be positive.");
  const pixelsPerMm = (CANVAS.height * REFERENCE_FILL_FRACTION) / REFERENCE_BODY_HEIGHT_MM;
  return {
    canvas: CANVAS,
    centerX: CENTER_X,
    baselineY: BASELINE_Y,
    referenceBodyHeightMm: REFERENCE_BODY_HEIGHT_MM,
    referenceFillFraction: REFERENCE_FILL_FRACTION,
    pixelsPerMm: Number(pixelsPerMm.toFixed(6)),
    targetBodyHeightMm,
    targetBodyHeightPx: Math.round(targetBodyHeightMm * pixelsPerMm),
    targetFillFraction: Number((REFERENCE_FILL_FRACTION * targetBodyHeightMm / REFERENCE_BODY_HEIGHT_MM).toFixed(4)),
    scaleAuthority: {
      normalizationScript: "scripts/paper-doll/normalize-plate.ts",
      lockedBodyRegistry: "docs/paper-doll-rig/body-plate-registry.json",
      rule: "Use the locked CYL-9ML paper-doll workbench registration for interchangeable layer construction; center on x=1040 and seat on baseline y=2082.",
    },
  };
}

async function borderMeanRgb(sourcePath: string): Promise<[number, number, number]> {
  const { data, info } = await sharp(sourcePath).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const border = Math.max(1, Math.min(24, Math.floor(Math.min(info.width, info.height) * 0.02)));
  let red = 0;
  let green = 0;
  let blue = 0;
  let count = 0;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (x >= border && x < info.width - border && y >= border && y < info.height - border) continue;
      const offset = (y * info.width + x) * 3;
      red += data[offset];
      green += data[offset + 1];
      blue += data[offset + 2];
      count += 1;
    }
  }
  return [red / count, green / count, blue / count];
}

async function adaptiveDiagnostic(sourcePath: string, roi: PixelBounds | undefined) {
  if (!roi) return null;
  const { data, info } = await sharp(sourcePath).extract(roi).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const result = extractAdaptiveReferenceSilhouette(new Uint8Array(data), info.width, info.height);
  return {
    calibrationRoiPx: roi,
    backgroundRgb: result.backgroundRgb,
    borderDistanceP99: result.borderDistanceP99,
    foregroundDistanceThreshold: result.foregroundDistanceThreshold,
    connectedComponentCount: result.connectedComponentCount,
    selectedForegroundComponentCount: result.selectedForegroundComponentCount,
    measuredBoundsWithinRoiPx: {
      left: result.bounds.x,
      top: result.bounds.y,
      width: result.bounds.width,
      height: result.bounds.height,
    },
    measuredBoundsInSourcePx: {
      left: roi.left + result.bounds.x,
      top: roi.top + result.bounds.y,
      width: result.bounds.width,
      height: result.bounds.height,
    },
    interpretation: "Diagnostic extraction only. Transparent glass can fragment into multiple optical components; this does not create an authority mask.",
  };
}

async function renderCandidate(
  sourcePath: string,
  editBoundsPx: PixelBounds,
  sourceBoundsPx: PixelBounds,
  placementBoundsPx: PixelBounds,
  outputPath: string,
) {
  const mean = await borderMeanRgb(sourcePath);
  const gain = [
    PAPER_DOLL_CANVAS_RGB.r / mean[0],
    PAPER_DOLL_CANVAS_RGB.g / mean[1],
    PAPER_DOLL_CANVAS_RGB.b / mean[2],
  ];
  const edit = await sharp(sourcePath)
    .linear(gain, [0, 0, 0])
    .removeAlpha()
    .extract(editBoundsPx)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const scale = placementBoundsPx.height / sourceBoundsPx.height;
  const scaledWidth = Math.round(edit.info.width * scale);
  const scaledHeight = Math.round(edit.info.height * scale);
  const scaled = await sharp(edit.data, { raw: { width: edit.info.width, height: edit.info.height, channels: 3 } })
    .resize(scaledWidth, scaledHeight)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const objectWithinEdit = {
    left: sourceBoundsPx.left - editBoundsPx.left,
    top: sourceBoundsPx.top - editBoundsPx.top,
    right: editBoundsPx.left + editBoundsPx.width - sourceBoundsPx.left - sourceBoundsPx.width,
    bottom: editBoundsPx.top + editBoundsPx.height - sourceBoundsPx.top - sourceBoundsPx.height,
  };
  const feather = {
    left: Math.max(4, Math.min(48, Math.floor(objectWithinEdit.left * scale * 0.55))),
    top: Math.max(4, Math.min(48, Math.floor(objectWithinEdit.top * scale * 0.55))),
    right: Math.max(4, Math.min(48, Math.floor(objectWithinEdit.right * scale * 0.55))),
    bottom: Math.max(4, Math.min(48, Math.floor(objectWithinEdit.bottom * scale * 0.55))),
  };
  const rgba = Buffer.alloc(scaledWidth * scaledHeight * 4);
  for (let y = 0; y < scaledHeight; y += 1) {
    for (let x = 0; x < scaledWidth; x += 1) {
      const sourceOffset = (y * scaledWidth + x) * 3;
      const targetOffset = (y * scaledWidth + x) * 4;
      rgba[targetOffset] = scaled.data[sourceOffset];
      rgba[targetOffset + 1] = scaled.data[sourceOffset + 1];
      rgba[targetOffset + 2] = scaled.data[sourceOffset + 2];
      rgba[targetOffset + 3] = Math.round(255 * Math.min(
        1,
        x / feather.left,
        (scaledWidth - 1 - x) / feather.right,
        y / feather.top,
        (scaledHeight - 1 - y) / feather.bottom,
      ));
    }
  }

  const subjectCenterWithinEditX = sourceBoundsPx.left - editBoundsPx.left + sourceBoundsPx.width / 2;
  const subjectBottomWithinEditY = sourceBoundsPx.top - editBoundsPx.top + sourceBoundsPx.height;
  const left = Math.round(CENTER_X - subjectCenterWithinEditX * scale);
  const top = Math.round(BASELINE_Y - subjectBottomWithinEditY * scale + 1);
  await sharp({ create: { width: CANVAS.width, height: CANVAS.height, channels: 3, background: PAPER_DOLL_CANVAS_RGB } })
    .composite([{ input: rgba, raw: { width: scaledWidth, height: scaledHeight, channels: 4 }, left, top }])
    .png()
    .toFile(outputPath);
  return {
    borderMeanRgb: mean.map((value) => Number(value.toFixed(3))),
    grayCardGain: gain.map((value) => Number(value.toFixed(6))),
    uniformScale: Number(scale.toFixed(8)),
    sourceCompositePlacementPx: { left, top, width: scaledWidth, height: scaledHeight },
    featherPx: feather,
  };
}

async function renderContactSheet(
  sourcePath: string,
  candidatePath: string,
  sourceBoundsPx: PixelBounds,
  editBoundsPx: PixelBounds,
  placementBoundsPx: PixelBounds,
  geometryKey: string,
  dimensionsMm: DimensionsMm,
  outputPath: string,
) {
  const width = 1600;
  const height = 1040;
  const sourcePreview = await sharp(sourcePath).resize({ width: 710, height: 700, fit: "contain", background: "#F5F3EF" }).png().toBuffer();
  const candidatePreview = await sharp(candidatePath).resize({ width: 710, height: 700, fit: "contain", background: "#F5F3EF" }).png().toBuffer();
  const header = Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <text x="50" y="58" fill="#f4c46c" font-size="34" font-family="Arial" font-weight="700">CYL-5ML BODY AUTHORITY REVIEW</text>
    <text x="50" y="94" fill="#ddd6c8" font-size="19" font-family="monospace">${escapeXml(geometryKey)} · ${dimensionsMm.bodyHeight}×${dimensionsMm.widthAxis} mm</text>
    <text x="50" y="128" fill="#e07b69" font-size="18" font-family="monospace">REVIEW CANDIDATE ONLY · AUTHORITY MISSING · NOT GEOMETRY LOCKED</text>
    <text x="50" y="918" fill="#f2efe9" font-size="20" font-family="Arial" font-weight="700">SOURCE EVIDENCE</text>
    <text x="840" y="918" fill="#f2efe9" font-size="20" font-family="Arial" font-weight="700">WORKBENCH SCALE PREVIEW</text>
    <text x="50" y="954" fill="#bcb4a6" font-size="16" font-family="monospace">source bounds ${sourceBoundsPx.left},${sourceBoundsPx.top} ${sourceBoundsPx.width}×${sourceBoundsPx.height} · edit ${editBoundsPx.left},${editBoundsPx.top} ${editBoundsPx.width}×${editBoundsPx.height}</text>
    <text x="840" y="954" fill="#bcb4a6" font-size="16" font-family="monospace">placement ${placementBoundsPx.left},${placementBoundsPx.top} ${placementBoundsPx.width}×${placementBoundsPx.height}</text>
    <text x="50" y="992" fill="#8f897f" font-size="16" font-family="Arial">Workbench registration comes from the locked rig. Final hero scale applies uniformly after assembly from catalog-scale-v1.</text>
  </svg>`);
  await sharp({ create: { width, height, channels: 4, background: "#11110f" } })
    .composite([
      { input: sourcePreview, left: 50, top: 150 },
      { input: candidatePreview, left: 840, top: 150 },
      { input: header, left: 0, top: 0 },
    ])
    .png()
    .toFile(outputPath);
}

export async function buildCylinderBodyAuthorityReview(options: ReviewOptions) {
  const sourcePath = path.resolve(options.sourcePath);
  const outputRoot = path.resolve(options.outputRoot ?? defaultOutputRoot);
  const sourceBuffer = await readFile(sourcePath);
  const metadata = await sharp(sourceBuffer).metadata();
  const sourceWidth = metadata.width ?? 0;
  const sourceHeight = metadata.height ?? 0;
  assertBounds("sourceBoundsPx", options.sourceBoundsPx, sourceWidth, sourceHeight);
  assertBounds("editBoundsPx", options.editBoundsPx, sourceWidth, sourceHeight);
  if (!contains(options.editBoundsPx, options.sourceBoundsPx)) throw new Error("editBoundsPx must contain sourceBoundsPx.");
  if (options.calibrationRoiPx) assertBounds("calibrationRoiPx", options.calibrationRoiPx, sourceWidth, sourceHeight);
  await mkdir(outputRoot, { recursive: true });

  const workbenchScale = deriveCylinderWorkbenchScale(options.dimensionsMm.bodyHeight);
  const targetAssembledHeightPct = resolveBestBottlesGlobalScalePct(options.capacityMl);
  const placementWidth = Math.round(options.sourceBoundsPx.width * workbenchScale.targetBodyHeightPx / options.sourceBoundsPx.height);
  const placementBoundsPx = {
    left: CENTER_X - Math.round(placementWidth / 2),
    top: BASELINE_Y - workbenchScale.targetBodyHeightPx + 1,
    width: placementWidth,
    height: workbenchScale.targetBodyHeightPx,
  };
  const candidatePath = path.join(outputRoot, "canonical-review-candidate.png");
  const normalization = await renderCandidate(
    sourcePath,
    options.editBoundsPx,
    options.sourceBoundsPx,
    placementBoundsPx,
    candidatePath,
  );
  const contactSheetPath = path.join(outputRoot, "contact-sheet.png");
  await renderContactSheet(
    sourcePath,
    candidatePath,
    options.sourceBoundsPx,
    options.editBoundsPx,
    placementBoundsPx,
    options.geometryKey,
    options.dimensionsMm,
    contactSheetPath,
  );
  const [candidateBuffer, contactSheetBuffer, diagnostic] = await Promise.all([
    readFile(candidatePath),
    readFile(contactSheetPath),
    adaptiveDiagnostic(sourcePath, options.calibrationRoiPx),
  ]);
  const observedAspect = options.sourceBoundsPx.width / options.sourceBoundsPx.height;
  const dimensionAspect = options.dimensionsMm.widthAxis / options.dimensionsMm.bodyHeight;
  const manifest = {
    schemaVersion: 1,
    reviewId: `body-authority-review__${options.geometryKey}`,
    lifecycleState: "candidate" as const,
    geometryKey: options.geometryKey,
    dimensionsMm: options.dimensionsMm,
    source: {
      path: relativeWorkspacePath(sourcePath),
      sha256: sha256(sourceBuffer),
      widthPx: sourceWidth,
      heightPx: sourceHeight,
    },
    workbenchScale,
    catalogPresentation: {
      scaleContractVersion: BEST_BOTTLES_CATALOG_SCALE_VERSION,
      capacityMl: options.capacityMl,
      targetAssembledHeightPct,
      targetAssembledHeightPx: Math.round(CANVAS.height * targetAssembledHeightPct / 100),
      transformTiming: "after-paper-doll-assembly" as const,
      resolvedAssemblyTransform: null,
      resolutionBlocker: "A complete SKU recipe with verified assembled height and topology is required before the final uniform hero transform can be calculated.",
      rule: "Compose all compatible layers at workbench registration, then uniformly transform the complete assembly. Never rescale the bottle and fitment independently.",
    },
    sourceBoundsPx: options.sourceBoundsPx,
    editBoundsPx: options.editBoundsPx,
    authorityBoundsPx: null,
    placementBoundsPx,
    calibration: {
      ...options.calibration,
      adaptiveDiagnostic: diagnostic,
      observedSourceAspect: Number(observedAspect.toFixed(6)),
      nominalDimensionAspect: Number(dimensionAspect.toFixed(6)),
      aspectDifferencePercent: Number((Math.abs(observedAspect - dimensionAspect) / dimensionAspect * 100).toFixed(3)),
      automatedAuthorityDecision: "not-permitted" as const,
    },
    normalization,
    geometryLocked: false,
    productionPlateEligible: false,
    requiredNextGate: "named physical-profile and clean-authority review",
    blockers: [
      "No approved clean CYL-5ML body geometry authority is registered.",
      "The source is visual evidence and cannot replace verified CAD, Blender, or an approved clean photographic silhouette.",
      "Thread profile and exact body silhouette still require named physical review.",
    ],
    artifacts: {
      canonicalCandidate: { path: "canonical-review-candidate.png", sha256: sha256(candidateBuffer), width: 2080, height: 2288 },
      contactSheet: { path: "contact-sheet.png", sha256: sha256(contactSheetBuffer), width: 1600, height: 1040 },
    },
    mutationPolicy: {
      sourcePixelsChanged: false,
      reviewCandidateWritten: true,
      approvalWritten: false,
      remoteWritesPerformed: false,
      currentReleaseChanged: false,
      sanityChanged: false,
    },
  };
  await writeFile(path.join(outputRoot, "review-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return manifest;
}

async function main() {
  const manifest = await buildCylinderBodyAuthorityReview({
    sourcePath: path.join(workspaceRoot, "tmp/inspect-GBCyl5WhtSht-master_rigged.png"),
    outputRoot: defaultOutputRoot,
    capacityMl: 5,
    geometryKey: "body__cylinder__5ml__53x17x17.0__f94a16652c",
    dimensionsMm: { bodyHeight: 53, widthAxis: 17, depthAxis: 17 },
    sourceBoundsPx: { left: 219, top: 89, width: 340, height: 1019 },
    editBoundsPx: { left: 139, top: 9, width: 500, height: 1150 },
    calibrationRoiPx: { left: 200, top: 60, width: 380, height: 1050 },
    calibration: {
      method: "per-file adaptive foreground diagnostic plus explicit operator-reviewed source bounds",
      rationale: "The tight ROI excludes the detached cap sidecar. Transparent glass fragments into optical components, so the diagnostic bounds remain review evidence and never become an authority mask automatically.",
    },
  });
  console.log(JSON.stringify({
    reviewId: manifest.reviewId,
    geometryLocked: manifest.geometryLocked,
    productionPlateEligible: manifest.productionPlateEligible,
    workbenchScale: manifest.workbenchScale,
    catalogPresentation: manifest.catalogPresentation,
    placementBoundsPx: manifest.placementBoundsPx,
    artifacts: manifest.artifacts,
    mutationPolicy: manifest.mutationPolicy,
  }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
