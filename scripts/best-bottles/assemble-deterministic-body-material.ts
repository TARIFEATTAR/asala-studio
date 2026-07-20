import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

import sharp from "sharp";

export interface InclusivePixelBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface DeterministicBodyMaterialAssemblyRecord {
  version: "best-bottles-deterministic-body-material-assembly-v1";
  websiteSku: string;
  graceSku: string;
  assetRole: "cap-on" | "sidecar";
  sourceAttemptId: string;
  canonicalMaster: { path: string; sha256: string };
  baseReference: { path: string; sha256: string };
  materialCandidate: { path: string; sha256: string };
  identityOverlay: { path: string; sha256: string };
  outputPath: string;
  outputSha256: string;
  sourceBodyBounds: InclusivePixelBounds;
  targetBodyBounds: InclusivePixelBounds;
  transform: {
    sourceWidthPx: number;
    sourceHeightPx: number;
    targetWidthPx: number;
    targetHeightPx: number;
    scaleX: number;
    scaleY: number;
  };
  canvas: { widthPx: number; heightPx: number; backgroundHex: "#F5F3EF" };
  geometryQa: {
    status: "pass-by-construction";
    bodyWidthPx: number;
    bodyHeightPx: number;
    baselineYPx: number;
  };
  pixelQa: { unownedCanvasPixelCount: number };
  operation: "deterministic-body-material-assembly";
  pixelPolicy: "native-bone+material-body+exact-identity-overlay";
  postGenerationBackgroundPainting: false;
  remoteWrites: false;
  publishing: false;
}

const sha256 = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");

const widthOf = (bounds: InclusivePixelBounds) =>
  bounds.right - bounds.left + 1;
const heightOf = (bounds: InclusivePixelBounds) =>
  bounds.bottom - bounds.top + 1;

function assertBounds(
  label: string,
  bounds: InclusivePixelBounds,
  width: number,
  height: number,
) {
  if (
    bounds.left < 0 || bounds.top < 0 || bounds.right >= width
    || bounds.bottom >= height || bounds.left > bounds.right
    || bounds.top > bounds.bottom
  ) {
    throw new Error(`${label} bounds are outside the image: ${JSON.stringify(bounds)}.`);
  }
}

function assertSha(label: string, bytes: Uint8Array, expected: string) {
  const observed = sha256(bytes);
  if (observed !== expected.toLowerCase()) {
    throw new Error(`${label} SHA mismatch: expected ${expected}, observed ${observed}.`);
  }
  return observed;
}

