import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import test from "node:test";
import { tmpdir } from "node:os";
import path from "node:path";

test("CYL-9ML local candidate materializer plans only the seven deterministic jobs", () => {
  const result = spawnSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "scripts/paper-doll/materialize-cyl9-local-candidates.ts",
      "--plan",
    ],
    { cwd: process.cwd(), encoding: "utf8" },
  );

  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout) as {
    mode: string;
    plannedCandidates: number;
    providerCounts: Record<string, number>;
    mutationPolicy: Record<string, boolean>;
  };
  assert.equal(output.mode, "plan");
  assert.equal(output.plannedCandidates, 7);
  assert.deepEqual(output.providerCounts, { deterministic: 7 });
  assert.deepEqual(output.mutationPolicy, {
    approvalsWritten: false,
    placementsWritten: false,
    currentReleaseChanged: false,
    sanityChanged: false,
  });
});

test("CYL-9ML local materialization creates seven exact-alpha candidates without approvals", () => {
  const outputDirectory = mkdtempSync(path.join(tmpdir(), "cyl9-local-candidates-"));
  try {
    const result = spawnSync(
      process.execPath,
      [
        "--import",
        "tsx",
        "scripts/paper-doll/materialize-cyl9-local-candidates.ts",
        "--execute",
        "--confirmation",
        "CYL9-LOCAL-CANDIDATES",
        "--output",
        outputDirectory,
      ],
      { cwd: process.cwd(), encoding: "utf8" },
    );
    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout) as {
      materializedCandidates: number;
      indexPath: string;
    };
    assert.equal(output.materializedCandidates, 7);

    const index = JSON.parse(readFileSync(output.indexPath, "utf8")) as {
      artifacts: Array<{
        lifecycleState: string;
        geometryLocked: boolean;
        mismatchedPixels: number;
      }>;
      mutationPolicy: Record<string, boolean>;
    };
    assert.equal(index.artifacts.length, 7);
    assert.ok(index.artifacts.every(({ lifecycleState }) => lifecycleState === "candidate"));
    assert.ok(index.artifacts.every(({ geometryLocked }) => geometryLocked));
    assert.ok(index.artifacts.every(({ mismatchedPixels }) => mismatchedPixels === 0));
    assert.deepEqual(index.mutationPolicy, {
      approvalsWritten: false,
      placementsWritten: false,
      currentReleaseChanged: false,
      sanityChanged: false,
    });
  } finally {
    rmSync(outputDirectory, { recursive: true, force: true });
  }
});
