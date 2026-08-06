export interface FamilyPlacementTransform {
  translateXPx: number;
  translateYPx: number;
  scaleX: number;
  scaleY: number;
}

export interface ReleaseBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface ContactPlacementMeasurement {
  sourceContactYPx: number;
  targetContactYPx: number;
  sourceCenterXPx: number;
  targetCenterXPx: number;
  sourceOuterWidthPx: number;
  targetOuterWidthPx: number;
}

export const CYL9_BODY_VARIANTS = ["AMB", "BLU", "CLR", "FRS", "SWL"] as const;

/**
 * Measured from the registered PLASTIC roller alpha and the shared neck geometry
 * of the five locked CYL-9ML plates. The omitted insertion plug is intentionally
 * outside the visible paper-doll layer.
 */
export const CYL9_ROLLER_CONTACT: ContactPlacementMeasurement = {
  sourceContactYPx: 918,
  targetContactYPx: 760,
  sourceCenterXPx: 1041,
  targetCenterXPx: 1041,
  sourceOuterWidthPx: 269,
  targetOuterWidthPx: 262,
};

/**
 * The roll-on overcap authority footprint on the locked canvas
 * (closure__17-415__rollon-overcap__v2): 344 px wide, center X 1041,
 * seat Y 1002. Imports are normalized into this footprint, so source and
 * target coincide and Family Fit opens at identity, recording fine nudges.
 */
export const CYL9_CAP_CONTACT: ContactPlacementMeasurement = {
  sourceContactYPx: 1002,
  targetContactYPx: 1002,
  sourceCenterXPx: 1041,
  targetCenterXPx: 1041,
  sourceOuterWidthPx: 344,
  targetOuterWidthPx: 344,
};

export const IDENTITY_FAMILY_PLACEMENT: FamilyPlacementTransform = {
  translateXPx: 0,
  translateYPx: 0,
  scaleX: 1,
  scaleY: 1,
};

