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

test("shot list records local parametric profile candidates without counting them as approved authority", async () => {
  const shotList = await buildMasterPlateShotList();
  const candidates = shotList.rows.filter((row) => row.authorityStatus === "dimension-calibrated-profile-review-candidate");
  assert.equal(candidates.length, 21);
  assert.deepEqual(new Set(candidates.map((row) => row.sourceIdentity)), new Set([
    "CPRoll13-415BlackDot",
    "CPRoll13-415BlkSh",
    "CPRoll13-415Cu",
    "CPRoll13-415GlMt",
    "CPRoll13-415GlSh",
    "CPRoll13-415PinkDot",
    "CPRoll13-415SlDot",
    "CPRoll13-415SlMt",
    "CPRoll13-415SlSh",
    "CP13-415Gl",
    "CP13-415Sl",
    "CP15-415ShnGl",
    "CP15-415ShnSl",
    "CP18-415MtSl",
    "CP18-415ShnGl",
    "CP18-415ShnSl",
    "CP18-415MtSlTall",
    "CP18-415ShnBlkTall",
    "CP8-425TallBlack",
    "CP8-425TallShnGl",
    "CP8-425TallShnSl",
  ]));
  assert.ok(candidates.every((row) => row.status === "needs-authority"));
  assert.ok(candidates.every((row) => row.existingAssetPaths.some((assetPath) => assetPath.endsWith("-family-recipe.json"))));
  assert.equal(shotList.summary.exactSourceBackedExistingCount, 22);
});
