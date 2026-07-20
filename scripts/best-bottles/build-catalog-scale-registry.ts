import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  applyBestBottlesFamilyScaleCorrection,
  BEST_BOTTLES_CATALOG_SCALE_VERSION,
  deriveBestBottlesBodyTargetPx,
  resolveBestBottlesGlobalScalePct,
} from "../../src/config/bestBottlesCatalogScale";
import {
  BEST_BOTTLES_FAMILY_SCALE_CORRECTIONS,
  getBestBottlesFamilyProfileForProduct,
} from "../../src/config/bestBottlesFamilyProfiles";
import {
  resolveBestBottlesCapStateEligibility,
  validateBestBottlesCalibrationRow,
  type BestBottlesCalibrationRegistryRow,
} from "../../src/lib/bestBottlesCalibrationRegistry";

type UnknownRow = Record<string, unknown>;

export interface BestBottlesCatalogScaleRegistryBuildInput {
  products: UnknownRow[];
  readinessRows: UnknownRow[];
  referenceObjects: UnknownRow[];
}

export interface BestBottlesCatalogScaleRegistryExclusion {
  graceSku: string;
  websiteSku: string;
  family: string;
  capacityMl: number | null;
  reasons: string[];
}

export interface BestBottlesCatalogScaleRegistryBuildResult {
  scaleContractVersion: typeof BEST_BOTTLES_CATALOG_SCALE_VERSION;
  registry: BestBottlesCalibrationRegistryRow[];
  excluded: BestBottlesCatalogScaleRegistryExclusion[];
  cylinderAnchors: BestBottlesCalibrationRegistryRow[];
  missingCylinderAnchorCapacitiesMl: number[];
}

