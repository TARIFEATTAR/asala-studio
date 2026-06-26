export type BestBottlesResolvedBodyMaterialKind =
  | "glass"
  | "aluminum"
  | "atomizer-metal"
  | "plastic";

export function formatBestBottlesBodyMaterialSkuLock(
  resolvedKind: BestBottlesResolvedBodyMaterialKind,
  fallbackMaterial?: unknown,
): string | null {
  if (resolvedKind === "glass") return "Body material: glass";
  if (resolvedKind === "aluminum") return "Body material: opaque brushed/satin aluminum";
  if (resolvedKind === "atomizer-metal") {
    return "Body material: opaque colored/anodized metal atomizer casing";
  }
  if (resolvedKind === "plastic") return "Body material: plastic";

  return typeof fallbackMaterial === "string" && fallbackMaterial.trim()
    ? `Body material: ${fallbackMaterial.trim()}`
    : null;
}
