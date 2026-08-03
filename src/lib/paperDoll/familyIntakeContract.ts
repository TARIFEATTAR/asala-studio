import { z } from "zod";

import { PAPER_DOLL_RELEASE_CANVAS } from "./releaseContract";

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);

export const PaperDollInventorySlotSchema = z.enum([
  "cap",
  "roller",
  "sprayer",
  "overcap",
  "pump",
  "dropper",
  "reducer",
  "glass-rod",
  "stopper",
  "bulb-sprayer",
]);

const FamilyIntakeGeometrySchema = z.object({
  geometryKey: z.string().min(1),
  capacityMl: z.number().positive(),
  dimensionsMm: z.object({
    bodyHeight: z.number().positive().nullable(),
    widthAxis: z.number().positive().nullable(),
    depthAxis: z.number().positive().nullable(),
    axisSemantics: z.string().min(1),
  }),
  productGroupSlugs: z.array(z.string().min(1)).min(1),
  conflictFlags: z.array(z.string()),
  authorityStatus: z.enum(["missing", "calibrating", "approved", "revoked"]),
});

const FamilyIntakeBodyAppearanceSchema = z.object({
  bodyAppearanceKey: z.string().min(1),
  geometryKey: z.string().min(1),
  color: z.string().min(1),
  truthStatus: z.enum(["ready", "manual-review-required"]),
  authorityStatus: z.enum(["missing", "calibrating", "approved", "revoked"]),
  plateStatus: z.enum(["missing", "candidate", "approved"]),
});

const FamilyIntakeComponentRequirementSchema = z.object({
  componentRequirementKey: z.string().min(1),
  slot: PaperDollInventorySlotSchema,
  descriptor: z.record(z.unknown()),
  compatibleGeometryKeys: z.array(z.string().min(1)).min(1),
  sourceIdentity: z.string().min(1).nullable(),
  compatibilityStatus: z.enum(["unverified", "verified", "rejected"]),
  authorityStatus: z.enum(["missing", "calibrating", "approved", "revoked"]),
});

const FamilyIntakeCatalogIdentitySchema = z.object({
  websiteSku: z.string().min(1),
  graceSkus: z.array(z.string().min(1)).min(1),
  bodyGeometryKeys: z.array(z.string().min(1)).min(1),
  bodyColors: z.array(z.string().min(1)),
  componentRequirementKeys: z.array(z.string().min(1)),
  reviewStatus: z.enum(["ready", "manual-review-required"]),
  issues: z.array(z.string()),
});

export const PaperDollFamilyIntakeSchema = z.object({
  schemaVersion: z.literal(1),
  familyKey: z.string().min(1),
  familyName: z.string().min(1),
  scope: z.string().min(1),
  sourceBacklogPath: z.string().min(1),
  sourceBacklogSha256: Sha256Schema,
  canvas: z.object({
    widthPx: z.literal(PAPER_DOLL_RELEASE_CANVAS.widthPx),
    heightPx: z.literal(PAPER_DOLL_RELEASE_CANVAS.heightPx),
    backgroundHex: z.literal(PAPER_DOLL_RELEASE_CANVAS.backgroundHex),
  }),
  geometries: z.array(FamilyIntakeGeometrySchema).min(1),
  bodyAppearances: z.array(FamilyIntakeBodyAppearanceSchema).min(1),
  componentRequirements: z.array(FamilyIntakeComponentRequirementSchema),
  catalogIdentities: z.array(FamilyIntakeCatalogIdentitySchema).min(1),
  blockers: z.array(z.string().min(1)).min(1),
  mutationPolicy: z.object({
    candidatesGenerated: z.literal(false),
    remoteWritesPerformed: z.literal(false),
    currentReleaseChanged: z.literal(false),
    sanityChanged: z.literal(false),
  }),
}).superRefine((intake, context) => {
  const geometryKeys = new Set(intake.geometries.map((geometry) => geometry.geometryKey));
  const requirementKeys = new Set(intake.componentRequirements.map((requirement) => requirement.componentRequirementKey));
  const uniqueChecks: Array<[string, string[]]> = [
    ["geometry", intake.geometries.map((value) => value.geometryKey)],
    ["body appearance", intake.bodyAppearances.map((value) => value.bodyAppearanceKey)],
    ["component requirement", intake.componentRequirements.map((value) => value.componentRequirementKey)],
    ["catalog identity", intake.catalogIdentities.map((value) => value.websiteSku)],
  ];
  for (const [label, values] of uniqueChecks) {
    if (new Set(values).size !== values.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: `Duplicate ${label} identity.`, path: [] });
    }
  }
  intake.bodyAppearances.forEach((appearance, index) => {
    if (!geometryKeys.has(appearance.geometryKey)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Body appearance references an unknown geometry.", path: ["bodyAppearances", index, "geometryKey"] });
    }
  });
  intake.componentRequirements.forEach((requirement, index) => {
    if (requirement.compatibleGeometryKeys.some((key) => !geometryKeys.has(key))) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Component requirement references an unknown geometry.", path: ["componentRequirements", index, "compatibleGeometryKeys"] });
    }
  });
  intake.catalogIdentities.forEach((identity, index) => {
    if (identity.bodyGeometryKeys.some((key) => !geometryKeys.has(key))) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Catalog identity references an unknown geometry.", path: ["catalogIdentities", index, "bodyGeometryKeys"] });
    }
    if (identity.componentRequirementKeys.some((key) => !requirementKeys.has(key))) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Catalog identity references an unknown component requirement.", path: ["catalogIdentities", index, "componentRequirementKeys"] });
    }
  });
});

