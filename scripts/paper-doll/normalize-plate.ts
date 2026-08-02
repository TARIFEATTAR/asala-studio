#!/usr/bin/env tsx
/**
 * Paper-Doll Rig — plate registration/normalization.
 *
 * Takes a raw born-on-Bone generation and produces the contract-true plate:
 *   1. Gray-card gain: plate background pulled to EXACT Bone #F5F3EF
 *      (fixes the two-tone-canvas defect: a warm generated background pasted
 *      onto exact Bone reads as a discolored inner box — found 2026-08-01).
 *   2. Deterministic rescale to the scale-arch frame (default: body 58.5% of
 *      canvas height, baseline y=2082, centered — the 9ml catalog scale).
 *   3. Bottle-safe feathered composite onto fresh Bone: edges of the pasted
 *      region ramp to transparent over a span capped by the distance to the
 *      bottle, so residual background gradients blend invisibly and the
 *      bottle pixels are never touched by the feather.
 *   4. Verification: fill/baseline/centerline, border Δ vs Bone ≈ 0, and a
 *      seam probe across the paste boundary.
 *
 * Usage:
 *   npm run paperdoll:normalize-plate -- --in <raw.png> --out <plate.png> \
 *     [--body-height-mm 70] [--fill 0.585] [--baseline-frac 0.91]
 */
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

import { PAPER_DOLL_CANVAS_RGB } from "../../src/lib/paperDoll/componentRegistry";
import {
  computeGrayCardGain,
  detectPlateForegroundBounds,
  measureBorderMeanRgb,
} from "../../src/lib/paperDoll/compositeEngine";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CANVAS_W = 2080;
const CANVAS_H = 2288;
const BONE = PAPER_DOLL_CANVAS_RGB;

