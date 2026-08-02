#!/usr/bin/env tsx
/**
 * Paper-Doll Rig — bulk body-layer harvester.
 *
 * Scans bottle PSD folders, auto-detects the BODY layer in each per-SKU PSD
 * (the tall layer: aspect ≥ 2.5, height ≥ 700px — scene index varies per
 * file), extracts it alpha-preserved, and files it SKU-labeled into a staging
 * folder ready for rig upload, with a manifest CSV (SKU joins from the canon
 * CSV) and a dedupe report (byte-identical bodies grouped by SHA — the
 * paper-doll premise says one body per cohort; the dedupe proves it).
 *
 * Staging only — intake (npm run paperdoll:intake) remains the gate that
 * SHA-pins anything into the registries/vault.
 *
 * Usage:
 *   npm run paperdoll:extract-bodies -- \
 *     --src "<dir with PSDs>" [--src "<another dir>" …] \
 *     --out outputs/paper-doll-bodies
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parseCsvLine } from "../../src/lib/paperDoll/componentRegistry";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CANON_CSV = resolve(REPO_ROOT, "docs/best-bottles-canonical-truth/best-bottles-master-truth.csv");

const BODY_MIN_HEIGHT_PX = 700;
const BODY_MIN_ASPECT = 2.5;

interface SceneInfo {
  index: number;
  width: number;
  height: number;
}

function identifyScenes(psdPath: string): SceneInfo[] {
  const out = execFileSync("magick", ["identify", "-format", "%s:%w:%h\n", psdPath], {
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });
  return out
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [index, width, height] = line.split(":").map(Number);
      return { index, width, height };
    });
}

function pickBodyScene(scenes: SceneInfo[]): SceneInfo | null {
  const candidates = scenes.filter(
    (s) => s.index >= 2 && s.height >= BODY_MIN_HEIGHT_PX && s.height / s.width >= BODY_MIN_ASPECT,
  );
  if (candidates.length === 0) return null;
  return candidates.sort((a, b) => b.height - a.height)[0];
}

function websiteSkuFromFilename(file: string): string {
  return basename(file, ".psd").replace(/^\d+\.\s*/, "").trim();
}

function loadCanonJoin(): Map<string, string[]> {
  const lines = readFileSync(CANON_CSV, "utf8").split(/\r?\n/).filter(Boolean);
  const header = parseCsvLine(lines[0]);
  const iWebsite = header.indexOf("websiteSku");
  const iGrace = header.indexOf("graceSku");
  const map = new Map<string, string[]>();
  for (const line of lines.slice(1)) {
    const f = parseCsvLine(line);
    const website = (f[iWebsite] ?? "").trim().toLowerCase();
    const grace = (f[iGrace] ?? "").trim();
    if (!website || !grace) continue;
    const list = map.get(website) ?? [];
    list.push(grace);
    map.set(website, list);
  }
  return map;
}

function parseArgs(argv: string[]): { srcs: string[]; out: string } {
  const srcs: string[] = [];
  let out = "outputs/paper-doll-bodies";
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--src" && argv[i + 1]) srcs.push(argv[++i]);
    else if (argv[i] === "--out" && argv[i + 1]) out = argv[++i];
  }
  if (srcs.length === 0) {
    console.error('Required: at least one --src "<dir>"');
    process.exit(1);
  }
  return { srcs, out: resolve(REPO_ROOT, out) };
}

async function main() {
  const { srcs, out } = parseArgs(process.argv.slice(2));
  mkdirSync(out, { recursive: true });
  const canon = loadCanonJoin();

  const rows: string[] = [
    "file,websiteSku,graceSkus,sourceDir,sourcePsd,scene,widthPx,heightPx,sha256",
  ];
  const bySha = new Map<string, string[]>();
  let extracted = 0, skipped = 0;

  for (const src of srcs) {
    const srcAbs = resolve(src);
    const dirLabel = basename(srcAbs);
    const psds = readdirSync(srcAbs).filter((f) => f.toLowerCase().endsWith(".psd"));
    console.log(`\n── ${dirLabel}: ${psds.length} PSDs`);
    for (const psd of psds) {
      const psdPath = join(srcAbs, psd);
      const websiteSku = websiteSkuFromFilename(psd);
      let scenes: SceneInfo[];
      try {
        scenes = identifyScenes(psdPath);
      } catch {
        console.log(`  ✗ ${websiteSku}: identify failed`);
        skipped++;
        continue;
      }
      const body = pickBodyScene(scenes);
      if (!body) {
        console.log(`  ✗ ${websiteSku}: no body layer (no scene ≥${BODY_MIN_HEIGHT_PX}px tall, aspect ≥${BODY_MIN_ASPECT})`);
        skipped++;
        continue;
      }
      const tmpPath = join(out, `.tmp-${websiteSku}.png`);
      try {
        execFileSync("magick", [
          `${psdPath}[${body.index}]`,
          "+repage",
          "-bordercolor", "none",
          "-border", "6",
          `PNG32:${tmpPath}`,
        ]);
      } catch {
        console.log(`  ✗ ${websiteSku}: extract failed (scene ${body.index})`);
        skipped++;
        continue;
      }
      const bytes = readFileSync(tmpPath);
      const sha256 = createHash("sha256").update(bytes).digest("hex");
      const finalName = `${websiteSku}__body__${sha256.slice(0, 8)}.png`;
      renameSync(tmpPath, join(out, finalName));
      const graces = canon.get(websiteSku.toLowerCase()) ?? [];
      rows.push(
        [finalName, websiteSku, `"${graces.join(";")}"`, `"${dirLabel}"`, `"${psd}"`, body.index, body.width, body.height, sha256].join(","),
      );
      const group = bySha.get(sha256) ?? [];
      group.push(websiteSku);
      bySha.set(sha256, group);
      extracted++;
      console.log(`  ✓ ${websiteSku} ← scene ${body.index} (${body.width}×${body.height})`);
    }
  }

  writeFileSync(join(out, "manifest.csv"), `${rows.join("\n")}\n`);
  const dedupe = [...bySha.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([sha, skus]) => `${sha.slice(0, 12)}  ×${skus.length}  ${skus.slice(0, 6).join(", ")}${skus.length > 6 ? ", …" : ""}`);
  writeFileSync(join(out, "dedupe-report.txt"), `${dedupe.join("\n")}\n`);

  console.log(`\n══ ${extracted} bodies extracted, ${skipped} skipped → ${out}`);
  console.log(`   unique bodies by SHA: ${bySha.size} (dedupe-report.txt)`);
  console.log(`   manifest: manifest.csv`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
