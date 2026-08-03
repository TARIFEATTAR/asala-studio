import assert from "node:assert/strict";
import { mkdtemp, readFile, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import sharp from "sharp";

import {
  buildCylinderBodyAuthorityReview,
  deriveCylinderWorkbenchScale,
} from "./build-cylinder-body-authority-review";

test("derives smaller cylinder placement from the locked 9 ml rig scale", () => {
  const scale = deriveCylinderWorkbenchScale(53);

  assert.equal(scale.canvas.width, 2080);
  assert.equal(scale.canvas.height, 2288);
  assert.equal(scale.centerX, 1040);
  assert.equal(scale.baselineY, 2082);
  assert.equal(scale.referenceBodyHeightMm, 70);
  assert.equal(scale.referenceFillFraction, 0.585);
  assert.equal(scale.targetBodyHeightPx, 1013);
  assert.equal(scale.targetFillFraction, 0.4429);
});

test("builds a canonical review candidate without claiming body authority", async () => {
  const testRoot = await mkdtemp(path.join(os.tmpdir(), "cyl5-body-review-"));
  const sourcePath = path.join(testRoot, "source.png");
  const outputRoot = path.join(testRoot, "output");

  const bottle = Buffer.from(`<svg width="180" height="360" xmlns="http://www.w3.org/2000/svg">
    <rect width="180" height="360" fill="#eee7d8"/>
    <rect x="68" y="24" width="44" height="45" rx="6" fill="#8b857d"/>
    <rect x="45" y="64" width="90" height="260" rx="12" fill="#aaa49a"/>
  </svg>`);
  await sharp(bottle).png().toFile(sourcePath);

  const manifest = await buildCylinderBodyAuthorityReview({
    sourcePath,
    outputRoot,
    capacityMl: 5,
    geometryKey: "body__cylinder__5ml__53x17x17.0__test",
    dimensionsMm: { bodyHeight: 53, widthAxis: 17, depthAxis: 17 },
    sourceBoundsPx: { left: 45, top: 24, width: 90, height: 300 },
    editBoundsPx: { left: 20, top: 10, width: 140, height: 330 },
    calibration: {
      method: "explicit-operator-bounds-with-source-specific-review",
      rationale: "Synthetic contract fixture.",
    },
  });

  assert.equal(manifest.lifecycleState, "candidate");
  assert.equal(manifest.geometryLocked, false);
  assert.equal(manifest.productionPlateEligible, false);
  assert.equal(manifest.authorityBoundsPx, null);
  assert.equal(manifest.workbenchScale.targetBodyHeightPx, 1013);
  assert.equal(manifest.catalogPresentation.scaleContractVersion, "best-bottles-catalog-scale-v1");
  assert.equal(manifest.catalogPresentation.targetAssembledHeightPct, 61);
  assert.equal(manifest.catalogPresentation.transformTiming, "after-paper-doll-assembly");
  assert.equal(manifest.catalogPresentation.resolvedAssemblyTransform, null);
  assert.equal(manifest.placementBoundsPx.height, 1013);
  assert.equal(manifest.placementBoundsPx.left + Math.round(manifest.placementBoundsPx.width / 2), 1040);
  assert.equal(manifest.placementBoundsPx.top + manifest.placementBoundsPx.height - 1, 2082);
  assert.deepEqual(manifest.mutationPolicy, {
    sourcePixelsChanged: false,
    reviewCandidateWritten: true,
    approvalWritten: false,
    remoteWritesPerformed: false,
    currentReleaseChanged: false,
    sanityChanged: false,
  });

  const persisted = JSON.parse(await readFile(path.join(outputRoot, "review-manifest.json"), "utf8"));
  assert.deepEqual(persisted, manifest);
  assert.ok((await stat(path.join(outputRoot, manifest.artifacts.canonicalCandidate.path))).size > 0);
  assert.ok((await stat(path.join(outputRoot, manifest.artifacts.contactSheet.path))).size > 0);
  const candidateMetadata = await sharp(path.join(outputRoot, manifest.artifacts.canonicalCandidate.path)).metadata();
  assert.equal(candidateMetadata.width, 2080);
  assert.equal(candidateMetadata.height, 2288);
});
