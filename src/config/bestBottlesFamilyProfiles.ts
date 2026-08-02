import { BEST_BOTTLES_TALL_PORTRAIT_CANVAS_PX } from "./productImageDimensions";
import {
  applyBestBottlesFamilyScaleCorrection,
  BEST_BOTTLES_CATALOG_SCALE_VERSION,
  resolveBestBottlesGlobalScalePct,
} from "./bestBottlesCatalogScale";

export type BestBottlesFamilyProfileId =
  | "sample-vial"
  | "roller-bottle"
  | "cylinder-standard"
  | "cylinder-tall"
  | "boston-round"
  | "empire-bottle"
  | "heavy-perfume-bottle"
  | "aluminum-bottle"
  // Families authored in the "all catalog families" coverage pass (2026-07):
  | "round-bottle"
  | "circle-bottle"
  | "square-bottle"
  | "rectangle-bottle"
  | "cream-jar"
  | "apothecary-bottle"
  | "pillar-bottle"
  | "atomizer-bottle"
  | "lotion-bottle"
  | "plastic-bottle"
  | "bell-bottle"
  | "flair-bottle"
  | "royal-bottle"
  | "tulip-bottle"
  | "teardrop-bottle"
  // Defensive backstop so a never-before-seen bottle family still gets framing:
  | "generic-bottle";

export type BestBottlesDetachedComponentPlacement = "right-sidecar";

export type BestBottlesRelativeScaleZoneId =
  | "sample-vial"
  | "small-cylinder"
  | "standard-cylinder"
  | "large-cylinder"
  | "roller-bottle"
  | "roller-small"
  | "roller-standard"
  | "roller-tall"
  | "boston-round"
  | "empire-bottle"
  | "heavy-perfume-bottle"
  | "aluminum-bottle"
  | "round-bottle"
  | "disc-bottle"
  | "cube-bottle"
  | "rectangle-bottle"
  | "wide-jar"
  | "tall-decorative"
  | "mini-decorative"
  | "atomizer"
  | "lotion-bottle"
  | "plastic-bottle"
  | "generic-bottle";

export interface BestBottlesRelativeScaleZone {
  id: BestBottlesRelativeScaleZoneId;
  label: string;
  targetProductHeightRangePct: { min: number; max: number };
  targetProductHeightPct: number;
}

export interface BestBottlesFamilyProfile {
  id: BestBottlesFamilyProfileId;
  family: string;
  label: string;
  scaleContractVersion: typeof BEST_BOTTLES_CATALOG_SCALE_VERSION;
  globalTargetProductHeightPct: number;
  familyScaleCorrectionPct: number;
  /** Reserved for non-production comparison views; PDP profiles do not set it. */
  geometryScaleVersion?: string;
  relativeScaleZoneId: BestBottlesRelativeScaleZoneId;
  relativeScaleZoneLabel: string;
  canvas: { widthPx: number; heightPx: number };
  targetProductHeightRangePct: { min: number; max: number };
  targetProductHeightPct: number;
  fillWidthPct: number;
  baselinePct: number;
  primaryObjectCenterXPct: number;
  detachedComponentPlacement: BestBottlesDetachedComponentPlacement;
  detachedComponentShiftsPrimary: boolean;
  /**
   * Optional one-line material-geometry cue rendered into the framing block.
   * Round-bodied glass families use this to defeat the "flat cutout" failure
   * mode (the canon's "quiet mid-body" instruction, unqualified, can make the
   * model render the transparent body as a flat pane of background). Flat-faced
   * families (Empire, Square, Rectangle) intentionally omit it.
   */
  glassGeometryHint?: string;
}

/**
 * Curvature cue for round-bodied CLEAR-GLASS families, calibrated against the
 * approved reference render (9ml roller, shiny-gold cap, 2026-07-04 smoke): the
 * quality that makes glass read as curved volume is that the INTERIOR tone sits
 * about a half-tone deeper than the bare canvas and deepens gradually toward the
 * walls. v1 of this cue only asked for denser edges, which high-key renders
 * ignored (interior stayed identical to the background = windowpane). Edge-
 * focused wording is deliberate: it cannot re-introduce the banned broad central
 * highlight stripe, and does not contradict the canon's "quiet mid-body" rule.
 */
export const BEST_BOTTLES_ROUND_GLASS_VOLUME_CUE =
  "- Round-glass volume cue: the body is a curved cylinder, not a flat pane. It must remain visibly dimensional at ecommerce thumbnail size while staying empty, transparent, and colorless. The backdrop seen THROUGH the glass reads about a half-tone deeper than the bare canvas beside the bottle, and that interior tone deepens gradually toward the left and right walls where the glass is optically thickest. Sidewall density must emerge as a soft graduated optical transition from refraction and real wall thickness; it must never resolve into a discrete dark rail, drawn outline, black stripe, or continuous line on either side. The interior must never become a uniform Bone-colored rectangle or empty cutout window inside the bottle silhouette. Add narrow asymmetric studio-card reflections that softly feather with the curved sidewalls, plus faint rear-wall refraction and an elliptical internal base ring, so the circular cross-section is unmistakable without changing the silhouette. This interior tone change is purely optical and PERFECTLY SMOOTH — an even, continuous gradient with zero grain, speckle, mottling, smudges, brushy streaks, haze patches, or painted texture inside the glass; the interior stays optically clean. The mid-body stays quiet but must not match the background exactly. Do not add a broad central highlight stripe.";

/**
 * Component material-targeting cue. PRODUCT TRUTH (operator-confirmed
 * 2026-07-04): the roll-on over-caps are PHENOLIC — a molded high-grade plastic
 * SUBSTRATE — but FINISH is independent of substrate: shiny colorways (shiny
 * gold / silver / black) are genuinely mirror-bright and chrome-LIKE, matte
 * colorways are soft satin. The roller BALL is genuinely polished steel.
 *
 * The real observed failure mode was NOT "looks too chrome" — it was a blown
 * highlight stripping the color off one side into a flat white panel (shiny
 * silver, 2026-07-04). An earlier fix over-corrected by forbidding any
 * mirror/chrome read, which would dull the legitimately shiny colorways
 * (including the approved shiny-gold T-07); that wording is removed here.
 *
 * Failure modes this prevents:
 * (1) blown highlight → flat white panel that reads as missing color on one side;
 * (2) wires crossing between the DETACHED CAP (sidecar), the steel ROLLER BALL
 *     and its translucent plastic housing (on the neck) — never metallize the
 *     plastic plug or recolor the steel ball to match the cap.
 * Scoped with the volume cue to the same round-glass profiles.
 */
