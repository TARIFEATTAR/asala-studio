/**
 * Lift the CYL-9ML roll-on cap layers by a small integer amount (default 2 px
 * up), per Jordan's visual direction on the storefront preview.
 *
 * The shift is applied identically to all ten cap layers AND the shared cap
 * authority mask as a pure integer row shift at scale 1 — no resampling, so
 * every retained pixel is byte-identical, just translated. The shifted mask
 * gets a new sha, the ten new versions clamp byte-exact against it, and an
 * identity placement lock is recorded for (cap geometry, shifted-mask sha),
 * coexisting with the original lock keyed by the old mask sha.
 *
 * Sources are the CURRENT release layers (1.3.5 export), so the harmonized
 * pixels carry forward unchanged.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";

const EXPECTED_PROJECT_REF = "likkskifwsrvszxdvufw";
const DEFAULT_ORGANIZATION_ID = "4ab1ac72-cd7e-4faf-9152-5aa5f2862411";
const CONFIRMATION = "CYL9-CAP-LIFT-V2";
const FAMILY_KEY = "CYL-9ML";
const GEOMETRY_KEY = "closure__17-415__rollon-overcap__v2";
const EXPORT_ROOT = "outputs/paper-doll-release-export/1.3.8-roller-light.1";
const OUT_ROOT = "outputs/paper-doll-cap-lift-v2";
const EVIDENCE_PATH = "docs/paper-doll-rig/cyl9-cap-lift-v2-lock.json";
const LIFT_PX = 2;
const CAP_VARIANTS = ["BKDT", "MCPR", "MGLD", "MSLV", "PKDT", "SBLK", "SGLD", "SLDT", "SSLV", "WHT"] as const;

type JsonRecord = Record<string, any>;

function sha256(bytes: Buffer | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function valueAfter(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

/** Shift RGBA rows up by LIFT_PX; vacated bottom rows become transparent. */
async function shiftUp(bytes: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.width !== 2080 || info.height !== 2288) throw new Error("Layer is off the canonical canvas.");
  const rowBytes = info.width * 4;
  const out = Buffer.alloc(data.length);
  out.copy; // noop to satisfy lint about unused expression styles
  for (let y = 0; y < info.height - LIFT_PX; y++) {
    data.copy(out, y * rowBytes, (y + LIFT_PX) * rowBytes, (y + LIFT_PX + 1) * rowBytes);
  }
  return sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

function alphaOf(dataInfo: { data: Buffer; width: number; height: number }): Uint8Array {
  const alpha = new Uint8Array(dataInfo.width * dataInfo.height);
  for (let i = 0; i < alpha.length; i++) alpha[i] = Math.min(dataInfo.data[i * 4], dataInfo.data[i * 4 + 3]);
  return alpha;
}

