import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";

import type { MaterialPilotScaleContract } from "../../supabase/functions/_shared/bestBottlesMaterialPilot.ts";

export interface PixelBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface MaterialPilotReferenceConditioningInput {
  sourcePath: string;
  outputPath: string;
  recordPath: string;
  websiteSku: string;
  sourceSha256: string;
  sourceBodyBounds: PixelBounds;
  sourceClosureBounds: PixelBounds;
  sourceSidecarBounds: PixelBounds;
  rendererBaselinePrecompensationPx?: number;
  scaleContract: MaterialPilotScaleContract;
}

export interface MaterialPilotReferenceConditioningRecord {
  version: "best-bottles-material-reference-conditioning-v1";
  websiteSku: string;
  sourcePath: string;
  sourceSha256: string;
  outputPath: string;
  outputSha256: string;
  backgroundHex: "#F5F3EF";
  targetBodyBounds: PixelBounds;
  targetClosureBounds: PixelBounds;
  targetSidecarBounds: PixelBounds;
  sourceBodyBounds: PixelBounds;
  sourceClosureBounds: PixelBounds;
  sourceSidecarBounds: PixelBounds;
  scaleContractVersion: MaterialPilotScaleContract["version"];
  scaleContractBaselineYPx: number;
  rendererBaselinePrecompensationPx: number;
  operation: "pre-generation-product-truth-conditioning";
  postGenerationMutationAllowed: false;
}

const sha256 = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");

const widthOf = (bounds: PixelBounds) => bounds.right - bounds.left + 1;
const heightOf = (bounds: PixelBounds) => bounds.bottom - bounds.top + 1;

function assertBounds(bounds: PixelBounds, width: number, height: number) {
  if (
    bounds.left < 0 || bounds.top < 0 || bounds.right >= width ||
    bounds.bottom >= height || bounds.left > bounds.right ||
    bounds.top > bounds.bottom
  ) {
    throw new Error(`Invalid source bounds: ${JSON.stringify(bounds)}`);
  }
}

/**
 * Removes only near-white pixels connected to a source-canvas edge. Enclosed
 * white product details (for example the sprayer nozzle) remain intact.
 */
function removeEdgeConnectedWhite(
  rgba: Uint8Array,
  width: number,
  height: number,
): Uint8Array {
  const output = Uint8Array.from(rgba);
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;
  const enqueue = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const pixel = y * width + x;
    if (visited[pixel]) return;
    const offset = pixel * 4;
    if (
      output[offset] < 245 || output[offset + 1] < 245 ||
      output[offset + 2] < 245
    ) return;
    visited[pixel] = 1;
    queue[tail++] = pixel;
  };

  for (let x = 0; x < width; x++) {
    enqueue(x, 0);
    enqueue(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    enqueue(0, y);
    enqueue(width - 1, y);
  }
  while (head < tail) {
    const pixel = queue[head++];
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    output[pixel * 4 + 3] = 0;
    enqueue(x - 1, y);
    enqueue(x + 1, y);
    enqueue(x, y - 1);
    enqueue(x, y + 1);
  }
  return output;
}

async function renderPart(
  rgba: Uint8Array,
  sourceWidth: number,
  sourceHeight: number,
  sourceBounds: PixelBounds,
  targetBounds: PixelBounds,
): Promise<Buffer> {
  return await sharp(rgba, {
    raw: { width: sourceWidth, height: sourceHeight, channels: 4 },
  }).extract({
    left: sourceBounds.left,
    top: sourceBounds.top,
    width: widthOf(sourceBounds),
    height: heightOf(sourceBounds),
  }).resize(widthOf(targetBounds), heightOf(targetBounds), {
    fit: "fill",
    kernel: sharp.kernel.lanczos3,
  }).png().toBuffer();
}

/**
 * Conditions approved product-truth pixels before generation. This is not a
 * generated-output postprocess: GPT receives this exact native Bone canvas as
 * its identity/geometry reference, while the returned generation remains
 * untouched and is measured independently.
 */
