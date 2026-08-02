import { z } from "zod";

export const PAPER_DOLL_RELEASE_SCHEMA_VERSION = 1 as const;
export const PAPER_DOLL_RELEASE_CANVAS = {
  widthPx: 2080,
  heightPx: 2288,
  backgroundHex: "#F5F3EF",
} as const;

export const PaperDollSlotSchema = z.enum([
  "body",
  "cap",
  "roller",
  "sprayer",
  "overcap",
  "pump",
]);

export const PaperDollReleaseStatusSchema = z.enum([
  "draft",
  "validating",
  "blocked",
  "ready",
  "published",
  "superseded",
]);

export const PaperDollQaStatusSchema = z.enum([
  "passed",
  "failed",
  "advisory",
  "blocked",
]);

export const PaperDollReleaseAssetSchema = z.object({
  componentVersionId: z.string().min(1),
  componentKey: z.string().min(1),
  geometryFamilyId: z.string().min(1),
  slot: PaperDollSlotSchema,
  variantKey: z.string().min(1),
  materialVariant: z.string().min(1),
  imagePath: z.string().min(1),
  imageSha256: z.string().regex(/^[a-f0-9]{64}$/),
  geometryMaskPath: z.string().min(1).nullable(),
  geometryMaskSha256: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  widthPx: z.literal(PAPER_DOLL_RELEASE_CANVAS.widthPx),
  heightPx: z.literal(PAPER_DOLL_RELEASE_CANVAS.heightPx),
  alphaBounds: z.object({
    left: z.number().int().nonnegative(),
    top: z.number().int().nonnegative(),
    right: z.number().int().nonnegative(),
    bottom: z.number().int().nonnegative(),
  }),
  mountAxisXPx: z.number(),
  seatYPx: z.number(),
  approvalStatus: z.enum(["candidate", "blocked", "approved", "rejected"]),
});

export const PaperDollQaEvidenceSchema = z.object({
  evidenceId: z.string().min(1),
  subjectId: z.string().min(1),
  gateKey: z.string().min(1),
  gateVersion: z.string().min(1),
  status: PaperDollQaStatusSchema,
  blocking: z.boolean(),
  calibratedWith: z.array(z.string().min(1)),
  measurements: z.record(z.unknown()),
  issues: z.array(z.string()),
});

export const PaperDollReleaseManifestSchema = z.object({
  schemaVersion: z.literal(PAPER_DOLL_RELEASE_SCHEMA_VERSION),
  familyKey: z.string().min(1),
  releaseVersion: z.string().min(1),
  status: PaperDollReleaseStatusSchema,
  canvas: z.object({
    widthPx: z.literal(PAPER_DOLL_RELEASE_CANVAS.widthPx),
    heightPx: z.literal(PAPER_DOLL_RELEASE_CANVAS.heightPx),
    backgroundHex: z.literal(PAPER_DOLL_RELEASE_CANVAS.backgroundHex),
  }),
  assets: z.array(PaperDollReleaseAssetSchema),
  assemblyRecipes: z.array(z.object({
    recipeKey: z.string().min(1),
    mode: z.enum(["rollon", "spray", "lotion", "closure"]),
    layerOrder: z.array(PaperDollSlotSchema).min(1),
  })),
  assemblyMappings: z.array(z.object({
    mappingKey: z.string().min(1),
    websiteSku: z.string().min(1),
    graceSku: z.string().min(1),
    recipeKey: z.string().min(1),
    bodyVariantKey: z.string().min(1),
    fitmentVariantKey: z.string().min(1).nullable(),
    closureVariantKey: z.string().min(1).nullable(),
    overcapVariantKey: z.string().min(1).nullable(),
  })),
  qaEvidence: z.array(PaperDollQaEvidenceSchema),
  blockers: z.array(z.string()),
  provenance: z.object({
    sourceGitCommit: z.string().min(1),
    rendererVersion: z.string().min(1),
  }),
});

export type PaperDollSlot = z.infer<typeof PaperDollSlotSchema>;
export type PaperDollReleaseAsset = z.infer<typeof PaperDollReleaseAssetSchema>;
export type PaperDollQaEvidence = z.infer<typeof PaperDollQaEvidenceSchema>;
export type PaperDollReleaseManifest = z.infer<typeof PaperDollReleaseManifestSchema>;

export function parsePaperDollReleaseManifest(value: unknown): PaperDollReleaseManifest {
  return PaperDollReleaseManifestSchema.parse(value);
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, sortValue(entry)]),
    );
  }
  return value;
}

export function canonicalizeReleaseValue(value: unknown): string {
  return JSON.stringify(sortValue(value));
}
