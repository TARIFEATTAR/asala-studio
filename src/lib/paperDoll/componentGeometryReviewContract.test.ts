import assert from "node:assert/strict";
import test from "node:test";

import { parsePaperDollComponentGeometryReview } from "./componentGeometryReviewContract";

const hash = "a".repeat(64);

test("geometry review contract permits only exact shared authority geometry claims", () => {
  const parsed = parsePaperDollComponentGeometryReview({
    schemaVersion: 1,
    generatedFrom: { componentAuthorityQueuePath: "queue.json", componentAuthorityQueueSha256: hash },
    summary: {
      sourceIdentityCount: 2,
      descriptorReviewGroupCount: 1,
      verifiedSharedAuthorityGroupCount: 1,
      verifiedSharedAuthorityIdentityCount: 2,
      localReconciliationGroupCount: 0,
      sourceReadyPhysicalReviewGroupCount: 0,
      sourceIncompleteGroupCount: 0,
    },
    groups: [{
      reviewGroupKey: "review__cap__17-415",
      descriptorSignature: "cap :: 17-415 :: Plastic Roller Ball :: Roll-On",
      slotProposals: ["cap"],
      neckFinishEvidence: ["17-415"],
      applicatorEvidence: ["Plastic Roller Ball"],
      capStyleEvidence: ["Roll-On"],
      sourceIdentities: ["cap-a", "cap-b"],
      appearanceEvidence: ["Black", "Gold"],
      sourceReferenceUrls: ["https://example.com/a.png", "https://example.com/b.png"],
      sourceIdentityCount: 2,
      sourceReferenceObservedCount: 2,
      localVariantCount: 2,
      localGeometryFamilyIds: ["cap__17-415__v1"],
      localAuthorityMaskSha256: [hash],
      status: "verified-local-shared-authority",
      priority: "P0-VERIFY",
      geometryClaim: "verified-local-exact-alpha",
      nextGate: "Preserve authority.",
      issues: [],
    }],
    claimPolicy: { descriptorClusterIsGeometryLock: false, exactSharedAuthorityRequiredForVerifiedClaim: true, compatibilityInferred: false },
    mutationPolicy: { assetsGenerated: false, remoteWritesPerformed: false, currentReleaseChanged: false, sanityChanged: false },
  });
  assert.equal(parsed.groups[0].geometryClaim, "verified-local-exact-alpha");
});

test("geometry review contract rejects a descriptor-only geometry lock", () => {
  assert.throws(() => parsePaperDollComponentGeometryReview({
    schemaVersion: 1,
    generatedFrom: { componentAuthorityQueuePath: "queue.json", componentAuthorityQueueSha256: hash },
    summary: {
      sourceIdentityCount: 1,
      descriptorReviewGroupCount: 1,
      verifiedSharedAuthorityGroupCount: 0,
      verifiedSharedAuthorityIdentityCount: 0,
      localReconciliationGroupCount: 0,
      sourceReadyPhysicalReviewGroupCount: 1,
      sourceIncompleteGroupCount: 0,
    },
    groups: [{
      reviewGroupKey: "review__sprayer__13-415",
      descriptorSignature: "sprayer :: 13-415 :: Fine Mist Sprayer :: Spray",
      slotProposals: ["sprayer"],
      neckFinishEvidence: ["13-415"],
      applicatorEvidence: ["Fine Mist Sprayer"],
      capStyleEvidence: ["Spray"],
      sourceIdentities: ["sprayer-a"],
      appearanceEvidence: ["Gold"],
      sourceReferenceUrls: ["https://example.com/a.png"],
      sourceIdentityCount: 1,
      sourceReferenceObservedCount: 1,
      localVariantCount: 0,
      localGeometryFamilyIds: [],
      localAuthorityMaskSha256: [],
      status: "source-ready-physical-review",
      priority: "P1-PRODUCE",
      geometryClaim: "verified-local-exact-alpha",
      nextGate: "Review source.",
      issues: [],
    }],
    claimPolicy: { descriptorClusterIsGeometryLock: false, exactSharedAuthorityRequiredForVerifiedClaim: true, compatibilityInferred: false },
    mutationPolicy: { assetsGenerated: false, remoteWritesPerformed: false, currentReleaseChanged: false, sanityChanged: false },
  }));
});
