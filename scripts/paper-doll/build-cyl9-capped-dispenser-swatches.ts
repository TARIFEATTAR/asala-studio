import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import sharp from "sharp";

import {
  clampToAuthorityMask,
  inspectAuthorityMask,
} from "../../src/lib/paperDoll/componentPlateImage.node";
import { extractClosedAssemblySwatch } from "./build-dispenser-17-415-closed-swatches";

const DEFAULT_CAPPED_ROOT = "/Users/jordanrichter/Projects/Clients/Nemat-International/BBUAT-Upload-Files/2. PSD Capped ";
const DEFAULT_OUTPUT_ROOT = "outputs/paper-doll-dispenser-17-415/capped-source-swatches-v3";

const CANVAS = { widthPx: 2080, heightPx: 2288 } as const;
// The approved v2 review read one pixel narrow on each side. Keep the center
// and seat fixed while adding two pixels to the shared family width.
const PLACEMENT = { targetWidthPx: 346, centerXPx: 1041, seatYPx: 1002 } as const;

type Lane = "sprayer" | "pump";

interface PixelBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface CappedDispenserSource {
  lane: Lane;
  variantKey: string;
  sourcePath: string;
  sourceBoundsPx: PixelBounds;
  bandTopSourceYPx: number;
  authorityVariant: boolean;
}

interface PreparedCandidate extends CappedDispenserSource {
  sourceSha256: string;
  sourceCompositeSha256: string;
  candidatePng: Buffer;
  provisionalMaskPng: Buffer;
  placementBoundsPx: PixelBounds;
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function source(
  root: string,
  lane: Lane,
  variantKey: string,
  filename: string,
  options: {
    sourceBoundsPx: PixelBounds;
    bandTopSourceYPx: number;
    authorityVariant?: boolean;
  },
): CappedDispenserSource {
  return {
    lane,
    variantKey,
    sourcePath: path.join(root, "3.  17-415 Bottles/10. Clear  (Capped)", filename),
    sourceBoundsPx: options.sourceBoundsPx,
    bandTopSourceYPx: options.bandTopSourceYPx,
    authorityVariant: options.authorityVariant ?? false,
  };
}

export function planCyl9CappedDispenserSources(
  cappedRoot = DEFAULT_CAPPED_ROOT,
): CappedDispenserSource[] {
  const sprayerBounds = { left: 236, top: 327, width: 233, height: 453 };
  const pumpBounds = { left: 230, top: 322, width: 235, height: 461 };
  const bandTopSourceYPx = 584;
  return [
    source(cappedRoot, "sprayer", "GLD", "21. GBCyl9SpryGl.psd", { sourceBoundsPx: sprayerBounds, bandTopSourceYPx }),
    source(cappedRoot, "sprayer", "MSLV", "22. GBCyl9SpryMattSl.psd", { sourceBoundsPx: sprayerBounds, bandTopSourceYPx }),
    source(cappedRoot, "sprayer", "BLK", "23. GBCyl9SpryBlk.psd", { sourceBoundsPx: sprayerBounds, bandTopSourceYPx }),
    source(cappedRoot, "sprayer", "SSLV", "24. GBCyl9SpryShSl.psd", {
      sourceBoundsPx: sprayerBounds,
      bandTopSourceYPx,
      authorityVariant: true,
    }),
    source(cappedRoot, "sprayer", "RED", "25. GBCyl9SpryRd.psd", { sourceBoundsPx: sprayerBounds, bandTopSourceYPx }),
    source(cappedRoot, "sprayer", "TUR", "26. GBCyl9SpryTur.psd", { sourceBoundsPx: sprayerBounds, bandTopSourceYPx }),
    source(cappedRoot, "pump", "MSLV", "27. LBCyl9LtnMtSl.psd", { sourceBoundsPx: pumpBounds, bandTopSourceYPx }),
    source(cappedRoot, "pump", "GLD", "28. LBCyl9LtnGl.psd", {
      sourceBoundsPx: pumpBounds,
      bandTopSourceYPx,
      authorityVariant: true,
    }),
    source(cappedRoot, "pump", "BLK", "29. LBCyl9LtnBlk.psd", { sourceBoundsPx: pumpBounds, bandTopSourceYPx }),
  ];
}

function runMagick(args: readonly string[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn("magick", [...args], { stdio: ["ignore", "pipe", "pipe"] });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`ImageMagick failed (${code ?? "signal"}): ${Buffer.concat(stderr).toString("utf8").trim()}`));
        return;
      }
      resolve(Buffer.concat(stdout));
    });
  });
}

