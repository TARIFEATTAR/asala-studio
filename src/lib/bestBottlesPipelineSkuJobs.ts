export interface PipelineSkuJobIdentityRow {
  grace_sku?: string | null;
  website_sku?: string | null;
  shopify_sku?: string | null;
  status: string;
}

export interface PipelineProductIdentityInput {
  graceSku?: string | null;
  websiteSku?: string | null;
  shopifySku?: string | null;
}

const TERMINAL_SKU_JOB_STATUSES = new Set([
  "approved",
  "shopify-pushed",
  "synced",
]);

export function normalizePipelineSkuLookupKey(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

export function shouldRecordGeneratedImageForSkuJob<T extends Pick<PipelineSkuJobIdentityRow, "status">>(
  job: T,
): boolean {
  return !TERMINAL_SKU_JOB_STATUSES.has(job.status);
}

export function findPipelineSkuJobForProductIdentity<T extends PipelineSkuJobIdentityRow>(
  jobs: T[],
  product: PipelineProductIdentityInput,
): T | null {
  const productKeys = new Set(
    [product.graceSku, product.websiteSku, product.shopifySku]
      .map(normalizePipelineSkuLookupKey)
      .filter(Boolean),
  );
  if (productKeys.size === 0) return null;
  return (
    jobs.find((job) =>
      [job.grace_sku, job.website_sku, job.shopify_sku].some((sku) =>
        productKeys.has(normalizePipelineSkuLookupKey(sku)),
      ),
    ) ?? null
  );
}
