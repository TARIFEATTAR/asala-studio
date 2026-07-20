import { createHash, randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import {
  buildCylinderBlockedRecoveryQueue,
  type CylinderBlockedReadinessRow,
  type CylinderBlockedRecoveryCandidate,
  type CylinderPsdRecoveryRecord,
} from "../../src/lib/bestBottlesCylinderBlockedRecovery";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const readinessPath = resolve(projectRoot, "public/data/best-bottles-cylinder-production-readiness.json");
const identityJoinPath = resolve(
  projectRoot,
  "tmp/best-bottles-reference-production/psd-cap-state-audit-v1/identity-join.json",
);
const outputRoot = resolve(
  projectRoot,
  "tmp/best-bottles-reference-production/cylinder-blocked-recovery-v1",
);
const exportsRoot = resolve(outputRoot, "review-candidates");

type ReadinessArtifact = {
  minimumReferencePixels: number;
  rows: Array<CylinderBlockedReadinessRow | { status: "production-qualified" }>;
};

type ExportRecord = {
  canonicalIdentityKey: string;
  websiteSku: string;
  graceSku: string;
  sourcePath: string;
  sourceRelativePath: string;
  sourceSha256: string;
  outputPath: string;
  outputRelativePath: string;
  outputSha256: string;
  outputBytes: number;
  width: number;
  height: number;
  opaque: true;
  recoveryStatus: "exact-high-resolution-pending-review" | "exact-low-resolution-only";
  reviewState: "pending-human-review";
  promotionState: "blocked-not-promoted";
};

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function normalizedIdentity(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
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

async function verifyPng(path: string, expected: CylinderBlockedRecoveryCandidate): Promise<void> {
  const raw = await runMagick([
    "identify",
    "-format",
    '{"format":"%m","width":%w,"height":%h,"opaque":"%[opaque]"}',
    path,
  ]);
  const metadata = JSON.parse(raw.toString("utf8")) as {
    format: string;
    width: number;
    height: number;
    opaque: string;
  };
  if (
    metadata.format !== "PNG"
    || metadata.width !== expected.width
    || metadata.height !== expected.height
    || metadata.opaque.toLowerCase() !== "true"
  ) {
    throw new Error(`Invalid recovery export ${path}: ${raw.toString("utf8")}.`);
  }
}

async function exportCandidate(input: {
  canonicalIdentityKey: string;
  websiteSku: string;
  graceSku: string;
  candidate: CylinderBlockedRecoveryCandidate;
  recoveryStatus: ExportRecord["recoveryStatus"];
}): Promise<ExportRecord> {
  const sourceBefore = await readFile(input.candidate.sourcePath);
  if (sha256(sourceBefore) !== input.candidate.sourceSha256) {
    throw new Error(`PSD hash drift for ${input.candidate.sourcePath}.`);
  }
  const sourceStatBefore = await stat(input.candidate.sourcePath);
  const filename = `${normalizedIdentity(input.websiteSku)}__${normalizedIdentity(input.graceSku)}__${input.candidate.sourceSha256.slice(0, 12)}.png`;
  const outputPath = resolve(exportsRoot, filename);
  const temporaryPath = `${outputPath}.tmp-${process.pid}-${randomBytes(5).toString("hex")}.png`;
  await mkdir(exportsRoot, { recursive: true });
  try {
    await runMagick([
      `${input.candidate.sourcePath}[0]`,
      "-alpha", "off",
      "-colorspace", "sRGB",
      "-define", "png:exclude-chunks=date,time",
      `PNG24:${temporaryPath}`,
    ]);
    await verifyPng(temporaryPath, input.candidate);
    const bytes = await readFile(temporaryPath);
    try {
      await writeFile(outputPath, bytes, { flag: "wx" });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      const existing = await readFile(outputPath);
      if (sha256(existing) !== sha256(bytes)) {
        throw new Error(`Immutable recovery export conflict at ${outputPath}.`);
      }
    }
    const sourceStatAfter = await stat(input.candidate.sourcePath);
    if (
      sourceStatBefore.size !== sourceStatAfter.size
      || sourceStatBefore.mtimeMs !== sourceStatAfter.mtimeMs
      || sha256(await readFile(input.candidate.sourcePath)) !== input.candidate.sourceSha256
    ) {
      throw new Error(`PSD changed during recovery export: ${input.candidate.sourcePath}.`);
    }
    return {
      canonicalIdentityKey: input.canonicalIdentityKey,
      websiteSku: input.websiteSku,
      graceSku: input.graceSku,
      sourcePath: input.candidate.sourcePath,
      sourceRelativePath: input.candidate.sourceRelativePath,
      sourceSha256: input.candidate.sourceSha256,
      outputPath,
      outputRelativePath: relative(outputRoot, outputPath),
      outputSha256: sha256(bytes),
      outputBytes: bytes.length,
      width: input.candidate.width,
      height: input.candidate.height,
      opaque: true,
      recoveryStatus: input.recoveryStatus,
      reviewState: "pending-human-review",
      promotionState: "blocked-not-promoted",
    };
  } finally {
    await rm(temporaryPath, { force: true });
  }
}

function renderHtml(input: {
  recovery: ReturnType<typeof buildCylinderBlockedRecoveryQueue>;
  exports: readonly ExportRecord[];
}): string {
  const exportByIdentity = new Map(input.exports.map((record) => [record.canonicalIdentityKey, record]));
  const reviewCards = input.recovery.rows
    .filter((row) => row.recoveryStatus === "exact-high-resolution-pending-review")
    .map((row) => {
      const exported = exportByIdentity.get(row.canonicalIdentityKey);
      if (!exported) throw new Error(`Missing review export for ${row.canonicalIdentityKey}.`);
      return `<article class="card">
  <div class="image"><img src="${escapeHtml(exported.outputRelativePath)}" alt="${escapeHtml(row.websiteSku)}"></div>
  <div class="copy">
    <div class="badge">PENDING HUMAN REVIEW · NOT PROMOTED</div>
    <h2>${escapeHtml(row.websiteSku)}</h2>
    <p class="grace">${escapeHtml(row.graceSku)}</p>
    <dl><dt>Native composite</dt><dd>${exported.width} × ${exported.height}px</dd><dt>PSD</dt><dd>${escapeHtml(exported.sourceRelativePath)}</dd><dt>PSD SHA-256</dt><dd><code>${exported.sourceSha256}</code></dd></dl>
    <p><strong>Verify:</strong> exact product identity, assembled cap-on state, correct applicator/closure, no detached components, and no sibling substitution.</p>
  </div>
</article>`;
    }).join("\n");
  const blockedRows = input.recovery.rows
    .filter((row) => row.recoveryStatus !== "exact-high-resolution-pending-review")
    .map((row) => `<tr><td>${escapeHtml(row.websiteSku)}</td><td>${escapeHtml(row.graceSku)}</td><td>${escapeHtml(row.recoveryStatus)}</td><td>${escapeHtml(row.blockers.join(", "))}</td><td>${row.candidates.length}</td></tr>`)
    .join("\n");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Cylinder blocked-reference recovery</title>
<style>
:root{font-family:Inter,ui-sans-serif,system-ui,sans-serif;color:#171612;background:#111}body{margin:0}.shell{max-width:1500px;margin:auto;padding:36px}.hero{color:#fff;margin-bottom:28px}.hero h1{font-size:38px;margin:0 0 10px}.hero p{max-width:980px;color:#c9c6bd}.stats{display:flex;gap:12px;flex-wrap:wrap}.stat{background:#24221c;border:1px solid #48443a;border-radius:10px;padding:10px 14px}.card{display:grid;grid-template-columns:minmax(300px,42%) 1fr;background:#f5f3ed;border-radius:18px;overflow:hidden;margin:18px 0}.image{min-height:520px;background:white;display:flex;align-items:center;justify-content:center;padding:24px}.image img{max-width:100%;max-height:650px;object-fit:contain}.copy{padding:36px}.copy h2{font-size:30px;margin:14px 0 4px}.grace{color:#4f4a3f}.badge{display:inline-block;background:#fff0cb;color:#6e4800;border:1px solid #e7ba50;border-radius:999px;padding:7px 10px;font-size:12px;font-weight:750}dl{display:grid;grid-template-columns:140px 1fr;gap:8px 16px;margin:28px 0}dt{font-weight:700}dd{margin:0;overflow-wrap:anywhere}code{font-size:11px}.blocked{background:#f5f3ed;border-radius:18px;padding:28px;margin-top:28px;overflow:auto}table{width:100%;border-collapse:collapse;font-size:13px}th,td{text-align:left;padding:10px;border-bottom:1px solid #d8d3c8}th{position:sticky;top:0;background:#f5f3ed}</style></head>
<body><main class="shell"><header class="hero"><h1>Cylinder blocked-reference recovery</h1><p>This cohort is local review evidence only. Nothing shown here is approved or promoted. Exact high-resolution PSD composites are exported at native size with their original opaque background; all other identities remain explicitly blocked.</p><div class="stats"><div class="stat">${input.recovery.summary.blockedIdentityCount} blocked identities</div><div class="stat">${input.recovery.summary.exactHighResolutionPendingReviewCount} exact high-res pending review</div><div class="stat">${input.recovery.summary.exactLowResolutionOnlyCount} low-res only</div><div class="stat">${input.recovery.summary.noExactPsdCandidateCount} no exact PSD match</div><div class="stat">0 promotable now</div></div></header>
<section>${reviewCards}</section><section class="blocked"><h2>Source-evidence blockers retained</h2><table><thead><tr><th>Website SKU</th><th>Grace SKU</th><th>Recovery state</th><th>Existing blockers</th><th>Exact PSD candidates</th></tr></thead><tbody>${blockedRows}</tbody></table></section></main></body></html>`;
}

async function renderBulkReviewSheet(input: {
  exports: readonly ExportRecord[];
  outputPath: string;
  title: string;
  subtitle: string;
  statusLabel: string;
}): Promise<void> {
  const exports = input.exports;
  const columns = 4;
  const cardWidth = 560;
  const cardHeight = 760;
  const headerHeight = 150;
  const rows = Math.ceil(exports.length / columns);
  const overlays: Array<{ input: Buffer; left: number; top: number }> = [];
  const header = Buffer.from(`<svg width="${cardWidth * columns}" height="${headerHeight}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#15140f"/>
    <text x="34" y="54" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="700">${escapeHtml(input.title)}</text>
    <text x="34" y="94" fill="#d7d1c2" font-family="Arial, Helvetica, sans-serif" font-size="20">${exports.length} identities · ${escapeHtml(input.subtitle)}</text>
    <text x="34" y="124" fill="#d7d1c2" font-family="Arial, Helvetica, sans-serif" font-size="17">Approve only when the image is the exact assembled product. Reject detached, component-only, ambiguous, or sibling references.</text>
  </svg>`);
  overlays.push({ input: header, left: 0, top: 0 });
  for (let index = 0; index < exports.length; index += 1) {
    const record = exports[index];
    const column = index % columns;
    const row = Math.floor(index / columns);
    const left = column * cardWidth;
    const top = headerHeight + row * cardHeight;
    const image = await sharp(record.outputPath, { failOn: "error" })
      .resize({
        width: cardWidth - 40,
        height: 570,
        fit: "contain",
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      })
      .png()
      .toBuffer();
    const label = Buffer.from(`<svg width="${cardWidth}" height="${cardHeight}" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="${cardWidth - 2}" height="${cardHeight - 2}" fill="none" stroke="#c7c1b4" stroke-width="2"/>
      <rect x="0" y="590" width="${cardWidth}" height="170" fill="#f5f3ed"/>
      <text x="20" y="624" fill="#171612" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700">${escapeHtml(record.websiteSku)}</text>
      <text x="20" y="654" fill="#4f4a3f" font-family="Arial, Helvetica, sans-serif" font-size="15">${escapeHtml(record.graceSku)}</text>
      <text x="20" y="683" fill="#171612" font-family="Arial, Helvetica, sans-serif" font-size="15">${record.width} × ${record.height}px · ${escapeHtml(basename(record.sourceRelativePath))}</text>
      <text x="20" y="714" fill="#8b5a00" font-family="Arial, Helvetica, sans-serif" font-size="14" font-weight="700">${escapeHtml(input.statusLabel)}</text>
      <text x="20" y="741" fill="#514d43" font-family="Arial, Helvetica, sans-serif" font-size="13">Approve / reject by exact Website + Grace SKU</text>
    </svg>`);
    overlays.push(
      { input: image, left: left + 20, top: top + 12 },
      { input: label, left, top },
    );
  }
  await sharp({
    create: {
      width: cardWidth * columns,
      height: headerHeight + rows * cardHeight,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  }).composite(overlays).png().toFile(input.outputPath);
}

async function main(): Promise<void> {
  const [readinessBytes, identityJoinBytes] = await Promise.all([
    readFile(readinessPath),
    readFile(identityJoinPath),
  ]);
  const readiness = JSON.parse(readinessBytes.toString("utf8")) as ReadinessArtifact;
  const psdRecords = JSON.parse(identityJoinBytes.toString("utf8")) as CylinderPsdRecoveryRecord[];
  const blockedRows = readiness.rows.filter((row): row is CylinderBlockedReadinessRow => row.status === "blocked");
  const recovery = buildCylinderBlockedRecoveryQueue({
    blockedRows,
    psdRecords,
    minimumPixels: readiness.minimumReferencePixels,
  });
  if (
    recovery.summary.blockedIdentityCount !== 158
    || recovery.summary.exactHighResolutionPendingReviewCount !== 16
    || recovery.summary.exactLowResolutionOnlyCount !== 31
    || recovery.summary.noExactPsdCandidateCount !== 111
    || recovery.summary.promotableNowCount !== 0
  ) {
    throw new Error(`Unexpected Cylinder blocked-recovery partition: ${JSON.stringify(recovery.summary)}.`);
  }
  const exports: ExportRecord[] = [];
  for (const row of recovery.rows) {
    if (row.recoveryStatus === "no-exact-psd-candidate" || row.selectedCandidate === null) continue;
    exports.push(await exportCandidate({
      canonicalIdentityKey: row.canonicalIdentityKey,
      websiteSku: row.websiteSku,
      graceSku: row.graceSku,
      candidate: row.selectedCandidate,
      recoveryStatus: row.recoveryStatus,
    }));
  }
  await mkdir(outputRoot, { recursive: true });
  const artifact = {
    ...recovery,
    provenance: {
      readinessPath: relative(projectRoot, readinessPath),
      readinessSha256: sha256(readinessBytes),
      identityJoinPath: relative(projectRoot, identityJoinPath),
      identityJoinSha256: sha256(identityJoinBytes),
      externalWriteCount: 0,
    },
    reviewExports: exports,
  };
  await Promise.all([
    writeFile(resolve(outputRoot, "cylinder-blocked-recovery.json"), `${JSON.stringify(artifact, null, 2)}\n`),
    writeFile(resolve(outputRoot, "index.html"), renderHtml({ recovery, exports })),
    renderBulkReviewSheet({
      exports: exports.filter((record) => record.recoveryStatus === "exact-high-resolution-pending-review"),
      outputPath: resolve(outputRoot, "cylinder-high-resolution-recovery-review-sheet.png"),
      title: "CYLINDER RECOVERY · EXACT HIGH-RES PSD CANDIDATES",
      subtitle: "pending identity/cap-state review · not promoted",
      statusLabel: "PENDING REVIEW · NOT PROMOTED",
    }),
    renderBulkReviewSheet({
      exports: exports.filter((record) => record.recoveryStatus === "exact-low-resolution-only"),
      outputPath: resolve(outputRoot, "cylinder-low-resolution-exact-reference-review-sheet.png"),
      title: "CYLINDER RECOVERY · EXACT LOW-RES PSD REFERENCES",
      subtitle: "identity can be reviewed, resolution blocker remains · not promoted",
      statusLabel: "LOW RESOLUTION · NOT PROMOTED",
    }),
  ]);
  process.stdout.write(`${JSON.stringify({
    outputRoot,
    summary: recovery.summary,
    reviewExportCount: exports.length,
    externalWriteCount: 0,
  }, null, 2)}\n`);
}

await main();
