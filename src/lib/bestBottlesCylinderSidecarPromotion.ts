import type {
  CylinderPromotionPipelineJob,
  CylinderPromotionRemoteObject,
  CylinderReferencePromotionBlocker,
  CylinderReferencePromotionPlan,
  CylinderReferencePromotionRow,
} from "./bestBottlesCylinderReferencePromotion";
import { cylinderProductionIdentityKey } from "./bestBottlesCylinderProductionCutover";

export interface CylinderSidecarPromotionRecord {
  canonicalIdentityKey: string;
  websiteSku: string;
  graceSku: string;
  canonical: CylinderReferencePromotionRow["canonical"];
  route: string;
  requiredOutputTopology: string;
  blockers: readonly string[];
  output: {
    path: string;
    filename: string;
    sha256: string;
    bytes: number;
    width: number;
    height: number;
    opaque: true;
  };
}

function normalizedBaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!/^https:\/\//i.test(trimmed)) throw new Error("Supabase URL must use HTTPS.");
  return trimmed;
}

function immutableSidecarStoragePath(identityKey: string, exportSha256: string): string {
  return [
    "best-bottles",
    "production-references",
    "cylinder",
    "sidecar-v2",
    exportSha256.slice(0, 2),
    `${identityKey.replace("|", "__")}__${exportSha256}.png`,
  ].join("/");
}

export function buildCylinderSidecarPromotionPlan(input: {
  records: readonly CylinderSidecarPromotionRecord[];
  jobs: readonly CylinderPromotionPipelineJob[];
  remoteObjects: readonly CylinderPromotionRemoteObject[];
  bucket: string;
  supabaseUrl: string;
  expectedCount?: number;
}): CylinderReferencePromotionPlan {
  const expectedCount = input.expectedCount ?? 228;
  if (input.records.length !== expectedCount) {
    throw new Error(`Cylinder sidecar promotion expected ${expectedCount} records, found ${input.records.length}.`);
  }
  const bucket = input.bucket.trim();
  if (!bucket) throw new Error("Storage bucket is required.");
  const supabaseUrl = normalizedBaseUrl(input.supabaseUrl);
  const remoteByPath = new Map(input.remoteObjects.map((item) => [item.path, item]));
  if (remoteByPath.size !== input.remoteObjects.length) {
    throw new Error("Cylinder sidecar promotion received duplicate remote observations.");
  }

  const identities = new Set<string>();
  const rows = input.records.map<CylinderReferencePromotionRow>((record) => {
    const exactIdentity = cylinderProductionIdentityKey(record.websiteSku, record.graceSku);
    if (!exactIdentity || exactIdentity !== record.canonicalIdentityKey) {
      throw new Error(`Cylinder sidecar identity mismatch for ${record.canonicalIdentityKey}.`);
    }
    if (identities.has(record.canonicalIdentityKey)) {
      throw new Error(`Duplicate Cylinder sidecar identity ${record.canonicalIdentityKey}.`);
    }
    identities.add(record.canonicalIdentityKey);
    if (
      record.blockers.length > 0
      || record.output.opaque !== true
      || !/^[a-f0-9]{64}$/i.test(record.output.sha256)
      || record.output.bytes <= 0
      || record.output.width <= 0
      || record.output.height <= 0
    ) {
      throw new Error(`${record.canonicalIdentityKey} is not an immutable reviewed PNG.`);
    }

    const storagePath = immutableSidecarStoragePath(
      record.canonicalIdentityKey,
      record.output.sha256,
    );
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/${storagePath}`;
    const observed = remoteByPath.get(storagePath) ?? { path: storagePath, status: "absent" as const };
    const blockers: CylinderReferencePromotionBlocker[] = [];
    let remote: CylinderReferencePromotionRow["remote"];
    if (observed.status === "absent") {
      remote = { status: "absent" };
    } else if (observed.status === "error") {
      remote = { status: "read-error", error: observed.error };
      blockers.push("remote-object-read-error");
    } else if (
      observed.sha256 === record.output.sha256
      && observed.bytes === record.output.bytes
    ) {
      remote = { status: "exact-match", sha256: observed.sha256, bytes: observed.bytes };
    } else {
      remote = { status: "byte-collision", sha256: observed.sha256, bytes: observed.bytes };
      blockers.push("remote-path-byte-collision");
    }

    const exactJobs = input.jobs.filter((job) =>
      cylinderProductionIdentityKey(job.websiteSku, job.graceSku) === record.canonicalIdentityKey
    );
    let pipeline: CylinderReferencePromotionRow["pipeline"];
    if (exactJobs.length === 0) {
      pipeline = { status: "missing-exact-job", exactJobCount: 0 };
      blockers.push("missing-exact-pipeline-job");
    } else if (exactJobs.length > 1) {
      pipeline = {
        status: "duplicate-exact-jobs",
        exactJobCount: exactJobs.length,
        jobIds: exactJobs.map((job) => job.id).sort(),
      };
      blockers.push("duplicate-exact-pipeline-jobs");
    } else {
      pipeline = {
        status: exactJobs[0].bestReferenceCandidatePath === publicUrl
          ? "already-target"
          : "needs-repoint",
        exactJobCount: 1,
        jobId: exactJobs[0].id,
        currentReferencePath: exactJobs[0].bestReferenceCandidatePath,
      };
    }

    return {
      canonicalIdentityKey: record.canonicalIdentityKey,
      websiteSku: record.websiteSku,
      graceSku: record.graceSku,
      canonical: { ...record.canonical },
      localPath: record.output.path,
      filename: record.output.filename,
      exportSha256: record.output.sha256,
      bytes: record.output.bytes,
      width: record.output.width,
      height: record.output.height,
      opaque: true,
      storage: { bucket, path: storagePath, publicUrl },
      remote,
      pipeline,
      blockers,
      decision: blockers.length > 0
        ? "blocked"
        : remote.status === "exact-match"
          ? "ready-to-reuse"
          : "ready-to-upload",
    };
  });

  return {
    version: "best-bottles-cylinder-reference-promotion-preflight-v1",
    mode: "read-only",
    summary: {
      qualifiedIdentityCount: rows.length,
      readyToUploadCount: rows.filter((row) => row.decision === "ready-to-upload").length,
      readyToReuseCount: rows.filter((row) => row.decision === "ready-to-reuse").length,
      blockedCount: rows.filter((row) => row.decision === "blocked").length,
      remoteAbsentCount: rows.filter((row) => row.remote.status === "absent").length,
      remoteExactMatchCount: rows.filter((row) => row.remote.status === "exact-match").length,
      remoteCollisionCount: rows.filter((row) => row.remote.status === "byte-collision").length,
      remoteReadErrorCount: rows.filter((row) => row.remote.status === "read-error").length,
      externalWriteCount: 0,
    },
    rows,
  };
}
