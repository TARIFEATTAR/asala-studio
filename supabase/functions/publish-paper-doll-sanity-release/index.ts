import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { resolvePaperDollSanityConfig } from "../_shared/paperDollSanityDraftContract.ts";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
function sorted(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sorted);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, row]) => [key, sorted(row)]));
  return value;
}
async function sha256(value: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(sorted(value)));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
function cleanSanityDocument(value: Record<string, unknown>) {
  const { _rev: _revIgnored, _createdAt: _createdIgnored, _updatedAt: _updatedIgnored, ...clean } = value;
  return clean;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return json({ error: "Authentication required" }, 401);
  let input: Record<string, unknown>;
  try { input = await request.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  if (!input || !UUID.test(String(input.organizationId)) || !UUID.test(String(input.releaseCutId)) || !["dry-run", "publish"].includes(String(input.mode))) {
    return json({ error: "organizationId, releaseCutId, and mode are invalid" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const { projectId, dataset, token } = resolvePaperDollSanityConfig((key) => Deno.env.get(key));
  const publicDocumentId = Deno.env.get("SANITY_CYL9_PAPER_DOLL_DOCUMENT_ID") ?? "";
  const draftDocumentId = `drafts.${publicDocumentId}`;
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !projectId || !dataset || !token || !/^(?!drafts\.)[A-Za-z0-9._-]+$/.test(publicDocumentId)) return json({ error: "Publication service or canonical document is not configured" }, 503);
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
  const { data: { user }, error: userError } = await userClient.auth.getUser(authorization.replace(/^Bearer\s+/i, ""));
  if (userError || !user) return json({ error: "Not signed in" }, 401);
  const { data: visibleCut } = await userClient.from("paper_doll_release_cuts").select("id, resulting_release_id").eq("id", input.releaseCutId).eq("organization_id", input.organizationId).maybeSingle();
  if (!visibleCut) return json({ error: "Organization release-cut access denied" }, 403);

  const query = encodeURIComponent(`*[_id in [$draftId,$publicId]]`);
  const queryResponse = await fetch(`https://${projectId}.api.sanity.io/v2025-02-19/data/query/${encodeURIComponent(dataset)}?query=${query}&$draftId=${encodeURIComponent(JSON.stringify(draftDocumentId))}&$publicId=${encodeURIComponent(JSON.stringify(publicDocumentId))}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!queryResponse.ok) return json({ error: "Unable to read the Sanity draft" }, 502);
  const documents = (await queryResponse.json()).result as Array<Record<string, unknown>>;
  const draftRaw = documents.find((document) => document._id === draftDocumentId);
  const publicRaw = documents.find((document) => document._id === publicDocumentId);
  if (!draftRaw || draftRaw.releaseCutId !== input.releaseCutId) return json({ error: "Stable Sanity draft is missing or belongs to another cut" }, 409);
  const draft = cleanSanityDocument(draftRaw);
  const draftSha = await sha256(draft);
  const publicSha = publicRaw ? await sha256(cleanSanityDocument(publicRaw)) : null;
  const service = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  if (input.mode === "dry-run") {
    const { data: priorDryRun, error: priorDryRunError } = await service
      .from("paper_doll_publish_runs")
      .select("id, result")
      .eq("organization_id", input.organizationId)
      .eq("release_cut_id", visibleCut.id)
      .eq("destination", "sanity:public")
      .eq("publish_status", "public_dry_run")
      .eq("request_sha256", draftSha)
      .order("attempt_sequence", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (priorDryRunError) return json({ error: "Unable to verify prior public dry-runs" }, 500);
    if (priorDryRun) {
      return json({ dryRunId: priorDryRun.id, draftSha256: draftSha, currentPublicSha256: publicSha, changed: publicSha !== draftSha, readiness: draft.readinessSummary ?? null, publicPublished: false });
    }
    const { data: latestAttempt, error: attemptError } = await service
      .from("paper_doll_publish_runs")
      .select("attempt_sequence")
      .eq("organization_id", input.organizationId)
      .eq("release_cut_id", visibleCut.id)
      .eq("destination", "sanity:public")
      .order("attempt_sequence", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (attemptError) return json({ error: "Unable to allocate the public dry-run sequence" }, 500);
    const { data: run, error } = await service.from("paper_doll_publish_runs").insert({
      organization_id: input.organizationId, release_id: visibleCut.resulting_release_id,
      release_cut_id: visibleCut.id, destination: "sanity:public", sanity_document_id: publicDocumentId,
      publish_status: "public_dry_run", request_sha256: draftSha, attempt_sequence: Number(latestAttempt?.attempt_sequence ?? 0) + 1,
      result: { draftSha256: draftSha, currentPublicSha256: publicSha, changed: publicSha !== draftSha, readiness: draft.readinessSummary ?? null },
      completed_at: new Date().toISOString(),
    }).select("id").single();
    if (error || !run) return json({ error: "Unable to record public dry-run" }, 409);
    return json({ dryRunId: run.id, draftSha256: draftSha, currentPublicSha256: publicSha, changed: publicSha !== draftSha, readiness: draft.readinessSummary ?? null, publicPublished: false });
  }

  if (!UUID.test(String(input.dryRunId)) || typeof input.expectedDraftSha256 !== "string" || input.expectedDraftSha256 !== draftSha || typeof input.approverDisplayName !== "string" || !input.approverDisplayName.trim() || typeof input.approvalNote !== "string" || !input.approvalNote.trim()) {
    return json({ error: "Named publication approval and the exact dry-run draft hash are required" }, 400);
  }
  const { data: dryRun } = await userClient.from("paper_doll_publish_runs").select("*").eq("id", input.dryRunId).eq("organization_id", input.organizationId).eq("release_cut_id", visibleCut.id).eq("publish_status", "public_dry_run").maybeSingle();
  if (!dryRun || dryRun.request_sha256 !== draftSha) return json({ error: "Public dry-run is stale" }, 409);
  const readiness = draft.readinessSummary as { ready?: number; incomplete?: number } | undefined;
  if (draft.storefrontReady !== true || !readiness || Number(readiness.ready) < 1 || Number(readiness.incomplete) !== 0) {
    return json({ error: "Public publication requires at least one ready SKU and zero incomplete SKUs" }, 409);
  }
  const { data: existingApproval, error: approvalReadError } = await service
    .from("paper_doll_publication_approvals")
    .select("expected_draft_sha256, approver_user_id, approver_display_name, approval_note")
    .eq("publish_run_id", dryRun.id)
    .maybeSingle();
  if (approvalReadError) return json({ error: "Unable to verify the publication approval ledger" }, 500);
  if (existingApproval) {
    if (
      existingApproval.expected_draft_sha256 !== draftSha
      || existingApproval.approver_user_id !== user.id
      || existingApproval.approver_display_name !== input.approverDisplayName.trim()
      || existingApproval.approval_note !== input.approvalNote.trim()
    ) return json({ error: "This dry-run already has a different immutable publication approval" }, 409);
  } else {
    const { error: approvalError } = await service.from("paper_doll_publication_approvals").insert({
      organization_id: input.organizationId, release_cut_id: visibleCut.id, publish_run_id: dryRun.id,
      expected_draft_sha256: draftSha, approver_user_id: user.id,
      approver_display_name: input.approverDisplayName.trim(), approval_note: input.approvalNote.trim(),
    });
    if (approvalError) return json({ error: "Unable to record the named publication approval" }, 409);
  }

  const publicDocument = { ...draft, _id: publicDocumentId };
  const mutation = await fetch(`https://${projectId}.api.sanity.io/v2025-02-19/data/mutate/${encodeURIComponent(dataset)}?returnIds=true&visibility=async`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ mutations: [{ createOrReplace: publicDocument }] }),
  });
  if (!mutation.ok) {
    await service.from("paper_doll_publish_runs").update({ error_message: "Sanity public mutation was rejected", completed_at: new Date().toISOString() }).eq("id", dryRun.id);
    return json({ error: "Sanity public mutation was rejected; the named approval receipt is retained for an exact retry" }, 502);
  }
  const mutationResult = await mutation.json();
  await service.from("paper_doll_publish_runs").update({ publish_status: "published", result: { ...dryRun.result, transactionId: mutationResult.transactionId ?? null, publishedDocumentId: publicDocumentId }, completed_at: new Date().toISOString() }).eq("id", dryRun.id);
  return json({ publishRunId: dryRun.id, documentId: publicDocumentId, status: "published", draftSha256: draftSha, publicPublished: true });
});
