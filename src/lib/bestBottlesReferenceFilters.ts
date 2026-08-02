const RETIRED_TRANSPARENT_BEST_BOTTLES_REFERENCE_TOKENS = [
  "best-bottles/clean-references/cylinder/",
  "clean-references/cylinder/",
  "reference-imports/background-removed",
  "reference-imports/bg-removed",
  "/paper-doll/",
  "paper-doll/",
  "paperdoll",
  "mask-control",
  "mask_control",
  "maskcontrol",
  "mask-ref",
  "mask_ref",
  "maskref",
  "studio-mask-control-references",
  "best-bottles/mask-imports/",
  "mask-imports",
  "transparent",
  "transparent-png",
  "background-removed",
  "background_removed",
  "backgroundremoved",
  "bg-removed",
  "bg_removed",
  "bgremoved",
  "remove-background",
  "removed-background",
  "removed_background",
  "background removed",
  "remove background",
];

const RETIRED_REFERENCE_METADATA_KEY_FRAGMENTS = [
  "url",
  "path",
  "name",
  "filename",
  "file",
  "storage",
  "session",
  "tag",
  "library",
  "source",
  "lineage",
  "role",
  "label",
  "metadata",
  "meta",
  "reference",
  "origin",
  "folder",
  "directory",
  "key",
];

const RETIRED_REFERENCE_METADATA_SKIP_KEYS = new Set([
  "prompt",
  "finalprompt",
  "final_prompt",
  "description",
  "body",
  "content",
  "text",
]);

function normalizeReferenceFingerprint(value: unknown): string {
  if (value == null) return "";
  let normalized = String(value).trim().toLowerCase().replace(/\\/g, "/");
  try {
    normalized = decodeURIComponent(normalized);
  } catch {
    // Keep the raw fingerprint when decoding fails.
  }
  return normalized
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function isRetiredTransparentBestBottlesReferenceValue(value: unknown): boolean {
  const normalized = normalizeReferenceFingerprint(value);
  if (!normalized) return false;
  return RETIRED_TRANSPARENT_BEST_BOTTLES_REFERENCE_TOKENS.some((token) =>
    normalized.includes(token),
  );
}

function normalizeMetadataKey(value: string): string {
  return normalizeReferenceFingerprint(value).replace(/[^a-z0-9]+/g, "");
}

function shouldInspectMetadataValue(key: string): boolean {
  const normalizedKey = normalizeMetadataKey(key);
  if (!normalizedKey || RETIRED_REFERENCE_METADATA_SKIP_KEYS.has(normalizedKey)) {
    return false;
  }
  if (isRetiredTransparentBestBottlesReferenceValue(key)) return true;
  return RETIRED_REFERENCE_METADATA_KEY_FRAGMENTS.some((fragment) =>
    normalizedKey.includes(fragment),
  );
}

function collectReferenceFingerprintValues(
  value: unknown,
  seen = new WeakSet<object>(),
  depth = 0,
): unknown[] {
  if (value == null || depth > 5) return [];
  if (typeof value !== "object") return [value];
  if (seen.has(value)) return [];
  seen.add(value);

  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectReferenceFingerprintValues(entry, seen, depth + 1));
  }

  const record = value as Record<string, unknown>;

  // Optional generation slots are represented as descriptors even when no
  // asset is attached (for example { url: "", role: "mask-reference" }).
  // The role describes the empty slot; it is not provenance for a real asset.
  // Keep inspecting descriptors that carry any other metadata, filename, tag,
  // path, or source signal so real retired lineage remains fail-closed.
  if (Object.prototype.hasOwnProperty.call(record, "url") && !String(record.url ?? "").trim()) {
    const hasAssetMetadata = Object.entries(record).some(([key, entry]) => {
      if (key === "url" || key === "role" || key === "label" || key === "description") {
        return false;
      }
      if (!shouldInspectMetadataValue(key)) return false;
      if (Array.isArray(entry)) return entry.length > 0;
      return entry != null && String(entry).trim().length > 0;
    });
    if (!hasAssetMetadata) return [];
  }

  const values: unknown[] = [];

  // Browser File fields are not guaranteed to be enumerable.
  for (const fileKey of ["name", "webkitRelativePath", "type"]) {
    if (record[fileKey] != null) values.push(record[fileKey]);
  }

  for (const [key, entry] of Object.entries(record)) {
    if (!shouldInspectMetadataValue(key)) continue;
    if (
      isRetiredTransparentBestBottlesReferenceValue(key) &&
      entry !== false &&
      entry != null
    ) {
      values.push(key);
    }
    values.push(...collectReferenceFingerprintValues(entry, seen, depth + 1));
  }

  return values;
}

export function isRetiredTransparentBestBottlesReferenceCandidate(
  values: readonly unknown[],
): boolean {
  return values
    .flatMap((value) => collectReferenceFingerprintValues(value))
    .some(isRetiredTransparentBestBottlesReferenceValue);
}

export function isRetiredTransparentBestBottlesReferenceUrl(
  value: string | null | undefined,
): boolean {
  return isRetiredTransparentBestBottlesReferenceValue(value);
}

export function getRetiredTransparentBestBottlesReferenceIssue(
  values: readonly unknown[],
): string | null {
  return isRetiredTransparentBestBottlesReferenceCandidate(values)
    ? "Retired reference lineage detected in the asset URL or metadata (clean-reference, background-removed, paper-doll, or mask/control). This does not prove the current pixels are transparent; the asset must be re-imported from the approved opaque canonical export with clean provenance."
    : null;
}

export function getBestBottlesCylinderProductTruthReferenceIssue(
  candidateValues: readonly unknown[],
): string | null {
  return getRetiredTransparentBestBottlesReferenceIssue(candidateValues);
}

export function isBestBottlesCylinderProductTruthReferenceCandidate(
  candidateValues: readonly unknown[],
): boolean {
  return getBestBottlesCylinderProductTruthReferenceIssue(candidateValues) === null;
}
