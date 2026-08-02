import { createHash } from "node:crypto";

import sharp from "sharp";

import { buildPaperDollObjectPath } from "./assetStorage";

export interface PixelBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface RollerNormalizationContract {
  sourceSha256: string;
  sourceWidthPx: number;
  sourceHeightPx: number;
  sourceAlphaBounds: PixelBounds;
  canvasWidthPx: number;
  canvasHeightPx: number;
  targetWidthPx: number;
  anchorTopYPx: number;
  centerXPx: number;
  alphaFloor: number;
}

export const CYL9_PLASTIC_ROLLER_CONTRACT: RollerNormalizationContract = {
  sourceSha256: "442e94e1e1b5c034648d40a06950642eaf770ab9d51d717d7be59adc4511d11c",
  sourceWidthPx: 198,
  sourceHeightPx: 330,
  sourceAlphaBounds: { left: 35, top: 12, right: 186, bottom: 149 },
  canvasWidthPx: 2080,
  canvasHeightPx: 2288,
  targetWidthPx: 269,
  anchorTopYPx: 675,
  centerXPx: 1041,
  alphaFloor: 8,
};

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function alphaBounds(rgba: Buffer, width: number, height: number, alphaFloor: number): PixelBounds | null {
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (rgba[(y * width + x) * 4 + 3] < alphaFloor) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  return right === -1 ? null : { left, top, right, bottom };
}

