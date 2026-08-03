import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { PaperDollFamilyProductionManifest } from "@/lib/paperDoll/componentPlateContract";
import type { PersistedCandidateSummary } from "@/lib/paperDoll/componentWorkbenchModel";
import {
  buildCandidateApprovalPayload,
  buildSharedPlacementPayload,
  mapPersistedCandidates,
  parsePrivateStoragePath,
  resolveApprovedBodyVersionIds,
  type PaperDollCandidateRow,
  type PaperDollComponentRow,
  type PaperDollComponentVersionRow,
} from "@/lib/paperDoll/workbenchPersistence";
import type { PaperDollReleaseAsset } from "@/lib/paperDoll/releaseContract";

const SIGNED_URL_TTL_SECONDS = 60 * 60;

// Generated Supabase types lag the append-only paper-doll migrations. Keep the
// narrow escape hatch in this adapter instead of spreading untyped access into UI code.
const paperDollDb = supabase as any;

async function signCandidatePaths(paths: readonly string[]): Promise<Record<string, string>> {
  const unique = [...new Set(paths)];
  const entries = await Promise.all(unique.map(async (privatePath) => {
    const location = parsePrivateStoragePath(privatePath);
    const { data, error } = await paperDollDb.storage
      .from(location.bucket)
      .createSignedUrl(location.path, SIGNED_URL_TTL_SECONDS);
    if (error || !data?.signedUrl) {
      throw new Error(`Private candidate preview could not be signed: ${error?.message ?? privatePath}`);
    }
    return [privatePath, data.signedUrl] as const;
  }));
  return Object.fromEntries(entries);
}

async function loadWorkbenchCandidates(input: {
  organizationId: string;
  manifest: PaperDollFamilyProductionManifest;
}): Promise<PersistedCandidateSummary[]> {
  const componentKeys = input.manifest.components.map((component) => component.componentKey);
  const { data: componentData, error: componentError } = await paperDollDb
    .from("paper_doll_components")
    .select("id, component_key")
    .eq("organization_id", input.organizationId)
    .in("component_key", componentKeys);
  if (componentError) throw new Error(`Component registry could not be loaded: ${componentError.message}`);
  const componentRows = (componentData ?? []) as PaperDollComponentRow[];
  if (componentRows.length === 0) return [];

  const { data: candidateData, error: candidateError } = await paperDollDb
    .from("paper_doll_component_candidates")
    .select([
      "id", "component_id", "variant_key", "original_filename", "source_path", "source_sha256",
      "normalized_path", "normalized_sha256", "layer_path", "layer_sha256", "authority_mask_path",
      "authority_mask_sha256", "source_bounds", "edit_bounds", "authority_bounds", "placement_bounds",
      "provider", "model", "prompt_sha256", "estimated_cost_usd", "qa", "lifecycle_state", "created_at",
    ].join(","))
    .eq("organization_id", input.organizationId)
    .in("component_id", componentRows.map((row) => row.id))
    .order("created_at", { ascending: false });
  if (candidateError) throw new Error(`Component candidates could not be loaded: ${candidateError.message}`);
  const candidateRows = (candidateData ?? []) as PaperDollCandidateRow[];
  if (candidateRows.length === 0) return [];
  const { data: candidateVersionData, error: candidateVersionError } = await paperDollDb
    .from("paper_doll_component_versions")
    .select("id, component_id, image_sha256, approval_status")
    .eq("organization_id", input.organizationId)
    .in("component_id", componentRows.map((row) => row.id));
  if (candidateVersionError) throw new Error(`Candidate component versions could not be loaded: ${candidateVersionError.message}`);
  const candidateVersions = (candidateVersionData ?? []) as PaperDollComponentVersionRow[];
  const componentVersionsByCandidateId = Object.fromEntries(candidateRows.flatMap((candidate) => {
    const matches = candidateVersions.filter((version) =>
      version.component_id === candidate.component_id && version.image_sha256 === candidate.layer_sha256
    );
    if (matches.length > 1) throw new Error(`Candidate ${candidate.id} has duplicate component versions for the same immutable pixels.`);
    return matches[0] ? [[candidate.id, { id: matches[0].id, approvalStatus: matches[0].approval_status }]] : [];
  }));
  const { data: placementEvents, error: placementEventsError } = await paperDollDb
    .from("paper_doll_approval_events")
    .select("candidate_id, evidence")
    .eq("organization_id", input.organizationId)
    .eq("action", "placement-locked")
    .in("candidate_id", candidateRows.map((row) => row.id));
  if (placementEventsError) throw new Error(`Placement evidence could not be loaded: ${placementEventsError.message}`);
  const placementVersionIdsByCandidateId = Object.fromEntries((placementEvents ?? []).flatMap((row: any) => {
    const placementVersionId = row.evidence?.placementVersionId;
    return typeof placementVersionId === "string" ? [[row.candidate_id, placementVersionId]] : [];
  }));
  const signedUrls = await signCandidatePaths(candidateRows.flatMap((row) => [row.normalized_path, row.layer_path]));
  return mapPersistedCandidates({
    familyKey: input.manifest.familyKey,
    components: input.manifest.components,
    componentRows,
    candidateRows,
    signedUrlsByPrivatePath: signedUrls,
    placementVersionIdsByCandidateId,
    componentVersionsByCandidateId,
  });
}

