import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildShopifyPushDryRunResult } from "./shopifyPushDryRun.ts";

describe("Shopify push dry-run result", () => {
  it("returns the resolved product and variant without media mutation fields", () => {
    const result = buildShopifyPushDryRunResult({
      imageId: "image-1",
      sku: "GB-CYL-CLR-9ML-SPR-GLD",
      matchedShopifySku: "GB-CYL-CLR-9ML-SPR-GLD",
      actualShopifySku: "GB-CYL-CLR-9ML-SPR-GLD",
      expectedCapColor: "Gold",
      manualVisualIdentityApproval: null,
      mode: "cap-on",
      variant: {
        id: "gid://shopify/ProductVariant/1",
        sku: "GB-CYL-CLR-9ML-SPR-GLD",
        title: "Gold",
        product: {
          id: "gid://shopify/Product/1",
          title: "Cylinder 9 ml",
          handle: "cylinder-9ml",
          legacyResourceId: "1",
        },
      },
      bestBottlesConvex: {
        websiteSku: "GB9MlGoldSprayer",
        graceSku: "GB-CYL-CLR-9ML-SPR-GLD",
        resolvedVia: "websiteSku",
      },
      existingVariantMedia: [
        {
          id: "gid://shopify/MediaImage/legacy",
          alt: "Legacy flat image",
          imageUrl: "https://cdn.shopify.com/legacy.png",
        },
      ],
      legacyMediaCleanupDisposition: "detach-after-successful-replacement",
    });

    assert.equal(result.status, "dry-run");
    assert.equal(result.shopifyProductId, "gid://shopify/Product/1");
    assert.equal(result.shopifyVariantId, "gid://shopify/ProductVariant/1");
    assert.equal(result.mediaId, null);
    assert.equal(result.mediaStatus, null);
    assert.equal(result.shopifyImageUrl, null);
    assert.deepEqual(result.existingVariantMedia, [
      {
        id: "gid://shopify/MediaImage/legacy",
        alt: "Legacy flat image",
        imageUrl: "https://cdn.shopify.com/legacy.png",
      },
    ]);
    assert.equal(result.legacyMediaCleanupDisposition, "detach-after-successful-replacement");
  });
});
