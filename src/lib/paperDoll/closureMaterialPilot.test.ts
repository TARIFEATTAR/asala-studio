import assert from "node:assert/strict";
import test from "node:test";

import {
  compareAlphaSilhouettes,
  resizeContainTransparent,
  solveLockedPixelPlacement,
  type AlphaImage,
} from "./closureMaterialPilot";

function alphaImage(width: number, height: number, occupied: Array<[number, number, number]>): AlphaImage {
  const alpha = new Uint8Array(width * height);
  for (const [x, y, value] of occupied) alpha[y * width + x] = value;
  return { width, height, alpha };
}

test("alpha silhouette comparison ignores finish opacity while preserving occupied pixels", () => {
  const mirror = alphaImage(4, 3, [
    [1, 0, 255], [2, 0, 255],
    [1, 1, 255], [2, 1, 255],
    [1, 2, 128], [2, 2, 128],
  ]);
  const translucent = alphaImage(4, 3, [
    [1, 0, 90], [2, 0, 90],
    [1, 1, 40], [2, 1, 40],
    [1, 2, 1], [2, 2, 1],
  ]);

  const result = compareAlphaSilhouettes([
    { name: "mirror", image: mirror },
    { name: "translucent", image: translucent },
  ]);

  assert.equal(result.pass, true);
  assert.equal(result.minIoU, 1);
  assert.equal(result.pairs[0]?.mismatchedPixels, 0);
});

test("alpha silhouette comparison catches a one-pixel geometry drift", () => {
  const master = alphaImage(4, 3, [[1, 0, 255], [1, 1, 255], [1, 2, 255]]);
  const drifted = alphaImage(4, 3, [[2, 0, 255], [2, 1, 255], [2, 2, 255]]);

  const result = compareAlphaSilhouettes([
    { name: "master", image: master },
    { name: "drifted", image: drifted },
  ]);

  assert.equal(result.pass, false);
  assert.equal(result.minIoU, 0);
  assert.equal(result.pairs[0]?.mismatchedPixels, 6);
});

test("locked pixel placement honors the recipe width, center, and bottom anchor", () => {
  const placement = solveLockedPixelPlacement({
    sourceWidth: 1400,
    sourceHeight: 2050,
    targetWidth: 363,
    centerX: 1041,
    bottomY: 1002,
  });

  assert.deepEqual(placement, {
    width: 363,
    height: 532,
    left: 860,
    top: 470,
    rightExclusive: 1223,
    bottomExclusive: 1002,
  });
});

test("contact-sheet contain resize leaves letterbox pixels transparent", async () => {
  const source = Buffer.from([
    255, 0, 0, 255, 255, 0, 0, 255,
    255, 0, 0, 255, 255, 0, 0, 255,
    255, 0, 0, 255, 255, 0, 0, 255,
    255, 0, 0, 255, 255, 0, 0, 255,
  ]);

  const result = await resizeContainTransparent(source, {
    raw: { width: 2, height: 4, channels: 4 },
    width: 4,
    height: 4,
  });
  const { data } = await (await import("sharp")).default(result).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  assert.equal(data[3], 0, "left letterbox pixel must be transparent");
  assert.equal(data[(1 * 4 + 1) * 4 + 3], 255, "resized image center must remain opaque");
});
