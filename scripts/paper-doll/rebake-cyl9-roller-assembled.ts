/**
 * Rebake the CYL-9ML roller-ball fitment layers to the ASSEMBLED canvas
 * position and register them as approved component versions.
 *
 * Root cause: caps and sprayers/pumps ship baked at their assembled position
 * (seat on the neck), but the two roller versions were registered at source
 * position (alpha bottom y=918). The approved shared placement lock
 * fbe551b9… (x 27.066, y -134.132, scale 0.974 — derived from
 * CYL9_ROLLER_CONTACT, seating the fitment bottom at neck contact y=760) was
 * only ever applied at render time by the Madison bench; the storefront canvas
 * stacks layers verbatim, so the roller rendered 158 px too low.
 *
 * This script applies that exact locked transform to both roller layers AND
 * the shared roller authority mask, stamps the transformed mask alpha
 * byte-exact onto each layer, and registers the results as `assembled-v2`
 * versions of the same component. Dry-run renders an on-body montage first.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";

const EXPECTED_PROJECT_REF = "likkskifwsrvszxdvufw";
const DEFAULT_ORGANIZATION_ID = "4ab1ac72-cd7e-4faf-9152-5aa5f2862411";
const CONFIRMATION = "CYL9-ROLLER-ASSEMBLED-V2";
const FAMILY_KEY = "CYL-9ML";
const OUT_ROOT = "outputs/paper-doll-roller-assembled-v2";
const EVIDENCE_PATH = "docs/paper-doll-rig/cyl9-roller-assembled-v2-lock.json";
const MONTAGE_PATH = `${OUT_ROOT}/roller-assembled-on-body-montage.png`;

const PLACEMENT_VERSION_ID = "fbe551b9-19ca-4202-842c-06634fdae2da";
const TRANSFORM = { translateXPx: 27.066, translateYPx: -134.132, uniformScale: 0.974 } as const;
const SOURCE_MASK_SHA = "b815bcd76f39e5a54e7ff68a660c826755dd670dc7464a7d38f87103f87e70c6";
const SOURCE_MASK_STORAGE_PATH = `${DEFAULT_ORGANIZATION_ID}/CYL-9ML/roller-pair-v03-shared-authority-mask/${SOURCE_MASK_SHA}.png`;
const EXPECTED_CONTACT_Y = 760;
const MOUNT_AXIS_X = 1041;

const COMPONENT = {
  componentKey: "closure__17-415__plastic-roller-ball__natural",
  geometryFamilyId: "fitment__roller-ball__17-415__v1",
  slot: "roller",
  displayName: "17-415 natural plastic roller-ball fitment",
} as const;

const ROLLERS = [
  {
    variantKey: "METAL",
    materialVariant: "METAL",
    sourceVersionId: "e7a6636a-b2db-4bfe-bbb9-fde0458fe407",
    sourceSha256: "b6f4fae2fa74f8a4ae22f402ef9fc18abdf370fbdb7a1eb2569fb47a4145fcee",
    sourcePath: "outputs/paper-doll-release-export/1.3.1-clean-caps.1/4ab1ac72-cd7e-4faf-9152-5aa5f2862411/CYL-9ML/approved-94f1f8f6-9f49-4844-bd22-2196e0071941/b6f4fae2fa74f8a4ae22f402ef9fc18abdf370fbdb7a1eb2569fb47a4145fcee.png",
  },
  {
    variantKey: "PLASTIC",
    materialVariant: "PLASTIC",
    sourceVersionId: "02161d6f-fb7c-4b44-ba98-a61500181529",
    sourceSha256: "77c67191a8efa1808031c386b432244df6b78b91bdc4cdccc5a4658711f4edd5",
    sourcePath: "outputs/paper-doll-release-export/1.3.1-clean-caps.1/4ab1ac72-cd7e-4faf-9152-5aa5f2862411/CYL-9ML/approved-0faa90d9-8c67-4c02-9778-95fde66f994d/77c67191a8efa1808031c386b432244df6b78b91bdc4cdccc5a4658711f4edd5.png",
  },
] as const;

const BODY_CACHE = "outputs/paper-doll-cap-adobe-v2/bodies";
const BODY_KEYS = ["AMB", "BLU", "CLR", "FRS", "SWL"] as const;
const SOLID = 200;
const OUT_BLEED = 4;

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

/** dest = src × scale + translate, onto a blank 2080×2288 canvas. */
async function applyLockedTransform(bytes: Buffer): Promise<Buffer> {
  const scaledW = Math.round(2080 * TRANSFORM.uniformScale);
  const scaledH = Math.round(2288 * TRANSFORM.uniformScale);
  const left = Math.round(TRANSFORM.translateXPx);
  const top = Math.round(TRANSFORM.translateYPx);
  const scaled = await sharp(bytes)
    .resize({ width: scaledW, height: scaledH, fit: "fill", kernel: "lanczos3" })
    .ensureAlpha()
    .png()
    .toBuffer();
  // negative top: crop the overflow off the scaled image before placing at 0
  const cropTop = top < 0 ? -top : 0;
  const placeTop = top < 0 ? 0 : top;
  const cropped = cropTop > 0
    ? await sharp(scaled).extract({ left: 0, top: cropTop, width: scaledW, height: scaledH - cropTop }).png().toBuffer()
    : scaled;
  return sharp({ create: { width: 2080, height: 2288, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: cropped, left, top: placeTop }])
    .png()
    .toBuffer();
}

