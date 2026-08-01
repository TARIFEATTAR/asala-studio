#!/usr/bin/env tsx
/**
 * Paper-Doll Rig — closure material rebirth via Gemini (Nano Banana).
 *
 * Regenerates harvested PSD closures at master resolution under the SAME light
 * contract as the locked body plates, by attaching two references:
 *   Image 1 — the harvested part (geometry + camera authority)
 *   Image 2 — a crop of the locked clear plate (light + material authority)
 * Reference images are pushed BEFORE the text prompt, which is what makes the
 * model treat them as things to preserve rather than things to reinterpret.
 *
 * MATERIAL DOCTRINE (learned the hard way, 2026-08-01): the roll-on over-caps
 * are moulded phenolic plastic with a metallized chrome finish. They are NOT
 * aluminium. Saying "aluminium"/"anodised"/"brushed"/"machined" reliably yields
 * a milled aluminium part with a visible grain — wrong material, wrong product.
 * Only the roller BALL is ever steel. Name the finish, never a metal.
 *
 * Usage:
 *   npm run paperdoll:regen-closures -- --only CpRoll17-415ShnSl
 *   npm run paperdoll:regen-closures -- --all [--size 2K]
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SRC = resolve(REPO, "outputs/paper-doll-plates/cap-regen-sources");
const OUT = resolve(SRC, "reborn");
const LIGHT_REF = resolve(SRC, "_LIGHTING-REFERENCE-clear-plate.png");
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

const MODEL_CHAIN = [
  "gemini-3-pro-image-preview",
  "gemini-3.1-flash-image-preview",
  "gemini-2.5-flash-image",
];

function loadKey(): string {
  for (const f of [".env.local", ".env"]) {
    const p = resolve(REPO, f);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split("\n")) {
      const m = line.match(/^\s*(GEMINI_API_KEY|GOOGLE_AI_API_KEY)\s*=\s*(.+)$/);
      if (m) return m[2].trim().replace(/^["']|["']$/g, "");
    }
  }
  throw new Error("No GEMINI_API_KEY in .env.local or .env");
}

// ─── Material blocks ─────────────────────────────────────────────────

const PREAMBLE_HEAD = `Re-photograph this closure as a real studio product photograph, matching the lighting and material quality of the second reference image.`;

const CHROME_PLASTIC = `WHAT THIS PART IS MADE OF — this matters more than anything else in this prompt:
This is a moulded phenolic plastic closure with a bright metallized CHROME MIRROR finish. It is NOT aluminium, NOT machined metal, NOT anodised, NOT brushed steel. It is plastic that has been vacuum-metallized to a true mirror, so there is no grain, no machining marks and no directional texture anywhere on it.

THIS IS A MIRROR, NOT A SHINY METAL — this distinction is the whole job:
- A shiny metal shows ONE smooth gradient easing gently around the curve, bright on one side and dark on the other. That is WRONG and is what keeps being produced.
- A mirror instead shows the ROOM REFLECTED IN IT, as distinct vertical bands with CRISP, SHARP boundaries. Where the reflection changes it changes abruptly, like an edge — never a soft blend.
- Reading across the cylinder there are separate, sharply divided vertical zones: a deep warm-grey band reflecting the dark side of the room, a brilliant near-white band reflecting the softbox, a warm cream zone reflecting the background, and another crisp dark band where the surface turns away. Hard edges between them.
- The reflection is sharp enough that you could almost make out shapes in it. Mirror-crisp, liquid, wet-looking.

TONE LIMITS — the one thing to hold back:
Nothing in this warm cream room is pure black and nothing is paper white, so the reflection never reaches either. The darkest band stays a deep warm grey; the brightest stays just short of white. Keep the bands sharp-edged but never let them clip.`;

const MATTE_PLASTIC = `WHAT THIS PART IS MADE OF — this matters more than anything else in this prompt:
This is a moulded phenolic plastic closure with a smooth low-gloss coloured coating. It is NOT aluminium, NOT machined metal, NOT anodised. There is no brushed grain, no machining marks, and no directional metal texture anywhere on it.

HOW THIS FINISH ACTUALLY READS — build the material this way:
- One broad, soft, diffuse sheen down the lit side rather than a mirror reflection, easing gently into mid-tones and a soft darker turn on the far side.
- The surface is perfectly smooth and even — soft and powdery in its light response, never grainy, textured, speckled or brushed.
- Nothing crushes to solid black; nothing blows to paper white. The full range of mid-tones stays visible.
- Crisply moulded top rim with one clean, gentle highlight along the edge.`;

const TRANSLUCENT = `WHAT THIS PART IS MADE OF:
This is a translucent frosted polypropylene over-cap — a moulded plastic hood.

HOW THIS PLASTIC ACTUALLY READS — build the material this way:
- Translucent frosted polypropylene: milky and light-diffusing, so the form is read through soft internal glow rather than surface reflection.
- The wall reads slightly denser where the cylinder turns away at each side, and is at its most transparent through the middle.
- A soft broad sheen on the lit side — diffuse and wide, never a hard mirror highlight. One gentle bright edge along the top dome where it catches the key.
- Clean crisp silhouette. The frosting is smooth and even, never grainy, chalky or speckled.`;

const ROLLER = `WHAT THIS PART IS:
A roller-ball fitment — a ball seated in a clear moulded plastic housing with a flanged collar at the base.
- The housing is clear, precise, injection-moulded plastic: crisp edges, clean internal structure, gently visible wall thickness.
- The collar flange at the base stays sharply defined.
- Show the fitment alone — no bottle, no neck, no glass beneath it.`;

const PREAMBLE_TAIL = `CAMERA — read this carefully, it is failing repeatedly:
The camera is DEAD LEVEL with the middle of the closure. This is a straight-on elevation view. The camera is not raised and does not look down at the part.
- Because the camera is level, the top face is almost edge-on. You see only a very shallow curved sliver of it — its depth is about 6% of the closure's width. It reads as a thin arc, not a surface.
- Do NOT show the top as a round disc, an oval, or any wide ellipse. A visible top face means the camera was raised, and that is wrong.
- The bottom edge is likewise a shallow arc, not a deep curve.
- Match the first reference image's viewing angle exactly. These parts composite onto bottles photographed at eye level; any downward tilt makes them unusable.

LIGHTING: one large soft key from the RIGHT, gentle fill from the left. Clean speculars — soft-edged but genuinely bright. Match the second reference image exactly: the same soft key direction, the same restraint, the same warmth.

MATERIAL AND MOOD: premium apothecary product photography — polished luxury. Warm, precise, expensive, composed. Refined, never gaudy: no dramatic contrast, no blown hotspots, no coloured reflections, no rainbow dispersion, no plastic CGI sheen.

BACKGROUND: seamless warm cream (#F5F3EF), no horizon line, no props, no text, no cast shadow, nothing beneath the closure.

KEEP EXACTLY AS SHOWN IN THE FIRST IMAGE: the closure's silhouette, proportions, height-to-width ratio, the level camera angle, and the shallow 6% top arc. Show the closure alone — no bottle, no neck, no glass. This is the correct part; only the material rendering and resolution change.`;

interface Part { file: string; body: string; finish: string; aspect: string }

const RHINESTONE = `Set with small clear crystal rhinestones in the same pattern and positions as the first image — each stone crisp and faceted, catching one small bright glint.`;

const PARTS: Part[] = [
  // ── roll-on over-caps (chrome/matte plastic — NEVER aluminium)
  { file: "CpRoll17-415ShnSl",  body: CHROME_PLASTIC, aspect: "2:3", finish: "FINISH: bright chrome-silver — a cool neutral mirror finish, glassy and liquid-smooth." },
  { file: "CpRoll17-415ShnGl",  body: CHROME_PLASTIC, aspect: "2:3", finish: "FINISH: bright chrome-gold — a warm yellow-gold mirror finish, luminous and rich, never brassy or orange." },
  { file: "CpRoll17-415Cu",     body: CHROME_PLASTIC, aspect: "2:3", finish: "FINISH: bright chrome-copper — a warm rose-copper mirror finish, rich and luminous." },
  { file: "CpRoll17-415ShnBlk", body: CHROME_PLASTIC, aspect: "2:3", finish: "FINISH: glossy black — deep neutral black with a wet, liquid, high-gloss surface and a clean bright highlight along the top rim; the body stays readable, never a flat silhouette." },
  { file: "CpRoll17-415MattSl", body: MATTE_PLASTIC,  aspect: "2:3", finish: "FINISH: soft matte silver — a smooth low-gloss silver coating, cool and neutral." },
  { file: "CpRoll17-415MattGl", body: MATTE_PLASTIC,  aspect: "2:3", finish: "FINISH: soft matte gold — a smooth low-gloss warm gold coating." },
  { file: "CpRoll17-415White",  body: MATTE_PLASTIC,  aspect: "2:3", finish: "FINISH: smooth glossy white — clean neutral white with soft even shading that keeps the cylinder's roundness clearly readable." },
  { file: "CpRoll17-415SlDot",  body: CHROME_PLASTIC, aspect: "2:3", finish: `FINISH: bright chrome-silver mirror. ${RHINESTONE}` },
  { file: "CpRoll17-415BlkDot", body: CHROME_PLASTIC, aspect: "2:3", finish: `FINISH: glossy black. ${RHINESTONE}` },
  { file: "CpRoll17-415PnkDot", body: MATTE_PLASTIC,  aspect: "2:3", finish: `FINISH: soft matte pink. ${RHINESTONE}` },

  // ── translucent over-caps
  { file: "OverCap17-415-Spray-Translucent",  body: TRANSLUCENT, aspect: "4:5", finish: "" },
  { file: "OverCap17-415-Lotion-Translucent", body: TRANSLUCENT, aspect: "2:3", finish: "Keep the small circular moulding detail on the face exactly where the first image places it." },

  // ── roller balls (the ONLY steel in the family)
  { file: "RollerBall17-415-Metal",   body: ROLLER, aspect: "1:1", finish: "THE BALL: polished stainless steel — a real metal sphere with a bright compact specular highlight and a soft dark turn away from the key. Cool neutral steel, unmistakably metal." },
  { file: "RollerBall17-415-Plastic", body: ROLLER, aspect: "1:1", finish: "THE BALL: frosted white polypropylene — a soft matte dome that diffuses light evenly, with no mirror highlight. Unmistakably plastic, not metal." },

  // ── sprayers & lotion pumps (metal-look sleeve + white pump head)
  ...(["Blk:glossy black","Gl:bright chrome-gold","MattSl:soft matte silver","Red:glossy red","ShnSl:bright chrome-silver","Tur:glossy turquoise"] as const)
    .map((s) => { const [k, d] = s.split(":");
      return { file: `Spry17-415${k}`, body: CHROME_PLASTIC, aspect: "9:16",
        finish: `FINISH of the sleeve: ${d}.\nThe white pump head and its collar are smooth matte white moulded plastic — clean, even, and slightly soft in the shading. Keep the two materials clearly distinct.` }; }),
  ...(["Blk:glossy black","Gl:bright chrome-gold","MattSl:soft matte silver"] as const)
    .map((s) => { const [k, d] = s.split(":");
      return { file: `Ltn17-415${k}`, body: CHROME_PLASTIC, aspect: "9:16",
        finish: `FINISH of the sleeve: ${d}.\nThe white pump head and its collar are smooth matte white moulded plastic — clean, even, and slightly soft in the shading. Keep the two materials clearly distinct.` }; }),
];

function buildPrompt(p: Part): string {
  return [PREAMBLE_HEAD, p.body, p.finish, PREAMBLE_TAIL].filter(Boolean).join("\n\n");
}

/**
 * Post-generation QA on the two properties that keep failing, so a bad roll is
 * caught by measurement rather than by eye.
 *
 *  topArcPct — depth of the visible top face as a % of part width. A level
 *    camera yields ~6% (measured on the source PSD and the frozen component).
 *    A raised camera turns the top into a disc and this climbs past 15%.
 *  range/clip — a chrome mirror should hold sharp bands WITHOUT clipping; the
 *    harvested originals clipped 0..255, which is what reads as pasted-on.
 */
