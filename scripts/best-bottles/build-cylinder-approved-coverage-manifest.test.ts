import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { buildCylinderApprovedCoverageArtifacts } from "./build-cylinder-approved-coverage-manifest";

const canonicalMasterCsv = [
  "graceSku,websiteSku,productGroupSlug,family,capacityMl,canon_bodyHeightMm,canon_widthAxisMm,canon_secondAxisMm,canon_heightWithCapMm,notes",
  'GB-CYL-CLR-9ML-SPR-BLK,GBCyl9SpryBlk,cylinder-9ml-clear-17-415-finemist,Cylinder,9,70,20,20,96,"quoted, canonical ""note"""',
  "GB-TALL-CLR-10ML-SPR-BLK,GBTall10SpryBlk,tall-cylinder-10ml-clear-18-415-finemist,Tall Cylinder,10,80,22,22,106,unreferenced",
].join("\n");

const bodyGeometryCsv = [
  "family,capacityMl,bodyHeightMm,widthAxisMm,depthAxisMm,productGroupSlugs",
  "Cylinder,9,70,20,20,cylinder-9ml-clear-17-415-finemist",
  "Tall Cylinder,10,80,22,22,tall-cylinder-10ml-clear-18-415-finemist",
].join("\n");

function reviewedManifest(options: {
  sourceIdentityStatus?: string;
  sourceGraceSku?: string;
} = {}): string {
  const sourceIdentityStatus = options.sourceIdentityStatus ?? "exact-website-sku";
  const sourceGraceSku = options.sourceGraceSku ?? "GB-CYL-CLR-9ML-SPR-BLK";
  return JSON.stringify([{
    reviewUnitKey: "a".repeat(64) + "|GBCYL9SPRYBLK",
    sourceSha256: "a".repeat(64),
    websiteSku: "GBCyl9SpryBlk",
    graceSku: "GB-CYL-CLR-9ML-SPR-BLK",
    family: "Cylinder",
    canonicalReviewMetadata: {},
    identityStatus: "exact-website-sku",
    classification: "assembled-cap-on",
    reviewStatus: "approved",
    reviewer: { kind: "human", identity: "Reviewer" },
    reviewedAt: "2026-07-12T18:00:00.000Z",
    notes: "Approved source.",
    sources: [{
      sourcePath: "/audit/GBCyl9SpryBlk.psd",
      sourceRelativePath: "GBCyl9SpryBlk.psd",
      sourceSha256: "a".repeat(64),
      sourceBytes: 1,
      family: "Cylinder",
      canonicalReviewMetadata: {},
      identityStatus: sourceIdentityStatus,
      websiteSku: "GBCyl9SpryBlk",
      graceSku: sourceGraceSku,
      aliasProvenance: sourceIdentityStatus === "reviewed-alias" ? {
        observedAliasToken: "LegacyCylinder9",
        canonicalWebsiteSku: "GBCyl9SpryBlk",
        canonicalGraceSku: sourceGraceSku,
        reviewer: { kind: "human", identity: "Reviewer" },
        reviewedAt: "2026-07-12T18:00:00.000Z",
      } : null,
      identityReasons: [],
      composite: {
        width: 1000,
        height: 1300,
        opaque: false,
        sceneCount: 1,
        foregroundBounds: null,
        largeForegroundComponentCount: 1,
        whiteCornerCount: 0,
        minimumSafeMarginPct: 10,
        previewPath: "/audit/GBCyl9SpryBlk.png",
        evidenceSha256: "b".repeat(64),
      },
      machineTriage: {
        proposedClassification: "assembled-cap-on",
        confidence: "high",
        reasons: [],
      },
      humanClassification: "assembled-cap-on",
      reviewStatus: "approved",
      reviewer: { kind: "human", identity: "Reviewer" },
      reviewedAt: "2026-07-12T18:00:00.000Z",
    }],
    representative: {
      sourcePath: "/audit/GBCyl9SpryBlk.psd",
      sourceRelativePath: "GBCyl9SpryBlk.psd",
      sourceSha256: "a".repeat(64),
    },
  }], null, 2);
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function writeFixture(options: Parameters<typeof reviewedManifest>[0] = {}) {
  const root = await mkdtemp(join(tmpdir(), "best-bottles-cylinder-coverage-"));
  const canonicalMasterPath = join(root, "canonical-master.csv");
  const bodyGeometryPath = join(root, "body-geometry.csv");
  const reviewedManifestPath = join(root, "reviewed-manifest.json");
  const outputRoot = join(root, "cylinder-coverage-manifest-v1");
  const reviewed = reviewedManifest(options);
  await Promise.all([
    writeFile(canonicalMasterPath, canonicalMasterCsv),
    writeFile(bodyGeometryPath, bodyGeometryCsv),
    writeFile(reviewedManifestPath, reviewed),
  ]);
  return { root, canonicalMasterPath, bodyGeometryPath, reviewedManifestPath, outputRoot, reviewed };
}

describe("build Cylinder approved coverage artifacts", () => {
  it("writes only versioned local coverage artifacts and reports the canonical gap", async () => {
    const fixture = await writeFixture();
    try {
      const sourceHashBefore = createHash("sha256").update(fixture.reviewed).digest("hex");
      const result = await buildCylinderApprovedCoverageArtifacts({
        canonicalMasterPath: fixture.canonicalMasterPath,
        bodyGeometryPath: fixture.bodyGeometryPath,
        reviewedManifestPath: fixture.reviewedManifestPath,
        outputRoot: fixture.outputRoot,
      });

      assert.equal(result.summary.externalWriteCount, 0);
      assert.equal(result.summary.canonicalIdentityCount, 2);
      assert.equal(result.summary.referenceReadyCount, 1);
      assert.equal(result.summary.blockedIdentityCount, 1);
      assert.ok(await exists(join(fixture.outputRoot, "cylinder-approved-coverage-manifest.json")));
      assert.ok(await exists(join(fixture.outputRoot, "cylinder-approved-coverage-summary.json")));
      assert.deepEqual((await readdir(fixture.outputRoot)).sort(), [
        "cylinder-approved-coverage-manifest.json",
        "cylinder-approved-coverage-summary.json",
      ]);
      assert.equal(await readFile(fixture.reviewedManifestPath, "utf8"), fixture.reviewed);
      assert.equal(
        createHash("sha256").update(await readFile(fixture.reviewedManifestPath)).digest("hex"),
        sourceHashBefore,
      );

      const manifestArtifact = JSON.parse(await readFile(
        join(fixture.outputRoot, "cylinder-approved-coverage-manifest.json"), "utf8",
      ));
      const summaryArtifact = JSON.parse(await readFile(
        join(fixture.outputRoot, "cylinder-approved-coverage-summary.json"), "utf8",
      ));
      for (const artifact of [manifestArtifact, summaryArtifact]) {
        assert.deepEqual(Object.keys(artifact.provenance.inputs).sort(), [
          "bodyGeometry", "canonicalMaster", "reviewedManifest",
        ]);
        for (const input of Object.values(artifact.provenance.inputs) as Array<{ path: string; sha256: string }>) {
          assert.ok(input.path.startsWith("/"));
          assert.match(input.sha256, /^[a-f0-9]{64}$/);
        }
      }
      assert.equal(manifestArtifact.manifest.rows[0].canonical.productGroupSlug, "cylinder-9ml-clear-17-415-finemist");
      assert.deepEqual(summaryArtifact.uncoveredCanonicalIdentityKeys, [
        "GBTALL10SPRYBLK|GBTALLCLR10MLSPRBLK",
      ]);
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  });

  it("rejects a reviewed source that is not an exact website-SKU identity", async () => {
    const fixture = await writeFixture({ sourceIdentityStatus: "exact-grace-sku" });
    try {
      await assert.rejects(
        buildCylinderApprovedCoverageArtifacts(fixture),
        /identityStatus.*exact-website-sku/i,
      );
      assert.equal(await exists(fixture.outputRoot), false);
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  });

  it("accepts a human-reviewed alias with complete provenance and the exact canonical SKU pair", async () => {
    const fixture = await writeFixture({ sourceIdentityStatus: "reviewed-alias" });
    try {
      const result = await buildCylinderApprovedCoverageArtifacts(fixture);
      assert.equal(result.summary.referenceReadyCount, 1);
      assert.equal(result.summary.blockedIdentityCount, 1);
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  });

  it("rejects a reviewed source whose paired canonical identity conflicts", async () => {
    const fixture = await writeFixture({ sourceGraceSku: "GB-CYL-CONFLICTING-9ML-SPR-BLK" });
    try {
      await assert.rejects(
        buildCylinderApprovedCoverageArtifacts(fixture),
        /conflicts with canonical identity/i,
      );
      assert.equal(await exists(fixture.outputRoot), false);
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  });
});
