import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import sharp from "sharp";

import { resolveCylinderPaperDollPresentation } from "../../src/config/bestBottlesCylinderPresentation";
import {
  buildRegisteredFamilyLayerPlan,
  type RegisteredFamilyBounds,
  type RegisteredFamilyLayerRole,
} from "../../src/lib/paperDoll/registeredFamilyLayerPlan";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const defaultRecipePath = path.join(workspaceRoot, "docs/paper-doll-rig/cylinder-requested-family-source-recipes.json");
const defaultOutputRoot = path.join(workspaceRoot, "outputs/paper-doll-cylinder-requested-family-reviews/source-registered-v3-exact-jumbo-rollons");

type IdentityStatus = "source-backed" | "manual-review-required";

interface ExactCatalogIdentity {
  websiteSku: string;
  graceSku: string;
}

interface SourceRecipeLayer {
  layerId: string;
  role: RegisteredFamilyLayerRole;
  sceneIndex: number;
  sourceBoundsPx: RegisteredFamilyBounds;
  assemblyMember: boolean;
  zIndex: number;
}

interface SourceRecipeFamily {
  familyKey: string;
  label: string;
  displayKey: string;
  geometry: {
    geometryKey: string;
    capacityMl: number;
    bodyHeightMm: number;
    bodyWidthMm: number;
    neckFinish: string;
  };
  source: {
    archiveRelativePath: string;
    originalFilename: string;
    sha256: string;
    canvas: { width: number; height: number };
    identityStatus: IdentityStatus;
    exactCatalogIdentities?: ExactCatalogIdentity[];
    identityConflict?: string;
    notes?: string;
    excludedScenes?: Array<{ sceneIndex: number; reason: string }>;
  };
  layers: SourceRecipeLayer[];
}

interface RejectedRegistration {
  requestedLabel: string;
  rejectedFamilyKey: string;
  reason: string;
  promotionAllowed: false;
  catalogEvidence: { skus: string[] };
  sourceEvidence: { archiveRelativePath: string; sha256: string };
}

interface UnresolvedRequestedFamily {
  requestedLabel: string;
  status: "missing-exact-identity";
  requiredEvidence: string;
}

interface SupersededIdentityCorrection {
  requestedLabel: string;
  previousDecision: "quarantined-wrong-family";
  status: "superseded-by-exact-user-reference";
  resolution: string;
  exactCatalogIdentities: ExactCatalogIdentity[];
}

interface SourceRecipe {
  schemaVersion: 1;
  state: "source-registered-review-only";
  canonicalCanvas: {
    width: number;
    height: number;
    centerX: number;
    baselineY: number;
    background: string;
  };
  rules: {
    transformScope: "complete-paper-doll-assembly";
    geometryLockGate: "approved-exact-alpha-mask-and-clamp";
    enhancementPolicy: "material-and-lighting-only";
    detachedComponentPolicy: "review-only-until-family-fit-approval";
    remoteWritesAllowed: false;
  };
  rejectedRegistrations: RejectedRegistration[];
  unresolvedRequestedFamilies: UnresolvedRequestedFamily[];
  supersededIdentityCorrections: SupersededIdentityCorrection[];
  families: SourceRecipeFamily[];
}

export type DecodePsdScene = (sourcePath: string, sceneIndex: number) => Promise<Buffer>;

export interface BuildCylinderRequestedFamilyReviewInput {
  recipe: unknown;
  archiveRoot: string;
  outputRoot: string;
  decodePsdScene?: DecodePsdScene;
  generatedAt?: string;
}

const sha256 = (value: Buffer) => createHash("sha256").update(value).digest("hex");

