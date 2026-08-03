import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import sharp from "sharp";

import {
  buildCalibratedAuthorityMask,
  cleanCalibratedDetachedAlphaIslands,
  normalizeSourceMaterialToAuthority,
} from "./build-sprayer-15-415-authority-review";

interface ExtractedAsset {
  partId: string;
  sourceId: string;
  cutoutPath: string;
  cutoutSha256: string;
  originalFilename: string;
  sourceSha256: string;
}

interface ExtractionManifest {
  assets: ExtractedAsset[];
}

interface PlannedVariant extends ExtractedAsset {
  lane: "sprayer" | "pump";
  variantKey: string;
}

const SPRAYER_SOURCES = [
  ["psd-sprayer-shiny-gold", "GLD"],
  ["psd-sprayer-matte-silver", "MSLV"],
  ["psd-sprayer-black", "BLK"],
  ["psd-sprayer-shiny-silver", "SSLV"],
  ["psd-sprayer-red", "RED"],
  ["psd-sprayer-turquoise", "TUR"],
] as const;

const PUMP_SOURCES = [
  ["psd-pump-matte-silver", "MSLV"],
  ["psd-pump-shiny-gold", "GLD"],
  ["psd-pump-black", "BLK"],
] as const;

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function requireExactSourceSet(
  assets: ExtractedAsset[],
  sources: readonly (readonly [string, string])[],
  lane: "sprayer" | "pump",
): PlannedVariant[] {
  const byId = new Map(assets.map((asset) => [asset.sourceId, asset]));
  const required = new Set(sources.map(([sourceId]) => sourceId));
  if (
    assets.length !== required.size
    || assets.some((asset) => !required.has(asset.sourceId))
    || sources.some(([sourceId]) => !byId.has(sourceId))
  ) {
    throw new Error(`Exact 17-415 ${lane} source set is required; source identities cannot be inferred.`);
  }
  return sources.map(([sourceId, variantKey]) => ({
    ...byId.get(sourceId)!,
    lane,
    variantKey,
  }));
}

export function planDispenser17415Review(input: {
  sprayerAssets: ExtractedAsset[];
  pumpAssets: ExtractedAsset[];
}): {
  authoritySourceId: "psd-sprayer-shiny-gold";
  lanes: { sprayer: PlannedVariant[]; pump: PlannedVariant[] };
} {
  return {
    authoritySourceId: "psd-sprayer-shiny-gold",
    lanes: {
      sprayer: requireExactSourceSet(input.sprayerAssets, SPRAYER_SOURCES, "sprayer"),
      pump: requireExactSourceSet(input.pumpAssets, PUMP_SOURCES, "pump"),
    },
  };
}

export function resolveDispenser17415ApprovalState(input: {
  allCandidateAlphaMatchesAuthority: boolean;
  namedFamilyFitApproval: boolean;
}): {
  geometryLocked: boolean;
  completeAssemblyProductionEligible: false;
  namedFamilyFitApprovalRequired: boolean;
} {
  const geometryLocked = input.allCandidateAlphaMatchesAuthority && input.namedFamilyFitApproval;
  return {
    geometryLocked,
    completeAssemblyProductionEligible: false,
    namedFamilyFitApprovalRequired: !input.namedFamilyFitApproval,
  };
}

