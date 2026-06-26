import { getBestBottlesApprovalStatus } from "../src/lib/bestBottlesImageCoverage.ts";
import { expectedBestBottlesVisualIdentityForProduct } from "../src/lib/bestBottlesShopifyPushIdentity.ts";

export type ShopifyPublishPreflightSkuJobRow = {
  id: string;
  product_group_slug: string;
  product_group_display_name: string | null;
  family: string | null;
  category: string | null;
  capacity_ml: number | null;
  applicator: string | null;
  canonical_color: string | null;
  grace_sku: string | null;
  website_sku: string | null;
  shopify_sku: string | null;
  status: string | null;
  approved_image_id: string | null;
  approved_image_url: string | null;
  generated_image_id: string | null;
  generated_image_url: string | null;
  shopify_product_id: string | null;
  shopify_variant_id: string | null;
  shopify_media_id: string | null;
  shopify_image_url: string | null;
  shopify_pushed_at: string | null;
  convex_synced_at: string | null;
  last_error: string | null;
};

export type ShopifyPublishPreflightBlockReason =
  | "status-not-approved"
  | "approval-not-approved-keep"
  | "missing-approved-image-url"
  | "missing-shopify-sku"
  | "already-pushed-or-synced"
  | `duplicate-sku-key:${string}`;

export type ShopifyPublishPreflightPushItem = {
  imageId: string | null;
  imageUrl: string | null;
  sku: string;
  websiteSku: string;
  graceSku: string;
  expectedCapColor?: string;
  altText: string;
};

export type ShopifyPublishPreflightRow = {
  id: string;
  graceSku: string;
  websiteSku: string;
  shopifySku: string;
  productGroupSlug: string;
  productGroupDisplayName: string;
  family: string;
  status: "eligible" | "blocked";
  approvalStatus: string | null;
  approvedImageId: string | null;
  approvedImageUrl: string | null;
  blockReasons: ShopifyPublishPreflightBlockReason[];
  pushItem: ShopifyPublishPreflightPushItem | null;
};

export type ShopifyPublishPreflightSummary = {
  totalRows: number;
  eligible: number;
  blocked: number;
  duplicateSkuKeys: number;
};

export type ShopifyPublishPreflightBuildResult = {
  summary: ShopifyPublishPreflightSummary;
  rows: ShopifyPublishPreflightRow[];
  pushItems: ShopifyPublishPreflightPushItem[];
  duplicateSkuKeys: Array<{ key: string; rowIds: string[]; graceSkus: string[] }>;
};

export type LegacyMediaCleanupDisposition =
  | "no-existing-variant-media"
  | "detach-after-successful-replacement"
  | "blocked-until-approved-replacement";

function clean(value: string | null | undefined): string {
  return String(value ?? "").trim();
}

