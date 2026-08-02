import { buildPaperDollObjectPath } from "./assetStorage";
import {
  CandidateApprovalRequestSchema,
  CandidateJobRecordSchema,
  CandidateJobRequestSchema,
  PrivateAssetRefSchema,
  type CandidateApprovalRequest,
  type CandidateJobRecord,
  type CandidateJobRequest,
  type PrivateAssetRef,
} from "./candidateJobContract";

interface FunctionClient {
  functions: {
    invoke(name: string, options: { body: unknown }): Promise<{ data: unknown; error: { message: string } | null }>;
  };
}

interface RpcClient {
  rpc(name: string, args: Record<string, unknown>): Promise<{ data: unknown; error: { message: string } | null }>;
  storage?: {
    from(bucket: string): {
      createSignedUrl(path: string, expiresIn: number): Promise<{ data: { signedUrl?: string } | null; error: { message: string } | null }>;
    };
  };
}

interface SourceStorageClient {
  storage: {
    from(bucket: string): {
      upload(path: string, bytes: Uint8Array, options: Record<string, unknown>): Promise<{ data: unknown; error: { message: string } | null }>;
      download?(path: string): Promise<{ data: Blob | null; error: { message: string } | null }>;
    };
  };
}

export interface CandidateHistoryEntry {
  job: CandidateJobRecord;
  component: { id: string; displayName: string; slot: string };
  parentVersion: Record<string, unknown>;
  candidateVersion: Record<string, unknown> | null;
  qa: Array<Record<string, unknown>>;
  approval: Record<string, unknown> | null;
  candidateImageUrl: string | null;
}

export interface CandidateWorkbenchData {
  jobs: CandidateHistoryEntry[];
  approvals: Array<Record<string, unknown>>;
  worker: {
    status: "offline" | "ready" | "busy" | "error";
    lastSeenAt: string | null;
    currentJobId: string | null;
    errorMessage: string | null;
  };
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`Malformed ${label}.`);
  return value as Record<string, unknown>;
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value) throw new Error(`Malformed ${label}.`);
  return value;
}

function nullableString(value: unknown, label: string): string | null {
  if (value === null || value === undefined) return null;
  return requiredString(value, label);
}

function parseJob(value: unknown): CandidateJobRecord {
  const job = asRecord(value, "candidate job");
  return CandidateJobRecordSchema.parse({
    id: job.id,
    organizationId: job.organization_id,
    requirementKey: job.requirement_key,
    componentId: job.component_id,
    parentComponentVersionId: job.parent_component_version_id,
    parentSha256: job.parent_sha256,
    provider: job.provider,
    model: job.model,
    status: job.status,
    promptSha256: job.prompt_sha256,
    generationAttemptId: job.generation_attempt_id,
    candidateComponentVersionId: job.candidate_component_version_id,
    output: job.output_ref,
    outputMetadata: job.output_metadata ?? {},
    initiatedBy: job.initiated_by,
    errorMessage: job.error_message,
    createdAt: job.created_at,
    updatedAt: job.updated_at,
    completedAt: job.completed_at,
  });
}

