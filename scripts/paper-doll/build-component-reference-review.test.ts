import assert from "node:assert/strict";
import test from "node:test";

import { buildComponentReferenceReview, COMPONENT_REFERENCE_CONFIRMATION } from "./build-component-reference-review";

const cyl5RollOnCaps = "geometry-review__cap__13-415__e45a8a2c38";

test("13-415 roll-on cap review plans nine exact source references without geometry claims", async () => {
  const result = await buildComponentReferenceReview({ groupKey: cyl5RollOnCaps });
  assert.equal(result.mode, "dry-run");
  assert.equal(result.plan.sourceIdentityCount, 9);
  assert.equal(result.plan.sourceReferenceCount, 9);
  assert.deepEqual(result.plan.sourceIdentitiesWithoutImage, []);
  assert.equal(result.plan.geometryClaim, "unverified-descriptor-cluster");
  assert.equal(result.plan.mutationPolicy.remoteWritesPerformed, false);
});

test("reference download refuses execution without an explicit confirmation", async () => {
  await assert.rejects(
    buildComponentReferenceReview({ groupKey: cyl5RollOnCaps, execute: true }),
    new RegExp(COMPONENT_REFERENCE_CONFIRMATION),
  );
});
