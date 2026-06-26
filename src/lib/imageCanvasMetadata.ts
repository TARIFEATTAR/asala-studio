export interface ImageCanvasSize {
  width: number;
  height: number;
}

export interface PreserveSourceCanvasConstraints {
  preserveSourceCanvas: true;
  outputCanvas: ImageCanvasSize;
}

export const BEST_BOTTLES_PDP_CANVAS: ImageCanvasSize = {
  width: 2080,
  height: 2288,
};

export interface ReadCanvasGenerationMetadata {
  aspectRatio: string | null;
  imageConstraints: PreserveSourceCanvasConstraints | undefined;
  canvas: ImageCanvasSize | null;
}

export interface ResolveGenerationCanvasContext {
  prompt?: string | null;
  libraryTags?: string[] | null;
  aspectRatio?: string | null;
  goalType?: string | null;
}

export interface ResolvedGenerationCanvasMetadata extends ReadCanvasGenerationMetadata {
  canvasSource:
    | "source-image"
    | "best-bottles-pdp-fallback"
    | "context-aspect-ratio"
    | "none";
}

function greatestCommonDivisor(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) {
    const next = x % y;
    x = y;
    y = next;
  }
  return x || 1;
}

export function normalizeImageCanvasSize(
  value: Partial<ImageCanvasSize> | null | undefined,
): ImageCanvasSize | null {
  const width = Number(value?.width);
  const height = Number(value?.height);

  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }

  return {
    width: Math.round(width),
    height: Math.round(height),
  };
}

export function toCanvasAspectRatio(canvas: ImageCanvasSize | null | undefined): string | null {
  const normalized = normalizeImageCanvasSize(canvas);
  if (!normalized) return null;

  const divisor = greatestCommonDivisor(normalized.width, normalized.height);
  return `${normalized.width / divisor}:${normalized.height / divisor}`;
}

export function buildPreserveSourceCanvasConstraints(
  canvas: ImageCanvasSize | null | undefined,
): PreserveSourceCanvasConstraints | undefined {
  const normalized = normalizeImageCanvasSize(canvas);
  if (!normalized) return undefined;

  return {
    preserveSourceCanvas: true,
    outputCanvas: normalized,
  };
}

export async function readImageCanvasSize(imageUrl: string): Promise<ImageCanvasSize | null> {
  if (typeof window === "undefined" || typeof Image === "undefined") {
    return null;
  }

  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      resolve(
        normalizeImageCanvasSize({
          width: image.naturalWidth || image.width,
          height: image.naturalHeight || image.height,
        }),
      );
    };
    image.onerror = () => resolve(null);
    image.src = imageUrl;
  });
}

export async function readPreserveCanvasGenerationMetadata(
  imageUrl: string | null | undefined,
): Promise<ReadCanvasGenerationMetadata> {
  if (!imageUrl) {
    return { aspectRatio: null, imageConstraints: undefined, canvas: null };
  }

  const canvas = await readImageCanvasSize(imageUrl);
  return {
    aspectRatio: toCanvasAspectRatio(canvas),
    imageConstraints: buildPreserveSourceCanvasConstraints(canvas),
    canvas,
  };
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function normalizeTags(tags: string[] | null | undefined): string[] {
  return Array.isArray(tags) ? tags.map((tag) => normalizeText(tag)).filter(Boolean) : [];
}

function isBestBottlesPdpCanvasContext(context: ResolveGenerationCanvasContext): boolean {
  const prompt = normalizeText(context.prompt);
  const tags = normalizeTags(context.libraryTags);
  const tagSet = new Set(tags);

  const isBestBottles =
    prompt.includes("reference-locked best bottles") ||
    prompt.includes("best bottles") ||
    tagSet.has("brand:best-bottles") ||
    tagSet.has("best-bottles");

  if (!isBestBottles) return false;

  const isExplicitHeroOrBackground =
    prompt.includes("homepage hero") ||
    prompt.includes("hero image") ||
    tagSet.has("intended-use:homepage-hero") ||
    tagSet.has("role:background-scene") ||
    tagSet.has("kind:darkroom-background-scene");

  if (isExplicitHeroOrBackground) return false;

  return (
    prompt.includes("reference-locked best bottles") ||
    prompt.includes("pdp master") ||
    tagSet.has("studio-master") ||
    tagSet.has("pipeline") ||
    tagSet.has("role:product-image") ||
    tagSet.has("intended-use:pdp-candidate")
  );
}

export function resolveGenerationCanvasMetadata(
  metadata: ReadCanvasGenerationMetadata,
  context: ResolveGenerationCanvasContext = {},
): ResolvedGenerationCanvasMetadata {
  if (metadata.canvas) {
    return {
      aspectRatio: metadata.aspectRatio,
      imageConstraints: metadata.imageConstraints,
      canvas: metadata.canvas,
      canvasSource: "source-image",
    };
  }

  if (isBestBottlesPdpCanvasContext(context)) {
    return {
      aspectRatio: toCanvasAspectRatio(BEST_BOTTLES_PDP_CANVAS),
      imageConstraints: buildPreserveSourceCanvasConstraints(BEST_BOTTLES_PDP_CANVAS),
      canvas: BEST_BOTTLES_PDP_CANVAS,
      canvasSource: "best-bottles-pdp-fallback",
    };
  }

  const aspectRatio = normalizeText(context.aspectRatio) || metadata.aspectRatio;
  if (aspectRatio) {
    return {
      aspectRatio,
      imageConstraints: metadata.imageConstraints,
      canvas: metadata.canvas,
      canvasSource: "context-aspect-ratio",
    };
  }

  return {
    aspectRatio: null,
    imageConstraints: metadata.imageConstraints,
    canvas: metadata.canvas,
    canvasSource: "none",
  };
}