async function loadApprovedBodyVersionIds(input: {
  organizationId: string;
  bodies: readonly PaperDollReleaseAsset[];
}): Promise<Record<string, string>> {
  const bodyKeys = input.bodies.filter((body) => body.slot === "body").map((body) => body.componentKey);
  const { data: componentData, error: componentError } = await paperDollDb
    .from("paper_doll_components")
    .select("id, component_key")
    .eq("organization_id", input.organizationId)
    .in("component_key", bodyKeys);
  if (componentError) throw new Error(`Body registry could not be loaded: ${componentError.message}`);
  const components = (componentData ?? []) as PaperDollComponentRow[];
  if (components.length === 0) return {};
  const { data: versionData, error: versionError } = await paperDollDb
    .from("paper_doll_component_versions")
    .select("id, component_id, image_sha256, approval_status")
    .eq("organization_id", input.organizationId)
    .eq("approval_status", "approved")
    .in("component_id", components.map((row) => row.id));
  if (versionError) throw new Error(`Approved body versions could not be loaded: ${versionError.message}`);
  return resolveApprovedBodyVersionIds({
    bodies: input.bodies,
    components,
    versions: (versionData ?? []) as PaperDollComponentVersionRow[],
  });
}

export function usePaperDollWorkbenchData(input: {
  organizationId: string | null | undefined;
  manifest: PaperDollFamilyProductionManifest;
  bodies: readonly PaperDollReleaseAsset[];
}) {
  const queryClient = useQueryClient();
  const queryKey = ["paper-doll-workbench", input.organizationId, input.manifest.familyKey] as const;
  const candidatesQuery = useQuery({
    queryKey,
    queryFn: () => loadWorkbenchCandidates({
      organizationId: input.organizationId!,
      manifest: input.manifest,
    }),
    enabled: Boolean(input.organizationId),
    staleTime: 30_000,
    retry: false,
  });
  const bodyVersionsQuery = useQuery({
    queryKey: [...queryKey, "approved-body-versions"],
    queryFn: () => loadApprovedBodyVersionIds({ organizationId: input.organizationId!, bodies: input.bodies }),
    enabled: Boolean(input.organizationId),
    staleTime: 30_000,
    retry: false,
  });
  const approvalMutation = useMutation({
    mutationFn: async (approval: {
      candidate: PersistedCandidateSummary;
      action: "pixels-approved" | "family-fit-approved";
      approvedByName: string;
      approvalNote: string;
    }) => {
      if (!input.organizationId) throw new Error("Select an organization before approving a candidate.");
      const body = buildCandidateApprovalPayload({ organizationId: input.organizationId, ...approval });
      const { data, error } = await supabase.functions.invoke("approve-paper-doll-candidate", { body });
      if (error) throw new Error(error.message || "Candidate approval failed.");
      return data as { candidateId: string; lifecycleState: string; approvalEventId: string };
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
    },
  });
  const placementMutation = useMutation({
    mutationFn: async (placement: {
      candidate: PersistedCandidateSummary;
      geometryFamilyId: string;
      approvedByName: string;
      approvalNote: string;
    }) => {
      if (!input.organizationId) throw new Error("Select an organization before locking placement.");
      const body = buildSharedPlacementPayload({
        organizationId: input.organizationId,
        familyKey: input.manifest.familyKey,
        geometryFamilyId: placement.geometryFamilyId,
        candidate: placement.candidate,
        bodies: input.bodies,
        bodyVersionIdsByVariant: bodyVersionsQuery.data ?? {},
        approvedByName: placement.approvedByName,
        approvalNote: placement.approvalNote,
      });
      const { data, error } = await supabase.functions.invoke("lock-paper-doll-placement", { body });
      if (error) throw new Error(error.message || "Shared placement lock failed.");
      return data as { candidateId: string; placementVersionId: string; lifecycleState: string };
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
    },
  });
  return { candidatesQuery, bodyVersionsQuery, approvalMutation, placementMutation };
}
