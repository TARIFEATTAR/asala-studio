export interface PixelBounds { left: number; top: number; right: number; bottom: number }

export function largestAlphaComponent(
  alpha: Uint8ClampedArray,
  width: number,
  height: number,
  threshold = 8,
): { membership: Uint8Array; bounds: PixelBounds; removedDetachedIslands: number } {
  if (alpha.length !== width * height || width < 1 || height < 1) throw new Error("Alpha raster dimensions are invalid.");
  const visited = new Uint8Array(alpha.length);
  let largest: number[] = [];
  let components = 0;
  for (let seed = 0; seed < alpha.length; seed += 1) {
    if (visited[seed] || alpha[seed] <= threshold) continue;
    components += 1;
    const stack = [seed];
    const pixels: number[] = [];
    visited[seed] = 1;
    while (stack.length) {
      const pixel = stack.pop()!;
      pixels.push(pixel);
      const x = pixel % width;
      const y = Math.floor(pixel / width);
      for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const next = ny * width + nx;
        if (!visited[next] && alpha[next] > threshold) {
          visited[next] = 1;
          stack.push(next);
        }
      }
    }
    if (pixels.length > largest.length) largest = pixels;
  }
  if (!largest.length) throw new Error("The upload has no non-transparent component.");
  const membership = new Uint8Array(alpha.length);
  let left = width; let top = height; let right = -1; let bottom = -1;
  for (const pixel of largest) {
    membership[pixel] = 1;
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
  }
  return { membership, bounds: { left, top, right, bottom }, removedDetachedIslands: Math.max(0, components - 1) };
}

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("PNG encoding failed.")), "image/png"));
}

export async function normalizeComponentSource(file: Blob, input: {
  targetVisibleWidthPx: number;
  seatYPx: number;
  canvasWidthPx?: number;
  canvasHeightPx?: number;
}) {
  const canvasWidthPx = input.canvasWidthPx ?? 2080;
  const canvasHeightPx = input.canvasHeightPx ?? 2288;
  const bitmap = await createImageBitmap(file);
  const scratch = document.createElement("canvas");
  scratch.width = bitmap.width; scratch.height = bitmap.height;
  const scratchContext = scratch.getContext("2d", { willReadFrequently: true });
  if (!scratchContext) throw new Error("Canvas image inspection is unavailable.");
  scratchContext.drawImage(bitmap, 0, 0);
  bitmap.close();
  const raw = scratchContext.getImageData(0, 0, scratch.width, scratch.height);
  const rawAlpha = new Uint8ClampedArray(scratch.width * scratch.height);
  for (let pixel = 0; pixel < rawAlpha.length; pixel += 1) rawAlpha[pixel] = raw.data[pixel * 4 + 3];
  const sourceComponent = largestAlphaComponent(rawAlpha, scratch.width, scratch.height);
  const sourceWidth = sourceComponent.bounds.right - sourceComponent.bounds.left + 1;
  const sourceHeight = sourceComponent.bounds.bottom - sourceComponent.bounds.top + 1;
  const scale = input.targetVisibleWidthPx / sourceWidth;
  const targetWidth = Math.max(1, Math.round(sourceWidth * scale));
  const targetHeight = Math.max(1, Math.round(sourceHeight * scale));
  const targetLeft = Math.round((canvasWidthPx - targetWidth) / 2);
  const targetTop = Math.round(input.seatYPx - targetHeight + 1);
  if (targetLeft < 0 || targetTop < 0 || targetLeft + targetWidth > canvasWidthPx || targetTop + targetHeight > canvasHeightPx) {
    throw new Error("The normalized component would exceed the 2080×2288 canvas.");
  }

  const output = document.createElement("canvas");
  output.width = canvasWidthPx; output.height = canvasHeightPx;
  const outputContext = output.getContext("2d", { willReadFrequently: true });
  if (!outputContext) throw new Error("Canvas normalization is unavailable.");
  outputContext.drawImage(
    scratch,
    sourceComponent.bounds.left,
    sourceComponent.bounds.top,
    sourceWidth,
    sourceHeight,
    targetLeft,
    targetTop,
    targetWidth,
    targetHeight,
  );
  const normalized = outputContext.getImageData(0, 0, canvasWidthPx, canvasHeightPx);
  const normalizedAlpha = new Uint8ClampedArray(canvasWidthPx * canvasHeightPx);
  for (let pixel = 0; pixel < normalizedAlpha.length; pixel += 1) normalizedAlpha[pixel] = normalized.data[pixel * 4 + 3];
  const clean = largestAlphaComponent(normalizedAlpha, canvasWidthPx, canvasHeightPx);
  const mask = document.createElement("canvas");
  mask.width = canvasWidthPx; mask.height = canvasHeightPx;
  const maskContext = mask.getContext("2d");
  if (!maskContext) throw new Error("Authority-mask generation is unavailable.");
  const maskPixels = maskContext.createImageData(canvasWidthPx, canvasHeightPx);
  for (let pixel = 0; pixel < clean.membership.length; pixel += 1) {
    if (clean.membership[pixel]) {
      maskPixels.data[pixel * 4] = 255;
      maskPixels.data[pixel * 4 + 1] = 255;
      maskPixels.data[pixel * 4 + 2] = 255;
      maskPixels.data[pixel * 4 + 3] = 255;
    } else {
      normalized.data[pixel * 4 + 3] = 0;
    }
  }
  outputContext.putImageData(normalized, 0, 0);
  maskContext.putImageData(maskPixels, 0, 0);
  const [sourceBlob, authorityMaskBlob] = await Promise.all([canvasBlob(output), canvasBlob(mask)]);
  return {
    sourceBlob,
    authorityMaskBlob,
    alphaBounds: clean.bounds,
    sourceVisibleBounds: sourceComponent.bounds,
    removedDetachedIslands: sourceComponent.removedDetachedIslands + clean.removedDetachedIslands,
    mountAxisXPx: (clean.bounds.left + clean.bounds.right) / 2,
    seatYPx: clean.bounds.bottom,
    previewUrl: URL.createObjectURL(sourceBlob),
  };
}

