export type CylinderPlateId = "01" | "02" | "03" | "04" | "05" | "06" | "07" | "08";

export interface CylinderCatalogRow {
  graceSku?: string | null;
  websiteSku?: string | null;
  family?: string | null;
  capacityMl?: number | string | null;
  category?: string | null;
  neckThreadSize?: string | null;
  applicator?: string | null;
  capStyle?: string | null;
  color?: string | null;
  heightWithCap?: string | number | null;
  heightWithoutCap?: string | number | null;
  diameter?: string | number | null;
  [key: string]: unknown;
}

export type CylinderPhysicalType = CylinderCatalogRow & {
  physicalTypeKey: string;
  plateId: CylinderPlateId;
};

function normalizedText(value: unknown): string {
  return typeof value === "string"
    ? value.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ")
    : "";
}

function normalizedCapacity(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return String(parsed);
  }
  return "";
}

function capacityMl(row: CylinderCatalogRow): number | null {
  const normalized = normalizedCapacity(row.capacityMl);
  return normalized === "" ? null : Number(normalized);
}

export function physicalTypeKey(row: CylinderCatalogRow): string {
  return [
    normalizedCapacity(row.capacityMl),
    normalizedText(row.category),
    normalizedText(row.neckThreadSize),
    normalizedText(row.applicator),
    normalizedText(row.capStyle),
  ].join("|");
}

function isCapOnly(applicator: string): boolean {
  return applicator === "" || applicator === "n/a" || applicator === "cap/closure";
}

export function resolveCylinderPlate(row: CylinderCatalogRow): CylinderPlateId {
  const capacity = capacityMl(row);
  const applicator = normalizedText(row.applicator);
  const capStyle = normalizedText(row.capStyle);

  if (capacity !== null && capacity >= 1 && capacity <= 4) return "01";
  if (isCapOnly(applicator) || capacity === 118 || capacity === 227 || capacity === 454) return "02";
  if (applicator.includes("vintage bulb sprayer")) return "08";
  if (applicator.includes("metal roller ball")) return "03";
  if (applicator.includes("plastic roller ball")) return "04";
  if (applicator.includes("sprayer") || applicator.includes("spray pump")) return "05";
  if (applicator.includes("lotion pump")) return "06";
  if (
    applicator.includes("reducer") ||
    applicator.includes("glass rod") ||
    applicator.includes("decorative") ||
    capStyle.includes("decorative")
  ) return "07";

  const sku = normalizedText(row.graceSku) || normalizedText(row.websiteSku) || "unknown SKU";
  throw new Error(`Unable to resolve Cylinder plate for ${sku} (${physicalTypeKey(row)})`);
}

function isCylinderCoverageRow(row: CylinderCatalogRow): boolean {
  const family = normalizedText(row.family);
  const capacity = capacityMl(row);
  return family === "cylinder" || family === "tall cylinder" || (
    family === "vial" && capacity !== null && capacity >= 1 && capacity <= 4
  );
}

function hasValue(value: unknown): boolean {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function referenceBasename(value: unknown): string {
  if (typeof value !== "string") return "";
  const withoutQuery = value.split(/[?#]/, 1)[0];
  const basename = withoutQuery.split(/[\\/]/).pop() ?? "";
  try {
    return decodeURIComponent(basename).normalize("NFKC").toLowerCase();
  } catch {
    return basename.normalize("NFKC").toLowerCase();
  }
}

function hasExactPsdMatch(row: CylinderCatalogRow): boolean {
  const graceSku = normalizedText(row.graceSku);
  const websiteSku = normalizedText(row.websiteSku);
  if (!graceSku) return false;

  const expectedFilename = websiteSku
    ? `${graceSku}__${websiteSku}__pdp-main__v001.png`
    : `${graceSku}__pdp-main__v001.png`;
  const paths = [
    row.psdFilename,
    row.psdPath,
    row.sourceReference,
    row.referencePath,
    row.sourceAssetPath,
    row.referenceName,
    row.imageUrl,
  ];
  return paths.some((path) => referenceBasename(path) === expectedFilename);
}

function hasReconciledMeasurements(row: CylinderCatalogRow): boolean {
  if (row.measurementReconciled === true) return true;
  const status = normalizedText(
    row.measurementReconciliationStatus ?? row.measurementStatus ?? row.reconciliationStatus,
  );
  return status
    .split(/[^a-z0-9]+/)
    .some((token) => ["reconciled", "resolved", "verified", "approved"].includes(token));
}

function hasSimpleCapState(row: CylinderCatalogRow): boolean {
  const capState = normalizedText(row.capState);
  return /^(cap on|cap-on|attached|closed|simple)$/.test(capState);
}

function representativeRank(row: CylinderCatalogRow): readonly [number, number, number, number, number] {
  const measurementCount = [row.heightWithCap, row.heightWithoutCap, row.diameter]
    .filter(hasValue).length;
  return [
    normalizedText(row.color) === "clear" ? 1 : 0,
    hasReconciledMeasurements(row) ? 1 : 0,
    hasExactPsdMatch(row) ? 1 : 0,
    hasSimpleCapState(row) ? 1 : 0,
    measurementCount,
  ];
}

function stableRowKey(row: CylinderCatalogRow): string {
  return Object.keys(row)
    .sort()
    .map((key) => `${key}:${JSON.stringify(row[key]) ?? String(row[key])}`)
    .join("|");
}

function representativeIdentity(row: CylinderCatalogRow): readonly string[] {
  return [
    normalizedText(row.graceSku),
    normalizedText(row.websiteSku),
    normalizedText(row._id),
    normalizedText(row.productId),
    normalizedText(row.productGroupId),
    normalizedText(row.imageUrl),
    stableRowKey(row),
  ];
}

function preferRepresentative(candidate: CylinderCatalogRow, current: CylinderCatalogRow): boolean {
  const candidateRank = representativeRank(candidate);
  const currentRank = representativeRank(current);
  for (let index = 0; index < candidateRank.length; index += 1) {
    if (candidateRank[index] !== currentRank[index]) {
      return candidateRank[index] > currentRank[index];
    }
  }

  const candidateIdentity = representativeIdentity(candidate);
  const currentIdentity = representativeIdentity(current);
  for (let index = 0; index < candidateIdentity.length; index += 1) {
    if (candidateIdentity[index] !== currentIdentity[index]) {
      return candidateIdentity[index] < currentIdentity[index];
    }
  }
  return false;
}

export function buildCylinderPhysicalTypes(products: readonly CylinderCatalogRow[]): CylinderPhysicalType[] {
  const representatives = new Map<string, CylinderCatalogRow>();

  for (const row of products) {
    if (!isCylinderCoverageRow(row)) continue;
    const key = physicalTypeKey(row);
    const current = representatives.get(key);
    if (!current || preferRepresentative(row, current)) representatives.set(key, row);
  }

  return [...representatives.entries()]
    .map(([key, row]) => ({
      ...row,
      physicalTypeKey: key,
      plateId: resolveCylinderPlate(row),
    }))
    .sort((left, right) =>
      left.plateId.localeCompare(right.plateId) ||
      (capacityMl(left) ?? Number.POSITIVE_INFINITY) - (capacityMl(right) ?? Number.POSITIVE_INFINITY) ||
      left.physicalTypeKey.localeCompare(right.physicalTypeKey)
    );
}
