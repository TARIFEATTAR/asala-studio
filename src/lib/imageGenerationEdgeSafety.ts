export type ImageGenerationOutputFormat = "png" | "jpeg" | "webp";

export interface EdgeSafeImageSettingsInput {
  aiProvider?: string | null;
  resolution?: string | null;
  outputFormat?: string | null;
  hasReferenceImages?: boolean;
  surface?: "darkroom" | "light-table" | "other";
  goalType?: string | null;
}

export interface EdgeSafeImageSettings {
  aiProvider: string;
  resolution: string;
  outputFormat: ImageGenerationOutputFormat;
  adjusted: boolean;
  reasons: string[];
}

const OUTPUT_FORMATS = new Set<ImageGenerationOutputFormat>(["png", "jpeg", "webp"]);

export function isOpenAIImageProvider(provider?: string | null): boolean {
  const normalized = provider?.trim().toLowerCase();
  return Boolean(normalized && (
    normalized.startsWith("openai") ||
    normalized.startsWith("gpt-image") ||
    normalized === "dall-e-3"
  ));
}

function normalizeOutputFormat(format?: string | null): ImageGenerationOutputFormat {
  const normalized = format?.trim().toLowerCase();
  if (normalized === "jpg") return "jpeg";
  return OUTPUT_FORMATS.has(normalized as ImageGenerationOutputFormat)
    ? (normalized as ImageGenerationOutputFormat)
    : "png";
}

export function resolveEdgeSafeImageSettings(input: EdgeSafeImageSettingsInput): EdgeSafeImageSettings {
  const aiProvider = input.aiProvider?.trim() || "auto";
  const hasReferenceImages = Boolean(input.hasReferenceImages);
  const openaiReferenceEdit = isOpenAIImageProvider(aiProvider) && hasReferenceImages;
  const requestedResolution = input.resolution?.trim() || "standard";
  const requestedFormat = normalizeOutputFormat(input.outputFormat);
  const reasons: string[] = [];

  let resolution = requestedResolution;
  let outputFormat = requestedFormat;

  if (openaiReferenceEdit && outputFormat === "png") {
    outputFormat = "jpeg";
    reasons.push("openai-reference-edit-jpeg");
  }

  if (openaiReferenceEdit && resolution === "4k") {
    resolution = "high";
    reasons.push("openai-reference-edit-no-4k");
  }

  if (
    openaiReferenceEdit &&
    (input.surface === "light-table" || input.goalType === "variation" || input.goalType === "refinement")
  ) {
    if (resolution !== "standard") reasons.push("light-table-reference-edit-standard");
    resolution = "standard";
  }

  return {
    aiProvider,
    resolution,
    outputFormat,
    adjusted: resolution !== requestedResolution || outputFormat !== requestedFormat,
    reasons,
  };
}

export async function getSupabaseFunctionErrorMessage(error: unknown): Promise<string> {
  const err = error as {
    message?: string;
    status?: number;
    context?: {
      status?: number;
      statusText?: string;
      body?: unknown;
      json?: () => Promise<unknown>;
      text?: () => Promise<string>;
    };
  } | null | undefined;

  let message = err?.message || String(error);
  const status = err?.status ?? err?.context?.status;

  try {
    if (typeof err?.context?.json === "function") {
      const body = await err.context.json();
      if (body && typeof body === "object" && "error" in body) {
        const bodyError = (body as { error?: unknown }).error;
        if (typeof bodyError === "string" && bodyError.trim()) return bodyError;
      }
    }
  } catch {
    // The Supabase client only lets the response body be read once.
  }

  try {
    if (typeof err?.context?.text === "function") {
      const text = await err.context.text();
      if (text.trim()) return text;
    }
  } catch {
    // Fall back to the SDK message below.
  }

  if (
    status === 546 ||
    message.includes("non-2xx") ||
    message.includes("Failed to send a request")
  ) {
    return "The image worker hit an Edge Function limit before it could return details. Retry with fewer references or Standard resolution; Madison will send reference edits through a lighter path.";
  }

  if (err?.context?.statusText && status) {
    return `${message} (${status} ${err.context.statusText})`;
  }

  return message;
}
