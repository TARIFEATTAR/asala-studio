export function selectBestBottlesCatalogMeasurement(
  masterValue: string | null | undefined,
  liveValue: string | null | undefined,
): string | null {
  const clean = (value: string | null | undefined): string | null => {
    const normalized = value?.trim() ?? "";
    if (!/\d/.test(normalized)) return null;
    if (/item\s*(?:height|diameter)|height\s*(?:with|without)|diameter\s*:/i.test(normalized)) {
      return null;
    }
    return normalized;
  };

  return clean(liveValue) ?? clean(masterValue);
}

export function mergeBestBottlesCatalogSourceRows<T extends Record<string, string>>(
  masterRows: T[],
  liveRows: T[],
): T[] {
  const sku = (row: T): string =>
    String(row.graceSku ?? row.grace_sku ?? row.sku ?? "").trim().toUpperCase();
  const seen = new Set(masterRows.map(sku).filter(Boolean));
  return [
    ...masterRows,
    ...liveRows.filter((row) => {
      const key = sku(row);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    }),
  ];
}
