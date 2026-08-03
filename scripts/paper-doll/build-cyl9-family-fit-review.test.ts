import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import test from "node:test";
import { tmpdir } from "node:os";
import path from "node:path";

import { mergeCyl9CandidateArtifacts } from "./build-cyl9-family-fit-review";

test("complete review merges seven deterministic and fourteen generated candidates in catalog order", () => {
  const componentOrder = Array.from({ length: 21 }, (_, index) => `component-${index}`);
  const artifact = (componentKey: string) => ({
    componentKey,
    variantKey: componentKey,
    candidateId: componentKey,
    paths: { layerPath: `${componentKey}.png`, manifestPath: `${componentKey}.json` },
  });
  const deterministic = componentOrder.slice(0, 7).reverse().map(artifact);
  const generated = componentOrder.slice(7).reverse().map(artifact);
  const merged = mergeCyl9CandidateArtifacts({ deterministic, generated, componentOrder });
  assert.deepEqual(merged.map(({ componentKey }) => componentKey), componentOrder);
  assert.throws(
    () => mergeCyl9CandidateArtifacts({
      deterministic,
      generated: [...generated, artifact(componentOrder[0])],
      componentOrder,
    }),
    /duplicate/i,
  );
});

test("CYL-9ML review bundle renders seven candidates across all five locked bodies", () => {
  const root = mkdtempSync(path.join(tmpdir(), "cyl9-family-fit-"));
  const materialized = path.join(root, "materialized");
  const review = path.join(root, "review");
  try {
    const materializeResult = spawnSync(
      process.execPath,
      [
        "--import", "tsx",
        "scripts/paper-doll/materialize-cyl9-local-candidates.ts",
        "--execute",
        "--confirmation", "CYL9-LOCAL-CANDIDATES",
        "--output", materialized,
      ],
      { cwd: process.cwd(), encoding: "utf8" },
    );
    assert.equal(materializeResult.status, 0, materializeResult.stderr);

    const reviewResult = spawnSync(
      process.execPath,
      [
        "--import", "tsx",
        "scripts/paper-doll/build-cyl9-family-fit-review.ts",
        "--materialized", materialized,
        "--output", review,
      ],
      { cwd: process.cwd(), encoding: "utf8" },
    );
    assert.equal(reviewResult.status, 0, reviewResult.stderr);
    const output = JSON.parse(reviewResult.stdout) as {
      candidateCount: number;
      assemblyCount: number;
      lineupCount: number;
      contactSheetPath: string;
      manifestPath: string;
    };
    assert.equal(output.candidateCount, 7);
    assert.equal(output.assemblyCount, 35);
    assert.equal(output.lineupCount, 7);
    assert.ok(existsSync(output.contactSheetPath));

    const manifest = JSON.parse(readFileSync(output.manifestPath, "utf8")) as {
      lifecycleState: string;
      candidates: Array<{ geometryLocked: boolean; mismatchedPixels: number }>;
      mutationPolicy: Record<string, boolean>;
    };
    assert.equal(manifest.lifecycleState, "family-fit-review-required");
    assert.ok(manifest.candidates.every(({ geometryLocked }) => geometryLocked));
    assert.ok(manifest.candidates.every(({ mismatchedPixels }) => mismatchedPixels === 0));
    assert.deepEqual(manifest.mutationPolicy, {
      approvalsWritten: false,
      placementsWritten: false,
      currentReleaseChanged: false,
      sanityChanged: false,
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
