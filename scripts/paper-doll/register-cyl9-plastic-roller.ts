import "dotenv/config";

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

import {
  CYL9_PLASTIC_ROLLER_CONTRACT,
  buildCyl9PlasticRollerRegistrationPlan,
  normalizeRollerLayer,
} from "../../src/lib/paperDoll/cyl9PlasticRoller.node";

const ORGANIZATION_ID = "4ab1ac72-cd7e-4faf-9152-5aa5f2862411";
const EXPECTED_PROJECT_REF = "likkskifwsrvszxdvufw";
const COMPONENT_KEY = "closure__17-415__plastic-roller-ball__natural";

interface RegistryEntry {
  id: string;
  asset: { path: string; sha256: string; widthPx: number; heightPx: number };
  status: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
}

interface BodyRegistry {
  entries: Array<{
    id: string;
    asset: { path: string; sha256: string; widthPx: number; heightPx: number };
  }>;
}

function argumentValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

async function writeInspectionPack(input: {
  outputDir: string;
  assetRepoRoot: string;
  imageBytes: Buffer;
  maskBytes: Buffer;
}): Promise<string> {
  await mkdir(input.outputDir, { recursive: true });
  await Promise.all([
    writeFile(resolve(input.outputDir, "cyl9-plastic-roller-beauty.png"), input.imageBytes),
    writeFile(resolve(input.outputDir, "cyl9-plastic-roller-authority-mask.png"), input.maskBytes),
  ]);

  const bodyRegistry = JSON.parse(await readFile(
    resolve(input.assetRepoRoot, "docs/paper-doll-rig/body-plate-registry.json"),
    "utf8",
  )) as BodyRegistry;
  if (bodyRegistry.entries.length !== 5) throw new Error("Inspection lineup requires exactly five locked body plates.");

  const cards = await Promise.all(bodyRegistry.entries.map(async (entry) => {
    const bodyBytes = await readFile(resolve(input.assetRepoRoot, entry.asset.path));
    if (sha256(bodyBytes) !== entry.asset.sha256) throw new Error(`Body plate identity drifted: ${entry.id}`);
    const assembled = await sharp(bodyBytes)
      .composite([{ input: input.imageBytes }])
      .png({ compressionLevel: 9 })
      .toBuffer();
    return sharp(assembled)
      .resize({ width: 416, height: 458, fit: "fill" })
      .png({ compressionLevel: 9 })
      .toBuffer();
  }));
  const lineupPath = resolve(input.outputDir, "cyl9-plastic-roller-five-body-lineup.png");
  await sharp({
    create: { width: 2080, height: 458, channels: 4, background: "#F5F3EF" },
  })
    .composite(cards.map((inputBytes, index) => ({ input: inputBytes, left: index * 416, top: 0 })))
    .png({ compressionLevel: 9 })
    .toFile(lineupPath);
  return lineupPath;
}

async function uploadOrVerify(input: {
  bucket: ReturnType<ReturnType<typeof createClient>["storage"]["from"]>;
  objectPath: string;
  bytes: Buffer;
  expectedSha256: string;
}): Promise<"created" | "verified-existing"> {
  const folder = input.objectPath.slice(0, input.objectPath.lastIndexOf("/"));
  const fileName = input.objectPath.slice(input.objectPath.lastIndexOf("/") + 1);
  const listed = await input.bucket.list(folder, { limit: 10, search: fileName });
  if (listed.error) throw new Error(`Unable to inspect ${input.objectPath}: ${listed.error.message}`);
  if (!listed.data.some((object) => object.name === fileName)) {
    const uploaded = await input.bucket.upload(input.objectPath, input.bytes, {
      cacheControl: "31536000",
      contentType: "image/png",
      upsert: false,
    });
    if (uploaded.error) throw new Error(`Unable to upload ${input.objectPath}: ${uploaded.error.message}`);
  }
  const downloaded = await input.bucket.download(input.objectPath);
  if (downloaded.error || !downloaded.data) {
    throw new Error(`Unable to download-verify ${input.objectPath}: ${downloaded.error?.message ?? "no bytes"}`);
  }
  const verifiedBytes = Buffer.from(await downloaded.data.arrayBuffer());
  if (sha256(verifiedBytes) !== input.expectedSha256 || verifiedBytes.byteLength !== input.bytes.byteLength) {
    throw new Error(`Approved object identity mismatch: ${input.objectPath}`);
  }
  return listed.data.some((object) => object.name === fileName) ? "verified-existing" : "created";
}

