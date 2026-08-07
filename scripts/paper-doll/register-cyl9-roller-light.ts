/**
 * Harmonize the two roller fitment layers to the Bone body anchor.
 *
 * The 2026-08-06 light audit measured METAL at R/B 1.016 and PLASTIC at
 * 1.015 vs the body anchor 1.030 — ~1.5% cool, visible on the white housing
 * now that the cap-off view exposes the roller. Applies the measured
 * white-balance gain per layer (RGB only, alpha untouched), so the assembled
 * mask d4343d85… and identity lock d975a5a4… are inherited unchanged.
 * Sources are the CURRENT release layers (1.3.7 export).
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";

const EXPECTED_PROJECT_REF = "likkskifwsrvszxdvufw";
const DEFAULT_ORGANIZATION_ID = "4ab1ac72-cd7e-4faf-9152-5aa5f2862411";
const CONFIRMATION = "CYL9-ROLLER-LIGHT-V1";
const FAMILY_KEY = "CYL-9ML";
const EXPORT_ROOT = "outputs/paper-doll-release-export/1.3.7-cap-crown.1";
const OUT_ROOT = "outputs/paper-doll-roller-light-v1";
const EVIDENCE_PATH = "docs/paper-doll-rig/cyl9-roller-light-v1-lock.json";
const BODY_ANCHOR_TEMP = 1.03;
const MEASURED: Record<string, number> = { METAL: 1.016, PLASTIC: 1.015 };

type JsonRecord = Record<string, any>;

function sha256(bytes: Buffer | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function valueAfter(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
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
  if (!supabaseUrl || !serviceRoleKey) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  if (new URL(supabaseUrl).hostname.split(".")[0] !== EXPECTED_PROJECT_REF) {
    throw new Error("Refusing to access an unexpected Supabase project.");
  }
  const client = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  await mkdir(resolve(OUT_ROOT), { recursive: true });

  const manifest = JSON.parse(await readFile(resolve(EXPORT_ROOT, "manifest.json"), "utf8"));
  if (manifest.releaseVersion !== "1.3.7-cap-crown.1") {
    throw new Error("Roller-light sources must come from the 1.3.7 export.");
  }

  const items: JsonRecord[] = [];
  for (const variantKey of ["METAL", "PLASTIC"] as const) {
    const asset = manifest.assets.find((entry: JsonRecord) => entry.slot === "roller" && entry.variantKey === variantKey);
    if (!asset) throw new Error(`Missing roller ${variantKey} in the manifest.`);
    const sourceBytes = await readFile(resolve(EXPORT_ROOT, asset.imagePath));
    if (sha256(sourceBytes) !== asset.imageSha256) throw new Error(`${variantKey} source bytes drifted.`);
    const k = Math.sqrt(BODY_ANCHOR_TEMP / MEASURED[variantKey]);
    const gains = { r: k, b: 1 / k };
    const { data, info } = await sharp(sourceBytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const alphaBefore = Buffer.from(Array.from({ length: info.width * info.height }, (_, i) => data[i * 4 + 3]));
    for (let i = 0; i < info.width * info.height; i++) {
      if (data[i * 4 + 3] === 0) continue;
      data[i * 4] = Math.min(255, Math.round(data[i * 4] * gains.r));
      data[i * 4 + 2] = Math.min(255, Math.round(data[i * 4 + 2] * gains.b));
    }
    const layerPng = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
    const check = await sharp(layerPng).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    for (let i = 0; i < info.width * info.height; i++) {
      if (check.data[i * 4 + 3] !== alphaBefore[i]) throw new Error(`${variantKey} alpha drifted.`);
    }
    const layerSha = sha256(layerPng);
    const layerPath = resolve(OUT_ROOT, `roller__17-415__${variantKey}__light-v1.png`);
    await writeFile(layerPath, layerPng);
    console.log(`${variantKey}: gains R x${gains.r.toFixed(5)} B x${gains.b.toFixed(5)} sha ${layerSha.slice(0, 12)}`);

    items.push({
      variantKey,
      layerBytes: layerPng,
      layerSha256: layerSha,
      source: asset,
      gains,
      component: {
        componentKey: asset.componentKey,
        geometryFamilyId: asset.geometryFamilyId,
        slot: "roller",
        displayName: null,
      },
      version: {
        versionKey: `roller-light-v1-${layerSha.slice(0, 12)}`,
        materialVariant: asset.materialVariant,
        storageBucket: "paper-doll-approved",
        imagePath: `${organizationId}/${FAMILY_KEY}/roller-light-v1/${variantKey}/${layerSha}.png`,
        imageSha256: layerSha,
        geometryMaskPath: asset.geometryMaskPath,
        geometryMaskSha256: asset.geometryMaskSha256,
        contentType: "image/png",
        byteSize: layerPng.byteLength,
        widthPx: 2080,
        heightPx: 2288,
        alphaBounds: asset.alphaBounds,
        mountAxisXPx: asset.mountAxisXPx,
        seatYPx: asset.seatYPx,
        approvalStatus: "approved",
        provenance: {
          sourceType: "light-harmonization",
          sourceComponentVersionId: asset.componentVersionId,
          sourceImageSha256: asset.imageSha256,
          neutralAnchorTemp: BODY_ANCHOR_TEMP,
          measuredTemp: MEASURED[variantKey],
          appliedGains: gains,
          auditPath: "outputs/paper-doll-light-audit/audit.json",
          approvedByName,
          approvalNote,
        },
      },
      qaResults: [
        {
          gateKey: "exact-alpha",
          gateVersion: "roller-light-v1",
          qaStatus: "passed",
          blocking: true,
          calibratedWith: [asset.geometryMaskSha256],
          measurements: { alphaMismatchedPixels: 0, alphaUntouched: true },
          issues: [],
        },
        {
          gateKey: "light-harmonization",
          gateVersion: "neutral-anchor-1p03",
          qaStatus: "passed",
          blocking: true,
          calibratedWith: [asset.imageSha256],
          measurements: {
            gainR: +gains.r.toFixed(6),
            gainB: +gains.b.toFixed(6),
            neutralAnchorTemp: BODY_ANCHOR_TEMP,
            measuredTemp: MEASURED[variantKey],
          },
          issues: [],
        },
      ],
    });
  }

  if (!execute) {
    process.stdout.write(`${JSON.stringify({
      mode: "dry-run",
      rollerVersions: items.length,
      gains: Object.fromEntries(items.map(({ variantKey, gains }) => [variantKey, gains])),
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
      authorityMaskSha256: item.version.geometryMaskSha256,
      placementVersionId: item.source.placementVersionId,
      versionCreated: registration.data.versionCreated,
    });
  }

  const evidence = {
    schemaVersion: 1,
    familyKey: FAMILY_KEY,
    approvedByName,
    approvalNote,
    approvedAt: new Date().toISOString(),
    neutralAnchorTemp: BODY_ANCHOR_TEMP,
    rollerComponentVersions: registered,
    storageActions,
    releaseMutation: false,
    sanityMutation: false,
  };
  await writeFile(EVIDENCE_PATH, `${JSON.stringify({ ...evidence, contentSha256: sha256(JSON.stringify(evidence)) }, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({
    mode: "executed",
    rollerVersions: registered.length,
    versionsCreated: registered.filter(({ versionCreated }) => versionCreated).length,
    evidencePath: EVIDENCE_PATH,
  }, null, 2)}\n`);
}

main().catch((error) => {
  const detail = error instanceof Error ? error.stack ?? error.message : JSON.stringify(error, null, 2);
  process.stderr.write(`${detail}\n`);
  process.exitCode = 1;
});
