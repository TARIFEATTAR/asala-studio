import { createHash } from "node:crypto";

import type {
  CylinderReferencePromotionPlan,
  CylinderReferencePromotionRow,
} from "./bestBottlesCylinderReferencePromotion";
import { cylinderProductionIdentityKey } from "./bestBottlesCylinderProductionCutover";

export type CylinderPromotionLiveJob = {
  websiteSku: string;
  graceSku: string;
  referencePath: string | null;
  referenceSource: string | null;
};

export type CylinderReferencePromotionExecutionAdapter = {
  readLocalFile(path: string): Promise<Uint8Array>;
  inspectRemote(
    bucket: string,
    path: string,
  ): Promise<{ status: "absent" } | { status: "present"; bytes: Uint8Array }>;
  uploadImmutable(
    bucket: string,
    path: string,
    bytes: Uint8Array,
    options: { contentType: "image/png"; upsert: false },
  ): Promise<void>;
  readJob(id: string): Promise<CylinderPromotionLiveJob | null>;
  repointExactJob(request: {
    jobId: string;
    websiteSku: string;
    graceSku: string;
    expectedCurrentPath: string | null;
    targetPublicUrl: string;
    referenceSource: "flattened-product-truth";
  }): Promise<void>;
};

type VerifiedReference = {
  row: CylinderReferencePromotionRow;
  disposition: "uploaded" | "reused";
};

export type CylinderReferencePromotionExecutionResult = {
  version: "best-bottles-cylinder-reference-promotion-execution-v1";
  summary: {
    identityCount: number;
    uploadedCount: number;
    reusedCount: number;
    verifiedCount: number;
    repointedCount: number;
    alreadyRepointedCount: number;
    failedCount: 0;
  };
  rows: Array<{
    canonicalIdentityKey: string;
    storagePath: string;
    publicUrl: string;
    exportSha256: string;
    uploadDisposition: "uploaded" | "reused";
    jobDisposition: "repointed" | "already-repointed";
  }>;
};

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

