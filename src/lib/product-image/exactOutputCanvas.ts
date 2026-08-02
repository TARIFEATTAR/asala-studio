export interface ExactCanvas {
  widthPx: number;
  heightPx: number;
}

export interface ExactOutputCanvasConstraints {
  outputCanvas: {
    width: number;
    height: number;
  };
}

const OPENAI_EXACT_PRESET_CANVAS_SIZES = new Set([
  "1024x1536",
  "1536x1024",
  "2048x2048",
  "2080x2288",
]);

export function resolveExactCanvasForAspectRatio(aspectRatio: string): ExactCanvas | null {
  const normalized = aspectRatio.trim().toLowerCase().replace(/\s+/g, "");
  if (normalized === "2:3" || normalized === "1024:1536" || normalized === "1024x1536") {
    return { widthPx: 1024, heightPx: 1536 };
  }
  if (normalized === "3:2" || normalized === "1536:1024" || normalized === "1536x1024") {
    return { widthPx: 1536, heightPx: 1024 };
  }
  if (normalized === "1:1" || normalized === "2048:2048" || normalized === "2048x2048") {
    return { widthPx: 2048, heightPx: 2048 };
  }
  if (normalized === "10:11" || normalized === "2080:2288" || normalized === "2080x2288") {
    return { widthPx: 2080, heightPx: 2288 };
  }
  return null;
}

export function getExactOutputCanvasConstraints(
  canvas: ExactCanvas,
): ExactOutputCanvasConstraints | undefined {
  const key = `${canvas.widthPx}x${canvas.heightPx}`;
  if (!OPENAI_EXACT_PRESET_CANVAS_SIZES.has(key)) return undefined;
  return { outputCanvas: { width: canvas.widthPx, height: canvas.heightPx } };
}
