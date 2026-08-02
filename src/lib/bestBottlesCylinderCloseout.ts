export const CYLINDER_CLOSEOUT_EXPECTED_SKUS = 384;
export const CYLINDER_CLOSEOUT_EXPECTED_PUBLICATION_TARGETS = 377;
export const CYLINDER_CLOSEOUT_VERSION = "cylinder-v6.1-closeout-v2" as const;

const TALL_CYLINDER_WEBSITE_SKU = "GBTallCyl9WhtSht";
const TALL_CYLINDER_CANONICAL_GRACE_SKU = "GB-CYL-WHT-9ML-WHT-S";

export const CYLINDER_APPROVED_GRACE_SKU_ALIASES: Readonly<Record<string, string>> =
  Object.freeze({
    "GB-CYL-CLR-100ML-RDC-MSLV-01": "GB-CYL-CLR-100ML-RDC-MSLV",
    "GB-CYL-CLR-100ML-RDC-SBLK-01": "GB-CYL-CLR-100ML-RDC-SBLK",
    "GB-CYL-CLR-50ML-RDC-MSLV-01": "GB-CYL-CLR-50ML-RDC-MSLV",
    "GB-CYL-CLR-50ML-RDC-SBLK-01": "GB-CYL-CLR-50ML-RDC-SBLK",
    GBCyl5WhtSht: "GB-CYL-WHT-5ML-WHT-S",
    GBCylSwrl9MtlRollWht: "GB-CYL-WHT-9ML-MRL-WHT",
    GBCylSwrl9RollWht: "GB-CYL-WHT-9ML-ROL-WHT",
    [TALL_CYLINDER_WEBSITE_SKU]: TALL_CYLINDER_CANONICAL_GRACE_SKU,
  });

export interface CylinderCloseoutSourceRow {
  graceSku?: string | null;
  websiteSku?: string | null;
  family?: string | null;
  productGroupSlug?: string | null;
  status?: string | null;
  issues?: string[] | null;
}

export interface CylinderCloseoutRow {
  graceSku: string;
  websiteSku: string;
  aliases: string[];
  productGroupSlug: string | null;
  status: string;
  issues: string[];
}

export interface CylinderPublicationTarget extends CylinderCloseoutRow {
  sourceGraceSkus: string[];
}

export interface CylinderCloseoutLedger {
  version: typeof CYLINDER_CLOSEOUT_VERSION;
  generatedAt: string;
  rows: CylinderCloseoutRow[];
  publicationTargets: CylinderPublicationTarget[];
  aliases: Record<string, string>;
  sha256: string;
}

export type CylinderCloseoutBlockerCode =
  | "unexpected-sku-count"
  | "unexpected-publication-target-count"
  | "missing-grace-sku"
  | "missing-website-sku"
  | "duplicate-grace-sku"
  | "duplicate-website-sku"
  | "missing-catalog-join"
  | "measurement-override-pending";

export interface CylinderCloseoutBlocker {
  code: CylinderCloseoutBlockerCode;
  message: string;
  graceSkus: string[];
  websiteSkus: string[];
}

export interface BuildCylinderCloseoutLedgerInput {
  readinessRows: CylinderCloseoutSourceRow[];
  generatedAt?: string;
}

function normalize(value: string | null | undefined): string {
  return String(value ?? "").trim();
}

