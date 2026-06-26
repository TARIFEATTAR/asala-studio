import test from "node:test";
import assert from "node:assert/strict";
import {
  buildBestBottlesLaunchReconciliation,
  productMediaSampleHasExactSku,
} from "./bestBottlesLaunchReconciliation";

test("productMediaSampleHasExactSku requires an exact SKU filename token", () => {
  assert.equal(
    productMediaSampleHasExactSku(
      "https://cdn.shopify.com/files/GB-SLK-CLR-5ML-SLV-T__GBSleek5Sl__pdp-main__v001.png",
      "GB-SLK-CLR-5ML-S",
    ),
    false,
  );
  assert.equal(
    productMediaSampleHasExactSku(
      "https://cdn.shopify.com/files/GB-SLK-CLR-5ML-S__GBSleek5Short__pdp-main__v001.png",
      "GB-SLK-CLR-5ML-S",
    ),
    true,
  );
});

test("launch reconciliation classifies local, legacy, existing media, and truth blockers by Grace SKU", () => {
  const manifest = buildBestBottlesLaunchReconciliation({
    generatedAt: "2026-06-15T12:00:00.000Z",
    residualRows: [
      {
        family: "Sleek",
        product_group_slug: "sleek-5ml-clear-13-415-rollon",
        sku: "GB-SLK-CLR-5ML-ROL-SBLK",
        website_sku: "GBSleek5RollBlk",
        product_media_count: "0",
        issue: "no_product_media",
        recommended_next_action: "Generate/upload correct product media.",
      },
      {
        family: "Cylinder",
        product_group_slug: "cylinder-28ml-clear-16mm-rollon",
        sku: "GB-CYL-CLR-28ML-RBL-WHT",
        website_sku: "GBCyl1ozRollWht",
        product_media_count: "0",
        issue: "no_product_media",
      },
      {
        family: "Elegant",
        product_group_slug: "elegant-30ml-clear-15-415-perfumespray",
        sku: "GB-ELG-CLR-30ML-SPR-SGLD",
        website_sku: "GBElg30SpryShGl",
        product_media_count: "3",
        issue: "shopify_product_media_present_but_variant_image_missing",
        product_media_sample:
          "https://cdn.shopify.com/files/GB-ELG-CLR-30ML-SPR-MSLV.png?v=1 | https://cdn.shopify.com/files/GB-ELG-CLR-30ML-SPR-MGLD.png?v=1",
      },
      {
        family: "Vial",
        product_group_slug: "vial-4ml-clear-13-425",
        sku: "GB-VIA-CLR-3ML-S-02",
        website_sku: "GBV1DrmWhtCapSht",
        product_media_count: "0",
        issue: "no_product_media",
      },
    ],
    coverageRows: [
      {
        graceSku: "GB-SLK-CLR-5ML-ROL-SBLK",
        websiteSku: "GBSleek5RollBlk",
        family: "Sleek",
        productGroupSlug: "sleek-5ml-clear-13-415-rollon",
        capacity: "5 ml",
        color: "Clear",
        applicator: "Roll-on",
        capColor: "Black",
      },
      {
        graceSku: "GB-CYL-CLR-28ML-RBL-WHT",
        websiteSku: "GBCyl1ozRollWht",
        family: "Cylinder",
        productGroupSlug: "cylinder-28ml-clear-16mm-rollon",
        referenceUrl: "https://www.bestbottles.com/images/store/enlarged_pics/GBCyl28RollWht.gif",
        generationBucket: "generate_from_legacy_reference",
      },
      {
        graceSku: "GB-ELG-CLR-30ML-SPR-SGLD",
        websiteSku: "GBElg30SpryShGl",
        family: "Elegant",
        productGroupSlug: "elegant-30ml-clear-15-415-perfumespray",
        coverageEvidenceUrl: "https://cdn.shopify.com/files/GB-ELG-CLR-30ML-SPR-SGLD.png?v=1",
      },
      {
        graceSku: "GB-VIA-CLR-3ML-S-02",
        websiteSku: "GBVialDifferent",
        family: "Vial",
        productGroupSlug: "vial-4ml-clear-13-425",
      },
    ],
    localReferenceRows: [
      {
        graceSku: "GB-SLK-CLR-5ML-ROL-SBLK",
        websiteSku: "GBSleek5RollBlk",
        family: "Sleek",
        productGroupSlug: "sleek-5ml-clear-13-415-rollon",
        absoluteReferencePath: "/refs/GB-SLK-CLR-5ML-ROL-SBLK.png",
        bestReferenceCandidatePath: "pipeline/renders/GB-SLK-CLR-5ML-ROL-SBLK.png",
      },
    ],
    legacyReferenceRows: [
      {
        graceSku: "GB-CYL-CLR-28ML-RBL-WHT",
        websiteSku: "GBCyl1ozRollWht",
        family: "Cylinder",
        liveReferenceUrl: "https://www.bestbottles.com/images/store/enlarged_pics/GBCyl28RollWht.gif",
      },
    ],
    blockerRows: [],
  });

  assert.equal(manifest.summary.totalRows, 4);
  assert.equal(manifest.summary.byActionBucket.generate_from_local_reference, 1);
  assert.equal(manifest.summary.byActionBucket.generate_from_legacy_reference, 1);
  assert.equal(manifest.summary.byActionBucket.assign_existing_media, 1);
  assert.equal(manifest.summary.byActionBucket.blocked_truth_review, 1);
  assert.deepEqual(
    manifest.rows.map((row) => [row.graceSku, row.actionBucket, row.referenceSource]),
    [
      ["GB-CYL-CLR-28ML-RBL-WHT", "generate_from_legacy_reference", "legacy_site"],
      ["GB-ELG-CLR-30ML-SPR-SGLD", "assign_existing_media", "shopify_existing_media"],
      ["GB-SLK-CLR-5ML-ROL-SBLK", "generate_from_local_reference", "local_repo"],
      ["GB-VIA-CLR-3ML-S-02", "blocked_truth_review", "blocked"],
    ],
  );
});

