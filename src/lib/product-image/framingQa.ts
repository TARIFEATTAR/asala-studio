import type { FamilyRigConfig, RigCapState } from "./familyRig";

export type FramingQaStatus = "pass" | "warn" | "fail";
export type FramingDecision = "pass" | "normalize" | "reject";

export interface FramingQaBounds {
  top: number;
  bottom: number;
  left?: number;
  right?: number;
}

export interface FramingQaReport {
  status: FramingQaStatus;
  failures: string[];
  warnings: string[];
  measurements: {
    fillHeightPct: number | null;
    baselineYPx: number | null;
    targetBaselineYPx: number;
    baselineDeltaPx: number | null;
    centerXPct: number | null;
    targetCenterXPct: number;
    centerDeltaPct: number | null;
  };
  target: {
    family: string;
    profileId: string | null;
    relativeScaleZoneId: string | null;
    fillHeightPct: number;
    fillHeightRangePct: { min: number; max: number };
    baselinePct: number;
    primaryObjectCenterXPct: number;
  };
}

export interface BuildFramingQaReportInput {
  width: number;
  height: number;
  rig: FamilyRigConfig;
  bounds: FramingQaBounds | null;
  primaryBounds?: FramingQaBounds | null;
  baselineYPx: number | null;
  capState?: RigCapState;
  fillHeightTolerancePct?: number;
  baselineTolerancePx?: number;
  baselineWarnTolerancePx?: number;
  centerTolerancePct?: number;
}

function roundToTenth(value: number): number {
  return Number(value.toFixed(1));
}

function getFillHeightRange(rig: FamilyRigConfig): { min: number; max: number } {
  return rig.fillHeightRangePct ?? {
    min: rig.fillHeightPct - 2,
    max: rig.fillHeightPct + 2,
  };
}

function getBoundsCenterXPct(bounds: FramingQaBounds | null, width: number): number | null {
  if (!bounds || typeof bounds.left !== "number" || typeof bounds.right !== "number") {
    return null;
  }
  return roundToTenth((((bounds.left + bounds.right) / 2) / width) * 100);
}

export function buildFramingQaReport(input: BuildFramingQaReportInput): FramingQaReport {
  const failures: string[] = [];
  const warnings: string[] = [];
  const fillHeightTolerancePct = input.fillHeightTolerancePct ?? 0.5;
  const baselineTolerancePx = input.baselineTolerancePx ?? 8;
  const baselineWarnTolerancePx = input.baselineWarnTolerancePx ?? 4;
  const centerTolerancePct = input.centerTolerancePct ?? 2.5;
  const targetRange = getFillHeightRange(input.rig);
  const targetCenterXPct = input.rig.primaryObjectCenterXPct ?? 50;
  const targetBaselineYPx = Math.round(input.height * (1 - input.rig.baselinePct / 100));

  const fillHeightPct = input.bounds
    ? roundToTenth(((input.bounds.bottom - input.bounds.top + 1) / input.height) * 100)
    : null;
  const baselineDeltaPx =
    typeof input.baselineYPx === "number"
      ? input.baselineYPx - targetBaselineYPx
      : null;

  const centerBounds =
    input.capState === "detached"
      ? input.primaryBounds ?? null
      : input.primaryBounds ?? input.bounds;
  const centerXPct = getBoundsCenterXPct(centerBounds, input.width);
  const centerDeltaPct =
    centerXPct == null ? null : roundToTenth(centerXPct - targetCenterXPct);

  if (!input.bounds) {
    failures.push("Product foreground bounds were not detectable for framing QA.");
  }

  if (fillHeightPct != null) {
    if (fillHeightPct < targetRange.min - fillHeightTolerancePct) {
      failures.push(
        `Product fill height ${fillHeightPct}% is below target range ${targetRange.min}-${targetRange.max}%.`,
      );
    } else if (fillHeightPct > targetRange.max + fillHeightTolerancePct) {
      failures.push(
        `Product fill height ${fillHeightPct}% is above target range ${targetRange.min}-${targetRange.max}%.`,
      );
    } else if (fillHeightPct < targetRange.min || fillHeightPct > targetRange.max) {
      warnings.push(
        `Product fill height ${fillHeightPct}% is outside target range ${targetRange.min}-${targetRange.max}% but within tolerance.`,
      );
    }
  }

  if (baselineDeltaPx == null) {
    failures.push("Product baseline was not detectable for framing QA.");
  } else if (Math.abs(baselineDeltaPx) > baselineTolerancePx) {
    failures.push(
      `Product baseline is ${baselineDeltaPx}px from target ${targetBaselineYPx}px.`,
    );
  } else if (Math.abs(baselineDeltaPx) > baselineWarnTolerancePx) {
    warnings.push(
      `Product baseline is ${baselineDeltaPx}px from target ${targetBaselineYPx}px.`,
    );
  }

  if (input.capState === "detached" && !input.primaryBounds) {
    warnings.push("Primary bottle bounds unavailable for detached-cap centerline QA.");
  } else if (centerDeltaPct == null) {
    failures.push("Product centerline was not detectable for framing QA.");
  } else if (Math.abs(centerDeltaPct) > centerTolerancePct) {
    failures.push(
      `Product centerline is ${centerDeltaPct}% from target ${targetCenterXPct}%.`,
    );
  }

  return {
    status: failures.length > 0 ? "fail" : warnings.length > 0 ? "warn" : "pass",
    failures,
    warnings,
    measurements: {
      fillHeightPct,
      baselineYPx: input.baselineYPx,
      targetBaselineYPx,
      baselineDeltaPx,
      centerXPct,
      targetCenterXPct,
      centerDeltaPct,
    },
    target: {
      family: input.rig.family,
      profileId: input.rig.profileId ?? null,
      relativeScaleZoneId: input.rig.relativeScaleZoneId ?? null,
      fillHeightPct: input.rig.fillHeightPct,
      fillHeightRangePct: targetRange,
      baselinePct: input.rig.baselinePct,
      primaryObjectCenterXPct: targetCenterXPct,
    },
  };
}

export function getFramingDecision(report: FramingQaReport): FramingDecision {
  const fillHeightPct = report.measurements.fillHeightPct;
  const targetRange = report.target.fillHeightRangePct;

  if (fillHeightPct == null) return "reject";
  if (fillHeightPct < targetRange.min - 12 || fillHeightPct > targetRange.max + 12) {
    return "reject";
  }
  if (report.status === "pass") return "pass";
  return "normalize";
}
