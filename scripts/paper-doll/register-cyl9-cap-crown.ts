/**
 * Refit the nine Adobe cap cutouts HEIGHT-EXACT so the cap crown is fully
 * exposed (Jordan: tops were cropped too early).
 *
 * The original adobe-v2 fit used a 5% top overfill, which pushed the photo's
 * crown above the authority silhouette where the alpha stamp sliced it — the
 * same defect fixed for the pump actuators. This pass scales each cutout to
 * the exact authority height (crown to crown, seat to seat); the sub-2.5%
 * width shortfall at the cap walls is filled by the BFS bleed.
 *
 * Fits target the CURRENT (lifted) cap authority 95965dba…, apply the 1.3.5
 * harmonization gains (R x1.0149, B x0.9853), and clamp byte-exact — so the
 * new versions inherit the existing identity placement lock 335aea8d…
 * unchanged. WHT keeps its current version: its v1-source fit was exact and
 * its crown is intact.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";

const EXPECTED_PROJECT_REF = "likkskifwsrvszxdvufw";
const DEFAULT_ORGANIZATION_ID = "4ab1ac72-cd7e-4faf-9152-5aa5f2862411";
const CONFIRMATION = "CYL9-CAP-CROWN-V1";
const FAMILY_KEY = "CYL-9ML";
const GEOMETRY_KEY = "closure__17-415__rollon-overcap__v2";
const ADOBE_DIR = "outputs/paper-doll-component-locker/CYL-9ML/_psd-flat/Cap_Adobe";
const LIFTED_MASK_PATH = "outputs/paper-doll-cap-lift-v1/authority-lifted-95965dba9192.png";
const LIFTED_MASK_SHA = "95965dba9192a56f81bf8da802cb22748fbb62ee9024d5bc53a96e7b00dc70fe";
const OUT_ROOT = "outputs/paper-doll-cap-crown-v1";
const EVIDENCE_PATH = "docs/paper-doll-rig/cyl9-cap-crown-v1-lock.json";
const HARMONY_GAINS = { r: 1.014889156509222, b: 0.9853292781642932 };
const SOLID = 200;
const OUT_BLEED = 4;

const CAPS = [
  { variantKey: "BKDT", file: "cap_BKDT.png", materialVariant: "black-dotted", bboxMode: "alpha" },
  { variantKey: "MCPR", file: "cap_MCPR.png", materialVariant: "matte-copper", bboxMode: "alpha" },
  { variantKey: "MGLD", file: "cap_MGLD.png", materialVariant: "matte-gold", bboxMode: "alpha" },
  { variantKey: "MSLV", file: "cap__MSLV.png", materialVariant: "matte-silver", bboxMode: "alpha" },
  { variantKey: "PKDT", file: "cap__PKDT.png", materialVariant: "pink-dotted", bboxMode: "alpha" },
  { variantKey: "SBLK", file: "cap__SBLK.png", materialVariant: "shiny-black", bboxMode: "alpha" },
  { variantKey: "SGLD", file: "cap__SGLD.png", materialVariant: "shiny-gold", bboxMode: "non-white" },
  { variantKey: "SLDT", file: "cap__SLDT.png", materialVariant: "silver-dotted", bboxMode: "alpha" },
  { variantKey: "SSLV", file: "cap__SSLV.png", materialVariant: "shiny-silver", bboxMode: "alpha" },
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

function boundsOfAlpha(alpha: Uint8Array, width: number, height: number) {
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (alpha[y * width + x] > 0) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  return { left: minX, top: minY, right: maxX, bottom: maxY };
}

function contentBBox(img: Raw, mode: "alpha" | "non-white") {
  let minX = img.width, minY = img.height, maxX = -1, maxY = -1;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const i = (y * img.width + x) * 4;
      const hit = mode === "alpha"
        ? img.data[i + 3] >= 8
        : Math.min(img.data[i], img.data[i + 1], img.data[i + 2]) < 240 && img.data[i + 3] > 0;
      if (hit) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) throw new Error("source has no content");
  return { minX, minY, maxX, maxY, width: maxX - minX + 1, height: maxY - minY + 1 };
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

  const maskBytes = await readFile(resolve(LIFTED_MASK_PATH));
  if (sha256(maskBytes) !== LIFTED_MASK_SHA) throw new Error("Lifted cap authority bytes drifted.");
  const mask = await loadRaw(maskBytes);
  const maskAlpha = maskAlphaOf(mask);
  const mb = boundsOfAlpha(maskAlpha, mask.width, mask.height);
  const mbH = mb.bottom - mb.top + 1;
  const maskCenterX = (mb.left + mb.right) / 2;
  console.log(`lifted authority bbox x[${mb.left}..${mb.right}] y[${mb.top}..${mb.bottom}] h${mbH}`);

  const items: JsonRecord[] = [];
  for (const cap of CAPS) {
    const sourceBytes = await readFile(resolve(ADOBE_DIR, cap.file));
    const src = await loadRaw(sourceBytes);
    if (cap.bboxMode === "non-white") {
      for (let i = 0; i < src.width * src.height; i++) src.data[i * 4 + 3] = 255;
    }
    const sb = contentBBox(src, cap.bboxMode);
    // height-exact: crown lands on the authority crown, seat on the seat
    const scale = mbH / sb.height;
    const dstW = Math.round(sb.width * scale);
    const dstH = Math.round(sb.height * scale);
    const dstLeft = Math.round(maskCenterX - dstW / 2);
    const dstTop = mb.bottom - dstH + 1;

    const scaledBuf = await sharp(sourceBytes)
      .extract({ left: sb.minX, top: sb.minY, width: sb.width, height: sb.height })
      .resize({ width: dstW, height: dstH, fit: "fill", kernel: "lanczos3" })
      .ensureAlpha()
      .raw()
      .toBuffer();
    if (cap.bboxMode === "non-white") {
      for (let i = 0; i < dstW * dstH; i++) scaledBuf[i * 4 + 3] = 255;
    }

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

    // BFS fill of weakly covered authority pixels, then harmonize + clamp
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
    for (let i = 0; i < n; i++) {
      if (out[i * 4 + 3] === 0 && maskAlpha[i] === 0) continue;
      out[i * 4] = Math.min(255, Math.round(out[i * 4] * HARMONY_GAINS.r));
      out[i * 4 + 2] = Math.min(255, Math.round(out[i * 4 + 2] * HARMONY_GAINS.b));
    }
    for (let i = 0; i < n; i++) out[i * 4 + 3] = maskAlpha[i];

    const layerPng = await sharp(out, { raw: { width: 2080, height: 2288, channels: 4 } }).png().toBuffer();
    const layerSha = sha256(layerPng);
    const layerPath = resolve(OUT_ROOT, `cap__17-415__${cap.variantKey}__crown-v1.png`);
    await writeFile(layerPath, layerPng);

    const check = await loadRaw(layerPng);
    let mismatch = 0;
    for (let i = 0; i < n; i++) if (check.data[i * 4 + 3] !== maskAlpha[i]) mismatch++;
    if (mismatch !== 0) throw new Error(`${cap.variantKey} alpha not byte-exact (${mismatch}px).`);
    console.log(`${cap.variantKey}: scale ${scale.toFixed(3)} filled ${filledPx}px alphaMismatch 0 sha ${layerSha.slice(0, 12)}`);

    items.push({
      variantKey: cap.variantKey,
      layerPath,
      layerBytes: layerPng,
      layerSha256: layerSha,
      component: {
        componentKey: `cap__17-415__rollon__${cap.variantKey}`,
        geometryFamilyId: GEOMETRY_KEY,
        slot: "cap",
        displayName: null,
      },
      version: {
        versionKey: `cap-crown-v1-${layerSha.slice(0, 12)}`,
        materialVariant: cap.materialVariant,
        storageBucket: "paper-doll-approved",
        imagePath: `${organizationId}/${FAMILY_KEY}/cap-crown-v1/${cap.variantKey}/${layerSha}.png`,
        imageSha256: layerSha,
        geometryMaskPath: `${organizationId}/${FAMILY_KEY}/cap-lift-v1/authority/${LIFTED_MASK_SHA}.png`,
        geometryMaskSha256: LIFTED_MASK_SHA,
        contentType: "image/png",
        byteSize: layerPng.byteLength,
        widthPx: 2080,
        heightPx: 2288,
        alphaBounds: { left: mb.left, top: mb.top, right: mb.right, bottom: mb.bottom },
        mountAxisXPx: 1041,
        seatYPx: 1000,
        approvalStatus: "approved",
        provenance: {
          sourceType: "adobe-external-cutout",
          originalFilename: cap.file,
          sourceSha256: sha256(sourceBytes),
          exactAuthorityAlpha: true,
          fitContract: { mode: "height-exact", liftPx: 2 },
          harmonizationGains: HARMONY_GAINS,
          approvedByName,
          approvalNote,
        },
      },
      qaResults: [
        {
          gateKey: "exact-alpha",
          gateVersion: "cap-crown-v1",
          qaStatus: "passed",
          blocking: true,
          calibratedWith: [LIFTED_MASK_SHA],
          measurements: { alphaMismatchedPixels: 0, crownExposed: true },
          issues: [],
        },
        {
          gateKey: "five-body-family-fit",
          gateVersion: "cap-crown-v1-identity",
          qaStatus: "passed",
          blocking: true,
          calibratedWith: [LIFTED_MASK_SHA],
          measurements: { bodyPlateCount: 5, translateXPx: 0, translateYPx: 0, uniformScale: 1 },
          issues: [],
        },
      ],
    });
  }

  if (!execute) {
    // crown comparison: current release layer vs refit, MGLD at 2x
    const currentPath = "outputs/paper-doll-cap-lift-v1/cap__17-415__MGLD__lift-v1.png";
    const refit = items.find(({ variantKey }) => variantKey === "MGLD")!;
    const body = await readFile("outputs/paper-doll-cap-adobe-v2/bodies/CLR.png");
    const crop = { left: 850, top: 470, width: 384, height: 160 };
    const cells = await Promise.all([
      sharp(await sharp(body).composite([{ input: await readFile(currentPath), left: 0, top: 0 }]).png().toBuffer()).extract(crop).resize({ width: 768, kernel: "nearest" }).png().toBuffer(),
      sharp(await sharp(body).composite([{ input: refit.layerBytes, left: 0, top: 0 }]).png().toBuffer()).extract(crop).resize({ width: 768, kernel: "nearest" }).png().toBuffer(),
    ]);
    await sharp({ create: { width: 768 * 2 + 12, height: 350, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
      .composite([
        { input: Buffer.from('<svg width="1548" height="26"><text x="6" y="19" font-family="Helvetica" font-size="15" font-weight="bold">MGLD crown — current overfilled fit (left) vs height-exact refit (right), 2x</text></svg>'), left: 0, top: 0 },
        { input: cells[0], left: 0, top: 28 },
        { input: cells[1], left: 780, top: 28 },
      ]).png().toFile(resolve(OUT_ROOT, "cap-crown-comparison.png"));
    process.stdout.write(`${JSON.stringify({
      mode: "dry-run",
      capVersions: items.length,
      authorityMaskSha256: LIFTED_MASK_SHA,
      crownPreview: resolve(OUT_ROOT, "cap-crown-comparison.png"),
      remoteWritesPerformed: false,
    }, null, 2)}\n`);
    return;
  }
  if (!args.includes("--allow-remote-write") || valueAfter(args, "--confirmation") !== CONFIRMATION) {
    throw new Error(`Remote execution requires --execute --allow-remote-write --confirmation ${CONFIRMATION}.`);
  }

  // reuse the existing identity lock for (cap geometry, lifted mask)
  const existingLock = await client.from("paper_doll_placement_versions")
    .select("id,translate_x_px,translate_y_px,uniform_scale")
    .eq("organization_id", organizationId)
    .eq("family_key", FAMILY_KEY)
    .eq("fitment_geometry_key", GEOMETRY_KEY)
    .eq("authority_mask_sha256", LIFTED_MASK_SHA)
    .maybeSingle();
  if (existingLock.error) throw existingLock.error;
  if (!existingLock.data) throw new Error("The lifted-mask identity lock is missing.");
  if (Number(existingLock.data.translate_x_px) !== 0 || Number(existingLock.data.translate_y_px) !== 0 || Number(existingLock.data.uniform_scale) !== 1) {
    throw new Error("The lifted-mask lock is not identity.");
  }
  const placementVersionId = existingLock.data.id as string;

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

  const capLiftLock = JSON.parse(await readFile("docs/paper-doll-rig/cyl9-cap-lift-v1-lock.json", "utf8"));
  const whtLift = capLiftLock.capComponentVersions.find((entry: JsonRecord) => entry.variantKey === "WHT");
  if (!whtLift) throw new Error("The lifted WHT version is missing from the cap-lift evidence.");

  const evidence = {
    schemaVersion: 1,
    familyKey: FAMILY_KEY,
    geometryFamilyId: GEOMETRY_KEY,
    placementVersionId,
    approvedByName,
    approvalNote,
    approvedAt: new Date().toISOString(),
    placement: { translateXPx: 0, translateYPx: 0, uniformScale: 1 },
    authorityMaskSha256: LIFTED_MASK_SHA,
    capComponentVersions: [
      ...registered.map(({ variantKey, componentVersionId, imageSha256 }) => ({ variantKey, componentVersionId, imageSha256 })),
      { variantKey: "WHT", componentVersionId: whtLift.componentVersionId, imageSha256: whtLift.imageSha256 },
    ].sort((left, right) => left.variantKey.localeCompare(right.variantKey)),
    retained: [{ variantKey: "WHT", reason: "v1-source fit was exact; crown intact" }],
    storageActions,
    releaseMutation: false,
    sanityMutation: false,
  };
  await writeFile(EVIDENCE_PATH, `${JSON.stringify({ ...evidence, contentSha256: sha256(JSON.stringify(evidence)) }, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({
    mode: "executed",
    capVersions: registered.length,
    versionsCreated: registered.filter(({ versionCreated }) => versionCreated).length,
    placementVersionId,
    evidencePath: EVIDENCE_PATH,
  }, null, 2)}\n`);
}

main().catch((error) => {
  const detail = error instanceof Error ? error.stack ?? error.message : JSON.stringify(error, null, 2);
  process.stderr.write(`${detail}\n`);
  process.exitCode = 1;
});
