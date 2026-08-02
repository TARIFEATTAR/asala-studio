import {
  toPlacementLockTransform,
  type FamilyPlacementTransform,
} from "./familyPlacementModel";

interface ApprovedGeometryIdentity {
  authorityMaskSha256: string;
}

interface CompatibleBodyIdentity {
  componentVersionId: string;
}

export interface SharedPlacementEligibilityInput {
  approved: ApprovedGeometryIdentity | null;
  expectedAuthorityMaskSha256: string | null;
  bodyPlates: CompatibleBodyIdentity[];
  transform: FamilyPlacementTransform;
  approverDisplayName: string;
  approvalNote: string;
}

export function sharedPlacementLockEligible(input: SharedPlacementEligibilityInput): boolean {
  if (!input.approved || input.approved.authorityMaskSha256 !== input.expectedAuthorityMaskSha256) return false;
  if (input.bodyPlates.length !== 5 || new Set(input.bodyPlates.map((body) => body.componentVersionId)).size !== 5) return false;
  if (!input.approverDisplayName.trim() || !input.approvalNote.trim()) return false;
  try {
    toPlacementLockTransform(input.transform);
    return true;
  } catch {
    return false;
  }
}
