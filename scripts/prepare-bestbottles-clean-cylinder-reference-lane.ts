#!/usr/bin/env tsx
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import sharp from "sharp";

type SourceKind = "raw-extracted" | "paper-doll-output";
type ImageKind = "body" | "cap" | "fitment" | "sprayer" | "composite" | "diagnostic" | "unknown";
type Lane =
  | "selected-originals"
  | "source-evidence"
  | "needs-centering-review"
  | "quarantine-backup-preview-debug";

interface SourceRoot {
  label: string;
  kind: SourceKind;
  root: string;
}

interface GeometryBox {
  left: number | null;
  top: number | null;
  right: number | null;
  bottom: number | null;
  width: number;
  height: number;
}

interface ImageInspection {
  width: number;
  height: number;
  channels: number;
  hasAlpha: boolean;
  transparentPct: number;
  foregroundPct: number;
  foregroundBox: GeometryBox;
  centerDeltaX: number | null;
  centerDeltaXPct: number | null;
  baselineFromBottomPct: number | null;
  touchesEdge: boolean;
}

interface AuditRow extends ImageInspection {
  sourceLabel: string;
  sourceKind: SourceKind;
  sourcePath: string;
  relativePath: string;
  fileName: string;
  imageKind: ImageKind;
  lane: Lane;
  targetPath: string;
  copied: boolean;
  issues: string[];
}

interface AuditPayload {
  generatedAt: string;
  dryRun: boolean;
  capacity: string;
  sourceRoots: SourceRoot[];
  cleanRoot: string;
  policy: {
    action: string;
    selectedOriginals: string;
    sourceEvidence: string;
    needsCenteringReview: string;
    quarantine: string;
    nextFolder: string;
  };
  summary: Record<Lane | "total" | "copied", number>;
  rows: AuditRow[];
}

const BEST_BOTTLES_REPO =
  "/Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Website-02-20-2026";
const PAPER_DOLL_ROOT = path.join(BEST_BOTTLES_REPO, "pipeline/paper-doll");
const DEFAULT_CLEAN_ROOT = path.join(
  BEST_BOTTLES_REPO,
  "pipeline/best-bottles-clean-reference-lane/cylinder",
);
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);
const CAPACITY_TO_FOLDER: Record<string, string> = {
  "5ml": "CYL-5ML",
  "9ml": "CYL-9ML",
  "tall-9ml": "TALLCYL-9ML",
};

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function getArg(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  if (index < 0) return fallback;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) return fallback;
  return value;
}

function safeSegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96) || "unknown";
}

function csvEscape(value: unknown): string {
  if (value == null) return "";
  const text = Array.isArray(value) ? value.join("; ") : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function walkImages(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const filePath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(filePath);
      } else if (entry.isFile() && IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        out.push(filePath);
      }
    }
  };
  walk(root);
  return out.sort((a, b) => a.localeCompare(b));
}

function inferImageKind(relativePath: string): ImageKind {
  const text = relativePath.toLowerCase();
  if (text.includes("_preview") || text.includes("_lineup") || text.includes("alignment-grid")) return "diagnostic";
  if (text.includes("/composites/") || text.startsWith("composites/") || path.basename(text).startsWith("comp-")) return "composite";
  if (text.includes("/bottles/") || text.startsWith("bottles/") || text.includes("-body")) return "body";
  if (text.includes("/caps/") || text.startsWith("caps/") || text.includes("-cap")) return "cap";
  if (text.includes("/fitments/") || text.startsWith("fitments/") || text.includes("-fitment")) return "fitment";
  if (text.includes("/sprayers/") || text.startsWith("sprayers/") || text.includes("-sprayer")) return "sprayer";
  return "unknown";
}

function isBackupPreviewOrDebug(relativePath: string): boolean {
  const text = relativePath.toLowerCase();
  return (
    text.includes("/_backups/") ||
    text.includes("backup") ||
    text.includes("_preview") ||
    text.includes("_lineup") ||
    text.includes("_unnamed") ||
    text.includes("alignment-grid") ||
    text.includes("-layer-") ||
    text.includes("/layers/")
  );
}

