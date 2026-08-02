import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  CYLINDER_DISPLAY_CURVE_VERSION,
  resolveCylinderDisplayScale,
  type CylinderDisplayScale,
} from "../../src/lib/bestBottlesCylinderDisplayCurve";
import {
  buildCylinderPhysicalTypes,
  physicalTypeKey,
  type CylinderCatalogRow,
  type CylinderPhysicalType,
  type CylinderPlateId,
} from "../../src/lib/bestBottlesCylinderPhysicalTypes";

type Bytes = Uint8Array;
type ConfirmationStatus = "confirmed" | "missing" | "mismatch" | "ambiguous";
type MeasurementStatus = "confirmed" | "missing" | "invalid";
type ReferenceStatus = "exact-psd" | "exact-catalog" | "missing-source" | "rejected-non-exact" | "missing" | "ambiguous";

export interface PsdCoverageRow {
  websiteSku?: string | null;
  graceSku?: string | null;
  allMatchedPsdPaths?: string | null;
  [key: string]: unknown;
}

export interface Cylinder75TypeManifestInput {
  catalogProducts: readonly CylinderCatalogRow[];
  readinessRows: readonly CylinderCatalogRow[];
  psdCoverageRows: readonly PsdCoverageRow[];
  authoritativePsdRoot: string;
  psdSourceBytesByPath: Readonly<Record<string, Bytes>>;
  sourceFiles: {
    catalog: { path: string; bytes: Bytes };
    readiness: { path: string; bytes: Bytes };
    psdCoverage: { path: string; bytes: Bytes };
  };
  canvasHeightPx?: number;
}

export interface ManifestReference {
  source: "authoritative-psd" | "catalog-image-url";
  path: string;
  sha256: string | null;
}

export interface CylinderManifestRow {
  physicalTypeKey: string;
  plateId: CylinderPlateId | "supplemental";
  websiteSku: string;
  graceSku: string;
  capacityMl: number;
  material: "glass" | "plastic" | "aluminum" | "unknown";
  identityMatch: "websiteSku" | "graceSku" | null;
  identityStatus: ConfirmationStatus;
  measurementStatus: MeasurementStatus;
  referenceStatus: ReferenceStatus;
  topologyStatus: ConfirmationStatus;
  measurements: {
    heightWithCapMm: number | null;
    heightWithoutCapMm: number | null;
    diameterMm: number | null;
  };
  displayScale: CylinderDisplayScale | null;
  reference: ManifestReference | null;
  primarySourceChecksum: string | null;
  reasons: string[];
}

export interface CylinderManifestBlocker {
  physicalTypeKey: string;
  websiteSku: string;
  graceSku: string;
  reasons: string[];
}

export interface Cylinder75TypeManifest {
  version: "best-bottles-cylinder-75-type-lineup-manifest-v1";
  curveVersion: typeof CYLINDER_DISPLAY_CURVE_VERSION;
  canvasHeightPx: number;
  authoritativePsdRoot: string;
  primarySourceChecksum: string;
  sources: Record<"catalog" | "readiness" | "psdCoverage", { path: string; sha256: string }>;
  summary: {
    physicalTypeCount: number;
    eligibleCount: number;
    blockerCount: number;
    supplementalEndpointCount: 1;
  };
  coverageRows: CylinderManifestRow[];
  eligibleRows: CylinderManifestRow[];
  blockers: CylinderManifestBlocker[];
  plates: Record<CylinderPlateId, CylinderManifestRow[]>;
  supplementalMasterEndpoint: CylinderManifestRow;
}

function normalizedSku(value: unknown): string {
  return typeof value === "string"
    ? value.normalize("NFKC").trim().toLowerCase()
    : "";
}

function sha256(bytes: Bytes): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function parseMeasurement(value: unknown): { status: "confirmed" | "missing" | "invalid"; value: number | null } {
  if (value === null || value === undefined || (typeof value === "string" && value.trim() === "")) {
    return { status: "missing", value: null };
  }
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0
      ? { status: "confirmed", value }
      : { status: "invalid", value: null };
  }
  if (typeof value !== "string") return { status: "invalid", value: null };
  const match = value.trim().match(/^(\d+(?:\.\d+)?)\s*(?:±\s*(\d+(?:\.\d+)?)\s*)?(?:mm)?$/i);
  if (!match) return { status: "invalid", value: null };
  const parsed = Number(match[1]);
  const tolerance = match[2] === undefined ? null : Number(match[2]);
  if (!Number.isFinite(parsed) || parsed <= 0 ||
      (tolerance !== null && (!Number.isFinite(tolerance) || tolerance <= 0))) {
    return { status: "invalid", value: null };
  }
  return { status: "confirmed", value: parsed };
}

