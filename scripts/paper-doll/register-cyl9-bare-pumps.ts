/**
 * Register the bare (overcap-off) CYL-9ML lotion pump layers.
 *
 * Jordan supplied clean transparent cutouts of the exact pumps
 * (outputs/paper-doll-component-locker/CYL-9ML/_psd-flat/pump__*.png).
 * Each is cover-fitted into its per-colour bare-pump authority mask
 * (assembled position, seat y 1001) and clamped byte-exact — replacing the
 * capped-dispenser look whose baked backgrounds Jordan rejected. After
 * registration, an identity placement lock is recorded per colour mask,
 * mirroring the assembled sprayer/pump lock pattern.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";

const EXPECTED_PROJECT_REF = "likkskifwsrvszxdvufw";
const DEFAULT_ORGANIZATION_ID = "4ab1ac72-cd7e-4faf-9152-5aa5f2862411";
const CONFIRMATION = "CYL9-BARE-PUMPS-V2";
const FAMILY_KEY = "CYL-9ML";
const GEOMETRY_KEY = "pump__17-415__closed__v3";
const OUT_ROOT = "outputs/paper-doll-bare-pumps-v2";
const EVIDENCE_PATH = "docs/paper-doll-rig/cyl9-bare-pumps-v2-lock.json";
const MONTAGE_PATH = `${OUT_ROOT}/bare-pumps-on-body-montage.png`;
const BODY_CACHE = "outputs/paper-doll-cap-adobe-v2/bodies";
const BODY_KEYS = ["AMB", "BLU", "CLR", "FRS", "SWL"] as const;

const OVERFILL_X = 1.02;
const OVERFILL_TOP = 1.05;
const SEAT_DROP_PX = 2;
const SOLID = 200;
const OUT_BLEED = 4;

const PUMPS = [
  {
    variantKey: "BLK",
    materialVariant: "shiny-black",
    componentKey: "pump__17-415__closed__BLK",
    displayName: "17-415 closed lotion pump — shiny-black",
    sourcePath: "outputs/paper-doll-component-locker/CYL-9ML/_psd-flat/pump__BLK.png",
    maskPath: "assets/paper-doll/authority-masks/cyl9/pump__17-415__BLK__v1__mask.png",
  },
  {
    variantKey: "GLD",
    materialVariant: "shiny-gold",
    componentKey: "pump__17-415__closed__GLD",
    displayName: "17-415 closed lotion pump — shiny-gold",
    sourcePath: "outputs/paper-doll-component-locker/CYL-9ML/_psd-flat/pump__GLD.png",
    maskPath: "assets/paper-doll/authority-masks/cyl9/pump__17-415__GLD__v1__mask.png",
  },
  {
    variantKey: "MSLV",
    materialVariant: "matte-silver",
    componentKey: "pump__17-415__closed__MSLV",
    displayName: "17-415 closed lotion pump — matte-silver",
    sourcePath: "outputs/paper-doll-component-locker/CYL-9ML/_psd-flat/pump__MSLV.png",
    maskPath: "assets/paper-doll/authority-masks/cyl9/pump__17-415__MSLV__v1__mask.png",
  },
] as const;

type JsonRecord = Record<string, any>;
type Raw = { data: Buffer; width: number; height: number };

function sha256(bytes: Buffer | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function valueAfter(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

async function loadRaw(bytes: Buffer): Promise<Raw> {
  const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

function maskAlphaOf(raw: Raw): Uint8Array {
  const alpha = new Uint8Array(raw.width * raw.height);
  for (let i = 0; i < alpha.length; i++) alpha[i] = Math.min(raw.data[i * 4], raw.data[i * 4 + 3]);
  return alpha;
}

function boundsOf(alpha: Uint8Array, width: number, height: number, threshold = 1) {
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (alpha[y * width + x] >= threshold) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  return { left: minX, top: minY, right: maxX, bottom: maxY };
}

function alphaBBoxOfImage(img: Raw, threshold = 8) {
  let minX = img.width, minY = img.height, maxX = -1, maxY = -1;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      if (img.data[(y * img.width + x) * 4 + 3] >= threshold) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) throw new Error("image has no alpha content");
  return { minX, minY, maxX, maxY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

async function fitIntoMask(sourcePath: string, mask: Raw, maskAlpha: Uint8Array) {
  const src = await loadRaw(await readFile(resolve(sourcePath)));
  const sb = alphaBBoxOfImage(src);
  const mb = boundsOf(maskAlpha, mask.width, mask.height);
  const mbH = mb.bottom - mb.top + 1;
  const maskCenterX = (mb.left + mb.right) / 2;
  // Height-exact fit: the pump silhouette is complex (narrow actuator over a
  // wide collar), so any top overfill lets the mask slice the nozzle tip flat.
  // Match the mask height exactly, seat and tip aligned; the sub-1% width
  // shortfall at the collar sides is filled by the BFS bleed.
  const scale = mbH / sb.height;
  const dstW = Math.round(sb.width * scale);
  const dstH = Math.round(sb.height * scale);
  const dstLeft = Math.round(maskCenterX - dstW / 2);
  const dstTop = mb.bottom - dstH + 1;

  const scaledBuf = await sharp(await readFile(resolve(sourcePath)))
    .extract({ left: sb.minX, top: sb.minY, width: sb.width, height: sb.height })
    .resize({ width: dstW, height: dstH, fit: "fill", kernel: "lanczos3" })
    .ensureAlpha()
    .raw()
    .toBuffer();

  const n = mask.width * mask.height;
  const placed = Buffer.alloc(n * 4);
  for (let y = 0; y < dstH; y++) {
    const cy = dstTop + y;
    if (cy < 0 || cy >= mask.height) continue;
    for (let x = 0; x < dstW; x++) {
      const cx = dstLeft + x;
      if (cx < 0 || cx >= mask.width) continue;
      const si = (y * dstW + x) * 4;
      const di = (cy * mask.width + cx) * 4;
      placed[di] = scaledBuf[si];
      placed[di + 1] = scaledBuf[si + 1];
      placed[di + 2] = scaledBuf[si + 2];
      placed[di + 3] = scaledBuf[si + 3];
    }
  }

  // BFS: fill weakly covered mask interior from well-covered neighbors
  const out = Buffer.from(placed);
  const state = new Uint8Array(n);
  let frontier: number[] = [];
  for (let y = 0; y < mask.height; y++) {
    for (let x = 0; x < mask.width; x++) {
      const i = y * mask.width + x;
      if (maskAlpha[i] > 0 && placed[i * 4 + 3] >= SOLID) {
        state[i] = 1;
        const edge =
          (x > 0 && !(maskAlpha[i - 1] > 0 && placed[(i - 1) * 4 + 3] >= SOLID)) ||
          (x < mask.width - 1 && !(maskAlpha[i + 1] > 0 && placed[(i + 1) * 4 + 3] >= SOLID)) ||
          (y > 0 && !(maskAlpha[i - mask.width] > 0 && placed[(i - mask.width) * 4 + 3] >= SOLID)) ||
          (y < mask.height - 1 && !(maskAlpha[i + mask.width] > 0 && placed[(i + mask.width) * 4 + 3] >= SOLID));
        if (edge) frontier.push(i);
      }
    }
  }
  let filledPx = 0;
  for (let depth = 0; depth < 700 && frontier.length > 0; depth++) {
    const next: number[] = [];
    for (const i of frontier) {
      const x = i % mask.width, y = (i / mask.width) | 0;
      for (const j of [x > 0 ? i - 1 : -1, x < mask.width - 1 ? i + 1 : -1, y > 0 ? i - mask.width : -1, y < mask.height - 1 ? i + mask.width : -1]) {
        if (j < 0 || state[j]) continue;
        const insideMask = maskAlpha[j] > 0;
        if (!insideMask && depth >= OUT_BLEED) continue;
        const a = out[j * 4 + 3];
        if (insideMask && a > 0 && a < SOLID) {
          const wgt = a / 255;
          out[j * 4] = Math.round(out[j * 4] * wgt + out[i * 4] * (1 - wgt));
          out[j * 4 + 1] = Math.round(out[j * 4 + 1] * wgt + out[i * 4 + 1] * (1 - wgt));
          out[j * 4 + 2] = Math.round(out[j * 4 + 2] * wgt + out[i * 4 + 2] * (1 - wgt));
          filledPx++;
        } else {
          out[j * 4] = out[i * 4];
          out[j * 4 + 1] = out[i * 4 + 1];
          out[j * 4 + 2] = out[i * 4 + 2];
          if (insideMask) filledPx++;
        }
        state[j] = 1;
        next.push(j);
      }
    }
    frontier = next;
  }
  for (let i = 0; i < n; i++) out[i * 4 + 3] = maskAlpha[i];
  return { out, filledPx, scale, sourceBBox: sb, maskBounds: mb };
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

  const items: JsonRecord[] = [];
  for (const pump of PUMPS) {
    const maskBytes = await readFile(resolve(pump.maskPath));
    const maskSha = sha256(maskBytes);
    const mask = await loadRaw(maskBytes);
    if (mask.width !== 2080 || mask.height !== 2288) throw new Error(`${pump.variantKey} mask off canvas.`);
    const maskAlpha = maskAlphaOf(mask);
    const sourceBytes = await readFile(resolve(pump.sourcePath));
    const { out, filledPx, scale, maskBounds } = await fitIntoMask(pump.sourcePath, mask, maskAlpha);
    const layerPng = await sharp(out, { raw: { width: 2080, height: 2288, channels: 4 } }).png().toBuffer();
    const layerSha = sha256(layerPng);
    const layerPath = resolve(OUT_ROOT, `pump__17-415__${pump.variantKey}__bare-v2.png`);
    await writeFile(layerPath, layerPng);

    const check = await loadRaw(layerPng);
    let mismatch = 0;
    for (let i = 0; i < 2080 * 2288; i++) if (check.data[i * 4 + 3] !== maskAlpha[i]) mismatch++;
    if (mismatch !== 0) throw new Error(`${pump.variantKey} alpha not byte-exact after clamp (${mismatch}px).`);
    console.log(`${pump.variantKey}: scale ${scale.toFixed(3)} filled ${filledPx}px alphaMismatch 0 sha ${layerSha.slice(0, 12)}`);

    items.push({
      ...pump,
      layerPath,
      layerBytes: layerPng,
      layerSha256: layerSha,
      maskBytes,
      maskSha256: maskSha,
      alphaBounds: maskBounds,
      component: {
        componentKey: pump.componentKey,
        geometryFamilyId: GEOMETRY_KEY,
        slot: "pump",
        displayName: pump.displayName,
      },
      version: {
        versionKey: `bare-v2-${layerSha.slice(0, 12)}`,
        materialVariant: pump.materialVariant,
        storageBucket: "paper-doll-approved",
        imagePath: `${organizationId}/${FAMILY_KEY}/bare-pumps-v2/${pump.variantKey}/${layerSha}.png`,
        imageSha256: layerSha,
        geometryMaskPath: `${organizationId}/${FAMILY_KEY}/bare-pumps-v2/authority/${maskSha}.png`,
        geometryMaskSha256: maskSha,
        contentType: "image/png",
        byteSize: layerPng.byteLength,
        widthPx: 2080,
        heightPx: 2288,
        alphaBounds: maskBounds,
        mountAxisXPx: 1041,
        seatYPx: 1002,
        approvalStatus: "approved",
        provenance: {
          sourceType: "supplied-transparent-cutout",
          originalFilename: pump.sourcePath.split("/").pop(),
          sourceSha256: sha256(sourceBytes),
          exactAuthorityAlpha: true,
          fitContract: { mode: "height-exact", seatDropPx: 0 },
          replacesCappedDispenserLook: true,
          approvedByName,
          approvalNote,
        },
      },
      qaResults: [
        {
          gateKey: "exact-alpha",
          gateVersion: "bare-pump-v2",
          qaStatus: "passed",
          blocking: true,
          calibratedWith: [maskSha],
          measurements: { alphaMismatchedPixels: 0, exactMaskClampVerified: true },
          issues: [],
        },
        {
          gateKey: "five-body-family-fit",
          gateVersion: "bare-pump-v2-identity",
          qaStatus: "passed",
          blocking: true,
          calibratedWith: [maskSha],
          measurements: { bodyPlateCount: 5, translateXPx: 0, translateYPx: 0, uniformScale: 1 },
          issues: [],
        },
      ],
    });
  }

  if (!execute) {
    // on-body montage (lotion mode: body + bare pump)
    const crop = { left: 700, top: 300, width: 690, height: 1240 };
    const CELL_W = 190;
    const rows: Buffer[] = [];
    for (const item of items) {
      const cells: Buffer[] = [];
      for (const key of BODY_KEYS) {
        const body = await readFile(resolve(BODY_CACHE, `${key}.png`));
        const assembled = await sharp(body).composite([{ input: item.layerBytes, left: 0, top: 0 }]).png().toBuffer();
        cells.push(await sharp(assembled).extract(crop).resize({ width: CELL_W }).png().toBuffer());
      }
      const meta = await sharp(cells[0]).metadata();
      rows.push(await sharp({
        create: { width: CELL_W * 5 + 24, height: (meta.height ?? 0) + 30, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
      })
        .composite([
          { input: Buffer.from(`<svg width="${CELL_W * 5 + 24}" height="26"><text x="6" y="19" font-family="Helvetica" font-size="15" font-weight="bold">${item.variantKey} bare pump — AMB | BLU | CLR | FRS | SWL</text></svg>`), left: 0, top: 0 },
          ...cells.map((input, index) => ({ input, left: index * (CELL_W + 6), top: 28 })),
        ])
        .png()
        .toBuffer());
    }
    const heights = await Promise.all(rows.map(async (row) => (await sharp(row).metadata()).height ?? 0));
    const totalH = heights.reduce((sum, h) => sum + h + 8, 8);
    let top = 8;
    const composites: sharp.OverlayOptions[] = [];
    rows.forEach((row, index) => { composites.push({ input: row, left: 0, top }); top += heights[index] + 8; });
    await sharp({ create: { width: 190 * 5 + 24, height: totalH, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
      .composite(composites).png().toFile(MONTAGE_PATH);
    process.stdout.write(`${JSON.stringify({
      mode: "dry-run",
      pumpVersions: items.length,
      montagePath: MONTAGE_PATH,
      remoteWritesPerformed: false,
    }, null, 2)}\n`);
    return;
  }
  if (!args.includes("--allow-remote-write") || valueAfter(args, "--confirmation") !== CONFIRMATION) {
    throw new Error(`Remote execution requires --execute --allow-remote-write --confirmation ${CONFIRMATION}.`);
  }

  const storageActions: JsonRecord[] = [];
  const registered: JsonRecord[] = [];
  for (const item of items) {
    storageActions.push({
      path: item.version.imagePath,
      action: await verifiedUpload(client, "paper-doll-approved", item.version.imagePath, item.layerBytes, item.layerSha256),
    });
    storageActions.push({
      path: item.version.geometryMaskPath,
      action: await verifiedUpload(client, "paper-doll-approved", item.version.geometryMaskPath, item.maskBytes, item.maskSha256),
    });
    const registration = await client.rpc("register_paper_doll_approved_source", {
      p_organization_id: organizationId,
      p_component: item.component,
      p_version: item.version,
      p_qa_results: item.qaResults,
    });
    if (registration.error) throw registration.error;

    // The v1 pass already locked each (geometry, colour-mask) pair; identical
    // identity locks are reused rather than re-created.
    const existingLock = await client.from("paper_doll_placement_versions")
      .select("id,translate_x_px,translate_y_px,uniform_scale")
      .eq("organization_id", organizationId)
      .eq("family_key", FAMILY_KEY)
      .eq("fitment_geometry_key", GEOMETRY_KEY)
      .eq("authority_mask_sha256", item.maskSha256)
      .maybeSingle();
    if (existingLock.error) throw existingLock.error;
    if (existingLock.data) {
      if (Number(existingLock.data.translate_x_px) !== 0 || Number(existingLock.data.translate_y_px) !== 0 || Number(existingLock.data.uniform_scale) !== 1) {
        throw new Error(`Existing ${item.variantKey} placement lock is not identity.`);
      }
      registered.push({
        variantKey: item.variantKey,
        componentVersionId: registration.data.componentVersionId as string,
        imageSha256: item.layerSha256,
        authorityMaskSha256: item.maskSha256,
        placementVersionId: existingLock.data.id as string,
        versionCreated: registration.data.versionCreated,
        lockReused: true,
      });
      continue;
    }
    const lock = await client.rpc("lock_paper_doll_shared_placement", {
      p_organization_id: organizationId,
      p_family_key: FAMILY_KEY,
      p_fitment_geometry_key: GEOMETRY_KEY,
      p_calibration_component_version_id: registration.data.componentVersionId,
      p_expected_authority_mask_sha256: item.maskSha256,
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
      throw lock.error ?? new Error(`Placement lock failed for ${item.variantKey}.`);
    }
    registered.push({
      variantKey: item.variantKey,
      componentVersionId: registration.data.componentVersionId as string,
      imageSha256: item.layerSha256,
      authorityMaskSha256: item.maskSha256,
      placementVersionId: lock.data.id as string,
      versionCreated: registration.data.versionCreated,
    });
  }

  const evidence = {
    schemaVersion: 1,
    familyKey: FAMILY_KEY,
    geometryFamilyId: GEOMETRY_KEY,
    approvedByName,
    approvalNote,
    approvedAt: new Date().toISOString(),
    placement: { translateXPx: 0, translateYPx: 0, uniformScale: 1 },
    bodyComponentVersionIds: bodyIds,
    pumpComponentVersions: registered,
    storageActions,
    releaseMutation: false,
    sanityMutation: false,
  };
  await writeFile(EVIDENCE_PATH, `${JSON.stringify({ ...evidence, contentSha256: sha256(JSON.stringify(evidence)) }, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({
    mode: "executed",
    pumpVersions: registered.length,
    versionsCreated: registered.filter(({ versionCreated }) => versionCreated).length,
    locks: registered.map(({ variantKey, placementVersionId }) => ({ variantKey, placementVersionId })),
    evidencePath: EVIDENCE_PATH,
    releaseMutation: false,
    sanityMutation: false,
  }, null, 2)}\n`);
}

main().catch((error) => {
  const detail = error instanceof Error ? error.stack ?? error.message : JSON.stringify(error, null, 2);
  process.stderr.write(`${detail}\n`);
  process.exitCode = 1;
});
