#!/usr/bin/env tsx

/**
 * Cut the CYL-9ML roller-seat release: replace the two roller layers of the
 * Current Release (1.3.1-clean-caps.1) with the assembled-position v2
 * versions recorded in docs/paper-doll-rig/cyl9-roller-assembled-v2-lock.json.
 * Every other layer (bodies, caps, sprayers, pumps) is carried forward
 * unchanged. The roller placement lock fbe551b9… rides along as bake
 * provenance; the storefront canvas can now stack the layer verbatim.
 */

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  buildReleaseAssemblyMappings,
  buildReleaseReadiness,
} from "./register-cyl9-capped-dispenser-release";
import { loadCyl9ComponentFactory } from "../../src/lib/paperDoll/cyl9ComponentFactory";

const EXPECTED_PROJECT_REF = "likkskifwsrvszxdvufw";
const DEFAULT_ORGANIZATION_ID = "4ab1ac72-cd7e-4faf-9152-5aa5f2862411";
const FAMILY_KEY = "CYL-9ML";
const RELEASE_VERSION = "1.3.2-roller-seat.1";
const RENDERER_VERSION = "paper-doll-complete-family-v1";
const SANITY_PUBLIC_DOCUMENT_ID = "d5291f24-f02b-4fb7-aa99-78c5f63d8c9d";
const CONFIRMATION = "CYL9-ROLLER-SEAT-RELEASE";
const ROLLER_LOCK_PATH = "docs/paper-doll-rig/cyl9-roller-assembled-v2-lock.json";
const PLACEMENT_EVIDENCE_PATH = "docs/paper-doll-rig/cyl9-roller-assembled-v2-placement.json";
const EVIDENCE_PATH = "docs/paper-doll-rig/cyl9-roller-seat-v2-remote-release.json";
// Identity lock for the assembled roller versions (d975a5a4…), created by
// lock-cyl9-roller-assembled-placement.ts and re-read from evidence at runtime.
let ROLLER_PLACEMENT_VERSION_ID = "";

type JsonRecord = Record<string, any>;

const REQUIRED_VARIANTS: Record<string, string[]> = {
  body: ["AMB", "BLU", "CLR", "FRS", "SWL"],
  roller: ["METAL", "PLASTIC"],
  cap: ["BKDT", "MCPR", "MGLD", "MSLV", "PKDT", "SBLK", "SGLD", "SLDT", "SSLV", "WHT"],
  sprayer: ["BLK", "GLD", "MSLV", "RED", "SSLV", "TUR"],
  pump: ["BLK", "GLD", "MSLV"],
};