export const BEST_BOTTLES_COMPONENT_MATERIAL_TARGETING_CUE =
  "- Component material targeting: the DETACHED CAP beside the bottle and any ROLLER ASSEMBLY on the bottle neck are separate components — never blend their materials or colors. The detached cap is a phenolic (molded high-grade plastic) closure; render its exact reference colorway and finish across its ENTIRE visible surface, never a flat white panel that looks like missing color on one side. Shiny colorways (shiny gold, shiny silver, shiny black) are genuinely mirror-bright — keep them glossy and chrome-like exactly as the reference shows; matte colorways (matte gold, matte silver, matte copper) read as soft satin. White and pale caps keep an even, uniform surface with soft gentle shading — no harsh vertical streaks of gloss and no irregular gray patches that read as worn or rubbed-off paint. The substrate is molded plastic, so avoid literal machined-metal grain or seams, but never dull a shiny cap's mirror reflection. The roller ball on the neck IS polished steel exactly as photographed — do not recolor it to match the cap — and its translucent plastic plug housing stays translucent plastic, never metallized.";


interface BestBottlesFamilyProfileTemplate
  extends Omit<BestBottlesFamilyProfile, "targetProductHeightPct"> {
  observedHeightRangeMm: { min: number; max: number };
  fallbackTargetProductHeightPct: number;
}

export interface BestBottlesFamilyProfileProductInput {
  family?: string | null;
  bottleCollection?: string | null;
  category?: string | null;
  graceSku?: string | null;
  websiteSku?: string | null;
  itemName?: string | null;
  itemDescription?: string | null;
  applicator?: string | null;
  capacity?: string | null;
  capacityMl?: number | null;
  heightWithCap?: string | null;
  heightWithoutCap?: string | null;
  diameter?: string | null;
  capState?: string | null;
  mode?: string | null;
}

const FIXED_STUDIO_CANVAS = {
  widthPx: BEST_BOTTLES_TALL_PORTRAIT_CANVAS_PX.width,
  heightPx: BEST_BOTTLES_TALL_PORTRAIT_CANVAS_PX.height,
} as const;

const BEST_BOTTLES_SHARED_BASELINE_PCT = 9;

/**
 * Family profiles may correct silhouette framing, but the global catalog curve
 * owns product height. The first contract launches at zero correction for every
 * family; any future non-zero value requires versioned visual calibration.
 */
export const BEST_BOTTLES_FAMILY_SCALE_CORRECTIONS: Record<BestBottlesFamilyProfileId, number> = {
  "sample-vial": 0,
  "roller-bottle": 0,
  "cylinder-standard": 0,
  "cylinder-tall": 0,
  "boston-round": 0,
  "empire-bottle": 0,
  "heavy-perfume-bottle": 0,
  "aluminum-bottle": 0,
  "round-bottle": 0,
  "circle-bottle": 0,
  "square-bottle": 0,
  "rectangle-bottle": 0,
  "cream-jar": 0,
  "apothecary-bottle": 0,
  "pillar-bottle": 0,
  "atomizer-bottle": 0,
  "lotion-bottle": 0,
  "plastic-bottle": 0,
  "bell-bottle": 0,
  "flair-bottle": 0,
  "royal-bottle": 0,
  "tulip-bottle": 0,
  "teardrop-bottle": 0,
  "generic-bottle": 0,
};

export const BEST_BOTTLES_FAMILY_FILL_HEIGHT_RANGES = {
  sampleVials: { min: 55, max: 60 },
  smallCylinders: { min: 60, max: 64 },
  rollerBottles: { min: 65, max: 70 },
  // Roll-ons split into 3 capacity/height zones so a 5ml reads visibly shorter
  // than a 9ml, and a tall 118mm 9ml reads visibly taller than a standard 75mm
  // one. The old single rollerBottles band (65-70) compressed a 2x real-size
  // spread into ~2%, making 5ml and 9ml render at the same on-canvas height.
  rollerBottlesSmall: { min: 58, max: 64 },
  rollerBottlesStandard: { min: 67, max: 72 },
  // Tall band trimmed 75-80 -> 74-77 (Jordan 2026-07-20): at 80 the 118mm
  // tall roll-on dominated the grid beside the 71% standard roll-on. 77 keeps
  // a clearly readable ~8% canvas separation (the bottles are 42% apart in
  // reality) without the tall bottle crowding its frame.
  rollerBottlesTall: { min: 74, max: 77 },
  cylinders10To30Ml: { min: 72, max: 78 },
  largeCylinders: { min: 80, max: 84 },
  bostonRounds: { min: 78, max: 82 },
  empireBottles: { min: 80, max: 84 },
  heavyPerfumeBottles: { min: 84, max: 88 },
  aluminumBottles: { min: 88, max: 92 },
} as const;

const SAMPLE_VIAL_TEMPLATE: BestBottlesFamilyProfileTemplate = {
  id: "sample-vial",
  family: "sample-vial",
  label: "Cylinder Sample Vial",
  relativeScaleZoneId: "sample-vial",
  relativeScaleZoneLabel: "Sample vials",
  glassGeometryHint: BEST_BOTTLES_ROUND_GLASS_VOLUME_CUE,
  canvas: FIXED_STUDIO_CANVAS,
  targetProductHeightRangePct: BEST_BOTTLES_FAMILY_FILL_HEIGHT_RANGES.sampleVials,
  observedHeightRangeMm: { min: 32, max: 75 },
  fallbackTargetProductHeightPct: 58,
  fillWidthPct: 58,
  baselinePct: BEST_BOTTLES_SHARED_BASELINE_PCT,
  primaryObjectCenterXPct: 50,
  detachedComponentPlacement: "right-sidecar",
  detachedComponentShiftsPrimary: false,
};

const ROLLER_BOTTLE_TEMPLATE: BestBottlesFamilyProfileTemplate = {
  id: "roller-bottle",
  family: "roller-bottle",
  label: "Roller Bottle",
  relativeScaleZoneId: "roller-bottle",
  relativeScaleZoneLabel: "Roller bottles",
  glassGeometryHint: BEST_BOTTLES_ROUND_GLASS_VOLUME_CUE,
  canvas: FIXED_STUDIO_CANVAS,
  targetProductHeightRangePct: BEST_BOTTLES_FAMILY_FILL_HEIGHT_RANGES.rollerBottles,
  observedHeightRangeMm: { min: 55, max: 118 },
  fallbackTargetProductHeightPct: 68,
  // Flattened roll-on references commonly include the matching cap as a wide
  // right-sidecar. A narrow 58% full-assembly width cap became the binding
  // dimension and crushed otherwise-correct bottle heights as low as 41%.
  // Keep 4% total canvas air for the sidecar assembly; height remains the
  // framing authority for normal assembled roll-ons.
  fillWidthPct: 96,
  baselinePct: BEST_BOTTLES_SHARED_BASELINE_PCT,
  primaryObjectCenterXPct: 50,
  detachedComponentPlacement: "right-sidecar",
  detachedComponentShiftsPrimary: false,
};

