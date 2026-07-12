import {
  BEST_BOTTLES_CATALOG_SCALE_VERSION,
  BEST_BOTTLES_MAX_FAMILY_SCALE_CORRECTION_PCT,
} from "../config/bestBottlesCatalogScale";

export type BestBottlesMeasurementStatus = "reconciled" | "missing" | "disputed";

export type BestBottlesCapStateEligibility =
  | "cap-on-confirmed"
  | "cap-off-confirmed"
  | "multi-component-confirmed"
  | "cap-off-unavailable"
  | "needs-psd-review";

export interface BestBottlesCalibrationRegistryRow {
  scaleContractVersion: typeof BEST_BOTTLES_CATALOG_SCALE_VERSION;
  registryKey: string;
  graceSku: string;
  websiteSku: string;
  productGroupId: string;
  family: string;
  capacityMl: number;
  bodyMaterial: string;
  shapeClass: string;
  heightWithCapMm: number;
  heightWithoutCapMm: number;
  diameterMm: number;
  measurementStatus: BestBottlesMeasurementStatus;
  measurementSources: string[];
  capOnReferenceId: string;
  capOffReferenceId: string | null;
  topologyReferenceId: string | null;
  capStateEligibility: BestBottlesCapStateEligibility;
  globalTargetPct: number;
  familyCorrectionPct: number;
  finalAssembledTargetPct: number;
  bodyTargetPx: number;
  promptVersion: "best-bottles-reference-locked-v6.1";
}

export function resolveBestBottlesCapStateEligibility(input: {
  capOnReferenceId: string | null;
  capOffReferenceId: string | null;
  topologyReferenceId: string | null;
  heightWithoutCap?: string | null;
  isMultiComponent: boolean;
}): BestBottlesCapStateEligibility {
  if (!input.capOnReferenceId?.trim()) return "needs-psd-review";
  if (input.isMultiComponent) {
    return input.topologyReferenceId?.trim()
      ? "multi-component-confirmed"
      : "needs-psd-review";
  }
  if (input.capOffReferenceId?.trim()) return "cap-off-confirmed";
  return "cap-off-unavailable";
}

export function validateBestBottlesCalibrationRow<T extends BestBottlesCalibrationRegistryRow>(
  row: T,
): T {
  if (row.measurementStatus !== "reconciled") {
    throw new Error(`Calibration row ${row.registryKey} requires reconciled measurements.`);
  }
  if (
    !Number.isFinite(row.capacityMl)
    || !Number.isFinite(row.heightWithCapMm)
    || !Number.isFinite(row.heightWithoutCapMm)
    || !Number.isFinite(row.diameterMm)
    || row.capacityMl <= 0
    || row.heightWithCapMm <= 0
    || row.heightWithoutCapMm <= 0
    || row.diameterMm <= 0
  ) {
    throw new Error(`Calibration row ${row.registryKey} requires positive measurements.`);
  }
  if (row.heightWithoutCapMm > row.heightWithCapMm) {
    throw new Error(`Calibration row ${row.registryKey} has body height above assembled height.`);
  }
  if (Math.abs(row.familyCorrectionPct) > BEST_BOTTLES_MAX_FAMILY_SCALE_CORRECTION_PCT) {
    throw new Error(`Calibration row ${row.registryKey} exceeds the ±2 family correction rail.`);
  }
  if (!row.capOnReferenceId.trim()) {
    throw new Error(`Calibration row ${row.registryKey} requires an approved cap-on PSD reference.`);
  }
  if (row.scaleContractVersion !== BEST_BOTTLES_CATALOG_SCALE_VERSION) {
    throw new Error(`Calibration row ${row.registryKey} has stale scale-contract lineage.`);
  }
  if (row.promptVersion !== "best-bottles-reference-locked-v6.1") {
    throw new Error(`Calibration row ${row.registryKey} requires v6.1 prompt lineage.`);
  }
  return row;
}
