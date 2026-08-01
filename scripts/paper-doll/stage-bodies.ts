#!/usr/bin/env tsx
/**
 * Paper-Doll Rig — stage body cutouts onto the canonical 2080×2288 canvas.
 *
 * Produces REGISTERED GENERATION INPUTS (not plates): each body cutout is
 * scaled to the rig fill target and seated on the canonical baseline/
 * centerline, so plate-birth generation receives the exact target framing
 * and every color lands identically (swatch-lock starts at the input stage).
 *
 * Background rule (plate-birth doctrine):
 *   - clear glass → WHITE  (dead cutout interior disappears against white,
 *     freeing Pass 1 to re-invent real optics)
 *   - amber/cobalt/frosted/swirl → BONE #F5F3EF (interiors barely show;
 *     near-ready inputs for material work)
 * Color is inferred from the websiteSku (Amb/Blu/Frst/Swrl → Bone; else white)
 * and can be forced with --background white|bone.
 *
 * Usage:
 *   npm run paperdoll:stage-bodies -- \
 *     --src outputs/paper-doll-bodies [--out outputs/paper-doll-bodies-staged] \
 *     [--fill 0.72] [--baseline 0.9] [--background auto|white|bone]
 */
import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CANVAS_W = 2080;
const CANVAS_H = 2288;
const BONE = { r: 0xf5, g: 0xf3, b: 0xef };
const WHITE = { r: 255, g: 255, b: 255 };

function parseArgs(argv: string[]) {
  const get = (key: string, fallback: string) => {
    const i = argv.indexOf(`--${key}`);
    return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
  };
  return {
    src: resolve(REPO_ROOT, get("src", "outputs/paper-doll-bodies")),
    out: resolve(REPO_ROOT, get("out", "outputs/paper-doll-bodies-staged")),
    fill: Number(get("fill", "0.72")),
    baseline: Number(get("baseline", "0.9")),
    background: get("background", "auto") as "auto" | "white" | "bone",
  };
}

function inferBackground(fileName: string): "white" | "bone" {
  return /Amb|Blu|Frst|Swrl/i.test(fileName) ? "bone" : "white";
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  mkdirSync(args.out, { recursive: true });
  const files = readdirSync(args.src).filter((f) => f.endsWith(".png"));
  const targetBodyH = Math.round(args.fill * CANVAS_H);
  const baselineY = Math.round(args.baseline * CANVAS_H);
  const rows = ["file,background,scaledWidthPx,scaledHeightPx,leftPx,topPx"];
  let done = 0;

  for (const file of files) {
    const srcPath = join(args.src, file);
    const background = args.background === "auto" ? inferBackground(file) : args.background;
    const bg = background === "bone" ? BONE : WHITE;

    // Trim the cutout to its alpha bounds, then scale to the fill target.
    const trimmed = await sharp(srcPath).trim().toBuffer({ resolveWithObject: true });
    const scale = targetBodyH / trimmed.info.height;
    const scaledW = Math.max(1, Math.round(trimmed.info.width * scale));
    const scaledH = targetBodyH;
    const scaled = await sharp(trimmed.data).resize(scaledW, scaledH).png().toBuffer();

    const left = Math.round(CANVAS_W / 2 - scaledW / 2);
    const top = baselineY - scaledH;
    const outName = file.replace(/__body__/, `__staged-${background}__`);
    await sharp({
      create: { width: CANVAS_W, height: CANVAS_H, channels: 3, background: bg },
    })
      .composite([{ input: scaled, left, top }])
      .png()
      .toFile(join(args.out, outName));
    rows.push([outName, background, scaledW, scaledH, left, top].join(","));
    done++;
    if (done % 25 === 0) console.log(`  …${done}/${files.length}`);
  }

  writeFileSync(join(args.out, "staging-manifest.csv"), `${rows.join("\n")}\n`);
  console.log(`\n══ ${done} bodies staged at ${CANVAS_W}×${CANVAS_H} → ${args.out}`);
  console.log(`   fill=${args.fill} baselineY=${baselineY} centerlineX=${CANVAS_W / 2}`);
  console.log(`   registered inputs ONLY — intake remains the gate to platehood.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
