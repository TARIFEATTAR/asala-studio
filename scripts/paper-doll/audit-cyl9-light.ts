/**
 * CYL-9ML light audit — measures lighting consistency across all 26 released
 * layers (release 1.3.4). Read-only.
 *
 * Per layer, inside its own alpha (the authority silhouette), over the diffuse
 * band (specular top 4% and deepest 8% excluded):
 *   - temperature proxy: mean R / mean B (>1 warm, <1 cool)
 *   - green balance: mean G / mean(R,B)
 *   - key: median luminance (P50) and highlight P95
 *   - contrast: P95 - P05
 *   - direction proxy: mean luminance of left vs right third of the silhouette
 * The five body plates define the family target; deltas are reported vs that.
 */
import { readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";

const EXPORT_ROOT = "outputs/paper-doll-release-export/1.3.4-bare-pumps.2";

type Stat = {
  slot: string;
  variantKey: string;
  temp: number;
  green: number;
  p05: number;
  p50: number;
  p95: number;
  contrast: number;
  dirDelta: number;
  meanRGB: [number, number, number];
};

async function main() {
  const manifest = JSON.parse(await readFile(resolve(EXPORT_ROOT, "manifest.json"), "utf8"));
  const stats: Stat[] = [];
  for (const asset of manifest.assets) {
    const path = resolve(EXPORT_ROOT, asset.imagePath);
    const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const lums: number[] = [];
    const px: Array<[number, number, number, number]> = []; // r,g,b,x
    for (let y = 0; y < info.height; y++) {
      for (let x = 0; x < info.width; x++) {
        const i = (y * info.width + x) * 4;
        if (data[i + 3] < 250) continue;
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        lums.push(l);
        px.push([r, g, b, x]);
      }
    }
    if (lums.length < 1000) continue;
    const sorted = [...lums].sort((a, b) => a - b);
    const q = (f: number) => sorted[Math.min(sorted.length - 1, Math.floor(f * sorted.length))];
    const p05 = q(0.05), p50 = q(0.5), p95 = q(0.95);
    const lo = q(0.08), hi = q(0.96);
    // diffuse band accumulators + horizontal split
    let sr = 0, sg = 0, sb = 0, n = 0;
    let minX = Infinity, maxX = -Infinity;
    for (const [r, , , x] of px) { if (x < minX) minX = x; if (x > maxX) maxX = x; void r; }
    const third = (maxX - minX) / 3;
    let sl = 0, nl = 0, srr = 0, nr = 0;
    for (const [r, g, b, x] of px) {
      const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      if (l < lo || l > hi) continue;
      sr += r; sg += g; sb += b; n++;
      if (x <= minX + third) { sl += l; nl++; }
      else if (x >= maxX - third) { srr += l; nr++; }
    }
    if (!n || !nl || !nr) continue;
    stats.push({
      slot: asset.slot,
      variantKey: asset.variantKey,
      temp: +(sr / n / (sb / n)).toFixed(3),
      green: +((sg / n) / ((sr / n + sb / n) / 2)).toFixed(3),
      p05: Math.round(p05),
      p50: Math.round(p50),
      p95: Math.round(p95),
      contrast: Math.round(p95 - p05),
      dirDelta: +((sl / nl) - (srr / nr)).toFixed(1),
      meanRGB: [Math.round(sr / n), Math.round(sg / n), Math.round(sb / n)],
    });
  }

  const bodies = stats.filter((s) => s.slot === "body");
  const target = {
    temp: +(bodies.reduce((a, s) => a + s.temp, 0) / bodies.length).toFixed(3),
    p50: Math.round(bodies.reduce((a, s) => a + s.p50, 0) / bodies.length),
    dirDelta: +(bodies.reduce((a, s) => a + s.dirDelta, 0) / bodies.length).toFixed(1),
  };
  console.log(`BODY ANCHOR: temp ${target.temp}  keyP50 ${target.p50}  dirΔ(L−R) ${target.dirDelta}\n`);
  console.log("slot     variant  temp   Δtemp   green  P05  P50  P95  contrast  dirΔ(L−R)");
  for (const s of stats.sort((a, b) => (a.slot + a.variantKey).localeCompare(b.slot + b.variantKey))) {
    const dTemp = +(s.temp - target.temp).toFixed(3);
    console.log(
      `${s.slot.padEnd(8)} ${s.variantKey.padEnd(8)} ${s.temp.toFixed(3)}  ${String(dTemp >= 0 ? "+" + dTemp.toFixed(3) : dTemp.toFixed(3)).padStart(6)}  ${s.green.toFixed(3)}  ${String(s.p05).padStart(3)}  ${String(s.p50).padStart(3)}  ${String(s.p95).padStart(3)}  ${String(s.contrast).padStart(8)}  ${String(s.dirDelta).padStart(8)}`,
    );
  }
  await writeFile("outputs/paper-doll-light-audit/audit.json", JSON.stringify({ target, stats }, null, 2));
  console.log("\nwritten: outputs/paper-doll-light-audit/audit.json");
}

main().catch((e) => { console.error(e); process.exit(1); });