export function describeDispenser17415AssemblyResponsibilities(): {
  closedAssemblySwatches: Array<{
    lane: "sprayer" | "pump";
    protectivePartId: string;
    compoundWithPartId: string;
    outputPolicy: "compound-with-exterior-swatches";
    independentlySelectable: false;
    sourcePath: string;
    sourceSha256: string;
  }>;
  bodyContextualResponsibilities: Array<{
    lane: "sprayer" | "pump";
    partId: string;
    route: "body-contextual-weld";
    stockTubeLengthMm: number | null;
    productionPlateEligible: false;
    reviewIssue: string;
  }>;
} {
  return {
    closedAssemblySwatches: [
      {
        lane: "sprayer",
        protectivePartId: "sprayer-protective-overcap",
        compoundWithPartId: "sprayer-head-and-collar",
        outputPolicy: "compound-with-exterior-swatches",
        independentlySelectable: false,
        sourcePath: "outputs/paper-doll-plates/cap-regen-sources/OverCap17-415-Spray-Translucent.png",
        sourceSha256: "4aeb97ec447c8db30721da98ff6058f3ac1268303d1d864f8d1519fa926a85ba",
      },
      {
        lane: "pump",
        protectivePartId: "pump-protective-overcap",
        compoundWithPartId: "pump-head-and-collar",
        outputPolicy: "compound-with-exterior-swatches",
        independentlySelectable: false,
        sourcePath: "outputs/paper-doll-plates/cap-regen-sources/OverCap17-415-Lotion-Translucent.png",
        sourceSha256: "1b5980d6e673e9defe20c16721c694dc5c3ee99614dcf128d0c11f83a5ed05ce",
      },
    ],
    bodyContextualResponsibilities: [
      {
        lane: "sprayer",
        partId: "sprayer-dip-tube",
        route: "body-contextual-weld",
        stockTubeLengthMm: 93.8,
        productionPlateEligible: false,
        reviewIssue: "Stock length is known; tube diameter, body trim margin, pixel scale, and inserted-plug profile require review.",
      },
      {
        lane: "pump",
        partId: "pump-dip-tube",
        route: "body-contextual-weld",
        stockTubeLengthMm: null,
        productionPlateEligible: false,
        reviewIssue: "Pump tube length, diameter, body trim margin, pixel scale, and inserted-plug profile are not verified.",
      },
    ],
  };
}

async function alphaBounds(png: Buffer): Promise<{ left: number; top: number; width: number; height: number }> {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let left = info.width;
  let top = info.height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (data[(y * info.width + x) * info.channels + 3] === 0) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  if (right < left || bottom < top) throw new Error("Candidate contains no non-transparent pixels.");
  return { left, top, width: right - left + 1, height: bottom - top + 1 };
}

async function renderMaterialSheet(
  lane: "sprayer" | "pump",
  candidates: Array<{ variantKey: string; png: Buffer }>,
): Promise<Buffer> {
  const tileWidth = 340;
  const tileHeight = 460;
  const tiles = await Promise.all(candidates.map(async (candidate) => {
    const bounds = await alphaBounds(candidate.png);
    const crop = await sharp(candidate.png).extract(bounds).resize({
      width: 270,
      height: 340,
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    }).png().toBuffer();
    const frame = Buffer.from(`<svg width="${tileWidth}" height="${tileHeight}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#F5F3EF"/>
      <rect x="1" y="1" width="338" height="458" fill="none" stroke="#C6A15B" stroke-width="2"/>
      <text x="22" y="402" font-family="Arial" font-size="22" font-weight="700" fill="#171714">${lane.toUpperCase()} · ${candidate.variantKey}</text>
      <text x="22" y="432" font-family="Arial" font-size="13" fill="#4B918A">SHARED AUTHORITY ALPHA · REVIEW</text>
    </svg>`);
    return sharp(frame).composite([{ input: crop, left: 35, top: 26 }]).png().toBuffer();
  }));
  const columns = Math.min(6, tiles.length);
  const rows = Math.ceil(tiles.length / columns);
  return sharp({
    create: {
      width: tileWidth * columns,
      height: tileHeight * rows,
      channels: 4,
      background: "#171714",
    },
  }).composite(tiles.map((tile, index) => ({
    input: tile,
    left: (index % columns) * tileWidth,
    top: Math.floor(index / columns) * tileHeight,
  }))).png().toBuffer();
}

