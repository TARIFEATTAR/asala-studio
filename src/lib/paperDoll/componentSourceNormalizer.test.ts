import assert from "node:assert/strict";
import test from "node:test";

import { largestAlphaComponent } from "./componentSourceNormalizer";

test("authority-mask derivation keeps one 8-connected silhouette and counts detached junk", () => {
  const alpha = new Uint8ClampedArray(6 * 4);
  for (const pixel of [7, 8, 13, 14]) alpha[pixel] = 255;
  alpha[23] = 255;
  const result = largestAlphaComponent(alpha, 6, 4);
  assert.deepEqual(result.bounds, { left: 1, top: 1, right: 2, bottom: 2 });
  assert.equal(result.removedDetachedIslands, 1);
  assert.equal(result.membership[23], 0);
});

