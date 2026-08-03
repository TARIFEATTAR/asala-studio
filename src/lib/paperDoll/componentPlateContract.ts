import { z } from "zod";

import {
  PAPER_DOLL_RELEASE_CANVAS,
  PaperDollPixelBoundsSchema,
  PaperDollSlotSchema,
} from "./releaseContract";

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);

export const PixelBoundsSchema = PaperDollPixelBoundsSchema;

export const ComponentSourceSchema = z.object({
  originalFilename: z.string()
    .min(1)
    .refine((value) => !/[\\/]/.test(value), {
      message: "Original filename must not contain path separators.",
    }),
  path: z.string().min(1),
  sha256: Sha256Schema,
  widthPx: z.number().int().positive(),
  heightPx: z.number().int().positive(),
});

export const ComponentAuthoritySchema = z.object({
  authorityId: z.string().min(1),
  maskPath: z.string().min(1),
  maskSha256: Sha256Schema,
  maskWidthPx: z.literal(PAPER_DOLL_RELEASE_CANVAS.widthPx),
  maskHeightPx: z.literal(PAPER_DOLL_RELEASE_CANVAS.heightPx),
  authorityBoundsPx: PixelBoundsSchema,
  expectedRegions: z.number().int().positive(),
});

export const ComponentPlacementSchema = z.object({
  placementVersionId: z.string().min(1),
  geometryFamilyId: z.string().min(1),
  widthPx: z.number().int().positive(),
  centerXPx: z.number(),
  seatYPx: z.number(),
  placementBoundsPx: PixelBoundsSchema,
  compatibleBodyVariantKeys: z.array(z.string().min(1)).min(1),
  locked: z.boolean(),
});

export const ComponentMaterialClassSchema = z.enum([
  "mirror",
  "matte",
  "glossy-dielectric",
  "translucent",
  "roller-plastic",
  "roller-steel-ball",
  "rhinestone",
]);

export const ComponentCandidateSchema = z.object({
  candidateId: z.string().min(1),
  familyKey: z.string().min(1),
  componentKey: z.string().min(1),
  variantKey: z.string().min(1),
  source: ComponentSourceSchema,
  sourceBoundsPx: PixelBoundsSchema,
  editBoundsPx: PixelBoundsSchema,
  authorityBoundsPx: PixelBoundsSchema,
  placementBoundsPx: PixelBoundsSchema,
  authorityMaskPath: z.string().min(1),
  authorityMaskSha256: Sha256Schema,
  normalizedCandidateSha256: Sha256Schema,
  fullCanvasLayerSha256: Sha256Schema,
  placementVersionId: z.string().min(1).nullable(),
  provider: z.enum([
    "openai",
    "google",
    "higgsfield",
    "manual",
    "blender",
    "deterministic",
  ]),
  model: z.string().min(1),
  promptSha256: Sha256Schema.nullable(),
  estimatedCostUsd: z.number().nonnegative().nullable(),
  qa: z.object({
    geometryLocked: z.boolean(),
    minIoU: z.number().min(0).max(1),
    mismatchedPixels: z.number().int().nonnegative(),
  }),
  mutationPolicy: z.object({
    currentReleaseChanged: z.literal(false),
    sanityChanged: z.literal(false),
  }),
  lifecycleState: z.enum([
    "candidate",
    "pixels-approved",
    "family-fit-approved",
    "placement-locked",
    "released",
    "sanity-draft",
    "published",
    "rejected",
  ]),
}).superRefine((candidate, context) => {
  addBoundsIssue(
    context,
    candidate.sourceBoundsPx,
    candidate.source.widthPx,
    candidate.source.heightPx,
    "sourceBoundsPx",
    "source image",
  );
  addBoundsIssue(
    context,
    candidate.editBoundsPx,
    candidate.source.widthPx,
    candidate.source.heightPx,
    "editBoundsPx",
    "source image",
  );
  addReleaseBoundsIssue(context, candidate.authorityBoundsPx, "authorityBoundsPx");
  addReleaseBoundsIssue(context, candidate.placementBoundsPx, "placementBoundsPx");
});

const ComponentVariantSchema = z.object({
  variantKey: z.string().min(1),
  materialVariant: z.string().min(1),
  materialClass: ComponentMaterialClassSchema,
});

export const FamilyComponentDefinitionSchema = z.object({
  componentKey: z.string().min(1),
  slot: PaperDollSlotSchema,
  geometryFamilyId: z.string().min(1),
  authorityStatus: z.enum(["missing", "calibrating", "approved", "revoked"]),
  authority: ComponentAuthoritySchema.nullable(),
  variants: z.array(ComponentVariantSchema).min(1),
  compatibleBodyVariantKeys: z.array(z.string().min(1)).min(1),
}).superRefine((component, context) => {
  if (component.authorityStatus === "approved" && component.authority === null) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["authority"],
      message: "Approved component authority requires measured mask evidence.",
    });
  }
  if (component.authorityStatus === "missing" && component.authority !== null) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["authority"],
      message: "Missing component authority cannot include mask evidence.",
    });
  }
  if (component.authority) {
    addReleaseBoundsIssue(
      context,
      component.authority.authorityBoundsPx,
      "authority.authorityBoundsPx",
    );
  }
  addDuplicateIssues(
    context,
    component.variants.map((variant) => variant.variantKey),
    ["variants"],
    "variant",
  );
});

