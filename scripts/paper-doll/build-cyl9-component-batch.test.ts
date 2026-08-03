import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { buildCyl9ComponentBatch } from "./build-cyl9-component-batch";

test("the CYL-9ML batch plans selectable components and excludes compound-source-only overcaps", async () => {
  const plan = await buildCyl9ComponentBatch({ mode: "plan" });
  assert.equal(plan.jobs.length, 21);
  assert.equal(new Set(plan.jobs.map((job) => job.componentKey)).size, 21);
  assert.ok(plan.jobs.every((job) => !job.componentKey.startsWith("overcap__17-415__")));
  assert.equal(plan.reviewAssemblies, 105);
  assert.equal(plan.catalogMappings, 145);
  assert.equal(plan.mutationPolicy.currentReleaseChanged, false);
  assert.equal(plan.mutationPolicy.sanityChanged, false);
});

test("the plan uses the versioned GPT Image price estimate and preserves four-box evidence", async () => {
  const plan = await buildCyl9ComponentBatch({ mode: "plan" });
  assert.equal(plan.unpricedProviderJobs, 0);
  assert.equal(plan.knownEstimatedCostUsd, 6.02);
  assert.ok(plan.jobs.every((job) => job.costStatus === "known"));
  assert.ok(plan.jobs.every((job) => job.sourceBoundsPx && job.editBoundsPx && job.authorityBoundsPx && job.placementBoundsPx));
  assert.ok(plan.jobs.filter((job) => job.materialClass === "rhinestone").every((job) => job.rhinestoneLayout?.length === 8));
});

test("execute requires a confirmation and refuses remote targets without a second flag", async () => {
  await assert.rejects(
    () => buildCyl9ComponentBatch({ mode: "execute", target: "local" }),
    /confirmation/i,
  );
  await assert.rejects(
    () => buildCyl9ComponentBatch({
      mode: "execute",
      target: "remote",
      confirmation: "CYL9-MATERIAL-BATCH",
    }),
    /remote-write/i,
  );
});

test("local execute writes append-only candidate requests without approvals or release writes", async () => {
  const outputDirectory = await mkdtemp(path.join(tmpdir(), "cyl9-component-batch-"));
  const result = await buildCyl9ComponentBatch({
    mode: "execute",
    target: "local",
    confirmation: "CYL9-MATERIAL-BATCH",
    outputDirectory,
  });
  assert.equal(result.requestPaths.length, 21);
  const request = JSON.parse(await readFile(result.requestPaths[0], "utf8"));
  assert.equal(request.lifecycleState, "queued");
  assert.deepEqual(request.mutationPolicy, {
    approvalWritten: false,
    placementWritten: false,
    currentReleaseChanged: false,
    sanityChanged: false,
  });
});
