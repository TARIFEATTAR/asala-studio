/**
 * Resolve the Product Reference Image for a Dark Room product selection.
 *
 * Product Hub rows for Best Bottles do NOT carry a `hero_image_url` (the
 * enrich script never sets one), so the actual reference image lives in:
 *   1. Product Hub / DAM hero image (generic products)             — `hero_image_url`
 *   2. The pipeline's clean reference, keyed by Grace SKU          — `best_reference_candidate_path`
 *      (this is the exact image `generate-madison-image` consumes)
 *   3. The Best Bottles Convex catalog product photo, by Grace SKU — `imageUrl` / `imageUrlCapOff`
 *
 * Network lookups are best-effort and fail soft to the next source.
 */

import type { Product } from "@/hooks/useProducts";
import {
  isRetiredTransparentBestBottlesReferenceCandidate,
  isRetiredTransparentBestBottlesReferenceUrl,
} from "@/lib/bestBottlesReferenceFilters";
import {
  extractDarkroomBestBottlesContext,
  type DarkroomReferenceSource,
} from "@/lib/darkroomProductContext";

export { isRetiredTransparentBestBottlesReferenceUrl } from "@/lib/bestBottlesReferenceFilters";

export interface DarkroomReferenceImage {
  url: string;
  name: string;
  source: DarkroomReferenceSource;
}

function isHttpUrl(value: string | null | undefined): value is string {
  return typeof value === "string" && /^https?:\/\//i.test(value.trim());
}

function isUsableBestBottlesProductTruthReference(values: readonly unknown[]): boolean {
  return !isRetiredTransparentBestBottlesReferenceCandidate(values);
}

function referenceCandidateValues(
  url: string | null | undefined,
  metadata?: unknown,
): readonly unknown[] {
  return metadata == null ? [url] : [url, metadata];
}

export async function resolveDarkroomProductReferenceImage(
  product: Product,
  orgId: string | null | undefined,
): Promise<DarkroomReferenceImage | null> {
  const bestBottles = extractDarkroomBestBottlesContext(product);
  const graceSku = bestBottles?.graceSku ?? null;

  // 1. Product Hub / DAM hero image.
  if (
    isHttpUrl(product.hero_image_url) &&
    isUsableBestBottlesProductTruthReference(
      referenceCandidateValues(product.hero_image_url, product.metadata),
    )
  ) {
    return { url: product.hero_image_url, name: product.name, source: "product-hub" };
  }

  // Best Bottles image fields occasionally set directly on the row.
  if (
    isHttpUrl(bestBottles?.imageUrl) &&
    isUsableBestBottlesProductTruthReference(
      referenceCandidateValues(bestBottles.imageUrl, {
        imageUrl: bestBottles.imageUrl,
        imageUrlCapOff: bestBottles.imageUrlCapOff,
      }),
    )
  ) {
    return { url: bestBottles!.imageUrl!, name: product.name, source: "best-bottles-catalog" };
  }

  if (!graceSku) return null;
  const target = graceSku.trim().toUpperCase();

  // 2. Pipeline clean reference — the same image generation actually consumes.
  if (orgId) {
    try {
      const { listPipelineSkuJobs } = await import("@/lib/bestBottlesPipeline");
      const filters = bestBottles?.productGroupSlug
        ? { productGroupSlug: bestBottles.productGroupSlug }
        : bestBottles?.family
          ? { family: bestBottles.family }
          : {};
      const jobs = await listPipelineSkuJobs(orgId, filters);
      const withReference = jobs.filter(
        (job) =>
          isHttpUrl(job.best_reference_candidate_path) &&
          isUsableBestBottlesProductTruthReference(
            referenceCandidateValues(job.best_reference_candidate_path, {
              best_reference_candidate_path: job.best_reference_candidate_path,
              expected_canonical_filename: job.expected_canonical_filename,
            }),
          ),
      );
      // Prefer the exact Grace SKU; otherwise fall back to any reference in the
      // same product group (the Product Hub row is group-level), matching the
      // pipeline studio's group reference behavior.
      const match =
        withReference.find((job) => (job.grace_sku ?? "").trim().toUpperCase() === target) ??
        (filters.productGroupSlug ? withReference[0] : undefined);
      if (match && isHttpUrl(match.best_reference_candidate_path)) {
        return {
          url: match.best_reference_candidate_path,
          name: match.expected_canonical_filename ?? graceSku,
          source: "pipeline-reference",
        };
      }
    } catch (error) {
      console.warn("[darkroom] pipeline reference lookup failed", error);
    }
  }

  // 3. Best Bottles Convex catalog product photo.
  try {
    const { getProductBySku } = await import("@/integrations/convex/bestBottles");
    const convexProduct = await getProductBySku(graceSku);
    const url = convexProduct?.imageUrl ?? convexProduct?.imageUrlCapOff ?? null;
    if (
      isHttpUrl(url) &&
      isUsableBestBottlesProductTruthReference(
        referenceCandidateValues(url, {
          imageUrl: convexProduct?.imageUrl,
          imageUrlCapOff: convexProduct?.imageUrlCapOff,
        }),
      )
    ) {
      return { url, name: convexProduct?.itemName ?? product.name, source: "best-bottles-catalog" };
    }
  } catch (error) {
    console.warn("[darkroom] Best Bottles catalog image lookup failed", error);
  }

  return null;
}
