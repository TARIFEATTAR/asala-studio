export const PAPER_DOLL_STORAGE_BUCKETS = [
  "paper-doll-sources",
  "paper-doll-candidates",
  "paper-doll-approved",
] as const;

export type PaperDollStorageBucket = (typeof PAPER_DOLL_STORAGE_BUCKETS)[number];

export interface PaperDollAssetReference {
  storageBucket: PaperDollStorageBucket;
  objectPath: string;
  sha256: string;
  contentType: string;
  byteSize: number;
}

interface SignedUrlResponse {
  data: { signedUrl: string } | null;
  error: { message: string } | null;
}

export interface PaperDollStorageClient {
  storage: {
    from(bucket: string): {
      createSignedUrl(path: string, expiresIn: number): Promise<SignedUrlResponse>;
    };
  };
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const ABSOLUTE_URL_PATTERN = /^[a-z][a-z0-9+.-]*:\/\//i;

function sanitizePathSegment(value: string, label: string): string {
  const sanitized = value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!sanitized || sanitized === "." || sanitized === "..") {
    throw new Error(`${label} must contain a safe path segment.`);
  }
  return sanitized;
}

export function buildPaperDollObjectPath(input: {
  organizationId: string;
  familyKey: string;
  assetId: string;
  sha256: string;
  extension: string;
}): string {
  if (!UUID_PATTERN.test(input.organizationId)) {
    throw new Error("organizationId must be a UUID.");
  }
  if (!SHA256_PATTERN.test(input.sha256)) {
    throw new Error("sha256 must be a lowercase 64-character digest.");
  }
  const extension = input.extension.trim().replace(/^\.+/, "").toLowerCase();
  if (!/^[a-z0-9]+$/.test(extension)) {
    throw new Error("extension must be alphanumeric.");
  }
  return [
    input.organizationId,
    sanitizePathSegment(input.familyKey, "familyKey"),
    sanitizePathSegment(input.assetId, "assetId"),
    `${input.sha256}.${extension}`,
  ].join("/");
}

export function validatePaperDollAssetReference(
  reference: PaperDollAssetReference,
  organizationId: string,
): void {
  if (!PAPER_DOLL_STORAGE_BUCKETS.includes(reference.storageBucket)) {
    throw new Error(`Unsupported paper-doll storage bucket: ${reference.storageBucket}`);
  }
  if (
    !reference.objectPath
    || reference.objectPath.startsWith("/")
    || reference.objectPath.includes("\\")
    || reference.objectPath.split("/").includes("..")
    || ABSOLUTE_URL_PATTERN.test(reference.objectPath)
  ) {
    throw new Error("Asset reference must use a relative object path, never a URL.");
  }
  if (reference.objectPath.split("/", 1)[0] !== organizationId) {
    throw new Error("Asset reference organization does not match the active organization.");
  }
  if (!SHA256_PATTERN.test(reference.sha256)) {
    throw new Error("Asset reference requires a lowercase SHA-256 digest.");
  }
  const fileName = reference.objectPath.split("/").at(-1);
  if (!fileName?.startsWith(`${reference.sha256}.`)) {
    throw new Error("Asset object filename must be content-addressed by its SHA-256 digest.");
  }
  if (!reference.contentType.trim()) {
    throw new Error("Asset reference requires a content type.");
  }
  if (!Number.isSafeInteger(reference.byteSize) || reference.byteSize <= 0) {
    throw new Error("Asset reference requires a positive integer byte size.");
  }
}

export async function resolvePaperDollAssetUrls(
  client: PaperDollStorageClient,
  referencesByKey: Readonly<Record<string, PaperDollAssetReference>>,
  organizationId: string,
  expiresInSeconds = 300,
): Promise<Record<string, string>> {
  if (!Number.isSafeInteger(expiresInSeconds) || expiresInSeconds < 60 || expiresInSeconds > 3600) {
    throw new Error("Signed URL lifetime must be between 60 and 3600 seconds.");
  }

  const resolvedEntries = await Promise.all(
    Object.entries(referencesByKey).map(async ([key, reference]) => {
      validatePaperDollAssetReference(reference, organizationId);
      const { data, error } = await client.storage
        .from(reference.storageBucket)
        .createSignedUrl(reference.objectPath, expiresInSeconds);
      if (error || !data?.signedUrl) {
        throw new Error(`Unable to resolve ${key}: ${error?.message ?? "Storage returned no signed URL"}`);
      }
      return [key, data.signedUrl] as const;
    }),
  );

  return Object.fromEntries(resolvedEntries);
}
