import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { buildCompoundComponentReviewQueue } from "./build-compound-component-review-queue";

test("queues every potentially compound catalog lane without pulling in ordinary caps", async () => {
  const groups = JSON.parse(await readFile(path.resolve(
    "docs/paper-doll-rig/component-geometry-review-groups.json",
  ), "utf8"));
  const decisions = JSON.parse(await readFile(path.resolve(
    "docs/paper-doll-rig/component-physical-review-decisions.json",
  ), "utf8"));

  const queue = buildCompoundComponentReviewQueue(groups, decisions);

  assert.equal(queue.summary.catalogReviewLaneCount, 20);
  assert.deepEqual(queue.summary.laneTypeCounts, {
    pump: 2,
    sprayer: 6,
    dropper: 6,
    "bulb-sprayer": 4,
    "bulb-sprayer+sprayer": 1,
    "compound-applicator": 1,
  });
  assert.ok(queue.items.every((item) => item.laneType !== "cap"));
  assert.ok(queue.items.every((item) => item.geometryClaim === "none"));
});

test("preserves source readiness and reviewed decomposition evidence as separate facts", async () => {
  const groups = JSON.parse(await readFile(path.resolve(
    "docs/paper-doll-rig/component-geometry-review-groups.json",
  ), "utf8"));
  const decisions = JSON.parse(await readFile(path.resolve(
    "docs/paper-doll-rig/component-physical-review-decisions.json",
  ), "utf8"));

  const queue = buildCompoundComponentReviewQueue(groups, decisions);
  const sprayer15415 = queue.items.find((item) => (
    item.reviewGroupKey === "geometry-review__sprayer__15-415__01e5312a22"
  ));
  const pump17415 = queue.items.find((item) => (
    item.reviewGroupKey === "geometry-review__pump__17-415__d4ca90a05c"
  ));

  assert.equal(sprayer15415?.auditStatus, "source-extraction-review-created-authority-required");
  assert.equal(sprayer15415?.sourceStatus, "source-ready-physical-review");
  assert.ok(sprayer15415?.evidencePaths.some((value) => value.endsWith(
    "SPRAYER-15-415-SOURCE-EXTRACTION-REVIEW.md",
  )));
  assert.equal(pump17415?.auditStatus, "decomposition-audit-required");
  assert.equal(pump17415?.sourceStatus, "local-authorities-require-reconciliation");
  assert.equal(queue.mutationPolicy.currentReleaseChanged, false);
  assert.equal(queue.mutationPolicy.sanityChanged, false);
});

test("treats the queue as a review warning rather than an automatic plate-count expansion", async () => {
  const groups = JSON.parse(await readFile(path.resolve(
    "docs/paper-doll-rig/component-geometry-review-groups.json",
  ), "utf8"));
  const decisions = JSON.parse(await readFile(path.resolve(
    "docs/paper-doll-rig/component-physical-review-decisions.json",
  ), "utf8"));

  const queue = buildCompoundComponentReviewQueue(groups, decisions);

  assert.equal(queue.summary.finalReusablePlateDelta, null);
  assert.ok(queue.items.every((item) => item.productionPlateDelta === null));
  assert.ok(queue.items.every((item) => item.reviewQuestions.length >= 3));
});
