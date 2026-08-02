import assert from "node:assert/strict";
import test from "node:test";

import {
  canPaintSelection,
  canPersistTransform,
  displayRectToRelease,
  displayToRelease,
  releaseToDisplay,
  shouldShowGeometryLocked,
} from "./assemblyEditModel";

test("display coordinates round-trip to the 2080x2288 release canvas", () => {
  const display = { width: 520, height: 572 };
  const point = displayToRelease({ x: 260, y: 286 }, display);
  assert.deepEqual(point, { x: 1040, y: 1144 });
  assert.deepEqual(releaseToDisplay(point, display), { x: 260, y: 286 });
});

test("rectangle selection is normalized and clamped to the release canvas", () => {
  assert.deepEqual(
    displayRectToRelease(
      { left: 300, top: 500, right: -20, bottom: 50 },
      { width: 520, height: 572 },
    ),
    { left: 0, top: 200, right: 1200, bottom: 2000 },
  );
});

test("release-lock cannot paint or persist transforms", () => {
  assert.equal(canPaintSelection("release-lock"), false);
  assert.equal(canPersistTransform({ mode: "release-lock", createsCandidate: true }), false);
  assert.equal(canPaintSelection("edit-lab"), true);
  assert.equal(canPersistTransform({ mode: "edit-lab", createsCandidate: true }), true);
  assert.equal(canPersistTransform({ mode: "edit-lab", createsCandidate: false }), false);
});

test("geometry locked label requires exact server mask identity", () => {
  assert.equal(shouldShowGeometryLocked({ geometryLocked: true, geometryGate: "exact-authoritative-mask-alpha" }), true);
  assert.equal(shouldShowGeometryLocked({ geometryLocked: true, geometryGate: "reference-anchored" }), false);
  assert.equal(shouldShowGeometryLocked({ geometryLocked: false, geometryGate: "exact-authoritative-mask-alpha" }), false);
});
