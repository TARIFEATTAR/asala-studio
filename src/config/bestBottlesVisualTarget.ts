export const BEST_BOTTLES_VISUAL_TARGET_VERSION = "best-bottles-pdp-v2" as const;

/** Median corner tone across the seven approved aluminum references. */
export const BEST_BOTTLES_VISUAL_TARGET_CANVAS_HEX = "#F6EFE8" as const;

export type BestBottlesVisualTargetMaterial = "glass" | "aluminum";

/**
 * Material-surface exemplars (Jordan-elected 2026-07-19, v2): one real studio
 * photo per glass surface plus aluminum, hash-locked in the visual-targets
 * library. Selection keys off the inferred bodyMaterial string ONLY — never
 * SKU color segments, which inconsistently encode cap color vs body color.
 */
export type BestBottlesVisualTargetSurface =
  | "clear"
  | "cobalt"
  | "amber"
  | "green"
  | "swirl"
  | "frosted"
  | "aluminum";

const BEST_BOTTLES_SINGLE_PRODUCT_COMPOSITION_SAFETY =
  "COMPOSITION SAFETY: render exactly one finished SKU product and only the components physically attached to it in the primary Product Reference. The canvas must contain no detached cap, overcap, bottle, cylinder, accessory, duplicate, ghost object, packaging, prop, or second product anywhere. Never infer or stage a separate object. If a component is absent from the primary Product Reference, it must be absent from the final image.";

const BEST_BOTTLES_SIDECAR_COMPOSITION_SAFETY =
  "SIDECAR COMPOSITION SAFETY: render exactly one finished SKU product as shown in the primary Product Reference: the bottle upright with its exact fitment or applicator attached, plus exactly one matching cap or overcap detached on camera-right on the same shared baseline. Preserve the reference component count, component identities, fitment seating, sidecar position, spacing, and relative scale. Do not assemble the sidecar onto the bottle, omit it, duplicate it, substitute it, invent hidden hardware, or add any other bottle, accessory, packaging, prop, ghost object, or second product.";

export type BestBottlesVisualComponentTopology =
  | "assembled"
  | "fitment-attached-cap-right-sidecar"
  | "assembled-live-site-exception";

function compositionSafetyForTopology(
  componentTopology: BestBottlesVisualComponentTopology,
): string {
  return componentTopology === "fitment-attached-cap-right-sidecar"
    ? BEST_BOTTLES_SIDECAR_COMPOSITION_SAFETY
    : BEST_BOTTLES_SINGLE_PRODUCT_COMPOSITION_SAFETY;
}

export interface BestBottlesVisualTargetReference {
  material: BestBottlesVisualTargetMaterial;
  surface: BestBottlesVisualTargetSurface;
  imageId: string;
  imageUrl: string;
  exportSha256: string;
  role: "style-only";
  /** True when an unmapped surface fell back to the clear-glass exemplar. */
  fallbackApplied: boolean;
}

type SurfaceRegistryEntry = Omit<BestBottlesVisualTargetReference, "fallbackApplied">;

/**
 * v2 exemplar set — real studio photos supplied and elected by Jordan
 * 2026-07-19, uploaded hash-named to the visual-targets library. Style-only:
 * product identity always comes from the SKU's primary byte-locked reference.
 */
export const BEST_BOTTLES_VISUAL_TARGET_SURFACES: Record<
  BestBottlesVisualTargetSurface,
  SurfaceRegistryEntry