function maskAlphaOf(raw: Raw): Uint8Array {
  const alpha = new Uint8Array(raw.width * raw.height);
  for (let i = 0; i < alpha.length; i++) alpha[i] = Math.min(raw.data[i * 4], raw.data[i * 4 + 3]);
  return alpha;
}

function alphaBounds(alpha: Uint8Array, width: number, height: number, threshold = 1) {
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

/** Stamp mask alpha byte-exact; fill weakly covered interior RGB from neighbors. */
function clampToMask(layer: Raw, maskAlpha: Uint8Array): { out: Buffer; filledPx: number } {
  const { width: w, height: h } = layer;
  const n = w * h;
  const out = Buffer.from(layer.data);
  const state = new Uint8Array(n);
  let frontier: number[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (maskAlpha[i] > 0 && out[i * 4 + 3] >= SOLID) {
        state[i] = 1;
        const edge =
          (x > 0 && !(maskAlpha[i - 1] > 0 && out[(i - 1) * 4 + 3] >= SOLID)) ||
          (x < w - 1 && !(maskAlpha[i + 1] > 0 && out[(i + 1) * 4 + 3] >= SOLID)) ||
          (y > 0 && !(maskAlpha[i - w] > 0 && out[(i - w) * 4 + 3] >= SOLID)) ||
          (y < h - 1 && !(maskAlpha[i + w] > 0 && out[(i + w) * 4 + 3] >= SOLID));
        if (edge) frontier.push(i);
      }
    }
  }
  let filledPx = 0;
  for (let depth = 0; depth < 600 && frontier.length > 0; depth++) {
    const next: number[] = [];
    for (const i of frontier) {
      const x = i % w, y = (i / w) | 0;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) {
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
  return { out, filledPx };
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

async function renderMontage(items: Array<{ variantKey: string; layerPath: string }>) {
  const crop = { left: 700, top: 430, width: 690, height: 1100 };
  const CELL_W = 190;
  const rows: Buffer[] = [];
  for (const item of items) {
    const rollerLayer = await readFile(item.layerPath);
    const cells: Buffer[] = [];
    for (const key of BODY_KEYS) {
      const body = await readFile(resolve(BODY_CACHE, `${key}.png`));
      const assembled = await sharp(body).composite([{ input: rollerLayer, left: 0, top: 0 }]).png().toBuffer();
      cells.push(await sharp(assembled).extract(crop).resize({ width: CELL_W }).png().toBuffer());
    }
    const meta = await sharp(cells[0]).metadata();
    const row = await sharp({
      create: { width: CELL_W * 5 + 24, height: (meta.height ?? 0) + 30, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
    })
      .composite([
        { input: Buffer.from(`<svg width="${CELL_W * 5 + 24}" height="26"><text x="6" y="19" font-family="Helvetica" font-size="15" font-weight="bold">${item.variantKey} roller, assembled — AMB | BLU | CLR | FRS | SWL</text></svg>`), left: 0, top: 0 },
        ...cells.map((input, index) => ({ input, left: index * (CELL_W + 6), top: 28 })),
      ])
      .png()
      .toBuffer();
    rows.push(row);
  }
  const heights = await Promise.all(rows.map(async (row) => (await sharp(row).metadata()).height ?? 0));
  const totalH = heights.reduce((sum, h) => sum + h + 8, 8);
  let top = 8;
  const composites: sharp.OverlayOptions[] = [];
  rows.forEach((row, index) => { composites.push({ input: row, left: 0, top }); top += heights[index] + 8; });
  await sharp({ create: { width: 190 * 5 + 24, height: totalH, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
    .composite(composites).png().toFile(MONTAGE_PATH);
  return MONTAGE_PATH;
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
  if (!supabaseUrl || !serviceRoleKey) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  if (new URL(supabaseUrl).hostname.split(".")[0] !== EXPECTED_PROJECT_REF) {
    throw new Error("Refusing to access an unexpected Supabase project.");
  }
  const client = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  await mkdir(resolve(OUT_ROOT), { recursive: true });

  // The locked placement must still match the constants baked into this script.
  const lock = await client.from("paper_doll_placement_versions")
    .select("id,authority_mask_sha256,translate_x_px,translate_y_px,uniform_scale")
    .eq("organization_id", organizationId)
    .eq("id", PLACEMENT_VERSION_ID)
    .single();
  if (lock.error) throw lock.error;
  if (
    lock.data.authority_mask_sha256 !== SOURCE_MASK_SHA
    || Number(lock.data.translate_x_px) !== TRANSFORM.translateXPx
    || Number(lock.data.translate_y_px) !== TRANSFORM.translateYPx
    || Number(lock.data.uniform_scale) !== TRANSFORM.uniformScale
  ) {
    throw new Error("The approved roller placement lock differs from this script's constants.");
  }

  // Fetch + verify the released roller authority mask.
  const maskCachePath = resolve(OUT_ROOT, `source-mask-${SOURCE_MASK_SHA.slice(0, 12)}.png`);
  let maskBytes: Buffer;
  if (existsSync(maskCachePath)) {
    maskBytes = await readFile(maskCachePath);
  } else {
    const download = await client.storage.from("paper-doll-approved").download(SOURCE_MASK_STORAGE_PATH);
    if (download.error || !download.data) throw download.error ?? new Error("Roller authority mask download failed.");
    maskBytes = Buffer.from(await download.data.arrayBuffer());
    await writeFile(maskCachePath, maskBytes);
  }
  if (sha256(maskBytes) !== SOURCE_MASK_SHA) throw new Error("Roller authority mask bytes do not match the lock.");

  // Transform the mask once; it becomes the assembled-position authority.
  const transformedMaskBytes = await applyLockedTransform(maskBytes);
  const transformedMask = await loadRaw(transformedMaskBytes);
  const newMaskAlpha = maskAlphaOf(transformedMask);
  // Re-encode the mask as pure alpha (white on transparent) for determinism.
  const maskCanonical = Buffer.alloc(transformedMask.width * transformedMask.height * 4);
  for (let i = 0; i < newMaskAlpha.length; i++) {
    maskCanonical[i * 4] = 255;
    maskCanonical[i * 4 + 1] = 255;
    maskCanonical[i * 4 + 2] = 255;
    maskCanonical[i * 4 + 3] = newMaskAlpha[i];
  }
  const newMaskPng = await sharp(maskCanonical, { raw: { width: 2080, height: 2288, channels: 4 } }).png().toBuffer();
  const newMaskSha = sha256(newMaskPng);
  const newBounds = alphaBounds(newMaskAlpha, 2080, 2288);
  // The mask carries a few soft antialiased fringe rows below the physical
  // seat; the locked contact target applies to the solid silhouette.
  const solidBounds = alphaBounds(newMaskAlpha, 2080, 2288, 128);
  const centerX = (newBounds.left + newBounds.right) / 2;
  if (Math.abs(solidBounds.bottom - EXPECTED_CONTACT_Y) > 1 || Math.abs(centerX - MOUNT_AXIS_X) > 1.5) {
    throw new Error(`Transformed roller authority off target: solid bottom ${solidBounds.bottom} (want ${EXPECTED_CONTACT_Y}), centerX ${centerX} (want ${MOUNT_AXIS_X}).`);
  }
  const newMaskPath = resolve(OUT_ROOT, `authority-assembled-${newMaskSha.slice(0, 12)}.png`);
  await writeFile(newMaskPath, newMaskPng);
  console.log(`assembled authority: bounds l${newBounds.left} t${newBounds.top} r${newBounds.right} b${newBounds.bottom} (solid contact ${solidBounds.bottom}) centerX ${centerX} sha ${newMaskSha.slice(0, 12)}`);

  const items: JsonRecord[] = [];
  for (const roller of ROLLERS) {
    const sourceBytes = await readFile(resolve(roller.sourcePath));
    if (sha256(sourceBytes) !== roller.sourceSha256) throw new Error(`${roller.variantKey} source bytes changed.`);
    const transformed = await loadRaw(await applyLockedTransform(sourceBytes));
    const { out, filledPx } = clampToMask(transformed, newMaskAlpha);
    const layerPng = await sharp(out, { raw: { width: 2080, height: 2288, channels: 4 } }).png().toBuffer();
    const layerSha = sha256(layerPng);
    const layerPath = resolve(OUT_ROOT, `roller__17-415__${roller.variantKey}__assembled-v2.png`);
    await writeFile(layerPath, layerPng);

    const check = await loadRaw(layerPng);
    let mismatch = 0;
    for (let i = 0; i < 2080 * 2288; i++) if (check.data[i * 4 + 3] !== newMaskAlpha[i]) mismatch++;
    if (mismatch !== 0) throw new Error(`${roller.variantKey} alpha not byte-exact after clamp (${mismatch}px).`);
    console.log(`${roller.variantKey}: filled ${filledPx}px, alphaMismatch 0, sha ${layerSha.slice(0, 12)}`);

    items.push({
      ...roller,
      layerPath,
      layerBytes: layerPng,
      layerSha256: layerSha,
      version: {
        versionKey: `assembled-v2-${layerSha.slice(0, 12)}`,
        materialVariant: roller.materialVariant,
        storageBucket: "paper-doll-approved",
        imagePath: `${organizationId}/${FAMILY_KEY}/roller-assembled-v2/${roller.variantKey}/${layerSha}.png`,
        imageSha256: layerSha,
        geometryMaskPath: `${organizationId}/${FAMILY_KEY}/roller-assembled-v2/authority/${newMaskSha}.png`,
        geometryMaskSha256: newMaskSha,
        contentType: "image/png",
        byteSize: layerPng.byteLength,
        widthPx: 2080,
        heightPx: 2288,
        alphaBounds: newBounds,
        mountAxisXPx: MOUNT_AXIS_X,
        seatYPx: EXPECTED_CONTACT_Y,
        approvalStatus: "approved",
        provenance: {
          sourceType: "assembled-rebake",
          sourceComponentVersionId: roller.sourceVersionId,
          sourceImageSha256: roller.sourceSha256,
          appliedPlacementVersionId: PLACEMENT_VERSION_ID,
          appliedTransform: { ...TRANSFORM },
          sourceAuthorityMaskSha256: SOURCE_MASK_SHA,
          approvedByName,
          approvalNote,
        },
      },
      qaResults: [
        {
          gateKey: "exact-alpha",
          gateVersion: "roller-assembled-v2",
          qaStatus: "passed",
          blocking: true,
          calibratedWith: [newMaskSha],
          measurements: { alphaMismatchedPixels: 0, exactMaskClampVerified: true },
          issues: [],
        },
        {
          gateKey: "assembled-position",
          gateVersion: "roller-contact-y760",
          qaStatus: "passed",
          blocking: true,
          calibratedWith: [SOURCE_MASK_SHA],
          measurements: {
            contactYPx: newBounds.bottom,
            mountAxisXPx: MOUNT_AXIS_X,
            appliedPlacementVersionId: PLACEMENT_VERSION_ID,
            translateXPx: TRANSFORM.translateXPx,
            translateYPx: TRANSFORM.translateYPx,
            uniformScale: TRANSFORM.uniformScale,
          },
          issues: [],
        },
      ],
    });
  }

  if (!execute) {
    const montagePath = await renderMontage(items.map(({ variantKey, layerPath }) => ({ variantKey, layerPath })));
    process.stdout.write(`${JSON.stringify({
      mode: "dry-run",
      familyKey: FAMILY_KEY,
      rollerVersions: items.length,
      assembledBounds: newBounds,
      assembledMaskSha256: newMaskSha,
      montagePath,
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
  const registered: JsonRecord[] = [];
  for (const item of items) {
    storageActions.push({
      path: item.version.imagePath,
      action: await verifiedUpload(client, "paper-doll-approved", item.version.imagePath, item.layerBytes, item.layerSha256),
    });
    storageActions.push({
      path: item.version.geometryMaskPath,
      action: await verifiedUpload(client, "paper-doll-approved", item.version.geometryMaskPath, newMaskPng, newMaskSha),
    });
    const registration = await client.rpc("register_paper_doll_approved_source", {
      p_organization_id: organizationId,
      p_component: COMPONENT,
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

  const evidence = {
    schemaVersion: 1,
    familyKey: FAMILY_KEY,
    geometryFamilyId: COMPONENT.geometryFamilyId,
    placementVersionId: PLACEMENT_VERSION_ID,
    approvedByName,
    approvalNote,
    approvedAt: new Date().toISOString(),
    appliedTransform: { ...TRANSFORM },
    sourceAuthorityMaskSha256: SOURCE_MASK_SHA,
    assembledAuthorityMaskSha256: newMaskSha,
    assembledBounds: newBounds,
    rollerComponentVersions: registered.map(({ variantKey, componentVersionId, imageSha256 }) => ({ variantKey, componentVersionId, imageSha256 })),
    storageActions,
    releaseMutation: false,
    sanityMutation: false,
  };
  await writeFile(EVIDENCE_PATH, `${JSON.stringify({ ...evidence, contentSha256: sha256(JSON.stringify(evidence)) }, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({
    mode: "executed",
    rollerVersions: registered.length,
    versionsCreated: registered.filter(({ versionCreated }) => versionCreated).length,
    assembledMaskSha256: newMaskSha,
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
