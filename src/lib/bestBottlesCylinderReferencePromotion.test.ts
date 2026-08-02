import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildCylinderReferencePromotionPlan,
  type CylinderPromotionPipelineJob,
  type CylinderPromotionRemoteObject,
} from "./bestBottlesCylinderReferencePromotion";
import type {
  CylinderProductionReadinessArtifact,
  CylinderProductionReadinessRow,
} from "./bestBottlesCylinderProductionCutover";
import type { CylinderReferenceProductionExportRecord } from "../../scripts/best-bottles/build-cylinder-reference-production";

const BUCKET = "reference-images";
const SUPABASE_URL = "https://example.supabase.co";

function hash(index: number, offset = 0): string {
  return (index + offset).toString(16).padStart(64, "0");
}

function fixture(count = 228): {
  readiness: CylinderProductionReadinessArtifact;
  exports: CylinderReferenceProductionExportRecord[];
  jobs: CylinderPromotionPipelineJob[];
  remoteObjects: CylinderPromotionRemoteObject[];
} {
  const rows: CylinderProductionReadinessRow[] = [];
  const exports: CylinderReferenceProductionExportRecord[] = [];
  const jobs: CylinderPromotionPipelineJob[] = [];
  const remoteObjects: CylinderPromotionRemoteObject[] = [];
  for (let index = 1; index <= count; index += 1) {
    const websiteSku = `GBCylFixture${index}`;
    const graceSku = `GB-CYL-FIXTURE-${index}`;
    const canonicalIdentityKey = `GBCYLFIXTURE${index}|GBCYLFIXTURE${index}`;
    const exportSha256 = hash(index);
    const canonical = {
      websiteSku,
      graceSku,
      family: "Cylinder",
      productGroupSlug: `cylinder-fixture-${index}`,
      capacityMl: "9",
      canon_bodyHeightMm: "70.0",
      canon_widthAxisMm: "20.0",
      canon_secondAxisMm: "20.0",
      canon_heightWithCapMm: "96.0",
    };
    rows.push({
      canonicalIdentityKey,
      websiteSku,
      graceSku,
      status: "production-qualified",
      blockers: [],
      blockerLane: null,
      canonical,
      reference: {
        filename: `${canonicalIdentityKey.replace("|", "__")}__${exportSha256.slice(0, 12)}.png`,
        sourceSha256: hash(index, 1000),
        exportSha256,
        width: 1000,
        height: 1300,
        pixelCount: 1_300_000,
        opaque: true,
        capState: "assembled-cap-on",
        reviewer: "Jordan Richter",
        reviewedAt: "2026-07-13T00:00:00.000Z",
      },
    });
    exports.push({
      canonicalIdentityKey,
      canonical,
      bodyGeometry: {} as CylinderReferenceProductionExportRecord["bodyGeometry"],
      source: {
        sourcePath: `/sources/${index}.psd`,
        sourceRelativePath: `${index}.psd`,
        sourceSha256: hash(index, 1000),
        sourceBytes: 10,
        previewPath: `/previews/${index}.png`,
        previewSha256: hash(index, 2000),
        reviewUnitKey: `${index}`,
        reviewer: "Jordan Richter",
        reviewedAt: "2026-07-13T00:00:00.000Z",
        capState: "assembled-cap-on",
        composite: {} as CylinderReferenceProductionExportRecord["source"]["composite"],
      },
      output: {
        path: `/exports/${index}.png`,
        filename: `${canonicalIdentityKey.replace("|", "__")}__${exportSha256.slice(0, 12)}.png`,
        sha256: exportSha256,
        bytes: 1000,
        format: "PNG",
        width: 1000,
        height: 1300,
        opaque: true,
        colorspace: "sRGB",
        primaryBounds: { left: 10, top: 10, width: 500, height: 1000 },
      },
    });
    jobs.push({
      id: `job-${index}`,
      websiteSku,
      graceSku,
      family: "Cylinder",
      bestReferenceCandidatePath: null,
    });
  }
  return {
    readiness: {
      version: "best-bottles-cylinder-production-readiness-v1",
      minimumReferencePixels: 1_000_000,
      provenance: {
        referenceProductionVersion: "v1",
        referenceProductionPlanVersion: "v1",
        coverageManifestSha256: hash(3000),
        reviewedManifestSha256: hash(3001),
      },
      summary: {
        canonicalIdentityCount: 377,
        localReferenceExportCount: 232,
        productionQualifiedCount: count,
        belowMinimumPixelsCount: 13,
        evidenceBlockedCount: 145,
        totalBlockedCount: 158,
        externalWriteCount: 0,
      },
      rows,
    },
    exports,
    jobs,
    remoteObjects,
  };
}

