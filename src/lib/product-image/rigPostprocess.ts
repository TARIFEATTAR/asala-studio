import { getFamilyRig, type RigCapState } from "@/lib/product-image/familyRig";

interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface RigBaselineNormalizeResult {
  dataUrl: string;
  shifted: boolean;
  shiftYPx: number;
  detectedBaselineYPx: number | null;
  targetBaselineYPx: number | null;
}

export interface RigBaselineNormalizeOptions {
  family?: string | null;
  capState?: string | null;
  mode?: string | null;
  targetBackgroundHex?: string;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
}

function hexToRgb(hex: string): Rgb | null {
  const raw = hex.replace(/^#/, "");
  const full = raw.length === 3
    ? raw.split("").map((c) => c + c).join("")
    : raw;
  if (!/^[0-9a-f]{6}$/i.test(full)) return null;
  const n = parseInt(full, 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

function colorDistance(pixels: Uint8ClampedArray, i: number, bg: Rgb): number {
  return Math.abs(pixels[i] - bg.r) + Math.abs(pixels[i + 1] - bg.g) + Math.abs(pixels[i + 2] - bg.b);
}

function resolveCapState(options: RigBaselineNormalizeOptions): RigCapState {
  const text = `${options.capState ?? ""} ${options.mode ?? ""}`.toLowerCase();
  return /\b(?:detached|cap[-_\s]?off|exploded)\b/.test(text) ? "detached" : "assembled";
}

function detectStrongBottomY(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  bg: Rgb,
  capState: RigCapState,
): number | null {
  const x0 = Math.round(width * (capState === "detached" ? 0.16 : 0.18));
  const x1 = Math.round(width * (capState === "detached" ? 0.62 : 0.82));
  const xStep = 2;
  const minRowHits = Math.max(10, Math.floor(((x1 - x0) / xStep) * 0.012));
  const strongThreshold = 52;

  for (let y = height - 1; y >= Math.round(height * 0.42); y -= 1) {
    let rowHits = 0;
    const row = y * width * 4;
    for (let x = x0; x < x1; x += xStep) {
      if (colorDistance(pixels, row + x * 4, bg) >= strongThreshold) {
        rowHits += 1;
        if (rowHits >= minRowHits) return y;
      }
    }
  }
  return null;
}

function detectStrongBounds(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  bg: Rgb,
): { top: number; bottom: number } | null {
  const threshold = 52;
  let top = height;
  let bottom = -1;

  for (let y = 0; y < height; y += 2) {
    const row = y * width * 4;
    let rowHasForeground = false;
    for (let x = 0; x < width; x += 2) {
      if (colorDistance(pixels, row + x * 4, bg) >= threshold) {
        rowHasForeground = true;
        break;
      }
    }
    if (rowHasForeground) {
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }

  return bottom >= 0 ? { top, bottom } : null;
}

export async function normalizeBestBottlesRigBaseline(
  imageUrl: string,
  options: RigBaselineNormalizeOptions,
): Promise<RigBaselineNormalizeResult> {
  const rig = getFamilyRig(options.family ?? "");
  const bg = hexToRgb(options.targetBackgroundHex ?? "#EEE6D4");
  if (!rig || !bg) {
    const img = await loadImage(imageUrl);
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Unable to acquire 2d canvas context");
    ctx.drawImage(img, 0, 0);
    return {
      dataUrl: canvas.toDataURL("image/png"),
      shifted: false,
      shiftYPx: 0,
      detectedBaselineYPx: null,
      targetBaselineYPx: null,
    };
  }

  const img = await loadImage(imageUrl);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Unable to acquire 2d canvas context");
  ctx.drawImage(img, 0, 0);

  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const capState = resolveCapState(options);
  const detectedBaseline = detectStrongBottomY(imageData.data, width, height, bg, capState);
  const targetBaseline = Math.round(height * (1 - rig.baselinePct / 100));

  if (detectedBaseline === null) {
    return {
      dataUrl: canvas.toDataURL("image/png"),
      shifted: false,
      shiftYPx: 0,
      detectedBaselineYPx: null,
      targetBaselineYPx: targetBaseline,
    };
  }

  const maxShift = Math.round(height * 0.08);
  const noOpTolerance = 8;
  let shiftY = Math.max(-maxShift, Math.min(maxShift, targetBaseline - detectedBaseline));
  const strongBounds = detectStrongBounds(imageData.data, width, height, bg);
  if (strongBounds) {
    shiftY = Math.max(shiftY, 12 - strongBounds.top);
    shiftY = Math.min(shiftY, height - 12 - strongBounds.bottom);
  }

  if (Math.abs(shiftY) <= noOpTolerance) {
    return {
      dataUrl: canvas.toDataURL("image/png"),
      shifted: false,
      shiftYPx: 0,
      detectedBaselineYPx: detectedBaseline,
      targetBaselineYPx: targetBaseline,
    };
  }

  const out = document.createElement("canvas");
  out.width = width;
  out.height = height;
  const outCtx = out.getContext("2d");
  if (!outCtx) throw new Error("Unable to acquire 2d canvas context");
  outCtx.fillStyle = options.targetBackgroundHex ?? "#EEE6D4";
  outCtx.fillRect(0, 0, width, height);
  outCtx.drawImage(canvas, 0, shiftY);

  return {
    dataUrl: out.toDataURL("image/png"),
    shifted: true,
    shiftYPx: shiftY,
    detectedBaselineYPx: detectedBaseline,
    targetBaselineYPx: targetBaseline,
  };
}
