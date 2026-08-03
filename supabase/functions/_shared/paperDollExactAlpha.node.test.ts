import assert from "node:assert/strict";
import test from "node:test";

import {
  compareExactAlphaBytes,
  copyAuthorityAlpha,
} from "./paperDollExactAlpha";

test("exact alpha clamp copies authority bytes and clears hidden RGB", () => {
  const material = new Uint8Array([
    10, 20, 30, 255,
    40, 50, 60, 255,
    70, 80, 90, 255,
  ]);
  const authorityAlpha = new Uint8Array([0, 128, 255]);

  const output = copyAuthorityAlpha(material, authorityAlpha);

  assert.deepEqual(Array.from(output), [
    0, 0, 0, 0,
    40, 50, 60, 128,
    70, 80, 90, 255,
  ]);
});

test("exact alpha comparison distinguishes byte mismatch from binary IoU", () => {
  const result = compareExactAlphaBytes(
    new Uint8Array([0, 128, 255]),
    new Uint8Array([0, 255, 255]),
  );

  assert.equal(result.minIoU, 1);
  assert.equal(result.mismatchedPixels, 1);
  assert.equal(result.geometryLocked, false);
});

test("exact alpha helpers reject dimension mismatches", () => {
  assert.throws(
    () => copyAuthorityAlpha(new Uint8Array(8), new Uint8Array(3)),
    /pixel count/i,
  );
  assert.throws(
    () => compareExactAlphaBytes(new Uint8Array(2), new Uint8Array(3)),
    /length/i,
  );
});

