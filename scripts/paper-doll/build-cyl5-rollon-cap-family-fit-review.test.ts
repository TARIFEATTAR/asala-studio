import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import sharp from "sharp";

import { buildCyl5RollonCapFamilyFitReview } from "./build-cyl5-rollon-cap-family-fit-review";

const sha256 = (value: Buffer) => createHash("sha256").update(value).digest("hex");

test("builds review-only workbench and catalog presentations for every cap variant", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "cyl5-rollon-fit-"));
  const bodyDirectory = path.join(root, "body");
  const capDirectory = path.join(root, "caps");
  const outputDirectory = path.join(root, "review");
  await Promise.all([
    import("node:fs/promises").then(({ mkdir }) => mkdir(bodyDirectory, { recursive: true })),
    import("node:fs/promises").then(({ mkdir }) => mkdir(path.join(capDirectory, "clamped"), { recursive: true })),
  ]);

  const body = await sharp({ create: { width: 2080, height: 2288, channels: 4, background: "#F5F3EF" } })
    .composite([{ input: Buffer.from(`<svg width="338" height="1013"><rect width="338" height="1013" rx="40" fill="#b7aea0"/></svg>`), left: 871, top: 1070 }])
    .png()
    .toBuffer();
  await writeFile(path.join(bodyDirectory, "canonical-review-candidate.png"), body);
  await writeFile(path.join(bodyDirectory, "review-manifest.json"), `${JSON.stringify({
    geometryKey: "body__cylinder__5ml__53x17x17.0__test",
    lifecycleState: "candidate",
    geometryLocked: false,
    productionPlateEligible: false,
    dimensionsMm: { bodyHeight: 53, widthAxis: 17, depthAxis: 17 },
    workbenchScale: { canvas: { width: 2080, height: 2288 }, centerX: 1040, baselineY: 2082, pixelsPerMm: 19.121143 },
    placementBoundsPx: { left: 871, top: 1070, width: 338, height: 1013 },
    artifacts: { canonicalCandidate: { path: "canonical-review-candidate.png", sha256: sha256(body), width: 2080, height: 2288 } },
  }, null, 2)}\n`);

  const cap = await sharp({ create: { width: 140, height: 205, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: Buffer.from(`<svg width="120" height="170"><rect width="120" height="170" rx="8" fill="#d3b45d"/></svg>`), left: 10, top: 18 }])
    .png()
    .toBuffer();
  for (const key of ["GOLD", "SILVER"]) await writeFile(path.join(capDirectory, "clamped", `${key}.png`), cap);
  const recipePath = path.join(root, "recipe.json");
  await writeFile(recipePath, `${JSON.stringify({
    recipeId: "test-cap-family",
    geometryFamilyId: "closure__13-415__test",
    neckFinish: "13-415",
    nominalDimensionsMm: { outsideDiameter: 17, height: 24, verified: true },
    variants: [
      { variantKey: "GOLD", sourceIdentity: "gold", material: "mirror-gold", decoration: "none" },
      { variantKey: "SILVER", sourceIdentity: "silver", material: "mirror-silver", decoration: "none" },
    ],
  }, null, 2)}\n`);
  await writeFile(path.join(capDirectory, "candidate-manifest.json"), `${JSON.stringify({
    recipeId: "test-cap-family",
    geometryFamilyId: "closure__13-415__test",
    authorityState: "dimension-calibrated-profile-review",
    outputs: [
      { variantKey: "GOLD", path: "clamped/GOLD.png", sha256: sha256(cap) },
      { variantKey: "SILVER", path: "clamped/SILVER.png", sha256: sha256(cap) },
    ],
    summary: { minimumPairwiseAlphaIou: 1, maximumPairwiseMismatchedPixels: 0, geometryLocked: false, productionPlateEligible: false, authorityReviewRequired: true },
  }, null, 2)}\n`);

  const manifest = await buildCyl5RollonCapFamilyFitReview({
    bodyReviewDirectory: bodyDirectory,
    capRecipePath: recipePath,
    capCandidateDirectory: capDirectory,
    outputDirectory,
    assembledHeightMm: 65,
  });

  assert.equal(manifest.summary.variantCount, 2);
  assert.equal(manifest.summary.workbenchAssemblyCount, 2);
  assert.equal(manifest.summary.catalogPresentationCount, 2);
  assert.equal(manifest.lifecycleState, "family-fit-review-required");
  assert.equal(manifest.geometryLocked, false);
  assert.equal(manifest.productionPlateEligible, false);
  assert.equal(manifest.placement.physicalOverlapMm, 12);
  assert.equal(manifest.catalogPresentation.targetAssembledHeightPct, 61);
  assert.ok(manifest.variants.every((variant) => variant.placementBoundsPx.left === manifest.variants[0].placementBoundsPx.left));
  assert.ok(manifest.variants.every((variant) => variant.catalogPresentation.uniformScale === manifest.variants[0].catalogPresentation.uniformScale));
  assert.deepEqual(manifest.mutationPolicy, {
    candidatePixelsChanged: false,
    approvalWritten: false,
    placementLockWritten: false,
    remoteWritesPerformed: false,
    currentReleaseChanged: false,
    sanityChanged: false,
  });
  assert.ok((await stat(path.join(outputDirectory, manifest.contactSheet.path))).size > 0);
  assert.deepEqual(JSON.parse(await readFile(path.join(outputDirectory, "family-fit-manifest.json"), "utf8")), manifest);
});
