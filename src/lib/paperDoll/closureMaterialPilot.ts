export interface AlphaImage {
  width: number;
  height: number;
  alpha: Uint8Array;
}

export interface NamedAlphaImage {
  name: string;
  image: AlphaImage;
}

export interface AlphaSilhouettePair {
  a: string;
  b: string;
  iou: number;
  mismatchedPixels: number;
}

export interface AlphaSilhouetteComparison {
  pass: boolean;
  minIoU: number;
  pairs: AlphaSilhouettePair[];
}

export function compareAlphaSilhouettes(
  images: NamedAlphaImage[],
  minIoU = 0.985,
): AlphaSilhouetteComparison {
  const pairs: AlphaSilhouettePair[] = [];

  for (let a = 0; a < images.length; a++) {
    for (let b = a + 1; b < images.length; b++) {
      const left = images[a];
      const right = images[b];
      if (left.image.width !== right.image.width || left.image.height !== right.image.height) {
        pairs.push({ a: left.name, b: right.name, iou: 0, mismatchedPixels: -1 });
        continue;
      }

      let intersection = 0;
      let union = 0;
      let mismatchedPixels = 0;
      for (let i = 0; i < left.image.alpha.length; i++) {
        const leftOccupied = left.image.alpha[i] > 0;
        const rightOccupied = right.image.alpha[i] > 0;
        if (leftOccupied && rightOccupied) intersection++;
        if (leftOccupied || rightOccupied) union++;
        if (leftOccupied !== rightOccupied) mismatchedPixels++;
      }
      pairs.push({
        a: left.name,
        b: right.name,
        iou: union === 0 ? 1 : intersection / union,
        mismatchedPixels,
      });
    }
  }

  const min = pairs.length === 0 ? 1 : Math.min(...pairs.map((pair) => pair.iou));
  return { pass: min >= minIoU, minIoU: min, pairs };
}

export interface LockedPixelPlacementInput {
  sourceWidth: number;
  sourceHeight: number;
  targetWidth: number;
  centerX: number;
  bottomY: number;
}

export interface LockedPixelPlacement {
  width: number;
  height: number;
  left: number;
  top: number;
  rightExclusive: number;
  bottomExclusive: number;
}

export function solveLockedPixelPlacement(input: LockedPixelPlacementInput): LockedPixelPlacement {
  const width = Math.round(input.targetWidth);
  const height = Math.round((input.sourceHeight / input.sourceWidth) * width);
  const left = Math.round(input.centerX - width / 2);
  const top = Math.round(input.bottomY - height);
  return {
    width,
    height,
    left,
    top,
    rightExclusive: left + width,
    bottomExclusive: input.bottomY,
  };
}

export async function resizeContainTransparent(
  input: Buffer,
  options: { raw?: Create["raw"]; width: number; height: number },
): Promise<Buffer> {
  const pipeline = options.raw ? sharp(input, { raw: options.raw }) : sharp(input);
  return pipeline
    .resize({
      width: options.width,
      height: options.height,
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
}
import sharp, { type Create } from "sharp";
