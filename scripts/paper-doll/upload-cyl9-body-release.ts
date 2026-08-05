import "dotenv/config";

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { createClient } from "@supabase/supabase-js";

import {
  buildCyl9BodyReleasePlan,
  type BodyPlateFileFacts,
  type BodyPlateRegistry,
} from "../../src/lib/paperDoll/cyl9BodyRelease.node";

const ORGANIZATION_ID = "4ab1ac72-cd7e-4faf-9152-5aa5f2862411";
const EXPECTED_PROJECT_REF = "likkskifwsrvszxdvufw";

function argumentValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function pngDimensions(buffer: Buffer): { widthPx: number; heightPx: number } {
  const signature = buffer.subarray(0, 8).toString("hex");
  if (signature !== "89504e470d0a1a0a" || buffer.subarray(12, 16).toString("ascii") !== "IHDR") {
    throw new Error("Expected a PNG with a valid IHDR chunk.");
  }
  return { widthPx: buffer.readUInt32BE(16), heightPx: buffer.readUInt32BE(20) };
}

async function main(): Promise<void> {
  const assetRepoRoot = resolve(argumentValue("--asset-repo-root") ?? process.cwd());
  const dryRun = process.argv.includes("--dry-run");
  const registryPath = resolve(assetRepoRoot, "docs/paper-doll-rig/body-plate-registry.json");
  const registry = JSON.parse(await readFile(registryPath, "utf8")) as BodyPlateRegistry;
  const buffersById = new Map<string, Buffer>();
  const assetFactsById: Record<string, BodyPlateFileFacts> = {};

  for (const entry of registry.entries) {
    const buffer = await readFile(resolve(assetRepoRoot, entry.asset.path));
    const dimensions = pngDimensions(buffer);
    buffersById.set(entry.id, buffer);
    assetFactsById[entry.id] = {
      sha256: createHash("sha256").update(buffer).digest("hex"),
      widthPx: dimensions.widthPx,
      heightPx: dimensions.heightPx,
      byteSize: buffer.byteLength,
    };
  }

  const plan = buildCyl9BodyReleasePlan({
    organizationId: ORGANIZATION_ID,
    registry,
    assetFactsById,
  });

  const uploads: Array<{ objectPath: string; result: "created" | "verified-existing" | "dry-run" }> = [];
  if (dryRun) {
    uploads.push(...plan.assets.map((asset) => ({ objectPath: asset.objectPath, result: "dry-run" as const })));
  } else {
    const supabaseUrl = process.env.SUPABASE_URL?.trim();
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
    }
    if (new URL(supabaseUrl).hostname.split(".")[0] !== EXPECTED_PROJECT_REF) {
      throw new Error(`Refusing to upload outside the linked ${EXPECTED_PROJECT_REF} project.`);
    }
    const client = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const bucket = client.storage.from("paper-doll-approved");

    for (const asset of plan.assets) {
      const buffer = buffersById.get(asset.componentKey);
      if (!buffer) throw new Error(`No verified buffer for ${asset.componentKey}.`);
      const folder = asset.objectPath.slice(0, asset.objectPath.lastIndexOf("/"));
      const fileName = asset.objectPath.slice(asset.objectPath.lastIndexOf("/") + 1);
      const listed = await bucket.list(folder, { limit: 10, search: fileName });
      if (listed.error) throw new Error(`Unable to inspect ${asset.objectPath}: ${listed.error.message}`);
      const existing = listed.data.find((object) => object.name === fileName);

      if (existing) {
        const downloaded = await bucket.download(asset.objectPath);
        if (downloaded.error || !downloaded.data) {
          throw new Error(`Unable to verify existing ${asset.objectPath}: ${downloaded.error?.message ?? "no data"}`);
        }
        const existingBuffer = Buffer.from(await downloaded.data.arrayBuffer());
        const existingSha = createHash("sha256").update(existingBuffer).digest("hex");
        if (existingSha !== asset.imageSha256 || existingBuffer.byteLength !== asset.byteSize) {
          throw new Error(`Existing approved object does not match its content-addressed identity: ${asset.objectPath}`);
        }
        uploads.push({ objectPath: asset.objectPath, result: "verified-existing" });
        continue;
      }

      const uploaded = await bucket.upload(asset.objectPath, buffer, {
        cacheControl: "31536000",
        contentType: asset.contentType,
        upsert: false,
      });
      if (uploaded.error) throw new Error(`Unable to upload ${asset.objectPath}: ${uploaded.error.message}`);
      uploads.push({ objectPath: asset.objectPath, result: "created" });
    }
  }

  process.stdout.write(`${JSON.stringify({ plan, uploads }, null, 2)}\n`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`CYL-9ML body release upload failed: ${message}\n`);
  process.exitCode = 1;
});