const FamilyBodyPlateSchema = z.object({
  bodyVariantKey: z.string().min(1),
  componentVersionId: z.string().min(1),
  imagePath: z.string().min(1),
  imageSha256: Sha256Schema,
});

const FamilyCatalogMappingSchema = z.object({
  mappingKey: z.string().min(1),
  bodyVariantKey: z.string().min(1),
  mode: z.enum(["rollon", "spray", "lotion", "closure"]),
  componentVariantKeys: z.array(z.string().min(1)).min(1),
});

export const PaperDollFamilyProductionManifestSchema = z.object({
  schemaVersion: z.literal(1),
  familyKey: z.string().min(1),
  canvas: z.object({
    widthPx: z.literal(PAPER_DOLL_RELEASE_CANVAS.widthPx),
    heightPx: z.literal(PAPER_DOLL_RELEASE_CANVAS.heightPx),
    backgroundHex: z.literal(PAPER_DOLL_RELEASE_CANVAS.backgroundHex),
  }),
  bodyPlates: z.array(FamilyBodyPlateSchema).min(1),
  components: z.array(FamilyComponentDefinitionSchema).min(1),
  placements: z.array(ComponentPlacementSchema),
  catalogMappings: z.array(FamilyCatalogMappingSchema),
  releaseTarget: z.object({ sanityDocumentId: z.string().min(1) }),
}).superRefine((manifest, context) => {
  addDuplicateIssues(
    context,
    manifest.bodyPlates.map((plate) => plate.bodyVariantKey),
    ["bodyPlates"],
    "body plate",
  );
  addDuplicateIssues(
    context,
    manifest.components.map((component) => component.componentKey),
    ["components"],
    "component",
  );
  addDuplicateIssues(
    context,
    manifest.placements.map((placement) => placement.placementVersionId),
    ["placements"],
    "placement",
  );
  addDuplicateIssues(
    context,
    manifest.catalogMappings.map((mapping) => mapping.mappingKey),
    ["catalogMappings"],
    "catalog mapping",
  );
  manifest.placements.forEach((placement, index) => {
    addReleaseBoundsIssue(
      context,
      placement.placementBoundsPx,
      `placements.${index}.placementBoundsPx`,
    );
  });
});

function boundsFitCanvas(
  bounds: PixelBounds,
  widthPx: number,
  heightPx: number,
): boolean {
  return bounds.left + bounds.width <= widthPx && bounds.top + bounds.height <= heightPx;
}

function addBoundsIssue(
  context: z.RefinementCtx,
  bounds: PixelBounds,
  widthPx: number,
  heightPx: number,
  path: string,
  canvasLabel: string,
): void {
  if (boundsFitCanvas(bounds, widthPx, heightPx)) return;
  context.addIssue({
    code: z.ZodIssueCode.custom,
    path: path.split("."),
    message: `${path} must remain inside the ${canvasLabel}.`,
  });
}

function addReleaseBoundsIssue(
  context: z.RefinementCtx,
  bounds: PixelBounds,
  path: string,
): void {
  addBoundsIssue(
    context,
    bounds,
    PAPER_DOLL_RELEASE_CANVAS.widthPx,
    PAPER_DOLL_RELEASE_CANVAS.heightPx,
    path,
    "release canvas",
  );
}

function addDuplicateIssues(
  context: z.RefinementCtx,
  values: string[],
  path: Array<string | number>,
  label: string,
): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path,
        message: `Duplicate ${label} key: ${value}`,
      });
    }
    seen.add(value);
  }
}

export type PixelBounds = z.infer<typeof PixelBoundsSchema>;
export type ComponentSource = z.infer<typeof ComponentSourceSchema>;
export type ComponentAuthority = z.infer<typeof ComponentAuthoritySchema>;
export type ComponentPlacement = z.infer<typeof ComponentPlacementSchema>;
export type ComponentCandidate = z.infer<typeof ComponentCandidateSchema>;
export type FamilyComponentDefinition = z.infer<typeof FamilyComponentDefinitionSchema>;
export type PaperDollFamilyProductionManifest = z.infer<
  typeof PaperDollFamilyProductionManifestSchema
>;

export function parseComponentCandidate(value: unknown): ComponentCandidate {
  return ComponentCandidateSchema.parse(value);
}

export function parsePaperDollFamilyProductionManifest(
  value: unknown,
): PaperDollFamilyProductionManifest {
  return PaperDollFamilyProductionManifestSchema.parse(value);
}
