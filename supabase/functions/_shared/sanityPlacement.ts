export type SanityDestinationKey =
  | "blog_post"
  | "homepage_hero"
  | "product_family_hero"
  | "product_main_image"
  | "paper_doll_component";

export type SanityDestinationRow = {
  organization_id?: string | null;
  destination_key?: string | null;
  schema_profile?: string | null;
  sanity_document_type?: string | null;
  selector_query?: string | null;
  selector_params?: Record<string, unknown> | null;
  target_field_path?: string | null;
  publish_mode?: string | null;
  requires_image?: boolean | null;
  required_metadata?: unknown;
};

export type ProductTruthMetadataRule = {
  requiredKeys: string[];
  skuScoped: boolean;
  familyScoped: boolean;
};

export type PlacementValidationInput = {
  imageUrl?: unknown;
  metadata?: Record<string, unknown> | null;
};

export type SanityImageField = {
  _type: "image";
  asset: { _type: "reference"; _ref: string };
  alt?: string;
  caption?: string;
};

const DESTINATION_KEYS: SanityDestinationKey[] = [
  "blog_post",
  "homepage_hero",
  "product_family_hero",
  "product_main_image",
  "paper_doll_component",
];

const destinationKeySet = new Set<string>(DESTINATION_KEYS);

export function normalizeDestinationKey(
  value: unknown,
): SanityDestinationKey | null {
  if (typeof value !== "string") return null;
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/_+/g, "_");
  return destinationKeySet.has(normalized)
    ? (normalized as SanityDestinationKey)
    : null;
}

export function selectDestinationConfig<T extends SanityDestinationRow>(
  rows: T[],
  destinationKey: SanityDestinationKey | string,
  schemaProfile: string | null | undefined,
  organizationId?: string | null,
): T | null {
  const key = normalizeDestinationKey(destinationKey);
  if (!key) return null;
  const profile = schemaProfile?.trim() || "generic";
  const orgId = organizationId?.trim() || null;
  const candidates = rows.filter((row) =>
    normalizeDestinationKey(row.destination_key) === key
  );

  return (
    candidates.find((row) =>
      row.organization_id === orgId && row.schema_profile === profile
    ) ??
      candidates.find((row) =>
        row.organization_id === orgId && row.schema_profile === "generic"
      ) ??
      candidates.find((row) =>
        !row.organization_id && row.schema_profile === profile
      ) ??
      candidates.find((row) =>
        !row.organization_id && row.schema_profile === "generic"
      ) ??
      null
  );
}

export function needsProfileSpecificDestination(
  destination: SanityDestinationRow | null | undefined,
  schemaProfile: string | null | undefined,
): boolean {
  const profile = schemaProfile?.trim() || "generic";
  return profile !== "generic" && !destination?.organization_id;
}

export function bestBottlesProductTruthRule(
  destinationKey: SanityDestinationKey | string | null | undefined,
): ProductTruthMetadataRule | null {
  const key = normalizeDestinationKey(destinationKey);
  if (key === "product_main_image") {
    return {
      requiredKeys: ["websiteSku", "graceSku"],
      skuScoped: true,
      familyScoped: false,
    };
  }
  if (key === "product_family_hero") {
    return {
      requiredKeys: ["familySlug"],
      skuScoped: false,
      familyScoped: true,
    };
  }
  if (key === "paper_doll_component") {
    return {
      requiredKeys: ["familySlug", "role"],
      skuScoped: false,
      familyScoped: true,
    };
  }
  return null;
}

function requiredMetadataKeys(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string =>
      typeof entry === "string" && entry.trim().length > 0
    );
  }
  if (value && typeof value === "object") {
    const maybeKeys = (value as { keys?: unknown }).keys;
    if (Array.isArray(maybeKeys)) {
      return maybeKeys.filter((entry): entry is string =>
        typeof entry === "string" && entry.trim().length > 0
      );
    }
  }
  return [];
}

function hasMetadataValue(
  metadata: Record<string, unknown>,
  key: string,
): boolean {
  const value = metadata[key];
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  return true;
}

export function isHttpUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  return trimmed.startsWith("https://") || trimmed.startsWith("http://");
}

export function validatePlacementRequest(
  input: PlacementValidationInput,
  destination: SanityDestinationRow,
): { ok: true; errors: [] } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const metadata = input.metadata ?? {};
  if (destination.requires_image !== false && !isHttpUrl(input.imageUrl)) {
    errors.push("imageUrl must be an http(s) URL.");
  }

  for (const key of requiredMetadataKeys(destination.required_metadata)) {
    if (!hasMetadataValue(metadata, key)) {
      errors.push(
        `metadata.${key} is required for ${
          destination.destination_key ?? "this destination"
        }.`,
      );
    }
  }

  if (
    !destination.target_field_path ||
    !isSafeFieldPath(destination.target_field_path)
  ) {
    errors.push(
      "destination target_field_path must be a safe Sanity field path.",
    );
  }

  return errors.length === 0 ? { ok: true, errors: [] } : { ok: false, errors };
}

export function buildSelectorParams(
  destination: Pick<
    SanityDestinationRow,
    "sanity_document_type" | "selector_params"
  >,
  metadata: Record<string, unknown>,
): Record<string, unknown> {
  const params: Record<string, unknown> = {
    documentType: destination.sanity_document_type ?? null,
  };
  if (metadata.documentId != null) params.documentId = metadata.documentId;
  if (metadata.slug != null) params.slug = metadata.slug;

  for (
    const [paramName, source] of Object.entries(
      destination.selector_params ?? {},
    )
  ) {
    if (
      typeof source === "string" &&
      Object.prototype.hasOwnProperty.call(metadata, source)
    ) {
      params[paramName] = metadata[source];
    } else {
      params[paramName] = source;
    }
  }

  return params;
}

export function buildImageField(
  assetId: string,
  metadata: Record<string, unknown> = {},
): SanityImageField {
  const image: SanityImageField = {
    _type: "image",
    asset: { _type: "reference", _ref: assetId },
  };
  if (typeof metadata.altText === "string" && metadata.altText.trim()) {
    image.alt = metadata.altText.trim();
  }
  if (typeof metadata.caption === "string" && metadata.caption.trim()) {
    image.caption = metadata.caption.trim();
  }
  return image;
}

export function isSafeFieldPath(value: unknown): value is string {
  return typeof value === "string" &&
    /^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*$/.test(value);
}

export function buildPatchSet(
  fieldPath: string,
  imageField: SanityImageField,
): Record<string, SanityImageField> {
  if (!isSafeFieldPath(fieldPath)) {
    throw new Error(`Unsafe Sanity field path: ${fieldPath}`);
  }
  return { [fieldPath]: imageField };
}
