import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

import { buildPaperDollSanityDraftDocument } from "../_shared/paperDollSanityDraftContract.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function cleanFilename(path: string) {
  return path.split("/").at(-1)?.replace(/[^a-zA-Z0-9._-]/g, "-") || "paper-doll-layer.png";
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return json({ error: "Authentication required" }, 401);

  let input: { organizationId: string; publishRunId: string };
  try {
    const raw = await request.json();
    if (!raw || !UUID.test(raw.organizationId) || !UUID.test(raw.publishRunId)) throw new Error("organizationId and publishRunId must be UUIDs.");
    input = { organizationId: raw.organizationId, publishRunId: raw.publishRunId };
  } catch (error) { return json({ error: error instanceof Error ? error.message : "Invalid draft sync request" }, 400); }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const sanityProjectId = Deno.env.get("SANITY_PROJECT_ID") ?? "";
  const sanityDataset = Deno.env.get("SANITY_DATASET") ?? "";
  const sanityToken = Deno.env.get("SANITY_API_TOKEN") ?? Deno.env.get("SANITY_WRITE_TOKEN") ?? "";
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: "Draft sync service is not configured" }, 503);
  if (!sanityProjectId || !sanityDataset || !sanityToken) return json({ error: "Sanity draft credentials are not configured" }, 503);

  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
  const { data: { user }, error: userError } = await userClient.auth.getUser(authorization.replace(/^Bearer\s+/i, ""));
  if (userError || !user) return json({ error: "Not signed in" }, 401);
  const { data: visibleRun } = await userClient.from("paper_doll_publish_runs")
    .select("id, organization_id, release_id, release_cut_id, publish_status, sanity_document_id")
    .eq("id", input.publishRunId).eq("organization_id", input.organizationId).maybeSingle();
  if (!visibleRun) return json({ error: "Organization draft-sync access denied" }, 403);
  if (!visibleRun.release_cut_id || visibleRun.sanity_document_id !== "drafts.paperDollFamily.CYL-9ML") {
    return json({ error: "Publish run is not a CYL-9ML draft attempt" }, 409);
  }

  const service = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const claimed = await service.from("paper_doll_publish_runs").update({ publish_status: "running", error_message: null })
    .eq("id", visibleRun.id).eq("organization_id", input.organizationId)
    .in("publish_status", ["queued", "failed"]).select("id").maybeSingle();
  if (claimed.error || !claimed.data) return json({ error: "Draft attempt is already running or complete" }, 409);

  try {
    const [{ data: release }, { data: cut }, { data: memberships }, { data: readiness }] = await Promise.all([
      service.from("paper_doll_family_releases").select("*").eq("id", visibleRun.release_id).eq("organization_id", input.organizationId).single(),
      service.from("paper_doll_release_cuts").select("*").eq("id", visibleRun.release_cut_id).eq("organization_id", input.organizationId).single(),
      service.from("paper_doll_family_release_assets").select("*").eq("release_id", visibleRun.release_id).eq("organization_id", input.organizationId),
      service.from("paper_doll_release_sku_readiness").select("*").eq("release_id", visibleRun.release_id).eq("organization_id", input.organizationId).order("mapping_key"),
    ]);
    if (!release || !cut || !memberships || !readiness) throw new Error("Release-cut ledger is incomplete.");
    const versionIds = memberships.map((row) => row.component_version_id);
    const { data: versions } = await service.from("paper_doll_component_versions").select("*").eq("organization_id", input.organizationId).in("id", versionIds);
    if (!versions || versions.length !== memberships.length) throw new Error("Approved release asset versions are incomplete.");
    const selected = Array.isArray(cut.selected_components) ? cut.selected_components : [];
    const placementId = selected.find((item: Record<string, unknown>) => item.placementVersionId)?.placementVersionId;
    const { data: placement } = placementId
      ? await service.from("paper_doll_placement_versions").select("*").eq("id", placementId).eq("organization_id", input.organizationId).maybeSingle()
      : { data: null };
    const versionById = new Map(versions.map((row) => [row.id, row]));

    const layers = [];
    for (const membership of memberships) {
      const version = versionById.get(membership.component_version_id);
      if (!version || version.approval_status !== "approved" || version.width_px !== 2080 || version.height_px !== 2288) {
        throw new Error(`Release asset ${membership.slot}:${membership.variant_key} is not an approved 2080x2288 layer.`);
      }
      const download = await service.storage.from(version.storage_bucket).download(version.image_path);
      if (download.error || !download.data) throw new Error(`Unable to read ${membership.slot}:${membership.variant_key}.`);
      const uploadResponse = await fetch(
        `https://${sanityProjectId}.api.sanity.io/v2025-02-19/assets/images/${encodeURIComponent(sanityDataset)}?filename=${encodeURIComponent(cleanFilename(version.image_path))}`,
        { method: "POST", headers: { Authorization: `Bearer ${sanityToken}`, "Content-Type": version.content_type }, body: download.data },
      );
      if (!uploadResponse.ok) throw new Error(`Sanity asset upload failed for ${membership.slot}:${membership.variant_key}.`);
      const uploaded = await uploadResponse.json();
      const imageAssetId = uploaded.document?._id ?? uploaded.asset?._id ?? uploaded._id;
      if (typeof imageAssetId !== "string") throw new Error("Sanity asset upload returned no asset ID.");
      layers.push({
        componentVersionId: version.id, slot: membership.slot, variantKey: membership.variant_key,
        imageAssetId, sourceFilename: cleanFilename(version.image_path),
        offsetX: membership.slot === "roller" && placement ? Number(placement.translate_x_px) : 0,
        offsetY: membership.slot === "roller" && placement ? Number(placement.translate_y_px) : 0,
      });
    }

    const document = buildPaperDollSanityDraftDocument({
      familyKey: "CYL-9ML", releaseId: release.id, releaseCutId: cut.id,
      releaseVersion: release.release_version, manifestSha256: release.manifest_sha256,
      rendererVersion: release.renderer_version, syncedAt: new Date().toISOString(),
      placement: placement ? {
        roller: { placementVersionId: placement.id, translateXPx: Number(placement.translate_x_px), translateYPx: Number(placement.translate_y_px), uniformScale: Number(placement.uniform_scale), authorityMaskSha256: placement.authority_mask_sha256 },
      } : {},
      readiness: readiness.map((row) => ({ mappingKey: row.mapping_key, websiteSku: row.website_sku, graceSku: row.grace_sku, status: row.readiness_status, missingReasons: row.missing_reasons })),
      layers,
    });
    const mutation = await fetch(
      `https://${sanityProjectId}.api.sanity.io/v2025-02-19/data/mutate/${encodeURIComponent(sanityDataset)}?returnIds=true&visibility=async`,
      { method: "POST", headers: { Authorization: `Bearer ${sanityToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ mutations: [{ createOrReplace: document }] }) },
    );
    if (!mutation.ok) throw new Error("Sanity draft mutation was rejected.");
    const mutationResult = await mutation.json();
    await service.from("paper_doll_publish_runs").update({
      publish_status: "draft_synced", completed_at: new Date().toISOString(),
      result: { documentId: document._id, transactionId: mutationResult.transactionId ?? null, storefrontReady: document.storefrontReady, readiness: document.readinessSummary },
    }).eq("id", visibleRun.id).eq("organization_id", input.organizationId);
    return json({ publishRunId: visibleRun.id, documentId: document._id, status: "draft_synced", storefrontReady: document.storefrontReady, readiness: document.readinessSummary, publicPublished: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sanity draft sync failed";
    await service.from("paper_doll_publish_runs").update({ publish_status: "failed", error_message: message, completed_at: new Date().toISOString() })
      .eq("id", visibleRun.id).eq("organization_id", input.organizationId);
    return json({ error: message, releaseChanged: false, publicPublished: false }, 502);
  }
});
