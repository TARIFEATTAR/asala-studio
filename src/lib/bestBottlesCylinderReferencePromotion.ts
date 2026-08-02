import type { CylinderReferenceProductionExportRecord } from "../../scripts/best-bottles/build-cylinder-reference-production";
import { BEST_BOTTLES_CYLINDER_PRODUCTION_CONTRACT } from "../config/bestBottlesCylinderProductionContract";
import {
  BEST_BOTTLES_CYLINDER_PRODUCTION_READINESS_VERSION,
  cylinderProductionIdentityKey,
  type CylinderProductionReadinessArtifact,
  type CylinderProductionReadinessRow,
} from "./bestBottlesCylinderProductionCutover";

export const BEST_BOTTLES_CYLINDER_REFERENCE_PROMOTION_VERSION =
  "best-bottles-cylinder-reference-promotion-preflight-v1" as const;

export type CylinderPromotionPipelineJob = {
  id: string;
  websiteSku: string | null;
  graceSku: string;
  family: string;
  bestReferenceCandidatePath: string | null;
};

export type CylinderPromotionRemoteObject =
  | { path: string; status: "absent" }
  | { path: string; status: "present"; sha256: string; bytes: number }
  | { path: string; status: "error"; error: string };

export type CylinderReferencePromotionBlocker =
  | "missing-exact-pipeline-job"
  | "duplicate-exact-pipeline-jobs"
  | "remote-path-byte-collision"
  | "remote-object-read-error";

export type CylinderReferencePromotionRow = {
  canonicalIdentityKey: string;
  websiteSku: string;
  graceSku: string;
  canonical: CylinderProductionReadinessRow["canonical"];
  localPath: string;
  filename: string;
  exportSha256: string;
  bytes: number;
  width: number;
  height: number;
  opaque: true;
  storage: {
    bucket: string;
    path: string;
    publicUrl: string;
  };
  remote:
    | { status: "absent" }
    | { status: "exact-match"; sha256: string; bytes: number }
    | { status: "byte-collision"; sha256: string; bytes: number }
    | { status: "read-error"; error: string };
  pipeline:
    | { status: "missing-exact-job"; exactJobCount: 0 }
    | { status: "duplicate-exact-jobs"; exactJobCount: number; jobIds: string[] }
    | {
        status: "needs-repoint" | "already-target";
        exactJobCount: 1;
        jobId: string;
        currentReferencePath: string | null;
      };
  blockers: CylinderReferencePromotionBlocker[];
  decision: "ready-to-upload" | "ready-to-reuse" | "blocked";
};

export type CylinderReferencePromotionPlan = {
  version: typeof BEST_BOTTLES_CYLINDER_REFERENCE_PROMOTION_VERSION;
  mode: "read-only";
  summary: {
    qualifiedIdentityCount: number;
    readyToUploadCount: number;
    readyToReuseCount: number;
    blockedCount: number;
    remoteAbsentCount: number;
    remoteExactMatchCount: number;
    remoteCollisionCount: number;
    remoteReadErrorCount: number;
    externalWriteCount: 0;
  };
  rows: CylinderReferencePromotionRow[];
};

function assertSha256(value: string, label: string): void {
  if (!/^[a-f0-9]{64}$/i.test(value)) {
    throw new Error(`${label} must be a SHA-256 hash.`);
  }
}

function normalizedBaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!/^https:\/\//i.test(trimmed)) {
    throw new Error("Supabase URL must use HTTPS.");
  }
  return trimmed;
}

function immutableStoragePath(identityKey: string, exportSha256: string): string {
  const identity = identityKey.replace("|", "__");
  return [
    "best-bottles",
    "production-references",
    "cylinder",
    "v1",
    exportSha256.slice(0, 2),
    `${identity}__${exportSha256}.png`,
  ].join("/");
}

function assertQualifiedExportAgreement(
  readiness: CylinderProductionReadinessRow,
  productionExport: CylinderReferenceProductionExportRecord,
): void {
  const reference = readiness.reference;
  if (!reference) {
    throw new Error(`${readiness.canonicalIdentityKey} is qualified without a reference.`);
  }
  if (productionExport.canonicalIdentityKey !== readiness.canonicalIdentityKey) {
    throw new Error(`Canonical identity mismatch for ${readiness.canonicalIdentityKey}.`);
  }
  const exportIdentity = cylinderProductionIdentityKey(
    productionExport.canonical.websiteSku,
    productionExport.canonical.graceSku,
  );
  if (exportIdentity !== readiness.canonicalIdentityKey) {
    throw new Error(`Export identity mismatch for ${readiness.canonicalIdentityKey}.`);
  }
  assertSha256(reference.exportSha256, `${readiness.canonicalIdentityKey} readiness export hash`);
  assertSha256(productionExport.output.sha256, `${readiness.canonicalIdentityKey} native export hash`);
  if (reference.exportSha256 !== productionExport.output.sha256) {
    throw new Error(`Native export hash disagreement for ${readiness.canonicalIdentityKey}.`);
  }
  if (
    reference.filename !== productionExport.output.filename
    || reference.width !== productionExport.output.width
    || reference.height !== productionExport.output.height
    || productionExport.output.opaque !== true
  ) {
    throw new Error(`Native export metadata disagreement for ${readiness.canonicalIdentityKey}.`);
  }
}

