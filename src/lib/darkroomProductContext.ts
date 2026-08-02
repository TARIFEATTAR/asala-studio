/**
 * Dark Room product-context hydration.
 *
 * A small layer (not a new architecture) that turns a Product Hub row into the
 * rich `productContext` payload `generate-madison-image` already understands,
 * pulling Best Bottles measurements/identity out of the row's `metadata`
 * (written by `scripts/enrich-bestbottles-product-hubs.ts`) and applying the
 * shared measurement overrides before the request leaves the browser.
 *
 * It also produces a compact UI summary so the Product Context area can show
 * "Full context loaded" vs "Missing image" / "Missing measurements" at a glance.
 */

import type { Product } from "@/hooks/useProducts";
import {
  applyBestBottlesMeasurementOverrides,
  type BestBottlesMeasurementOverride,
  type BestBottlesMeasurementOverridesPayload,
} from "./bestBottlesMeasurementOverrides";

type UnknownRecord = Record<string, unknown>;

interface UploadedImageLike {
  url: string;
  name?: string;
}

/** Where a loaded Product Reference Image came from. */
export type DarkroomReferenceSource =
  | "product-hub"
  | "pipeline-reference"
  | "best-bottles-catalog";

/** Reference-image status shown on the Product Context card. */
export type DarkroomImageStatus = "missing" | "manual" | DarkroomReferenceSource;

export const DARKROOM_IMAGE_SOURCE_LABEL: Record<DarkroomImageStatus, string> = {
  missing: "Missing image",
  manual: "Custom reference",
  "product-hub": "Product Hub image",
  "pipeline-reference": "Pipeline reference",
  "best-bottles-catalog": "Best Bottles catalog",
};

/** Best Bottles fields lifted off a Product Hub row's metadata (or set directly on it). */
export interface DarkroomBestBottlesContext {
  graceSku: string | null;
  websiteSku: string | null;
  shopifySku: string | null;
  productGroupSlug: string | null;
  family: string | null;
  capacityMl: number | null;
  heightWithoutCap: string | null;
  heightWithCap: string | null;
  diameter: string | null;
  neckThreadSize: string | null;
  applicator: string | null;
  capStyle: string | null;
  capColor: string | null;
  trimColor: string | null;
  color: string | null;
  imageUrl: string | null;
  imageUrlCapOff: string | null;
}

/** Compact, render-ready summary for the Dark Room Product Context card. */
export interface DarkroomProductContextSummary {
  name: string;
  sku: string | null;
  graceSku: string | null;
  websiteSku: string | null;
  capacity: string | null;
  heightWithoutCap: string | null;
  diameter: string | null;
  applicator: string | null;
  imageStatus: DarkroomImageStatus;
  imageSourceLabel: string;
  isBestBottles: boolean;
  hasMeasurements: boolean;
  fullyLoaded: boolean;
}

function asRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as UnknownRecord) : null;
}

function asString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    const resolved = asString(value);
    if (resolved) return resolved;
  }
  return null;
}

function firstArrayString(value: unknown): string | null {
  if (!Array.isArray(value)) return null;
  for (const entry of value) {
    const resolved = asString(entry);
    if (resolved) return resolved;
  }
  return null;
}

/**
 * Load the shared Best Bottles measurement overrides from the static asset.
 * Mirrors the loader in BestBottlesStudio so the same generation-readiness
 * dimensions are applied in Dark Room. Resolves to `[]` on any failure so the
 * selector never breaks for non-Best-Bottles orgs.
 */
export async function loadBestBottlesMeasurementOverrides(): Promise<BestBottlesMeasurementOverride[]> {
  try {
    const response = await fetch("/data/best-bottles-measurement-overrides.json");
    if (!response.ok) return [];
    const payload = (await response.json()) as BestBottlesMeasurementOverridesPayload;
    return payload.overrides ?? [];
  } catch {
    return [];
  }
}

