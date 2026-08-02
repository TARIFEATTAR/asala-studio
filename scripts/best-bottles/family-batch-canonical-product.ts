import type { CylinderProductionReadinessRow } from "../../src/lib/bestBottlesCylinderProductionCutover";

export const BEST_BOTTLES_CANONICAL_TRUTH_VERSION =
  "best-bottles-canonical-truth-2026-07-12" as const;

type FamilyBatchProductLike = {
  websiteSku?: string | null;
  graceSku?: string | null;
  family?: string | null;
  capacityMl?: number | null;
  heightWithoutCap?: string | null;
  heightWithCap?: string | null;
  diameter?: string | null;
  [key: string]: unknown;
};

function normalizedIdentity(value: string | null | undefined): string {
  return String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function positiveDimension(value: string, label: string): number {
  const parsed = Number(value.trim());
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Canonical Cylinder ${label} is missing or invalid.`);
  }
  return parsed;
}

export function applyCanonicalCylinderGeometry<T extends FamilyBatchProductLike>(
  product: T,
  readiness: CylinderProductionReadinessRow,
): T & {
  canonicalBodyHeightMm: number;
  canonicalAssembledHeightMm: number;
  canonicalWidthAxisMm: number;
  canonicalSecondAxisMm: number;
  measurementSource: typeof BEST_BOTTLES_CANONICAL_TRUTH_VERSION;
} {
  const exactIdentity =
    normalizedIdentity(product.websiteSku) === normalizedIdentity(readiness.websiteSku) &&
    normalizedIdentity(product.graceSku) === normalizedIdentity(readiness.graceSku) &&
    normalizedIdentity(readiness.canonical.websiteSku) === normalizedIdentity(readiness.websiteSku) &&
    normalizedIdentity(readiness.canonical.graceSku) === normalizedIdentity(readiness.graceSku);
  if (!exactIdentity) {
    throw new Error(
      `Canonical Cylinder generation requires an exact Website + Grace SKU match for ${readiness.canonicalIdentityKey}.`,
    );
  }
  if (readiness.status !== "production-qualified" || !readiness.reference) {
    throw new Error(
      `${readiness.canonicalIdentityKey} is not production-qualified: ${readiness.blockers.join(", ") || "reference missing"}.`,
    );
  }
  const bodyHeight = positiveDimension(
    readiness.canonical.canon_bodyHeightMm,
    "canon_bodyHeightMm",
  );
  const assembledHeight = positiveDimension(
    readiness.canonical.canon_heightWithCapMm,
    "canon_heightWithCapMm",
  );
  const widthAxis = positiveDimension(
    readiness.canonical.canon_widthAxisMm,
    "canon_widthAxisMm",
  );
  const secondAxis = positiveDimension(
    readiness.canonical.canon_secondAxisMm,
    "canon_secondAxisMm",
  );
  if (bodyHeight > assembledHeight) {
    throw new Error(
      `${readiness.canonicalIdentityKey} canonical body height ${bodyHeight} exceeds assembled height ${assembledHeight}.`,
    );
  }

  return {
    ...product,
    family: readiness.canonical.family,
    capacityMl: positiveDimension(readiness.canonical.capacityMl, "capacityMl"),
    heightWithoutCap: String(bodyHeight),
    heightWithCap: String(assembledHeight),
    diameter: String(widthAxis),
    canonicalBodyHeightMm: bodyHeight,
    canonicalAssembledHeightMm: assembledHeight,
    canonicalWidthAxisMm: widthAxis,
    canonicalSecondAxisMm: secondAxis,
    measurementSource: BEST_BOTTLES_CANONICAL_TRUTH_VERSION,
  };
}
