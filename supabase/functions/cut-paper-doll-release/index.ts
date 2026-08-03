import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

import { parseReleaseCutRequest } from "../_shared/paperDollReleaseCutContract.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

type JsonRecord = Record<string, unknown>;
function asRecord(value: unknown, label: string): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} is malformed.`);
  return value as JsonRecord;
}

function selectedAsset(component: JsonRecord, version: JsonRecord, slot: string, variantKey: string) {
  return {
    componentVersionId: version.id,
    componentKey: component.component_key,
    geometryFamilyId: component.geometry_family_id,
    slot,
    variantKey,
    materialVariant: version.material_variant,
    imagePath: version.image_path,
    imageSha256: version.image_sha256,
    geometryMaskPath: version.geometry_mask_path,
    geometryMaskSha256: version.geometry_mask_sha256,
    widthPx: version.width_px,
    heightPx: version.height_px,
    alphaBounds: version.alpha_bounds,
    mountAxisXPx: Number(version.mount_axis_x_px),
    seatYPx: Number(version.seat_y_px),
    approvalStatus: version.approval_status,
  };
}

function readinessFor(mapping: JsonRecord, available: Set<string>) {
  const required = [
    `body:${mapping.bodyVariantKey}`,
    mapping.fitmentVariantKey ? `roller:${mapping.fitmentVariantKey}` : null,
    mapping.closureVariantKey ? `cap:${mapping.closureVariantKey}` : null,
  ].filter((value): value is string => Boolean(value));
  const missingReasons = required.filter((key) => !available.has(key));
  return {
    mappingKey: mapping.mappingKey,
    websiteSku: mapping.websiteSku,
    graceSku: mapping.graceSku,
    status: missingReasons.length ? "incomplete" : "ready",
    missingReasons,
  };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return json({ error: "Authentication required" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: "Release service is not configured" }, 503);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } }, auth: { persistSession: false },
  });
  const { data: { user }, error: userError } = await userClient.auth.getUser(authorization.replace(/^Bearer\s+/i, ""));
  if (userError || !user) return json({ error: "Not signed in" }, 401);

  let cut;
  try { cut = parseReleaseCutRequest(await request.json()); }
  catch (error) { return json({ error: error instanceof Error ? error.message : "Invalid release cut" }, 400); }

  const { data: visibleHead } = await userClient.from("paper_doll_family_release_heads")
    .select("release_id")
    .eq("organization_id", cut.organizationId).eq("family_key", cut.familyKey).maybeSingle();
  if (!visibleHead) return json({ error: "Organization release access denied" }, 403);
  if (visibleHead.release_id !== cut.expectedCurrentReleaseId) return json({ error: "Current Release changed; refresh before cutting" }, 409);

  const service = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const [{ data: release }, { data: versions }, { data: components }] = await Promise.all([
    service.from("paper_doll_family_releases").select("id, manifest").eq("id", cut.expectedCurrentReleaseId).eq("organization_id", cut.organizationId).single(),
    service.from("paper_doll_component_versions").select("*").eq("organization_id", cut.organizationId).in("id", cut.selectedComponents.map((item) => item.componentVersionId)),
    service.from("paper_doll_components").select("*").eq("organization_id", cut.organizationId),
  ]);
  if (!release || !versions || !components || versions.length !== cut.selectedComponents.length) {
    return json({ error: "Release cut inputs are unavailable" }, 409);
  }

  try {
    const source = asRecord(release.manifest, "Current Release manifest");
    const sourceAssets = Array.isArray(source.assets) ? source.assets.map((asset) => asRecord(asset, "release asset")) : [];
    const componentById = new Map(components.map((component) => [String(component.id), component as JsonRecord]));
    const versionById = new Map(versions.map((version) => [String(version.id), version as JsonRecord]));
    const replacedMemberships = new Set(cut.selectedComponents.map((item) => `${item.slot}:${item.variantKey}`));
    const retainedAssets = sourceAssets.filter((asset) => !replacedMemberships.has(`${asset.slot}:${asset.variantKey}`));
    const additions = cut.selectedComponents.map((item) => {
      const version = versionById.get(item.componentVersionId);
      const component = version ? componentById.get(String(version.component_id)) : null;
      if (!version || !component) throw new Error("Selected component identity is unavailable.");
      return selectedAsset(component, version, item.slot, item.variantKey);
    });
    const assets = [...retainedAssets, ...additions];

    const recipes = Array.isArray(source.assemblyRecipes)
      ? source.assemblyRecipes.map((raw) => {
          const recipe = asRecord(raw, "assembly recipe");
          return recipe.mode === "rollon" ? { ...recipe, layerOrder: ["body", "roller", "cap"] } : recipe;
        })
      : [];
    const mappings = Array.isArray(source.assemblyMappings)
      ? source.assemblyMappings.map((raw) => {
          const mapping = asRecord(raw, "assembly mapping");
          return { ...mapping, closureVariantKey: mapping.closureVariantKey ?? mapping.overcapVariantKey, overcapVariantKey: null };
        })
      : [];
    const available = new Set(assets.map((asset) => `${asset.slot}:${asset.variantKey}`));
    const readiness = mappings.map((mapping) => readinessFor(mapping, available));
    const missingBlockers = readiness.flatMap((row) => row.missingReasons.map((reason) => `missing_asset:${reason}`));
    const manifest = {
      ...source,
      releaseVersion: cut.releaseVersion,
      status: readiness.some((row) => row.status === "incomplete") ? "blocked" : "ready",
      assets,
      assemblyRecipes: recipes,
      assemblyMappings: mappings,
      blockers: [...new Set(missingBlockers)],
      provenance: { sourceGitCommit: cut.sourceGitCommit, rendererVersion: cut.rendererVersion },
    };

    const { data, error } = await service.rpc("cut_paper_doll_release", {
      p_organization_id: cut.organizationId,
      p_family_key: cut.familyKey,
      p_expected_current_release_id: cut.expectedCurrentReleaseId,
      p_release_version: cut.releaseVersion,
      p_manifest: manifest,
      p_selected_components: cut.selectedComponents,
      p_body_component_version_ids: cut.compatibleBodyComponentVersionIds,
      p_sku_readiness: readiness,
      p_approver_user_id: user.id,
      p_approver_display_name: cut.approverDisplayName,
      p_approval_note: cut.approvalNote,
      p_source_git_commit: cut.sourceGitCommit,
      p_renderer_version: cut.rendererVersion,
    });
    if (error || !data) {
      console.error("[paper-doll release cut]", error?.message);
      return json({ error: "Release cut transaction was rejected" }, 409);
    }
    return json(data);
  } catch (error) {
    console.error("[paper-doll release cut build]", error);
    return json({ error: error instanceof Error ? error.message : "Release cut failed" }, 409);
  }
});