export async function conditionMaterialPilotReference(
  input: MaterialPilotReferenceConditioningInput,
): Promise<MaterialPilotReferenceConditioningRecord> {
  const sourceBytes = readFileSync(input.sourcePath);
  const observedSourceHash = sha256(sourceBytes);
  if (observedSourceHash !== input.sourceSha256.toLowerCase()) {
    throw new Error(
      `Source hash mismatch: expected ${input.sourceSha256}, observed ${observedSourceHash}`,
    );
  }
  const source = sharp(sourceBytes).ensureAlpha();
  const { data, info } = await source.raw().toBuffer({ resolveWithObject: true });
  assertBounds(input.sourceBodyBounds, info.width, info.height);
  assertBounds(input.sourceClosureBounds, info.width, info.height);
  assertBounds(input.sourceSidecarBounds, info.width, info.height);
  const rgba = removeEdgeConnectedWhite(data, info.width, info.height);

  const scale = input.scaleContract;
  const baselinePrecompensation = Math.round(
    input.rendererBaselinePrecompensationPx ?? 0,
  );
  if (baselinePrecompensation < 0) {
    throw new Error("Renderer baseline precompensation cannot be negative.");
  }
  const placementBaselineYPx = scale.baselineYPx + baselinePrecompensation;
  if (placementBaselineYPx >= scale.canvasHeightPx) {
    throw new Error("Conditioned baseline would exceed the native canvas.");
  }
  const centerX = Math.round(scale.canvasWidthPx / 2);
  const bodyLeft = centerX - Math.floor(scale.bodyWidthTargetPx / 2);
  const targetBodyBounds: PixelBounds = {
    left: bodyLeft,
    top: placementBaselineYPx - scale.bodyTargetPx + 1,
    right: bodyLeft + scale.bodyWidthTargetPx - 1,
    bottom: placementBaselineYPx,
  };
  const closureHeight = scale.assembledTargetPx - scale.bodyTargetPx;
  const targetClosureBounds: PixelBounds = {
    left: targetBodyBounds.left,
    top: targetBodyBounds.top - closureHeight,
    right: targetBodyBounds.right,
    bottom: targetBodyBounds.top - 1,
  };
  const sourceGap = input.sourceSidecarBounds.left -
    input.sourceBodyBounds.right - 1;
  const horizontalScale = scale.bodyWidthTargetPx /
    widthOf(input.sourceBodyBounds);
  const targetGap = Math.max(48, Math.round(sourceGap * horizontalScale));
  const targetSidecarBounds: PixelBounds = {
    left: targetBodyBounds.right + 1 + targetGap,
    top: placementBaselineYPx - closureHeight + 1,
    right: targetBodyBounds.right + targetGap + scale.bodyWidthTargetPx,
    bottom: placementBaselineYPx,
  };
  if (targetSidecarBounds.right >= scale.canvasWidthPx) {
    throw new Error("Conditioned sidecar would exceed the native canvas.");
  }

  const [body, closure, sidecar] = await Promise.all([
    renderPart(
      rgba,
      info.width,
      info.height,
      input.sourceBodyBounds,
      targetBodyBounds,
    ),
    renderPart(
      rgba,
      info.width,
      info.height,
      input.sourceClosureBounds,
      targetClosureBounds,
    ),
    renderPart(
      rgba,
      info.width,
      info.height,
      input.sourceSidecarBounds,
      targetSidecarBounds,
    ),
  ]);
  await sharp({
    create: {
      width: scale.canvasWidthPx,
      height: scale.canvasHeightPx,
      channels: 3,
      background: { r: 245, g: 243, b: 239 },
    },
  }).composite([
    { input: body, left: targetBodyBounds.left, top: targetBodyBounds.top },
    {
      input: closure,
      left: targetClosureBounds.left,
      top: targetClosureBounds.top,
    },
    {
      input: sidecar,
      left: targetSidecarBounds.left,
      top: targetSidecarBounds.top,
    },
  ]).removeAlpha().png().toFile(input.outputPath);

  const outputBytes = readFileSync(input.outputPath);
  const record: MaterialPilotReferenceConditioningRecord = {
    version: "best-bottles-material-reference-conditioning-v1",
    websiteSku: input.websiteSku,
    sourcePath: input.sourcePath,
    sourceSha256: observedSourceHash,
    outputPath: input.outputPath,
    outputSha256: sha256(outputBytes),
    backgroundHex: "#F5F3EF",
    targetBodyBounds,
    targetClosureBounds,
    targetSidecarBounds,
    sourceBodyBounds: input.sourceBodyBounds,
    sourceClosureBounds: input.sourceClosureBounds,
    sourceSidecarBounds: input.sourceSidecarBounds,
    scaleContractVersion: scale.version,
    scaleContractBaselineYPx: scale.baselineYPx,
    rendererBaselinePrecompensationPx: baselinePrecompensation,
    operation: "pre-generation-product-truth-conditioning",
    postGenerationMutationAllowed: false,
  };
  writeFileSync(input.recordPath, `${JSON.stringify(record, null, 2)}\n`);
  return record;
}
