export interface BestBottlesBackgroundAndShadowPromptInput {
  shadowContact?: string;
}

export const BEST_BOTTLES_REFERENCE_LOCKED_BONE_HEX = "#F5F3EF";
export const BEST_BOTTLES_REFERENCE_LOCKED_BONE_CANVAS_RGBA = 0xF5F3EFFF;

export function buildBestBottlesBackgroundAndShadowPrompt(
  input: BestBottlesBackgroundAndShadowPromptInput = {},
): string[] {
  const shadowContact = typeof input.shadowContact === "string" && input.shadowContact.trim()
    ? input.shadowContact.trim()
    : "product contact points visible in the reference";

  return [
    "BACKGROUND AND SHADOW:",
    `- Replace background with seamless Best Bottles Bone ${BEST_BOTTLES_REFERENCE_LOCKED_BONE_HEX}. It must visibly read as warm cream, not white, with no horizon line, tabletop edge, vignette, props, labels, or decorative frame.`,
    `- Add physically plausible grounding: visible soft contact shadow and ambient occlusion under ${shadowContact}. Shadow should be elegant but present, about 18-28% opacity at contact points, feathering outward naturally.`,
    "- Remove only dirt, low-quality capture artifacts, jagged edges, compression noise, and background contamination outside the product silhouette.",
  ];
}
