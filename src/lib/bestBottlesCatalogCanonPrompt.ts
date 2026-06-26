// Madison intentionally imports the Best Bottles pipeline prompt module
// instead of copying its prompt text. This points at the v1.1 draft while
// we test it; do not rewrite the catalog prompt in Madison.
// @ts-expect-error The Canon v1.1 draft module lives in the adjacent Best Bottles repo.
import { buildCatalogPrompt } from "../../../../Clients/Nemat-International/Best-Bottles-Website-02-20-2026/pipeline/aios-shopify-pdp-images/prompt-template-canon-v1-1-draft.mjs";

import type { PromptSku } from "./bestBottlesPromptCompiler";

export const BEST_BOTTLES_CATALOG_CANON_SOURCE_PATH =
  "/Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Website-02-20-2026/pipeline/aios-shopify-pdp-images/prompt-template-canon-v1-1-draft.mjs";

export const BEST_BOTTLES_CATALOG_CANON_PROMPT_FLAG = "catalog_canon_v1_1_draft_prompt";

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
  return buildCatalogPrompt({
    glassType: getBestBottlesCatalogGlassType(sku),
    glassIsClear: isBestBottlesCatalogClearGlass(sku),
  });
}
