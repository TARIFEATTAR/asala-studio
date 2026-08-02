import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BEST_BOTTLES_DARKROOM_ASSET_TAG_SOURCE,
  BEST_BOTTLES_DARKROOM_IDENTITY_TAG_NEEDS_PRODUCT_MATCH,
  BEST_BOTTLES_DARKROOM_INTENDED_USE_PDP_CANDIDATE,
  BEST_BOTTLES_DARKROOM_STATUS_TAG_UNASSIGNED,
  BEST_BOTTLES_DARKROOM_STATUS_TAG_SKU_BOUND_CANDIDATE,
  getBestBottlesDarkroomAssetWorkflow,
  isBestBottlesDarkroomPushBlocked,
} from "./bestBottlesDarkroomAssetWorkflow";

describe("getBestBottlesDarkroomAssetWorkflow", () => {
  it("blocks an unassigned Darkroom PDP candidate from Shopify or Grace", () => {
    const workflow = getBestBottlesDarkroomAssetWorkflow({
      libraryTags: [
        "brand:best-bottles",
        BEST_BOTTLES_DARKROOM_ASSET_TAG_SOURCE,
        BEST_BOTTLES_DARKROOM_INTENDED_USE_PDP_CANDIDATE,
        BEST_BOTTLES_DARKROOM_STATUS_TAG_UNASSIGNED,
        BEST_BOTTLES_DARKROOM_IDENTITY_TAG_NEEDS_PRODUCT_MATCH,
      ],
      hasWebsiteSku: false,
      hasGraceSku: false,
      hasVerifiedProductMatch: false,
    });

    assert.equal(workflow.status, "unassigned");
    assert.equal(workflow.identityStatus, "needs-product-match");
    assert.equal(workflow.pushBlocked, true);
    assert.equal(isBestBottlesDarkroomPushBlocked(workflow), true);
    assert.deepEqual(workflow.allowedActions, ["attach-to-product", "keep-as-concept", "reject"]);
  });

  it("keeps a SKU-bound candidate blocked until it has a verified product match", () => {
    const workflow = getBestBottlesDarkroomAssetWorkflow({
      libraryTags: [
        "brand:best-bottles",
        BEST_BOTTLES_DARKROOM_ASSET_TAG_SOURCE,
        BEST_BOTTLES_DARKROOM_STATUS_TAG_SKU_BOUND_CANDIDATE,
        "websiteSku:GBCyl5RollBlkDot",
        "sku:GB-CYL-CLR-5ML-ROL-BKDT",
      ],
      hasWebsiteSku: true,
      hasGraceSku: true,
      hasVerifiedProductMatch: false,
    });

    assert.equal(workflow.status, "needs-product-match");
    assert.equal(workflow.identityStatus, "needs-product-match");
    assert.equal(workflow.pushBlocked, true);
  });

  it("allows a verified SKU-bound candidate to enter visual QA without push approval", () => {
    const workflow = getBestBottlesDarkroomAssetWorkflow({
      libraryTags: [
        "brand:best-bottles",
        BEST_BOTTLES_DARKROOM_ASSET_TAG_SOURCE,
        BEST_BOTTLES_DARKROOM_STATUS_TAG_SKU_BOUND_CANDIDATE,
        "websiteSku:GBCyl5RollBlkDot",
        "sku:GB-CYL-CLR-5ML-ROL-BKDT",
      ],
      hasWebsiteSku: true,
      hasGraceSku: true,
      hasVerifiedProductMatch: true,
    });

    assert.equal(workflow.status, "sku-bound-candidate");
    assert.equal(workflow.identityStatus, "matched");
    assert.equal(workflow.pushBlocked, false);
    assert.deepEqual(workflow.allowedActions, ["visual-qa", "keep-as-concept", "reject"]);
  });

  it("promotes an explicitly unassigned image after website SKU attachment verifies product truth", () => {
    const workflow = getBestBottlesDarkroomAssetWorkflow({
      libraryTags: [
        "brand:best-bottles",
        BEST_BOTTLES_DARKROOM_ASSET_TAG_SOURCE,
        BEST_BOTTLES_DARKROOM_STATUS_TAG_UNASSIGNED,
        BEST_BOTTLES_DARKROOM_IDENTITY_TAG_NEEDS_PRODUCT_MATCH,
        "push-blocked:true",
        "websiteSku:GBCyl5RollBlkDot",
        "sku:GB-CYL-CLR-5ML-ROL-BKDT",
      ],
      hasWebsiteSku: true,
      hasGraceSku: true,
      hasVerifiedProductMatch: true,
    });

    assert.equal(workflow.status, "sku-bound-candidate");
    assert.equal(workflow.identityStatus, "matched");
    assert.equal(workflow.pushBlocked, false);
  });

  it("blocks explicit truth conflicts even when SKUs are present", () => {
    const workflow = getBestBottlesDarkroomAssetWorkflow({
      libraryTags: [
        "brand:best-bottles",
        BEST_BOTTLES_DARKROOM_ASSET_TAG_SOURCE,
        "asset-status:truth-conflict",
        "identity-status:truth-conflict",
        "websiteSku:GBCyl5RollBlkDot",
        "sku:GB-CYL-CLR-5ML-ROL-BKDT",
      ],
      hasWebsiteSku: true,
      hasGraceSku: true,
      hasVerifiedProductMatch: true,
    });

    assert.equal(workflow.status, "truth-conflict");
    assert.equal(workflow.identityStatus, "truth-conflict");
    assert.equal(workflow.pushBlocked, true);
    assert.deepEqual(workflow.allowedActions, ["attach-to-product", "keep-as-concept", "reject"]);
  });

  it("does not broadly classify untagged legacy images as Darkroom unassigned work", () => {
    const workflow = getBestBottlesDarkroomAssetWorkflow({
      libraryTags: ["brand:best-bottles", "sku:GB-CYL-CLR-5ML-ROL-BKDT"],
      hasWebsiteSku: true,
      hasGraceSku: true,
      hasVerifiedProductMatch: true,
    });

    assert.equal(workflow.status, "not-darkroom-workflow");
    assert.equal(workflow.pushBlocked, false);
    assert.deepEqual(workflow.allowedActions, []);
  });
});
