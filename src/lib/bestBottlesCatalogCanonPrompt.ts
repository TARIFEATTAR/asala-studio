// The canonical catalog prompt now lives IN this repo (vendored, authoritative).
// See src/config/bestBottlesCatalogCanon.ts — the external Best Bottles pipeline
// module is a mirror/consumer of this copy, not the source.
import {
  BEST_BOTTLES_CATALOG_CANON_VERSION,
  CLEAR_GLASS,
  FINAL_V2_STUDIO_CHECK,
  KEEP_MATERIAL,
  MODEL_OWNED_GROUNDING_SHADOW,
  PRESERVE,
  STUDIO_DIRECTION,
  buildPrompt,
} from "@/config/bestBottlesCatalogCanon";

import type { PromptSku } from "./bestBottlesPromptCompiler";
import type { BestBottlesShadowOwner, BestBottlesShadowPolicy } from "./bestBottlesShadowPolicy";
import { resolveBestBottlesShadowPolicy } from "./bestBottlesShadowPolicy";

export const BEST_BOTTLES_CATALOG_CANON_SOURCE_PATH =
  `src/config/bestBottlesCatalogCanon.ts@${BEST_BOTTLES_CATALOG_CANON_VERSION}`;

export const BEST_BOTTLES_CATALOG_CANON_PROMPT_FLAG = "catalog_canon_v3_prompt";

const CLEAR_GLASS_DETERMINISTIC_SHADOW_SENTENCES =
  "Background canvas color and the contact shadow are handled deterministically after generation. Do not add, redraw, or improve either one.";
const STUDIO_DETERMINISTIC_SHADOW_SENTENCE =
  "Do not add or alter a shadow, floor plane, reflection, hard cast shadow, smear, horizon, vignette, or background texture; background and grounding are deterministic post-processing responsibilities.";
const FINAL_STUDIO_MEASUREMENTS_SENTENCE =
  "Respect the resolved family framing measurements while making the photograph feel like the approved v2 studio direction.";
const MODEL_FINAL_STUDIO_CHECK_SENTENCE =
  "The resolved model-owned contact-shadow contract is permitted only for this exact smoke SKU and does not weaken product identity, geometry, material, canvas, or framing authority.";

function replaceCanonSourceText(source: string, exactText: string, replacement: string, label: string): string {
  const first = source.indexOf(exactText);
  if (first < 0 || first !== source.lastIndexOf(exactText)) {
    throw new Error(`Best Bottles canon drift: expected one exact ${label} source text.`);
  }
  return source.slice(0, first) + replacement + source.slice(first + exactText.length);
}

export function clearGlassForShadowOwner(owner: BestBottlesShadowOwner): string {
  if (owner === "rig") return CLEAR_GLASS;
  return replaceCanonSourceText(
    CLEAR_GLASS,
    CLEAR_GLASS_DETERMINISTIC_SHADOW_SENTENCES,
    "Background canvas color remains a deterministic normalization responsibility. Do not add, redraw, or improve the background.",
    "clear-glass shadow policy",
  );
}

export function studioDirectionForShadowOwner(owner: BestBottlesShadowOwner): string {
  if (owner === "rig") return STUDIO_DIRECTION;
  return replaceCanonSourceText(
    STUDIO_DIRECTION,
    STUDIO_DETERMINISTIC_SHADOW_SENTENCE,
    "The declared model-owned contact shadow is allowed only as resolved by the framing profile; do not add or alter any second shadow, floor plane, reflection, hard cast shadow, smear, horizon, vignette, or background texture. Background color remains a deterministic normalization responsibility.",
    "studio shadow policy",
  );
}

export function finalStudioCheckForShadowOwner(owner: BestBottlesShadowOwner): string {
  if (owner === "rig") return FINAL_V2_STUDIO_CHECK;
  return replaceCanonSourceText(
    FINAL_V2_STUDIO_CHECK,
    FINAL_STUDIO_MEASUREMENTS_SENTENCE,
    `${FINAL_STUDIO_MEASUREMENTS_SENTENCE}\n${MODEL_FINAL_STUDIO_CHECK_SENTENCE}`,
    "final studio check",
  );
}

function normalizedSkuText(sku: PromptSku): string {
  return [
    sku.sku,
    sku.body_material,
    sku.body_color,
    sku.product_family,
    sku.body_shape,
    sku.special_geometry_notes,
  ]
    .join(" ")
    .toLowerCase();
}

export function getBestBottlesCatalogGlassType(sku: PromptSku): string {
  const text = normalizedSkuText(sku);
  if (text.includes("frost")) return "frosted";
  if (text.includes("swirl") || text.includes("flute")) return "swirl";
  if (text.includes("cobalt") || text.includes("blue")) return "cobalt";
  if (text.includes("amber")) return "amber";
  if (text.includes("green") || text.includes("emerald")) return "green";
  if (text.includes("apothecary")) return "apothecary";
  if (text.includes("heart") || text.includes("keychain") || text.includes("novelty")) return "novelty";
  return "colored";
}

export function isBestBottlesCatalogClearGlass(sku: PromptSku): boolean {
  const text = normalizedSkuText(sku);
  return (
    sku.body_material === "clear_glass" &&
    !text.includes("frost") &&
    !text.includes("swirl") &&
    !text.includes("amber") &&
    !text.includes("cobalt") &&
    !text.includes("blue") &&
    !text.includes("green")
  );
}

export function buildBestBottlesCatalogCanonPrompt(sku: PromptSku): string {
  const isClearGlass = isBestBottlesCatalogClearGlass(sku);
  const policy = resolveBestBottlesShadowPolicy(sku.sku);
  if (policy.owner === "rig") return buildPrompt(isClearGlass);
  return [
    PRESERVE,
    isClearGlass ? clearGlassForShadowOwner(policy.owner) : KEEP_MATERIAL,
    MODEL_OWNED_GROUNDING_SHADOW,
    studioDirectionForShadowOwner(policy.owner),
    finalStudioCheckForShadowOwner(policy.owner),
  ].join("\n\n");
}

export interface BestBottlesCatalogCanonPromptParts {
  basePrompt: string;
  finalStudioDirection: string;
}

export function buildBestBottlesCatalogCanonPromptParts(
  sku: PromptSku,
  policy: BestBottlesShadowPolicy = resolveBestBottlesShadowPolicy(sku.sku),
): BestBottlesCatalogCanonPromptParts {
  const isClearGlass = isBestBottlesCatalogClearGlass(sku);
  return {
    basePrompt: [PRESERVE, isClearGlass ? clearGlassForShadowOwner(policy.owner) : KEEP_MATERIAL].join("\n\n"),
    finalStudioDirection: [
      studioDirectionForShadowOwner(policy.owner),
      finalStudioCheckForShadowOwner(policy.owner),
    ].join("\n\n"),
  };
}

export { MODEL_OWNED_GROUNDING_SHADOW };
