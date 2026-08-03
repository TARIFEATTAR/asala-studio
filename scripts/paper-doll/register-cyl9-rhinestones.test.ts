import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import sharp from "sharp";

import {
  applyRegisteredRhinestones,
  registerCyl9RhinestoneCandidates,
} from "./register-cyl9-rhinestones";

const TEST_LAYOUT = [
  { id: "stone-top-left", order: 0, angleDeg: -42, heightRatio: 0.78, scaleRatio: 0.028, xRatio: 0.219002 },
  { id: "stone-top-right", order: 1, angleDeg: 42, heightRatio: 0.78, scaleRatio: 0.028, xRatio: 0.780998 },
  { id: "stone-upper-center", order: 2, angleDeg: 0, heightRatio: 0.64, scaleRatio: 0.028, xRatio: 0.5 },
  { id: "stone-mid-left", order: 3, angleDeg: -42, heightRatio: 0.49, scaleRatio: 0.028, xRatio: 0.219002 },
  { id: "stone-mid-right", order: 4, angleDeg: 42, heightRatio: 0.49, scaleRatio: 0.028, xRatio: 0.780998 },
  { id: "stone-lower-center", order: 5, angleDeg: 0, heightRatio: 0.34, scaleRatio: 0.028, xRatio: 0.5 },
  { id: "stone-bottom-left", order: 6, angleDeg: -42, heightRatio: 0.19, scaleRatio: 0.028, xRatio: 0.219002 },
  { id: "stone-bottom-right", order: 7, angleDeg: 42, heightRatio: 0.19, scaleRatio: 0.028, xRatio: 0.780998 },
];

test("registered rhinestones use the same eight IDs and exact coordinates on every material base", async () => {
  const bounds = { left: 20, top: 10, width: 100, height: 140 };
  const makeBase = (background: string) => sharp({
    create: { width: 160, height: 180, channels: 4, background },
  }).png().toBuffer();
  const [black, pink] = await Promise.all([
    applyRegisteredRhinestones({ basePng: await makeBase("#111111"), authorityBoundsPx: bounds, layout: TEST_LAYOUT }),
    applyRegisteredRhinestones({ basePng: await makeBase("#ef9faf"), authorityBoundsPx: bounds, layout: TEST_LAYOUT }),
  ]);

  assert.deepEqual(black.stones, pink.stones);
  assert.equal(black.stones.length, 8);
  assert.equal(new Set(black.stones.map(({ id }) => id)).size, 8);
  assert.deepEqual(black.stones.map(({ id }) => id), TEST_LAYOUT.map(({ id }) => id));

  const [blackRaw, pinkRaw] = await Promise.all([
    sharp(black.png).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(pink.png).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
  ]);
  for (const stone of black.stones) {
    const offset = (stone.centerYPx * blackRaw.info.width + stone.centerXPx) * 4;
    assert.deepEqual(
      Array.from(blackRaw.data.subarray(offset, offset + 4)),
      Array.from(pinkRaw.data.subarray(offset, offset + 4)),
    );
  }
});

test("the CYL-9ML registration pass supersedes only the three rhinestone candidates and writes no approval state", async () => {
  const outputDirectory = await mkdtemp(path.join(tmpdir(), "cyl9-registered-stones-"));
  try {
    const result = await registerCyl9RhinestoneCandidates({ outputDirectory });
    assert.equal(result.replacedCandidates, 3);
    assert.equal(result.artifacts.length, 16);
    assert.deepEqual(result.registeredVariantKeys, ["SLDT", "BKDT", "PKDT"]);
    assert.equal(result.mutationPolicy.approvalsWritten, false);
    assert.equal(result.mutationPolicy.placementsWritten, false);
    assert.equal(result.mutationPolicy.currentReleaseChanged, false);
    assert.equal(result.mutationPolicy.sanityChanged, false);

    const registered = result.artifacts.filter(({ decorationState }) => (
      decorationState === "registered-layout-locked"
    ));
    assert.equal(registered.length, 3);
    assert.deepEqual(
      Object.fromEntries(registered.map(({ variantKey, rhinestoneRegistration }) => [
        variantKey,
        rhinestoneRegistration?.materialSourceVariantKey,
      ])),
      { SLDT: "SSLV", PKDT: "MSLV", BKDT: "SBLK" },
    );
    for (const artifact of registered) {
      assert.equal(artifact.geometryLocked, true);
      assert.equal(artifact.mismatchedPixels, 0);
      const manifest = JSON.parse(await readFile(artifact.paths.manifestPath, "utf8"));
      assert.equal(manifest.lifecycleState, "candidate");
    }
  } finally {
    await rm(outputDirectory, { recursive: true, force: true });
  }
});
