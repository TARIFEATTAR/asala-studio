#!/usr/bin/env tsx
import "dotenv/config";

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";

import {
  BEST_BOTTLES_CYLINDER_PRODUCTION_CONTRACT,
  BEST_BOTTLES_CYLINDER_PRODUCTION_ROOT,
} from "../../src/config/bestBottlesCylinderProductionContract";
import {
  buildCylinderReferencePromotionPlan,
  type CylinderPromotionPipelineJob,
  type CylinderPromotionRemoteObject,
  type CylinderReferencePromotionPlan,
} from "../../src/lib/bestBottlesCylinderReferencePromotion";
import type { CylinderProductionReadinessArtifact } from "../../src/lib/bestBottlesCylinderProductionCutover";
import type { CylinderReferenceProductionExportRecord } from "./build-cylinder-reference-production";

const ORGANIZATION_ID = "4ab1ac72-cd7e-4faf-9152-5aa5f2862411";
const READINESS_PATH = "public/data/best-bottles-cylinder-production-readiness.json";
const PRODUCTION_MANIFEST_PATH =
  `${BEST_BOTTLES_CYLINDER_PRODUCTION_ROOT}/cylinder-reference-production-manifest.json`;
const OUTPUT_ROOT =
  "tmp/best-bottles-reference-production/cylinder-production-promotion-v1";
const BUCKET = "reference-images";

type InputProvenance = {
  readiness: { path: string; sha256: string };
  productionManifest: { path: string; sha256: string };
};

type PromotionPreflightArtifact = {
  version: "best-bottles-cylinder-reference-promotion-preflight-artifact-v1";
  generatedAt: string;
  mode: "read-only";
  inputProvenance: InputProvenance;
  plan: CylinderReferencePromotionPlan;
  manifestSha256: string;
};

export type WriteCylinderReferencePromotionPreflightInput = {
  readiness: CylinderProductionReadinessArtifact;
  exports: CylinderReferenceProductionExportRecord[];
  jobs: CylinderPromotionPipelineJob[];
  remoteObjects: CylinderPromotionRemoteObject[];
  bucket: string;
  supabaseUrl: string;
  outputRoot: string;
  expectedQualifiedCount?: number;
  generatedAt?: string;
  inputProvenance: InputProvenance;
};

export type WriteCylinderReferencePromotionPreflightResult = {
  manifestPath: string;
  collisionReportPath: string;
  plan: CylinderReferencePromotionPlan;
  manifestSha256: string;
};

function sha256(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function stableJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function verifyQualifiedLocalExports(
  readiness: CylinderProductionReadinessArtifact,
  exports: CylinderReferenceProductionExportRecord[],
): Promise<void> {
  const qualifiedKeys = new Set(
    readiness.rows
      .filter((row) => row.status === "production-qualified")
      .map((row) => row.canonicalIdentityKey),
  );
  const qualifiedExports = exports.filter((item) => qualifiedKeys.has(item.canonicalIdentityKey));
  if (qualifiedExports.length !== qualifiedKeys.size) {
    throw new Error(
      `Local verification found ${qualifiedExports.length}/${qualifiedKeys.size} qualified exports.`,
    );
  }
  await Promise.all(qualifiedExports.map(async (item) => {
    const bytes = await readFile(item.output.path);
    if (bytes.length !== item.output.bytes) {
      throw new Error(`Local byte count disagreement for ${item.canonicalIdentityKey}.`);
    }
    if (sha256(bytes) !== item.output.sha256) {
      throw new Error(`Local export hash disagreement for ${item.canonicalIdentityKey}.`);
    }
    const image = sharp(bytes);
    const [metadata, stats] = await Promise.all([image.metadata(), image.stats()]);
    if (
      metadata.format !== "png"
      || metadata.width !== item.output.width
      || metadata.height !== item.output.height
      || stats.isOpaque !== true
    ) {
      throw new Error(`Local opaque PNG inspection disagreement for ${item.canonicalIdentityKey}.`);
    }
  }));
}

export async function writeCylinderReferencePromotionPreflight(
  input: WriteCylinderReferencePromotionPreflightInput,
): Promise<WriteCylinderReferencePromotionPreflightResult> {
  await verifyQualifiedLocalExports(input.readiness, input.exports);
  const plan = buildCylinderReferencePromotionPlan({
    readiness: input.readiness,
    exports: input.exports,
    jobs: input.jobs,
    remoteObjects: input.remoteObjects,
    bucket: input.bucket,
    supabaseUrl: input.supabaseUrl,
    expectedQualifiedCount: input.expectedQualifiedCount,
  });
  const unsigned = {
    version: "best-bottles-cylinder-reference-promotion-preflight-artifact-v1" as const,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    mode: "read-only" as const,
    inputProvenance: input.inputProvenance,
    plan,
  };
  const manifestSha256 = sha256(stableJson(unsigned));
  const artifact: PromotionPreflightArtifact = { ...unsigned, manifestSha256 };
  const collisionReport = {
    version: "best-bottles-cylinder-reference-promotion-collision-report-v1",
    generatedAt: unsigned.generatedAt,
    mode: "read-only",
    manifestSha256,
    blockedIdentityCount: plan.summary.blockedCount,
    externalWriteCount: 0,
    blockedIdentities: plan.rows
      .filter((row) => row.decision === "blocked")
      .map((row) => ({
        canonicalIdentityKey: row.canonicalIdentityKey,
        websiteSku: row.websiteSku,
        graceSku: row.graceSku,
        storagePath: row.storage.path,
        remote: row.remote,
        pipeline: row.pipeline,
        blockers: row.blockers,
      })),
  };
  const outputRoot = resolve(input.outputRoot);
  const manifestPath = resolve(outputRoot, "cylinder-reference-promotion-manifest.json");
  const collisionReportPath = resolve(outputRoot, "cylinder-reference-promotion-collision-report.json");
  await mkdir(outputRoot, { recursive: true });
  await Promise.all([
    writeFile(manifestPath, stableJson(artifact)),
    writeFile(collisionReportPath, stableJson(collisionReport)),
  ]);
  return { manifestPath, collisionReportPath, plan, manifestSha256 };
}

function env(name: string): string {
  return String(process.env[name] ?? "").trim();
}

function getSupabase(): { client: SupabaseClient; url: string } {
  const url = env("SUPABASE_URL") || env("VITE_SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    throw new Error("SUPABASE_URL/VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for read-only audit.");
  }
  return {
    url,
    client: createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  };
}

async function fetchPipelineJobs(client: SupabaseClient): Promise<CylinderPromotionPipelineJob[]> {
  const jobs: CylinderPromotionPipelineJob[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await client
      .from("best_bottles_pipeline_sku_jobs")
      .select("id,website_sku,grace_sku,family,best_reference_candidate_path")
      .eq("organization_id", ORGANIZATION_ID)
      .order("id")
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`Pipeline job read failed: ${error.message}`);
    const page = (data ?? []).map((row) => ({
      id: String(row.id),
      websiteSku: row.website_sku == null ? null : String(row.website_sku),
      graceSku: String(row.grace_sku ?? ""),
      family: String(row.family ?? ""),
      bestReferenceCandidatePath:
        row.best_reference_candidate_path == null
          ? null
          : String(row.best_reference_candidate_path),
    }));
    jobs.push(...page);
    if (page.length < pageSize) break;
  }
  return jobs;
}

