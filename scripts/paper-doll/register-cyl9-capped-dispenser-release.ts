import { createHash } from "node:crypto";
import { basename } from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  loadCyl9ComponentFactory,
  type CYL9_BODY_VARIANT_KEYS,
} from "../../src/lib/paperDoll/cyl9ComponentFactory";

const CONFIRMATION = "CYL9-CAPPED-DISPENSER-RELEASE";
const EXPECTED_PROJECT_REF = "likkskifwsrvszxdvufw";
const DEFAULT_ORGANIZATION_ID = "4ab1ac72-cd7e-4faf-9152-5aa5f2862411";
const FAMILY_KEY = "CYL-9ML";
const RELEASE_VERSION = "1.2.0-capped-dispensers.1";
const RENDERER_VERSION = "paper-doll-capped-source-v3";
const SANITY_PUBLIC_DOCUMENT_ID = "paperDollFamily.CYL-9ML";
const SOURCE_MANIFEST_PATH = "outputs/paper-doll-dispenser-17-415/capped-source-swatches-v3/manifest.json";
const PLACEMENT_LOCK_PATH = "docs/paper-doll-rig/cyl9-capped-dispenser-v3-placement-lock.json";
const EVIDENCE_PATH = "docs/paper-doll-rig/cyl9-capped-dispenser-v3-remote-release.json";

type Lane = "sprayer" | "pump";
type JsonRecord = Record<string, any>;
type ReleaseMapping = {
  mappingKey: string;
  websiteSku: string;
  graceSku: string;
  recipeKey: string;
  bodyVariantKey: string;
  fitmentVariantKey: string | null;
  closureVariantKey: string | null;
  overcapVariantKey: string | null;
};

const MATERIALS: Record<Lane, Record<string, string>> = {
  sprayer: {
    GLD: "shiny-gold",
    MSLV: "matte-silver",
    BLK: "shiny-black",
    SSLV: "shiny-silver",
    RED: "red",
    TUR: "turquoise",
  },
  pump: { MSLV: "matte-silver", GLD: "shiny-gold", BLK: "shiny-black" },
};

const DISPLAY_NAMES: Record<Lane, string> = {
  sprayer: "17-415 closed fine-mist sprayer",
  pump: "17-415 closed lotion pump",
};

