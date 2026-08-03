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
  assert.equal(rows.filter((row) => row.authorityStatus === "approved").length, 23);
  assert.equal(rows.every((row) => row.authority !== null), true);
  assert.equal(rows.every((row) => row.nextAction === "Generate or upload candidate"), true);
});

test("a newer candidate is reviewable even when an older version reached release", () => {
  const manifest = loadCyl9ComponentFactory();
  const component = manifest.components[0];
  const variant = component.variants[0];
  const base = {
    familyKey: manifest.familyKey,
    componentKey: component.componentKey,
    variantKey: variant.variantKey,
    source: component.source,
    sourceBoundsPx: { left: 0, top: 0, width: component.source.widthPx, height: component.source.heightPx },
    editBoundsPx: { left: 0, top: 0, width: component.source.widthPx, height: component.source.heightPx },
    authorityBoundsPx: component.authority!.authorityBoundsPx,
    placementBoundsPx: component.authority!.authorityBoundsPx,
    authorityMaskPath: component.authority!.maskPath,
    authorityMaskSha256: component.authority!.maskSha256,
    normalizedCandidateSha256: "a".repeat(64),
    fullCanvasLayerSha256: "a".repeat(64),
    placementVersionId: null,
    provider: "manual" as const,
    model: "manual-v1",
    promptSha256: null,
    estimatedCostUsd: null,
    qa: { geometryLocked: true, minIoU: 1, mismatchedPixels: 0 },
    mutationPolicy: { currentReleaseChanged: false as const, sanityChanged: false as const },
  };
  const rows = buildComponentWorkbenchRows({
    manifest,
    releaseAssets: [],
    sanitySyncs: [],
    candidates: [
      { ...base, candidateId: "old-released", lifecycleState: "released", createdAt: "2026-08-02T12:00:00Z" },
      { ...base, candidateId: "new-review", lifecycleState: "candidate", createdAt: "2026-08-03T12:00:00Z" },
    ],
  });
  assert.equal(rows[0].candidate?.candidateId, "new-review");
  assert.equal(rows[0].nextAction, "Approve Pixels");
});
