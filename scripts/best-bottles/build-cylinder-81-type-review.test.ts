import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, cp, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, it } from "node:test";

import { buildCylinder81TypeReviewArtifacts } from "./build-cylinder-81-type-review";

const projectRoot = resolve(import.meta.dirname, "../..");
const sourcePaths = {
  coverageArtifactPath: resolve(
    projectRoot,
    "tmp/best-bottles-reference-production/cylinder-coverage-manifest-v1/cylinder-approved-coverage-manifest.json",
  ),
  canonicalMasterPath: resolve(
    projectRoot,
    "docs/best-bottles-canonical-truth/best-bottles-master-truth.csv",
  ),
  reviewedManifestPath: resolve(
    projectRoot,
    "tmp/best-bottles-reference-production/psd-cap-state-audit-v1/reviewed-manifest.json",
  ),
};

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function copyFixture() {
  const root = await mkdtemp(join(tmpdir(), "best-bottles-cylinder-81-review-"));
  const coverageArtifactPath = join(root, "coverage.json");
  const canonicalMasterPath = join(root, "canonical.csv");
  const reviewedManifestPath = join(root, "reviewed.json");
  const outputRoot = join(root, "cylinder-81-type-review-v1");
  await Promise.all([
    cp(sourcePaths.coverageArtifactPath, coverageArtifactPath),
    cp(sourcePaths.canonicalMasterPath, canonicalMasterPath),
    cp(sourcePaths.reviewedManifestPath, reviewedManifestPath),
  ]);
  return { root, coverageArtifactPath, canonicalMasterPath, reviewedManifestPath, outputRoot };
}

describe("build Cylinder 81-type review artifacts", () => {
  it("writes exactly three local JSON artifacts with source hashes and unchanged inputs", async () => {
    const fixture = await copyFixture();
    try {
      const inputPaths = [
        fixture.coverageArtifactPath,
        fixture.canonicalMasterPath,
        fixture.reviewedManifestPath,
      ];
      const before = await Promise.all(inputPaths.map(async (path) => sha256(await readFile(path))));
      const result = await buildCylinder81TypeReviewArtifacts(fixture);

      assert.deepEqual(result.summary, {
        canonicalIdentityCount: 377,
        typeCount: 81,
        readyTypeCount: 41,
        blockedTypeCount: 40,
        blockedIdentityCount: 216,
        collapseCandidateCount: 6,
        appliedCollapseCount: 0,
        externalWriteCount: 0,
      });
      assert.deepEqual((await readdir(fixture.outputRoot)).sort(), [
        "cylinder-216-blocker-report.json",
        "cylinder-81-type-review-manifest.json",
        "cylinder-six-collapse-candidates.json",
      ]);

      const artifacts = await Promise.all(Object.values(result.artifactPaths).map(async (path) => (
        JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>
      )));
      for (const artifact of artifacts) {
        const provenance = artifact.provenance as {
          inputs: Record<string, { path: string; sha256: string }>;
        };
        assert.deepEqual(Object.keys(provenance.inputs).sort(), [
          "canonicalMaster",
          "coverageArtifact",
          "reviewedManifest",
        ]);
        for (const input of Object.values(provenance.inputs)) {
          assert.ok(input.path.startsWith("/"));
          assert.match(input.sha256, /^[a-f0-9]{64}$/);
        }
      }

      const after = await Promise.all(inputPaths.map(async (path) => sha256(await readFile(path))));
      assert.deepEqual(after, before);
      assert.deepEqual([
        result.provenance.inputs.coverageArtifact.sha256,
        result.provenance.inputs.canonicalMaster.sha256,
        result.provenance.inputs.reviewedManifest.sha256,
      ], before);
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  });

  it("rejects a reviewed-unit identity mismatch before creating the output root", async () => {
    const fixture = await copyFixture();
    try {
      const coverageArtifact = JSON.parse(await readFile(fixture.coverageArtifactPath, "utf8"));
      const reviewedManifest = JSON.parse(await readFile(fixture.reviewedManifestPath, "utf8"));
      const reviewUnitKey = coverageArtifact.manifest.rows[0].primaryReference.reviewUnitKey;
      const reviewedUnit = reviewedManifest.find((unit: { reviewUnitKey: string }) => (
        unit.reviewUnitKey === reviewUnitKey
      ));
      assert.ok(reviewedUnit);
      reviewedUnit.graceSku = "CONFLICTING-GRACE-SKU";
      reviewedUnit.sources[0].graceSku = "CONFLICTING-GRACE-SKU";
      await writeFile(fixture.reviewedManifestPath, `${JSON.stringify(reviewedManifest, null, 2)}\n`);

      await assert.rejects(
        buildCylinder81TypeReviewArtifacts(fixture),
        /reviewed-unit dual-SKU.*mismatch/i,
      );
      assert.equal(await exists(fixture.outputRoot), false);
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  });
});