function parseArgs(argv: string[]) {
  const get = (key: string, fallback: string | null = null) => {
    const i = argv.indexOf(`--${key}`);
    return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
  };
  return {
    input: get("in"),
    out: get("out"),
    fill: Number(get("fill", "0.585")),
    baselineFrac: Number(get("baseline-frac", "0.91")),
    // Shadowed plates MUST pass a strict threshold: the adaptive default sees a
    // soft contact shadow as part of the object, measures body = bottle+shadow,
    // and scales everything down to fit — shrinking every bottle ~13%.
    detectThreshold: get("detect-threshold", null),
    minRunFrac: get("min-run-frac", null),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input || !args.out) {
    console.error("Required: --in, --out");
    process.exit(1);
  }
  const inAbs = resolve(args.input);
  const baselineY = Math.round(args.baselineFrac * CANVAS_H);
  const centerX = CANVAS_W / 2;

  // ── 1. Gray-card to exact Bone.
  const rawIn = await sharp(inAbs).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const img = { data: rawIn.data, width: rawIn.info.width, height: rawIn.info.height, hasAlpha: false };
  const borderMean = measureBorderMeanRgb(img);
  const gain = computeGrayCardGain(borderMean);
  console.log(`── Plate registration`);
  console.log(`   border mean: ${borderMean.r.toFixed(1)},${borderMean.g.toFixed(1)},${borderMean.b.toFixed(1)} → gain r=${gain.r.toFixed(4)} g=${gain.g.toFixed(4)} b=${gain.b.toFixed(4)}`);
  const gained = await sharp(inAbs)
    .linear([gain.r, gain.g, gain.b], [0, 0, 0])
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // ── 2. Detect body on the gained plate, compute scale + placement.
  const gainedRgba = Buffer.alloc(gained.info.width * gained.info.height * 4);
  for (let i = 0; i < gained.info.width * gained.info.height; i++) {
    gainedRgba[i * 4] = gained.data[i * 3];
    gainedRgba[i * 4 + 1] = gained.data[i * 3 + 1];
    gainedRgba[i * 4 + 2] = gained.data[i * 3 + 2];
    gainedRgba[i * 4 + 3] = 255;
  }
  const bounds = detectPlateForegroundBounds(
    { data: gainedRgba, width: gained.info.width, height: gained.info.height, hasAlpha: false },
    args.detectThreshold ? Number(args.detectThreshold) : undefined,
    args.minRunFrac ? { minRunFraction: Number(args.minRunFrac) } : {},
  );
  if (!bounds) throw new Error("no foreground detected");
  const bodyH = bounds.bottom - bounds.top + 1;
  const scale = (args.fill * CANVAS_H) / bodyH;
  const scaledW = Math.round(gained.info.width * scale);
  const scaledH = Math.round(gained.info.height * scale);
  const left = Math.round(centerX - ((bounds.left + bounds.right) / 2) * scale);
  const top = Math.round(baselineY - bounds.bottom * scale);
  console.log(`   body ${bounds.right - bounds.left + 1}×${bodyH} (${(bodyH / CANVAS_H * 100).toFixed(1)}%) → scale ${scale.toFixed(4)}`);

  // ── 3. Feathered RGBA of the scaled plate — feather spans capped so the
  //      ramp never crosses the (scaled) bottle bounds.
  const scaledRgb = await sharp(Buffer.from(gained.data), {
    raw: { width: gained.info.width, height: gained.info.height, channels: 3 },
  }).resize(scaledW, scaledH).raw().toBuffer({ resolveWithObject: true });

  const margin = 40;
  const span = {
    left: Math.max(8, Math.min(160, Math.round(bounds.left * scale) - margin)),
    right: Math.max(8, Math.min(160, scaledW - Math.round(bounds.right * scale) - margin)),
    top: Math.max(8, Math.min(160, Math.round(bounds.top * scale) - margin)),
    bottom: Math.max(8, Math.min(160, scaledH - Math.round(bounds.bottom * scale) - margin)),
  };
  const rgba = Buffer.alloc(scaledW * scaledH * 4);
  for (let y = 0; y < scaledH; y++) {
    for (let x = 0; x < scaledW; x++) {
      const si = (y * scaledW + x) * 3;
      const di = (y * scaledW + x) * 4;
      rgba[di] = scaledRgb.data[si];
      rgba[di + 1] = scaledRgb.data[si + 1];
      rgba[di + 2] = scaledRgb.data[si + 2];
      const aL = Math.min(1, x / span.left);
      const aR = Math.min(1, (scaledW - 1 - x) / span.right);
      const aT = Math.min(1, y / span.top);
      const aB = Math.min(1, (scaledH - 1 - y) / span.bottom);
      rgba[di + 3] = Math.round(255 * Math.min(aL, aR, aT, aB));
    }
  }

  // The scaled plate can exceed the canvas (any source needing >1x upscale with
  // tight framing — swirl hit this at 1.07x). sharp refuses to composite an
  // input larger than its target, so crop to the visible region and shift the
  // offset to match.
  const cropLeft = Math.max(0, -left);
  const cropTop = Math.max(0, -top);
  const cropWidth = Math.min(scaledW - cropLeft, CANVAS_W - Math.max(0, left));
  const cropHeight = Math.min(scaledH - cropTop, CANVAS_H - Math.max(0, top));
  if (cropWidth <= 0 || cropHeight <= 0) {
    throw new Error("Scaled plate lands entirely outside the canvas — check fill/baseline.");
  }
  const placed = await sharp(rgba, { raw: { width: scaledW, height: scaledH, channels: 4 } })
    .extract({ left: cropLeft, top: cropTop, width: cropWidth, height: cropHeight })
    .png()
    .toBuffer();

  const outAbs = resolve(args.out);
  mkdirSync(dirname(outAbs), { recursive: true });
  await sharp({ create: { width: CANVAS_W, height: CANVAS_H, channels: 3, background: BONE } })
    .composite([{ input: placed, left: Math.max(0, left), top: Math.max(0, top) }])
    .png()
    .toFile(outAbs);

  // ── 4. Verify: geometry + border + seam probe across the paste boundary.
  const check = await sharp(outAbs).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const checkImg = { data: check.data, width: check.info.width, height: check.info.height, hasAlpha: false };
  const b2 = detectPlateForegroundBounds(checkImg);
  const border2 = measureBorderMeanRgb(checkImg);
  const seamX = left + Math.round(scaledW / 2);
  const seamYIn = top + 4, seamYOut = top - 12;
  const px = (x: number, y: number) => {
    const i = (y * CANVAS_W + x) * 4;
    return (check.data[i] + check.data[i + 1] + check.data[i + 2]) / 3;
  };
  const seamDelta = seamYOut >= 0 ? Math.abs(px(seamX, seamYIn) - px(seamX, seamYOut)) : 0;
  console.log(`   normalized body: ${(b2!.bottom - b2!.top + 1)}px = ${((b2!.bottom - b2!.top + 1) / CANVAS_H * 100).toFixed(1)}% · baseline ${b2!.bottom} · center ${Math.round((b2!.left + b2!.right) / 2)}`);
  console.log(`   border Δ vs Bone: ${(Math.abs(border2.r - BONE.r) + Math.abs(border2.g - BONE.g) + Math.abs(border2.b - BONE.b)) / 3 < 1 ? "✅" : "⚠"} ${border2.r.toFixed(1)},${border2.g.toFixed(1)},${border2.b.toFixed(1)}`);
  console.log(`   seam probe (top boundary): Δ ${seamDelta.toFixed(2)} ${seamDelta < 1.5 ? "✅ invisible" : "❌ visible"}`);
  console.log(`   → ${outAbs}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
