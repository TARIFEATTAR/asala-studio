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

function choosePrimary(components: Component[], width: number, lane: { leftPct: number; rightPct: number }): Component | null {
  const center = width * ((lane.leftPct + lane.rightPct) / 2);
  return components.filter((component) => intersectsLane(component, width, lane)).sort((left, right) =>
    right.pixelCount - left.pixelCount ||
    Math.abs(left.centerX - center) - Math.abs(right.centerX - center) ||
    left.bounds.left - right.bounds.left
  )[0] ?? null;
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
  const full = await rawImage(input.sourceBytes);
  const analysis = await rawImage(input.sourceBytes, input.analysisMaxDimension ?? 512);
  const analysisComponents = componentsFor(foregroundMask(analysis), analysis.width, analysis.height);
  const analysisPrimary = choosePrimary(analysisComponents, analysis.width, lane);
  const fullComponents = componentsFor(foregroundMask(full), full.width, full.height);
  const primary = analysisPrimary
    ? refinePrimary(fullComponents, analysisPrimary, analysis.width, analysis.height, full.width, full.height, lane)
    : null;

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
      sidecars: fullComponents.map(({ bounds, pixelCount }) => ({ bounds, pixelCount })),
      topologyStatus: "unresolved",
      aspectComparison: null,
      blockers: ["primary_bounds_unresolved"],
    };
  }

  const sidecars = fullComponents
    .filter((component) => component.id !== primary.id)
    .sort((left, right) => left.bounds.left - right.bounds.left || left.bounds.top - right.bounds.top)
    .map(({ bounds, pixelCount }) => ({ bounds, pixelCount }));
  const observedSourceAspect = primary.bounds.height / primary.bounds.width;
  const measuredAspect = input.heightWithCapMm / input.diameterMm;
  return {
    status: "prepared",
    sourceChecksum: input.sourceChecksum,
    sourceWidth: full.width,
    sourceHeight: full.height,
    reviewLayerPath: input.reviewLayerPath ?? null,
    primaryBounds: primary.bounds,
    sidecars,
    topologyStatus: sidecars.length > 0 ? "topology-review" : "confirmed",
    aspectComparison: {
      observedSourceAspect: roundEvidence(observedSourceAspect),
      measuredAspect: roundEvidence(measuredAspect),
      relativeDelta: roundEvidence((observedSourceAspect - measuredAspect) / measuredAspect),
    },
    blockers: [],
  };
}
