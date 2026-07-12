export const CYLINDER_DISPLAY_CURVE_VERSION = "cylinder-measured-display-v1" as const;

export interface CylinderDisplayScaleInput {
  canvasHeightPx: number;
  heightWithCapMm: number;
  heightWithoutCapMm: number;
  diameterMm: number;
}

export interface CylinderDisplayScale {
  version: typeof CYLINDER_DISPLAY_CURVE_VERSION;
  assembledTargetPct: number;
  assembledTargetPx: number;
  bodyTargetPx: number;
  expectedWidthPx: number;
}

const HEIGHT_KNOTS = [
  { heightMm: 35, targetPct: 52 },
  { heightMm: 47, targetPct: 55 },
  { heightMm: 54, targetPct: 57.5 },
  { heightMm: 55, targetPct: 58 },
  { heightMm: 75, targetPct: 71 },
  { heightMm: 100, targetPct: 76 },
  { heightMm: 128, targetPct: 79 },
  { heightMm: 159, targetPct: 84 },
  { heightMm: 180, targetPct: 88 },
  { heightMm: 186, targetPct: 90 },
  { heightMm: 250, targetPct: 92 },
] as const;

function targetPct(heightMm: number): number {
  if (heightMm <= HEIGHT_KNOTS[0].heightMm) return HEIGHT_KNOTS[0].targetPct;
  for (let index = 1; index < HEIGHT_KNOTS.length; index += 1) {
    const upper = HEIGHT_KNOTS[index];
    if (heightMm <= upper.heightMm) {
      const lower = HEIGHT_KNOTS[index - 1];
      const progress = (heightMm - lower.heightMm) / (upper.heightMm - lower.heightMm);
      return lower.targetPct + progress * (upper.targetPct - lower.targetPct);
    }
  }
  return HEIGHT_KNOTS.at(-1)!.targetPct;
}

export function resolveCylinderDisplayScale(input: CylinderDisplayScaleInput): CylinderDisplayScale {
  if (![input.canvasHeightPx, input.heightWithCapMm, input.heightWithoutCapMm, input.diameterMm]
    .every((value) => Number.isFinite(value) && value > 0)) {
    throw new Error("Cylinder display scale requires positive reconciled measurements.");
  }
  if (input.heightWithoutCapMm > input.heightWithCapMm) {
    throw new Error("Cylinder body height cannot exceed assembled height.");
  }
  const assembledTargetPct = targetPct(input.heightWithCapMm);
  const assembledTargetPx = input.canvasHeightPx * assembledTargetPct / 100;
  const pixelsPerMm = assembledTargetPx / input.heightWithCapMm;
  return {
    version: CYLINDER_DISPLAY_CURVE_VERSION,
    assembledTargetPct,
    assembledTargetPx,
    bodyTargetPx: pixelsPerMm * input.heightWithoutCapMm,
    expectedWidthPx: pixelsPerMm * input.diameterMm,
  };
}

export function assertMonotonicCylinderBodies(rows: Array<{
  key: string; heightWithoutCapMm: number; bodyTargetPx: number;
}>): void {
  const ordered = [...rows].sort((a, b) => a.heightWithoutCapMm - b.heightWithoutCapMm);
  for (let index = 1; index < ordered.length; index += 1) {
    if (ordered[index].bodyTargetPx < ordered[index - 1].bodyTargetPx) {
      throw new Error(`Cylinder body target reversal: ${ordered[index - 1].key} -> ${ordered[index].key}`);
    }
  }
}
