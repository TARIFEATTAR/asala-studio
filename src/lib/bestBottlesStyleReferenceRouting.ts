import { isCylinderFamilyAlias } from "@/lib/product-image/familyRig";

export interface BestBottlesStyleReferenceRoutingInput {
  explicitStyleReferenceUrl?: string | null;
  fallbackCylinderStyleReferenceUrl?: string | null;
  isBestBottlesStudioMasterRequest: boolean;
  family?: string | null;
}

/**
 * Explicit caller-selected style references preserve the existing general
 * generator path. The automatic Madison glass/metal calibration fallback is
 * Cylinder-only and must never be silently attached to another family.
 */
export function resolveBestBottlesStyleReferenceUrl(
  input: BestBottlesStyleReferenceRoutingInput,
): string {
  const explicit = input.explicitStyleReferenceUrl?.trim() ?? "";
  if (explicit) return explicit;
  if (
    input.isBestBottlesStudioMasterRequest
    && isCylinderFamilyAlias(input.family)
  ) {
    return input.fallbackCylinderStyleReferenceUrl?.trim() ?? "";
  }
  return "";
}
