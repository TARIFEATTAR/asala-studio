#!/usr/bin/env tsx
import "dotenv/config";

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

import { BEST_BOTTLES_CYLINDER_PRODUCTION_CONTRACT } from "../../src/config/bestBottlesCylinderProductionContract";
import {
  executeCylinderReferencePromotion,
  type CylinderPromotionLiveJob,
  type CylinderReferencePromotionExecutionAdapter,
} from "../../src/lib/bestBottlesCylinderReferencePromotionExecution";
import type { CylinderReferencePromotionPlan } from "../../src/lib/bestBottlesCylinderReferencePromotion";

const ORGANIZATION_ID = "4ab1ac72-cd7e-4faf-9152-5aa5f2862411";
const MANIFEST_PATH = resolve(
  "tmp/best-bottles-reference-production/cylinder-production-promotion-v1/cylinder-reference-promotion-manifest.json",
);
const OUTPUT_ROOT = resolve(
  "tmp/best-bottles-reference-production/cylinder-production-promotion-v1",
);

type PromotionManifestArtifact = {
  version: string;
  generatedAt: string;
  mode: "read-only";
  inputProvenance: unknown;
  plan: CylinderReferencePromotionPlan;
  manifestSha256: string;
};

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

async function loadAndVerifyManifest(): Promise<PromotionManifestArtifact> {
  const artifact = JSON.parse(await readFile(MANIFEST_PATH, "utf8")) as PromotionManifestArtifact;
  const { manifestSha256, ...unsigned } = artifact;
  const actual = sha256(stableJson(unsigned));
  if (actual !== manifestSha256) {
    throw new Error(`Promotion manifest seal mismatch: ${actual} != ${manifestSha256}.`);
  }
  if (
    artifact.plan.summary.qualifiedIdentityCount !== BEST_BOTTLES_CYLINDER_PRODUCTION_CONTRACT.productionQualifiedCount
    || artifact.plan.rows.length !== BEST_BOTTLES_CYLINDER_PRODUCTION_CONTRACT.productionQualifiedCount
    || artifact.plan.summary.blockedCount !== 0
  ) {
    throw new Error(
      `Promotion manifest is not the approved ${BEST_BOTTLES_CYLINDER_PRODUCTION_CONTRACT.productionQualifiedCount}-reference zero-blocker cohort.`,
    );
  }
  return artifact;
}

async function main(): Promise<void> {
  const execute = process.argv.includes("--execute");
  const artifact = await loadAndVerifyManifest();
  if (!execute) {
    process.stdout.write(`${JSON.stringify({
      mode: "dry-run",
      message: "Pass --execute to perform the user-authorized immutable upload and exact job repoint.",
      manifestSha256: artifact.manifestSha256,
      summary: artifact.plan.summary,
    }, null, 2)}\n`);
    return;
  }

  const supabaseUrl = env("SUPABASE_URL") || env("VITE_SUPABASE_URL");
  const serviceRoleKey = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase URL and service-role credentials are required.");
  }
  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const jobIds = artifact.plan.rows.map((row) => {
    if (row.pipeline.status !== "needs-repoint" && row.pipeline.status !== "already-target") {
      throw new Error(`${row.canonicalIdentityKey} has no exact pipeline job.`);
    }
    return row.pipeline.jobId;
  });
  const { data: backupRows, error: backupError } = await client
    .from("best_bottles_pipeline_sku_jobs")
    .select([
      "id",
      "organization_id",
      "website_sku",
      "grace_sku",
      "family",
      "best_reference_candidate_path",
      "reference_source",
      "reference_source_path",
      "reference_source_url",
      "reference_imported_at",
      "reference_issue",
      "coverage_status",
      "status",
    ].join(","))
    .eq("organization_id", ORGANIZATION_ID)
    .in("id", jobIds)
    .order("id");
  if (backupError) throw new Error(`Pre-promotion job backup failed: ${backupError.message}`);
  if ((backupRows ?? []).length !== BEST_BOTTLES_CYLINDER_PRODUCTION_CONTRACT.productionQualifiedCount) {
    throw new Error(
      `Pre-promotion backup resolved ${(backupRows ?? []).length}/${BEST_BOTTLES_CYLINDER_PRODUCTION_CONTRACT.productionQualifiedCount} exact jobs.`,
    );
  }
  const backupPath = resolve(OUTPUT_ROOT, "cylinder-reference-promotion-job-backup.json");
  await mkdir(dirname(backupPath), { recursive: true });
  await writeFile(backupPath, stableJson({
    version: "best-bottles-cylinder-reference-promotion-job-backup-v1",
    createdAt: new Date().toISOString(),
    organizationId: ORGANIZATION_ID,
    manifestSha256: artifact.manifestSha256,
    rows: backupRows,
  }));

  const adapter: CylinderReferencePromotionExecutionAdapter = {
    readLocalFile: async (path) => readFile(path),
    inspectRemote: async (bucket, path) => {
      const separator = path.lastIndexOf("/");
      const folder = path.slice(0, separator);
      const filename = path.slice(separator + 1);
      const listed = await client.storage.from(bucket).list(folder, { limit: 2, search: filename });
      if (listed.error) throw new Error(`Storage list failed for ${path}: ${storageError(listed.error)}`);
      if (!(listed.data ?? []).some((item) => item.name === filename)) return { status: "absent" };
      const downloaded = await client.storage.from(bucket).download(path);
      if (downloaded.error) {
        throw new Error(`Storage download failed for ${path}: ${storageError(downloaded.error)}`);
      }
      return {
        status: "present",
        bytes: new Uint8Array(await downloaded.data.arrayBuffer()),
      };
    },
    uploadImmutable: async (bucket, path, bytes, options) => {
      const uploaded = await client.storage.from(bucket).upload(path, bytes, {
        contentType: options.contentType,
        upsert: false,
      });
      if (uploaded.error) {
        throw new Error(`Immutable upload failed for ${path}: ${storageError(uploaded.error)}`);
      }
    },
    readJob: async (id): Promise<CylinderPromotionLiveJob | null> => {
      const { data, error } = await client
        .from("best_bottles_pipeline_sku_jobs")
        .select("id,website_sku,grace_sku,best_reference_candidate_path,reference_source")
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
      if (error) throw new Error(`Exact job repoint failed for ${request.graceSku}: ${error.message}`);
      if ((data ?? []).length !== 1) {
        throw new Error(`Exact job repoint affected ${(data ?? []).length} rows for ${request.graceSku}.`);
      }
    },
  };

  const result = await executeCylinderReferencePromotion(artifact.plan, adapter);
  const completedAt = new Date().toISOString();
  const unsignedExecution = {
    version: "best-bottles-cylinder-reference-promotion-execution-artifact-v1",
    completedAt,
    organizationId: ORGANIZATION_ID,
    manifestSha256: artifact.manifestSha256,
    backupPath,
    result,
  };
  const executionSha256 = sha256(stableJson(unsignedExecution));
  const reportPath = resolve(OUTPUT_ROOT, "cylinder-reference-promotion-execution.json");
  await writeFile(reportPath, stableJson({ ...unsignedExecution, executionSha256 }));
  process.stdout.write(`${JSON.stringify({
    mode: "executed",
    reportPath,
    backupPath,
    manifestSha256: artifact.manifestSha256,
    executionSha256,
    summary: result.summary,
  }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
