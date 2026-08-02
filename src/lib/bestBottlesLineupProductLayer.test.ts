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

async function outlinedBottleWithDenseCapFixture() {
  return sharp({
    create: { width: 240, height: 260, channels: 3, background: "white" },
  }).composite([
    {
      input: Buffer.from(`
        <svg width="70" height="210">
          <rect x="2" y="2" width="66" height="206" rx="8" fill="none" stroke="#242424" stroke-width="4"/>
        </svg>
      `),
      left: 30,
      top: 25,
    },
    {
      input: {
        create: { width: 92, height: 112, channels: 3, background: { r: 36, g: 36, b: 36 } },
      },
      left: 128,
      top: 120,
    },
  ]).png().toBuffer();
}

async function connectedBulbFixture() {
  return sharp({
    create: { width: 320, height: 260, channels: 3, background: "white" },
  }).composite([{
    input: Buffer.from(`
      <svg width="320" height="260">
        <path d="M35 190 C80 35 180 35 225 65" fill="none" stroke="#242424" stroke-width="12"/>
        <ellipse cx="55" cy="200" rx="42" ry="34" fill="#242424"/>
        <rect x="220" y="45" width="58" height="190" rx="8" fill="none" stroke="#242424" stroke-width="5"/>
      </svg>
    `),
    left: 0,
    top: 0,
  }]).png().toBuffer();
}

async function disconnectedClearBottleEdgesFixture() {
  return sharp({
    create: { width: 320, height: 260, channels: 3, background: "white" },
  }).composite([
    {
      input: { create: { width: 8, height: 190, channels: 3, background: { r: 36, g: 36, b: 36 } } },
      left: 220,
      top: 45,
    },
    {
      input: { create: { width: 8, height: 190, channels: 3, background: { r: 36, g: 36, b: 36 } } },
      left: 270,
      top: 45,
    },
    {
      input: { create: { width: 70, height: 12, channels: 3, background: { r: 36, g: 36, b: 36 } } },
      left: 35,
      top: 190,
    },
  ]).png().toBuffer();
}

async function sparseClearBottleEdgeFixture() {
  return sharp({
    create: { width: 320, height: 260, channels: 3, background: "white" },
  }).composite([{
    input: { create: { width: 8, height: 190, channels: 3, background: { r: 36, g: 36, b: 36 } } },
    left: 270,
    top: 45,
  }]).png().toBuffer();
}

