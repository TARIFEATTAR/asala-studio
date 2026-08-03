import type {
  ComponentCandidate,
  FamilyComponentDefinition,
  PaperDollFamilyProductionManifest,
} from "./componentPlateContract";
import type {
  PaperDollReleaseAsset,
  PaperDollSlot,
} from "./releaseContract";

export type ComponentWorkbenchTone =
  | "missing"
  | "candidate"
  | "qa-passed"
  | "approved"
  | "in-release"
  | "blocked"
  | "rejected"
  | "published";

export interface ComponentStatusInput {
  authorityStatus: FamilyComponentDefinition["authorityStatus"];
  lifecycleState: ComponentCandidate["lifecycleState"] | null;
  currentCandidateFailed: boolean;
  quarantinedAncestor: boolean;
}

export interface ComponentWorkbenchStatus {
  tone: ComponentWorkbenchTone;
  label: string;
  blockers: string[];
  ancestorNotice: string | null;
}

export interface PersistedCandidateSummary extends ComponentCandidate {
  componentId?: string;
  componentVersionId?: string;
  componentVersionApprovalStatus?: string;
  normalizedPath?: string;
  layerPath?: string;
  normalizedUrl?: string;
  layerUrl?: string;
  createdAt?: string;
  currentCandidateFailed?: boolean;
  quarantinedAncestor?: boolean;
}

export interface SanitySyncSummary {
  action: "draft" | "public";
  status: "queued" | "success" | "failed";
  candidateIds?: string[];
  revision?: string | null;
}

export interface ComponentWorkbenchRow {
  componentKey: string;
  variantKey: string;
  slot: PaperDollSlot;
  materialVariant: string;
  materialClass: FamilyComponentDefinition["variants"][number]["materialClass"];
  geometryFamilyId: string;
  source: FamilyComponentDefinition["source"];
  authorityStatus: FamilyComponentDefinition["authorityStatus"];
  authority: FamilyComponentDefinition["authority"];
  compatibleBodyVariantKeys: string[];
  candidate: PersistedCandidateSummary | null;
  pixelApproved: boolean;
  familyFitApproved: boolean;
  placementLocked: boolean;
  inCurrentRelease: boolean;
  sanityDrafted: boolean;
  publiclyPublished: boolean;
  status: ComponentWorkbenchStatus;
  nextAction: string;
}

const LIFECYCLE_RANK: Record<ComponentCandidate["lifecycleState"], number> = {
  candidate: 0,
  "pixels-approved": 1,
  "family-fit-approved": 2,
  "placement-locked": 3,
  released: 4,
  "sanity-draft": 5,
  published: 6,
  rejected: -1,
};

export function buildComponentStatus(
  input: ComponentStatusInput,
): ComponentWorkbenchStatus {
  const ancestorNotice = input.quarantinedAncestor
    ? "Old release ancestor quarantined"
    : null;
  if (input.authorityStatus === "missing") {
    return {
      tone: "blocked",
      label: "Authority missing",
      blockers: ["Register and approve an exact geometry authority."],
      ancestorNotice,
    };
  }
  if (input.authorityStatus === "revoked") {
    return {
      tone: "blocked",
      label: "Authority revoked",
      blockers: ["Replace the revoked authority before geometry lock."],
      ancestorNotice,
    };
  }
  if (input.authorityStatus === "calibrating") {
    return {
      tone: "candidate",
      label: "Authority calibrating",
      blockers: ["Finish measured authority calibration."],
      ancestorNotice,
    };
  }
  if (input.currentCandidateFailed) {
    return {
      tone: "blocked",
      label: "Current candidate failed",
      blockers: ["Resolve the current candidate failure or select a clean candidate."],
      ancestorNotice,
    };
  }
  switch (input.lifecycleState) {
    case null:
      return { tone: "missing", label: "Candidate missing", blockers: [], ancestorNotice };
    case "candidate":
      return { tone: "candidate", label: "Candidate ready", blockers: [], ancestorNotice };
    case "pixels-approved":
      return { tone: "qa-passed", label: "Pixels approved", blockers: [], ancestorNotice };
    case "family-fit-approved":
      return { tone: "approved", label: "Family fit approved", blockers: [], ancestorNotice };
    case "placement-locked":
      return { tone: "approved", label: "Placement locked", blockers: [], ancestorNotice };
    case "released":
      return { tone: "in-release", label: "In Current Release", blockers: [], ancestorNotice };
    case "sanity-draft":
      return { tone: "in-release", label: "Sanity draft synced", blockers: [], ancestorNotice };
    case "published":
      return { tone: "published", label: "Publicly published", blockers: [], ancestorNotice };
    case "rejected":
      return { tone: "rejected", label: "Candidate rejected", blockers: [], ancestorNotice };
  }
}

