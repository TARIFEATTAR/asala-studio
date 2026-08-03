import assert from "node:assert/strict";
import { test } from "node:test";

import { calibrateCyl9Authorities } from "./calibrate-cyl9-component-authorities";

const LOCKED_BODY_HASHES = [
  "c84db213449da4ef6afbcb67fad0da5811ae937c3c9c1234be801cb473ea31c3",
  "87804d45a242795aaecf10d677ad469b22803e2f2476421ffbce5d4d944f148c",
  "97cfe967a4ab02ba4de51c07416c80df54244adf8dfab95406a36f4fe90e933f",
  "c844fb9f3a6ffb467daa02d17cb2378b659fc2e0be166f13073bb7b4f8422956",
  "c2b67ee9151dc89d44d3a8d65a112b908bb84a2c833ba0bcf643b16586371e68",
];

test("all 23 CYL-9ML records resolve to a calibrated authority mask", async () => {
  const report = await calibrateCyl9Authorities({ write: false });
  assert.equal(report.components.length, 23);
  assert.equal(report.components.filter((row) => row.status === "approved").length, 23);
  assert.ok(report.components.every((row) => row.expectedRegions === 1));
  assert.ok(report.components.every((row) => row.componentCount === 1));
  assert.ok(report.components.every((row) => row.touchesFrame === false));
});

test("shared geometry is earned by exact alpha, not by applicator label", async () => {
  const report = await calibrateCyl9Authorities({ write: false });
  for (const family of report.geometryFamilies) {
    assert.equal(family.maxAlphaMismatchPixels, 0, family.geometryFamilyId);
  }
  assert.equal(
    report.components.find((row) => row.variantKey === "PLASTIC")?.geometryFamilyId,
    report.components.find((row) => row.variantKey === "METAL")?.geometryFamilyId,
  );
  assert.equal(report.geometryFamilies.find((row) => /rollon-overcap/.test(row.geometryFamilyId))?.members.length, 10);
});

test("calibration preserves the locked bodies and approved cap placement", async () => {
  const report = await calibrateCyl9Authorities({ write: false });
  assert.deepEqual(report.bodyPlateSha256s, LOCKED_BODY_HASHES);
  const capPlacement = report.placements.find((row) => row.geometryFamilyId === "closure__17-415__rollon-overcap__v2");
  assert.deepEqual(capPlacement && {
    widthPx: capPlacement.widthPx,
    centerXPx: capPlacement.centerXPx,
    seatYPx: capPlacement.seatYPx,
  }, { widthPx: 344, centerXPx: 1041, seatYPx: 1002 });
});
