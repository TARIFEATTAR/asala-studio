import { z } from "zod";

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const dimensionFieldPattern = /^(\d+(?:\.\d+)?)\s*±\s*(\d+(?:\.\d+)?)\s*mm$/i;

function parseDimensionField(value: string): { value: number; tolerance: number } | null {
  const match = value.match(dimensionFieldPattern);
  return match ? { value: Number(match[1]), tolerance: Number(match[2]) } : null;
}

const materialSchema = z.enum([
  "mirror-silver",
  "matte-silver",
  "mirror-gold",
  "matte-gold",
  "matte-black",
  "glossy-black",
  "matte-copper",
  "glossy-white",
  "matte-pink",
  "faux-leather-black",
  "faux-leather-brown",
  "faux-leather-light-brown",
  "faux-leather-ivory",
  "faux-leather-pink",
]);

const variantSchema = z.object({
  variantKey: z.string().regex(/^[A-Z0-9]+$/),
  sourceIdentity: z.string().min(1),
  graceSku: z.string().min(1),
  material: materialSchema,
  trimMaterial: materialSchema.optional(),
  decoration: z.enum(["none", "crystal-v1"]),
  geometryFamilyId: z.string().min(1),
});

const crystalSchema = z.object({
  id: z.string().min(1),
  angleDeg: z.number().min(-89).max(89),
  heightRatio: z.number().positive().lt(1),
  scaleRatio: z.number().positive().lt(0.1),
});

const trimBandSchema = z.object({
  startHeightRatio: z.number().min(0).max(1),
  endHeightRatio: z.number().min(0).max(1),
  evidenceState: z.literal("source-derived-review-candidate"),
});

const surfaceProfileSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("smooth"),
  }),
  z.object({
    kind: z.literal("recessed-vertical-flutes"),
    fluteCount: z.number().int().min(12).max(96),
    fluteDepthRatio: z.number().positive().max(0.05),
    startHeightRatio: z.number().min(0.05).max(0.4),
    endHeightRatio: z.number().min(0.6).max(0.98),
    fadeRatio: z.number().positive().max(0.1),
    phaseDeg: z.number().min(-180).max(180),
    evidenceState: z.literal("source-derived-review-candidate"),
  }),
]);

