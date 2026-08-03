import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import sharp from "sharp";

import {
  centerCutoutOnCanonicalCanvas,
  extractComponentKitReview,
  planComponentKitReviewExtraction,
} from "./extract-component-kit-review";

function sha256(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function fixtureRecipe(sourceSha256: string) {
  return {
    schemaVersion: 1,
    kitId: "sprayer__test__physical-v1",
    sourceReviewGroupKey: "geometry-review__sprayer__test",
    sourceCompositeProductionEligible: false,
    canonicalCanvas: { width: 20, height: 24 },
    sources: [
      {
        sourceId: "layered-source",
        sourceType: "photoshop-layered-source",
        originalFilename: "sprayer.psd",
        archiveRelativePath: "sprayers/sprayer.psd",
        sha256: sourceSha256,
        productionEligible: false,
      },
    ],
    parts: [
      {
        partId: "sprayer-head",
        responsibility: "exterior-dispenser",
        outputPolicy: "reusable-full-canvas-plate",
        reviewFraming: "center-nontransparent-bounds",
        productionAnchor: "mount-axis-seat",
        independentlySelectable: true,
        assemblyContextQa: false,
        sourceSelectors: [
          { sourceId: "layered-source", method: "psd-layer-scene", sceneIndex: 2, layerName: "Head" },
        ],
      },
      {
        partId: "protective-overcap",
        responsibility: "secondary-overcap",
        outputPolicy: "reusable-full-canvas-plate",
        reviewFraming: "center-nontransparent-bounds",
        productionAnchor: "mount-axis-seat",
        independentlySelectable: true,
        assemblyContextQa: true,
        sourceSelectors: [
          { sourceId: "layered-source", method: "psd-layer-scene", sceneIndex: 3, layerName: "Cap" },
        ],
      },
      {
        partId: "dip-tube",
        responsibility: "internal-delivery",
        outputPolicy: "body-contextual-weld",
        reviewFraming: "preserve-source-bounds",
        productionAnchor: "body-centerline-to-interior-base",
        independentlySelectable: false,
        assemblyContextQa: true,
        sourceSelectors: [
          { sourceId: "layered-source", method: "psd-layer-scene", sceneIndex: 4, layerName: "Tube" },
        ],
      },
    ],
  };
}

async function cutoutFixture(): Promise<Buffer> {
  const pixels = Buffer.alloc(8 * 6 * 4);
  for (let y = 1; y <= 4; y += 1) {
    for (let x = 2; x <= 5; x += 1) {
      const index = (y * 8 + x) * 4;
      pixels[index] = 180;
      pixels[index + 1] = 120;
      pixels[index + 2] = 60;
      pixels[index + 3] = 255;
    }
  }
  return sharp(pixels, { raw: { width: 8, height: 6, channels: 4 } }).png().toBuffer();
}

async function solidFixture(
  width: number,
  height: number,
  color: { r: number; g: number; b: number },
): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { ...color, alpha: 1 },
    },
  }).png().toBuffer();
}

test("centers non-transparent bounds without resizing the source pixels", async () => {
  const result = await centerCutoutOnCanonicalCanvas(await cutoutFixture(), 20, 24);
  const metadata = await sharp(result.canvasPng).metadata();

  assert.deepEqual(result.sourceNonTransparentBounds, { left: 2, top: 1, width: 4, height: 4 });
  assert.deepEqual(result.reviewPlacementBounds, { left: 8, top: 10, width: 4, height: 4 });
  assert.deepEqual({ width: metadata.width, height: metadata.height }, { width: 20, height: 24 });
  assert.equal(result.scale, 1);
});

test("plans every Photoshop selector as review-only responsibility output", () => {
  const sourceBytes = Buffer.from("layered Photoshop fixture");
  const jobs = planComponentKitReviewExtraction(
    fixtureRecipe(sha256(sourceBytes)),
    "/archive",
    "/review",
  );

  assert.deepEqual(jobs.map((job) => job.partId), [
    "sprayer-head",
    "protective-overcap",
    "dip-tube",
  ]);
  assert.ok(jobs.every((job) => job.productionEligible === false));
  assert.ok(jobs.every((job) => job.geometryLocked === false));
  assert.equal(jobs[0].sourcePath, "/archive/sprayers/sprayer.psd");
});

test("plans a multi-scene Photoshop responsibility as one review candidate", () => {
  const sourceBytes = Buffer.from("layered Photoshop fixture");
  const recipe = fixtureRecipe(sha256(sourceBytes));
  recipe.parts[0].sourceSelectors = [{
    sourceId: "layered-source",
    method: "psd-layer-composite" as const,
    sceneIndices: [2, 3, 4],
    layerNames: ["Actuator", "Collar", "Nozzle"],
  }];

  const jobs = planComponentKitReviewExtraction(recipe, "/archive", "/review");

  assert.equal(jobs.length, 3);
  assert.deepEqual(jobs[0].sceneIndices, [2, 3, 4]);
  assert.deepEqual(jobs[0].layerNames, ["Actuator", "Collar", "Nozzle"]);
  assert.match(jobs[0].cutoutPath, /scene-2-3-4__cutout\.png$/);
});

