/**
 * Per-SKU cap-color corrections for Best Bottles catalog rows whose structured
 * color fields contradict the product itself. Modeled on
 * bestBottlesMeasurementOverrides.ts (which corrects measurements only).
 *
 * Madison is READ-ONLY on the Convex catalog (Cowork's lane), so when a row is
 * wrong the generation pipeline needs a code-side source of truth until the
 * upstream data is corrected. Entries here should be removed once Convex is
 * fixed — each entry documents the conflict it papers over.
 *
 * Audit 2026-07-04 (convex snapshot 2026-06-27): of 13 pink-dot SKUs, exactly
 * two carry capColor="Clear" while the item name says "pink dot cap"; the other
 * eleven correctly say "Pink"/"Pink Dotted". The value below matches the line's
 * own convention ("Pink Dotted"). The row's `color` field stays untouched — it
 * describes the clear glass body, which is correct.
 */

export interface BestBottlesCapColorOverride {
  capColor: string;
  reason: string;
}

const CAP_COLOR_OVERRIDES: Record<string, BestBottlesCapColorOverride> = {
  "GB-CYL-CLR-9ML-T-05": {
    capColor: "Pink Dotted",
    reason:
      "Convex row says capColor=Clear but the product is a metal roller with a pink dot cap (websiteSku GBCyl9MtlRollPnkDot).",
  },
  "GB-CYL-CLR-9ML-T-15": {
    capColor: "Pink Dotted",
    reason:
      "Convex row says capColor=Clear but the product is a plastic roller with a pink dot cap (websiteSku GBCyl9RollPnkDot).",
  },
};

export function getBestBottlesCapColorOverride(
  graceSku: string | null | undefined,
): BestBottlesCapColorOverride | null {
  const key = graceSku?.trim().toUpperCase();
  if (!key) return null;
  return CAP_COLOR_OVERRIDES[key] ?? null;
}

/**
 * Returns the product with any registered cap-color correction applied. The
 * input object is not mutated. Safe to call with any product-like shape that
 * carries graceSku/capColor.
 */
export function applyBestBottlesCapColorOverride<
  T extends { graceSku?: string | null; capColor?: string | null },
>(product: T): T {
  const override = getBestBottlesCapColorOverride(product.graceSku);
  if (!override) return product;
  return { ...product, capColor: override.capColor };
}