function sha256(bytes: Buffer | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function requireSha(value: string, label: string): string {
  if (!/^[a-f0-9]{64}$/.test(value)) throw new Error(`${label} is not a lowercase SHA-256.`);
  return value;
}

function boundsToEdges(bounds: { left: number; top: number; width: number; height: number }) {
  return {
    left: bounds.left,
    top: bounds.top,
    right: bounds.left + bounds.width - 1,
    bottom: bounds.top + bounds.height - 1,
  };
}

function componentSlot(componentVariantKey: string): "cap" | "roller" | "sprayer" | "pump" {
  if (componentVariantKey.startsWith("closure__")) return "cap";
  if (componentVariantKey.startsWith("roller__")) return "roller";
  if (componentVariantKey.startsWith("sprayer__")) return "sprayer";
  if (componentVariantKey.startsWith("pump__")) return "pump";
  throw new Error(`Unknown CYL-9ML component identity: ${componentVariantKey}`);
}

function variantPart(componentVariantKey: string): string {
  const separator = componentVariantKey.lastIndexOf(":");
  if (separator < 0) throw new Error(`Component variant is malformed: ${componentVariantKey}`);
  return componentVariantKey.slice(separator + 1);
}

export function buildCappedDispenserRegistrationPlan(input: {
  sourceManifest: JsonRecord;
  placementLock: JsonRecord;
  organizationId: string;
}) {
  const { sourceManifest, placementLock, organizationId } = input;
  if (
    placementLock.familyKey !== FAMILY_KEY
    || placementLock.canvas?.widthPx !== 2080
    || placementLock.canvas?.heightPx !== 2288
    || placementLock.components?.length !== 9
    || placementLock.bodyPlates?.length !== 5
    || placementLock.placementRows?.length !== 45
    || placementLock.lifecycleState !== "placement-locked"
    || !placementLock.approvedByName?.trim()
    || !placementLock.approvalNote?.trim()
  ) {
    throw new Error("The named capped-dispenser placement lock is incomplete or stale.");
  }
  if (
    sourceManifest.candidates?.length !== 9
    || !sourceManifest.qa?.exactMaskClampVerified
    || !sourceManifest.qa?.fiveBodyAssemblyContextRendered
    || Object.values(sourceManifest.mutationPolicy ?? {}).some(Boolean)
  ) {
    throw new Error("The capped source manifest has not earned immutable registration.");
  }
  const bodyHashes = placementLock.bodyPlates.map((body: JsonRecord) => requireSha(body.assetSha256, "body SHA"));

  return sourceManifest.candidates.map((candidate: JsonRecord) => {
    const lane = candidate.lane as Lane;
    const materialVariant = MATERIALS[lane]?.[candidate.variantKey];
    if (!materialVariant) throw new Error(`Unexpected capped dispenser variant ${lane}:${candidate.variantKey}.`);
    if (candidate.qa?.alphaMismatchedPixels !== 0 || !candidate.qa?.exactMaskClampVerified) {
      throw new Error(`${lane}:${candidate.variantKey} does not have exact alpha identity.`);
    }
    const lockComponent = placementLock.components.find(
      (component: JsonRecord) => component.lane === lane && component.variantKey === candidate.variantKey,
    );
    if (
      !lockComponent
      || lockComponent.candidateSha256 !== candidate.candidateSha256
      || lockComponent.authoritySha256 !== candidate.authoritySha256
    ) throw new Error(`${lane}:${candidate.variantKey} differs from the named placement lock.`);

    const imagePath = `${organizationId}/${FAMILY_KEY}/capped-dispensers-v3/${lane}/${candidate.variantKey}/${candidate.candidateSha256}.png`;
    const maskPath = `${organizationId}/${FAMILY_KEY}/capped-dispensers-v3/authority/${lane}/${candidate.authoritySha256}.png`;
    const geometryFamilyId = `${lane}__17-415__closed__v3`;
    const componentKey = `${lane}__17-415__closed__${candidate.variantKey}`;
    return {
      lane,
      variantKey: candidate.variantKey as string,
      candidatePath: candidate.candidatePath as string,
      candidateSha256: requireSha(candidate.candidateSha256, "candidate SHA"),
      authorityPath: candidate.authorityPath as string,
      authoritySha256: requireSha(candidate.authoritySha256, "authority SHA"),
      sourcePath: candidate.sourcePath as string,
      sourceSha256: requireSha(candidate.sourceSha256, "source SHA"),
      sourceManifestSha256: requireSha(placementLock.sourceManifestSha256, "source manifest SHA"),
      component: {
        componentKey,
        geometryFamilyId,
        slot: lane,
        displayName: `${DISPLAY_NAMES[lane]} — ${materialVariant}`,
      },
      version: {
        versionKey: `source-backed-v3-${candidate.candidateSha256.slice(0, 12)}`,
        materialVariant,
        storageBucket: "paper-doll-approved",
        imagePath,
        imageSha256: candidate.candidateSha256,
        geometryMaskPath: maskPath,
        geometryMaskSha256: candidate.authoritySha256,
        contentType: "image/png",
        byteSize: 0,
        widthPx: 2080,
        heightPx: 2288,
        alphaBounds: boundsToEdges(candidate.authorityBoundsPx),
        mountAxisXPx: placementLock.sharedPlacement.centerXPx,
        seatYPx: placementLock.sharedPlacement.seatYPx,
        approvalStatus: "approved",
        provenance: {
          sourceType: "layered-capped-photoshop-source",
          originalFilename: basename(candidate.sourcePath),
          sourceSha256: candidate.sourceSha256,
          sourceManifestSha256: placementLock.sourceManifestSha256,
          placementLockId: placementLock.lockId,
          placementLockSha256: placementLock.contentSha256,
          compoundCapOnComponent: true,
          bottlePixelsUsed: false,
          independentTranslucentOverlayAllowed: false,
          approvedByName: placementLock.approvedByName,
          approvedAt: placementLock.approvedAt,
          approvalNote: placementLock.approvalNote,
          placementBoundsPx: candidate.placementBoundsPx,
          authorityBoundsPx: candidate.authorityBoundsPx,
        },
      },
      qaResults: [
        {
          gateKey: "exact-alpha",
          gateVersion: "capped-source-v3",
          qaStatus: "passed",
          blocking: true,
          calibratedWith: [candidate.authoritySha256],
          measurements: { alphaMismatchedPixels: 0, exactMaskClampVerified: true },
          issues: [],
        },
        {
          gateKey: "five-body-family-fit",
          gateVersion: "capped-source-v3",
          qaStatus: "passed",
          blocking: true,
          calibratedWith: bodyHashes,
          measurements: { bodyPlateCount: 5, placementLockSha256: placementLock.contentSha256 },
          issues: [],
        },
        {
          gateKey: "source-responsibility",
          gateVersion: "compound-cap-on-v1",
          qaStatus: "passed",
          blocking: true,
          calibratedWith: [candidate.sourceSha256],
          measurements: { bottlePixelsUsed: false, compoundCapOnComponent: true },
          issues: [],
        },
      ],
    };
  }).sort((left: JsonRecord, right: JsonRecord) => `${left.lane}:${left.variantKey}`.localeCompare(`${right.lane}:${right.variantKey}`));
}

export function buildReleaseAssemblyMappings(factory: ReturnType<typeof loadCyl9ComponentFactory>): ReleaseMapping[] {
  return factory.catalogMappings.map((mapping) => {
    const selections = new Map(
      mapping.componentVariantKeys.map((identity) => [componentSlot(identity), variantPart(identity)]),
    );
    return {
      mappingKey: mapping.mappingKey,
      websiteSku: mapping.websiteSku,
      graceSku: mapping.graceSku,
      recipeKey: `CYL-9ML:${mapping.mode.toUpperCase()}`,
      bodyVariantKey: mapping.bodyVariantKey,
      fitmentVariantKey: selections.get("roller") ?? selections.get("sprayer") ?? selections.get("pump") ?? null,
      closureVariantKey: selections.get("cap") ?? null,
      overcapVariantKey: null,
    };
  });
}

export function buildReleaseReadiness(mappings: ReleaseMapping[], availableAssets: Set<string>) {
  return mappings.map((mapping) => {
    const requirements = [`body:${mapping.bodyVariantKey}`];
    const mode = mapping.recipeKey.split(":").at(-1)?.toLowerCase();
    if (mapping.fitmentVariantKey) requirements.push(`${mode === "rollon" ? "roller" : mode === "spray" ? "sprayer" : "pump"}:${mapping.fitmentVariantKey}`);
    if (mapping.closureVariantKey) requirements.push(`cap:${mapping.closureVariantKey}`);
    const missingReasons = requirements.filter((identity) => !availableAssets.has(identity));
    return {
      mappingKey: mapping.mappingKey,
      websiteSku: mapping.websiteSku,
      graceSku: mapping.graceSku,
      status: missingReasons.length === 0 ? "ready" : "incomplete",
      missingReasons,
    };
  });
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
    const existingBytes = Buffer.from(await existing.data.arrayBuffer());
    if (sha256(existingBytes) !== expectedSha256) throw new Error(`Immutable storage collision at ${bucket}/${objectPath}.`);
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
  const verifiedBytes = Buffer.from(await verification.data.arrayBuffer());
  if (sha256(verifiedBytes) !== expectedSha256) throw new Error(`Uploaded bytes failed SHA verification: ${objectPath}.`);
  return "uploaded" as const;
}

async function queryCurrentRelease(client: SupabaseClient, organizationId: string) {
  const head = await client.from("paper_doll_family_release_heads")
    .select("release_id,release_cut_id,updated_at")
    .eq("organization_id", organizationId).eq("family_key", FAMILY_KEY).single();
  if (head.error) throw head.error;
  const release = await client.from("paper_doll_family_releases")
    .select("id,release_version,manifest,manifest_sha256")
    .eq("id", head.data.release_id).single();
  if (release.error) throw release.error;
  const memberships = await client.from("paper_doll_family_release_assets")
    .select("component_version_id,slot,variant_key")
    .eq("organization_id", organizationId).eq("release_id", head.data.release_id);
  if (memberships.error) throw memberships.error;
  const versionIds = memberships.data.map(({ component_version_id }) => component_version_id);
  const versions = await client.from("paper_doll_component_versions").select("*")
    .eq("organization_id", organizationId).in("id", versionIds);
  if (versions.error) throw versions.error;
  const componentIds = [...new Set(versions.data.map(({ component_id }) => component_id))];
  const components = await client.from("paper_doll_components").select("*")
    .eq("organization_id", organizationId).in("id", componentIds);
  if (components.error) throw components.error;
  return { head: head.data, release: release.data, memberships: memberships.data, versions: versions.data, components: components.data };
}

function manifestAsset(version: JsonRecord, component: JsonRecord, membership: JsonRecord, placementVersionId?: string) {
  return {
    componentVersionId: version.id,
    componentKey: component.component_key,
    geometryFamilyId: component.geometry_family_id,
    slot: membership.slot,
    variantKey: membership.variant_key,
    materialVariant: version.material_variant,
    imagePath: version.image_path,
    imageSha256: version.image_sha256,
    geometryMaskPath: version.geometry_mask_path,
    geometryMaskSha256: version.geometry_mask_sha256,
    widthPx: version.width_px,
    heightPx: version.height_px,
    alphaBounds: version.alpha_bounds,
    mountAxisXPx: Number(version.mount_axis_x_px),
    seatYPx: Number(version.seat_y_px),
    approvalStatus: version.approval_status,
    ...(placementVersionId ? { placementVersionId } : {}),
  };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const execute = args.includes("--execute");
  const organizationId = valueAfter(args, "--organization-id") ?? DEFAULT_ORGANIZATION_ID;
  const [sourceManifestBytes, placementLockBytes] = await Promise.all([
    readFile(SOURCE_MANIFEST_PATH),
    readFile(PLACEMENT_LOCK_PATH),
  ]);
  const sourceManifest = JSON.parse(sourceManifestBytes.toString("utf8"));
  const placementLock = JSON.parse(placementLockBytes.toString("utf8"));
  if (sha256(sourceManifestBytes) !== placementLock.sourceManifestSha256) throw new Error("Source manifest bytes changed after named placement approval.");
  if (sha256(JSON.stringify({
    familyKey: placementLock.familyKey,
    geometryFamilyKey: placementLock.geometryFamilyKey,
    sourceManifestPath: placementLock.sourceManifestPath,
    sourceManifestSha256: placementLock.sourceManifestSha256,
    canvas: placementLock.canvas,
    sharedPlacement: placementLock.sharedPlacement,
    components: placementLock.components,
    bodyPlates: placementLock.bodyPlates,
    placementRows: placementLock.placementRows,
  })) !== placementLock.contentSha256) throw new Error("Placement-lock content SHA no longer matches its immutable payload.");

  const plan = buildCappedDispenserRegistrationPlan({ sourceManifest, placementLock, organizationId });
  for (const item of plan) {
    const [candidateBytes, authorityBytes] = await Promise.all([readFile(item.candidatePath), readFile(item.authorityPath)]);
    if (sha256(candidateBytes) !== item.candidateSha256) throw new Error(`Candidate bytes changed: ${item.candidatePath}`);
    if (sha256(authorityBytes) !== item.authoritySha256) throw new Error(`Authority bytes changed: ${item.authorityPath}`);
    item.version.byteSize = candidateBytes.byteLength;
  }

  if (!execute) {
    process.stdout.write(`${JSON.stringify({ mode: "dry-run", familyKey: FAMILY_KEY, releaseVersion: RELEASE_VERSION, candidates: plan.length, geometryAuthorities: new Set(plan.map(({ authoritySha256 }) => authoritySha256)).size, bodyPlates: 5, remoteWritesPerformed: false }, null, 2)}\n`);
    return;
  }
  if (!args.includes("--allow-remote-write") || valueAfter(args, "--confirmation") !== CONFIRMATION) {
    throw new Error(`Remote execution requires --execute --allow-remote-write --confirmation ${CONFIRMATION}.`);
  }
  const supabaseUrl = (process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "").trim();
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  const approverUserId = (process.env.MADISON_IMPORT_USER_ID ?? "").trim();
  if (!supabaseUrl || !serviceRoleKey || !approverUserId) throw new Error("SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and MADISON_IMPORT_USER_ID are required.");
  if (new URL(supabaseUrl).hostname.split(".")[0] !== EXPECTED_PROJECT_REF) throw new Error("Refusing to write to an unexpected Supabase project.");
  const client = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const before = await queryCurrentRelease(client, organizationId);
  if (before.release.release_version === RELEASE_VERSION) throw new Error(`${RELEASE_VERSION} is already Current; refusing a second cut.`);

  const storageActions: JsonRecord[] = [];
  const registered: Array<JsonRecord & { componentVersionId: string }> = [];
  for (const item of plan) {
    const [candidateBytes, authorityBytes] = await Promise.all([readFile(item.candidatePath), readFile(item.authorityPath)]);
    storageActions.push({ path: item.version.imagePath, action: await verifiedUpload(client, "paper-doll-approved", item.version.imagePath, candidateBytes, item.candidateSha256) });
    storageActions.push({ path: item.version.geometryMaskPath, action: await verifiedUpload(client, "paper-doll-approved", item.version.geometryMaskPath, authorityBytes, item.authoritySha256) });
    const registration = await client.rpc("register_paper_doll_approved_source", {
      p_organization_id: organizationId,
      p_component: item.component,
      p_version: item.version,
      p_qa_results: item.qaResults,
    });
    if (registration.error) throw registration.error;
    const componentVersionId = registration.data.componentVersionId as string;
    const existingIntake = await client.from("paper_doll_component_source_intakes").select("id")
      .eq("organization_id", organizationId).eq("component_version_id", componentVersionId).maybeSingle();
    if (existingIntake.error) throw existingIntake.error;
    if (!existingIntake.data) {
      const intake = await client.from("paper_doll_component_source_intakes").insert({
        organization_id: organizationId,
        family_key: FAMILY_KEY,
        component_version_id: componentVersionId,
        variant_key: item.variantKey,
        original_filename: basename(item.sourcePath),
        registrar_user_id: approverUserId,
        registrar_display_name: placementLock.approvedByName,
        intake_note: placementLock.approvalNote,
      });
      if (intake.error) throw intake.error;
    }
    registered.push({ ...item, componentVersionId });
  }

  const bodyMemberships = before.memberships.filter(({ slot }) => slot === "body");
  const bodyVersionIds = bodyMemberships.map(({ component_version_id }) => component_version_id);
  if (bodyVersionIds.length !== 5) throw new Error("Current Release no longer contains exactly five body plates.");
  const currentBodyHashes = new Set(before.versions.filter(({ id }) => bodyVersionIds.includes(id)).map(({ image_sha256 }) => image_sha256));
  for (const body of placementLock.bodyPlates) if (!currentBodyHashes.has(body.assetSha256)) throw new Error(`Current Release body changed: ${body.bodyPlateId}`);

  const placements = new Map<Lane, string>();
  for (const lane of ["sprayer", "pump"] as const) {
    const calibrationVariant = lane === "sprayer" ? "SSLV" : "MSLV";
    const calibration = registered.find((item) => item.lane === lane && item.variantKey === calibrationVariant);
    if (!calibration) throw new Error(`Missing calibration source ${lane}:${calibrationVariant}.`);
    const lock = await client.rpc("lock_paper_doll_shared_placement", {
      p_organization_id: organizationId,
      p_family_key: FAMILY_KEY,
      p_fitment_geometry_key: calibration.component.geometryFamilyId,
      p_calibration_component_version_id: calibration.componentVersionId,
      p_expected_authority_mask_sha256: calibration.authoritySha256,
      p_canvas_width_px: 2080,
      p_canvas_height_px: 2288,
      p_translate_x_px: 0,
      p_translate_y_px: 0,
      p_uniform_scale: 1,
      p_compatible_body_component_version_ids: bodyVersionIds,
      p_approver_user_id: approverUserId,
      p_approver_display_name: placementLock.approvedByName,
      p_approval_note: placementLock.approvalNote,
    });
    if (lock.error) throw lock.error;
    const placementVersionId = lock.data?.id;
    if (typeof placementVersionId !== "string") {
      throw new Error(`Placement lock for ${lane} returned no immutable placement ID.`);
    }
    placements.set(lane, placementVersionId);
  }

  const currentAssets = before.memberships.map((membership) => {
    const version = before.versions.find(({ id }) => id === membership.component_version_id);
    const component = before.components.find(({ id }) => id === version?.component_id);
    if (!version || !component) throw new Error(`Current release asset identity is incomplete: ${membership.component_version_id}`);
    return manifestAsset(version, component, membership);
  });
  const newVersionIds = registered.map(({ componentVersionId }) => componentVersionId);
  const versionRows = await client.from("paper_doll_component_versions").select("*").eq("organization_id", organizationId).in("id", newVersionIds);
  if (versionRows.error) throw versionRows.error;
  const componentRows = await client.from("paper_doll_components").select("*").eq("organization_id", organizationId)
    .in("id", [...new Set(versionRows.data.map(({ component_id }) => component_id))]);
  if (componentRows.error) throw componentRows.error;
  const newAssets = registered.map((item) => {
    const version = versionRows.data.find(({ id }) => id === item.componentVersionId);
    const component = componentRows.data.find(({ id }) => id === version?.component_id);
    if (!version || !component) throw new Error(`Registered asset identity is incomplete: ${item.componentVersionId}`);
    return manifestAsset(version, component, { slot: item.lane, variant_key: item.variantKey }, placements.get(item.lane));
  });
  const assets = [...currentAssets, ...newAssets].sort((left, right) => `${left.slot}:${left.variantKey}`.localeCompare(`${right.slot}:${right.variantKey}`));
  const available = new Set(assets.map(({ slot, variantKey }) => `${slot}:${variantKey}`));
  const mappings = buildReleaseAssemblyMappings(loadCyl9ComponentFactory());
  const readiness = buildReleaseReadiness(mappings, available);
  const blockers = [...new Set(readiness.flatMap(({ missingReasons }) => missingReasons.map((reason) => `missing_asset:${reason}`)))].sort();
  const sourceGitCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const qaEvidence = [
    ...(before.release.manifest.qaEvidence ?? []),
    ...registered.map((item) => ({
      evidenceId: `capped-source-v3-${item.candidateSha256.slice(0, 16)}`,
      subjectId: item.componentVersionId,
      gateKey: "capped-source-v3",
      gateVersion: "exact-alpha-five-body-v1",
      status: "passed",
      blocking: true,
      calibratedWith: [item.authoritySha256, ...placementLock.bodyPlates.map((body: JsonRecord) => body.assetSha256)],
      measurements: { alphaMismatchedPixels: 0, bodyPlateCount: 5, placementVersionId: placements.get(item.lane), placementLockSha256: placementLock.contentSha256 },
      issues: [],
    })),
  ];
  const manifest = {
    schemaVersion: 1,
    familyKey: FAMILY_KEY,
    releaseVersion: RELEASE_VERSION,
    status: blockers.length ? "blocked" : "ready",
    canvas: { widthPx: 2080, heightPx: 2288, backgroundHex: "#F5F3EF" },
    assets,
    assemblyRecipes: [
      { recipeKey: "CYL-9ML:ROLLON", mode: "rollon", layerOrder: ["body", "roller", "cap"] },
      { recipeKey: "CYL-9ML:SPRAY", mode: "spray", layerOrder: ["body", "sprayer"] },
      { recipeKey: "CYL-9ML:LOTION", mode: "lotion", layerOrder: ["body", "pump"] },
    ],
    assemblyMappings: mappings,
    qaEvidence,
    blockers,
    provenance: { sourceGitCommit, rendererVersion: RENDERER_VERSION },
  };
  const selectedComponents = registered.map((item) => ({
    slot: item.lane,
    variantKey: item.variantKey,
    componentVersionId: item.componentVersionId,
    placementVersionId: placements.get(item.lane),
  }));
  const cut = await client.rpc("cut_paper_doll_release", {
    p_organization_id: organizationId,
    p_family_key: FAMILY_KEY,
    p_expected_current_release_id: before.head.release_id,
    p_release_version: RELEASE_VERSION,
    p_manifest: manifest,
    p_selected_components: selectedComponents,
    p_body_component_version_ids: bodyVersionIds,
    p_sku_readiness: readiness,
    p_approver_user_id: approverUserId,
    p_approver_display_name: placementLock.approvedByName,
    p_approval_note: `${placementLock.approvalNote} Named release cut adds six closed sprayers and three closed lotion pumps; public publication remains untouched.`,
    p_source_git_commit: sourceGitCommit,
    p_renderer_version: RENDERER_VERSION,
    p_sanity_public_document_id: SANITY_PUBLIC_DOCUMENT_ID,
  });
  if (cut.error) throw cut.error;

  const evidence = {
    schemaVersion: 1,
    recordedAt: new Date().toISOString(),
    familyKey: FAMILY_KEY,
    organizationId,
    sourceReleaseId: before.head.release_id,
    sourceReleaseVersion: before.release.release_version,
    sourcePlacementLockId: placementLock.lockId,
    sourcePlacementLockSha256: placementLock.contentSha256,
    sourceGitCommit,
    registeredComponentVersions: registered.map((item) => ({ lane: item.lane, variantKey: item.variantKey, componentVersionId: item.componentVersionId, imageSha256: item.candidateSha256 })),
    placementVersionIds: Object.fromEntries(placements),
    storage: { uploaded: storageActions.filter(({ action }) => action === "uploaded").length, verifiedExisting: storageActions.filter(({ action }) => action === "verified-existing").length },
    releaseCut: cut.data,
    readiness: { ready: readiness.filter(({ status }) => status === "ready").length, incomplete: readiness.filter(({ status }) => status === "incomplete").length },
    sanity: { draftQueued: true, draftSynced: false, publicPublicationChanged: false, publicDocumentId: SANITY_PUBLIC_DOCUMENT_ID },
  };
  await writeFile(EVIDENCE_PATH, `${JSON.stringify(evidence, null, 2)}\n`, { flag: "wx" });
  process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
