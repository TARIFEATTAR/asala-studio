import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import sharp from "sharp";

import { assembleDeterministicBodyMaterial } from "./assemble-deterministic-body-material";

const sha256 = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");

test("locks the material body into the canonical box without changing any outside pixel", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "bb-deterministic-body-"));
  try {
    const basePath = path.join(directory, "base.png");
    const materialPath = path.join(directory, "material.png");
    const identityOverlayPath = path.join(directory, "identity-overlay.png");
    const outputPath = path.join(directory, "assembled.png");
    const recordPath = path.join(directory, "assembled.json");
    const base = await sharp({
      create: { width: 20, height: 20, channels: 3, background: "#F5F3EF" },
    }).composite([
      { input: { create: { width: 4, height: 3, channels: 3, background: "#111111" } }, left: 8, top: 3 },
      { input: { create: { width: 6, height: 8, channels: 3, background: "#55aa55" } }, left: 7, top: 6 },
      { input: { create: { width: 3, height: 5, channels: 3, background: "#2255aa" } }, left: 16, top: 9 },
    ]).png().toBuffer();
    const material = await sharp({
      create: { width: 20, height: 20, channels: 3, background: "#F5F3EF" },
    }).composite([
      { input: { create: { width: 6, height: 10, channels: 3, background: "#d8c27a" } }, left: 2, top: 4 },
    ]).png().toBuffer();
    const identityOverlay = await sharp({
      create: {
        width: 20,
        height: 20,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    }).composite([
      { input: { create: { width: 4, height: 3, channels: 4, background: "#111111" } }, left: 8, top: 3 },
      { input: { create: { width: 3, height: 5, channels: 4, background: "#2255aa" } }, left: 16, top: 9 },
    ]).png().toBuffer();
    await writeFile(basePath, base);
    await writeFile(materialPath, material);
    await writeFile(identityOverlayPath, identityOverlay);

    const record = await assembleDeterministicBodyMaterial({
      websiteSku: "TEST",
      graceSku: "GB-CYL-TEST",
      assetRole: "sidecar",
      canonicalMaster: {
        path: "docs/best-bottles-canonical-truth/best-bottles-master-truth.csv",
        sha256: "a".repeat(64),
      },
      baseReferencePath: basePath,
      baseReferenceSha256: sha256(base),
      materialCandidatePath: materialPath,
      materialCandidateSha256: sha256(material),
      identityOverlayPath,
      identityOverlaySha256: sha256(identityOverlay),
      sourceBodyBounds: { left: 2, top: 4, right: 7, bottom: 13 },
      targetBodyBounds: { left: 8, top: 6, right: 11, bottom: 13 },
      expectedCanvas: { widthPx: 20, heightPx: 20, backgroundHex: "#F5F3EF" },
      outputPath,
      recordPath,
      sourceAttemptId: "test-attempt",
    });

    assert.equal(record.geometryQa.status, "pass-by-construction");
    assert.equal(record.geometryQa.bodyWidthPx, 4);
    assert.equal(record.geometryQa.bodyHeightPx, 8);
    assert.equal(record.geometryQa.baselineYPx, 13);
    assert.equal(record.pixelQa.unownedCanvasPixelCount, 0);
    assert.equal(record.pixelPolicy, "native-bone+material-body+exact-identity-overlay");
    assert.equal(record.postGenerationBackgroundPainting, false);
    assert.match(record.outputSha256, /^[a-f0-9]{64}$/);

    const outputRaw = await sharp(outputPath).removeAlpha().raw().toBuffer();
    const pixel = (x: number, y: number) =>
      [...outputRaw.subarray((y * 20 + x) * 3, (y * 20 + x) * 3 + 3)];
    assert.deepEqual(pixel(9, 4), [17, 17, 17], "Exact sprayer overlay changed.");
    assert.deepEqual(pixel(17, 10), [34, 85, 170], "Exact sidecar overlay changed.");
    assert.deepEqual(pixel(8, 10), [216, 194, 122], "Material body was not assembled.");
    assert.deepEqual(pixel(7, 10), [245, 243, 239], "Old oversize body fringe survived.");
    assert.deepEqual(JSON.parse(await readFile(recordPath, "utf8")), record);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
