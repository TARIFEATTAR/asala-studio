export type CylinderBeautyGlassKey = "CLR" | "AMB" | "BLU" | "FRS" | "SWL";

export type CylinderBeautyHeroDefinition = {
  glassKey: CylinderBeautyGlassKey;
  glassLabel: "Clear" | "Amber" | "Cobalt Blue" | "Frosted" | "Swirl";
  outputSlug: string;
  referenceFilename: string;
  materialDirective: string;
};

export const CYLINDER_BEAUTY_HEROES: CylinderBeautyHeroDefinition[] = [
  {
    glassKey: "CLR",
    glassLabel: "Clear",
    outputSlug: "clear",
    referenceFilename: "clear-reference.png",
    materialDirective: "clear transparent glass with authentic edge highlights, visible wall thickness, neck transparency, and a clean heavy base",
  },
  {
    glassKey: "AMB",
    glassLabel: "Amber",
    outputSlug: "amber",
    referenceFilename: "amber-reference.png",
    materialDirective: "transparent amber glass with controlled transmitted warm light and no dark internal fill boundary",
  },
  {
    glassKey: "BLU",
    glassLabel: "Cobalt Blue",
    outputSlug: "cobalt",
    referenceFilename: "cobalt-blue-reference.png",
    materialDirective: "transparent cobalt-blue glass with controlled transmitted blue light and no dark internal fill boundary",
  },
  {
    glassKey: "FRS",
    glassLabel: "Frosted",
    outputSlug: "frosted",
    referenceFilename: "frosted-reference.png",
    materialDirective: "uniform fine acid-frosted clear glass that remains visibly empty, with no darker lower-body gradient or fill boundary",
  },
  {
    glassKey: "SWL",
    glassLabel: "Swirl",
    outputSlug: "swirl",
    referenceFilename: "swirl-reference.png",
    materialDirective: "clear transparent glass with the authentic subtle molded optical swirl from the product reference, never a painted or opaque stripe",
  },
];

export type GeminiInlineReference = {
  mimeType: string;
  data: string;
};

export type GeminiImageRequest = {
  model: "gemini-3-pro-image";
  body: {
    contents: Array<{
      role: "user";
      parts: Array<
        | { inlineData: GeminiInlineReference }
        | { text: string }
      >;
    }>;
    generationConfig: {
      responseModalities: ["IMAGE"];
      imageConfig: { aspectRatio: "4:5"; imageSize: "4K" };
    };
  };
};

export function buildGeminiImageRequest(input: {
  prompt: string;
  references: GeminiInlineReference[];
}): GeminiImageRequest {
  return {
    model: "gemini-3-pro-image",
    body: {
      contents: [{
        role: "user",
        parts: [
          ...input.references.map((reference) => ({ inlineData: reference })),
          { text: input.prompt },
        ],
      }],
      generationConfig: {
        responseModalities: ["IMAGE"],
        imageConfig: { aspectRatio: "4:5", imageSize: "4K" },
      },
    },
  };
}

const SESSION_LOCK = [
  "Exactly one EMPTY 9 mL 17-415 Cylinder bottle, uncapped, standing upright.",
  "The correctly seated metal roller ball is exposed. Exactly one matte-silver cap stands upright to the bottle's right.",
  "The bottle is approximately 2.7 times the cap height and the cap width approximately matches the bottle body width.",
  "One low irregular slab of natural warm sandstone with a flat top, authentic quarried fractured perimeter, fine sandy mineral grain, dry matte finish, and no additional stones.",
  "Warm ivory seamless studio sweep, large softbox camera-left and slightly above, white bounce camera-right, soft directional contact shadows, premium editorial product photography.",
  "Bottle foot and cap foot share one precise baseline on the sandstone. Preserve the complete product, slab, and generous negative space inside a centered crop-safe composition.",
  "The bottle is EMPTY: no liquid, oil, contents, horizontal fill line, internal lower-body fill gradient, haze, or opacity.",
  "No text, label, logo, additional object, plant, fabric, water, marble, concrete platform, stacked podium, or decorative rubble.",
  "Compose for a deterministic final 2080 × 2288 portrait crop without stretching, elongating, or redesigning the bottle.",
].join("\n");

export function buildClearMasterPrompt(): string {
  return [
    "Create the locked CLEAR master for the Best Bottles Cylinder beauty gallery.",
    "IMAGE 1 is the approved visual master. Preserve its complete elegant composition: the compact bottle silhouette, bottle/cap relationship, roller scale, object coordinates, shared baseline, natural sandstone slab, camera, crop, softbox lighting, shadows, background, and negative space. Recreate it as a new native studio render rather than changing its framing.",
    "IMAGE 2 is geometry truth from a real phone photograph. Use it only for exact bottle-to-cap proportions, bottle silhouette, cap height and width, neck, threads, and roller scale—not for glass color or fill. If any apparent product proportion conflicts, IMAGE 2 overrides.",
    "IMAGE 3 is product truth for the clear uncapped Cylinder bottle and metal roller assembly.",
    "IMAGE 4 is sandstone material direction only. Use its natural warm quarried material character, not its exact layout or number of stones.",
    SESSION_LOCK,
    "Render the body as clear transparent glass with authentic edge highlights, visible wall thickness, neck transparency, background refraction, and a clean heavy base.",
    "This frame becomes the immutable composition master for four material variants, so camera, coordinates, slab, lighting, crop, and baseline must be exceptionally clean and repeatable. DO NOT ELONGATE the bottle or shorten the cap.",
  ].join("\n\n");
}

export function buildVariantPrompt(hero: CylinderBeautyHeroDefinition): string {
  return [
    `Create the ${hero.glassLabel.toUpperCase()} glass variant of the approved Cylinder hero.`,
    "IMAGE 1 is the locked Clear master. Preserve its complete composition exactly: camera, crop, bottle silhouette and dimensions, bottle/cap ratio, roller geometry, object coordinates, shared baseline, sandstone slab shape and texture, background, softbox lighting, highlights, shadows, and negative space.",
    `IMAGE 2 is authoritative material truth for the bottle body only. Change ONLY the clear glass body in IMAGE 1 to ${hero.materialDirective}, matching IMAGE 2.`,
    SESSION_LOCK,
    "Do not move, resize, relight, redraw, or replace the roller assembly, matte-silver cap, sandstone, background, or shadows. It must look like the same exact studio session and frame, with only the glass treatment changed.",
  ].join("\n\n");
}

export function requiresExistingClearMaster(
  selectedGlassKeys: readonly CylinderBeautyGlassKey[],
): boolean {
  return selectedGlassKeys.some((glassKey) => glassKey !== "CLR")
    && !selectedGlassKeys.includes("CLR");
}

export function extractGeminiImage(value: unknown): GeminiInlineReference {
  if (!value || typeof value !== "object") {
    throw new Error("Gemini response contains no image");
  }
  const candidates = (value as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates)) throw new Error("Gemini response contains no image");
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") continue;
    const parts = (candidate as { content?: { parts?: unknown } }).content?.parts;
    if (!Array.isArray(parts)) continue;
    for (const part of parts) {
      if (!part || typeof part !== "object" || !("inlineData" in part)) continue;
      const inlineData = part.inlineData;
      if (!inlineData || typeof inlineData !== "object") continue;
      const { mimeType, data } = inlineData as { mimeType?: unknown; data?: unknown };
      if (typeof mimeType === "string" && typeof data === "string" && data.length > 0) {
        return { mimeType, data };
      }
    }
  }
  throw new Error("Gemini response contains no image");
}