async function largeTransparentBottleFixture() {
  return sharp({
    create: { width: 6000, height: 4000, channels: 3, background: "white" },
  }).composite([{
    input: Buffer.from(`
      <svg width="6000" height="4000">
        <rect x="2200" y="1000" width="500" height="2300" rx="80" fill="none" stroke="#e6e6e6" stroke-width="10"/>
        <rect x="2300" y="800" width="300" height="400" rx="30" fill="#242424"/>
        <rect x="2800" y="2600" width="500" height="700" rx="40" fill="#242424"/>
      </svg>
    `),
    left: 0,
    top: 0,
  }]).png().toBuffer();
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
    assert.deepEqual(result.fullForegroundBounds, { left: 80, top: 30, width: 40, height: 180 });
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
    assert.deepEqual(result.fullForegroundBounds, { left: 80, top: 30, width: 95, height: 180 });
    assert.equal(result.topologyStatus, "topology-review");
  });

  it("prefers the component matching measured bottle geometry over a denser detached cap", async () => {
    const result = await prepareLineupProductLayer({
      sourceBytes: await outlinedBottleWithDenseCapFixture(),
      sourceChecksum: "fixture-checksum",
      heightWithCapMm: 90,
      diameterMm: 30,
    });

    assert.equal(result.status, "prepared");
    assert.deepEqual(result.primaryBounds, { left: 30, top: 25, width: 70, height: 210 });
    assert.deepEqual(result.sidecars.map(({ bounds }) => bounds), [
      { left: 128, top: 120, width: 92, height: 112 },
    ]);
  });

  it("clips connected multi-component searches to an explicit primary-bottle lane", async () => {
    const result = await prepareLineupProductLayer({
      sourceBytes: await connectedBulbFixture(),
      sourceChecksum: "fixture-checksum",
      expectedPrimaryLane: { leftPct: 0.65, rightPct: 0.95 },
      clipPrimarySearchToLane: true,
      heightWithCapMm: 190,
      diameterMm: 58,
    });

    assert.equal(result.status, "prepared");
    assert.ok(result.primaryBounds);
    assert.ok(result.primaryBounds.left >= 208);
    assert.ok(result.primaryBounds.width <= 96);
    assert.ok(result.primaryBounds.height >= 185);
  });

  it("unions disconnected clear-glass edges inside an explicit primary-bottle lane", async () => {
    const result = await prepareLineupProductLayer({
      sourceBytes: await disconnectedClearBottleEdgesFixture(),
      sourceChecksum: "fixture-checksum",
      expectedPrimaryLane: { leftPct: 0.65, rightPct: 0.95 },
      clipPrimarySearchToLane: true,
      heightWithCapMm: 190,
      diameterMm: 58,
    });

    assert.equal(result.status, "prepared");
    assert.deepEqual(result.primaryBounds, { left: 220, top: 45, width: 58, height: 190 });
  });

  it("recovers measured bottle width when only the right clear-glass edge survives masking", async () => {
    const result = await prepareLineupProductLayer({
      sourceBytes: await sparseClearBottleEdgeFixture(),
      sourceChecksum: "fixture-checksum",
      expectedPrimaryLane: { leftPct: 0.65, rightPct: 0.95 },
      clipPrimarySearchToLane: true,
      heightWithCapMm: 190,
      diameterMm: 58,
    });

    assert.equal(result.status, "prepared");
    assert.deepEqual(result.primaryBounds, { left: 220, top: 45, width: 58, height: 190 });
  });

  it("retains faint transparent-bottle edges when analyzing large authoritative composites", async () => {
    const result = await prepareLineupProductLayer({
      sourceBytes: await largeTransparentBottleFixture(),
      sourceChecksum: "fixture-checksum",
      heightWithCapMm: 67,
      diameterMm: 14,
    });

    assert.equal(result.status, "prepared");
    assert.ok(result.primaryBounds);
    assert.ok(result.primaryBounds.left < 2800);
    assert.ok(result.primaryBounds.height > 2000);
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

  it("uses the catalog-confirmed right-hand bottle lane for vintage bulb plates", async () => {
    const imageBytes = await connectedBulbFixture();
    const outputRoot = await mkdtemp(path.join(os.tmpdir(), "bb-vintage-layer-"));

    const result = await prepareEligibleLayers({
      manifest: {
        version: "fixture-manifest-v1",
        eligibleRows: [{
          physicalTypeKey: "50|glass bottle|18-415|vintage bulb sprayer with tassel|spray",
          plateId: "08",
          websiteSku: "VintageFixture",
          graceSku: "VINTAGE-FIXTURE",
          measurements: { heightWithCapMm: 190, diameterMm: 58 },
          reference: {
            source: "authoritative-psd",
            path: "/archive/VintageFixture.psd",
            sha256: "manifest-source-checksum",
          },
          primarySourceChecksum: "manifest-source-checksum",
        }],
      },
      outputRoot,
      loadSourceAsset: async () => ({
        imageBytes,
        resolvedAssetChecksum: createHash("sha256").update(imageBytes).digest("hex"),
      }),
    });

    assert.deepEqual(result.blockers, []);
    assert.equal(result.layers.length, 1);
    assert.ok(result.layers[0].primaryBounds);
    assert.ok(result.layers[0].primaryBounds.left >= 192);
    assert.ok(result.layers[0].primaryBounds.width <= 96);
  });
});
