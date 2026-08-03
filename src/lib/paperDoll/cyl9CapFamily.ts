import { z } from "zod";

import {
  solveLockedPixelPlacement,
  type LockedPixelPlacement,
} from "./closureMaterialPilot";

export const CYL9_CAP_VARIANT_KEYS = [
  "SSLV",
  "MSLV",
  "SGLD",
  "MGLD",
  "SBLK",
  "MCPR",
  "WHT",
  "SLDT",
  "BKDT",
  "PKDT",
] as const;

export type Cyl9CapVariantKey = (typeof CYL9_CAP_VARIANT_KEYS)[number];

const Cyl9CapVariantSchema = z.object({
  variantKey: z.enum(CYL9_CAP_VARIANT_KEYS),
  material: z.enum([
    "mirror-silver",
    "matte-silver",
    "mirror-gold",
    "matte-gold",
    "glossy-black",
    "matte-copper",
    "glossy-white",
    "matte-pink",
  ]),
  decoration: z.enum(["none", "crystal-v1"]),
});

const Cyl9CrystalSchema = z.object({
  id: z.string().min(1),
  angleDeg: z.number().min(-89).max(89),
  heightRatio: z.number().positive().lt(1),
  scaleRatio: z.number().positive().lt(0.1),
});

const Cyl9CapFamilyRecipeSchema = z.object({
  schemaVersion: z.literal(1),
  familyKey: z.literal("CYL-9ML"),
  geometryFamilyId: z.literal("closure__17-415__rollon-overcap__v2"),
  authorityImagePath: z.string().min(1),
  nominalDimensionsMm: z.object({
    outsideDiameter: z.number().positive(),
    height: z.number().positive(),
    verified: z.boolean(),
  }),
  geometryCalibration: z.object({
    heightScale: z.number().gt(0.95).lt(1.05),
    derivedFrom: z.literal("photographic-authority-alpha-v1"),
  }),
  render: z.object({
    widthPx: z.literal(1400),
    heightPx: z.literal(2050),
    samples: z.number().int().positive(),
    topArcRatio: z.number().min(0).max(0.1),
  }),
  placement: z.object({
    canvasWidthPx: z.literal(2080),
    canvasHeightPx: z.literal(2288),
    widthPx: z.literal(344, {
      errorMap: () => ({ message: "CYL-9ML cap calibration must remain 344 px wide." }),
    }),
    centerX: z.literal(1041),
    bottomY: z.literal(1002),
  }),
  variants: z.array(Cyl9CapVariantSchema).length(10),
  crystalLayout: z.array(Cyl9CrystalSchema).min(1),
}).superRefine((recipe, context) => {
  const actualKeys = recipe.variants.map(({ variantKey }) => variantKey);
  if (
    actualKeys.length !== CYL9_CAP_VARIANT_KEYS.length ||
    actualKeys.some((key, index) => key !== CYL9_CAP_VARIANT_KEYS[index])
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["variants"],
      message: "Recipe must contain the exact ten catalog variant keys in canonical order.",
    });
  }

  if (new Set(recipe.crystalLayout.map(({ id }) => id)).size !== recipe.crystalLayout.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["crystalLayout"],
      message: "Crystal layout IDs must be unique.",
    });
  }
});

export type Cyl9CapFamilyRecipe = z.infer<typeof Cyl9CapFamilyRecipeSchema>;

export function parseCyl9CapFamilyRecipe(value: unknown): Cyl9CapFamilyRecipe {
  return Cyl9CapFamilyRecipeSchema.parse(value);
}

export function solveCyl9CapPlacement(
  sourceWidth: number,
  sourceHeight: number,
  recipe: Cyl9CapFamilyRecipe,
): LockedPixelPlacement {
  return solveLockedPixelPlacement({
    sourceWidth,
    sourceHeight,
    targetWidth: recipe.placement.widthPx,
    centerX: recipe.placement.centerX,
    bottomY: recipe.placement.bottomY,
  });
}

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);

const Cyl9BlenderProvenanceSchema = z.object({
  meshRecipeHash: Sha256Schema,
  cameraRecipeHash: Sha256Schema,
  studioRecipeHash: Sha256Schema,
  maskRecipeHash: Sha256Schema,
});

const Cyl9CrystalTransformSchema = z.object({
  id: z.string().min(1),
  angleDeg: z.number(),
  heightRatio: z.number(),
  scaleRatio: z.number(),
});

const Cyl9BlenderManifestSchema = z.object({
  schemaVersion: z.literal(1),
  geometryFamilyId: z.literal("closure__17-415__rollon-overcap__v2"),
  blenderVersion: z.string().min(1),
  maskPath: z.string().min(1),
  sharedProvenance: Cyl9BlenderProvenanceSchema,
  renders: z.array(z.object({
    variantKey: z.enum(CYL9_CAP_VARIANT_KEYS),
    path: z.string().min(1),
    provenance: Cyl9BlenderProvenanceSchema,
    crystals: z.array(Cyl9CrystalTransformSchema),
  })).min(1),
}).superRefine((manifest, context) => {
  const authority = manifest.renders.find(({ variantKey }) => variantKey === "SSLV");
  if (!authority) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["renders"],
      message: "Blender manifest must include the SSLV authority render.",
    });
    return;
  }

  const fields = [
    "meshRecipeHash",
    "cameraRecipeHash",
    "studioRecipeHash",
    "maskRecipeHash",
  ] as const;
  for (const [index, render] of manifest.renders.entries()) {
    for (const field of fields) {
      if (render.provenance[field] !== authority.provenance[field]) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["renders", index, "provenance", field],
          message: `${render.variantKey} ${field} differs from SSLV authority.`,
        });
      }
      if (render.provenance[field] !== manifest.sharedProvenance[field]) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["renders", index, "provenance", field],
          message: `${render.variantKey} ${field} differs from shared provenance.`,
        });
      }
    }
  }
});

export type Cyl9BlenderManifest = z.infer<typeof Cyl9BlenderManifestSchema>;

export function parseCyl9BlenderManifest(value: unknown): Cyl9BlenderManifest {
  return Cyl9BlenderManifestSchema.parse(value);
}
