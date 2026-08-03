import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  buildComponentKitDecompositionPlan,
  parseComponentKitDecomposition,
} from "./componentKitDecomposition";

const sprayerKit = {
  schemaVersion: 1,
  kitId: "sprayer__15-415__physical-v1",
  sourceReviewGroupKey: "geometry-review__sprayer__15-415__01e5312a22",
  sourceCompositeProductionEligible: false,
  canonicalCanvas: { width: 2080, height: 2288 },
  sources: [
    {
      sourceId: "psd-head-black",
      sourceType: "photoshop-layered-source",
      originalFilename: "1. Spry15-415Blk.psd",
      archiveRelativePath: "20. Closures - Cap, Sprayers, Lotion pumps, etc/16. 15-415 Sprayer/1. Spry15-415Blk.psd",
      sha256: "b22b91e47d3fd7b0b8f517afd472b739a2e83d8c280ea4ab964272a77e688521",
      productionEligible: false,
    },
    {
      sourceId: "catalog-reference-black",
      sourceType: "catalog-composite-reference",
      originalFilename: "Spry15-415Blk.gif",
      referenceUrl: "https://www.bestbottles.com/images/store/enlarged_pics/Spry15-415Blk.gif",
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
        { sourceId: "psd-head-black", method: "psd-layer-scene", sceneIndex: 2, layerName: "Layer 14" },
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
        { sourceId: "catalog-reference-black", method: "reviewed-selection-mask" },
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
        { sourceId: "catalog-reference-black", method: "reviewed-selection-mask" },
      ],
    },
  ],
} as const;

test("preserves immutable Photoshop provenance and part-level extraction selectors", () => {
  const parsed = parseComponentKitDecomposition(sprayerKit);

  assert.equal(parsed.sources[0].originalFilename, "1. Spry15-415Blk.psd");
  assert.equal(parsed.sources[0].sha256, "b22b91e47d3fd7b0b8f517afd472b739a2e83d8c280ea4ab964272a77e688521");
  assert.deepEqual(parsed.parts[0].sourceSelectors[0], {
    sourceId: "psd-head-black",
    method: "psd-layer-scene",
    sceneIndex: 2,
    layerName: "Layer 14",
  });
});

test("decomposes a sprayer kit into two reusable plates and one body-contextual responsibility", () => {
  const plan = buildComponentKitDecompositionPlan(sprayerKit);

  assert.deepEqual(plan.reusablePlatePartIds, ["sprayer-head", "protective-overcap"]);
  assert.deepEqual(plan.bodyContextualPartIds, ["dip-tube"]);
  assert.equal(plan.productionPlateCount, 2);
  assert.equal(plan.requiresAssemblyContextQa, true);
});

test("rejects a dip tube flattened into a global reusable plate", () => {
  const invalid = structuredClone(sprayerKit) as Record<string, unknown> & {
    parts: Array<Record<string, unknown>>;
  };
  invalid.parts[2].outputPolicy = "reusable-full-canvas-plate";

  assert.throws(
    () => parseComponentKitDecomposition(invalid),
    /Internal delivery must remain body-contextual/,
  );
});

test("rejects an independently reusable overcap merged into source evidence", () => {
  const invalid = structuredClone(sprayerKit) as Record<string, unknown> & {
    parts: Array<Record<string, unknown>>;
  };
  invalid.parts[1].outputPolicy = "source-evidence-only";

  assert.throws(
    () => parseComponentKitDecomposition(invalid),
    /Secondary overcap must be its own reusable plate/,
  );
});

test("rejects a reusable exterior plate that is not anchored to the physical mount axis", () => {
  const invalid = structuredClone(sprayerKit) as Record<string, unknown> & {
    parts: Array<Record<string, unknown>>;
  };
  invalid.parts[0].productionAnchor = "component-bounds-center";

  assert.throws(
    () => parseComponentKitDecomposition(invalid),
    /Exterior dispenser must use the physical mount-axis seat/,
  );
});

test("the 15-415 sprayer recipe records the layered head and assembly sources without flattening the kit", async () => {
  const recipePath = path.resolve(
    "docs/paper-doll-rig/sprayer-15-415-component-kit-decomposition.json",
  );
  const recipe = parseComponentKitDecomposition(
    JSON.parse(await readFile(recipePath, "utf8")),
  );
  const plan = buildComponentKitDecompositionPlan(recipe);

  assert.equal(
    recipe.sources.filter((source) => source.sourceType === "photoshop-layered-source").length,
    10,
  );
  assert.equal(recipe.parts.find((part) => part.partId === "sprayer-head")?.sourceSelectors.length, 5);
  assert.equal(recipe.parts.find((part) => part.partId === "protective-overcap")?.sourceSelectors.length, 5);
  assert.equal(recipe.parts.find((part) => part.partId === "dip-tube")?.sourceSelectors.length, 5);
  assert.deepEqual(plan.reusablePlatePartIds, ["sprayer-head", "protective-overcap"]);
  assert.deepEqual(plan.bodyContextualPartIds, ["dip-tube"]);
});
