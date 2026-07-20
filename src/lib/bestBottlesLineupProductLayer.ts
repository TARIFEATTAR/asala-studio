import { mkdir } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

export interface ProductBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface ProductLayerInput {
  sourceBytes: Uint8Array;
  /** Manifest lineage checksum. The layer preparation contract preserves this value verbatim. */
  sourceChecksum: string;
  heightWithCapMm: number;
  diameterMm: number;
  reviewLayerPath?: string;
  expectedPrimaryLane?: { leftPct: number; rightPct: number };
  clipPrimarySearchToLane?: boolean;
  analysisMaxDimension?: number;
}

export interface ProductLayerComponent {
  bounds: ProductBounds;
  pixelCount: number;
}

export interface ProductAspectComparison {
  observedSourceAspect: number;
  measuredAspect: number;
  relativeDelta: number;
}

export interface ProductLayerResult {
  status: "prepared" | "blocked";
  /** Exact manifest lineage supplied by the caller; never recomputed from decoded image bytes. */
  sourceChecksum: string;
  sourceWidth: number;
  sourceHeight: number;
  reviewLayerPath: string | null;
  primaryBounds: ProductBounds | null;
  fullForegroundBounds: ProductBounds | null;
  sidecars: ProductLayerComponent[];
  topologyStatus: "confirmed" | "topology-review" | "unresolved";
  aspectComparison: ProductAspectComparison | null;
  blockers: string[];
}

interface RawImage {
  data: Buffer;
  width: number;
  height: number;
  channels: number;
}

interface Component extends ProductLayerComponent {
  id: number;
  centerX: number;
}

const DEFAULT_PRIMARY_LANE = { leftPct: 0.35, rightPct: 0.65 };

function roundEvidence(value: number): number {
  return Number(value.toFixed(6));
}

function validateInput(input: ProductLayerInput): void {
  if (!input.sourceChecksum.trim()) throw new Error("sourceChecksum is required");
  if (!(input.heightWithCapMm > 0) || !Number.isFinite(input.heightWithCapMm)) {
    throw new Error("heightWithCapMm must be a positive finite number");
  }
  if (!(input.diameterMm > 0) || !Number.isFinite(input.diameterMm)) {
    throw new Error("diameterMm must be a positive finite number");
  }
  const lane = input.expectedPrimaryLane ?? DEFAULT_PRIMARY_LANE;
  if (!(lane.leftPct >= 0 && lane.leftPct < lane.rightPct && lane.rightPct <= 1)) {
    throw new Error("expectedPrimaryLane must be ordered within 0..1");
  }
}

async function rawImage(sourceBytes: Uint8Array, maxDimension?: number): Promise<RawImage> {
  let pipeline = sharp(sourceBytes, { animated: false }).flatten({ background: { r: 255, g: 255, b: 255 } });
  if (maxDimension) {
    pipeline = pipeline.resize({
      width: maxDimension,
      height: maxDimension,
      fit: "inside",
      withoutEnlargement: true,
    });
  }
  const { data, info } = await pipeline.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height, channels: info.channels };
}

function backgroundColor(image: RawImage): [number, number, number] {
  const samples: Array<[number, number, number]> = [];
  const insetX = Math.max(0, Math.min(2, image.width - 1));
  const insetY = Math.max(0, Math.min(2, image.height - 1));
  for (const [x, y] of [
    [0, 0], [image.width - 1, 0], [0, image.height - 1], [image.width - 1, image.height - 1],
    [insetX, insetY], [image.width - 1 - insetX, insetY],
    [insetX, image.height - 1 - insetY], [image.width - 1 - insetX, image.height - 1 - insetY],
  ]) {
    const offset = (y * image.width + x) * image.channels;
    samples.push([image.data[offset], image.data[offset + 1], image.data[offset + 2]]);
  }
  const median = (channel: number) => samples.map((sample) => sample[channel]).sort((a, b) => a - b)[Math.floor(samples.length / 2)];
  return [median(0), median(1), median(2)];
}

function foregroundMask(image: RawImage): Uint8Array {
  const background = backgroundColor(image);
  const mask = new Uint8Array(image.width * image.height);
  for (let pixel = 0; pixel < mask.length; pixel += 1) {
    const offset = pixel * image.channels;
    const difference = Math.max(
      Math.abs(image.data[offset] - background[0]),
      Math.abs(image.data[offset + 1] - background[1]),
      Math.abs(image.data[offset + 2] - background[2]),
    );
    if (difference >= 18) mask[pixel] = 1;
  }
  return mask;
}

