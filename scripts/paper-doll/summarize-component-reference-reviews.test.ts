import assert from "node:assert/strict";
import test from "node:test";

import { summarizeComponentReferenceReviews } from "./summarize-component-reference-reviews";

test("summarizes source evidence without converting diagnostics into a geometry claim", () => {
  const batch = {
    records: [
      {
        reviewGroupKey: "group-a",
        descriptorSignature: "cap :: 13-415 :: Cap/Closure :: Short",
        sourceIdentityCount: 2,
        sourceReferenceCount: 2,
        downloadStatus: "fulfilled",
        analysisStatus: "fulfilled",
        contactSheetPath: "a/contact-sheet.png",
        silhouetteAnalysisPath: "a/analysis.json",
        silhouetteContactSheetPath: "a/analysis.png",
      },
      {
        reviewGroupKey: "group-b",
        descriptorSignature: "sprayer :: 13-415 :: none :: Spray",
        sourceIdentityCount: 1,
        sourceReferenceCount: 1,
        downloadStatus: "fulfilled",
        analysisStatus: "fulfilled",
        contactSheetPath: "b/contact-sheet.png",
        silhouetteAnalysisPath: "b/analysis.json",
        silhouetteContactSheetPath: "b/analysis.png",
      },
    ],
  };
  const analyses = new Map([
    ["a/analysis.json", { comparison: {
      normalizedCanvas: { width: 256, height: 256 },
      medoidSourceIdentity: "cap-black",
      medoidAverageIou: 0.8,
      worstPair: { left: "cap-black", right: "cap-white", iou: 0.72 },
      minimumBoundsAspectRatio: 0.8,
      maximumBoundsAspectRatio: 0.9,
      medianBoundsAspectRatio: 0.9,
      boundsAspectSpreadPercent: 11.1,
    } }],
    ["b/analysis.json", { comparison: {
      normalizedCanvas: { width: 256, height: 256 },
      medoidSourceIdentity: "sprayer-black",
      medoidAverageIou: 1,
      worstPair: null,
      minimumBoundsAspectRatio: 0.5,
      maximumBoundsAspectRatio: 0.5,
      medianBoundsAspectRatio: 0.5,
      boundsAspectSpreadPercent: 0,
    } }],
  ]);

  const result = summarizeComponentReferenceReviews(batch, analyses);
  assert.deepEqual(result.summary, {
    reviewGroupCount: 2,
    sourceIdentityCount: 3,
    sourceReferenceCount: 3,
    evidenceReadyGroupCount: 2,
    evidenceIncompleteGroupCount: 0,
    singleIdentityGroupCount: 1,
    multiIdentityGroupCount: 1,
    lowestObservedDiagnosticIou: 0.72,
    largestObservedBoundsAspectSpreadPercent: 11.1,
  });
  assert.equal(result.records[0].geometryClaim, "none");
  assert.equal(result.records[0].diagnosticLowestIouRank, 1);
  assert.equal(result.records[1].diagnosticLowestIouRank, null);
  assert.equal(result.claimPolicy.diagnosticMetricIsApprovalGate, false);
  assert.equal(result.mutationPolicy.remoteWritesPerformed, false);
});
