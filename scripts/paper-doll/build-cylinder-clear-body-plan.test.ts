import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("deduplicates the authority-ready Cylinder positions into measured clear-body builds", async () => {
  const outputDirectory = mkdtempSync(path.join(os.tmpdir(), "cylinder-clear-body-plan-"));
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", "scripts/paper-doll/build-cylinder-clear-body-plan.ts", "--out", outputDirectory],
    { cwd: process.cwd(), encoding: "utf8" },
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const plan = JSON.parse(await readFile(path.join(outputDirectory, "cylinder-clear-body-plan.json"), "utf8"));

  assert.deepEqual(plan.summary, {
    catalogCoveragePositionCount: 18,
    authorityReadyDisplayPositionCount: 14,
    uniqueBodyAuthorityCount: 9,
    bodyOnlyCandidateAvailableCount: 7,
    bodyExtractionRequiredCount: 0,
    sourceCalibratedBlenderRequiredCount: 2,
    candidateReadyPositionCount: 2,
    truthDecisionPositionCount: 1,
    exactReferenceRequiredPositionCount: 1,
    paidGenerationRequestCount: 0,
  });
  assert.deepEqual(
    plan.coverageAudit.map((entry: any) => entry.displayKey),
    [
      "spray|3",
      "spray|4",
      "spray|5",
      "spray|9|regular",
      "spray|9|tall",
      "spray|25",
      "spray|50",
      "spray|100",
      "roll-on|5",
      "roll-on|9|classic-20",
      "roll-on|9|classic-21",
      "roll-on|9|regular",
      "roll-on|9|tall",
      "roll-on|28",
      "roll-on|50",
      "reducer|25",
      "reducer|50",
      "reducer|100",
    ],
  );
  assert.ok(plan.coverageAudit.every((entry: any) => entry.productClass === "Cylinder"));
  assert.equal(plan.coverageAudit.some((entry: any) => /glass.?rod|vial/i.test(entry.displayKey)), false);
  assert.equal(plan.coverageAudit.find((entry: any) => entry.displayKey === "spray|25").stage, "authority-build-ready");
  assert.equal(plan.coverageAudit.find((entry: any) => entry.displayKey === "roll-on|28").dimensionsMm.bodyHeight, 81);
  assert.equal(plan.coverageAudit.find((entry: any) => entry.displayKey === "roll-on|50").dimensionsMm.bodyHeight, 98);
  assert.equal(plan.coverageAudit.find((entry: any) => entry.displayKey === "spray|9|tall").dimensionsMm.bodyHeight, 106);
  assert.equal(plan.coverageAudit.find((entry: any) => entry.displayKey === "spray|9|regular").dimensionsMm.bodyHeight, 70);
  assert.equal(plan.coverageAudit.find((entry: any) => entry.displayKey === "roll-on|9|regular").dimensionsMm.bodyHeight, 74);
  assert.equal(plan.coverageAudit.find((entry: any) => entry.displayKey === "roll-on|9|regular").stage, "truth-decision-required");
  assert.equal(
    plan.bodyAuthorities.some((entry: any) => entry.geometryKey === "body__cylinder__9ml__74x21x21.0__c3c136fd9e"),
    false,
  );
  assert.equal(new Set(plan.bodyAuthorities.map((entry: any) => entry.geometryKey)).size, 9);
  assert.deepEqual(
    plan.bodyAuthorities.filter((entry: any) => entry.sourceState === "body-extraction-required").map((entry: any) => entry.geometryKey),
    [],
  );
  assert.deepEqual(
    plan.bodyAuthorities.filter((entry: any) => entry.sourceState === "source-calibrated-blender-required").map((entry: any) => entry.geometryKey),
    [
      "body__cylinder__3ml__37x14x14.0__aa7c8c6e6d",
      "body__cylinder__4ml__49x14x14.0__c3932dacb5",
    ],
  );
  assert.ok(plan.bodyAuthorities.every((entry: any) => entry.materialTarget === "premium-clear-glass"));
  assert.ok(plan.bodyAuthorities.every((entry: any) => entry.geometryLocked === false));
  assert.ok(plan.bodyAuthorities.every((entry: any) => entry.authorityMaskIncludesGroundShadow === false));
  assert.ok(plan.bodyAuthorities.every((entry: any) => entry.gptMaterialPass.requiresExplicitPaidAuthorization === true));
  assert.equal(plan.opticalBenchmark.sha256, "97cfe967a4ab02ba4de51c07416c80df54244adf8dfab95406a36f4fe90e933f");
  assert.equal(plan.canvas.widthPx, 2080);
  assert.equal(plan.canvas.heightPx, 2288);
  assert.equal(plan.registration.centerX, 1040);
  assert.equal(plan.registration.baselineY, 2082);
  assert.equal(plan.mutationPolicy.currentReleaseChanged, false);
  assert.equal(plan.mutationPolicy.sanityChanged, false);
});