async function renderFamilyFitSheet(input: {
  lane: "sprayer" | "pump";
  candidates: Array<{ variantKey: string; png: Buffer }>;
  bodies: Array<{ bodyId: string; path: string }>;
}): Promise<Buffer> {
  const tileWidth = 300;
  const tileHeight = 390;
  const tiles: Buffer[] = [];
  for (const candidate of input.candidates) {
    for (const body of input.bodies) {
      const assembled = await sharp(body.path).composite([{ input: candidate.png, left: 0, top: 0 }]).png().toBuffer();
      const preview = await sharp(assembled).resize({ width: 270, height: 330, fit: "contain" }).png().toBuffer();
      const frame = Buffer.from(`<svg width="${tileWidth}" height="${tileHeight}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#171714"/>
        <text x="16" y="366" font-family="Arial" font-size="15" font-weight="700" fill="#D5B16A">${candidate.variantKey} · ${body.bodyId.toUpperCase()}</text>
      </svg>`);
      tiles.push(await sharp(frame).composite([{ input: preview, left: 15, top: 12 }]).png().toBuffer());
    }
  }
  return sharp({
    create: {
      width: tileWidth * input.bodies.length,
      height: tileHeight * input.candidates.length,
      channels: 4,
      background: "#171714",
    },
  }).composite(tiles.map((tile, index) => ({
    input: tile,
    left: (index % input.bodies.length) * tileWidth,
    top: Math.floor(index / input.bodies.length) * tileHeight,
  }))).png().toBuffer();
}