/**
 * Pull Best Bottles fields off a Product Hub row. Reads (in priority order)
 * direct properties, then `metadata.best_bottles` / `metadata.bottle_specs`
 * (the enrich-script shape). Returns null when nothing Best-Bottles-ish exists.
 */
export function extractDarkroomBestBottlesContext(product: Product): DarkroomBestBottlesContext | null {
  const direct = product as unknown as UnknownRecord;
  const metadata = asRecord(product.metadata) ?? {};
  const bestBottles = asRecord(metadata.best_bottles) ?? {};
  const bottleSpecs = asRecord(metadata.bottle_specs) ?? {};
  const dimensions = asRecord(bottleSpecs.dimensions) ?? {};
  const capacity = asRecord(bottleSpecs.capacity) ?? {};
  const neck = asRecord(bottleSpecs.neck) ?? {};
  const container = asRecord(bottleSpecs.container) ?? {};
  const color = asRecord(bottleSpecs.color) ?? {};
  const externalIds = asRecord(direct.external_ids) ?? {};

  const context: DarkroomBestBottlesContext = {
    graceSku: firstString(direct.graceSku, bestBottles.graceSku, metadata.graceSku),
    websiteSku: firstString(direct.websiteSku, bestBottles.websiteSku, metadata.websiteSku),
    shopifySku: firstString(direct.shopifySku, bestBottles.shopifySku, metadata.shopifySku),
    productGroupSlug: firstString(
      direct.productGroupSlug,
      bestBottles.productGroupSlug,
      externalIds.best_bottles_product_group_slug,
    ),
    family: firstString(direct.family, bestBottles.family),
    capacityMl: asNumber(direct.capacityMl ?? bestBottles.capacityMl ?? capacity.ml),
    heightWithoutCap: firstString(direct.heightWithoutCap, dimensions.height_without_cap, bestBottles.heightWithoutCap),
    heightWithCap: firstString(direct.heightWithCap, dimensions.height_with_cap, bestBottles.heightWithCap),
    diameter: firstString(direct.diameter, dimensions.diameter, bestBottles.diameter),
    neckThreadSize: firstString(direct.neckThreadSize, bestBottles.neckThread, neck.thread_size, neck.finish_code),
    applicator: firstString(direct.applicator, bestBottles.applicator, firstArrayString(container.applicators)),
    capStyle: firstString(direct.capStyle, firstArrayString(container.capStyles)),
    capColor: firstString(direct.capColor, firstArrayString(container.capColors)),
    trimColor: firstString(direct.trimColor, bestBottles.trimColor),
    color: firstString(direct.color, bestBottles.canonicalColor, color.canonical),
    imageUrl: firstString(direct.imageUrl, bestBottles.imageUrl),
    imageUrlCapOff: firstString(direct.imageUrlCapOff, bestBottles.imageUrlCapOff),
  };

  const hasAnything = Object.values(context).some((value) => value !== null && value !== undefined);
  return hasAnything ? context : null;
}

function applyOverridesToContext(
  context: DarkroomBestBottlesContext,
  overrides: BestBottlesMeasurementOverride[],
): DarkroomBestBottlesContext {
  if (!context.graceSku || overrides.length === 0) return context;
  const [hydrated] = applyBestBottlesMeasurementOverrides(
    [
      {
        graceSku: context.graceSku,
        heightWithoutCap: context.heightWithoutCap,
        diameter: context.diameter,
      },
    ],
    overrides,
  );
  return {
    ...context,
    heightWithoutCap: hydrated.heightWithoutCap ?? context.heightWithoutCap,
    diameter: hydrated.diameter ?? context.diameter,
  };
}

/**
 * Build the enriched `productContext` payload for `generate-madison-image`.
 * Includes the standard Product Hub fields plus any Best Bottles measurement /
 * identity fields (with measurement overrides merged in).
 */