function parseCapacity(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function materialFor(row: CylinderCatalogRow): CylinderManifestRow["material"] {
  if (normalizedSku(row.websiteSku) === "pbclear8ozflpwh") return "plastic";
  const text = `${String(row.category ?? "")} ${String(row.family ?? "")}`.toLowerCase();
  if (text.includes("aluminum")) return "aluminum";
  if (text.includes("plastic") || normalizedSku(row.websiteSku).startsWith("pb")) return "plastic";
  if (text.includes("glass") || normalizedSku(row.websiteSku).startsWith("gb")) return "glass";
  return "unknown";
}

function basename(value: string): string {
  const withoutQuery = value.split(/[?#]/, 1)[0];
  const raw = withoutQuery.split(/[\\/]/).pop() ?? "";
  try {
    return decodeURIComponent(raw).normalize("NFKC");
  } catch {
    return raw.normalize("NFKC");
  }
}

function exactPsdPath(candidate: string, row: CylinderCatalogRow): boolean {
  const match = basename(candidate).match(/^(.*)\.(psd|psb)$/i);
  if (!match) return false;
  const stem = normalizedSku(match[1].replace(/^\d+\.\s+/, "").replace(/\.+$/, ""));
  return [normalizedSku(row.websiteSku), normalizedSku(row.graceSku)].filter(Boolean).includes(stem);
}

function exactCatalogImage(row: CylinderCatalogRow): string | null {
  const imageUrl = typeof row.imageUrl === "string" ? row.imageUrl.trim() : "";
  if (!imageUrl) return null;
  const filename = basename(imageUrl);
  const stem = normalizedSku(filename.replace(/\.[^.]+$/, ""));
  const websiteSku = normalizedSku(row.websiteSku);
  const graceSku = normalizedSku(row.graceSku);
  const canonical = `${graceSku}__${websiteSku}__pdp-main__v001.png`;
  const canonicalWithoutWebsite = `${graceSku}__pdp-main__v001.png`;
  if (stem === websiteSku || normalizedSku(filename) === canonical || normalizedSku(filename) === canonicalWithoutWebsite) {
    return imageUrl;
  }
  return null;
}

function indexRows(rows: readonly CylinderCatalogRow[], field: "websiteSku" | "graceSku"): Map<string, CylinderCatalogRow[]> {
  const index = new Map<string, CylinderCatalogRow[]>();
  for (const row of rows) {
    const key = normalizedSku(row[field]);
    if (!key) continue;
    const bucket = index.get(key) ?? [];
    bucket.push(row);
    index.set(key, bucket);
  }
  return index;
}

function canonicalEvidence(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalEvidence).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, child]) => child !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${canonicalEvidence(child)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? String(value);
}

function equivalentBucket<T>(rows: readonly T[]): { row: T | null; ambiguous: boolean } {
  if (rows.length === 0) return { row: null, ambiguous: false };
  return new Set(rows.map(canonicalEvidence)).size === 1
    ? { row: rows[0], ambiguous: false }
    : { row: null, ambiguous: true };
}

function joinReadiness(
  target: CylinderCatalogRow,
  websiteIndex: Map<string, CylinderCatalogRow[]>,
  graceIndex: Map<string, CylinderCatalogRow[]>,
): { row: CylinderCatalogRow | null; match: CylinderManifestRow["identityMatch"]; ambiguityReason: string | null } {
  const websiteMatches = websiteIndex.get(normalizedSku(target.websiteSku)) ?? [];
  if (websiteMatches.length > 0) {
    const resolved = equivalentBucket(websiteMatches);
    return resolved.ambiguous
      ? { row: null, match: "websiteSku", ambiguityReason: "ambiguous_readiness_website_sku" }
      : { row: resolved.row, match: "websiteSku", ambiguityReason: null };
  }
  const graceMatches = graceIndex.get(normalizedSku(target.graceSku)) ?? [];
  const resolved = equivalentBucket(graceMatches);
  if (resolved.ambiguous) return { row: null, match: "graceSku", ambiguityReason: "ambiguous_readiness_grace_sku" };
  return resolved.row
    ? { row: resolved.row, match: "graceSku", ambiguityReason: null }
    : { row: null, match: null, ambiguityReason: null };
}

function coverageFor(
  target: CylinderCatalogRow,
  websiteIndex: Map<string, PsdCoverageRow[]>,
  graceIndex: Map<string, PsdCoverageRow[]>,
): { row: PsdCoverageRow | null; ambiguityReason: string | null } {
  const websiteMatches = websiteIndex.get(normalizedSku(target.websiteSku)) ?? [];
  if (websiteMatches.length > 0) {
    const resolved = equivalentBucket(websiteMatches);
    return resolved.ambiguous
      ? { row: null, ambiguityReason: "ambiguous_psd_coverage_website_sku" }
      : { row: resolved.row, ambiguityReason: null };
  }
  const graceMatches = graceIndex.get(normalizedSku(target.graceSku)) ?? [];
  const resolved = equivalentBucket(graceMatches);
  if (resolved.ambiguous) return { row: null, ambiguityReason: "ambiguous_psd_coverage_grace_sku" };
  return { row: resolved.row, ambiguityReason: null };
}

function indexCoverage(rows: readonly PsdCoverageRow[], field: "websiteSku" | "graceSku"): Map<string, PsdCoverageRow[]> {
  const index = new Map<string, PsdCoverageRow[]>();
  for (const row of rows) {
    const key = normalizedSku(row[field]);
    if (!key) continue;
    const bucket = index.get(key) ?? [];
    bucket.push(row);
    index.set(key, bucket);
  }
  return index;
}

function resolveReference(
  target: CylinderCatalogRow,
  coverage: PsdCoverageRow | null,
  input: Cylinder75TypeManifestInput,
): { status: ReferenceStatus; reference: ManifestReference | null; reason: string | null } {
  const candidates = String(coverage?.allMatchedPsdPaths ?? "")
    .split("|").map((value) => value.trim()).filter(Boolean);
  if (candidates.length > 0) {
    const exactCandidates = candidates.filter((candidate) => exactPsdPath(candidate, target));
    if (exactCandidates.length === 0) {
      return { status: "rejected-non-exact", reference: null, reason: "no_exact_reference" };
    }
    for (const relativePath of exactCandidates) {
      const sourcePath = path.resolve(input.authoritativePsdRoot, relativePath);
      const root = path.resolve(input.authoritativePsdRoot);
      if (sourcePath !== root && !sourcePath.startsWith(`${root}${path.sep}`)) continue;
      const bytes = input.psdSourceBytesByPath[sourcePath];
      if (bytes) {
        return {
          status: "exact-psd",
          reference: { source: "authoritative-psd", path: sourcePath, sha256: sha256(bytes) },
          reason: null,
        };
      }
    }
    return { status: "missing-source", reference: null, reason: "exact_psd_source_missing" };
  }
  const catalogImage = exactCatalogImage(target);
  if (catalogImage) {
    return {
      status: "exact-catalog",
      reference: { source: "catalog-image-url", path: catalogImage, sha256: null },
      reason: null,
    };
  }
  return { status: "missing", reference: null, reason: "no_exact_reference" };
}

function buildRow(
  target: CylinderPhysicalType | (CylinderCatalogRow & { physicalTypeKey: string; plateId: "supplemental" }),
  input: Cylinder75TypeManifestInput,
  indexes: {
    readinessWebsite: Map<string, CylinderCatalogRow[]>;
    readinessGrace: Map<string, CylinderCatalogRow[]>;
    coverageWebsite: Map<string, PsdCoverageRow[]>;
    coverageGrace: Map<string, PsdCoverageRow[]>;
  },
): CylinderManifestRow {
  const joined = joinReadiness(target, indexes.readinessWebsite, indexes.readinessGrace);
  const identityStatus: ConfirmationStatus = joined.ambiguityReason ? "ambiguous" : joined.row ? "confirmed" : "missing";
  const topologyStatus: ConfirmationStatus = joined.ambiguityReason
    ? "ambiguous"
    : !joined.row
    ? "missing"
    : physicalTypeKey(joined.row) === target.physicalTypeKey ? "confirmed" : "mismatch";
  const parsedMeasurements = {
    heightWithCap: parseMeasurement(target.heightWithCap),
    heightWithoutCap: parseMeasurement(target.heightWithoutCap),
    diameter: parseMeasurement(target.diameter),
  };
  const heightWithCapMm = parsedMeasurements.heightWithCap.value;
  const heightWithoutCapMm = parsedMeasurements.heightWithoutCap.value;
  const diameterMm = parsedMeasurements.diameter.value;
  const measurementReasons: string[] = [];
  for (const [field, parsed] of Object.entries(parsedMeasurements)) {
    const reasonField = field === "heightWithCap" ? "height_with_cap_mm" :
      field === "heightWithoutCap" ? "height_without_cap_mm" : "diameter_mm";
    if (parsed.status === "missing") measurementReasons.push(`missing_${reasonField}`);
    if (parsed.status === "invalid") measurementReasons.push(`invalid_${reasonField}`);
  }
  let measurementStatus: MeasurementStatus = Object.values(parsedMeasurements).some((parsed) => parsed.status === "invalid")
    ? "invalid"
    : Object.values(parsedMeasurements).some((parsed) => parsed.status === "missing") ? "missing" : "confirmed";
  let displayScale: CylinderDisplayScale | null = null;
  if (measurementStatus === "confirmed") {
    try {
      displayScale = resolveCylinderDisplayScale({
        canvasHeightPx: input.canvasHeightPx ?? 2288,
        heightWithCapMm: heightWithCapMm!,
        heightWithoutCapMm: heightWithoutCapMm!,
        diameterMm: diameterMm!,
      });
    } catch {
      measurementStatus = "invalid";
      measurementReasons.push("invalid_measurement_geometry");
    }
  }
  const coverage = coverageFor(target, indexes.coverageWebsite, indexes.coverageGrace);
  const resolvedReference = coverage.ambiguityReason
    ? { status: "ambiguous" as const, reference: null, reason: coverage.ambiguityReason }
    : resolveReference(target, coverage.row, input);
  const reasons = [...measurementReasons];
  if (joined.ambiguityReason) reasons.push(joined.ambiguityReason);
  else if (!joined.row) reasons.push("readiness_identity_missing");
  if (topologyStatus === "mismatch") reasons.push("readiness_topology_mismatch");
  if (resolvedReference.reason) reasons.push(resolvedReference.reason);
  return {
    physicalTypeKey: target.physicalTypeKey,
    plateId: target.plateId,
    websiteSku: String(target.websiteSku ?? ""),
    graceSku: String(target.graceSku ?? ""),
    capacityMl: parseCapacity(target.capacityMl),
    material: materialFor(target),
    identityMatch: joined.match,
    identityStatus,
    measurementStatus,
    referenceStatus: resolvedReference.status,
    topologyStatus,
    measurements: { heightWithCapMm, heightWithoutCapMm, diameterMm },
    displayScale,
    reference: resolvedReference.reference,
    primarySourceChecksum: resolvedReference.reference?.sha256 ??
      (resolvedReference.status === "exact-catalog" ? sha256(input.sourceFiles.catalog.bytes) : null),
    reasons,
  };
}

function eligible(row: CylinderManifestRow): boolean {
  return row.identityStatus === "confirmed" &&
    row.measurementStatus === "confirmed" &&
    (row.referenceStatus === "exact-psd" || row.referenceStatus === "exact-catalog") &&
    row.topologyStatus === "confirmed";
}

function comparePlateRows(left: CylinderManifestRow, right: CylinderManifestRow): number {
  return (left.displayScale?.assembledTargetPct ?? Number.POSITIVE_INFINITY) -
    (right.displayScale?.assembledTargetPct ?? Number.POSITIVE_INFINITY) ||
    left.capacityMl - right.capacityMl ||
    left.websiteSku.localeCompare(right.websiteSku);
}

export function buildCylinder75TypeManifest(input: Cylinder75TypeManifestInput): Cylinder75TypeManifest {
  const physicalTypes = buildCylinderPhysicalTypes(input.catalogProducts);
  if (physicalTypes.length !== 75) {
    throw new Error(`Cylinder manifest requires exactly 75 physical types; received ${physicalTypes.length}.`);
  }
  const indexes = {
    readinessWebsite: indexRows(input.readinessRows, "websiteSku"),
    readinessGrace: indexRows(input.readinessRows, "graceSku"),
    coverageWebsite: indexCoverage(input.psdCoverageRows, "websiteSku"),
    coverageGrace: indexCoverage(input.psdCoverageRows, "graceSku"),
  };
  const coverageRows = physicalTypes.map((target) => buildRow(target, input, indexes));
  const supplementalProduct = input.catalogProducts.find((row) => normalizedSku(row.websiteSku) === "alu500");
  if (!supplementalProduct) throw new Error("Cylinder manifest requires supplemental endpoint Alu500.");
  const supplementalMasterEndpoint = buildRow({
    ...supplementalProduct,
    physicalTypeKey: physicalTypeKey(supplementalProduct),
    plateId: "supplemental",
  }, input, indexes);
  const eligibleRows = coverageRows.filter(eligible);
  const blockers = coverageRows.filter((row) => !eligible(row)).map((row) => ({
    physicalTypeKey: row.physicalTypeKey,
    websiteSku: row.websiteSku,
    graceSku: row.graceSku,
    reasons: row.reasons,
  }));
  const plates = Object.fromEntries(
    (["01", "02", "03", "04", "05", "06", "07", "08"] as const).map((plateId) => [
      plateId,
      coverageRows.filter((row) => row.plateId === plateId).sort(comparePlateRows),
    ]),
  ) as Record<CylinderPlateId, CylinderManifestRow[]>;
  return {
    version: "best-bottles-cylinder-75-type-lineup-manifest-v1",
    curveVersion: CYLINDER_DISPLAY_CURVE_VERSION,
    canvasHeightPx: input.canvasHeightPx ?? 2288,
    authoritativePsdRoot: input.authoritativePsdRoot,
    primarySourceChecksum: sha256(input.sourceFiles.catalog.bytes),
    sources: {
      catalog: { path: input.sourceFiles.catalog.path, sha256: sha256(input.sourceFiles.catalog.bytes) },
      readiness: { path: input.sourceFiles.readiness.path, sha256: sha256(input.sourceFiles.readiness.bytes) },
      psdCoverage: { path: input.sourceFiles.psdCoverage.path, sha256: sha256(input.sourceFiles.psdCoverage.bytes) },
    },
    summary: {
      physicalTypeCount: coverageRows.length,
      eligibleCount: eligibleRows.length,
      blockerCount: blockers.length,
      supplementalEndpointCount: 1,
    },
    coverageRows,
    eligibleRows,
    blockers,
    plates,
    supplementalMasterEndpoint,
  };
}

export function parsePsdCoverageCsv(text: string): PsdCoverageRow[] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (character === "," && !quoted) {
      record.push(field); field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      record.push(field);
      if (record.some(Boolean)) records.push(record);
      record = []; field = "";
    } else field += character;
  }
  if (field || record.length > 0) { record.push(field); records.push(record); }
  const [headers = [], ...rows] = records;
  return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}

