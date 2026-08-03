import assert from "node:assert/strict";
import { test } from "node:test";

import { buildMasterPlateShotList } from "./build-master-plate-shot-list";

test("master shot list proves the limited reusable plate ceiling", async () => {
  const shotList = await buildMasterPlateShotList();
  assert.equal(shotList.summary.sourceBackedPlateCount, 309);
  assert.equal(shotList.summary.bodyAppearancePlateCount, 161);
  assert.equal(shotList.summary.explicitComponentPlateCount, 148);
  assert.equal(shotList.summary.supplementalExistingCount, 6);
  assert.equal(shotList.summary.missingSourceResponsibilityCount, 3);
  assert.equal(shotList.summary.operationalRowCount, 318);
  assert.equal(shotList.rows.filter((row) => row.recordType === "body-appearance").length, 161);
  assert.equal(shotList.rows.filter((row) => row.recordType === "component-source").length, 148);
  assert.equal(new Set(shotList.rows.map((row) => row.shotId)).size, shotList.rows.length);
});

test("shot list distinguishes exact coverage from supplemental local assets", async () => {
  const shotList = await buildMasterPlateShotList();
  assert.equal(shotList.summary.exactSourceBackedExistingCount, 22);
  assert.equal(shotList.summary.exactSourceBackedOutstandingCount, 287);
  assert.equal(shotList.rows.filter((row) => row.recordType === "supplemental-existing" && row.plateType === "body").length, 2);
  assert.equal(shotList.rows.filter((row) => row.recordType === "supplemental-existing" && row.plateType !== "body").length, 4);
  assert.ok(shotList.rows.filter((row) => row.recordType === "source-gap").every((row) => row.status === "needs-source"));
});
