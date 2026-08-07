/**
 * Lock the identity placement for the ASSEMBLED roller fitment versions.
 *
 * Mirrors the assembled sprayer/pump pattern: layers baked at their assembled
 * canvas position carry an identity placement lock (0, 0, ×1) whose authority
 * is the assembled mask. The source-position lock fbe551b9… (x 27.066,
 * y -134.132, s 0.974) remains as bake provenance for the v1 layers; this new
 * lock shares the same fitment geometry key with a different authority sha,
 * so the two coexist without ambiguity.
 */
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

import { createClient } from "@supabase/supabase-js";

const EXPECTED_PROJECT_REF = "likkskifwsrvszxdvufw";
const DEFAULT_ORGANIZATION_ID = "4ab1ac72-cd7e-4faf-9152-5aa5f2862411";
const CONFIRMATION = "CYL9-ROLLER-ASSEMBLED-PLACEMENT";
const FAMILY_KEY = "CYL-9ML";
const GEOMETRY_KEY = "fitment__roller-ball__17-415__v1";
const REBAKE_LOCK_PATH = "docs/paper-doll-rig/cyl9-roller-assembled-v2-lock.json";
const EVIDENCE_PATH = "docs/paper-doll-rig/cyl9-roller-assembled-v2-placement.json";

function sha256(value: Buffer | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function valueAfter(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

async function main() {
  const args = process.argv.slice(2);
  const execute = args.includes("--execute");
  const organizationId = valueAfter(args, "--organization-id") ?? DEFAULT_ORGANIZATION_ID;
  const approvedByName = (valueAfter(args, "--approved-by") ?? "").trim();
  const approvalNote = (valueAfter(args, "--approval-note") ?? "").trim();
  if (!approvedByName || !approvalNote) throw new Error("A named approver and approval note are required.");

  const supabaseUrl = (process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "").trim();
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  const approverUserId = (process.env.MADISON_IMPORT_USER_ID ?? "").trim();
  if (!supabaseUrl || !serviceRoleKey || !approverUserId) {
    throw new Error("SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and MADISON_IMPORT_USER_ID are required.");
  }
  if (new URL(supabaseUrl).hostname.split(".")[0] !== EXPECTED_PROJECT_REF) {
    throw new Error("Refusing to access an unexpected Supabase project.");
  }
  const client = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const rebakeLock = JSON.parse(await readFile(REBAKE_LOCK_PATH, "utf8"));
  const { contentSha256, ...lockPayload } = rebakeLock;
  if (sha256(JSON.stringify(lockPayload)) !== contentSha256) {
    throw new Error("The roller rebake evidence hash no longer matches.");
  }
  const assembledMaskSha = rebakeLock.assembledAuthorityMaskSha256 as string;
  const calibration = rebakeLock.rollerComponentVersions.find((entry: any) => entry.variantKey === "METAL");
  if (!calibration) throw new Error("The METAL calibration roller version is missing from the rebake evidence.");

  const head = await client.from("paper_doll_family_release_heads")
    .select("release_id")
    .eq("organization_id", organizationId)
    .eq("family_key", FAMILY_KEY)
    .single();
  if (head.error) throw head.error;
  const bodies = await client.from("paper_doll_family_release_assets")
    .select("component_version_id")
    .eq("organization_id", organizationId)
    .eq("release_id", head.data.release_id)
    .eq("slot", "body");
  if (bodies.error || bodies.data.length !== 5) {
    throw bodies.error ?? new Error("Current Release must contain exactly five body plates.");
  }
  const bodyIds = bodies.data.map(({ component_version_id }) => component_version_id as string).sort();

  if (!execute) {
    process.stdout.write(`${JSON.stringify({
      mode: "dry-run",
      geometryKey: GEOMETRY_KEY,
      authorityMaskSha256: assembledMaskSha,
      calibrationComponentVersionId: calibration.componentVersionId,
      transform: { translateXPx: 0, translateYPx: 0, uniformScale: 1 },
      bodyComponentVersionIds: bodyIds,
      remoteWritesPerformed: false,
    }, null, 2)}\n`);
    return;
  }
  if (!args.includes("--allow-remote-write") || valueAfter(args, "--confirmation") !== CONFIRMATION) {
    throw new Error(`Remote execution requires --execute --allow-remote-write --confirmation ${CONFIRMATION}.`);
  }

  const lock = await client.rpc("lock_paper_doll_shared_placement", {
    p_organization_id: organizationId,
    p_family_key: FAMILY_KEY,
    p_fitment_geometry_key: GEOMETRY_KEY,
    p_calibration_component_version_id: calibration.componentVersionId,
    p_expected_authority_mask_sha256: assembledMaskSha,
    p_canvas_width_px: 2080,
    p_canvas_height_px: 2288,
    p_translate_x_px: 0,
    p_translate_y_px: 0,
    p_uniform_scale: 1,
    p_compatible_body_component_version_ids: bodyIds,
    p_approver_user_id: approverUserId,
    p_approver_display_name: approvedByName,
    p_approval_note: approvalNote,
  });
  if (lock.error || typeof lock.data?.id !== "string") {
    throw lock.error ?? new Error("Placement lock returned no immutable placement ID.");
  }

  const evidence = {
    schemaVersion: 1,
    familyKey: FAMILY_KEY,
    geometryKey: GEOMETRY_KEY,
    placementVersionId: lock.data.id,
    approvalId: lock.data.approvalId ?? null,
    approvedByName,
    approvalNote,
    approvedAt: new Date().toISOString(),
    placement: { translateXPx: 0, translateYPx: 0, uniformScale: 1 },
    authorityMaskSha256: assembledMaskSha,
    calibrationComponentVersionId: calibration.componentVersionId,
    bodyComponentVersionIds: bodyIds,
    supersedesSourcePlacementVersionId: rebakeLock.placementVersionId,
  };
  await writeFile(EVIDENCE_PATH, `${JSON.stringify({ ...evidence, contentSha256: sha256(JSON.stringify(evidence)) }, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ mode: "executed", placementVersionId: lock.data.id, evidencePath: EVIDENCE_PATH }, null, 2)}\n`);
}

main().catch((error) => {
  const detail = error instanceof Error ? error.stack ?? error.message : JSON.stringify(error, null, 2);
  process.stderr.write(`${detail}\n`);
  process.exitCode = 1;
});
