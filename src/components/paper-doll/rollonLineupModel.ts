export const ROLLON_LINEUP_BODY_VARIANTS = ["CLR", "AMB", "BLU", "FRS", "SWL"] as const;

export interface RollonLineupAsset {
  componentVersionId: string;
  displayName: string;
  slot: "body" | "roller" | "overcap";
  variantKey: string;
  imageUrl: string;
}

export interface RollonLineupItem {
  bodyVariantKey: typeof ROLLON_LINEUP_BODY_VARIANTS[number];
  canvas: { widthPx: 2080; heightPx: 2288; mountAxisXPx: 1041; seatYPx: 1002 };
  layers: {
    body: RollonLineupAsset | null;
    roller: RollonLineupAsset | null;
    overcap: RollonLineupAsset | null;
  };
  status: "complete" | "blocked";
  issues: string[];
}

export function buildRollonLineup(
  assets: RollonLineupAsset[],
  selection: { rollerVariantKey: string; overcapVariantKey: string },
): RollonLineupItem[] {
  const roller = assets.find((asset) => asset.slot === "roller" && asset.variantKey === selection.rollerVariantKey) ?? null;
  const overcap = assets.find((asset) => asset.slot === "overcap" && asset.variantKey === selection.overcapVariantKey) ?? null;
  return ROLLON_LINEUP_BODY_VARIANTS.map((bodyVariantKey) => {
    const body = assets.find((asset) => asset.slot === "body" && asset.variantKey === bodyVariantKey) ?? null;
    const issues = [
      ...(body ? [] : [`Missing exact body ${bodyVariantKey}`]),
      ...(roller ? [] : [`Missing exact roller ${selection.rollerVariantKey}`]),
      ...(overcap ? [] : [`Missing exact overcap ${selection.overcapVariantKey}`]),
    ];
    return {
      bodyVariantKey,
      canvas: { widthPx: 2080, heightPx: 2288, mountAxisXPx: 1041, seatYPx: 1002 },
      layers: { body, roller, overcap },
      status: issues.length === 0 ? "complete" : "blocked",
      issues,
    };
  });
}
