// hf-frame-test.mjs — Higgsfield prompt-framing alignment test (4 sizes).
// Downloads the 4 Nano renders, pads each to the EXACT 2080x2288 bone canvas
// (geometry-only: scale to height, center, bone side margins — NO color shift),
// then MEASURES product fill-height %, baseline %, centerline % against each
// SKU's real rig target and prints pass/fail. Writes padded PNGs + a report.
//
//   cd ".../Madison Studio/madison-app" && node hf-frame-test.mjs
//
// Needs sharp (already a madison-app dep; else: npm i sharp)
import { mkdirSync, writeFileSync } from "node:fs";

let sharp;
try { sharp = (await import("sharp")).default; }
catch { console.error("Missing sharp — run: npm i sharp"); process.exit(1); }

const CANVAS_W = 2080, CANVAS_H = 2288;
const BONE = { r: 245, g: 243, b: 239 };            // #F5F3EF
const OUT = "tmp/bestbottles-generation/hf-frame-test";
mkdirSync(OUT, { recursive: true });

const CDN = "https://d8j0ntlcm91z4.cloudfront.net/user_38uS8RFOrQvYLf5nxOwGbhGKNAb";
const JOBS = [
  { sku: "GB-CYL-CLR-5ML-SPR-SBLK",  cap: "5ml",  fill: 62, range: [60, 64],
    url: `${CDN}/hf_20260710_021252_a95df3a1-46cd-4b53-9434-506ba664a000.png` },
  { sku: "GB-CYL-CLR-9ML-T-03",      cap: "9ml",  fill: 67, range: [65, 70],
    url: `${CDN}/hf_20260710_021311_bb60b23c-6072-445b-940f-49139abf15ba.png` },
  { sku: "GB-CYL-CLR-50ML-RDC-SBLK", cap: "50ml", fill: 80, range: [80, 84],
    url: `${CDN}/hf_20260710_021326_1d52f0d7-1df5-45b7-87bc-c0df64f905fb.png` },
  { sku: "LB-CYL-CLR-100ML-LPM-SSLV",cap: "100ml",fill: 82, range: [80, 84],
    url: `${CDN}/hf_20260710_021341_353e2977-0233-4152-b1ab-1610c52283be.png` },
];

const BASELINE_RANGE = [8, 10];      // % up from bottom
const CENTER_TOL = 6;                // ±% from 50
const MASK_DELTA = 20;               // pixel differs from bg by > this = product

async function fetchPng(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
  return Buffer.from(await r.arrayBuffer());
}

async function padToCanvas(buf) {
  // scale to exactly CANVAS_H tall (renders are 1856x2304 ≈ same aspect), then
  // center on a bone CANVAS_W x CANVAS_H canvas. Pure geometry, zero color ops.
  const img = sharp(buf);
  const meta = await img.metadata();
  const scale = CANVAS_H / meta.height;
  const newW = Math.round(meta.width * scale);
  const resized = await img.resize({ height: CANVAS_H, width: newW }).png().toBuffer();
  const left = Math.round((CANVAS_W - newW) / 2);
  return sharp({
    create: { width: CANVAS_W, height: CANVAS_H, channels: 3,
              background: BONE } })
    .composite([{ input: resized, left: Math.max(0, left), top: 0 }])
    .png().toBuffer();
}

async function measure(buf) {
  const W = 320;
  const { data, info } = await sharp(buf).resize({ width: W }).removeAlpha()
    .raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height, ch = info.channels;
  const px = (x, y) => { const i = (y * w + x) * ch; return { r: data[i], g: data[i+1], b: data[i+2] }; };
  const dist = (a, b) => Math.sqrt((a.r-b.r)**2 + (a.g-b.g)**2 + (a.b-b.b)**2);
  // bg = median of top band
  const vals = [];
  for (let y = 0; y < Math.max(2, Math.floor(h*0.05)); y++)
    for (let x = 0; x < w; x += 2) vals.push(px(x, y));
  const med = (k) => vals.map(v => v[k]).sort((a,b)=>a-b)[vals.length>>1];
  const bg = { r: med("r"), g: med("g"), b: med("b") };
  let top = h, bot = -1, left = w, right = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    // ignore soft shadow: require BOTH luma + chroma distance
    const p = px(x, y);
    if (dist(p, bg) > MASK_DELTA) { if (y<top)top=y; if (y>bot)bot=y; if (x<left)left=x; if (x>right)right=x; }
  }
  if (bot < 0) return null;
  return {
    bgHex: "#" + [bg.r,bg.g,bg.b].map(v=>v.toString(16).padStart(2,"0")).join(""),
    fillPct: ((bot - top) / h) * 100,
    baselinePct: ((h - 1 - bot) / h) * 100,
    centerPct: (((left + right) / 2) / w) * 100,
  };
}

const report = [];
for (const j of JOBS) {
  try {
    const url = j.url && !j.url.includes("TBD") ? j.url : null;
    if (!url) { console.log(`~ ${j.sku}: paste final URL for job ${j.id} into JOBS and re-run`); continue; }
    const raw = await fetchPng(url);
    const padded = await padToCanvas(raw);
    const out = `${OUT}/${j.sku}__hf-padded.png`;
    writeFileSync(out, padded);
    const m = await measure(padded);
    const fillOk = m.fillPct >= j.range[0] - 4 && m.fillPct <= j.range[1] + 4; // user's 3-4% rule
    const strictFill = m.fillPct >= j.range[0] && m.fillPct <= j.range[1];
    const baseOk = m.baselinePct >= BASELINE_RANGE[0] - 4 && m.baselinePct <= BASELINE_RANGE[1] + 4;
    const strictBase = m.baselinePct >= BASELINE_RANGE[0] && m.baselinePct <= BASELINE_RANGE[1];
    const cenOk  = Math.abs(m.centerPct - 50) <= CENTER_TOL;
    const verdict = (strictFill && strictBase && cenOk) ? "PASS"
                  : (fillOk && baseOk && cenOk) ? "PASS (within 3-4% tolerance)"
                  : "MISS";
    console.log(`${j.sku.padEnd(28)} [${j.cap.padStart(5)}]  fill ${m.fillPct.toFixed(1)}% (target ${j.fill}, ${j.range[0]}-${j.range[1]})  baseline ${m.baselinePct.toFixed(1)}% (8-10)  center ${m.centerPct.toFixed(1)}%  bg ${m.bgHex}   → ${verdict}`);
    report.push({ ...j, ...m, verdict, padded: out });
  } catch (e) {
    console.log(`✗ ${j.sku}: ${e.message}`);
    report.push({ ...j, error: e.message });
  }
}
writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
console.log(`\nPadded PNGs + report.json → ${OUT}`);
console.log(`Verdict guide: all PASS → prompt+pad replaces the rig for the Higgsfield lane.`);
console.log(`MISSes on fill/baseline → keep the rig's geometry-only pass (safe, no color).`);
