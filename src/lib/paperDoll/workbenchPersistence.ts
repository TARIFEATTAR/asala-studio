import type { FamilyComponentDefinition } from "./componentPlateContract";
import type { PersistedCandidateSummary } from "./componentWorkbenchModel";
import { PAPER_DOLL_RELEASE_CANVAS, type PaperDollReleaseAsset } from "./releaseContract";

export interface PaperDollComponentRow {
  id: string;
  component_key: string;
}

export interface PaperDollComponentVersionRow {
  id: string;
  component_id: string;
  image_sha256: string;
  approval_status: string;
}

export interface PaperDollCandidateRow {
  id: string;
  component_id: string;
  variant_key: string;
  original_filename: string;
  source_path: string;
  source_sha256: string;
  normalized_path: string;
  normalized_sha256: string;
  layer_path: string;
  layer_sha256: string;
  authority_mask_path: string;
  authority_mask_sha256: string;
  source_bounds: unknown;
  edit_bounds: unknown;
  authority_bounds: unknown;
  placement_bounds: unknown;
  provider: string;
  model: string;
  prompt_sha256: string | null;
  estimated_cost_usd: number | string | null;
  qa: unknown;
  lifecycle_state: string;
  created_at: string;
}

export interface PrivateStorageLocation {
  bucket: string;
  path: string;
}

const PROVIDERS = new Set([
  "openai",
  "google",
  "higgsfield",
  "manual",
  "blender",
  "deterministic",
]);

