export type SanityPlacementDestinationKey =
  | "homepage_hero"
  | "blog_post"
  | "product_family_hero"
  | "product_main_image"
  | "paper_doll_component";

export type SanityPlacementDestination = {
  key: SanityPlacementDestinationKey;
  label: string;
  description: string;
  requiresFamilySlug?: boolean;
  requiresRole?: boolean;
  requiresBestBottlesSkuTruth?: boolean;
};

export type SanityPlacementFormInput = {
  destinationKey: SanityPlacementDestinationKey;
  documentId?: string | null;
  altText?: string | null;
  caption?: string | null;
  familySlug?: string | null;
  role?: string | null;
  websiteSku?: string | null;
  graceSku?: string | null;
  shopifySku?: string | null;
  isBestBottlesOrg: boolean;
};

export const SANITY_PLACEMENT_DESTINATIONS: SanityPlacementDestination[] = [
  {
    key: "homepage_hero",
    label: "Homepage hero",
    description: "Patch the selected image into the configured homepage hero field.",
  },
  {
    key: "blog_post",
    label: "Blog post image",
    description: "Patch the selected image into the configured blog post image field.",
  },
  {
    key: "product_family_hero",
    label: "Product family hero",
    description: "Patch family/category media for Sanity-controlled merchandising surfaces.",
    requiresFamilySlug: true,
  },
  {
    key: "product_main_image",
    label: "Product main image",
    description: "Patch a Sanity product image field. Best Bottles commerce PDP media stays Shopify-first.",
    requiresBestBottlesSkuTruth: true,
  },
  {
    key: "paper_doll_component",
    label: "Paper-doll component",
    description: "Patch a component image such as cap, top, applicator, or bottle body.",
    requiresFamilySlug: true,
    requiresRole: true,
  },
];

export function getSanityPlacementDestination(
  key: SanityPlacementDestinationKey,
): SanityPlacementDestination | null {
  return SANITY_PLACEMENT_DESTINATIONS.find((destination) => destination.key === key) ?? null;
}

export function getDefaultSanityPlacementDestination({
  familySlug,
}: {
  familySlug?: string | null;
} = {}): SanityPlacementDestinationKey {
  return familySlug?.trim() ? "product_family_hero" : "homepage_hero";
}

function clean(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

export function validateSanityPlacementForm(
  input: SanityPlacementFormInput,
): { ok: true; errors: [] } | { ok: false; errors: string[] } {
  const destination = getSanityPlacementDestination(input.destinationKey);
  const errors: string[] = [];
  if (!destination) errors.push("Choose a Sanity destination.");
  if (!clean(input.documentId)) errors.push("Sanity document ID is required.");
  if (!clean(input.altText)) errors.push("Alt text is required.");
  if (destination?.requiresFamilySlug && !clean(input.familySlug)) {
    errors.push("Family slug is required for this Sanity placement.");
  }
  if (destination?.requiresRole && !clean(input.role)) {
    errors.push("Component role is required for this Sanity placement.");
  }
  if (
    input.isBestBottlesOrg &&
    destination?.requiresBestBottlesSkuTruth
  ) {
    if (!clean(input.websiteSku)) {
      errors.push("Website SKU is required for Best Bottles product image placement.");
    }
    if (!clean(input.graceSku)) {
      errors.push("Grace SKU is required for Best Bottles product image placement.");
    }
  }
  return errors.length === 0 ? { ok: true, errors: [] } : { ok: false, errors };
}

export function buildSanityPlacementMetadata(
  input: Omit<SanityPlacementFormInput, "isBestBottlesOrg">,
): Record<string, string> {
  const metadata: Record<string, string> = {};
  const fields = {
    documentId: input.documentId,
    altText: input.altText,
    caption: input.caption,
    familySlug: input.familySlug,
    role: input.role,
    websiteSku: input.websiteSku,
    graceSku: input.graceSku,
    shopifySku: input.shopifySku,
  };

  for (const [key, value] of Object.entries(fields)) {
    const cleaned = clean(value);
    if (cleaned) metadata[key] = cleaned;
  }

  return metadata;
}
