export type DarkroomSchematicPromptMode = "whole-product" | "exploded";

const BASE_SCHEMATIC_CONTRACT = [
  "Use the uploaded product image as the locked source of truth.",
  "Preserve the exact product identity, silhouette, proportions, material, color, cap/applicator state, and visible components.",
  "Retain the source image canvas, aspect ratio, crop, centerline, and overall product placement.",
  "Create a refined schematic design on a flat Best Bottles Bone #EEE6D4 background with precise technical linework, restrained luxury editorial polish, subtle soft shadow, and no clutter.",
  "Use elegant thin callout lines and quiet diagram details only where they clarify the product structure.",
  "Do not invent measurements, SKUs, brand text, labels, logos, serial numbers, or unsupported product facts.",
  "Do not add parts, props, hands, flowers, duplicate products, badges, watermarks, or decorative scene elements.",
].join(" ");

export function buildDarkroomSchematicPrompt(mode: DarkroomSchematicPromptMode): string {
  if (mode === "exploded") {
    return [
      "Create a beautiful exploded assembly schematic from the uploaded product image.",
      BASE_SCHEMATIC_CONTRACT,
      "Separate only the components that are already visible or implied by the reference product, such as cap, applicator, collar, fitment, bottle body, and base.",
      "Show the parts aligned with clear assembly logic, even spacing, and premium industrial-design clarity.",
      "If the product is cap-off, cap-off means the cap is visible beside the product; do not create a third cap state.",
      "Do not add parts that are not supported by the reference image.",
    ].join(" ");
  }

  return [
    "Create a beautiful whole product schematic from the uploaded product image.",
    BASE_SCHEMATIC_CONTRACT,
    "Keep the product assembled as one coherent object, shown as a polished technical-elegant schematic rather than a photorealistic PDP shot.",
    "Emphasize glass wall thickness, cap/applicator geometry, seams, shoulders, base structure, and material transitions using subtle linework.",
  ].join(" ");
}