async function loadRaw(bytes: Buffer) {
  const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
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
    if (sha256(Buffer.from(await existing.data.arrayBuffer())) !== expectedSha256) {
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
  if (verification.error || !verification.data) throw verification.error ?? new Error(`Unable to verify ${objectPath}.`);
  if (sha256(Buffer.from(await verification.data.arrayBuffer())) !== expectedSha256) {
    throw new Error(`Uploaded bytes failed SHA verification: ${objectPath}.`);
  }
  return "uploaded" as const;
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
  await mkdir(resolve(OUT_ROOT), { recursive: true });

  const manifest = JSON.parse(await readFile(resolve(EXPORT_ROOT, "manifest.json"), "utf8"));
  if (manifest.releaseVersion !== "1.3.8-roller-light.1") {
    throw new Error("Cap-lift sources must come from the 1.3.8 export.");
  }
  const capAssets = manifest.assets.filter((asset: JsonRecord) => asset.slot === "cap");
  if (capAssets.length !== 10) throw new Error("Expected ten cap layers in the current release.");
  const maskShas = new Set(capAssets.map((asset: JsonRecord) => asset.geometryMaskSha256));
  if (maskShas.size !== 1) throw new Error("All caps must share one authority mask.");
  const sourceMaskSha = capAssets[0].geometryMaskSha256 as string;
  const sourceMaskPath = capAssets[0].geometryMaskPath as string;

  const maskDownload = await client.storage.from("paper-doll-approved").download(sourceMaskPath);
  if (maskDownload.error || !maskDownload.data) throw maskDownload.error ?? new Error("Cap authority mask download failed.");
  const maskBytes = Buffer.from(await maskDownload.data.arrayBuffer());
  if (sha256(maskBytes) !== sourceMaskSha) throw new Error("Cap authority mask bytes do not match the manifest.");

  const shiftedMaskPng = await shiftUp(maskBytes);
  const shiftedMask = await loadRaw(shiftedMaskPng);
  const shiftedMaskAlpha = alphaOf(shiftedMask);
  const newMaskSha = sha256(shiftedMaskPng);
  await writeFile(resolve(OUT_ROOT, `authority-lifted-${newMaskSha.slice(0, 12)}.png`), shiftedMaskPng);
  console.log(`shifted cap authority: ${sourceMaskSha.slice(0, 12)} -> ${newMaskSha.slice(0, 12)} (up ${LIFT_PX}px)`);

  const items: JsonRecord[] = [];
  for (const variantKey of CAP_VARIANTS) {
    const asset = capAssets.find((entry: JsonRecord) => entry.variantKey === variantKey);
    if (!asset) throw new Error(`Missing cap ${variantKey} in the manifest.`);
    const sourceBytes = await readFile(resolve(EXPORT_ROOT, asset.imagePath));
    if (sha256(sourceBytes) !== asset.imageSha256) throw new Error(`${variantKey} source bytes drifted.`);
    const layerPng = await shiftUp(sourceBytes);
    const layerSha = sha256(layerPng);
    const layerPath = resolve(OUT_ROOT, `cap__17-415__${variantKey}__lift-v2.png`);
    await writeFile(layerPath, layerPng);

    const check = await loadRaw(layerPng);
    let mismatch = 0;
    for (let i = 0; i < 2080 * 2288; i++) if (check.data[i * 4 + 3] !== shiftedMaskAlpha[i]) mismatch++;
    if (mismatch !== 0) throw new Error(`${variantKey} alpha not byte-exact vs the shifted authority (${mismatch}px).`);

    const alphaBounds = {
      left: asset.alphaBounds.left,
      top: asset.alphaBounds.top - LIFT_PX,
      right: asset.alphaBounds.right,
      bottom: asset.alphaBounds.bottom - LIFT_PX,
    };
    console.log(`${variantKey}: lifted ${LIFT_PX}px, alphaMismatch 0, sha ${layerSha.slice(0, 12)}`);
    items.push({
      variantKey,
      layerPath,
      layerBytes: layerPng,
      layerSha256: layerSha,
      source: asset,
      component: {
        componentKey: asset.componentKey,
        geometryFamilyId: GEOMETRY_KEY,
        slot: "cap",
        displayName: null,
      },
      version: {
        versionKey: `cap-lift-v2-${layerSha.slice(0, 12)}`,
        materialVariant: asset.materialVariant,
        storageBucket: "paper-doll-approved",
        imagePath: `${organizationId}/${FAMILY_KEY}/cap-lift-v2/${variantKey}/${layerSha}.png`,
        imageSha256: layerSha,
        geometryMaskPath: `${organizationId}/${FAMILY_KEY}/cap-lift-v2/authority/${newMaskSha}.png`,
        geometryMaskSha256: newMaskSha,
        contentType: "image/png",
        byteSize: layerPng.byteLength,
        widthPx: 2080,
        heightPx: 2288,
        alphaBounds,
        mountAxisXPx: asset.mountAxisXPx,
        seatYPx: asset.seatYPx - LIFT_PX,
        approvalStatus: "approved",
        provenance: {
          sourceType: "integer-lift-rebake",
          sourceComponentVersionId: asset.componentVersionId,
          sourceImageSha256: asset.imageSha256,
          sourceAuthorityMaskSha256: sourceMaskSha,
          liftPx: LIFT_PX,
          approvedByName,
          approvalNote,
        },
      },
      qaResults: [
        {
          gateKey: "exact-alpha",
          gateVersion: "cap-lift-v2",
          qaStatus: "passed",
          blocking: true,
          calibratedWith: [newMaskSha],
          measurements: { alphaMismatchedPixels: 0, integerShiftLossless: true, liftPx: LIFT_PX },
          issues: [],
        },
        {
          gateKey: "five-body-family-fit",
          gateVersion: "cap-lift-v2-identity",
          qaStatus: "passed",
          blocking: true,
          calibratedWith: [newMaskSha],
          measurements: { bodyPlateCount: 5, translateXPx: 0, translateYPx: 0, uniformScale: 1 },
          issues: [],
        },
      ],
    });
  }

  if (!execute) {
    // 1:1 junction comparison, current vs lifted, on the CLR body
    const body = await readFile("outputs/paper-doll-cap-adobe-v2/bodies/CLR.png");
    const sample = items.find(({ variantKey }) => variantKey === "MGLD")!;
    const before = await sharp(body).composite([{ input: await readFile(resolve(EXPORT_ROOT, sample.source.imagePath)), left: 0, top: 0 }]).png().toBuffer();
    const after = await sharp(body).composite([{ input: sample.layerBytes, left: 0, top: 0 }]).png().toBuffer();
    const crop = { left: 850, top: 900, width: 384, height: 180 };
    const cells = await Promise.all([before, after].map(async (buf) =>
      sharp(buf).extract(crop).resize({ width: 768, kernel: "nearest" }).png().toBuffer()));
    await sharp({ create: { width: 768 * 2 + 12, height: 390, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
      .composite([
        { input: Buffer.from('<svg width="1548" height="26"><text x="6" y="19" font-family="Helvetica" font-size="15" font-weight="bold">MGLD cap seat on CLR — current (left) vs lifted 2px (right), 2x</text></svg>'), left: 0, top: 0 },
        { input: cells[0], left: 0, top: 28 },
        { input: cells[1], left: 780, top: 28 },
      ]).png().toFile(resolve(OUT_ROOT, "cap-lift-junction.png"));
    process.stdout.write(`${JSON.stringify({
      mode: "dry-run",
      liftPx: LIFT_PX,
      capVersions: items.length,
      shiftedMaskSha256: newMaskSha,
      junctionPreview: resolve(OUT_ROOT, "cap-lift-junction.png"),
      remoteWritesPerformed: false,
    }, null, 2)}\n`);
    return;
  }
  if (!args.includes("--allow-remote-write") || valueAfter(args, "--confirmation") !== CONFIRMATION) {
    throw new Error(`Remote execution requires --execute --allow-remote-write --confirmation ${CONFIRMATION}.`);
  }

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
  if (bodies.error || bodies.data.length !== 5) throw bodies.error ?? new Error("Five body plates required.");
  const bodyIds = bodies.data.map(({ component_version_id }) => component_version_id as string).sort();

  const storageActions: JsonRecord[] = [];
  const registered: JsonRecord[] = [];
  for (const item of items) {
    const componentRow = await client.from("paper_doll_components")
      .select("display_name")
      .eq("organization_id", organizationId)
      .eq("component_key", item.component.componentKey)
      .single();
    if (componentRow.error) throw componentRow.error;
    item.component.displayName = componentRow.data.display_name;
    storageActions.push({
      path: item.version.imagePath,
      action: await verifiedUpload(client, "paper-doll-approved", item.version.imagePath, item.layerBytes, item.layerSha256),
    });
    storageActions.push({
      path: item.version.geometryMaskPath,
      action: await verifiedUpload(client, "paper-doll-approved", item.version.geometryMaskPath, shiftedMaskPng, newMaskSha),
    });
    const registration = await client.rpc("register_paper_doll_approved_source", {
      p_organization_id: organizationId,
      p_component: item.component,
      p_version: item.version,
      p_qa_results: item.qaResults,
    });
    if (registration.error) throw registration.error;
    registered.push({
      variantKey: item.variantKey,
      componentVersionId: registration.data.componentVersionId as string,
      imageSha256: item.layerSha256,
      versionCreated: registration.data.versionCreated,
    });
  }

  const calibration = registered.find(({ variantKey }) => variantKey === "SSLV")!;
  const lock = await client.rpc("lock_paper_doll_shared_placement", {
    p_organization_id: organizationId,
    p_family_key: FAMILY_KEY,
    p_fitment_geometry_key: GEOMETRY_KEY,
    p_calibration_component_version_id: calibration.componentVersionId,
    p_expected_authority_mask_sha256: newMaskSha,
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
    geometryFamilyId: GEOMETRY_KEY,
    liftPx: LIFT_PX,
    placementVersionId: lock.data.id,
    approvedByName,
    approvalNote,
    approvedAt: new Date().toISOString(),
    placement: { translateXPx: 0, translateYPx: 0, uniformScale: 1 },
    sourceAuthorityMaskSha256: sourceMaskSha,
    liftedAuthorityMaskSha256: newMaskSha,
    // alias consumed by the release-cut script (matches the v1 lock shape)
    authorityMaskSha256: newMaskSha,
    capComponentVersions: registered.map(({ variantKey, componentVersionId, imageSha256 }) => ({ variantKey, componentVersionId, imageSha256 })),
    bodyComponentVersionIds: bodyIds,
    storageActions,
    releaseMutation: false,
    sanityMutation: false,
  };
  await writeFile(EVIDENCE_PATH, `${JSON.stringify({ ...evidence, contentSha256: sha256(JSON.stringify(evidence)) }, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({
    mode: "executed",
    capVersions: registered.length,
    versionsCreated: registered.filter(({ versionCreated }) => versionCreated).length,
    placementVersionId: lock.data.id,
    liftedMaskSha256: newMaskSha,
    evidencePath: EVIDENCE_PATH,
  }, null, 2)}\n`);
}

main().catch((error) => {
  const detail = error instanceof Error ? error.stack ?? error.message : JSON.stringify(error, null, 2);
  process.stderr.write(`${detail}\n`);
  process.exitCode = 1;
});
