import assert from "node:assert/strict";
import { createHash } from "node:crypto";
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

const tallCylinderAlias9ml = {
  graceSku: "GB-TALL-CYL-CLR-9ML-SPR-BLK",
  websiteSku: "GBTallCyl9SpryBlk",
  family: "Tall Cylinder",
  bottleCollection: "Tall Cylinder",
  category: "Glass Bottle",
  itemName: "Tall cylinder design 9ml clear glass bottle with black spray.",
  itemDescription: "9 ml tall cylinder sprayer",
  color: "Clear",
  capacityMl: 9,
  applicator: "Fine Mist Sprayer",
  heightWithCap: "999 mm",
  heightWithoutCap: "888 mm",
  diameter: "777 mm",
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
  [tallCylinderAlias9ml.graceSku, tallCylinderAlias9ml],
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

function refsWithStyle(styleCount = 1) {
  return {
    ...refs(),
    style: Array.from({ length: styleCount }, (_, index) => ({
      url: `https://cdn.example.test/style-${index}.png`,
      label: "Metal Lighting-Only Style Reference",
    })),
  };
}

function resolver() {
  return {
    fetchProductBySku: async (sku: string) => bySku.get(sku) ?? null,
    fetchProductByWebsiteSku: async (sku: string) =>
      [...bySku.values()].find((row) => row.websiteSku === sku) ?? null,
  };
}

function nominal(value: string | undefined): string {
  const parsed = Number(value?.match(/[\d.]+/)?.[0]);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`Invalid fixture dimension: ${value}`);
  return String(parsed);
}

function canonicalGeometryContract(
  product: typeof cylinder3ml | typeof slim9ml | typeof regular9ml | typeof tallCylinderAlias9ml = cylinder3ml,
  overrides: Record<string, string> = {},
) {
  const contract = {
    version: "best-bottles-canonical-geometry-v1",
    websiteSku: product.websiteSku,
    graceSku: product.graceSku,
    canon_bodyHeightMm: nominal(product.heightWithoutCap),
    canon_heightWithCapMm: nominal(product.heightWithCap),
    canon_widthAxisMm: nominal(product.diameter),
    canon_secondAxisMm: nominal(product.diameter),
    ...overrides,
  };
  return {
    ...contract,
    sha256: createHash("sha256").update(JSON.stringify(contract)).digest("hex"),
  };
}

function cylinderContext(product: typeof cylinder3ml | typeof slim9ml | typeof regular9ml) {
  return {
    sku: product.graceSku,
    websiteSku: product.websiteSku,
    canonicalGeometryContract: canonicalGeometryContract(product),
  };
}

