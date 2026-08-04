import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import sharp from "sharp";

import { buildSprayer13OvercapReview } from "./build-sprayer-13-415-overcap-review";

const sha256 = (value: Buffer) => createHash("sha256").update(value).digest("hex");

async function syntheticCap(color: string, island: boolean): Promise<Buffer> {
  const base = await sharp({ create: { width: 20, height: 38, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: Buffer.from(`<svg width="16" height="34"><rect x="0" y="1" width="16" height="33" rx="2" fill="${color}"/></svg>`), left: 2, top: 2 }])
    .png().toBuffer();
  if (!island) return base;
  return sharp(base).composite([{ input: Buffer.from('<svg width="1" height="1"><rect width="1" height="1" fill="white"/></svg>'), left: 0, top: 0 }]).png().toBuffer();
}

test("builds exact-alpha opaque-overcap candidates without approving their geometry", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "sprayer13-overcap-"));
  const outputRoot = path.join(root, "output");
  await mkdir(outputRoot, { recursive: true });
  const black = await syntheticCap("#111111", false);
  const gold = await syntheticCap("#c6a050", true);
  const blackPath = path.join(root, "black.png");
  const goldPath = path.join(root, "gold.png");
  await Promise.all([writeFile(blackPath, black), writeFile(goldPath, gold)]);
  const extractionPath = path.join(root, "extraction.json");
  await writeFile(extractionPath, JSON.stringify({ assets: [
    { partId: "opaque-protective-overcap", sourceId: "black", cutoutPath: blackPath, cutoutSha256: sha256(black), originalFilename: "black.psd", sourceSha256: "a".repeat(64) },
    { partId: "opaque-protective-overcap", sourceId: "gold", cutoutPath: goldPath, cutoutSha256: sha256(gold), originalFilename: "gold.psd", sourceSha256: "b".repeat(64) },
  ] }));

  const result = await buildSprayer13OvercapReview({
    extractionManifestPath: extractionPath,
    outputRoot,
    canvas: { width: 100, height: 120 },
    authoritySourceId: "black",
    variants: [
      { sourceId: "black", variantKey: "MBLK", finish: "matte-black", alphaCleanup: { expectedSourceComponents: 1, maxDiscardedComponentPixels: 0, maxDiscardedTotalPixels: 0 } },
      { sourceId: "gold", variantKey: "SGLD", finish: "mirror-gold", alphaCleanup: { expectedSourceComponents: 2, maxDiscardedComponentPixels: 1, maxDiscardedTotalPixels: 1 } },
    ],
  });

  assert.equal(result.manifest.summary.variantCount, 2);
  assert.equal(result.manifest.summary.exactAlphaAcrossCandidates, true);
  assert.equal(result.manifest.geometryLocked, false);
  assert.equal(result.manifest.productionEligible, false);
  assert.equal(result.manifest.candidates.every((candidate) => candidate.placementBoundsPx === null), true);
  assert.equal(result.manifest.mutationPolicy.currentReleaseChanged, false);
  const { data, info } = await sharp(await readFile(result.contactSheetPath)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let foreground = 0;
  for (let y = 0; y < 430; y += 1) for (let x = 0; x < 320; x += 1) {
    const offset = (y * info.width + x) * info.channels;
    if (Math.abs(data[offset] - 245) + Math.abs(data[offset + 1] - 243) + Math.abs(data[offset + 2] - 239) > 24) foreground += 1;
  }
  assert.ok(foreground > 20_000, "the review sheet should magnify the overcap crop for visual inspection");
});