function componentsFor(mask: Uint8Array, width: number, height: number): Component[] {
  const labels = new Int32Array(mask.length);
  const components: Component[] = [];
  const minimumPixels = Math.max(3, Math.floor(mask.length * 0.0002));
  let nextId = 1;
  for (let start = 0; start < mask.length; start += 1) {
    if (!mask[start] || labels[start]) continue;
    const queue = [start];
    labels[start] = nextId;
    let cursor = 0;
    let count = 0;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    let sumX = 0;
    while (cursor < queue.length) {
      const pixel = queue[cursor++];
      const x = pixel % width;
      const y = Math.floor(pixel / width);
      count += 1;
      sumX += x;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          if (offsetX === 0 && offsetY === 0) continue;
          const neighborX = x + offsetX;
          const neighborY = y + offsetY;
          if (neighborX < 0 || neighborX >= width || neighborY < 0 || neighborY >= height) continue;
          const neighbor = neighborY * width + neighborX;
          if (mask[neighbor] && !labels[neighbor]) {
            labels[neighbor] = nextId;
            queue.push(neighbor);
          }
        }
      }
    }
    if (count >= minimumPixels) {
      components.push({
        id: nextId,
        bounds: { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 },
        pixelCount: count,
        centerX: sumX / count,
      });
    }
    nextId += 1;
  }
  return components;
}

function intersectsLane(component: Component, width: number, lane: { leftPct: number; rightPct: number }): boolean {
  const laneLeft = width * lane.leftPct;
  const laneRight = width * lane.rightPct;
  const componentRight = component.bounds.left + component.bounds.width;
  return component.bounds.left < laneRight && componentRight > laneLeft;
}

function aspectError(component: Component, measuredAspect: number): number {
  const observedAspect = component.bounds.height / component.bounds.width;
  return Math.abs(observedAspect - measuredAspect) / measuredAspect;
}

function choosePrimary(
  components: Component[],
  width: number,
  lane: { leftPct: number; rightPct: number },
  measuredAspect: number,
): Component | null {
  const center = width * ((lane.leftPct + lane.rightPct) / 2);
  return components.filter((component) => intersectsLane(component, width, lane)).sort((left, right) =>
    aspectError(left, measuredAspect) - aspectError(right, measuredAspect) ||
    right.pixelCount - left.pixelCount ||
    Math.abs(left.centerX - center) - Math.abs(right.centerX - center) ||
    left.bounds.left - right.bounds.left
  )[0] ?? null;
}

function clipMaskToLane(
  mask: Uint8Array,
  width: number,
  lane: { leftPct: number; rightPct: number },
): Uint8Array {
  const clipped = mask.slice();
  const left = Math.floor(width * lane.leftPct);
  const right = Math.ceil(width * lane.rightPct);
  for (let pixel = 0; pixel < clipped.length; pixel += 1) {
    const x = pixel % width;
    if (x < left || x >= right) clipped[pixel] = 0;
  }
  return clipped;
}

function unionComponents(components: Component[]): Component | null {
  if (components.length === 0) return null;
  const left = Math.min(...components.map((component) => component.bounds.left));
  const top = Math.min(...components.map((component) => component.bounds.top));
  const right = Math.max(...components.map((component) => component.bounds.left + component.bounds.width));
  const bottom = Math.max(...components.map((component) => component.bounds.top + component.bounds.height));
  const pixelCount = components.reduce((total, component) => total + component.pixelCount, 0);
  return {
    id: -1,
    bounds: { left, top, width: right - left, height: bottom - top },
    pixelCount,
    centerX: left + (right - left) / 2,
  };
}

function recoverMeasuredWidthForRightHandLane(
  primary: Component | null,
  measuredAspect: number,
  imageWidth: number,
): Component | null {
  if (!primary) return null;
  const expectedWidth = Math.max(1, Math.round(primary.bounds.height / measuredAspect));
  if (primary.bounds.width >= expectedWidth * 0.75) return primary;
  const right = Math.min(imageWidth, primary.bounds.left + primary.bounds.width);
  const left = Math.max(0, right - expectedWidth);
  return {
    ...primary,
    bounds: { ...primary.bounds, left, width: right - left },
    centerX: left + (right - left) / 2,
  };
}

function refinePrimary(
  fullComponents: Component[],
  analysisPrimary: Component,
  analysisWidth: number,
  analysisHeight: number,
  fullWidth: number,
  fullHeight: number,
  lane: { leftPct: number; rightPct: number },
): Component | null {
  const analysisCenterX = analysisPrimary.centerX / analysisWidth;
  const analysisCenterY = (analysisPrimary.bounds.top + analysisPrimary.bounds.height / 2) / analysisHeight;
  return fullComponents.filter((component) => intersectsLane(component, fullWidth, lane)).sort((left, right) => {
    const leftDistance = Math.abs(left.centerX / fullWidth - analysisCenterX) +
      Math.abs((left.bounds.top + left.bounds.height / 2) / fullHeight - analysisCenterY);
    const rightDistance = Math.abs(right.centerX / fullWidth - analysisCenterX) +
      Math.abs((right.bounds.top + right.bounds.height / 2) / fullHeight - analysisCenterY);
    return leftDistance - rightDistance || right.pixelCount - left.pixelCount;
  })[0] ?? null;
}