function inferLane(params: {
  sourceKind: SourceKind;
  imageKind: ImageKind;
  relativePath: string;
  inspection: ImageInspection;
}): { lane: Lane; issues: string[] } {
  const issues: string[] = [];
  if (isBackupPreviewOrDebug(params.relativePath) || params.imageKind === "diagnostic") {
    issues.push("Backup, preview, lineup, layer, or alignment/debug artifact.");
    return { lane: "quarantine-backup-preview-debug", issues };
  }

  const lacksMeaningfulTransparency = !params.inspection.hasAlpha || params.inspection.transparentPct < 0.02;
  if (lacksMeaningfulTransparency) {
    issues.push("No meaningful transparency; keep as source evidence, not Madison import-ready PNG.");
  }

  if (params.inspection.touchesEdge) {
    issues.push("Foreground touches the canvas edge; inspect for crop damage.");
  }

  const centerDeltaXPct = Math.abs(params.inspection.centerDeltaXPct ?? 0);
  if (centerDeltaXPct > 0.08) {
    issues.push(`Foreground center is ${(centerDeltaXPct * 100).toFixed(1)}% off the canvas center.`);
    return { lane: "needs-centering-review", issues };
  }

  if (params.sourceKind === "raw-extracted" || lacksMeaningfulTransparency) {
    return { lane: "source-evidence", issues };
  }

  if (params.imageKind === "body" || params.imageKind === "cap" || params.imageKind === "fitment" || params.imageKind === "sprayer" || params.imageKind === "composite") {
    return { lane: "selected-originals", issues };
  }

  issues.push("Unknown image role; inspect before using.");
  return { lane: "needs-centering-review", issues };
}

function getCornerSamples(data: Buffer, info: sharp.OutputInfo): number[][] {
  const samples: number[][] = [];
  const sampleSize = Math.min(10, Math.floor(info.width / 2), Math.floor(info.height / 2));
  const addRegion = (x0: number, y0: number): void => {
    for (let y = y0; y < y0 + sampleSize; y += 1) {
      for (let x = x0; x < x0 + sampleSize; x += 1) {
        const index = (y * info.width + x) * info.channels;
        samples.push([data[index] ?? 0, data[index + 1] ?? 0, data[index + 2] ?? 0]);
      }
    }
  };
  addRegion(0, 0);
  addRegion(info.width - sampleSize, 0);
  addRegion(0, info.height - sampleSize);
  addRegion(info.width - sampleSize, info.height - sampleSize);
  return samples;
}

function averageColor(samples: number[][]): [number, number, number] {
  if (samples.length === 0) return [255, 255, 255];
  const sum = samples.reduce<[number, number, number]>(
    (acc, sample) => [acc[0] + sample[0], acc[1] + sample[1], acc[2] + sample[2]],
    [0, 0, 0],
  );
  return [sum[0] / samples.length, sum[1] / samples.length, sum[2] / samples.length];
}

function colorDistance(a: [number, number, number], b: [number, number, number]): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

