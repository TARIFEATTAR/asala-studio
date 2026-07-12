import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { CylinderCloseoutLedger } from "../../src/lib/bestBottlesCylinderCloseout";
import type { CylinderReferenceManifest } from "../../src/lib/bestBottlesCylinderReferenceReadiness";
import { buildCylinderSmokeMatrixReport } from "../../src/lib/bestBottlesCylinderSmokeMatrix";

const outputDir = path.resolve("tmp/bestbottles-generation");
const ledger = JSON.parse(readFileSync(path.join(outputDir, "cylinder-v6.1-closeout-ledger.json"), "utf8")) as CylinderCloseoutLedger;
const references = JSON.parse(readFileSync(path.join(outputDir, "cylinder-v6.1-reference-manifest.json"), "utf8")) as CylinderReferenceManifest;
const report = buildCylinderSmokeMatrixReport(ledger, references);
const jsonPath = path.join(outputDir, "cylinder-v6.1-smoke-matrix.json");
const markdownPath = path.join(outputDir, "cylinder-v6.1-smoke-matrix.md");

mkdirSync(outputDir, { recursive: true });
writeFileSync(jsonPath, `${JSON.stringify({
  version: "cylinder-v6.1-smoke-matrix-v1",
  ledgerHash: ledger.sha256,
  referenceManifestHash: references.sha256,
  eligible: report.missing.length === 0,
  missing: report.missing,
  allowlist: report.entries.map((entry) => entry.graceSku),
  entries: report.entries,
}, null, 2)}\n`);
writeFileSync(markdownPath, [
  "# Cylinder V6.1 Smoke Matrix",
  "",
  `- Ledger: \`${ledger.sha256}\``,
  `- Reference manifest: \`${references.sha256}\``,
  `- Status: **${report.missing.length === 0 ? "READY" : "BLOCKED"}**`,
  `- Selected archetypes: ${report.entries.length}`,
  "",
  ...(report.missing.length ? ["## Missing coverage", "", ...report.missing.map((item) => `- ${item}`), ""] : []),
  "## Allowlist",
  "",
  "```text",
  report.entries.map((entry) => entry.graceSku).join(","),
  "```",
  "",
  "## Review grouping",
  "",
  ...report.entries.map((entry) => `- **${entry.graceSku}** — ${Object.values(entry.coverage).join(" / ")} — ref \`${entry.referenceHash}\``),
  "",
].join("\n"));

console.log(JSON.stringify({ jsonPath, markdownPath, selected: report.entries.length, missing: report.missing }, null, 2));
if (report.missing.length > 0) process.exitCode = 2;
