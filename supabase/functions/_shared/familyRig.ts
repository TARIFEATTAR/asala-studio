/**
 * IMPOSED STUDIO RIG - Deno / Supabase Edge twin.
 *
 * Keep FAMILY_RIG numerically identical to
 * `src/lib/product-image/familyRig.ts`. The edge function cannot import the
 * Vite/Node module directly, so this dependency-free file mirrors the pure
 * rig math used by the local generator and prompt assembler.
 */

export interface FamilyRigConfig {
  family: string;
  fillHeightPct: number;
  fillWidthPct: number;
  baselinePct: number;
}

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

export function getFamilyRig(family?: string | null): FamilyRigConfig | null {
  const normalized = normalizeFamily(family);
  if (normalized === "tall cylinder") return FAMILY_RIG.cylinder;
  return FAMILY_RIG[normalized] ?? null;
}

export function hasFamilyRig(family?: string | null): boolean {
  return getFamilyRig(family) !== null;
}

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

export interface BuildRigBlockInput {
  family: string;
  capState: RigCapState;
}

export function buildImposedRigBlock(input: BuildRigBlockInput): string | null {
  const cfg = getFamilyRig(input.family);
  if (!cfg) return null;

  const familyLabel = cfg.family.replace(/\b\w/g, (c) => c.toUpperCase());
  const baselineLow = cfg.baselinePct - 1;
  const baselineHigh = cfg.baselinePct + 1;
  const placementLines = input.capState === "detached"
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
    `IMPOSED STUDIO RIG - ${familyLabel.toUpperCase()} (COMPOSITION AUTHORITY, OVERRIDES REFERENCE FRAMING):`,
    "- This rig defines composition. It SUPERSEDES any earlier instruction to preserve, match, or stay within tolerance of the reference image's centerline, baseline, crop, footprint, framing, padding, or scale.",
    "- Still locked to the reference (do NOT change these): product geometry, silhouette, proportions, height-to-width ratio, colors, component shapes, cap-on vs cap-off state, number of components, and material identity. The reference governs WHAT the product is; this rig governs WHERE and HOW it sits on the canvas.",
    `- Baseline: seat the bottle base at ${baselineLow}-${baselineHigh}% up from the canvas bottom. Every ${familyLabel} SKU shares this one horizontal shelf line.`,
    ...placementLines,
    `- Render the product at a generous, CONSISTENT catalog size: the whole assembly fills the frame the same way for every ${familyLabel} SKU. Fit it fully within ~${cfg.fillHeightPct}% of the canvas height and ~${cfg.fillWidthPct}% of the width, centered, with comfortable even margins.`,
    "- Do not leave the product small with large empty margins, and do not crop any part (cap, base, applicator, detached cap, or grounding shadow).",
    "- Do NOT vary the on-canvas size by ml capacity. A small-capacity and a large-capacity bottle are framed at the SAME generous size here - true relative size is applied later at display time, not in this image.",
    "- FINAL ALIGNMENT QA: before accepting the image, seat the bottle base and any detached cap bottom on the shared rig baseline; no sibling variant may float higher, sink lower, or use a different floor line.",
    "- Same fixed studio rig for the whole family: identical camera distance, lens, optical compression, baseline, and centerline. Only the purchasable component differences change between siblings.",
  ].join("\n");
}
