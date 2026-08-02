import { createHash } from "node:crypto";
import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import {
  buildCyl9RollonRequirementSnapshot,
  canonicalizeCyl9RollonSnapshot,
  parseCyl9RollonRequirements,
} from "../../src/lib/paperDoll/rollonRequirements";

const DEFAULT_SOURCE = "public/data/best-bottles-catalog-lite.json";
const DEFAULT_OUTPUT = "docs/paper-doll-rig/cyl9-rollon-requirements.json";

function readArg(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  if (index < 0) return fallback;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`Missing value for ${name}.`);
  return value;
}

async function main(): Promise<void> {
  const sourcePath = path.resolve(process.cwd(), readArg("--source", DEFAULT_SOURCE));
  const outputPath = path.resolve(process.cwd(), readArg("--out", DEFAULT_OUTPUT));
  const sourceBuffer = await readFile(sourcePath);
  const sourceStats = await stat(sourcePath);
  const sourceSha256 = createHash("sha256").update(sourceBuffer).digest("hex");
  const catalog = JSON.parse(sourceBuffer.toString("utf8"));

  const unhashed = buildCyl9RollonRequirementSnapshot({
    catalog,
    sourceGeneratedAt: sourceStats.mtime.toISOString(),
    sourcePath: path.relative(process.cwd(), sourcePath),
    sourceSha256,
  });
  const snapshotSha256 = createHash("sha256")
    .update(canonicalizeCyl9RollonSnapshot(unhashed))
    .digest("hex");
  const snapshot = parseCyl9RollonRequirements({ ...unhashed, snapshotSha256 });

  await writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  process.stdout.write([
    `Wrote ${path.relative(process.cwd(), outputPath)}`,
    `source rows: ${snapshot.evidenceSummary.sourceRowCount}`,
    `assembly mappings: ${snapshot.assemblyMappings.length}`,
    `component requirements: ${snapshot.requirements.length}`,
    `dimension conflicts: ${snapshot.evidenceSummary.dimensionConflictCount}`,
    `snapshot sha256: ${snapshot.snapshotSha256}`,
  ].join("\n") + "\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