async function digest(bytes: Uint8Array): Promise<string> {
  const input = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const hash = await globalThis.crypto.subtle.digest("SHA-256", input);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function createCandidateJob(client: FunctionClient, request: CandidateJobRequest) {
  const exactRequest = CandidateJobRequestSchema.parse(request);
  const { data, error } = await client.functions.invoke("generate-paper-doll-candidate", { body: exactRequest });
  if (error) throw new Error(`Unable to queue candidate: ${error.message}`);
  const payload = asRecord(data, "candidate queue response");
  const job = asRecord(payload.job, "queued candidate job");
  return {
    id: requiredString(job.id, "queued candidate id"),
    status: requiredString(job.status, "queued candidate status"),
    provider: requiredString(job.provider, "queued candidate provider"),
    model: requiredString(job.model, "queued candidate model"),
    createdAt: requiredString(job.created_at, "queued candidate created time"),
  };
}

export async function uploadCandidateSource(client: SourceStorageClient, input: {
  organizationId: string;
  familyKey: string;
  assetId: string;
  bytes: Uint8Array;
  contentType: string;
  extension: string;
}): Promise<PrivateAssetRef> {
  if (input.bytes.byteLength < 1) throw new Error("Source upload cannot be empty.");
  const sha256 = await digest(input.bytes);
  const path = buildPaperDollObjectPath({
    organizationId: input.organizationId,
    familyKey: input.familyKey,
    assetId: input.assetId,
    sha256,
    extension: input.extension,
  });
  const bucket = "paper-doll-sources" as const;
  const storage = client.storage.from(bucket);
  const { error } = await storage.upload(path, input.bytes, { upsert: false, contentType: input.contentType });
  if (error) {
    if (!/already exists|duplicate/i.test(error.message) || !storage.download) {
      throw new Error(`Unable to upload immutable source: ${error.message}`);
    }
    const existing = await storage.download(path);
    if (existing.error || !existing.data) throw new Error("Existing source could not be verified.");
    const existingBytes = new Uint8Array(await existing.data.arrayBuffer());
    if (existingBytes.byteLength !== input.bytes.byteLength || await digest(existingBytes) !== sha256) {
      throw new Error("Existing content-addressed source does not match the upload.");
    }
  }
  return PrivateAssetRefSchema.parse({
    bucket,
    path,
    sha256,
    contentType: input.contentType,
    byteSize: input.bytes.byteLength,
  });
}

export async function verifySignedPrivateAsset(
  signedUrl: string,
  identity: Omit<PrivateAssetRef, "byteSize">,
  fetcher: typeof fetch = fetch,
): Promise<PrivateAssetRef> {
  const response = await fetcher(signedUrl);
  if (!response.ok) throw new Error(`Private asset download failed with HTTP ${response.status}.`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength < 1 || await digest(bytes) !== identity.sha256) {
    throw new Error("Private asset bytes do not match the authority checksum.");
  }
  return PrivateAssetRefSchema.parse({ ...identity, byteSize: bytes.byteLength });
}

export async function loadCandidateWorkbench(
  client: RpcClient,
  organizationId: string,
  familyKey: string,
): Promise<CandidateWorkbenchData> {
  const { data, error } = await client.rpc("get_paper_doll_candidate_workbench", {
    p_organization_id: organizationId,
    p_family_key: familyKey,
  });
  if (error) throw new Error(`Unable to load candidate history: ${error.message}`);
  const payload = asRecord(data, "candidate workbench");
  if (!Array.isArray(payload.jobs) || !Array.isArray(payload.approvals)) throw new Error("Malformed candidate history.");
  const workerRaw = payload.worker == null ? {} : asRecord(payload.worker, "worker health");
  const workerStatus = workerRaw.status === "ready" || workerRaw.status === "busy" || workerRaw.status === "error"
    ? workerRaw.status
    : "offline";
  const jobs = payload.jobs.map<CandidateHistoryEntry>((rawEntry) => {
      const entry = asRecord(rawEntry, "candidate history entry");
      const component = asRecord(entry.component, "candidate component");
      return {
        job: parseJob(entry.job),
        component: {
          id: requiredString(component.id, "candidate component id"),
          displayName: requiredString(component.display_name, "candidate component name"),
          slot: requiredString(component.slot, "candidate component slot"),
        },
        parentVersion: asRecord(entry.parentVersion, "candidate parent version"),
        candidateVersion: entry.candidateVersion == null ? null : asRecord(entry.candidateVersion, "candidate version"),
        qa: Array.isArray(entry.qa) ? entry.qa.map((row) => asRecord(row, "candidate QA")) : [],
        approval: entry.approval == null ? null : asRecord(entry.approval, "candidate approval"),
        candidateImageUrl: null,
      };
    });
  if (client.storage) {
    await Promise.all(jobs.map(async (entry) => {
      const output = entry.job.output;
      if (!output) return;
      const signed = await client.storage!.from(output.bucket).createSignedUrl(output.path, 300);
      if (signed.error || !signed.data?.signedUrl) throw new Error(`Unable to sign candidate output: ${signed.error?.message ?? "no URL"}`);
      entry.candidateImageUrl = signed.data.signedUrl;
    }));
  }
  return {
    jobs,
    approvals: payload.approvals.map((approval) => asRecord(approval, "approval")),
    worker: {
      status: workerStatus,
      lastSeenAt: nullableString(workerRaw.lastSeenAt, "worker last seen"),
      currentJobId: nullableString(workerRaw.currentJobId, "worker current job"),
      errorMessage: nullableString(workerRaw.errorMessage, "worker error"),
    },
  };
}

export async function approveCandidate(client: FunctionClient, request: CandidateApprovalRequest) {
  const exactRequest = CandidateApprovalRequestSchema.parse(request);
  const { data, error } = await client.functions.invoke("approve-paper-doll-candidate", { body: exactRequest });
  if (error) throw new Error(`Unable to record candidate decision: ${error.message}`);
  return asRecord(data, "candidate approval response");
}
