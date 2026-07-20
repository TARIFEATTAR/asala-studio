import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { Product } from "@/integrations/convex/bestBottles";
import type { BestBottlesWebsiteTruthRow } from "./bestBottlesWebsiteTruth.ts";
import {
  buildBestBottlesLiveTruthRecovery,
  isCatalogRelatedMadisonFailure,
} from "./bestBottlesLiveTruthRecovery.ts";

const product = {
  _id: "product-1",
  websiteSku: "GBSpry3mlClBlk",
  graceSku: "GB-SPR-CLR-3ML-BLK",
  category: "Glass Bottle",
  family: "Cylinder",
  color: "Clear",
  capacity: "3 ml",
  capacityMl: 3,
  capacityOz: 0.1,
  heightWithCap: "54 ±1 mm",
  heightWithoutCap: "37 ±0.5 mm",
  diameter: "14 ±0.5 mm",
  neckThreadSize: "12mm",
  applicator: "Fine Mist Sprayer",
  capStyle: "Clear Cap",
  capColor: "Clear",
  trimColor: "Black",
  bottleCollection: "Cylinder",
  itemName: "GBSpry3mlClBlk",
  itemDescription: "3 ml clear glass bottle with black spray pump and clear cap",
  stockStatus: "In stock",
  verified: false,
  productGroupSlug: "cylinder-3ml-clear-12mm-finemist",
} satisfies Product;

const truthRow = {
  truthStatus: "alias_exception",
  truthStatusLabel: "Live-Verified Taxonomy Alias",
  severity: "info",
  issueTypes: "live_verified_sprayer_commercial_family_with_cylinder_geometry_cohort",
  commercialLane: "pdp",
  websiteSku: "GBSpry3mlClBlk",
  graceSku: "GB-SPR-CLR-3ML-BLK",
  convexGraceSku: "GB-SPR-CLR-3ML-BLK",
  expectedFamily: "Spray Bottle",
  convexFamily: "Cylinder",
  productGroupSlug: "cylinder-3ml-clear-12mm-finemist",
  liveEvidenceStatus: "verified_current_live_pdp_2026-07-11",
  liveWebsiteSkuPresent: "true",
  liveFamily: "Refillable Glass Bottles with Fine Mist Sprayers",
  liveConfiguration: "3 ml clear glass; black spray pump; clear cap",
  liveSourceUrl: "https://www.bestbottles.com/product/sample-spray",
  liveFinalUrl: "https://www.bestbottles.com/product/sample-spray",
} satisfies BestBottlesWebsiteTruthRow;

describe("Best Bottles live truth recovery", () => {
  it("classifies catalog failures but ignores provider outages", () => {
    assert.equal(isCatalogRelatedMadisonFailure("Website truth conflict: family mismatch"), true);
    assert.equal(isCatalogRelatedMadisonFailure("Reference is not usable"), true);
    assert.equal(isCatalogRelatedMadisonFailure("OpenAI rate limit exceeded"), false);
  });

  it("builds exact live-site evidence routes and remains fail-closed", () => {
    const recovery = buildBestBottlesLiveTruthRecovery(
      product,
      "website_truth",
      "family mismatch",
      truthRow,
    );

    assert.equal(recovery.websiteSku, "GBSpry3mlClBlk");
    assert.equal(recovery.pdpUrl, truthRow.liveFinalUrl);
    assert.equal(
      recovery.searchUrl,
      "https://www.bestbottles.com/all-bottles/all-items/search-products.php?search_name=GBSpry3mlClBlk",
    );
    assert.equal(
      recovery.primaryImageUrl,
      "https://www.bestbottles.com/images/store/enlarged_pics/GBSpry3mlClBlk.gif",
    );
    assert.equal(recovery.liveEvidenceStatus, "verified");
    assert.equal(recovery.generationBlocked, true);
  });

  it("requires verification when no current live PDP evidence is recorded", () => {
    const recovery = buildBestBottlesLiveTruthRecovery(product, "reference", "missing reference", null);
    assert.equal(recovery.pdpUrl, null);
    assert.equal(recovery.liveEvidenceStatus, "verification_required");
    assert.equal(recovery.generationBlocked, true);
  });
});
