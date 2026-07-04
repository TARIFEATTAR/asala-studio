import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BEST_BOTTLES_CONTRACT_CANVAS,
  resolveBestBottlesRenderingContract,
} from "./bestBottlesRenderingContract";

const cylinder3ml = {
  graceSku: "GB-SPR-CLR-3ML-BLK",
  websiteSku: "GBSpry3mlClBlk",
  family: "Cylinder",
  bottleCollection: "Cylinder",
  category: "Glass Bottle",
  itemName: "3 ml clear cylinder sprayer with black cap",
  itemDescription: "3 ml clear cylinder glass sprayer",
  color: "Clear",
  capacityMl: 3,
  applicator: "Fine Mist Sprayer",
  heightWithCap: "54 ±1 mm",
  heightWithoutCap: "38 ±1 mm",
  diameter: "14 ±0.5 mm",
};

const slim9ml = {
  graceSku: "GB-CYL-CLR-9ML-SPR-SBLK",
  websiteSku: "GBTallCyl9SpryBlkSh",
  family: "Cylinder",
  bottleCollection: "Cylinder",
  category: "Glass Bottle",
  itemName: "Tall cylinder design 9ml clear glass bottle with shiny black spray.",
  itemDescription: "9 ml slim clear cylinder sprayer",
  color: "Clear",
  capacityMl: 9,
  applicator: "Fine Mist Sprayer",
  heightWithCap: "118 ±2 mm",
  heightWithoutCap: "106 ±2 mm",
  diameter: "18 ±0.5 mm",
};

const regular9ml = {
  graceSku: "GB-CYL-CLR-9ML-T-11",
  websiteSku: "GBCyl9RollBlkDot",
  family: "Cylinder",
  bottleCollection: "Cylinder",
  category: "Glass Bottle",
  itemName: "Cylinder design 9ml clear glass bottle with plastic roller ball plug and black dot cap.",
  itemDescription: "9 ml regular cylinder roll-on",
  color: "Clear",
  capacityMl: 9,
  applicator: "Plastic Roller Ball",
  heightWithCap: "83 ±1 mm",
  heightWithoutCap: "70 ±1 mm",
  diameter: "20 ±0.5 mm",
};

const dropper = {
  graceSku: "CMP-DRP-BKGD-18400-66",
  websiteSku: "DropperBlackGold18400",
  family: "Dropper",
  bottleCollection: "Dropper",
  category: "Component",
  itemName: "Black and gold dropper",
  capacityMl: 0,
  applicator: "Dropper",
  heightWithCap: "39 mm",
  diameter: "21 mm",
};

const giftBox = {
  graceSku: "PKG-BOX-BWIN-BLU",
  websiteSku: "BoxWindowBlue",
  family: "Gift Box",
  bottleCollection: "Gift Box",
  category: "Packaging",
  itemName: "Blue window gift box",
  capacityMl: 0,
  heightWithCap: "127 mm",
  diameter: "23.7 mm",
};

const bySku = new Map([
  [cylinder3ml.graceSku, cylinder3ml],
  [slim9ml.graceSku, slim9ml],
  [regular9ml.graceSku, regular9ml],
  [dropper.graceSku, dropper],
  [giftBox.graceSku, giftBox],
]);

function refs(count = 1) {
  return {
    product: Array.from({ length: count }, (_, index) => ({
      url: `https://cdn.example.test/ref-${index}.png`,
      label: "product",
    })),
    background: [],
    style: [],
  };
}

function resolver() {
  return {
    fetchProductBySku: async (sku: string) => bySku.get(sku) ?? null,
    fetchProductByWebsiteSku: async (sku: string) =>
      [...bySku.values()].find((row) => row.websiteSku === sku) ?? null,
  };
}