export async function assembleDeterministicBodyMaterial(input: {
  websiteSku: string;
  graceSku: string;
  assetRole: "cap-on" | "sidecar";
  sourceAttemptId: string;
  canonicalMaster: { path: string; sha256: string };
  baseReferencePath: string;
  baseReferenceSha256: string;
  materialCandidatePath: string;
  materialCandidateSha256: string;
  identityOverlayPath: string;
  identityOverlaySha256: string;
  sourceBodyBounds: InclusivePixelBounds;
  targetBodyBounds: InclusivePixelBounds;
  expectedCanvas: {
    widthPx: number;
    heightPx: number;
    backgroundHex: "#F5F3EF";
  };
  outputPath: string;
  recordPath: string;
}): Promise<DeterministicBodyMaterialAssemblyRecord> {
  const [baseBytes, materialBytes, identityOverlayBytes] = await Promise.all([
    readFile(input.baseReferencePath),
    readFile(input.materialCandidatePath),
    readFile(input.identityOverlayPath),
  ]);
  const baseSha = assertSha("Base reference", baseBytes, input.baseReferenceSha256);
  const materialSha = assertSha(
    "Material candidate",
    materialBytes,
    input.materialCandidateSha256,
  );
  const identityOverlaySha = assertSha(
    "Identity overlay",
    identityOverlayBytes,
    input.identityOverlaySha256,
  );
  const [baseMetadata, materialMetadata, identityOverlayMetadata] = await Promise.all([
    sharp(baseBytes, { failOn: "error" }).metadata(),
    sharp(materialBytes, { failOn: "error" }).metadata(),
    sharp(identityOverlayBytes, { failOn: "error" }).metadata(),
  ]);
  if (
    baseMetadata.width !== input.expectedCanvas.widthPx
    || baseMetadata.height !== input.expectedCanvas.heightPx
  ) {
    throw new Error(
      `Base reference must be ${input.expectedCanvas.widthPx}x${input.expectedCanvas.heightPx}.`,
    );
  }
  if (!materialMetadata.width || !materialMetadata.height) {
    throw new Error("Material candidate dimensions could not be read.");
  }
  if (
    identityOverlayMetadata.width !== input.expectedCanvas.widthPx
    || identityOverlayMetadata.height !== input.expectedCanvas.heightPx
    || !identityOverlayMetadata.hasAlpha
  ) {
    throw new Error("Identity overlay must be an alpha-bearing native-canvas PNG.");
  }
  assertBounds(
    "Source body",
    input.sourceBodyBounds,
    materialMetadata.width,
    materialMetadata.height,
  );
  assertBounds(
    "Target body",
    input.targetBodyBounds,
    input.expectedCanvas.widthPx,
    input.expectedCanvas.heightPx,
  );
  const sourceWidthPx = widthOf(input.sourceBodyBounds);
  const sourceHeightPx = heightOf(input.sourceBodyBounds);
  const targetWidthPx = widthOf(input.targetBodyBounds);
  const targetHeightPx = heightOf(input.targetBodyBounds);
  const materialBody = await sharp(materialBytes, { failOn: "error" })
    .extract({
      left: input.sourceBodyBounds.left,
      top: input.sourceBodyBounds.top,
      width: sourceWidthPx,
      height: sourceHeightPx,
    })
    .resize(targetWidthPx, targetHeightPx, {
      fit: "fill",
      kernel: sharp.kernel.lanczos3,
    })
    .png()
    .toBuffer();
  const outputBytes = await sharp({
    create: {
      width: input.expectedCanvas.widthPx,
      height: input.expectedCanvas.heightPx,
      channels: 3,
      background: { r: 245, g: 243, b: 239 },
    },
  })
    .composite([
      {
        input: materialBody,
        left: input.targetBodyBounds.left,
        top: input.targetBodyBounds.top,
      },
      { input: identityOverlayBytes, left: 0, top: 0 },
    ])
    .png()
    .toBuffer();
  const [outputRaw, overlayAlpha] = await Promise.all([
    sharp(outputBytes).removeAlpha().raw().toBuffer(),
    sharp(identityOverlayBytes).ensureAlpha().extractChannel("alpha").raw().toBuffer(),
  ]);
  let unownedCanvasPixelCount = 0;
  for (let y = 0; y < input.expectedCanvas.heightPx; y += 1) {
    for (let x = 0; x < input.expectedCanvas.widthPx; x += 1) {
      const inside = x >= input.targetBodyBounds.left
        && x <= input.targetBodyBounds.right
        && y >= input.targetBodyBounds.top
        && y <= input.targetBodyBounds.bottom;
      const pixel = y * input.expectedCanvas.widthPx + x;
      if (inside || overlayAlpha[pixel] > 0) continue;
      const offset = (y * input.expectedCanvas.widthPx + x) * 3;
      if (
        outputRaw[offset] !== 245
        || outputRaw[offset + 1] !== 243
        || outputRaw[offset + 2] !== 239
      ) {
        unownedCanvasPixelCount += 1;
      }
    }
  }
  if (unownedCanvasPixelCount !== 0) {
    throw new Error(
      `Deterministic assembly found ${unownedCanvasPixelCount} non-Bone pixels outside owned layers.`,
    );
  }
  await writeFile(input.outputPath, outputBytes);
  const record: DeterministicBodyMaterialAssemblyRecord = {
    version: "best-bottles-deterministic-body-material-assembly-v1",
    websiteSku: input.websiteSku,
    graceSku: input.graceSku,
    assetRole: input.assetRole,
    sourceAttemptId: input.sourceAttemptId,
    canonicalMaster: input.canonicalMaster,
    baseReference: { path: input.baseReferencePath, sha256: baseSha },
    materialCandidate: { path: input.materialCandidatePath, sha256: materialSha },
    identityOverlay: { path: input.identityOverlayPath, sha256: identityOverlaySha },
    outputPath: input.outputPath,
    outputSha256: sha256(outputBytes),
    sourceBodyBounds: input.sourceBodyBounds,
    targetBodyBounds: input.targetBodyBounds,
    transform: {
      sourceWidthPx,
      sourceHeightPx,
      targetWidthPx,
      targetHeightPx,
      scaleX: targetWidthPx / sourceWidthPx,
      scaleY: targetHeightPx / sourceHeightPx,
    },
    canvas: {
      widthPx: input.expectedCanvas.widthPx,
      heightPx: input.expectedCanvas.heightPx,
      backgroundHex: input.expectedCanvas.backgroundHex,
    },
    geometryQa: {
      status: "pass-by-construction",
      bodyWidthPx: targetWidthPx,
      bodyHeightPx: targetHeightPx,
      baselineYPx: input.targetBodyBounds.bottom,
    },
    pixelQa: { unownedCanvasPixelCount },
    operation: "deterministic-body-material-assembly",
    pixelPolicy: "native-bone+material-body+exact-identity-overlay",
    postGenerationBackgroundPainting: false,
    remoteWrites: false,
    publishing: false,
  };
  await writeFile(input.recordPath, `${JSON.stringify(record, null, 2)}\n`);
  return record;
}