test("composites positioned Photoshop scenes before centering one responsibility", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "component-kit-composite-"));
  const archiveRoot = path.join(temporary, "archive");
  const outputRoot = path.join(temporary, "output");
  const sourceBytes = Buffer.from("layered Photoshop fixture");
  await mkdir(path.join(archiveRoot, "sprayers"), { recursive: true });
  await writeFile(path.join(archiveRoot, "sprayers", "sprayer.psd"), sourceBytes);
  const recipe = fixtureRecipe(sha256(sourceBytes));
  recipe.parts[0].sourceSelectors = [{
    sourceId: "layered-source",
    method: "psd-layer-composite" as const,
    sceneIndices: [2, 3],
    layerNames: ["Actuator", "Collar"],
  }];

  const result = await extractComponentKitReview({
    recipe,
    archiveRoot,
    outputRoot,
    decodePsdScene: async (_sourcePath, sceneIndex) => (
      sceneIndex === 2
        ? solidFixture(4, 3, { r: 220, g: 10, b: 10 })
        : solidFixture(6, 2, { r: 10, g: 20, b: 220 })
    ),
    identifyPsdScene: async (_sourcePath, sceneIndex) => (
      sceneIndex === 2
        ? { left: 10, top: 5, width: 4, height: 3 }
        : { left: 9, top: 8, width: 6, height: 2 }
    ),
    generatedAt: "2026-08-03T12:00:00.000Z",
  });

  assert.deepEqual(result.assets[0].sourcePageBounds, {
    left: 9,
    top: 5,
    width: 6,
    height: 5,
  });
  assert.deepEqual(result.assets[0].sourceNonTransparentBounds, {
    left: 0,
    top: 0,
    width: 6,
    height: 5,
  });
  assert.deepEqual(result.assets[0].sceneIndices, [2, 3]);
});

test("materializes SHA-verified cutouts and a review-only manifest", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "component-kit-review-"));
  const archiveRoot = path.join(temporary, "archive");
  const outputRoot = path.join(temporary, "output");
  const sourceBytes = Buffer.from("layered Photoshop fixture");
  await mkdir(path.join(archiveRoot, "sprayers"), { recursive: true });
  await writeFile(path.join(archiveRoot, "sprayers", "sprayer.psd"), sourceBytes);

  const result = await extractComponentKitReview({
    recipe: fixtureRecipe(sha256(sourceBytes)),
    archiveRoot,
    outputRoot,
    decodePsdScene: async () => cutoutFixture(),
    identifyPsdScene: async () => ({ left: 12, top: 34, width: 8, height: 6 }),
    generatedAt: "2026-08-03T12:00:00.000Z",
  });
  const manifest = JSON.parse(await readFile(result.manifestPath, "utf8")) as {
    assets: Array<{ productionEligible: boolean; geometryLocked: boolean; sourceSha256: string }>;
  };

  assert.equal(manifest.assets.length, 3);
  assert.ok(manifest.assets.every((asset) => asset.productionEligible === false));
  assert.ok(manifest.assets.every((asset) => asset.geometryLocked === false));
  assert.ok(manifest.assets.every((asset) => asset.sourceSha256 === sha256(sourceBytes)));
  assert.equal((await sharp(result.assets[0].reviewCanvasPath).metadata()).width, 20);
  assert.equal(result.contactSheetPaths.length, 3);
  assert.equal((await sharp(result.contactSheetPaths[0]).metadata()).width, 460);
});

test("rejects a mutated Photoshop source before writing review assets", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "component-kit-review-mutation-"));
  const archiveRoot = path.join(temporary, "archive");
  const outputRoot = path.join(temporary, "output");
  await mkdir(path.join(archiveRoot, "sprayers"), { recursive: true });
  await writeFile(path.join(archiveRoot, "sprayers", "sprayer.psd"), "mutated source");

  await assert.rejects(
    () => extractComponentKitReview({
      recipe: fixtureRecipe(sha256(Buffer.from("original source"))),
      archiveRoot,
      outputRoot,
      decodePsdScene: async () => cutoutFixture(),
      identifyPsdScene: async () => ({ left: 0, top: 0, width: 8, height: 6 }),
      generatedAt: "2026-08-03T12:00:00.000Z",
    }),
    /Photoshop source SHA-256 mismatch/,
  );
  await assert.rejects(() => readFile(path.join(outputRoot, "manifest.json")), /ENOENT/);
});
