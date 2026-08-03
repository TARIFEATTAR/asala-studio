import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const reviewGroupsPath = path.join(workspaceRoot, "docs/paper-doll-rig/component-geometry-review-groups.json");
const authorityQueuePath = path.join(workspaceRoot, "docs/paper-doll-rig/component-authority-queue.json");
const defaultOutputRoot = path.join(workspaceRoot, "outputs/paper-doll-component-authority-reviews");

export const COMPONENT_REFERENCE_CONFIRMATION = "FETCH_COMPONENT_REFERENCES";

function sha256(value: Buffer | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function escapeXml(value: string): string {
  return value.replace(/[<>&'\"]/g, (character) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", "\"": "&quot;" })[character] ?? character);
}

function slug(value: string): string {
  return value.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function extensionFor(url: string, contentType: string | null): string {
  const urlExtension = path.extname(new URL(url).pathname).toLowerCase();
  if (/^\.(gif|png|jpe?g|webp)$/.test(urlExtension)) return urlExtension;
  if (contentType?.includes("gif")) return ".gif";
  if (contentType?.includes("png")) return ".png";
  if (contentType?.includes("webp")) return ".webp";
  return ".jpg";
}

export interface ComponentReferenceReviewOptions {
  groupKey: string;
  execute?: boolean;
  confirmation?: string;
  outputRoot?: string;
  fetchImpl?: typeof fetch;
}

export async function buildComponentReferenceReview(options: ComponentReferenceReviewOptions) {
  const [groupsText, queueText] = await Promise.all([
    readFile(reviewGroupsPath, "utf8"),
    readFile(authorityQueuePath, "utf8"),
  ]);
  const groups = JSON.parse(groupsText) as any;
  const queue = JSON.parse(queueText) as any;
  const group = groups.groups.find((candidate: any) => candidate.reviewGroupKey === options.groupKey);
  if (!group) throw new Error(`Unknown component geometry review group: ${options.groupKey}`);
  const queueByIdentity = new Map(queue.items.map((item: any) => [item.sourceIdentity, item]));
  const references = group.sourceIdentities.flatMap((sourceIdentity: string) => {
    const item = queueByIdentity.get(sourceIdentity) as any;
    if (!item) throw new Error(`Missing component authority queue identity: ${sourceIdentity}`);
    return item.referenceUrls.map((url: string, index: number) => ({
      sourceIdentity,
      referenceIndex: index + 1,
      url,
    }));
  });
  const plan = {
    reviewGroupKey: group.reviewGroupKey,
    descriptorSignature: group.descriptorSignature,
    sourceIdentityCount: group.sourceIdentityCount,
    sourceReferenceCount: references.length,
    sourceIdentitiesWithoutImage: group.sourceIdentities.filter((identity: string) => ((queueByIdentity.get(identity) as any)?.referenceUrls.length ?? 0) === 0),
    geometryClaim: "unverified-descriptor-cluster" as const,
    references,
    mutationPolicy: { remoteWritesPerformed: false, currentReleaseChanged: false, sanityChanged: false },
  };
  if (!options.execute) return { mode: "dry-run" as const, plan };
  if (options.confirmation !== COMPONENT_REFERENCE_CONFIRMATION) {
    throw new Error(`Execution requires --confirm ${COMPONENT_REFERENCE_CONFIRMATION}.`);
  }
  if (references.length === 0) throw new Error("The selected review group has no component image references.");

  const fetchImpl = options.fetchImpl ?? fetch;
  const outputRoot = options.outputRoot ?? defaultOutputRoot;
  const groupDir = path.join(outputRoot, group.reviewGroupKey);
  const sourceDir = path.join(groupDir, "source");
  const previewDir = path.join(groupDir, "preview");
  await Promise.all([mkdir(sourceDir, { recursive: true }), mkdir(previewDir, { recursive: true })]);

  const downloaded = [];
  for (const reference of references) {
    const response = await fetchImpl(reference.url);
    if (!response.ok) throw new Error(`Reference download failed ${response.status}: ${reference.url}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get("content-type");
    const extension = extensionFor(reference.url, contentType);
    const basename = `${slug(reference.sourceIdentity)}__${String(reference.referenceIndex).padStart(2, "0")}`;
    const sourcePath = path.join(sourceDir, `${basename}${extension}`);
    const previewPath = path.join(previewDir, `${basename}.png`);
    await writeFile(sourcePath, buffer);
    const image = sharp(buffer, { animated: false });
    const metadata = await image.metadata();
    await image.png().toFile(previewPath);
    downloaded.push({
      ...reference,
      sourcePath: path.relative(workspaceRoot, sourcePath),
      previewPath: path.relative(workspaceRoot, previewPath),
      originalFilename: path.basename(new URL(reference.url).pathname),
      contentType: contentType ?? "unknown",
      byteLength: buffer.length,
      sha256: sha256(buffer),
      width: metadata.width ?? null,
      height: metadata.height ?? null,
      format: metadata.format ?? null,
    });
  }

  const tileWidth = 520;
  const tileHeight = 600;
  const columns = Math.min(3, downloaded.length);
  const rows = Math.ceil(downloaded.length / columns);
  const composites = await Promise.all(downloaded.map(async (source, index) => {
    const referenceBuffer = await readFile(path.join(workspaceRoot, source.previewPath));
    const contained = await sharp(referenceBuffer)
      .resize({ width: 440, height: 440, fit: "contain", background: "#F5F3EF" })
      .png()
      .toBuffer();
    const caption = Buffer.from(`<svg width="${tileWidth}" height="${tileHeight}">
      <rect x="1" y="1" width="${tileWidth - 2}" height="${tileHeight - 2}" fill="none" stroke="#C6A15B" stroke-width="2"/>
      <text x="24" y="500" font-family="Arial, sans-serif" font-size="24" font-weight="700" fill="#151515">${escapeXml(source.sourceIdentity)}</text>
      <text x="24" y="534" font-family="Arial, sans-serif" font-size="18" fill="#5C574E">${source.width}×${source.height} · ${escapeXml(source.sha256.slice(0, 12))}</text>
      <text x="24" y="568" font-family="Arial, sans-serif" font-size="16" fill="#A5453C">UNVERIFIED SOURCE · NOT GEOMETRY LOCKED</text>
    </svg>`);
    const tile = await sharp({ create: { width: tileWidth, height: tileHeight, channels: 4, background: "#F5F3EF" } })
      .composite([{ input: contained, left: 40, top: 30 }, { input: caption, left: 0, top: 0 }])
      .png()
      .toBuffer();
    return { input: tile, left: (index % columns) * tileWidth, top: Math.floor(index / columns) * tileHeight };
  }));
  const contactSheetPath = path.join(groupDir, "contact-sheet.png");
  await sharp({ create: { width: columns * tileWidth, height: rows * tileHeight, channels: 4, background: "#151515" } })
    .composite(composites)
    .png()
    .toFile(contactSheetPath);

  const manifest = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    generatedFrom: {
      reviewGroupsPath: path.relative(workspaceRoot, reviewGroupsPath),
      reviewGroupsSha256: sha256(groupsText),
      authorityQueuePath: path.relative(workspaceRoot, authorityQueuePath),
      authorityQueueSha256: sha256(queueText),
    },
    group,
    downloaded,
    contactSheetPath: path.relative(workspaceRoot, contactSheetPath),
    reviewState: "visual-and-physical-review-required",
    geometryClaim: "unverified-descriptor-cluster",
    productionPolicy: {
      authorityCreated: false,
      candidateCreated: false,
      compatibilityInferred: false,
      geometryLocked: false,
    },
    mutationPolicy: { remoteWritesPerformed: false, currentReleaseChanged: false, sanityChanged: false },
  };
  const manifestPath = path.join(groupDir, "reference-review.json");
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return { mode: "executed" as const, plan, manifestPath, contactSheetPath, manifest };
}

function parseArgs(argv: string[]) {
  const get = (name: string) => {
    const index = argv.indexOf(name);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  return {
    groupKey: get("--group-key") ?? "",
    execute: argv.includes("--execute"),
    confirmation: get("--confirm"),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.groupKey) throw new Error("Usage: --group-key <geometry-review-key> [--execute --confirm FETCH_COMPONENT_REFERENCES]");
  const result = await buildComponentReferenceReview(args);
  console.log(JSON.stringify(result.mode === "dry-run" ? result : {
    mode: result.mode,
    plan: result.plan,
    manifestPath: result.manifestPath,
    contactSheetPath: result.contactSheetPath,
    downloaded: result.manifest.downloaded.length,
    productionPolicy: result.manifest.productionPolicy,
    mutationPolicy: result.manifest.mutationPolicy,
  }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
