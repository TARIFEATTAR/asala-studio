import { createHash, randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const reportPath = resolve(
  projectRoot,
  "tmp/best-bottles-reference-production/cylinder-blocked-recovery-v1/deep-archive-reconciliation/cylinder-59-strong-semantic-exact-candidates.json",
);
const outputRoot = resolve(dirname(reportPath), "review-sheets");
const exportsRoot = resolve(outputRoot, "exports");
const minimumPixels = 1_000_000;

type Candidate = {
  targetWebsiteSku: string;
  targetGraceSku: string;
  targetCanonicalIdentityKey: string;
  confidenceClass: string;
  sourcePath: string;
  sourceRelativePath: string;
  sourceSha256: string;
  sourceCompositeWidth: number;
  sourceCompositeHeight: number;
  matchReasons: string[];
  normalizationReasons: string[];
  cautions: string[];
  identityReviewStatus: "pending-human-review";
  promotionStatus: "not-promoted";
};

type CandidateReport = {
  records: Candidate[];
};

type ExportRecord = Candidate & {
  outputPath: string;
  outputRelativePath: string;
  outputSha256: string;
  outputBytes: number;
  pixelCount: number;
  opaque: true;
};

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function normalizedIdentity(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function escapeXml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function runMagick(args: readonly string[]): Promise<Buffer> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn("magick", [...args], { stdio: ["ignore", "pipe", "pipe"] });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`ImageMagick failed (${code ?? "signal"}): ${Buffer.concat(stderr).toString("utf8")}`));
        return;
      }
      resolvePromise(Buffer.concat(stdout));
    });
  });
}

async function exportCandidate(candidate: Candidate): Promise<ExportRecord> {
  const sourceBytes = await readFile(candidate.sourcePath);
  if (sha256(sourceBytes) !== candidate.sourceSha256) {
    throw new Error(`Source hash drift for ${candidate.sourcePath}.`);
  }
  const before = await stat(candidate.sourcePath);
  const filename = `${normalizedIdentity(candidate.targetWebsiteSku)}__${normalizedIdentity(candidate.targetGraceSku)}__${candidate.sourceSha256.slice(0, 12)}.png`;
  const outputPath = resolve(exportsRoot, filename);
  const temporaryPath = `${outputPath}.tmp-${process.pid}-${randomBytes(5).toString("hex")}.png`;
  await mkdir(exportsRoot, { recursive: true });
  try {
    await runMagick([
      `${candidate.sourcePath}[0]`,
      "-alpha", "off",
      "-colorspace", "sRGB",
      "-define", "png:exclude-chunks=date,time",
      `PNG24:${temporaryPath}`,
    ]);
    const metadata = JSON.parse((await runMagick([
      "identify", "-format",
      '{"format":"%m","width":%w,"height":%h,"opaque":"%[opaque]"}',
      temporaryPath,
    ])).toString("utf8")) as { format: string; width: number; height: number; opaque: string };
    if (
      metadata.format !== "PNG"
      || metadata.width !== candidate.sourceCompositeWidth
      || metadata.height !== candidate.sourceCompositeHeight
      || metadata.opaque.toLowerCase() !== "true"
    ) {
      throw new Error(`Invalid native export for ${candidate.targetCanonicalIdentityKey}.`);
    }
    const outputBytes = await readFile(temporaryPath);
    try {
      await writeFile(outputPath, outputBytes, { flag: "wx" });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      if (sha256(await readFile(outputPath)) !== sha256(outputBytes)) {
        throw new Error(`Immutable alias-review export conflict at ${outputPath}.`);
      }
    }
    const after = await stat(candidate.sourcePath);
    if (
      before.size !== after.size
      || before.mtimeMs !== after.mtimeMs
      || sha256(await readFile(candidate.sourcePath)) !== candidate.sourceSha256
    ) {
      throw new Error(`Source changed during export: ${candidate.sourcePath}.`);
    }
    return {
      ...candidate,
      outputPath,
      outputRelativePath: relative(outputRoot, outputPath),
      outputSha256: sha256(outputBytes),
      outputBytes: outputBytes.length,
      pixelCount: metadata.width * metadata.height,
      opaque: true,
    };
  } finally {
    await rm(temporaryPath, { force: true });
  }
}

