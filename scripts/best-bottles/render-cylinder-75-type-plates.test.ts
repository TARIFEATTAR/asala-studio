import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import sharp from "sharp";

import {
  buildCylinder75TypePlateRenderPlan,
  renderCylinder75TypePlates,
} from "./render-cylinder-75-type-plates";

const root = process.cwd();
const manifest = JSON.parse(
  await readFile(path.join(root, "public/data/best-bottles-cylinder-75-type-lineup-manifest.json"), "utf8"),
);
const layerManifest = JSON.parse(
  await readFile(path.join(root, "tmp/best-bottles-cylinder-75/layers.json"), "utf8"),
);

describe("Cylinder 75-type plate render plan", () => {
  it("preserves all 75 physical slots while rendering only the 59 evidence-ready products", () => {
    const plan = buildCylinder75TypePlateRenderPlan({ manifest, layerManifest });

    assert.deepEqual(plan.summary, {
      physicalTypeCount: 75,
      readyCount: 59,
      blockedCount: 16,
      plateCount: 8,
    });
    assert.deepEqual(
      Object.fromEntries(plan.plates.map((plate) => [plate.plateId, plate.slots.length])),
      { "01": 10, "02": 12, "03": 11, "04": 11, "05": 7, "06": 9, "07": 7, "08": 8 },
    );
    assert.equal(new Set(plan.plates.flatMap((plate) => plate.slots.map((slot) => slot.physicalTypeKey))).size, 75);
    assert.ok(plan.plates.flatMap((plate) => plate.slots).filter((slot) => slot.status === "blocked")
      .every((slot) => slot.reasons.length > 0 && slot.layerPath === null));
  });

  it("uses the approved global catalog curve without sidecar- or width-driven scale reduction", () => {
    const plan = buildCylinder75TypePlateRenderPlan({ manifest, layerManifest });
    const ready = plan.plates.flatMap((plate) => plate.slots)
      .filter((slot) => slot.status === "ready");
    const fiveMl = ready.find((slot) => slot.capacityMl === 5);
    const nineMl = ready.find((slot) => slot.capacityMl === 9);
    const vintage = ready.find((slot) => slot.websiteSku === "GBCyl50AnSpTslBlk");

    assert.equal(plan.scaleContractVersion, "best-bottles-catalog-scale-v1");
    assert.equal(plan.sourceCurveVersion, "cylinder-measured-display-v1");
    assert.equal(fiveMl?.resolvedAssembledTargetPct, 61);
    assert.equal(nineMl?.resolvedAssembledTargetPct, 69);
    assert.ok(vintage?.primaryBounds);
    assert.equal(
      vintage?.primaryScale,
      Number((vintage!.resolvedAssembledTargetPx / vintage!.primaryBounds!.height).toFixed(8)),
    );
    assert.ok(vintage!.slotWidthPx > 340);
    assert.ok(plan.plates.every((plate) => plate.cleanOrder.join("|") === plate.annotatedOrder.join("|")));
    assert.equal(new Set(plan.plates.map((plate) => plate.baselineY)).size, 1);
  });

  it("renders clean and annotated visual-test plates plus a machine-readable manifest", async () => {
    const outputRoot = await mkdtemp(path.join(os.tmpdir(), "bb-75-plates-"));
    const layerPath = path.join(outputRoot, "fixture-layer.png");
    await sharp({
      create: { width: 120, height: 220, channels: 3, background: "white" },
    }).composite([{
      input: { create: { width: 40, height: 180, channels: 3, background: { r: 40, g: 40, b: 40 } } },
      left: 40,
      top: 20,
    }]).png().toFile(layerPath);

    const fixtureManifest = {
      version: "fixture-manifest-v1",
      curveVersion: "cylinder-measured-display-v1",
      coverageRows: [{
        physicalTypeKey: "5|glass bottle|13-415||short",
        plateId: "01",
        websiteSku: "FixtureReady",
        graceSku: "FIXTURE-READY",
        capacityMl: 5,
        identityStatus: "confirmed",
        measurementStatus: "confirmed",
        referenceStatus: "exact-psd",
        topologyStatus: "confirmed",
        measurements: { heightWithCapMm: 55, heightWithoutCapMm: 53, diameterMm: 17 },
        reference: { source: "authoritative-psd", path: "/archive/FixtureReady.psd", sha256: "source-ready" },
        primarySourceChecksum: "source-ready",
        reasons: [],
      }, {
        physicalTypeKey: "9|glass bottle|17-415|metal roller ball|roll-on cap",
        plateId: "01",
        websiteSku: "FixtureBlocked",
        graceSku: "FIXTURE-BLOCKED",
        capacityMl: 9,
        identityStatus: "confirmed",
        measurementStatus: "confirmed",
        referenceStatus: "missing",
        topologyStatus: "confirmed",
        measurements: { heightWithCapMm: 75, heightWithoutCapMm: 63, diameterMm: 21 },
        reference: null,
        primarySourceChecksum: null,
        reasons: ["no_exact_reference"],
      }],
      eligibleRows: [{ physicalTypeKey: "5|glass bottle|13-415||short" }],
      blockers: [{
        physicalTypeKey: "9|glass bottle|17-415|metal roller ball|roll-on cap",
        websiteSku: "FixtureBlocked",
        graceSku: "FIXTURE-BLOCKED",
        reasons: ["no_exact_reference"],
      }],
      plates: {
        "01": [], "02": [], "03": [], "04": [], "05": [], "06": [], "07": [], "08": [],
      },
    };
    fixtureManifest.plates["01"] = fixtureManifest.coverageRows;
    const fixtureLayers = {
      layers: [{
        physicalTypeKey: "5|glass bottle|13-415||short",
        plateId: "01",
        websiteSku: "FixtureReady",
        graceSku: "FIXTURE-READY",
        status: "prepared",
        sourceChecksum: "source-ready",
        resolvedAssetChecksum: "resolved-ready",
        sourceWidth: 120,
        sourceHeight: 220,
        reviewLayerPath: layerPath,
        primaryBounds: { left: 40, top: 20, width: 40, height: 180 },
        fullForegroundBounds: { left: 40, top: 20, width: 40, height: 180 },
        sidecars: [],
        topologyStatus: "confirmed",
        aspectComparison: { observedSourceAspect: 4.5, measuredAspect: 3.235, relativeDelta: 0.391 },
        blockers: [],
      }],
    };
    const plan = buildCylinder75TypePlateRenderPlan({
      manifest: fixtureManifest,
      layerManifest: fixtureLayers,
      minimumCanvasWidthPx: 900,
      canvasHeightPx: 700,
    });

    const result = await renderCylinder75TypePlates({ plan, outputRoot });
    assert.equal(result.renderedPlateCount, 1);
    assert.deepEqual(
      await sharp(result.plates[0].cleanPath).metadata().then(({ width, height }) => ({ width, height })),
      { width: 900, height: 700 },
    );
    assert.equal((await sharp(result.plates[0].annotatedPath).metadata()).height, 920);
    assert.equal(JSON.parse(await readFile(result.manifestPath, "utf8")).summary.blockedCount, 1);
  });
});
