import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { analyzeComponentReferenceSilhouettes } from "./analyze-component-reference-silhouettes";
import { buildComponentReferenceReview, COMPONENT_REFERENCE_CONFIRMATION } from "./build-component-reference-review";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const groupsPath = path.join(workspaceRoot, "docs/paper-doll-rig/component-geometry-review-groups.json");
const outputPath = path.join(workspaceRoot, "outputs/paper-doll-component-authority-reviews/source-ready-batch.json");
export const SOURCE_READY_BATCH_CONFIRMATION = "FETCH_SOURCE_READY_COMPONENT_BATCH";

async function inBatches<T, R>(items: T[], batchSize: number, task: (item: T) => Promise<R>): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = [];
  for (let index = 0; index < items.length; index += batchSize) {
    results.push(...await Promise.allSettled(items.slice(index, index + batchSize).map(task)));
  }
  return results;
}

export async function buildSourceReadyComponentReviewBatch(options: { execute?: boolean; confirmation?: string } = {}) {
  const groups = JSON.parse(await readFile(groupsPath, "utf8")) as any;
  const targets = groups.groups.filter((group: any) => group.status === "source-ready-physical-review");
  const plan = {
    groupCount: targets.length,
    sourceIdentityCount: targets.reduce((total: number, group: any) => total + group.sourceIdentityCount, 0),
    sourceReferenceCount: targets.reduce((total: number, group: any) => total + group.sourceReferenceUrls.length, 0),
    reviewGroupKeys: targets.map((group: any) => group.reviewGroupKey),
    geometryClaim: "none" as const,
    productionPolicy: { authorityCreated: false, candidateCreated: false, compatibilityInferred: false, geometryLocked: false },
    mutationPolicy: { remoteWritesPerformed: false, currentReleaseChanged: false, sanityChanged: false },
  };
  if (!options.execute) return { mode: "dry-run" as const, plan };
  if (options.confirmation !== SOURCE_READY_BATCH_CONFIRMATION) {
    throw new Error(`Execution requires --confirm ${SOURCE_READY_BATCH_CONFIRMATION}.`);
  }

  const downloadResults = await inBatches(targets, 5, (group: any) => buildComponentReferenceReview({
    groupKey: group.reviewGroupKey,
    execute: true,
    confirmation: COMPONENT_REFERENCE_CONFIRMATION,
  }));
  const downloadedGroups = targets.filter((_: any, index: number) => downloadResults[index].status === "fulfilled");
  const analysisResults = await inBatches(downloadedGroups, 4, (group: any) => analyzeComponentReferenceSilhouettes(group.reviewGroupKey));
  const analysisByGroup = new Map(downloadedGroups.map((group: any, index: number) => [group.reviewGroupKey, analysisResults[index]]));
  const records = targets.map((group: any, index: number) => {
    const download = downloadResults[index];
    const analysis = analysisByGroup.get(group.reviewGroupKey);
    return {
      reviewGroupKey: group.reviewGroupKey,
      descriptorSignature: group.descriptorSignature,
      sourceIdentityCount: group.sourceIdentityCount,
      sourceReferenceCount: group.sourceReferenceUrls.length,
      downloadStatus: download.status,
      downloadError: download.status === "rejected" ? String(download.reason) : null,
      analysisStatus: analysis?.status ?? "not-run",
      analysisError: analysis?.status === "rejected" ? String(analysis.reason) : null,
      contactSheetPath: download.status === "fulfilled" && download.value.mode === "executed"
        ? path.relative(workspaceRoot, download.value.contactSheetPath)
        : null,
      silhouetteAnalysisPath: analysis?.status === "fulfilled"
        ? path.relative(workspaceRoot, analysis.value.outputPath)
        : null,
      silhouetteContactSheetPath: analysis?.status === "fulfilled"
        ? path.relative(workspaceRoot, analysis.value.contactSheetPath)
        : null,
      geometryClaim: "unverified-descriptor-cluster",
    };
  });
  const result = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    plan,
    summary: {
      groupsDownloaded: records.filter((record) => record.downloadStatus === "fulfilled").length,
      groupsDownloadFailed: records.filter((record) => record.downloadStatus === "rejected").length,
      groupsAnalyzed: records.filter((record) => record.analysisStatus === "fulfilled").length,
      groupsAnalysisFailed: records.filter((record) => record.analysisStatus === "rejected").length,
    },
    records,
    interpretation: "Reference review evidence only. No descriptor group is promoted to geometry authority by this batch.",
    productionPolicy: plan.productionPolicy,
    mutationPolicy: plan.mutationPolicy,
  };
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  return { mode: "executed" as const, plan, outputPath, result };
}

async function main() {
  const execute = process.argv.includes("--execute");
  const confirmIndex = process.argv.indexOf("--confirm");
  const confirmation = confirmIndex >= 0 ? process.argv[confirmIndex + 1] : undefined;
  const result = await buildSourceReadyComponentReviewBatch({ execute, confirmation });
  console.log(JSON.stringify(result.mode === "dry-run" ? result : {
    mode: result.mode,
    plan: result.plan,
    outputPath: result.outputPath,
    summary: result.result.summary,
    interpretation: result.result.interpretation,
    productionPolicy: result.result.productionPolicy,
    mutationPolicy: result.result.mutationPolicy,
  }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
