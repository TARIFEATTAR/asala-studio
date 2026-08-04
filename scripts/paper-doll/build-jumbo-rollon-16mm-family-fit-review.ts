import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import sharp from "sharp";

type PixelBounds = { left: number; top: number; width: number; height: number };

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const defaultSourceManifestPath = path.join(workspaceRoot, "outputs/paper-doll-cylinder-requested-family-reviews/source-registered-v3-exact-jumbo-rollons/manifest.json");
const defaultAuthorityManifestPath = path.join(workspaceRoot, "outputs/paper-doll-component-authority-reviews/jumbo-rollon-16mm/authority-review-v1/review-manifest.json");
const defaultOutputRoot = path.join(workspaceRoot, "outputs/paper-doll-component-family-fit-reviews/jumbo-rollon-16mm/family-fit-v1");

type SourceFamily = {
  familyKey: string;
  source: { catalogReference?: { capacityMl: number; neckFinish: string } };
  sourceAssemblyBoundsPx: PixelBounds;
  targetAssemblyBoundsPx: PixelBounds;
  uniformScale: number;
  layers: Array<{
    role: string;
    sourceBoundsPx: PixelBounds;
    placementBoundsPx: PixelBounds;
    fullCanvasPlatePath: string;
    fullCanvasPlateSha256: string;
  }>;
};

type AuthorityCandidate = {
  material: string;
  path: string;
  sha256: string;
  qa: { exactAlpha: boolean; mismatchedAlphaBytes: number };
};

type AuthorityGroup = {
  groupKey: string;
  physicalContract: { capacityMl: number; neckSizeMm: number; bodyHeightMm?: number; bodyDiameterMm?: number; assembledHeightMm?: number };
  authoritySource: { sourceBoundsPx: PixelBounds };
  authorityMaskReviewCandidate: { authorityBoundsPx: PixelBounds };
  candidates: AuthorityCandidate[];
};

export function resolveSourceRelativePlacement(input: {
  sourceBodyBoundsPx: PixelBounds;
  targetBodyBoundsPx: PixelBounds;
  sourceComponentBoundsPx: PixelBounds;
  uniformScale: number;
}): PixelBounds {
  const { sourceBodyBoundsPx, targetBodyBoundsPx, sourceComponentBoundsPx, uniformScale } = input;
  if (!Number.isFinite(uniformScale) || uniformScale <= 0) throw new Error("Family Fit requires a positive finite uniform scale.");
  for (const [label, bounds] of Object.entries({ sourceBodyBoundsPx, targetBodyBoundsPx, sourceComponentBoundsPx })) {
    if (![bounds.left, bounds.top, bounds.width, bounds.height].every(Number.isFinite) || bounds.width <= 0 || bounds.height <= 0) {
      throw new Error(`${label} is not a valid pixel box.`);
    }
  }
  return {
    left: Math.round(targetBodyBoundsPx.left + (sourceComponentBoundsPx.left - sourceBodyBoundsPx.left) * uniformScale),
    top: Math.round(targetBodyBoundsPx.top + (sourceComponentBoundsPx.top - sourceBodyBoundsPx.top) * uniformScale),
    width: Math.round(sourceComponentBoundsPx.width * uniformScale),
    height: Math.round(sourceComponentBoundsPx.height * uniformScale),
  };
}

