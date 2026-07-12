import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import sharp from "sharp";

import {
  buildCylinderCloseoutLedger,
  type CylinderCloseoutSourceRow,
} from "../../src/lib/bestBottlesCylinderCloseout";
import {
  buildCylinderReferenceManifest,
  classifyCylinderPsdPath,
  type CylinderFlattenedReferenceCandidate,
  type CylinderPsdCandidate,
  type CylinderReferenceDecision,
} from "../../src/lib/bestBottlesCylinderReferenceReadiness";

const root = process.cwd();
const psdInventoryDir =
  process.env.BEST_BOTTLES_PSD_INVENTORY_DIR ??
  "/Users/jordanrichter/Desktop/AI-OS/07 Outputs/best-bottles/2026-07-11-psd-website-csv-coverage-inventory";
const psdArchiveRoot =
  process.env.BEST_BOTTLES_PSD_ARCHIVE_ROOT ??
  "/Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Original-Photoshop-Sources";
const outputDir = path.join(root, "tmp/bestbottles-generation");

interface IntakeRow {
  graceSku: string;
  websiteSku: string;
  family: string;
  referenceSource: string;
  referenceSourcePath: string | null;
  referenceSourceUrl: string | null;
  liveReferenceUrl: string | null;
}

function parseCsv(text: string): Array<Record<string, string>> {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      record.push(field);
      field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      record.push(field);
      if (record.some(Boolean)) records.push(record);
      record = [];
      field = "";
    } else {
      field += character;
    }
  }
  if (field || record.length > 0) {
    record.push(field);
    records.push(record);
  }
  const [headers = [], ...rows] = records;
  return rows.map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])),
  );
}

function csv(value: string | number | boolean | null): string {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function decisionsCsv(decisions: CylinderReferenceDecision[]): string {
  const headers = [
    "graceSku",
    "websiteSku",
    "sourceGraceSkus",
    "status",
    "sourcePath",
    "sourcePsdPath",
    "sha256",
    "width",
    "height",
    "opaque",
    "reasons",
  ];
  return [
    headers.join(","),
    ...decisions.map((decision) =>
      [
        decision.graceSku,
        decision.websiteSku,
        decision.sourceGraceSkus.join("|"),
        decision.status,
        decision.sourcePath,
        decision.sourcePsdPath,
        decision.sha256,
        decision.width,
        decision.height,
        decision.opaque,
        decision.reasons.join("|"),
      ]
        .map(csv)
        .join(","),
    ),
  ].join("\n") + "\n";
}

async function inspectReference(
  row: IntakeRow | undefined,
): Promise<CylinderFlattenedReferenceCandidate | null> {
  const sourcePath = String(row?.referenceSourcePath ?? "").trim();
  if (!sourcePath || !existsSync(sourcePath)) return null;
  const image = sharp(sourcePath, { failOn: "error" });
  const [metadata, stats] = await Promise.all([image.metadata(), image.stats()]);
  return {
    sourcePath,
    provenance: row?.referenceSource ?? null,
    width: metadata.width ?? null,
    height: metadata.height ?? null,
    opaque: stats.isOpaque,
    sha256: createHash("sha256").update(readFileSync(sourcePath)).digest("hex"),
  };
}

const readiness = JSON.parse(
  readFileSync(
    path.join(root, "public/data/best-bottles-generation-readiness.json"),
    "utf8",
  ),
) as { rows: CylinderCloseoutSourceRow[] };
const ledger = await buildCylinderCloseoutLedger({ readinessRows: readiness.rows });
const intake = JSON.parse(
  readFileSync(path.join(root, "public/data/bb-all-flattened-reference-intake.json"), "utf8"),
) as { rows: IntakeRow[] };

const intakeByGraceSku = new Map(
  intake.rows
    .filter((row) => row.family.toLowerCase() === "cylinder")
    .map((row) => [row.graceSku, row]),
);
const referencesByWebsiteSku: Record<
  string,
  CylinderFlattenedReferenceCandidate | null
> = {};
for (const target of ledger.publicationTargets) {
  const sourceRow =
    intakeByGraceSku.get(target.graceSku) ??
    target.sourceGraceSkus.map((sku) => intakeByGraceSku.get(sku)).find(Boolean);
  referencesByWebsiteSku[target.websiteSku] = await inspectReference(sourceRow);
}

const coverageCsvPath = path.join(psdInventoryDir, "website-sku-psd-coverage.csv");
if (!existsSync(coverageCsvPath)) {
  throw new Error(`PSD coverage CSV not found: ${coverageCsvPath}`);
}
const psdCandidatesByWebsiteSku: Record<string, CylinderPsdCandidate[]> = {};
for (const row of parseCsv(readFileSync(coverageCsvPath, "utf8"))) {
  const websiteSku = row.websiteSku?.trim();
  if (!websiteSku || !row.allMatchedPsdPaths?.trim()) continue;
  psdCandidatesByWebsiteSku[websiteSku] = row.allMatchedPsdPaths
    .split("|")
    .map((relativePath) => relativePath.trim())
    .filter(Boolean)
    .map((relativePath) => ({
      sourcePath: path.join(psdArchiveRoot, relativePath),
      pathClass: classifyCylinderPsdPath(relativePath, {
        sampleCappedPsd: row.sampleCappedPsd,
        sampleUncappedPsd: row.sampleUncappedPsd,
        sampleUnspecifiedPsd: row.sampleUnspecifiedPsd,
        recoveryCoverageLabel: row.recoveryCoverageLabel,
      }),
    }));
}

const manifest = await buildCylinderReferenceManifest({
  ledgerHash: ledger.sha256,
  targets: ledger.publicationTargets,
  referencesByWebsiteSku,
  psdCandidatesByWebsiteSku,
});
const manifestPath = path.join(outputDir, "cylinder-v6.1-reference-manifest.json");
const recoveryPath = path.join(outputDir, "cylinder-v6.1-reference-recovery.csv");
const manualPath = path.join(outputDir, "cylinder-v6.1-manual-source-match.csv");
mkdirSync(outputDir, { recursive: true });
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
writeFileSync(
  recoveryPath,
  decisionsCsv(
    manifest.decisions.filter((decision) => decision.status === "recover-from-psd"),
  ),
);
writeFileSync(
  manualPath,
  decisionsCsv(
    manifest.decisions.filter((decision) =>
      ["manual-source-match", "blocked"].includes(decision.status),
    ),
  ),
);

console.log(
  JSON.stringify(
    {
      version: manifest.version,
      sourceRows: ledger.rows.length,
      publicationTargets: ledger.publicationTargets.length,
      decisions: manifest.decisions.length,
      summary: manifest.summary,
      ledgerSha256: manifest.ledgerHash,
      manifestSha256: manifest.sha256,
      outputs: { manifestPath, recoveryPath, manualPath },
      readOnlyPsdInventory: true,
    },
    null,
    2,
  ),
);

if (manifest.summary.eligible !== ledger.publicationTargets.length) {
  process.exitCode = 2;
}
