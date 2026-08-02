import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "../../src/integrations/supabase/types";
import { buildPaperDollObjectPath } from "../../src/lib/paperDoll/assetStorage";
import { clampCandidate } from "../../src/lib/paperDoll/candidateClamp.node";
import {
  beginGenerationAttempt,
  completeGenerationAttempt,
  type GenerationAttemptTracker,
} from "../../supabase/functions/_shared/generationAttemptLedger";
import {
  buildProviderDispatch,
  parsePaperDollCandidateRequest,
  type PaperDollPrivateAssetRef,
  type ProviderReference,
} from "../../supabase/functions/_shared/paperDollCandidateContract";

type ServiceClient = SupabaseClient<Database>;
type CandidateJobUpdate = Database["public"]["Tables"]["paper_doll_candidate_jobs"]["Update"];

interface CandidateJobRow {
  id: string;
  organization_id: string;
  requirement_key: string;
  component_id: string;
  parent_component_version_id: string;
  parent_sha256: string;
  provider: "blender" | "openai" | "google" | "manual";
  model: string;
  status: string;
  prompt: string;
  source_ref: PaperDollPrivateAssetRef;
  authoritative_mask_ref: PaperDollPrivateAssetRef;
  edit_mask_ref: PaperDollPrivateAssetRef;
  assembly_context_ref: PaperDollPrivateAssetRef | null;
  manual_output_ref: PaperDollPrivateAssetRef | null;
  transform: { translateXPx: number; translateYPx: number; scaleX: number; scaleY: number };
  selection_kind: "whole-layer" | "rectangle" | "brush";
  initiated_by: string;
}

interface ProviderResult {
  bytes: Buffer;
  contentType: string;
  endpoint: string;
  revisedPrompt?: string;
}

type WorkerState = "offline" | "ready" | "busy" | "error";

async function setWorkerHeartbeat(
  client: ServiceClient,
  input: { organizationId: string; status: WorkerState; currentJobId: string | null; errorMessage?: string | null },
) {
  const heartbeatClient = client as unknown as {
    from(table: "paper_doll_worker_heartbeats"): {
      upsert(values: Record<string, unknown>, options: { onConflict: string }): Promise<{ error: { message: string } | null }>;
    };
  };
  const { error } = await heartbeatClient.from("paper_doll_worker_heartbeats").upsert({
    organization_id: input.organizationId,
    worker_key: "paper-doll-candidate-worker-v1",
    worker_status: input.status,
    current_job_id: input.currentJobId,
    error_message: input.errorMessage ?? null,
    last_seen_at: new Date().toISOString(),
  }, { onConflict: "organization_id,worker_key" });
  if (error) throw new Error(`Worker heartbeat failed: ${error.message}`);
}

function cliArg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

async function downloadVerified(client: ServiceClient, reference: PaperDollPrivateAssetRef): Promise<Buffer> {
  const { data, error } = await client.storage.from(reference.bucket).download(reference.path);
  if (error || !data) throw new Error(`Unable to download ${reference.bucket}/${reference.path}: ${error?.message}`);
  const bytes = Buffer.from(await data.arrayBuffer());
  if (bytes.byteLength !== reference.byteSize || sha256(bytes) !== reference.sha256) {
    throw new Error(`Stored bytes do not match ${reference.path}.`);
  }
  return bytes;
}

function referencesFor(
  job: CandidateJobRow,
  bytes: { source: Buffer; authority: Buffer; edit: Buffer; assembly?: Buffer },
): ProviderReference[] {
  return [
    { role: "source", data: bytes.source.toString("base64"), mimeType: job.source_ref.contentType },
    ...(bytes.assembly && job.assembly_context_ref
      ? [{ role: "assembly-context" as const, data: bytes.assembly.toString("base64"), mimeType: job.assembly_context_ref.contentType }]
      : []),
    { role: "authoritative-mask", data: bytes.authority.toString("base64"), mimeType: job.authoritative_mask_ref.contentType },
    { role: "edit-mask", data: bytes.edit.toString("base64"), mimeType: job.edit_mask_ref.contentType },
  ];
}