export function buildDarkroomProductContext(
  product: Product,
  overrides: BestBottlesMeasurementOverride[] = [],
): Record<string, unknown> {
  const direct = product as unknown as UnknownRecord;
  const bestBottles = extractDarkroomBestBottlesContext(product);
  const hydrated = bestBottles ? applyOverridesToContext(bestBottles, overrides) : null;

  const context: Record<string, unknown> = {
    id: product.id,
    name: product.name,
    sku: asString(product.sku) ?? hydrated?.graceSku ?? null,
    category: product.category ?? null,
    product_type: product.product_type ?? null,
    short_description: product.short_description ?? null,
    long_description: product.long_description ?? null,
    hero_image_url: product.hero_image_url ?? null,
    metadata: product.metadata ?? null,
    // Preserve the shallow fields the backend already relied on.
    collection: firstString(direct.collection, product.collections?.[0]) ?? "Unknown",
    scent_family: firstString(direct.scentFamily) ?? "Unspecified",
  };

  if (hydrated) {
    const bestBottlesPayload: Record<string, unknown> = {
      graceSku: hydrated.graceSku,
      websiteSku: hydrated.websiteSku,
      shopifySku: hydrated.shopifySku,
      productGroupSlug: hydrated.productGroupSlug,
      family: hydrated.family,
      capacityMl: hydrated.capacityMl,
      heightWithoutCap: hydrated.heightWithoutCap,
      heightWithCap: hydrated.heightWithCap,
      diameter: hydrated.diameter,
      neckThreadSize: hydrated.neckThreadSize,
      applicator: hydrated.applicator,
      capStyle: hydrated.capStyle,
      capColor: hydrated.capColor,
      trimColor: hydrated.trimColor,
      color: hydrated.color,
      imageUrl: hydrated.imageUrl,
      imageUrlCapOff: hydrated.imageUrlCapOff,
    };
    for (const [key, value] of Object.entries(bestBottlesPayload)) {
      if (value !== null && value !== undefined) context[key] = value;
    }
  }

  return context;
}

/**
 * Derive the compact card summary from a built productContext payload plus the
 * currently-loaded product reference image.
 */
export function summarizeDarkroomProductContext(
  product: Product,
  context: Record<string, unknown> | null,
  productImage: UploadedImageLike | null,
  imageSource?: DarkroomImageStatus | null,
): DarkroomProductContextSummary {
  const safeContext = context ?? {};
  const graceSku = asString(safeContext.graceSku);
  const websiteSku = asString(safeContext.websiteSku);
  const capacityMl = asNumber(safeContext.capacityMl);
  const heightWithoutCap = asString(safeContext.heightWithoutCap);
  const diameter = asString(safeContext.diameter);
  const applicator = asString(safeContext.applicator);

  const isBestBottles = Boolean(
    graceSku || websiteSku || asString(safeContext.productGroupSlug) || asString(safeContext.family),
  );
  const hasMeasurements = Boolean(heightWithoutCap && diameter);

  let imageStatus: DarkroomImageStatus = "missing";
  if (productImage?.url) {
    if (imageSource && imageSource !== "missing") {
      imageStatus = imageSource;
    } else if (product.hero_image_url && productImage.url === product.hero_image_url) {
      imageStatus = "product-hub";
    } else {
      imageStatus = "manual";
    }
  }

  const fullyLoaded = imageStatus !== "missing" && (!isBestBottles || hasMeasurements);

  return {
    name: product.name,
    sku: asString(product.sku),
    graceSku,
    websiteSku,
    capacity: capacityMl ? `${capacityMl} ml` : null,
    heightWithoutCap: heightWithoutCap ? `${heightWithoutCap} mm` : null,
    diameter: diameter ? `${diameter} mm` : null,
    applicator,
    imageStatus,
    imageSourceLabel: DARKROOM_IMAGE_SOURCE_LABEL[imageStatus],
    isBestBottles,
    hasMeasurements,
    fullyLoaded,
  };
}
