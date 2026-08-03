import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import {
  binarySilhouetteIou,
  extractAdaptiveReferenceSilhouette,
  normalizeReferenceSilhouette,
} from "../../src/lib/paperDoll/referenceSilhouetteAnalysis";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const outputRoot = path.join(workspaceRoot, "outputs/paper-doll-component-authority-reviews");

function escapeXml(value: string): string {
  return value.replace(/[<>&'\"]/g, (character) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", "\"": "&quot;" })[character] ?? character);
}

export async function analyzeComponentReferenceSilhouettes(groupKey: string) {
  const groupDir = path.join(outputRoot, groupKey);
  const manifestPath = path.join(groupDir, "reference-review.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as any;
  const analyses = [];
  const normalizedMasks: Uint8Array[] = [];
  for (const source of manifest.downloaded) {
    const previewPath = path.join(workspaceRoot, source.previewPath);
    const { data, info } = await sharp(previewPath).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const extraction = extractAdaptiveReferenceSilhouette(new Uint8Array(data), info.width, info.height);
    const normalized = normalizeReferenceSilhouette(extraction, info.width, 256);
    normalizedMasks.push(normalized);
    const maskPath = path.join(groupDir, "preview", `${path.basename(previewPath, path.extname(previewPath))}__adaptive-mask.png`);
    await sharp(Buffer.from(extraction.mask), { raw: { width: info.width, height: info.height, channels: 1 } }).png().toFile(maskPath);
    analyses.push({
      sourceIdentity: source.sourceIdentity,
      sourceSha256: source.sha256,
      sourceWidth: info.width,
      sourceHeight: info.height,
      backgroundRgb: extraction.backgroundRgb,
      borderDistanceP99: extraction.borderDistanceP99,
      foregroundDistanceThreshold: extraction.foregroundDistanceThreshold,
      connectedComponentCount: extraction.connectedComponentCount,
      largestComponentPixels: extraction.largestComponentPixels,
      selectedForegroundComponentCount: extraction.selectedForegroundComponentCount,
      outerEnvelopePixels: extraction.outerEnvelopePixels,
      bounds: extraction.bounds,
      boundsAspectRatio: extraction.bounds.width / extraction.bounds.height,
      maskPath: path.relative(workspaceRoot, maskPath),
    });
  }

  const pairwiseIou = analyses.map((left, leftIndex) => analyses.map((right, rightIndex) => ({
    left: left.sourceIdentity,
    right: right.sourceIdentity,
    iou: binarySilhouetteIou(normalizedMasks[leftIndex], normalizedMasks[rightIndex]),
  })));
  const averageIou = pairwiseIou.map((row) => row.reduce((total, comparison) => total + comparison.iou, 0) / row.length);
  const medoidIndex = averageIou.reduce((best, value, index) => value > averageIou[best] ? index : best, 0);
  const offDiagonal = pairwiseIou.flatMap((row, leftIndex) => row.filter((_, rightIndex) => leftIndex !== rightIndex));
  const worstComparison = offDiagonal.length > 0
    ? offDiagonal.reduce((worst, comparison) => comparison.iou < worst.iou ? comparison : worst, offDiagonal[0])
    : null;
  const aspects = analyses.map((analysis) => analysis.boundsAspectRatio).sort((left, right) => left - right);
  const medianAspect = aspects[Math.floor(aspects.length / 2)];

  const tileWidth = 620;
  const tileHeight = 560;
  const columns = Math.min(3, analyses.length);
  const rows = Math.ceil(analyses.length / columns);
  const composites = await Promise.all(analyses.map(async (analysis, index) => {
    const source = manifest.downloaded.find((candidate: any) => candidate.sourceIdentity === analysis.sourceIdentity);
    const original = await sharp(path.join(workspaceRoot, source.previewPath))
      .resize({ width: 260, height: 360, fit: "contain", background: "#F5F3EF" })
      .png()
      .toBuffer();
    const mask = await sharp(path.join(workspaceRoot, analysis.maskPath))
      .resize({ width: 260, height: 360, fit: "contain", kernel: "nearest", background: "#151515" })
      .png()
      .toBuffer();
    const caption = Buffer.from(`<svg width="${tileWidth}" height="${tileHeight}">
      <rect x="1" y="1" width="${tileWidth - 2}" height="${tileHeight - 2}" fill="none" stroke="#C6A15B" stroke-width="2"/>
      <text x="24" y="420" font-family="Arial, sans-serif" font-size="23" font-weight="700" fill="#151515">${escapeXml(analysis.sourceIdentity)}</text>
      <text x="24" y="455" font-family="Arial, sans-serif" font-size="17" fill="#5C574E">bounds ${analysis.bounds.width}×${analysis.bounds.height} · aspect ${analysis.boundsAspectRatio.toFixed(4)}</text>
      <text x="24" y="487" font-family="Arial, sans-serif" font-size="17" fill="#5C574E">bg ${analysis.backgroundRgb.join(",")} · adaptive threshold ${analysis.foregroundDistanceThreshold.toFixed(1)}</text>
      <text x="24" y="525" font-family="Arial, sans-serif" font-size="16" fill="#A5453C">MEASURED SOURCE SILHOUETTE · MANUAL PHYSICAL REVIEW</text>
    </svg>`);
    const tile = await sharp({ create: { width: tileWidth, height: tileHeight, channels: 4, background: "#F5F3EF" } })
      .composite([{ input: original, left: 25, top: 30 }, { input: mask, left: 335, top: 30 }, { input: caption, left: 0, top: 0 }])
      .png()
      .toBuffer();
    return { input: tile, left: (index % columns) * tileWidth, top: Math.floor(index / columns) * tileHeight };
  }));
  const contactSheetPath = path.join(groupDir, "silhouette-analysis-contact-sheet.png");
  await sharp({ create: { width: columns * tileWidth, height: rows * tileHeight, channels: 4, background: "#151515" } })
    .composite(composites)
    .png()
    .toFile(contactSheetPath);

  const result = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    reviewGroupKey: groupKey,
    sourceManifestPath: path.relative(workspaceRoot, manifestPath),
    calibrationPolicy: "per-file border median plus per-file border-distance p99; no material-independent fixed approval threshold",
    analyses,
    comparison: {
      normalizedCanvas: { width: 256, height: 256 },
      medoidSourceIdentity: analyses[medoidIndex].sourceIdentity,
      medoidAverageIou: averageIou[medoidIndex],
      worstPair: worstComparison,
      minimumBoundsAspectRatio: Math.min(...aspects),
      maximumBoundsAspectRatio: Math.max(...aspects),
      medianBoundsAspectRatio: medianAspect,
      boundsAspectSpreadPercent: medianAspect === 0 ? null : ((Math.max(...aspects) - Math.min(...aspects)) / medianAspect) * 100,
    },
    interpretation: {
      automatedGeometryDecision: "not-permitted",
      manualPhysicalReviewRequired: true,
      exactAuthorityCreated: false,
      geometryLocked: false,
      note: "Normalized source-image IoU is diagnostic only. It cannot prove physical dimensions, camera equivalence, or shared tooling.",
    },
    contactSheetPath: path.relative(workspaceRoot, contactSheetPath),
    mutationPolicy: { remoteWritesPerformed: false, currentReleaseChanged: false, sanityChanged: false },
  };
  const outputPath = path.join(groupDir, "silhouette-analysis.json");
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  return { outputPath, contactSheetPath, result };
}

async function main() {
  const index = process.argv.indexOf("--group-key");
  const groupKey = index >= 0 ? process.argv[index + 1] : undefined;
  if (!groupKey) throw new Error("Usage: --group-key <geometry-review-key>");
  const output = await analyzeComponentReferenceSilhouettes(groupKey);
  console.log(JSON.stringify({ outputPath: output.outputPath, contactSheetPath: output.contactSheetPath, comparison: output.result.comparison, interpretation: output.result.interpretation, mutationPolicy: output.result.mutationPolicy }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
