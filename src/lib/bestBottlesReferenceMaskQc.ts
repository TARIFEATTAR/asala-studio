export interface BestBottlesAlphaMaskPixelInput {
  data: ArrayLike<number>;
  width: number;
  height: number;
}

export interface BestBottlesAlphaMaskQcResult {
  passed: boolean;
  reasons: string[];
  foregroundPixelRatio: number;
  transparentPixelRatio: number;
  partialAlphaPixelRatio: number;
  significantForegroundComponents: number;
}

export interface BestBottlesAlphaMaskQcOptions {
  minTransparentRatio?: number;
  minForegroundRatio?: number;
  maxForegroundRatio?: number;
  maxSignificantForegroundComponents?: number;
  minSignificantComponentRatio?: number;
}

export type BestBottlesReferenceSlot = "product-truth" | "mask-control";
export type BestBottlesMaskControlStatus =
  | "not-required"
  | "missing"
  | "checking"
  | "unverified"
  | "failed"
  | "passed";

export interface BestBottlesMaskControlReadinessInput {
  isCylinderTwoSourcePilot: boolean;
  maskReferenceUrl: string | null | undefined;
  isCheckingMaskQc: boolean;
  maskQcResult: BestBottlesAlphaMaskQcResult | null;
}

export interface BestBottlesMaskControlReadiness {
  status: BestBottlesMaskControlStatus;
  issue: string | null;
}

export interface BestBottlesProductTruthReferenceIssueInput {
  isCylinderTwoSourcePilot: boolean;
  referenceUrl: string | null | undefined;
  isCheckingReferenceQc: boolean;
  referenceAlphaMaskQc: BestBottlesAlphaMaskQcResult | null;
}

export function hasBestBottlesReferenceTransparency(
  alphaMaskQc: BestBottlesAlphaMaskQcResult | null | undefined,
): boolean {
  if (!alphaMaskQc) return false;
  return alphaMaskQc.transparentPixelRatio >= 0.02 || alphaMaskQc.partialAlphaPixelRatio >= 0.02;
}

export function isBestBottlesReferenceOverrideActive({
  selectedKey,
  overrideKey,
}: {
  selectedKey: string | null | undefined;
  overrideKey: string | null | undefined;
}): boolean {
  return Boolean(selectedKey && overrideKey && selectedKey === overrideKey);
}

export function classifyBestBottlesReferenceSlot({
  isCylinderTwoSourcePilot,
  alphaMaskQc,
}: {
  isCylinderTwoSourcePilot: boolean;
  alphaMaskQc: BestBottlesAlphaMaskQcResult;
}): BestBottlesReferenceSlot {
  if (isCylinderTwoSourcePilot && (alphaMaskQc.passed || hasBestBottlesReferenceTransparency(alphaMaskQc))) {
    return "mask-control";
  }
  return "product-truth";
}

export function getBestBottlesMaskControlReadiness({
  isCylinderTwoSourcePilot,
  maskReferenceUrl,
  isCheckingMaskQc,
  maskQcResult,
}: BestBottlesMaskControlReadinessInput): BestBottlesMaskControlReadiness {
  if (!isCylinderTwoSourcePilot) {
    return { status: "not-required", issue: null };
  }
  if (!maskReferenceUrl) {
    return {
      status: "not-required",
      issue: null,
    };
  }
  if (isCheckingMaskQc) {
    return {
      status: "checking",
      issue: "Transparent mask/control PNG is still running Alpha QC.",
    };
  }
  if (maskQcResult === null) {
    return {
      status: "unverified",
      issue: "Transparent mask/control PNG has not completed Alpha QC.",
    };
  }
  if (!maskQcResult.passed) {
    return {
      status: "failed",
      issue: maskQcResult.reasons.join(" "),
    };
  }
  return { status: "passed", issue: null };
}

export function getBestBottlesProductTruthReferenceIssue({
  isCylinderTwoSourcePilot,
  referenceUrl,
  isCheckingReferenceQc,
  referenceAlphaMaskQc,
}: BestBottlesProductTruthReferenceIssueInput): string | null {
  if (!isCylinderTwoSourcePilot || !referenceUrl) return null;
  if (isCheckingReferenceQc) {
    return "Product truth reference is still checking transparency before generation.";
  }
  if (hasBestBottlesReferenceTransparency(referenceAlphaMaskQc)) {
    return "Transparent product truth references cannot be used as the flattened product-truth source. Use the flattened Photoshop export here.";
  }
  return null;
}

