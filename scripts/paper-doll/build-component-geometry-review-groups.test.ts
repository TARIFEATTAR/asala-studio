import assert from "node:assert/strict";
import test from "node:test";

import { buildComponentGeometryReviewGroups } from "./build-component-geometry-review-groups";

test("component geometry review covers all appearances without claiming descriptor geometry", async () => {
  const review = await buildComponentGeometryReviewGroups();
  assert.deepEqual(review.summary, {
    sourceIdentityCount: 148,
    descriptorReviewGroupCount: 42,
    verifiedSharedAuthorityGroupCount: 1,
    verifiedSharedAuthorityIdentityCount: 10,
    localReconciliationGroupCount: 2,
    sourceReadyPhysicalReviewGroupCount: 28,
    sourceIncompleteGroupCount: 11,
  });
  assert.equal(review.claimPolicy.descriptorClusterIsGeometryLock, false);
  assert.equal(review.claimPolicy.compatibilityInferred, false);
  assert.equal(new Set(review.groups.flatMap((group) => group.sourceIdentities)).size, 148);
});

test("only the ten 17-415 roll-on cap appearances earn one shared exact authority", async () => {
  const review = await buildComponentGeometryReviewGroups();
  const verified = review.groups.filter((group) => group.geometryClaim === "verified-local-exact-alpha");
  assert.equal(verified.length, 1);
  assert.equal(verified[0].sourceIdentityCount, 10);
  assert.deepEqual(verified[0].slotProposals, ["cap"]);
  assert.deepEqual(verified[0].neckFinishEvidence, ["17-415"]);
  assert.deepEqual(verified[0].localAuthorityMaskSha256.length, 1);
  assert.deepEqual(verified[0].localGeometryFamilyIds, ["closure__17-415__rollon-overcap__v2"]);
});

test("17-415 pumps and sprayers remain reconciliation work rather than geometry locked", async () => {
  const review = await buildComponentGeometryReviewGroups();
  const reconciliation = review.groups.filter((group) => group.status === "local-authorities-require-reconciliation");
  assert.equal(reconciliation.length, 2);
  assert.deepEqual(reconciliation.map((group) => group.slotProposals[0]).sort(), ["pump", "sprayer"]);
  assert.ok(reconciliation.every((group) => group.geometryClaim === "unverified-descriptor-cluster"));
});
