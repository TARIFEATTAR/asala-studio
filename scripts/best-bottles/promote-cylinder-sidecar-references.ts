#!/usr/bin/env tsx
import "dotenv/config";

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";

import {
  CYLINDER_SIDECAR_RECONCILIATION_VERSION,
} from "../../src/lib/bestBottlesCylinderSidecarReconciliation";
import {
  buildCylinderSidecarPromotionPlan,
  type CylinderSidecarPromotionRecord,
} from "../../src/lib/bestBottlesCylinderSidecarPromotion";
import {
  executeCylinderReferencePromotion,
  type CylinderPromotionLiveJob,
  type CylinderReferencePromotionExecutionAdapter,
} from "../../src/lib/bestBottlesCylinderReferencePromotionExecution";
import type {
  CylinderPromotionPipelineJob,
  CylinderPromotionRemoteObject,
  CylinderReferencePromotionPlan,
} from "../../src/lib/bestBottlesCylinderReferencePromotion";

const ORGANIZATION_ID = "4ab1ac72-cd7e-4faf-9152-5aa5f2862411";
const BUCKET = "reference-images";
const EXPECTED_COUNT = 228;
const MANIFEST_PATH = resolve(
  "tmp/best-bottles-reference-production/cylinder-sidecar-reconciliation-v2/cylinder-sidecar-reconciliation-manifest.json",
);
const OUTPUT_ROOT = resolve(
  "tmp/best-bottles-reference-production/cylinder-sidecar-promotion-v2",
);

interface SidecarManifest {
  version: typeof CYLINDER_SIDECAR_RECONCILIATION_VERSION;
  summary: { targetCount: number; blockedCount: number };
  records: CylinderSidecarPromotionRecord[];
}

function sha256(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function stableJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function env(name: string): string {
  return String(process.env[name] ?? "").trim();
}

function storageError(error: unknown): string {
  const candidate = error as { name?: unknown; message?: unknown; statusCode?: unknown };
  return JSON.stringify({
    name: candidate?.name,
    message: candidate?.message,
    statusCode: candidate?.statusCode,
  });
}

async function mapLimited<T, R>(
  items: readonly T[],
  concurrency: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await task(items[index]);
    }
  }));
  return results;
}

async function loadAndVerifyManifest(): Promise<{ manifest: SidecarManifest; manifestSha256: string }> {
  const bytes = await readFile(MANIFEST_PATH);
  const manifest = JSON.parse(bytes.toString("utf8")) as SidecarManifest;
  if (
    manifest.version !== CYLINDER_SIDECAR_RECONCILIATION_VERSION
    || manifest.summary.targetCount !== EXPECTED_COUNT
    || manifest.summary.blockedCount !== 0
    || manifest.records.length !== EXPECTED_COUNT
  ) {
    throw new Error("Sidecar promotion requires the reviewed 228-record v2 manifest with zero blockers.");
  }
  const identities = new Set<string>();
  await mapLimited(manifest.records, 8, async (record) => {
    if (identities.has(record.canonicalIdentityKey)) {
      throw new Error(`Duplicate sidecar identity ${record.canonicalIdentityKey}.`);
    }
    identities.add(record.canonicalIdentityKey);
    const localBytes = await readFile(record.output.path);
    if (
      localBytes.length !== record.output.bytes
      || sha256(localBytes) !== record.output.sha256
    ) {
      throw new Error(`Local sidecar bytes disagree for ${record.canonicalIdentityKey}.`);
    }
    const image = sharp(localBytes, { failOn: "error" });
    const [metadata, stats] = await Promise.all([image.metadata(), image.stats()]);
    if (
      metadata.format !== "png"
      || metadata.width !== record.output.width
      || metadata.height !== record.output.height
      || stats.isOpaque !== true
    ) {
      throw new Error(`Local sidecar PNG inspection disagrees for ${record.canonicalIdentityKey}.`);
    }
  });
  return { manifest, manifestSha256: sha256(bytes) };
}

