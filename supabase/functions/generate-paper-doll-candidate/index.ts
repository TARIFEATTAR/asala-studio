import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

import { sha256Hex } from "../_shared/generationAttemptLedger.ts";
import { parsePaperDollCandidateRequest } from "../_shared/paperDollCandidateContract.ts";

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

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return json({ error: "Authentication required" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: "Candidate service is not configured" }, 503);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: { user }, error: userError } = await userClient.auth.getUser(
    authorization.replace(/^Bearer\s+/i, ""),
  );
  if (userError || !user) return json({ error: "Not signed in" }, 401);

  let candidate;
  try {
    candidate = parsePaperDollCandidateRequest(await request.json());
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Invalid candidate request" }, 400);
  }

  // These reads run with the caller JWT. RLS is the organization-membership
  // check; the service-role client is never used until the caller has proven
  // access to both the component and exact immutable parent.
  const [{ data: component }, { data: parent }] = await Promise.all([
    userClient
      .from("paper_doll_components")
      .select("id")
      .eq("id", candidate.componentId)
      .eq("organization_id", candidate.organizationId)
      .maybeSingle(),
    userClient
      .from("paper_doll_component_versions")
      .select("id, component_id, image_sha256")
      .eq("id", candidate.parentComponentVersionId)
      .eq("organization_id", candidate.organizationId)
      .maybeSingle(),
  ]);
  if (!component || !parent) return json({ error: "Organization asset access denied" }, 403);
  if (parent.component_id !== candidate.componentId || parent.image_sha256 !== candidate.parentSha256) {
    return json({ error: "Parent identity or SHA changed; refresh before creating a candidate" }, 409);
  }

  const service = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const { data: job, error: insertError } = await service
    .from("paper_doll_candidate_jobs")
    .insert({
      organization_id: candidate.organizationId,
      requirement_key: candidate.requirementKey,
      component_id: candidate.componentId,
      parent_component_version_id: candidate.parentComponentVersionId,
      parent_sha256: candidate.parentSha256,
      provider: candidate.provider,
      model: candidate.model,
      status: "queued",
      prompt: candidate.instruction,
      prompt_sha256: await sha256Hex(candidate.instruction),
      source_ref: candidate.source,
      authoritative_mask_ref: candidate.authoritativeMask,
      edit_mask_ref: candidate.editMask,
      assembly_context_ref: candidate.assemblyContext ?? null,
      transform: candidate.transform,
      selection_kind: candidate.selectionKind,
      initiated_by: user.id,
    })
    .select("id, status, provider, model, created_at")
    .single();
  if (insertError || !job) {
    console.error("[paper-doll candidate queue]", insertError?.message);
    return json({ error: "Unable to queue candidate" }, 500);
  }

  return json({
    job,
    processing: "queued-for-deterministic-worker",
    geometryLocked: false,
    note: "Geometry lock is awarded only after the worker completes exact mask-and-clamp verification.",
  }, 202);
});
