export const FILLED_HOVER_TWIN_PILOT_GRACE_SKU =
  "GB-CYL-CLR-9ML-ROL-BKDT-02" as const;
export const FILLED_HOVER_TWIN_PILOT_WEBSITE_SKU =
  "GBTallCyl9RollBlkDot" as const;
export const FILLED_HOVER_TWIN_PARENT_APPROVAL_TAG =
  "marketing-hover-parent-approved" as const;
export const FILLED_HOVER_TWIN_PILOT_LIQUID =
  "warm translucent amber" as const;
export const FILLED_HOVER_TWIN_PILOT_PLATFORM_THEME =
  "pale-limestone-low-plinth" as const;

export interface FilledHoverTwinEdgeRequest {
  assetRole: "marketing-hover-filled";
  organizationId: string;
  parentImageId: string;
  graceSku: typeof FILLED_HOVER_TWIN_PILOT_GRACE_SKU;
  websiteSku: typeof FILLED_HOVER_TWIN_PILOT_WEBSITE_SKU;
  provider: "openai-image-2";
  liquid: {
    color: typeof FILLED_HOVER_TWIN_PILOT_LIQUID;
    fillPercent: 70;
  };
  mask: {
    imageUrl: string;
    mimeType: "image/png";
    reviewed: true;
    reviewedBy: string;
  };
  destinations: ["madison-library"];
}

export type FilledHoverTwinEdgeValidation =
  | { ok: true; request: FilledHoverTwinEdgeRequest }
  | { ok: false; issues: string[] };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOP_LEVEL_KEYS = new Set([
  "assetRole",
  "organizationId",
  "parentImageId",
  "graceSku",
  "websiteSku",
  "provider",
  "liquid",
  "mask",
  "destinations",
]);

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function isHttpsUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  const set = new Set(allowed);
  return Object.keys(value).every((key) => set.has(key));
}

export function validateFilledHoverTwinEdgeRequest(
  input: unknown,
): FilledHoverTwinEdgeValidation {
  const root = record(input);
  if (!root) return { ok: false, issues: ["request_must_be_object"] };
  const issues: string[] = [];

  for (const key of Object.keys(root)) {
    if (!TOP_LEVEL_KEYS.has(key)) issues.push(`unknown_or_forbidden_field:${key}`);
  }
  if (root.assetRole !== "marketing-hover-filled") issues.push("asset_role_must_be_marketing_hover_filled");
  if (root.provider !== "openai-image-2") issues.push("provider_must_be_gpt_image_2");
  if (typeof root.organizationId !== "string" || !UUID.test(root.organizationId)) issues.push("invalid_organization_id");
  if (typeof root.parentImageId !== "string" || !UUID.test(root.parentImageId)) issues.push("invalid_parent_image_id");
  if (root.graceSku !== FILLED_HOVER_TWIN_PILOT_GRACE_SKU) issues.push("pilot_grace_sku_mismatch");
  if (root.websiteSku !== FILLED_HOVER_TWIN_PILOT_WEBSITE_SKU) issues.push("pilot_website_sku_mismatch");
  if (
    !Array.isArray(root.destinations) ||
    root.destinations.length !== 1 ||
    root.destinations[0] !== "madison-library"
  ) issues.push("destination_must_be_madison_library_only");

  const liquid = record(root.liquid);
  if (!liquid || !hasOnlyKeys(liquid, ["color", "fillPercent"])) {
    issues.push("invalid_liquid_contract");
  } else {
    if (liquid.color !== FILLED_HOVER_TWIN_PILOT_LIQUID) issues.push("pilot_liquid_color_mismatch");
    if (liquid.fillPercent !== 70) issues.push("pilot_fill_must_be_70");
  }

  const mask = record(root.mask);
  if (!mask || !hasOnlyKeys(mask, ["imageUrl", "mimeType", "reviewed", "reviewedBy"])) {
    issues.push("invalid_mask_contract");
  } else {
    if (!isHttpsUrl(mask.imageUrl)) issues.push("mask_url_must_be_https");
    if (mask.mimeType !== "image/png") issues.push("mask_must_be_png");
    if (mask.reviewed !== true) issues.push("mask_must_be_reviewed");
    if (typeof mask.reviewedBy !== "string" || !mask.reviewedBy.trim()) issues.push("mask_reviewer_required");
  }

  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, request: root as unknown as FilledHoverTwinEdgeRequest };
}

function buildPrompt(request: FilledHoverTwinEdgeRequest): string {
  return [
    "BEST BOTTLES MARKETING HOVER FILLED-TWIN EDIT.",
    `Add ${request.liquid.color} perfume oil only inside the transparent bottle cavity permitted by the supplied edit mask.`,
    `Set the liquid meniscus at exactly ${request.liquid.fillPercent}% of the usable internal cavity height, with slightly deeper color near the base and realistic absorption and refraction through the unchanged glass.`,
    "Preserve the bottle exterior, outer glass silhouette, cap, roller assembly, platform, background, lighting, crop, camera, highlights outside the cavity, and model-owned shadow exactly.",
    "Do not add labels, text, bubbles, suspended particles, a dip tube, a second bottle, or any scene change.",
    "Do not modify any pixel outside the transparent region of the supplied mask.",
  ].join("\n");
}

export function buildFilledHoverTwinProviderInput(
  request: FilledHoverTwinEdgeRequest,
  bytes: {
    parentBase64: string;
    parentMimeType: string;
    maskBase64: string;
  },
) {
  return {
    prompt: buildPrompt(request),
    model: "gpt-image-2" as const,
    size: "2080x2288" as const,
    quality: "high" as const,
    background: "opaque" as const,
    outputFormat: "png" as const,
    n: 1,
    referenceImages: [{
      data: bytes.parentBase64,
      mimeType: bytes.parentMimeType,
    }],
    editMask: {
      data: bytes.maskBase64,
      mimeType: "image/png" as const,
    },
  };
}

export function buildFilledHoverTwinLibraryTags(
  request: FilledHoverTwinEdgeRequest,
  qaStatus: "pass" | "fail",
): string[] {
  return [
    "brand:best-bottles",
    "asset-role:marketing-hover-filled",
    "filled-twin",
    `filled-twin-parent:${request.parentImageId}`,
    `sku:${request.graceSku}`,
    `websiteSku:${request.websiteSku}`,
    `liquid-color:${request.liquid.color.replace(/\s+/g, "-")}`,
    `liquid-fill:${request.liquid.fillPercent}`,
    `platform-theme:${FILLED_HOVER_TWIN_PILOT_PLATFORM_THEME}`,
    "destination:madison-library",
    `pair-qa:${qaStatus}`,
    qaStatus === "pass" ? "status:review-pending" : "status:rejected",
  ];
}
