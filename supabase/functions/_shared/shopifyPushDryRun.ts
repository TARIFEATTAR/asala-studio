export type ShopifyPushDryRunVariant = {
  id: string;
  sku: string | null;
  title: string | null;
  product: {
    id: string;
    title: string;
    handle: string | null;
    legacyResourceId?: string | null;
  };
};

export type ShopifyPushDryRunMode = "cap-on" | "cap-off";

export type ShopifyPushDryRunExistingVariantMedia = {
  id: string;
  alt: string | null;
  imageUrl: string | null;
};

export function buildShopifyPushDryRunResult(params: {
  imageId?: string;
  sku: string;
  matchedShopifySku: string;
  actualShopifySku: string;
  expectedCapColor?: string | null;
  manualVisualIdentityApproval?: unknown;
  mode: ShopifyPushDryRunMode;
  variant: ShopifyPushDryRunVariant;
  bestBottlesConvex?: unknown;
  existingVariantMedia?: ShopifyPushDryRunExistingVariantMedia[];
  legacyMediaCleanupDisposition?: string | null;
}): Record<string, unknown> {
  return {
    imageId: params.imageId,
    sku: params.sku,
    matchedShopifySku: params.matchedShopifySku,
    actualShopifySku: params.actualShopifySku,
    expectedCapColor: params.expectedCapColor ?? null,
    manualVisualIdentityApproval: params.manualVisualIdentityApproval ?? null,
    mode: params.mode,
    status: "dry-run",
    shopifyProductId: params.variant.product.id,
    shopifyVariantId: params.variant.id,
    productTitle: params.variant.product.title,
    productHandle: params.variant.product.handle ?? null,
    variantTitle: params.variant.title ?? null,
    mediaId: null,
    mediaStatus: null,
    shopifyImageUrl: null,
    bestBottlesConvex: params.bestBottlesConvex ?? null,
    existingVariantMedia: params.existingVariantMedia ?? [],
    legacyMediaCleanupDisposition: params.legacyMediaCleanupDisposition ?? null,
  };
}