> = {
  // v3 (Jordan 2026-07-19): cylinder-bodied clear exemplar replaces the square
  // bottle — the catalog is cylinders and curvature behavior (wall gradient,
  // edge density, elliptical base ring) is the whole point of the style ref.
  clear: {
    material: "glass",
    surface: "clear",
    imageId: "clear-v3-e2bdaaa1",
    imageUrl:
      "https://likkskifwsrvszxdvufw.supabase.co/storage/v1/object/public/reference-images/best-bottles/visual-targets/clear/v3/clear-cylinder__e2bdaaa1ac56c55d7133cbc64180560677ce3ed3fdf5c6dcc50c61a865bc6733.png",
    exportSha256: "e2bdaaa1ac56c55d7133cbc64180560677ce3ed3fdf5c6dcc50c61a865bc6733",
    role: "style-only",
  },
  cobalt: {
    material: "glass",
    surface: "cobalt",
    imageId: "cobalt-v2-9abd0cdf",
    imageUrl:
      "https://likkskifwsrvszxdvufw.supabase.co/storage/v1/object/public/reference-images/best-bottles/visual-targets/cobalt/v2/cobalt__9abd0cdf4e141aa45cb3b7be56026aceda5adc290ab9d45bf4dd59457ef0fe52.png",
    exportSha256: "9abd0cdf4e141aa45cb3b7be56026aceda5adc290ab9d45bf4dd59457ef0fe52",
    role: "style-only",
  },
  amber: {
    material: "glass",
    surface: "amber",
    imageId: "amber-v2-d4295a25",
    imageUrl:
      "https://likkskifwsrvszxdvufw.supabase.co/storage/v1/object/public/reference-images/best-bottles/visual-targets/amber/v2/amber__d4295a25e32fe5cacb470dd117ea4f9da1fad75ff46ad60c20973d48653fdc30.png",
    exportSha256: "d4295a25e32fe5cacb470dd117ea4f9da1fad75ff46ad60c20973d48653fdc30",
    role: "style-only",
  },
  green: {
    material: "glass",
    surface: "green",
    imageId: "green-v2-7521b239",
    imageUrl:
      "https://likkskifwsrvszxdvufw.supabase.co/storage/v1/object/public/reference-images/best-bottles/visual-targets/green/v2/green__7521b23978342f9e1daa5c1ba7b7044c281dcf1bbfca42c9ad1ade1fbf9b32b5.png",
    exportSha256: "7521b23978342f9e1daa5c1ba7b7044c281dcf1bbfca42c9ad1ade1fbf9b32b5",
    role: "style-only",
  },
  swirl: {
    material: "glass",
    surface: "swirl",
    imageId: "swirl-v2-ee1381f4",
    imageUrl:
      "https://likkskifwsrvszxdvufw.supabase.co/storage/v1/object/public/reference-images/best-bottles/visual-targets/swirl/v2/swirl__ee1381f4a0c9cf5102d5cd1b5756b07c43e4dc0b18a3c36393fa68671abd222c.png",
    exportSha256: "ee1381f4a0c9cf5102d5cd1b5756b07c43e4dc0b18a3c36393fa68671abd222c",
    role: "style-only",
  },
  frosted: {
    material: "glass",
    surface: "frosted",
    imageId: "frosted-v2-52333263",
    imageUrl:
      "https://likkskifwsrvszxdvufw.supabase.co/storage/v1/object/public/reference-images/best-bottles/visual-targets/frosted/v2/frosted__523332637c649c16331bc92e275a67c8bb43d5d4567c4ff3acac3ff4bee7f416.png",
    exportSha256: "523332637c649c16331bc92e275a67c8bb43d5d4567c4ff3acac3ff4bee7f416",
    role: "style-only",
  },
  aluminum: {
    material: "aluminum",
    surface: "aluminum",
    imageId: "aluminum-v2-d972c7d8",
    imageUrl:
      "https://likkskifwsrvszxdvufw.supabase.co/storage/v1/object/public/reference-images/best-bottles/visual-targets/aluminum/v2/aluminum__d972c7d814c83943d777c266c7d4b80eae9dd98957bf16d0e8c7aa45de85983a.png",
    exportSha256: "d972c7d814c83943d777c266c7d4b80eae9dd98957bf16d0e8c7aa45de85983a",
    role: "style-only",
  },
};

export function getBestBottlesVisualTargetMaterial(bodyMaterial?: string | null): BestBottlesVisualTargetMaterial {
  const value = bodyMaterial?.toLowerCase() ?? "";
  return value.includes("aluminum") || value.includes("aluminium") || value.includes("metal atomizer")
    ? "aluminum"
    : "glass";
}

