import { createHash } from "node:crypto";

interface AssetRef {
  bucket: "paper-doll-sources" | "paper-doll-candidates" | "paper-doll-approved";
  path: string;
  sha256: string;
  contentType: string;
  byteSize: number;
}

interface ManualAssetRef extends AssetRef {
  originalFilename: string;
}

export function buildCyl9RollerPairJobPlan(input: {
  organizationId: string;
  initiatedBy: string;
  componentId: string;
  parentComponentVersionId: string;
  parent: AssetRef;
  authorityMask: AssetRef;
  assemblyContext: AssetRef;
  plastic: ManualAssetRef;
  metal: ManualAssetRef;
}) {
  const variants = [
    {
      key: "PLASTIC",
      manual: input.plastic,
      instruction: "Stage the clean natural-plastic roller fitment as the geometry master. Preserve the exact shared authority silhouette and catalog lighting.",
    },
    {
      key: "METAL",
      manual: input.metal,
      instruction: "Stage the metal-ball roller as a material-only child of the natural-plastic geometry master. Only the exposed ball is polished stainless steel.",
    },
  ] as const;
  return {
    jobs: variants.map((variant) => ({
      organization_id: input.organizationId,
      requirement_key: `CYL-9ML:ROLLER:${variant.key}`,
      component_id: input.componentId,
      parent_component_version_id: input.parentComponentVersionId,
      parent_sha256: input.parent.sha256,
      provider: "manual" as const,
      model: "manual-v1",
      status: "queued" as const,
      prompt: variant.instruction,
      prompt_sha256: createHash("sha256").update(variant.instruction).digest("hex"),
      source_ref: input.parent,
      authoritative_mask_ref: input.authorityMask,
      edit_mask_ref: input.authorityMask,
      assembly_context_ref: input.assemblyContext,
      manual_output_ref: variant.manual,
      transform: { translateXPx: 0, translateYPx: 0, scaleX: 1, scaleY: 1 },
      selection_kind: "whole-layer" as const,
      initiated_by: input.initiatedBy,
    })),
    releaseMutation: false,
    sanityPublished: false,
  };
}
