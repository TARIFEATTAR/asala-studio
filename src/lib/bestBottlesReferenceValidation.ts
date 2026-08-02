const SUPPORTED_REFERENCE_EXT = /\.(png|jpe?g|webp)(?:[?#].*)?$/i;
const UNSUPPORTED_REFERENCE_EXT = /\.(gif|heic|bmp|tiff?)(?:[?#].*)?$/i;

export interface BestBottlesReferenceCanvas {
  width: number;
  height: number;
}

export interface BestBottlesReferenceProvenance {
  referenceSource: string | null | undefined;
  referenceName?: string | null;
}

// Reference inputs keep their reviewed native PSD-export dimensions. They are
// not required to match Madison's standardized 2080 × 2288 output canvas.
// This floor rejects small legacy website thumbnails (for example 360 × 480)
// without turning one known SKU's 750 × 1594 source into a catalog-wide size.
const BEST_BOTTLES_MIN_CANONICAL_REFERENCE_PIXELS = 1_000_000;
// Founder-approved exception (Jordan 2026-07-20): reviewed Photoshop-Studio
// product-truth exports are natively ~600 × 827 (0.5 MP) — the same resolution
// class as the Cylinder promoted refs that already carry a founder-approved
// bypass. References WITH approved PSD-derived provenance pass at this floor;
// unreviewed sources still face the full 1 MP floor above.
const BEST_BOTTLES_MIN_REVIEWED_REFERENCE_PIXELS = 400_000;

export function getBestBottlesReferenceUrlIssue(url: string | null | undefined): string | null {
  const value = String(url ?? "").trim();
  if (!value) return "Missing reference URL.";

  if (/^data:image\/(?:png|jpe?g|webp);base64,/i.test(value)) return null;
  if (/^data:/i.test(value)) {
    return "Reference must be a PNG, JPG, or WebP image.";
  }

  if (/^https?:\/\//i.test(value)) {
    if (UNSUPPORTED_REFERENCE_EXT.test(value)) {
      return "Reference format is unsupported for image edits. Use PNG, JPG, or WebP.";
    }
    return null;
  }

  if (/^(blob|file):/i.test(value)) {
    return "Reference is browser-local. Upload it to Madison storage before generating.";
  }

  if (value.startsWith("/") && SUPPORTED_REFERENCE_EXT.test(value)) {
    return "Reference is a local app path, not a public image URL. Upload or sync the PNG first.";
  }

  if (SUPPORTED_REFERENCE_EXT.test(value)) {
    return "Reference is a pipeline file path, not a fetchable image URL. Import/upload the PNG before generating.";
  }

  return "Reference is not a fetchable image URL.";
}

export function isBestBottlesReferenceUrlUsable(url: string | null | undefined): boolean {
  return getBestBottlesReferenceUrlIssue(url) === null;
}

/** A fetchable image is not automatically an approved product-truth reference. */
export function getBestBottlesCanonicalReferenceIssue(
  url: string | null | undefined,
  canvas: BestBottlesReferenceCanvas | null | undefined,
  provenance: BestBottlesReferenceProvenance,
): string | null {
  const value = String(url ?? "").trim();
  if (/bestbottles\.com\/images\/store\//i.test(value)) {
    return "Live BestBottles product images are commercial evidence, not canonical generation references.";
  }

  const urlIssue = getBestBottlesReferenceUrlIssue(url);
  if (urlIssue) return urlIssue;

  if (!canvas) {
    return "Reference canvas could not be verified. Canonical generation requires a reviewed PSD-derived source at its native resolution.";
  }

  const source = String(provenance.referenceSource ?? "").trim().toLowerCase();
  const reviewedLocalName = String(provenance.referenceName ?? "").trim();
  const isApprovedPersistedCanonical = source === "flattened-product-truth";
  const isApprovedLocalCanonical =
    source === "reviewed-local-canonical" &&
    /__pdp-main__v\d+\.png$/i.test(reviewedLocalName);
  const hasApprovedProvenance = isApprovedPersistedCanonical || isApprovedLocalCanonical;

  // Reviewed product-truth exports get the founder-approved lower floor; every
  // other source keeps the strict 1 MP thumbnail rejection.
  const minPixels = hasApprovedProvenance
    ? BEST_BOTTLES_MIN_REVIEWED_REFERENCE_PIXELS
    : BEST_BOTTLES_MIN_CANONICAL_REFERENCE_PIXELS;
  if (canvas.width * canvas.height < minPixels) {
    return `Reference is ${canvas.width} × ${canvas.height}; canonical generation requires a reviewed PSD-derived source at native resolution with at least ${hasApprovedProvenance ? "0.4" : "1"} megapixel${hasApprovedProvenance ? " (founder-approved reviewed floor)" : ", not a low-resolution website thumbnail"}.`;
  }

  if (!hasApprovedProvenance) {
    return "Reference has no approved PSD-derived provenance. Use a reviewed flattened-product-truth pointer or import the reviewed local canonical export.";
  }

  return null;
}
