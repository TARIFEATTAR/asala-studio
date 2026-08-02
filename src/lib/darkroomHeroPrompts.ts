export type BestBottlesStoneHeroPresetId =
  | "warm-travertine"
  | "cream-limestone"
  | "honed-marble"
  | "sandstone-pillar"
  | "basalt-slate"
  | "green-onyx"
  | "rose-granite"
  | "soapstone-slab";

export type BestBottlesStoneHeroArrangement =
  | "single-stone"
  | "two-stone"
  | "stone-cluster";

export interface BestBottlesStoneHeroPreset {
  id: BestBottlesStoneHeroPresetId;
  label: string;
  shortLabel: string;
  materialPrompt: string;
}

export interface BuildBestBottlesStoneHeroPromptInput {
  stoneId: BestBottlesStoneHeroPresetId;
  arrangement: BestBottlesStoneHeroArrangement;
}

export const BEST_BOTTLES_STONE_HERO_PRESETS: BestBottlesStoneHeroPreset[] = [
  {
    id: "warm-travertine",
    label: "Warm Travertine",
    shortLabel: "Travertine",
    materialPrompt:
      "warm honed travertine with soft cream-beige pores, subtle linear sediment bands, and a refined matte stone finish",
  },
  {
    id: "cream-limestone",
    label: "Cream Limestone",
    shortLabel: "Limestone",
    materialPrompt:
      "smooth cream limestone with pale ivory fossil flecks, quiet tonal variation, and a sculptural gallery-plinth feel",
  },
  {
    id: "honed-marble",
    label: "Honed Marble",
    shortLabel: "Marble",
    materialPrompt:
      "honed warm white marble with sparse taupe veining, softened bevels, and a non-gloss museum-stone surface",
  },
  {
    id: "sandstone-pillar",
    label: "Sandstone Pillar",
    shortLabel: "Sandstone",
    materialPrompt:
      "warm sandstone pillar stone with fine grain, lightly weathered edges, and an architectural desert-studio character",
  },
  {
    id: "basalt-slate",
    label: "Basalt Slate",
    shortLabel: "Basalt",
    materialPrompt:
      "deep basalt and charcoal slate with a soft honed surface, restrained mineral texture, and clean cut slab edges",
  },
  {
    id: "green-onyx",
    label: "Green Onyx",
    shortLabel: "Onyx",
    materialPrompt:
      "pale green onyx with translucent mineral depth, warm cream veining, and an elegant carved-stone plinth presence",
  },
  {
    id: "rose-granite",
    label: "Rose Granite",
    shortLabel: "Granite",
    materialPrompt:
      "muted rose granite with fine mineral speckling, polished-but-soft edges, and a quiet warm luxury tone",
  },
  {
    id: "soapstone-slab",
    label: "Soapstone Slab",
    shortLabel: "Soapstone",
    materialPrompt:
      "soft gray-beige soapstone slab with silky matte texture, faint white veining, and understated apothecary weight",
  },
];

const ARRANGEMENT_PROMPTS: Record<BestBottlesStoneHeroArrangement, string> = {
  "single-stone":
    "Use one sculptural stone plinth or slab only. The bottle stands securely on top of it, with the stone acting as a quiet pedestal rather than a busy prop.",
  "two-stone":
    "Use two stone forms: one primary plinth supporting the bottle and one lower companion slab offset nearby for depth. Keep both stones aligned to the same studio floor logic.",
  "stone-cluster":
    "Use three to five stone forms in a restrained editorial cluster: one main plinth under the bottle, with smaller slabs or pillars arranged around it to create depth and homepage scale.",
};

function getStonePreset(id: BestBottlesStoneHeroPresetId): BestBottlesStoneHeroPreset {
  return BEST_BOTTLES_STONE_HERO_PRESETS.find((preset) => preset.id === id)
    ?? BEST_BOTTLES_STONE_HERO_PRESETS[0];
}

export function buildBestBottlesStoneHeroPrompt(
  input: BuildBestBottlesStoneHeroPromptInput,
): string {
  const stone = getStonePreset(input.stoneId);
  const arrangement = ARRANGEMENT_PROMPTS[input.arrangement];

  return [
    "Create a Best Bottles homepage hero image from the uploaded product reference image.",
    "Use the uploaded product image as the locked source of truth: preserve the exact product identity, silhouette, geometry, proportions, glass/body color, material, cap, applicator, cap state, and visible components.",
    "Do not paste the source image, place it as a rectangular cutout, lay it on top of another image, or keep the original image border; regenerate the full scene as one seamless studio photograph.",
    "Do not change the bottle into a different SKU, family, colorway, cap finish, applicator, label state, or accessory configuration.",
    "Scene direction: a high-end fragrance editorial studio set with Amouage-like stone plinth luxury, quiet Middle Eastern perfume-house richness, and Kinfolk-level restraint; do not copy Amouage bottles, packaging, logos, labels, typography, color blocking, or campaign layouts.",
    `Stone style: ${stone.materialPrompt}.`,
    arrangement,
    "Background and canvas: flat Best Bottles Bone #F5F3EF backdrop, warm cream studio atmosphere, edge-to-edge seamless coverage across the whole canvas; no side padding, no vertical bands, no edge stripes, no letterboxing, no mat border, no visible pasted-image boundary, no gradient, no texture pattern, no vignette, no horizon line, and no visible room clutter.",
    "Lighting: apply studio lighting to the entire image as one coherent scene: premium editorial photorealism with a single soft key light from upper-front-left, controlled warm bounce, gentle negative fill, subtle backlight through glass, crisp edge glints, realistic refraction, and a beautiful soft contact shadow falling back-right.",
    "Composition: homepage hero scale with the product as the clear subject, elegant stone support, generous negative space for website copy, clean depth, no awkward empty strips at the left or right edge, no crowding, and no cropping of cap, applicator, base, detached cap, shadow, or stone edge.",
    "Quality bar: poster-print luxury fragrance still life, Hasselblad-like clarity, realistic stone texture, premium glass realism, controlled amber glass density, refined retouching, calm Kinfolk editorial polish, not a CGI render.",
    "Forbidden: no text, no labels, no logos, no badge, no watermark, no hands, no flowers, no extra bottles, no spray mist, no fabric folds, no wood table, no copied reference-scene props, no magazine page chrome, no distorted cap, no wrong bottle color, no invented components, no rectangular source-image frame, no side padding, no vertical bands or stripes.",
  ].join(" ");
}
