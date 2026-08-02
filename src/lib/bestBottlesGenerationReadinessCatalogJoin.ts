export interface BestBottlesCatalogJoinPipelineProduct {
  graceSku: string | null;
  websiteSku: string | null;
  productId: string | null;
  family: string | null;
  capacityMl: string | number | null;
  canonicalColor?: string | null;
  color?: string | null;
  applicator: string | null;
}

export interface BestBottlesCatalogJoinCatalogProduct {
  graceSku: string | null;
  websiteSku: string | null;
  productId: string | null;
  family: string | null;
  capacityMl: string | number | null;
  color: string | null;
  applicator: string | null;
  heightWithoutCap: string | null;
  diameter: string | null;
  productGroupId?: string | null;
}

export type BestBottlesCatalogJoinMatchKind =
  | "graceSku"
  | "productId"
  | "websiteSku"
  | "none";

export type BestBottlesCatalogJoinIssue =
  | "ambiguous_product_id"
  | "ambiguous_website_sku"
  | "identity_conflict_website_sku"
  | "no_catalog_match";

export interface BestBottlesCatalogJoinResult<TCatalogProduct> {
  catalogProduct?: TCatalogProduct;
  matchKind: BestBottlesCatalogJoinMatchKind;
  issue: BestBottlesCatalogJoinIssue | null;
}

function key(value: string | number | null | undefined): string {
  return String(value ?? "")
    .trim()
    .toUpperCase();
}

function normalizedText(value: string | null | undefined): string {
  return key(value).replace(/[^A-Z0-9]+/g, "");
}

function normalizedNumber(value: string | number | null | undefined): string {
  const match = String(value ?? "").match(/\d+(?:\.\d+)?/);
  return match?.[0] ?? "";
}

function hasMeasurements(product: BestBottlesCatalogJoinCatalogProduct): boolean {
  return key(product.heightWithoutCap).length > 0 && key(product.diameter).length > 0;
}

function sameMeasuredShape(
  a: BestBottlesCatalogJoinCatalogProduct,
  b: BestBottlesCatalogJoinCatalogProduct,
): boolean {
  return (
    key(a.heightWithoutCap) === key(b.heightWithoutCap) &&
    key(a.diameter) === key(b.diameter)
  );
}

function pickConsistentCandidate<TCatalogProduct extends BestBottlesCatalogJoinCatalogProduct>(
  candidates: TCatalogProduct[],
): TCatalogProduct | null {
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  const measured = candidates.filter(hasMeasurements);
  if (measured.length === 0) return null;
  const first = measured[0];
  return measured.every((candidate) => sameMeasuredShape(candidate, first)) ? first : null;
}

function websiteCandidateMatchesIdentity(
  product: BestBottlesCatalogJoinPipelineProduct,
  candidate: BestBottlesCatalogJoinCatalogProduct,
): boolean {
  const productFamily = normalizedText(product.family);
  const candidateFamily = normalizedText(candidate.family);
  const productCapacity = normalizedNumber(product.capacityMl);
  const candidateCapacity = normalizedNumber(candidate.capacityMl);
  const productColor = normalizedText(product.canonicalColor ?? product.color ?? null);
  const candidateColor = normalizedText(candidate.color);
  const productApplicator = normalizedText(product.applicator);
  const candidateApplicator = normalizedText(candidate.applicator);

  if (productFamily && candidateFamily && productFamily !== candidateFamily) return false;
  if (productCapacity && candidateCapacity && productCapacity !== candidateCapacity) return false;
  if (productColor && candidateColor && productColor !== candidateColor) return false;
  if (productApplicator && candidateApplicator && productApplicator !== candidateApplicator) {
    return false;
  }
  return true;
}

function groupByKey<TCatalogProduct extends BestBottlesCatalogJoinCatalogProduct>(
  catalogProducts: TCatalogProduct[],
  getValue: (product: TCatalogProduct) => string | number | null | undefined,
): Map<string, TCatalogProduct[]> {
  const map = new Map<string, TCatalogProduct[]>();
  for (const product of catalogProducts) {
    const productKey = key(getValue(product));
    if (!productKey) continue;
    const rows = map.get(productKey) ?? [];
    rows.push(product);
    map.set(productKey, rows);
  }
  return map;
}

export function resolveBestBottlesReadinessCatalogJoin<
  TCatalogProduct extends BestBottlesCatalogJoinCatalogProduct,
>(
  product: BestBottlesCatalogJoinPipelineProduct,
  catalogProducts: TCatalogProduct[],
): BestBottlesCatalogJoinResult<TCatalogProduct> {
  const byGraceSku = groupByKey(catalogProducts, (catalogProduct) => catalogProduct.graceSku);
  const exactGraceSku = pickConsistentCandidate(byGraceSku.get(key(product.graceSku)) ?? []);
  if (exactGraceSku) {
    return { catalogProduct: exactGraceSku, matchKind: "graceSku", issue: null };
  }

  const byProductId = groupByKey(catalogProducts, (catalogProduct) => catalogProduct.productId);
  const productIdCandidates = byProductId.get(key(product.productId)) ?? [];
  const productIdMatch = pickConsistentCandidate(productIdCandidates);
  if (productIdMatch) {
    return { catalogProduct: productIdMatch, matchKind: "productId", issue: null };
  }
  if (productIdCandidates.length > 1) {
    return { matchKind: "none", issue: "ambiguous_product_id" };
  }

  const byWebsiteSku = groupByKey(catalogProducts, (catalogProduct) => catalogProduct.websiteSku);
  const websiteSkuCandidates = byWebsiteSku.get(key(product.websiteSku)) ?? [];
  const identityMatches = websiteSkuCandidates.filter((candidate) =>
    websiteCandidateMatchesIdentity(product, candidate),
  );
  const websiteSkuMatch = pickConsistentCandidate(identityMatches);
  if (websiteSkuMatch) {
    return { catalogProduct: websiteSkuMatch, matchKind: "websiteSku", issue: null };
  }
  if (websiteSkuCandidates.length > 0 && identityMatches.length === 0) {
    return { matchKind: "none", issue: "identity_conflict_website_sku" };
  }
  if (websiteSkuCandidates.length > 1) {
    return { matchKind: "none", issue: "ambiguous_website_sku" };
  }

  return { matchKind: "none", issue: "no_catalog_match" };
}