async function inspectImage(filePath: string): Promise<ImageInspection> {
  const metadata = await sharp(filePath, { animated: false }).metadata();
  const { data, info } = await sharp(filePath, { animated: false })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const hasAlpha = Boolean(metadata.hasAlpha);
  const totalPixels = info.width * info.height;
  const bgColor = averageColor(getCornerSamples(data, info));
  let transparentPixels = 0;
  let foregroundPixels = 0;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const index = (y * info.width + x) * info.channels;
      const alpha = data[index + 3] ?? 255;
      if (alpha <= 8) transparentPixels += 1;
      const isForeground = hasAlpha && transparentPixels > -1
        ? alpha > 8
        : colorDistance([data[index] ?? 0, data[index + 1] ?? 0, data[index + 2] ?? 0], bgColor) > 34;
      if (!isForeground) continue;
      foregroundPixels += 1;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  const hasForeground = foregroundPixels > 0;
  const box: GeometryBox = hasForeground
    ? {
        left: minX,
        top: minY,
        right: maxX,
        bottom: maxY,
        width: maxX - minX + 1,
        height: maxY - minY + 1,
      }
    : { left: null, top: null, right: null, bottom: null, width: 0, height: 0 };
  const centerX = box.left == null || box.right == null ? null : (box.left + box.right) / 2;
  const centerDeltaX = centerX == null ? null : centerX - info.width / 2;
  const centerDeltaXPct = centerDeltaX == null ? null : centerDeltaX / info.width;
  const baselineFromBottomPct = box.bottom == null ? null : (info.height - box.bottom - 1) / info.height;
  const touchesEdge =
    box.left != null &&
    box.top != null &&
    box.right != null &&
    box.bottom != null &&
    (box.left <= 0 || box.top <= 0 || box.right >= info.width - 1 || box.bottom >= info.height - 1);

  return {
    width: info.width,
    height: info.height,
    channels: info.channels,
    hasAlpha,
    transparentPct: Number((transparentPixels / totalPixels).toFixed(4)),
    foregroundPct: Number((foregroundPixels / totalPixels).toFixed(4)),
    foregroundBox: box,
    centerDeltaX: centerDeltaX == null ? null : Number(centerDeltaX.toFixed(2)),
    centerDeltaXPct: centerDeltaXPct == null ? null : Number(centerDeltaXPct.toFixed(4)),
    baselineFromBottomPct: baselineFromBottomPct == null ? null : Number(baselineFromBottomPct.toFixed(4)),
    touchesEdge,
  };
}

function targetPathFor(params: {
  cleanRoot: string;
  capacity: string;
  lane: Lane;
  sourceLabel: string;
  imageKind: ImageKind;
  relativePath: string;
}): string {
  const fileName = path.basename(params.relativePath);
  const sourceSegment = safeSegment(params.sourceLabel);
  if (params.lane === "selected-originals") {
    return path.join(params.cleanRoot, "01-selected-originals", params.capacity, params.imageKind, fileName);
  }
  if (params.lane === "source-evidence") {
    return path.join(params.cleanRoot, "00-source-audit", "source-evidence", params.capacity, sourceSegment, params.imageKind, fileName);
  }
  if (params.lane === "needs-centering-review") {
    return path.join(params.cleanRoot, "03-quarantine", params.capacity, "needs-centering-review", sourceSegment, params.imageKind, fileName);
  }
  return path.join(params.cleanRoot, "03-quarantine", params.capacity, "backup-preview-debug", sourceSegment, params.imageKind, fileName);
}

function toCsv(rows: AuditRow[]): string {
  const headers: Array<keyof AuditRow | "boxLeft" | "boxTop" | "boxRight" | "boxBottom" | "boxWidth" | "boxHeight"> = [
    "lane",
    "imageKind",
    "fileName",
    "sourceLabel",
    "relativePath",
    "width",
    "height",
    "hasAlpha",
    "transparentPct",
    "foregroundPct",
    "boxLeft",
    "boxTop",
    "boxRight",
    "boxBottom",
    "boxWidth",
    "boxHeight",
    "centerDeltaX",
    "centerDeltaXPct",
    "baselineFromBottomPct",
    "touchesEdge",
    "copied",
    "issues",
    "sourcePath",
    "targetPath",
  ];
  const valueFor = (row: AuditRow, header: (typeof headers)[number]): unknown => {
    if (header === "boxLeft") return row.foregroundBox.left;
    if (header === "boxTop") return row.foregroundBox.top;
    if (header === "boxRight") return row.foregroundBox.right;
    if (header === "boxBottom") return row.foregroundBox.bottom;
    if (header === "boxWidth") return row.foregroundBox.width;
    if (header === "boxHeight") return row.foregroundBox.height;
    return row[header];
  };
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(valueFor(row, header))).join(",")),
  ].join("\n");
}

