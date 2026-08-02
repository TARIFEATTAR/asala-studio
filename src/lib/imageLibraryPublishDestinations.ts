export type ImageLibraryPublishDestination =
  | "tarife-sanity"
  | "best-bottles-grid"
  | "best-bottles-pdp";

export type ImageLibraryPublishDestinationOption = {
  value: ImageLibraryPublishDestination;
  label: string;
};

const BEST_BOTTLES_DESTINATIONS: ImageLibraryPublishDestinationOption[] = [
  {
    value: "best-bottles-grid",
    label: "Best Bottles group hero / grid thumbnail via Shopify",
  },
  {
    value: "best-bottles-pdp",
    label: "Best Bottles variant PDP image via Shopify",
  },
];

const TARIFE_DESTINATIONS: ImageLibraryPublishDestinationOption[] = [
  {
    value: "tarife-sanity",
    label: "Tarife product main image",
  },
];

export function getImageLibraryPublishDestinations(
  isBestBottlesOrg: boolean,
): ImageLibraryPublishDestinationOption[] {
  return isBestBottlesOrg ? BEST_BOTTLES_DESTINATIONS : TARIFE_DESTINATIONS;
}

export function getDefaultImageLibraryPublishDestination({
  isBestBottlesOrg,
  resolvedGroupSlug,
  resolvedWebsiteSku,
}: {
  isBestBottlesOrg: boolean;
  resolvedGroupSlug?: string | null;
  resolvedWebsiteSku?: string | null;
}): ImageLibraryPublishDestination {
  if (!isBestBottlesOrg) return "tarife-sanity";
  if (resolvedGroupSlug?.trim()) return "best-bottles-grid";
  if (resolvedWebsiteSku?.trim()) return "best-bottles-pdp";
  return "best-bottles-grid";
}
