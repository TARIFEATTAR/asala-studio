import { z } from "zod";

const SHA256Schema = z.string().regex(/^[a-f0-9]{64}$/);

export const SharedPlacementLockRequestSchema = z.object({
  organizationId: z.string().uuid(),
  familyKey: z.literal("CYL-9ML"),
  fitmentGeometryKey: z.literal("fitment__roller-ball__17-415__v1"),
  calibrationComponentVersionId: z.string().uuid(),
  expectedAuthorityMaskSha256: SHA256Schema,
  canvas: z.object({ widthPx: z.literal(2080), heightPx: z.literal(2288) }),
  transform: z.object({
    translateXPx: z.number().finite(),
    translateYPx: z.number().finite(),
    uniformScale: z.number().finite().positive(),
  }),
  compatibleBodyComponentVersionIds: z.array(z.string().uuid()).length(5),
  approverDisplayName: z.string().trim().min(1).max(200),
  approvalNote: z.string().trim().min(1).max(500),
}).superRefine((value, context) => {
  if (new Set(value.compatibleBodyComponentVersionIds).size !== 5) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["compatibleBodyComponentVersionIds"],
      message: "CYL-9ML placement requires five unique compatible body versions.",
    });
  }
});

export type SharedPlacementLockRequest = z.infer<typeof SharedPlacementLockRequestSchema>;
