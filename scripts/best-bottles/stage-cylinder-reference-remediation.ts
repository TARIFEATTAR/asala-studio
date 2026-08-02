#!/usr/bin/env tsx
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

import {
  cylinderRemediationSourceStoragePath,
  type CylinderReferenceRemediationPlan,
} from "../../src/lib/bestBottlesCylinderReferenceRemediation";

const ORG_ID = process.env.MADISON_BEST_BOTTLES_ORG_ID || "4ab1ac72-cd7e-4faf-9152-5aa5f2862411";
const BUCKET = "generated-images";
const execute = process.argv.includes("--execute");
const root = process.cwd();
const inputPath = path.resolve(
  root,
  "tmp/best-bottles-reference-production/cylinder-reference-remediation-v1/cylinder-reference-remediation-plan.json",
);
const outputPath = path.resolve(
  root,
  "tmp/best-bottles-reference-production/cylinder-reference-remediation-v1/cylinder-reference-remediation-staging.json",
);

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const filename of [".env", ".env.local"]) {
    try {
      const source = readFileSync(path.resolve(root, filename), "utf8");
      for (const line of source.split(/\r?\n/)) {
        const match = line.match(/^\s*([A-Za-z0-9_]+)=(.*)$/);
        if (match) env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
      }
    } catch {
      // Optional file.
    }
  }
  return env;
}

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index]);
    }
  }));
  return results;
}

const env = loadEnv();
const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) throw new Error("Missing Supabase URL or service role key.");
const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
const plan = JSON.parse(await readFile(inputPath, "utf8")) as CylinderReferenceRemediationPlan;
if (plan.summary.generationReadyCount !== plan.rows.length || plan.summary.geometryBlockedCount !== 0) {
  throw new Error(`Remediation staging requires every Cylinder row to be generation-ready: ${JSON.stringify(plan.summary)}.`);
}

const rows = await mapPool(plan.rows, 4, async (row) => {
  const bytes = await readFile(row.sourceReferencePath);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  if (sha256 !== row.sourceReferenceSha256) throw new Error(`${row.graceSku} local source hash changed.`);
  const image = sharp(bytes, { failOn: "error" });
  const [metadata, stats] = await Promise.all([image.metadata(), image.stats()]);
  const alpha = stats.channels.find((channel) => channel.channel === "alpha");
  if (alpha && alpha.min < 255) throw new Error(`${row.graceSku} source reference is not fully opaque.`);
  if (metadata.width !== row.sourceDimensions.widthPx || metadata.height !== row.sourceDimensions.heightPx) {
    throw new Error(`${row.graceSku} source dimensions changed.`);
  }

  const storagePath = cylinderRemediationSourceStoragePath(ORG_ID, row);
  let action: "dry-run" | "uploaded" | "reused-verified" = "dry-run";
  if (execute) {
    const upload = await supabase.storage.from(BUCKET).upload(storagePath, bytes, {
      contentType: "image/png",
      cacheControl: "31536000",
      upsert: false,
    });
    if (!upload.error) {
      action = "uploaded";
    } else {
      const existing = await supabase.storage.from(BUCKET).download(storagePath);
      if (existing.error || !existing.data) {
        throw new Error(`${row.graceSku} immutable upload failed: ${upload.error.message}`);
      }
      const existingBytes = Buffer.from(await existing.data.arrayBuffer());
      const existingSha256 = createHash("sha256").update(existingBytes).digest("hex");
      if (existingSha256 !== sha256) {
        throw new Error(`${row.graceSku} immutable storage collision at ${storagePath}.`);
      }
      action = "reused-verified";
    }
  }
  const publicUrl = supabase.storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl;
  return {
    canonicalIdentityKey: row.canonicalIdentityKey,
    websiteSku: row.websiteSku,
    graceSku: row.graceSku,
    storagePath,
    publicUrl,
    sha256,
    width: metadata.width,
    height: metadata.height,
    opaque: true,
    action,
  };
});

const artifact = {
  version: "best-bottles-cylinder-reference-remediation-staging-v1",
  planSha256: plan.sha256,
  execute,
  bucket: BUCKET,
  summary: {
    total: rows.length,
    uploaded: rows.filter((row) => row.action === "uploaded").length,
    reusedVerified: rows.filter((row) => row.action === "reused-verified").length,
    dryRun: rows.filter((row) => row.action === "dry-run").length,
    failures: 0,
  },
  rows,
};
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`);
console.log(JSON.stringify({ outputPath, planSha256: plan.sha256, summary: artifact.summary }, null, 2));