function summarize(rows: AuditRow[]): AuditPayload["summary"] {
  return {
    total: rows.length,
    copied: rows.filter((row) => row.copied).length,
    "selected-originals": rows.filter((row) => row.lane === "selected-originals").length,
    "source-evidence": rows.filter((row) => row.lane === "source-evidence").length,
    "needs-centering-review": rows.filter((row) => row.lane === "needs-centering-review").length,
    "quarantine-backup-preview-debug": rows.filter((row) => row.lane === "quarantine-backup-preview-debug").length,
  };
}

function assertSafeResetRoot(cleanRoot: string): void {
  const resolved = path.resolve(cleanRoot);
  const expectedSuffix = path.join("pipeline", "best-bottles-clean-reference-lane", "cylinder");
  if (!resolved.endsWith(expectedSuffix)) {
    throw new Error(`Refusing to reset unexpected clean root: ${resolved}`);
  }
  if (!resolved.startsWith(path.resolve(BEST_BOTTLES_REPO))) {
    throw new Error(`Refusing to reset outside Best Bottles repo: ${resolved}`);
  }
}

function resetCapacityLane(cleanRoot: string, capacity: string): void {
  assertSafeResetRoot(cleanRoot);
  const generatedPaths = [
    path.join(cleanRoot, "00-source-audit", `${capacity}-manifest.json`),
    path.join(cleanRoot, "00-source-audit", `${capacity}-manifest.csv`),
    path.join(cleanRoot, "00-source-audit", "source-evidence", capacity),
    path.join(cleanRoot, "01-selected-originals", capacity),
    path.join(cleanRoot, "02-normalized-transparent", capacity),
    path.join(cleanRoot, "03-quarantine", capacity),
    path.join(cleanRoot, "04-madison-import-ready", capacity),
  ];
  for (const generatedPath of generatedPaths) {
    fs.rmSync(generatedPath, { recursive: true, force: true });
  }
}

function buildReadme(payload: AuditPayload): string {
  return `# Best Bottles Clean Cylinder Reference Lane

Generated: ${payload.generatedAt}
Mode: ${payload.dryRun ? "dry run" : "apply"}
Capacity: ${payload.capacity}
Clean root: \`${payload.cleanRoot}\`

## What This Folder Is

This is a safe, copy-only staging lane for cleaning up Cylinder references before Madison Studio import and new generation. It does not replace, delete, or mutate the old paper-doll folders.

## Folder Contract

- \`00-source-audit/\`: manifests and source evidence. Use this to understand where a file came from.
- \`01-selected-originals/\`: current best candidate originals copied from the paper-doll output folders.
- \`02-normalized-transparent/\`: intentionally empty for now; this is where recentered, background-removed, Convex/Grace-SKU-named reference PNGs should land next.
- \`03-quarantine/\`: previews, backups, debug images, and files whose foreground appears materially off center.
- \`04-madison-import-ready/\`: intentionally empty for now; only final transparent identity references should be copied here after naming and QA.

## Summary

- Total audited images: ${payload.summary.total}
- Copied this run: ${payload.summary.copied}
- Selected originals: ${payload.summary["selected-originals"]}
- Source evidence: ${payload.summary["source-evidence"]}
- Needs centering review: ${payload.summary["needs-centering-review"]}
- Quarantined preview/debug/backup files: ${payload.summary["quarantine-backup-preview-debug"]}

## Guardrails

- Do not import \`01-selected-originals\` directly into Madison as final references until the file has been renamed to the exact Convex/Grace SKU and checked for alpha quality.
- Do not use flattened RGB cutouts as transparent references; glass edges and soft pixels can get destroyed.
- Cap state has only two states: \`cap-on\` and \`cap-off\`. \`cap-off\` means the cap appears beside the bottle.
- The final PDP generated master remains a separate 2080 x 2288 image. These PNGs are identity references, not final PDP images.
`;
}