const CYLINDER_STANDARD_TEMPLATE: BestBottlesFamilyProfileTemplate = {
  id: "cylinder-standard",
  family: "cylinder",
  label: "Cylinder Standard",
  relativeScaleZoneId: "standard-cylinder",
  relativeScaleZoneLabel: "Standard Cylinder bottles",
  glassGeometryHint: BEST_BOTTLES_ROUND_GLASS_VOLUME_CUE,
  canvas: FIXED_STUDIO_CANVAS,
  targetProductHeightRangePct: BEST_BOTTLES_FAMILY_FILL_HEIGHT_RANGES.cylinders10To30Ml,
  observedHeightRangeMm: { min: 75, max: 142 },
  fallbackTargetProductHeightPct: 76,
  fillWidthPct: 60,
  baselinePct: BEST_BOTTLES_SHARED_BASELINE_PCT,
  primaryObjectCenterXPct: 50,
  detachedComponentPlacement: "right-sidecar",
  detachedComponentShiftsPrimary: false,
};

const CYLINDER_SMALL_OBSERVED_HEIGHT_RANGE_MM = { min: 60, max: 90 } as const;

function resolveSmallCylinderFillHeightPct(measuredHeightMm: number | null): number {
  const range = BEST_BOTTLES_FAMILY_FILL_HEIGHT_RANGES.smallCylinders;
  if (measuredHeightMm == null) return 62;
  const observed = CYLINDER_SMALL_OBSERVED_HEIGHT_RANGE_MM;
  const normalized = (clamp(measuredHeightMm, observed.min, observed.max) - observed.min) /
    (observed.max - observed.min);
  return Math.round(range.min + normalized * (range.max - range.min));
}

const CYLINDER_TALL_TEMPLATE: BestBottlesFamilyProfileTemplate = {
  id: "cylinder-tall",
  family: "cylinder",
  label: "Cylinder Tall",
  relativeScaleZoneId: "large-cylinder",
  relativeScaleZoneLabel: "Large Cylinder bottles",
  glassGeometryHint: BEST_BOTTLES_ROUND_GLASS_VOLUME_CUE,
  canvas: FIXED_STUDIO_CANVAS,
  targetProductHeightRangePct: BEST_BOTTLES_FAMILY_FILL_HEIGHT_RANGES.largeCylinders,
  observedHeightRangeMm: { min: 142, max: 199 },
  fallbackTargetProductHeightPct: 82,
  fillWidthPct: 56,
  baselinePct: BEST_BOTTLES_SHARED_BASELINE_PCT,
  primaryObjectCenterXPct: 50,
  detachedComponentPlacement: "right-sidecar",
  detachedComponentShiftsPrimary: false,
};

const BOSTON_ROUND_TEMPLATE: BestBottlesFamilyProfileTemplate = {
  id: "boston-round",
  family: "boston-round",
  label: "Boston Round",
  relativeScaleZoneId: "boston-round",
  relativeScaleZoneLabel: "Boston Round bottles",
  glassGeometryHint: BEST_BOTTLES_ROUND_GLASS_VOLUME_CUE,
  canvas: FIXED_STUDIO_CANVAS,
  targetProductHeightRangePct: BEST_BOTTLES_FAMILY_FILL_HEIGHT_RANGES.bostonRounds,
  observedHeightRangeMm: { min: 72, max: 117 },
  fallbackTargetProductHeightPct: 80,
  fillWidthPct: 64,
  baselinePct: BEST_BOTTLES_SHARED_BASELINE_PCT,
  primaryObjectCenterXPct: 50,
  detachedComponentPlacement: "right-sidecar",
  detachedComponentShiftsPrimary: false,
};

const EMPIRE_BOTTLE_TEMPLATE: BestBottlesFamilyProfileTemplate = {
  id: "empire-bottle",
  family: "empire",
  label: "Empire Bottle",
  relativeScaleZoneId: "empire-bottle",
  relativeScaleZoneLabel: "Empire bottles",
  canvas: FIXED_STUDIO_CANVAS,
  targetProductHeightRangePct: BEST_BOTTLES_FAMILY_FILL_HEIGHT_RANGES.empireBottles,
  observedHeightRangeMm: { min: 93, max: 139 },
  fallbackTargetProductHeightPct: 82,
  fillWidthPct: 64,
  baselinePct: BEST_BOTTLES_SHARED_BASELINE_PCT,
  primaryObjectCenterXPct: 50,
  detachedComponentPlacement: "right-sidecar",
  detachedComponentShiftsPrimary: false,
};

const HEAVY_PERFUME_BOTTLE_TEMPLATE: BestBottlesFamilyProfileTemplate = {
  id: "heavy-perfume-bottle",
  family: "heavy-perfume",
  label: "Heavy Perfume Bottle",
  relativeScaleZoneId: "heavy-perfume-bottle",
  relativeScaleZoneLabel: "Heavy perfume bottles",
  canvas: FIXED_STUDIO_CANVAS,
  targetProductHeightRangePct: BEST_BOTTLES_FAMILY_FILL_HEIGHT_RANGES.heavyPerfumeBottles,
  observedHeightRangeMm: { min: 80, max: 198 },
  fallbackTargetProductHeightPct: 86,
  fillWidthPct: 68,
  baselinePct: BEST_BOTTLES_SHARED_BASELINE_PCT,
  primaryObjectCenterXPct: 50,
  detachedComponentPlacement: "right-sidecar",
  detachedComponentShiftsPrimary: false,
};

const ALUMINUM_BOTTLE_TEMPLATE: BestBottlesFamilyProfileTemplate = {
  id: "aluminum-bottle",
  family: "aluminum-bottle",
  label: "Aluminum Bottle",
  relativeScaleZoneId: "aluminum-bottle",
  relativeScaleZoneLabel: "Aluminum bottles",
  canvas: FIXED_STUDIO_CANVAS,
  targetProductHeightRangePct: BEST_BOTTLES_FAMILY_FILL_HEIGHT_RANGES.aluminumBottles,
  observedHeightRangeMm: { min: 127, max: 186 },
  fallbackTargetProductHeightPct: 90,
  fillWidthPct: 58,
  baselinePct: BEST_BOTTLES_SHARED_BASELINE_PCT,
  primaryObjectCenterXPct: 50,
  detachedComponentPlacement: "right-sidecar",
  detachedComponentShiftsPrimary: false,
};

// ── Additional catalog families (authored 2026-07 to close the coverage gap) ────
// Every entry renders on the SAME fixed 2080×2288 tall-portrait studio canvas as
// the originals; only the fill-height/width band and scale-zone label differ per
// shape archetype. Silhouette stays locked to the reference image — these numbers
// govern ONLY how the product sits on the canvas.
function makeFamilyTemplate(config: {
  id: BestBottlesFamilyProfileId;
  family: string;
  label: string;
  relativeScaleZoneId: BestBottlesRelativeScaleZoneId;
  relativeScaleZoneLabel: string;
  targetProductHeightRangePct: { min: number; max: number };
  fallbackTargetProductHeightPct: number;
  fillWidthPct: number;
  observedHeightRangeMm: { min: number; max: number };
  glassGeometryHint?: string;
}): BestBottlesFamilyProfileTemplate {
  return {
    id: config.id,
    family: config.family,
    label: config.label,
    relativeScaleZoneId: config.relativeScaleZoneId,
    relativeScaleZoneLabel: config.relativeScaleZoneLabel,
    glassGeometryHint: config.glassGeometryHint,
    canvas: FIXED_STUDIO_CANVAS,
    targetProductHeightRangePct: config.targetProductHeightRangePct,
    observedHeightRangeMm: config.observedHeightRangeMm,
    fallbackTargetProductHeightPct: config.fallbackTargetProductHeightPct,
    fillWidthPct: config.fillWidthPct,
    baselinePct: BEST_BOTTLES_SHARED_BASELINE_PCT,
    primaryObjectCenterXPct: 50,
    detachedComponentPlacement: "right-sidecar",
    detachedComponentShiftsPrimary: false,
  };
}

