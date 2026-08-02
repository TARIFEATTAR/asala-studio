export const DUPLICATE_CAP_REFINEMENT =
  "Fix the duplicate-cap artifact. Keep exactly one detached matching over-cap beside the bottle on the shared baseline. Keep the exposed sprayer, pump, actuator/nozzle, collar, and dip tube seated on the bottle as the bottle top. Do not render a second loose cap, duplicate cap shell, ghost cap outline, or extra cap-like cylinder.";

export const IMAGE_REFINEMENT_QUICK_EDITS = [
  {
    id: "duplicate-cap",
    label: "Fix duplicate cap",
    instruction: DUPLICATE_CAP_REFINEMENT,
  },
] as const;

const PRODUCT_IMAGE_LIBRARY_TAG = "role:product-image";

export function mergeRefinementLibraryTags(libraryTags: string[] | null | undefined): string[] {
  const tags = Array.isArray(libraryTags) ? libraryTags : [];
  return Array.from(new Set([PRODUCT_IMAGE_LIBRARY_TAG, ...tags]));
}

export function getInlineRefinementRequestPrompt(
  originalPrompt: string | null | undefined,
  refinementInstruction: string,
): string {
  const prompt = typeof originalPrompt === "string" ? originalPrompt.trim() : "";
  return prompt || refinementInstruction.trim();
}
