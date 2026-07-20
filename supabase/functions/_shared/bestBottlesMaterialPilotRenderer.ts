import {
  getMaterialPilotRenderer,
  type MaterialPilotReferenceRole,
  type MaterialPilotRendererId,
} from "./bestBottlesMaterialPilot.ts";

export interface MaterialPilotReferencePayload {
  role: MaterialPilotReferenceRole;
  data: string;
  mimeType: string;
  sha256: string;
}

export interface MaterialPilotProviderRequest {
  rendererId: MaterialPilotRendererId;
  provider: "openai" | "google";
  model: string;
  endpoint: "/v1/images/edits" | ":generateContent";
  prompt: string;
  references: MaterialPilotReferencePayload[];
  parameters: Record<string, unknown>;
}

export interface MaterialPilotProviderResult {
  imageBase64: string;
  mimeType: string;
  model: string;
  endpoint: string;
  providerRequestId?: string;
  responseMetadata?: Record<string, unknown>;
}

export interface MaterialPilotProviderDependencies {
  openai: (
    request: MaterialPilotProviderRequest,
  ) => Promise<MaterialPilotProviderResult>;
  google: (
    request: MaterialPilotProviderRequest,
  ) => Promise<MaterialPilotProviderResult>;
}

export function buildMaterialPilotProviderRequest(input: {
  rendererId: MaterialPilotRendererId;
  prompt: string;
  references: MaterialPilotReferencePayload[];
}): MaterialPilotProviderRequest {
  const renderer = getMaterialPilotRenderer(input.rendererId);
  if (!renderer?.active) {
    throw new Error(
      `Material pilot renderer '${input.rendererId}' is not active.`,
    );
  }
  if (!input.prompt.trim()) {
    throw new Error("Material pilot prompt is required.");
  }
  if (input.references.length === 0) {
    throw new Error(
      "Material pilot requires exact role-specific product evidence.",
    );
  }
  if (input.references.length > renderer.referenceLimit) {
    throw new Error(
      `${renderer.id} accepts at most ${renderer.referenceLimit} references.`,
    );
  }

  if (renderer.id === "openai-gpt-image-2") {
    return {
      rendererId: renderer.id,
      provider: "openai",
      model: renderer.model,
      endpoint: "/v1/images/edits",
      prompt: input.prompt,
      references: [...input.references],
      parameters: {
        size: "2080x2288",
        quality: "high",
        background: "opaque",
        outputFormat: "png",
        n: 1,
      },
    };
  }

  return {
    rendererId: renderer.id,
    provider: "google",
    model: renderer.model,
    endpoint: ":generateContent",
    prompt: input.prompt,
    references: [...input.references],
    parameters: {
      aspectRatio: "1:1",
      imageSize: "2K",
      responseModalities: ["IMAGE"],
    },
  };
}

export async function executeMaterialPilotRenderer(
  request: MaterialPilotProviderRequest,
  dependencies: MaterialPilotProviderDependencies,
): Promise<MaterialPilotProviderResult> {
  const result = request.provider === "openai"
    ? await dependencies.openai(request)
    : await dependencies.google(request);

  if (result.model !== request.model) {
    throw new Error(
      `Renderer model drift: requested '${request.model}' but received '${result.model}'.`,
    );
  }
  if (!result.imageBase64) throw new Error("Renderer returned no image bytes.");
  return result;
}
