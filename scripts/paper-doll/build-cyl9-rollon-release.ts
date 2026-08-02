import "dotenv/config";

import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { loadCyl9RollonRequirements } from "../../src/lib/paperDoll/rollonRequirements";
import {
  buildRollonReleaseDraft,
  type RollonReleaseInventoryVersion,
} from "../../src/lib/paperDoll/rollonReleaseDraft.node";
import {
  loadPaperDollReleaseWorkbench,
  type PaperDollReleaseRpcClient,
} from "../../src/lib/paperDoll/releaseRepository";

const ORGANIZATION_ID = "4ab1ac72-cd7e-4faf-9152-5aa5f2862411";
const EXPECTED_PROJECT_REF = "likkskifwsrvszxdvufw";
const execFileAsync = promisify(execFile);

function argumentValue(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

function requirementKey(slot: string, variantKey: string): string {
  const kind = slot === "body" ? "BODY" : slot === "roller" ? "ROLLER" : slot === "overcap" ? "OVERCAP" : null;
  if (!kind) throw new Error(`Unsupported CYL-9ML release slot: ${slot}`);
  return `CYL-9ML:${kind}:${variantKey}`;
}

interface ApprovedVersionRow {
  id: string;
  component_id: string;
  version_key: string;
  material_variant: string;
  storage_bucket: string;
  image_path: string;
  image_sha256: string;
  geometry_mask_path: string | null;
  geometry_mask_sha256: string | null;
  width_px: number;
  height_px: number;
  alpha_bounds: { left: number; top: number; right: number; bottom: number };
  mount_axis_x_px: number | string;
  seat_y_px: number | string;
  byte_size: number | string;
  approval_status: string;
}

async function loadApprovedPlasticRoller(client: SupabaseClient): Promise<RollonReleaseInventoryVersion> {
  const componentResponse = await client
    .from("paper_doll_components")
    .select("id, component_key, geometry_family_id, slot")
    .eq("organization_id", ORGANIZATION_ID)
    .eq("component_key", "closure__17-415__plastic-roller-ball__natural")
    .maybeSingle();
  if (componentResponse.error || !componentResponse.data) {
    throw new Error(`Approved plastic roller component is unavailable: ${componentResponse.error?.message ?? "no row"}`);
  }
  const component = componentResponse.data as {
    id: string;
    component_key: string;
    geometry_family_id: string;
    slot: string;
  };
  if (component.slot !== "roller" || component.geometry_family_id !== "fitment__roller-ball__17-415__v1") {
    throw new Error("Approved plastic roller component identity drifted.");
  }

  const versionResponse = await client
    .from("paper_doll_component_versions")
    .select("id, component_id, version_key, material_variant, storage_bucket, image_path, image_sha256, geometry_mask_path, geometry_mask_sha256, width_px, height_px, alpha_bounds, mount_axis_x_px, seat_y_px, byte_size, approval_status")
    .eq("organization_id", ORGANIZATION_ID)
    .eq("component_id", component.id)
    .eq("approval_status", "approved");
  if (versionResponse.error || versionResponse.data?.length !== 1) {
    throw new Error(`Plastic roller requires exactly one approved version: ${versionResponse.error?.message ?? versionResponse.data?.length ?? 0} found`);
  }
  const version = versionResponse.data[0] as ApprovedVersionRow;
  if (
    version.storage_bucket !== "paper-doll-approved"
    || version.width_px !== 2080
    || version.height_px !== 2288
    || !version.geometry_mask_path
    || !version.geometry_mask_sha256
  ) {
    throw new Error("Approved plastic roller version violates the release asset contract.");
  }

  const qaResponse = await client
    .from("paper_doll_qa_results")
    .select("id, qa_status, blocking")
    .eq("organization_id", ORGANIZATION_ID)
    .eq("component_version_id", version.id);
  if (qaResponse.error || !qaResponse.data?.some((qa) => qa.blocking)) {
    throw new Error(`Plastic roller has no blocking QA evidence: ${qaResponse.error?.message ?? "no rows"}`);
  }
  if (qaResponse.data.some((qa) => qa.blocking && qa.qa_status !== "passed")) {
    throw new Error("Plastic roller has non-passing blocking QA.");
  }

  for (const reference of [
    { path: version.image_path, sha256: version.image_sha256, byteSize: Number(version.byte_size) },
    { path: version.geometry_mask_path, sha256: version.geometry_mask_sha256, byteSize: null },
  ]) {
    const downloaded = await client.storage.from("paper-doll-approved").download(reference.path);
    if (downloaded.error || !downloaded.data) {
      throw new Error(`Unable to verify ${reference.path}: ${downloaded.error?.message ?? "no bytes"}`);
    }
    const bytes = Buffer.from(await downloaded.data.arrayBuffer());
    if (createHash("sha256").update(bytes).digest("hex") !== reference.sha256) {
      throw new Error(`Private plastic roller object SHA mismatch: ${reference.path}`);
    }
    if (reference.byteSize !== null && bytes.byteLength !== reference.byteSize) {
      throw new Error(`Private plastic roller object byte-size mismatch: ${reference.path}`);
    }
  }

  return {
    requirementKey: "CYL-9ML:ROLLER:PLASTIC",
    componentVersionId: version.id,
    componentKey: component.component_key,
    geometryFamilyId: component.geometry_family_id,
    slot: "roller",
    variantKey: "PLASTIC",
    materialVariant: version.material_variant,
    imagePath: version.image_path,
    imageSha256: version.image_sha256,
    geometryMaskPath: version.geometry_mask_path,
    geometryMaskSha256: version.geometry_mask_sha256,
    widthPx: 2080,
    heightPx: 2288,
    alphaBounds: version.alpha_bounds,
    mountAxisXPx: Number(version.mount_axis_x_px),
    seatYPx: Number(version.seat_y_px),
    approvalStatus: "approved",
    blockingQaPassed: true,
    qaEvidenceIds: qaResponse.data.filter((qa) => qa.blocking).map((qa) => qa.id),
  };
}

async function main(): Promise<void> {
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceRoleKey) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  if (new URL(supabaseUrl).hostname.split(".")[0] !== EXPECTED_PROJECT_REF) {
    throw new Error(`Refusing to register outside the linked ${EXPECTED_PROJECT_REF} project.`);
  }
  const shouldRegister = process.argv.includes("--register");
  const releaseVersion = argumentValue("--release-version", "1.0.0-rollon-plastic-roller.1");
  const client = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const workbench = await loadPaperDollReleaseWorkbench(
    client as unknown as PaperDollReleaseRpcClient,
    ORGANIZATION_ID,
    "CYL-9ML",
  );
  if (!workbench) throw new Error("The five locked CYL-9ML body plates must be registered first.");

  const inventory: RollonReleaseInventoryVersion[] = workbench.assets.map((asset) => ({
    requirementKey: requirementKey(asset.slot, asset.variantKey),
    componentVersionId: asset.componentVersionId,
    componentKey: asset.componentKey,
    geometryFamilyId: asset.geometryFamilyId,
    slot: asset.slot as "body" | "roller" | "overcap",
    variantKey: asset.variantKey,
    materialVariant: asset.materialVariant,
    imagePath: asset.reference.objectPath,
    imageSha256: asset.reference.sha256,
    geometryMaskPath: asset.geometryMaskReference?.objectPath ?? null,
    geometryMaskSha256: asset.geometryMaskReference?.sha256 ?? null,
    widthPx: asset.widthPx as 2080,
    heightPx: asset.heightPx as 2288,
    alphaBounds: asset.alphaBounds,
    mountAxisXPx: asset.mountAxisXPx,
    seatYPx: asset.seatYPx,
    approvalStatus: asset.approvalStatus,
    blockingQaPassed: asset.qa.some((qa) => qa.blocking)
      && asset.qa.filter((qa) => qa.blocking).every((qa) => qa.status === "passed"),
    qaEvidenceIds: asset.qa.filter((qa) => qa.blocking && qa.status === "passed").map((qa) => qa.id),
  }));
  if (!inventory.some((version) => version.requirementKey === "CYL-9ML:ROLLER:PLASTIC")) {
    inventory.push(await loadApprovedPlasticRoller(client));
  }

  for (const asset of workbench.assets) {
    const downloaded = await client.storage.from(asset.reference.storageBucket).download(asset.reference.objectPath);
    if (downloaded.error || !downloaded.data) {
      throw new Error(`Unable to verify ${asset.reference.objectPath}: ${downloaded.error?.message ?? "no bytes"}`);
    }
    const bytes = Buffer.from(await downloaded.data.arrayBuffer());
    const sha = createHash("sha256").update(bytes).digest("hex");
    if (sha !== asset.reference.sha256 || bytes.byteLength !== asset.reference.byteSize) {
      throw new Error(`Private object identity mismatch: ${asset.reference.objectPath}`);
    }
  }

  const renderReport = JSON.parse(await readFile("docs/paper-doll-rig/cyl9-rollon-render-report.json", "utf8")) as {
    rendererVersion: string;
    geometryRecipeSha256: string;
  };
  const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"]);
  const draft = buildRollonReleaseDraft({
    requirements: loadCyl9RollonRequirements(),
    inventory,
    releaseVersion,
    sourceGitCommit: stdout.trim(),
    rendererVersion: renderReport.rendererVersion,
    rendererRecipeSha256: renderReport.geometryRecipeSha256,
  });

  let registration: unknown = { dryRun: true, sanityPublished: false };
  if (shouldRegister) {
    const response = await client.rpc("register_paper_doll_release_draft", {
      p_organization_id: ORGANIZATION_ID,
      p_manifest: draft.manifest,
      p_manifest_sha256: draft.manifestSha256,
      p_source_git_commit: stdout.trim(),
      p_renderer_version: renderReport.rendererVersion,
    });
    if (response.error) throw new Error(`Release registration failed: ${response.error.message}`);
    registration = response.data;
  }

  process.stdout.write(`${JSON.stringify({
    releaseVersion,
    releaseStatus: draft.releaseStatus,
    counts: draft.counts,
    blockers: draft.blockers,
    manifestSha256: draft.manifestSha256,
    verifiedPrivateAssets: inventory.length,
    registration,
  }, null, 2)}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`CYL-9ML roll-on release build failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