const CYLINDER_ANCHOR_CAPACITIES_ML = [1, 3, 4, 5, 9, 28, 30, 50, 100, 118, 227, 454] as const;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function positiveNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  const match = text(value).match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const parsed = Number.parseFloat(match[1]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function normalizedSku(value: unknown): string {
  return text(value).toUpperCase();
}

function rowKey(row: UnknownRow): string {
  return normalizedSku(row.graceSku) || normalizedSku(row.websiteSku);
}

function indexRows(rows: UnknownRow[]): Map<string, UnknownRow> {
  const index = new Map<string, UnknownRow>();
  for (const row of rows) {
    const graceSku = normalizedSku(row.graceSku);
    const websiteSku = normalizedSku(row.websiteSku);
    if (graceSku) index.set(graceSku, row);
    if (websiteSku && !index.has(websiteSku)) index.set(websiteSku, row);
  }
  return index;
}

function lookup(index: Map<string, UnknownRow>, product: UnknownRow): UnknownRow | null {
  return index.get(normalizedSku(product.graceSku))
    ?? index.get(normalizedSku(product.websiteSku))
    ?? null;
}

function list(value: unknown): string[] {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}

function isMultiComponentProduct(product: UnknownRow): boolean {
  const haystack = [product.itemName, product.itemDescription, product.applicator, product.capStyle]
    .map(text)
    .join(" ");
  return /\b(?:vintage|antique|bulb|tassel|two[- ]piece)\b/i.test(haystack);
}

function approvedReplacement(reference: UnknownRow | null): UnknownRow | null {
  const replacement = reference?.approvedReplacement;
  return replacement && typeof replacement === "object"
    ? replacement as UnknownRow
    : null;
}

function referenceId(reference: UnknownRow | null): string {
  const replacement = approvedReplacement(reference);
  if (!replacement) return "";
  const alphaState = text(replacement.pixelAlphaState).toLowerCase();
  if (!alphaState.includes("opaque") || alphaState.includes("transparent")) return "";
  return text(replacement.sha256) || text(replacement.localPath);
}

function optionalReferenceField(reference: UnknownRow | null, field: string): string | null {
  const value = reference ? text(reference[field]) : "";
  return value || null;
}

function familyText(product: UnknownRow): string {
  return text(product.family) || text(product.bottleCollection) || text(product.category);
}

function isCylinderFamily(family: string): boolean {
  return /^(?:tall )?cylinder$/i.test(family) || /^vial$/i.test(family);
}

export function buildBestBottlesCatalogScaleRegistry(
  input: BestBottlesCatalogScaleRegistryBuildInput,
): BestBottlesCatalogScaleRegistryBuildResult {
  const readinessIndex = indexRows(input.readinessRows);
  const referenceIndex = indexRows(input.referenceObjects);
  const registry: BestBottlesCalibrationRegistryRow[] = [];
  const excluded: BestBottlesCatalogScaleRegistryExclusion[] = [];

  for (const product of input.products) {
    const graceSku = text(product.graceSku);
    const websiteSku = text(product.websiteSku);
    const family = familyText(product);
    const capacityMl = positiveNumber(product.capacityMl ?? product.capacity);
    const heightWithCapMm = positiveNumber(product.heightWithCap);
    const heightWithoutCapMm = positiveNumber(product.heightWithoutCap);
    const diameterMm = positiveNumber(product.diameter);
    const readiness = lookup(readinessIndex, product);
    const reference = lookup(referenceIndex, product);
    const reasons: string[] = [];

    if (!graceSku || !websiteSku) reasons.push("Canonical Grace SKU and website SKU are required.");
    if (!family) reasons.push("Catalog family is missing.");
    if (capacityMl == null) reasons.push("Capacity measurement is missing.");
    if (heightWithCapMm == null || heightWithoutCapMm == null || diameterMm == null) {
      reasons.push("Reconciled assembled height, body height, and diameter measurements are required.");
    } else if (heightWithoutCapMm > heightWithCapMm) {
      reasons.push("Measurement dispute: body height exceeds assembled height.");
    }

    const readinessIssues = list(readiness?.issues);
    if (text(readiness?.catalogJoinIssue)) reasons.push(`Catalog join issue: ${text(readiness?.catalogJoinIssue)}`);
    if (readinessIssues.some((issue) => /missing_measurement|measurement_override_pending/i.test(issue))) {
      reasons.push("Measurement evidence is not reconciled.");
    }

    const capOnReferenceId = referenceId(reference);
    if (!capOnReferenceId) reasons.push("Approved opaque cap-on PSD-derived reference is required.");

    const multiComponent = isMultiComponentProduct(product);
    const capOffReferenceId = optionalReferenceField(reference, "capOffReferenceId");
    const topologyReferenceId = optionalReferenceField(reference, "topologyReferenceId");
    const capStateEligibility = resolveBestBottlesCapStateEligibility({
      capOnReferenceId: capOnReferenceId || null,
      capOffReferenceId,
      topologyReferenceId,
      heightWithoutCap: text(product.heightWithoutCap),
      isMultiComponent: multiComponent,
    });
    if (multiComponent && capStateEligibility !== "multi-component-confirmed") {
      reasons.push("Multi-component product requires confirmed topology PSD evidence.");
    }

    if (reasons.length > 0 || capacityMl == null || heightWithCapMm == null || heightWithoutCapMm == null || diameterMm == null) {
      excluded.push({ graceSku, websiteSku, family, capacityMl, reasons });
      continue;
    }

    const profile = getBestBottlesFamilyProfileForProduct({
      family,
      bottleCollection: text(product.bottleCollection),
      category: text(product.category),
      graceSku,
      websiteSku,
      itemName: text(product.itemName),
      itemDescription: text(product.itemDescription),
      applicator: text(product.applicator),
      capacityMl,
      heightWithCap: text(product.heightWithCap),
      heightWithoutCap: text(product.heightWithoutCap),
      diameter: text(product.diameter),
    });
    if (!profile) {
      excluded.push({ graceSku, websiteSku, family, capacityMl, reasons: ["No bottle-family framing profile resolved."] });
      continue;
    }

    const globalTargetPct = resolveBestBottlesGlobalScalePct(capacityMl);
    const familyCorrectionPct = BEST_BOTTLES_FAMILY_SCALE_CORRECTIONS[profile.id];
    const finalAssembledTargetPct = applyBestBottlesFamilyScaleCorrection(
      globalTargetPct,
      familyCorrectionPct,
    );
    const productGroupId = text(product.productGroupId);
    const row: BestBottlesCalibrationRegistryRow = {
      scaleContractVersion: BEST_BOTTLES_CATALOG_SCALE_VERSION,
      registryKey: `${family.toLowerCase().replace(/[^a-z0-9]+/g, "-")}:${capacityMl}:${productGroupId || graceSku}`,
      graceSku,
      websiteSku,
      productGroupId,
      family,
      capacityMl,
      bodyMaterial: text(product.category) || text(product.bodyMaterial) || "unspecified",
      shapeClass: profile.id,
      heightWithCapMm,
      heightWithoutCapMm,
      diameterMm,
      measurementStatus: "reconciled",
      measurementSources: [text(readiness?.measurementSource), "convex-catalog"].filter(Boolean),
      capOnReferenceId,
      capOffReferenceId,
      topologyReferenceId,
      capStateEligibility,
      globalTargetPct,
      familyCorrectionPct,
      finalAssembledTargetPct,
      bodyTargetPx: deriveBestBottlesBodyTargetPx({
        canvasHeightPx: 2288,
        assembledHeightPct: finalAssembledTargetPct,
        verifiedBodyHeightMm: heightWithoutCapMm,
        verifiedAssembledHeightMm: heightWithCapMm,
      }),
      promptVersion: "best-bottles-reference-locked-v6.1",
    };

    try {
      registry.push(validateBestBottlesCalibrationRow(row));
    } catch (error) {
      excluded.push({
        graceSku,
        websiteSku,
        family,
        capacityMl,
        reasons: [error instanceof Error ? error.message : String(error)],
      });
    }
  }

  registry.sort((a, b) => a.family.localeCompare(b.family) || a.capacityMl - b.capacityMl || a.graceSku.localeCompare(b.graceSku));
  const cylinderAnchors = CYLINDER_ANCHOR_CAPACITIES_ML.flatMap((capacityMl) => {
    const candidates = registry.filter((row) => isCylinderFamily(row.family) && row.capacityMl === capacityMl);
    candidates.sort((a, b) => {
      const aSimple = /(?:tassel|bulb|pump|spray|dropper|wand)/i.test(a.graceSku) ? 1 : 0;
      const bSimple = /(?:tassel|bulb|pump|spray|dropper|wand)/i.test(b.graceSku) ? 1 : 0;
      return aSimple - bSimple || a.graceSku.localeCompare(b.graceSku);
    });
    return candidates.slice(0, 1);
  });
  const selectedCapacities = new Set(cylinderAnchors.map((row) => row.capacityMl));

  return {
    scaleContractVersion: BEST_BOTTLES_CATALOG_SCALE_VERSION,
    registry,
    excluded,
    cylinderAnchors,
    missingCylinderAnchorCapacitiesMl: CYLINDER_ANCHOR_CAPACITIES_ML.filter(
      (capacityMl) => !selectedCapacities.has(capacityMl),
    ),
  };
}

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function main(): void {
  const root = process.cwd();
  const catalog = readJson<{ products?: UnknownRow[] }>(path.join(root, "public/data/best-bottles-catalog-lite.json"));
  const readiness = readJson<{ rows?: UnknownRow[] }>(path.join(root, "public/data/best-bottles-generation-readiness.json"));
  const references = readJson<{ objects?: UnknownRow[] }>(path.join(root, "docs/best-bottles-reference-migration-manifest.json"));
  const result = buildBestBottlesCatalogScaleRegistry({
    products: catalog.products ?? [],
    readinessRows: readiness.rows ?? [],
    referenceObjects: references.objects ?? [],
  });

  const outputDir = path.join(root, "public/data");
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(
    path.join(outputDir, "best-bottles-catalog-scale-registry.json"),
    `${JSON.stringify(result, null, 2)}\n`,
  );
  writeFileSync(
    path.join(outputDir, "best-bottles-cylinder-calibration-manifest.json"),
    `${JSON.stringify({
      scaleContractVersion: result.scaleContractVersion,
      anchors: result.cylinderAnchors,
      missingAnchorCapacitiesMl: result.missingCylinderAnchorCapacitiesMl,
    }, null, 2)}\n`,
  );

  console.log(JSON.stringify({
    registryRows: result.registry.length,
    excludedRows: result.excluded.length,
    cylinderAnchors: result.cylinderAnchors.length,
    missingCylinderAnchorCapacitiesMl: result.missingCylinderAnchorCapacitiesMl,
  }, null, 2));
  if (result.missingCylinderAnchorCapacitiesMl.length > 0) process.exitCode = 1;
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (import.meta.url === invokedPath) main();