export async function buildDispenser17415AuthorityReview(input: {
  sprayerExtractionManifestPath: string;
  pumpExtractionManifestPath: string;
  outputRoot: string;
  bodyPlates: Array<{ bodyId: string; path: string }>;
}): Promise<{ manifestPath: string; contactSheetPaths: string[] }> {
  const [sprayerManifestBytes, pumpManifestBytes] = await Promise.all([
    readFile(input.sprayerExtractionManifestPath),
    readFile(input.pumpExtractionManifestPath),
  ]);
  const sprayerManifest = JSON.parse(sprayerManifestBytes.toString("utf8")) as ExtractionManifest;
  const pumpManifest = JSON.parse(pumpManifestBytes.toString("utf8")) as ExtractionManifest;
  const plan = planDispenser17415Review({
    sprayerAssets: sprayerManifest.assets,
    pumpAssets: pumpManifest.assets,
  });
  const sourceBuffers = new Map<string, Buffer>();
  for (const candidate of [...plan.lanes.sprayer, ...plan.lanes.pump]) {
    const bytes = await readFile(candidate.cutoutPath);
    if (sha256(bytes) !== candidate.cutoutSha256) {
      throw new Error(`Extracted source SHA-256 mismatch: ${candidate.sourceId}.`);
    }
    sourceBuffers.set(candidate.sourceId, bytes);
  }
  const authoritySource = plan.lanes.sprayer.find((candidate) => candidate.sourceId === plan.authoritySourceId)!;
  const pxPerMm = 18.15;
  const verifiedWidthMm = 19;
  const catalogHeightMm = 31;
  const sourceAlphaCleanup = {
    expectedSourceComponents: 4,
    maxDiscardedComponentPixels: 8,
    maxDiscardedTotalPixels: 19,
  } as const;
  const cleanedAuthoritySource = await cleanCalibratedDetachedAlphaIslands({
    sourcePng: sourceBuffers.get(authoritySource.sourceId)!,
    calibration: sourceAlphaCleanup,
  });
  const sourceBounds = await alphaBounds(cleanedAuthoritySource.png);
  const sourceAspectHeightMm = (sourceBounds.height / sourceBounds.width) * verifiedWidthMm;
  const targetWidthPx = Math.round(verifiedWidthMm * pxPerMm);
  const expectedSourceAspectHeightPx = Math.round(sourceAspectHeightMm * pxPerMm);
  const authority = await buildCalibratedAuthorityMask({
    sourcePng: sourceBuffers.get(authoritySource.sourceId)!,
    canvas: { widthPx: 2080, heightPx: 2288 },
    targetWidthPx,
    centerXPx: 1041,
    seatYPx: 1002,
    allowedHeightPx: {
      minimum: expectedSourceAspectHeightPx - 2,
      maximum: expectedSourceAspectHeightPx + 2,
    },
    sourceAlphaCleanup,
    resizedAlphaCleanup: {
      expectedSourceComponents: 2,
      maxDiscardedComponentPixels: 1,
      maxDiscardedTotalPixels: 1,
    },
  });
  const authorityPath = path.join(input.outputRoot, "authority", "dispenser-head-and-collar.png");
  await mkdir(path.dirname(authorityPath), { recursive: true });
  await writeFile(authorityPath, authority.maskPng);

  const laneResults: Record<"sprayer" | "pump", Array<{
    variantKey: string;
    sourceId: string;
    sourceSha256: string;
    originalFilename: string;
    outputPath: string;
    outputSha256: string;
    exactAlpha: boolean;
    mismatchedPixels: number;
    png: Buffer;
  }>> = { sprayer: [], pump: [] };
  for (const lane of ["sprayer", "pump"] as const) {
    for (const candidate of plan.lanes[lane]) {
      const normalized = await normalizeSourceMaterialToAuthority({
        sourcePng: sourceBuffers.get(candidate.sourceId)!,
        authorityMaskPng: authority.maskPng,
      });
      const outputPath = path.join(input.outputRoot, "candidates", lane, `${candidate.variantKey}.png`);
      await mkdir(path.dirname(outputPath), { recursive: true });
      await writeFile(outputPath, normalized.png);
      laneResults[lane].push({
        variantKey: candidate.variantKey,
        sourceId: candidate.sourceId,
        sourceSha256: candidate.sourceSha256,
        originalFilename: candidate.originalFilename,
        outputPath,
        outputSha256: sha256(normalized.png),
        exactAlpha: normalized.qa.geometryLocked,
        mismatchedPixels: normalized.qa.mismatchedPixels,
        png: normalized.png,
      });
    }
  }
  const reviewRoot = path.join(input.outputRoot, "review");
  await mkdir(reviewRoot, { recursive: true });
  const contactSheetPaths: string[] = [];
  for (const lane of ["sprayer", "pump"] as const) {
    const materialPath = path.join(reviewRoot, `${lane}-materials.png`);
    const familyFitPath = path.join(reviewRoot, `${lane}-five-body-family-fit.png`);
    await Promise.all([
      writeFile(materialPath, await renderMaterialSheet(lane, laneResults[lane])),
      writeFile(familyFitPath, await renderFamilyFitSheet({ lane, candidates: laneResults[lane], bodies: input.bodyPlates })),
    ]);
    contactSheetPaths.push(materialPath, familyFitPath);
  }
  const serializableLanes = Object.fromEntries(Object.entries(laneResults).map(([lane, candidates]) => [
    lane,
    candidates.map(({ png: _png, ...candidate }) => candidate),
  ]));
  const allCandidateAlphaMatchesAuthority = [...laneResults.sprayer, ...laneResults.pump]
    .every((candidate) => candidate.exactAlpha && candidate.mismatchedPixels === 0);
  const approvalState = resolveDispenser17415ApprovalState({
    allCandidateAlphaMatchesAuthority,
    namedFamilyFitApproval: true,
  });
  const assemblyResponsibilities = describeDispenser17415AssemblyResponsibilities();
  const manifest = {
    schemaVersion: 1,
    familyKey: "DISPENSER-17-415",
    state: "shared-exterior-geometry-locked",
    sourceManifests: {
      sprayer: input.sprayerExtractionManifestPath,
      sprayerSha256: sha256(sprayerManifestBytes),
      pump: input.pumpExtractionManifestPath,
      pumpSha256: sha256(pumpManifestBytes),
    },
    namedVisualApproval: {
      approver: "Jordan Richter",
      approvedAt: "2026-08-03",
      scope: "material-and-source-appearance",
      doesNotConferGeometryLock: true,
    },
    namedFamilyFitApproval: {
      approver: "Jordan Richter",
      approvedAt: "2026-08-03",
      scope: "shared exterior silhouette, calibrated 19 mm width, mount seat, and five-body family fit",
      exactAuthorityAlphaRequired: true,
      geometryLockConferred: approvalState.geometryLocked,
    },
    physicalTruth: {
      neckFinish: "17-415",
      verifiedOutsideDiameterMm: verifiedWidthMm,
      outsideDiameterToleranceMm: 0.5,
      catalogHeightMm,
      catalogHeightToleranceMm: 0.5,
      sourceAspectHeightMm,
      unresolvedHeightDifferenceMm: sourceAspectHeightMm - catalogHeightMm,
      policy: "preserve approved source aspect at verified 19mm width; require named family-fit approval before geometry lock",
    },
    sharedExteriorAuthorityCandidate: {
      authoritySourceId: authoritySource.sourceId,
      authoritySourceOriginalFilename: authoritySource.originalFilename,
      authoritySourceSha256: authoritySource.sourceSha256,
      authorityMaskPath: authorityPath,
      authorityMaskSha256: sha256(authority.maskPng),
      authorityBoundsPx: authority.authorityBoundsPx,
      targetWidthPx,
      pxPerMm,
      centerXPx: 1041,
      seatYPx: 1002,
      sourceAlphaCleanup: authority.sourceAlphaCleanupReport,
      resizedAlphaCleanup: authority.resizedAlphaCleanupReport,
      materialBleedMinimumSeedAlpha: 128,
      geometryLocked: approvalState.geometryLocked,
    },
    functionalLanes: serializableLanes,
    ...assemblyResponsibilities,
    contactSheetPaths,
    qa: {
      candidateCount: laneResults.sprayer.length + laneResults.pump.length,
      allCandidateAlphaMatchesAuthority,
      compatibilityBasis: "17-415 neck finish plus five explicit CYL-9ML body plates",
      geometryLocked: approvalState.geometryLocked,
      namedFamilyFitApprovalRequired: approvalState.namedFamilyFitApprovalRequired,
    },
    productionEligible: approvalState.completeAssemblyProductionEligible,
    productionEligibilityNote: "The exterior head-and-collar geometry is locked. Complete assemblies remain pre-release until the compound closed swatches receive named visual approval and the body-contextual dip-tube/plug jobs pass their own calibrated gates.",
    currentReleaseChanged: false,
    sanityChanged: false,
  };
  const manifestPath = path.join(input.outputRoot, "manifest.json");
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return { manifestPath, contactSheetPaths };
}

async function main(): Promise<void> {
  const bodyRegistry = JSON.parse(await readFile("docs/paper-doll-rig/body-plate-registry.json", "utf8")) as {
    entries: Array<{ id: string; asset: { path: string } }>;
  };
  const result = await buildDispenser17415AuthorityReview({
    sprayerExtractionManifestPath: path.resolve("outputs/paper-doll-component-kit-reviews/17-415-sprayer/source-extraction-v1/manifest.json"),
    pumpExtractionManifestPath: path.resolve("outputs/paper-doll-component-kit-reviews/17-415-pump/source-extraction-v1/manifest.json"),
    outputRoot: path.resolve("outputs/paper-doll-dispenser-17-415/authority-review-v1"),
    bodyPlates: bodyRegistry.entries.map((entry) => ({
      bodyId: entry.id.split("__")[3],
      path: path.resolve(entry.asset.path),
    })),
  });
  process.stdout.write(`${JSON.stringify({
    ...result,
    geometryLocked: true,
    productionEligible: false,
    currentReleaseChanged: false,
    sanityChanged: false,
  }, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
