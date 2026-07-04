import {
  BEST_BOTTLES_SQUARE_ROUND_CANVAS_PX,
  BEST_BOTTLES_TALL_NARROW_CANVAS_PX,
  BEST_BOTTLES_TALL_PORTRAIT_CANVAS_PX,
  BEST_BOTTLES_WIDE_LOW_CANVAS_PX,
} from "./productImageDimensions";

export type BestBottlesCanvasTierId =
  | "tall-narrow"
  | "tall-portrait"
  | "square-round"
  | "wide-low";

export type BestBottlesCanvasTierOrientation = "portrait" | "square" | "landscape";

export interface BestBottlesCanvasTier {
  id: BestBottlesCanvasTierId;
  label: string;
  purpose: string;
  canvas: { widthPx: number; heightPx: number };
  aspectRatio: "2:3" | "10:11" | "1:1" | "3:2";
  orientation: BestBottlesCanvasTierOrientation;
  foregroundAspectHOverW: {
    minInclusive: number;
    maxExclusive: number | null;
  };
  familyKeys: readonly string[];
}

export interface BestBottlesCanvasTierProductInput {
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
  foregroundAspectHOverW?: number | null;
}

const TALL_NARROW_FAMILIES = [] as const;

const TALL_PORTRAIT_FAMILIES = [
  "aluminum-bottle",
  "apothecary",
  "cylinder",
  "diamond",
  "diva",
  "dropper",
  "elegant",
  "empire",
  "eternal-flame",
  "fine-mist-sprayer",
  "genie-32ml",
  "grace",
  "lotion-pump",
  "marble-10ml",
  "marble-5ml",
  "pear-118ml",
  "pear-355ml",
  "plastic-bottle",
  "rectangle",
  "roll-on",
  "roll-on-cap",
  "sleek",
  "slim",
  "sprayer",
  "tall-cylinder",
  "tall-rectangle",
  "teardrop",
  "tola-6ml",
  "vial",
  "vintage-bulb",
] as const;

const SQUARE_ROUND_FAMILIES = [
  "atomizer",
  "boston-round",
  "cap-closure",
  "circle",
  "flair",
  "footed-rectangle",
  "round",
  "royal",
  "square",
  "tola-3ml",
  "tulip",
] as const;

const WIDE_LOW_FAMILIES = [
  "cream-jar",
  "heart",
  "heart-4ml",
  "jar",
] as const;

export const BEST_BOTTLES_TALL_NARROW_CANVAS_TIER: BestBottlesCanvasTier = {
  id: "tall-narrow",
  label: "Tall / Narrow",
  purpose:
    "Legacy native 2:3 generation canvas retained for older renders and manual experiments. Production Best Bottles catalog masters should prefer fixed-family 2080 x 2288 studio framing.",
  canvas: {
    widthPx: BEST_BOTTLES_TALL_NARROW_CANVAS_PX.width,
    heightPx: BEST_BOTTLES_TALL_NARROW_CANVAS_PX.height,
  },
  aspectRatio: "2:3",
  orientation: "portrait",
  foregroundAspectHOverW: {
    minInclusive: 3,
    maxExclusive: null,
  },
  familyKeys: TALL_NARROW_FAMILIES,
};

export const BEST_BOTTLES_TALL_PORTRAIT_CANVAS_TIER: BestBottlesCanvasTier = {
  id: "tall-portrait",
  label: "Tall Portrait",
  purpose:
    "Canonical Madison PDP/catalog master for tall, standard-upright, and narrow product silhouettes.",
  canvas: {
    widthPx: BEST_BOTTLES_TALL_PORTRAIT_CANVAS_PX.width,
    heightPx: BEST_BOTTLES_TALL_PORTRAIT_CANVAS_PX.height,
  },
  aspectRatio: "10:11",
  orientation: "portrait",
  foregroundAspectHOverW: {
    minInclusive: 1.35,
    maxExclusive: null,
  },
  familyKeys: TALL_PORTRAIT_FAMILIES,
};

export const BEST_BOTTLES_SQUARE_ROUND_CANVAS_TIER: BestBottlesCanvasTier = {
  id: "square-round",
  label: "Square / Round",
  purpose:
    "Square canvas for round, square, atomizer, cap/closure, and squat vial families that over-fill a portrait frame.",
  canvas: {
    widthPx: BEST_BOTTLES_SQUARE_ROUND_CANVAS_PX.width,
    heightPx: BEST_BOTTLES_SQUARE_ROUND_CANVAS_PX.height,
  },
  aspectRatio: "1:1",
  orientation: "square",
  foregroundAspectHOverW: {
    minInclusive: 0.9,
    maxExclusive: 1.35,
  },
  familyKeys: SQUARE_ROUND_FAMILIES,
};

export const BEST_BOTTLES_WIDE_LOW_CANVAS_TIER: BestBottlesCanvasTier = {
  id: "wide-low",
  label: "Wide / Low",
  purpose:
    "Landscape canvas for low, wide products such as cream jars and heart bottles that look stranded in portrait framing.",
  canvas: {
    widthPx: BEST_BOTTLES_WIDE_LOW_CANVAS_PX.width,
    heightPx: BEST_BOTTLES_WIDE_LOW_CANVAS_PX.height,
  },
  aspectRatio: "3:2",
  orientation: "landscape",
  foregroundAspectHOverW: {
    minInclusive: 0,
    maxExclusive: 0.9,
  },
  familyKeys: WIDE_LOW_FAMILIES,
};