function storageErrorMessage(error: unknown): string {
  const candidate = error as {
    message?: unknown;
    name?: unknown;
    status?: unknown;
    statusCode?: unknown;
    originalError?: unknown;
  };
  const details = {
    name: candidate?.name,
    message: candidate?.message,
    status: candidate?.status,
    statusCode: candidate?.statusCode,
    originalError: candidate?.originalError,
  };
  const serialized = JSON.stringify(details, (_key, value) =>
    value instanceof Error ? { name: value.name, message: value.message } : value,
  );
  return serialized === "{}" ? String(error) : serialized;
}

async function mapLimited<T, R>(
  items: readonly T[],
  concurrency: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    for (;;) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      results[index] = await task(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

async function auditRemoteObjects(
  client: SupabaseClient,
  bucket: string,
  paths: string[],
): Promise<CylinderPromotionRemoteObject[]> {
  return mapLimited(paths, 8, async (path) => {
    const separator = path.lastIndexOf("/");
    const folder = path.slice(0, separator);
    const filename = path.slice(separator + 1);
    const listed = await client.storage.from(bucket).list(folder, { limit: 2, search: filename });
    if (listed.error) {
      return {
        path,
        status: "error" as const,
        error: `Exact-path list failed: ${storageErrorMessage(listed.error)}`,
      };
    }
    if (!(listed.data ?? []).some((item) => item.name === filename)) {
      return { path, status: "absent" as const };
    }
    const { data, error } = await client.storage.from(bucket).download(path);
    if (error) {
      return {
        path,
        status: "error" as const,
        error: `Confirmed object download failed: ${storageErrorMessage(error)}`,
      };
    }
    const bytes = new Uint8Array(await data.arrayBuffer());
    return { path, status: "present" as const, sha256: sha256(bytes), bytes: bytes.length };
  });
}

async function readJsonWithHash<T>(path: string): Promise<{ value: T; sha256: string }> {
  const bytes = await readFile(path);
  return { value: JSON.parse(bytes.toString("utf8")) as T, sha256: sha256(bytes) };
}

async function main(): Promise<void> {
  const readinessFile = await readJsonWithHash<CylinderProductionReadinessArtifact>(READINESS_PATH);
  const productionFile = await readJsonWithHash<{ exports: CylinderReferenceProductionExportRecord[] }>(
    PRODUCTION_MANIFEST_PATH,
  );
  const { client, url } = getSupabase();
  const jobs = await fetchPipelineJobs(client);
  const initialPlan = buildCylinderReferencePromotionPlan({
    readiness: readinessFile.value,
    exports: productionFile.value.exports,
    jobs,
    remoteObjects: [],
    bucket: BUCKET,
    supabaseUrl: url,
    expectedQualifiedCount: BEST_BOTTLES_CYLINDER_PRODUCTION_CONTRACT.productionQualifiedCount,
  });
  const remoteObjects = await auditRemoteObjects(
    client,
    BUCKET,
    initialPlan.rows.map((row) => row.storage.path),
  );
  const result = await writeCylinderReferencePromotionPreflight({
    readiness: readinessFile.value,
    exports: productionFile.value.exports,
    jobs,
    remoteObjects,
    bucket: BUCKET,
    supabaseUrl: url,
    outputRoot: OUTPUT_ROOT,
    expectedQualifiedCount: BEST_BOTTLES_CYLINDER_PRODUCTION_CONTRACT.productionQualifiedCount,
    inputProvenance: {
      readiness: { path: READINESS_PATH, sha256: readinessFile.sha256 },
      productionManifest: { path: PRODUCTION_MANIFEST_PATH, sha256: productionFile.sha256 },
    },
  });
  process.stdout.write(`${JSON.stringify({
    mode: "read-only",
    manifestPath: result.manifestPath,
    collisionReportPath: result.collisionReportPath,
    manifestSha256: result.manifestSha256,
    summary: result.plan.summary,
  }, null, 2)}\n`);
}

const isMain = process.argv[1]
  ? fileURLToPath(import.meta.url) === resolve(process.argv[1])
  : false;
if (isMain) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
