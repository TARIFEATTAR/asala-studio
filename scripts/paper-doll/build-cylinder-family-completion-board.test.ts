import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("builds one completion row for every Cylinder display position without hiding truth blockers", async () => {
  const outputDirectory = mkdtempSync(path.join(os.tmpdir(), "cylinder-completion-board-"));
  const result = spawnSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "scripts/paper-doll/build-cylinder-family-completion-board.ts",
      "--out",
      outputDirectory,
    ],
    { cwd: process.cwd(), encoding: "utf8" },
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const board = JSON.parse(await readFile(path.join(outputDirectory, "cylinder-family-completion-board.json"), "utf8"));

  assert.deepEqual(board.summary, {
    positionCount: 18,
    candidateReadyForNamedApprovalCount: 2,
    authorityBuildReadyCount: 14,
    truthDecisionRequiredCount: 1,
    exactReferenceRequiredCount: 1,
    productionReleasedCount: 0,
  });
  assert.equal(new Set(board.positions.map((position: any) => position.displayKey)).size, 18);
  assert.deepEqual(
    board.positions.filter((position: any) => position.stage === "exact-reference-required").map((position: any) => position.displayKey),
    ["roll-on|9|classic-21"],
  );
  const byKey = new Map(board.positions.map((position: any) => [position.displayKey, position]));
  assert.ok((byKey.get("spray|5") as any).bodyHeightMm > (byKey.get("spray|4") as any).bodyHeightMm);
  assert.equal((byKey.get("roll-on|9|classic-20") as any).stage, "candidate-ready-for-named-approval");
  for (const required of ["spray|25", "roll-on|28", "roll-on|50"]) assert.ok(byKey.has(required));
  assert.ok(board.positions.every((position: any) => !/glass[ -]?rod|vial/i.test(`${position.displayKey} ${position.label}`)));
  const regularNineRollOn = board.positions.find((position: any) => position.displayKey === "roll-on|9|regular");
  assert.equal(regularNineRollOn.stage, "truth-decision-required");
  assert.ok(regularNineRollOn.evidencePaths.includes("docs/paper-doll-rig/body-plate-registry.json"));
  assert.match(regularNineRollOn.nextGate, /five locked 70 × 20 mm plates/i);
  assert.match(regularNineRollOn.nextGate, /reference-only/i);
  assert.ok(board.positions.every((position: any) => position.bodyAuthorityKey));
  assert.ok(board.positions.every((position: any) => position.requiredResponsibilities.length > 0));
  assert.ok(board.positions.every((position: any) => position.nextGate));
  assert.equal(board.mutationPolicy.currentReleaseChanged, false);
  assert.equal(board.mutationPolicy.sanityChanged, false);
});
