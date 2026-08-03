import assert from "node:assert/strict";
import { test } from "node:test";

import { buildComponentAuthorityQueue } from "./build-component-authority-queue";

test("component authority queue covers the explicit source inventory without inventing fit", async () => {
  const queue = await buildComponentAuthorityQueue();
  assert.equal(queue.summary.sourceIdentityCount, 148);
  assert.equal(queue.summary.exactWebsiteSkuCount, 146);
  assert.equal(queue.summary.localPilotAuthorityIdentityCount, 19);
  assert.deepEqual(queue.missingSourceResponsibilities.map((item) => item.slot).sort(), ["glass-rod", "reducer", "stopper"]);
  assert.ok(queue.items.every((item) => item.compatibilityStatus === "unverified"));
  assert.ok(queue.items.every((item) => item.mutationPolicy.candidatesGenerated === false));
});

test("local pilot source identities retain exact authority lineage", async () => {
  const queue = await buildComponentAuthorityQueue();
  const local = queue.items.filter((item) => item.authorityStatus === "local-pilot-authority-exists");
  assert.equal(local.length, 19);
  assert.ok(local.every((item) => item.geometryGroupingStatus === "verified-local-pilot"));
  assert.ok(local.every((item) => item.localPlateVariants.length > 0));
  assert.ok(local.every((item) => item.localPlateVariants.every((variant) => variant.authorityStatus === "approved" && variant.authorityId && variant.authorityMaskSha256)));
});