async function main(): Promise<void> {
  const apply = hasFlag("--apply");
  const reset = hasFlag("--reset-clean-lane");
  const capacity = safeSegment(getArg("--capacity", "5ml"));
  const folderName = CAPACITY_TO_FOLDER[capacity];
  if (!folderName) {
    throw new Error(`Unsupported capacity "${capacity}". Use one of: ${Object.keys(CAPACITY_TO_FOLDER).join(", ")}`);
  }

  const cleanRoot = path.resolve(getArg("--clean-root", DEFAULT_CLEAN_ROOT));
  if (apply && reset && fs.existsSync(cleanRoot)) {
    resetCapacityLane(cleanRoot, capacity);
  }
  const sourceRoots: SourceRoot[] = [
    {
      label: `processing-01-extracted-${folderName}`,
      kind: "raw-extracted",
      root: path.join(PAPER_DOLL_ROOT, "processing/01-extracted", folderName),
    },
    {
      label: `paper-doll-output-${folderName}`,
      kind: "paper-doll-output",
      root: path.join(PAPER_DOLL_ROOT, "output", folderName),
    },
  ];

  const rows: AuditRow[] = [];
  for (const source of sourceRoots) {
    for (const sourcePath of walkImages(source.root)) {
      const relativePath = path.relative(source.root, sourcePath);
      const imageKind = inferImageKind(relativePath);
      const inspection = await inspectImage(sourcePath);
      const { lane, issues } = inferLane({
        sourceKind: source.kind,
        imageKind,
        relativePath,
        inspection,
      });
      const targetPath = targetPathFor({
        cleanRoot,
        capacity,
        lane,
        sourceLabel: source.label,
        imageKind,
        relativePath,
      });
      let copied = false;
      if (apply) {
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        fs.copyFileSync(sourcePath, targetPath);
        copied = true;
      }
      rows.push({
        ...inspection,
        sourceLabel: source.label,
        sourceKind: source.kind,
        sourcePath,
        relativePath,
        fileName: path.basename(sourcePath),
        imageKind,
        lane,
        targetPath,
        copied,
        issues,
      });
    }
  }

  const payload: AuditPayload = {
    generatedAt: new Date().toISOString(),
    dryRun: !apply,
    capacity,
    sourceRoots,
    cleanRoot,
    policy: {
      action: "Copy only. Never delete or mutate the source folders.",
      selectedOriginals: "Candidate component/composite originals from paper-doll output.",
      sourceEvidence: "Raw extracted files kept for traceability, not direct Madison import.",
      needsCenteringReview: "Foreground center is more than 8% off canvas center or role is unknown.",
      quarantine: "Backups, previews, lineups, layers, and alignment/debug artifacts.",
      nextFolder: "02-normalized-transparent receives recentered, background-removed, Convex/Grace-SKU-named PNGs.",
    },
    summary: summarize(rows),
    rows,
  };

  const auditRoot = path.join(cleanRoot, "00-source-audit");
  if (apply) {
    fs.mkdirSync(path.join(cleanRoot, "02-normalized-transparent", capacity), { recursive: true });
    fs.mkdirSync(path.join(cleanRoot, "04-madison-import-ready", capacity), { recursive: true });
    fs.mkdirSync(auditRoot, { recursive: true });
    fs.writeFileSync(path.join(auditRoot, `${capacity}-manifest.json`), JSON.stringify(payload, null, 2));
    fs.writeFileSync(path.join(auditRoot, `${capacity}-manifest.csv`), toCsv(rows));
    fs.writeFileSync(path.join(cleanRoot, "README.md"), buildReadme(payload));
  }

  console.log(JSON.stringify(payload.summary, null, 2));
  console.log(`${apply ? "Wrote" : "Dry run only"} clean lane: ${cleanRoot}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