/**
 * Map the inferred bodyMaterial string to an exemplar surface. Returns null
 * for surfaces with no exemplar (plastics, fabrics, unknown finishes) — the
 * caller applies the Jordan-approved fallback: clear glass, recorded.
 */
/**
 * Body-color evidence for surface selection. `inferBestBottlesBodyMaterial`
 * collapses every glass bottle to the string "glass", which mapped ALL colored
 * glass to the clear exemplar (2026-07-20: amber 9 ml rendered spotty/cloudy
 * with `style-surface:clear`). The catalog `color` field and the grace SKU's
 * BODY segment carry the true glass color; cap-finish tokens (SBLK/BKDT/...)
 * are deliberately ignored — cap color slots lie about the body.
 */
export interface BestBottlesVisualTargetSurfaceHints {
  color?: string | null;
  graceSku?: string | null;
}

function surfaceFromHints(
  hints?: BestBottlesVisualTargetSurfaceHints | null,
): BestBottlesVisualTargetSurface | null {
  if (!hints) return null;
  const color = (hints.color ?? "").toLowerCase();
  if (color.includes("swirl")) return "swirl";
  if (color.includes("frost")) return "frosted";
  if (color.includes("amber")) return "amber";
  if (color.includes("cobalt") || color.includes("blue")) return "cobalt";
  if (color.includes("green")) return "green";
  const sku = (hints.graceSku ?? "").toUpperCase();
  if (/-AMB-/.test(sku)) return "amber";
  if (/-(?:BLU|CBL)-/.test(sku)) return "cobalt";
  if (/-FRS-/.test(sku)) return "frosted";
  if (/-GRN-/.test(sku)) return "green";
  if (/-SWL-/.test(sku)) return "swirl";
  return null;
}

export function getBestBottlesVisualTargetSurface(
  bodyMaterial?: string | null,
  hints?: BestBottlesVisualTargetSurfaceHints | null,
): BestBottlesVisualTargetSurface | null {
  const value = bodyMaterial?.toLowerCase() ?? "";
  // Opaque metals win outright — a colored aluminum body must never pick a
  // colored-GLASS exemplar.
  if (value.includes("aluminum") || value.includes("aluminium") || value.includes("metal atomizer")) {
    return "aluminum";
  }
  if (value.includes("swirl")) return "swirl";
  if (value.includes("frosted") && value.includes("glass")) return "frosted";
  if (value.includes("amber")) return "amber";
  if (value.includes("cobalt")) return "cobalt";
  if (value.includes("green") && value.includes("glass")) return "green";
  const hinted = surfaceFromHints(hints);
  if (hinted) return hinted;
  if (value.includes("clear_glass") || value === "glass") return "clear";
  return null;
}

export function getBestBottlesVisualTargetReference(
  bodyMaterial?: string | null,
  hints?: BestBottlesVisualTargetSurfaceHints | null,
): BestBottlesVisualTargetReference {
  const surface = getBestBottlesVisualTargetSurface(bodyMaterial, hints);
  if (surface) {
    return { ...BEST_BOTTLES_VISUAL_TARGET_SURFACES[surface], fallbackApplied: false };
  }
  // Fallback rule (Jordan 2026-07-19): unmapped surfaces use the clear-glass
  // exemplar, and the fallback is recorded in lineage tags — never blocked,
  // never silent.
  return { ...BEST_BOTTLES_VISUAL_TARGET_SURFACES.clear, fallbackApplied: true };
}

