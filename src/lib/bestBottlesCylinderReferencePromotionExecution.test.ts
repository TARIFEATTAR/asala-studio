import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";

import {
  executeCylinderReferencePromotion,
  type CylinderReferencePromotionExecutionAdapter,
} from "./bestBottlesCylinderReferencePromotionExecution";
import type {
  CylinderReferencePromotionPlan,
  CylinderReferencePromotionRow,
} from "./bestBottlesCylinderReferencePromotion";

function hash(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function fixture(): {
  plan: CylinderReferencePromotionPlan;
  local: Map<string, Uint8Array>;
} {
  const local = new Map<string, Uint8Array>([
    ["/local/one.png", Buffer.from("one")],
    ["/local/two.png", Buffer.from("two")],
  ]);
  const rows = [1, 2].map((index): CylinderReferencePromotionRow => {
    const bytes = local.get(`/local/${index === 1 ? "one" : "two"}.png`)!;
    return {
      canonicalIdentityKey: `WEBSITE${index}|GRACE${index}`,
      websiteSku: `Website${index}`,
      graceSku: `Grace-${index}`,
      canonical: {} as CylinderReferencePromotionRow["canonical"],
      localPath: `/local/${index === 1 ? "one" : "two"}.png`,
      filename: `${index}.png`,
      exportSha256: hash(bytes),
      bytes: bytes.length,
      width: 1000,
      height: 1300,
      opaque: true,
      storage: {
        bucket: "reference-images",
        path: `immutable/${index}/${hash(bytes)}.png`,
        publicUrl: `https://example.supabase.co/reference-images/${index}.png`,
      },
      remote: { status: "absent" },
      pipeline: {
        status: "needs-repoint",
        exactJobCount: 1,
        jobId: `job-${index}`,
        currentReferencePath: `https://old/${index}.png`,
      },
      blockers: [],
      decision: "ready-to-upload",
    };
  });
  return {
    local,
    plan: {
      version: "best-bottles-cylinder-reference-promotion-preflight-v1",
      mode: "read-only",
      summary: {
        qualifiedIdentityCount: 2,
        readyToUploadCount: 2,
        readyToReuseCount: 0,
        blockedCount: 0,
        remoteAbsentCount: 2,
        remoteExactMatchCount: 0,
        remoteCollisionCount: 0,
        remoteReadErrorCount: 0,
        externalWriteCount: 0,
      },
      rows,
    },
  };
}

function adapterFor(input: ReturnType<typeof fixture>): {
  adapter: CylinderReferencePromotionExecutionAdapter;
  events: string[];
  remote: Map<string, Uint8Array>;
  jobs: Map<string, { websiteSku: string; graceSku: string; referencePath: string | null; referenceSource: string | null }>;
} {
  const events: string[] = [];
  const remote = new Map<string, Uint8Array>();
  const jobs = new Map(input.plan.rows.map((row) => [
    row.pipeline.status === "needs-repoint" ? row.pipeline.jobId : "",
    {
      websiteSku: row.websiteSku,
      graceSku: row.graceSku,
      referencePath: row.pipeline.status === "needs-repoint" ? row.pipeline.currentReferencePath : null,
      referenceSource: null,
    },
  ]));
  const adapter: CylinderReferencePromotionExecutionAdapter = {
    readLocalFile: async (path) => input.local.get(path)!,
    inspectRemote: async (_bucket, path) => {
      const bytes = remote.get(path);
      return bytes ? { status: "present", bytes } : { status: "absent" };
    },
    uploadImmutable: async (_bucket, path, bytes, options) => {
      events.push(`upload:${path}:upsert=${options.upsert}`);
      assert.equal(options.upsert, false);
      if (remote.has(path)) throw new Error("occupied");
      remote.set(path, bytes);
    },
    readJob: async (id) => jobs.get(id) ?? null,
    repointExactJob: async (request) => {
      events.push(`repoint:${request.jobId}:${request.referenceSource}`);
      const job = jobs.get(request.jobId)!;
      job.referencePath = request.targetPublicUrl;
      job.referenceSource = request.referenceSource;
    },
  };
  return { adapter, events, remote, jobs };
}

describe("Cylinder production reference promotion execution", () => {
  it("uploads every object without overwrite, verifies bytes, then repoints exact jobs", async () => {
    const input = fixture();
    const state = adapterFor(input);
    const result = await executeCylinderReferencePromotion(input.plan, state.adapter);
    assert.deepEqual(result.summary, {
      identityCount: 2,
      uploadedCount: 2,
      reusedCount: 0,
      verifiedCount: 2,
      repointedCount: 2,
      alreadyRepointedCount: 0,
      failedCount: 0,
    });
    const firstRepoint = state.events.findIndex((event) => event.startsWith("repoint:"));
    assert.ok(firstRepoint > -1);
    assert.ok(state.events.slice(0, firstRepoint).every((event) => event.startsWith("upload:")));
    assert.equal(state.jobs.get("job-1")?.referenceSource, "flattened-product-truth");
  });

  it("fails before any job repoint when an immutable path contains different bytes", async () => {
    const input = fixture();
    const state = adapterFor(input);
    state.remote.set(input.plan.rows[1].storage.path, Buffer.from("wrong"));
    await assert.rejects(
      executeCylinderReferencePromotion(input.plan, state.adapter),
      /immutable remote collision/i,
    );
    assert.equal(state.events.some((event) => event.startsWith("repoint:")), false);
  });

  it("resumes byte-identical uploads and already-repointed jobs without rewriting objects", async () => {
    const input = fixture();
    const state = adapterFor(input);
    for (const row of input.plan.rows) {
      state.remote.set(row.storage.path, input.local.get(row.localPath)!);
      const jobId = row.pipeline.status === "needs-repoint" ? row.pipeline.jobId : "";
      const job = state.jobs.get(jobId)!;
      job.referencePath = row.storage.publicUrl;
      job.referenceSource = "flattened-product-truth";
    }
    const result = await executeCylinderReferencePromotion(input.plan, state.adapter);
    assert.equal(result.summary.uploadedCount, 0);
    assert.equal(result.summary.reusedCount, 2);
    assert.equal(result.summary.alreadyRepointedCount, 2);
    assert.deepEqual(state.events, []);
  });
});