export function evaluateBestBottlesAlphaMaskPixels(
  input: BestBottlesAlphaMaskPixelInput,
  options: BestBottlesAlphaMaskQcOptions = {},
): BestBottlesAlphaMaskQcResult {
  const totalPixels = input.width * input.height;
  const expectedLength = totalPixels * 4;
  if (input.width <= 0 || input.height <= 0 || input.data.length < expectedLength) {
    return {
      passed: false,
      reasons: ["Mask image could not be read."],
      foregroundPixelRatio: 0,
      transparentPixelRatio: 0,
      partialAlphaPixelRatio: 0,
      significantForegroundComponents: 0,
    };
  }

  const minTransparentRatio = options.minTransparentRatio ?? 0.05;
  const minForegroundRatio = options.minForegroundRatio ?? 0.01;
  const maxForegroundRatio = options.maxForegroundRatio ?? 0.85;
  const maxSignificantForegroundComponents = options.maxSignificantForegroundComponents ?? 2;
  const minSignificantComponentPixels = Math.max(
    8,
    Math.floor(totalPixels * (options.minSignificantComponentRatio ?? 0.003)),
  );
  let transparentPixels = 0;
  let foregroundPixels = 0;
  let partialAlphaPixels = 0;

  for (let i = 0; i < expectedLength; i += 4) {
    const alpha = input.data[i + 3] ?? 255;
    if (alpha <= 8) {
      transparentPixels += 1;
    } else {
      foregroundPixels += 1;
      if (alpha < 250) partialAlphaPixels += 1;
    }
  }

  const transparentPixelRatio = transparentPixels / totalPixels;
  const foregroundPixelRatio = foregroundPixels / totalPixels;
  const partialAlphaPixelRatio = partialAlphaPixels / totalPixels;
  const significantForegroundComponents = countSignificantAlphaComponents(
    input,
    minSignificantComponentPixels,
  );
  const reasons: string[] = [];

  if (transparentPixelRatio < minTransparentRatio && partialAlphaPixelRatio < 0.01) {
    reasons.push("Mask/control reference needs real transparency; use the background-removed PNG, not the flattened product truth PNG.");
  }
  if (foregroundPixelRatio < minForegroundRatio) {
    reasons.push("Mask foreground is too sparse to control product bounds.");
  }
  if (foregroundPixelRatio > maxForegroundRatio) {
    reasons.push("Mask foreground covers almost the entire canvas; background removal likely failed.");
  }
  if (significantForegroundComponents > maxSignificantForegroundComponents) {
    reasons.push("Mask/control reference contains extra disconnected foreground fragments; remove ghost caps or extraction debris before generation.");
  }

  return {
    passed: reasons.length === 0,
    reasons,
    foregroundPixelRatio,
    transparentPixelRatio,
    partialAlphaPixelRatio,
    significantForegroundComponents,
  };
}

function countSignificantAlphaComponents(
  input: BestBottlesAlphaMaskPixelInput,
  minSignificantComponentPixels: number,
): number {
  const { width, height, data } = input;
  const totalPixels = width * height;
  const visited = new Uint8Array(totalPixels);
  let significant = 0;

  for (let start = 0; start < totalPixels; start += 1) {
    if (visited[start] || (data[start * 4 + 3] ?? 0) <= 8) continue;
    let count = 0;
    const stack = [start];
    visited[start] = 1;

    while (stack.length > 0) {
      const p = stack.pop()!;
      count += 1;
      const x = p % width;
      const y = Math.floor(p / width);
      const neighbors = [
        x > 0 ? p - 1 : -1,
        x < width - 1 ? p + 1 : -1,
        y > 0 ? p - width : -1,
        y < height - 1 ? p + width : -1,
      ];

      for (const n of neighbors) {
        if (n < 0 || visited[n] || (data[n * 4 + 3] ?? 0) <= 8) continue;
        visited[n] = 1;
        stack.push(n);
      }
    }

    if (count >= minSignificantComponentPixels) {
      significant += 1;
    }
  }

  return significant;
}

function loadReferenceImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Mask/control image could not be loaded for Alpha QC."));
    image.src = url;
  });
}

export async function runBestBottlesReferenceMaskQc(
  url: string,
  options: BestBottlesAlphaMaskQcOptions = {},
): Promise<BestBottlesAlphaMaskQcResult> {
  if (typeof document === "undefined") {
    return {
      passed: false,
      reasons: ["Mask Alpha QC requires a browser canvas."],
      foregroundPixelRatio: 0,
      transparentPixelRatio: 0,
      partialAlphaPixelRatio: 0,
      significantForegroundComponents: 0,
    };
  }

  try {
    const image = await loadReferenceImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth || image.width;
    canvas.height = image.naturalHeight || image.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Unable to acquire mask QC canvas context.");
    ctx.drawImage(image, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return evaluateBestBottlesAlphaMaskPixels(
      { data: imageData.data, width: canvas.width, height: canvas.height },
      options,
    );
  } catch (error) {
    return {
      passed: false,
      reasons: [error instanceof Error ? error.message : String(error)],
      foregroundPixelRatio: 0,
      transparentPixelRatio: 0,
      partialAlphaPixelRatio: 0,
      significantForegroundComponents: 0,
    };
  }
}