async function main(): Promise<void> {
  const assetRepoRoot = resolve(argumentValue("--asset-repo-root") ?? process.cwd());
  const outputDir = argumentValue("--output-dir");
  const shouldRegister = process.argv.includes("--register");
  const registry = JSON.parse(await readFile(
    resolve(assetRepoRoot, "docs/paper-doll-rig/component-registry.json"),
    "utf8",
  )) as { entries: RegistryEntry[] };
  const entry = registry.entries.find((candidate) => candidate.id === COMPONENT_KEY);
  if (!entry) throw new Error(`Component registry does not contain ${COMPONENT_KEY}.`);
  const placement = JSON.parse(await readFile(
    resolve(assetRepoRoot, "docs/paper-doll-rig/closure-placement-recipe.json"),
    "utf8",
  )) as {
    canvas: { widthPx: number; heightPx: number };
    sharedNeckGeometry: { neckBaseY: number; centerX: number };
    placements: { "plastic-roller-ball": { widthPx: number; anchor: { topY: number; centerX: number } } };
  };
  const placementContract = placement.placements["plastic-roller-ball"];
  if (
    placement.canvas.widthPx !== CYL9_PLASTIC_ROLLER_CONTRACT.canvasWidthPx
    || placement.canvas.heightPx !== CYL9_PLASTIC_ROLLER_CONTRACT.canvasHeightPx
    || placementContract.widthPx !== CYL9_PLASTIC_ROLLER_CONTRACT.targetWidthPx
    || placementContract.anchor.topY !== CYL9_PLASTIC_ROLLER_CONTRACT.anchorTopYPx
    || placementContract.anchor.centerX !== CYL9_PLASTIC_ROLLER_CONTRACT.centerXPx
    || placement.sharedNeckGeometry.centerX !== CYL9_PLASTIC_ROLLER_CONTRACT.centerXPx
    || placement.sharedNeckGeometry.neckBaseY !== 968
  ) {
    throw new Error("Shared CYL-9ML placement recipe drifted from the normalization contract.");
  }

  const sourceBytes = await readFile(resolve(assetRepoRoot, entry.asset.path));
  const normalized = await normalizeRollerLayer(sourceBytes, CYL9_PLASTIC_ROLLER_CONTRACT);
  const plan = buildCyl9PlasticRollerRegistrationPlan({
    organizationId: ORGANIZATION_ID,
    source: {
      sha256: entry.asset.sha256,
      widthPx: entry.asset.widthPx,
      heightPx: entry.asset.heightPx,
      alphaBounds: CYL9_PLASTIC_ROLLER_CONTRACT.sourceAlphaBounds,
      status: entry.status,
      reviewedBy: entry.reviewedBy,
      reviewedAt: entry.reviewedAt,
    },
    normalized,
  });

  const inspectionLineupPath = outputDir
    ? await writeInspectionPack({
      outputDir: resolve(outputDir),
      assetRepoRoot,
      imageBytes: normalized.imageBytes,
      maskBytes: normalized.geometryMaskBytes,
    })
    : null;

  let uploadResults: Array<{ objectPath: string; result: string }> = [];
  let registration: unknown = { dryRun: true, releaseMutation: false, sanityPublished: false };
  if (shouldRegister) {
    const supabaseUrl = process.env.SUPABASE_URL?.trim();
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for --register.");
    }
    if (new URL(supabaseUrl).hostname.split(".")[0] !== EXPECTED_PROJECT_REF) {
      throw new Error(`Refusing to register outside the linked ${EXPECTED_PROJECT_REF} project.`);
    }
    const client = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const bucket = client.storage.from("paper-doll-approved");
    uploadResults = [
      {
        objectPath: plan.version.imagePath,
        result: await uploadOrVerify({
          bucket,
          objectPath: plan.version.imagePath,
          bytes: normalized.imageBytes,
          expectedSha256: normalized.imageSha256,
        }),
      },
      {
        objectPath: plan.maskUpload.path,
        result: await uploadOrVerify({
          bucket,
          objectPath: plan.maskUpload.path,
          bytes: normalized.geometryMaskBytes,
          expectedSha256: normalized.geometryMaskSha256,
        }),
      },
    ];
    const response = await client.rpc("register_paper_doll_approved_source", {
      p_organization_id: ORGANIZATION_ID,
      p_component: plan.component,
      p_version: plan.version,
      p_qa_results: plan.qaResults,
    });
    if (response.error) throw new Error(`Approved-source registration failed: ${response.error.message}`);
    registration = response.data;
  }

  process.stdout.write(`${JSON.stringify({
    source: { path: entry.asset.path, sha256: entry.asset.sha256, reviewedBy: entry.reviewedBy },
    normalized: {
      imageSha256: normalized.imageSha256,
      geometryMaskSha256: normalized.geometryMaskSha256,
      alphaBounds: normalized.alphaBounds,
      authorityMaskAlphaExact: normalized.authorityMaskAlphaExact,
      opaqueWhiteFraction: normalized.opaqueWhiteFraction,
    },
    plan,
    inspectionLineupPath,
    uploadResults,
    registration,
  }, null, 2)}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`CYL-9ML plastic roller registration failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
