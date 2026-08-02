import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

import { parsePaperDollApprovalRequest } from "../_shared/paperDollApprovalContract.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const input = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const hash = await crypto.subtle.digest("SHA-256", input);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return json({ error: "Authentication required" }, 401);
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: "Approval service is not configured" }, 503);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: { user }, error: userError } = await userClient.auth.getUser(
    authorization.replace(/^Bearer\s+/i, ""),
  );
  if (userError || !user) return json({ error: "Not signed in" }, 401);

  let approval;
  try {
    approval = parsePaperDollApprovalRequest(await request.json());
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Invalid approval request" }, 400);
  }

  // RLS-backed reads prove membership and exact candidate visibility before
  // service-role Storage access or the service-only transaction is used.
  const { data: candidate } = await userClient
    .from("paper_doll_component_versions")
    .select("id, organization_id, component_id, approval_status, storage_bucket, image_path, image_sha256, byte_size, content_type")
    .eq("id", approval.candidateComponentVersionId)
    .eq("organization_id", approval.organizationId)
    .maybeSingle();
  if (!candidate) return json({ error: "Organization candidate access denied" }, 403);
  if (candidate.image_sha256 !== approval.expectedCandidateSha256 || candidate.approval_status !== "candidate") {
    return json({ error: "Candidate SHA or state changed; refresh before deciding" }, 409);
  }

  const [{ data: component }, { data: job }, { data: qaRows }] = await Promise.all([
    userClient.from("paper_doll_components").select("id, slot").eq("id", candidate.component_id).eq("organization_id", approval.organizationId).maybeSingle(),
    userClient.from("paper_doll_candidate_jobs").select("id, status, requirement_key, output_ref").eq("candidate_component_version_id", candidate.id).eq("organization_id", approval.organizationId).maybeSingle(),
    userClient.from("paper_doll_qa_results").select("id, gate_key, qa_status, blocking").eq("component_version_id", candidate.id).eq("organization_id", approval.organizationId),
  ]);
  if (!component || !job || job.status !== "candidate_ready") return json({ error: "Candidate is not ready for a decision" }, 409);
  const qa = qaRows ?? [];
  const evidence = new Set(approval.evidenceIds);
  const blocking = qa.filter((row) => row.blocking);
  const blockingFailure = blocking.some((row) => row.qa_status !== "passed");
  const exactGeometryPassed = blocking.some((row) => row.gate_key === "geometry-mask-identity" && row.qa_status === "passed" && evidence.has(row.id));
  const metalWhitePassed = blocking.some((row) => row.gate_key === "opaque-white-fraction" && row.qa_status === "passed" && evidence.has(row.id));
  if (approval.decision === "approved" && (blocking.length < 1 || blockingFailure || !exactGeometryPassed)) {
    return json({ error: "Passing blocking QA and exact geometry-mask identity evidence are required" }, 409);
  }
  if (approval.decision === "approved" && component.slot === "roller" && job.requirement_key === "CYL-9ML:ROLLER:METAL" && !metalWhitePassed) {
    return json({ error: "Metal roller remains blocked until opaque-white-fraction QA passes" }, 409);
  }

  const service = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  let approvedRef: Record<string, unknown> | null = null;
  if (approval.decision === "approved") {
    const source = await service.storage.from(candidate.storage_bucket).download(candidate.image_path);
    if (source.error || !source.data) return json({ error: "Candidate bytes are unavailable" }, 409);
    const bytes = new Uint8Array(await source.data.arrayBuffer());
    if (bytes.byteLength !== Number(candidate.byte_size) || await sha256(bytes) !== candidate.image_sha256) {
      return json({ error: "Candidate Storage bytes do not match the ledger" }, 409);
    }
    const approvedPath = `${approval.organizationId}/CYL-9ML/approved-${candidate.id}/${candidate.image_sha256}.png`;
    const upload = await service.storage.from("paper-doll-approved").upload(approvedPath, bytes, {
      upsert: false,
      contentType: candidate.content_type,
    });
    if (upload.error && !/already exists|duplicate/i.test(upload.error.message)) {
      return json({ error: "Approved Storage copy failed" }, 500);
    }
    if (upload.error) {
      const existing = await service.storage.from("paper-doll-approved").download(approvedPath);
      if (existing.error || !existing.data) return json({ error: "Existing approved object could not be verified" }, 500);
      const existingBytes = new Uint8Array(await existing.data.arrayBuffer());
      if (existingBytes.byteLength !== bytes.byteLength || await sha256(existingBytes) !== candidate.image_sha256) {
        return json({ error: "Existing approved object does not preserve candidate identity" }, 409);
      }
    }
    approvedRef = {
      bucket: "paper-doll-approved",
      path: approvedPath,
      sha256: candidate.image_sha256,
      contentType: candidate.content_type,
      byteSize: bytes.byteLength,
    };
  }

  const { data: result, error: transactionError } = await service.rpc("approve_paper_doll_candidate", {
    p_organization_id: approval.organizationId,
    p_candidate_component_version_id: approval.candidateComponentVersionId,
    p_expected_candidate_sha256: approval.expectedCandidateSha256,
    p_decision: approval.decision,
    p_approver_user_id: user.id,
    p_approver_display_name: approval.approverDisplayName,
    p_evidence_ids: approval.evidenceIds,
    p_approved_ref: approvedRef,
  });
  if (transactionError || !result) {
    console.error("[paper-doll approval]", transactionError?.message);
    return json({ error: "Approval transaction was rejected" }, 409);
  }
  return json({ ...result, releaseChanged: false, sanityPublished: false });
});