async function fetchPipelineJobs(client: SupabaseClient): Promise<CylinderPromotionPipelineJob[]> {
  const rows: CylinderPromotionPipelineJob[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await client
      .from("best_bottles_pipeline_sku_jobs")
      .select("id,website_sku,grace_sku,family,best_reference_candidate_path")
      .eq("organization_id", ORGANIZATION_ID)
      .eq("family", "Cylinder")
      .order("id")
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`Pipeline job read failed: ${error.message}`);
    const page = (data ?? []).map((row) => ({
      id: String(row.id),
      websiteSku: row.website_sku == null ? null : String(row.website_sku),
      graceSku: String(row.grace_sku ?? ""),
      family: String(row.family ?? ""),
      bestReferenceCandidatePath: row.best_reference_candidate_path == null
        ? null
        : String(row.best_reference_candidate_path),
    }));
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

async function auditRemoteObjects(
  client: SupabaseClient,
  plan: CylinderReferencePromotionPlan,
): Promise<CylinderPromotionRemoteObject[]> {
  return mapLimited(plan.rows, 8, async (row) => {
    const storagePath = row.storage.path;
    const separator = storagePath.lastIndexOf("/");
    const folder = storagePath.slice(0, separator);
    const filename = storagePath.slice(separator + 1);
    const listed = await client.storage.from(row.storage.bucket).list(folder, {
      limit: 2,
      search: filename,
    });
    if (listed.error) {
      return { path: storagePath, status: "error" as const, error: storageError(listed.error) };
    }
    if (!(listed.data ?? []).some((item) => item.name === filename)) {
      return { path: storagePath, status: "absent" as const };
    }
    const downloaded = await client.storage.from(row.storage.bucket).download(storagePath);
    if (downloaded.error) {
      return { path: storagePath, status: "error" as const, error: storageError(downloaded.error) };
    }
    const bytes = new Uint8Array(await downloaded.data.arrayBuffer());
    return { path: storagePath, status: "present" as const, sha256: sha256(bytes), bytes: bytes.length };
  });
}

async function writePreflight(input: {
  plan: CylinderReferencePromotionPlan;
  manifestSha256: string;
}): Promise<{ path: string; seal: string }> {
  const unsigned = {
    version: "best-bottles-cylinder-sidecar-promotion-preflight-v2",
    generatedAt: new Date().toISOString(),
    mode: "read-only",
    sourceManifestPath: MANIFEST_PATH,
    sourceManifestSha256: input.manifestSha256,
    plan: input.plan,
  };
  const seal = sha256(stableJson(unsigned));
  const path = resolve(OUTPUT_ROOT, "cylinder-sidecar-promotion-preflight.json");
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, stableJson({ ...unsigned, preflightSha256: seal }));
  return { path, seal };
}

