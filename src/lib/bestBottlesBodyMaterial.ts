export interface BestBottlesBodyMaterialProduct {
  family?: string | null;
  bottleCollection?: string | null;
  category?: string | null;
  itemName?: string | null;
  itemDescription?: string | null;
  graceSku?: string | null;
  color?: string | null;
}

function materialText(product: BestBottlesBodyMaterialProduct): string {
  return [
    product.family,
    product.bottleCollection,
    product.category,
    product.itemName,
    product.itemDescription,
    product.graceSku,
    product.color,
  ]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();
}

export function inferBestBottlesBodyMaterial(product: BestBottlesBodyMaterialProduct): string {
  const haystack = materialText(product);

  if (haystack.includes("aluminum") || haystack.includes("aluminium") || haystack.includes("ab-alu")) {
    return "opaque brushed/satin aluminum";
  }
  if (
    haystack.includes("metal atomizer") ||
    /(?:^|\s)gb-[a-z0-9-]+-(?:5ml|10ml)-atm-/i.test(haystack)
  ) {
    return "opaque colored/anodized metal atomizer casing";
  }
  if (/\bglass\b/.test(haystack) || /\bgb[-_]/i.test(product.graceSku ?? "")) {
    return "glass";
  }
  if (haystack.includes("plastic")) {
    return "plastic";
  }
  return "glass";
}
