import { z } from "zod";

const hashSchema = z.string().regex(/^[a-f0-9]{64}$/);

export const paperDollComponentGeometryReviewStatusSchema = z.enum([
  "verified-local-shared-authority",
  "local-authorities-require-reconciliation",
  "source-ready-physical-review",
  "source-incomplete",
]);

export const paperDollComponentGeometryReviewGroupSchema = z.object({
  reviewGroupKey: z.string().min(1),
  descriptorSignature: z.string().min(1),
  slotProposals: z.array(z.string().min(1)).min(1),
  neckFinishEvidence: z.array(z.string().min(1)),
  applicatorEvidence: z.array(z.string().min(1)),
  capStyleEvidence: z.array(z.string().min(1)),
  sourceIdentities: z.array(z.string().min(1)).min(1),
  appearanceEvidence: z.array(z.string().min(1)),
  sourceReferenceUrls: z.array(z.string().url()),
  sourceIdentityCount: z.number().int().positive(),
  sourceReferenceObservedCount: z.number().int().nonnegative(),
  localVariantCount: z.number().int().nonnegative(),
  localGeometryFamilyIds: z.array(z.string().min(1)),
  localAuthorityMaskSha256: z.array(hashSchema),
  status: paperDollComponentGeometryReviewStatusSchema,
  priority: z.enum(["P0-VERIFY", "P0-TRUTH", "P1-PRODUCE"]),
  geometryClaim: z.enum(["verified-local-exact-alpha", "unverified-descriptor-cluster"]),
  nextGate: z.string().min(1),
  issues: z.array(z.string().min(1)),
});

export const paperDollComponentGeometryReviewSchema = z.object({
  schemaVersion: z.literal(1),
  generatedFrom: z.object({
    componentAuthorityQueuePath: z.string().min(1),
    componentAuthorityQueueSha256: hashSchema,
  }),
  summary: z.object({
    sourceIdentityCount: z.number().int().nonnegative(),
    descriptorReviewGroupCount: z.number().int().nonnegative(),
    verifiedSharedAuthorityGroupCount: z.number().int().nonnegative(),
    verifiedSharedAuthorityIdentityCount: z.number().int().nonnegative(),
    localReconciliationGroupCount: z.number().int().nonnegative(),
    sourceReadyPhysicalReviewGroupCount: z.number().int().nonnegative(),
    sourceIncompleteGroupCount: z.number().int().nonnegative(),
  }),
  groups: z.array(paperDollComponentGeometryReviewGroupSchema),
  claimPolicy: z.object({
    descriptorClusterIsGeometryLock: z.literal(false),
    exactSharedAuthorityRequiredForVerifiedClaim: z.literal(true),
    compatibilityInferred: z.literal(false),
  }),
  mutationPolicy: z.object({
    assetsGenerated: z.literal(false),
    remoteWritesPerformed: z.literal(false),
    currentReleaseChanged: z.literal(false),
    sanityChanged: z.literal(false),
  }),
}).superRefine((review, context) => {
  const keys = review.groups.map((group) => group.reviewGroupKey);
  if (new Set(keys).size !== keys.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Duplicate geometry review group key.", path: ["groups"] });
  }
  const sourceIdentities = review.groups.flatMap((group) => group.sourceIdentities);
  if (new Set(sourceIdentities).size !== sourceIdentities.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "A component source identity appears in more than one review group.", path: ["groups"] });
  }
  if (sourceIdentities.length !== review.summary.sourceIdentityCount) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Source identity count does not match grouped identities.", path: ["summary", "sourceIdentityCount"] });
  }
  if (review.groups.length !== review.summary.descriptorReviewGroupCount) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Review group count does not match groups.", path: ["summary", "descriptorReviewGroupCount"] });
  }
  const count = (status: z.infer<typeof paperDollComponentGeometryReviewStatusSchema>) => review.groups.filter((group) => group.status === status).length;
  if (count("verified-local-shared-authority") !== review.summary.verifiedSharedAuthorityGroupCount) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Verified shared authority count mismatch.", path: ["summary", "verifiedSharedAuthorityGroupCount"] });
  }
  if (count("local-authorities-require-reconciliation") !== review.summary.localReconciliationGroupCount) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Local reconciliation count mismatch.", path: ["summary", "localReconciliationGroupCount"] });
  }
  if (count("source-ready-physical-review") !== review.summary.sourceReadyPhysicalReviewGroupCount) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Source-ready group count mismatch.", path: ["summary", "sourceReadyPhysicalReviewGroupCount"] });
  }
  if (count("source-incomplete") !== review.summary.sourceIncompleteGroupCount) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Source-incomplete group count mismatch.", path: ["summary", "sourceIncompleteGroupCount"] });
  }
  const verifiedIdentities = review.groups
    .filter((group) => group.status === "verified-local-shared-authority")
    .reduce((total, group) => total + group.sourceIdentityCount, 0);
  if (verifiedIdentities !== review.summary.verifiedSharedAuthorityIdentityCount) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Verified shared authority identity count mismatch.", path: ["summary", "verifiedSharedAuthorityIdentityCount"] });
  }
  for (const [index, group] of review.groups.entries()) {
    if (group.sourceIdentityCount !== group.sourceIdentities.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Group source identity count mismatch.", path: ["groups", index, "sourceIdentityCount"] });
    }
    if (group.geometryClaim === "verified-local-exact-alpha"
      && (group.status !== "verified-local-shared-authority"
        || group.localGeometryFamilyIds.length !== 1
        || group.localAuthorityMaskSha256.length !== 1
        || group.localVariantCount !== group.sourceIdentityCount)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Verified geometry claim lacks one exact shared local authority.", path: ["groups", index, "geometryClaim"] });
    }
    if (group.status !== "verified-local-shared-authority" && group.geometryClaim !== "unverified-descriptor-cluster") {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Descriptor clusters must remain unverified.", path: ["groups", index, "geometryClaim"] });
    }
  }
});

export type PaperDollComponentGeometryReview = z.infer<typeof paperDollComponentGeometryReviewSchema>;
export type PaperDollComponentGeometryReviewGroup = z.infer<typeof paperDollComponentGeometryReviewGroupSchema>;

export function parsePaperDollComponentGeometryReview(value: unknown): PaperDollComponentGeometryReview {
  return paperDollComponentGeometryReviewSchema.parse(value);
}
