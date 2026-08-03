import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA = /^[a-f0-9]{64}$/;
const SAFE_KEY = /^[a-z0-9][a-z0-9_.-]{2,179}$/;
const VARIANT = /^[A-Z0-9][A-Z0-9-]{0,79}$/;
const SLOTS = new Set(["cap", "roller", "sprayer", "overcap", "pump"]);

function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return value as Record<string, unknown>;
}
function required(value: unknown, label: string, max = 2_000) {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new Error(`${label} is invalid.`);
  return value.trim();
}
function asset(value: unknown, organizationId: string, label: string) {
  const row = object(value, label);
  const path = required(row.path, `${label}.path`);
  const sha256 = required(row.sha256, `${label}.sha256`);
  if (row.bucket !== "paper-doll-sources" || row.contentType !== "image/png" || !SHA.test(sha256)
    || !path.startsWith(`${organizationId}/`) || path.startsWith("/") || path.includes("\\") || path.split("/").includes("..")
    || !path.split("/").at(-1)?.startsWith(`${sha256}.`) || !Number.isSafeInteger(row.byteSize) || Number(row.byteSize) < 1) {
    throw new Error(`${label} violates the private content-addressed PNG contract.`);
  }
  return { bucket: "paper-doll-sources", path, sha256, contentType: "image/png", byteSize: Number(row.byteSize) };
}
async function sha256(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
function pngSize(bytes: Uint8Array) {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (bytes.length < 24 || signature.some((value, index) => bytes[index] !== value)) throw new Error("Component source is not a PNG.");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return json({ error: "Authentication required" }, 401);
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: "Component intake service is not configured" }, 503);

  let input: Record<string, unknown>;
  try { input = object(await request.json(), "Component intake"); } catch (error) { return json({ error: error instanceof Error ? error.message : "Invalid JSON" }, 400); }
  const organizationId = String(input.organizationId ?? "");
  try {
    if (!UUID.test(organizationId) || input.familyKey !== "CYL-9ML" || !SLOTS.has(String(input.slot))
      || !SAFE_KEY.test(String(input.componentKey)) || !SAFE_KEY.test(String(input.geometryFamilyId))
      || !VARIANT.test(String(input.variantKey))) throw new Error("Component identity is invalid.");
    required(input.displayName, "displayName", 200);
    required(input.versionKey, "versionKey", 120);
    required(input.materialVariant, "materialVariant", 160);
    required(input.originalFilename, "originalFilename", 255);
    required(input.registrarDisplayName, "registrarDisplayName", 200);
    required(input.intakeNote, "intakeNote");
    if (typeof input.mountAxisXPx !== "number" || !Number.isFinite(input.mountAxisXPx) || input.mountAxisXPx < 0 || input.mountAxisXPx > 2079
      || typeof input.seatYPx !== "number" || !Number.isFinite(input.seatYPx) || input.seatYPx < 0 || input.seatYPx > 2287) {
      throw new Error("Mount axis and seat coordinates are invalid.");
    }
    object(input.normalization, "normalization");
  } catch (error) { return json({ error: error instanceof Error ? error.message : "Invalid component identity" }, 400); }

  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
  const { data: { user }, error: userError } = await userClient.auth.getUser(authorization.replace(/^Bearer\s+/i, ""));
  if (userError || !user) return json({ error: "Not signed in" }, 401);
  const { data: membership } = await userClient.from("organization_members").select("organization_id").eq("organization_id", organizationId).eq("user_id", user.id).maybeSingle();
  if (!membership) return json({ error: "Organization access denied" }, 403);

  let source; let authorityMask; let bounds: Record<string, unknown>;
  try {
    source = asset(input.source, organizationId, "source");
    authorityMask = asset(input.authorityMask, organizationId, "authorityMask");
    bounds = object(input.alphaBounds, "alphaBounds");
    for (const key of ["left", "top", "right", "bottom"]) if (!Number.isInteger(bounds[key])) throw new Error("alphaBounds must use integer pixels.");
    if (Number(bounds.left) < 0 || Number(bounds.top) < 0 || Number(bounds.right) > 2079 || Number(bounds.bottom) > 2287
      || Number(bounds.left) > Number(bounds.right) || Number(bounds.top) > Number(bounds.bottom)) throw new Error("alphaBounds are outside the canvas.");
  } catch (error) { return json({ error: error instanceof Error ? error.message : "Invalid component assets" }, 400); }

  const service = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  try {
    const [sourceDownload, maskDownload] = await Promise.all([
      service.storage.from(source.bucket).download(source.path),
      service.storage.from(authorityMask.bucket).download(authorityMask.path),
    ]);
    if (sourceDownload.error || !sourceDownload.data || maskDownload.error || !maskDownload.data) throw new Error("Private source bytes could not be downloaded.");
    const sourceBytes = new Uint8Array(await sourceDownload.data.arrayBuffer());
    const maskBytes = new Uint8Array(await maskDownload.data.arrayBuffer());
    const [sourceDigest, maskDigest] = await Promise.all([sha256(sourceBytes), sha256(maskBytes)]);
    if (sourceDigest !== source.sha256 || maskDigest !== authorityMask.sha256
      || sourceBytes.byteLength !== source.byteSize || maskBytes.byteLength !== authorityMask.byteSize) throw new Error("Downloaded component bytes do not match their immutable references.");
    for (const bytes of [sourceBytes, maskBytes]) {
      const size = pngSize(bytes);
      if (size.width !== 2080 || size.height !== 2288) throw new Error("Component source and authority mask must both be 2080×2288 PNGs.");
    }
  } catch (error) { return json({ error: error instanceof Error ? error.message : "Unable to verify component bytes" }, 409); }

  const { data, error } = await service.rpc("register_paper_doll_component_source", {
    p_organization_id: organizationId,
    p_family_key: "CYL-9ML",
    p_component: { componentKey: input.componentKey, geometryFamilyId: input.geometryFamilyId, slot: input.slot, displayName: input.displayName },
    p_version: {
      versionKey: input.versionKey, materialVariant: input.materialVariant,
      storageBucket: source.bucket, imagePath: source.path, imageSha256: source.sha256,
      geometryMaskPath: authorityMask.path, geometryMaskSha256: authorityMask.sha256,
      contentType: "image/png", byteSize: source.byteSize, widthPx: 2080, heightPx: 2288,
      alphaBounds: bounds, mountAxisXPx: input.mountAxisXPx, seatYPx: input.seatYPx,
      approvalStatus: "candidate",
      provenance: { stage: "proposed-source", originalFilename: input.originalFilename, normalization: input.normalization },
    },
    p_variant_key: input.variantKey,
    p_original_filename: input.originalFilename,
    p_registrar_user_id: user.id,
    p_registrar_display_name: input.registrarDisplayName,
    p_intake_note: input.intakeNote,
  });
  if (error || !data) return json({ error: error?.message ?? "Component source registration failed" }, 409);
  return json(data, 201);
});
