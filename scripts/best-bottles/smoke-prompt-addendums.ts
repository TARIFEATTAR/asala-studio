export interface SmokePromptAddendum {
  id: string;
  text: string;
}

const CLEAR_GLASS_POLISH_ADDENDUM: SmokePromptAddendum = {
  id: "clear-glass-polish-v1",
  text: [
    "Material-only refinement for clear transparent glass:",
    "Render the bottle body as optically clean commercial product photography glass with crisp rim thickness, believable transparent sidewalls, and subtle specular glass response.",
    "Reduce internal haze, cloudy patches, painterly texture, noisy speckling, muddy gray wash, and milky fog inside the clear glass.",
    "Use natural studio reflections and edge definition only; do not create literal parallel highlight lines, drawn stripes, etched marks, or artificial contour bands.",
    "Preserve the existing product identity lock. Do not change geometry, silhouette, height, width, neck threads, roller ball, cap shape, cap position, detached-cap staging, canvas, baseline, scale, color, or shadow.",
    "No fog, no liquid, no glow, no frost unless present in the reference, no added labels, no added props, no redesigned hardware.",
  ].join("\n"),
};

const KINFOLK_AESOP_STUDIO_V2_ADDENDUM: SmokePromptAddendum = {
  id: "kinfolk-aesop-studio-v2",
  text: [
    "Strict studio-direction refinement for restrained premium ecommerce photography:",
    "Use the restrained studio product-photography sensibility associated with Kinfolk and Aesop only as a mood reference: quiet premium lighting, controlled material finish, clean restraint, subtle dimensional contact shadow, and refined ecommerce polish.",
    "This is not lifestyle photography. Do not add props, labels, packaging, typography, scenes, brand marks, retail environments, Aesop-style product design, or any brand-specific asset.",
    "The catalog contract remains absolute: preserve the exact 2080x2288 canvas, product fill-height target, shared baseline, centerline, crop, product scale, detached-cap sidecar position, geometry, color, material, and component placement.",
    "Shadow direction may become slightly more dimensional and premium, but it must remain one realistic contact-only shadow under the bottle base and any detached cap. No floor plane, reflection, hard cast shadow, smear, horizon, vignette, or background texture.",
    "The attached product reference remains the source of truth. Improve only light, glass clarity, cap material polish, and contact shadow realism.",
  ].join("\n"),
};

const ADDENDUMS = new Map<string, SmokePromptAddendum>([
  [CLEAR_GLASS_POLISH_ADDENDUM.id, CLEAR_GLASS_POLISH_ADDENDUM],
  [KINFOLK_AESOP_STUDIO_V2_ADDENDUM.id, KINFOLK_AESOP_STUDIO_V2_ADDENDUM],
]);

const RETIRED_ADDENDUM_IDS = new Set(["kinfolk-aesop-studio-v1"]);

export function getSmokePromptAddendum(id: string | undefined): SmokePromptAddendum | null {
  const normalizedId = id?.trim();
  if (!normalizedId) return null;

  if (RETIRED_ADDENDUM_IDS.has(normalizedId)) {
    throw new Error(
      `Retired Best Bottles smoke prompt addendum: ${normalizedId}. v1 was too loose; use kinfolk-aesop-studio-v2 or the promoted canon prompt instead.`,
    );
  }

  const addendum = ADDENDUMS.get(normalizedId);
  if (!addendum) {
    throw new Error(`Unknown Best Bottles smoke prompt addendum: ${normalizedId}`);
  }

  return addendum;
}

export function applySmokePromptAddendum(
  prompt: string,
  addendum: SmokePromptAddendum | null,
): string {
  if (!addendum) return prompt;

  return [
    prompt.trimEnd(),
    "",
    `TEST-ONLY MATERIAL POLISH ADDENDUM (${addendum.id}):`,
    addendum.text,
  ].join("\n");
}
