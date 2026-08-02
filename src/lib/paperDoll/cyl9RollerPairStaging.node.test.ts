import assert from "node:assert/strict";
import { test } from "node:test";

import { buildCyl9RollerPairJobPlan } from "./cyl9RollerPairStaging.node";

const ref = (bucket: "paper-doll-approved" | "paper-doll-candidates" | "paper-doll-sources", sha: string) => ({
  bucket,
  path: `4ab1ac72-cd7e-4faf-9152-5aa5f2862411/CYL-9ML/test/${sha}.png`,
  sha256: sha,
  contentType: "image/png",
  byteSize: 123,
});

test("roller pair staging creates two immutable release-neutral manual jobs", () => {
  const plan = buildCyl9RollerPairJobPlan({
    organizationId: "4ab1ac72-cd7e-4faf-9152-5aa5f2862411",
    initiatedBy: "d4cd4ae9-a9a8-4ea6-ab6f-fd1e19078e5e",
    componentId: "f31e2125-d2fb-4894-afa1-986f44e294d8",
    parentComponentVersionId: "f1fb4f6e-43c9-4404-b294-a9c900093f1c",
    parent: ref("paper-doll-approved", "1".repeat(64)),
    authorityMask: ref("paper-doll-candidates", "2".repeat(64)),
    assemblyContext: ref("paper-doll-approved", "3".repeat(64)),
    plastic: { ...ref("paper-doll-sources", "4".repeat(64)), originalFilename: "plastic-v03.png" },
    metal: { ...ref("paper-doll-sources", "5".repeat(64)), originalFilename: "metal-v03.png" },
  });

  assert.equal(plan.jobs.length, 2);
  assert.deepEqual(plan.jobs.map((job) => job.requirement_key), [
    "CYL-9ML:ROLLER:PLASTIC",
    "CYL-9ML:ROLLER:METAL",
  ]);
  assert.ok(plan.jobs.every((job) => job.provider === "manual" && job.model === "manual-v1"));
  assert.ok(plan.jobs.every((job) => job.authoritative_mask_ref.sha256 === "2".repeat(64)));
  assert.ok(plan.jobs.every((job) => job.edit_mask_ref.sha256 === "2".repeat(64)));
  assert.equal(plan.releaseMutation, false);
  assert.equal(plan.sanityPublished, false);
});
