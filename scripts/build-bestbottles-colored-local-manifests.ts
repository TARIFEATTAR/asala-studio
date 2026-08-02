#!/usr/bin/env tsx
/**
 * Emit cap-on generation manifests for prompt-ready SKUs with a LOCAL
 * madison-master reference that are NOT in the clear-glass queue —
 * i.e. the colored/other-material local-reference gap (~438 rows).
 *
 *   npx tsx scripts/build-bestbottles-colored-local-manifests.ts
 *
 * Outputs: tmp/best-bottles-colored-local-batch-00N.json
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const STAMP = "2026-06-11";
const PIPELINE_LANE_ID = "grid-card-2000x2200";
const CHUNK_SIZE = 150;

const audit = JSON.parse(
  readFileSync(resolve("tmp/best-bottles-reference-backed-cap-on-all-audit.json"), "utf-8"),
);
const clear = JSON.parse(
  readFileSync(resolve("tmp/best-bottles-reference-backed-cap-on-clear.json"), "utf-8"),
);
const clearSet = new Set(clear.rows.map((r: { graceSku: string }) => r.graceSku));

type AuditRow = {
  graceSku: string;
  websiteSku: string | null;
  family: string | null;
  materialBucket: string | null;
  promptReady: boolean;
  referenceStatus: string;
  absoluteReferencePath: string | null;
  liveReferenceUrl: string | null;
};

const rows: AuditRow[] = (audit.rows ?? []).filter(
  (r: AuditRow) =>
    r.promptReady &&
    r.referenceStatus === "local" &&
    r.absoluteReferencePath &&
    !clearSet.has(r.graceSku),
);

const missingRef = rows.filter((r) => !existsSync(r.absoluteReferencePath!));
if (missingRef.length) {
  console.warn(`WARNING: ${missingRef.length} rows have local reference paths that no longer exist — excluded:`);
  for (const r of missingRef.slice(0, 10)) console.warn(`  ${r.graceSku}  ${r.absoluteReferencePath}`);
}
const usable = rows.filter((r) => existsSync(r.absoluteReferencePath!));

const manifestRows = usable.map((r, i) => ({
  cycleId: `best-bottles-colored-local-${STAMP}`,
  launchOrder: i + 1,
  pipelineLaneId: PIPELINE_LANE_ID,
  mode: "cap-on" as const,
  graceSku: r.graceSku,
  websiteSku: r.websiteSku,
  family: r.family,
  materialBucket: r.materialBucket,
  referenceSource: "madison-master",
  liveReferenceUrl: r.liveReferenceUrl,
  absoluteReferencePath: r.absoluteReferencePath,
  expectedCanonicalFilename: `${r.graceSku}.png`,
}));

const chunkCount = Math.ceil(manifestRows.length / CHUNK_SIZE);
for (let c = 0; c < chunkCount; c++) {
  const chunk = manifestRows.slice(c * CHUNK_SIZE, (c + 1) * CHUNK_SIZE);
  const n = String(c + 1).padStart(3, "0");
  const payload = {
    generatedAt: new Date().toISOString(),
    source: "build-bestbottles-colored-local-manifests.ts",
    sourceCandidateMode: "cap-on",
    referenceScope: "local-madison-master-colored",
    pipelineLaneId: PIPELINE_LANE_ID,
    mode: "cap-on",
    cycleId: `best-bottles-colored-local-batch-${n}-${STAMP}`,
    launchOrder: 1,
    totalRows: chunk.length,
    chunkIndex: c + 1,
    chunkCount,
    rows: chunk,
  };
  const out = resolve(`tmp/best-bottles-colored-local-batch-${n}.json`);
  writeFileSync(out, JSON.stringify(payload, null, 2));
  console.log(`Manifest: ${out} (${chunk.length} rows)`);
}
console.log(`\n${manifestRows.length} colored/other local-reference rows across ${chunkCount} manifests.`);