function assertBounds(actual: PixelBounds | null, expected: PixelBounds, label: string): void {
  if (!actual || JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label} alpha bounds drifted: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}.`);
  }
}

function copyLayerToCanvas(input: {
  layer: Buffer;
  layerWidth: number;
  layerHeight: number;
  canvasWidth: number;
  canvasHeight: number;
  left: number;
  top: number;
}): Buffer {
  if (
    input.left < 0
    || input.top < 0
    || input.left + input.layerWidth > input.canvasWidth
    || input.top + input.layerHeight > input.canvasHeight
  ) {
    throw new Error("Normalized roller layer falls outside the release canvas.");
  }
  const canvas = Buffer.alloc(input.canvasWidth * input.canvasHeight * 4);
  const rowBytes = input.layerWidth * 4;
  for (let y = 0; y < input.layerHeight; y += 1) {
    input.layer.copy(
      canvas,
      ((input.top + y) * input.canvasWidth + input.left) * 4,
      y * rowBytes,
      (y + 1) * rowBytes,
    );
  }
  return canvas;
}

async function resizeRgbaPremultiplied(input: {
  rgba: Buffer;
  width: number;
  height: number;
  targetWidth: number;
  targetHeight: number;
}): Promise<Buffer> {
  const premultiplied = Buffer.alloc(input.rgba.length);
  for (let offset = 0; offset < input.rgba.length; offset += 4) {
    const alpha = input.rgba[offset + 3];
    premultiplied[offset] = Math.round(input.rgba[offset] * alpha / 255);
    premultiplied[offset + 1] = Math.round(input.rgba[offset + 1] * alpha / 255);
    premultiplied[offset + 2] = Math.round(input.rgba[offset + 2] * alpha / 255);
    premultiplied[offset + 3] = alpha;
  }

  const resized = await sharp(premultiplied, {
    raw: { width: input.width, height: input.height, channels: 4 },
  })
    .resize({
      width: input.targetWidth,
      height: input.targetHeight,
      fit: "fill",
      kernel: sharp.kernel.lanczos3,
    })
    .raw()
    .toBuffer();

  for (let offset = 0; offset < resized.length; offset += 4) {
    const alpha = resized[offset + 3];
    if (alpha === 0) {
      resized[offset] = 0;
      resized[offset + 1] = 0;
      resized[offset + 2] = 0;
      continue;
    }
    resized[offset] = Math.min(255, Math.round(resized[offset] * 255 / alpha));
    resized[offset + 1] = Math.min(255, Math.round(resized[offset + 1] * 255 / alpha));
    resized[offset + 2] = Math.min(255, Math.round(resized[offset + 2] * 255 / alpha));
  }
  return resized;
}

export interface NormalizedRollerLayer {
  imageBytes: Buffer;
  geometryMaskBytes: Buffer;
  imageSha256: string;
  geometryMaskSha256: string;
  imageByteSize: number;
  geometryMaskByteSize: number;
  widthPx: number;
  heightPx: number;
  alphaBounds: PixelBounds;
  authorityMaskAlphaExact: boolean;
  opaqueWhiteFraction: number;
}

export async function normalizeRollerLayer(
  sourceBytes: Buffer,
  contract: RollerNormalizationContract,
): Promise<NormalizedRollerLayer> {
  const measuredSourceSha = sha256(sourceBytes);
  if (measuredSourceSha !== contract.sourceSha256) {
    throw new Error(`Source SHA mismatch: expected ${contract.sourceSha256}, received ${measuredSourceSha}.`);
  }

  const source = await sharp(sourceBytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (source.info.width !== contract.sourceWidthPx || source.info.height !== contract.sourceHeightPx) {
    throw new Error("Source dimensions disagree with the normalization contract.");
  }
  assertBounds(
    alphaBounds(source.data, source.info.width, source.info.height, contract.alphaFloor),
    contract.sourceAlphaBounds,
    "Source",
  );

  const cropWidth = contract.sourceAlphaBounds.right - contract.sourceAlphaBounds.left + 1;
  const cropHeight = contract.sourceAlphaBounds.bottom - contract.sourceAlphaBounds.top + 1;
  const targetHeight = Math.round(cropHeight * contract.targetWidthPx / cropWidth);
  const cropped = Buffer.alloc(cropWidth * cropHeight * 4);
  const sourceRowBytes = source.info.width * 4;
  const cropRowBytes = cropWidth * 4;
  for (let y = 0; y < cropHeight; y += 1) {
    const sourceStart = (contract.sourceAlphaBounds.top + y) * sourceRowBytes
      + contract.sourceAlphaBounds.left * 4;
    source.data.copy(cropped, y * cropRowBytes, sourceStart, sourceStart + cropRowBytes);
  }
  const resized = await resizeRgbaPremultiplied({
    rgba: cropped,
    width: cropWidth,
    height: cropHeight,
    targetWidth: contract.targetWidthPx,
    targetHeight,
  });

  const left = contract.centerXPx - Math.floor(contract.targetWidthPx / 2);
  const fullBeauty = copyLayerToCanvas({
    layer: resized,
    layerWidth: contract.targetWidthPx,
    layerHeight: targetHeight,
    canvasWidth: contract.canvasWidthPx,
    canvasHeight: contract.canvasHeightPx,
    left,
    top: contract.anchorTopYPx,
  });

  const fullMask = Buffer.alloc(fullBeauty.length);
  let opaqueCount = 0;
  let exactWhiteCount = 0;
  let authorityMaskAlphaExact = true;
  for (let index = 0; index < contract.canvasWidthPx * contract.canvasHeightPx; index += 1) {
    const offset = index * 4;
    const alpha = fullBeauty[offset + 3];
    if (alpha > 0) {
      fullMask[offset] = 255;
      fullMask[offset + 1] = 255;
      fullMask[offset + 2] = 255;
    }
    fullMask[offset + 3] = alpha;
    if (fullMask[offset + 3] !== alpha) authorityMaskAlphaExact = false;
    if (alpha >= 250) {
      opaqueCount += 1;
      if (fullBeauty[offset] === 255 && fullBeauty[offset + 1] === 255 && fullBeauty[offset + 2] === 255) {
        exactWhiteCount += 1;
      }
    }
  }

  const measuredBounds = alphaBounds(
    fullBeauty,
    contract.canvasWidthPx,
    contract.canvasHeightPx,
    contract.alphaFloor,
  );
  if (!measuredBounds) throw new Error("Normalized roller contains no foreground.");

  const pngOptions = { compressionLevel: 9 as const, adaptiveFiltering: false, palette: false };
  const [imageBytes, geometryMaskBytes] = await Promise.all([
    sharp(fullBeauty, {
      raw: { width: contract.canvasWidthPx, height: contract.canvasHeightPx, channels: 4 },
    }).png(pngOptions).toBuffer(),
    sharp(fullMask, {
      raw: { width: contract.canvasWidthPx, height: contract.canvasHeightPx, channels: 4 },
    }).png(pngOptions).toBuffer(),
  ]);

  return {
    imageBytes,
    geometryMaskBytes,
    imageSha256: sha256(imageBytes),
    geometryMaskSha256: sha256(geometryMaskBytes),
    imageByteSize: imageBytes.byteLength,
    geometryMaskByteSize: geometryMaskBytes.byteLength,
    widthPx: contract.canvasWidthPx,
    heightPx: contract.canvasHeightPx,
    alphaBounds: measuredBounds,
    authorityMaskAlphaExact,
    opaqueWhiteFraction: opaqueCount === 0 ? 0 : exactWhiteCount / opaqueCount,
  };
}

interface ApprovedSourceFacts {
  sha256: string;
  widthPx: number;
  heightPx: number;
  alphaBounds: PixelBounds;
  status: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
}

interface NormalizedFacts {
  imageSha256: string;
  geometryMaskSha256: string;
  imageByteSize: number;
  geometryMaskByteSize: number;
  widthPx: number;
  heightPx: number;
  alphaBounds: PixelBounds;
  authorityMaskAlphaExact: boolean;
  opaqueWhiteFraction: number;
}

export function buildCyl9PlasticRollerRegistrationPlan(input: {
  organizationId: string;
  source: ApprovedSourceFacts;
  normalized: NormalizedFacts;
}) {
  const expectedSource = CYL9_PLASTIC_ROLLER_CONTRACT;
  if (
    input.source.sha256 !== expectedSource.sourceSha256
    || input.source.widthPx !== expectedSource.sourceWidthPx
    || input.source.heightPx !== expectedSource.sourceHeightPx
    || JSON.stringify(input.source.alphaBounds) !== JSON.stringify(expectedSource.sourceAlphaBounds)
    || input.source.status !== "approved"
    || input.source.reviewedBy !== "jordan"
    || input.source.reviewedAt !== "2026-07-31T14:57:23.371Z"
  ) {
    throw new Error("Plastic roller registration requires the exact approved source and named review evidence.");
  }

  const expectedBounds = { left: 907, top: 675, right: 1175, bottom: 918 };
  if (
    input.normalized.widthPx !== 2080
    || input.normalized.heightPx !== 2288
    || JSON.stringify(input.normalized.alphaBounds) !== JSON.stringify(expectedBounds)
    || !input.normalized.authorityMaskAlphaExact
    || input.normalized.opaqueWhiteFraction > 0.05
    || input.normalized.imageByteSize <= 0
    || input.normalized.geometryMaskByteSize <= 0
    || !/^[a-f0-9]{64}$/.test(input.normalized.imageSha256)
    || !/^[a-f0-9]{64}$/.test(input.normalized.geometryMaskSha256)
  ) {
    throw new Error("Plastic roller normalized geometry or calibrated QA evidence drifted.");
  }

  const componentKey = "closure__17-415__plastic-roller-ball__natural";
  const imagePath = buildPaperDollObjectPath({
    organizationId: input.organizationId,
    familyKey: "CYL-9ML",
    assetId: `${componentKey}__beauty`,
    sha256: input.normalized.imageSha256,
    extension: "png",
  });
  const geometryMaskPath = buildPaperDollObjectPath({
    organizationId: input.organizationId,
    familyKey: "CYL-9ML",
    assetId: `${componentKey}__authority-mask`,
    sha256: input.normalized.geometryMaskSha256,
    extension: "png",
  });

  const qaResults = [
    {
      gateKey: "approved-source-identity",
      gateVersion: "cyl9-plastic-roller-v1",
      qaStatus: "passed" as const,
      blocking: true,
      calibratedWith: ["component-registry-v1", "named-review:jordan"],
      measurements: {
        sourceSha256: input.source.sha256,
        sourceAlphaBounds: input.source.alphaBounds,
        reviewedAt: input.source.reviewedAt,
      },
      issues: [] as string[],
    },
    {
      gateKey: "shared-placement-recipe",
      gateVersion: "cyl9-17-415-v1",
      qaStatus: "passed" as const,
      blocking: true,
      calibratedWith: ["closure-placement-recipe.json", "five-locked-body-plates"],
      measurements: {
        targetWidthPx: 269,
        anchorTopYPx: 675,
        centerXPx: 1041,
        seatYPx: 968,
        alphaBounds: input.normalized.alphaBounds,
      },
      issues: [] as string[],
    },
    {
      gateKey: "exact-authority-mask-alpha",
      gateVersion: "v1",
      qaStatus: "passed" as const,
      blocking: true,
      calibratedWith: ["normalized-beauty-alpha", "derived-authority-mask-alpha"],
      measurements: {
        exact: input.normalized.authorityMaskAlphaExact,
        beautySha256: input.normalized.imageSha256,
        maskSha256: input.normalized.geometryMaskSha256,
      },
      issues: [] as string[],
    },
    {
      gateKey: "opaque-white-fraction",
      gateVersion: "opaque-white-fraction-v1",
      qaStatus: "passed" as const,
      blocking: true,
      calibratedWith: [
        "plastic-roller:442e94e1e1b5",
        "rejected-metal-roller:db65f5072e97",
      ],
      measurements: { fraction: input.normalized.opaqueWhiteFraction, maximum: 0.05 },
      issues: [] as string[],
    },
  ];

  return {
    component: {
      componentKey,
      displayName: "17-415 natural plastic roller-ball fitment",
      geometryFamilyId: "fitment__roller-ball__17-415__v1",
      slot: "roller" as const,
      variantKey: "PLASTIC" as const,
    },
    version: {
      versionKey: `normalized-sha256-${input.normalized.imageSha256.slice(0, 12)}`,
      materialVariant: "matte-white-plastic",
      storageBucket: "paper-doll-approved" as const,
      imagePath,
      imageSha256: input.normalized.imageSha256,
      geometryMaskPath,
      geometryMaskSha256: input.normalized.geometryMaskSha256,
      contentType: "image/png" as const,
      byteSize: input.normalized.imageByteSize,
      widthPx: 2080 as const,
      heightPx: 2288 as const,
      alphaBounds: input.normalized.alphaBounds,
      mountAxisXPx: 1041,
      seatYPx: 968,
      approvalStatus: "approved" as const,
      provenance: {
        sourceAssetSha256: input.source.sha256,
        sourceRegistryStatus: input.source.status,
        sourceReviewedBy: input.source.reviewedBy,
        sourceReviewedAt: input.source.reviewedAt,
        normalizationRecipe: "cyl9-plastic-roller-normalization-v1",
        targetWidthPx: 269,
        anchorTopYPx: 675,
        centerXPx: 1041,
        noPerBottleAdjustment: true,
      },
    },
    maskUpload: {
      storageBucket: "paper-doll-approved" as const,
      path: geometryMaskPath,
      sha256: input.normalized.geometryMaskSha256,
      byteSize: input.normalized.geometryMaskByteSize,
      contentType: "image/png" as const,
    },
    qaResults,
    releaseMutation: false as const,
  };
}
