/**
 * IMPOSED STUDIO RIG — single source of truth (Vite / Node runtime).
 *
 * Consumed by BOTH the in-app assembler (`promptAssembler.ts`) and the batch
 * CLI runner (`scripts/local-generate.ts`). Only place the rig geometry lives
 * on this side of the runtime wall.
 *
 * ── Runtime boundary ────────────────────────────────────────────────────
 * The Deno edge function (`supabase/functions/generate-madison-image`) cannot
 * import this file (tsconfig.app excludes the functions tree; Deno can't
 * resolve `@/`). Its twin is `supabase/functions/_shared/familyRig.ts` — keep
 * FAMILY_RIG numerically identical there.
 *
 * ── What this does (and deliberately does NOT do) ───────────────────────
 * SIZE STRATEGY DECISION (Jordan, 2026-06-18): the generated master is
 * SIZE-AGNOSTIC. It does NOT encode true cross-SKU size. Reasons:
 *   - Source references are framed-to-fill (measured: 5 ml and 9 ml both fill
 *     ~87% of their own frame), so they can't be trusted for scale.
 *   - A single honest mm-driven scale makes most of the catalog (50–120 mm
 *     decant bottles, tallest ~200 mm) render small/sparse in a solo PDP.
 *   - A solo PDP hero wants a clean, full, CONSISTENT frame; true relative
 *     size only matters in variant/category GRIDS.
 * So: the rig gives every SKU one consistent, generous fit-to-box framing on a
 * shared baseline + centerline. TRUE RELATIVE SIZE is applied at the DISPLAY
 * layer by the website, scaling each thumbnail by its real `heightWithCap`
 * (mm lives in Convex). See the website repo's variant/category grid.
 *
 * The rig still separates concerns cleanly:
 *   - Reference image  → IDENTITY (shape, color, material, components, cap state)
 *   - This rig         → PLACEMENT + consistent framing (where + how big on canvas)
 *   - Display layer    → TRUE SIZE (mm-driven scaling in grids)
 */

export interface FamilyRigConfig {
  /** Normalized family key (lowercase). */
  family: string;
  /**
   * The whole assembly (bottle + cap/applicator) is fit-to-box: scaled to fit
   * within this % of canvas HEIGHT and `fillWidthPct` of canvas WIDTH,
   * whichever binds (contain). Same target for every SKU in the family →
   * consistent catalog framing regardless of real size.
   */
  fillHeightPct: number;
  /** Width half of the fit-to-box (see fillHeightPct). */
  fillWidthPct: number;
  /** Bottle base seated this far up from the canvas bottom (% of height). */
  baselinePct: number;
}

/**
 * Per-family rig configs. The fill/baseline numbers are framing aesthetics,
 * NOT size encodings — every SKU in a family is framed the same. Add a family
 * here to opt it into the rig; families without an entry keep the legacy
 * reference-locked behavior (the rig rolls out family-by-family).
 */
export const FAMILY_RIG: Record<string, FamilyRigConfig> = {
  cylinder: {
    family: "cylinder",
    fillHeightPct: 80,
    fillWidthPct: 60,
    baselinePct: 13,
  },
  circle: {
    family: "circle",
    fillHeightPct: 78,
    fillWidthPct: 68,
    baselinePct: 13,
  },
};

export function normalizeFamily(family?: string | null): string {
  return (family ?? "").trim().toLowerCase();
}

/**
 * Resolve the rig config for a family. "Tall Cylinder" is treated as Cylinder.
 * Returns null for families without a rig yet (callers fall back to legacy
 * reference-locked behavior).
 */
export function getFamilyRig(family?: string | null): FamilyRigConfig | null {
  const f = normalizeFamily(family);
  if (f === "tall cylinder") return FAMILY_RIG.cylinder;
  return FAMILY_RIG[f] ?? null;
}

export function hasFamilyRig(family?: string | null): boolean {
  return getFamilyRig(family) !== null;
}

/**
 * Fit-to-box scale factor for the rendered foreground. Given the foreground
 * bounding-box dimensions (in canvas pixels) and the canvas size, returns the
 * scale that fits the assembly within the rig's fill box (contain — the
 * binding dimension wins). Pure math; no image deps.
 */
