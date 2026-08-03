import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildComponentStatus,
  buildComponentWorkbenchRows,
} from "./componentWorkbenchModel";
import { loadCyl9ComponentFactory } from "./cyl9ComponentFactory";

test("inventory distinguishes missing authority from a clean candidate with quarantined ancestry", () => {
  assert.equal(buildComponentStatus({
    authorityStatus: "missing",
    lifecycleState: null,
    currentCandidateFailed: false,
    quarantinedAncestor: false,
  }).tone, "blocked");

  const status = buildComponentStatus({
    authorityStatus: "approved",
    lifecycleState: "candidate",
    currentCandidateFailed: false,
    quarantinedAncestor: true,
  });
  assert.equal(status.tone, "candidate");
  assert.equal(status.ancestorNotice, "Old release ancestor quarantined");
  assert.equal(status.blockers.length, 0);
});

test("component workbench expands all 23 CYL-9ML plates without confusing variants with geometry", () => {
  const manifest = loadCyl9ComponentFactory();
  const rows = buildComponentWorkbenchRows({ manifest, candidates: [], releaseAssets: [], sanitySyncs: [] });
  assert.equal(rows.length, 23);
  assert.deepEqual(
    rows.reduce<Record<string, number>>((counts, row) => {
      counts[row.slot] = (counts[row.slot] ?? 0) + 1;
      return counts;
    }, {}),
    { cap: 10, roller: 2, sprayer: 6, pump: 3, overcap: 2 },
  );
  assert.equal(rows.filter((row) => row.authorityStatus === "missing").length, 23);
  assert.equal(rows.every((row) => row.nextAction === "Register geometry authority"), true);
});