export const BEST_BOTTLES_CANVAS_TIERS = [
  BEST_BOTTLES_TALL_NARROW_CANVAS_TIER,
  BEST_BOTTLES_TALL_PORTRAIT_CANVAS_TIER,
  BEST_BOTTLES_SQUARE_ROUND_CANVAS_TIER,
  BEST_BOTTLES_WIDE_LOW_CANVAS_TIER,
] as const;

export const BEST_BOTTLES_CANVAS_TIER_BY_ID = Object.freeze(
  Object.fromEntries(BEST_BOTTLES_CANVAS_TIERS.map((tier) => [tier.id, tier])),
) as Readonly<Record<BestBottlesCanvasTierId, BestBottlesCanvasTier>>;

function normalizeBestBottlesFamilyKey(family: string | null | undefined): string {
  return (family ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_]+/g, "-")
    .replace(/([a-z])(\d)/g, "$1-$2")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeCanvasTierText(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function parseFirstNumber(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = value.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const parsed = Number.parseFloat(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function getCapacityMl(input: BestBottlesCanvasTierProductInput): number | null {
  if (typeof input.capacityMl === "number" && Number.isFinite(input.capacityMl) && input.capacityMl > 0) {
    return input.capacityMl;
  }
  return parseFirstNumber(input.capacity);
}

function isCylinderProduct(input: BestBottlesCanvasTierProductInput): boolean {
  const explicitFamilyKey = normalizeBestBottlesFamilyKey(input.family ?? input.bottleCollection);
  if (explicitFamilyKey === "cylinder" || explicitFamilyKey === "tall-cylinder") return true;

  const text = normalizeCanvasTierText(
    [
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
      .join(" "),
  );

  return text.includes("cylinder") || /\b(?:gb|lb)-cyl\b/.test(text) || text.includes("-cyl-");
}

export function isCompactBestBottlesCylinderProduct(input: BestBottlesCanvasTierProductInput): boolean {
  if (!isCylinderProduct(input)) return false;

  const capacityMl = getCapacityMl(input);
  if (capacityMl != null && capacityMl <= 4) return true;

  const heightWithCapMm = parseFirstNumber(input.heightWithCap);
  if (heightWithCapMm != null && heightWithCapMm <= 60) return true;

  const heightWithoutCapMm = parseFirstNumber(input.heightWithoutCap);
  if (heightWithoutCapMm != null && heightWithoutCapMm <= 40) return true;

  return false;
}

const familyTierEntries = BEST_BOTTLES_CANVAS_TIERS.flatMap((tier) =>
  tier.familyKeys.map((familyKey) => [familyKey, tier.id] as const),
);

export const BEST_BOTTLES_CANVAS_TIER_ID_BY_FAMILY = Object.freeze(
  Object.fromEntries(familyTierEntries),
) as Readonly<Record<string, BestBottlesCanvasTierId>>;

export function getBestBottlesCanvasTierForForegroundAspect(
  foregroundAspectHOverW: number | null | undefined,
): BestBottlesCanvasTier | null {
  if (
    typeof foregroundAspectHOverW !== "number" ||
    !Number.isFinite(foregroundAspectHOverW) ||
    foregroundAspectHOverW <= 0
  ) {
    return null;
  }

  if (foregroundAspectHOverW < 0.9) return BEST_BOTTLES_WIDE_LOW_CANVAS_TIER;
  if (foregroundAspectHOverW < 1.35) return BEST_BOTTLES_SQUARE_ROUND_CANVAS_TIER;
  return BEST_BOTTLES_TALL_PORTRAIT_CANVAS_TIER;
}

export function getBestBottlesCanvasTierForKnownFamily(
  family: string | null | undefined,
): BestBottlesCanvasTier | null {
  const key = normalizeBestBottlesFamilyKey(family);
  const tierId = BEST_BOTTLES_CANVAS_TIER_ID_BY_FAMILY[key];
  if (!tierId) return null;
  return BEST_BOTTLES_CANVAS_TIER_BY_ID[tierId];
}

export function getBestBottlesCanvasTierForFamily(
  family: string | null | undefined,
): BestBottlesCanvasTier {
  return getBestBottlesCanvasTierForKnownFamily(family) ?? BEST_BOTTLES_TALL_PORTRAIT_CANVAS_TIER;
}

export function getBestBottlesCanvasTierForProduct(
  input: BestBottlesCanvasTierProductInput | null | undefined,
): BestBottlesCanvasTier {
  if (!input) return BEST_BOTTLES_TALL_PORTRAIT_CANVAS_TIER;
  return resolveBestBottlesCanvasTier({
    family: input.family ?? input.bottleCollection,
    foregroundAspectHOverW: input.foregroundAspectHOverW,
  });
}

export function resolveBestBottlesCanvasTier(input: {
  family?: string | null;
  foregroundAspectHOverW?: number | null;
}): BestBottlesCanvasTier {
  return (
    getBestBottlesCanvasTierForKnownFamily(input.family) ??
    getBestBottlesCanvasTierForForegroundAspect(input.foregroundAspectHOverW) ??
    BEST_BOTTLES_TALL_PORTRAIT_CANVAS_TIER
  );
}
