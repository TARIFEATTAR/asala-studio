import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  buildCylinderCloseoutLedger,
  getCylinderCloseoutBlockers,
  type CylinderCloseoutSourceRow,
} from "../../src/lib/bestBottlesCylinderCloseout";

const root = process.cwd();
const readinessPath = path.join(
  root,
  "public/data/best-bottles-generation-readiness.json",
);
const outputDir = path.join(root, "tmp/bestbottles-generation");
const ledgerPath = path.join(outputDir, "cylinder-v6.1-closeout-ledger.json");
const blockersPath = path.join(outputDir, "cylinder-v6.1-closeout-blockers.csv");

function csv(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

const readiness = JSON.parse(readFileSync(readinessPath, "utf8")) as {
  rows: CylinderCloseoutSourceRow[];
};
const ledger = await buildCylinderCloseoutLedger({
  readinessRows: readiness.rows,
});
const blockers = getCylinderCloseoutBlockers(ledger);

mkdirSync(outputDir, { recursive: true });
writeFileSync(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`);
writeFileSync(
  blockersPath,
  [
    "code,message,graceSkus,websiteSkus",
    ...blockers.map((blocker) =>
      [
        blocker.code,
        blocker.message,
        blocker.graceSkus.join("|"),
        blocker.websiteSkus.join("|"),
      ]
        .map(csv)
        .join(","),
    ),
  ].join("\n") + "\n",
);

const counts = blockers.reduce<Record<string, number>>((result, blocker) => {
  result[blocker.code] = (result[blocker.code] ?? 0) + 1;
  return result;
}, {});

console.log(
  JSON.stringify(
    {
      version: ledger.version,
      sourceRows: ledger.rows.length,
      publicationTargets: ledger.publicationTargets.length,
      aliases: Object.keys(ledger.aliases).length,
      ledgerSha256: ledger.sha256,
      blockers: blockers.length,
      blockerCounts: counts,
      outputs: { ledgerPath, blockersPath },
    },
    null,
    2,
  ),
);

if (blockers.length > 0) process.exitCode = 2;