export function computeRigFitScale(
  cfg: FamilyRigConfig,
  boxWidthPx: number,
  boxHeightPx: number,
  canvasWidthPx: number,
  canvasHeightPx: number,
): number {
  if (boxWidthPx <= 0 || boxHeightPx <= 0) return 1;
  const scaleH = (cfg.fillHeightPct / 100) * canvasHeightPx / boxHeightPx;
  const scaleW = (cfg.fillWidthPct / 100) * canvasWidthPx / boxWidthPx;
  return Math.min(scaleH, scaleW);
}

export type RigCapState = "assembled" | "detached";

/**
 * Build the imposed-rig prompt block. Returns null when the family has no rig.
 *
 * This block is authoritative for COMPOSITION and explicitly supersedes any
 * earlier "preserve the reference's centerline/baseline/crop/scale" language.
 * It does NOT touch geometry/material/component locks (those stay anchored to
 * the reference), and it deliberately does NOT vary on-canvas size by capacity
 * — every SKU is framed consistently; true size is applied at display time.
 */
export function buildImposedRigBlock(input: {
  family: string;
  capState: RigCapState;
}): string | null {
  const cfg = getFamilyRig(input.family);
  if (!cfg) return null;

  const familyLabel = cfg.family.replace(/\b\w/g, (c) => c.toUpperCase());
  const baselineLow = cfg.baselinePct - 1;
  const baselineHigh = cfg.baselinePct + 1;

  const placementLines =
    input.capState === "detached"
      ? [
          "- Treat the bottle plus detached cap as ONE two-object assembly, not two independently framed products.",
          "- Place the bottle BODY slightly left of the canvas vertical centerline so the combined bottle+cap assembly is visually centered on the canvas.",
          "- Place the DETACHED cap upright to the RIGHT of the body. Seat the cap bottom on the EXACT SAME horizontal baseline as the bottle base; their bottom contact pixels should align within ~6 px.",
          "- Keep a clean, even gap of about 6-10% of canvas width between the bottle's widest right edge and the cap's left edge. Do not let the cap drift far away, tuck behind the bottle, or overlap the bottle.",
          "- Keep the cap's vertical axis parallel to the bottle. Scale it as the real matching cap for this bottle: not tiny, not oversized, and with the cap top around the bottle shoulder/lower-neck zone unless the reference product proves otherwise.",
          "- For roll-on / roller-ball SKUs, keep the exposed roller ball plug seated on the bottle neck centerline. The roller plug/ball belongs to the bottle and must not drift sideways, rise above the neck, or turn into a second detached object.",
          "- For roll-on / roller-ball SKUs, the detached object is the matching over-cap only. Keep that over-cap upright to the right, on the shared baseline, with the same cap scale and gap across all cap-color variants.",
          "- The bottle, detached cap, and their contact shadows share one continuous studio floor line and one camera scale.",
        ]
      : [
          "- Place the assembled bottle centered on the canvas vertical centerline, standing upright on the baseline.",
        ];

  return [
    `IMPOSED STUDIO RIG — ${familyLabel.toUpperCase()} (COMPOSITION AUTHORITY, OVERRIDES REFERENCE FRAMING):`,
    "- This rig defines composition. It SUPERSEDES any earlier instruction to preserve, match, or stay within tolerance of the reference image's centerline, baseline, crop, footprint, framing, padding, or scale.",
    "- Still locked to the reference (do NOT change these): product geometry, silhouette, proportions, height-to-width ratio, colors, component shapes, cap-on vs cap-off state, number of components, and material identity. The reference governs WHAT the product is; this rig governs WHERE and HOW it sits on the canvas.",
    `- Baseline: seat the bottle base at ${baselineLow}–${baselineHigh}% up from the canvas bottom. Every ${familyLabel} SKU shares this one horizontal shelf line.`,
    ...placementLines,
    `- Render the product at a generous, CONSISTENT catalog size: the whole assembly fills the frame the same way for every ${familyLabel} SKU. Fit it fully within ~${cfg.fillHeightPct}% of the canvas height and ~${cfg.fillWidthPct}% of the width, centered, with comfortable even margins.`,
    "- Do not leave the product small with large empty margins, and do not crop any part (cap, base, applicator, detached cap, or grounding shadow).",
    "- Do NOT vary the on-canvas size by ml capacity. A small-capacity and a large-capacity bottle are framed at the SAME generous size here — true relative size is applied later at display time, not in this image.",
    "- Same fixed studio rig for the whole family: identical camera distance, lens, optical compression, baseline, and centerline. Only the purchasable component differences change between siblings.",
  ].join("\n");
}
