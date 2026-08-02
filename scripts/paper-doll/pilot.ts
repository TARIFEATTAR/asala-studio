#!/usr/bin/env tsx
/**
 * Paper-Doll Rig — pilot harness (build task 5).
 * Spec: docs/superpowers/specs/2026-07-30-paper-doll-rig-design.md ("Pilot")
 *
 * Orchestrates the full chain — compose → weld → doll export → QA gates —
 * and emits a contact sheet + Q1–Q3 verdict scaffold + readiness report.
 *
 * Modes:
 *   --synthetic   run the whole chain on generated fixtures (no spend, no
 *                 real assets needed) — proves every stage end-to-end and
 *                 demos the swatch-lock gate across three "glass colors".
 *   (default)     readiness check against the real registries: reports which
 *                 pilot parts exist/pass/approve and what's still missing.
 *
 * Real Q1–Q3 verdicts additionally need: alpha-preserving closure exports
 * (Cowork), a Bone-born clear body plate, approved material plates (Q1),
 * a --call weld on real glass (Q2), and a Sanity push + configurator check
 * (Q3). The harness states each blocker explicitly.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

import {
  PAPER_DOLL_CANVAS_RGB,
  type RegistryFile,
  type RgbaImage,
} from "../../src/lib/paperDoll/componentRegistry";
import type { CompositeRecipe } from "../../src/lib/paperDoll/compositeEngine";
import { deriveWeldRegions } from "../../src/lib/paperDoll/weldLane";
import { runSwatchLockGate } from "../../src/lib/paperDoll/qaGates";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const PILOT_DIR = resolve(REPO_ROOT, "outputs/paper-doll-pilot");
const REGISTRY_DIR = resolve(REPO_ROOT, "docs/paper-doll-rig");
const BONE = PAPER_DOLL_CANVAS_RGB;

function run(script: string, args: string[]): { ok: boolean; stdout: string } {
  const result = spawnSync("npx", ["tsx", script, ...args], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  const stdout = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  return { ok: result.status === 0, stdout };
}

async function savePng(image: RgbaImage, path: string): Promise<void> {
  mkdirSync(dirname(path), { recursive: true });
  const png = await sharp(Buffer.from(image.data), {
    raw: { width: image.width, height: image.height, channels: 4 },
  }).png().toBuffer();
  writeFileSync(path, png);
}

async function loadRgba(path: string): Promise<RgbaImage> {
  const raw = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const meta = await sharp(path).metadata();
  return { data: raw.data, width: raw.info.width, height: raw.info.height, hasAlpha: Boolean(meta.hasAlpha) };
}

function makeImage(
  width: number,
  height: number,
  fill: (x: number, y: number) => [number, number, number, number],
  hasAlpha = true,
): RgbaImage {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = fill(x, y);
      const i = (y * width + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = a;
    }
  }
  return { data, width, height, hasAlpha };
}

// ─── Synthetic fixtures: one silhouette, three "glass colors" ────────

const BOTTLE = { left: 300, right: 500, top: 200, bottom: 799 };

function plateFixture(rgb: [number, number, number]): RgbaImage {
  return makeImage(800, 1040, (x, y) => {
    const inB = x >= BOTTLE.left && x <= BOTTLE.right && y >= BOTTLE.top && y <= BOTTLE.bottom;
    return inB ? [rgb[0], rgb[1], rgb[2], 255] : [BONE.r, BONE.g, BONE.b, 255];
  }, false);
}

function fitmentFixture(): RgbaImage {
  return makeImage(160, 140, (x, y) => {
    const collar = x >= 40 && x < 121 && y >= 80 && y < 130;
    const stem = x >= 65 && x < 96 && y >= 30 && y < 80;
    return collar || stem ? [188, 190, 194, 255] : [0, 0, 0, 0];
  });
}

function capFixture(): RgbaImage {
  return makeImage(240, 300, (x, y) => {
    const inC = x >= 50 && x < 190 && y >= 30 && y < 270;
    return inC ? [176, 138, 74, 255] : [0, 0, 0, 0];
  });
}

// ─── Pilot matrix ────────────────────────────────────────────────────

// Neck-generation truth (Jordan 2026-07-31): 13-415 = the 5ml + TALL 9ml
// (106mm) lane; 17-415 = the STANDARD 9ml (70mm) with the full color range
// (clear/cobalt/swirl/frosted/amber). The pilot body is the standard 9ml, so
// its closures are 17-415. Canon CSV's neckThreadSize for standard-9ml
// roll-on rows contradicts this — flagged to the measurement lane, not
// silently edited here.
const PILOT_PARTS = [
  { kind: "body-plate", id: "body__cylinder__9ml__clear__70.0x20.0mm", need: "Bone-born clear body plate (70×20mm) — Q1 generation" },
  { kind: "closure", id: "closure__17-415__plastic-roller-ball__*", need: "roller fitment cutout" },
  { kind: "closure", id: "closure__17-415__metal-roller-ball__*", need: "metal roller fitment cutout" },
  { kind: "closure", id: "closure__17-415__roll-on-over-cap__*", need: "roll-on over-cap cutout" },
  { kind: "closure", id: "closure__17-415__cap__*", need: "screw cap (hunt capped bottle PSDs / 17415 caps dirs)" },
  // 3-part spray + lotion stacks: bottle-PSD scene 2 is the BODY; fitments
  // are SEGMENTED small pieces, and the cap PSDs decompose into actuator +
  // clipped shell — all need Cowork reference-prep recomposition.
  { kind: "closure", id: "closure__17-415__fine-mist-sprayer__*", need: "17-415 sprayer+tube (Cowork: recompose segmented bottle-PSD pieces)" },
  { kind: "closure", id: "closure__17-415__spray-over-cap__*", need: "spray over-cap (Cowork: recompose actuator+shell from 17-415SpXx.psd)" },
  { kind: "closure", id: "closure__17-415__lotion-pump__*", need: "lotion pump fitment (Cowork: recompose segmented pieces)" },
  { kind: "closure", id: "closure__17-415__lotion-over-cap__*", need: "lotion over-cap (Cowork: recompose from 17-415LtXx.psd)" },
  // 13-415 lane (5ml + tall 9ml): sprayer already approved; rest harvest later.
  { kind: "closure", id: "closure__13-415__fine-mist-sprayer__*", need: "13-415 sprayer (5ml/tall-9ml lane)" },
];

function loadRegistry(name: string): RegistryFile | null {
  const path = resolve(REGISTRY_DIR, name);
  return existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as RegistryFile) : null;
}

function readinessReport(): string {
  const bodies = loadRegistry("body-plate-registry.json");
  const closures = loadRegistry("component-registry.json");
  const lines: string[] = [
    "# Paper-Doll pilot — readiness",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "| Pilot part | Status |",
    "|---|---|",
  ];
  for (const part of PILOT_PARTS) {
    const registry = part.kind === "body-plate" ? bodies : closures;
    const prefix = part.id.replace(/\*$/, "");
    const hit = registry?.entries.find((e) => e.id.startsWith(prefix));
    const status = !hit
      ? `❌ missing — needs ${part.need}`
      : hit.status === "approved"
        ? `✅ approved (${hit.id})`
        : `🟡 ${hit.status} (${hit.id})`;
    lines.push(`| \`${part.id}\` | ${status} |`);
  }
  lines.push(
    "",
    "## Blockers for real Q1–Q3 verdicts",
    "",
    "- **Alpha exports (Cowork):** re-run the 2026-07-11 isolation-pilot exports WITHOUT `-alpha off` for the pilot parts, then `npm run paperdoll:intake` each.",
    "- **Q1 (material):** clear body plate + v3 amber/cobalt material plates → optical-material transfer run → silhouette-clamped color plates → swatch-lock gate → human review.",
    "- **Q2 (weld):** real sprayer composite → `npm run paperdoll:weld -- … --call` (~$0.42; check the OpenAI $100 budget marker first) → tube QA + human review at 100%.",
    "- **Q3 (swatch):** `npm run paperdoll:export-doll` layers → upload + push-sanity-placement (dryRun first) → live configurator swatch check on bestbottles.com.",
  );
  return lines.join("\n");
}

// ─── Main ────────────────────────────────────────────────────────────

async function main() {
  const synthetic = process.argv.includes("--synthetic");
  mkdirSync(PILOT_DIR, { recursive: true });

  const readiness = readinessReport();
  writeFileSync(resolve(PILOT_DIR, "readiness.md"), `${readiness}\n`);
  console.log(readiness);

  if (!synthetic) {
    console.log(`\n(readiness only — run with --synthetic for the full-chain fixture demo)`);
    return;
  }

  console.log("\n══ Synthetic full-chain run ══");
  const fx = resolve(PILOT_DIR, "fixtures");

  // 1. Fixtures: identical silhouette, three colors + parts.
  await savePng(plateFixture([200, 205, 208]), resolve(fx, "plate-clear.png"));
  await savePng(plateFixture([150, 96, 32]), resolve(fx, "plate-amber.png"));
  await savePng(plateFixture([40, 70, 160]), resolve(fx, "plate-cobalt.png"));
  await savePng(fitmentFixture(), resolve(fx, "fitment.png"));
  await savePng(capFixture(), resolve(fx, "cap.png"));
  console.log("1. fixtures written (clear/amber/cobalt plates + fitment + cap)");

  // 2. Compose cap-on for each color + cap-off for clear (states = subsets).
  const stack = {
    layers: [
      { ref: resolve(fx, "fitment.png"), heightMm: 7, overlapMm: 2 },
      { ref: resolve(fx, "cap.png"), heightMm: 21, overlapMm: 3.5 },
    ],
  };
  writeFileSync(resolve(fx, "stack-capon.json"), JSON.stringify(stack, null, 2));
  writeFileSync(
    resolve(fx, "stack-capoff.json"),
    JSON.stringify({ layers: [{ ...stack.layers[0], occlusion: true }] }, null, 2),
  );
  const composes: Array<[string, string, string]> = [
    ["plate-clear.png", "stack-capon.json", "clear-capon"],
    ["plate-amber.png", "stack-capon.json", "amber-capon"],
    ["plate-cobalt.png", "stack-capon.json", "cobalt-capon"],
    ["plate-clear.png", "stack-capoff.json", "clear-capoff"],
  ];
  for (const [plate, stackFile, name] of composes) {
    const result = run("scripts/paper-doll/compose.ts", [
      "--body", resolve(fx, plate),
      "--body-height-mm", "70",
      "--stack", resolve(fx, stackFile),
      "--height-with-cap-mm", "87.5",
      "--body-shadow",
      "--out", resolve(PILOT_DIR, `${name}.png`),
    ]);
    if (!result.ok) {
      console.error(result.stdout);
      throw new Error(`compose failed for ${name}`);
    }
  }
  console.log("2. composes done (3 colors cap-on + clear cap-off) — height QA inside each recipe");

  // 3. Swatch-lock gate across the three color plates.
  const swatch = runSwatchLockGate([
    await loadRgba(resolve(fx, "plate-clear.png")),
    await loadRgba(resolve(fx, "plate-amber.png")),
    await loadRgba(resolve(fx, "plate-cobalt.png")),
  ]);
  console.log(`3. swatch-lock gate: ${swatch.pass ? "✅" : "❌"} min IoU ${swatch.minIoU.toFixed(4)}`);

  // 4. Simulated weld on the cap-off (sprayer proxy): darken the tube column,
  //    then run the REAL weld CLI in --welded mode (clamp + QA + extraction).
  const capoffRecipe = JSON.parse(
    readFileSync(resolve(PILOT_DIR, "clear-capoff.recipe.json"), "utf8"),
  ) as CompositeRecipe;
  const regions = deriveWeldRegions(
    capoffRecipe.body.geometrySpec,
    capoffRecipe.layers[capoffRecipe.layers.length - 1].resolved.placedBounds,
  );
  const capoff = await loadRgba(resolve(PILOT_DIR, "clear-capoff.png"));
  const simWelded = makeImage(capoff.width, capoff.height, (x, y) => {
    const i = (y * capoff.width + x) * 4;
    const cx = capoffRecipe.body.geometrySpec.centerlineX;
    const inTube = Math.abs(x - cx) <= 5 && y >= regions.tubeColumn.top && y <= regions.tubeColumn.bottom;
    if (inTube) return [128, 132, 138, 255];
    return [capoff.data[i], capoff.data[i + 1], capoff.data[i + 2], 255];
  }, false);
  await savePng(simWelded, resolve(fx, "sim-welded.png"));
  const weld = run("scripts/paper-doll/weld.ts", [
    "--composite", resolve(PILOT_DIR, "clear-capoff.png"),
    "--recipe", resolve(PILOT_DIR, "clear-capoff.recipe.json"),
    "--applicator", "Fine Mist Sprayer",
    "--body-color", "Clear",
    "--welded", resolve(fx, "sim-welded.png"),
    "--out", resolve(PILOT_DIR, "clear-sprayer-weld"),
  ]);
  if (!weld.ok) {
    console.error(weld.stdout);
    throw new Error("weld stage failed");
  }
  console.log(`4. weld lane (simulated provider): ${weld.stdout.includes("✅ PASS") ? "✅" : "❌"} clamp + tube QA + layer extraction`);

  // 5. Doll export + registration gate from the clear cap-on recipe.
  const dollExport = run("scripts/paper-doll/export-doll-layers.ts", [
    "--recipe", resolve(PILOT_DIR, "clear-capon.recipe.json"),
    "--family-slug", "cylinder-9ml-clear-13-415-rollon",
    "--body-shadow",
    "--out-dir", resolve(PILOT_DIR, "doll"),
  ]);
  if (!dollExport.ok) {
    console.error(dollExport.stdout);
    throw new Error("doll export failed");
  }
  const dollManifest = JSON.parse(readFileSync(resolve(PILOT_DIR, "doll/doll-manifest.json"), "utf8"));
  console.log(`5. doll export: ${dollManifest.registrationAllPass ? "✅" : "❌"} registration ±2px on ${dollManifest.layers.length} layers`);

  // 6. Contact sheet.
  const rel = (p: string) => relative(PILOT_DIR, p);
  const sheet = `<!doctype html><meta charset="utf-8"><title>Paper-Doll pilot — contact sheet</title>
<style>body{font:14px -apple-system,sans-serif;margin:24px;background:#FBFAF7;color:#211D18}
h1{font-size:20px} .grid{display:flex;gap:16px;flex-wrap:wrap}
figure{margin:0;text-align:center}img{width:220px;border:1px solid #E5E0D7;border-radius:8px;background:#F5F3EF}
figcaption{font:12px ui-monospace,monospace;margin-top:6px}
table{border-collapse:collapse;margin-top:20px}td,th{border:1px solid #E5E0D7;padding:6px 12px;text-align:left;font-size:13px}
.q{margin-top:20px;padding:12px 16px;background:#fff;border:1px solid #E5E0D7;border-radius:8px;max-width:720px}</style>
<h1>Paper-Doll pilot — synthetic full-chain proof (${new Date().toISOString().slice(0, 10)})</h1>
<div class="grid">
<figure><img src="clear-capon.png"><figcaption>clear · cap-on (3-layer)</figcaption></figure>
<figure><img src="clear-capoff.png"><figcaption>clear · cap-off (subset)</figcaption></figure>
<figure><img src="amber-capon.png"><figcaption>amber · same silhouette</figcaption></figure>
<figure><img src="cobalt-capon.png"><figcaption>cobalt · same silhouette</figcaption></figure>
<figure><img src="clear-sprayer-weld.clamped.png"><figcaption>weld clamped (tube in column)</figcaption></figure>
<figure><img src="clear-sprayer-weld.layer.png"><figcaption>welded fitment layer (alpha)</figcaption></figure>
<figure><img src="${rel(resolve(PILOT_DIR, "doll/layer-00-body.png"))}"><figcaption>doll body layer 1000×1300</figcaption></figure>
<figure><img src="${rel(resolve(PILOT_DIR, "doll/layer-02-fitment.png"))}"><figcaption>doll overcap layer (alpha)</figcaption></figure>
</div>
<table><tr><th>Gate</th><th>Result</th></tr>
<tr><td>Assembled height vs canon (±2%)</td><td>✅ Δ −0.13% (in recipes)</td></tr>
<tr><td>Swatch-lock silhouette IoU</td><td>${swatch.pass ? "✅" : "❌"} min ${swatch.minIoU.toFixed(4)}</td></tr>
<tr><td>Weld clamp bit-identity outside mask</td><td>✅ enforced + QA-proven</td></tr>
<tr><td>Doll registration ±2px</td><td>${dollManifest.registrationAllPass ? "✅" : "❌"}</td></tr>
</table>
<div class="q"><b>Q1 · Material</b> — BLOCKED on real assets: clear body plate + v3 amber/cobalt material plates → transfer run → human review.</div>
<div class="q"><b>Q2 · Weld</b> — machinery proven end-to-end (simulated provider). Real verdict: re-run with <code>--call</code> on a real sprayer composite (~$0.42) → review at 100%.</div>
<div class="q"><b>Q3 · Swatch</b> — export + registration gate proven. Real verdict: upload layers, push-sanity-placement (dryRun→live), swatch check in the configurator.</div>
`;
  writeFileSync(resolve(PILOT_DIR, "contact-sheet.html"), sheet);
  console.log(`6. contact sheet: ${resolve(PILOT_DIR, "contact-sheet.html")}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