export function resolveCoverageTarget<T extends CylinderCatalogRow>(
  coverage: PsdCoverageRow,
  targetRows: readonly T[],
): T | null {
  const websiteSku = normalizedSku(coverage.websiteSku);
  const websiteMatches = websiteSku
    ? targetRows.filter((row) => normalizedSku(row.websiteSku) === websiteSku)
    : [];
  if (websiteMatches.length > 0) {
    const graceSku = normalizedSku(coverage.graceSku);
    const graceWithinWebsite = graceSku
      ? websiteMatches.filter((row) => normalizedSku(row.graceSku) === graceSku)
      : [];
    const candidates = graceWithinWebsite.length > 0 ? graceWithinWebsite : websiteMatches;
    return [...candidates].sort((left, right) =>
      physicalTypeKey(left).localeCompare(physicalTypeKey(right)) ||
      normalizedSku(left.graceSku).localeCompare(normalizedSku(right.graceSku))
    )[0] ?? null;
  }
  const graceSku = normalizedSku(coverage.graceSku);
  if (!graceSku) return null;
  return [...targetRows]
    .filter((row) => normalizedSku(row.graceSku) === graceSku)
    .sort((left, right) =>
      physicalTypeKey(left).localeCompare(physicalTypeKey(right)) ||
      normalizedSku(left.websiteSku).localeCompare(normalizedSku(right.websiteSku))
    )[0] ?? null;
}

