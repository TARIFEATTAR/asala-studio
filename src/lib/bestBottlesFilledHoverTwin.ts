export const FILLED_HOVER_TWIN_ASSET_ROLE = "marketing-hover-filled" as const;
export const FILLED_HOVER_TWIN_PROVIDER = "openai-image-2" as const;
export const FILLED_HOVER_TWIN_ALLOWED_DESTINATION = "madison-library" as const;

export type FilledHoverTwinRequest = {
  assetRole: typeof FILLED_HOVER_TWIN_ASSET_ROLE;
  parent: {
    generatedImageId: string;
    imageUrl: string;
    approvalStatus: "approved";
    assetRole: "scene" | "marketing";
  };
  identity: {
    graceSku: string;
    websiteSku: string;
  };
  liquid: {
    color: string;
    fillPercent: number;
  };
  provider: typeof FILLED_HOVER_TWIN_PROVIDER;
  mask: {
    imageUrl: string;
    mimeType: "image/png";
    reviewed: true;
    reviewedBy: string;
  };
  destinations: [typeof FILLED_HOVER_TWIN_ALLOWED_DESTINATION];
};

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} is required.`);
  }
  return value.trim();
}

function requiredHttpsUrl(value: unknown, label: string): string {
  const url = requiredString(value, label);
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`${label} must be a valid HTTPS URL.`);
  }
  if (parsed.protocol !== "https:") {
    throw new Error(`${label} must be a valid HTTPS URL.`);
  }
  return parsed.toString();
}

function normalizeTagValue(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function parseFilledHoverTwinRequest(input: unknown): FilledHoverTwinRequest {
  const root = asRecord(input, "Filled hover twin request");
  if (root.assetRole !== FILLED_HOVER_TWIN_ASSET_ROLE) {
    throw new Error("Filled twins are a marketing-only asset role.");
  }
  if (root.provider !== FILLED_HOVER_TWIN_PROVIDER) {
    throw new Error("The filled-twin pilot requires GPT Image 2.");
  }
  if (Array.isArray(root.referenceImages) && root.referenceImages.length > 0) {
    throw new Error("Do not provide referenceImages; the approved parent must be submitted exactly once.");
  }

  const destinations = root.destinations;
  if (
    !Array.isArray(destinations) ||
    destinations.length !== 1 ||
    destinations[0] !== FILLED_HOVER_TWIN_ALLOWED_DESTINATION
  ) {
    throw new Error("The marketing-only filled twin destination must be Madison Library only.");
  }

  const parent = asRecord(root.parent, "Parent");
  if (parent.approvalStatus !== "approved") {
    throw new Error("The marketing parent must be explicitly approved.");
  }
  if (parent.assetRole !== "scene" && parent.assetRole !== "marketing") {
    throw new Error("The parent must be an approved marketing parent or scene parent.");
  }

  const identity = asRecord(root.identity, "Identity");
  const graceSku = requiredString(identity.graceSku, "Grace SKU");
  const websiteSku = requiredString(identity.websiteSku, "Website SKU");

  const liquid = asRecord(root.liquid, "Liquid");
  const color = requiredString(liquid.color, "Liquid color");
  const fillPercent = liquid.fillPercent;
  if (typeof fillPercent !== "number" || !Number.isFinite(fillPercent) || fillPercent <= 0 || fillPercent >= 100) {
    throw new Error("Liquid fill percentage must be greater than 0 and less than 100.");
  }

  const mask = asRecord(root.mask, "Mask");
  if (mask.mimeType !== "image/png") {
    throw new Error("The reviewed cavity mask must be a PNG.");
  }
  if (mask.reviewed !== true) {
    throw new Error("The cavity mask must be reviewed before a paid edit.");
  }

  return {
    assetRole: FILLED_HOVER_TWIN_ASSET_ROLE,
    parent: {
      generatedImageId: requiredString(parent.generatedImageId, "Parent generated-image ID"),
      imageUrl: requiredHttpsUrl(parent.imageUrl, "Parent image URL"),
      approvalStatus: "approved",
      assetRole: parent.assetRole,
    },
    identity: { graceSku, websiteSku },
    liquid: { color, fillPercent },
    provider: FILLED_HOVER_TWIN_PROVIDER,
    mask: {
      imageUrl: requiredHttpsUrl(mask.imageUrl, "Mask image URL"),
      mimeType: "image/png",
      reviewed: true,
      reviewedBy: requiredString(mask.reviewedBy, "Mask reviewer"),
    },
    destinations: [FILLED_HOVER_TWIN_ALLOWED_DESTINATION],
  };
}

export function buildFilledHoverTwinPrompt(request: FilledHoverTwinRequest): string {
  return [
    "BEST BOTTLES MARKETING HOVER FILLED-TWIN EDIT.",
    `Add ${request.liquid.color} perfume oil only inside the transparent bottle cavity permitted by the supplied edit mask.`,
    `Set the liquid meniscus at exactly ${request.liquid.fillPercent}% of the usable internal cavity height, with slightly deeper color near the base and realistic absorption and refraction through the unchanged glass.`,
    "Preserve the bottle exterior, outer glass silhouette, edge highlights outside the cavity, cap, roller assembly, neck threads, base exterior, platform, background, lighting, crop, camera, and model-owned shadow exactly.",
    "Do not add labels, text, bubbles, suspended particles, a dip tube, a second bottle, or any scene change.",
    "Do not modify any pixel outside the permitted mask.",
  ].join("\n");
}

export function buildFilledHoverTwinTags(request: FilledHoverTwinRequest): string[] {
  return [
    `asset-role:${FILLED_HOVER_TWIN_ASSET_ROLE}`,
    "filled-twin",
    `filled-twin-parent:${request.parent.generatedImageId}`,
    `sku:${request.identity.graceSku}`,
    `websiteSku:${request.identity.websiteSku}`,
    `liquid-color:${normalizeTagValue(request.liquid.color)}`,
    `liquid-fill:${request.liquid.fillPercent}`,
    "destination:madison-library",
    "qa:review-pending",
  ];
}