async function mapLimited<T, R>(
  items: readonly T[],
  concurrency: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await task(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

function exactPipelineJob(row: CylinderReferencePromotionRow): {
  jobId: string;
  currentReferencePath: string | null;
} {
  if (row.pipeline.status === "needs-repoint" || row.pipeline.status === "already-target") {
    return {
      jobId: row.pipeline.jobId,
      currentReferencePath: row.pipeline.currentReferencePath,
    };
  }
  throw new Error(`${row.canonicalIdentityKey} has no single exact pipeline job.`);
}

function assertExecutablePlan(plan: CylinderReferencePromotionPlan): void {
  if (plan.mode !== "read-only" || plan.summary.externalWriteCount !== 0) {
    throw new Error("Promotion execution requires a zero-write preflight plan.");
  }
  if (plan.summary.blockedCount !== 0 || plan.rows.some((row) => row.blockers.length > 0)) {
    throw new Error("Promotion execution cannot include blocked identities.");
  }
  if (plan.rows.length !== plan.summary.qualifiedIdentityCount) {
    throw new Error("Promotion row count disagrees with the qualified identity count.");
  }
  for (const row of plan.rows) {
    if (!/^[a-f0-9]{64}$/i.test(row.exportSha256)) {
      throw new Error(`${row.canonicalIdentityKey} has no valid export hash.`);
    }
    exactPipelineJob(row);
  }
}

export async function executeCylinderReferencePromotion(
  plan: CylinderReferencePromotionPlan,
  adapter: CylinderReferencePromotionExecutionAdapter,
): Promise<CylinderReferencePromotionExecutionResult> {
  assertExecutablePlan(plan);

  // Phase 1 is deliberately complete before any database repoint. A partial
  // storage upload is resumable and harmless; no job can point at an object
  // until every planned object has passed exact byte verification.
  const verified = await mapLimited(plan.rows, 8, async (row): Promise<VerifiedReference> => {
    const localBytes = await adapter.readLocalFile(row.localPath);
    if (localBytes.length !== row.bytes || sha256(localBytes) !== row.exportSha256) {
      throw new Error(`Local export verification failed for ${row.canonicalIdentityKey}.`);
    }
    const before = await adapter.inspectRemote(row.storage.bucket, row.storage.path);
    if (before.status === "present") {
      if (before.bytes.length !== row.bytes || sha256(before.bytes) !== row.exportSha256) {
        throw new Error(`Immutable remote collision for ${row.canonicalIdentityKey}.`);
      }
      return { row, disposition: "reused" };
    }
    await adapter.uploadImmutable(row.storage.bucket, row.storage.path, localBytes, {
      contentType: "image/png",
      upsert: false,
    });
    const after = await adapter.inspectRemote(row.storage.bucket, row.storage.path);
    if (
      after.status !== "present"
      || after.bytes.length !== row.bytes
      || sha256(after.bytes) !== row.exportSha256
    ) {
      throw new Error(`Remote upload verification failed for ${row.canonicalIdentityKey}.`);
    }
    return { row, disposition: "uploaded" };
  });

  const executionRows = await mapLimited(verified, 8, async ({ row, disposition }) => {
    const pipeline = exactPipelineJob(row);
    const live = await adapter.readJob(pipeline.jobId);
    if (!live) throw new Error(`Pipeline job ${pipeline.jobId} disappeared before repoint.`);
    const liveIdentity = cylinderProductionIdentityKey(live.websiteSku, live.graceSku);
    if (liveIdentity !== row.canonicalIdentityKey) {
      throw new Error(`Pipeline identity drift for ${row.canonicalIdentityKey}.`);
    }
    let jobDisposition: "repointed" | "already-repointed";
    if (
      live.referencePath === row.storage.publicUrl
      && live.referenceSource === "flattened-product-truth"
    ) {
      jobDisposition = "already-repointed";
    } else {
      if (
        live.referencePath !== pipeline.currentReferencePath
        && live.referencePath !== row.storage.publicUrl
      ) {
        throw new Error(`Pipeline reference drift for ${row.canonicalIdentityKey}.`);
      }
      await adapter.repointExactJob({
        jobId: pipeline.jobId,
        websiteSku: row.websiteSku,
        graceSku: row.graceSku,
        expectedCurrentPath: live.referencePath,
        targetPublicUrl: row.storage.publicUrl,
        referenceSource: "flattened-product-truth",
      });
      jobDisposition = "repointed";
    }
    const readback = await adapter.readJob(pipeline.jobId);
    if (
      !readback
      || cylinderProductionIdentityKey(readback.websiteSku, readback.graceSku)
        !== row.canonicalIdentityKey
      || readback.referencePath !== row.storage.publicUrl
      || readback.referenceSource !== "flattened-product-truth"
    ) {
      throw new Error(`Pipeline read-back verification failed for ${row.canonicalIdentityKey}.`);
    }
    return {
      canonicalIdentityKey: row.canonicalIdentityKey,
      storagePath: row.storage.path,
      publicUrl: row.storage.publicUrl,
      exportSha256: row.exportSha256,
      uploadDisposition: disposition,
      jobDisposition,
    };
  });

  return {
    version: "best-bottles-cylinder-reference-promotion-execution-v1",
    summary: {
      identityCount: executionRows.length,
      uploadedCount: executionRows.filter((row) => row.uploadDisposition === "uploaded").length,
      reusedCount: executionRows.filter((row) => row.uploadDisposition === "reused").length,
      verifiedCount: executionRows.length,
      repointedCount: executionRows.filter((row) => row.jobDisposition === "repointed").length,
      alreadyRepointedCount: executionRows.filter(
        (row) => row.jobDisposition === "already-repointed",
      ).length,
      failedCount: 0,
    },
    rows: executionRows,
  };
}
