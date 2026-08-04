import assert from "node:assert/strict";
import test from "node:test";

import { buildCyl9CappedDispenserPlacementLock } from "./lock-cyl9-capped-dispenser-placement";

const variants = {
  sprayer: ["GLD", "MSLV", "BLK", "SSLV", "RED", "TUR"],
  pump: ["MSLV", "GLD", "BLK"],
} as const;

function validInput() {
  const candidates = (Object.entries(variants) as Array<["sprayer" | "pump", readonly string[]]>).flatMap(([lane, keys]) => keys.map((variantKey) => ({
    lane,
    variantKey,
    candidatePath: `/${lane}/${variantKey}.png`,
    candidateSha256: `${lane}-${variantKey}`,
    authorityPath: `/${lane}/authority.png`,
    authoritySha256: `${lane}-authority`,
    placementBoundsPx: lane === "sprayer"
      ? { left: 868, top: 329, width: 346, height: 673 }
      : { left: 868, top: 323, width: 346, height: 679 },
    qa: { alphaMismatchedPixels: 0, exactMaskClampVerified: true },
  })));
  return {
    sourceManifestPath: "/manifest.json",
    sourceManifestSha256: "manifest-sha",
    sourceManifest: {
      state: "named-five-body-visual-review-required",
      calibration: { targetWidthPx: 346, centerXPx: 1041, seatYPx: 1002 },
      candidates,
      qa: { exactMaskClampVerified: true, fiveBodyAssemblyContextRendered: true },
      mutationPolicy: { remoteWritesPerformed: false, currentReleaseChanged: false, sanityChanged: false },
    },
    bodies: Array.from({ length: 5 }, (_, index) => ({
      id: `body-${index}`,
      asset: { path: `/body-${index}.png`, sha256: `body-sha-${index}`, widthPx: 2080, heightPx: 2288 },
    })),
    approvedByName: "Jordan Richter",
    approvedAt: "2026-08-04T10:30:00.000Z",
    approvalNote: "Approved capped dispenser fit across all five body plates.",
  };
}

test("creates a content-addressed local placement lock with 45 explicit rows", () => {
  const lock = buildCyl9CappedDispenserPlacementLock(validInput());
  assert.equal(lock.lifecycleState, "placement-locked");
  assert.equal(lock.components.length, 9);
  assert.equal(lock.bodyPlates.length, 5);
  assert.equal(lock.placementRows.length, 45);
  assert.ok(lock.components.every(({ geometryLocked }) => geometryLocked));
  assert.equal(lock.persistence.remoteDatabaseWritten, false);
  assert.equal(lock.releaseState.currentReleaseChanged, false);
});

test("rejects a candidate whose exact authority alpha is not proven", () => {
  const input = validInput();
  input.sourceManifest.candidates[0].qa.alphaMismatchedPixels = 1;
  assert.throws(() => buildCyl9CappedDispenserPlacementLock(input), /exact-alpha approval/);
});
