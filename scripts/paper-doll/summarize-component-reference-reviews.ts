import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const batchPath = path.join(workspaceRoot, "outputs/paper-doll-component-authority-reviews/source-ready-batch.json");
const outputJsonPath = path.join(workspaceRoot, "docs/paper-doll-rig/component-source-review-summary.json");
const outputCsvPath = path.join(workspaceRoot, "docs/paper-doll-rig/component-source-review-summary.csv");
const outputReportPath = path.join(workspaceRoot, "docs/paper-doll-rig/COMPONENT-SOURCE-REVIEW-SUMMARY.md");

type BatchRecord = {
  reviewGroupKey: string;
  descriptorSignature: string;
  sourceIdentityCount: number;
  sourceReferenceCount: number;
  downloadStatus: string;
  analysisStatus: string;
  contactSheetPath: string | null;
  silhouetteAnalysisPath: string | null;
  silhouetteContactSheetPath: string | null;
};

type Comparison = {
  normalizedCanvas: { width: number; height: number };
  medoidSourceIdentity: string;
  medoidAverageIou: number;
  worstPair: { left: string; right: string; iou: number } | null;
  minimumBoundsAspectRatio: number;
  maximumBoundsAspectRatio: number;
  medianBoundsAspectRatio: number;
  boundsAspectSpreadPercent: number | null;
};

type AnalysisValue = {
  comparison: Comparison;
};

export function summarizeComponentReferenceReviews(
  batch: { records: BatchRecord[] },
  analysesByPath: Map<string, AnalysisValue>,
) {
  const records = batch.records.map((record) => {
    const analysis = record.silhouetteAnalysisPath
      ? analysesByPath.get(record.silhouetteAnalysisPath)
      : undefined;
    const comparison = analysis?.comparison ?? null;
    const isMultiReference = record.sourceIdentityCount > 1;
    return {
      reviewGroupKey: record.reviewGroupKey,
      descriptorSignature: record.descriptorSignature,
      sourceIdentityCount: record.sourceIdentityCount,
      sourceReferenceCount: record.sourceReferenceCount,
      evidenceStatus: record.downloadStatus === "fulfilled" && record.analysisStatus === "fulfilled"
        ? "review-evidence-ready"
        : "review-evidence-incomplete",
      comparisonBasis: isMultiReference ? "multi-identity-diagnostic" : "single-identity-reference",
      medoidSourceIdentity: comparison?.medoidSourceIdentity ?? null,
      medoidAverageIou: comparison?.medoidAverageIou ?? null,
      worstPairLeft: comparison?.worstPair?.left ?? null,
      worstPairRight: comparison?.worstPair?.right ?? null,
      worstPairIou: comparison?.worstPair?.iou ?? null,
      minimumBoundsAspectRatio: comparison?.minimumBoundsAspectRatio ?? null,
      maximumBoundsAspectRatio: comparison?.maximumBoundsAspectRatio ?? null,
      medianBoundsAspectRatio: comparison?.medianBoundsAspectRatio ?? null,
      boundsAspectSpreadPercent: comparison?.boundsAspectSpreadPercent ?? null,
      contactSheetPath: record.contactSheetPath,
      silhouetteAnalysisPath: record.silhouetteAnalysisPath,
      silhouetteContactSheetPath: record.silhouetteContactSheetPath,
      geometryClaim: "none",
      nextGate: isMultiReference
        ? "Review the source contact sheet and physical dimensions. Split only when visual or measured evidence proves distinct geometry; otherwise select one geometry authority and validate exact alpha."
        : "Obtain physical dimensions or select a reviewed silhouette authority, then validate the resulting exact-alpha mask before any geometry-lock claim.",
    };
  });

  const multiReferenceRecords = records.filter((record) => record.comparisonBasis === "multi-identity-diagnostic");
  const byLowestIou = [...multiReferenceRecords]
    .filter((record) => record.worstPairIou !== null)
    .sort((left, right) => (left.worstPairIou ?? 1) - (right.worstPairIou ?? 1));
  const byLargestAspectSpread = [...multiReferenceRecords]
    .filter((record) => record.boundsAspectSpreadPercent !== null)
    .sort((left, right) => (right.boundsAspectSpreadPercent ?? 0) - (left.boundsAspectSpreadPercent ?? 0));
  const iouRank = new Map(byLowestIou.map((record, index) => [record.reviewGroupKey, index + 1]));
  const aspectRank = new Map(byLargestAspectSpread.map((record, index) => [record.reviewGroupKey, index + 1]));
  const rankedRecords = records.map((record) => ({
    ...record,
    diagnosticLowestIouRank: iouRank.get(record.reviewGroupKey) ?? null,
    diagnosticLargestAspectSpreadRank: aspectRank.get(record.reviewGroupKey) ?? null,
  }));

  return {
    schemaVersion: 1,
    summary: {
      reviewGroupCount: rankedRecords.length,
      sourceIdentityCount: rankedRecords.reduce((total, record) => total + record.sourceIdentityCount, 0),
      sourceReferenceCount: rankedRecords.reduce((total, record) => total + record.sourceReferenceCount, 0),
      evidenceReadyGroupCount: rankedRecords.filter((record) => record.evidenceStatus === "review-evidence-ready").length,
      evidenceIncompleteGroupCount: rankedRecords.filter((record) => record.evidenceStatus === "review-evidence-incomplete").length,
      singleIdentityGroupCount: rankedRecords.filter((record) => record.comparisonBasis === "single-identity-reference").length,
      multiIdentityGroupCount: multiReferenceRecords.length,
      lowestObservedDiagnosticIou: byLowestIou[0]?.worstPairIou ?? null,
      largestObservedBoundsAspectSpreadPercent: byLargestAspectSpread[0]?.boundsAspectSpreadPercent ?? null,
    },
    records: rankedRecords,
    interpretation: [
      "These metrics rank source-reference disagreement for human review; they do not approve or reject geometry.",
      "No global IoU, aspect-ratio, material, brightness, or topology threshold is used to promote a descriptor lane.",
      "Source photography may contain perspective, cropping, color, transparency, and background-removal differences.",
      "Only reviewed physical dimensions plus an approved exact-alpha authority can earn geometry lock.",
    ],
    claimPolicy: {
      sourceReferenceIsGeometryAuthority: false,
      diagnosticMetricIsApprovalGate: false,
      compatibilityInferred: false,
      exactAlphaAuthorityRequired: true,
    },
    mutationPolicy: {
      assetsGenerated: false,
      candidatesCreated: false,
      remoteWritesPerformed: false,
      currentReleaseChanged: false,
      sanityChanged: false,
    },
  };
}

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function csvFor(records: ReturnType<typeof summarizeComponentReferenceReviews>["records"]): string {
  const headers = [
    "reviewGroupKey", "descriptorSignature", "sourceIdentityCount", "sourceReferenceCount", "evidenceStatus",
    "comparisonBasis", "medoidSourceIdentity", "medoidAverageIou", "worstPairLeft", "worstPairRight", "worstPairIou",
    "boundsAspectSpreadPercent", "diagnosticLowestIouRank", "diagnosticLargestAspectSpreadRank", "geometryClaim",
    "contactSheetPath", "silhouetteAnalysisPath", "silhouetteContactSheetPath", "nextGate",
  ] as const;
  return `${headers.join(",")}\n${records.map((record) => headers.map((header) => csvCell(record[header])).join(",")).join("\n")}\n`;
}