function plan(input = fixture()) {
  return buildCylinderReferencePromotionPlan({
    ...input,
    bucket: BUCKET,
    supabaseUrl: SUPABASE_URL,
    expectedQualifiedCount: input.readiness.summary.productionQualifiedCount,
  });
}

describe("Cylinder production-reference promotion plan", () => {
  it("plans all 228 exact identities at immutable full-hash storage paths with zero writes", () => {
    const result = plan();
    assert.equal(result.summary.qualifiedIdentityCount, 228);
    assert.equal(result.summary.readyToUploadCount, 228);
    assert.equal(result.summary.blockedCount, 0);
    assert.equal(result.summary.externalWriteCount, 0);
    assert.equal(result.rows.length, 228);
    for (const row of result.rows) {
      assert.match(row.storage.path, new RegExp(`${row.exportSha256}\\.png$`));
      assert.equal(row.remote.status, "absent");
      assert.equal(row.pipeline.status, "needs-repoint");
      assert.equal(row.decision, "ready-to-upload");
      assert.ok(row.storage.publicUrl.startsWith(`${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`));
    }
  });

  it("reuses only byte-identical remote objects and blocks an occupied path with different bytes", () => {
    const input = fixture(2);
    const first = plan(input).rows[0];
    const second = plan(input).rows[1];
    input.remoteObjects.push(
      { path: first.storage.path, status: "present", sha256: first.exportSha256, bytes: 1000 },
      { path: second.storage.path, status: "present", sha256: hash(9999), bytes: 999 },
    );
    const result = plan(input);
    assert.equal(result.rows[0].decision, "ready-to-reuse");
    assert.equal(result.rows[1].decision, "blocked");
    assert.deepEqual(result.rows[1].blockers, ["remote-path-byte-collision"]);
  });

  it("recognizes an exact pipeline job already pointing at the immutable public URL", () => {
    const input = fixture(1);
    const initial = plan(input).rows[0];
    input.jobs[0].bestReferenceCandidatePath = initial.storage.publicUrl;
    input.remoteObjects.push({
      path: initial.storage.path,
      status: "present",
      sha256: initial.exportSha256,
      bytes: initial.bytes,
    });
    const result = plan(input);
    assert.equal(result.rows[0].pipeline.status, "already-target");
    assert.equal(result.rows[0].decision, "ready-to-reuse");
  });

  it("blocks missing, duplicate, or cross-identity pipeline jobs", () => {
    const input = fixture(3);
    input.jobs = [
      input.jobs[0],
      input.jobs[1],
      { ...input.jobs[1], id: "duplicate-job" },
      { ...input.jobs[2], websiteSku: "WrongWebsiteSku" },
    ];
    const result = plan(input);
    assert.equal(result.rows[0].decision, "ready-to-upload");
    assert.deepEqual(result.rows[1].blockers, ["duplicate-exact-pipeline-jobs"]);
    assert.deepEqual(result.rows[2].blockers, ["missing-exact-pipeline-job"]);
  });

  it("fails closed when readiness and the native production export disagree", () => {
    const input = fixture(1);
    input.exports[0].output.sha256 = hash(9999);
    assert.throws(() => plan(input), /export hash/i);
  });
});
