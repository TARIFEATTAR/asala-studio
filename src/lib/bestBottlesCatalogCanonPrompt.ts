// The canonical catalog prompt now lives IN this repo (vendored, authoritative).
// See src/config/bestBottlesCatalogCanon.ts — the external Best Bottles pipeline
// module is a mirror/consumer of this copy, not the source.
import {
  BEST_BOTTLES_CATALOG_CANON_VERSION,
  CLEAR_GLASS,
  FINAL_V2_STUDIO_CHECK,
  KEEP_MATERIAL,
  PRESERVE,
  STUDIO_DIRECTION,
  buildPrompt,
} from "@/config/bestBottlesCatalogCanon";

import type { PromptSku } from "./bestBottlesPromptCompiler";

export const BEST_BOTTLES_CATALOG_CANON_SOURCE_PATH =
  `src/config/bestBottlesCatalogCanon.ts@${BEST_BOTTLES_CATALOG_CANON_VERSION}`;

export const BEST_BOTTLES_CATALOG_CANON_PROMPT_FLAG = "catalog_canon_v3_prompt";

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
  return buildPrompt(isClearGlass);
}

export interface BestBottlesCatalogCanonPromptParts {
  basePrompt: string;
  finalStudioDirection: string;
}

export function buildBestBottlesCatalogCanonPromptParts(
  sku: PromptSku,
): BestBottlesCatalogCanonPromptParts {
  const isClearGlass = isBestBottlesCatalogClearGlass(sku);
  return {
    basePrompt: [PRESERVE, isClearGlass ? CLEAR_GLASS : KEEP_MATERIAL].join("\n\n"),
    finalStudioDirection: [STUDIO_DIRECTION, FINAL_V2_STUDIO_CHECK].join("\n\n"),
  };
}
