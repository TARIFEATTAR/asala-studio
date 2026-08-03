export type Cyl9CatalogProduct = {
  websiteSku: string;
  graceSku: string;
  family: string;
  capacityMl: number;
  neckThreadSize: string;
  color: string;
};

export type Cyl9CatalogCrosswalk = {
  schemaVersion: 1;
  familyKey: "CYL-9ML";
  sourceCatalogPath: string;
  sourceCatalogSha256: string;
  mappings: Array<{
    mappingKey: string;
    graceSku: string;
    websiteSku: string;
  }>;
  reviewIssues: Array<{
    issueKey: string;
    websiteSku: string;
    reason: "duplicate-website-sku-conflicting-body-color";
    resolution: "selected-row-matching-website-sku-body";
    selectedGraceSku: string;
    sourceRows: Array<{ graceSku: string; color: string }>;
  }>;
};

const BODY_BY_WEBSITE_TOKEN: Record<string, string> = {
  "": "CLR",
  Amb: "AMB",
  Blu: "BLU",
  Frst: "FRS",
  Swrl: "SWL",
};

const BODY_BY_CATALOG_COLOR: Record<string, string> = {
  Amber: "AMB",
  "Cobalt Blue": "BLU",
  Clear: "CLR",
  Frosted: "FRS",
  Swirl: "SWL",
};

const CAP_BY_SUFFIX: Record<string, string> = {
  ShnSl: "SSLV",
  MattSl: "MSLV",
  ShnGl: "SGLD",
  MattGl: "MGLD",
  ShBlk: "SBLK",
  MattCu: "MCPR",
  Wht: "WHT",
  SlDot: "SLDT",
  BlkDot: "BKDT",
  PnkDot: "PKDT",
};

const SPRAYER_BY_SUFFIX: Record<string, string> = {
  Gl: "GLD",
  MattSl: "MSLV",
  Blk: "BLK",
  ShSl: "SSLV",
  Rd: "RED",
  Tur: "TUR",
};

const PUMP_BY_SUFFIX: Record<string, string> = {
  Blk: "BLK",
  Gl: "GLD",
  MtSl: "MSLV",
  MattSl: "MSLV",
};

function requiredLookup(
  values: Record<string, string>,
  key: string,
  label: string,
  websiteSku: string,
): string {
  const value = values[key];
  if (!value) throw new Error(`Unknown CYL-9ML ${label} '${key}' in ${websiteSku}.`);
  return value;
}

export function cyl9MappingKeyFromWebsiteSku(websiteSku: string): string {
  const match = websiteSku.match(/^(?:GB|LB)Cyl(Amb|Blu|Frst|Swrl)?9(.+)$/);
  if (!match) throw new Error(`Unrecognized CYL-9ML website SKU: ${websiteSku}.`);
  const bodyVariantKey = requiredLookup(
    BODY_BY_WEBSITE_TOKEN,
    match[1] ?? "",
    "body token",
    websiteSku,
  );
  const suffix = match[2];

  if (suffix.startsWith("MtlRoll")) {
    const cap = requiredLookup(CAP_BY_SUFFIX, suffix.slice("MtlRoll".length), "cap suffix", websiteSku);
    return `CYL-9ML:${bodyVariantKey}:ROLLON:${cap}:METAL`;
  }
  if (suffix.startsWith("Roll")) {
    const cap = requiredLookup(CAP_BY_SUFFIX, suffix.slice("Roll".length), "cap suffix", websiteSku);
    return `CYL-9ML:${bodyVariantKey}:ROLLON:${cap}:PLASTIC`;
  }
  if (suffix.startsWith("Spry")) {
    const sprayer = requiredLookup(
      SPRAYER_BY_SUFFIX,
      suffix.slice("Spry".length),
      "sprayer suffix",
      websiteSku,
    );
    return `CYL-9ML:${bodyVariantKey}:SPRAY:${sprayer}`;
  }
  if (suffix.startsWith("Ltn")) {
    const pump = requiredLookup(PUMP_BY_SUFFIX, suffix.slice("Ltn".length), "pump suffix", websiteSku);
    return `CYL-9ML:${bodyVariantKey}:LOTION:${pump}`;
  }
  throw new Error(`Unknown CYL-9ML assembly suffix '${suffix}' in ${websiteSku}.`);
}

function bodyVariantFromCatalogColor(color: string, websiteSku: string): string {
  return requiredLookup(BODY_BY_CATALOG_COLOR, color, "catalog color", websiteSku);
}

export function buildCyl9CatalogCrosswalk(
  products: Cyl9CatalogProduct[],
  sourceCatalogPath: string,
  sourceCatalogSha256: string,
): Cyl9CatalogCrosswalk {
  const familyRows = products.filter((product) => (
    product.family === "Cylinder"
    && product.capacityMl === 9
    && product.neckThreadSize === "17-415"
  ));
  const rowsByWebsiteSku = new Map<string, Cyl9CatalogProduct[]>();
  for (const row of familyRows) {
    const rows = rowsByWebsiteSku.get(row.websiteSku) ?? [];
    rows.push(row);
    rowsByWebsiteSku.set(row.websiteSku, rows);
  }

  const mappings: Cyl9CatalogCrosswalk["mappings"] = [];
  const reviewIssues: Cyl9CatalogCrosswalk["reviewIssues"] = [];
  for (const websiteSku of [...rowsByWebsiteSku.keys()].sort()) {
    const rows = rowsByWebsiteSku.get(websiteSku) ?? [];
    const mappingKey = cyl9MappingKeyFromWebsiteSku(websiteSku);
    const bodyVariantKey = mappingKey.split(":")[1];
    const matchingRows = rows.filter((row) => (
      bodyVariantFromCatalogColor(row.color, websiteSku) === bodyVariantKey
    ));
    if (matchingRows.length !== 1) {
      throw new Error(
        `CYL-9ML ${websiteSku} must resolve to exactly one row matching body ${bodyVariantKey}; found ${matchingRows.length}.`,
      );
    }
    const selectedRow = matchingRows[0];
    mappings.push({
      mappingKey,
      graceSku: selectedRow.graceSku,
      websiteSku,
    });
    if (rows.length > 1) {
      reviewIssues.push({
        issueKey: `CYL-9ML:DUPLICATE:${websiteSku}`,
        websiteSku,
        reason: "duplicate-website-sku-conflicting-body-color",
        resolution: "selected-row-matching-website-sku-body",
        selectedGraceSku: selectedRow.graceSku,
        sourceRows: [...rows]
          .sort((left, right) => left.color.localeCompare(right.color))
          .map(({ graceSku, color }) => ({ graceSku, color })),
      });
    }
  }

  const mappingKeys = new Set(mappings.map(({ mappingKey }) => mappingKey));
  if (mappings.length !== 145 || mappingKeys.size !== 145) {
    throw new Error(
      `CYL-9ML catalog must resolve to 145 unique assemblies; found ${mappings.length} rows and ${mappingKeys.size} mapping keys.`,
    );
  }

  return {
    schemaVersion: 1,
    familyKey: "CYL-9ML",
    sourceCatalogPath,
    sourceCatalogSha256,
    mappings,
    reviewIssues,
  };
}