export function buildCylinderReferencePromotionPlan(input: {
  readiness: CylinderProductionReadinessArtifact;
  exports: CylinderReferenceProductionExportRecord[];
  jobs: CylinderPromotionPipelineJob[];
  remoteObjects: CylinderPromotionRemoteObject[];
  bucket: string;
  supabaseUrl: string;
  expectedQualifiedCount?: number;
}): CylinderReferencePromotionPlan {
  if (input.readiness.version !== BEST_BOTTLES_CYLINDER_PRODUCTION_READINESS_VERSION) {
    throw new Error(`Unsupported Cylinder readiness version ${input.readiness.version}.`);
  }
  if (input.readiness.summary.externalWriteCount !== 0) {
    throw new Error("Cylinder readiness does not prove zero external writes.");
  }
  const bucket = input.bucket.trim();
  if (!bucket) throw new Error("Storage bucket is required.");
  const supabaseUrl = normalizedBaseUrl(input.supabaseUrl);
  const qualified = input.readiness.rows.filter((row) => row.status === "production-qualified");
  const expectedQualifiedCount = input.expectedQualifiedCount
    ?? BEST_BOTTLES_CYLINDER_PRODUCTION_CONTRACT.productionQualifiedCount;
  if (qualified.length !== expectedQualifiedCount) {
    throw new Error(
      `Cylinder promotion expected ${expectedQualifiedCount} qualified identities, found ${qualified.length}.`,
    );
  }
  if (qualified.length !== input.readiness.summary.productionQualifiedCount) {
    throw new Error("Qualified identity count disagrees with the readiness summary.");
  }

  const exportByIdentity = new Map<string, CylinderReferenceProductionExportRecord>();
  for (const item of input.exports) {
    if (exportByIdentity.has(item.canonicalIdentityKey)) {
      throw new Error(`Duplicate native export identity ${item.canonicalIdentityKey}.`);
    }
    exportByIdentity.set(item.canonicalIdentityKey, item);
  }
  const remoteByPath = new Map<string, CylinderPromotionRemoteObject>();
  for (const item of input.remoteObjects) {
    if (remoteByPath.has(item.path)) {
      throw new Error(`Duplicate remote observation for ${item.path}.`);
    }
    remoteByPath.set(item.path, item);
  }

  const rows = qualified.map<CylinderReferencePromotionRow>((readinessRow) => {
    const productionExport = exportByIdentity.get(readinessRow.canonicalIdentityKey);
    if (!productionExport) {
      throw new Error(`Missing native production export for ${readinessRow.canonicalIdentityKey}.`);
    }
    assertQualifiedExportAgreement(readinessRow, productionExport);
    const storagePath = immutableStoragePath(
      readinessRow.canonicalIdentityKey,
      productionExport.output.sha256,
    );
    const observedRemote = remoteByPath.get(storagePath) ?? {
      path: storagePath,
      status: "absent" as const,
    };
    let remote: CylinderReferencePromotionRow["remote"];
    const blockers: CylinderReferencePromotionBlocker[] = [];
    if (observedRemote.status === "absent") {
      remote = { status: "absent" };
    } else if (observedRemote.status === "error") {
      remote = { status: "read-error", error: observedRemote.error };
      blockers.push("remote-object-read-error");
    } else if (
      observedRemote.sha256 === productionExport.output.sha256
      && observedRemote.bytes === productionExport.output.bytes
    ) {
      remote = {
        status: "exact-match",
        sha256: observedRemote.sha256,
        bytes: observedRemote.bytes,
      };
    } else {
      remote = {
        status: "byte-collision",
        sha256: observedRemote.sha256,
        bytes: observedRemote.bytes,
      };
      blockers.push("remote-path-byte-collision");
    }

    const exactJobs = input.jobs.filter(
      (job) => cylinderProductionIdentityKey(job.websiteSku, job.graceSku)
        === readinessRow.canonicalIdentityKey,
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
      const job = exactJobs[0];
      pipeline = {
        status: job.bestReferenceCandidatePath
          === `${supabaseUrl}/storage/v1/object/public/${bucket}/${storagePath}`
          ? "already-target"
          : "needs-repoint",
        exactJobCount: 1,
        jobId: job.id,
        currentReferencePath: job.bestReferenceCandidatePath,
      };
    }

    const decision = blockers.length > 0
      ? "blocked"
      : remote.status === "exact-match"
        ? "ready-to-reuse"
        : "ready-to-upload";
    return {
      canonicalIdentityKey: readinessRow.canonicalIdentityKey,
      websiteSku: readinessRow.websiteSku,
      graceSku: readinessRow.graceSku,
      canonical: { ...readinessRow.canonical },
      localPath: productionExport.output.path,
      filename: productionExport.output.filename,
      exportSha256: productionExport.output.sha256,
      bytes: productionExport.output.bytes,
      width: productionExport.output.width,
      height: productionExport.output.height,
      opaque: true,
      storage: {
        bucket,
        path: storagePath,
        publicUrl: `${supabaseUrl}/storage/v1/object/public/${bucket}/${storagePath}`,
      },
      remote,
      pipeline,
      blockers,
      decision,
    };
  });

  rows.sort((left, right) => left.canonicalIdentityKey.localeCompare(right.canonicalIdentityKey));
  return {
    version: BEST_BOTTLES_CYLINDER_REFERENCE_PROMOTION_VERSION,
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
