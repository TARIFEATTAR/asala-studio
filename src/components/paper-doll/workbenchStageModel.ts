export type WorkbenchStage = "approve-pixels" | "family-fit" | "placement-locked";

interface ApprovedGeometry {
  authorityMaskSha256: string;
}

interface PlacementGeometry {
  authorityMaskSha256: string;
}

export function placementMatchesApprovedGeometry(input: {
  approved: ApprovedGeometry | null;
  placement: PlacementGeometry | null;
}): boolean {
  return Boolean(input.approved && input.placement
    && input.approved.authorityMaskSha256 === input.placement.authorityMaskSha256);
}

export function canEnterFamilyFit(input: { approved: ApprovedGeometry | null }): boolean {
  return Boolean(input.approved);
}

export function resolveWorkbenchStage(input: {
  approved: ApprovedGeometry | null;
  placement: PlacementGeometry | null;
}): WorkbenchStage {
  if (!input.approved) return "approve-pixels";
  return placementMatchesApprovedGeometry(input) ? "placement-locked" : "family-fit";
}
