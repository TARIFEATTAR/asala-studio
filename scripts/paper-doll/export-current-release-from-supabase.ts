#!/usr/bin/env tsx

import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

import {
  canonicalizeReleaseValue,
  parsePaperDollReleaseManifest,
  type PaperDollReleaseManifest,
} from "../../src/lib/paperDoll/releaseContract";

const EXPECTED_PROJECT_REF = "likkskifwsrvszxdvufw";
const DEFAULT_ORGANIZATION_ID = "4ab1ac72-cd7e-4faf-9152-5aa5f2862411";

function option(argv: string[], name: string, fallback?: string): string {
  const index = argv.indexOf(name);
  const value = index >= 0 ? argv[index + 1]?.trim() : fallback;
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function containedPath(root: string, path: string): string {
  if (isAbsolute(path)) throw new Error(`Release asset path must be relative: ${path}`);
  const absoluteRoot = resolve(root);
  const absolutePath = resolve(absoluteRoot, path);
  const fromRoot = relative(absoluteRoot, absolutePath);
  if (fromRoot === ".." || fromRoot.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) || isAbsolute(fromRoot)) {
    throw new Error(`Release asset path escapes the export root: ${path}`);
  }
  return absolutePath;
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const familyKey = option(argv, "--family-key", "CYL-9ML");
  const organizationId = option(argv, "--organization-id", DEFAULT_ORGANIZATION_ID);
  const outputDirectory = resolve(option(argv, "--output-dir"));
  const supabaseUrl = (process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "").trim();
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  if (!supabaseUrl || !serviceRoleKey) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  if (new URL(supabaseUrl).hostname.split(".")[0] !== EXPECTED_PROJECT_REF) {
    throw new Error("Refusing to read from an unexpected Supabase project.");
  }

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const head = await client.from("paper_doll_family_release_heads")
    .select("release_id,release_cut_id")
    .eq("organization_id", organizationId)
    .eq("family_key", familyKey)
    .single();
  if (head.error) throw head.error;
  const release = await client.from("paper_doll_family_releases")
    .select("release_version,manifest,manifest_sha256")
    .eq("organization_id", organizationId)
    .eq("id", head.data.release_id)
    .single();
  if (release.error) throw release.error;

  parsePaperDollReleaseManifest(release.data.manifest);
  const manifest = release.data.manifest as PaperDollReleaseManifest;
  const manifestSha256 = createHash("sha256")
    .update(canonicalizeReleaseValue(manifest))
    .digest("hex");
  const sourceManifestSha256 = String(release.data.manifest_sha256);

  let downloaded = 0;
  for (const asset of manifest.assets) {
    const download = await client.storage.from("paper-doll-approved").download(asset.imagePath);
    if (download.error || !download.data) throw download.error ?? new Error(`Missing approved asset ${asset.imagePath}.`);
    const bytes = Buffer.from(await download.data.arrayBuffer());
    if (sha256(bytes) !== asset.imageSha256) throw new Error(`Approved asset hash mismatch: ${asset.slot}:${asset.variantKey}.`);
    const metadata = await sharp(bytes).metadata();
    const validChannels = asset.slot === "body"
      ? metadata.channels === 3 || metadata.channels === 4
      : metadata.hasAlpha === true && metadata.channels === 4;
    if (metadata.width !== asset.widthPx || metadata.height !== asset.heightPx || !validChannels) {
      throw new Error(`Approved asset contract failed: ${asset.slot}:${asset.variantKey}.`);
    }
    const outputPath = containedPath(outputDirectory, asset.imagePath);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, bytes, { flag: "wx" });
    downloaded += 1;
  }
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(resolve(outputDirectory, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });
  process.stdout.write(`${JSON.stringify({
    familyKey,
    releaseVersion: manifest.releaseVersion,
    releaseId: head.data.release_id,
    releaseCutId: head.data.release_cut_id,
    sourceManifestSha256,
    canonicalManifestSha256: manifestSha256,
    assetCount: manifest.assets.length,
    downloaded,
    outputDirectory,
    remoteWritesPerformed: false,
  }, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
