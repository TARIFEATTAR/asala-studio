import { z } from "zod";

const ReleaseCutComponentSchema = z.object({
  componentVersionId: z.string().uuid(),
  slot: z.enum(["body", "cap", "roller", "sprayer", "overcap", "pump"]),
  variantKey: z.string().trim().min(1).max(100),
  placementVersionId: z.string().uuid().nullable().optional(),
});

export const ReleaseCutRequestSchema = z.object({
  organizationId: z.string().uuid(),
  familyKey: z.literal("CYL-9ML"),
  expectedCurrentReleaseId: z.string().uuid(),
  releaseVersion: z.string().trim().min(1).max(200),
  selectedComponents: z.array(ReleaseCutComponentSchema).min(1).max(100),
  compatibleBodyComponentVersionIds: z.array(z.string().uuid()).length(5),
  approverDisplayName: z.string().trim().min(1).max(200),
  approvalNote: z.string().trim().min(1).max(1000),
  sourceGitCommit: z.string().trim().min(1).max(200),
  rendererVersion: z.string().trim().min(1).max(200),
}).superRefine((value, context) => {
  const componentKeys = value.selectedComponents.map((item) => `${item.slot}:${item.variantKey}`);
  if (new Set(componentKeys).size !== componentKeys.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Each selected slot and variant must be unique." });
  }
  if (new Set(value.selectedComponents.map((item) => item.componentVersionId)).size !== value.selectedComponents.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Each selected component version must be unique." });
  }
  if (new Set(value.compatibleBodyComponentVersionIds).size !== 5) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "The five compatible body versions must be unique." });
  }
});

export type ReleaseCutRequest = z.infer<typeof ReleaseCutRequestSchema>;

export function parseReleaseCutRequest(value: unknown): ReleaseCutRequest {
  return ReleaseCutRequestSchema.parse(value);
}

export type AssemblyReadiness = {
  status: "ready" | "incomplete";
  missingReasons: string[];
};

type ReadinessMapping = {
  bodyVariantKey: string;
  fitmentVariantKey: string | null;
  closureVariantKey: string | null;
  overcapVariantKey: string | null;
};

type AvailableAsset = { slot: string; variantKey: string };

export function deriveAssemblyReadiness(
  mapping: ReadinessMapping,
  availableAssets: AvailableAsset[],
): AssemblyReadiness {
  const available = new Set(availableAssets.map((asset) => `${asset.slot}:${asset.variantKey}`));
  const required = [
    ["body", mapping.bodyVariantKey],
    mapping.fitmentVariantKey ? ["roller", mapping.fitmentVariantKey] : null,
    mapping.closureVariantKey ? ["cap", mapping.closureVariantKey] : null,
    mapping.overcapVariantKey ? ["cap", mapping.overcapVariantKey] : null,
  ].filter((entry): entry is string[] => Boolean(entry));
  const missingReasons = required
    .map(([slot, variantKey]) => `${slot}:${variantKey}`)
    .filter((key) => !available.has(key));
  return { status: missingReasons.length === 0 ? "ready" : "incomplete", missingReasons };
}

export function sanityDocumentIds(publicDocumentId: string): { draftId: string; publicId: string } {
  const clean = publicDocumentId.trim();
  if (!/^(?!drafts\.)[A-Za-z0-9._-]+$/.test(clean)) throw new Error("publicDocumentId is not a safe canonical Sanity document ID.");
  return {
    draftId: `drafts.${clean}`,
    publicId: clean,
  };
}
