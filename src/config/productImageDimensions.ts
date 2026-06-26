/**
 * Authoritative pixel dimensions across the product-image / paper-doll pipeline.
 *
 * Use these constants in UI copy, QC expectations, and docs — not magic numbers.
 * Sanity and CDN heroes are delivery-sized; composition canvas and raw OpenAI
 * outputs are upstream artifacts (different stages).
 */

/**
 * Raw PNGs from pipeline image-gen (OpenAI path), e.g. `grid-images/output/openai/raw/*.png`.
 *
 * Bumped 2026-04-26 from 2000×2200 to 2080×2288 to comply with
 * gpt-image-2's "both edges multiple of 16" constraint (2200/16=137.5
 * is invalid). Ratio preserved exactly: 2080:2288 = 10:11.
 */
export const PIPELINE_OPENAI_RAW_PX = {
  width: 2080,
  height: 2288,
} as const;

/** Aspect width:height = 10:11 (exact) */
export const PIPELINE_OPENAI_RAW_RATIO = 2080 / 2288;

/**
 * Best Bottles routed catalog canvas tiers.
 *
 * The tall tier is the existing Madison master. The tall/narrow, square, and
 * wide tiers are additional production canvases for cylinder, round/square,
 * and low/wide product families found in the flattened Best Bottles reference
 * set. All sizes are supported by the image-generation exact-size allowlist.
 */
export const BEST_BOTTLES_TALL_PORTRAIT_CANVAS_PX = PIPELINE_OPENAI_RAW_PX;

/** Aspect width:height = 10:11 (exact). */
export const BEST_BOTTLES_TALL_PORTRAIT_CANVAS_RATIO = PIPELINE_OPENAI_RAW_RATIO;

/** Native tall/slender Cylinder output canvas, aspect width:height = 2:3. */
export const BEST_BOTTLES_TALL_NARROW_CANVAS_PX = {
  width: 1024,
  height: 1536,
} as const;

export const BEST_BOTTLES_TALL_NARROW_CANVAS_RATIO = 1024 / 1536;

/** Square round/squat product canvas, aspect width:height = 1:1. */
export const BEST_BOTTLES_SQUARE_ROUND_CANVAS_PX = {
  width: 2048,
  height: 2048,
} as const;

export const BEST_BOTTLES_SQUARE_ROUND_CANVAS_RATIO = 1;

/** Landscape low/wide product canvas, aspect width:height = 3:2. */
export const BEST_BOTTLES_WIDE_LOW_CANVAS_PX = {
  width: 1536,
  height: 1024,
} as const;

export const BEST_BOTTLES_WIDE_LOW_CANVAS_RATIO = 1536 / 1024;

/**
 * Representative live Sanity CDN hero from a paper-doll group (sample; actual
 * assets may vary slightly with transforms).
 */
export const SANITY_HERO_SAMPLE_PX = {
  width: 928,
  height: 1152,
} as const;

/** ≈ 4:5 */
export const SANITY_HERO_SAMPLE_RATIO = 928 / 1152;

/**
 * Paper-doll composition canvas — components and manifest `canonicalCanvas`
 * for the local extract → Madison ingest handoff.
 *
 * Aligned 2026-04-28 to PIPELINE_OPENAI_RAW_PX (2080×2288, 10:11) so that
 * paper-doll layered components and brand-styled gpt-image-2 renders share
 * one canonical canvas across the entire product image system. Brings
 * consistency to the Best Bottles PDP, where both rendering paths now
 * compose into the same aspect-[10/11] container.
 *
 * Migration note: legacy CYL-9ML and CYL-5ML paper-doll components in
 * Sanity were uploaded at the previous 1000×1300 spec. They render
 * correctly under the new spec (object-contain in PaperDollImage handles
 * the scale-up), but a one-pass recanvas to 2080×2288 is recommended
 * for visual parity with newer families.
 */
export const PAPER_DOLL_CANVAS_PX = {
  width: 2080,
  height: 2288,
} as const;

/** Aspect width:height = 10:11 (matches PIPELINE_OPENAI_RAW_RATIO). */
export const PAPER_DOLL_CANVAS_RATIO = 2080 / 2288;

/**
 * Pre-2026-04-28 paper-doll canvas dimensions, retained for migration
 * tooling that needs to recognise legacy assets and recanvas them.
 */
export const PAPER_DOLL_CANVAS_PX_LEGACY = {
  width: 1000,
  height: 1300,
} as const;
