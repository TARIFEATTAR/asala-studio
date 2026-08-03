import { z } from "zod";

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);

export const PaperDollMasterShotStatusSchema = z.enum([
  "locked-existing",
  "authority-existing-local",
  "needs-authority",
  "needs-source",
  "manual-review-required",
]);

export const PaperDollMasterShotRowSchema = z.object({
  lineNumber: z.number().int().positive(),
  shotId: z.string().min(1),
  recordType: z.enum(["body-appearance", "component-source", "supplemental-existing", "source-gap"]),
  plateType: z.string().min(1),
  family: z.string().min(1),
  capacityMl: z.number().positive().nullable(),
  neckFinish: z.string(),
  geometryOrAuthorityKey: z.string().min(1),
  appearance: z.string().min(1),
  materialEvidence: z.array(z.string().min(1)),
  sourceIdentity: z.string(),
  sourceReferenceUrls: z.array(z.string().url()),
  catalogSkuCount: z.number().int().nonnegative().nullable(),
  cohortKeys: z.array(z.string().min(1)),
  status: PaperDollMasterShotStatusSchema,
  priority: z.enum(["P0-VERIFY", "P0-TRUTH", "P1-PRODUCE", "P2-BACKLOG"]),
  authorityStatus: z.string().min(1),
  compatibilityStatus: z.string().min(1),
  nextGate: z.string().min(1),
  existingAssetPaths: z.array(z.string().min(1)),
  existingAssetSha256: z.array(Sha256Schema),
  notes: z.string(),
});

export const PaperDollMasterShotListSchema = z.object({
  schemaVersion: z.literal(1),
  generatedFrom: z.object({
    catalogBacklogPath: z.string().min(1),
    catalogBacklogSha256: Sha256Schema,
    familyIntakesPath: z.string().min(1),
    familyIntakesSha256: Sha256Schema,
    componentAuthorityQueuePath: z.string().min(1),
    componentAuthorityQueueSha256: Sha256Schema,
  }),
  summary: z.object({
    operationalRowCount: z.number().int().nonnegative(),
    sourceBackedPlateCount: z.number().int().nonnegative(),
    bodyAppearancePlateCount: z.number().int().nonnegative(),
    explicitComponentPlateCount: z.number().int().nonnegative(),
    exactSourceBackedExistingCount: z.number().int().nonnegative(),
    exactSourceBackedOutstandingCount: z.number().int().nonnegative(),
    supplementalExistingCount: z.number().int().nonnegative(),
    missingSourceResponsibilityCount: z.number().int().nonnegative(),
  }),
  rows: z.array(PaperDollMasterShotRowSchema).min(1),
  mutationPolicy: z.object({
    assetsGenerated: z.literal(false),
    remoteWritesPerformed: z.literal(false),
    currentReleaseChanged: z.literal(false),
    sanityChanged: z.literal(false),
  }),
}).superRefine((shotList, context) => {
  const ids = shotList.rows.map((row) => row.shotId);
  if (new Set(ids).size !== ids.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Duplicate master shot ID.", path: ["rows"] });
  }
  if (shotList.rows.some((row, index) => row.lineNumber !== index + 1)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Master shot line numbers must be contiguous and sorted.", path: ["rows"] });
  }
  const sourceRows = shotList.rows.filter((row) => row.recordType === "body-appearance" || row.recordType === "component-source");
  const actual = {
    operationalRowCount: shotList.rows.length,
    sourceBackedPlateCount: sourceRows.length,
    bodyAppearancePlateCount: shotList.rows.filter((row) => row.recordType === "body-appearance").length,
    explicitComponentPlateCount: shotList.rows.filter((row) => row.recordType === "component-source").length,
    exactSourceBackedExistingCount: sourceRows.filter((row) => row.status === "locked-existing" || row.status === "authority-existing-local").length,
    exactSourceBackedOutstandingCount: sourceRows.filter((row) => row.status !== "locked-existing" && row.status !== "authority-existing-local").length,
    supplementalExistingCount: shotList.rows.filter((row) => row.recordType === "supplemental-existing").length,
    missingSourceResponsibilityCount: shotList.rows.filter((row) => row.recordType === "source-gap").length,
  };
  for (const [key, value] of Object.entries(actual)) {
    if (shotList.summary[key as keyof typeof actual] !== value) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: `Summary ${key} does not match shot rows.`, path: ["summary", key] });
    }
  }
});

export type PaperDollMasterShotList = z.infer<typeof PaperDollMasterShotListSchema>;
export type PaperDollMasterShotRow = z.infer<typeof PaperDollMasterShotRowSchema>;

export function parsePaperDollMasterShotList(value: unknown): PaperDollMasterShotList {
  return PaperDollMasterShotListSchema.parse(value);
}
