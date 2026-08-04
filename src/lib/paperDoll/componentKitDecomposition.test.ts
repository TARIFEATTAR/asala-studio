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

test("records an existing paper-doll plate as review evidence without re-extracting it", () => {
  const existingAsset = structuredClone(sprayerKit) as Record<string, unknown> & {
    sources: Array<Record<string, unknown>>;
    parts: Array<Record<string, unknown> & { sourceSelectors: Array<Record<string, unknown>> }>;
  };
  existingAsset.sources.push({
    sourceId: "existing-overcap",
    sourceType: "existing-paper-doll-asset",
    originalFilename: "OverCap17-415-Spray-Translucent.png",
    repositoryRelativePath: "outputs/paper-doll-plates/cap-regen-sources/OverCap17-415-Spray-Translucent.png",
    sha256: "4aeb97ec447c8db30721da98ff6058f3ac1268303d1d864f8d1519fa926a85ba",
    productionEligible: false,
  });
  existingAsset.parts[1].sourceSelectors = [{
    sourceId: "existing-overcap",
    method: "reviewed-selection-mask",
  }];

  const parsed = parseComponentKitDecomposition(existingAsset);

  assert.equal(parsed.sources[2].sourceType, "existing-paper-doll-asset");
  assert.equal(
    parsed.sources[2].repositoryRelativePath,
    "outputs/paper-doll-plates/cap-regen-sources/OverCap17-415-Spray-Translucent.png",
  );
});

test("accepts one reusable responsibility assembled from multiple positioned Photoshop scenes", () => {
  const compound = structuredClone(sprayerKit) as Record<string, unknown> & {
    parts: Array<Record<string, unknown>>;
  };
  compound.parts[0].sourceSelectors = [{
    sourceId: "psd-head-black",
    method: "psd-layer-composite",
    sceneIndices: [2, 3, 4],
    layerNames: ["Actuator", "Decorative collar", "Nozzle detail"],
  }];

  const parsed = parseComponentKitDecomposition(compound);

  assert.deepEqual(parsed.parts[0].sourceSelectors[0], {
    sourceId: "psd-head-black",
    method: "psd-layer-composite",
    sceneIndices: [2, 3, 4],
    layerNames: ["Actuator", "Decorative collar", "Nozzle detail"],
  });
});

test("rejects an ambiguous Photoshop scene composite", () => {
  const invalid = structuredClone(sprayerKit) as Record<string, unknown> & {
    parts: Array<Record<string, unknown>>;
  };
  invalid.parts[0].sourceSelectors = [{
    sourceId: "psd-head-black",
    method: "psd-layer-composite",
    sceneIndices: [2, 2],
    layerNames: ["Actuator"],
  }];

  assert.throws(
    () => parseComponentKitDecomposition(invalid),
    /Photoshop scene composites require unique scenes and one layer name per scene/,
  );
});

test("decomposes a sprayer kit into two reusable plates and one body-contextual responsibility", () => {
  const plan = buildComponentKitDecompositionPlan(sprayerKit);

  assert.deepEqual(plan.reusablePlatePartIds, ["sprayer-head", "protective-overcap"]);
  assert.deepEqual(plan.bodyContextualPartIds, ["dip-tube"]);
  assert.equal(plan.productionPlateCount, 2);
  assert.equal(plan.requiresAssemblyContextQa, true);
});

test("routes a translucent overcap into closed assembly swatches instead of an independent overlay", () => {
  const compound = structuredClone(sprayerKit) as Record<string, unknown> & {
    parts: Array<Record<string, unknown>>;
  };
  compound.parts[1].outputPolicy = "compound-with-exterior-swatches";
  compound.parts[1].productionAnchor = "component-relative";
  compound.parts[1].independentlySelectable = false;
  compound.parts[1].compoundWithPartId = "sprayer-head";

  const parsed = parseComponentKitDecomposition(compound);
  const plan = buildComponentKitDecompositionPlan(parsed);

  assert.equal(parsed.parts[1].outputPolicy, "compound-with-exterior-swatches");
  assert.deepEqual(plan.reusablePlatePartIds, ["sprayer-head"]);
  assert.deepEqual(plan.compoundSwatchPartIds, ["protective-overcap"]);
  assert.equal(plan.productionPlateCount, 2);
});

