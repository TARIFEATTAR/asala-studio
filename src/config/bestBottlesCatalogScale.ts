export const BEST_BOTTLES_CATALOG_SCALE_VERSION = "best-bottles-catalog-scale-v1" as const;

export const BEST_BOTTLES_GLOBAL_SCALE_KNOTS = [
  { capacityMl: 1, assembledHeightPct: 54 },
  { capacityMl: 3, assembledHeightPct: 56 },
  { capacityMl: 4, assembledHeightPct: 58 },
  { capacityMl: 5, assembledHeightPct: 61 },
  { capacityMl: 9, assembledHeightPct: 69 },
  { capacityMl: 28, assembledHeightPct: 74 },
  { capacityMl: 30, assembledHeightPct: 75 },
  { capacityMl: 50, assembledHeightPct: 78 },
  { capacityMl: 100, assembledHeightPct: 79 },
  { capacityMl: 118, assembledHeightPct: 80 },
  { capacityMl: 227, assembledHeightPct: 82 },
  { capacityMl: 454, assembledHeightPct: 84 },
] as const;

export const BEST_BOTTLES_MAX_FAMILY_SCALE_CORRECTION_PCT = 2 as const;

export function resolveBestBottlesGlobalScalePct(capacityMl: number): number {
  if (!Number.isFinite(capacityMl) || capacityMl <= 0) {
    throw new Error("A positive capacityMl is required.");
  }

  const first = BEST_BOTTLES_GLOBAL_SCALE_KNOTS[0];
  const last = BEST_BOTTLES_GLOBAL_SCALE_KNOTS[BEST_BOTTLES_GLOBAL_SCALE_KNOTS.length - 1];
  if (capacityMl <= first.capacityMl) return first.assembledHeightPct;
  if (capacityMl >= last.capacityMl) return last.assembledHeightPct;

  const upperIndex = BEST_BOTTLES_GLOBAL_SCALE_KNOTS.findIndex(
    (knot) => knot.capacityMl >= capacityMl,
  );
  const lower = BEST_BOTTLES_GLOBAL_SCALE_KNOTS[upperIndex - 1];
  const upper = BEST_BOTTLES_GLOBAL_SCALE_KNOTS[upperIndex];
  const progress = (capacityMl - lower.capacityMl) / (upper.capacityMl - lower.capacityMl);
  return lower.assembledHeightPct
    + progress * (upper.assembledHeightPct - lower.assembledHeightPct);
}

export function applyBestBottlesFamilyScaleCorrection(
  basePct: number,
  correctionPct: number,
): number {
  if (!Number.isFinite(basePct) || !Number.isFinite(correctionPct)) {
    throw new Error("Scale targets and family corrections must be finite numbers.");
  }
  if (Math.abs(correctionPct) > BEST_BOTTLES_MAX_FAMILY_SCALE_CORRECTION_PCT) {
    throw new Error("Family scale correction must remain within ±2 percentage points.");
  }
  return basePct + correctionPct;
}

export function deriveBestBottlesBodyTargetPx(input: {
  canvasHeightPx: number;
  assembledHeightPct: number;
  verifiedBodyHeightMm: number;
  verifiedAssembledHeightMm: number;
}): number {
  if (
    !Number.isFinite(input.canvasHeightPx)
    || !Number.isFinite(input.assembledHeightPct)
    || !Number.isFinite(input.verifiedBodyHeightMm)
    || !Number.isFinite(input.verifiedAssembledHeightMm)
    || input.canvasHeightPx <= 0
    || input.assembledHeightPct <= 0
    || input.verifiedBodyHeightMm <= 0
    || input.verifiedAssembledHeightMm <= 0
  ) {
    throw new Error("Verified positive canvas, target, body, and assembled heights are required.");
  }

  return Math.round(
    input.canvasHeightPx
      * (input.assembledHeightPct / 100)
      * (input.verifiedBodyHeightMm / input.verifiedAssembledHeightMm),
  );
}