export function buildBestBottlesVisualTargetPromptBlock(
  bodyMaterial?: string | null,
  componentTopology: BestBottlesVisualComponentTopology = "assembled",
): string {
  const target = getBestBottlesVisualTargetReference(bodyMaterial);
  const surfaceDirections: Record<BestBottlesVisualTargetSurface, string> = {
    clear:
      "Match the approved target's clear-glass wall definition, edge density, refraction, specular rhythm, material separation, and premium glass finish.",
    cobalt:
      "Match the approved target's saturated cobalt transmitted color, inner glow at thin sections, deep-blue wall density, specular rhythm, and premium colored-glass finish.",
    amber:
      "Match the approved target's warm amber transmitted depth, tonal gradation from thick base to thin shoulder, wall density, specular rhythm, and premium colored-glass finish.",
    green:
      "Match the approved target's deep green transmitted color, lighter glow at thin shoulder and neck sections, wall density, specular rhythm, and premium colored-glass finish.",
    swirl:
      "Match the approved target's helical swirl relief definition, highlight play across the raised pattern, refraction between ridges, and premium textured-glass finish.",
    frosted:
      "Match the approved target's satin frosted diffusion, soft light falloff, subtle translucency without gloss hotspots, and premium etched-glass finish.",
    aluminum:
      "Match the approved target's satin-metal gradient, controlled reflection-card rhythm, edge glints, material separation, and premium opaque-metal finish.",
  };
  const materialDirection = surfaceDirections[target.surface];

  const referenceStatus = target.imageUrl
    ? `Secondary reference image ${target.imageId} is STYLE-ONLY.`
    : "No secondary style reference is authorized for this material until an approved opaque non-paper-doll image is registered.";
  return [
    `VISUAL CALIBRATION TARGET — ${BEST_BOTTLES_VISUAL_TARGET_VERSION}.`,
    referenceStatus,
    materialDirection,
    target.imageUrl
      ? `Render the final canvas in the approved warm tone ${BEST_BOTTLES_VISUAL_TARGET_CANVAS_HEX} and match the reference's refined natural contact/drop shadow: local grounding, soft feathered falloff, restrained spread, and no pasted-on or floating appearance.`
      : `Render the final canvas in the approved warm tone ${BEST_BOTTLES_VISUAL_TARGET_CANVAS_HEX} with a refined natural contact/drop shadow: local grounding, soft feathered falloff, restrained spread, and no pasted-on or floating appearance.`,
    "Do not copy the secondary reference's silhouette, bottle family, closure, applicator, color, scale, crop, geometry, composition, or components.",
    "The primary Product Reference is the sole authority for product identity, geometry, component count, closure state, scale relationships, centerline, and baseline.",
    compositionSafetyForTopology(componentTopology),
  ].join("\n");
}

export function applyBestBottlesVisualTargetPrompt(
  prompt: string,
  bodyMaterial?: string | null,
  componentTopology: BestBottlesVisualComponentTopology = "assembled",
): string {
  const safety = compositionSafetyForTopology(componentTopology);
  const block = buildBestBottlesVisualTargetPromptBlock(bodyMaterial, componentTopology);
  if (!prompt.includes(`VISUAL CALIBRATION TARGET — ${BEST_BOTTLES_VISUAL_TARGET_VERSION}`)) {
    return `${prompt.trim()}\n\n${block}`;
  }
  // Existing v1 prompts were emitted before the composition-safety guard existed.
  // Preserve their precompiled authority while adding this non-negotiable repair.
  if (prompt.includes(safety)) return prompt;
  if (prompt.includes(BEST_BOTTLES_SINGLE_PRODUCT_COMPOSITION_SAFETY)) {
    return prompt.replace(BEST_BOTTLES_SINGLE_PRODUCT_COMPOSITION_SAFETY, safety);
  }
  if (prompt.includes(BEST_BOTTLES_SIDECAR_COMPOSITION_SAFETY)) {
    return prompt.replace(BEST_BOTTLES_SIDECAR_COMPOSITION_SAFETY, safety);
  }
  return `${prompt.trim()}\n${safety}`;
}

export function getBestBottlesVisualTargetTags(bodyMaterial?: string | null): string[] {
  const target = getBestBottlesVisualTargetReference(bodyMaterial);
  return [
    `visual-target:${BEST_BOTTLES_VISUAL_TARGET_VERSION}`,
    `style-reference-image:${target.imageId}`,
    `material-profile:${target.material}`,
    `style-surface:${target.surface}`,
    ...(target.fallbackApplied ? ["style-surface-fallback:clear"] : []),
  ];
}
