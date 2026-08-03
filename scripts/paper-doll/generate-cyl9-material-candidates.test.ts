import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import sharp from "sharp";

import {
  buildCyl9GenerationConditioning,
  generateCyl9MaterialCandidates,
  measureAuthorityMaterialFill,
  planCyl9MaterialGeneration,
} from "./generate-cyl9-material-candidates";

test("the paid material plan contains only the sixteen real provider gaps", async () => {
  const plan = await planCyl9MaterialGeneration();
  assert.equal(plan.jobs.length, 16);
  assert.equal(plan.estimatedCostUsd, 6.88);
  assert.ok(plan.jobs.every(({ provider }) => provider === "openai"));
  assert.equal(plan.mutationPolicy.approvalsWritten, false);
  assert.equal(plan.mutationPolicy.currentReleaseChanged, false);
  assert.equal(plan.mutationPolicy.sanityChanged, false);
});

test("conditioning uses the full canonical canvas and exact inverted authority alpha", async () => {
  const plan = await planCyl9MaterialGeneration();
  const prepared = await buildCyl9GenerationConditioning(plan.jobs[0]);
  const [conditioning, mask, authority] = await Promise.all([
    sharp(prepared.conditioningPng).metadata(),
    sharp(prepared.editMaskPng).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(plan.jobs[0].authorityMaskPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
  ]);
  assert.equal(conditioning.width, 2080);
  assert.equal(conditioning.height, 2288);
  assert.equal(mask.info.width, authority.info.width);
  assert.equal(mask.info.height, authority.info.height);
  for (let index = 0; index < mask.info.width * mask.info.height; index++) {
    assert.equal(mask.data[index * 4 + 3], 255 - authority.data[index * 4 + 3]);
  }
});

test("material-fill QA is calibrated against each real reference instead of one material threshold", async () => {
  const plan = await planCyl9MaterialGeneration();
  const matteSilver = plan.jobs.find(({ componentKey }) => (
    componentKey === "closure__17-415__rollon-overcap__MSLV"
  ));
  const white = plan.jobs.find(({ componentKey }) => (
    componentKey === "closure__17-415__rollon-overcap__WHT"
  ));
  assert.ok(matteSilver);
  assert.ok(white);
  const silverPrepared = await buildCyl9GenerationConditioning(matteSilver);
  const whitePrepared = await buildCyl9GenerationConditioning(white);
  const silverPass = await measureAuthorityMaterialFill({
    outputPng: silverPrepared.conditioningPng,
    conditioningPng: silverPrepared.conditioningPng,
    authorityMaskPng: silverPrepared.authorityMaskPng,
  });
  const whitePass = await measureAuthorityMaterialFill({
    outputPng: whitePrepared.conditioningPng,
    conditioningPng: whitePrepared.conditioningPng,
    authorityMaskPng: whitePrepared.authorityMaskPng,
  });
  assert.equal(silverPass.status, "pass");
  assert.equal(whitePass.status, "pass");
  assert.ok(whitePass.calibratedMaxLargestRegionRatio > silverPass.calibratedMaxLargestRegionRatio);

  const defective = await sharp(silverPrepared.conditioningPng)
    .composite([{
      input: await sharp({
        create: { width: 344, height: 180, channels: 4, background: "#F5F3EF" },
      }).png().toBuffer(),
      left: matteSilver.authorityBoundsPx.left,
      top: matteSilver.authorityBoundsPx.top,
    }])
    .png()
    .toBuffer();
  const failed = await measureAuthorityMaterialFill({
    outputPng: defective,
    conditioningPng: silverPrepared.conditioningPng,
    authorityMaskPng: silverPrepared.authorityMaskPng,
  });
  assert.equal(failed.status, "fail");
  assert.ok(failed.largestBoneLikeRegionRatio > failed.calibratedMaxLargestRegionRatio);

  const translucent = await measureAuthorityMaterialFill({
    outputPng: whitePrepared.conditioningPng,
    conditioningPng: whitePrepared.conditioningPng,
    authorityMaskPng: whitePrepared.authorityMaskPng,
    materialClass: "translucent",
  });
  assert.equal(translucent.status, "review-required");
});

test("local execution writes exact-alpha candidates and never writes approval or release state", async () => {
  const outputDirectory = await mkdtemp(path.join(tmpdir(), "cyl9-gpt-materials-"));
  let calls = 0;
  try {
    const result = await generateCyl9MaterialCandidates({
      mode: "execute",
      confirmation: "CYL9-GPT-MATERIALS",
      authorizePaidGeneration: true,
      outputDirectory,
      limit: 1,
      concurrency: 1,
    }, {
      generate: async ({ conditioningPng }) => {
        calls++;
        return { png: conditioningPng, usage: { test: true }, revisedPrompt: null };
      },
    });
    assert.equal(calls, 1);
    assert.equal(result.generatedCandidates, 1);
    assert.equal(result.failedCandidates, 0);
    assert.equal(result.mutationPolicy.approvalsWritten, false);
    assert.equal(result.mutationPolicy.placementsWritten, false);
    assert.equal(result.mutationPolicy.currentReleaseChanged, false);
    assert.equal(result.mutationPolicy.sanityChanged, false);

    const index = JSON.parse(await readFile(result.indexPath!, "utf8")) as {
      artifacts: Array<{ geometryLocked: boolean; mismatchedPixels: number; lifecycleState: string }>;
    };
    assert.equal(index.artifacts.length, 1);
    assert.equal(index.artifacts[0].geometryLocked, true);
    assert.equal(index.artifacts[0].mismatchedPixels, 0);
    assert.equal(index.artifacts[0].lifecycleState, "candidate");

    const resumed = await generateCyl9MaterialCandidates({
      mode: "execute",
      confirmation: "CYL9-GPT-MATERIALS",
      authorizePaidGeneration: true,
      outputDirectory,
      limit: 1,
      concurrency: 1,
    }, {
      generate: async () => {
        calls++;
        throw new Error("resume should not call the provider");
      },
    });
    assert.equal(calls, 1);
    assert.equal(resumed.resumedCandidates, 1);
  } finally {
    await rm(outputDirectory, { recursive: true, force: true });
  }
});

test("paid execution requires both the confirmation token and explicit authorization", async () => {
  await assert.rejects(
    () => generateCyl9MaterialCandidates({ mode: "execute" }),
    /confirmation/i,
  );
  await assert.rejects(
    () => generateCyl9MaterialCandidates({
      mode: "execute",
      confirmation: "CYL9-GPT-MATERIALS",
    }),
    /paid generation/i,
  );
});