const ROUND_BOTTLE_TEMPLATE = makeFamilyTemplate({
  id: "round-bottle", family: "round", label: "Round Bottle",
  relativeScaleZoneId: "round-bottle", relativeScaleZoneLabel: "Round bottles",
  targetProductHeightRangePct: { min: 76, max: 82 }, fallbackTargetProductHeightPct: 79,
  fillWidthPct: 66, observedHeightRangeMm: { min: 60, max: 150 },
  glassGeometryHint: BEST_BOTTLES_ROUND_GLASS_VOLUME_CUE,
});
const CIRCLE_BOTTLE_TEMPLATE = makeFamilyTemplate({
  id: "circle-bottle", family: "circle", label: "Circle Bottle",
  relativeScaleZoneId: "disc-bottle", relativeScaleZoneLabel: "Disc-form bottles",
  targetProductHeightRangePct: { min: 70, max: 76 }, fallbackTargetProductHeightPct: 73,
  fillWidthPct: 66, observedHeightRangeMm: { min: 40, max: 90 },
});
const SQUARE_BOTTLE_TEMPLATE = makeFamilyTemplate({
  id: "square-bottle", family: "square", label: "Square Bottle",
  relativeScaleZoneId: "cube-bottle", relativeScaleZoneLabel: "Cube-form bottles",
  targetProductHeightRangePct: { min: 68, max: 74 }, fallbackTargetProductHeightPct: 71,
  fillWidthPct: 64, observedHeightRangeMm: { min: 40, max: 120 },
});
const RECTANGLE_BOTTLE_TEMPLATE = makeFamilyTemplate({
  id: "rectangle-bottle", family: "rectangle", label: "Rectangle Bottle",
  relativeScaleZoneId: "rectangle-bottle", relativeScaleZoneLabel: "Rectangular bottles",
  targetProductHeightRangePct: { min: 76, max: 82 }, fallbackTargetProductHeightPct: 79,
  fillWidthPct: 60, observedHeightRangeMm: { min: 70, max: 150 },
});
const CREAM_JAR_TEMPLATE = makeFamilyTemplate({
  id: "cream-jar", family: "cream-jar", label: "Cream Jar",
  relativeScaleZoneId: "wide-jar", relativeScaleZoneLabel: "Wide jars",
  targetProductHeightRangePct: { min: 56, max: 64 }, fallbackTargetProductHeightPct: 60,
  fillWidthPct: 70, observedHeightRangeMm: { min: 30, max: 80 },
});
const APOTHECARY_TEMPLATE = makeFamilyTemplate({
  id: "apothecary-bottle", family: "apothecary", label: "Apothecary Bottle",
  relativeScaleZoneId: "tall-decorative", relativeScaleZoneLabel: "Tall decorative bottles",
  targetProductHeightRangePct: { min: 80, max: 86 }, fallbackTargetProductHeightPct: 83,
  fillWidthPct: 56, observedHeightRangeMm: { min: 90, max: 200 },
  glassGeometryHint: BEST_BOTTLES_ROUND_GLASS_VOLUME_CUE,
});
const PILLAR_TEMPLATE = makeFamilyTemplate({
  id: "pillar-bottle", family: "pillar", label: "Pillar Bottle",
  relativeScaleZoneId: "tall-decorative", relativeScaleZoneLabel: "Tall decorative bottles",
  targetProductHeightRangePct: { min: 80, max: 86 }, fallbackTargetProductHeightPct: 83,
  fillWidthPct: 54, observedHeightRangeMm: { min: 90, max: 200 },
  glassGeometryHint: BEST_BOTTLES_ROUND_GLASS_VOLUME_CUE,
});
const ATOMIZER_TEMPLATE = makeFamilyTemplate({
  id: "atomizer-bottle", family: "atomizer", label: "Atomizer Bottle",
  relativeScaleZoneId: "atomizer", relativeScaleZoneLabel: "Atomizer bottles",
  targetProductHeightRangePct: { min: 72, max: 80 }, fallbackTargetProductHeightPct: 76,
  fillWidthPct: 52, observedHeightRangeMm: { min: 60, max: 160 },
});
const LOTION_BOTTLE_TEMPLATE = makeFamilyTemplate({
  id: "lotion-bottle", family: "lotion-bottle", label: "Lotion Bottle",
  relativeScaleZoneId: "lotion-bottle", relativeScaleZoneLabel: "Lotion bottles",
  targetProductHeightRangePct: { min: 78, max: 84 }, fallbackTargetProductHeightPct: 81,
  fillWidthPct: 58, observedHeightRangeMm: { min: 100, max: 200 },
});
const PLASTIC_BOTTLE_TEMPLATE = makeFamilyTemplate({
  id: "plastic-bottle", family: "plastic-bottle", label: "Plastic Bottle",
  relativeScaleZoneId: "plastic-bottle", relativeScaleZoneLabel: "Plastic bottles",
  targetProductHeightRangePct: { min: 72, max: 78 }, fallbackTargetProductHeightPct: 75,
  fillWidthPct: 58, observedHeightRangeMm: { min: 70, max: 180 },
});
const BELL_TEMPLATE = makeFamilyTemplate({
  id: "bell-bottle", family: "bell", label: "Bell Bottle",
  relativeScaleZoneId: "mini-decorative", relativeScaleZoneLabel: "Miniature decorative bottles",
  targetProductHeightRangePct: { min: 60, max: 68 }, fallbackTargetProductHeightPct: 64,
  fillWidthPct: 60, observedHeightRangeMm: { min: 40, max: 90 },
});
const FLAIR_TEMPLATE = makeFamilyTemplate({
  id: "flair-bottle", family: "flair", label: "Flair Bottle",
  relativeScaleZoneId: "mini-decorative", relativeScaleZoneLabel: "Miniature decorative bottles",
  targetProductHeightRangePct: { min: 60, max: 68 }, fallbackTargetProductHeightPct: 64,
  fillWidthPct: 60, observedHeightRangeMm: { min: 40, max: 90 },
});
const ROYAL_TEMPLATE = makeFamilyTemplate({
  id: "royal-bottle", family: "royal", label: "Royal Bottle",
  relativeScaleZoneId: "mini-decorative", relativeScaleZoneLabel: "Miniature decorative bottles",
  targetProductHeightRangePct: { min: 62, max: 70 }, fallbackTargetProductHeightPct: 66,
  fillWidthPct: 62, observedHeightRangeMm: { min: 40, max: 100 },
});
const TULIP_TEMPLATE = makeFamilyTemplate({
  id: "tulip-bottle", family: "tulip", label: "Tulip Bottle",
  relativeScaleZoneId: "mini-decorative", relativeScaleZoneLabel: "Miniature decorative bottles",
  targetProductHeightRangePct: { min: 60, max: 68 }, fallbackTargetProductHeightPct: 64,
  fillWidthPct: 58, observedHeightRangeMm: { min: 40, max: 90 },
});
const TEARDROP_TEMPLATE = makeFamilyTemplate({
  id: "teardrop-bottle", family: "teardrop", label: "Teardrop Bottle",
  relativeScaleZoneId: "mini-decorative", relativeScaleZoneLabel: "Miniature decorative bottles",
  targetProductHeightRangePct: { min: 66, max: 74 }, fallbackTargetProductHeightPct: 70,
  fillWidthPct: 60, observedHeightRangeMm: { min: 50, max: 110 },
  glassGeometryHint: BEST_BOTTLES_ROUND_GLASS_VOLUME_CUE,
});
const GENERIC_BOTTLE_TEMPLATE = makeFamilyTemplate({
  id: "generic-bottle", family: "bottle", label: "Bottle",
  relativeScaleZoneId: "generic-bottle", relativeScaleZoneLabel: "Standard bottles",
  targetProductHeightRangePct: { min: 72, max: 78 }, fallbackTargetProductHeightPct: 75,
  fillWidthPct: 60, observedHeightRangeMm: { min: 60, max: 160 },
});

