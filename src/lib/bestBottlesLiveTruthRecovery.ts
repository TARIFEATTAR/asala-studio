import type { Product } from "@/integrations/convex/bestBottles";
import type { BestBottlesWebsiteTruthRow } from "@/lib/bestBottlesWebsiteTruth";

export type BestBottlesLiveTruthTrigger =
  | "website_truth"
  | "sku_identity"
  | "reference"
  | "measurement"
  | "prompt_preflight"
  | "generation_failure";

export interface BestBottlesLiveTruthRecovery {
  trigger: BestBottlesLiveTruthTrigger;
  failure: string;
  graceSku: string;
  websiteSku: string;
  productGroupSlug: string | null;
  pdpUrl: string | null;
  searchUrl: string;
  primaryImageUrl: string;
  cappedImageUrl: string;
  liveEvidenceStatus: "verified" | "verification_required";
  liveFamily: string | null;
  liveConfiguration: string | null;
  generationBlocked: true;
}

const CATALOG_FAILURE_PATTERNS = [
  /website truth/i,
  /truth conflict/i,
  /sku identity/i,
  /identity mismatch/i,
  /reference/i,
  /product truth/i,
  /measurement/i,
  /dimension/i,
  /applicator/i,
  /cap state/i,
  /product group/i,
  /prompt preflight/i,
];

export function isCatalogRelatedMadisonFailure(message: string): boolean {
  return CATALOG_FAILURE_PATTERNS.some((pattern) => pattern.test(message));
}

export function buildBestBottlesLiveTruthRecovery(
  product: Product,
  trigger: BestBottlesLiveTruthTrigger,
  failure: string,
  truthRow: BestBottlesWebsiteTruthRow | null,
): BestBottlesLiveTruthRecovery {
  const websiteSku = (truthRow?.websiteSku || product.websiteSku || "").trim();
  const encodedSku = encodeURIComponent(websiteSku || product.graceSku);
  const verified = Boolean(
    truthRow?.liveEvidenceStatus?.startsWith("verified_current_live_pdp_") &&
      truthRow.liveWebsiteSkuPresent === "true" &&
      (truthRow.liveFinalUrl || truthRow.liveSourceUrl),
  );

  return {
    trigger,
    failure,
    graceSku: product.graceSku,
    websiteSku,
    productGroupSlug: truthRow?.productGroupSlug || product.productGroupSlug || null,
    pdpUrl: truthRow?.liveFinalUrl || truthRow?.liveSourceUrl || null,
    searchUrl: `https://www.bestbottles.com/all-bottles/all-items/search-products.php?search_name=${encodedSku}`,
    primaryImageUrl: `https://www.bestbottles.com/images/store/enlarged_pics/${encodedSku}.gif`,
    cappedImageUrl: `https://www.bestbottles.com/images/store/capped/${encodedSku}.gif`,
    liveEvidenceStatus: verified ? "verified" : "verification_required",
    liveFamily: truthRow?.liveFamily || null,
    liveConfiguration: truthRow?.liveConfiguration || null,
    generationBlocked: true,
  };
}
