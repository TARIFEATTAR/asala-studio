import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

import { parsePaperDollPlacementLockRequest } from "../_shared/paperDollPlacementContract.ts";

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
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: "Placement service is not configured" }, 503);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: { user }, error: userError } = await userClient.auth.getUser(authorization.replace(/^Bearer\s+/i, ""));
  if (userError || !user) return json({ error: "Not signed in" }, 401);

  let placement;
  try {
    placement = parsePaperDollPlacementLockRequest(await request.json());
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Invalid placement request" }, 400);
  }

  const { data: calibration } = await userClient
    .from("paper_doll_component_versions")
    .select("id, organization_id, component_id, approval_status, geometry_mask_sha256, width_px, height_px")
    .eq("id", placement.calibrationComponentVersionId)
    .eq("organization_id", placement.organizationId)
    .maybeSingle();
  if (!calibration) return json({ error: "Organization calibration access denied" }, 403);
  if (
    calibration.approval_status !== "approved"
    || calibration.geometry_mask_sha256 !== placement.expectedAuthorityMaskSha256
    || calibration.width_px !== 2080
    || calibration.height_px !== 2288
  ) return json({ error: "Approved calibration identity, mask, or canvas changed" }, 409);

  const { data: currentRelease } = await userClient
    .from("paper_doll_family_releases")
    .select("id")
    .eq("organization_id", placement.organizationId)
    .eq("family_key", placement.familyKey)
    .neq("release_status", "superseded")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!currentRelease) return json({ error: "Current family release is unavailable" }, 409);

  const [{ data: component }, { data: bodies }, { data: releaseMembership }] = await Promise.all([
    userClient.from("paper_doll_components")
      .select("id, slot, geometry_family_id")
      .eq("id", calibration.component_id)
      .eq("organization_id", placement.organizationId)
      .maybeSingle(),
    userClient.from("paper_doll_component_versions")
      .select("id, component_id, approval_status")
      .eq("organization_id", placement.organizationId)
      .in("id", placement.compatibleBodyComponentVersionIds),
    userClient.from("paper_doll_family_release_assets")
      .select("component_version_id, slot, release_id")
      .eq("organization_id", placement.organizationId)
      .eq("release_id", currentRelease.id)
      .eq("slot", "body")
      .in("component_version_id", placement.compatibleBodyComponentVersionIds),
  ]);
  if (!component || component.slot !== "roller" || component.geometry_family_id !== placement.fitmentGeometryKey) {
    return json({ error: "Calibration geometry does not match the registered roller family" }, 409);
  }
  if ((bodies ?? []).length !== 5 || (bodies ?? []).some((body) => body.approval_status !== "approved")) {
    return json({ error: "Five approved body versions are required" }, 409);
  }
  if ((releaseMembership ?? []).length !== 5) return json({ error: "Five Current Release body memberships are required" }, 409);

  const service = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const { data, error } = await service.rpc("lock_paper_doll_shared_placement", {
    p_organization_id: placement.organizationId,
    p_family_key: placement.familyKey,
    p_fitment_geometry_key: placement.fitmentGeometryKey,
    p_calibration_component_version_id: placement.calibrationComponentVersionId,
    p_expected_authority_mask_sha256: placement.expectedAuthorityMaskSha256,
    p_canvas_width_px: placement.canvas.widthPx,
    p_canvas_height_px: placement.canvas.heightPx,
    p_translate_x_px: placement.transform.translateXPx,
    p_translate_y_px: placement.transform.translateYPx,
    p_uniform_scale: placement.transform.uniformScale,
    p_compatible_body_component_version_ids: placement.compatibleBodyComponentVersionIds,
    p_approver_user_id: user.id,
    p_approver_display_name: placement.approverDisplayName,
    p_approval_note: placement.approvalNote,
  });
  if (error || !data) {
    console.error("[paper-doll placement]", error?.message);
    return json({ error: "Shared placement transaction was rejected" }, 409);
  }
  return json(data);
});