export async function prepareLineupProductLayer(input: ProductLayerInput): Promise<ProductLayerResult> {
  validateInput(input);
  const lane = input.expectedPrimaryLane ?? DEFAULT_PRIMARY_LANE;
  const measuredAspect = input.heightWithCapMm / input.diameterMm;
  const full = await rawImage(input.sourceBytes);
  const analysis = await rawImage(input.sourceBytes, input.analysisMaxDimension ?? 1024);
  const analysisMask = foregroundMask(analysis);
  const fullMask = foregroundMask(full);
  const analysisPrimaryMask = input.clipPrimarySearchToLane
    ? clipMaskToLane(analysisMask, analysis.width, lane)
    : analysisMask;
  const fullPrimaryMask = input.clipPrimarySearchToLane
    ? clipMaskToLane(fullMask, full.width, lane)
    : fullMask;
  const analysisComponents = componentsFor(analysisPrimaryMask, analysis.width, analysis.height);
  const analysisPrimary = input.clipPrimarySearchToLane
    ? unionComponents(analysisComponents)
    : choosePrimary(analysisComponents, analysis.width, lane, measuredAspect);
  const fullComponents = componentsFor(fullPrimaryMask, full.width, full.height);
  const fullSourceComponents = input.clipPrimarySearchToLane
    ? componentsFor(fullMask, full.width, full.height)
    : fullComponents;
  const fullForegroundBounds = unionComponents(fullSourceComponents)?.bounds ?? null;
  const detectedPrimary = input.clipPrimarySearchToLane
    ? unionComponents(fullComponents)
    : analysisPrimary
      ? refinePrimary(fullComponents, analysisPrimary, analysis.width, analysis.height, full.width, full.height, lane)
      : null;
  const primary = input.clipPrimarySearchToLane
    ? recoverMeasuredWidthForRightHandLane(detectedPrimary, measuredAspect, full.width)
    : detectedPrimary;

  if (input.reviewLayerPath) {
    await mkdir(path.dirname(input.reviewLayerPath), { recursive: true });
    await sharp(input.sourceBytes, { animated: false }).png().toFile(input.reviewLayerPath);
  }

  if (!primary) {
    return {
      status: "blocked",
      sourceChecksum: input.sourceChecksum,
      sourceWidth: full.width,
      sourceHeight: full.height,
      reviewLayerPath: input.reviewLayerPath ?? null,
      primaryBounds: null,
      fullForegroundBounds,
      sidecars: fullSourceComponents.map(({ bounds, pixelCount }) => ({ bounds, pixelCount })),
      topologyStatus: "unresolved",
      aspectComparison: null,
      blockers: ["primary_bounds_unresolved"],
    };
  }

  const primaryRight = primary.bounds.left + primary.bounds.width;
  const primaryBottom = primary.bounds.top + primary.bounds.height;
  const sidecars = fullSourceComponents
    .filter((component) => input.clipPrimarySearchToLane
      ? component.bounds.left + component.bounds.width <= primary.bounds.left
        || component.bounds.left >= primaryRight
        || component.bounds.top + component.bounds.height <= primary.bounds.top
        || component.bounds.top >= primaryBottom
      : component.id !== primary.id)
    .sort((left, right) => left.bounds.left - right.bounds.left || left.bounds.top - right.bounds.top)
    .map(({ bounds, pixelCount }) => ({ bounds, pixelCount }));
  const observedSourceAspect = primary.bounds.height / primary.bounds.width;
  return {
    status: "prepared",
    sourceChecksum: input.sourceChecksum,
    sourceWidth: full.width,
    sourceHeight: full.height,
    reviewLayerPath: input.reviewLayerPath ?? null,
    primaryBounds: primary.bounds,
    fullForegroundBounds,
    sidecars,
    topologyStatus: sidecars.length > 0 || input.clipPrimarySearchToLane ? "topology-review" : "confirmed",
    aspectComparison: {
      observedSourceAspect: roundEvidence(observedSourceAspect),
      measuredAspect: roundEvidence(measuredAspect),
      relativeDelta: roundEvidence((observedSourceAspect - measuredAspect) / measuredAspect),
    },
    blockers: [],
  };
}
