import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import sharp from "sharp";

import { buildSprayer13HeadAuthorityReview } from "./build-sprayer-13-415-head-authority-review";

function sha256(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

async function syntheticHead(color: { r: number; g: number; b: number }): Promise<Buffer> {
  const width = 20;
  const height = 40;
  const data = Buffer.alloc(width * height * 4);
  for (let y = 3; y <= 36; y += 1) {
    for (let x = 3; x <= 16; x += 1) {
      const offset = (y * width + x) * 4;
      data[offset] = color.r;
      data[offset + 1] = color.g;
      data[offset + 2] = color.b;
      data[offset + 3] = 255;
    }
  }
  const islandOffset = 4;
  data[islandOffset] = color.r;
  data[islandOffset + 1] = color.g;
  data[islandOffset + 2] = color.b;
  data[islandOffset + 3] = 255;
  return sharp(data, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

test("builds eight-style-ready exact-alpha sprayer head candidates without promoting geometry", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "sprayer-13-review-"));
  const repositoryRoot = path.join(root, "repo");
  const archiveRoot = path.join(root, "archive");
  const outputRoot = path.join(root, "output");
  await Promise.all([mkdir(repositoryRoot, { recursive: true }), mkdir(archiveRoot, { recursive: true })]);

  const approved = await syntheticHead({ r: 210, g: 170, b: 70 });
  const black = await syntheticHead({ r: 20, g: 20, b: 20 });
  const silver = await syntheticHead({ r: 190, g: 195, b: 200 });
  await writeFile(path.join(repositoryRoot, "approved.png"), approved);
  const blackPsd = Buffer.from("black-source");
  const silverPsd = Buffer.from("silver-source");
  await writeFile(path.join(archiveRoot, "black.psd"), blackPsd);
  await writeFile(path.join(archiveRoot, "silver.psd"), silverPsd);

  const result = await buildSprayer13HeadAuthorityReview({
    recipe: {
      schemaVersion: 1,
      reviewId: "synthetic-sprayer-review",
      kitId: "sprayer__13-415__physical-v1",
      canonicalCanvas: { width: 100, height: 120 },
      approvedSource: {
        repositoryRelativePath: "approved.png",
        originalFilename: "approved.png",
        sha256: sha256(approved),
        reviewedBy: "named reviewer",
        reviewedAt: "2026-08-03T00:00:00.000Z",
        approvalScope: "source-appearance-and-silhouette-evidence",
        alphaCleanup: {
          expectedSourceComponents: 2,
          maxDiscardedComponentPixels: 1,
          maxDiscardedTotalPixels: 1,
        },
      },
      sceneSources: [
        {
          variantKey: "MBLK",
          finish: "matte-black",
          originalFilename: "black.psd",
          archiveRelativePath: "black.psd",
          sha256: sha256(blackPsd),
          sceneIndex: 2,
          layerName: "Head",
          alphaCleanup: {
            expectedSourceComponents: 2,
            maxDiscardedComponentPixels: 1,
            maxDiscardedTotalPixels: 1,
          },
        },
        {
          variantKey: "SSLV",
          finish: "mirror-silver",
          originalFilename: "silver.psd",
          archiveRelativePath: "silver.psd",
          sha256: sha256(silverPsd),
          sceneIndex: 2,
          layerName: "Head",
          alphaCleanup: {
            expectedSourceComponents: 2,
            maxDiscardedComponentPixels: 1,
            maxDiscardedTotalPixels: 1,
          },
        },
      ],
      authorityReviewState: "named-geometry-review-required",
      productionEligible: false,
      geometryLocked: false,
    },
    repositoryRoot,
    archiveRoot,
    outputRoot,
    generatedAt: "2026-08-03T00:00:00.000Z",
    decodePsdScene: async (sourcePath) => sourcePath.endsWith("black.psd") ? black : silver,
  });

  assert.equal(result.manifest.summary.variantCount, 2);
  assert.equal(result.manifest.summary.exactAlphaAcrossVariants, true);
  assert.equal(result.manifest.geometryLocked, false);
  assert.equal(result.manifest.productionEligible, false);
  assert.deepEqual(result.manifest.excludedResponsibilities, [
    "opaque-protective-overcap",
    "sprayer-dip-tube",
  ]);
  assert.equal(result.manifest.candidates.every((candidate) => candidate.qa.exactAlpha), true);
  assert.equal(result.manifest.candidates.every((candidate) => candidate.boxes.placementBoundsPx === null), true);
  assert.equal(result.manifest.mutationPolicy.currentReleaseChanged, false);
  assert.equal(result.manifest.mutationPolicy.sanityChanged, false);
  assert.ok((await readFile(result.contactSheetPath)).length > 0);
});
