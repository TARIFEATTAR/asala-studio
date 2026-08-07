/**
 * Register the Adobe-cleaned CYL-9ML roll-on cap layers (v2) as approved
 * component versions, reusing the existing approved shared placement lock.
 *
 * Nine caps are replaced with Adobe-external-cutout pixels fitted into the
 * locked overcap authority (byte-exact alpha identity). WHT is retained from
 * source-backed v1: its released layer is clean and the Adobe re-cut destroyed
 * its shading, so it keeps componentVersionId adcd518a-74de-4c86-96e0-a04a2d900e97.
 *
 * The shared placement lock 64099824-4079-43f2-8219-8afa6cb18dd6 (x 0, y -3,
 * scale 1, authority 46c5d169…) is inherited, NOT recreated: release cuts
 * refuse geometry keys with more than one approved placement version.
 *
 * Dry-run additionally renders a 9x5 cap-on-body montage for visual review.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";

const EXPECTED_PROJECT_REF = "likkskifwsrvszxdvufw";
const DEFAULT_ORGANIZATION_ID = "4ab1ac72-cd7e-4faf-9152-5aa5f2862411";
const CONFIRMATION = "CYL9-ADOBE-CAP-V2";
const FAMILY_KEY = "CYL-9ML";
const GEOMETRY_FAMILY_ID = "closure__17-415__rollon-overcap__v2";
const FIT_INDEX_PATH = "outputs/paper-doll-cap-adobe-v2/index.json";
const ADOBE_SOURCE_DIR = "outputs/paper-doll-component-locker/CYL-9ML/_psd-flat/Cap_Adobe";
const AUTHORITY_MASK_PATH = "assets/paper-doll/authority-masks/cyl9/closure__17-415__rollon-overcap__v2__mask.png";
const V1_LOCK_PATH = "docs/paper-doll-rig/cyl9-source-cap-v1-remote-placement-lock.json";
const EVIDENCE_PATH = "docs/paper-doll-rig/cyl9-adobe-cap-v2-remote-placement-lock.json";
const MONTAGE_PATH = "outputs/paper-doll-cap-adobe-v2/adobe-v2-on-body-montage.png";
const AUTHORITY_BOUNDS = { left: 869, top: 501, right: 1212, bottom: 1001 } as const;
const MOUNT_AXIS_X_PX = 1041;
const SEAT_Y_PX = 1002;
const PLACEMENT = { translateXPx: 0, translateYPx: -3, uniformScale: 1 } as const;
const RETAINED_WHT = {
  variantKey: "WHT",
  componentVersionId: "adcd518a-74de-4c86-96e0-a04a2d900e97",
  imageSha256: "63d7e8c2f395487b47f47b1acc6981de573dfb39586f9f69bc3737f7ce0e1bed",
} as const;

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
};

// Must match paper_doll_components.display_name byte-for-byte: the register
// RPC refuses identity drift on existing components.
const LABELS: Record<string, string> = {
  BKDT: "Black dotted",
  MCPR: "Matte copper",
  MGLD: "Matte gold",
  MSLV: "Matte silver",
  PKDT: "Pink dotted",
  SBLK: "Shiny black",
  SGLD: "Shiny gold",
  SLDT: "Silver dotted",
  SSLV: "Shiny silver",
};

// Published body plates of release 1.3.0 (public Sanity CDN), used only for
// the dry-run visual montage.
const BODY_CDN: Record<string, string> = {
  AMB: "https://cdn.sanity.io/images/gh97irjh/production/4e9bdf504980fce9c5b145a3bf5ef52d466ac6b2-2080x2288.png",
  BLU: "https://cdn.sanity.io/images/gh97irjh/production/7f7084f598a8d5ffe776d3c5a0bcc1c1aae815ee-2080x2288.png",
  CLR: "https://cdn.sanity.io/images/gh97irjh/production/937d2d44de10bf9353e3e6fedc2577213fcab955-2080x2288.png",
  FRS: "https://cdn.sanity.io/images/gh97irjh/production/5f8f665119828d4b985fb8d3b78b3d5479fa0f5e-2080x2288.png",
  SWL: "https://cdn.sanity.io/images/gh97irjh/production/311588ac5bb106336db33bbe0c5189a075086892-2080x2288.png",
};

type JsonRecord = Record<string, any>;

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

async function verifyExactAuthorityAlpha(layerBytes: Buffer, maskAlpha: Uint8Array): Promise<number> {
  const { data, info } = await sharp(layerBytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.width !== 2080 || info.height !== 2288) throw new Error("Layer is off the canonical canvas.");
  let mismatch = 0;
  for (let i = 0; i < info.width * info.height; i++) {
    if (data[i * 4 + 3] !== maskAlpha[i]) mismatch++;
  }
  return mismatch;
}

async function loadMaskAlpha(maskBytes: Buffer): Promise<Uint8Array> {
  const { data, info } = await sharp(maskBytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.width !== 2080 || info.height !== 2288) throw new Error("Authority mask is off canvas.");
  const alpha = new Uint8Array(info.width * info.height);
  for (let i = 0; i < alpha.length; i++) alpha[i] = Math.min(data[i * 4], data[i * 4 + 3]);
  return alpha;
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
  if (sha256(Buffer.from(await verification.data.arrayBuffer())) !== expectedSha256) {
    throw new Error(`Uploaded bytes failed SHA verification: ${objectPath}.`);
  }
  return "uploaded" as const;
}

async function loadCurrentReleaseTruth(client: SupabaseClient, organizationId: string) {
  const head = await client.from("paper_doll_family_release_heads")
    .select("release_id")
    .eq("organization_id", organizationId)
    .eq("family_key", FAMILY_KEY)
    .single();
  if (head.error) throw head.error;
  const release = await client.from("paper_doll_family_releases")
    .select("id,release_version")
    .eq("organization_id", organizationId)
    .eq("id", head.data.release_id)
    .single();
  if (release.error) throw release.error;
  const bodies = await client.from("paper_doll_family_release_assets")
    .select("component_version_id")
    .eq("organization_id", organizationId)
    .eq("release_id", head.data.release_id)
    .eq("slot", "body");
  if (bodies.error || bodies.data.length !== 5) {
    throw bodies.error ?? new Error("Current Release must contain exactly five body plates.");
  }
  const versions = await client.from("paper_doll_component_versions")
    .select("id,image_sha256,approval_status")
    .eq("organization_id", organizationId)
    .in("id", bodies.data.map(({ component_version_id }) => component_version_id));
  if (versions.error || versions.data.length !== 5 || versions.data.some(({ approval_status }) => approval_status !== "approved")) {
    throw versions.error ?? new Error("Current Release body versions must all be approved.");
  }
  return {
    releaseId: head.data.release_id as string,
    releaseVersion: release.data.release_version as string,
    bodyVersionIds: versions.data.map(({ id }) => id as string).sort(),
    bodyAssetSha256: versions.data.map(({ image_sha256 }) => requireSha(image_sha256, "Current body SHA")).sort(),
  };
}

async function loadInheritedPlacement(client: SupabaseClient, organizationId: string, expectedAuthoritySha: string) {
  const placements = await client.from("paper_doll_placement_versions")
    .select("id,fitment_geometry_key,authority_mask_sha256,translate_x_px,translate_y_px,uniform_scale")
    .eq("organization_id", organizationId)
    .eq("family_key", FAMILY_KEY)
    .eq("fitment_geometry_key", GEOMETRY_FAMILY_ID);
  if (placements.error) throw placements.error;
  const approvals = await client.from("paper_doll_placement_approvals")
    .select("id,placement_version_id")
    .eq("organization_id", organizationId)
    .in("placement_version_id", placements.data.map(({ id }) => id));
  if (approvals.error) throw approvals.error;
  const approved = placements.data.filter((placement) =>
    approvals.data.some(({ placement_version_id }) => placement_version_id === placement.id));
  if (approved.length !== 1) {
    throw new Error(`Expected exactly one approved cap placement lock; found ${approved.length}.`);
  }
  const placement = approved[0];
  if (
    placement.authority_mask_sha256 !== expectedAuthoritySha
    || Number(placement.translate_x_px) !== PLACEMENT.translateXPx
    || Number(placement.translate_y_px) !== PLACEMENT.translateYPx
    || Number(placement.uniform_scale) !== PLACEMENT.uniformScale
  ) {
    throw new Error("The approved cap placement lock differs from the reviewed contract.");
  }
  const approval = approvals.data.find(({ placement_version_id }) => placement_version_id === placement.id)!;
  return { placementVersionId: placement.id as string, approvalId: approval.id as string };
}

async function renderOnBodyMontage(items: Array<{ variantKey: string; layerPath: string }>) {
  const bodyDir = resolve("outputs/paper-doll-cap-adobe-v2/bodies");
  await mkdir(bodyDir, { recursive: true });
  const bodies: Array<{ key: string; raw: Buffer }> = [];
  for (const [key, url] of Object.entries(BODY_CDN)) {
    const local = resolve(bodyDir, `${key}.png`);
    let bytes: Buffer;
    try {
      bytes = await readFile(local);
    } catch {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${url} -> ${res.status}`);
      bytes = Buffer.from(await res.arrayBuffer());
      await writeFile(local, bytes);
    }
    bodies.push({ key, raw: bytes });
  }
  const crop = { left: 700, top: 430, width: 690, height: 1100 };
  const CELL_W = 190;
  const rows: Buffer[] = [];
  for (const item of items) {
    // pre-shift the cap layer by the locked placement (y -3) so the composite
    // input keeps canvas dimensions
    const shiftUp = -PLACEMENT.translateYPx;
    const capLayer = await sharp(await readFile(item.layerPath))
      .extract({ left: 0, top: shiftUp, width: 2080, height: 2288 - shiftUp })
      .extend({ bottom: shiftUp, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    const cells: Buffer[] = [];
    for (const body of bodies) {
      // composite first (sharp applies extract before composite in one pipeline)
      const assembled = await sharp(body.raw)
        .composite([{ input: capLayer, left: 0, top: 0 }])
        .png()
        .toBuffer();
      const composed = await sharp(assembled)
        .extract(crop)
        .resize({ width: CELL_W })
        .png()
        .toBuffer();
      cells.push(composed);
    }
    const meta = await sharp(cells[0]).metadata();
    const cellH = meta.height ?? 0;
    const row = await sharp({
      create: { width: CELL_W * 5 + 24, height: cellH + 30, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
    })
      .composite([
        { input: Buffer.from(`<svg width="${CELL_W * 5 + 24}" height="26"><text x="6" y="19" font-family="Helvetica" font-size="15" font-weight="bold">${item.variantKey} — AMB | BLU | CLR | FRS | SWL (x0 y-3 s1)</text></svg>`), left: 0, top: 0 },
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
  rows.forEach((row, index) => {
    composites.push({ input: row, left: 0, top });
    top += heights[index] + 8;
  });
  await sharp({ create: { width: 190 * 5 + 24, height: totalH, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
    .composite(composites)
    .png()
    .toFile(MONTAGE_PATH);
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
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  }
  if (new URL(supabaseUrl).hostname.split(".")[0] !== EXPECTED_PROJECT_REF) {
    throw new Error("Refusing to access an unexpected Supabase project.");
  }
  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const v1Lock = JSON.parse(await readFile(V1_LOCK_PATH, "utf8"));
  const { contentSha256: v1ContentSha, ...v1Payload } = v1Lock;
  if (sha256(JSON.stringify(v1Payload)) !== v1ContentSha) {
    throw new Error("The v1 cap placement evidence hash no longer matches.");
  }
  const retainedWht = v1Lock.capComponentVersions.find((entry: JsonRecord) => entry.variantKey === "WHT");
  if (
    !retainedWht
    || retainedWht.componentVersionId !== RETAINED_WHT.componentVersionId
    || retainedWht.imageSha256 !== RETAINED_WHT.imageSha256
  ) {
    throw new Error("The retained WHT v1 identity differs from its immutable lock evidence.");
  }

  const authorityBytes = await readFile(AUTHORITY_MASK_PATH);
  const authoritySha = sha256(authorityBytes);
  if (authoritySha !== v1Lock.authorityMaskSha256) {
    throw new Error("Authority mask bytes changed since the v1 placement lock.");
  }
  const maskAlpha = await loadMaskAlpha(authorityBytes);

  const fitIndex = JSON.parse(await readFile(FIT_INDEX_PATH, "utf8"));
  const layers = (fitIndex.layers as JsonRecord[]).filter(({ variantKey }) => variantKey !== "WHT");
  if (layers.length !== 9) throw new Error("Expected exactly nine Adobe-cleaned cap layers (WHT retained from v1).");

  const items: JsonRecord[] = [];
  for (const layer of [...layers].sort((a, b) => String(a.variantKey).localeCompare(String(b.variantKey)))) {
    const variantKey = String(layer.variantKey);
    const materialVariant = MATERIALS[variantKey];
    if (!materialVariant) throw new Error(`Unexpected CYL-9ML cap variant ${variantKey}.`);
    const layerBytes = await readFile(String(layer.layerPath));
    const layerSha = sha256(layerBytes);
    if (layerSha !== requireSha(layer.layerSha256, `${variantKey} layer SHA`)) {
      throw new Error(`Cap bytes changed after fit review: ${variantKey}.`);
    }
    const mismatch = await verifyExactAuthorityAlpha(layerBytes, maskAlpha);
    if (mismatch !== 0) throw new Error(`${variantKey} alpha is not byte-exact to the authority (${mismatch}px).`);
    const sourceBytes = await readFile(resolve(ADOBE_SOURCE_DIR, String(layer.sourceFile)));
    items.push({
      variantKey,
      layerPath: String(layer.layerPath),
      layerBytes,
      layerSha256: layerSha,
      sourceFilename: String(layer.sourceFile),
      sourceSha256: sha256(sourceBytes),
      component: {
        componentKey: `cap__17-415__rollon__${variantKey}`,
        geometryFamilyId: GEOMETRY_FAMILY_ID,
        slot: "cap",
        displayName: `17-415 roll-on overcap — ${LABELS[variantKey]}`,
      },
      version: {
        versionKey: `adobe-clean-v2-${layerSha.slice(0, 12)}`,
        materialVariant,
        storageBucket: "paper-doll-approved",
        imagePath: `${organizationId}/${FAMILY_KEY}/adobe-cap-v2/${variantKey}/${layerSha}.png`,
        imageSha256: layerSha,
        geometryMaskPath: `${organizationId}/${FAMILY_KEY}/adobe-cap-v2/authority/${authoritySha}.png`,
        geometryMaskSha256: authoritySha,
        contentType: "image/png",
        byteSize: layerBytes.byteLength,
        widthPx: 2080,
        heightPx: 2288,
        alphaBounds: AUTHORITY_BOUNDS,
        mountAxisXPx: MOUNT_AXIS_X_PX,
        seatYPx: SEAT_Y_PX,
        approvalStatus: "approved",
        provenance: {
          sourceType: "adobe-external-cutout",
          originalFilename: basename(String(layer.sourceFile)),
          sourceSha256: sha256(sourceBytes),
          exactAuthorityAlpha: true,
          fitContract: fitIndex.fit,
          sharedPlacement: { x: PLACEMENT.translateXPx, y: PLACEMENT.translateYPx, scale: PLACEMENT.uniformScale },
          replacesComponentVersionId: v1Lock.capComponentVersions
            .find((entry: JsonRecord) => entry.variantKey === variantKey)?.componentVersionId ?? null,
          approvedByName,
          approvalNote,
        },
      },
    });
  }

  const [currentRelease, inherited] = await Promise.all([
    loadCurrentReleaseTruth(client, organizationId),
    loadInheritedPlacement(client, organizationId, authoritySha),
  ]);
  if (inherited.placementVersionId !== v1Lock.placementVersionId) {
    throw new Error("The approved placement lock id changed since the v1 evidence.");
  }

  for (const item of items) {
    item.qaResults = [
      {
        gateKey: "exact-alpha",
        gateVersion: "adobe-cap-v2",
        qaStatus: "passed",
        blocking: true,
        calibratedWith: [authoritySha],
        measurements: { alphaMismatchedPixels: 0, exactMaskClampVerified: true },
        issues: [],
      },
      {
        gateKey: "five-body-family-fit",
        gateVersion: "adobe-cap-v2-y-neg-3",
        qaStatus: "passed",
        blocking: true,
        calibratedWith: [...currentRelease.bodyAssetSha256],
        measurements: {
          bodyPlateCount: 5,
          translateXPx: PLACEMENT.translateXPx,
          translateYPx: PLACEMENT.translateYPx,
          uniformScale: PLACEMENT.uniformScale,
          inheritedPlacementVersionId: inherited.placementVersionId,
        },
        issues: [],
      },
    ];
  }

  if (!execute) {
    const montagePath = await renderOnBodyMontage(items.map(({ variantKey, layerPath }) => ({ variantKey, layerPath })));
    process.stdout.write(`${JSON.stringify({
      mode: "dry-run",
      familyKey: FAMILY_KEY,
      newCapVersions: items.length,
      retained: RETAINED_WHT,
      inheritedPlacementVersionId: inherited.placementVersionId,
      currentRelease: { id: currentRelease.releaseId, version: currentRelease.releaseVersion },
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
      action: await verifiedUpload(client, "paper-doll-approved", item.version.geometryMaskPath, authorityBytes, authoritySha),
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

  const evidence = {
    schemaVersion: 1,
    familyKey: FAMILY_KEY,
    geometryFamilyId: GEOMETRY_FAMILY_ID,
    placementVersionId: inherited.placementVersionId,
    approvalId: inherited.approvalId,
    approvedByName,
    approvalNote,
    approvedAt: new Date().toISOString(),
    placement: { ...PLACEMENT },
    authorityMaskSha256: authoritySha,
    currentReleaseId: currentRelease.releaseId,
    bodyComponentVersionIds: currentRelease.bodyVersionIds,
    capComponentVersions: [
      ...registered.map(({ variantKey, componentVersionId, imageSha256 }) => ({ variantKey, componentVersionId, imageSha256 })),
      { ...RETAINED_WHT },
    ].sort((left, right) => left.variantKey.localeCompare(right.variantKey)),
    retainedFromV1: [{ ...RETAINED_WHT, reason: "released layer is clean; Adobe re-cut destroyed the white cap shading" }],
    storageActions,
    releaseMutation: false,
    sanityMutation: false,
  };
  await writeFile(EVIDENCE_PATH, `${JSON.stringify({ ...evidence, contentSha256: sha256(JSON.stringify(evidence)) }, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({
    mode: "executed",
    newCapVersions: registered.length,
    versionsCreated: registered.filter(({ versionCreated }) => versionCreated).length,
    retained: RETAINED_WHT,
    placementVersionId: inherited.placementVersionId,
    releaseMutation: false,
    sanityMutation: false,
    evidencePath: EVIDENCE_PATH,
  }, null, 2)}\n`);
}

if (process.argv[1]?.endsWith("register-cyl9-adobe-cap-v2.ts")) {
  main().catch((error) => {
    const detail = error instanceof Error
      ? error.stack ?? error.message
      : JSON.stringify(error, null, 2);
    process.stderr.write(`${detail}\n`);
    process.exitCode = 1;
  });
}
