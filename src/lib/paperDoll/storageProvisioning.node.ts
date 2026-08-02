import { PAPER_DOLL_STORAGE_BUCKETS } from "./assetStorage";

interface BucketRecord {
  id: string;
  name: string;
  public: boolean;
}

interface StorageAdminClient {
  storage: {
    listBuckets(): Promise<{
      data: BucketRecord[] | null;
      error: { message: string } | null;
    }>;
    createBucket(id: string, options: Record<string, unknown>): Promise<{
      data: unknown;
      error: { message: string } | null;
    }>;
  };
}

const BUCKET_OPTIONS: Record<(typeof PAPER_DOLL_STORAGE_BUCKETS)[number], Record<string, unknown>> = {
  "paper-doll-sources": {
    public: false,
  },
  "paper-doll-candidates": {
    public: false,
    allowedMimeTypes: ["image/png", "image/jpeg", "image/webp", "image/tiff"],
  },
  "paper-doll-approved": {
    public: false,
    allowedMimeTypes: [
      "image/png",
      "image/jpeg",
      "image/webp",
      "model/gltf-binary",
      "model/vnd.usdz+zip",
    ],
  },
};

export async function provisionPaperDollBuckets(client: StorageAdminClient): Promise<{
  created: string[];
  existing: string[];
}> {
  const listed = await client.storage.listBuckets();
  if (listed.error || !listed.data) {
    throw new Error(`Unable to list Storage buckets: ${listed.error?.message ?? "no data"}`);
  }

  const existingById = new Map(listed.data.map((bucket) => [bucket.id, bucket]));
  const created: string[] = [];
  const existing: string[] = [];

  for (const bucketId of PAPER_DOLL_STORAGE_BUCKETS) {
    const current = existingById.get(bucketId);
    if (current?.public) {
      throw new Error(`${bucketId} already exists as a public bucket; refusing unsafe provisioning.`);
    }
  }

  for (const bucketId of PAPER_DOLL_STORAGE_BUCKETS) {
    const current = existingById.get(bucketId);
    if (current) {
      existing.push(bucketId);
      continue;
    }

    const result = await client.storage.createBucket(bucketId, BUCKET_OPTIONS[bucketId]);
    if (result.error) {
      throw new Error(`Unable to create ${bucketId}: ${result.error.message}`);
    }
    created.push(bucketId);
  }

  return { created, existing };
}