function nextActionFor(
  component: FamilyComponentDefinition,
  candidate: PersistedCandidateSummary | null,
): string {
  if (component.authorityStatus === "missing" || component.authorityStatus === "revoked") {
    return "Register geometry authority";
  }
  if (!candidate || candidate.lifecycleState === "rejected") return "Generate or upload candidate";
  switch (candidate.lifecycleState) {
    case "candidate":
      return "Approve Pixels";
    case "pixels-approved":
      return "Approve Family Fit";
    case "family-fit-approved":
      return "Lock Shared Placement";
    case "placement-locked":
      return "Add to Release Cut";
    case "released":
      return "Sync Draft";
    case "sanity-draft":
      return "Publish Publicly";
    case "published":
      return "Complete";
    case "rejected":
      return "Generate or upload candidate";
  }
}

function latestCandidate(
  candidates: readonly PersistedCandidateSummary[],
  componentKey: string,
  variantKey: string,
): PersistedCandidateSummary | null {
  return candidates
    .filter((candidate) => candidate.componentKey === componentKey && candidate.variantKey === variantKey)
    .sort((left, right) => {
      const created = String(right.createdAt ?? "").localeCompare(String(left.createdAt ?? ""));
      if (created !== 0) return created;
      const state = LIFECYCLE_RANK[right.lifecycleState] - LIFECYCLE_RANK[left.lifecycleState];
      if (state !== 0) return state;
      return right.candidateId.localeCompare(left.candidateId);
    })[0] ?? null;
}

function lifecycleAtLeast(
  candidate: PersistedCandidateSummary | null,
  state: ComponentCandidate["lifecycleState"],
): boolean {
  return Boolean(candidate && LIFECYCLE_RANK[candidate.lifecycleState] >= LIFECYCLE_RANK[state]);
}

export function buildComponentWorkbenchRows(input: {
  manifest: PaperDollFamilyProductionManifest;
  candidates: readonly PersistedCandidateSummary[];
  releaseAssets: readonly PaperDollReleaseAsset[];
  sanitySyncs: readonly SanitySyncSummary[];
}): ComponentWorkbenchRow[] {
  return input.manifest.components.flatMap((component) =>
    component.variants.map((variant) => {
      const candidate = latestCandidate(
        input.candidates,
        component.componentKey,
        variant.variantKey,
      );
      const inCurrentRelease = input.releaseAssets.some((asset) =>
        asset.componentKey === component.componentKey && asset.variantKey === variant.variantKey
      );
      const sanityDrafted = Boolean(candidate && input.sanitySyncs.some((sync) =>
        sync.action === "draft" && sync.status === "success" && sync.candidateIds?.includes(candidate.candidateId)
      ));
      const publiclyPublished = Boolean(candidate && input.sanitySyncs.some((sync) =>
        sync.action === "public" && sync.status === "success" && sync.candidateIds?.includes(candidate.candidateId)
      ));
      const status = buildComponentStatus({
        authorityStatus: component.authorityStatus,
        lifecycleState: candidate?.lifecycleState ?? null,
        currentCandidateFailed: candidate?.currentCandidateFailed === true,
        quarantinedAncestor: candidate?.quarantinedAncestor === true,
      });
      return {
        componentKey: component.componentKey,
        variantKey: variant.variantKey,
        slot: component.slot,
        materialVariant: variant.materialVariant,
        materialClass: variant.materialClass,
        geometryFamilyId: component.geometryFamilyId,
        source: component.source,
        authorityStatus: component.authorityStatus,
        authority: component.authority,
        compatibleBodyVariantKeys: component.compatibleBodyVariantKeys,
        candidate,
        pixelApproved: lifecycleAtLeast(candidate, "pixels-approved"),
        familyFitApproved: lifecycleAtLeast(candidate, "family-fit-approved"),
        placementLocked: lifecycleAtLeast(candidate, "placement-locked"),
        inCurrentRelease,
        sanityDrafted,
        publiclyPublished,
        status,
        nextAction: nextActionFor(component, candidate),
      };
    })
  );
}
