import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, it } from "node:test";

import {
  buildCylinderReferenceProductionArtifacts,
} from "./build-cylinder-reference-production";

const execFileAsync = promisify(execFile);

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "best-bottles-cylinder-reference-production-"));
  const sourcePath = join(root, "GBCyl9SpryBlk.psd");
  await execFileAsync("magick", [
    "-size", "100x130",
    "xc:white",
    "-fill", "#202020",
    "-draw", "roundrectangle 35,20 65,115 4,4",
    sourcePath,
  ]);
  const sourceBytes = await readFile(sourcePath);
  const sourceSha256 = sha256(sourceBytes);
  const reviewUnitKey = `${sourceSha256}|GBCYL9SPRYBLK|GBCYLCLR9MLSPRBLK`;
  const source = {
    sourcePath,
    sourceRelativePath: "Cylinder/GBCyl9SpryBlk.psd",
    sourceSha256,
    sourceBytes: sourceBytes.length,
    family: "Cylinder",
    canonicalReviewMetadata: null,
    identityStatus: "exact-website-sku",
    websiteSku: "GBCyl9SpryBlk",
    graceSku: "GB-CYL-CLR-9ML-SPR-BLK",
    aliasProvenance: null,
    identityReasons: [],
    composite: {
      width: 100,
      height: 130,
      opaque: true,
      sceneCount: 1,
      foregroundBounds: { left: 35, top: 20, width: 31, height: 96 },
      largeForegroundComponentCount: 1,
      whiteCornerCount: 4,
      minimumSafeMarginPct: 15,
      previewPath: join(root, "preview.png"),
      evidenceSha256: "b".repeat(64),
    },
    machineTriage: {
      proposedClassification: "assembled-cap-on",
      confidence: "high",
      reasons: [],
    },
    humanClassification: "assembled-cap-on",
    reviewStatus: "approved",
    reviewer: { kind: "human", identity: "Jordan Richter" },
    reviewedAt: "2026-07-13T15:00:00.000Z",
  };
  const reference = {
    sourcePath,
    sourceRelativePath: source.sourceRelativePath,
    sourceSha256,
    previewPath: source.composite.previewPath,
    previewSha256: source.composite.evidenceSha256,
    classification: "assembled-cap-on",
    reviewUnitKey,
  };
  const coverageManifest = {
    version: "best-bottles-cylinder-approved-coverage-manifest-v1",
    summary: {
      canonicalIdentityCount: 1,
      referenceReadyCount: 1,
      blockedIdentityCount: 0,
      canonicalBodyCount: 1,
      coveredBodyCount: 1,
      externalWriteCount: 0,
    },
    rows: [{
      canonicalIdentityKey: "GBCYL9SPRYBLK|GBCYLCLR9MLSPRBLK",
      canonical: {
        websiteSku: "GBCyl9SpryBlk",
        graceSku: "GB-CYL-CLR-9ML-SPR-BLK",
        family: "Cylinder",
        productGroupSlug: "cylinder-9ml-clear-17-415-finemist",
        capacityMl: "9",
        canon_bodyHeightMm: "70",
        canon_widthAxisMm: "20",
        canon_secondAxisMm: "20",
        canon_heightWithCapMm: "96",
      },
      approvedReferences: [reference],
      primaryReference: reference,
      bodyMatch: {
        method: "product-group-slug",
        bodyGeometry: {
          family: "Cylinder",
          capacityMl: "9",
          bodyHeightMm: "70",
          widthAxisMm: "20",
          depthAxisMm: "20",
          productGroupSlugs: "cylinder-9ml-clear-17-415-finemist",
        },
      },
      blockers: [],
      referenceReady: true,
    }],
    bodyCoverage: [],
  };
  const reviewedManifest = [{
    reviewUnitKey,
    sourceSha256,
    websiteSku: "GBCyl9SpryBlk",
    graceSku: "GB-CYL-CLR-9ML-SPR-BLK",
    family: "Cylinder",
    canonicalReviewMetadata: null,
    identityStatus: "exact-website-sku",
    classification: "assembled-cap-on",
    reviewStatus: "approved",
    reviewer: { kind: "human", identity: "Jordan Richter" },
    reviewedAt: "2026-07-13T15:00:00.000Z",
    notes: "Approved exact assembled reference.",
    sources: [source],
    representative: source,
  }];
  const coverageManifestPath = join(root, "coverage.json");
  const reviewedManifestPath = join(root, "reviewed.json");
  const outputRoot = join(root, "cylinder-native-opaque-exports-v1");
  await Promise.all([
    writeFile(coverageManifestPath, `${JSON.stringify({ manifest: coverageManifest }, null, 2)}\n`),
    writeFile(reviewedManifestPath, `${JSON.stringify(reviewedManifest, null, 2)}\n`),
  ]);
  return {
    root,
    sourcePath,
    sourceBytes,
    sourceSha256,
    coverageManifestPath,
    reviewedManifestPath,
    outputRoot,
  };
}

