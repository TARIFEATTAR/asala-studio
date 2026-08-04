import { z } from "zod";

const ComponentResponsibilitySchema = z.enum([
  "exterior-dispenser",
  "secondary-overcap",
  "internal-delivery",
  "visible-insert",
  "decorative-accessory",
  "integration-effect",
]);

const ComponentOutputPolicySchema = z.enum([
  "reusable-full-canvas-plate",
  "compound-with-exterior-swatches",
  "body-contextual-weld",
  "source-evidence-only",
]);

const ComponentReviewFramingSchema = z.enum([
  "center-nontransparent-bounds",
  "preserve-source-bounds",
]);

const ComponentProductionAnchorSchema = z.enum([
  "mount-axis-seat",
  "body-centerline-to-interior-base",
  "component-bounds-center",
  "component-relative",
  "not-applicable",
]);

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);

const CatalogProductContractSchema = z.object({
  familyKey: z.string().min(1),
  catalogProductId: z.string().min(1),
  referenceUrl: z.string().url(),
  capacityMl: z.number().positive(),
  bodyHeightMm: z.number().positive(),
  bodyDiameterMm: z.number().positive(),
  assembledHeightMm: z.number().positive(),
  assembledHeightToleranceMm: z.number().nonnegative(),
  neckSizeMm: z.number().positive(),
  applicatorClass: z.string().min(1),
  placementAuthorityScope: z.enum(["family-specific", "shared-exact-geometry"]),
});

const ComponentKitSourceSchema = z.object({
  sourceId: z.string().min(1),
  sourceType: z.enum([
    "photoshop-layered-source",
    "catalog-composite-reference",
    "existing-paper-doll-asset",
  ]),
  originalFilename: z.string().min(1).refine(
    (value) => !/[\\/]/.test(value),
    "Original filename must not contain path separators.",
  ),
  archiveRelativePath: z.string().min(1).optional(),
  repositoryRelativePath: z.string().min(1).optional(),
  referenceUrl: z.string().url().optional(),
  sha256: Sha256Schema.optional(),
  productionEligible: z.literal(false),
}).superRefine((source, context) => {
  if (source.sourceType === "photoshop-layered-source") {
    if (!source.archiveRelativePath) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Photoshop source requires an archive-relative path.",
        path: ["archiveRelativePath"],
      });
    }
    if (!source.sha256) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Photoshop source requires an immutable SHA-256.",
        path: ["sha256"],
      });
    }
  }
  if (source.sourceType === "catalog-composite-reference" && !source.referenceUrl) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Catalog composite reference requires a source URL.",
      path: ["referenceUrl"],
    });
  }
  if (source.sourceType === "existing-paper-doll-asset") {
    if (!source.repositoryRelativePath) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Existing paper-doll asset requires a repository-relative path.",
        path: ["repositoryRelativePath"],
      });
    }
    if (!source.sha256) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Existing paper-doll asset requires an immutable SHA-256.",
        path: ["sha256"],
      });
    }
  }
});

const ComponentSourceSelectorSchema = z.discriminatedUnion("method", [
  z.object({
    sourceId: z.string().min(1),
    method: z.literal("psd-layer-scene"),
    sceneIndex: z.number().int().nonnegative(),
    layerName: z.string().min(1),
  }),
  z.object({
    sourceId: z.string().min(1),
    method: z.literal("psd-layer-composite"),
    sceneIndices: z.array(z.number().int().nonnegative()).min(2),
    layerNames: z.array(z.string().min(1)).min(2),
  }),
  z.object({
    sourceId: z.string().min(1),
    method: z.literal("reviewed-selection-mask"),
  }),
]);

const ComponentKitPartSchema = z.object({
  partId: z.string().min(1),
  responsibility: ComponentResponsibilitySchema,
  outputPolicy: ComponentOutputPolicySchema,
  reviewFraming: ComponentReviewFramingSchema,
  productionAnchor: ComponentProductionAnchorSchema,
  independentlySelectable: z.boolean(),
  assemblyContextQa: z.boolean(),
  compoundWithPartId: z.string().min(1).optional(),
  sourceSelectors: z.array(ComponentSourceSelectorSchema).min(1),
});

