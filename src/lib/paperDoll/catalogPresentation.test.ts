import assert from "node:assert/strict";
import test from "node:test";

import { resolvePaperDollCatalogPresentation } from "./catalogPresentation";

test("uniformly maps a complete 5 ml assembly to the approved catalog curve", () => {
  const result = resolvePaperDollCatalogPresentation({
    capacityMl: 5,
    canvas: { widthPx: 2080, heightPx: 2288 },
    sourceAssemblyBoundsPx: { left: 871, top: 840, width: 338, height: 1243 },
    targetCenterXPx: 1040,
    targetBaselineYPx: 2082,
  });

  assert.equal(result.scaleContractVersion, "best-bottles-catalog-scale-v1");
  assert.equal(result.targetSource, "global-capacity-curve");
  assert.equal(result.targetAssembledHeightPct, 61);
  assert.equal(result.targetAssembledHeightPx, 1396);
  assert.equal(result.targetAssemblyBoundsPx.height, 1396);
  assert.equal(result.targetAssemblyBoundsPx.top + result.targetAssemblyBoundsPx.height - 1, 2082);
  assert.equal(result.targetAssemblyBoundsPx.left + Math.round(result.targetAssemblyBoundsPx.width / 2), 1040);
  assert.ok(Math.abs(result.uniformScale - 1396 / 1243) < 1e-8);
});

test("accepts an explicit height-zone target but never creates per-layer transforms", () => {
  const result = resolvePaperDollCatalogPresentation({
    capacityMl: 9,
    targetAssembledHeightPct: 71,
    targetSource: "roller-standard-height-zone",
    canvas: { widthPx: 2080, heightPx: 2288 },
    sourceAssemblyBoundsPx: { left: 850, top: 500, width: 380, height: 1580 },
    targetCenterXPx: 1040,
    targetBaselineYPx: 2082,
  });

  assert.equal(result.targetAssembledHeightPct, 71);
  assert.equal(result.targetSource, "roller-standard-height-zone");
  assert.equal(result.transformScope, "complete-paper-doll-assembly");
  assert.equal("layerTransforms" in result, false);
});

test("preserves the monotonic 3 ml to 100 ml presentation hierarchy", () => {
  const resolve = (capacityMl: number) => resolvePaperDollCatalogPresentation({
    capacityMl,
    canvas: { widthPx: 2080, heightPx: 2288 },
    sourceAssemblyBoundsPx: { left: 900, top: 900, width: 280, height: 1000 },
    targetCenterXPx: 1040,
    targetBaselineYPx: 2082,
  });

  const three = resolve(3);
  const five = resolve(5);
  const nine = resolve(9);
  const hundred = resolve(100);
  assert.deepEqual(
    [three.targetAssembledHeightPct, five.targetAssembledHeightPct, nine.targetAssembledHeightPct, hundred.targetAssembledHeightPct],
    [56, 61, 69, 79],
  );
  assert.ok(three.targetAssembledHeightPx < five.targetAssembledHeightPx);
  assert.ok(five.targetAssembledHeightPx < nine.targetAssembledHeightPx);
  assert.ok(nine.targetAssembledHeightPx < hundred.targetAssembledHeightPx);
});

test("uses the reviewed Cylinder display position before the capacity-only fallback", () => {
  const result = resolvePaperDollCatalogPresentation({
    capacityMl: 9,
    cylinderDisplayKey: "spray|9|tall",
    canvas: { widthPx: 2080, heightPx: 2288 },
    sourceAssemblyBoundsPx: { left: 900, top: 500, width: 280, height: 1580 },
    targetCenterXPx: 1040,
    targetBaselineYPx: 2082,
  });

  assert.equal(result.targetAssembledHeightPct, 71);
  assert.equal(result.targetSource, "reviewed-cylinder-applicator-display-position");
  assert.equal(result.cylinderDisplayKey, "spray|9|tall");
  assert.equal(result.assembledHeightMm, 111);
});