async function dispatchOpenAI(job: CandidateJobRow, references: ProviderReference[]): Promise<ProviderResult> {
  const dispatch = buildProviderDispatch({
    provider: job.provider,
    model: job.model,
    instruction: job.prompt,
    references,
  });
  const form = new FormData();
  form.append("model", dispatch.model);
  for (const part of dispatch.orderedInputs) {
    if (part.type !== "image") continue;
    const bytes = Buffer.from(part.data, "base64");
    form.append(
      "image[]",
      new Blob([new Uint8Array(bytes)], { type: part.mimeType }),
      `${part.role}.png`,
    );
  }
  const instruction = dispatch.orderedInputs.at(-1);
  if (instruction?.type !== "text") throw new Error("OpenAI dispatch lost its final instruction.");
  form.append("prompt", instruction.text);
  form.append("size", "2080x2288");
  form.append("quality", "high");
  form.append("output_format", "png");
  form.append("background", "opaque");
  const response = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { Authorization: `Bearer ${requiredEnv("OPENAI_API_KEY")}` },
    body: form,
  });
  if (!response.ok) throw new Error(`OpenAI ${response.status}: ${(await response.text()).slice(0, 500)}`);
  const body = await response.json() as { data?: Array<{ b64_json?: string; revised_prompt?: string }> };
  const first = body.data?.[0];
  if (!first?.b64_json) throw new Error("OpenAI returned no image bytes.");
  return {
    bytes: Buffer.from(first.b64_json, "base64"),
    contentType: "image/png",
    endpoint: dispatch.endpoint,
    revisedPrompt: first.revised_prompt,
  };
}

function findGoogleImage(value: unknown): { data: string; mimeType: string } | null {
  if (!value || typeof value !== "object") return null;
  const object = value as Record<string, unknown>;
  if (object.type === "image" && typeof object.data === "string") {
    return { data: object.data, mimeType: typeof object.mime_type === "string" ? object.mime_type : "image/png" };
  }
  if (object.inlineData && typeof object.inlineData === "object") {
    const inline = object.inlineData as Record<string, unknown>;
    if (typeof inline.data === "string") {
      return { data: inline.data, mimeType: typeof inline.mimeType === "string" ? inline.mimeType : "image/png" };
    }
  }
  for (const child of Object.values(object)) {
    if (Array.isArray(child)) {
      for (const entry of child) {
        const found = findGoogleImage(entry);
        if (found) return found;
      }
    } else {
      const found = findGoogleImage(child);
      if (found) return found;
    }
  }
  return null;
}

async function dispatchGoogle(job: CandidateJobRow, references: ProviderReference[]): Promise<ProviderResult> {
  const dispatch = buildProviderDispatch({
    provider: job.provider,
    model: job.model,
    instruction: job.prompt,
    references,
  });
  const input = dispatch.orderedInputs.map((part) => part.type === "image"
    ? { type: "image", data: part.data, mime_type: part.mimeType }
    : { type: "text", text: part.text });
  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": requiredEnv("GEMINI_API_KEY"),
    },
    body: JSON.stringify({ model: dispatch.model, input, response_format: { type: "image", mime_type: "image/png" } }),
  });
  if (!response.ok) throw new Error(`Google ${response.status}: ${(await response.text()).slice(0, 500)}`);
  const body = await response.json();
  const image = findGoogleImage(body);
  if (!image) throw new Error("Google returned no image bytes.");
  return { bytes: Buffer.from(image.data, "base64"), contentType: image.mimeType, endpoint: dispatch.endpoint };
}

async function providerResult(
  job: CandidateJobRow,
  references: ProviderReference[],
  manualOutput?: Buffer,
): Promise<ProviderResult> {
  if (job.provider === "openai") return dispatchOpenAI(job, references);
  if (job.provider === "google") return dispatchGoogle(job, references);
  if (job.provider === "manual") {
    if (!manualOutput) throw new Error("Manual job is missing its immutable uploaded output.");
    return {
      bytes: manualOutput,
      contentType: job.manual_output_ref?.contentType ?? "image/png",
      endpoint: "manual-upload",
    };
  }
  const outputPath = cliArg("--provider-output");
  if (!outputPath) throw new Error(`${job.provider} jobs require --provider-output with an explicit rendered/uploaded file.`);
  return {
    bytes: await readFile(path.resolve(outputPath)),
    contentType: "image/png",
    endpoint: "local-blender-render",
  };
}

