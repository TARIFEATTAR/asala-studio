import assert from "node:assert/strict";
import test from "node:test";

import { resolveInitialStudioTab } from "./bestBottlesStudioPreview";

test("paperDollPreview=1 opens Compose directly after a browser refresh", () => {
  assert.equal(resolveInitialStudioTab("?paperDollPreview=1"), "compose");
});

test("ordinary Studio URLs retain the Masters entry point", () => {
  assert.equal(resolveInitialStudioTab(""), "masters");
  assert.equal(resolveInitialStudioTab("?paperDollPreview=0"), "masters");
});
