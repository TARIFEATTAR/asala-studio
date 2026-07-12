export type BestBottlesImageAssetRole =
  | "pdp-primary"
  | "pdp-secondary"
  | "marketing"
  | "scene";

export function getBestBottlesImageAssetRoleForPreset(
  presetId: string,
): BestBottlesImageAssetRole {
  if (presetId === "master-scene-flexible-2000x2200") return "scene";
  if (presetId === "master-marketing-2080x2288") return "marketing";
  if (
    presetId === "master-angle-2080x2288" ||
    presetId === "grid-card-exploded-2000x2200"
  ) {
    return "pdp-secondary";
  }
  return "pdp-primary";
}

export function requiresBestBottlesPipelineReconciliation(
  assetRole: BestBottlesImageAssetRole,
): boolean {
  return assetRole === "pdp-primary";
}

export interface BestBottlesCatalogTruthSnapshot {
  name: string | null;
  graceSku: string | null;
  websiteSku: string | null;
  family: string | null;
  category: string | null;
  capacityMl: number | null;
  heightWithoutCap: string | null;
  heightWithCap: string | null;
  diameter: string | null;
  neckThreadSize: string | null;
  applicator: string | null;
  capState: string | null;
  capColor: string | null;
  trimColor: string | null;
  bodyMaterial: string | null;
  color: string | null;
  identityStatus: string | null;
  identityBlockers: string[];
  identityHash: string | null;
  sourceReferenceUrl: string | null;
  sourcePageUrl: string | null;
  measurementSource: string | null;
  measurementSourceUrl: string | null;
  measurementSourceNote: string | null;
  websiteTruthStatus: string | null;
  websiteTruthIssues: string[];
}