function isCylinderRow(row: CylinderCloseoutSourceRow): boolean {
  const family = normalize(row.family).toLowerCase();
  return family === "cylinder" || family === "tall cylinder";
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJson(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(object[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

async function sha256(value: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function normalizedIssues(row: CylinderCloseoutSourceRow): string[] {
  return Array.from(
    new Set(
      (Array.isArray(row.issues) ? row.issues : [])
        .map((issue) => normalize(issue))
        .filter(Boolean),
    ),
  ).sort();
}

export async function buildCylinderCloseoutLedger(
  input: BuildCylinderCloseoutLedgerInput,
): Promise<CylinderCloseoutLedger> {
  const sourceRows = input.readinessRows.filter(isCylinderRow);
  const sourceGraceSkus = new Set(
    sourceRows.map((row) => normalize(row.graceSku)).filter(Boolean),
  );
  const aliases: Record<string, string> = Object.fromEntries(
    Object.entries(CYLINDER_APPROVED_GRACE_SKU_ALIASES).filter(([alias]) =>
      sourceGraceSkus.has(alias),
    ),
  );
  const tallAliases = sourceRows.filter(
    (row) => normalize(row.family).toLowerCase() === "tall cylinder",
  );
  const canonicalRows = sourceRows.filter(
    (row) => normalize(row.family).toLowerCase() === "cylinder",
  );

  for (const row of tallAliases) {
    const websiteSku = normalize(row.websiteSku);
    const graceSku = normalize(row.graceSku);
    if (
      websiteSku === TALL_CYLINDER_WEBSITE_SKU &&
      canonicalRows.some(
        (candidate) =>
          normalize(candidate.graceSku) === TALL_CYLINDER_CANONICAL_GRACE_SKU &&
          normalize(candidate.websiteSku) === websiteSku,
      )
    ) {
      aliases[graceSku || websiteSku] = TALL_CYLINDER_CANONICAL_GRACE_SKU;
    }
  }

  const aliasesByCanonical = new Map<string, string[]>();
  for (const [alias, canonical] of Object.entries(aliases)) {
    const values = aliasesByCanonical.get(canonical) ?? [];
    values.push(alias);
    aliasesByCanonical.set(canonical, values);
  }

  const rows = canonicalRows
    .map<CylinderCloseoutRow>((row) => {
      const graceSku = normalize(row.graceSku);
      return {
        graceSku,
        websiteSku: normalize(row.websiteSku),
        aliases: (aliasesByCanonical.get(graceSku) ?? []).sort(),
        productGroupSlug: normalize(row.productGroupSlug) || null,
        status: normalize(row.status) || "unknown",
        issues: normalizedIssues(row),
      };
    })
    .sort((left, right) =>
      left.graceSku.localeCompare(right.graceSku) ||
      left.websiteSku.localeCompare(right.websiteSku),
    );

  const rowsByWebsiteSku = new Map<string, CylinderCloseoutRow[]>();
  for (const row of rows) {
    if (!row.websiteSku) continue;
    rowsByWebsiteSku.set(row.websiteSku, [
      ...(rowsByWebsiteSku.get(row.websiteSku) ?? []),
      row,
    ]);
  }

  const publicationTargets = [...rowsByWebsiteSku.entries()]
    .map<CylinderPublicationTarget>(([websiteSku, sourceTargetRows]) => {
      const sourceGraceSkus = sourceTargetRows
        .map((row) => row.graceSku)
        .filter(Boolean)
        .sort();
      const resolvedGraceSkus = sourceGraceSkus.map(
        (graceSku) => aliases[graceSku] ?? graceSku,
      );
      const canonicalGraceSku = [...new Set(resolvedGraceSkus)].sort()[0] ?? "";
      const canonicalRow =
        sourceTargetRows.find((row) => row.graceSku === canonicalGraceSku) ??
        [...sourceTargetRows].sort((left, right) =>
          left.graceSku.localeCompare(right.graceSku),
        )[0];
      const targetAliases = sourceGraceSkus.filter(
        (graceSku) => graceSku !== canonicalGraceSku,
      );

      return {
        ...canonicalRow,
        graceSku: canonicalGraceSku,
        websiteSku,
        aliases: Array.from(
          new Set([...canonicalRow.aliases, ...targetAliases]),
        ).sort(),
        sourceGraceSkus,
      };
    })
    .sort(
      (left, right) =>
        left.graceSku.localeCompare(right.graceSku) ||
        left.websiteSku.localeCompare(right.websiteSku),
    );

  const hashPayload = {
    version: CYLINDER_CLOSEOUT_VERSION,
    rows,
    publicationTargets,
    aliases: Object.fromEntries(
      Object.entries(aliases).sort(([left], [right]) => left.localeCompare(right)),
    ),
  };

  return {
    ...hashPayload,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    sha256: await sha256(stableJson(hashPayload)),
  };
}

function duplicatesBy(
  rows: CylinderCloseoutRow[],
  select: (row: CylinderCloseoutRow) => string,
): Map<string, CylinderCloseoutRow[]> {
  const grouped = new Map<string, CylinderCloseoutRow[]>();
  for (const row of rows) {
    const key = select(row);
    if (!key) continue;
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }
  return new Map([...grouped].filter(([, values]) => values.length > 1));
}

export function getCylinderCloseoutBlockers(
  ledger: Pick<CylinderCloseoutLedger, "rows" | "publicationTargets" | "aliases">,
): CylinderCloseoutBlocker[] {
  const blockers: CylinderCloseoutBlocker[] = [];
  if (ledger.rows.length !== CYLINDER_CLOSEOUT_EXPECTED_SKUS) {
    blockers.push({
      code: "unexpected-sku-count",
      message: `Cylinder closeout requires exactly ${CYLINDER_CLOSEOUT_EXPECTED_SKUS} canonical SKUs; found ${ledger.rows.length}.`,
      graceSkus: ledger.rows.map((row) => row.graceSku).filter(Boolean),
      websiteSkus: ledger.rows.map((row) => row.websiteSku).filter(Boolean),
    });
  }
  if (
    ledger.publicationTargets.length !==
    CYLINDER_CLOSEOUT_EXPECTED_PUBLICATION_TARGETS
  ) {
    blockers.push({
      code: "unexpected-publication-target-count",
      message: `Cylinder closeout requires exactly ${CYLINDER_CLOSEOUT_EXPECTED_PUBLICATION_TARGETS} unique publication targets from ${CYLINDER_CLOSEOUT_EXPECTED_SKUS} source rows; found ${ledger.publicationTargets.length}.`,
      graceSkus: ledger.publicationTargets
        .map((row) => row.graceSku)
        .filter(Boolean),
      websiteSkus: ledger.publicationTargets
        .map((row) => row.websiteSku)
        .filter(Boolean),
    });
  }

  for (const row of ledger.rows) {
    if (!row.graceSku) {
      blockers.push({
        code: "missing-grace-sku",
        message: `Cylinder row ${row.websiteSku || "<unknown>"} is missing a Grace SKU.`,
        graceSkus: [],
        websiteSkus: row.websiteSku ? [row.websiteSku] : [],
      });
    }
    if (!row.websiteSku) {
      blockers.push({
        code: "missing-website-sku",
        message: `Cylinder row ${row.graceSku || "<unknown>"} is missing a website SKU.`,
        graceSkus: row.graceSku ? [row.graceSku] : [],
        websiteSkus: [],
      });
    }
    if (row.issues.includes("missing_catalog_join")) {
      blockers.push({
        code: "missing-catalog-join",
        message: `${row.graceSku} is missing its catalog join.`,
        graceSkus: [row.graceSku],
        websiteSkus: row.websiteSku ? [row.websiteSku] : [],
      });
    }
    if (row.issues.includes("measurement_override_pending_convex_sync")) {
      blockers.push({
        code: "measurement-override-pending",
        message: `${row.graceSku} has a measurement override pending Convex/catalog synchronization.`,
        graceSkus: [row.graceSku],
        websiteSkus: row.websiteSku ? [row.websiteSku] : [],
      });
    }
  }

  for (const [graceSku, rows] of duplicatesBy(ledger.rows, (row) => row.graceSku)) {
    blockers.push({
      code: "duplicate-grace-sku",
      message: `Grace SKU ${graceSku} appears ${rows.length} times in the canonical Cylinder ledger.`,
      graceSkus: [graceSku],
      websiteSkus: rows.map((row) => row.websiteSku).filter(Boolean),
    });
  }
  for (const [websiteSku, rows] of duplicatesBy(ledger.rows, (row) => row.websiteSku)) {
    const canonicalGraceSkus = new Set(
      rows.map((row) => ledger.aliases[row.graceSku] ?? row.graceSku),
    );
    if (canonicalGraceSkus.size === 1) continue;
    blockers.push({
      code: "duplicate-website-sku",
      message: `Website SKU ${websiteSku} maps to ${rows.length} Cylinder rows.`,
      graceSkus: rows.map((row) => row.graceSku).filter(Boolean),
      websiteSkus: [websiteSku],
    });
  }

  return blockers.sort(
    (left, right) =>
      left.code.localeCompare(right.code) || left.message.localeCompare(right.message),
  );
}
