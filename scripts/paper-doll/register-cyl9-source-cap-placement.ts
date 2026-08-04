import { createHash } from "node:crypto";
import { basename } from "node:path";
import { readFile, writeFile } from "node:fs/promises";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";

const EXPECTED_PROJECT_REF = "likkskifwsrvszxdvufw";
const DEFAULT_ORGANIZATION_ID = "4ab1ac72-cd7e-4faf-9152-5aa5f2862411";
const CONFIRMATION = "CYL9-SOURCE-CAP-PLACEMENT-LOCK";
const FAMILY_KEY = "CYL-9ML";
const GEOMETRY_FAMILY_ID = "closure__17-415__rollon-overcap__v2";
const SOURCE_MANIFEST_PATH = "outputs/paper-doll-cyl9-cap-family/source-backed-v1/manifest.json";
const EVIDENCE_PATH = "docs/paper-doll-rig/cyl9-source-cap-v1-remote-placement-lock.json";
const AUTHORITY_BOUNDS = { left: 869, top: 501, right: 1212, bottom: 1001 } as const;
const MOUNT_AXIS_X_PX = 1041;
const SEAT_Y_PX = 1002;

type JsonRecord = Record<string, any>;

const MATERIALS: Record<string, string> = {
  BKDT: "black-dotted",
  MCPR: "matte-copper",
  MGLD: "matte-gold",
  MSLV: "matte-silver",
  PKDT: "pink-dotted",
  SBLK: "shiny-black",
  SGLD: "shiny-gold",
  SLDT: "silver-dotted",
  SSLV: "shiny-silver",
  WHT: "white",
};

function sha256(bytes: Buffer | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function requireSha(value: unknown, label: string): string {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) {
    throw new Error(`${label} is not a lowercase SHA-256.`);
  }
  return value;
}