test("rejects a compound translucent overcap that remains independently selectable", () => {
  const invalid = structuredClone(sprayerKit) as Record<string, unknown> & {
    parts: Array<Record<string, unknown>>;
  };
  invalid.parts[1].outputPolicy = "compound-with-exterior-swatches";
  invalid.parts[1].productionAnchor = "component-relative";
  invalid.parts[1].independentlySelectable = true;
  invalid.parts[1].compoundWithPartId = "sprayer-head";

  assert.throws(
    () => parseComponentKitDecomposition(invalid),
    /Compound overcap swatches cannot be independently selected/,
  );
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

test("the 17-415 sprayer and pump stay distinct while each preserves its compound responsibilities", async () => {
  const [sprayer, pump] = await Promise.all([
    readFile(path.resolve("docs/paper-doll-rig/sprayer-17-415-component-kit-decomposition.json"), "utf8"),
    readFile(path.resolve("docs/paper-doll-rig/pump-17-415-component-kit-decomposition.json"), "utf8"),
  ]).then((values) => values.map((value) => parseComponentKitDecomposition(JSON.parse(value))));

  assert.notEqual(sprayer.kitId, pump.kitId);
  assert.equal(sprayer.parts[0].sourceSelectors.length, 6);
  assert.equal(pump.parts[0].sourceSelectors.length, 3);
  assert.ok(sprayer.parts[0].sourceSelectors.every((selector) => selector.method === "psd-layer-composite"));
  assert.ok(pump.parts[0].sourceSelectors.every((selector) => selector.method === "psd-layer-composite"));
  assert.equal(sprayer.parts[1].partId, "sprayer-protective-overcap");
  assert.equal(pump.parts[1].partId, "pump-protective-overcap");
  assert.equal(sprayer.parts[1].outputPolicy, "compound-with-exterior-swatches");
  assert.equal(pump.parts[1].outputPolicy, "compound-with-exterior-swatches");
  assert.equal(sprayer.parts[1].compoundWithPartId, "sprayer-head-and-collar");
  assert.equal(pump.parts[1].compoundWithPartId, "pump-head-and-collar");
  assert.equal(sprayer.parts[1].independentlySelectable, false);
  assert.equal(pump.parts[1].independentlySelectable, false);
  assert.equal(sprayer.parts[2].outputPolicy, "body-contextual-weld");
  assert.equal(pump.parts[2].outputPolicy, "body-contextual-weld");
});

test("the 13-415 sprayer separates eight reusable heads, opaque overcaps, and body-contextual tubes", async () => {
  const recipe = parseComponentKitDecomposition(JSON.parse(await readFile(
    path.resolve("docs/paper-doll-rig/sprayer-13-415-component-kit-decomposition.json"),
    "utf8",
  )));
  const plan = buildComponentKitDecompositionPlan(recipe);
  const head = recipe.parts.find((part) => part.partId === "sprayer-head-and-collar");
  const overcap = recipe.parts.find((part) => part.partId === "opaque-protective-overcap");
  const tube = recipe.parts.find((part) => part.partId === "sprayer-dip-tube");

  assert.equal(recipe.sources.filter((source) => source.sourceType === "photoshop-layered-source").length, 15);
  assert.equal(head?.sourceSelectors.filter((selector) => selector.method === "psd-layer-scene").length, 8);
  assert.equal(overcap?.sourceSelectors.length, 8);
  assert.equal(overcap?.sourceSelectors.filter((selector) => selector.method === "psd-layer-scene").length, 7);
  assert.equal(overcap?.outputPolicy, "reusable-full-canvas-plate");
  assert.equal(overcap?.independentlySelectable, true);
  assert.equal(tube?.sourceSelectors.length, 8);
  assert.equal(tube?.sourceSelectors.filter((selector) => selector.method === "psd-layer-scene").length, 7);
  assert.equal(tube?.outputPolicy, "body-contextual-weld");
  assert.equal(tube?.independentlySelectable, false);
  assert.deepEqual(plan.reusablePlatePartIds, ["sprayer-head-and-collar", "opaque-protective-overcap"]);
  assert.deepEqual(plan.bodyContextualPartIds, ["sprayer-dip-tube"]);
  assert.equal(plan.productionPlateCount, 2);
});

test("the 28/50 mL jumbo roll-on kit is closed to two rollers and black/white overcaps", async () => {
  const recipe = parseComponentKitDecomposition(JSON.parse(await readFile(
    path.resolve("docs/paper-doll-rig/jumbo-rollon-16mm-component-kit-decomposition.json"),
    "utf8",
  )));
  const plan = buildComponentKitDecompositionPlan(recipe);
  const fitment = recipe.parts.find((part) => part.partId === "jumbo-roller-fitment");
  const overcap = recipe.parts.find((part) => part.partId === "jumbo-overcap");
  const metalComposite = recipe.parts.find((part) => part.partId === "metal-fitment-neck-composite-reference");
  const integration = recipe.parts.find((part) => part.partId === "plastic-fitment-neck-integration-reference");
  const sourceIds = recipe.sources.map((source) => source.sourceId);

  assert.equal(recipe.sources.length, 8);
  assert.equal(fitment?.sourceSelectors.length, 8);
  assert.equal(fitment?.sourceSelectors.filter((selector) => selector.method === "reviewed-selection-mask").length, 4);
  assert.equal(overcap?.sourceSelectors.length, 8);
  assert.equal(metalComposite?.sourceSelectors.length, 4);
  assert.equal(integration?.sourceSelectors.length, 4);
  assert.deepEqual(plan.reusablePlatePartIds, ["jumbo-roller-fitment", "jumbo-overcap"]);
  assert.deepEqual(plan.sourceEvidencePartIds, [
    "metal-fitment-neck-composite-reference",
    "plastic-fitment-neck-integration-reference",
  ]);
  assert.equal(plan.productionPlateCount, 2);
  assert.ok(recipe.sources.every((source) => source.productionEligible === false));
  assert.ok(sourceIds.every((sourceId) => /jumbo-(28|50)-(plastic|metal)-(black|white)/.test(sourceId)));
  assert.ok(sourceIds.every((sourceId) => !/boston|dropper|spray|pump/i.test(sourceId)));
});
