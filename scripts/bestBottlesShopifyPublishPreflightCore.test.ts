import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildShopifyPublishPreflightRows,
  deriveLegacyMediaCleanupDisposition,
  type ShopifyPublishPreflightSkuJobRow,
} from "./bestBottlesShopifyPublishPreflightCore.ts";

function row(overrides: Partial<ShopifyPublishPreflightSkuJobRow> = {}): ShopifyPublishPreflightSkuJobRow {
  return {
    id: "job-1",
    product_group_slug: "cylinder-9ml-swirl-17-415-finemist",
    product_group_display_name: "Cylinder 9ml Swirl",
    family: "Cylinder",
    category: "Glass Bottle",
    capacity_ml: 9,
    applicator: "Fine Mist Sprayer",
    canonical_color: "Clear",
    grace_sku: "GB-CYL-CLR-9ML-SPR-GLD",
    website_sku: "GB9MlGoldSprayer",
    shopify_sku: "GB-CYL-CLR-9ML-SPR-GLD",
    status: "approved",
    approved_image_id: "image-1",
    approved_image_url: "https://images.example.com/approved.png",
    generated_image_id: "generated-1",
    generated_image_url: "https://images.example.com/generated.png",
    shopify_product_id: null,
    shopify_variant_id: null,
    shopify_media_id: null,
    shopify_image_url: null,
    shopify_pushed_at: null,
    convex_synced_at: null,
    last_error: null,
    ...overrides,
  };
}

describe("Best Bottles Shopify publish preflight core", () => {
  it("selects only approved-keep rows with public images and exact Shopify SKUs", () => {
    const rows = buildShopifyPublishPreflightRows({
      jobs: [
        row(),
        row({
          id: "unreviewed",
          grace_sku: "GB-CYL-CLR-9ML-SPR-RED",
          website_sku: "GB9MlRedSprayer",
          shopify_sku: "GB-CYL-CLR-9ML-SPR-RED",
          approved_image_id: "image-2",
        }),
        row({
          id: "missing-shopify",
          grace_sku: "GB-CYL-CLR-9ML-SPR-BLK",
          website_sku: "GB9MlBlackSprayer",
          shopify_sku: null,
        }),
        row({
          id: "already-pushed",
          grace_sku: "GB-CYL-CLR-9ML-SPR-SSLV",
          website_sku: "GB9MlSilverSprayer",
          shopify_sku: "GB-CYL-CLR-9ML-SPR-SSLV",
          status: "shopify-pushed",
          shopify_media_id: "gid://shopify/MediaImage/1",
        }),
      ],
      imageTagsById: new Map([
        ["image-1", ["status:approved-keep"]],
        ["image-2", ["status:unreviewed"]],
      ]),
    });

    assert.deepEqual(rows.summary, {
      totalRows: 4,
      eligible: 1,
      blocked: 3,
      duplicateSkuKeys: 0,
    });
    assert.equal(rows.rows.find((hit) => hit.id === "job-1")?.status, "eligible");
    assert.equal(rows.rows.find((hit) => hit.id === "unreviewed")?.status, "blocked");
    assert.deepEqual(rows.rows.find((hit) => hit.id === "unreviewed")?.blockReasons, [
      "approval-not-approved-keep",
    ]);
    assert.deepEqual(rows.rows.find((hit) => hit.id === "missing-shopify")?.blockReasons, [
      "missing-shopify-sku",
    ]);
    assert.deepEqual(rows.rows.find((hit) => hit.id === "already-pushed")?.blockReasons, [
      "already-pushed-or-synced",
    ]);
    assert.deepEqual(rows.pushItems, [
      {
        imageId: "image-1",
        imageUrl: "https://images.example.com/approved.png",
        sku: "GB-CYL-CLR-9ML-SPR-GLD",
        websiteSku: "GB9MlGoldSprayer",
        graceSku: "GB-CYL-CLR-9ML-SPR-GLD",
        expectedCapColor: undefined,
        altText: "Cylinder 9ml Swirl",
      },
    ]);
  });

  it("blocks publish rows whose alias keys collide with another SKU job", () => {
    const rows = buildShopifyPublishPreflightRows({
      jobs: [
        row({
          id: "matte",
          grace_sku: "GB-CYL-CLR-100ML-RDC-MSLV",
          website_sku: "GBCyl100RdcrMtSl",
          shopify_sku: "GB-CYL-CLR-100ML-RDC-MSLV",
        }),
        row({
          id: "matte-duplicate",
          grace_sku: "GB-CYL-CLR-100ML-RDC-MSLV-01",
          website_sku: "GBCyl100RdcrMtSl",
          shopify_sku: "GB-CYL-CLR-100ML-RDC-MSLV-01",
          approved_image_id: "image-2",
        }),
      ],
      imageTagsById: new Map([
        ["image-1", ["status:approved-keep"]],
        ["image-2", ["status:approved-keep"]],
      ]),
    });

    assert.equal(rows.summary.eligible, 0);
    assert.equal(rows.summary.duplicateSkuKeys, 1);
    assert.deepEqual(rows.rows.map((hit) => hit.blockReasons), [
      ["duplicate-sku-key:GBCYL100RDCRMTSL"],
      ["duplicate-sku-key:GBCYL100RDCRMTSL"],
    ]);
  });

  it("prepares legacy Shopify media for detach-only cleanup after a replacement dry-run resolves", () => {
    assert.equal(
      deriveLegacyMediaCleanupDisposition({
        eligibleForPush: true,
        dryRunStatus: "dry-run",
        existingVariantMediaCount: 2,
      }),
      "detach-after-successful-replacement",
    );
    assert.equal(
      deriveLegacyMediaCleanupDisposition({
        eligibleForPush: false,
        dryRunStatus: "blocked",
        existingVariantMediaCount: 2,
      }),
      "blocked-until-approved-replacement",
    );
    assert.equal(
      deriveLegacyMediaCleanupDisposition({
        eligibleForPush: true,
        dryRunStatus: "dry-run",
        existingVariantMediaCount: 0,
      }),
      "no-existing-variant-media",
    );
  });
});
