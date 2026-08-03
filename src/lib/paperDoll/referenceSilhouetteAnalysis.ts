export interface ReferenceSilhouetteBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ReferenceSilhouetteExtraction {
  backgroundRgb: [number, number, number];
  borderDistanceP99: number;
  foregroundDistanceThreshold: number;
  connectedComponentCount: number;
  largestComponentPixels: number;
  selectedForegroundComponentCount: number;
  outerEnvelopePixels: number;
  bounds: ReferenceSilhouetteBounds;
  mask: Uint8Array;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
}

function percentile(values: number[], ratio: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * ratio))];
}

function distance(r: number, g: number, b: number, background: [number, number, number]): number {
  return Math.sqrt((r - background[0]) ** 2 + (g - background[1]) ** 2 + (b - background[2]) ** 2);
}

export function extractAdaptiveReferenceSilhouette(
  rgb: Uint8Array,
  width: number,
  height: number,
): ReferenceSilhouetteExtraction {
  if (rgb.length !== width * height * 3) throw new Error("RGB buffer dimensions do not match.");
  const borderWidth = Math.max(2, Math.round(Math.min(width, height) * 0.02));
  const borderR: number[] = [];
  const borderG: number[] = [];
  const borderB: number[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (x >= borderWidth && x < width - borderWidth && y >= borderWidth && y < height - borderWidth) continue;
      const offset = (y * width + x) * 3;
      borderR.push(rgb[offset]);
      borderG.push(rgb[offset + 1]);
      borderB.push(rgb[offset + 2]);
    }
  }
  const backgroundRgb: [number, number, number] = [median(borderR), median(borderG), median(borderB)];
  const borderDistances = borderR.map((r, index) => distance(r, borderG[index], borderB[index], backgroundRgb));
  const borderDistanceP99 = percentile(borderDistances, 0.99);
  const foregroundDistanceThreshold = Math.min(64, Math.max(3, Math.ceil(borderDistanceP99 + 3)));
  const foreground = new Uint8Array(width * height);
  for (let index = 0; index < foreground.length; index += 1) {
    const offset = index * 3;
    if (distance(rgb[offset], rgb[offset + 1], rgb[offset + 2], backgroundRgb) > foregroundDistanceThreshold) foreground[index] = 1;
  }

  const visited = new Uint8Array(foreground.length);
  const components: Array<{ pixels: number[]; bounds: ReferenceSilhouetteBounds }> = [];
  const neighborOffsets = [-1, 0, 1];
  for (let index = 0; index < foreground.length; index += 1) {
    if (!foreground[index] || visited[index]) continue;
    const stack = [index];
    visited[index] = 1;
    const pixels: number[] = [];
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    while (stack.length > 0) {
      const current = stack.pop()!;
      pixels.push(current);
      const x = current % width;
      const y = Math.floor(current / width);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      for (const dy of neighborOffsets) for (const dx of neighborOffsets) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const neighbor = ny * width + nx;
        if (foreground[neighbor] && !visited[neighbor]) {
          visited[neighbor] = 1;
          stack.push(neighbor);
        }
      }
    }
    components.push({ pixels, bounds: { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 } });
  }
  const sortedComponents = components.sort((left, right) => right.pixels.length - left.pixels.length);
  const largest = sortedComponents[0];
  if (!largest) throw new Error("No foreground component found after adaptive border calibration.");
  // Product references frequently contain pure-white highlights that split a reflective
  // object into multiple foreground components. Retain every materially sized component,
  // then compare the per-row outer envelope. This is diagnostic source evidence only and
  // is never accepted as an authority mask.
  const minimumComponentPixels = Math.max(4, Math.floor(largest.pixels.length * 0.001));
  const selectedComponents = sortedComponents.filter((component) => component.pixels.length >= minimumComponentPixels);
  const rowMinimum = new Int32Array(height).fill(width);
  const rowMaximum = new Int32Array(height).fill(-1);
  for (const component of selectedComponents) for (const pixel of component.pixels) {
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    rowMinimum[y] = Math.min(rowMinimum[y], x);
    rowMaximum[y] = Math.max(rowMaximum[y], x);
  }
  const mask = new Uint8Array(width * height);
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let outerEnvelopePixels = 0;
  for (let y = 0; y < height; y += 1) {
    if (rowMaximum[y] < rowMinimum[y]) continue;
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
    minX = Math.min(minX, rowMinimum[y]);
    maxX = Math.max(maxX, rowMaximum[y]);
    for (let x = rowMinimum[y]; x <= rowMaximum[y]; x += 1) {
      mask[y * width + x] = 255;
      outerEnvelopePixels += 1;
    }
  }
  return {
    backgroundRgb,
    borderDistanceP99,
    foregroundDistanceThreshold,
    connectedComponentCount: components.length,
    largestComponentPixels: largest.pixels.length,
    selectedForegroundComponentCount: selectedComponents.length,
    outerEnvelopePixels,
    bounds: { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 },
    mask,
  };
}

export function normalizeReferenceSilhouette(
  extraction: Pick<ReferenceSilhouetteExtraction, "bounds" | "mask">,
  sourceWidth: number,
  targetSize = 256,
): Uint8Array {
  const target = new Uint8Array(targetSize * targetSize);
  for (let y = 0; y < targetSize; y += 1) {
    const sourceY = extraction.bounds.y + Math.min(extraction.bounds.height - 1, Math.floor(y * extraction.bounds.height / targetSize));
    for (let x = 0; x < targetSize; x += 1) {
      const sourceX = extraction.bounds.x + Math.min(extraction.bounds.width - 1, Math.floor(x * extraction.bounds.width / targetSize));
      if (extraction.mask[sourceY * sourceWidth + sourceX]) target[y * targetSize + x] = 255;
    }
  }
  return target;
}

export function binarySilhouetteIou(left: Uint8Array, right: Uint8Array): number {
  if (left.length !== right.length) throw new Error("Silhouette lengths do not match.");
  let intersection = 0;
  let union = 0;
  for (let index = 0; index < left.length; index += 1) {
    const leftOn = left[index] > 0;
    const rightOn = right[index] > 0;
    if (leftOn && rightOn) intersection += 1;
    if (leftOn || rightOn) union += 1;
  }
  return union === 0 ? 1 : intersection / union;
}