describe("BestBottlesRenderingContract", () => {
  it("accepts one optional Cylinder style-only calibration reference beside product truth", async () => {
    const contract = await resolveBestBottlesRenderingContract({
      isBestBottlesStudioMasterRequest: true,
      productContext: cylinderContext(cylinder3ml),
      categorizedRefs: refsWithStyle(),
    }, resolver());

    assert.equal(contract.status, "ready");
  });

  it("preserves the prior non-Cylinder style-reference path", async () => {
    const contract = await resolveBestBottlesRenderingContract({
      isBestBottlesStudioMasterRequest: true,
      productContext: { sku: dropper.graceSku },
      categorizedRefs: refsWithStyle(),
    }, resolver());

    assert.equal(contract.status, "needs_review");
    assert.equal(contract.renderingLane, "component_enhancement");
    assert.equal(contract.error, null);
  });

  it("blocks transparent-derived style references as well as product references", async () => {
    const contract = await resolveBestBottlesRenderingContract({
      isBestBottlesStudioMasterRequest: true,
      productContext: cylinderContext(cylinder3ml),
      categorizedRefs: {
        ...refs(),
        style: [{
          url: "https://cdn.example.test/generated-images/paper-doll/glass-style.png",
          label: "Glass Specularity Style Reference",
        }],
      },
    }, resolver());

    assert.equal(contract.status, "blocked");
    assert.match(contract.error ?? "", /transparent|paper-doll|prohibited/i);
  });

  it("blocks multiple style references", async () => {
    const contract = await resolveBestBottlesRenderingContract({
      isBestBottlesStudioMasterRequest: true,
      productContext: cylinderContext(cylinder3ml),
      categorizedRefs: refsWithStyle(2),
    }, resolver());

    assert.equal(contract.status, "blocked");
    assert.match(contract.error ?? "", /at most one Cylinder-only style calibration reference/);
  });

  it("resolves cylinder sample vials to the fixed canvas and bottle glass profile", async () => {
    const contract = await resolveBestBottlesRenderingContract({
      isBestBottlesStudioMasterRequest: true,
      allowBestBottlesProviderOverride: false,
      productContext: cylinderContext(cylinder3ml),
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
      productContext: cylinderContext(regular9ml),
      categorizedRefs: refs(),
    }, resolver());
    const slim = await resolveBestBottlesRenderingContract({
      isBestBottlesStudioMasterRequest: true,
      productContext: cylinderContext(slim9ml),
      categorizedRefs: refs(),
    }, resolver());

    assert.equal(regular.status, "ready");
    assert.equal(slim.status, "ready");
    assert.equal(regular.rig?.relativeScaleZoneId, "roller-bottle");
    assert.equal(slim.rig?.relativeScaleZoneId, "standard-cylinder");
    assert.notEqual(regular.rig?.fillHeightPct, slim.rig?.fillHeightPct);
  });

  it("preserves a matching sealed canonical Cylinder geometry contract", async () => {
    const geometry = canonicalGeometryContract(cylinder3ml);
    const contract = await resolveBestBottlesRenderingContract({
      isBestBottlesStudioMasterRequest: true,
      productContext: {
        sku: cylinder3ml.graceSku,
        websiteSku: cylinder3ml.websiteSku,
        canonicalGeometryContract: geometry,
      },
      categorizedRefs: refs(),
    }, resolver());

    assert.equal(contract.status, "ready");
    assert.deepEqual(contract.productContext.canonicalGeometryContract, geometry);
    assert.equal(contract.productContext.heightWithoutCap, "38 mm");
    assert.equal(contract.productContext.heightWithCap, "54 mm");
    assert.equal(contract.productContext.diameter, "14 mm");
  });

  it("fails closed when a Cylinder request omits the sealed canonical geometry contract", async () => {
    const contract = await resolveBestBottlesRenderingContract({
      isBestBottlesStudioMasterRequest: true,
      productContext: {
        sku: cylinder3ml.graceSku,
        websiteSku: cylinder3ml.websiteSku,
      },
      categorizedRefs: refs(),
    }, resolver());

    assert.equal(contract.status, "blocked");
    assert.match(contract.error ?? "", /requires a sealed canonical geometry contract/i);
  });

  it("uses the sealed canonical Cylinder geometry instead of conflicting raw Convex values", async () => {
    const geometry = canonicalGeometryContract(cylinder3ml, { canon_bodyHeightMm: "37" });
    const contract = await resolveBestBottlesRenderingContract({
      isBestBottlesStudioMasterRequest: true,
      productContext: {
        sku: cylinder3ml.graceSku,
        websiteSku: cylinder3ml.websiteSku,
        canonicalGeometryContract: geometry,
      },
      categorizedRefs: refs(),
    }, resolver());

    assert.equal(contract.status, "ready");
    assert.equal(contract.productContext.heightWithoutCap, "37 mm");
    assert.equal(contract.productContext.heightWithCap, "54 mm");
    assert.equal(contract.productContext.diameter, "14 mm");
    assert.deepEqual(contract.productContext.canonicalGeometryContract, geometry);
  });

  it("treats Tall Cylinder as the same sealed Cylinder authority and does not leak raw Convex geometry", async () => {
    const geometry = canonicalGeometryContract(tallCylinderAlias9ml, {
      canon_bodyHeightMm: "106",
      canon_heightWithCapMm: "118",
      canon_widthAxisMm: "18",
      canon_secondAxisMm: "18",
    });
    const contract = await resolveBestBottlesRenderingContract({
      isBestBottlesStudioMasterRequest: true,
      productContext: {
        sku: tallCylinderAlias9ml.graceSku,
        websiteSku: tallCylinderAlias9ml.websiteSku,
        canonicalGeometryContract: geometry,
      },
      categorizedRefs: refsWithStyle(),
    }, resolver());

    assert.equal(contract.status, "ready");
    assert.equal(contract.renderingLane, "bottle_catalog");
    assert.equal(contract.productContext.heightWithoutCap, "106 mm");
    assert.equal(contract.productContext.heightWithCap, "118 mm");
    assert.equal(contract.productContext.diameter, "18 mm");
    assert.equal(contract.rig?.relativeScaleZoneId, "standard-cylinder");
    assert.doesNotMatch(JSON.stringify(contract.productContext), /777|888|999/);
  });

  it("preserves caller-authoritative Cylinder role and sidecar topology fields", async () => {
    const roleFields = {
      presetId: "grid-card-exploded-2000x2200",
      capState: "detached",
      mode: "cap-off",
      componentTopology: "fitment-attached-cap-right-sidecar",
      capOffReferenceId: "a".repeat(64),
      topologyReferenceId: "b".repeat(64),
      referenceRoleId: "pdp-cap-off-sidecar",
    };
    const contract = await resolveBestBottlesRenderingContract({
      isBestBottlesStudioMasterRequest: true,
      productContext: {
        ...cylinderContext(cylinder3ml),
        ...roleFields,
      },
      categorizedRefs: refs(),
    }, resolver());

    assert.equal(contract.status, "ready");
    for (const [key, value] of Object.entries(roleFields)) {
      assert.equal(contract.productContext[key], value, key);
    }
    assert.equal(contract.rig?.scaleContractVersion, "best-bottles-catalog-scale-v1");
  });

  it("keeps caller sidecar authority when stale Convex role fields conflict", async () => {
    const staleConvexProduct = {
      ...cylinder3ml,
      capState: "assembled",
      mode: "cap-on",
      componentTopology: "assembled",
      capOffReferenceId: null,
      topologyReferenceId: "stale-convex-topology",
      referenceRoleId: "identity-cap-on",
    };
    const callerSidecar = {
      presetId: "grid-card-exploded-2000x2200",
      capState: "detached",
      mode: "cap-off",
      componentTopology: "fitment-attached-cap-right-sidecar",
      capOffReferenceId: "c".repeat(64),
      topologyReferenceId: "d".repeat(64),
      referenceRoleId: "pdp-cap-off-sidecar",
    };
    const contract = await resolveBestBottlesRenderingContract({
      isBestBottlesStudioMasterRequest: true,
      productContext: {
        ...cylinderContext(cylinder3ml),
        ...callerSidecar,
      },
      categorizedRefs: refs(),
    }, {
      fetchProductBySku: async () => staleConvexProduct,
      fetchProductByWebsiteSku: async () => staleConvexProduct,
    });

    assert.equal(contract.status, "ready");
    for (const [key, value] of Object.entries(callerSidecar)) {
      assert.equal(contract.productContext[key], value, key);
    }
    assert.equal(contract.rig?.scaleContractVersion, "best-bottles-catalog-scale-v1");
    assert.equal(contract.rig?.targetBodyHeightPx != null, true);
  });

  it("fails closed on self-sealed malformed canonical dimensions", async () => {
    const malformedValues = ["70garbage", "NaN", "0", "-1", ""];
    for (const malformed of malformedValues) {
      const geometry = canonicalGeometryContract(cylinder3ml, { canon_bodyHeightMm: malformed });
      const contract = await resolveBestBottlesRenderingContract({
        isBestBottlesStudioMasterRequest: true,
        productContext: {
          sku: cylinder3ml.graceSku,
          websiteSku: cylinder3ml.websiteSku,
          canonicalGeometryContract: geometry,
        },
        categorizedRefs: refs(),
      }, resolver());
      assert.equal(contract.status, "blocked", malformed);
      assert.match(contract.error ?? "", /malformed/i, malformed);
    }

    const missing = canonicalGeometryContract(cylinder3ml) as Record<string, string>;
    delete missing.canon_bodyHeightMm;
    missing.sha256 = createHash("sha256").update(JSON.stringify(missing)).digest("hex");
    const missingContract = await resolveBestBottlesRenderingContract({
      isBestBottlesStudioMasterRequest: true,
      productContext: {
        sku: cylinder3ml.graceSku,
        websiteSku: cylinder3ml.websiteSku,
        canonicalGeometryContract: missing,
      },
      categorizedRefs: refs(),
    }, resolver());
    assert.equal(missingContract.status, "blocked");
    assert.match(missingContract.error ?? "", /malformed/i);
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
      productContext: cylinderContext(cylinder3ml),
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
      productContext: cylinderContext(cylinder3ml),
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
      productContext: cylinderContext(cylinder3ml),
      categorizedRefs: refs(),
    }, resolver());

    assert.equal(contract.status, "ready");
    assert.equal(contract.providerPolicy.comparisonOnly, true);
    assert.ok(contract.libraryTags.includes("contract-provider:comparison"));
  });
});