const parametricOvercapFamilyRecipeSchema = z.object({
  schemaVersion: z.literal(1),
  recipeId: z.string().min(1),
  familyKey: z.string().min(1),
  neckFinish: z.string().min(1),
  geometryFamilyId: z.string().min(1),
  authorityReviewGroupKey: z.string().min(1),
  authorityState: z.literal("dimension-calibrated-profile-review"),
  authorityReference: z.object({
    sourceIdentity: z.string().min(1),
    sourceSha256: sha256Schema,
    sourceUrl: z.string().url(),
    localReviewPath: z.string().min(1),
    status: z.literal("calibration-reference-not-approved-authority"),
  }),
  physicalTruthSource: z.object({
    path: z.string().min(1),
    websiteSku: z.string().min(1),
    fields: z.object({
      heightWithCap: z.string().min(1),
      diameter: z.string().min(1),
    }),
  }),
  nominalDimensionsMm: z.object({
    outsideDiameter: z.number().positive(),
    outsideDiameterTolerance: z.number().nonnegative(),
    height: z.number().positive(),
    heightTolerance: z.number().nonnegative(),
    verified: z.literal(true),
  }),
  geometryCalibration: z.object({
    heightScale: z.number().positive(),
    derivedFrom: z.string().min(1),
  }),
  profileNormalized: z.array(z.tuple([z.number().min(0).max(0.5), z.number().min(0).max(1)])).min(4),
  surfaceProfile: surfaceProfileSchema.default({ kind: "smooth" }),
  trimBands: z.array(trimBandSchema).default([]),
  render: z.object({
    widthPx: z.literal(1400),
    heightPx: z.literal(2050),
    samples: z.number().int().positive(),
    topArcRatio: z.number().min(0).max(0.1),
  }),
  canvas: z.object({
    widthPx: z.literal(2080),
    heightPx: z.literal(2288),
    backgroundHex: z.literal("#F5F3EF"),
  }),
  variants: z.array(variantSchema).min(1),
  crystalLayout: z.array(crystalSchema),
  mutationPolicy: z.object({
    candidatesCreated: z.literal(false),
    remoteWritesPerformed: z.literal(false),
    currentReleaseChanged: z.literal(false),
    sanityChanged: z.literal(false),
  }),
}).superRefine((recipe, context) => {
  const unique = (values: string[]) => new Set(values).size === values.length;
  const heightField = parseDimensionField(recipe.physicalTruthSource.fields.heightWithCap);
  const diameterField = parseDimensionField(recipe.physicalTruthSource.fields.diameter);
  if (!heightField || heightField.value !== recipe.nominalDimensionsMm.height || heightField.tolerance !== recipe.nominalDimensionsMm.heightTolerance) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["physicalTruthSource", "fields", "heightWithCap"], message: "Height field must match nominal dimensions." });
  }
  if (!diameterField || diameterField.value !== recipe.nominalDimensionsMm.outsideDiameter || diameterField.tolerance !== recipe.nominalDimensionsMm.outsideDiameterTolerance) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["physicalTruthSource", "fields", "diameter"], message: "Diameter field must match nominal dimensions." });
  }
  if (!unique(recipe.variants.map((variant) => variant.variantKey))) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["variants"], message: "Variant keys must be unique." });
  }
  if (!unique(recipe.variants.map((variant) => variant.sourceIdentity))) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["variants"], message: "Source identities must be unique." });
  }
  if (!unique(recipe.variants.map((variant) => variant.graceSku))) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["variants"], message: "Grace SKUs must be unique." });
  }
  if (recipe.variants.some((variant) => variant.geometryFamilyId !== recipe.geometryFamilyId)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["variants"], message: "Every variant must reference the recipe geometry family." });
  }
  if (!unique(recipe.crystalLayout.map((crystal) => crystal.id))) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["crystalLayout"], message: "Crystal IDs must be unique." });
  }
  const decorated = recipe.variants.some((variant) => variant.decoration === "crystal-v1");
  if (decorated && recipe.crystalLayout.length === 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["crystalLayout"], message: "Decorated variants require a deterministic crystal layout." });
  }
  if (
    recipe.surfaceProfile.kind === "recessed-vertical-flutes"
    && recipe.surfaceProfile.startHeightRatio + recipe.surfaceProfile.fadeRatio * 2 >= recipe.surfaceProfile.endHeightRatio
  ) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["surfaceProfile"], message: "Flute fade zones must fit between the declared start and end heights." });
  }
  const sortedTrimBands = [...recipe.trimBands].sort((left, right) => left.startHeightRatio - right.startHeightRatio);
  for (const [index, band] of sortedTrimBands.entries()) {
    if (band.startHeightRatio >= band.endHeightRatio) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["trimBands"], message: "Trim bands must have a positive height span." });
    }
    const previous = sortedTrimBands[index - 1];
    if (previous && previous.endHeightRatio > band.startHeightRatio) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["trimBands"], message: "Trim bands must not overlap." });
    }
  }
  if (recipe.trimBands.length === 0 && recipe.variants.some((variant) => variant.trimMaterial)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["variants"], message: "A trim material requires declared trim bands." });
  }
  if (recipe.trimBands.length > 0 && recipe.variants.some((variant) => !variant.trimMaterial)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["variants"], message: "Every variant requires a trim material when trim bands are declared." });
  }
});

export type ParametricOvercapFamilyRecipe = z.infer<typeof parametricOvercapFamilyRecipeSchema>;

export function parseParametricOvercapFamilyRecipe(value: unknown): ParametricOvercapFamilyRecipe {
  return parametricOvercapFamilyRecipeSchema.parse(value);
}

export function buildParametricOvercapRenderPlan(recipe: ParametricOvercapFamilyRecipe) {
  return {
    recipeId: recipe.recipeId,
    geometryFamilyId: recipe.geometryFamilyId,
    variantCount: recipe.variants.length,
    variantKeys: recipe.variants.map((variant) => variant.variantKey),
    authorityState: recipe.authorityState,
    geometryLocked: false as const,
    productionPlateEligible: false as const,
    requiresExactAlphaClamp: true as const,
    remoteWritesAuthorized: false as const,
  };
}
