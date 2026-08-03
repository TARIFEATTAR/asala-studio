import { z } from "zod";

import { PaperDollInventorySlotSchema } from "./familyIntakeContract";

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);

const LocalPlateVariantSchema = z.object({
  componentKey: z.string().min(1),
  geometryFamilyId: z.string().min(1),
  slot: z.string().min(1),
  authorityStatus: z.string().min(1),
  authorityId: z.string().min(1).nullable(),
  authorityMaskSha256: Sha256Schema.nullable(),
  variantKey: z.string().min(1),
  materialVariant: z.string().min(1),
});

export const PaperDollComponentAuthorityIntakeSchema = z.object({
  authorityQueueKey: z.string().min(1),
  sourceIdentity: z.string().min(1),
  websiteSkus: z.array(z.string().min(1)),
  graceSkus: z.array(z.string().min(1)).min(1),
  slotProposals: z.array(PaperDollInventorySlotSchema).min(1),
  familyLabels: z.array(z.string().min(1)).min(1),
  neckFinishEvidence: z.array(z.string().min(1)),
  applicatorEvidence: z.array(z.string().min(1)),
  capStyleEvidence: z.array(z.string().min(1)),
  finishEvidence: z.array(z.string().min(1)),
  trimEvidence: z.array(z.string().min(1)),
  materialEvidence: z.array(z.string().min(1)),
  assemblyEvidence: z.array(z.string().min(1)),
  itemNameEvidence: z.array(z.string().min(1)),
  referenceUrls: z.array(z.string().url()),
  productUrls: z.array(z.string().url()),
  localPlateVariants: z.array(LocalPlateVariantSchema),
  sourceReferenceStatus: z.enum(["reference-url-observed", "reference-url-missing"]),
  authorityStatus: z.enum(["local-pilot-authority-exists", "missing", "manual-review-required"]),
  geometryGroupingStatus: z.enum(["verified-local-pilot", "unresolved"]),
  compatibilityStatus: z.literal("unverified"),
  issues: z.array(z.string()),
  mutationPolicy: z.object({
    candidatesGenerated: z.literal(false),
    remoteWritesPerformed: z.literal(false),
    currentReleaseChanged: z.literal(false),
    sanityChanged: z.literal(false),
  }),
});

export const PaperDollComponentAuthorityQueueSchema = z.object({
  schemaVersion: z.literal(1),
  sourceBacklogPath: z.string().min(1),
  sourceBacklogSha256: Sha256Schema,
  summary: z.object({
    sourceIdentityCount: z.number().int().nonnegative(),
    exactWebsiteSkuCount: z.number().int().nonnegative(),
    localPilotAuthorityIdentityCount: z.number().int().nonnegative(),
    sourceReferenceObservedCount: z.number().int().nonnegative(),
    manualReviewIdentityCount: z.number().int().nonnegative(),
  }),
  items: z.array(PaperDollComponentAuthorityIntakeSchema).min(1),
  missingSourceResponsibilities: z.array(z.object({
    slot: PaperDollInventorySlotSchema,
    reason: z.string().min(1),
    nextAction: z.string().min(1),
  })),
  mutationPolicy: z.object({
    candidatesGenerated: z.literal(false),
    remoteWritesPerformed: z.literal(false),
    currentReleaseChanged: z.literal(false),
    sanityChanged: z.literal(false),
  }),
}).superRefine((queue, context) => {
  const identities = queue.items.map((item) => item.sourceIdentity);
  const keys = queue.items.map((item) => item.authorityQueueKey);
  if (new Set(identities).size !== identities.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Duplicate component source identity.", path: ["items"] });
  }
  if (new Set(keys).size !== keys.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Duplicate authority queue key.", path: ["items"] });
  }
  const actual = {
    sourceIdentityCount: queue.items.length,
    exactWebsiteSkuCount: queue.items.filter((item) => item.websiteSkus.length === 1).length,
    localPilotAuthorityIdentityCount: queue.items.filter((item) => item.authorityStatus === "local-pilot-authority-exists").length,
    sourceReferenceObservedCount: queue.items.filter((item) => item.sourceReferenceStatus === "reference-url-observed").length,
    manualReviewIdentityCount: queue.items.filter((item) => item.authorityStatus === "manual-review-required").length,
  };
  for (const [key, value] of Object.entries(actual)) {
    if (queue.summary[key as keyof typeof actual] !== value) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: `Summary ${key} does not match component evidence.`, path: ["summary", key] });
    }
  }
});

export type PaperDollComponentAuthorityQueue = z.infer<typeof PaperDollComponentAuthorityQueueSchema>;

export function parsePaperDollComponentAuthorityQueue(value: unknown): PaperDollComponentAuthorityQueue {
  return PaperDollComponentAuthorityQueueSchema.parse(value);
}
