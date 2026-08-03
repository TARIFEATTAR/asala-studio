import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { CandidateImportBundle } from "./build-cyl9-candidate-import-bundle";

const CONFIRMATION = "CYL9-CANDIDATE-IMPORT";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const defaultBundlePath = path.join(workspaceRoot, "outputs/paper-doll-component-factory/CYL-9ML/candidate-import-bundle.json");

export interface ImportCandidateBundleOptions {
  bundlePath: string;
  organizationId: string | null;
  requestedBy: string | null;
  execute: boolean;
  allowRemoteWrite: boolean;
  confirmation: string | null;
}

export function parseImportCandidateBundleArgs(argv: readonly string[]): ImportCandidateBundleOptions {
  const value = (name: string) => {
    const index = argv.indexOf(name);
    return index >= 0 ? argv[index + 1] ?? null : null;
  };
  return {
    bundlePath: path.resolve(value("--bundle") ?? defaultBundlePath),
    organizationId: value("--organization-id"),
    requestedBy: value("--requested-by"),
    execute: argv.includes("--execute"),
    allowRemoteWrite: argv.includes("--allow-remote-write"),
    confirmation: value("--confirmation"),
  };
}

export function assertImportCandidateBundleAuthorization(options: ImportCandidateBundleOptions): void {
  if (!options.execute) return;
  if (!options.allowRemoteWrite || options.confirmation !== CONFIRMATION) {
    throw new Error(`Remote import requires --allow-remote-write --confirmation ${CONFIRMATION}.`);
  }
  if (!options.organizationId || !UUID_PATTERN.test(options.organizationId)) {
    throw new Error("Remote import requires a valid --organization-id UUID.");
  }
  if (!options.requestedBy || !UUID_PATTERN.test(options.requestedBy)) {
    throw new Error("Remote import requires a valid --requested-by user UUID.");
  }
}

export function uuidFromSha256(value: string, namespace: string): string {
  const hex = createHash("sha256").update(`${namespace}:${value}`).digest("hex").slice(0, 32).split("");
  hex[12] = "5";
  hex[16] = ["8", "9", "a", "b"][Number.parseInt(hex[16], 16) % 4];
  const joined = hex.join("");
  return `${joined.slice(0, 8)}-${joined.slice(8, 12)}-${joined.slice(12, 16)}-${joined.slice(16, 20)}-${joined.slice(20)}`;
}

async function sha256(bytes: Uint8Array): Promise<string> {
  return createHash("sha256").update(bytes).digest("hex");
}

async function uploadImmutable(input: {
  client: SupabaseClient<any>;
  bucket: string;
  objectPath: string;
  bytes: Uint8Array;
  expectedSha256: string;
  contentType: string;
}): Promise<"uploaded" | "verified-existing"> {
  const { error } = await input.client.storage.from(input.bucket).upload(input.objectPath, input.bytes, {
    contentType: input.contentType,
    upsert: false,
  });
  if (!error) return "uploaded";
  const { data: existing, error: downloadError } = await input.client.storage.from(input.bucket).download(input.objectPath);
  if (downloadError || !existing) throw new Error(`Storage write failed for ${input.bucket}/${input.objectPath}: ${error.message}`);
  const existingSha = await sha256(new Uint8Array(await existing.arrayBuffer()));
  if (existingSha !== input.expectedSha256) {
    throw new Error(`Immutable storage collision at ${input.bucket}/${input.objectPath}.`);
  }
  return "verified-existing";
}

