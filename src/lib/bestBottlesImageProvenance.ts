export type BestBottlesImageProvenanceKind =
  | "generated-output"
  | "keeper-backfill"
  | "reference-import"
  | "shopify-source"
  | "unknown";

export interface BestBottlesImageProvenanceInput {
  imageUrl?: string | null;
  sessionName?: string | null;
  goalType?: string | null;
  libraryCategory?: string | null;
  libraryTags?: string[] | null;
  referenceImageUrl?: string | null;
  finalPrompt?: string | null;
  description?: string | null;
  brandContextUsed?: unknown;
}

export interface BestBottlesImageProvenance {
  kind: BestBottlesImageProvenanceKind;
  label: string;
  description: string;
  isRegeneratedOutput: boolean;
  isReferenceLike: boolean;
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizedTags(input: BestBottlesImageProvenanceInput): string[] {
  return (input.libraryTags ?? []).map((tag) => clean(tag).toLowerCase()).filter(Boolean);
}

function objectSource(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const source = (value as { source?: unknown }).source;
  return clean(source).toLowerCase();
}

function host(value: string): string {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function pathText(value: string): string {
  try {
    return new URL(value).pathname.toLowerCase();
  } catch {
    return value.toLowerCase();
  }
}

function searchableText(input: BestBottlesImageProvenanceInput): string {
  return [
    input.imageUrl,
    input.sessionName,
    input.goalType,
    input.libraryCategory,
    input.finalPrompt,
    input.description,
    ...(input.libraryTags ?? []),
  ]
    .map(clean)
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function provenance(
  kind: BestBottlesImageProvenanceKind,
  label: string,
  description: string,
  isRegeneratedOutput: boolean,
  isReferenceLike: boolean,
): BestBottlesImageProvenance {
  return { kind, label, description, isRegeneratedOutput, isReferenceLike };
}

export function getBestBottlesImageProvenance(
  input: BestBottlesImageProvenanceInput,
): BestBottlesImageProvenance {
  const tags = normalizedTags(input);
  const source = objectSource(input.brandContextUsed);
  const text = searchableText(input);
  const imageUrl = clean(input.imageUrl);
  const imageHost = host(imageUrl);
  const imagePath = pathText(imageUrl);

  if (
    source === "keeper-backfill" ||
    tags.some((tag) => tag.startsWith("keeper-backfill")) ||
    /\bkeeper[- ]backfill\b/.test(text)
  ) {
    return provenance(
      "keeper-backfill",
      "Keeper import",
      "Existing live or approved image cataloged into Madison; not a newly regenerated output.",
      false,
      true,
    );
  }

  if (
    tags.includes("local-generation") ||
    source === "local-generate.ts" ||
    (tags.includes("brand:best-bottles") && tags.includes("studio-master"))
  ) {
    return provenance(
      "generated-output",
      "Generated output",
      "Madison-generated Best Bottles output.",
      true,
      false,
    );
  }

  if (
    imagePath.includes("/reference-imports/") ||
    source.includes("reference") ||
    source === "bestbottles-live" ||
    /\b(?:reference import|legacy-reference|bestbottles-live)\b/.test(text)
  ) {
    return provenance(
      "reference-import",
      "Reference import",
      "Reference/source image brought into Madison; not a newly regenerated output.",
      false,
      true,
    );
  }

  if (imageHost === "cdn.shopify.com" || imageHost.endsWith(".myshopify.com")) {
    return provenance(
      "shopify-source",
      "Shopify source",
      "Shopify-hosted source image; destination evidence, not generation evidence.",
      false,
      true,
    );
  }

  return provenance(
    "unknown",
    "Unclassified",
    "Image provenance is not tagged clearly enough to prove whether this is regenerated or a source import.",
    false,
    false,
  );
}