async function decodePsdComposite(sourcePath: string): Promise<Buffer> {
  return runMagick(["-background", "white", `${sourcePath}[0]`, "png:-"]);
}

async function exactAlphaMismatchCount(leftPng: Buffer, rightPng: Buffer): Promise<number> {
  const [left, right] = await Promise.all([
    sharp(leftPng).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(rightPng).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
  ]);
  if (left.info.width !== right.info.width || left.info.height !== right.info.height) return -1;
  let mismatches = 0;
  for (let pixel = 0; pixel < left.info.width * left.info.height; pixel += 1) {
    if (left.data[pixel * 4 + 3] !== right.data[pixel * 4 + 3]) mismatches += 1;
  }
  return mismatches;
}

export async function keepAuthorityUpperAndSwapBand(input: {
  authorityPng: Buffer;
  variantPng: Buffer;
  authorityMaskPng: Buffer;
  bandTopYPx: number;
}): Promise<Buffer> {
  const [authority, variant, mask] = await Promise.all([
    sharp(input.authorityPng).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(input.variantPng).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(input.authorityMaskPng).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
  ]);
  const dimensions = [authority.info, variant.info, mask.info].map(({ width, height }) => `${width}x${height}`);
  if (new Set(dimensions).size !== 1) throw new Error("Band swatch inputs must share one canvas.");
  if (!Number.isInteger(input.bandTopYPx) || input.bandTopYPx < 0 || input.bandTopYPx >= authority.info.height) {
    throw new Error("Band top must be an integer inside the canonical canvas.");
  }
  const output = Buffer.from(authority.data);
  for (let y = input.bandTopYPx; y < authority.info.height; y += 1) {
    for (let x = 0; x < authority.info.width; x += 1) {
      const offset = (y * authority.info.width + x) * 4;
      output[offset] = variant.data[offset];
      output[offset + 1] = variant.data[offset + 1];
      output[offset + 2] = variant.data[offset + 2];
      output[offset + 3] = mask.data[offset + 3];
    }
  }
  return clampToAuthorityMask(
    await sharp(output, {
      raw: { width: authority.info.width, height: authority.info.height, channels: 4 },
    }).png().toBuffer(),
    input.authorityMaskPng,
  );
}

function normalizedBandTop(sourcePlan: CappedDispenserSource, placementBoundsPx: PixelBounds): number {
  const relativeBandTop = sourcePlan.bandTopSourceYPx - sourcePlan.sourceBoundsPx.top;
  return placementBoundsPx.top + Math.round(
    (relativeBandTop / sourcePlan.sourceBoundsPx.height) * placementBoundsPx.height,
  );
}

async function buildFiveBodyLineup(
  candidatePng: Buffer,
  bodyPlates: Array<{ bodyId: string; path: string }>,
): Promise<Buffer> {
  const panelWidth = 416;
  const panelHeight = 510;
  const previewHeight = 458;
  const panels = await Promise.all(bodyPlates.map(async ({ bodyId, path: bodyPath }) => {
    const assembly = await sharp(await readFile(bodyPath)).composite([{ input: candidatePng }]).png().toBuffer();
    const preview = await sharp(assembly).resize({ width: panelWidth, height: previewHeight, fit: "fill" }).png().toBuffer();
    const label = Buffer.from(`<svg width="${panelWidth}" height="52" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#11110f"/><text x="16" y="32" fill="#f4c46c" font-size="20" font-family="monospace">${bodyId.toUpperCase()}</text></svg>`);
    return sharp({
      create: { width: panelWidth, height: panelHeight, channels: 4, background: "#F5F3EF" },
    }).composite([{ input: preview, top: 0, left: 0 }, { input: label, top: previewHeight, left: 0 }]).png().toBuffer();
  }));
  return sharp({
    create: { width: panelWidth * panels.length, height: panelHeight, channels: 4, background: "#F5F3EF" },
  }).composite(panels.map((input, index) => ({ input, left: index * panelWidth, top: 0 }))).png().toBuffer();
}