async function renderSheet(input: {
  records: readonly ExportRecord[];
  path: string;
  title: string;
  subtitle: string;
  status: string;
}): Promise<void> {
  const columns = 4;
  const cardWidth = 560;
  const cardHeight = 760;
  const headerHeight = 150;
  const rows = Math.ceil(input.records.length / columns);
  const overlays: Array<{ input: Buffer; left: number; top: number }> = [{
    input: Buffer.from(`<svg width="${cardWidth * columns}" height="${headerHeight}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#15140f"/><text x="34" y="54" fill="#fff" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="700">${escapeXml(input.title)}</text><text x="34" y="94" fill="#d7d1c2" font-family="Arial, Helvetica, sans-serif" font-size="20">${input.records.length} identities · ${escapeXml(input.subtitle)}</text><text x="34" y="124" fill="#d7d1c2" font-family="Arial, Helvetica, sans-serif" font-size="17">Approve only exact product + closure topology. Reject detached, component-only, ambiguous, or incorrect aliases.</text></svg>`),
    left: 0,
    top: 0,
  }];
  for (let index = 0; index < input.records.length; index += 1) {
    const record = input.records[index];
    const column = index % columns;
    const row = Math.floor(index / columns);
    const left = column * cardWidth;
    const top = headerHeight + row * cardHeight;
    const image = await sharp(record.outputPath, { failOn: "error" }).resize({
      width: cardWidth - 40,
      height: 570,
      fit: "contain",
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    }).png().toBuffer();
    const cautions = record.cautions.length > 0 ? record.cautions.join(", ") : "none";
    const label = Buffer.from(`<svg width="${cardWidth}" height="${cardHeight}" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="1" width="${cardWidth - 2}" height="${cardHeight - 2}" fill="none" stroke="#c7c1b4" stroke-width="2"/><rect x="0" y="590" width="${cardWidth}" height="170" fill="#f5f3ed"/><text x="20" y="622" fill="#171612" font-family="Arial, Helvetica, sans-serif" font-size="21" font-weight="700">${escapeXml(record.targetWebsiteSku)}</text><text x="20" y="650" fill="#4f4a3f" font-family="Arial, Helvetica, sans-serif" font-size="14">${escapeXml(record.targetGraceSku)}</text><text x="20" y="677" fill="#171612" font-family="Arial, Helvetica, sans-serif" font-size="14">${record.sourceCompositeWidth} × ${record.sourceCompositeHeight}px · ${escapeXml(basename(record.sourceRelativePath))}</text><text x="20" y="705" fill="#8b5a00" font-family="Arial, Helvetica, sans-serif" font-size="14" font-weight="700">${escapeXml(input.status)}</text><text x="20" y="730" fill="#514d43" font-family="Arial, Helvetica, sans-serif" font-size="12">${escapeXml(cautions.slice(0, 72))}</text><text x="20" y="750" fill="#514d43" font-family="Arial, Helvetica, sans-serif" font-size="12">Approve / reject exact legacy alias</text></svg>`);
    overlays.push({ input: image, left: left + 20, top: top + 12 }, { input: label, left, top });
  }
  await sharp({
    create: {
      width: cardWidth * columns,
      height: headerHeight + rows * cardHeight,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  }).composite(overlays).png().toFile(input.path);
}

async function main(): Promise<void> {
  const reportBytes = await readFile(reportPath);
  const report = JSON.parse(reportBytes.toString("utf8")) as CandidateReport;
  if (report.records.length !== 59) throw new Error(`Expected 59 semantic-exact candidates; got ${report.records.length}.`);
  const exports: ExportRecord[] = [];
  for (const candidate of report.records) exports.push(await exportCandidate(candidate));
  const highResolution = exports.filter((record) => record.pixelCount >= minimumPixels);
  const lowResolution = exports.filter((record) => record.pixelCount < minimumPixels);
  if (highResolution.length !== 27 || lowResolution.length !== 32) {
    throw new Error(`Unexpected alias resolution partition ${highResolution.length}/${lowResolution.length}.`);
  }
  await mkdir(outputRoot, { recursive: true });
  await Promise.all([
    renderSheet({
      records: highResolution,
      path: resolve(outputRoot, "cylinder-legacy-alias-high-resolution-review-sheet.png"),
      title: "CYLINDER RECOVERY · LEGACY-ALIAS HIGH-RES CANDIDATES",
      subtitle: "semantic-exact filenames · pending human review · not promoted",
      status: "ALIAS REVIEW REQUIRED · NOT PROMOTED",
    }),
    renderSheet({
      records: lowResolution,
      path: resolve(outputRoot, "cylinder-legacy-alias-low-resolution-review-sheet.png"),
      title: "CYLINDER RECOVERY · LEGACY-ALIAS LOW-RES CANDIDATES",
      subtitle: "identity can be reviewed; resolution blocker remains · not promoted",
      status: "ALIAS + RESOLUTION BLOCKED",
    }),
    writeFile(resolve(outputRoot, "cylinder-semantic-alias-review-manifest.json"), `${JSON.stringify({
      version: "best-bottles-cylinder-semantic-alias-review-v1",
      reportPath: relative(projectRoot, reportPath),
      reportSha256: sha256(reportBytes),
      minimumPixels,
      summary: {
        candidateCount: exports.length,
        highResolutionCount: highResolution.length,
        lowResolutionCount: lowResolution.length,
        approvedCount: 0,
        promotedCount: 0,
        externalWriteCount: 0,
      },
      exports,
    }, null, 2)}\n`),
  ]);
  process.stdout.write(`${JSON.stringify({
    outputRoot,
    candidateCount: exports.length,
    highResolutionCount: highResolution.length,
    lowResolutionCount: lowResolution.length,
    approvedCount: 0,
    promotedCount: 0,
    externalWriteCount: 0,
  }, null, 2)}\n`);
}

await main();
