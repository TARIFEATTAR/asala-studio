import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getEffectiveBestBottlesWebsiteTruthStatus,
  getBestBottlesWebsiteTruthBlocker,
  type BestBottlesWebsiteTruthRow,
} from "./bestBottlesWebsiteTruth";

function row(
  overrides: Partial<BestBottlesWebsiteTruthRow> = {},
): BestBottlesWebsiteTruthRow {
  return {
    truthStatus: "ready",
    truthStatusLabel: "Ready",
    severity: "pass",
    issueTypes: "",
    commercialLane: "pdp",
    websiteSku: "GBCyl9MtlRollMattCu",
    graceSku: "GB-CYL-CLR-9ML-T-03",
    convexGraceSku: "GB-CYL-CLR-9ML-T-03",
    expectedFamily: "Cylinder",
    convexFamily: "Cylinder",
    productGroupSlug: "cylinder-9ml-clear-17-415-rollon",
    liveEvidenceStatus: "",
    liveWebsiteSkuPresent: "",
    liveFamily: "",
    liveConfiguration: "",
    liveSourceUrl: "",
    liveFinalUrl: "",
    ...overrides,
  };
}

describe("Best Bottles website truth gate", () => {
  it("allows truth-ready PDP SKUs", () => {
    assert.equal(getBestBottlesWebsiteTruthBlocker(row()), null);
  });

  it("allows an individually live-verified taxonomy alias", () => {
    assert.equal(
      getBestBottlesWebsiteTruthBlocker(
        row({
          truthStatus: "alias_exception",
          truthStatusLabel: "Live-Verified Taxonomy Alias",
          issueTypes: "live_verified_sprayer_commercial_family_with_cylinder_geometry_cohort",
          liveEvidenceStatus: "verified_current_live_pdp_2026-07-11",
          liveWebsiteSkuPresent: "true",
          liveSourceUrl: "https://www.bestbottles.com/product/example",
        }),
      ),
      null,
    );
  });

  it("normalizes the exact white 3 ml Spray Bottle commercial family to Cylinder geometry", () => {
    const whiteSprayer = row({
      truthStatus: "truth_conflict",
      truthStatusLabel: "Truth Conflict",
      severity: "medium",
      issueTypes: "convex_family_mismatch_with_website_sku;product_group_slug_family_mismatch",
      websiteSku: "GBSpry3mlClWht",
      graceSku: "GB-SPR-CLR-3ML-WHT",
      convexGraceSku: "GB-SPR-CLR-3ML-WHT",
      expectedFamily: "Spray Bottle",
      convexFamily: "Cylinder",
      sourceCategory: "Glass Bottle",
      productGroupSlug: "cylinder-3ml-clear-12mm-finemist",
    });

    assert.equal(getEffectiveBestBottlesWebsiteTruthStatus(whiteSprayer), "alias_exception");
    assert.equal(getBestBottlesWebsiteTruthBlocker(whiteSprayer), null);
  });

  it("normalizes Tall Cylinder commercial naming to the Cylinder geometry cohort", () => {
    const tallCylinder = row({
      truthStatus: "truth_conflict",
      truthStatusLabel: "Truth Conflict",
      severity: "high",
      issueTypes:
        "convex_family_mismatch_with_website_sku;product_group_slug_family_mismatch;source_family_conflicts_with_website_sku;grace_prefix_alias_exception",
      websiteSku: "GBTallCyl9Gl",
      graceSku: "GB-CYL-CLR-9ML-GLD-T",
      convexGraceSku: "GB-CYL-CLR-9ML-GLD-T",
      expectedFamily: "Tall Cylinder",
      convexFamily: "Cylinder",
      sourceCategory: "Glass Bottle",
      productGroupSlug: "cylinder-9ml-clear-13-415",
    });

    assert.equal(getEffectiveBestBottlesWebsiteTruthStatus(tallCylinder), "alias_exception");
    assert.equal(getBestBottlesWebsiteTruthBlocker(tallCylinder), null);
  });

  it("does not normalize duplicate or missing-Convex conflicts", () => {
    for (const issueTypes of [
      "duplicate_convex_website_sku;convex_family_mismatch_with_website_sku;product_group_slug_family_mismatch",
      "missing_convex_row_for_website_sku;convex_family_mismatch_with_website_sku;product_group_slug_family_mismatch",
    ]) {
      const conflicted = row({
        truthStatus: "truth_conflict",
        truthStatusLabel: "Truth Conflict",
        issueTypes,
        websiteSku: "GBSpry3mlClWht",
        graceSku: "GB-SPR-CLR-3ML-WHT",
        convexGraceSku: "GB-SPR-CLR-3ML-WHT",
        expectedFamily: "Spray Bottle",
        convexFamily: "Cylinder",
        sourceCategory: "Glass Bottle",
        productGroupSlug: "cylinder-3ml-clear-12mm-finemist",
      });
      assert.equal(getEffectiveBestBottlesWebsiteTruthStatus(conflicted), "truth_conflict");
      assert.match(getBestBottlesWebsiteTruthBlocker(conflicted) ?? "", /Truth Conflict/);
    }
  });

  it("does not normalize bad identity, bad slug, unrelated family, or Vial aliases", () => {
    const validBase: Partial<BestBottlesWebsiteTruthRow> = {
      truthStatus: "truth_conflict",
      truthStatusLabel: "Truth Conflict",
      issueTypes: "convex_family_mismatch_with_website_sku;product_group_slug_family_mismatch",
      websiteSku: "GBSpry3mlClWht",
      graceSku: "GB-SPR-CLR-3ML-WHT",
      convexGraceSku: "GB-SPR-CLR-3ML-WHT",
      expectedFamily: "Spray Bottle",
      convexFamily: "Cylinder",
      sourceCategory: "Glass Bottle",
      productGroupSlug: "cylinder-3ml-clear-12mm-finemist",
    };
    const blockedRows = [
      row({ ...validBase, convexGraceSku: "GB-SPR-CLR-3ML-BLK" }),
      row({ ...validBase, productGroupSlug: "vial-3ml-clear-12mm-finemist" }),
      row({ ...validBase, expectedFamily: "Square", convexFamily: "Rectangle" }),
      row({ ...validBase, expectedFamily: "Vial", convexFamily: "Cylinder" }),
    ];

    for (const blocked of blockedRows) {
      assert.equal(getEffectiveBestBottlesWebsiteTruthStatus(blocked), "truth_conflict");
      assert.match(getBestBottlesWebsiteTruthBlocker(blocked) ?? "", /Truth Conflict/);
    }
  });

  it("blocks truth conflicts and preserves the issue names", () => {
    const blocker = getBestBottlesWebsiteTruthBlocker(
      row({
        truthStatus: "truth_conflict",
        truthStatusLabel: "Truth Conflict",
        issueTypes: "convex_family_mismatch_with_website_sku;product_group_slug_family_mismatch",
      }),
    );
    assert.match(blocker ?? "", /Truth Conflict/);
    assert.match(blocker ?? "", /convex_family_mismatch_with_website_sku/);
  });


  it("blocks missing audit evidence and component-lane rows", () => {
    assert.match(getBestBottlesWebsiteTruthBlocker(null) ?? "", /No website-truth audit row/);
    assert.match(
      getBestBottlesWebsiteTruthBlocker(
        row({ truthStatus: "component_lane", commercialLane: "component" }),
      ) ?? "",
      /component asset/,
    );
  });
});
