import assert from "node:assert/strict";
import test from "node:test";

import type { CandidateJobRequest } from "./candidateJobContract";
import {
  approveCandidate,
  createCandidateJob,
  loadCandidateWorkbench,
  uploadCandidateSource,
  uploadManualCandidateSource,
  verifySignedPrivateAsset,
} from "./candidateRepository";

const SHA = "a".repeat(64);
const PARENT_SHA = "b".repeat(64);
const ORG = "11111111-1111-4111-8111-111111111111";
const COMPONENT = "22222222-2222-4222-8222-222222222222";
const VERSION = "33333333-3333-4333-8333-333333333333";

const selection: CandidateJobRequest = {
  organizationId: ORG,
  requirementKey: "CYL-9ML:OVERCAP:MAT-GL",
  componentId: COMPONENT,
  parentComponentVersionId: VERSION,
  parentSha256: PARENT_SHA,
  provider: "openai",
  model: "gpt-image-2",
  instruction: "Preserve the moulded phenolic plastic overcap geometry and apply a matte gold coating.",
  source: { bucket: "paper-doll-approved", path: `${ORG}/CYL-9ML/source/${PARENT_SHA}.png`, sha256: PARENT_SHA, contentType: "image/png", byteSize: 40 },
  authoritativeMask: { bucket: "paper-doll-approved", path: `${ORG}/CYL-9ML/mask/${SHA}.png`, sha256: SHA, contentType: "image/png", byteSize: 20 },
  editMask: { bucket: "paper-doll-sources", path: `${ORG}/CYL-9ML/edit/${SHA}.png`, sha256: SHA, contentType: "image/png", byteSize: 20 },
  transform: { translateXPx: 0, translateYPx: 0, scaleX: 1, scaleY: 1 },
  selectionKind: "whole-layer",
};

test("createCandidateJob sends one exact provider and expected parent SHA", async () => {
  const invocations: Array<{ name: string; body: unknown }> = [];
  const client = {
    functions: {
      invoke: async (name: string, options: { body: unknown }) => {
        invocations.push({ name, body: options.body });
        return { data: { job: { id: VERSION, status: "queued", provider: "openai", model: "gpt-image-2", created_at: new Date().toISOString() } }, error: null };
      },
    },
  };

  await createCandidateJob(client, selection);

  assert.equal(invocations.length, 1);
  assert.equal(invocations[0].name, "generate-paper-doll-candidate");
  assert.equal((invocations[0].body as CandidateJobRequest).provider, "openai");
  assert.equal((invocations[0].body as CandidateJobRequest).model, "gpt-image-2");
  assert.equal((invocations[0].body as CandidateJobRequest).parentSha256, PARENT_SHA);
});

test("uploadCandidateSource hashes bytes and uploads without overwrite", async () => {
  const uploads: Array<{ bucket: string; path: string; options: Record<string, unknown> }> = [];
  const client = {
    storage: {
      from: (bucket: string) => ({
        upload: async (path: string, _bytes: Uint8Array, options: Record<string, unknown>) => {
          uploads.push({ bucket, path, options });
          return { data: { path }, error: null };
        },
      }),
    },
  };
  const bytes = new TextEncoder().encode("immutable source bytes");

  const result = await uploadCandidateSource(client, {
    organizationId: ORG,
    familyKey: "CYL-9ML",
    assetId: "manual-overcap",
    bytes,
    contentType: "image/png",
    extension: "png",
  });

  assert.equal(result.bucket, "paper-doll-sources");
  assert.equal(result.byteSize, bytes.byteLength);
  assert.match(result.sha256, /^[a-f0-9]{64}$/);
  assert.ok(result.path.endsWith(`${result.sha256}.png`));
  assert.deepEqual(uploads[0].options, { upsert: false, contentType: "image/png" });
});

test("manual source upload preserves the exact filename outside its content-addressed path", async () => {
  const uploads: string[] = [];
  const client = {
    storage: {
      from: () => ({
        upload: async (path: string) => {
          uploads.push(path);
          return { data: { path }, error: null };
        },
      }),
    },
  };
  const originalFilename = "Rollers / 17-415 Natural Plastic Roller FINAL.png";

  const result = await uploadManualCandidateSource(client, {
    organizationId: ORG,
    familyKey: "CYL-9ML",
    assetId: "manual-roller",
    bytes: new TextEncoder().encode("immutable roller bytes"),
    contentType: "image/png",
    extension: "png",
    originalFilename,
  });

  assert.equal(result.originalFilename, originalFilename);
  assert.match(result.path.split("/").at(-1) ?? "", /^[a-f0-9]{64}\.png$/);
  assert.equal(result.path.includes(originalFilename), false);
  assert.equal(uploads[0], result.path);
});

test("candidate workbench preserves worker truth and immutable history", async () => {
  const client = {
    rpc: async () => ({
      data: {
        jobs: [{
          job: {
            id: VERSION, organization_id: ORG, requirement_key: "CYL-9ML:OVERCAP:MAT-GL",
            component_id: COMPONENT, parent_component_version_id: VERSION, parent_sha256: PARENT_SHA,
            provider: "openai", model: "gpt-image-2", status: "queued", prompt_sha256: SHA,
            generation_attempt_id: null, candidate_component_version_id: null, output_ref: null,
            manual_output_ref: null,
            output_metadata: {}, initiated_by: COMPONENT, error_message: null,
            created_at: "2026-08-02T00:00:00.000Z", updated_at: "2026-08-02T00:00:00.000Z", completed_at: null,
          },
          component: { id: COMPONENT, display_name: "17-415 overcap", slot: "overcap" },
          parentVersion: { id: VERSION, image_sha256: PARENT_SHA },
          candidateVersion: null,
          qa: [],
          approval: null,
        }],
        approvals: [],
        worker: { status: "offline", lastSeenAt: null, currentJobId: null, errorMessage: null },
      },
      error: null,
    }),
  };

  const result = await loadCandidateWorkbench(client, ORG, "CYL-9ML");

  assert.equal(result.jobs[0].job.provider, "openai");
  assert.equal(result.jobs[0].job.status, "queued");
  assert.equal(result.worker.status, "offline");
});