describe("Cylinder native opaque reference production", () => {
  it("exports and validates an immutable native-resolution PNG without changing the PSD", async () => {
    const input = await fixture();
    try {
      const first = await buildCylinderReferenceProductionArtifacts(input);
      assert.equal(first.summary.canonicalIdentityCount, 1);
      assert.equal(first.summary.exportQualifiedCount, 1);
      assert.equal(first.summary.blockedIdentityCount, 0);
      assert.equal(first.summary.externalWriteCount, 0);
      assert.equal(first.createdExportCount, 1);
      assert.equal(first.reusedExportCount, 0);
      assert.deepEqual((await readdir(input.outputRoot)).sort(), [
        "cylinder-reference-blocker-report.json",
        "cylinder-reference-production-manifest.json",
        "cylinder-reference-production-summary.json",
        "exports",
      ]);
      const exportFiles = await readdir(join(input.outputRoot, "exports"));
      assert.equal(exportFiles.length, 1);
      assert.match(exportFiles[0], /^GBCYL9SPRYBLK__GBCYLCLR9MLSPRBLK__[a-f0-9]{12}\.png$/);

      const artifact = JSON.parse(await readFile(first.artifactPaths.manifest, "utf8"));
      const exported = artifact.exports[0];
      assert.equal(exported.output.format, "PNG");
      assert.equal(exported.output.width, 100);
      assert.equal(exported.output.height, 130);
      assert.equal(exported.output.opaque, true);
      assert.match(exported.output.sha256, /^[a-f0-9]{64}$/);
      assert.ok(exported.output.primaryBounds.width > 0);
      assert.ok(exported.output.primaryBounds.height > 0);
      assert.equal(artifact.provenance.inputs.coverageManifest.path, input.coverageManifestPath);
      assert.equal(artifact.provenance.inputs.reviewedManifest.path, input.reviewedManifestPath);
      assert.equal(sha256(await readFile(input.sourcePath)), input.sourceSha256);
      assert.deepEqual(await readFile(input.sourcePath), input.sourceBytes);

      const second = await buildCylinderReferenceProductionArtifacts(input);
      assert.equal(second.createdExportCount, 0);
      assert.equal(second.reusedExportCount, 1);
      assert.deepEqual(await readFile(input.sourcePath), input.sourceBytes);

      await writeFile(join(input.outputRoot, "exports", exportFiles[0]), "different bytes");
      await assert.rejects(
        buildCylinderReferenceProductionArtifacts(input),
        /immutable output conflict/i,
      );
      assert.deepEqual(await readFile(input.sourcePath), input.sourceBytes);
    } finally {
      await rm(input.root, { recursive: true, force: true });
    }
  });

  it("writes all blocked identities to the blocker report without creating borrowed exports", async () => {
    const input = await fixture();
    try {
      const coverageArtifact = JSON.parse(await readFile(input.coverageManifestPath, "utf8"));
      const row = coverageArtifact.manifest.rows[0];
      row.canonicalIdentityKey = "BLOCKED|IDENTITY";
      row.canonical.websiteSku = "Blocked";
      row.canonical.graceSku = "Identity";
      row.approvedReferences = [];
      row.primaryReference = null;
      row.blockers = ["no-approved-exact-reference"];
      row.referenceReady = false;
      coverageArtifact.manifest.summary.referenceReadyCount = 0;
      coverageArtifact.manifest.summary.blockedIdentityCount = 1;
      await writeFile(input.coverageManifestPath, `${JSON.stringify(coverageArtifact, null, 2)}\n`);

      const result = await buildCylinderReferenceProductionArtifacts(input);
      assert.equal(result.summary.exportQualifiedCount, 0);
      assert.equal(result.summary.blockedIdentityCount, 1);
      assert.deepEqual(await readdir(join(input.outputRoot, "exports")), []);
      const blockers = JSON.parse(await readFile(result.artifactPaths.blockers, "utf8"));
      assert.equal(blockers.blockedIdentities[0].lane, "source-evidence");
      assert.equal(blockers.blockedIdentities[0].canonicalIdentityKey, "BLOCKED|IDENTITY");
    } finally {
      await rm(input.root, { recursive: true, force: true });
    }
  });
});