async function inspect(file: string): Promise<string> {
  const r = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { data } = r, w = r.info.width, h = r.info.height;
  const lum = (i: number) => data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;

  // Two input shapes reach this gate: alpha cutouts (transparent corners) and
  // raw generations (opaque, GRADED background). Gemini's background is not flat
  // Bone — measured 15 luma darker at the top than the bottom on the first real
  // generation — so a fixed threshold reads the gradient as object and silently
  // measures the whole FRAME. A 2:3 frame then fakes a plausible cap aspect,
  // which is how a broken gate reports a clean pass.
  const cornerA = [[8, 8], [w - 9, 8], [8, h - 9], [w - 9, h - 9]]
    .map(([x, y]) => data[(y * w + x) * 4 + 3]);
  const alphaKeyed = cornerA.every((a) => a < 20);

  let span: (y: number) => { L: number; R: number; w: number } | null;
  if (alphaKeyed) {
    span = (y) => {
      let L = -1, R = -1;
      for (let x = 0; x < w; x++) if (data[(y * w + x) * 4 + 3] >= 24) { if (L < 0) L = x; R = x; }
      return L < 0 ? null : { L, R, w: R - L + 1 };
    };
  } else {
    const c = [[8, 8], [w - 9, 8], [8, h - 9], [w - 9, h - 9]].map(([x, y]) => lum((y * w + x) * 4));
    const bgMin = Math.min(...c);
    const cut = bgMin - Math.max(10, (Math.max(...c) - bgMin) * 1.5);
    span = (y) => {
      let L = -1, R = -1;
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (data[i + 3] < 20) continue;
        if (lum(i) < cut) { if (L < 0) L = x; R = x; }
      }
      return L < 0 ? null : { L, R, w: R - L + 1 };
    };
  }

  const minRun = Math.max(8, Math.round(h * 0.02));
  let top = -1, bot = -1;
  for (let y = 0; y < h - minRun; y++) {
    let ok = true;
    for (let k = 0; k < minRun; k++) if (!span(y + k)) { ok = false; break; }
    if (ok) { top = y; break; }
  }
  for (let y = h - 1; y >= minRun; y--) {
    let ok = true;
    for (let k = 0; k < minRun; k++) if (!span(y - k)) { ok = false; break; }
    if (ok) { bot = y; break; }
  }
  if (top < 0 || bot < 0) return "\u26a0 no object detected";
  const ht = bot - top + 1;
  if (!alphaKeyed && ht > h * 0.97) return "\u26a0 object fills frame \u2014 background not separable";

  // Anchor the top arc to BARREL width (25% down), not global max: these caps
  // flare slightly at the base, so "widest row" lands near the bottom and the
  // arc reads as >100% of width. Barrel width is past the top curve and above
  // any flare. Level camera measures ~6% on the source PSD.
  const barrel = span(top + Math.round(ht * 0.25))?.w ?? 0;
  if (barrel === 0) return "\u26a0 barrel width unmeasurable";
  let arc = 0;
  for (let y = top; y <= bot; y++) { const s = span(y); if (s && s.w >= barrel * 0.985) { arc = y - top; break; } }
  const arcPct = (arc / barrel) * 100;

  // Clipping as MASS, not percentile: a p99 ceiling fails our own approved
  // plates, whose speculars legitimately reach 253. Calibrated on real files —
  // approved plates 0.01-1.94%, clipped PSD caps 15.3%. 5% sits in the gap.
  let n = 0, clipped = 0;
  for (let y = top; y <= bot; y++) {
    const s = span(y); if (!s) continue;
    for (let x = s.L; x <= s.R; x++) {
      const i = (y * w + x) * 4;
      if (data[i + 3] < 20) continue;
      const l = lum(i); n++;
      if (l <= 2 || l >= 253) clipped++;
    }
  }
  const clipPct = n > 0 ? (clipped / n) * 100 : 0;
  const aspect = barrel / ht;

  return `${barrel}px \u00b7 aspect ${aspect.toFixed(3)} \u00b7 top-arc ${arcPct.toFixed(1)}% ` +
         `${arcPct <= 12 ? "\u2705" : "\u274c CAMERA RAISED"} \u00b7 clip ${clipPct.toFixed(1)}% ` +
         `${clipPct <= 5 ? "\u2705" : "\u274c clipping"}`;
}