test("launch reconciliation never collapses duplicate website SKUs", () => {
  const manifest = buildBestBottlesLaunchReconciliation({
    generatedAt: "2026-06-15T12:00:00.000Z",
    residualRows: [
      {
        family: "Diva",
        product_group_slug: "diva-30ml-clear-15-415-reducer",
        sku: "GB-DIV-CLR-30ML-RDC-BLK",
        website_sku: "GBDiva30RdcrShared",
        product_media_count: "0",
      },
      {
        family: "Diva",
        product_group_slug: "diva-30ml-clear-15-415-reducer",
        sku: "GB-DIV-CLR-30ML-RDC-SLV",
        website_sku: "GBDiva30RdcrShared",
        product_media_count: "0",
      },
    ],
    coverageRows: [],
    localReferenceRows: [
      {
        graceSku: "GB-DIV-CLR-30ML-RDC-BLK",
        websiteSku: "GBDiva30RdcrShared",
        family: "Diva",
        absoluteReferencePath: "/refs/black.png",
      },
    ],
    legacyReferenceRows: [
      {
        graceSku: "GB-DIV-CLR-30ML-RDC-SLV",
        websiteSku: "GBDiva30RdcrShared",
        family: "Diva",
        liveReferenceUrl: "https://www.bestbottles.com/images/store/enlarged_pics/silver.gif",
      },
    ],
    blockerRows: [],
  });

  assert.equal(manifest.summary.duplicateWebsiteSkuKeys, 1);
  assert.deepEqual(
    manifest.rows.map((row) => [row.graceSku, row.actionBucket, row.referenceSource]),
    [
      ["GB-DIV-CLR-30ML-RDC-BLK", "generate_from_local_reference", "local_repo"],
      ["GB-DIV-CLR-30ML-RDC-SLV", "generate_from_legacy_reference", "legacy_site"],
    ],
  );
});
