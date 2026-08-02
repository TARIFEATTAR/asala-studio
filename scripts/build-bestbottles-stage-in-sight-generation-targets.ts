import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  buildStageInSightGenerationTargets,
  type StageInSightAuditRow,
} from "../src/lib/bestBottlesStageInSightTargets";

const DEFAULT_AUDIT_DIR =
  "/Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Website-02-20-2026/data/audits/stage-in-sight-image-sync-2026-06-15/coordinator";
const DEFAULT_OUTPUT =
  "public/data/best-bottles-stage-in-sight-generation-targets.json";

function readArg(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] || fallback;
}

function parseCsv(text: string): StageInSightAuditRow[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (quoted) {
      if (char === "\"" && next === "\"") {
        cell += "\"";
        index += 1;
      } else if (char === "\"") {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === "\"") {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }

  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }

  const header = rows.shift() ?? [];
  return rows
    .filter((values) => values.some((value) => value.trim()))
    .map((values) =>
      Object.fromEntries(header.map((key, index) => [key, values[index] ?? ""])),
    ) as StageInSightAuditRow[];
}

const auditDir = readArg("--audit-dir", DEFAULT_AUDIT_DIR);
const outputPath = readArg("--output", DEFAULT_OUTPUT);
const missingPath = resolve(auditDir, "missing_shopify_variant_images.csv");
const generatedPath = resolve(auditDir, "generated_in_madison_but_not_shopify.csv");

const targets = buildStageInSightGenerationTargets({
  missingShopifyVariantImages: parseCsv(readFileSync(missingPath, "utf8")),
  generatedInMadisonButNotShopify: parseCsv(readFileSync(generatedPath, "utf8")),
  source: {
    missingShopifyVariantImages: missingPath,
    generatedInMadisonButNotShopify: generatedPath,
  },
});

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(targets, null, 2)}\n`);

console.log(
  `Stage In Sight generation targets: ${targets.summary.total} rows · ` +
    Object.entries(targets.summary.byFamily)
      .map(([family, count]) => `${family}: ${count}`)
      .join(" · "),
);
console.log(`Wrote ${outputPath}`);