function roundPlacementValue(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export interface PlacementLockTransform {
  translateXPx: number;
  translateYPx: number;
  uniformScale: number;
}

export function toPlacementLockTransform(transform: FamilyPlacementTransform): PlacementLockTransform {
  const issues = validateFamilyPlacement(transform);
  if (issues.length > 0) throw new Error(issues.join(" "));
  if (transform.scaleX <= 0) throw new Error("Family placement scale must be positive.");
  return {
    translateXPx: roundPlacementValue(transform.translateXPx),
    translateYPx: roundPlacementValue(transform.translateYPx),
    uniformScale: roundPlacementValue(transform.scaleX),
  };
}

export function fromSharedPlacementRecord(record: { transform: PlacementLockTransform }): FamilyPlacementTransform {
  return {
    translateXPx: roundPlacementValue(record.transform.translateXPx),
    translateYPx: roundPlacementValue(record.transform.translateYPx),
    scaleX: roundPlacementValue(record.transform.uniformScale),
    scaleY: roundPlacementValue(record.transform.uniformScale),
  };
}

export function placementTransformsEqual(
  draft: FamilyPlacementTransform,
  locked: PlacementLockTransform,
): boolean {
  try {
    const serialized = toPlacementLockTransform(draft);
    return serialized.translateXPx === roundPlacementValue(locked.translateXPx)
      && serialized.translateYPx === roundPlacementValue(locked.translateYPx)
      && serialized.uniformScale === roundPlacementValue(locked.uniformScale);
  } catch {
    return false;
  }
}

export function deriveContactPlacement(measurement: ContactPlacementMeasurement): FamilyPlacementTransform {
  const scale = roundPlacementValue(measurement.targetOuterWidthPx / measurement.sourceOuterWidthPx);
  return {
    translateXPx: roundPlacementValue(measurement.targetCenterXPx - measurement.sourceCenterXPx * scale),
    translateYPx: roundPlacementValue(measurement.targetContactYPx - measurement.sourceContactYPx * scale),
    scaleX: scale,
    scaleY: scale,
  };
}

export function resizePlacementAroundContact(
  transform: FamilyPlacementTransform,
  measurement: ContactPlacementMeasurement,
  requestedScale: number,
): FamilyPlacementTransform {
  const scale = roundPlacementValue(requestedScale);
  const currentCenterXPx = measurement.sourceCenterXPx * transform.scaleX + transform.translateXPx;
  const currentContactYPx = measurement.sourceContactYPx * transform.scaleY + transform.translateYPx;
  return {
    translateXPx: roundPlacementValue(currentCenterXPx - measurement.sourceCenterXPx * scale),
    translateYPx: roundPlacementValue(currentContactYPx - measurement.sourceContactYPx * scale),
    scaleX: scale,
    scaleY: scale,
  };
}

export function applyPlacementToBounds(
  bounds: ReleaseBounds,
  transform: FamilyPlacementTransform,
): ReleaseBounds {
  return {
    left: Math.round(bounds.left * transform.scaleX + transform.translateXPx),
    top: Math.round(bounds.top * transform.scaleY + transform.translateYPx),
    right: Math.round(bounds.right * transform.scaleX + transform.translateXPx),
    bottom: Math.round(bounds.bottom * transform.scaleY + transform.translateYPx),
  };
}

export function familyPlacementTargets(transform: FamilyPlacementTransform) {
  return CYL9_BODY_VARIANTS.map((bodyVariantKey) => ({ bodyVariantKey, transform: { ...transform } }));
}

export function validateFamilyPlacement(transform: FamilyPlacementTransform): string[] {
  const issues: string[] = [];
  if (Math.abs(transform.scaleX - transform.scaleY) > 0.000001) {
    issues.push("Family placement scale must remain uniform.");
  }
  if (![transform.translateXPx, transform.translateYPx, transform.scaleX, transform.scaleY].every(Number.isFinite)) {
    issues.push("Family placement values must be finite numbers.");
  }
  return issues;
}

export function nudgePlacement(
  transform: FamilyPlacementTransform,
  delta: { x: number; y: number },
): FamilyPlacementTransform {
  return {
    ...transform,
    translateXPx: transform.translateXPx + delta.x,
    translateYPx: transform.translateYPx + delta.y,
  };
}

export function placementObjectOrigin(
  bounds: ReleaseBounds,
  transform: FamilyPlacementTransform,
): { x: number; y: number } {
  return {
    x: bounds.left * transform.scaleX + transform.translateXPx,
    y: bounds.top * transform.scaleY + transform.translateYPx,
  };
}

export function placementTransformFromObject(input: {
  left: number;
  top: number;
  scale: number;
  bounds: ReleaseBounds;
}): FamilyPlacementTransform {
  return {
    translateXPx: Math.round(input.left - input.bounds.left * input.scale),
    translateYPx: Math.round(input.top - input.bounds.top * input.scale),
    scaleX: input.scale,
    scaleY: input.scale,
  };
}

export function initialFamilyFitState(input: {
  familyKey: string | null;
  assets: Array<{ componentVersionId: string; slot: string; variantKey: string }>;
}): {
  mode: "release-lock" | "family-fit";
  selectedBodyId: string | null;
  selectedLayerId: string | null;
  transform: FamilyPlacementTransform;
} {
  const body = input.assets.find((asset) => asset.slot === "body" && asset.variantKey === "AMB")
    ?? input.assets.find((asset) => asset.slot === "body")
    ?? null;
  const roller = input.assets.find((asset) => asset.slot === "roller") ?? null;
  if (input.familyKey === "CYL-9ML" && body && roller) {
    return {
      mode: "family-fit",
      selectedBodyId: body.componentVersionId,
      selectedLayerId: roller.componentVersionId,
      transform: deriveContactPlacement(CYL9_ROLLER_CONTACT),
    };
  }
  return {
    mode: "release-lock",
    selectedBodyId: body?.componentVersionId ?? null,
    selectedLayerId: body?.componentVersionId ?? null,
    transform: { ...IDENTITY_FAMILY_PLACEMENT },
  };
}
