import { createHash } from "node:crypto";
import {
  copyFile,
  mkdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import sharp from "sharp";

import { solveLockedPixelPlacement } from "./closureMaterialPilot";
import type { RgbaImage } from "./componentRegistry";
import {
  detectAlphaForegroundBounds,
  detectPlateForegroundBounds,
} from "./compositeEngine";
import {
  PAPER_DOLL_RELEASE_CANVAS,
  parsePaperDollReleaseManifest,
  type PaperDollReleaseAsset,
  type PaperDollReleaseManifest,
} from "./releaseContract";
import { hashPaperDollRelease } from "./releaseHash.node";
import {
  validatePaperDollRelease,
  type PaperDollReleaseValidation,
} from "./releaseValidator";

const BODY_VARIANTS = [
  ["body__cylinder__9ml__clear__70.0x20.0mm", "CLR", "clear-glass"],
  ["body__cylinder__9ml__amber__70.0x20.0mm", "AMB", "amber-glass"],
  ["body__cylinder__9ml__cobalt__70.0x20.0mm", "BLU", "cobalt-glass"],
  ["body__cylinder__9ml__frosted__70.0x20.0mm", "FRS", "frosted-glass"],
  ["body__cylinder__9ml__swirl__70.0x20.0mm", "SWL", "swirl-glass"],
] as const;

const CAP_VARIANTS = [
  ["silver", "SHN-SL", "mirror-chrome", "approved"],
  ["matte-white", "WHT", "matte-white", "approved"],
  ["glossy-black", "SHN-BLK", "glossy-black", "approved"],
  ["translucent-frosted", "TRNS-FRS", "translucent-frosted", "blocked"],
] as const;

export const CYL9_FROZEN_BODY_SHA256: Record<string, string> = {
  "body__cylinder__9ml__clear__70.0x20.0mm": "97cfe967a4ab02ba4de51c07416c80df54244adf8dfab95406a36f4fe90e933f",
  "body__cylinder__9ml__amber__70.0x20.0mm": "c84db213449da4ef6afbcb67fad0da5811ae937c3c9c1234be801cb473ea31c3",
  "body__cylinder__9ml__cobalt__70.0x20.0mm": "87804d45a242795aaecf10d677ad469b22803e2f2476421ffbce5d4d944f148c",
  "body__cylinder__9ml__frosted__70.0x20.0mm": "c844fb9f3a6ffb467daa02d17cb2378b659fc2e0be166f13073bb7b4f8422956",
  "body__cylinder__9ml__swirl__70.0x20.0mm": "c2b67ee9151dc89d44d3a8d65a112b908bb84a2c833ba0bcf643b16586371e68",
};

interface BodyRegistryEntry {
  id: string;
  role: string;
  asset: { path: string; sha256: string; widthPx: number; heightPx: number };
  status: string;
}

interface ClosurePilotRender {
  id: string;
  path: string;
}

export interface Cyl9DraftReleaseInput {
  repositoryRoot: string;
  bodyRegistryPath: string;
  placementRecipePath: string;
  closurePilotManifestPath: string;
  outputDirectory: string;
  sourceGitCommit: string;
  expectedBodySha256ById: Record<string, string>;
}

export interface Cyl9DraftReleaseResult {
  manifest: PaperDollReleaseManifest;
  manifestSha256: string;
  validation: PaperDollReleaseValidation;
}

export function parseCyl9ReleaseArgs(argv: string[]): { outputDirectory: string } {
  const outputIndex = argv.indexOf("--output");
  const outputDirectory = outputIndex >= 0 ? argv[outputIndex + 1]?.trim() : "";
  if (!outputDirectory) throw new Error("--output is required.");
  return { outputDirectory };
}

/**
 * Calibrated on all five frozen CYL-9ML plates. The swirl relief interrupts
 * every foreground column before a 40% run, while 10% retains the full bottle
 * and remains longer than the shallow contact-shadow run.
 */
export function detectCyl9ReleaseBodyBounds(image: RgbaImage) {
  return detectPlateForegroundBounds(image, undefined, { minRunFraction: 0.1 });
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function inputPath(repositoryRoot: string, path: string): string {
  return isAbsolute(path) ? path : resolve(repositoryRoot, path);
}

async function loadRgba(path: string) {
  return sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
}

function requireBounds(
  bounds: { left: number; top: number; right: number; bottom: number } | null,
  label: string,
) {
  if (!bounds) throw new Error(`${label} contains no measurable foreground.`);
  return bounds;
}

async function exportPlacedCapLayer(
  sourcePath: string,
  destinationPath: string,
  placement: { widthPx: number; centerX: number; bottomY: number },
): Promise<{ sha: string; bounds: PaperDollReleaseAsset["alphaBounds"] }> {
  const loaded = await loadRgba(sourcePath);
  const sourceBounds = requireBounds(
    detectAlphaForegroundBounds({
      data: loaded.data,
      width: loaded.info.width,
      height: loaded.info.height,
      hasAlpha: true,
    }, 0),
    sourcePath,
  );
  const sourceWidth = sourceBounds.right - sourceBounds.left + 1;
  const sourceHeight = sourceBounds.bottom - sourceBounds.top + 1;
  const solved = solveLockedPixelPlacement({
    sourceWidth,
    sourceHeight,
    targetWidth: placement.widthPx,
    centerX: placement.centerX,
    bottomY: placement.bottomY,
  });
  const trimmed = await sharp(sourcePath)
    .extract({ left: sourceBounds.left, top: sourceBounds.top, width: sourceWidth, height: sourceHeight })
    .resize({ width: solved.width, height: solved.height, fit: "fill" })
    .png()
    .toBuffer();
  const output = await sharp({
    create: {
      width: PAPER_DOLL_RELEASE_CANVAS.widthPx,
      height: PAPER_DOLL_RELEASE_CANVAS.heightPx,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  }).composite([{ input: trimmed, left: solved.left, top: solved.top }]).png().toBuffer();
  await writeFile(destinationPath, output);
  const full = await sharp(output).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const bounds = requireBounds(
    detectAlphaForegroundBounds({
      data: full.data,
      width: full.info.width,
      height: full.info.height,
      hasAlpha: true,
    }, 0),
    destinationPath,
  );
  return { sha: sha256(output), bounds };
}

async function exportGeometryMask(
  silverLayerPath: string,
  maskPath: string,
): Promise<string> {
  const loaded = await loadRgba(silverLayerPath);
  const pixels = Buffer.alloc(loaded.data.length);
  for (let index = 0; index < loaded.info.width * loaded.info.height; index++) {
    const occupied = loaded.data[index * 4 + 3] > 0;
    pixels[index * 4] = 255;
    pixels[index * 4 + 1] = 255;
    pixels[index * 4 + 2] = 255;
    pixels[index * 4 + 3] = occupied ? 255 : 0;
  }
  const output = await sharp(pixels, {
    raw: { width: loaded.info.width, height: loaded.info.height, channels: 4 },
  }).png().toBuffer();
  await writeFile(maskPath, output);
  return sha256(output);
}

export async function buildCyl9DraftRelease(
  input: Cyl9DraftReleaseInput,
): Promise<Cyl9DraftReleaseResult> {
  const bodyRegistry = JSON.parse(await readFile(input.bodyRegistryPath, "utf8")) as {
    entries?: BodyRegistryEntry[];
  };
  const placementRecipe = JSON.parse(await readFile(input.placementRecipePath, "utf8")) as {
    canvas?: { widthPx?: number; heightPx?: number; background?: string };
    placements?: {
      "roll-on-over-cap"?: { widthPx?: number; anchor?: { centerX?: number; bottomY?: number } };
    };
  };
  const closurePilot = JSON.parse(await readFile(input.closurePilotManifestPath, "utf8")) as {
    geometryAuthority?: { mesh?: string };
    qa?: { exactBinarySilhouette?: boolean; minIoU?: number; renders?: ClosurePilotRender[] };
  };

  if (
    placementRecipe.canvas?.widthPx !== PAPER_DOLL_RELEASE_CANVAS.widthPx ||
    placementRecipe.canvas?.heightPx !== PAPER_DOLL_RELEASE_CANVAS.heightPx ||
    placementRecipe.canvas?.background !== PAPER_DOLL_RELEASE_CANVAS.backgroundHex
  ) {
    throw new Error("CYL-9ML placement recipe does not use the locked 2080 × 2288 Bone canvas.");
  }
  const placementSource = placementRecipe.placements?.["roll-on-over-cap"];
  const placement = {
    widthPx: placementSource?.widthPx ?? 0,
    centerX: placementSource?.anchor?.centerX ?? 0,
    bottomY: placementSource?.anchor?.bottomY ?? 0,
  };
  if (placement.widthPx <= 0 || placement.centerX <= 0 || placement.bottomY <= 0) {
    throw new Error("CYL-9ML closure placement recipe is incomplete.");
  }
  if (!closurePilot.qa?.exactBinarySilhouette || closurePilot.qa.minIoU !== 1) {
    throw new Error("Closure material pilot does not prove an exact shared silhouette.");
  }

  await mkdir(join(input.outputDirectory, "layers", "body"), { recursive: true });
  await mkdir(join(input.outputDirectory, "layers", "cap"), { recursive: true });
  await mkdir(join(input.outputDirectory, "geometry"), { recursive: true });

  const assets: PaperDollReleaseAsset[] = [];
  const entries = bodyRegistry.entries ?? [];
  if (Object.keys(input.expectedBodySha256ById).length !== BODY_VARIANTS.length) {
    throw new Error("CYL-9ML release requires exactly five expected frozen body SHAs.");
  }
  for (const [bodyId, variantKey, materialVariant] of BODY_VARIANTS) {
    const entry = entries.find((candidate) => candidate.id === bodyId);
    if (!entry || entry.role !== "body-plate" || entry.status !== "approved") {
      throw new Error(`Missing approved frozen body '${bodyId}'.`);
    }
    const expectedSha = input.expectedBodySha256ById[bodyId];
    if (!expectedSha || entry.asset.sha256 !== expectedSha) {
      throw new Error(`Frozen registry SHA mismatch for '${bodyId}'.`);
    }
    const sourcePath = inputPath(input.repositoryRoot, entry.asset.path);
    const bytes = await readFile(sourcePath);
    const actualSha = sha256(bytes);
    if (actualSha !== expectedSha) throw new Error(`Frozen body bytes drifted for '${bodyId}'.`);
    const metadata = await sharp(bytes).metadata();
    if (
      metadata.width !== PAPER_DOLL_RELEASE_CANVAS.widthPx ||
      metadata.height !== PAPER_DOLL_RELEASE_CANVAS.heightPx
    ) {
      throw new Error(`Frozen body '${bodyId}' is not 2080 × 2288.`);
    }
    const destinationRelative = join("layers", "body", `${variantKey}.png`);
    const destinationPath = join(input.outputDirectory, destinationRelative);
    await copyFile(sourcePath, destinationPath);
    const loaded = await loadRgba(sourcePath);
    const bounds = requireBounds(
      detectCyl9ReleaseBodyBounds({
        data: loaded.data,
        width: loaded.info.width,
        height: loaded.info.height,
        hasAlpha: true,
      }),
      bodyId,
    );
    assets.push({
      componentVersionId: `${bodyId}@${actualSha.slice(0, 12)}`,
      componentKey: bodyId,
      geometryFamilyId: "body__cylinder__9ml__70x20__v1",
      slot: "body",
      variantKey,
      materialVariant,
      imagePath: destinationRelative,
      imageSha256: actualSha,
      geometryMaskPath: null,
      geometryMaskSha256: null,
      widthPx: PAPER_DOLL_RELEASE_CANVAS.widthPx,
      heightPx: PAPER_DOLL_RELEASE_CANVAS.heightPx,
      alphaBounds: bounds,
      mountAxisXPx: 1041,
      seatYPx: bounds.bottom + 1,
      approvalStatus: "approved",
    });
  }

  const renders = closurePilot.qa.renders ?? [];
  const capAssets: PaperDollReleaseAsset[] = [];
  for (const [sourceId, variantKey, materialVariant, approvalStatus] of CAP_VARIANTS) {
    const render = renders.find((candidate) => candidate.id === sourceId);
    if (!render) throw new Error(`Closure material pilot is missing '${sourceId}'.`);
    const destinationRelative = join("layers", "cap", `${variantKey}.png`);
    const destinationPath = join(input.outputDirectory, destinationRelative);
    const exported = await exportPlacedCapLayer(
      inputPath(input.repositoryRoot, render.path),
      destinationPath,
      placement,
    );
    capAssets.push({
      componentVersionId: `closure__17-415__rollon-overcap__${variantKey.toLowerCase()}@${exported.sha.slice(0, 12)}`,
      componentKey: "closure__17-415__rollon-overcap",
      geometryFamilyId: "closure__17-415__rollon-overcap__v1",
      slot: "cap",
      variantKey,
      materialVariant,
      imagePath: destinationRelative,
      imageSha256: exported.sha,
      geometryMaskPath: null,
      geometryMaskSha256: null,
      widthPx: PAPER_DOLL_RELEASE_CANVAS.widthPx,
      heightPx: PAPER_DOLL_RELEASE_CANVAS.heightPx,
      alphaBounds: exported.bounds,
      mountAxisXPx: placement.centerX,
      seatYPx: placement.bottomY,
      approvalStatus,
    });
  }

  const maskRelative = join("geometry", "closure__17-415__rollon-overcap__v1-mask.png");
  const maskSha = await exportGeometryMask(
    join(input.outputDirectory, "layers", "cap", "SHN-SL.png"),
    join(input.outputDirectory, maskRelative),
  );
  for (const asset of capAssets) {
    asset.geometryMaskPath = maskRelative;
    asset.geometryMaskSha256 = maskSha;
  }
  assets.push(...capAssets);

  const approvedCapKeys = CAP_VARIANTS
    .filter(([, , , status]) => status === "approved")
    .map(([, variantKey]) => variantKey);
  const assemblyMappings = BODY_VARIANTS.flatMap(([, bodyVariantKey]) =>
    approvedCapKeys.map((closureVariantKey) => {
      const mappingKey = `CYL-9ML:${bodyVariantKey}:ROLLON:${closureVariantKey}`;
      return {
        mappingKey,
        websiteSku: `PREVIEW-${mappingKey}`,
        graceSku: `PREVIEW-${mappingKey}`,
        recipeKey: "rollon-capped",
        bodyVariantKey,
        fitmentVariantKey: null,
        closureVariantKey,
        overcapVariantKey: null,
      };
    }),
  );

  const translucent = capAssets.find((asset) => asset.materialVariant === "translucent-frosted");
  if (!translucent) throw new Error("Translucent research asset is missing from the release.");
  const manifest = parsePaperDollReleaseManifest({
    schemaVersion: 1,
    familyKey: "CYL-9ML",
    releaseVersion: "1.0.0-draft.1",
    status: "blocked",
    canvas: PAPER_DOLL_RELEASE_CANVAS,
    assets,
    assemblyRecipes: [{ recipeKey: "rollon-capped", mode: "rollon", layerOrder: ["body", "cap"] }],
    assemblyMappings,
    qaEvidence: [
      {
        evidenceId: "closure-shared-geometry-v1",
        subjectId: "closure__17-415__rollon-overcap__v1",
        gateKey: "shared-geometry-mask",
        gateVersion: "1",
        status: "passed",
        blocking: true,
        calibratedWith: [
          "closure-material-pilot:silver",
          "closure-material-pilot:matte-white",
          "closure-material-pilot:glossy-black",
        ],
        measurements: { minIoU: closurePilot.qa.minIoU, exactBinarySilhouette: true, maskSha256: maskSha },
        issues: [],
      },
      {
        evidenceId: "closure-translucent-context-v1",
        subjectId: translucent.componentVersionId,
        gateKey: "translucent-assembly-context",
        gateVersion: "1",
        status: "blocked",
        blocking: true,
        calibratedWith: ["closure-material-pilot:translucent-frosted"],
        measurements: { isolatedLayer: true },
        issues: ["assembly_context_required"],
      },
    ],
    blockers: [`assembly_context_required:${translucent.componentVersionId}`],
    provenance: {
      sourceGitCommit: input.sourceGitCommit,
      rendererVersion: `blender-shared-mesh:${closurePilot.geometryAuthority?.mesh ?? "unknown"}`,
    },
  });
  const validation = validatePaperDollRelease(manifest);
  const manifestSha256 = hashPaperDollRelease(manifest);
  await writeFile(join(input.outputDirectory, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(join(input.outputDirectory, "validation.json"), `${JSON.stringify(validation, null, 2)}\n`);
  return { manifest, manifestSha256, validation };
}