function valueAfter(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

export function buildSourceCapRegistrationPlan(input: {
  manifest: JsonRecord;
  organizationId: string;
  bodyAssetSha256: string[];
  approvedByName: string;
  approvalNote: string;
}) {
  const { manifest, organizationId, bodyAssetSha256 } = input;
  if (
    manifest.familyKey !== FAMILY_KEY
    || manifest.geometryFamilyId !== GEOMETRY_FAMILY_ID
    || manifest.canvas?.width !== 2080
    || manifest.canvas?.height !== 2288
    || manifest.variantCount !== 10
    || manifest.assemblyCount !== 50
    || manifest.bodyKeys?.length !== 5
    || manifest.releaseMutation !== false
    || manifest.sanityMutation !== false
    || manifest.sharedPlacement?.x !== 0
    || manifest.sharedPlacement?.y !== -3
    || manifest.sharedPlacement?.scale !== 1
    || !input.approvedByName.trim()
    || !input.approvalNote.trim()
  ) {
    throw new Error("The reviewed CYL-9ML cap manifest or named placement approval is incomplete.");
  }
  if (bodyAssetSha256.length !== 5 || new Set(bodyAssetSha256).size !== 5) {
    throw new Error("Five distinct body-plate hashes are required for family-fit evidence.");
  }
  bodyAssetSha256.forEach((hash, index) => requireSha(hash, `bodyAssetSha256.${index}`));

  const records = manifest.records as JsonRecord[];
  const authorityHashes = new Set(records.map(({ authorityMaskSha256 }) => authorityMaskSha256));
  if (
    records.length !== 10
    || authorityHashes.size !== 1
    || records.some((record) => record.alphaAuthorityMatch !== true || record.assemblyCount !== 5)
  ) {
    throw new Error("All ten caps must share one exact authority alpha and five-body review evidence.");
  }

  const items = records.map((record) => {
    const materialVariant = MATERIALS[record.variantKey];
    if (!materialVariant) throw new Error(`Unexpected CYL-9ML cap variant ${record.variantKey}.`);
    const layerSha256 = requireSha(record.layerSha256, `${record.variantKey} layer SHA`);
    const authoritySha256 = requireSha(record.authorityMaskSha256, `${record.variantKey} authority SHA`);
    return {
      variantKey: record.variantKey as string,
      label: record.label as string,
      layerPath: record.layerPath as string,
      layerSha256,
      authorityPath: record.authorityMaskPath as string,
      authoritySha256,
      sourcePath: record.sourcePath as string,
      sourceLayerSha256: requireSha(record.sourceLayerSha256, `${record.variantKey} source SHA`),
      component: {
        componentKey: `cap__17-415__rollon__${record.variantKey}`,
        geometryFamilyId: GEOMETRY_FAMILY_ID,
        slot: "cap",
        displayName: `17-415 roll-on overcap — ${record.label}`,
      },
      version: {
        versionKey: `source-backed-v1-${layerSha256.slice(0, 12)}`,
        materialVariant,
        storageBucket: "paper-doll-approved",
        imagePath: `${organizationId}/${FAMILY_KEY}/source-cap-v1/${record.variantKey}/${layerSha256}.png`,
        imageSha256: layerSha256,
        geometryMaskPath: `${organizationId}/${FAMILY_KEY}/source-cap-v1/authority/${authoritySha256}.png`,
        geometryMaskSha256: authoritySha256,
        contentType: "image/png",
        byteSize: 0,
        widthPx: 2080,
        heightPx: 2288,
        alphaBounds: AUTHORITY_BOUNDS,
        mountAxisXPx: MOUNT_AXIS_X_PX,
        seatYPx: SEAT_Y_PX,
        approvalStatus: "approved",
        provenance: {
          sourceType: record.sourceMode,
          originalFilename: basename(record.sourcePath),
          sourceSha256: record.sourceLayerSha256,
          exactAuthorityAlpha: true,
          fiveBodyAssemblyCount: 5,
          sharedPlacement: manifest.sharedPlacement,
          approvedByName: input.approvedByName.trim(),
          approvalNote: input.approvalNote.trim(),
        },
      },
      qaResults: [
        {
          gateKey: "exact-alpha",
          gateVersion: "source-cap-v1",
          qaStatus: "passed",
          blocking: true,
          calibratedWith: [authoritySha256],
          measurements: { alphaMismatchedPixels: 0, exactMaskClampVerified: true },
          issues: [],
        },
        {
          gateKey: "five-body-family-fit",
          gateVersion: "source-cap-v1-y-neg-3",
          qaStatus: "passed",
          blocking: true,
          calibratedWith: [...bodyAssetSha256].sort(),
          measurements: { bodyPlateCount: 5, translateXPx: 0, translateYPx: -3, uniformScale: 1 },
          issues: [],
        },
      ],
    };
  }).sort((left, right) => left.variantKey.localeCompare(right.variantKey));

  return {
    familyKey: FAMILY_KEY,
    geometryFamilyId: GEOMETRY_FAMILY_ID,
    approvedByName: input.approvedByName.trim(),
    approvalNote: input.approvalNote.trim(),
    items,
    placement: { translateXPx: 0, translateYPx: -3, uniformScale: 1 },
    releaseMutation: false,
    sanityMutation: false,
  };
}

async function verifiedUpload(
  client: SupabaseClient,
  bucket: string,
  objectPath: string,
  bytes: Buffer,
  expectedSha256: string,
) {
  const existing = await client.storage.from(bucket).download(objectPath);
  if (existing.data) {
    const existingBytes = Buffer.from(await existing.data.arrayBuffer());
    if (sha256(existingBytes) !== expectedSha256) {
      throw new Error(`Immutable storage collision at ${bucket}/${objectPath}.`);
    }
    return "verified-existing" as const;
  }
  const upload = await client.storage.from(bucket).upload(objectPath, bytes, {
    contentType: "image/png",
    cacheControl: "31536000",
    upsert: false,
  });
  if (upload.error) throw upload.error;
  const verification = await client.storage.from(bucket).download(objectPath);
  if (verification.error || !verification.data) {
    throw verification.error ?? new Error(`Unable to verify ${objectPath}.`);
  }
  const verifiedBytes = Buffer.from(await verification.data.arrayBuffer());
  if (sha256(verifiedBytes) !== expectedSha256) {
    throw new Error(`Uploaded bytes failed SHA verification: ${objectPath}.`);
  }
  return "uploaded" as const;
}

async function loadCurrentBodyVersions(client: SupabaseClient, organizationId: string) {
  const head = await client.from("paper_doll_family_release_heads")
    .select("release_id")
    .eq("organization_id", organizationId)
    .eq("family_key", FAMILY_KEY)
    .single();
  if (head.error) throw head.error;
  const memberships = await client.from("paper_doll_family_release_assets")
    .select("component_version_id,variant_key")
    .eq("organization_id", organizationId)
    .eq("release_id", head.data.release_id)
    .eq("slot", "body");
  if (memberships.error || memberships.data.length !== 5) {
    throw memberships.error ?? new Error("Current Release must contain exactly five body plates.");
  }
  const versions = await client.from("paper_doll_component_versions")
    .select("id,image_sha256,approval_status")
    .eq("organization_id", organizationId)
    .in("id", memberships.data.map(({ component_version_id }) => component_version_id));
  if (versions.error || versions.data.length !== 5 || versions.data.some(({ approval_status }) => approval_status !== "approved")) {
    throw versions.error ?? new Error("Current Release body versions must all be approved.");
  }
  return {
    releaseId: head.data.release_id as string,
    versionIds: versions.data.map(({ id }) => id as string).sort(),
    assetSha256: versions.data.map(({ image_sha256 }) => requireSha(image_sha256, "Current body SHA")).sort(),
  };
}

async function main() {
  const args = process.argv.slice(2);
  const execute = args.includes("--execute");
  const organizationId = valueAfter(args, "--organization-id") ?? DEFAULT_ORGANIZATION_ID;
  const approvedByName = valueAfter(args, "--approved-by") ?? "";
  const approvalNote = valueAfter(args, "--approval-note") ?? "";
  const manifest = JSON.parse(await readFile(SOURCE_MANIFEST_PATH, "utf8"));

  const supabaseUrl = (process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "").trim();
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  const approverUserId = (process.env.MADISON_IMPORT_USER_ID ?? "").trim();
  if (!supabaseUrl || !serviceRoleKey || !approverUserId) {
    throw new Error("SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and MADISON_IMPORT_USER_ID are required.");
  }
  if (new URL(supabaseUrl).hostname.split(".")[0] !== EXPECTED_PROJECT_REF) {
    throw new Error("Refusing to access an unexpected Supabase project.");
  }
  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const currentBodies = await loadCurrentBodyVersions(client, organizationId);
  const plan = buildSourceCapRegistrationPlan({
    manifest,
    organizationId,
    bodyAssetSha256: currentBodies.assetSha256,
    approvedByName,
    approvalNote,
  });

  const authorityBytes = await readFile(plan.items[0].authorityPath);
  if (sha256(authorityBytes) !== plan.items[0].authoritySha256) {
    throw new Error("Authority-mask bytes changed after review.");
  }
  const authorityMetadata = await sharp(authorityBytes).metadata();
  if (authorityMetadata.width !== 2080 || authorityMetadata.height !== 2288) {
    throw new Error("Authority mask is not on the canonical 2080×2288 canvas.");
  }
  for (const item of plan.items) {
    const layerBytes = await readFile(item.layerPath);
    if (sha256(layerBytes) !== item.layerSha256) throw new Error(`Cap bytes changed: ${item.variantKey}.`);
    const metadata = await sharp(layerBytes).metadata();
    if (metadata.width !== 2080 || metadata.height !== 2288) throw new Error(`${item.variantKey} is off canvas.`);
    item.version.byteSize = layerBytes.byteLength;
  }

  if (!execute) {
    process.stdout.write(`${JSON.stringify({
      mode: "dry-run",
      familyKey: plan.familyKey,
      capVersions: plan.items.length,
      bodyPlates: currentBodies.versionIds.length,
      placement: plan.placement,
      remoteWritesPerformed: false,
      releaseMutation: false,
      sanityMutation: false,
    }, null, 2)}\n`);
    return;
  }
  if (!args.includes("--allow-remote-write") || valueAfter(args, "--confirmation") !== CONFIRMATION) {
    throw new Error(`Remote execution requires --execute --allow-remote-write --confirmation ${CONFIRMATION}.`);
  }

  const storageActions: JsonRecord[] = [];
  const registered: Array<JsonRecord & { componentVersionId: string }> = [];
  for (const item of plan.items) {
    const layerBytes = await readFile(item.layerPath);
    storageActions.push({
      path: item.version.imagePath,
      action: await verifiedUpload(client, "paper-doll-approved", item.version.imagePath, layerBytes, item.layerSha256),
    });
    storageActions.push({
      path: item.version.geometryMaskPath,
      action: await verifiedUpload(client, "paper-doll-approved", item.version.geometryMaskPath, authorityBytes, item.authoritySha256),
    });
    const registration = await client.rpc("register_paper_doll_approved_source", {
      p_organization_id: organizationId,
      p_component: item.component,
      p_version: item.version,
      p_qa_results: item.qaResults,
    });
    if (registration.error) throw registration.error;
    registered.push({ ...item, componentVersionId: registration.data.componentVersionId as string });
  }

  const calibration = registered.find(({ variantKey }) => variantKey === "SSLV");
  if (!calibration) throw new Error("The shiny-silver calibration cap is missing.");
  const lock = await client.rpc("lock_paper_doll_shared_placement", {
    p_organization_id: organizationId,
    p_family_key: FAMILY_KEY,
    p_fitment_geometry_key: GEOMETRY_FAMILY_ID,
    p_calibration_component_version_id: calibration.componentVersionId,
    p_expected_authority_mask_sha256: calibration.authoritySha256,
    p_canvas_width_px: 2080,
    p_canvas_height_px: 2288,
    p_translate_x_px: plan.placement.translateXPx,
    p_translate_y_px: plan.placement.translateYPx,
    p_uniform_scale: plan.placement.uniformScale,
    p_compatible_body_component_version_ids: currentBodies.versionIds,
    p_approver_user_id: approverUserId,
    p_approver_display_name: plan.approvedByName,
    p_approval_note: plan.approvalNote,
  });
  if (lock.error || typeof lock.data?.id !== "string") {
    throw lock.error ?? new Error("Placement lock returned no immutable placement ID.");
  }

  const evidence = {
    schemaVersion: 1,
    familyKey: FAMILY_KEY,
    geometryFamilyId: GEOMETRY_FAMILY_ID,
    placementVersionId: lock.data.id,
    approvalId: lock.data.approvalId,
    approvedByName: plan.approvedByName,
    approvalNote: plan.approvalNote,
    approvedAt: new Date().toISOString(),
    placement: plan.placement,
    authorityMaskSha256: calibration.authoritySha256,
    currentReleaseId: currentBodies.releaseId,
    bodyComponentVersionIds: currentBodies.versionIds,
    capComponentVersions: registered.map(({ variantKey, componentVersionId, layerSha256 }) => ({
      variantKey,
      componentVersionId,
      imageSha256: layerSha256,
    })),
    storageActions,
    releaseMutation: false,
    sanityMutation: false,
  };
  await writeFile(EVIDENCE_PATH, `${JSON.stringify({ ...evidence, contentSha256: sha256(JSON.stringify(evidence)) }, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({
    mode: "executed",
    capVersions: registered.length,
    placementVersionId: lock.data.id,
    placement: plan.placement,
    releaseMutation: false,
    sanityMutation: false,
    evidencePath: EVIDENCE_PATH,
  }, null, 2)}\n`);
}

if (process.argv[1]?.endsWith("register-cyl9-source-cap-placement.ts")) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
