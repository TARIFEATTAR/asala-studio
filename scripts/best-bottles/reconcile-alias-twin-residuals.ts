import fs from "node:fs";
import path from "node:path";
import { parseCsv } from "../../src/lib/bestBottlesGapWorklist";
import { reconcileAliasTwinResiduals, type AliasTwinIdentityRow } from "../../src/lib/bestBottlesAliasTwinReconciliation";

const ROOT = process.cwd();
const GAP_DIR = path.join(ROOT, "tmp/best-bottles-reference-production/reference-gap-2026-07-20");
const residualPath = path.join(GAP_DIR, "residual-missing-after-import.csv");
const readinessPath = path.join(ROOT, "public/data/best-bottles-generation-readiness.json");

function csvCell(value: unknown): string {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(headers: string[], rows: Record<string, unknown>[]): string {
  return [headers, ...rows.map((row) => headers.map((header) => row[header]))]
    .map((row) => row.map(csvCell).join(","))
    .join("\n") + "\n";
}

const parsedResiduals = parseCsv(fs.readFileSync(residualPath, "utf8"));
const readiness = JSON.parse(fs.readFileSync(readinessPath, "utf8")) as { rows: AliasTwinIdentityRow[] };
const result = reconcileAliasTwinResiduals({
  residuals: parsedResiduals.records as AliasTwinIdentityRow[],
  catalog: readiness.rows,
});

if (result.twins.length !== 61 || result.remaining.length !== 110 || result.ambiguous.length !== 0) {
  throw new Error(
    `Alias-twin invariant failed: twins=${result.twins.length}, remaining=${result.remaining.length}, ambiguous=${result.ambiguous.length}`,
  );
}

const twinsPath = path.join(GAP_DIR, "alias-twin-reconciliation.csv");
const dedupedPath = path.join(GAP_DIR, "residual-missing-after-alias-reconciliation.csv");
fs.writeFileSync(
  twinsPath,
  toCsv(["websiteSku", "missingGraceSku", "siblingGraceSku", "family"], result.twins),
);
fs.writeFileSync(dedupedPath, toCsv(parsedResiduals.headers, result.remaining));

console.log(JSON.stringify({ twins: result.twins.length, remaining: result.remaining.length, twinsPath, dedupedPath }, null, 2));