function sha256(value: Buffer | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function resolveArtifactPath(filePath: string): string {
  return path.isAbsolute(filePath) ? filePath : path.resolve(workspaceRoot, filePath);
}

function workspaceRelative(filePath: string): string {
  const relative = path.relative(workspaceRoot, filePath);
  return relative.startsWith("..") ? filePath : relative;
}

function escapeXml(value: string): string {
  return value.replace(/[<>&'\"]/g, (character) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", "\"": "&quot;" })[character] ?? character);
}

async function alphaBytes(png: Buffer): Promise<Buffer> {
  return sharp(png).ensureAlpha().extractChannel("alpha").raw().toBuffer();
}

async function assertCanvas(png: Buffer, canvas: { width: number; height: number }, label: string): Promise<void> {
  const metadata = await sharp(png).metadata();
  if (metadata.width !== canvas.width || metadata.height !== canvas.height) {
    throw new Error(`${label} must use the canonical ${canvas.width}×${canvas.height} canvas.`);
  }
}

async function buildContactSheet(groups: Array<{
  capacityMl: number;
  material: string;
  assembly: Buffer;
  placementBoundsPx: PixelBounds;
}>): Promise<Buffer> {
  const tileWidth = 480;
  const imageHeight = 528;
  const labelHeight = 104;
  const columns = 2;
  const gap = 18;
  const margin = 34;
  const headerHeight = 138;
  const rows = Math.ceil(groups.length / columns);
  const width = margin * 2 + columns * tileWidth + (columns - 1) * gap;
  const height = headerHeight + rows * (imageHeight + labelHeight + gap) + margin;
  const layers: sharp.OverlayOptions[] = [{
    input: Buffer.from(`<svg width="${width}" height="${headerHeight}" xmlns="http://www.w3.org/2000/svg">
      <text x="${margin}" y="48" fill="#f2c36b" font-family="Arial" font-size="30" font-weight="700">28 / 50 mL JUMBO ROLL-ON · FAMILY FIT</text>
      <text x="${margin}" y="84" fill="#d8d2c7" font-family="monospace" font-size="16">Capacity-specific source transforms · plastic and metal-ball fitments</text>
      <text x="${margin}" y="116" fill="#e68a72" font-family="monospace" font-size="15">REVIEW ONLY · NAMED GEOMETRY + FAMILY FIT APPROVAL REQUIRED · OVERCAP PLACEMENT NOT YET PROVEN</text>
    </svg>`),
    left: 0,
    top: 0,
  }];
  for (const [index, group] of groups.entries()) {
    const left = margin + (index % columns) * (tileWidth + gap);
    const top = headerHeight + Math.floor(index / columns) * (imageHeight + labelHeight + gap);
    const preview = await sharp(group.assembly).resize({ width: tileWidth, height: imageHeight, fit: "fill" }).png().toBuffer();
    layers.push({ input: preview, left, top });
    layers.push({
      input: Buffer.from(`<svg width="${tileWidth}" height="${labelHeight}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#191816"/>
        <text x="16" y="30" fill="#f2c36b" font-family="monospace" font-size="18" font-weight="700">${group.capacityMl} mL · ${escapeXml(group.material)}</text>
        <text x="16" y="58" fill="#75dfce" font-family="monospace" font-size="14">SOURCE-RELATIVE PLACEMENT · EXACT GROUP ALPHA</text>
        <text x="16" y="84" fill="#bbb3a5" font-family="monospace" font-size="13">x ${group.placementBoundsPx.left} · y ${group.placementBoundsPx.top} · ${group.placementBoundsPx.width}×${group.placementBoundsPx.height}</text>
      </svg>`),
      left,
      top: top + imageHeight,
    });
  }
  return sharp({ create: { width, height, channels: 4, background: "#11110f" } }).composite(layers).png().toBuffer();
}

export async function buildJumboRollon16mmFamilyFitReview(input: {
  sourceManifestPath?: string;
  authorityManifestPath?: string;
  outputRoot?: string;
  generatedAt?: string;
} = {}) {
  const sourceManifestPath = path.resolve(input.sourceManifestPath ?? defaultSourceManifestPath);
  const authorityManifestPath = path.resolve(input.authorityManifestPath ?? defaultAuthorityManifestPath);
  const outputRoot = path.resolve(input.outputRoot ?? defaultOutputRoot);
  const [sourceManifestText, authorityManifestText] = await Promise.all([
    readFile(sourceManifestPath, "utf8"),
    readFile(authorityManifestPath, "utf8"),
  ]);
  const sourceManifest = JSON.parse(sourceManifestText) as { canonicalCanvas: { width: number; height: number }; families: SourceFamily[] };
  const authorityManifest = JSON.parse(authorityManifestText) as {
    canonicalCanvas: { width: number; height: number };
    lifecycleState: string;
    geometryLocked: boolean;
    productionEligible: boolean;
    groups: AuthorityGroup[];
  };
  const canvas = { width: sourceManifest.canonicalCanvas.width, height: sourceManifest.canonicalCanvas.height };
  if (canvas.width !== authorityManifest.canonicalCanvas.width || canvas.height !== authorityManifest.canonicalCanvas.height) {
    throw new Error("Jumbo body and authority manifests use different canonical canvases.");
  }
  if (authorityManifest.lifecycleState !== "authority-review-required" || authorityManifest.geometryLocked !== false || authorityManifest.productionEligible !== false) {
    throw new Error("Family Fit must consume the review-only jumbo authority package without upgrading its lifecycle state.");
  }
  if (authorityManifest.groups.length !== 2) throw new Error("Jumbo Family Fit requires separate 28 and 50 mL authority groups.");
  await rm(outputRoot, { recursive: true, force: true });
  await mkdir(path.join(outputRoot, "assemblies"), { recursive: true });

  const groups = [];
  const contactSheetGroups: Array<{ capacityMl: number; material: string; assembly: Buffer; placementBoundsPx: PixelBounds }> = [];
  for (const authorityGroup of authorityManifest.groups) {
    const capacityMl = authorityGroup.physicalContract.capacityMl;
    const family = sourceManifest.families.find((candidate) => candidate.familyKey.includes("JUMBO-ROLLON") && candidate.source.catalogReference?.capacityMl === capacityMl);
    if (!family) throw new Error(`Missing exact ${capacityMl} mL jumbo body family.`);
    if (family.source.catalogReference?.neckFinish !== "16mm" || authorityGroup.physicalContract.neckSizeMm !== 16) {
      throw new Error(`${capacityMl} mL jumbo body and roller do not share the verified 16mm contract.`);
    }
    const bodyLayer = family.layers.find((layer) => layer.role === "body");
    if (!bodyLayer?.fullCanvasPlatePath || !bodyLayer.placementBoundsPx) throw new Error(`${family.familyKey} lacks a registered body plate.`);
    const bodyPath = resolveArtifactPath(bodyLayer.fullCanvasPlatePath);
    const bodyPng = await readFile(bodyPath);
    if (sha256(bodyPng) !== bodyLayer.fullCanvasPlateSha256) throw new Error(`${family.familyKey} body SHA-256 mismatch.`);
    await assertCanvas(bodyPng, canvas, `${family.familyKey} body`);
    const placementBoundsPx = resolveSourceRelativePlacement({
      sourceBodyBoundsPx: bodyLayer.sourceBoundsPx,
      targetBodyBoundsPx: bodyLayer.placementBoundsPx,
      sourceComponentBoundsPx: authorityGroup.authoritySource.sourceBoundsPx,
      uniformScale: family.uniformScale,
    });
    if (placementBoundsPx.left < 0 || placementBoundsPx.top < 0 || placementBoundsPx.left + placementBoundsPx.width > canvas.width || placementBoundsPx.top + placementBoundsPx.height > canvas.height) {
      throw new Error(`${capacityMl} mL roller placement escapes the canonical canvas.`);
    }
    if (authorityGroup.candidates.length !== 2) throw new Error(`${capacityMl} mL requires plastic and metal-ball candidates.`);
    let groupAlphaSha256: string | null = null;
    const candidates = [];
    for (const candidate of authorityGroup.candidates) {
      if (!candidate.qa.exactAlpha || candidate.qa.mismatchedAlphaBytes !== 0) throw new Error(`${capacityMl} mL ${candidate.material} lacks exact-alpha evidence.`);
      const candidatePath = resolveArtifactPath(candidate.path);
      const candidatePng = await readFile(candidatePath);
      if (sha256(candidatePng) !== candidate.sha256) throw new Error(`${capacityMl} mL ${candidate.material} SHA-256 mismatch.`);
      await assertCanvas(candidatePng, canvas, `${capacityMl} mL ${candidate.material}`);
      const authorityBoundsPx = authorityGroup.authorityMaskReviewCandidate.authorityBoundsPx;
      const crop = await sharp(candidatePng).extract(authorityBoundsPx).resize(placementBoundsPx.width, placementBoundsPx.height).png().toBuffer();
      const alphaSha = sha256(await alphaBytes(crop));
      groupAlphaSha256 ??= alphaSha;
      if (alphaSha !== groupAlphaSha256) throw new Error(`${capacityMl} mL material candidates changed the placed alpha.`);
      const assembly = await sharp(bodyPng).composite([{ input: crop, left: placementBoundsPx.left, top: placementBoundsPx.top }]).png().toBuffer();
      const relativeAssemblyPath = `assemblies/${capacityMl}ml__${candidate.material}.png`;
      const assemblyPath = path.join(outputRoot, relativeAssemblyPath);
      await writeFile(assemblyPath, assembly);
      candidates.push({
        material: candidate.material,
        sourceCandidate: { path: workspaceRelative(candidatePath), sha256: candidate.sha256 },
        boxes: {
          sourceBoundsPx: authorityGroup.authoritySource.sourceBoundsPx,
          editBoundsPx: authorityGroup.authoritySource.sourceBoundsPx,
          authorityBoundsPx,
          placementBoundsPx,
        },
        exactPlacedAlphaSha256: alphaSha,
        exactAlphaCandidate: true,
        geometryLocked: false,
        productionEligible: false,
        assembly: { path: relativeAssemblyPath, sha256: sha256(assembly) },
      });
      contactSheetGroups.push({ capacityMl, material: candidate.material, assembly, placementBoundsPx });
    }
    groups.push({
      groupKey: authorityGroup.groupKey,
      familyKey: family.familyKey,
      physicalContract: authorityGroup.physicalContract,
      body: {
        path: workspaceRelative(bodyPath),
        sha256: bodyLayer.fullCanvasPlateSha256,
        sourceBoundsPx: bodyLayer.sourceBoundsPx,
        placementBoundsPx: bodyLayer.placementBoundsPx,
        geometryLocked: false,
      },
      placement: {
        placementBoundsPx,
        uniformScale: family.uniformScale,
        rule: "The component retains its source-coordinate relationship to the body under the body family's single uniform transform; no manual nudge is applied.",
        namedFamilyFitApprovalRequired: true,
      },
      candidates,
      exactAlphaAcrossMaterials: true,
      geometryLocked: false,
      productionEligible: false,
    });
  }
  const contactSheet = await buildContactSheet(contactSheetGroups);
  const contactSheetPath = path.join(outputRoot, "contact-sheet.png");
  await writeFile(contactSheetPath, contactSheet);
  const manifest = {
    schemaVersion: 1,
    reviewId: "family-fit__jumbo-rollon__16mm__28-50ml__v1",
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    lifecycleState: "family-fit-review-required",
    canonicalCanvas: canvas,
    provenance: {
      sourceManifestPath: workspaceRelative(sourceManifestPath),
      sourceManifestSha256: sha256(sourceManifestText),
      authorityManifestPath: workspaceRelative(authorityManifestPath),
      authorityManifestSha256: sha256(authorityManifestText),
    },
    groups,
    overcaps: {
      registeredColorsByCapacity: { "28": ["black", "white"], "50": ["black", "white"] },
      placementState: "missing-assembled-placement-authority",
      reason: "The Photoshop sources preserve black and white overcap pixels only as detached layers. A named assembled seating reference is required before Family Fit or a placement lock.",
      productionEligible: false,
    },
    summary: {
      capacityGroupCount: groups.length,
      candidateCount: groups.reduce((count, group) => count + group.candidates.length, 0),
      assemblyCount: groups.reduce((count, group) => count + group.candidates.length, 0),
      exactAlphaWithinEveryCapacity: groups.every((group) => group.exactAlphaAcrossMaterials),
      namedGeometryReviewRequired: true,
      namedFamilyFitApprovalRequired: true,
      overcapPlacementAuthorityRequired: true,
    },
    contactSheet: { path: workspaceRelative(contactSheetPath), sha256: sha256(contactSheet) },
    geometryLocked: false,
    productionEligible: false,
    mutationPolicy: { approvalsWritten: false, placementLockWritten: false, remoteWritesPerformed: false, currentReleaseChanged: false, sanityChanged: false },
  };
  const manifestPath = path.join(outputRoot, "family-fit-manifest.json");
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return { manifest, manifestPath, contactSheetPath };
}

async function main(): Promise<void> {
  const result = await buildJumboRollon16mmFamilyFitReview();
  process.stdout.write(`${JSON.stringify({ manifestPath: result.manifestPath, contactSheetPath: result.contactSheetPath, summary: result.manifest.summary, geometryLocked: result.manifest.geometryLocked, productionEligible: result.manifest.productionEligible, mutationPolicy: result.manifest.mutationPolicy }, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 1; });
}
