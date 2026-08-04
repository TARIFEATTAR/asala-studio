import { z } from "zod";

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const geometryFamilyId = z.string().min(1);

const variantSchema = z.object({
  variantKey: z.enum(["PLASTIC", "METAL"]),
  componentId: z.string().min(1),
  geometryFamilyId,
  housingMaterial: z.literal("natural-molded-plastic"),
  ballMaterial: z.enum(["natural-molded-plastic", "mirror-chrome"]),
});

const parametricRollerFitmentRecipeSchema = z.object({
  schemaVersion: z.literal(1),
  recipeId: z.string().min(1),
  familyKey: z.string().min(1),
  componentKind: z.literal("roller-fitment"),
  neckFinish: z.string().min(1),
  geometryFamilyId,
  authorityReviewGroupKey: z.string().min(1),
  authorityState: z.literal("assembly-calibrated-profile-review"),
  authorityReference: z.object({
    sourceIdentity: z.string().min(1),
    sourceSha256: sha256Schema,
    sourcePath: z.string().min(1),
    sceneIndex: z.number().int().nonnegative(),
    status: z.literal("calibration-reference-not-approved-authority"),
  }),
  physicalTruthSource: z.object({
    path: z.string().min(1),
    websiteSku: z.string().min(1),
    sourceProductUrl: z.string().url(),
    bodyDiameterField: z.string().min(1),
  }),
  geometryCalibration: z.object({
    evidenceState: z.literal("assembly-derived-estimate-not-supplier-cad"),
    sourceBodyDiameterMm: z.number().positive(),
    measuredBodyWidthPx: z.number().int().positive(),
    pixelsPerMm: z.number().positive(),
    sourceFitmentBoundsPx: z.object({
      width: z.number().int().positive(),
      height: z.number().int().positive(),
    }),
    measurementToleranceMm: z.number().positive(),
    derivedFrom: z.string().min(1),
  }),
  geometry: z.object({
    flangeOutsideDiameterMm: z.number().positive(),
    flangeThicknessMm: z.number().positive(),
    housingOutsideDiameterMm: z.number().positive(),
    housingCylinderHeightMm: z.number().positive(),
    shoulderHeightMm: z.number().positive(),
    ballDiameterMm: z.number().positive(),
    ballCenterZMm: z.number().positive(),
    visibleHeightMm: z.number().positive(),
  }),
  render: z.object({
    widthPx: z.literal(2080),
    heightPx: z.literal(2288),
    samples: z.number().int().positive(),
    topArcRatio: z.number().min(0).max(0.1),
    targetOccupiedHeightPx: z.number().int().min(200).max(900),
  }),
  canvas: z.object({
    widthPx: z.literal(2080),
    heightPx: z.literal(2288),
    backgroundHex: z.literal("#F5F3EF"),
  }),
  variants: z.tuple([variantSchema, variantSchema]),
  mutationPolicy: z.object({
    candidatesCreated: z.literal(false),
    paidGenerationAuthorized: z.literal(false),
    remoteWritesPerformed: z.literal(false),
    currentReleaseChanged: z.literal(false),
    sanityChanged: z.literal(false),
  }),
}).superRefine((recipe, context) => {
  const expectedPixelsPerMm = recipe.geometryCalibration.measuredBodyWidthPx
    / recipe.geometryCalibration.sourceBodyDiameterMm;
  if (Math.abs(recipe.geometryCalibration.pixelsPerMm - expectedPixelsPerMm) > 1e-9) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["geometryCalibration", "pixelsPerMm"],
      message: "pixelsPerMm must equal the measured body width divided by the verified body diameter.",
    });
  }
  const expectedFlangeDiameter = recipe.geometryCalibration.sourceFitmentBoundsPx.width / expectedPixelsPerMm;
  const expectedVisibleHeight = recipe.geometryCalibration.sourceFitmentBoundsPx.height / expectedPixelsPerMm;
  if (Math.abs(recipe.geometry.flangeOutsideDiameterMm - expectedFlangeDiameter) > 0.01) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["geometry", "flangeOutsideDiameterMm"], message: "Flange diameter must retain the recorded assembly calibration." });
  }
  if (Math.abs(recipe.geometry.visibleHeightMm - expectedVisibleHeight) > 0.01) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["geometry", "visibleHeightMm"], message: "Visible height must retain the recorded assembly calibration." });
  }
  if (recipe.geometry.housingOutsideDiameterMm >= recipe.geometry.flangeOutsideDiameterMm) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["geometry", "housingOutsideDiameterMm"], message: "Housing must remain inside the flange diameter." });
  }
  if (recipe.geometry.ballDiameterMm >= recipe.geometry.housingOutsideDiameterMm) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["geometry", "ballDiameterMm"], message: "The roller ball must seat inside the housing diameter." });
  }
  if (recipe.geometry.ballCenterZMm + recipe.geometry.ballDiameterMm / 2 > recipe.geometry.visibleHeightMm + 0.01) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["geometry", "ballCenterZMm"], message: "Ball top exceeds the calibrated visible height." });
  }
  const [plastic, metal] = recipe.variants;
  if (plastic.variantKey !== "PLASTIC" || plastic.ballMaterial !== "natural-molded-plastic") {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["variants", 0], message: "The first canonical variant must be the natural-plastic roller." });
  }
  if (metal.variantKey !== "METAL" || metal.ballMaterial !== "mirror-chrome") {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["variants", 1], message: "The second canonical variant must change only the ball to mirror chrome." });
  }
  if (recipe.variants.some((variant) => variant.geometryFamilyId !== recipe.geometryFamilyId)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["variants"], message: "Every variant must reference the shared geometry family." });
  }
});

export type ParametricRollerFitmentRecipe = z.infer<typeof parametricRollerFitmentRecipeSchema>;

export function parseParametricRollerFitmentRecipe(value: unknown): ParametricRollerFitmentRecipe {
  return parametricRollerFitmentRecipeSchema.parse(value);
}
export function buildParametricRollerFitmentPlan(recipe: ParametricRollerFitmentRecipe) {
  return {
    recipeId: recipe.recipeId,
    geometryFamilyId: recipe.geometryFamilyId,
    variantKeys: recipe.variants.map(({ variantKey }) => variantKey),
    authorityState: recipe.authorityState,
    geometryLocked: false as const,
    productionPlateEligible: false as const,
    requiresExactAlphaClamp: true as const,
    paidGenerationAuthorized: false as const,
    remoteWritesAuthorized: false as const,
  };
}
