import { readFile } from "node:fs/promises";
import path from "node:path";

import { writeBostonRoundPlateAuditArtifacts } from "../../src/lib/paperDoll/bostonRoundPlateAudit";

const workspaceRoot = process.cwd();
const canonicalCsvPath = path.join(
  workspaceRoot,
  "docs/best-bottles-canonical-truth/best-bottles-master-truth.csv",
);
const outputRoot = path.join(workspaceRoot, "docs/paper-doll-rig");

const result = await writeBostonRoundPlateAuditArtifacts({
  csv: await readFile(canonicalCsvPath, "utf8"),
  outputRoot,
});

console.log(`Boston Round plate audit: ${result.markdownPath}`);
console.log(`Boston Round machine audit: ${result.jsonPath}`);