function containedSourcePath(authoritativePsdRoot: string, relativePath: string): string | null {
  const root = path.resolve(authoritativePsdRoot);
  const sourcePath = path.resolve(root, relativePath);
  return sourcePath !== root && sourcePath.startsWith(`${root}${path.sep}`) ? sourcePath : null;
}

export function collectPsdSourceBytes(input: {
  coverageRows: readonly PsdCoverageRow[];
  targetRows: readonly CylinderCatalogRow[];
  authoritativePsdRoot: string;
  fileExists: (sourcePath: string) => boolean;
  readBytes: (sourcePath: string) => Bytes;
}): Record<string, Bytes> {
  const result: Record<string, Bytes> = {};
  for (const coverage of input.coverageRows) {
    const target = resolveCoverageTarget(coverage, input.targetRows);
    if (!target) continue;
    for (const relativePath of String(coverage.allMatchedPsdPaths ?? "")
      .split("|").map((value) => value.trim()).filter(Boolean)) {
      if (!exactPsdPath(relativePath, target)) continue;
      const sourcePath = containedSourcePath(input.authoritativePsdRoot, relativePath);
      if (!sourcePath) continue;
      if (input.fileExists(sourcePath)) result[sourcePath] = input.readBytes(sourcePath);
    }
  }
  return result;
}

