import assert from "node:assert/strict";
import test from "node:test";

import sharp from "sharp";

import { inspectAuthorityMask } from "../../src/lib/paperDoll/componentPlateImage.node";
import { extractClosedAssemblySwatch } from "./build-dispenser-17-415-closed-swatches";

test("extracts one baked closed assembly and excludes the source bottle below its calibrated seat", async () => {
  const source = await sharp({
    create: { width: 12, height: 12, channels: 4, background: "#ffffff" },
  }).composite([{
    input: Buffer.from(`
      <svg width="12" height="12" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 1h2v1H3v1H2v3h6V3H7V2H6Z" fill="#d8dde2"/>
        <path d="M4 2h2v3H4Z" fill="#ffffff" stroke="#d8dde2" stroke-width="0.2"/>
        <path d="M1 6h8v6H1Z" fill="none" stroke="#222"/>
      </svg>`),
  }]).png().toBuffer();

  const result = await extractClosedAssemblySwatch({
    sourcePng: source,
    sourceBoundsPx: { left: 2, top: 1, width: 6, height: 5 },
    backgroundRgb: { r: 255, g: 255, b: 255 },
    backgroundDistanceThreshold: 12,
    targetWidthPx: 6,
    centerXPx: 10,
    seatYPx: 10,
    canvas: { widthPx: 20, heightPx: 20 },
  });

  const authority = await inspectAuthorityMask(result.authorityMaskPng, { expectedRegions: 1 });
  const [candidate, mask] = await Promise.all([
    sharp(result.candidatePng).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(result.authorityMaskPng).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
  ]);

  assert.deepEqual(authority.authorityBoundsPx, { left: 7, top: 5, width: 6, height: 5 });
  assert.equal(result.qa.sourceBoundsPx.height, 5);
  assert.equal(result.qa.placementBoundsPx.top + result.qa.placementBoundsPx.height, 10);
  assert.equal(result.qa.alphaMismatchedPixels, 0);
  assert.deepEqual(candidate.info, mask.info);

  for (let y = 10; y < 20; y += 1) {
    for (let x = 0; x < 20; x += 1) {
      assert.equal(candidate.data[((y * 20) + x) * 4 + 3], 0);
    }
  }

  // The transparent-looking white center is intentionally baked into the
  // compound swatch rather than becoming a hole for a second cap overlay.
  assert.equal(candidate.data[((7 * 20) + 9) * 4 + 3], 255);
});
