import type { z } from "zod";

import { ComponentMaterialClassSchema } from "./componentPlateContract";

type ComponentMaterialClass = z.infer<typeof ComponentMaterialClassSchema>;

export interface ComponentMaterialPromptInput {
  componentLabel: string;
  materialClass: ComponentMaterialClass;
  physicalSubstrate: string;
  finishDescription: string;
  rhinestoneIds?: string[];
}

const MATERIAL_RULES: Record<ComponentMaterialClass, string> = {
  mirror: [
    "Render a thin, conforming metallized coating with controlled studio reflections and clean vertical highlight structure.",
    "The part remains lightweight molded plastic beneath the coating, with the consistent wall character and gently radiused edges of premium cosmetic packaging.",
  ].join(" "),
  matte: [
    "Render a genuinely diffuse micro-rough coating with soft, broad light response.",
    "Do not reuse mirror-chrome reflection bands, metallic flake, or brushed-metal grain.",
  ].join(" "),
  "glossy-dielectric": [
    "Render a smooth, high-gloss dielectric coating over the declared molded substrate.",
    "Keep dielectric Fresnel highlights; do not make the part metallic.",
  ].join(" "),
  translucent: [
    "Retain material transmission, edge density, and subtle internal optical depth; do not flatten transparency into opaque white or gray.",
    "This material requires assembly-context review over every compatible body before approval.",
  ].join(" "),
  "roller-plastic": [
    "Render molded natural plastic with restrained dielectric highlights and visible but neutral translucency appropriate to the physical part.",
    "Do not make the plastic housing metallic or opaque painted white.",
  ].join(" "),
  "roller-steel-ball": [
    "Change only the roller ball to polished stainless-steel reflection behavior while retaining the molded plastic housing exactly as declared.",
    "Do not metallize the housing.",
  ].join(" "),
  rhinestone: [
    "Preserve every registered rhinestone as an individually placed optical element.",
    "Do not add, remove, move, resize, or reorder any rhinestone.",
  ].join(" "),
};

export function buildComponentMaterialPrompt(input: ComponentMaterialPromptInput): string {
  const materialClass = ComponentMaterialClassSchema.parse(input.materialClass);
  const lines = [
    `Edit the ${input.componentLabel}.`,
    "Change surface pixels only.",
    "Treat the supplied image as material and lighting evidence only; its framing, silhouette, and alpha are not geometry authority.",
    `Physical substrate: ${input.physicalSubstrate}.`,
    `Target finish: ${input.finishDescription}.`,
    MATERIAL_RULES[materialClass],
    "Preserve the established camera direction, catalog lighting direction, and premium product-photography realism.",
    "Return one clean material treatment with no background contamination, detached islands, labels, shadows, or added hardware.",
  ];

  if (materialClass === "rhinestone") {
    if (!input.rhinestoneIds?.length) {
      throw new Error("Rhinestone material prompts require stable rhinestone IDs.");
    }
    lines.push(`Registered rhinestone IDs, in immutable order: ${input.rhinestoneIds.join(", ")}.`);
  }

  return lines.join("\n");
}
