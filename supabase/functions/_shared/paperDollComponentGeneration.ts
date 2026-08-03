import {
  compareExactAlphaBytes,
  copyAuthorityAlpha,
  type ExactAlphaComparison,
} from "./paperDollExactAlpha.ts";

export interface PixelBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface DecodedRgbaImage {
  width: number;
  height: number;
  rgba: Uint8Array | Uint8ClampedArray;
}

export interface DecodedAuthorityMask {
  width: number;
  height: number;
  alpha: Uint8Array;
  bounds: PixelBounds;
}

function validBounds(
  bounds: PixelBounds,
  width: number,
  height: number,
): boolean {
  return Number.isInteger(bounds.left) && Number.isInteger(bounds.top) &&
    Number.isInteger(bounds.width) && Number.isInteger(bounds.height) &&
    bounds.left >= 0 && bounds.top >= 0 && bounds.width > 0 &&
    bounds.height > 0 &&
    bounds.left + bounds.width <= width && bounds.top + bounds.height <= height;
}

function alphaBytes(rgba: Uint8Array): Uint8Array {
  const alpha = new Uint8Array(rgba.length / 4);
  for (let index = 0; index < alpha.length; index++) {
    alpha[index] = rgba[index * 4 + 3];
  }
  return alpha;
}

export function clampDecodedMaterialToAuthority(input: {
  material: DecodedRgbaImage;
  sourceBounds: PixelBounds;
  authority: DecodedAuthorityMask;
}): { rgba: Uint8Array; alpha: Uint8Array; qa: ExactAlphaComparison } {
  const { material, sourceBounds, authority } = input;
  if (material.rgba.length !== material.width * material.height * 4) {
    throw new Error(
      "Decoded material RGBA length does not match its dimensions.",
    );
  }
  if (authority.alpha.length !== authority.width * authority.height) {
    throw new Error("Authority alpha length does not match its dimensions.");
  }
  if (!validBounds(sourceBounds, material.width, material.height)) {
    throw new Error("Source bounds fall outside generated material pixels.");
  }
  if (!validBounds(authority.bounds, authority.width, authority.height)) {
    throw new Error("Authority bounds fall outside the authority canvas.");
  }

  const materialCanvas = new Uint8Array(authority.width * authority.height * 4);
  for (let targetY = 0; targetY < authority.bounds.height; targetY++) {
    const sourceY = sourceBounds.top + Math.min(
      sourceBounds.height - 1,
      Math.floor(targetY * sourceBounds.height / authority.bounds.height),
    );
    for (let targetX = 0; targetX < authority.bounds.width; targetX++) {
      const sourceX = sourceBounds.left + Math.min(
        sourceBounds.width - 1,
        Math.floor(targetX * sourceBounds.width / authority.bounds.width),
      );
      const sourceOffset = (sourceY * material.width + sourceX) * 4;
      const canvasX = authority.bounds.left + targetX;
      const canvasY = authority.bounds.top + targetY;
      const targetOffset = (canvasY * authority.width + canvasX) * 4;
      materialCanvas[targetOffset] = material.rgba[sourceOffset];
      materialCanvas[targetOffset + 1] = material.rgba[sourceOffset + 1];
      materialCanvas[targetOffset + 2] = material.rgba[sourceOffset + 2];
      materialCanvas[targetOffset + 3] = 255;
    }
  }
  const rgba = copyAuthorityAlpha(materialCanvas, authority.alpha);
  const alpha = alphaBytes(rgba);
  return { rgba, alpha, qa: compareExactAlphaBytes(alpha, authority.alpha) };
}

export type CandidateProvider =
  | "openai"
  | "google"
  | "higgsfield"
  | "manual"
  | "blender"
  | "deterministic";

export function buildProviderPlan(input: {
  provider: CandidateProvider;
  model: string;
}): { provider: CandidateProvider; model: string; invokeProvider: boolean } {
  if (!input.model.trim()) throw new Error("Generation model is required.");
  return {
    provider: input.provider,
    model: input.model,
    invokeProvider: input.provider === "openai" ||
      input.provider === "google" || input.provider === "higgsfield",
  };
}

export function validateOriginalFilename(value: string): string {
  const filename = value.trim();
  if (!filename) throw new Error("Original filename is required.");
  if (/[\\/]/.test(filename)) {
    throw new Error("Original filename must not contain path separators.");
  }
  return filename;
}

function segment(value: string, label: string): string {
  const normalized = value.trim().replace(/[^a-zA-Z0-9._-]+/g, "-");
  if (!normalized) throw new Error(`${label} is required.`);
  return normalized;
}

export function buildCandidateStoragePaths(input: {
  organizationId: string;
  familyKey: string;
  candidateId: string;
  sourceSha256: string;
}): {
  raw: string;
  candidate: string;
  layer: string;
  review: string;
  manifest: string;
} {
  if (!/^[a-f0-9]{64}$/.test(input.sourceSha256)) {
    throw new Error("Source SHA-256 is invalid.");
  }
  const root = `${segment(input.organizationId, "Organization ID")}/${
    segment(input.familyKey, "Family key")
  }`;
  const candidateId = segment(input.candidateId, "Candidate ID");
  return {
    raw: `${root}/raw/${input.sourceSha256}`,
    candidate: `${root}/candidates/${candidateId}.png`,
    layer: `${root}/layers/${candidateId}.png`,
    review: `${root}/review/${candidateId}.png`,
    manifest: `${root}/candidates/${candidateId}.json`,
  };
}
