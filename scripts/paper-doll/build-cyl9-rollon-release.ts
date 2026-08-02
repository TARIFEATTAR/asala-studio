import "dotenv/config";

import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";

import { createClient } from "@supabase/supabase-js";

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

async function main(): Promise<void> {
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceRoleKey) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  if (new URL(supabaseUrl).hostname.split(".")[0] !== EXPECTED_PROJECT_REF) {
    throw new Error(`Refusing to register outside the linked ${EXPECTED_PROJECT_REF} project.`);
  }
  const shouldRegister = process.argv.includes("--register");
  const releaseVersion = argumentValue("--release-version", "1.0.0-rollon-draft.1");
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
    verifiedPrivateAssets: workbench.assets.length,
    registration,
  }, null, 2)}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`CYL-9ML roll-on release build failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