describe("BestBottlesRenderingContract", () => {
  it("resolves cylinder sample vials to the fixed canvas and bottle glass profile", async () => {
    const contract = await resolveBestBottlesRenderingContract({
      isBestBottlesStudioMasterRequest: true,
      allowBestBottlesProviderOverride: false,
      productContext: { sku: cylinder3ml.graceSku },
      categorizedRefs: refs(),
      extraLibraryTags: ["brand:best-bottles", "studio-master"],
    }, resolver());

    assert.equal(contract.status, "ready");
    assert.equal(contract.renderingLane, "bottle_catalog");
    assert.equal(contract.promptProfile, "bottle_glass");
    assert.deepEqual(contract.canvas, BEST_BOTTLES_CONTRACT_CANVAS);
    assert.equal(contract.rig?.profileId, "sample-vial");
    assert.equal(contract.rig?.relativeScaleZoneId, "sample-vial");
    assert.deepEqual(contract.rig?.fillHeightRangePct, { min: 55, max: 60 });
    assert.equal(contract.providerPolicy.provider, "openai");
    assert.equal(contract.providerPolicy.model, "gpt-image-2");
    assert.equal(contract.providerPolicy.comparisonOnly, false);
    assert.equal(contract.qaPolicy.enforceFillHeight, true);
    assert.deepEqual(contract.qaPolicy.allowedDecisions, ["pass", "normalize", "reject"]);
    assert.ok(contract.libraryTags.includes("rendering-lane:bottle_catalog"));
    assert.ok(contract.libraryTags.includes("profile:sample-vial"));
    assert.ok(contract.libraryTags.includes("scale-zone:sample-vial"));
  });

  it("uses Convex measurements to separate regular 9ml roll-ons from slim 9ml sprayers", async () => {
    const regular = await resolveBestBottlesRenderingContract({
      isBestBottlesStudioMasterRequest: true,
      productContext: { sku: regular9ml.graceSku },
      categorizedRefs: refs(),
    }, resolver());
    const slim = await resolveBestBottlesRenderingContract({
      isBestBottlesStudioMasterRequest: true,
      productContext: { sku: slim9ml.graceSku },
      categorizedRefs: refs(),
    }, resolver());

    assert.equal(regular.status, "ready");
    assert.equal(slim.status, "ready");
    assert.equal(regular.rig?.relativeScaleZoneId, "roller-bottle");
    assert.equal(slim.rig?.relativeScaleZoneId, "standard-cylinder");
    assert.notEqual(regular.rig?.fillHeightPct, slim.rig?.fillHeightPct);
  });

  it("routes component families to component enhancement without glass fill-height QA", async () => {
    const contract = await resolveBestBottlesRenderingContract({
      isBestBottlesStudioMasterRequest: true,
      productContext: { sku: dropper.graceSku },
      categorizedRefs: refs(),
    }, resolver());

    assert.equal(contract.status, "needs_review");
    assert.equal(contract.renderingLane, "component_enhancement");
    assert.equal(contract.bottleScaleStatus, "not_bottle");
    assert.equal(contract.promptProfile, "component_enhancement");
    assert.equal(contract.rig?.profileId, "component-enhancement");
    assert.equal(contract.qaPolicy.enforceFillHeight, false);
    assert.ok(contract.libraryTags.includes("rendering-lane:component_enhancement"));
  });

  it("routes packaging families to packaging enhancement without bottle QA", async () => {
    const contract = await resolveBestBottlesRenderingContract({
      isBestBottlesStudioMasterRequest: true,
      productContext: { sku: giftBox.graceSku },
      categorizedRefs: refs(),
    }, resolver());

    assert.equal(contract.status, "needs_review");
    assert.equal(contract.renderingLane, "packaging_enhancement");
    assert.equal(contract.bottleScaleStatus, "not_bottle");
    assert.equal(contract.promptProfile, "packaging_enhancement");
    assert.equal(contract.qaPolicy.enforceFillHeight, false);
    assert.ok(contract.libraryTags.includes("rendering-lane:packaging_enhancement"));
  });

  it("blocks unknown product families before provider generation", async () => {
    const contract = await resolveBestBottlesRenderingContract({
      isBestBottlesStudioMasterRequest: true,
      productContext: { sku: "UNKNOWN-SKU" },
      categorizedRefs: refs(),
    }, {
      fetchProductBySku: async () => ({
        graceSku: "UNKNOWN-SKU",
        websiteSku: "UnknownWebsite",
        family: "Unknown",
        itemName: "Unknown item",
      }),
    });

    assert.equal(contract.status, "blocked");
    assert.equal(contract.renderingLane, "blocked_unknown");
    assert.match(contract.error ?? "", /unknown product truth/i);
  });

  it("blocks missing SKU truth and invalid reference counts", async () => {
    const missingSku = await resolveBestBottlesRenderingContract({
      isBestBottlesStudioMasterRequest: true,
      productContext: { sku: "MISSING" },
      categorizedRefs: refs(),
    }, resolver());
    const tooManyRefs = await resolveBestBottlesRenderingContract({
      isBestBottlesStudioMasterRequest: true,
      productContext: { sku: cylinder3ml.graceSku },
      categorizedRefs: refs(2),
    }, resolver());

    assert.equal(missingSku.status, "blocked");
    assert.match(missingSku.error ?? "", /could not resolve product truth/i);
    assert.equal(tooManyRefs.status, "blocked");
    assert.match(tooManyRefs.error ?? "", /exactly one product reference/i);
  });

  it("blocks retired transparent or background-removed references", async () => {
    const contract = await resolveBestBottlesRenderingContract({
      isBestBottlesStudioMasterRequest: true,
      productContext: { sku: cylinder3ml.graceSku },
      categorizedRefs: {
        product: [{
          url: "https://cdn.example.test/reference-imports/background-removed/GB-SPR-CLR-3ML-BLK.png",
          label: "product",
        }],
        background: [],
        style: [],
      },
    }, resolver());

    assert.equal(contract.status, "blocked");
    assert.match(contract.error ?? "", /retired.*background-removed/i);
  });

  it("marks provider overrides as comparison-only instead of production-safe", async () => {
    const contract = await resolveBestBottlesRenderingContract({
      isBestBottlesStudioMasterRequest: true,
      allowBestBottlesProviderOverride: true,
      productContext: { sku: cylinder3ml.graceSku },
      categorizedRefs: refs(),
    }, resolver());

    assert.equal(contract.status, "ready");
    assert.equal(contract.providerPolicy.comparisonOnly, true);
    assert.ok(contract.libraryTags.includes("contract-provider:comparison"));
  });
});