const UnresolvedCatalogIdentitySchema = z.object({
  websiteSku: z.string().min(1),
  graceSkus: z.array(z.string().min(1)).min(1),
  family: z.array(z.string().min(1)).min(1),
  capacityMl: z.array(z.string().min(1)),
  geometryStatus: z.enum(["ambiguous", "unresolved"]),
  geometryKeys: z.array(z.string().min(1)),
  issues: z.array(z.string()),
});

export const PaperDollCatalogFamilyIntakeIndexSchema = z.object({
  schemaVersion: z.literal(1),
  sourceBacklogPath: z.string().min(1),
  sourceBacklogSha256: Sha256Schema,
  summary: z.object({
    cohortCount: z.number().int().nonnegative(),
    catalogIdentityCount: z.number().int().nonnegative(),
    uniqueGeometryCount: z.number().int().nonnegative(),
    geometryMembershipCount: z.number().int().nonnegative(),
    bodyAppearanceRequirementCount: z.number().int().nonnegative(),
    componentRequirementCount: z.number().int().nonnegative(),
    unresolvedIdentityCount: z.number().int().nonnegative(),
  }),
  cohorts: z.array(PaperDollFamilyIntakeSchema).min(1),
  unresolvedCatalogIdentities: z.array(UnresolvedCatalogIdentitySchema),
  mutationPolicy: z.object({
    candidatesGenerated: z.literal(false),
    remoteWritesPerformed: z.literal(false),
    currentReleaseChanged: z.literal(false),
    sanityChanged: z.literal(false),
  }),
}).superRefine((index, context) => {
  const cohortKeys = index.cohorts.map((cohort) => cohort.familyKey);
  if (new Set(cohortKeys).size !== cohortKeys.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Duplicate family cohort key.", path: ["cohorts"] });
  }
  const mappedSkus = index.cohorts.flatMap((cohort) => cohort.catalogIdentities.map((identity) => identity.websiteSku));
  if (new Set(mappedSkus).size !== mappedSkus.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Catalog identity appears in more than one mapped cohort.", path: ["cohorts"] });
  }
  const unresolvedSkus = index.unresolvedCatalogIdentities.map((identity) => identity.websiteSku);
  if (new Set(unresolvedSkus).size !== unresolvedSkus.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Duplicate unresolved catalog identity.", path: ["unresolvedCatalogIdentities"] });
  }
  if (mappedSkus.some((sku) => unresolvedSkus.includes(sku))) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Catalog identity cannot be both mapped and unresolved.", path: [] });
  }
  const uniqueGeometryKeys = new Set(index.cohorts.flatMap((cohort) => cohort.geometries.map((geometry) => geometry.geometryKey)));
  const actual = {
    cohortCount: index.cohorts.length,
    catalogIdentityCount: mappedSkus.length,
    uniqueGeometryCount: uniqueGeometryKeys.size,
    geometryMembershipCount: index.cohorts.reduce((sum, cohort) => sum + cohort.geometries.length, 0),
    bodyAppearanceRequirementCount: index.cohorts.reduce((sum, cohort) => sum + cohort.bodyAppearances.length, 0),
    componentRequirementCount: index.cohorts.reduce((sum, cohort) => sum + cohort.componentRequirements.length, 0),
    unresolvedIdentityCount: index.unresolvedCatalogIdentities.length,
  };
  for (const [key, value] of Object.entries(actual)) {
    if (index.summary[key as keyof typeof actual] !== value) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: `Summary ${key} does not match indexed evidence.`, path: ["summary", key] });
    }
  }
});

export type PaperDollInventorySlot = z.infer<typeof PaperDollInventorySlotSchema>;
export type PaperDollFamilyIntake = z.infer<typeof PaperDollFamilyIntakeSchema>;
export type PaperDollCatalogFamilyIntakeIndex = z.infer<typeof PaperDollCatalogFamilyIntakeIndexSchema>;

export function parsePaperDollFamilyIntake(value: unknown): PaperDollFamilyIntake {
  return PaperDollFamilyIntakeSchema.parse(value);
}

export function parsePaperDollCatalogFamilyIntakeIndex(value: unknown): PaperDollCatalogFamilyIntakeIndex {
  return PaperDollCatalogFamilyIntakeIndexSchema.parse(value);
}