test("candidate workbench keeps a verified candidate in history when its preview URL cannot be signed", async () => {
  const client = {
    rpc: async () => ({
      data: {
        jobs: [{
          job: {
            id: VERSION, organization_id: ORG, requirement_key: "CYL-9ML:ROLLER:PLASTIC",
            component_id: COMPONENT, parent_component_version_id: VERSION, parent_sha256: PARENT_SHA,
            provider: "manual", model: "manual-v1", status: "candidate_ready", prompt_sha256: SHA,
            generation_attempt_id: VERSION, candidate_component_version_id: VERSION,
            manual_output_ref: { bucket: "paper-doll-sources", path: `${ORG}/CYL-9ML/manual/${SHA}.png`, sha256: SHA, contentType: "image/png", byteSize: 40, originalFilename: "17-415 Natural Roller FINAL.png" },
            output_ref: { bucket: "paper-doll-candidates", path: `${ORG}/CYL-9ML/candidate/${SHA}.png`, sha256: SHA, contentType: "image/png", byteSize: 40 },
            output_metadata: { geometryLocked: true }, initiated_by: COMPONENT, error_message: null,
            created_at: "2026-08-02T00:00:00.000Z", updated_at: "2026-08-02T00:00:00.000Z", completed_at: "2026-08-02T00:00:01.000Z",
          },
          component: { id: COMPONENT, display_name: "17-415 plastic roller", slot: "roller" },
          parentVersion: { id: VERSION, image_sha256: PARENT_SHA },
          candidateVersion: { id: VERSION },
          qa: [],
          approval: null,
        }],
        approvals: [],
        worker: { status: "offline", lastSeenAt: null, currentJobId: null, errorMessage: null },
      },
      error: null,
    }),
    storage: {
      from: () => ({
        createSignedUrl: async () => ({ data: null, error: { message: "private asset download failed with HTTP 400" } }),
      }),
    },
  };

  const result = await loadCandidateWorkbench(client, ORG, "CYL-9ML");

  assert.equal(result.jobs.length, 1);
  assert.equal(result.jobs[0].job.status, "candidate_ready");
  assert.equal(result.jobs[0].job.manualOutput?.originalFilename, "17-415 Natural Roller FINAL.png");
  assert.equal(result.jobs[0].candidateImageUrl, null);
});

test("candidate workbench accepts PostgreSQL UTC timestamp formatting", async () => {
  const client = {
    rpc: async () => ({
      data: {
        jobs: [{
          job: {
            id: VERSION, organization_id: ORG, requirement_key: "CYL-9ML:ROLLER:PLASTIC",
            component_id: COMPONENT, parent_component_version_id: VERSION, parent_sha256: PARENT_SHA,
            provider: "manual", model: "manual-v1", status: "candidate_ready", prompt_sha256: SHA,
            generation_attempt_id: VERSION, candidate_component_version_id: VERSION,
            manual_output_ref: { bucket: "paper-doll-sources", path: `${ORG}/CYL-9ML/manual/${SHA}.png`, sha256: SHA, contentType: "image/png", byteSize: 40 },
            output_ref: null, output_metadata: {}, initiated_by: COMPONENT, error_message: null,
            created_at: "2026-08-02T18:03:42.422743+00:00", updated_at: "2026-08-02T18:03:43.000000+00:00", completed_at: "2026-08-02T18:03:44.000000+00:00",
          },
          component: { id: COMPONENT, display_name: "17-415 plastic roller", slot: "roller" },
          parentVersion: { id: VERSION, image_sha256: PARENT_SHA }, candidateVersion: { id: VERSION }, qa: [], approval: null,
        }], approvals: [], worker: {},
      }, error: null,
    }),
  };

  const result = await loadCandidateWorkbench(client, ORG, "CYL-9ML");

  assert.equal(result.jobs.length, 1);
  assert.equal(result.jobs[0].job.createdAt, "2026-08-02T18:03:42.422743Z");
  assert.equal(result.jobs[0].job.manualOutput?.originalFilename, undefined, "legacy immutable jobs remain readable");
});

test("approval request remains SHA-bound and evidence-bound", async () => {
  const calls: Array<{ name: string; body: unknown }> = [];
  const client = {
    functions: {
      invoke: async (name: string, options: { body: unknown }) => {
        calls.push({ name, body: options.body });
        return { data: { decision: "approved", approvedComponentVersionId: VERSION }, error: null };
      },
    },
  };
  const request = {
    organizationId: ORG,
    candidateComponentVersionId: VERSION,
    expectedCandidateSha256: SHA,
    decision: "approved" as const,
    approverDisplayName: "Jordan Richter",
    evidenceIds: [COMPONENT],
  };

  await approveCandidate(client, request);

  assert.equal(calls[0].name, "approve-paper-doll-candidate");
  assert.deepEqual(calls[0].body, request);
});

test("signed authority-mask bytes are measured and SHA-verified", async () => {
  const bytes = new TextEncoder().encode("authority mask bytes");
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  const sha256 = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  const result = await verifySignedPrivateAsset("https://signed.example/mask", {
    bucket: "paper-doll-approved",
    path: `${ORG}/CYL-9ML/mask/${sha256}.png`,
    sha256,
    contentType: "image/png",
  }, async () => new Response(bytes));
  assert.equal(result.byteSize, bytes.byteLength);
  assert.equal(result.sha256, sha256);
});
