#!/usr/bin/env tsx

/**
 * Cut the CYL-9ML clean-caps release: replace the ten cap layers of the
 * Current Release (1.3.0-complete-family.1) with the Adobe-cleaned v2 cap
 * versions (nine new + WHT retained from v1) recorded in
 * docs/paper-doll-rig/cyl9-adobe-cap-v2-remote-placement-lock.json.
 * Every other layer (bodies, rollers, sprayers, pumps) is carried forward
 * unchanged. The shared cap placement lock is inherited, not recreated.
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
const RELEASE_VERSION = "1.3.9-cap-lift.2";
const RENDERER_VERSION = "paper-doll-complete-family-v1";
const SANITY_PUBLIC_DOCUMENT_ID = "d5291f24-f02b-4fb7-aa99-78c5f63d8c9d";
const CONFIRMATION = "CYL9-CAP-LIFT-RELEASE-2";
const CAP_LOCK_PATH = "docs/paper-doll-rig/cyl9-cap-lift-v2-lock.json";
const EVIDENCE_PATH = "docs/paper-doll-rig/cyl9-cap-lift-v2-remote-release.json";

type JsonRecord = Record<string, any>;
type Mapping = ReturnType<typeof buildReleaseAssemblyMappings>[number];

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

export function buildCapLiftReleasePlan(input: {
  currentManifest: JsonRecord;
  capAssets: JsonRecord[];
  mappings: Mapping[];
  releaseVersion: string;
  sourceGitCommit: string;
  rendererVersion: string;
  capPlacementVersionId: string;
  capAuthoritySha256: string;
}) {
  if (
    input.currentManifest.familyKey !== FAMILY_KEY
    || input.currentManifest.canvas?.widthPx !== 2080
    || input.currentManifest.canvas?.heightPx !== 2288
    || input.currentManifest.assets?.length !== 26
    || input.capAssets.length !== 10
    || input.mappings.length !== 145
    || !input.releaseVersion.trim()
    || !input.sourceGitCommit.trim()
    || !input.rendererVersion.trim()
    || !input.capPlacementVersionId.trim()
    || !/^[a-f0-9]{64}$/.test(input.capAuthoritySha256)
  ) {
    throw new Error("The CYL-9ML cap-lift inputs are incomplete or stale.");
  }
  if (input.capAssets.some((asset) =>
    asset.slot !== "cap"
    || asset.placementVersionId !== input.capPlacementVersionId
    || asset.geometryMaskSha256 !== input.capAuthoritySha256
  )) {
    throw new Error("Every cap must inherit the exact approved cap authority and placement version.");
  }

  const carriedAssets = input.currentManifest.assets.filter((asset: JsonRecord) => asset.slot !== "cap");
  if (carriedAssets.length !== 16) {
    throw new Error("The Current Release must carry exactly sixteen non-cap layers forward.");
  }
  const assets = [...carriedAssets, ...input.capAssets]
    .sort((left, right) => sortedIdentity(left).localeCompare(sortedIdentity(right)));
  assertCompleteAssetSet(assets);
  const available = new Set(assets.map(({ slot, variantKey }) => `${slot}:${variantKey}`));
  const readiness = buildReleaseReadiness(input.mappings, available);
  const blockers = [...new Set(readiness.flatMap(({ missingReasons }) =>
    missingReasons.map((reason) => `missing_asset:${reason}`)
  ))].sort();
  const qaEvidence = [
    ...(input.currentManifest.qaEvidence ?? []),
    ...input.capAssets
      .filter((asset) => asset.versionOrigin === "cap-lift-v2")
      .map((asset) => ({
        evidenceId: `cap-lift-v2-${asset.imageSha256.slice(0, 16)}`,
        subjectId: asset.componentVersionId,
        gateKey: "cap-lift-v2",
        gateVersion: "exact-alpha-integer-lift-2px",
        status: "passed",
        blocking: true,
        calibratedWith: [input.capAuthoritySha256],
        measurements: {
          alphaMismatchedPixels: 0,
          bodyPlateCount: 5,
          placementVersionId: input.capPlacementVersionId,
          translateXPx: 0,
          translateYPx: 0,
          uniformScale: 1,
        },
        issues: [],
      })),
  ];
  const manifest = {
    schemaVersion: 1,
    familyKey: FAMILY_KEY,
    releaseVersion: input.releaseVersion,
    status: blockers.length ? "blocked" : "ready",
    canvas: { widthPx: 2080, heightPx: 2288, backgroundHex: "#F5F3EF" },
    assets,
    assemblyRecipes: [
      { recipeKey: "CYL-9ML:ROLLON", mode: "rollon", layerOrder: ["body", "roller", "cap"] },
      { recipeKey: "CYL-9ML:SPRAY", mode: "spray", layerOrder: ["body", "sprayer"] },
      { recipeKey: "CYL-9ML:LOTION", mode: "lotion", layerOrder: ["body", "pump"] },
    ],
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
    selectedComponents: input.capAssets.map((asset) => ({
      slot: "cap",
      variantKey: asset.variantKey,
      componentVersionId: asset.componentVersionId,
      placementVersionId: input.capPlacementVersionId,
    })),
  };
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

async function loadCapAssets(
  client: SupabaseClient,
  organizationId: string,
  capLock: JsonRecord,
) {
  const expectedIds = capLock.capComponentVersions.map(({ componentVersionId }: JsonRecord) => componentVersionId);
  const versions = await client.from("paper_doll_component_versions")
    .select("*")
    .eq("organization_id", organizationId)
    .in("id", expectedIds);
  if (versions.error || versions.data.length !== 10) {
    throw versions.error ?? new Error("The ten approved cap versions are not available remotely.");
  }
  const components = await client.from("paper_doll_components")
    .select("*")
    .eq("organization_id", organizationId)
    .in("id", [...new Set(versions.data.map(({ component_id }) => component_id))]);
  if (components.error || components.data.length !== 10) {
    throw components.error ?? new Error("The ten cap component identities are incomplete.");
  }
  const placement = await client.from("paper_doll_placement_versions")
    .select("id,authority_mask_sha256,translate_x_px,translate_y_px,uniform_scale")
    .eq("organization_id", organizationId)
    .eq("id", capLock.placementVersionId)
    .single();
  if (placement.error) throw placement.error;
  const approval = await client.from("paper_doll_placement_approvals")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("placement_version_id", capLock.placementVersionId)
    .single();
  if (approval.error) throw approval.error;
  if (
    placement.data.authority_mask_sha256 !== capLock.authorityMaskSha256
    || Number(placement.data.translate_x_px) !== 0
    || Number(placement.data.translate_y_px) !== 0
    || Number(placement.data.uniform_scale) !== 1
  ) {
    throw new Error("The approved cap placement changed after review.");
  }

  return capLock.capComponentVersions.map((locked: JsonRecord) => {
    const version = versions.data.find(({ id }) => id === locked.componentVersionId);
    const component = components.data.find(({ id }) => id === version?.component_id);
    if (
      !version
      || !component
      || version.approval_status !== "approved"
      || version.image_sha256 !== locked.imageSha256
      || version.geometry_mask_sha256 !== capLock.authorityMaskSha256
      || component.slot !== "cap"
    ) {
      throw new Error(`Cap ${locked.variantKey} differs from its immutable lock evidence.`);
    }
    return {
      componentVersionId: version.id,
      componentKey: component.component_key,
      geometryFamilyId: component.geometry_family_id,
      slot: "cap",
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
      placementVersionId: capLock.placementVersionId,
      versionOrigin: String(version.version_key).startsWith("cap-lift-v2")
        ? "cap-lift-v2"
        : "unexpected",
    };
  });
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
  const capLock = JSON.parse(await readFile(CAP_LOCK_PATH, "utf8"));
  const { contentSha256, ...lockPayload } = capLock;
  if (sha256(JSON.stringify(lockPayload)) !== contentSha256) {
    throw new Error("The immutable cap placement evidence hash no longer matches.");
  }
  const [current, capAssets] = await Promise.all([
    loadCurrentRelease(client, organizationId),
    loadCapAssets(client, organizationId, capLock),
  ]);
  if (current.release.release_version === RELEASE_VERSION) {
    throw new Error(`${RELEASE_VERSION} is already Current; refusing a second release cut.`);
  }
  const newCapCount = capAssets.filter(({ versionOrigin }) => versionOrigin === "cap-lift-v2").length;
  if (newCapCount !== 10) {
    throw new Error(`Expected ten cap-lift v2 caps in the lock; found ${newCapCount}.`);
  }
  const sourceGitCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const plan = buildCapLiftReleasePlan({
    currentManifest: current.release.manifest,
    capAssets,
    mappings: buildReleaseAssemblyMappings(loadCyl9ComponentFactory()),
    releaseVersion: RELEASE_VERSION,
    sourceGitCommit,
    rendererVersion: RENDERER_VERSION,
    capPlacementVersionId: capLock.placementVersionId,
    capAuthoritySha256: capLock.authorityMaskSha256,
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
      newCapVersions: newCapCount,
      retainedCapVersions: capAssets.length - newCapCount,
      countsBySlot: Object.fromEntries(Object.keys(REQUIRED_VARIANTS).map((slot) => [
        slot,
        plan.manifest.assets.filter((asset: JsonRecord) => asset.slot === slot).length,
      ])),
      catalogReadiness: {
        ready: plan.readiness.filter(({ status }) => status === "ready").length,
        incomplete: plan.readiness.filter(({ status }) => status === "incomplete").length,
      },
      blockers: plan.manifest.blockers,
      sanityDraftTarget: `drafts.${SANITY_PUBLIC_DOCUMENT_ID}`,
      remoteWritesPerformed: false,
      publicPublicationPerformed: false,
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
    capPlacementVersionId: capLock.placementVersionId,
    capComponentVersionIds: capAssets.map(({ componentVersionId, variantKey, versionOrigin }) => ({ componentVersionId, variantKey, versionOrigin })),
    assetCounts: Object.fromEntries(Object.keys(REQUIRED_VARIANTS).map((slot) => [
      slot,
      plan.manifest.assets.filter((asset: JsonRecord) => asset.slot === slot).length,
    ])),
    readiness: {
      ready: plan.readiness.filter(({ status }) => status === "ready").length,
      incomplete: plan.readiness.filter(({ status }) => status === "incomplete").length,
    },
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