function assertRecord(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object.`);
}

function assertInteger(value: unknown, label: string, minimum = 0): asserts value is number {
  if (!Number.isInteger(value) || (value as number) < minimum) throw new Error(`${label} must be an integer >= ${minimum}.`);
}

function assertString(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
}

function parseBounds(value: unknown, label: string): RegisteredFamilyBounds {
  assertRecord(value, label);
  assertInteger(value.left, `${label}.left`);
  assertInteger(value.top, `${label}.top`);
  assertInteger(value.width, `${label}.width`, 1);
  assertInteger(value.height, `${label}.height`, 1);
  return { left: value.left, top: value.top, width: value.width, height: value.height };
}

function parseExactCatalogIdentities(value: unknown, label: string): ExactCatalogIdentity[] {
  if (!Array.isArray(value) || value.length < 1) throw new Error(`${label} must contain at least one exact identity.`);
  const seen = new Set<string>();
  return value.map((candidate, index) => {
    const identityLabel = `${label}[${index}]`;
    assertRecord(candidate, identityLabel);
    assertString(candidate.websiteSku, `${identityLabel}.websiteSku`);
    assertString(candidate.graceSku, `${identityLabel}.graceSku`);
    const key = `${candidate.websiteSku}|${candidate.graceSku}`;
    if (seen.has(key)) throw new Error(`Duplicate exact catalog identity: ${key}`);
    seen.add(key);
    return { websiteSku: candidate.websiteSku, graceSku: candidate.graceSku };
  });
}

export function parseCylinderRequestedFamilySourceRecipe(value: unknown): SourceRecipe {
  assertRecord(value, "recipe");
  if (value.schemaVersion !== 1 || value.state !== "source-registered-review-only") {
    throw new Error("Cylinder source recipe must be schema v1 and review-only.");
  }
  assertRecord(value.canonicalCanvas, "canonicalCanvas");
  const canvas = value.canonicalCanvas;
  assertInteger(canvas.width, "canonicalCanvas.width", 1);
  assertInteger(canvas.height, "canonicalCanvas.height", 1);
  assertInteger(canvas.centerX, "canonicalCanvas.centerX");
  assertInteger(canvas.baselineY, "canonicalCanvas.baselineY");
  assertString(canvas.background, "canonicalCanvas.background");
  assertRecord(value.rules, "rules");
  if (value.rules.transformScope !== "complete-paper-doll-assembly"
    || value.rules.geometryLockGate !== "approved-exact-alpha-mask-and-clamp"
    || value.rules.enhancementPolicy !== "material-and-lighting-only"
    || value.rules.detachedComponentPolicy !== "review-only-until-family-fit-approval"
    || value.rules.remoteWritesAllowed !== false) {
    throw new Error("Cylinder source recipe violates the review-only mask-and-clamp rules.");
  }
  const rejectedRegistrations = (value.rejectedRegistrations ?? []) as unknown;
  if (!Array.isArray(rejectedRegistrations)) throw new Error("rejectedRegistrations must be an array.");
  const parsedRejectedRegistrations = rejectedRegistrations.map((candidate, index): RejectedRegistration => {
    const label = `rejectedRegistrations[${index}]`;
    assertRecord(candidate, label);
    assertString(candidate.requestedLabel, `${label}.requestedLabel`);
    assertString(candidate.rejectedFamilyKey, `${label}.rejectedFamilyKey`);
    assertString(candidate.reason, `${label}.reason`);
    if (candidate.promotionAllowed !== false) throw new Error(`${label}.promotionAllowed must remain false.`);
    assertRecord(candidate.catalogEvidence, `${label}.catalogEvidence`);
    if (!Array.isArray(candidate.catalogEvidence.skus) || candidate.catalogEvidence.skus.length < 1) {
      throw new Error(`${label}.catalogEvidence.skus must identify at least one rejected catalog product.`);
    }
    candidate.catalogEvidence.skus.forEach((sku, skuIndex) => assertString(sku, `${label}.catalogEvidence.skus[${skuIndex}]`));
    assertRecord(candidate.sourceEvidence, `${label}.sourceEvidence`);
    assertString(candidate.sourceEvidence.archiveRelativePath, `${label}.sourceEvidence.archiveRelativePath`);
    if (typeof candidate.sourceEvidence.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(candidate.sourceEvidence.sha256)) {
      throw new Error(`${label}.sourceEvidence.sha256 must be a lowercase SHA-256 digest.`);
    }
    return candidate as unknown as RejectedRegistration;
  });
  const unresolvedRequestedFamilies = (value.unresolvedRequestedFamilies ?? []) as unknown;
  if (!Array.isArray(unresolvedRequestedFamilies)) throw new Error("unresolvedRequestedFamilies must be an array.");
  const parsedUnresolvedRequestedFamilies = unresolvedRequestedFamilies.map((candidate, index): UnresolvedRequestedFamily => {
    const label = `unresolvedRequestedFamilies[${index}]`;
    assertRecord(candidate, label);
    assertString(candidate.requestedLabel, `${label}.requestedLabel`);
    if (candidate.status !== "missing-exact-identity") throw new Error(`${label}.status is invalid.`);
    assertString(candidate.requiredEvidence, `${label}.requiredEvidence`);
    return candidate as unknown as UnresolvedRequestedFamily;
  });
  const supersededIdentityCorrections = (value.supersededIdentityCorrections ?? []) as unknown;
  if (!Array.isArray(supersededIdentityCorrections)) throw new Error("supersededIdentityCorrections must be an array.");
  const parsedSupersededIdentityCorrections = supersededIdentityCorrections.map((candidate, index): SupersededIdentityCorrection => {
    const label = `supersededIdentityCorrections[${index}]`;
    assertRecord(candidate, label);
    assertString(candidate.requestedLabel, `${label}.requestedLabel`);
    if (candidate.previousDecision !== "quarantined-wrong-family"
      || candidate.status !== "superseded-by-exact-user-reference") {
      throw new Error(`${label} must explicitly supersede the earlier quarantine decision.`);
    }
    assertString(candidate.resolution, `${label}.resolution`);
    return {
      requestedLabel: candidate.requestedLabel,
      previousDecision: candidate.previousDecision,
      status: candidate.status,
      resolution: candidate.resolution,
      exactCatalogIdentities: parseExactCatalogIdentities(candidate.exactCatalogIdentities, `${label}.exactCatalogIdentities`),
    };
  });
  if (!Array.isArray(value.families) || value.families.length < 1) throw new Error("At least one source family is required.");
  const familyKeys = new Set<string>();
  const families = value.families.map((candidate, familyIndex): SourceRecipeFamily => {
    const label = `families[${familyIndex}]`;
    assertRecord(candidate, label);
    assertString(candidate.familyKey, `${label}.familyKey`);
    if (familyKeys.has(candidate.familyKey)) throw new Error(`Duplicate familyKey: ${candidate.familyKey}`);
    familyKeys.add(candidate.familyKey);
    assertString(candidate.label, `${label}.label`);
    assertString(candidate.displayKey, `${label}.displayKey`);
    assertRecord(candidate.geometry, `${label}.geometry`);
    assertString(candidate.geometry.geometryKey, `${label}.geometry.geometryKey`);
    assertInteger(candidate.geometry.capacityMl, `${label}.geometry.capacityMl`, 1);
    if (typeof candidate.geometry.bodyHeightMm !== "number" || candidate.geometry.bodyHeightMm <= 0
      || typeof candidate.geometry.bodyWidthMm !== "number" || candidate.geometry.bodyWidthMm <= 0) {
      throw new Error(`${label}.geometry physical dimensions must be positive.`);
    }
    assertString(candidate.geometry.neckFinish, `${label}.geometry.neckFinish`);
    assertRecord(candidate.source, `${label}.source`);
    assertString(candidate.source.archiveRelativePath, `${label}.source.archiveRelativePath`);
    assertString(candidate.source.originalFilename, `${label}.source.originalFilename`);
    if (typeof candidate.source.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(candidate.source.sha256)) {
      throw new Error(`${label}.source.sha256 must be a lowercase SHA-256 digest.`);
    }
    assertRecord(candidate.source.canvas, `${label}.source.canvas`);
    assertInteger(candidate.source.canvas.width, `${label}.source.canvas.width`, 1);
    assertInteger(candidate.source.canvas.height, `${label}.source.canvas.height`, 1);
    if (candidate.source.identityStatus !== "source-backed" && candidate.source.identityStatus !== "manual-review-required") {
      throw new Error(`${label}.source.identityStatus is invalid.`);
    }
    if (candidate.source.exactCatalogIdentities !== undefined) {
      parseExactCatalogIdentities(candidate.source.exactCatalogIdentities, `${label}.source.exactCatalogIdentities`);
    }
    if (!Array.isArray(candidate.layers) || candidate.layers.length < 2) throw new Error(`${label}.layers are required.`);
    const layers = candidate.layers.map((layerValue, layerIndex): SourceRecipeLayer => {
      const layerLabel = `${label}.layers[${layerIndex}]`;
      assertRecord(layerValue, layerLabel);
      assertString(layerValue.layerId, `${layerLabel}.layerId`);
      if (!["body", "exterior-component", "body-contextual", "detached-review", "integration-reference"].includes(String(layerValue.role))) {
        throw new Error(`${layerLabel}.role is invalid.`);
      }
      assertInteger(layerValue.sceneIndex, `${layerLabel}.sceneIndex`);
      assertInteger(layerValue.zIndex, `${layerLabel}.zIndex`);
      if (typeof layerValue.assemblyMember !== "boolean") throw new Error(`${layerLabel}.assemblyMember must be boolean.`);
      return {
        layerId: layerValue.layerId,
        role: layerValue.role as RegisteredFamilyLayerRole,
        sceneIndex: layerValue.sceneIndex,
        sourceBoundsPx: parseBounds(layerValue.sourceBoundsPx, `${layerLabel}.sourceBoundsPx`),
        assemblyMember: layerValue.assemblyMember,
        zIndex: layerValue.zIndex,
      };
    });
    return {
      familyKey: candidate.familyKey,
      label: candidate.label,
      displayKey: candidate.displayKey,
      geometry: candidate.geometry as SourceRecipeFamily["geometry"],
      source: candidate.source as unknown as SourceRecipeFamily["source"],
      layers,
    };
  });
  return {
    schemaVersion: 1,
    state: "source-registered-review-only",
    canonicalCanvas: canvas as unknown as SourceRecipe["canonicalCanvas"],
    rules: value.rules as unknown as SourceRecipe["rules"],
    rejectedRegistrations: parsedRejectedRegistrations,
    unresolvedRequestedFamilies: parsedUnresolvedRequestedFamilies,
    supersededIdentityCorrections: parsedSupersededIdentityCorrections,
    families,
  };
}

function resolveInside(root: string, relativePath: string): string {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, relativePath);
  if (resolved !== resolvedRoot && !resolved.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error(`Source path escapes archive root: ${relativePath}`);
  }
  return resolved;
}

function safeToken(value: string): string {
  return value.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase();
}

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

export function clipLayerBoundsToSourceCanvas(
  bounds: RegisteredFamilyBounds,
  canvas: { width: number; height: number },
): RegisteredFamilyBounds {
  const left = Math.max(0, bounds.left);
  const top = Math.max(0, bounds.top);
  const right = Math.min(canvas.width, bounds.left + bounds.width);
  const bottom = Math.min(canvas.height, bounds.top + bounds.height);
  if (right <= left || bottom <= top) throw new Error("Photoshop layer does not intersect its source document canvas.");
  return { left, top, width: right - left, height: bottom - top };
}

async function runMagick(args: string[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn("magick", args, { stdio: ["ignore", "pipe", "pipe"] });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`ImageMagick failed (${code ?? "signal"}): ${Buffer.concat(stderr).toString("utf8").trim()}`));
        return;
      }
      resolve(Buffer.concat(stdout));
    });
  });
}

const defaultDecodePsdScene: DecodePsdScene = (sourcePath, sceneIndex) => (
  runMagick(["-background", "none", `${sourcePath}[${sceneIndex}]`, "png:-"])
);

async function fullCanvasLayer(
  sourcePng: Buffer,
  placement: RegisteredFamilyBounds,
  canvas: { width: number; height: number },
): Promise<Buffer> {
  const resized = await sharp(sourcePng).resize(placement.width, placement.height, { fit: "fill", kernel: sharp.kernel.lanczos3 }).png().toBuffer();
  return sharp({ create: { width: canvas.width, height: canvas.height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: resized, left: placement.left, top: placement.top }]).png().toBuffer();
}

async function familyContactSheet(
  families: Array<{ label: string; displayKey: string; identityStatus: IdentityStatus; assemblyPreviewPath: string }>,
  outputPath: string,
): Promise<void> {
  const tileWidth = 720;
  const tileHeight = 900;
  const columns = Math.min(3, families.length);
  const overlays: sharp.OverlayOptions[] = [];
  for (let index = 0; index < families.length; index += 1) {
    const family = families[index];
    const tileLeft = (index % columns) * tileWidth;
    const tileTop = Math.floor(index / columns) * tileHeight;
    const preview = await sharp(family.assemblyPreviewPath)
      .resize({ width: 660, height: 760, fit: "contain", background: "#F5F3EF" }).png().toBuffer();
    const label = Buffer.from(`<svg width="${tileWidth}" height="110"><rect width="100%" height="100%" fill="#171714"/><text x="24" y="38" font-family="Arial" font-size="24" fill="#E4BC68">${escapeXml(family.label)}</text><text x="24" y="70" font-family="Arial" font-size="17" fill="#FFFFFF">${escapeXml(family.displayKey)}</text><text x="24" y="96" font-family="Arial" font-size="15" fill="${family.identityStatus === "source-backed" ? "#64D995" : "#F4B860"}">${escapeXml(family.identityStatus)}</text></svg>`);
    overlays.push({ input: preview, left: tileLeft + 30, top: tileTop + 10 }, { input: label, left: tileLeft, top: tileTop + 790 });
  }
  await sharp({
    create: {
      width: columns * tileWidth,
      height: Math.ceil(families.length / columns) * tileHeight,
      channels: 4,
      background: "#F5F3EF",
    },
  }).composite(overlays).png().toFile(outputPath);
}