function runCli(): void {
  const root = process.cwd();
  const catalogPath = path.join(root, "public/data/best-bottles-catalog-lite.json");
  const readinessPath = path.join(root, "public/data/best-bottles-generation-readiness.json");
  const coveragePath = process.env.BEST_BOTTLES_PSD_COVERAGE_CSV ??
    "/Users/jordanrichter/Desktop/AI-OS/07 Outputs/best-bottles/2026-07-11-psd-website-csv-coverage-inventory/website-sku-psd-coverage.csv";
  const authoritativePsdRoot = process.env.BEST_BOTTLES_PSD_ARCHIVE_ROOT ??
    "/Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Original-Photoshop-Sources";
  const catalogBytes = readFileSync(catalogPath);
  const readinessBytes = readFileSync(readinessPath);
  const coverageBytes = readFileSync(coveragePath);
  const catalogProducts = (JSON.parse(catalogBytes.toString("utf8")) as { products: CylinderCatalogRow[] }).products;
  const readinessRows = (JSON.parse(readinessBytes.toString("utf8")) as { rows: CylinderCatalogRow[] }).rows;
  const targetRows: CylinderCatalogRow[] = [
    ...buildCylinderPhysicalTypes(catalogProducts),
    ...catalogProducts.filter((row) => normalizedSku(row.websiteSku) === "alu500").slice(0, 1),
  ];
  const targetWebsiteSkus = new Set(targetRows.map((row) => normalizedSku(row.websiteSku)).filter(Boolean));
  const targetGraceSkus = new Set(targetRows.map((row) => normalizedSku(row.graceSku)).filter(Boolean));
  const psdCoverageRows = parsePsdCoverageCsv(coverageBytes.toString("utf8")).filter((row) =>
    targetWebsiteSkus.has(normalizedSku(row.websiteSku)) || targetGraceSkus.has(normalizedSku(row.graceSku))
  );
  const psdSourceBytesByPath = collectPsdSourceBytes({
    coverageRows: psdCoverageRows,
    targetRows,
    authoritativePsdRoot,
    fileExists: existsSync,
    readBytes: readFileSync,
  });
  const manifest = buildCylinder75TypeManifest({
    catalogProducts,
    readinessRows,
    psdCoverageRows,
    authoritativePsdRoot,
    psdSourceBytesByPath,
    sourceFiles: {
      catalog: { path: catalogPath, bytes: catalogBytes },
      readiness: { path: readinessPath, bytes: readinessBytes },
      psdCoverage: { path: coveragePath, bytes: coverageBytes },
    },
  });
  const outputPath = path.join(root, "public/data/best-bottles-cylinder-75-type-lineup-manifest.json");
  writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(JSON.stringify({
    outputPath,
    physicalTypeCount: manifest.summary.physicalTypeCount,
    eligibleCount: manifest.summary.eligibleCount,
    blockerCount: manifest.summary.blockerCount,
    supplementalMasterEndpoint: manifest.supplementalMasterEndpoint.websiteSku,
    externalWrites: false,
  }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) runCli();