async function generate(p: Part, key: string, size: string): Promise<string> {
  const partPath = resolve(SRC, `${p.file}.png`);
  if (!existsSync(partPath)) throw new Error(`missing source ${p.file}.png`);
  const parts = [
    { inlineData: { data: readFileSync(partPath).toString("base64"), mimeType: "image/png" } },
    { inlineData: { data: readFileSync(LIGHT_REF).toString("base64"), mimeType: "image/png" } },
    { text: buildPrompt(p) },
  ];
  const body = {
    contents: [{ role: "user", parts }],
    generationConfig: {
      responseModalities: ["IMAGE"],
      imageConfig: { aspectRatio: p.aspect, imageSize: size },
    },
  };
  // Report EVERY model's failure, not just the last — a chain that 429s at each
  // rung is a key/quota problem, while a 404 at rung 1 and success at rung 3 is
  // just a preview model not released to this key. Collapsing them to lastErr
  // hides that distinction and costs a diagnostic round-trip.
  const errs: string[] = [];
  for (const model of MODEL_CHAIN) {
    const res = await fetch(`${ENDPOINT}/${model}:generateContent?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      let msg = "";
      const raw = await res.text();
      try { msg = JSON.parse(raw)?.error?.message ?? ""; } catch { msg = raw.slice(0, 120); }
      errs.push(`${model.replace("gemini-", "")} ${res.status}${res.status === 429 ? "" : ` ${msg.slice(0, 90)}`}`);
      continue;
    }
    const json = await res.json();
    const img = json?.candidates?.[0]?.content?.parts?.find((x: any) => x.inlineData)?.inlineData?.data;
    if (!img) { errs.push(`${model.replace("gemini-", "")} no-image`); continue; }
    mkdirSync(OUT, { recursive: true });
    const dst = resolve(OUT, `${p.file}.png`);
    writeFileSync(dst, Buffer.from(img, "base64"));
    return `${model.replace("gemini-", "")} · ${await inspect(dst)}`;
  }
  const allQuota = errs.every((e) => e.includes("429"));
  throw new Error(allQuota ? `quota exhausted on every model (${errs.join(", ")}) — this key has no remaining image quota` : errs.join(" | "));
}

async function main() {
  const argv = process.argv.slice(2);
  const get = (k: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : null; };
  const only = get("only");
  const size = get("size") ?? "4K";
  const key = loadKey();
  const queue = only ? PARTS.filter((p) => p.file === only) : PARTS;
  if (queue.length === 0) throw new Error(`no part matches --only ${only}`);

  console.log(`── Closure rebirth · ${queue.length} part(s) · ${size} · chain: ${MODEL_CHAIN[0]}\n`);
  let ok = 0;
  for (const p of queue) {
    process.stdout.write(`  ${p.file.padEnd(34)}`);
    try { console.log(`✅ ${await generate(p, key, size)}`); ok++; }
    catch (e) { console.log(`❌ ${e instanceof Error ? e.message : e}`); }
  }
  console.log(`\n  ${ok}/${queue.length} → ${OUT}`);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