export async function buildCylinderRequestedFamilyReview(input: BuildCylinderRequestedFamilyReviewInput) {
  const recipe = parseCylinderRequestedFamilySourceRecipe(input.recipe);
  const decodePsdScene = input.decodePsdScene ?? defaultDecodePsdScene;
  const sourceChecks = await Promise.all(recipe.families.map(async (family) => {
    const sourcePath = resolveInside(input.archiveRoot, family.source.archiveRelativePath);
    const bytes = await readFile(sourcePath);
    const actualSha256 = sha256(bytes);
    if (actualSha256 !== family.source.sha256) {
      throw new Error(`Photoshop source SHA-256 mismatch for ${family.familyKey}: expected ${family.source.sha256}, received ${actualSha256}.`);
    }
    return { family, sourcePath };
  }));

  await mkdir(input.outputRoot, { recursive: true });
  const manifestFamilies = [];
  for (const { family, sourcePath } of sourceChecks) {
    const presentation = resolveCylinderPaperDollPresentation(family.displayKey);
    const visibleBoundsByLayer = new Map(family.layers.map((layer) => [
      layer.layerId,
      clipLayerBoundsToSourceCanvas(layer.sourceBoundsPx, family.source.canvas),
    ]));
    const plan = buildRegisteredFamilyLayerPlan({
      familyKey: family.familyKey,
      canvas: { width: recipe.canonicalCanvas.width, height: recipe.canonicalCanvas.height },
      targetCenterX: recipe.canonicalCanvas.centerX,
      targetBaselineY: recipe.canonicalCanvas.baselineY,
      targetAssembledHeightPct: presentation.targetAssembledHeightPct,
      layers: family.layers.map(({ layerId, role, assemblyMember }) => ({
        layerId,
        role,
        sourceBoundsPx: visibleBoundsByLayer.get(layerId)!,
        assemblyMember,
      })),
    });
    const familyRoot = path.join(input.outputRoot, safeToken(family.familyKey));
    const plateRoot = path.join(familyRoot, "review-plates");
    const detachedRoot = path.join(familyRoot, "detached-source-reviews");
    await mkdir(plateRoot, { recursive: true });
    await mkdir(detachedRoot, { recursive: true });
    const decoded = new Map<number, Buffer>();
    for (const layer of family.layers) {
      const scenePng = await decodePsdScene(sourcePath, layer.sceneIndex);
      const metadata = await sharp(scenePng).metadata();
      if (metadata.width !== layer.sourceBoundsPx.width || metadata.height !== layer.sourceBoundsPx.height) {
        throw new Error(`${family.familyKey}/${layer.layerId} scene ${layer.sceneIndex} decoded at ${metadata.width ?? "?"}x${metadata.height ?? "?"}; calibrated bounds require ${layer.sourceBoundsPx.width}x${layer.sourceBoundsPx.height}.`);
      }
      const visibleBoundsPx = visibleBoundsByLayer.get(layer.layerId)!;
      const crop = {
        left: visibleBoundsPx.left - layer.sourceBoundsPx.left,
        top: visibleBoundsPx.top - layer.sourceBoundsPx.top,
        width: visibleBoundsPx.width,
        height: visibleBoundsPx.height,
      };
      const visibleScenePng = crop.left === 0 && crop.top === 0
        && crop.width === layer.sourceBoundsPx.width && crop.height === layer.sourceBoundsPx.height
        ? scenePng
        : await sharp(scenePng).extract(crop).png().toBuffer();
      decoded.set(layer.sceneIndex, visibleScenePng);
    }
    const outputLayers = [];
    for (const layer of family.layers) {
      const planned = plan.layers.find((candidate) => candidate.layerId === layer.layerId)!;
      const scenePng = decoded.get(layer.sceneIndex)!;
      if (planned.placementBoundsPx) {
        const fullCanvasPng = await fullCanvasLayer(scenePng, planned.placementBoundsPx, recipe.canonicalCanvas);
        const fullCanvasPlatePath = path.join(plateRoot, `${safeToken(layer.layerId)}.png`);
        await writeFile(fullCanvasPlatePath, fullCanvasPng);
        outputLayers.push({
          ...layer,
          sourceBoundsPx: layer.sourceBoundsPx,
          editBoundsPx: planned.sourceBoundsPx,
          authorityBoundsPx: null,
          placementBoundsPx: planned.placementBoundsPx,
          uniformScale: planned.uniformScale,
          fullCanvasPlatePath,
          fullCanvasPlateSha256: sha256(fullCanvasPng),
          detachedReviewPath: null,
          geometryLocked: false,
          productionEligible: false,
        });
      } else {
        const detachedReviewPath = path.join(detachedRoot, `${safeToken(layer.layerId)}__scene-${layer.sceneIndex}.png`);
        await writeFile(detachedReviewPath, scenePng);
        outputLayers.push({
          ...layer,
          sourceBoundsPx: layer.sourceBoundsPx,
          editBoundsPx: planned.sourceBoundsPx,
          authorityBoundsPx: null,
          placementBoundsPx: null,
          uniformScale: null,
          fullCanvasPlatePath: null,
          fullCanvasPlateSha256: null,
          detachedReviewPath,
          detachedReviewSha256: sha256(scenePng),
          geometryLocked: false,
          productionEligible: false,
        });
      }
    }
    const assemblyLayers = outputLayers.filter((layer) => layer.assemblyMember).sort((a, b) => a.zIndex - b.zIndex);
    const assemblyPlate = await sharp({ create: { width: recipe.canonicalCanvas.width, height: recipe.canonicalCanvas.height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite(assemblyLayers.map((layer) => ({ input: layer.fullCanvasPlatePath! }))).png().toBuffer();
    const assemblyPlatePath = path.join(familyRoot, "assembly-review-plate.png");
    await writeFile(assemblyPlatePath, assemblyPlate);
    const assemblyPreview = await sharp({
      create: {
        width: recipe.canonicalCanvas.width,
        height: recipe.canonicalCanvas.height,
        channels: 4,
        background: recipe.canonicalCanvas.background,
      },
    }).composite([{ input: assemblyPlate }]).png().toBuffer();
    const assemblyPreviewPath = path.join(familyRoot, "assembly-preview-bone.png");
    await writeFile(assemblyPreviewPath, assemblyPreview);
    manifestFamilies.push({
      familyKey: family.familyKey,
      label: family.label,
      displayKey: family.displayKey,
      identityStatus: family.source.identityStatus,
      geometry: family.geometry,
      source: { ...family.source, sourcePath },
      catalogPresentation: presentation,
      sourceAssemblyBoundsPx: plan.sourceAssemblyBoundsPx,
      targetAssemblyBoundsPx: plan.targetAssemblyBoundsPx,
      uniformScale: plan.uniformScale,
      transformScope: plan.transformScope,
      layers: outputLayers,
      assemblyPlatePath,
      assemblyPlateSha256: sha256(assemblyPlate),
      assemblyPreviewPath,
      assemblyPreviewSha256: sha256(assemblyPreview),
      identityReviewRequired: family.source.identityStatus === "manual-review-required",
      geometryLocked: false,
      productionEligible: false,
      namedGeometryAndFamilyFitApprovalRequired: true,
    });
  }
  const contactSheetPath = path.join(input.outputRoot, "contact-sheet.png");
  await familyContactSheet(manifestFamilies, contactSheetPath);
  const manifest = {
    schemaVersion: 1,
    state: "source-registered-review-only",
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    canonicalCanvas: recipe.canonicalCanvas,
    rules: recipe.rules,
    rejectedRegistrations: recipe.rejectedRegistrations,
    unresolvedRequestedFamilies: recipe.unresolvedRequestedFamilies,
    supersededIdentityCorrections: recipe.supersededIdentityCorrections,
    families: manifestFamilies,
    summary: {
      familyCount: manifestFamilies.length,
      sourceBackedCount: manifestFamilies.filter((family) => !family.identityReviewRequired).length,
      manualIdentityReviewCount: manifestFamilies.filter((family) => family.identityReviewRequired).length,
      geometryLockedCount: 0,
      productionEligibleCount: 0,
      rejectedRegistrationCount: recipe.rejectedRegistrations.length,
      unresolvedRequestedFamilyCount: recipe.unresolvedRequestedFamilies.length,
      supersededIdentityCorrectionCount: recipe.supersededIdentityCorrections.length,
    },
    enhancementBoundary: {
      allowed: ["material fidelity", "lighting fidelity", "reflection quality", "surface finish"],
      forbidden: ["silhouette", "dimensions", "perspective", "component placement", "camera framing"],
      lockRule: "A bounding box is not a geometry lock. Only an approved exact-alpha authority mask plus mask-and-clamp verification can earn geometry lock.",
    },
    mutationPolicy: { remoteWritesPerformed: false, currentReleaseChanged: false, sanityChanged: false },
  };
  const manifestPath = path.join(input.outputRoot, "manifest.json");
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return { manifest, manifestPath, contactSheetPath };
}

async function main() {
  const recipe = JSON.parse(await readFile(defaultRecipePath, "utf8")) as unknown;
  const archiveRoot = (recipe as { archiveRoot?: string }).archiveRoot;
  if (!archiveRoot) throw new Error("Source recipe is missing archiveRoot.");
  const result = await buildCylinderRequestedFamilyReview({ recipe, archiveRoot, outputRoot: defaultOutputRoot });
  process.stdout.write(`${JSON.stringify({
    manifestPath: path.relative(workspaceRoot, result.manifestPath),
    contactSheetPath: path.relative(workspaceRoot, result.contactSheetPath),
    summary: result.manifest.summary,
    geometryLocked: false,
    productionEligible: false,
    remoteWritesPerformed: false,
  }, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
