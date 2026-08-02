import assert from "node:assert/strict";
import test from "node:test";

import { authorityMaskBlocker } from "./authorityMaskPolicy";

test("revokes the measured CYL-9ML plastic-roller mask with detached islands", () => {
  const blocker = authorityMaskBlocker("d2d1bd4a29e949c2dd824c95f60607ee36954381084fe5bb5e7570000c65cbfa");
  assert.match(blocker ?? "", /15 connected components/i);
});

test("does not infer a blocker for an unmeasured authority mask", () => {
  assert.equal(authorityMaskBlocker("a".repeat(64)), null);
  assert.equal(authorityMaskBlocker(null), null);
});
