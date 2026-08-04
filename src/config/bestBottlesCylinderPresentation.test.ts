import assert from "node:assert/strict";
import test from "node:test";

import {
  CYLINDER_PAPER_DOLL_PRESENTATION_POSITIONS,
  resolveCylinderPaperDollPresentation,
} from "./bestBottlesCylinderPresentation";

test("covers every reviewed Cylinder applicator display position without collapsing distinct systems", () => {
  assert.equal(CYLINDER_PAPER_DOLL_PRESENTATION_POSITIONS.length, 18);
  assert.equal(
    CYLINDER_PAPER_DOLL_PRESENTATION_POSITIONS.filter((position) => position.status === "ready").length,
    17,
  );
  assert.equal(
    CYLINDER_PAPER_DOLL_PRESENTATION_POSITIONS.filter((position) => position.status === "blocked").length,
    1,
  );
});

test("reuses the exact locked 70x20 body for the classic 9 ml roll-on without collapsing 70x21 or 74x21", () => {
  const spray = resolveCylinderPaperDollPresentation("spray|9|regular");
  const classic = resolveCylinderPaperDollPresentation("roll-on|9|classic-20");
  const regular = resolveCylinderPaperDollPresentation("roll-on|9|regular");

  assert.equal(spray.bodyHeightMm, 70);
  assert.equal(classic.bodyHeightMm, 70);
  assert.equal(classic.capacityMl, 9);
  assert.equal(regular.bodyHeightMm, 74);
  assert.throws(
    () => resolveCylinderPaperDollPresentation("roll-on|9|classic-21"),
    /blocked.*no exact supplied or approved reference/i,
  );
});

test("keeps the tall 9 ml 13-415 spray distinct from the regular 9 ml spray", () => {
  const regular = resolveCylinderPaperDollPresentation("spray|9|regular");
  const tall = resolveCylinderPaperDollPresentation("spray|9|tall");

  assert.equal(regular.assembledHeightMm, 96);
  assert.equal(regular.targetAssembledHeightPct, 69);
  assert.equal(tall.assembledHeightMm, 111);
  assert.equal(tall.targetAssembledHeightPct, 71);
  assert.equal(tall.familyCorrectionPct, 2);
  assert.ok(tall.targetAssembledHeightPct > regular.targetAssembledHeightPct);
  assert.ok(tall.bodyHeightMm > regular.bodyHeightMm * 1.5);
  assert.ok(tall.bodyHeightMm > resolveCylinderPaperDollPresentation("roll-on|9|regular").bodyHeightMm * 1.4);
});

test("resolves the approved big roll-on and spray coverage positions", () => {
  const expected = [
    ["roll-on|28", 100, 74],
    ["roll-on|50", 116, 78],
    ["spray|25", 108, 73.210526],
    ["spray|50", 142, 78],
    ["spray|100", 195, 79],
  ] as const;

  for (const [displayKey, assembledHeightMm, targetAssembledHeightPct] of expected) {
    const profile = resolveCylinderPaperDollPresentation(displayKey);
    assert.equal(profile.status, "ready");
    assert.equal(profile.assembledHeightMm, assembledHeightMm);
    assert.equal(profile.targetAssembledHeightPct, targetAssembledHeightPct);
    assert.equal(profile.transformScope, "complete-paper-doll-assembly");
  }
});

test("refuses blocked or unknown display positions", () => {
  assert.throws(
    () => resolveCylinderPaperDollPresentation("roll-on|9|classic-21"),
    /blocked.*no exact supplied or approved reference/i,
  );
  assert.throws(
    () => resolveCylinderPaperDollPresentation("spray|250"),
    /unknown Cylinder paper-doll display position/i,
  );
});
