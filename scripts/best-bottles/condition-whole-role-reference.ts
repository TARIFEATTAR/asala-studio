import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

import sharp from "sharp";

export interface WholeRoleReferenceConditioningRecord {
  version: "best-bottles-whole-role-reference-conditioning-v1";
  websiteSku: string;
  assetRole: "cap-on" | "sidecar";
  sourcePath: string;
  sourceSha256: string;
  outputPath: string;
  outputSha256: string;
  maskPath: string;
  maskSha256: string;
  maskSemantics: "transparent-body-material-edit-opaque-hardware-sidecar-bone-preserve";
  preservedDipTubeColumn?: {
    centerXPx: number;
    leftPx: number;
    rightExclusivePx: number;
    topYPx: number;
    bottomYPx: number;
  };
  identityOverlayPath: string;
  identityOverlaySha256: string;
  identityOverlaySemantics: "exact-sprayer-closure-sidecar-with-body-removed";
  sourceGeometry: {
    foregroundBounds: { left: number; top: number; width: number; height: number };
    bodyLeftX: number;
    bodyRightXExclusive: number;
    bodyTopY: number;
    bodyBottomYExclusive: number;
    primaryCenterX: number;
  };
  targetBodyBounds: {
    left: number;
    right: number;
    top: number;
    bottom: number;
    width: number;
    height: number;
  };
  targetPrimaryCenterXPx: number;
  outputGroupBounds: { left: number; top: number; width: number; height: number };
  uniformScale: number;
  operation: "pre-generation-whole-role-uniform-conditioning";
  productPixelMutation: "uniform-scale-only";
  backgroundHex: "#F5F3EF";
  postGenerationMutationAllowed: false;
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

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
      output[offset] < 245 || output[offset + 1] < 245
      || output[offset + 2] < 245
    ) return;
    visited[pixel] = 1;
    queue[tail++] = pixel;
  };
  for (let x = 0; x < width; x += 1) {
    enqueue(x, 0);
    enqueue(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
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

export async function conditionWholeRoleReference(input: {
  websiteSku: string;
  assetRole: "cap-on" | "sidecar";
  sourcePath: string;
  sourceSha256: string;
  outputPath: string;
  maskPath: string;
  identityOverlayPath: string;
  recordPath: string;
  sourceGeometry: WholeRoleReferenceConditioningRecord["sourceGeometry"];
  canvas: { widthPx: number; heightPx: number; boneHex: "#F5F3EF" };
  target: {
    bodyHeightPx: number;
    bodyWidthPx: number;
    baselineYPx: number;
    primaryCenterXPx: number;
  };
}): Promise<WholeRoleReferenceConditioningRecord> {
  const sourceBytes = new Uint8Array(await readFile(input.sourcePath));
  const observedSourceSha256 = sha256(sourceBytes);
  if (observedSourceSha256 !== input.sourceSha256.toLowerCase()) {
    throw new Error(
      `Role source SHA mismatch: expected ${input.sourceSha256}, received ${observedSourceSha256}.`,
    );
  }
  const source = sharp(sourceBytes, { failOn: "error" }).ensureAlpha();
  const { data, info } = await source.raw().toBuffer({ resolveWithObject: true });
  const geometry = input.sourceGeometry;
  const foreground = geometry.foregroundBounds;
  if (
    foreground.left < 0 || foreground.top < 0
    || foreground.width <= 0 || foreground.height <= 0
    || foreground.left + foreground.width > info.width
    || foreground.top + foreground.height > info.height
    || geometry.bodyLeftX < foreground.left
    || geometry.bodyRightXExclusive > foreground.left + foreground.width
    || geometry.bodyRightXExclusive <= geometry.bodyLeftX
    || geometry.bodyTopY < foreground.top
    || geometry.bodyBottomYExclusive > foreground.top + foreground.height
    || geometry.bodyBottomYExclusive <= geometry.bodyTopY
    || geometry.primaryCenterX < foreground.left
    || geometry.primaryCenterX >= foreground.left + foreground.width
  ) {
    throw new Error(`Invalid role source geometry for ${input.websiteSku}.`);
  }
  const sourceBodyHeightPx = geometry.bodyBottomYExclusive - geometry.bodyTopY;
  const uniformScale = input.target.bodyHeightPx / sourceBodyHeightPx;
  const outputWidth = Math.round(foreground.width * uniformScale);
  const outputHeight = Math.round(foreground.height * uniformScale);
  const bodyBottomWithinCrop = geometry.bodyBottomYExclusive - foreground.top;
  const primaryCenterWithinCrop = geometry.primaryCenterX - foreground.left;
  const outputTop = input.target.baselineYPx
    - Math.round(bodyBottomWithinCrop * uniformScale) + 1;
  const outputLeft = input.target.primaryCenterXPx
    - Math.round(primaryCenterWithinCrop * uniformScale);
  if (
    outputLeft < 0 || outputTop < 0
    || outputLeft + outputWidth > input.canvas.widthPx
    || outputTop + outputHeight > input.canvas.heightPx
  ) {
    throw new Error(`Conditioned role group exceeds the native canvas for ${input.websiteSku}.`);
  }
  const transparent = removeEdgeConnectedWhite(data, info.width, info.height);
  const scaledGroup = await sharp(transparent, {
    raw: { width: info.width, height: info.height, channels: 4 },
  }).extract(foreground).resize(outputWidth, outputHeight, {
    fit: "fill",
    kernel: sharp.kernel.lanczos3,
  }).png().toBuffer();
  const { data: scaledGroupRgba } = await sharp(scaledGroup).ensureAlpha().raw()
    .toBuffer({ resolveWithObject: true });
  const bodyLeftWithinScaled = Math.max(
    0,
    Math.round((geometry.bodyLeftX - foreground.left) * uniformScale),
  );
  const bodyRightWithinScaledExclusive = Math.min(
    outputWidth,
    Math.round((geometry.bodyRightXExclusive - foreground.left) * uniformScale),
  );
  const bodyTopWithinScaled = Math.max(
    0,
    Math.round((geometry.bodyTopY - foreground.top) * uniformScale),
  );
  const bodyBottomWithinScaledExclusive = Math.min(
    outputHeight,
    Math.round((geometry.bodyBottomYExclusive - foreground.top) * uniformScale),
  );
  for (let y = bodyTopWithinScaled; y < bodyBottomWithinScaledExclusive; y += 1) {
    for (let x = bodyLeftWithinScaled; x < bodyRightWithinScaledExclusive; x += 1) {
      scaledGroupRgba[((y * outputWidth) + x) * 4 + 3] = 0;
    }
  }
  const identityGroup = await sharp(scaledGroupRgba, {
    raw: { width: outputWidth, height: outputHeight, channels: 4 },
  }).png().toBuffer();
  const identityOverlayBytes = await sharp({
    create: {
      width: input.canvas.widthPx,
      height: input.canvas.heightPx,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  }).composite([{ input: identityGroup, left: outputLeft, top: outputTop }])
    .png().toBuffer();
  const scaledAlpha = await sharp(scaledGroup).ensureAlpha()
    .extractChannel("alpha").raw().toBuffer();
  const maskRgba = Buffer.alloc(input.canvas.widthPx * input.canvas.heightPx * 4, 255);
  const targetBodyLeft = input.target.primaryCenterXPx
    - Math.round(input.target.bodyWidthPx / 2);
  const targetBodyRightExclusive = targetBodyLeft + input.target.bodyWidthPx;
  const targetBodyTop = input.target.baselineYPx - input.target.bodyHeightPx + 1;
  // The dip tube descends through the transparent body at the primary center.
  // It is identity hardware, not material: a 2026-07-16 pilot rejection showed
  // the material edit erasing it when the whole body was editable, so its
  // column stays protected in the mask.
  const dipTubeHalfWidthPx = Math.max(6, Math.round(input.target.bodyWidthPx * 0.1));
  const dipTubeLeft = input.target.primaryCenterXPx - dipTubeHalfWidthPx;
  const dipTubeRightExclusive = input.target.primaryCenterXPx + dipTubeHalfWidthPx;
  const editRadiusPx = 3;
  const clearBodyMaskPixel = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= input.canvas.widthPx || y >= input.canvas.heightPx) return;
    if (
      x < targetBodyLeft || x >= targetBodyRightExclusive
      || y < targetBodyTop || y > input.target.baselineYPx
    ) return;
    if (x >= dipTubeLeft && x < dipTubeRightExclusive) return;
    maskRgba[((y * input.canvas.widthPx) + x) * 4 + 3] = 0;
  };
  for (let localY = 0; localY < outputHeight; localY += 1) {
    for (let localX = 0; localX < outputWidth; localX += 1) {
      if (scaledAlpha[(localY * outputWidth) + localX] === 0) continue;
      for (let dy = -editRadiusPx; dy <= editRadiusPx; dy += 1) {
        for (let dx = -editRadiusPx; dx <= editRadiusPx; dx += 1) {
          clearBodyMaskPixel(outputLeft + localX + dx, outputTop + localY + dy);
        }
      }
    }
  }
  // Permit a narrow contact-shadow zone without freeing the surrounding Bone
  // canvas or allowing the model to move the product baseline.
  const shadowBottom = Math.min(input.canvas.heightPx - 1, input.target.baselineYPx + 16);
  for (let y = input.target.baselineYPx; y <= shadowBottom; y += 1) {
    for (
      let x = Math.max(0, targetBodyLeft - 8);
      x <= Math.min(input.canvas.widthPx - 1, targetBodyRightExclusive + 8);
      x += 1
    ) {
      maskRgba[((y * input.canvas.widthPx) + x) * 4 + 3] = 0;
    }
  }
  const maskBytes = await sharp(maskRgba, {
    raw: { width: input.canvas.widthPx, height: input.canvas.heightPx, channels: 4 },
  }).png().toBuffer();
  const outputBytes = await sharp({
    create: {
      width: input.canvas.widthPx,
      height: input.canvas.heightPx,
      channels: 3,
      background: { r: 245, g: 243, b: 239 },
    },
  }).composite([{ input: scaledGroup, left: outputLeft, top: outputTop }])
    .removeAlpha().png().toBuffer();
  await writeFile(input.outputPath, outputBytes);
  await writeFile(input.maskPath, maskBytes);
  await writeFile(input.identityOverlayPath, identityOverlayBytes);
  const record: WholeRoleReferenceConditioningRecord = {
    version: "best-bottles-whole-role-reference-conditioning-v1",
    websiteSku: input.websiteSku,
    assetRole: input.assetRole,
    sourcePath: input.sourcePath,
    sourceSha256: observedSourceSha256,
    outputPath: input.outputPath,
    outputSha256: sha256(outputBytes),
    maskPath: input.maskPath,
    maskSha256: sha256(maskBytes),
    maskSemantics: "transparent-body-material-edit-opaque-hardware-sidecar-bone-preserve",
    preservedDipTubeColumn: {
      centerXPx: input.target.primaryCenterXPx,
      leftPx: dipTubeLeft,
      rightExclusivePx: dipTubeRightExclusive,
      topYPx: targetBodyTop,
      bottomYPx: input.target.baselineYPx,
    },
    identityOverlayPath: input.identityOverlayPath,
    identityOverlaySha256: sha256(identityOverlayBytes),
    identityOverlaySemantics: "exact-sprayer-closure-sidecar-with-body-removed",
    sourceGeometry: geometry,
    targetBodyBounds: {
      left: targetBodyLeft,
      right: targetBodyRightExclusive - 1,
      top: targetBodyTop,
      bottom: input.target.baselineYPx,
      width: input.target.bodyWidthPx,
      height: input.target.bodyHeightPx,
    },
    targetPrimaryCenterXPx: input.target.primaryCenterXPx,
    outputGroupBounds: {
      left: outputLeft,
      top: outputTop,
      width: outputWidth,
      height: outputHeight,
    },
    uniformScale,
    operation: "pre-generation-whole-role-uniform-conditioning",
    productPixelMutation: "uniform-scale-only",
    backgroundHex: "#F5F3EF",
    postGenerationMutationAllowed: false,
  };
  await writeFile(input.recordPath, `${JSON.stringify(record, null, 2)}\n`);
  return record;
}
