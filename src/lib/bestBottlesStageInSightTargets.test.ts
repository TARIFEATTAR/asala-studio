import test from "node:test";
import assert from "node:assert/strict";
import {
  buildStageInSightGenerationTargets,
  STAGE_IN_SIGHT_GENERATION_FAMILY_TARGETS,
  stageInSightSkuKeys,
} from "./bestBottlesStageInSightTargets";

test("Stage In Sight generation lane keeps the exact requested family order", () => {
  assert.deepEqual(
    STAGE_IN_SIGHT_GENERATION_FAMILY_TARGETS.map((target) => target.family),
    ["Sleek", "Slim", "Roll-On Cap", "Cap/Closure", "Sprayer", "Rectangle", "Dropper"],
  );
});

test("stageInSightSkuKeys matches by Grace SKU and website SKU", () => {
  assert.deepEqual(stageInSightSkuKeys({ sku: " GB-SLK-1 ", website_sku: " GBSleek1 " }), [
    "gb-slk-1",
    "gbsleek1",
  ]);
});

test("buildStageInSightGenerationTargets excludes already-generated cleanup rows", () => {
  const targets = buildStageInSightGenerationTargets({
    generatedAt: "2026-06-15T10:00:00.000Z",
    missingShopifyVariantImages: [
      {
        family: "Sleek",
        product_group_slug: "sleek-5ml-clear-13-415-rollon",
        sku: "GB-SLK-CLR-5ML-ROL-SBLK",
        website_sku: "GBSlk5RollBlk",
        shopify_variant_id: "gid://shopify/ProductVariant/1",
        generation_bucket: "generate_from_legacy_reference",
      },
      {
        family: "Sleek",
        product_group_slug: "sleek-5ml-clear-13-415-rollon",
        sku: "GB-SLK-CLR-5ML-ROL-SGLD",
        website_sku: "GBSlk5RollGold",
      },
      {
        family: "Atomizer",
        product_group_slug: "atomizer-5ml-black",
        sku: "GB-SHOULD-NOT-INCLUDE",
      },
      {
        family: "Dropper",
        product_group_slug: "dropper-30ml-clear-18-400",
        sku: "GB-DRP-CLR-30ML-GLD-T",
      },
    ],
    generatedInMadisonButNotShopify: [
      {
        family: "Sleek",
        sku: "GB-SLK-CLR-5ML-ROL-SBLK",
        website_sku: "GBSlk5RollBlk",
      },
    ],
  });

  assert.equal(targets.generatedAt, "2026-06-15T10:00:00.000Z");
  assert.equal(targets.summary.total, 2);
  assert.equal(targets.summary.alreadyGeneratedExcluded, 1);
  assert.equal(targets.summary.byFamily.Sleek, 1);
  assert.equal(targets.summary.byFamily.Dropper, 1);
  assert.equal(targets.summary.byFamily.Slim, 0);
  assert.deepEqual(
    targets.rows.map((row) => `${row.family}:${row.sku}`),
    ["Sleek:GB-SLK-CLR-5ML-ROL-SGLD", "Dropper:GB-DRP-CLR-30ML-GLD-T"],
  );
});
