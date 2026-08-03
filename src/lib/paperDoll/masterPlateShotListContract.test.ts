import assert from "node:assert/strict";
import { test } from "node:test";

import { parsePaperDollMasterShotList, type PaperDollMasterShotList } from "./masterPlateShotListContract";

const SHA = "a".repeat(64);

function fixture(): PaperDollMasterShotList {
  return {
    schemaVersion: 1,
    generatedFrom: { catalogBacklogPath: "a", catalogBacklogSha256: SHA, familyIntakesPath: "b", familyIntakesSha256: SHA, componentAuthorityQueuePath: "c", componentAuthorityQueueSha256: SHA, parametricFamilyIndexPath: "d", parametricFamilyIndexSha256: SHA },
    summary: { operationalRowCount: 1, sourceBackedPlateCount: 1, bodyAppearancePlateCount: 1, explicitComponentPlateCount: 0, exactSourceBackedExistingCount: 0, exactSourceBackedOutstandingCount: 1, localReviewCandidateGeometryFamilyCount: 0, localReviewCandidateIdentityCount: 0, localReviewCandidateOutputCount: 0, supplementalExistingCount: 0, missingSourceResponsibilityCount: 0 },
    rows: [{ lineNumber: 1, shotId: "body-1", recordType: "body-appearance", plateType: "body", family: "Cylinder", capacityMl: 5, neckFinish: "13-415", geometryOrAuthorityKey: "geometry", appearance: "Clear", materialEvidence: ["Glass"], sourceIdentity: "", sourceReferenceUrls: [], catalogSkuCount: 1, cohortKeys: ["CYL-5ML-13-415"], status: "needs-authority", priority: "P1-PRODUCE", authorityStatus: "missing", compatibilityStatus: "geometry-source-only", nextGate: "register authority", existingAssetPaths: [], existingAssetSha256: [], notes: "" }],
    mutationPolicy: { assetsGenerated: false, remoteWritesPerformed: false, currentReleaseChanged: false, sanityChanged: false },
  };
}

test("master shot list proves row order and summary", () => {
  const shotList = fixture();
  assert.equal(parsePaperDollMasterShotList(shotList).rows.length, 1);
  shotList.summary.operationalRowCount = 2;
  assert.throws(() => parsePaperDollMasterShotList(shotList), /does not match shot rows/i);
});
