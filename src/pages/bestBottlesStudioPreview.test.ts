import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { resolveInitialStudioTab } from "./bestBottlesStudioPreview";

test("paperDollPreview=1 opens Compose directly after a browser refresh", () => {
  assert.equal(resolveInitialStudioTab("?paperDollPreview=1"), "compose");
});

test("ordinary Studio URLs retain the Masters entry point", () => {
  assert.equal(resolveInitialStudioTab(""), "masters");
  assert.equal(resolveInitialStudioTab("?paperDollPreview=0"), "masters");
});

test("Compose presents the immutable ledger as Current Release", () => {
  const source = readFileSync(new URL("../components/paper-doll/ProductionCandidateWorkbench.tsx", import.meta.url), "utf8");
  assert.match(source, /Current Release/);
  assert.match(source, /Read-only active ledger snapshot/);
  assert.doesNotMatch(source, />release lock</i);
});
