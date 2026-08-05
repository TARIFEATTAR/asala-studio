import assert from "node:assert/strict";
import test from "node:test";

import { runSwatchLockGate } from "./qaGates";
import { buildWeldMask, clampOutsideMask } from "./weldLane";

test("production branch exposes hostile-provider clamp and swatch-lock gates", () => {
  assert.equal(typeof buildWeldMask, "function");
  assert.equal(typeof clampOutsideMask, "function");
  assert.equal(typeof runSwatchLockGate, "function");
});