function normalizeSkuKey(value: string | null | undefined): string {
  return clean(value).toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function isPublicUrl(value: string | null | undefined): boolean {
  return /^https?:\/\//i.test(clean(value));
}

function hasShopifyDestination(row: ShopifyPublishPreflightSkuJobRow): boolean {
  return Boolean(
    clean(row.status).toLowerCase() === "shopify-pushed" ||
      clean(row.status).toLowerCase() === "synced" ||
      row.shopify_pushed_at ||
      row.shopify_image_url ||
      row.shopify_media_id,
  );
}

function skuKeysForRow(row: ShopifyPublishPreflightSkuJobRow): string[] {
  return Array.from(
    new Set(
      [row.grace_sku, row.website_sku, row.shopify_sku]
        .map(normalizeSkuKey)
        .filter(Boolean),
    ),
  );
}

function findDuplicateSkuKeys(rows: ShopifyPublishPreflightSkuJobRow[]): Array<{
  key: string;
  rowIds: string[];
  graceSkus: string[];
}> {
  const byKey = new Map<string, { rowIds: Set<string>; graceSkus: Set<string> }>();
  for (const row of rows) {
    for (const key of skuKeysForRow(row)) {
      const hit = byKey.get(key) ?? { rowIds: new Set<string>(), graceSkus: new Set<string>() };
      hit.rowIds.add(row.id);
      const graceSku = clean(row.grace_sku);
      if (graceSku) hit.graceSkus.add(graceSku);
      byKey.set(key, hit);
    }
  }

  return Array.from(byKey.entries())
    .filter(([, hit]) => hit.rowIds.size > 1)
    .map(([key, hit]) => ({
      key,
      rowIds: Array.from(hit.rowIds).sort(),
      graceSkus: Array.from(hit.graceSkus).sort(),
    }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

function buildPushItem(row: ShopifyPublishPreflightSkuJobRow): ShopifyPublishPreflightPushItem {
  const expectedCapColor = expectedBestBottlesVisualIdentityForProduct({
    graceSku: clean(row.grace_sku),
    websiteSku: clean(row.website_sku),
    family: clean(row.family),
    category: clean(row.category),
    color: clean(row.canonical_color),
    applicator: clean(row.applicator),
    itemName: clean(row.product_group_display_name),
  });

  return {
    imageId: row.approved_image_id,
    imageUrl: row.approved_image_url,
    sku: clean(row.shopify_sku),
    websiteSku: clean(row.website_sku),
    graceSku: clean(row.grace_sku),
    expectedCapColor: expectedCapColor || undefined,
    altText: clean(row.product_group_display_name) || clean(row.website_sku) || clean(row.grace_sku),
  };
}

export function buildShopifyPublishPreflightRows(params: {
  jobs: ShopifyPublishPreflightSkuJobRow[];
  imageTagsById: Map<string, readonly string[] | null | undefined>;
}): ShopifyPublishPreflightBuildResult {
  const duplicateSkuKeys = findDuplicateSkuKeys(params.jobs);
  const duplicateKeyByRowId = new Map<string, string[]>();
  for (const hit of duplicateSkuKeys) {
    for (const rowId of hit.rowIds) {
      const keys = duplicateKeyByRowId.get(rowId) ?? [];
      keys.push(hit.key);
      duplicateKeyByRowId.set(rowId, keys);
    }
  }

  const rows: ShopifyPublishPreflightRow[] = params.jobs.map((job) => {
    const approvalStatus =
      getBestBottlesApprovalStatus(params.imageTagsById.get(clean(job.approved_image_id))) ??
      getBestBottlesApprovalStatus(params.imageTagsById.get(clean(job.generated_image_id)));
    const blockReasons: ShopifyPublishPreflightBlockReason[] = [];
    const status = clean(job.status).toLowerCase();

    if (hasShopifyDestination(job)) blockReasons.push("already-pushed-or-synced");
    else if (status !== "approved") blockReasons.push("status-not-approved");
    if (approvalStatus !== "approved-keep") blockReasons.push("approval-not-approved-keep");
    if (!isPublicUrl(job.approved_image_url)) blockReasons.push("missing-approved-image-url");
    if (!clean(job.shopify_sku)) blockReasons.push("missing-shopify-sku");
    for (const key of duplicateKeyByRowId.get(job.id) ?? []) {
      blockReasons.push(`duplicate-sku-key:${key}`);
    }

    const pushItem = blockReasons.length === 0 ? buildPushItem(job) : null;
    return {
      id: job.id,
      graceSku: clean(job.grace_sku),
      websiteSku: clean(job.website_sku),
      shopifySku: clean(job.shopify_sku),
      productGroupSlug: clean(job.product_group_slug),
      productGroupDisplayName: clean(job.product_group_display_name),
      family: clean(job.family),
      status: pushItem ? "eligible" : "blocked",
      approvalStatus,
      approvedImageId: job.approved_image_id,
      approvedImageUrl: job.approved_image_url,
      blockReasons,
      pushItem,
    };
  });
  const pushItems = rows
    .map((row) => row.pushItem)
    .filter((item): item is ShopifyPublishPreflightPushItem => item !== null);

  return {
    summary: {
      totalRows: rows.length,
      eligible: pushItems.length,
      blocked: rows.length - pushItems.length,
      duplicateSkuKeys: duplicateSkuKeys.length,
    },
    rows,
    pushItems,
    duplicateSkuKeys,
  };
}

export function deriveLegacyMediaCleanupDisposition(params: {
  eligibleForPush: boolean;
  dryRunStatus: string | null | undefined;
  existingVariantMediaCount: number;
}): LegacyMediaCleanupDisposition {
  if (params.existingVariantMediaCount <= 0) return "no-existing-variant-media";
  if (params.eligibleForPush && params.dryRunStatus === "dry-run") {
    return "detach-after-successful-replacement";
  }
  return "blocked-until-approved-replacement";
}