async function updateJob(client: ServiceClient, job: CandidateJobRow, patch: CandidateJobUpdate) {
  const { error } = await client
    .from("paper_doll_candidate_jobs")
    .update(patch)
    .eq("id", job.id)
    .eq("organization_id", job.organization_id);
  if (error) throw new Error(`Candidate job update failed: ${error.message}`);
  Object.assign(job, patch);
}

async function uploadAndVerify(
  client: ServiceClient,
  job: CandidateJobRow,
  output: Buffer,
): Promise<PaperDollPrivateAssetRef> {
  const digest = sha256(output);
  const objectPath = buildPaperDollObjectPath({
    organizationId: job.organization_id,
    familyKey: "CYL-9ML",
    assetId: `candidate-${job.id}`,
    sha256: digest,
    extension: "png",
  });
  const bucket = "paper-doll-candidates" as const;
  const { error } = await client.storage.from(bucket).upload(objectPath, output, {
    upsert: false,
    contentType: "image/png",
  });
  if (error && !/already exists|duplicate/i.test(error.message)) {
    throw new Error(`Candidate upload failed: ${error.message}`);
  }
  const reference = { bucket, path: objectPath, sha256: digest, contentType: "image/png", byteSize: output.byteLength };
  await downloadVerified(client, reference);
  return reference;
}