async function loadBundle(bundlePath: string): Promise<CandidateImportBundle> {
  const bundle = JSON.parse(await readFile(bundlePath, "utf8")) as CandidateImportBundle;
  if (bundle.schemaVersion !== 1 || bundle.familyKey !== "CYL-9ML" || bundle.candidateCount !== 21 || bundle.candidates.length !== 21) {
    throw new Error("Candidate import bundle must contain the exact 21 production-selectable CYL-9ML components.");
  }
  if (Object.values(bundle.mutationPolicy).some((value) => value !== false)) {
    throw new Error("Candidate import bundle must prove zero prior production mutations.");
  }
  if (new Set(bundle.candidates.map((item) => item.componentKey)).size !== 21) {
    throw new Error("Candidate import bundle must contain 21 distinct component identities.");
  }
  if (new Set(bundle.candidates.map((item) => item.candidate.candidateId)).size !== 21) {
    throw new Error("Candidate import bundle must contain 21 distinct immutable candidate identities.");
  }
  return bundle;
}

function cleanEnv(name: string): string {
  return process.env[name]?.trim().replace(/^['"]|['"]$/g, "") ?? "";
}

async function executeImport(options: ImportCandidateBundleOptions, bundle: CandidateImportBundle) {
  const supabaseUrl = cleanEnv("SUPABASE_URL");
  const serviceRoleKey = cleanEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the server-side shell before remote import.");
  }
  const client = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } }) as SupabaseClient<any>;
  const organizationId = options.organizationId!;
  const requestedBy = options.requestedBy!;
  const summary = { insertedComponents: 0, insertedComponentVersions: 0, existingComponentVersions: 0, importedCandidates: 0, existingCandidates: 0, uploadedObjects: 0, verifiedObjects: 0 };

  const componentKeys = bundle.candidates.map((item) => item.componentKey);
  const { data: existingComponents, error: componentsError } = await client
    .from("paper_doll_components")
    .select("id, component_key, geometry_family_id, slot")
    .eq("organization_id", organizationId)
    .in("component_key", componentKeys);
  if (componentsError) throw new Error(`Component lookup failed: ${componentsError.message}`);
  const componentsByKey = new Map((existingComponents ?? []).map((row: any) => [row.component_key, row]));

  for (const item of bundle.candidates) {
    let component = componentsByKey.get(item.componentKey) as any;
    if (component) {
      if (component.geometry_family_id !== item.geometryFamilyId || component.slot !== item.slot) {
        throw new Error(`Existing component identity conflicts with ${item.componentKey}.`);
      }
    } else {
      const { data, error } = await client.from("paper_doll_components").insert({
        organization_id: organizationId,
        component_key: item.componentKey,
        geometry_family_id: item.geometryFamilyId,
        slot: item.slot,
        display_name: item.displayName,
      }).select("id, component_key, geometry_family_id, slot").single();
      if (error || !data) throw new Error(`Component insert failed for ${item.componentKey}: ${error?.message ?? "missing row"}`);
      component = data;
      componentsByKey.set(item.componentKey, data);
      summary.insertedComponents += 1;
    }

    const candidateUuid = uuidFromSha256(item.candidate.candidateId, "candidate");
    const root = `${organizationId}/CYL-9ML/import-v1/${candidateUuid}`;
    const authorityObject = `${organizationId}/CYL-9ML/authorities/${item.candidate.authorityMaskSha256}.png`;
    const objects = [
      { bucket: "paper-doll-authority", objectPath: authorityObject, localPath: item.artifacts.authorityMaskPath, sha: item.candidate.authorityMaskSha256 },
      { bucket: "paper-doll-candidates", objectPath: `${root}/raw.png`, localPath: item.artifacts.rawPath, sha: item.artifacts.rawSha256 },
      { bucket: "paper-doll-candidates", objectPath: `${root}/candidate.png`, localPath: item.artifacts.candidatePath, sha: item.artifacts.candidateSha256 },
      { bucket: "paper-doll-candidates", objectPath: `${root}/layer.png`, localPath: item.artifacts.layerPath, sha: item.artifacts.layerSha256 },
      { bucket: "paper-doll-candidates", objectPath: `${root}/review.png`, localPath: item.artifacts.reviewPath, sha: item.artifacts.reviewSha256 },
    ];
    for (const object of objects) {
      const bytes = new Uint8Array(await readFile(object.localPath));
      if (await sha256(bytes) !== object.sha) throw new Error(`Local artifact changed before import: ${object.localPath}`);
      const state = await uploadImmutable({ client, bucket: object.bucket, objectPath: object.objectPath, bytes, expectedSha256: object.sha, contentType: "image/png" });
      if (state === "uploaded") summary.uploadedObjects += 1;
      else summary.verifiedObjects += 1;
    }

    const componentVersionUuid = uuidFromSha256(item.candidate.candidateId, "component-version");
    const { data: existingVersion, error: existingVersionError } = await client
      .from("paper_doll_component_versions")
      .select("id, component_id, image_sha256, geometry_mask_sha256, approval_status")
      .eq("organization_id", organizationId)
      .eq("id", componentVersionUuid)
      .maybeSingle();
    if (existingVersionError) throw new Error(`Component version lookup failed: ${existingVersionError.message}`);
    if (existingVersion) {
      if (existingVersion.component_id !== component.id ||
        existingVersion.image_sha256 !== item.candidate.fullCanvasLayerSha256 ||
        existingVersion.geometry_mask_sha256 !== item.candidate.authorityMaskSha256) {
        throw new Error(`Persisted component version conflicts with ${item.candidate.candidateId}.`);
      }
      summary.existingComponentVersions += 1;
    } else {
      const authority = item.candidate.authorityBoundsPx;
      const { error: versionError } = await client.from("paper_doll_component_versions").insert({
        id: componentVersionUuid,
        organization_id: organizationId,
        component_id: component.id,
        version_key: `candidate:${item.candidate.candidateId}`,
        material_variant: item.materialVariant,
        image_path: `private://paper-doll-candidates/${root}/layer.png`,
        image_sha256: item.candidate.fullCanvasLayerSha256,
        geometry_mask_path: `private://paper-doll-authority/${authorityObject}`,
        geometry_mask_sha256: item.candidate.authorityMaskSha256,
        width_px: 2080,
        height_px: 2288,
        alpha_bounds: {
          left: authority.left,
          top: authority.top,
          right: authority.left + authority.width - 1,
          bottom: authority.top + authority.height - 1,
        },
        mount_axis_x_px: authority.left + authority.width / 2,
        seat_y_px: authority.top + authority.height,
        approval_status: "candidate",
        provenance: {
          importBundle: "candidate-import-bundle-v1",
          localCandidateId: item.candidate.candidateId,
          normalizedSha256: item.candidate.normalizedCandidateSha256,
          exactAuthorityAlpha: true,
        },
      });
      if (versionError) throw new Error(`Component version insert failed for ${item.componentKey}: ${versionError.message}`);
      summary.insertedComponentVersions += 1;
    }

    const { data: existingCandidate, error: existingCandidateError } = await client
      .from("paper_doll_component_candidates")
      .select("id, normalized_sha256, authority_mask_sha256")
      .eq("organization_id", organizationId)
      .eq("id", candidateUuid)
      .maybeSingle();
    if (existingCandidateError) throw new Error(`Candidate lookup failed: ${existingCandidateError.message}`);
    if (existingCandidate) {
      if (existingCandidate.normalized_sha256 !== item.candidate.normalizedCandidateSha256 || existingCandidate.authority_mask_sha256 !== item.candidate.authorityMaskSha256) {
        throw new Error(`Persisted candidate identity conflicts with ${item.candidate.candidateId}.`);
      }
      summary.existingCandidates += 1;
      continue;
    }

    const requestUuid = uuidFromSha256(item.candidate.candidateId, "request");
    const attemptUuid = uuidFromSha256(item.candidate.candidateId, "attempt");
    const now = new Date().toISOString();
    const requestKey = `local-import-v1:${item.candidate.candidateId}`;
    const { error: requestError } = await client.from("paper_doll_candidate_requests").insert({
      id: requestUuid,
      organization_id: organizationId,
      request_key: requestKey,
      family_key: bundle.familyKey,
      component_id: component.id,
      variant_key: item.variantKey,
      original_filename: item.candidate.source.originalFilename,
      provider: item.candidate.provider,
      model: item.candidate.model,
      prompt_sha256: item.candidate.promptSha256,
      request_payload: { importBundle: "candidate-import-bundle-v1", localCandidateId: item.candidate.candidateId },
      request_status: "succeeded",
      requested_by: requestedBy,
      claimed_by: "candidate-import-v1",
      claimed_at: now,
      completed_at: now,
    });
    if (requestError && requestError.code !== "23505") throw new Error(`Candidate request insert failed: ${requestError.message}`);

    const { error: attemptError } = await client.from("paper_doll_candidate_attempts").insert({
      id: attemptUuid,
      organization_id: organizationId,
      request_id: requestUuid,
      attempt_number: 1,
      attempt_status: "succeeded",
      worker_id: "candidate-import-v1",
      result: { importedCandidateId: item.candidate.candidateId, normalizedSha256: item.candidate.normalizedCandidateSha256 },
      started_at: now,
      completed_at: now,
    });
    if (attemptError && attemptError.code !== "23505") throw new Error(`Candidate attempt insert failed: ${attemptError.message}`);

    const { error: candidateError } = await client.from("paper_doll_component_candidates").insert({
      id: candidateUuid,
      organization_id: organizationId,
      request_id: requestUuid,
      attempt_id: attemptUuid,
      component_id: component.id,
      variant_key: item.variantKey,
      original_filename: item.candidate.source.originalFilename,
      source_path: `private://paper-doll-candidates/${root}/raw.png`,
      source_sha256: item.candidate.source.sha256,
      normalized_path: `private://paper-doll-candidates/${root}/candidate.png`,
      normalized_sha256: item.candidate.normalizedCandidateSha256,
      layer_path: `private://paper-doll-candidates/${root}/layer.png`,
      layer_sha256: item.candidate.fullCanvasLayerSha256,
      authority_mask_path: `private://paper-doll-authority/${authorityObject}`,
      authority_mask_sha256: item.candidate.authorityMaskSha256,
      source_bounds: item.candidate.sourceBoundsPx,
      edit_bounds: item.candidate.editBoundsPx,
      authority_bounds: item.candidate.authorityBoundsPx,
      placement_bounds: item.candidate.placementBoundsPx,
      provider: item.candidate.provider,
      model: item.candidate.model,
      prompt_sha256: item.candidate.promptSha256,
      estimated_cost_usd: item.candidate.estimatedCostUsd,
      qa: item.candidate.qa,
      lifecycle_state: "candidate",
    });
    if (candidateError) throw new Error(`Candidate insert failed for ${item.componentKey}: ${candidateError.message}`);
    summary.importedCandidates += 1;
  }
  return summary;
}

export async function buildCandidateImportDryRun(options: ImportCandidateBundleOptions) {
  const bundle = await loadBundle(options.bundlePath);
  return {
    mode: options.execute ? "remote-write" : "dry-run",
    bundlePath: options.bundlePath,
    familyKey: bundle.familyKey,
    candidateCount: bundle.candidateCount,
    storageObjectCount: bundle.candidateCount * 4 + new Set(bundle.candidates.map((item) => item.candidate.authorityMaskSha256)).size,
    reviewCounts: bundle.candidates.reduce<Record<string, number>>((counts, item) => {
      counts[item.reviewState] = (counts[item.reviewState] ?? 0) + 1;
      return counts;
    }, {}),
    forbiddenMutations: ["approval", "placement", "current-release", "sanity-draft", "public-publication"],
  };
}

async function main() {
  const options = parseImportCandidateBundleArgs(process.argv.slice(2));
  assertImportCandidateBundleAuthorization(options);
  const dryRun = await buildCandidateImportDryRun(options);
  if (!options.execute) {
    console.log(JSON.stringify(dryRun, null, 2));
    return;
  }
  const bundle = await loadBundle(options.bundlePath);
  const result = await executeImport(options, bundle);
  console.log(JSON.stringify({ ...dryRun, result }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
