export type RegisteredFamilyLayerRole =
  | "body"
  | "exterior-component"
  | "body-contextual"
  | "detached-review"
  | "integration-reference";

export type RegisteredFamilyBounds = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type RegisteredFamilyLayerInput = {
  layerId: string;
  role: RegisteredFamilyLayerRole;
  sourceBoundsPx: RegisteredFamilyBounds;
  assemblyMember: boolean;
};

export type BuildRegisteredFamilyLayerPlanInput = {
  familyKey: string;
  canvas: { width: number; height: number };
  targetCenterX: number;
  targetBaselineY: number;
  targetAssembledHeightPct: number;
  layers: RegisteredFamilyLayerInput[];
};

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 1) throw new Error(`${label} must be a positive integer.`);
}

function assertBounds(bounds: RegisteredFamilyBounds, label: string): void {
  if (![bounds.left, bounds.top, bounds.width, bounds.height].every(Number.isInteger)
    || bounds.width < 1 || bounds.height < 1) {
    throw new Error(`${label} must contain integer coordinates and positive dimensions.`);
  }
}

function unionBounds(bounds: RegisteredFamilyBounds[]): RegisteredFamilyBounds {
  const left = Math.min(...bounds.map((value) => value.left));
  const top = Math.min(...bounds.map((value) => value.top));
  const right = Math.max(...bounds.map((value) => value.left + value.width));
  const bottom = Math.max(...bounds.map((value) => value.top + value.height));
  return { left, top, width: right - left, height: bottom - top };
}

export function buildRegisteredFamilyLayerPlan(input: BuildRegisteredFamilyLayerPlanInput) {
  if (!input.familyKey.trim()) throw new Error("familyKey is required.");
  assertPositiveInteger(input.canvas.width, "canvas.width");
  assertPositiveInteger(input.canvas.height, "canvas.height");
  if (!Number.isFinite(input.targetCenterX) || !Number.isFinite(input.targetBaselineY)) {
    throw new Error("Target centerline and baseline must be finite.");
  }
  if (!Number.isFinite(input.targetAssembledHeightPct)
    || input.targetAssembledHeightPct <= 0
    || input.targetAssembledHeightPct >= 100) {
    throw new Error("targetAssembledHeightPct must be between zero and 100.");
  }
  const layerIds = new Set<string>();
  for (const layer of input.layers) {
    if (!layer.layerId.trim() || layerIds.has(layer.layerId)) {
      throw new Error(`Layer IDs must be unique and non-empty: ${layer.layerId}`);
    }
    layerIds.add(layer.layerId);
    assertBounds(layer.sourceBoundsPx, `${layer.layerId}.sourceBoundsPx`);
  }
  const assemblyLayers = input.layers.filter((layer) => layer.assemblyMember);
  if (!assemblyLayers.some((layer) => layer.role === "body")) {
    throw new Error("A registered family assembly requires one body layer.");
  }
  if (!assemblyLayers.some((layer) => layer.role === "exterior-component")) {
    throw new Error("A registered family assembly requires one exterior component layer.");
  }
  const sourceAssemblyBoundsPx = unionBounds(assemblyLayers.map((layer) => layer.sourceBoundsPx));
  const targetHeight = Math.round(input.canvas.height * input.targetAssembledHeightPct / 100);
  const uniformScale = targetHeight / sourceAssemblyBoundsPx.height;
  const targetWidth = Math.max(1, Math.round(sourceAssemblyBoundsPx.width * uniformScale));
  const targetAssemblyBoundsPx = {
    left: Math.round(input.targetCenterX - targetWidth / 2),
    top: Math.round(input.targetBaselineY - targetHeight + 1),
    width: targetWidth,
    height: targetHeight,
  };
  if (targetAssemblyBoundsPx.left < 0 || targetAssemblyBoundsPx.top < 0
    || targetAssemblyBoundsPx.left + targetAssemblyBoundsPx.width > input.canvas.width
    || targetAssemblyBoundsPx.top + targetAssemblyBoundsPx.height > input.canvas.height) {
    throw new Error("Registered family target assembly does not fit the canonical canvas.");
  }
  const layers = input.layers.map((layer) => {
    if (!layer.assemblyMember) {
      return { ...layer, uniformScale: null, placementBoundsPx: null };
    }
    const placementBoundsPx = {
      left: targetAssemblyBoundsPx.left + Math.round((layer.sourceBoundsPx.left - sourceAssemblyBoundsPx.left) * uniformScale),
      top: targetAssemblyBoundsPx.top + Math.round((layer.sourceBoundsPx.top - sourceAssemblyBoundsPx.top) * uniformScale),
      width: Math.max(1, Math.round(layer.sourceBoundsPx.width * uniformScale)),
      height: Math.max(1, Math.round(layer.sourceBoundsPx.height * uniformScale)),
    };
    if (placementBoundsPx.left < 0 || placementBoundsPx.top < 0
      || placementBoundsPx.left + placementBoundsPx.width > input.canvas.width
      || placementBoundsPx.top + placementBoundsPx.height > input.canvas.height) {
      throw new Error(`Registered layer ${layer.layerId} does not fit the canonical canvas.`);
    }
    return { ...layer, uniformScale, placementBoundsPx };
  });
  return {
    schemaVersion: 1 as const,
    familyKey: input.familyKey,
    canvas: input.canvas,
    sourceAssemblyBoundsPx,
    targetAssemblyBoundsPx,
    targetAssembledHeightPct: input.targetAssembledHeightPct,
    targetCenterX: input.targetCenterX,
    targetBaselineY: input.targetBaselineY,
    uniformScale,
    transformScope: "complete-paper-doll-assembly" as const,
    layers,
    rule: "Apply this one transform to every assembly member. Detached review layers receive no placement until family-fit approval.",
  };
}
