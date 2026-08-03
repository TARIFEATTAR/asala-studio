import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { loadCyl9ComponentFactory } from "../../src/lib/paperDoll/cyl9ComponentFactory";
import { buildComponentCandidate } from "./build-component-candidate";
import {
  buildCyl9ComponentBatch,
  type Cyl9ComponentBatchJob,
} from "./build-cyl9-component-batch";

const CONFIRMATION = "CYL9-LOCAL-CANDIDATES";
const DEFAULT_OUTPUT = "outputs/paper-doll-component-factory/CYL-9ML/materialized";

type MaterializeMode = "plan" | "execute";

type MaterializeResult = {
  mode: MaterializeMode;
  plannedCandidates: number;
  materializedCandidates: number;
  providerCounts: Record<string, number>;
  candidateIds: string[];
  indexPath: string | null;
  mutationPolicy: {
    approvalsWritten: false;
    placementsWritten: false;
    currentReleaseChanged: false;
    sanityChanged: false;
  };
};

function valueAfter(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

function countProviders(jobs: Cyl9ComponentBatchJob[]): Record<string, number> {
  return jobs.reduce<Record<string, number>>((counts, job) => {
    counts[job.provider] = (counts[job.provider] ?? 0) + 1;
    return counts;
  }, {});
}

export async function materializeCyl9LocalCandidates(options: {
  mode: MaterializeMode;
  confirmation?: string;
  outputDirectory?: string;
}): Promise<MaterializeResult> {
  const batch = await buildCyl9ComponentBatch({ mode: "plan" });
  const jobs = batch.jobs.filter(({ provider }) => provider === "deterministic");
  const base: MaterializeResult = {
    mode: options.mode,
    plannedCandidates: jobs.length,
    materializedCandidates: 0,
    providerCounts: countProviders(jobs),
    candidateIds: [],
    indexPath: null,
    mutationPolicy: {
      approvalsWritten: false,
      placementsWritten: false,
      currentReleaseChanged: false,
      sanityChanged: false,
    },
  };
  if (options.mode === "plan") return base;
  if (options.confirmation !== CONFIRMATION) {
    throw new Error(`Execute requires confirmation token ${CONFIRMATION}.`);
  }

  const manifest = loadCyl9ComponentFactory();
  const outputDirectory = path.resolve(options.outputDirectory ?? DEFAULT_OUTPUT);
  await mkdir(outputDirectory, { recursive: true });
  const artifacts = [];
  for (const job of jobs) {
    const result = await buildComponentCandidate({
      manifest,
      componentKey: job.componentKey,
      variantKey: job.variantKey,
      sourcePath: path.resolve(job.sourceReferencePath),
      originalFilename: path.basename(job.sourceReferencePath),
      sourceBoundsPx: job.sourceBoundsPx,
      editBoundsPx: job.editBoundsPx,
      provider: "deterministic",
      model: job.model,
      prompt: job.prompt,
      outputDirectory,
    });
    artifacts.push({
      requestId: job.requestId,
      componentKey: job.componentKey,
      variantKey: job.variantKey,
      candidateId: result.record.candidateId,
      lifecycleState: result.record.lifecycleState,
      geometryLocked: result.record.qa.geometryLocked,
      mismatchedPixels: result.record.qa.mismatchedPixels,
      paths: result.paths,
    });
  }

  const indexPath = path.join(outputDirectory, "materialization-index.json");
  await writeFile(indexPath, `${JSON.stringify({
    schemaVersion: 1,
    familyKey: "CYL-9ML",
    createdFrom: "deterministic-local-sources",
    artifacts,
    mutationPolicy: base.mutationPolicy,
  }, null, 2)}\n`, "utf8");
  return {
    ...base,
    materializedCandidates: artifacts.length,
    candidateIds: artifacts.map(({ candidateId }) => candidateId),
    indexPath,
  };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const mode: MaterializeMode = args.includes("--execute") ? "execute" : "plan";
  const result = await materializeCyl9LocalCandidates({
    mode,
    confirmation: valueAfter(args, "--confirmation"),
    outputDirectory: valueAfter(args, "--output"),
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (import.meta.url === new URL(process.argv[1], "file:").href) {
  main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
