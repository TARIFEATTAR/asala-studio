import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { describe, it } from "node:test";

const execFileAsync = promisify(execFile);
const SCRIPT_PATH = path.resolve(
  "scripts/best-bottles/render-cylinder-spray-cap-off-sidecar-curve.ts",
);
const MANIFEST_PATH = path.resolve(
  "tmp/best-bottles-reference-production/cylinder-spray-six-cap-off-sidecar-curve-v1/manifest.json",
);

describe("Cylinder six-spray true cap-off sidecar curve", () => {
  it("renders six exact role-clean references from canonical body geometry", async () => {
    assert.equal(
      existsSync(SCRIPT_PATH),
      true,
      "true cap-off sidecar renderer has not been implemented",
    );

    await execFileAsync("npx", ["tsx", SCRIPT_PATH], {
      cwd: path.resolve("."),
    });

    const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
    assert.equal(manifest.version, "best-bottles-cylinder-spray-six-cap-off-sidecar-curve-v1");
    assert.equal(manifest.constraints.family, "Cylinder");
    assert.equal(manifest.constraints.applicator, "spray");
    assert.equal(manifest.constraints.capState, "cap-off-sidecar");
    assert.equal(manifest.constraints.crossApplicatorSubstitution, false);
    assert.equal(manifest.constraints.aiReconstruction, false);
    assert.equal(manifest.constraints.productPixelMutation, "uniform-scale-only");
    assert.equal(manifest.scaleContract.pixelsPerMm, 6);

    assert.deepEqual(
      manifest.entries.map((entry: any) => ({
        websiteSku: entry.websiteSku,
        capacityMl: entry.capacityMl,
        bodyHeightMm: entry.canonicalGeometry.bodyHeightMm,
        targetBodyHeightPx: entry.renderedGeometry.targetBodyHeightPx,
        capState: entry.role.capState,
        topology: entry.role.topology,
        status: entry.status,
      })),
      [
        { websiteSku: "GBSpry3mlClBlk", capacityMl: 3, bodyHeightMm: 37, targetBodyHeightPx: 222, capState: "cap-off", topology: "sprayer-attached-cap-detached-sidecar", status: "ready" },
        { websiteSku: "GBCylBlu5SpryBlkSh", capacityMl: 5, bodyHeightMm: 53, targetBodyHeightPx: 318, capState: "cap-off", topology: "sprayer-attached-cap-detached-sidecar", status: "ready" },
        { websiteSku: "GBCylAmb9SpryBlk", capacityMl: 9, bodyHeightMm: 70, targetBodyHeightPx: 420, capState: "cap-off", topology: "sprayer-attached-cap-detached-sidecar", status: "ready" },
        { websiteSku: "GBcyl25SpryShnBlk", capacityMl: 25, bodyHeightMm: 83, targetBodyHeightPx: 498, capState: "cap-off", topology: "sprayer-attached-cap-detached-sidecar", status: "ready" },
        { websiteSku: "GBCyl50SpryShnBlk", capacityMl: 50, bodyHeightMm: 117, targetBodyHeightPx: 702, capState: "cap-off", topology: "sprayer-attached-cap-detached-sidecar", status: "ready" },
        { websiteSku: "GBCyl100SpryShnBlk", capacityMl: 100, bodyHeightMm: 154, targetBodyHeightPx: 924, capState: "cap-off", topology: "sprayer-attached-cap-detached-sidecar", status: "ready" },
      ],
    );

    for (const entry of manifest.entries) {
      assert.equal(entry.canonicalGeometry.source, "best-bottles-master-truth.csv:canon_*");
      assert.equal(entry.sourceEvidence.identityApproved, true);
      assert.equal(entry.sourceEvidence.capOffSidecarApproved, true);
      assert.equal(entry.renderedGeometry.observedBodyHeightPx, entry.renderedGeometry.targetBodyHeightPx);
      assert.equal(entry.renderedGeometry.baselineY, manifest.scaleContract.baselineY);
    }
  });
});
