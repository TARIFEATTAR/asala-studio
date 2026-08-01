export interface AliasTwinIdentityRow {
  graceSku: string;
  websiteSku: string;
  family: string;
  [key: string]: unknown;
}

export interface AliasTwinReconciliationRow {
  websiteSku: string;
  missingGraceSku: string;
  siblingGraceSku: string;
  family: string;
}

function normalizeIdentity(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function reconcileAliasTwinResiduals<T extends AliasTwinIdentityRow>(input: {
  residuals: T[];
  catalog: AliasTwinIdentityRow[];
}): {
  twins: AliasTwinReconciliationRow[];
  remaining: T[];
  ambiguous: Array<{ missingGraceSku: string; candidateGraceSkus: string[] }>;
} {
  const catalogByWebsiteSku = new Map<string, AliasTwinIdentityRow[]>();
  for (const row of input.catalog) {
    const key = normalizeIdentity(row.websiteSku);
    if (!key) continue;
    catalogByWebsiteSku.set(key, [...(catalogByWebsiteSku.get(key) ?? []), row]);
  }

  const twins: AliasTwinReconciliationRow[] = [];
  const remaining: T[] = [];
  const ambiguous: Array<{ missingGraceSku: string; candidateGraceSkus: string[] }> = [];

  for (const residual of input.residuals) {
    const residualGraceSku = normalizeIdentity(residual.graceSku);
    const candidates = (catalogByWebsiteSku.get(normalizeIdentity(residual.websiteSku)) ?? [])
      .filter((row) => normalizeIdentity(row.graceSku) !== residualGraceSku);

    if (candidates.length === 1) {
      twins.push({
        websiteSku: residual.websiteSku,
        missingGraceSku: residual.graceSku,
        siblingGraceSku: candidates[0].graceSku,
        family: residual.family,
      });
      continue;
    }

    remaining.push(residual);
    if (candidates.length > 1) {
      ambiguous.push({
        missingGraceSku: residual.graceSku,
        candidateGraceSkus: candidates.map((row) => row.graceSku).sort(),
      });
    }
  }

  return { twins, remaining, ambiguous };
}