function reportFor(summary: ReturnType<typeof summarizeComponentReferenceReviews>): string {
  const ranked = [...summary.records]
    .filter((record) => record.diagnosticLowestIouRank !== null)
    .sort((left, right) => (left.diagnosticLowestIouRank ?? 999) - (right.diagnosticLowestIouRank ?? 999));
  const rows = ranked.map((record) => `| ${record.diagnosticLowestIouRank} | ${record.descriptorSignature} | ${record.sourceIdentityCount} | ${record.worstPairIou?.toFixed(4) ?? "—"} | ${record.boundsAspectSpreadPercent?.toFixed(2) ?? "—"}% | ${record.medoidSourceIdentity ?? "—"} |`).join("\n");
  return `# Best Bottles component source-review summary

**Purpose:** rank disagreement in the downloaded catalog references so physical geometry review starts with the riskiest descriptor lanes. This is diagnostic evidence only.

## Coverage

- ${summary.summary.reviewGroupCount} source-ready descriptor lanes.
- ${summary.summary.sourceIdentityCount} source identities and ${summary.summary.sourceReferenceCount} downloaded references.
- ${summary.summary.evidenceReadyGroupCount} lanes have complete local review evidence; ${summary.summary.evidenceIncompleteGroupCount} are incomplete.
- ${summary.summary.multiIdentityGroupCount} multi-identity lanes have pairwise silhouette diagnostics; ${summary.summary.singleIdentityGroupCount} singleton lanes require direct authority selection or dimensions.

## Non-negotiable interpretation

There is no automatic geometry pass/fail threshold. Source photography changes crop, perspective, transparency, brightness, and edge extraction. Low IoU is a request for attention, not proof of different geometry; high IoU is not proof of shared physical geometry. Geometry lock still requires reviewed physical evidence and one approved exact-alpha authority mask.

## Multi-identity attention order

| Rank | Descriptor lane | Identities | Worst diagnostic IoU | Bounds aspect spread | Diagnostic medoid |
|---:|---|---:|---:|---:|---|
${rows}

## Next gate

Review the contact sheets in rank order. Record explicit split/merge decisions with visual or measured evidence. Do not change compatibility, create candidates, or promote an authority from this summary alone.
`;
}

export async function buildComponentSourceReviewSummary() {
  const batch = JSON.parse(await readFile(batchPath, "utf8")) as { records: BatchRecord[] };
  const analysesByPath = new Map<string, AnalysisValue>();
  await Promise.all(batch.records.map(async (record) => {
    if (!record.silhouetteAnalysisPath) return;
    const absolutePath = path.resolve(workspaceRoot, record.silhouetteAnalysisPath);
    analysesByPath.set(record.silhouetteAnalysisPath, JSON.parse(await readFile(absolutePath, "utf8")) as AnalysisValue);
  }));
  const summary = summarizeComponentReferenceReviews(batch, analysesByPath);
  await Promise.all([
    writeFile(outputJsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8"),
    writeFile(outputCsvPath, csvFor(summary.records), "utf8"),
    writeFile(outputReportPath, reportFor(summary), "utf8"),
  ]);
  return { outputJsonPath, outputCsvPath, outputReportPath, summary };
}

async function main() {
  const result = await buildComponentSourceReviewSummary();
  console.log(JSON.stringify({
    outputJsonPath: result.outputJsonPath,
    outputCsvPath: result.outputCsvPath,
    outputReportPath: result.outputReportPath,
    summary: result.summary.summary,
    claimPolicy: result.summary.claimPolicy,
    mutationPolicy: result.summary.mutationPolicy,
  }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
