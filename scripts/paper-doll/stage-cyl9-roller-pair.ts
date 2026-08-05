import "dotenv/config";

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

import { buildPaperDollObjectPath } from "../../src/lib/paperDoll/assetStorage";
import { buildCyl9RollerPair } from "../../src/lib/paperDoll/cyl9RollerPair.node";
import { buildCyl9RollerPairJobPlan } from "../../src/lib/paperDoll/cyl9RollerPairStaging.node";
import { processCandidateJob } from "./process-paper-doll-candidate";

const ORGANIZATION_ID = "4ab1ac72-cd7e-4faf-9152-5aa5f2862411";
const EXPECTED_PROJECT_REF = "likkskifwsrvszxdvufw";
const FAMILY_KEY = "CYL-9ML";
const DEFAULT_ASSET_REPO = "/Users/jordanrichter/Projects/Madison Studio/madison-app";

type Client = ReturnType<typeof createClient>;

interface AssetRef {
  bucket: "paper-doll-sources" | "paper-doll-candidates" | "paper-doll-approved";
  path: string;
  sha256: string;
  contentType: string;
  byteSize: number;
}

function argument(name: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function requiredArgument(name: string): string {
  const value = argument(name);
  if (!value) throw new Error(`${name} is required.`);
  return path.resolve(value);
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

async function uploadOrVerify(client: Client, input: {
  bucket: AssetRef["bucket"];
  objectPath: string;
  bytes: Buffer;
}): Promise<AssetRef> {
  const expectedSha = sha256(input.bytes);
  const storage = client.storage.from(input.bucket);
  const uploaded = await storage.upload(input.objectPath, input.bytes, {
    upsert: false,
    contentType: "image/png",
    cacheControl: "31536000",
  });
  if (uploaded.error && !/already exists|duplicate/i.test(uploaded.error.message)) {
    throw new Error(`Unable to upload ${input.bucket}/${input.objectPath}: ${uploaded.error.message}`);
  }
  const downloaded = await storage.download(input.objectPath);
  if (downloaded.error || !downloaded.data) throw new Error(`Unable to verify ${input.bucket}/${input.objectPath}.`);
  const verified = Buffer.from(await downloaded.data.arrayBuffer());
  if (verified.byteLength !== input.bytes.byteLength || sha256(verified) !== expectedSha) {
    throw new Error(`Storage identity mismatch for ${input.bucket}/${input.objectPath}.`);
  }
  return {
    bucket: input.bucket,
    path: input.objectPath,
    sha256: expectedSha,
    contentType: "image/png",
    byteSize: verified.byteLength,
  };
}

function releaseAssetRef(asset: Record<string, unknown>): AssetRef {
  const version = asset.version as Record<string, unknown>;
  return {
    bucket: version.storage_bucket as AssetRef["bucket"],
    path: String(version.image_path),
    sha256: String(version.image_sha256),
    contentType: String(version.content_type),
    byteSize: Number(version.byte_size),
  };
}

function releaseIdentity(payload: Record<string, unknown>) {
  const release = payload.release as Record<string, unknown>;
  const assets = payload.assets as Array<Record<string, unknown>>;
  return {
    id: release.id,
    version: release.release_version,
    status: release.release_status,
    manifestSha256: release.manifest_sha256,
    assets: assets.map((asset) => ({
      slot: asset.slot,
      variantKey: asset.variantKey,
      versionId: (asset.version as Record<string, unknown>).id,
      imageSha256: (asset.version as Record<string, unknown>).image_sha256,
    })),
  };
}

async function createFiveBodyLineup(input: {
  assetRepoRoot: string;
  outputDir: string;
  plastic: Buffer;
  metal: Buffer;
  bounds: { left: number; top: number; right: number; bottom: number };
}) {
  const registry = JSON.parse(await readFile(
    path.join(input.assetRepoRoot, "docs/paper-doll-rig/body-plate-registry.json"),
    "utf8",
  )) as { entries: Array<{ id: string; asset: { path: string; sha256: string } }> };
  const order = ["amber", "cobalt", "clear", "frosted", "swirl"];
  const bodies = registry.entries
    .filter((entry) => entry.id.startsWith("body__cylinder__9ml__"))
    .sort((left, right) => order.findIndex((name) => left.id.includes(`__${name}__`)) - order.findIndex((name) => right.id.includes(`__${name}__`)));
  if (bodies.length !== 5) throw new Error(`Expected five locked CYL-9ML body plates; received ${bodies.length}.`);

  const sourceWidth = input.bounds.right - input.bounds.left + 1;
  const sourceHeight = input.bounds.bottom - input.bounds.top + 1;
  const targetWidth = 262;
  const targetHeight = Math.round(sourceHeight * targetWidth / sourceWidth);
  const left = 1041 - Math.floor(targetWidth / 2);
  const top = 760 - targetHeight + 1;
  const fitted = await Promise.all([input.plastic, input.metal].map((bytes) => sharp(bytes)
    .extract({ left: input.bounds.left, top: input.bounds.top, width: sourceWidth, height: sourceHeight })
    .resize({ width: targetWidth, height: targetHeight, fit: "fill", kernel: sharp.kernel.lanczos3 })
    .png({ compressionLevel: 9 })
    .toBuffer()));

  const row = async (roller: Buffer, outputName: string) => {
    const cards = await Promise.all(bodies.map(async (entry) => {
      const body = await readFile(path.join(input.assetRepoRoot, entry.asset.path));
      if (sha256(body) !== entry.asset.sha256) throw new Error(`Locked plate SHA drifted: ${entry.id}.`);
      const assembled = await sharp(body).composite([{ input: roller, left, top }]).png({ compressionLevel: 9 }).toBuffer();
      return sharp(assembled).resize({ width: 416, height: 458, fit: "fill" }).png({ compressionLevel: 9 }).toBuffer();
    }));
    await sharp({ create: { width: 2080, height: 458, channels: 4, background: "#F5F3EF" } })
      .composite(cards.map((card, index) => ({ input: card, left: index * 416, top: 0 })))
      .png({ compressionLevel: 9 })
      .toFile(path.join(input.outputDir, outputName));
  };
  await row(fitted[0], "plastic-five-body-lineup.png");
  await row(fitted[1], "metal-five-body-lineup.png");
  await sharp({ create: { width: 2080, height: 916, channels: 4, background: "#F5F3EF" } })
    .composite([
      { input: path.join(input.outputDir, "plastic-five-body-lineup.png"), left: 0, top: 0 },
      { input: path.join(input.outputDir, "metal-five-body-lineup.png"), left: 0, top: 458 },
    ])
    .png({ compressionLevel: 9 })
    .toFile(path.join(input.outputDir, "roller-pair-five-body-review.png"));
}

async function stagePair(client: Client, pair: Awaited<ReturnType<typeof buildCyl9RollerPair>>) {
  const beforeResponse = await client.rpc("get_paper_doll_release_workbench", {
    p_organization_id: ORGANIZATION_ID,
    p_family_key: FAMILY_KEY,
  });
  if (beforeResponse.error || !beforeResponse.data) throw new Error(`Release lookup failed: ${beforeResponse.error?.message ?? "missing release"}.`);
  const before = beforeResponse.data as Record<string, unknown>;
  const assets = before.assets as Array<Record<string, unknown>>;
  const parent = assets.find((asset) => asset.slot === "roller" && asset.variantKey === "PLASTIC");
  const amber = assets.find((asset) => asset.slot === "body" && asset.variantKey === "AMB");
  if (!parent || !amber) throw new Error("The release must contain the registered PLASTIC parent and locked AMB body.");
  const parentVersion = parent.version as Record<string, unknown>;
  const component = parent.component as Record<string, unknown>;

  const latestJob = await client.from("paper_doll_candidate_jobs")
    .select("initiated_by")
    .eq("organization_id", ORGANIZATION_ID)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestJob.error || !latestJob.data?.initiated_by) throw new Error("No named CYL-9ML operator identity is available for staging.");

  const objectPath = (bucket: AssetRef["bucket"], assetId: string, bytes: Buffer) => buildPaperDollObjectPath({
    organizationId: ORGANIZATION_ID,
    familyKey: FAMILY_KEY,
    assetId,
    sha256: sha256(bytes),
    extension: "png",
  });
  const [maskRef, plasticRef, metalRef] = await Promise.all([
    uploadOrVerify(client, {
      bucket: "paper-doll-candidates",
      objectPath: objectPath("paper-doll-candidates", "roller-pair-v03-shared-authority-mask", pair.mask.png),
      bytes: pair.mask.png,
    }),
    uploadOrVerify(client, {
      bucket: "paper-doll-sources",
      objectPath: objectPath("paper-doll-sources", "plastic-roller-v03-geometry-master", pair.plastic.png),
      bytes: pair.plastic.png,
    }),
    uploadOrVerify(client, {
      bucket: "paper-doll-sources",
      objectPath: objectPath("paper-doll-sources", "metal-roller-v03-material-child", pair.metal.png),
      bytes: pair.metal.png,
    }),
  ]);
  const plan = buildCyl9RollerPairJobPlan({
    organizationId: ORGANIZATION_ID,
    initiatedBy: latestJob.data.initiated_by,
    componentId: String(component.id),
    parentComponentVersionId: String(parentVersion.id),
    parent: releaseAssetRef(parent),
    authorityMask: maskRef,
    assemblyContext: releaseAssetRef(amber),
    plastic: { ...plasticRef, originalFilename: "closure__17-415__plastic-roller-ball__natural__geometry-master__v03.png" },
    metal: { ...metalRef, originalFilename: "closure__17-415__metal-roller-ball__natural__material-child__v03.png" },
  });

  const staged: Array<Record<string, unknown>> = [];
  for (const job of plan.jobs) {
    const existing = await client.from("paper_doll_candidate_jobs")
      .select("id,status,candidate_component_version_id,manual_output_ref,authoritative_mask_ref")
      .eq("organization_id", ORGANIZATION_ID)
      .eq("requirement_key", job.requirement_key)
      .eq("component_id", job.component_id)
      .order("created_at", { ascending: false })
      .limit(20);
    if (existing.error) throw new Error(`Candidate idempotency lookup failed: ${existing.error.message}`);
    const prior = existing.data.find((row) => {
      const manual = row.manual_output_ref as Record<string, unknown> | null;
      const authority = row.authoritative_mask_ref as Record<string, unknown> | null;
      return manual?.sha256 === job.manual_output_ref.sha256
        && authority?.sha256 === job.authoritative_mask_ref.sha256
        && row.status === "candidate_ready";
    });
    if (prior) {
      staged.push({ requirementKey: job.requirement_key, jobId: prior.id, candidateVersionId: prior.candidate_component_version_id, reused: true });
      continue;
    }
    const inserted = await client.from("paper_doll_candidate_jobs")
      .insert(job)
      .select("id")
      .single();
    if (inserted.error || !inserted.data) throw new Error(`Candidate job insert failed: ${inserted.error?.message}.`);
    const processed = await processCandidateJob({ client: client as never, jobId: inserted.data.id });
    staged.push({ requirementKey: job.requirement_key, ...processed, reused: false });
  }

  const jobIds = staged.map((row) => String(row.jobId));
  const verified = await client.from("paper_doll_candidate_jobs")
    .select("id,requirement_key,status,output_ref,output_metadata,candidate_component_version_id")
    .in("id", jobIds);
  if (verified.error || !verified.data || verified.data.length !== 2) throw new Error(`Staged pair verification failed: ${verified.error?.message ?? "incomplete pair"}.`);
  for (const row of verified.data) {
    if (row.status !== "candidate_ready") throw new Error(`${row.requirement_key} is not candidate_ready.`);
    const versionResponse = await client.from("paper_doll_component_versions")
      .select("geometry_mask_sha256,approval_status")
      .eq("id", row.candidate_component_version_id!)
      .eq("organization_id", ORGANIZATION_ID)
      .single();
    if (versionResponse.error || versionResponse.data.geometry_mask_sha256 !== maskRef.sha256 || versionResponse.data.approval_status !== "candidate") {
      throw new Error(`${row.requirement_key} does not preserve the shared candidate authority.`);
    }
    const qaResponse = await client.from("paper_doll_qa_results")
      .select("gate_key,qa_status,blocking,measurements")
      .eq("component_version_id", row.candidate_component_version_id!)
      .eq("organization_id", ORGANIZATION_ID);
    if (qaResponse.error) throw new Error(`${row.requirement_key} QA verification failed: ${qaResponse.error.message}.`);
    const qa = qaResponse.data;
    if (qa.some((gate) => gate.blocking && gate.qa_status !== "passed")) throw new Error(`${row.requirement_key} has failing blocking QA.`);
    if (row.requirement_key.endsWith(":METAL") && !qa.some((gate) => gate.gate_key === "opaque-white-fraction" && gate.qa_status === "passed")) {
      throw new Error("METAL candidate is missing passing opaque-white-fraction evidence.");
    }
  }

  const afterResponse = await client.rpc("get_paper_doll_release_workbench", {
    p_organization_id: ORGANIZATION_ID,
    p_family_key: FAMILY_KEY,
  });
  if (afterResponse.error || !afterResponse.data) throw new Error("Post-stage release verification failed.");
  if (JSON.stringify(releaseIdentity(before)) !== JSON.stringify(releaseIdentity(afterResponse.data as Record<string, unknown>))) {
    throw new Error("Active release changed during candidate staging.");
  }
  return { staged, verified: verified.data, sharedMask: maskRef, release: releaseIdentity(before), releaseMutation: false, sanityPublished: false };
}

async function main() {
  const plasticPath = requiredArgument("--plastic");
  const metalPath = requiredArgument("--metal");
  const outputDir = path.resolve(argument("--output-dir", "tmp/cyl9-roller-pair-v03")!);
  const assetRepoRoot = path.resolve(argument("--asset-repo-root", DEFAULT_ASSET_REPO)!);
  await mkdir(outputDir, { recursive: true });
  const pair = await buildCyl9RollerPair({
    plasticSource: await readFile(plasticPath),
    metalSource: await readFile(metalPath),
    source: {
      alphaFloor: 8,
      plasticBallBounds: { left: 342, top: 192, right: 911, bottom: 390 },
      metalBallBounds: { left: 342, top: 194, right: 911, bottom: 390 },
    },
    placement: {
      canvasWidthPx: 2080,
      canvasHeightPx: 2288,
      targetWidthPx: 269,
      mountAxisXPx: 1041,
      contactYPx: 918,
    },
  });
  await Promise.all([
    writeFile(path.join(outputDir, "plastic-roller-geometry-master-v03.png"), pair.plastic.png),
    writeFile(path.join(outputDir, "metal-roller-material-child-v03.png"), pair.metal.png),
    writeFile(path.join(outputDir, "shared-authority-mask-v03.png"), pair.mask.png),
  ]);
  await createFiveBodyLineup({
    assetRepoRoot,
    outputDir,
    plastic: pair.plastic.png,
    metal: pair.metal.png,
    bounds: pair.mask.bounds,
  });

  let registration: unknown = { dryRun: true, releaseMutation: false, sanityPublished: false };
  if (process.argv.includes("--stage")) {
    const url = process.env.SUPABASE_URL?.trim();
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for --stage.");
    if (new URL(url).hostname.split(".")[0] !== EXPECTED_PROJECT_REF) throw new Error(`Refusing to stage outside ${EXPECTED_PROJECT_REF}.`);
    registration = await stagePair(createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }), pair);
  }
  const evidence = {
    schemaVersion: 1,
    status: "candidate-not-approved",
    plasticSource: { path: plasticPath, sha256: pair.source.plasticSha256 },
    metalSource: { path: metalPath, sha256: pair.source.metalSha256 },
    pair: {
      plasticSha256: pair.plastic.sha256,
      metalSha256: pair.metal.sha256,
      sharedMaskSha256: pair.mask.sha256,
      alphaBounds: pair.mask.bounds,
      foregroundPixelCount: pair.mask.foregroundPixelCount,
      silhouetteIou: pair.qa.silhouetteIou,
      sharedAlphaExact: pair.qa.sharedAlphaExact,
      connectedComponents: pair.qa.connectedComponents,
      metalOpaqueWhite: pair.qa.metalOpaqueWhite,
    },
    placement: pair.placement,
    registration,
  };
  await writeFile(path.join(outputDir, "roller-pair-evidence.json"), `${JSON.stringify(evidence, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ outputDir, ...evidence }, null, 2)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`CYL-9ML roller pair staging failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
