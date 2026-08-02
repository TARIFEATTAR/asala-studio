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
  /** Bottle-only pixel envelope used for scale, baseline, centerline, and crop QA. */
  primaryBounds?: FramingQaBounds | null;
  measurements: {
    fillHeightPct: number | null;
    baselineYPx: number | null;
    targetBaselineYPx: number;
    baselineDeltaPx: number | null;
    centerXPct: number | null;
    targetCenterXPct: number;
    centerDeltaPct: number | null;
    primaryAspectRatio: number | null;
    expectedPrimaryAspectRatio: number | null;
    aspectRatioDriftPct: number | null;
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
  /**
   * Truth height-to-width ratio for the primary bottle (canonical mm for
   * assembled cap-on; byte-locked reference measurement for detached sidecar).
   * The model can satisfy the fill-height target by stretching taller/thinner —
   * uniform rig scaling cannot catch that, so this is the only proportion gate.
   */
  expectedPrimaryAspectRatio?: number | null;
  aspectRatioWarnTolerancePct?: number;
  aspectRatioFailTolerancePct?: number;
  /**
   * Bottle-only bounds used solely for the aspect measurement. Detached-sidecar
   * primaryBounds can merge bottle+cap, which poisons the ratio; callers pass
   * tallest-component bounds here without disturbing the other QA metrics.
   */
  aspectBounds?: FramingQaBounds | null;
}

function roundToTenth(value: number): number {
  return Number(value.toFixed(1));
}

function getFillHeightTarget(input: BuildFramingQaReportInput): {
  fillHeightPct: number;
  range: { min: number; max: number };
} {
  const assembledRange = input.rig.fillHeightRangePct ?? {
    min: input.rig.fillHeightPct - 2,
    max: input.rig.fillHeightPct + 2,
  };
  // `bounds` and `primaryBounds` are both full visible product envelopes. In a
  // detached-sidecar image the primary envelope still includes the seated
  // sprayer/roller/pump; it is not a segmented glass-body mask. Never compare
  // that envelope to `targetBodyHeightPx` or a correctly framed product will be
  // shrunk until its actual bottle body is undersized.
  return { fillHeightPct: input.rig.fillHeightPct, range: assembledRange };
}

function getBoundsCenterXPct(bounds: FramingQaBounds | null, width: number): number | null {
  if (!bounds || typeof bounds.left !== "number" || typeof bounds.right !== "number") {
    return null;
  }
  return roundToTenth((((bounds.left + bounds.right) / 2) / width) * 100);
}

function isBoundsInsideCanvas(
  bounds: FramingQaBounds,
  width: number,
  height: number,
): boolean {
  return (
    bounds.top >= 0 &&
    bounds.bottom <= height - 1 &&
    typeof bounds.left === "number" &&
    bounds.left >= 0 &&
    typeof bounds.right === "number" &&
    bounds.right <= width - 1
  );
}

export function buildFramingQaReport(input: BuildFramingQaReportInput): FramingQaReport {
  const failures: string[] = [];
  const warnings: string[] = [];
  const fillHeightTolerancePct = input.fillHeightTolerancePct ?? 0.5;
  const baselineTolerancePx = input.baselineTolerancePx ?? 8;
  const baselineWarnTolerancePx = input.baselineWarnTolerancePx ?? 4;
  const centerTolerancePct = input.centerTolerancePct ?? 2.5;
  const fillHeightTarget = getFillHeightTarget(input);
  const targetRange = fillHeightTarget.range;
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

  const bottleBounds = input.primaryBounds ?? input.bounds;
  if (bottleBounds && !isBoundsInsideCanvas(bottleBounds, input.width, input.height)) {
    failures.push("Primary bottle crosses the output canvas bounds.");
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

  const expectedAspect =
    typeof input.expectedPrimaryAspectRatio === "number" &&
    Number.isFinite(input.expectedPrimaryAspectRatio) &&
    input.expectedPrimaryAspectRatio > 0
      ? input.expectedPrimaryAspectRatio
      : null;
  const aspectSourceBounds = input.aspectBounds ?? bottleBounds;
  const primaryAspectRatio =
    aspectSourceBounds &&
    typeof aspectSourceBounds.left === "number" &&
    typeof aspectSourceBounds.right === "number" &&
    aspectSourceBounds.right > aspectSourceBounds.left &&
    aspectSourceBounds.bottom > aspectSourceBounds.top
      ? roundToTenth(
          ((aspectSourceBounds.bottom - aspectSourceBounds.top + 1) /
            (aspectSourceBounds.right - aspectSourceBounds.left + 1)) * 10,
        ) / 10
      : null;
  const aspectRatioDriftPct =
    expectedAspect != null && primaryAspectRatio != null
      ? roundToTenth(((primaryAspectRatio - expectedAspect) / expectedAspect) * 100)
      : null;
  const aspectWarnPct = input.aspectRatioWarnTolerancePct ?? 4;
  const aspectFailPct = input.aspectRatioFailTolerancePct ?? 6;
  if (aspectRatioDriftPct != null) {
    const direction = aspectRatioDriftPct > 0 ? "taller/thinner" : "shorter/wider";
    if (Math.abs(aspectRatioDriftPct) > aspectFailPct) {
      failures.push(
        `Primary bottle aspect ratio ${primaryAspectRatio} drifts ${aspectRatioDriftPct}% ${direction} than truth ${roundToTenth(expectedAspect * 10) / 10} (tolerance ${aspectFailPct}%).`,
      );
    } else if (Math.abs(aspectRatioDriftPct) > aspectWarnPct) {
      warnings.push(
        `Primary bottle aspect ratio ${primaryAspectRatio} drifts ${aspectRatioDriftPct}% ${direction} than truth ${roundToTenth(expectedAspect * 10) / 10}.`,
      );
    }
  }

  return {
    status: failures.length > 0 ? "fail" : warnings.length > 0 ? "warn" : "pass",
    failures,
    warnings,
    primaryBounds: bottleBounds,
    measurements: {
      fillHeightPct,
      baselineYPx: input.baselineYPx,
      targetBaselineYPx,
      baselineDeltaPx,
      centerXPct,
      targetCenterXPct,
      centerDeltaPct,
      primaryAspectRatio,
      expectedPrimaryAspectRatio: expectedAspect,
      aspectRatioDriftPct,
    },
    target: {
      family: input.rig.family,
      profileId: input.rig.profileId ?? null,
      relativeScaleZoneId: input.rig.relativeScaleZoneId ?? null,
      fillHeightPct: fillHeightTarget.fillHeightPct,
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
