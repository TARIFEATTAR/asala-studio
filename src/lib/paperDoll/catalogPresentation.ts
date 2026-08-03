import {
  BEST_BOTTLES_CATALOG_SCALE_VERSION,
  resolveBestBottlesGlobalScalePct,
} from "../../config/bestBottlesCatalogScale";

export type PaperDollBounds = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type PaperDollCatalogPresentationInput = {
  capacityMl: number;
  canvas: { widthPx: number; heightPx: number };
  sourceAssemblyBoundsPx: PaperDollBounds;
  targetCenterXPx: number;
  targetBaselineYPx: number;
  targetAssembledHeightPct?: number;
  targetSource?: string;
};

function positiveFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${label} must be positive.`);
}

function validateBounds(bounds: PaperDollBounds, canvas: { widthPx: number; heightPx: number }): void {
  for (const [label, value] of Object.entries(bounds)) {
    if (!Number.isInteger(value)) throw new Error(`sourceAssemblyBoundsPx.${label} must be an integer.`);
  }
  if (bounds.left < 0 || bounds.top < 0 || bounds.width <= 0 || bounds.height <= 0
    || bounds.left + bounds.width > canvas.widthPx
    || bounds.top + bounds.height > canvas.heightPx) {
    throw new Error("sourceAssemblyBoundsPx must fit inside the canonical canvas.");
  }
}

export function resolvePaperDollCatalogPresentation(input: PaperDollCatalogPresentationInput) {
  positiveFinite(input.capacityMl, "capacityMl");
  positiveFinite(input.canvas.widthPx, "canvas.widthPx");
  positiveFinite(input.canvas.heightPx, "canvas.heightPx");
  validateBounds(input.sourceAssemblyBoundsPx, input.canvas);
  if (!Number.isFinite(input.targetCenterXPx) || !Number.isFinite(input.targetBaselineYPx)) {
    throw new Error("Presentation centerline and baseline must be finite.");
  }
  const targetAssembledHeightPct = input.targetAssembledHeightPct
    ?? resolveBestBottlesGlobalScalePct(input.capacityMl);
  if (!Number.isFinite(targetAssembledHeightPct)
    || targetAssembledHeightPct <= 0
    || targetAssembledHeightPct >= 100) {
    throw new Error("targetAssembledHeightPct must be between zero and 100.");
  }
  const targetAssembledHeightPx = Math.round(input.canvas.heightPx * targetAssembledHeightPct / 100);
  const uniformScale = targetAssembledHeightPx / input.sourceAssemblyBoundsPx.height;
  const targetWidth = Math.max(1, Math.round(input.sourceAssemblyBoundsPx.width * uniformScale));
  const targetAssemblyBoundsPx = {
    left: Math.round(input.targetCenterXPx - targetWidth / 2),
    top: Math.round(input.targetBaselineYPx - targetAssembledHeightPx + 1),
    width: targetWidth,
    height: targetAssembledHeightPx,
  };
  if (targetAssemblyBoundsPx.left < 0 || targetAssemblyBoundsPx.top < 0
    || targetAssemblyBoundsPx.left + targetAssemblyBoundsPx.width > input.canvas.widthPx
    || targetAssemblyBoundsPx.top + targetAssemblyBoundsPx.height > input.canvas.heightPx) {
    throw new Error("Resolved catalog presentation does not fit inside the canonical canvas.");
  }
  return {
    scaleContractVersion: BEST_BOTTLES_CATALOG_SCALE_VERSION,
    transformScope: "complete-paper-doll-assembly" as const,
    capacityMl: input.capacityMl,
    targetSource: input.targetSource ?? "global-capacity-curve",
    targetAssembledHeightPct,
    targetAssembledHeightPx,
    uniformScale,
    sourceAssemblyBoundsPx: input.sourceAssemblyBoundsPx,
    targetAssemblyBoundsPx,
    targetCenterXPx: input.targetCenterXPx,
    targetBaselineYPx: input.targetBaselineYPx,
    rule: "Apply one uniform transform to the complete assembled product. Never rescale body, closure, fitment, tube, shadow, or integration pixels independently.",
  };
}
