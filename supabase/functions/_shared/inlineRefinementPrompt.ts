const INLINE_REFINEMENT_STABILIZER_MAX_CHARS = 2_500;

function cleanPromptText(value: unknown, maxChars: number): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim()
    .slice(0, maxChars)
    .trim();
}

export function buildInlineRefinementStabilizerBlock(
  originalPrompt: unknown,
): string | null {
  const prompt = cleanPromptText(originalPrompt, INLINE_REFINEMENT_STABILIZER_MAX_CHARS);
  if (!prompt) return null;

  return [
    "INLINE EDIT STABILIZER:",
    "- This is a quick inline edit, not a fresh recreation. The original prompt remains active as the stabilizing contract for product identity, canvas, camera angle, lighting, material realism, background, shadow, rig, and forbidden elements.",
    "- Preserve every original prompt constraint unless the short operator retouch request explicitly changes that one detail.",
    "- Do not recompose, redesign, resize, recolor, change cap state, change SKU identity, or generate alternate product variants while applying the edit.",
    "",
    "ORIGINAL PROMPT STABILIZER:",
    prompt,
  ].join("\n");
}
