import type { PipelineSkuJob } from "@/lib/bestBottlesPipeline";
import {
  resolveBestBottlesVisualIdentity,
  type BestBottlesVisualProduct,
} from "@/lib/bestBottlesVisualIdentity";

export type BestBottlesShopifyPushItem = {
  imageId: string | null;
  imageUrl: string | null;
  sku: string;
  websiteSku: string;
  graceSku: string;
  expectedCapColor?: string;
  altText: string;
};

export function expectedBestBottlesVisualIdentityForProduct(
  product: BestBottlesVisualProduct | null | undefined,
): string {
  const resolution = resolveBestBottlesVisualIdentity(product ?? null);
  return resolution.safeToPush ? resolution.resolvedVisualIdentity : "";
}

export function expectedBestBottlesVisualIdentityForSkuJob(job: PipelineSkuJob): string {
  return expectedBestBottlesVisualIdentityForProduct({
    graceSku: job.grace_sku,
    websiteSku: job.website_sku,
    family: job.family,
    category: job.category,
    color: job.canonical_color,
    applicator: job.applicator,
    itemName: job.product_group_display_name,
  });
}

export function buildBestBottlesShopifyPushItemFromSkuJob(
  job: PipelineSkuJob,
): BestBottlesShopifyPushItem {
  const expectedCapColor = expectedBestBottlesVisualIdentityForSkuJob(job);

  return {
    imageId: job.approved_image_id,
    imageUrl: job.approved_image_url,
    sku: job.shopify_sku ?? job.website_sku,
    websiteSku: job.website_sku,
    graceSku: job.grace_sku,
    expectedCapColor: expectedCapColor || undefined,
    altText: job.product_group_display_name ?? job.website_sku,
  };
}
