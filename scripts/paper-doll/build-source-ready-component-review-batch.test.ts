import assert from "node:assert/strict";
import test from "node:test";

import { buildSourceReadyComponentReviewBatch, SOURCE_READY_BATCH_CONFIRMATION } from "./build-source-ready-component-review-batch";

test("source-ready batch inventories every reviewable component lane without production claims", async () => {
  const result = await buildSourceReadyComponentReviewBatch();
  assert.equal(result.mode, "dry-run");
  assert.equal(result.plan.groupCount, 28);
  assert.equal(result.plan.sourceIdentityCount, 100);
  assert.equal(result.plan.sourceReferenceCount, 117);
  assert.equal(result.plan.geometryClaim, "none");
  assert.equal(result.plan.productionPolicy.authorityCreated, false);
  assert.equal(result.plan.mutationPolicy.remoteWritesPerformed, false);
});

test("source-ready batch refuses downloads without explicit confirmation", async () => {
  await assert.rejects(
    buildSourceReadyComponentReviewBatch({ execute: true }),
    new RegExp(SOURCE_READY_BATCH_CONFIRMATION),
  );
});