async function main(): Promise<void> {
  const execute = process.argv.includes("--execute");
  const supabaseUrl = env("SUPABASE_URL") || env("VITE_SUPABASE_URL");
  const serviceRoleKey = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase URL and service-role credentials are required.");
  }
  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { manifest, manifestSha256 } = await loadAndVerifyManifest();
  const jobs = await fetchPipelineJobs(client);
  const initial = buildCylinderSidecarPromotionPlan({
    records: manifest.records,
    jobs,
    remoteObjects: [],
    bucket: BUCKET,
    supabaseUrl,
    expectedCount: EXPECTED_COUNT,
  });
  const remoteObjects = await auditRemoteObjects(client, initial);
  const plan = buildCylinderSidecarPromotionPlan({
    records: manifest.records,
    jobs,
    remoteObjects,
    bucket: BUCKET,
    supabaseUrl,
    expectedCount: EXPECTED_COUNT,
  });
  const preflight = await writePreflight({ plan, manifestSha256 });

  if (!execute) {
    process.stdout.write(`${JSON.stringify({
      mode: "dry-run",
      message: "Pass --execute to upload verified sidecar-v2 objects and repoint the exact 228 jobs.",
      preflightPath: preflight.path,
      preflightSha256: preflight.seal,
      summary: plan.summary,
    }, null, 2)}\n`);
    return;
  }
  if (plan.summary.blockedCount !== 0 || plan.rows.length !== EXPECTED_COUNT) {
    throw new Error(`Refusing sidecar promotion with ${plan.summary.blockedCount} blocked records.`);
  }

  const jobIds = plan.rows.map((row) => {
    if (row.pipeline.status !== "needs-repoint" && row.pipeline.status !== "already-target") {
      throw new Error(`${row.canonicalIdentityKey} has no exact pipeline job.`);
    }
    return row.pipeline.jobId;
  });
  const { data: backupRows, error: backupError } = await client
    .from("best_bottles_pipeline_sku_jobs")
    .select("id,organization_id,website_sku,grace_sku,family,best_reference_candidate_path,reference_source,reference_source_path,reference_source_url,reference_imported_at,reference_issue,coverage_status,status")
    .eq("organization_id", ORGANIZATION_ID)
    .in("id", jobIds)
    .order("id");
  if (backupError) throw new Error(`Sidecar job backup failed: ${backupError.message}`);
  if ((backupRows ?? []).length !== EXPECTED_COUNT) {
    throw new Error(`Sidecar job backup resolved ${(backupRows ?? []).length}/${EXPECTED_COUNT} jobs.`);
  }
  const backupPath = resolve(OUTPUT_ROOT, "cylinder-sidecar-job-backup.json");
  await writeFile(backupPath, stableJson({
    version: "best-bottles-cylinder-sidecar-job-backup-v2",
    createdAt: new Date().toISOString(),
    organizationId: ORGANIZATION_ID,
    sourceManifestSha256: manifestSha256,
    preflightSha256: preflight.seal,
    rows: backupRows,
  }));

  const adapter: CylinderReferencePromotionExecutionAdapter = {
    readLocalFile: async (path) => readFile(path),
    inspectRemote: async (bucket, storagePath) => {
      const separator = storagePath.lastIndexOf("/");
      const folder = storagePath.slice(0, separator);
      const filename = storagePath.slice(separator + 1);
      const listed = await client.storage.from(bucket).list(folder, { limit: 2, search: filename });
      if (listed.error) throw new Error(`Storage list failed: ${storageError(listed.error)}`);
      if (!(listed.data ?? []).some((item) => item.name === filename)) return { status: "absent" };
      const downloaded = await client.storage.from(bucket).download(storagePath);
      if (downloaded.error) throw new Error(`Storage download failed: ${storageError(downloaded.error)}`);
      return { status: "present", bytes: new Uint8Array(await downloaded.data.arrayBuffer()) };
    },
    uploadImmutable: async (bucket, storagePath, bytes, options) => {
      const uploaded = await client.storage.from(bucket).upload(storagePath, bytes, {
        contentType: options.contentType,
        upsert: false,
      });
      if (uploaded.error) throw new Error(`Immutable upload failed: ${storageError(uploaded.error)}`);
    },
    readJob: async (id): Promise<CylinderPromotionLiveJob | null> => {
      const { data, error } = await client
        .from("best_bottles_pipeline_sku_jobs")
        .select("website_sku,grace_sku,best_reference_candidate_path,reference_source")
        .eq("organization_id", ORGANIZATION_ID)
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(`Pipeline job read failed for ${id}: ${error.message}`);
      return data ? {
        websiteSku: String(data.website_sku ?? ""),
        graceSku: String(data.grace_sku ?? ""),
        referencePath: data.best_reference_candidate_path == null
          ? null
          : String(data.best_reference_candidate_path),
        referenceSource: data.reference_source == null ? null : String(data.reference_source),
      } : null;
    },
    repointExactJob: async (request) => {
      let query = client
        .from("best_bottles_pipeline_sku_jobs")
        .update({
          best_reference_candidate_path: request.targetPublicUrl,
          reference_source: request.referenceSource,
          reference_source_path: null,
          reference_source_url: request.targetPublicUrl,
          reference_imported_at: new Date().toISOString(),
          reference_issue: null,
          coverage_status: "covered_canonical",
        })
        .eq("id", request.jobId)
        .eq("organization_id", ORGANIZATION_ID)
        .eq("website_sku", request.websiteSku)
        .eq("grace_sku", request.graceSku);
      query = request.expectedCurrentPath === null
        ? query.is("best_reference_candidate_path", null)
        : query.eq("best_reference_candidate_path", request.expectedCurrentPath);
      const { data, error } = await query.select("id");
      if (error) throw new Error(`Exact sidecar repoint failed: ${error.message}`);
      if ((data ?? []).length !== 1) {
        throw new Error(`Exact sidecar repoint affected ${(data ?? []).length} rows for ${request.graceSku}.`);
      }
    },
  };

  const result = await executeCylinderReferencePromotion(plan, adapter);
  const unsignedExecution = {
    version: "best-bottles-cylinder-sidecar-promotion-execution-v2",
    completedAt: new Date().toISOString(),
    organizationId: ORGANIZATION_ID,
    sourceManifestSha256: manifestSha256,
    preflightSha256: preflight.seal,
    backupPath,
    result,
  };
  const executionSha256 = sha256(stableJson(unsignedExecution));
  const reportPath = resolve(OUTPUT_ROOT, "cylinder-sidecar-promotion-execution.json");
  await writeFile(reportPath, stableJson({ ...unsignedExecution, executionSha256 }));
  process.stdout.write(`${JSON.stringify({
    mode: "executed",
    reportPath,
    backupPath,
    executionSha256,
    summary: result.summary,
  }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
