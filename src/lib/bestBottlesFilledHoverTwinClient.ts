export const FILLED_HOVER_TWIN_FUNCTION_NAME =
  "generate-bestbottles-filled-twin" as const;
export const FILLED_HOVER_TWIN_PARENT_APPROVAL_TAG =
  "marketing-hover-parent-approved" as const;
export const FILLED_HOVER_TWIN_PILOT_GRACE_SKU =
  "GB-CYL-CLR-9ML-ROL-BKDT-02" as const;
export const FILLED_HOVER_TWIN_PILOT_WEBSITE_SKU =
  "GBTallCyl9RollBlkDot" as const;

export interface FilledHoverTwinLibraryImage {
  id: string;
  imageUrl: string;
  libraryTags: string[];
}

export interface FilledHoverTwinParentEligibility {
  eligible: boolean;
  approved: boolean;
  graceSku: string | null;
  websiteSku: string | null;
  issue: string | null;
}

function exactTag(tags: string[], value: string): boolean {
  return tags.some((tag) => tag === value);
}

export function getFilledHoverTwinParentEligibility(
  image: FilledHoverTwinLibraryImage,
): FilledHoverTwinParentEligibility {
  const tags = image.libraryTags ?? [];
  const graceSku = exactTag(tags, `sku:${FILLED_HOVER_TWIN_PILOT_GRACE_SKU}`)
    ? FILLED_HOVER_TWIN_PILOT_GRACE_SKU
    : null;
  const websiteSku = exactTag(tags, `websiteSku:${FILLED_HOVER_TWIN_PILOT_WEBSITE_SKU}`)
    ? FILLED_HOVER_TWIN_PILOT_WEBSITE_SKU
    : null;
  const marketingScene = exactTag(tags, "brand:best-bottles") &&
    (exactTag(tags, "scene-flexible") || exactTag(tags, "marketing"));
  const carriesPdpRole = tags.some((tag) => /(?:^|:)pdp-(?:primary|secondary)$/i.test(tag));
  const eligible = marketingScene && !carriesPdpRole && Boolean(graceSku && websiteSku);
  const approved = eligible && exactTag(tags, FILLED_HOVER_TWIN_PARENT_APPROVAL_TAG);

  return {
    eligible,
    approved,
    graceSku,
    websiteSku,
    issue: eligible
      ? null
      : "Only the exact Best Bottles pilot marketing scene can create a filled twin.",
  };
}

export function buildFilledHoverTwinInvocation(input: {
  image: FilledHoverTwinLibraryImage;
  organizationId: string;
  maskImageUrl: string;
  reviewedBy: string;
}) {
  const eligibility = getFilledHoverTwinParentEligibility(input.image);
  if (!eligibility.eligible) throw new Error(eligibility.issue ?? "Parent is not eligible.");
  if (!eligibility.approved) {
    throw new Error("Approve the marketing parent for this hover pair before generating.");
  }
  if (!input.organizationId.trim()) throw new Error("Organization is required.");
  if (!input.maskImageUrl.trim()) throw new Error("A reviewed cavity mask is required.");
  if (!input.reviewedBy.trim()) throw new Error("The mask reviewer is required.");

  return {
    functionName: FILLED_HOVER_TWIN_FUNCTION_NAME,
    body: {
      assetRole: "marketing-hover-filled" as const,
      organizationId: input.organizationId,
      parentImageId: input.image.id,
      graceSku: FILLED_HOVER_TWIN_PILOT_GRACE_SKU,
      websiteSku: FILLED_HOVER_TWIN_PILOT_WEBSITE_SKU,
      provider: "openai-image-2" as const,
      liquid: {
        color: "warm translucent amber",
        fillPercent: 70 as const,
      },
      mask: {
        imageUrl: input.maskImageUrl,
        mimeType: "image/png" as const,
        reviewed: true as const,
        reviewedBy: input.reviewedBy,
      },
      destinations: ["madison-library"] as ["madison-library"],
    },
  };
}
