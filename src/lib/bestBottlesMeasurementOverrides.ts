export interface BestBottlesMeasurementOverride {
  graceSku: string;
  heightWithoutCap?: string | null;
  diameter?: string | null;
  source?: string | null;
  sourceUrl?: string | null;
  note?: string | null;
}

export interface BestBottlesMeasurementOverridesPayload {
  notes?: string;
  overrides?: BestBottlesMeasurementOverride[];
}

function normalizeSku(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .toUpperCase();
}

function present(value: string | null | undefined): string | null {
  const text = value?.trim();
  return text ? text : null;
}

export function applyBestBottlesMeasurementOverrides<
  T extends { graceSku: string; heightWithoutCap?: string | null; diameter?: string | null },
>(
  products: T[],
  overrides: BestBottlesMeasurementOverride[],
): T[] {
  const overrideBySku = new Map(
    overrides
      .filter((override) => normalizeSku(override.graceSku))
      .map((override) => [normalizeSku(override.graceSku), override]),
  );

  return products.map((product) => {
    const override = overrideBySku.get(normalizeSku(product.graceSku));
    if (!override) return { ...product };
    return {
      ...product,
      heightWithoutCap: present(override.heightWithoutCap) ?? product.heightWithoutCap ?? null,
      diameter: present(override.diameter) ?? product.diameter ?? null,
    };
  });
}