async function buildContactSheet(rows: Array<{ label: string; lineup: Buffer }>): Promise<Buffer> {
  const rowHeight = 510;
  const labelWidth = 300;
  const lineupWidth = 2080;
  const layers: sharp.OverlayOptions[] = [];
  for (let index = 0; index < rows.length; index += 1) {
    const top = index * rowHeight;
    layers.push({ input: rows[index].lineup, left: labelWidth, top });
    layers.push({
      input: Buffer.from(`<svg width="${labelWidth}" height="${rowHeight}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#11110f"/><text x="24" y="58" fill="#f4c46c" font-size="24" font-family="monospace" font-weight="700">${rows[index].label}</text><text x="24" y="94" fill="#72e6d1" font-size="14" font-family="monospace">CAPPED PSD · BAND SWATCH</text></svg>`),
      left: 0,
      top,
    });
  }
  return sharp({
    create: {
      width: labelWidth + lineupWidth,
      height: rows.length * rowHeight,
      channels: 4,
      background: "#070706",
    },
  }).composite(layers).png().toBuffer();
}

function valueAfter(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

export async function buildCyl9CappedDispenserSwatches(input: {
  cappedRoot?: string;
  outputRoot?: string;
} = {}): Promise<{ manifestPath: string; contactSheetPath: string }> {
  const cappedRoot = path.resolve(input.cappedRoot ?? DEFAULT_CAPPED_ROOT);
  const outputRoot = path.resolve(input.outputRoot ?? DEFAULT_OUTPUT_ROOT);
  const plans = planCyl9CappedDispenserSources(cappedRoot);
  const bodyRegistry = JSON.parse(await readFile("docs/paper-doll-rig/body-plate-registry.json", "utf8")) as {
    entries: Array<{ id: string; asset: { path: string } }>;
  };
  const bodyPlates = bodyRegistry.entries.map((entry) => ({
    bodyId: entry.id.split("__")[3],
    path: path.resolve(entry.asset.path),
  }));
  const prepared: PreparedCandidate[] = [];
  for (const plan of plans) {
    const [sourceBytes, sourceComposite] = await Promise.all([
      readFile(plan.sourcePath),
      decodePsdComposite(plan.sourcePath),
    ]);
    const extracted = await extractClosedAssemblySwatch({
      sourcePng: sourceComposite,
      sourceBoundsPx: plan.sourceBoundsPx,
      backgroundRgb: { r: 255, g: 255, b: 255 },
      backgroundDistanceThreshold: 12,
      ...PLACEMENT,
      canvas: CANVAS,
    });
    prepared.push({
      ...plan,
      sourceSha256: sha256(sourceBytes),
      sourceCompositeSha256: sha256(sourceComposite),
      candidatePng: extracted.candidatePng,
      provisionalMaskPng: extracted.authorityMaskPng,
      placementBoundsPx: extracted.qa.placementBoundsPx,
    });
  }

  await Promise.all([
    mkdir(path.join(outputRoot, "authority"), { recursive: true }),
    mkdir(path.join(outputRoot, "candidates/sprayer"), { recursive: true }),
    mkdir(path.join(outputRoot, "candidates/pump"), { recursive: true }),
    mkdir(path.join(outputRoot, "review"), { recursive: true }),
  ]);

  const resultRows: Array<Record<string, unknown>> = [];
  const contactRows: Array<{ label: string; lineup: Buffer }> = [];
  for (const lane of ["sprayer", "pump"] as const) {
    const laneCandidates = prepared.filter((candidate) => candidate.lane === lane);
    const authority = laneCandidates.find((candidate) => candidate.authorityVariant);
    if (!authority) throw new Error(`Missing named ${lane} authority variant.`);
    const authorityInspection = await inspectAuthorityMask(authority.provisionalMaskPng, { expectedRegions: 1 });
    const authorityPath = path.join(outputRoot, "authority", `${lane}-closed-assembly.png`);
    await writeFile(authorityPath, authority.provisionalMaskPng);
    const bandTopYPx = normalizedBandTop(authority, authority.placementBoundsPx);
    for (const candidate of laneCandidates) {
      const candidateOnAuthority = await clampToAuthorityMask(candidate.candidatePng, authority.provisionalMaskPng);
      const swatch = await keepAuthorityUpperAndSwapBand({
        authorityPng: authority.candidatePng,
        variantPng: candidateOnAuthority,
        authorityMaskPng: authority.provisionalMaskPng,
        bandTopYPx,
      });
      const alphaMismatchedPixels = await exactAlphaMismatchCount(swatch, authority.provisionalMaskPng);
      if (alphaMismatchedPixels !== 0) {
        throw new Error(`${lane}:${candidate.variantKey} failed exact authority alpha (${alphaMismatchedPixels}).`);
      }
      const candidatePath = path.join(outputRoot, "candidates", lane, `${candidate.variantKey}.png`);
      const lineupPath = path.join(outputRoot, "review", `${lane}-${candidate.variantKey}-five-body.png`);
      const lineup = await buildFiveBodyLineup(swatch, bodyPlates);
      await Promise.all([writeFile(candidatePath, swatch), writeFile(lineupPath, lineup)]);
      contactRows.push({ label: `${lane.toUpperCase()} · ${candidate.variantKey}`, lineup });
      resultRows.push({
        lane,
        variantKey: candidate.variantKey,
        state: "source-backed-five-body-review-required",
        sourcePath: candidate.sourcePath,
        sourceSha256: candidate.sourceSha256,
        sourceCompositeSha256: candidate.sourceCompositeSha256,
        sourceBoundsPx: candidate.sourceBoundsPx,
        placementBoundsPx: candidate.placementBoundsPx,
        bandTopSourceYPx: candidate.bandTopSourceYPx,
        bandTopYPx,
        authorityVariantKey: authority.variantKey,
        authorityPath,
        authoritySha256: sha256(authority.provisionalMaskPng),
        authorityBoundsPx: authorityInspection.authorityBoundsPx,
        candidatePath,
        candidateSha256: sha256(swatch),
        lineupPath,
        qa: { alphaMismatchedPixels, exactMaskClampVerified: true },
      });
    }
  }

  const contactSheet = await buildContactSheet(contactRows);
  const contactSheetPath = path.join(outputRoot, "review/contact-sheet.png");
  await writeFile(contactSheetPath, contactSheet);
  const manifest = {
    schemaVersion: 1,
    familyKey: "CYL-9ML-17-415-CAPPED-DISPENSERS",
    state: "named-five-body-visual-review-required",
    sourcePolicy: {
      sourceAuthority: "layered capped Photoshop archive",
      bottlePixelsUsed: false,
      commonUpperAssemblyFrozen: true,
      variantResponsibility: "finish band pixels only",
      runtimePlatePolicy: "translucent overcap, visible internal mechanism, and finish band export as one compound cap-on component",
      independentTranslucentOverlayAllowed: false,
      uncappedMerchandisingPolicy: "use a separately approved open dispenser component; never derive it by hiding the translucent pixels of a closed component",
      generatedGeometryAllowed: false,
      gptRepairPolicy: "material or lighting repair only; normalize and exact-mask clamp before review",
    },
    calibration: {
      basis: "accepted capped-source v2 review plus one-pixel-per-side shared-width correction requested by Jordan Richter",
      ...PLACEMENT,
      canvas: CANVAS,
      backgroundRgb: { r: 255, g: 255, b: 255 },
      backgroundDistanceThreshold: 12,
    },
    candidates: resultRows,
    qa: {
      exactMaskClampVerified: true,
      fiveBodyAssemblyContextRendered: true,
      geometryLocked: false,
      productionEligible: false,
      reason: "Exact mask clamp is verified; named visual approval and shared placement lock are still required.",
    },
    mutationPolicy: {
      remoteWritesPerformed: false,
      currentReleaseChanged: false,
      sanityChanged: false,
    },
  };
  const manifestPath = path.join(outputRoot, "manifest.json");
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return { manifestPath, contactSheetPath };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const result = await buildCyl9CappedDispenserSwatches({
    cappedRoot: valueAfter(args, "--capped-root"),
    outputRoot: valueAfter(args, "--output-root"),
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