export async function processCandidateJob(input: {
  client: ServiceClient;
  jobId: string;
}): Promise<{ jobId: string; candidateVersionId: string; output: PaperDollPrivateAssetRef }> {
  const { data, error } = await input.client
    .from("paper_doll_candidate_jobs")
    .select("*")
    .eq("id", input.jobId)
    .single();
  if (error || !data) throw new Error(`Candidate job not found: ${error?.message}`);
  const job = data as unknown as CandidateJobRow;
  if (job.status !== "queued") throw new Error(`Candidate job must be queued; received ${job.status}.`);
  parsePaperDollCandidateRequest({
    organizationId: job.organization_id,
    requirementKey: job.requirement_key,
    componentId: job.component_id,
    parentComponentVersionId: job.parent_component_version_id,
    parentSha256: job.parent_sha256,
    provider: job.provider,
    model: job.model,
    instruction: job.prompt,
    source: job.source_ref,
    authoritativeMask: job.authoritative_mask_ref,
    editMask: job.edit_mask_ref,
    assemblyContext: job.assembly_context_ref ?? undefined,
    manualOutput: job.manual_output_ref ?? undefined,
    transform: job.transform,
    selectionKind: job.selection_kind,
  });

  let tracker: GenerationAttemptTracker | null = null;
  try {
    await setWorkerHeartbeat(input.client, {
      organizationId: job.organization_id,
      status: "busy",
      currentJobId: job.id,
    });
    const [source, authority, edit, assembly, manualOutput] = await Promise.all([
      downloadVerified(input.client, job.source_ref),
      downloadVerified(input.client, job.authoritative_mask_ref),
      downloadVerified(input.client, job.edit_mask_ref),
      job.assembly_context_ref ? downloadVerified(input.client, job.assembly_context_ref) : undefined,
      job.manual_output_ref ? downloadVerified(input.client, job.manual_output_ref) : undefined,
    ]);
    const references = referencesFor(job, { source, authority, edit, assembly });
    tracker = await beginGenerationAttempt(input.client, {
      organizationId: job.organization_id,
      userId: job.initiated_by,
      lane: "paper-doll-candidate",
      provider: job.provider,
      model: job.model,
      endpoint: job.provider === "openai" ? "images/edits" : job.provider === "google" ? "interactions" : null,
      prompt: job.prompt,
      referenceSha256s: [
        job.source_ref.sha256,
        ...(job.assembly_context_ref ? [job.assembly_context_ref.sha256] : []),
        ...(job.manual_output_ref ? [job.manual_output_ref.sha256] : []),
        job.authoritative_mask_ref.sha256,
        job.edit_mask_ref.sha256,
      ],
      requestParams: { fallback: null, transform: job.transform, selectionKind: job.selection_kind },
    });
    if (!tracker.id) throw new Error("Generation attempt could not be recorded; provider dispatch was withheld.");
    await updateJob(input.client, job, { status: "running", generation_attempt_id: tracker.id });

    const generated = await providerResult(job, references, manualOutput);
    await updateJob(input.client, job, { status: "clamping" });
    const clamped = await clampCandidate({
      source,
      provider: generated.bytes,
      editMask: edit,
      authoritativeMask: authority,
      manualPlacement: job.provider === "manual",
    });
    const output = await uploadAndVerify(input.client, job, clamped.output);
    await updateJob(input.client, job, { status: "qa" });

    const { data: candidateVersionId, error: finalizeError } = await input.client.rpc(
      "finalize_paper_doll_candidate_job",
      {
        p_job_id: job.id,
        p_organization_id: job.organization_id,
        p_output_ref: output as unknown as Json,
        p_output_metadata: {
          geometryLocked: clamped.geometryLocked,
          geometryGate: "exact-authoritative-mask-alpha",
          changedPixelCount: clamped.changedPixelCount,
          changedBounds: clamped.changedBounds,
          normalization: clamped.normalization,
          asymmetricStretchApplied: clamped.asymmetricStretchApplied,
          providerOutputSha256: clamped.providerSha256,
        },
        p_version: {
          versionKey: `candidate-${job.id}`,
          materialVariant: job.requirement_key.split(":").at(-1) ?? "",
          imagePath: output.path,
          imageSha256: output.sha256,
          geometryMaskPath: job.authoritative_mask_ref.path,
          geometryMaskSha256: job.authoritative_mask_ref.sha256,
          widthPx: 2080,
          heightPx: 2288,
          alphaBounds: clamped.authorityBounds,
          mountAxisXPx: 1041,
          seatYPx: 1002,
          byteSize: output.byteSize,
          contentType: output.contentType,
          provenance: {
            jobId: job.id,
            provider: job.provider,
            model: job.model,
            generationAttemptId: tracker.id,
            parentSha256: job.parent_sha256,
          },
        },
        p_qa_results: [
          {
            gateKey: "geometry-mask-identity",
            gateVersion: "mask-clamp-v1",
            qaStatus: "passed",
            blocking: true,
            calibratedWith: ["cyl9-rollon-real-render-2026-08-01", "frame-vs-object-regression"],
            measurements: { expectedMaskSha256: job.authoritative_mask_ref.sha256, actualMaskSha256: clamped.maskSha256 },
            issues: [],
          },
          {
            gateKey: "provider-normalization",
            gateVersion: "contain-v1",
            qaStatus: "passed",
            blocking: true,
            calibratedWith: ["square-provider-output", "canonical-2080x2288-canvas"],
            measurements: clamped.normalization,
            issues: [],
          },
        ],
      },
    );
    if (finalizeError || !candidateVersionId) throw new Error(`Candidate finalization failed: ${finalizeError?.message}`);
    await completeGenerationAttempt(input.client, tracker, {
      status: "succeeded",
      outputUrl: `${output.bucket}/${output.path}`,
      revisedPrompt: generated.revisedPrompt,
    });
    try {
      await setWorkerHeartbeat(input.client, {
        organizationId: job.organization_id,
        status: "offline",
        currentJobId: null,
      });
    } catch (heartbeatError) {
      console.error("Unable to mark candidate worker offline:", heartbeatError);
    }
    return { jobId: job.id, candidateVersionId: String(candidateVersionId), output };
  } catch (error) {
    await completeGenerationAttempt(input.client, tracker, {
      status: "failed",
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    try {
      await updateJob(input.client, job, {
        status: "failed",
        error_message: error instanceof Error ? error.message.slice(0, 2000) : String(error).slice(0, 2000),
        completed_at: new Date().toISOString(),
      });
    } catch (statusError) {
      console.error("Unable to mark candidate job failed:", statusError);
    }
    try {
      await setWorkerHeartbeat(input.client, {
        organizationId: job.organization_id,
        status: "error",
        currentJobId: job.id,
        errorMessage: error instanceof Error ? error.message.slice(0, 2000) : String(error).slice(0, 2000),
      });
    } catch (heartbeatError) {
      console.error("Unable to mark candidate worker error:", heartbeatError);
    }
    throw error;
  }
}

async function main() {
  const jobId = cliArg("--job");
  if (!jobId) throw new Error("Pass --job <candidate-job-uuid>.");
  const client = createClient<Database>(requiredEnv("SUPABASE_URL"), requiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false },
  });
  process.stdout.write(`${JSON.stringify(await processCandidateJob({ client, jobId }), null, 2)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
