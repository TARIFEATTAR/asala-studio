/** Body silhouette by color distance vs the Bone background. */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";

const EXPORT_ROOT = "outputs/paper-doll-release-export/1.3.9-cap-lift.2";
const BONE = { r: 245, g: 243, b: 239 };
const CAP_SOLID_SEAT = 996;

async function main() {
  const manifest = JSON.parse(await readFile(resolve(EXPORT_ROOT, "manifest.json"), "utf8"));
  console.log("body   topY  neckW  flareStartY  shoulderDoneY  fullW  capSeatVsShoulderDone");
  for (const key of ["AMB", "BLU", "CLR", "FRS", "SWL"]) {
    const asset = manifest.assets.find((a: any) => a.slot === "body" && a.variantKey === key);
    const { data, info } = await sharp(resolve(EXPORT_ROOT, asset.imagePath)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const isContent = (x: number, y: number) => {
      const i = (y * info.width + x) * 4;
      return Math.abs(data[i] - BONE.r) + Math.abs(data[i + 1] - BONE.g) + Math.abs(data[i + 2] - BONE.b) > 36;
    };
    const widthAt = (y: number) => {
      let minX = -1, maxX = -1;
      for (let x = 700; x < 1400; x++) {
        if (isContent(x, y)) { if (minX < 0) minX = x; maxX = x; }
      }
      return minX < 0 ? 0 : maxX - minX + 1;
    };
    const topY = asset.alphaBounds.top;
    const neckSamples: number[] = [];
    for (let y = topY + 60; y <= topY + 110; y++) neckSamples.push(widthAt(y));
    const neckW = neckSamples.sort((a, b) => a - b)[Math.floor(neckSamples.length / 2)];
    // full body width from the straight wall (y 1300..1500)
    const wallSamples: number[] = [];
    for (let y = 1300; y <= 1500; y += 10) wallSamples.push(widthAt(y));
    const fullW = wallSamples.sort((a, b) => a - b)[Math.floor(wallSamples.length / 2)];
    let flareStartY = 0, shoulderDoneY = 0;
    for (let y = topY + 60; y <= 1200; y++) {
      const w = widthAt(y);
      if (!flareStartY && w > neckW + 6) flareStartY = y;
      if (!shoulderDoneY && w >= fullW - 4) { shoulderDoneY = y; break; }
    }
    console.log(`${key.padEnd(6)} ${String(topY).padStart(4)}  ${String(neckW).padStart(5)}  ${String(flareStartY).padStart(11)}  ${String(shoulderDoneY).padStart(13)}  ${String(fullW).padStart(5)}  ${String(CAP_SOLID_SEAT - shoulderDoneY).padStart(10)}px below`);
  }
  console.log(`\ncap solid seat: ${CAP_SOLID_SEAT} (after two 2px lifts; original 1000)`);
}
main().catch((e) => { console.error(e); process.exit(1); });