const LIFECYCLE_STATES = new Set([
  "candidate",
  "pixels-approved",
  "family-fit-approved",
  "placement-locked",
  "released",
  "sanity-draft",
  "published",
  "rejected",
]);

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function number(value: unknown, label: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${label} must be a finite number.`);
  return parsed;
}

function bounds(value: unknown, label: string) {
  const input = record(value, label);
  return {
    left: number(input.left, `${label}.left`),
    top: number(input.top, `${label}.top`),
    width: number(input.width, `${label}.width`),
    height: number(input.height, `${label}.height`),
  };
}

export function parsePrivateStoragePath(value: string): PrivateStorageLocation {
  const match = /^private:\/\/([^/]+)\/(.+)$/.exec(value.trim());
  if (!match || !match[1] || !match[2] || match[2].includes("..")) {
    throw new Error(`Invalid private storage path: ${value}`);
  }
  return { bucket: match[1], path: match[2] };
}

export function mapPersistedCandidates(input: {
  familyKey: string;
  components: readonly FamilyComponentDefinition[];
  componentRows: readonly PaperDollComponentRow[];
  candidateRows: readonly PaperDollCandidateRow[];
  signedUrlsByPrivatePath?: Readonly<Record<string, string>>;
  placementVersionIdsByCandidateId?: Readonly<Record<string, string>>;
  componentVersionsByCandidateId?: Readonly<Record<string, { id: string; approvalStatus: string }>>;
}): PersistedCandidateSummary[] {
  const definitions = new Map(input.components.map((component) => [component.componentKey, component]));
  const keysById = new Map(input.componentRows.map((component) => [component.id, component.component_key]));
  const signedUrls = input.signedUrlsByPrivatePath ?? {};
  const placementVersionIds = input.placementVersionIdsByCandidateId ?? {};
  const componentVersions = input.componentVersionsByCandidateId ?? {};

  return input.candidateRows.map((row) => {
    const componentKey = keysById.get(row.component_id);
    const component = componentKey ? definitions.get(componentKey) : null;
    const variant = component?.variants.find((item) => item.variantKey === row.variant_key);
    if (!componentKey || !component || !variant) {
      throw new Error(`Candidate ${row.id} does not match the local component registry.`);
    }
    if (!PROVIDERS.has(row.provider)) throw new Error(`Candidate ${row.id} has unsupported provider ${row.provider}.`);
    if (!LIFECYCLE_STATES.has(row.lifecycle_state)) {
      throw new Error(`Candidate ${row.id} has unsupported lifecycle ${row.lifecycle_state}.`);
    }
    const qa = record(row.qa, `candidate ${row.id} qa`);
    const sourceBounds = bounds(row.source_bounds, `candidate ${row.id} source_bounds`);
    const editBounds = bounds(row.edit_bounds, `candidate ${row.id} edit_bounds`);
    const authorityBounds = bounds(row.authority_bounds, `candidate ${row.id} authority_bounds`);
    const placementBounds = bounds(row.placement_bounds, `candidate ${row.id} placement_bounds`);
    const sourceUsesOriginalCanvas = sourceBounds.left + sourceBounds.width <= component.source.widthPx
      && sourceBounds.top + sourceBounds.height <= component.source.heightPx;
    return {
      candidateId: row.id,
      componentId: row.component_id,
      componentVersionId: componentVersions[row.id]?.id,
      componentVersionApprovalStatus: componentVersions[row.id]?.approvalStatus,
      familyKey: input.familyKey,
      componentKey,
      variantKey: row.variant_key,
      source: {
        originalFilename: row.original_filename,
        path: row.source_path,
        sha256: row.source_sha256,
        widthPx: sourceUsesOriginalCanvas ? component.source.widthPx : PAPER_DOLL_RELEASE_CANVAS.widthPx,
        heightPx: sourceUsesOriginalCanvas ? component.source.heightPx : PAPER_DOLL_RELEASE_CANVAS.heightPx,
      },
      sourceBoundsPx: sourceBounds,
      editBoundsPx: editBounds,
      authorityBoundsPx: authorityBounds,
      placementBoundsPx: placementBounds,
      authorityMaskPath: row.authority_mask_path,
      authorityMaskSha256: row.authority_mask_sha256,
      normalizedCandidateSha256: row.normalized_sha256,
      fullCanvasLayerSha256: row.layer_sha256,
      normalizedPath: row.normalized_path,
      layerPath: row.layer_path,
      normalizedUrl: signedUrls[row.normalized_path],
      layerUrl: signedUrls[row.layer_path],
      placementVersionId: placementVersionIds[row.id] ?? null,
      provider: row.provider as PersistedCandidateSummary["provider"],
      model: row.model,
      promptSha256: row.prompt_sha256,
      estimatedCostUsd: row.estimated_cost_usd === null ? null : number(row.estimated_cost_usd, "estimated_cost_usd"),
      qa: {
        geometryLocked: qa.geometryLocked === true,
        minIoU: number(qa.minIoU, `candidate ${row.id} qa.minIoU`),
        mismatchedPixels: number(qa.mismatchedPixels, `candidate ${row.id} qa.mismatchedPixels`),
      },
      mutationPolicy: { currentReleaseChanged: false, sanityChanged: false },
      lifecycleState: row.lifecycle_state as PersistedCandidateSummary["lifecycleState"],
      createdAt: row.created_at,
    };
  });
}

export function resolveApprovedBodyVersionIds(input: {
  bodies: readonly PaperDollReleaseAsset[];
  components: readonly PaperDollComponentRow[];
  versions: readonly PaperDollComponentVersionRow[];
}): Record<string, string> {
  const componentIdsByKey = new Map(input.components.map((row) => [row.component_key, row.id]));
  const result: Record<string, string> = {};
  for (const body of input.bodies) {
    if (body.slot !== "body") continue;
    const componentId = componentIdsByKey.get(body.componentKey);
    if (!componentId) continue;
    const matching = input.versions.filter((row) =>
      row.component_id === componentId &&
      row.image_sha256 === body.imageSha256 &&
      row.approval_status === "approved"
    );
    if (matching.length > 1) {
      throw new Error(`Body ${body.variantKey} has duplicate approved persisted versions for the same pixels.`);
    }
    if (matching[0]) result[body.variantKey] = matching[0].id;
  }
  return result;
}

export function buildSharedPlacementPayload(input: {
  organizationId: string;
  familyKey: string;
  geometryFamilyId: string;
  candidate: PersistedCandidateSummary;
  bodies: readonly PaperDollReleaseAsset[];
  bodyVersionIdsByVariant: Readonly<Record<string, string>>;
  approvedByName: string;
  approvalNote: string;
}) {
  const approvedByName = input.approvedByName.trim();
  const approvalNote = input.approvalNote.trim();
  if (!approvedByName || !approvalNote) throw new Error("Named approver and approval note are required.");
  if (input.candidate.lifecycleState !== "family-fit-approved") {
    throw new Error("Candidate must be family-fit-approved before shared placement can be locked.");
  }
  const bodies = input.bodies.filter((body) => body.slot === "body");
  if (bodies.length !== 5 || new Set(bodies.map((body) => body.variantKey)).size !== 5) {
    throw new Error("Exactly five distinct locked body plates are required.");
  }
  const plates = bodies.map((body) => {
    const bodyComponentVersionId = input.bodyVersionIdsByVariant[body.variantKey];
    if (!bodyComponentVersionId) throw new Error(`Approved persisted body version is missing for ${body.variantKey}.`);
    return {
      bodyVariantKey: body.variantKey,
      bodyComponentVersionId,
      adjustment: { deltaX: 0, deltaY: 0, scale: 1 },
    };
  });
  const bounds = input.candidate.placementBoundsPx;
  return {
    organizationId: input.organizationId,
    candidateId: input.candidate.candidateId,
    familyKey: input.familyKey,
    geometryFamilyId: input.geometryFamilyId,
    expectedContentSha256: input.candidate.normalizedCandidateSha256,
    expectedAuthorityMaskSha256: input.candidate.authorityMaskSha256,
    approvedByName,
    approvalNote,
    widthPx: bounds.width,
    centerXPx: bounds.left + bounds.width / 2,
    seatYPx: bounds.top + bounds.height,
    placementBounds: bounds,
    plates,
  };
}

export function buildCandidateApprovalPayload(input: {
  organizationId: string;
  candidate: PersistedCandidateSummary;
  action: "pixels-approved" | "family-fit-approved";
  approvedByName: string;
  approvalNote: string;
}) {
  const approvedByName = input.approvedByName.trim();
  const approvalNote = input.approvalNote.trim();
  if (!approvedByName || !approvalNote) throw new Error("Named approver and approval note are required.");
  return {
    organizationId: input.organizationId,
    candidateId: input.candidate.candidateId,
    action: input.action,
    approvedByName,
    approvalNote,
    expectedLifecycleState: input.candidate.lifecycleState,
    expectedContentSha256: input.candidate.normalizedCandidateSha256,
  };
}