// Normalized-family-token → template. Keys are what normalizeFamilyText() produces
// for the catalog's family strings (e.g. "Cream Jar" → "cream-jar").
const FAMILY_TEMPLATE_BY_TOKEN: Record<string, BestBottlesFamilyProfileTemplate> = {
  round: ROUND_BOTTLE_TEMPLATE,
  circle: CIRCLE_BOTTLE_TEMPLATE,
  square: SQUARE_BOTTLE_TEMPLATE,
  rectangle: RECTANGLE_BOTTLE_TEMPLATE,
  "cream-jar": CREAM_JAR_TEMPLATE,
  apothecary: APOTHECARY_TEMPLATE,
  pillar: PILLAR_TEMPLATE,
  atomizer: ATOMIZER_TEMPLATE,
  "lotion-bottle": LOTION_BOTTLE_TEMPLATE,
  "plastic-bottle": PLASTIC_BOTTLE_TEMPLATE,
  bell: BELL_TEMPLATE,
  flair: FLAIR_TEMPLATE,
  royal: ROYAL_TEMPLATE,
  tulip: TULIP_TEMPLATE,
  teardrop: TEARDROP_TEMPLATE,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getMeasuredHeightMm(input: BestBottlesFamilyProfileProductInput): number | null {
  return parseFirstNumber(input.heightWithCap) ?? parseFirstNumber(input.heightWithoutCap);
}

function resolveTargetProductHeightPct(
  template: BestBottlesFamilyProfileTemplate,
  input?: BestBottlesFamilyProfileProductInput,
): number {
  const heightMm = input ? getMeasuredHeightMm(input) : null;
  if (heightMm == null) return template.fallbackTargetProductHeightPct;

  const observed = template.observedHeightRangeMm;
  const range = template.targetProductHeightRangePct;
  if (observed.max <= observed.min) return template.fallbackTargetProductHeightPct;

  const normalized = (clamp(heightMm, observed.min, observed.max) - observed.min) / (observed.max - observed.min);
  return Math.round(range.min + normalized * (range.max - range.min));
}

/**
 * Height-split zones OWN their scale band. The capacity-keyed global curve
 * cannot distinguish two real bottles that share a capacity: the 9 ml TALL
 * roll-on (106 mm) and the 9 ml standard roll-on (70 mm) both resolved to
 * 69% ± 2 fill, so a 51% real-height difference rendered as identical canvas
 * height (Jordan caught it on the storefront, 2026-07-20). The roller zones
 * were calibrated for exactly this split (small 58-64 / standard 67-72 /
 * tall 75-80); restore their authority. All other zones stay on the global
 * capacity rail per scale-contract v1.
 */
const HEIGHT_SPLIT_SCALE_ZONE_IDS = new Set<BestBottlesRelativeScaleZoneId>([
  "roller-small",
  "roller-standard",
  "roller-tall",
]);

function buildProfile(
  template: BestBottlesFamilyProfileTemplate,
  input?: BestBottlesFamilyProfileProductInput,
  scaleZone?: BestBottlesRelativeScaleZone | null,
): BestBottlesFamilyProfile {
  const { observedHeightRangeMm: _observedHeightRangeMm, fallbackTargetProductHeightPct: _fallback, ...profile } = template;
  const capacityMl = input ? getCapacityMl(input) : null;
  const globalTargetProductHeightPct = capacityMl == null
    ? resolveTargetProductHeightPct(template, input)
    : resolveBestBottlesGlobalScalePct(capacityMl);
  const familyScaleCorrectionPct = BEST_BOTTLES_FAMILY_SCALE_CORRECTIONS[template.id];
  const zoneOwnsScale = Boolean(
    scaleZone && HEIGHT_SPLIT_SCALE_ZONE_IDS.has(scaleZone.id),
  );
  const targetProductHeightPct = zoneOwnsScale
    ? scaleZone!.targetProductHeightPct
    : applyBestBottlesFamilyScaleCorrection(
        globalTargetProductHeightPct,
        familyScaleCorrectionPct,
      );
  return {
    ...profile,
    scaleContractVersion: BEST_BOTTLES_CATALOG_SCALE_VERSION,
    globalTargetProductHeightPct,
    familyScaleCorrectionPct,
    relativeScaleZoneId: scaleZone?.id ?? profile.relativeScaleZoneId,
    relativeScaleZoneLabel: scaleZone?.label ?? profile.relativeScaleZoneLabel,
    // Height-split zones own their calibrated band; every other zone exposes
    // the bounded correction rail around the global capacity target.
    targetProductHeightRangePct: zoneOwnsScale
      ? scaleZone!.targetProductHeightRangePct
      : {
          min: Math.max(0, targetProductHeightPct - 2),
          max: Math.min(100, targetProductHeightPct + 2),
        },
    targetProductHeightPct,
  };
}

export const BEST_BOTTLES_CYLINDER_COMPACT_PROFILE = buildProfile(SAMPLE_VIAL_TEMPLATE, {
  capacityMl: 3,
  heightWithCap: "54 mm",
}, {
  id: "sample-vial",
  label: "Sample vials",
  targetProductHeightRangePct: BEST_BOTTLES_FAMILY_FILL_HEIGHT_RANGES.sampleVials,
  targetProductHeightPct: 56,
});
export const BEST_BOTTLES_CYLINDER_STANDARD_PROFILE = buildProfile(CYLINDER_STANDARD_TEMPLATE);
export const BEST_BOTTLES_CYLINDER_TALL_PROFILE = buildProfile(CYLINDER_TALL_TEMPLATE);

/**
 * Generic bottle framing used as a defensive backstop by the catalog prompt path
 * so a bottle family we have not explicitly profiled still ships a real FRAMING
 * PROFILE block (never a blank one). NOT a substitute for the authored per-family
 * profiles above — it only catches never-before-seen family strings.
 */
export const GENERIC_BOTTLE_DEFAULT_PROFILE = buildProfile(GENERIC_BOTTLE_TEMPLATE);

function normalizeFamilyText(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_]+/g, "-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeSearchText(input: BestBottlesFamilyProfileProductInput): string {
  return [
    input.family,
    input.bottleCollection,
    input.category,
    input.graceSku,
    input.websiteSku,
    input.itemName,
    input.itemDescription,
    input.applicator,
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ")
    .trim()
    .toLowerCase();
}

function parseFirstNumber(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = value.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const parsed = Number.parseFloat(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function getCapacityMl(input: BestBottlesFamilyProfileProductInput): number | null {
  if (typeof input.capacityMl === "number" && Number.isFinite(input.capacityMl) && input.capacityMl > 0) {
    return input.capacityMl;
  }
  return parseFirstNumber(input.capacity);
}

function makeScaleZone(
  id: BestBottlesRelativeScaleZoneId,
  label: string,
  targetProductHeightRangePct: { min: number; max: number },
  targetProductHeightPct: number,
): BestBottlesRelativeScaleZone {
  return {
    id,
    label,
    targetProductHeightRangePct,
    targetProductHeightPct,
  };
}

function isSlimTallCylinderProduct(input: BestBottlesFamilyProfileProductInput): boolean {
  const capacityMl = getCapacityMl(input);
  const heightMm = parseFirstNumber(input.heightWithCap) ?? parseFirstNumber(input.heightWithoutCap);
  const diameterMm = parseFirstNumber(input.diameter);
  if (
    capacityMl == null ||
    capacityMl <= 4 ||
    heightMm == null ||
    diameterMm == null ||
    diameterMm <= 0
  ) {
    return false;
  }

  // Threshold is 105mm, not 110: the frosted slim 9ml (GB-CYL-FRS-9ML-S-02) is
  // 109mm with cap / 106mm without (Convex 2026-07-05, ±2mm) — a genuinely
  // tall, slender bottle that was missing this test by ~1mm and wrongly falling
  // into the short-bottle "small-cylinder" bucket. The diameter (<=19mm) and
  // aspect-ratio (>=6) constraints still guarantee it's actually slim + tall.
  return heightMm >= 105 && diameterMm <= 19 && heightMm / diameterMm >= 6;
}

function getCylinderRelativeScaleZone(
  input: BestBottlesFamilyProfileProductInput,
): BestBottlesRelativeScaleZone {
  const capacityMl = getCapacityMl(input);
  const heightWithCapMm = parseFirstNumber(input.heightWithCap);
  const heightWithoutCapMm = parseFirstNumber(input.heightWithoutCap);
  const measuredHeightMm = heightWithCapMm ?? heightWithoutCapMm;

  if (
    (capacityMl != null && capacityMl <= 4) ||
    (heightWithCapMm != null && heightWithCapMm <= 60) ||
    (heightWithoutCapMm != null && heightWithoutCapMm <= 40)
  ) {
    const target = capacityMl != null && capacityMl <= 3 ? 56 : 58;
    return makeScaleZone(
      "sample-vial",
      "Sample vials",
      BEST_BOTTLES_FAMILY_FILL_HEIGHT_RANGES.sampleVials,
      target,
    );
  }

  if (
    (capacityMl != null && capacityMl > 30) ||
    (heightWithCapMm != null && heightWithCapMm >= 142) ||
    (heightWithoutCapMm != null && heightWithoutCapMm >= 120)
  ) {
    return makeScaleZone(
      "large-cylinder",
      "Large Cylinder bottles",
      BEST_BOTTLES_FAMILY_FILL_HEIGHT_RANGES.largeCylinders,
      measuredHeightMm != null && measuredHeightMm >= 170 ? 82 : 80,
    );
  }

  if (isSlimTallCylinderProduct(input)) {
    return makeScaleZone(
      "standard-cylinder",
      "Standard Cylinder bottles",
      BEST_BOTTLES_FAMILY_FILL_HEIGHT_RANGES.cylinders10To30Ml,
      resolveTargetProductHeightPct(CYLINDER_STANDARD_TEMPLATE, input),
    );
  }

  if (
    (capacityMl != null && capacityMl < 10) ||
    (measuredHeightMm != null && measuredHeightMm < 90)
  ) {
    return makeScaleZone(
      "small-cylinder",
      "Small Cylinder bottles",
      BEST_BOTTLES_FAMILY_FILL_HEIGHT_RANGES.smallCylinders,
      resolveSmallCylinderFillHeightPct(measuredHeightMm),
    );
  }

  return makeScaleZone(
    "standard-cylinder",
    "Standard Cylinder bottles",
    BEST_BOTTLES_FAMILY_FILL_HEIGHT_RANGES.cylinders10To30Ml,
    76,
  );
}

function interpolateFill(
  heightMm: number | null,
  observedMinMm: number,
  observedMaxMm: number,
  range: { min: number; max: number },
  fallback: number,
): number {
  if (heightMm == null || observedMaxMm <= observedMinMm) return fallback;
  const normalized =
    (clamp(heightMm, observedMinMm, observedMaxMm) - observedMinMm) /
    (observedMaxMm - observedMinMm);
  return Math.round(range.min + normalized * (range.max - range.min));
}

/**
 * Roll-ons split by real size so 5ml, standard 9ml, and tall 9ml read as three
 * distinct heights on the shared shelf line (was one 65-70% band that made every
 * roll-on the same height regardless of capacity). Capacity is the primary key
 * (reliable in catalog data); measured height is the tiebreaker and drives the
 * within-zone interpolation. Observed height bands come from the 2026-06-27
 * Convex snapshot: 5ml roll-ons 57-72mm w/cap, standard 9ml 70-88mm, tall 9ml
 * 106-118mm.
 */
function getRollerRelativeScaleZone(
  input: BestBottlesFamilyProfileProductInput,
): BestBottlesRelativeScaleZone {
  const capacityMl = getCapacityMl(input);
  const heightMm = parseFirstNumber(input.heightWithCap) ?? parseFirstNumber(input.heightWithoutCap);

  const isTall =
    (heightMm != null && heightMm >= 100) ||
    (parseFirstNumber(input.heightWithoutCap) != null &&
      (parseFirstNumber(input.heightWithoutCap) as number) >= 95);
  const isSmall =
    !isTall &&
    ((capacityMl != null && capacityMl <= 5) ||
      (capacityMl == null && heightMm != null && heightMm <= 72));

  if (isSmall) {
    return makeScaleZone(
      "roller-small",
      "Small roller bottles (5ml)",
      BEST_BOTTLES_FAMILY_FILL_HEIGHT_RANGES.rollerBottlesSmall,
      interpolateFill(heightMm, 57, 72, BEST_BOTTLES_FAMILY_FILL_HEIGHT_RANGES.rollerBottlesSmall, 61),
    );
  }
  if (isTall) {
    return makeScaleZone(
      "roller-tall",
      "Tall roller bottles (9ml)",
      BEST_BOTTLES_FAMILY_FILL_HEIGHT_RANGES.rollerBottlesTall,
      interpolateFill(heightMm, 106, 118, BEST_BOTTLES_FAMILY_FILL_HEIGHT_RANGES.rollerBottlesTall, 76),
    );
  }
  return makeScaleZone(
    "roller-standard",
    "Standard roller bottles (9ml)",
    BEST_BOTTLES_FAMILY_FILL_HEIGHT_RANGES.rollerBottlesStandard,
    interpolateFill(heightMm, 70, 88, BEST_BOTTLES_FAMILY_FILL_HEIGHT_RANGES.rollerBottlesStandard, 70),
  );
}

function normalizedFamilyTokens(input: BestBottlesFamilyProfileProductInput): Set<string> {
  return new Set([
    normalizeFamilyText(input.family),
    normalizeFamilyText(input.bottleCollection),
    normalizeFamilyText(input.category),
  ].filter(Boolean));
}

function includesText(input: BestBottlesFamilyProfileProductInput, patterns: RegExp[]): boolean {
  const text = normalizeSearchText(input);
  return patterns.some((pattern) => pattern.test(text));
}

function isBestBottlesSampleVialProduct(input: BestBottlesFamilyProfileProductInput): boolean {
  const capacityMl = getCapacityMl(input);
  if (capacityMl != null && capacityMl <= 4) return true;

  const tokens = normalizedFamilyTokens(input);
  if (tokens.has("vial")) return true;

  return includesText(input, [/\bvial\b/, /\bgb-via\b/]);
}

function isBestBottlesRollerBottleProduct(input: BestBottlesFamilyProfileProductInput): boolean {
  return includesText(input, [/\broll-?on\b/, /\broller\b/, /\broller ball\b/, /\b-mrl-\b/, /\b-rol-\b/]);
}

function isBestBottlesBostonRoundProduct(input: BestBottlesFamilyProfileProductInput): boolean {
  const tokens = normalizedFamilyTokens(input);
  return tokens.has("boston-round") || includesText(input, [/\bboston round\b/, /\bgb-bos\b/]);
}

function isBestBottlesEmpireProduct(input: BestBottlesFamilyProfileProductInput): boolean {
  const tokens = normalizedFamilyTokens(input);
  return tokens.has("empire") || includesText(input, [/\bempire\b/]);
}

function isBestBottlesAluminumBottleProduct(input: BestBottlesFamilyProfileProductInput): boolean {
  const tokens = normalizedFamilyTokens(input);
  return tokens.has("aluminum-bottle") || includesText(input, [/\baluminum bottle\b/, /\baluminium bottle\b/]);
}

function isBestBottlesHeavyPerfumeProduct(input: BestBottlesFamilyProfileProductInput): boolean {
  const tokens = normalizedFamilyTokens(input);
  const decorativeFamilies = new Set([
    "decorative",
    "diamond",
    "diva",
    "elegant",
    "grace",
    "sleek",
    "slim",
  ]);
  if ([...tokens].some((token) => decorativeFamilies.has(token))) return true;
  return includesText(input, [/\bheavy perfume\b/, /\bperfume spray\b/]);
}

export function isBestBottlesCylinderFamilyProduct(
  input: BestBottlesFamilyProfileProductInput | null | undefined,
): boolean {
  if (!input) return false;

  const explicitFamily = normalizeFamilyText(input.family ?? input.bottleCollection);
  // Canonical family assignment wins over descriptive legacy copy such as
  // "Cylinder design ... vial". Vial outliers must never borrow Cylinder scale.
  if (explicitFamily === "vial") return false;
  if (explicitFamily === "cylinder" || explicitFamily === "tall-cylinder") return true;

  const text = normalizeSearchText(input);
  return text.includes("cylinder") || /\b(?:gb|lb)-cyl\b/.test(text) || text.includes("-cyl-");
}

export function getBestBottlesCylinderHeightDiameterRatio(
  input: BestBottlesFamilyProfileProductInput,
): number | null {
  const heightMm = parseFirstNumber(input.heightWithCap) ?? parseFirstNumber(input.heightWithoutCap);
  const diameterMm = parseFirstNumber(input.diameter);
  if (
    typeof heightMm !== "number" ||
    typeof diameterMm !== "number" ||
    !Number.isFinite(heightMm) ||
    !Number.isFinite(diameterMm) ||
    heightMm <= 0 ||
    diameterMm <= 0
  ) {
    return null;
  }
  return heightMm / diameterMm;
}

export function getBestBottlesCylinderFamilyProfile(
  input: BestBottlesFamilyProfileProductInput,
): BestBottlesFamilyProfile {
  const scaleZone = getCylinderRelativeScaleZone(input);

  if (scaleZone.id === "sample-vial") {
    return buildProfile(SAMPLE_VIAL_TEMPLATE, input, scaleZone);
  }

  if (scaleZone.id === "large-cylinder") {
    return buildProfile(CYLINDER_TALL_TEMPLATE, input, scaleZone);
  }

  return buildProfile(CYLINDER_STANDARD_TEMPLATE, input, scaleZone);
}

export function getBestBottlesRelativeScaleZoneForProduct(
  input: BestBottlesFamilyProfileProductInput | null | undefined,
): BestBottlesRelativeScaleZone | null {
  if (!input) return null;
  const base = getBestBottlesRelativeScaleZoneForProductInner(input);
  if (!base) return null;
  const capacityMl = getCapacityMl(input);
  if (capacityMl == null) return base;
  const targetProductHeightPct = resolveBestBottlesGlobalScalePct(capacityMl);
  return {
    ...base,
    label: isBestBottlesTasselSprayerProduct(input)
      ? `${base.label} (bulb + tassel)`
      : base.label,
    targetProductHeightRangePct: {
      min: Math.max(0, targetProductHeightPct - 2),
      max: Math.min(100, targetProductHeightPct + 2),
    },
    targetProductHeightPct,
  };
}

function getBestBottlesRelativeScaleZoneForProductInner(
  input: BestBottlesFamilyProfileProductInput | null | undefined,
): BestBottlesRelativeScaleZone | null {
  if (!input) return null;
  if (isBestBottlesSampleVialProduct(input)) return getCylinderRelativeScaleZone(input);
  if (isBestBottlesRollerBottleProduct(input)) {
    return getRollerRelativeScaleZone(input);
  }
  if (isBestBottlesCylinderFamilyProduct(input)) return getCylinderRelativeScaleZone(input);
  if (isBestBottlesBostonRoundProduct(input)) {
    return makeScaleZone(
      "boston-round",
      "Boston Round bottles",
      BEST_BOTTLES_FAMILY_FILL_HEIGHT_RANGES.bostonRounds,
      resolveTargetProductHeightPct(BOSTON_ROUND_TEMPLATE, input),
    );
  }
  if (isBestBottlesEmpireProduct(input)) {
    return makeScaleZone(
      "empire-bottle",
      "Empire bottles",
      BEST_BOTTLES_FAMILY_FILL_HEIGHT_RANGES.empireBottles,
      resolveTargetProductHeightPct(EMPIRE_BOTTLE_TEMPLATE, input),
    );
  }
  if (isBestBottlesAluminumBottleProduct(input)) {
    return makeScaleZone(
      "aluminum-bottle",
      "Aluminum bottles",
      BEST_BOTTLES_FAMILY_FILL_HEIGHT_RANGES.aluminumBottles,
      resolveTargetProductHeightPct(ALUMINUM_BOTTLE_TEMPLATE, input),
    );
  }
  if (isBestBottlesHeavyPerfumeProduct(input)) {
    return makeScaleZone(
      "heavy-perfume-bottle",
      "Heavy perfume bottles",
      BEST_BOTTLES_FAMILY_FILL_HEIGHT_RANGES.heavyPerfumeBottles,
      resolveTargetProductHeightPct(HEAVY_PERFUME_BOTTLE_TEMPLATE, input),
    );
  }
  return null;
}

function lookupRegisteredFamilyTemplate(
  input: BestBottlesFamilyProfileProductInput,
): BestBottlesFamilyProfileTemplate | null {
  for (const token of normalizedFamilyTokens(input)) {
    const template = FAMILY_TEMPLATE_BY_TOKEN[token];
    if (template) return template;
  }
  return null;
}

/**
 * Vintage bulb sprayers WITH a tassel compose very differently from plain
 * bottles: the bulb + braided hose + tassel drape widens/varies the detected
 * product bounds, so the family's tight fill-height range (e.g. 80-84% for
 * large cylinders) hard-fails renders whose bottles are actually correct
 * (observed real fills: ~52-68%, 2026-07-05 truth-v1 generalization test).
 * Tassel products get a widened acceptance range and a gentle normalize
 * target so the framing QA judges the assembly, not the bottle alone.
 */
// The bulb + draped tassel make the product WIDE. The rig scales to the lesser
// of the height target and the width target, and the default (narrow-bottle)
// fillWidthPct then crushes the scale — so the BOTTLE renders too short (the
// 100ml tassel came out clearly shorter than the 100ml spray, 2026-07-05).
// Fix: keep the bottle at a proper large-cylinder HEIGHT and RELAX the width
// target so the bulb + tassel extend into the side margin instead of shrinking
// the bottle. Range stays a touch permissive on the low end for tassel-drape
// variance; these ~18 SKUs are human-reviewed regardless.
// Target is pushed to 86 (was 80) so the GLASS BOTTLE shoulder lines up with the
// plain 100ml spray of the same bottle: the bulb+collar sits taller above the
// shoulder than a sprayer, so at a lower target the tassel bottle rendered
// visibly shorter. Higher target moves the bulb nearer the top margin and grows
// the glass. (The rig's top-air limit caps effective fill ~85%, so this is close
// to the practical max; exact shoulder-match confirmed by render on resume.)
export const BEST_BOTTLES_TASSEL_SPRAYER_FILL_HEIGHT_RANGE = { min: 70, max: 90 } as const;
export const BEST_BOTTLES_TASSEL_SPRAYER_TARGET_FILL_PCT = 86;
export const BEST_BOTTLES_TASSEL_SPRAYER_FILL_WIDTH_PCT = 96;

export function isBestBottlesTasselSprayerProduct(
  input: BestBottlesFamilyProfileProductInput | null | undefined,
): boolean {
  if (!input) return false;
  const haystack = `${input.applicator ?? ""} ${input.itemName ?? ""}`.toLowerCase();
  return haystack.includes("tassel");
}

function applyTasselSprayerFillAllowance(
  profile: BestBottlesFamilyProfile | null,
  input: BestBottlesFamilyProfileProductInput,
): BestBottlesFamilyProfile | null {
  if (!profile || !isBestBottlesTasselSprayerProduct(input)) return profile;
  return {
    ...profile,
    // Bulb + tassel topology needs width allowance, not a separate height
    // curve. Scale remains globally resolved and versioned.
    fillWidthPct: BEST_BOTTLES_TASSEL_SPRAYER_FILL_WIDTH_PCT,
    relativeScaleZoneLabel: `${profile.relativeScaleZoneLabel} (bulb + tassel)`,
  };
}

export function getBestBottlesFamilyProfileForProduct(
  input: BestBottlesFamilyProfileProductInput | null | undefined,
): BestBottlesFamilyProfile | null {
  if (!input) return null;
  const resolve = (): BestBottlesFamilyProfile | null => {
    if (isBestBottlesSampleVialProduct(input)) return buildProfile(SAMPLE_VIAL_TEMPLATE, input, getCylinderRelativeScaleZone(input));
    if (isBestBottlesRollerBottleProduct(input)) return buildProfile(ROLLER_BOTTLE_TEMPLATE, input, getRollerRelativeScaleZone(input));
    if (isBestBottlesCylinderFamilyProduct(input)) return getBestBottlesCylinderFamilyProfile(input);
    if (isBestBottlesBostonRoundProduct(input)) return buildProfile(BOSTON_ROUND_TEMPLATE, input);
    if (isBestBottlesEmpireProduct(input)) return buildProfile(EMPIRE_BOTTLE_TEMPLATE, input);
    if (isBestBottlesAluminumBottleProduct(input)) return buildProfile(ALUMINUM_BOTTLE_TEMPLATE, input);
    if (isBestBottlesHeavyPerfumeProduct(input)) return buildProfile(HEAVY_PERFUME_BOTTLE_TEMPLATE, input);
    const registered = lookupRegisteredFamilyTemplate(input);
    if (registered) return buildProfile(registered, input);
    // Unknown / non-bottle families intentionally return null here; the catalog
    // prompt path uses getBestBottlesCatalogFramingProfile() for a non-blank
    // fallback, while familyRig keeps its own universal-PDP default.
    return null;
  };
  return applyTasselSprayerFillAllowance(resolve(), input);
}

/**
 * Catalog-path resolver that NEVER returns null: any product still yields a real
 * framing profile so buildFinalPrompt() can never emit a blank FRAMING PROFILE
 * block. Prefer this over getBestBottlesFamilyProfileForProduct() when a framing
 * block must always be present.
 */
export function getBestBottlesCatalogFramingProfile(
  input: BestBottlesFamilyProfileProductInput | null | undefined,
): BestBottlesFamilyProfile {
  return getBestBottlesFamilyProfileForProduct(input) ?? GENERIC_BOTTLE_DEFAULT_PROFILE;
}