function sha256(value: Buffer | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function valueAfter(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

function sortedIdentity(asset: JsonRecord): string {
  return `${asset.slot}:${asset.variantKey}`;
}

function assertCompleteAssetSet(assets: JsonRecord[]): void {
  const expected = Object.entries(REQUIRED_VARIANTS)
    .flatMap(([slot, variants]) => variants.map((variant) => `${slot}:${variant}`))
    .sort();
  const actual = assets.map(sortedIdentity).sort();
  if (actual.length !== expected.length || actual.some((identity, index) => identity !== expected[index])) {
    throw new Error(`CYL-9ML asset set is incomplete or duplicated. Expected ${expected.join(", ")}; received ${actual.join(", ")}.`);
  }
  for (const asset of assets) {
    if (
      asset.approvalStatus !== "approved"
      || asset.widthPx !== 2080
      || asset.heightPx !== 2288
      || typeof asset.imageSha256 !== "string"
      || !/^[a-f0-9]{64}$/.test(asset.imageSha256)
    ) {
      throw new Error(`Release asset ${sortedIdentity(asset)} violates the approved 2080×2288 contract.`);
    }
    if (asset.slot !== "body" && !asset.placementVersionId) {
      throw new Error(`Release component ${sortedIdentity(asset)} lacks immutable placement truth.`);
    }
  }
}

async function loadCurrentRelease(client: SupabaseClient, organizationId: string) {
  const head = await client.from("paper_doll_family_release_heads")
    .select("release_id,release_cut_id")
    .eq("organization_id", organizationId)
    .eq("family_key", FAMILY_KEY)
    .single();
  if (head.error) throw head.error;
  const release = await client.from("paper_doll_family_releases")
    .select("id,release_version,manifest,manifest_sha256")
    .eq("organization_id", organizationId)
    .eq("id", head.data.release_id)
    .single();
  if (release.error) throw release.error;
  const memberships = await client.from("paper_doll_family_release_assets")
    .select("component_version_id,slot,variant_key")
    .eq("organization_id", organizationId)
    .eq("release_id", head.data.release_id);
  if (memberships.error) throw memberships.error;
  return { head: head.data, release: release.data, memberships: memberships.data };
}

async function loadRollerAssets(client: SupabaseClient, organizationId: string, rollerLock: JsonRecord) {
  const expected = rollerLock.rollerComponentVersions as JsonRecord[];
  if (expected.length !== 2) throw new Error("The roller lock must record exactly two assembled versions.");
  const versions = await client.from("paper_doll_component_versions")
    .select("*")
    .eq("organization_id", organizationId)
    .in("id", expected.map(({ componentVersionId }) => componentVersionId));
  if (versions.error || versions.data.length !== 2) {
    throw versions.error ?? new Error("The two assembled roller versions are not available remotely.");
  }
  const component = await client.from("paper_doll_components")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", versions.data[0].component_id)
    .single();
  if (component.error || component.data.slot !== "roller") {
    throw component.error ?? new Error("The roller component identity is missing.");
  }
  return expected.map((locked) => {
    const version = versions.data.find(({ id }) => id === locked.componentVersionId);
    if (
      !version
      || version.approval_status !== "approved"
      || version.image_sha256 !== locked.imageSha256
      || version.geometry_mask_sha256 !== rollerLock.assembledAuthorityMaskSha256
    ) {
      throw new Error(`Roller ${locked.variantKey} differs from its immutable lock evidence.`);
    }
    return {
      componentVersionId: version.id,
      componentKey: component.data.component_key,
      geometryFamilyId: component.data.geometry_family_id,
      slot: "roller",
      variantKey: locked.variantKey,
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
      placementVersionId: ROLLER_PLACEMENT_VERSION_ID,
    };
  });
}

export function buildRollerSeatReleasePlan(input: {
  currentManifest: JsonRecord;
  rollerAssets: JsonRecord[];
  mappings: ReturnType<typeof buildReleaseAssemblyMappings>;
  releaseVersion: string;
  sourceGitCommit: string;
  rendererVersion: string;
  assembledMaskSha256: string;
}) {
  if (
    input.currentManifest.familyKey !== FAMILY_KEY
    || input.currentManifest.assets?.length !== 26
    || input.rollerAssets.length !== 2
    || input.mappings.length !== 145
    || !/^[a-f0-9]{64}$/.test(input.assembledMaskSha256)
  ) {
    throw new Error("The CYL-9ML roller-seat inputs are incomplete or stale.");
  }
  const carriedAssets = input.currentManifest.assets.filter((asset: JsonRecord) => asset.slot !== "roller");
  if (carriedAssets.length !== 24) {
    throw new Error("The Current Release must carry exactly twenty-four non-roller layers forward.");
  }
  const assets = [...carriedAssets, ...input.rollerAssets]
    .sort((left, right) => sortedIdentity(left).localeCompare(sortedIdentity(right)));
  assertCompleteAssetSet(assets);
  const available = new Set(assets.map(({ slot, variantKey }) => `${slot}:${variantKey}`));
  const readiness = buildReleaseReadiness(input.mappings, available);
  const blockers = [...new Set(readiness.flatMap(({ missingReasons }) =>
    missingReasons.map((reason) => `missing_asset:${reason}`)
  ))].sort();
  const qaEvidence = [
    ...(input.currentManifest.qaEvidence ?? []),
    ...input.rollerAssets.map((asset) => ({
      evidenceId: `roller-assembled-v2-${asset.imageSha256.slice(0, 16)}`,
      subjectId: asset.componentVersionId,
      gateKey: "roller-assembled-v2",
      gateVersion: "exact-alpha-contact-y760",
      status: "passed",
      blocking: true,
      calibratedWith: [input.assembledMaskSha256],
      measurements: {
        alphaMismatchedPixels: 0,
        contactYPx: 760,
        placementVersionId: ROLLER_PLACEMENT_VERSION_ID,
        translateXPx: 27.066,
        translateYPx: -134.132,
        uniformScale: 0.974,
      },
      issues: [],
    })),
  ];
  const manifest = {
    ...input.currentManifest,
    releaseVersion: input.releaseVersion,
    status: blockers.length ? "blocked" : "ready",
    assets,
    assemblyMappings: input.mappings,
    qaEvidence,
    blockers,
    provenance: {
      sourceGitCommit: input.sourceGitCommit,
      rendererVersion: input.rendererVersion,
    },
  };
  return {
    manifest,
    readiness,
    selectedComponents: input.rollerAssets.map((asset) => ({
      slot: "roller",
      variantKey: asset.variantKey,
      componentVersionId: asset.componentVersionId,
      placementVersionId: ROLLER_PLACEMENT_VERSION_ID,
    })),
  };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const execute = args.includes("--execute");
  const organizationId = valueAfter(args, "--organization-id") ?? DEFAULT_ORGANIZATION_ID;
  const approvedByName = valueAfter(args, "--approved-by")?.trim() ?? "";
  const approvalNote = valueAfter(args, "--approval-note")?.trim() ?? "";
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
  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const rollerLock = JSON.parse(await readFile(ROLLER_LOCK_PATH, "utf8"));
  const { contentSha256, ...lockPayload } = rollerLock;
  if (sha256(JSON.stringify(lockPayload)) !== contentSha256) {
    throw new Error("The immutable roller rebake evidence hash no longer matches.");
  }
  const placementEvidence = JSON.parse(await readFile(PLACEMENT_EVIDENCE_PATH, "utf8"));
  const { contentSha256: placementSha, ...placementPayload } = placementEvidence;
  if (sha256(JSON.stringify(placementPayload)) !== placementSha) {
    throw new Error("The roller placement evidence hash no longer matches.");
  }
  if (placementEvidence.authorityMaskSha256 !== rollerLock.assembledAuthorityMaskSha256) {
    throw new Error("The placement lock authority differs from the rebaked roller mask.");
  }
  ROLLER_PLACEMENT_VERSION_ID = placementEvidence.placementVersionId;
  const [current, rollerAssets] = await Promise.all([
    loadCurrentRelease(client, organizationId),
    loadRollerAssets(client, organizationId, rollerLock),
  ]);
  if (current.release.release_version === RELEASE_VERSION) {
    throw new Error(`${RELEASE_VERSION} is already Current; refusing a second release cut.`);
  }
  if (current.release.release_version !== "1.3.1-clean-caps.1") {
    throw new Error(`Expected to cut from 1.3.1-clean-caps.1; Current is ${current.release.release_version}.`);
  }
  const sourceGitCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const plan = buildRollerSeatReleasePlan({
    currentManifest: current.release.manifest,
    rollerAssets,
    mappings: buildReleaseAssemblyMappings(loadCyl9ComponentFactory()),
    releaseVersion: RELEASE_VERSION,
    sourceGitCommit,
    rendererVersion: RENDERER_VERSION,
    assembledMaskSha256: rollerLock.assembledAuthorityMaskSha256,
  });
  const bodyIds = current.memberships
    .filter(({ slot }) => slot === "body")
    .map(({ component_version_id }) => component_version_id)
    .sort();
  if (bodyIds.length !== 5) throw new Error("Current Release must contain exactly five locked bodies.");

  if (!execute) {
    process.stdout.write(`${JSON.stringify({
      mode: "dry-run",
      sourceReleaseId: current.head.release_id,
      sourceReleaseVersion: current.release.release_version,
      releaseVersion: RELEASE_VERSION,
      assetCount: plan.manifest.assets.length,
      rollerBounds: rollerAssets[0].alphaBounds,
      countsBySlot: Object.fromEntries(Object.keys(REQUIRED_VARIANTS).map((slot) => [
        slot,
        plan.manifest.assets.filter((asset: JsonRecord) => asset.slot === slot).length,
      ])),
      catalogReadiness: {
        ready: plan.readiness.filter(({ status }) => status === "ready").length,
        incomplete: plan.readiness.filter(({ status }) => status === "incomplete").length,
      },
      blockers: plan.manifest.blockers,
      remoteWritesPerformed: false,
    }, null, 2)}\n`);
    return;
  }
  if (!args.includes("--allow-remote-write") || valueAfter(args, "--confirmation") !== CONFIRMATION) {
    throw new Error(`Remote execution requires --execute --allow-remote-write --confirmation ${CONFIRMATION}.`);
  }
  const cut = await client.rpc("cut_paper_doll_release", {
    p_organization_id: organizationId,
    p_family_key: FAMILY_KEY,
    p_expected_current_release_id: current.head.release_id,
    p_release_version: RELEASE_VERSION,
    p_manifest: plan.manifest,
    p_selected_components: plan.selectedComponents,
    p_body_component_version_ids: bodyIds,
    p_sku_readiness: plan.readiness,
    p_approver_user_id: approverUserId,
    p_approver_display_name: approvedByName,
    p_approval_note: approvalNote,
    p_source_git_commit: sourceGitCommit,
    p_renderer_version: RENDERER_VERSION,
    p_sanity_public_document_id: SANITY_PUBLIC_DOCUMENT_ID,
  });
  if (cut.error) throw cut.error;
  const evidence = {
    schemaVersion: 1,
    recordedAt: new Date().toISOString(),
    organizationId,
    familyKey: FAMILY_KEY,
    sourceReleaseId: current.head.release_id,
    sourceReleaseVersion: current.release.release_version,
    releaseVersion: RELEASE_VERSION,
    sourceGitCommit,
    rollerComponentVersionIds: rollerAssets.map(({ componentVersionId, variantKey }) => ({ componentVersionId, variantKey })),
    releaseCut: cut.data,
    sanity: {
      draftQueued: true,
      draftSynced: false,
      draftDocumentId: `drafts.${SANITY_PUBLIC_DOCUMENT_ID}`,
      publicPublicationPerformed: false,
    },
  };
  await writeFile(EVIDENCE_PATH, `${JSON.stringify(evidence, null, 2)}\n`, { flag: "wx" });
  process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    const detail = error instanceof Error ? error.stack ?? error.message : JSON.stringify(error, null, 2);
    process.stderr.write(`${detail}\n`);
    process.exitCode = 1;
  });
}
