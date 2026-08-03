import assert from "node:assert/strict";
import { mkdtemp, readFile, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import sharp from "sharp";

import { buildParametricComponentReviewBook } from "./build-parametric-component-review-book";

test("builds one review-only book for every rendered parametric family without promoting authority", async () => {
  const outputRoot = await mkdtemp(path.join(os.tmpdir(), "paper-doll-parametric-review-book-"));
  const manifest = await buildParametricComponentReviewBook({ outputRoot });

  assert.equal(manifest.summary.geometryFamilyCount, 12);
  assert.equal(manifest.summary.candidateOutputCount, 37);
  assert.equal(manifest.summary.catalogIdentityCount, 38);
  assert.deepEqual(manifest.reviewGroups.map((group) => group.neckFinish), [
    "8-425",
    "13-415",
    "15-415",
    "18-400",
    "18-415",
    "20-400",
  ]);
  assert.ok(manifest.families.every((family) => family.geometryLocked === false));
  assert.ok(manifest.families.every((family) => family.productionPlateEligible === false));
  assert.ok(manifest.families.every((family) => family.authorityReviewRequired === true));
  assert.deepEqual(manifest.mutationPolicy, {
    candidatePixelsChanged: false,
    approvalWritten: false,
    remoteWritesPerformed: false,
    currentReleaseChanged: false,
    sanityChanged: false,
  });

  const persisted = JSON.parse(await readFile(path.join(outputRoot, "review-book-manifest.json"), "utf8"));
  assert.deepEqual(persisted, manifest);
  assert.ok((await stat(path.join(outputRoot, manifest.overview.path))).size > 0);
  assert.equal((await sharp(path.join(outputRoot, manifest.overview.path)).metadata()).format, "png");
  for (const group of manifest.reviewGroups) {
    assert.ok((await stat(path.join(outputRoot, group.page.path))).size > 0);
    assert.equal((await sharp(path.join(outputRoot, group.page.path)).metadata()).format, "png");
  }
});
