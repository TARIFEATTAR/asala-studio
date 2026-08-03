import { z } from "zod";

import { OriginalFilenameSchema, PrivateAssetRefSchema } from "./candidateJobContract";

const BoundsSchema = z.object({
  left: z.number().int().min(0).max(2079),
  top: z.number().int().min(0).max(2287),
  right: z.number().int().min(0).max(2079),
  bottom: z.number().int().min(0).max(2287),
}).refine((value) => value.left <= value.right && value.top <= value.bottom, "Alpha bounds are inverted.");

export const ComponentSourceIntakeRequestSchema = z.object({
  organizationId: z.string().uuid(),
  familyKey: z.literal("CYL-9ML"),
  slot: z.enum(["cap", "roller", "sprayer", "overcap", "pump"]),
  componentKey: z.string().trim().min(3).max(180).regex(/^[a-z0-9][a-z0-9_.-]*$/),
  geometryFamilyId: z.string().trim().min(3).max(180).regex(/^[a-z0-9][a-z0-9_.-]*$/),
  displayName: z.string().trim().min(2).max(200),
  variantKey: z.string().trim().min(1).max(80).regex(/^[A-Z0-9][A-Z0-9-]*$/),
  versionKey: z.string().trim().min(1).max(120),
  materialVariant: z.string().trim().min(2).max(160),
  originalFilename: OriginalFilenameSchema,
  source: PrivateAssetRefSchema,
  authorityMask: PrivateAssetRefSchema,
  alphaBounds: BoundsSchema,
  mountAxisXPx: z.number().min(0).max(2079),
  seatYPx: z.number().min(0).max(2287),
  registrarDisplayName: z.string().trim().min(1).max(200),
  intakeNote: z.string().trim().min(1).max(2_000),
  normalization: z.object({
    targetVisibleWidthPx: z.number().int().positive().max(2080),
    removedDetachedIslands: z.number().int().nonnegative(),
    sourceVisibleBounds: BoundsSchema,
  }),
}).superRefine((value, context) => {
  for (const [field, asset] of [["source", value.source], ["authorityMask", value.authorityMask]] as const) {
    if (asset.bucket !== "paper-doll-sources") {
      context.addIssue({ code: z.ZodIssueCode.custom, path: [field, "bucket"], message: "Proposed sources belong in the private sources bucket." });
    }
    if (asset.path.split("/", 1)[0] !== value.organizationId) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: [field, "path"], message: "Asset organization must match the intake." });
    }
    if (asset.contentType !== "image/png") {
      context.addIssue({ code: z.ZodIssueCode.custom, path: [field, "contentType"], message: "Component sources must be PNG." });
    }
  }
});

export const ComponentSourceIntakeResultSchema = z.object({
  intakeId: z.string().uuid(),
  componentId: z.string().uuid(),
  componentVersionId: z.string().uuid(),
  approvalStatus: z.literal("candidate"),
  releaseChanged: z.literal(false),
  geometryLocked: z.literal(false),
});

export type ComponentSourceIntakeRequest = z.infer<typeof ComponentSourceIntakeRequestSchema>;

