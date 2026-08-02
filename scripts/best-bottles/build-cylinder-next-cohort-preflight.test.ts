import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import type { CylinderNextCohortPreflightArtifact } from "../../src/lib/bestBottlesCylinderNextCohortPreflight";
import { writeAddressedCylinderNextCohortPreflight } from "./build-cylinder-next-cohort-preflight";

function artifact(): CylinderNextCohortPreflightArtifact {
  return {
    workflowVersion: "best-bottles-cylinder-next-cohort-preflight-v1",
    inputSetSha256: "a".repeat(64),
    authority: {
      plan: {
        semanticSha256: "b".repeat(64),
        recomputedSemanticSha256: "b".repeat(64),
        runAncestorSha256: "b".repeat(64),
        fileSha256: "c".repeat(64),
      },
      compileAll: {
        fileSha256: "d".repeat(64),
        declaredPlanFileSha256: "c".repeat(64),
        declaredCanonicalProductTruthFileSha256: "e".repeat(64),
      },
      canonicalProductTruth: {
        path: "docs/best-bottles-canonical-truth/best-bottles-master-truth.csv",
        fileSha256: "e".repeat(64),
      },
    },
    identityCount: 4,
    jobCount: 8,
    identities: [],
    jobs: [],
    outputContract: { format: "png", width: 2080, height: 2288, opaque: true },
    generationStatus: "not-started",
    humanVisualApproval: "not-recorded",
    promotionStatus: "not-promoted",
    externalWriteCount: 0,
  };
}

describe("next Cylinder cohort addressed artifact writer", () => {
  it("writes once and accepts an existing address only when JSON and HTML bytes match", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "next-cylinder-preflight-"));
    try {
      const first = await writeAddressedCylinderNextCohortPreflight(root, artifact());
      const jsonBefore = await readFile(first.manifestPath);
      const htmlBefore = await readFile(first.htmlPath);
      const second = await writeAddressedCylinderNextCohortPreflight(root, artifact());

      assert.equal(second.outputDirectory, first.outputDirectory);
      assert.deepEqual(await readFile(second.manifestPath), jsonBefore);
      assert.deepEqual(await readFile(second.htmlPath), htmlBefore);
      assert.match(first.manifestSha256, /^[a-f0-9]{64}$/);
      assert.match(first.htmlSha256, /^[a-f0-9]{64}$/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects mutated bytes at an existing hash address", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "next-cylinder-preflight-"));
    try {
      const first = await writeAddressedCylinderNextCohortPreflight(root, artifact());
      await writeFile(first.htmlPath, "mutated\n");
      await assert.rejects(
        writeAddressedCylinderNextCohortPreflight(root, artifact()),
        /existing addressed HTML bytes/i,
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
