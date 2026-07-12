import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import sharp from "sharp";

import { prepareEligibleLayers } from "../../scripts/best-bottles/prepare-cylinder-75-type-layers";
import { prepareLineupProductLayer } from "./bestBottlesLineupProductLayer";

async function whiteFixture(rectangles: Array<{ left: number; top: number; width: number; height: number }>) {
  return sharp({
    create: { width: 200, height: 240, channels: 3, background: "white" },
  }).composite(rectangles.map((rectangle) => ({
    input: { create: { width: rectangle.width, height: rectangle.height, channels: 3, background: { r: 36, g: 36, b: 36 } } },
    left: rectangle.left,
    top: rectangle.top,
  }))).png().toBuffer();
}

describe("Best Bottles lineup product layers", () => {
  it("turns an opaque white-background source into a non-destructive PNG review layer", async () => {
    const sourceBytes = await whiteFixture([{ left: 80, top: 30, width: 40, height: 180 }]);
    const outputRoot = await mkdtemp(path.join(os.tmpdir(), "bb-layer-"));
    const reviewLayerPath = path.join(outputRoot, "review.png");
    const checksum = createHash("sha256").update(sourceBytes).digest("hex");

    const result = await prepareLineupProductLayer({
      sourceBytes,
      sourceChecksum: checksum,
      reviewLayerPath,
      heightWithCapMm: 90,
      diameterMm: 20,
    });

    assert.equal(result.status, "prepared");
    assert.equal(result.sourceChecksum, checksum);
    assert.deepEqual(result.primaryBounds, { left: 80, top: 30, width: 40, height: 180 });
    assert.equal((await sharp(await readFile(reviewLayerPath)).metadata()).format, "png");
    assert.deepEqual(await sharp(await readFile(reviewLayerPath)).metadata().then(({ width, height }) => ({ width, height })), {
      width: 200,
      height: 240,
    });
  });

  it("excludes detached sidecars from primary bounds and requires topology review", async () => {
    const sourceBytes = await whiteFixture([
      { left: 80, top: 30, width: 40, height: 180 },
      { left: 150, top: 150, width: 25, height: 45 },
    ]);

    const result = await prepareLineupProductLayer({
      sourceBytes,
      sourceChecksum: "fixture-checksum",
      heightWithCapMm: 90,
      diameterMm: 20,
    });

    assert.equal(result.status, "prepared");
    assert.deepEqual(result.primaryBounds, { left: 80, top: 30, width: 40, height: 180 });
    assert.deepEqual(result.sidecars.map(({ bounds }) => bounds), [
      { left: 150, top: 150, width: 25, height: 45 },
    ]);
    assert.equal(result.topologyStatus, "topology-review");
  });

  it("fails closed when no foreground component intersects the expected primary lane", async () => {
    const sourceBytes = await whiteFixture([{ left: 5, top: 40, width: 30, height: 160 }]);

    const result = await prepareLineupProductLayer({
      sourceBytes,
      sourceChecksum: "fixture-checksum",
      expectedPrimaryLane: { leftPct: 0.4, rightPct: 0.6 },
      heightWithCapMm: 80,
      diameterMm: 15,
    });

    assert.equal(result.status, "blocked");
    assert.equal(result.primaryBounds, null);
    assert.deepEqual(result.blockers, ["primary_bounds_unresolved"]);
  });

  it("retains the source checksum and compares observed source aspect with measured geometry", async () => {
    const sourceBytes = await whiteFixture([{ left: 75, top: 20, width: 50, height: 200 }]);

    const result = await prepareLineupProductLayer({
      sourceBytes,
      sourceChecksum: "sha256-from-exact-source",
      heightWithCapMm: 100,
      diameterMm: 20,
    });

    assert.equal(result.sourceChecksum, "sha256-from-exact-source");
    assert.deepEqual(result.aspectComparison, {
      observedSourceAspect: 4,
      measuredAspect: 5,
      relativeDelta: -0.2,
    });
  });

  it("retains catalog manifest lineage separately from downloaded asset bytes", async () => {
    const imageBytes = await whiteFixture([{ left: 80, top: 30, width: 40, height: 180 }]);
    const downloadedAssetChecksum = createHash("sha256").update(imageBytes).digest("hex");
    const outputRoot = await mkdtemp(path.join(os.tmpdir(), "bb-catalog-layer-"));
    const primarySourceChecksum = "manifest-primary-source-checksum";

    const result = await prepareEligibleLayers({
      manifest: {
        version: "fixture-manifest-v1",
        eligibleRows: [{
          physicalTypeKey: "fixture-type",
          plateId: "01",
          websiteSku: "CatalogFixture",
          graceSku: "CATALOG-FIXTURE",
          measurements: { heightWithCapMm: 90, diameterMm: 20 },
          reference: {
            source: "catalog-image-url",
            path: "https://catalog.invalid/CatalogFixture.png",
            sha256: null,
          },
          primarySourceChecksum,
        }],
      },
      outputRoot,
      loadSourceAsset: async () => ({ imageBytes, resolvedAssetChecksum: downloadedAssetChecksum }),
    });

    assert.deepEqual(result.blockers, []);
    assert.equal(result.layers.length, 1);
    assert.equal(result.layers[0].sourceChecksum, primarySourceChecksum);
    assert.equal(result.layers[0].resolvedAssetChecksum, downloadedAssetChecksum);
    assert.notEqual(result.layers[0].sourceChecksum, result.layers[0].resolvedAssetChecksum);
  });
});