export const ComponentKitDecompositionSchema = z.object({
  schemaVersion: z.literal(1),
  kitId: z.string().min(1),
  sourceReviewGroupKey: z.string().min(1),
  sourceCompositeProductionEligible: z.literal(false),
  authorityState: z.enum(["source-candidate-present", "exact-authority-required"]).optional(),
  primaryAuthorityPartId: z.string().min(1).optional(),
  canonicalCanvas: z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  }),
  catalogProductContracts: z.array(CatalogProductContractSchema).min(1).optional(),
  sources: z.array(ComponentKitSourceSchema).min(1),
  parts: z.array(ComponentKitPartSchema).min(2),
}).superRefine((kit, context) => {
  if (kit.catalogProductContracts) {
    const familyKeys = kit.catalogProductContracts.map((contract) => contract.familyKey);
    if (new Set(familyKeys).size !== familyKeys.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Catalog product contract family keys must be unique.",
        path: ["catalogProductContracts"],
      });
    }
  }

  const partIds = kit.parts.map((part) => part.partId);
  if (new Set(partIds).size !== partIds.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Component kit part IDs must be unique.",
      path: ["parts"],
    });
  }

  const sourceIds = kit.sources.map((source) => source.sourceId);
  if (new Set(sourceIds).size !== sourceIds.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Component kit source IDs must be unique.",
      path: ["sources"],
    });
  }
  const sourceById = new Map(kit.sources.map((source) => [source.sourceId, source]));

  const exteriorParts = kit.parts.filter((part) => part.responsibility === "exterior-dispenser");
  const exactAuthorityRequired = kit.authorityState === "exact-authority-required";
  const namedPrimary = kit.primaryAuthorityPartId
    ? kit.parts.find((part) => part.partId === kit.primaryAuthorityPartId)
    : undefined;
  if (exactAuthorityRequired) {
    const unresolvedExteriorIsReviewOnly = !kit.primaryAuthorityPartId
      && exteriorParts.length === 1
      && exteriorParts[0].outputPolicy === "source-evidence-only"
      && exteriorParts[0].productionAnchor === "not-applicable"
      && !exteriorParts[0].independentlySelectable;
    if (!unresolvedExteriorIsReviewOnly) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A kit awaiting exact authority must retain exactly one non-selectable exterior responsibility as source evidence only.",
        path: ["parts"],
      });
    }
  } else if (kit.primaryAuthorityPartId) {
    const namedPrimaryIsValid = namedPrimary
      && (namedPrimary.responsibility === "exterior-dispenser" || namedPrimary.responsibility === "visible-insert")
      && namedPrimary.outputPolicy === "reusable-full-canvas-plate"
      && namedPrimary.productionAnchor === "mount-axis-seat"
      && namedPrimary.independentlySelectable;
    const exteriorSetIsUnambiguous = namedPrimary?.responsibility === "exterior-dispenser"
      ? exteriorParts.length === 1 && exteriorParts[0].partId === namedPrimary.partId
      : exteriorParts.length === 0;
    if (!namedPrimaryIsValid || !exteriorSetIsUnambiguous) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Primary component authority must be a reusable exterior dispenser or visible insert anchored to the physical mount axis.",
        path: ["primaryAuthorityPartId"],
      });
    }
  } else if (exteriorParts.length !== 1) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Component kit must declare exactly one exterior dispenser authority.",
      path: ["parts"],
    });
  }

  kit.parts.forEach((part, index) => {
    part.sourceSelectors.forEach((selector, selectorIndex) => {
      const source = sourceById.get(selector.sourceId);
      if (!source) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Unknown component-kit source ${selector.sourceId}.`,
          path: ["parts", index, "sourceSelectors", selectorIndex, "sourceId"],
        });
      } else if (
        (selector.method === "psd-layer-scene" || selector.method === "psd-layer-composite")
        && source.sourceType !== "photoshop-layered-source"
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "PSD layer selectors require a Photoshop layered source.",
          path: ["parts", index, "sourceSelectors", selectorIndex],
        });
      }
      if (
        selector.method === "psd-layer-composite"
        && (
          selector.sceneIndices.length !== selector.layerNames.length
          || new Set(selector.sceneIndices).size !== selector.sceneIndices.length
        )
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Photoshop scene composites require unique scenes and one layer name per scene.",
          path: ["parts", index, "sourceSelectors", selectorIndex, "sceneIndices"],
        });
      }
    });

    if (
      part.responsibility === "internal-delivery"
      && (
        part.outputPolicy !== "body-contextual-weld"
        || part.productionAnchor !== "body-centerline-to-interior-base"
      )
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Internal delivery must remain body-contextual and anchored from the body centerline to the interior base.",
        path: ["parts", index],
      });
    }

    if (
      part.responsibility === "secondary-overcap"
      && part.outputPolicy === "reusable-full-canvas-plate"
      && !part.independentlySelectable
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Secondary overcap must be its own reusable plate and independently selectable.",
        path: ["parts", index],
      });
    }

    if (part.responsibility === "secondary-overcap" && part.outputPolicy === "compound-with-exterior-swatches") {
      const companion = part.compoundWithPartId
        ? kit.parts.find((candidate) => candidate.partId === part.compoundWithPartId)
        : undefined;
      if (part.independentlySelectable) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Compound overcap swatches cannot be independently selected.",
          path: ["parts", index, "independentlySelectable"],
        });
      }
      if (part.productionAnchor !== "component-relative") {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Compound overcap swatches must be anchored relative to their exterior dispenser.",
          path: ["parts", index, "productionAnchor"],
        });
      }
      if (!companion || companion.responsibility !== "exterior-dispenser") {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Compound overcap swatches must reference the exterior dispenser part.",
          path: ["parts", index, "compoundWithPartId"],
        });
      }
    } else if (
      part.responsibility === "secondary-overcap"
      && part.outputPolicy !== "reusable-full-canvas-plate"
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Secondary overcap must be its own reusable plate or composed into exterior assembly swatches.",
        path: ["parts", index, "outputPolicy"],
      });
    }

    if (
      part.responsibility === "exterior-dispenser"
      && !exactAuthorityRequired
      && (
        part.outputPolicy !== "reusable-full-canvas-plate"
        || part.productionAnchor !== "mount-axis-seat"
      )
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Exterior dispenser must use the physical mount-axis seat as its reusable-plate anchor.",
        path: ["parts", index],
      });
    }

    if (
      part.responsibility === "visible-insert"
      && part.outputPolicy === "reusable-full-canvas-plate"
      && (
        part.productionAnchor !== "mount-axis-seat"
        || !part.independentlySelectable
      )
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Reusable visible insert must use the physical mount-axis seat and remain independently selectable.",
        path: ["parts", index],
      });
    }

    if (
      part.outputPolicy === "reusable-full-canvas-plate"
      && part.reviewFraming !== "center-nontransparent-bounds"
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Reusable plates must be inspected with their non-transparent bounds centered.",
        path: ["parts", index, "reviewFraming"],
      });
    }
  });
});

export type ComponentKitDecomposition = z.infer<typeof ComponentKitDecompositionSchema>;

export interface ComponentKitDecompositionPlan {
  kitId: string;
  reusablePlatePartIds: string[];
  compoundSwatchPartIds: string[];
  bodyContextualPartIds: string[];
  sourceEvidencePartIds: string[];
  productionPlateCount: number;
  requiresAssemblyContextQa: boolean;
}

export function parseComponentKitDecomposition(value: unknown): ComponentKitDecomposition {
  return ComponentKitDecompositionSchema.parse(value);
}

export function buildComponentKitDecompositionPlan(
  value: unknown,
): ComponentKitDecompositionPlan {
  const kit = parseComponentKitDecomposition(value);
  const reusablePlatePartIds = kit.parts
    .filter((part) => part.outputPolicy === "reusable-full-canvas-plate")
    .map((part) => part.partId);
  const compoundSwatchPartIds = kit.parts
    .filter((part) => part.outputPolicy === "compound-with-exterior-swatches")
    .map((part) => part.partId);
  return {
    kitId: kit.kitId,
    reusablePlatePartIds,
    compoundSwatchPartIds,
    bodyContextualPartIds: kit.parts
      .filter((part) => part.outputPolicy === "body-contextual-weld")
      .map((part) => part.partId),
    sourceEvidencePartIds: kit.parts
      .filter((part) => part.outputPolicy === "source-evidence-only")
      .map((part) => part.partId),
    productionPlateCount: reusablePlatePartIds.length + compoundSwatchPartIds.length,
    requiresAssemblyContextQa: kit.parts.some((part) => part.assemblyContextQa),
  };
}
