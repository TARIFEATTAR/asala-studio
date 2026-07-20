import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import sharp from "sharp";

import type { CylinderProductionReadinessArtifact } from "../../src/lib/bestBottlesCylinderProductionCutover";
import type { CylinderReferenceProductionExportRecord } from "./build-cylinder-reference-production";
import {
  writeCylinderReferencePromotionPreflight,
} from "./build-cylinder-reference-promotion-preflight";

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

describe("Cylinder reference promotion preflight writer", () => {
  it("verifies local PNG bytes and emits hash-sealed zero-write artifacts", async () => {
    const root = await mkdtemp(join(tmpdir(), "bb-cylinder-promotion-"));
    const localPath = join(root, "qualified.png");
    const bytes = await sharp({
      create: { width: 1000, height: 1300, channels: 3, background: "white" },
    }).png().toFile(localPath).then(() => readFile(localPath));
    const exportSha256 = sha256(bytes);
    const canonicalIdentityKey = "GBCYLTEST|GBCYLTEST";
    const canonical = {
      websiteSku: "GBCylTest",
      graceSku: "GB-CYL-TEST",
      family: "Cylinder",
      productGroupSlug: "cylinder-test",
      capacityMl: "9",
      canon_bodyHeightMm: "70",
      canon_widthAxisMm: "20",
      canon_secondAxisMm: "20",
      canon_heightWithCapMm: "96",
    };
    const readiness: CylinderProductionReadinessArtifact = {
      version: "best-bottles-cylinder-production-readiness-v1",
      minimumReferencePixels: 1_000_000,
      provenance: {
        referenceProductionVersion: "production-v1",
        referenceProductionPlanVersion: "plan-v1",
        coverageManifestSha256: "a".repeat(64),
        reviewedManifestSha256: "b".repeat(64),
      },
      summary: {
        canonicalIdentityCount: 1,
        localReferenceExportCount: 1,
        productionQualifiedCount: 1,
        belowMinimumPixelsCount: 0,
        evidenceBlockedCount: 0,
        totalBlockedCount: 0,
        externalWriteCount: 0,
      },
      rows: [{
        canonicalIdentityKey,
        websiteSku: canonical.websiteSku,
        graceSku: canonical.graceSku,
        status: "production-qualified",
        blockers: [],
        blockerLane: null,
        canonical,
        reference: {
          filename: "qualified.png",
          sourceSha256: "c".repeat(64),
          exportSha256,
          width: 1000,
          height: 1300,
          pixelCount: 1_300_000,
          opaque: true,
          capState: "assembled-cap-on",
          reviewer: "Jordan Richter",
          reviewedAt: "2026-07-13T00:00:00.000Z",
        },
      }],
    };
    const exports: CylinderReferenceProductionExportRecord[] = [{
      canonicalIdentityKey,
      canonical,
      bodyGeometry: {} as CylinderReferenceProductionExportRecord["bodyGeometry"],
      source: {
        sourcePath: join(root, "source.psd"),
        sourceRelativePath: "source.psd",
        sourceSha256: "c".repeat(64),
        sourceBytes: 1,
        previewPath: join(root, "preview.png"),
        previewSha256: "d".repeat(64),
        reviewUnitKey: "test",
        reviewer: "Jordan Richter",
        reviewedAt: "2026-07-13T00:00:00.000Z",
        capState: "assembled-cap-on",
        composite: {} as CylinderReferenceProductionExportRecord["source"]["composite"],
      },
      output: {
        path: localPath,
        filename: "qualified.png",
        sha256: exportSha256,
        bytes: bytes.length,
        format: "PNG",
        width: 1000,
        height: 1300,
        opaque: true,
        colorspace: "sRGB",
        primaryBounds: { left: 0, top: 0, width: 1000, height: 1300 },
      },
    }];
    const outputRoot = join(root, "preflight");
    const result = await writeCylinderReferencePromotionPreflight({
      readiness,
      exports,
      jobs: [{
        id: "job-1",
        websiteSku: canonical.websiteSku,
        graceSku: canonical.graceSku,
        family: "Cylinder",
        bestReferenceCandidatePath: null,
      }],
      remoteObjects: [],
      bucket: "reference-images",
      supabaseUrl: "https://example.supabase.co",
      outputRoot,
      expectedQualifiedCount: 1,
      generatedAt: "2026-07-14T00:00:00.000Z",
      inputProvenance: {
        readiness: { path: "readiness.json", sha256: "e".repeat(64) },
        productionManifest: { path: "production.json", sha256: "f".repeat(64) },
      },
    });

    const manifest = JSON.parse(await readFile(result.manifestPath, "utf8")) as {
      manifestSha256: string;
      plan: { summary: { readyToUploadCount: number; externalWriteCount: number } };
    };
    const collisionReport = JSON.parse(await readFile(result.collisionReportPath, "utf8")) as {
      blockedIdentityCount: number;
    };
    assert.match(manifest.manifestSha256, /^[a-f0-9]{64}$/);
    assert.equal(manifest.plan.summary.readyToUploadCount, 1);
    assert.equal(manifest.plan.summary.externalWriteCount, 0);
    assert.equal(collisionReport.blockedIdentityCount, 0);
    assert.equal(sha256(await readFile(localPath)), exportSha256);
  });

  it("contains no remote storage or database mutation API calls", async () => {
    const source = await readFile(
      new URL("./build-cylinder-reference-promotion-preflight.ts", import.meta.url),
      "utf8",
    );
    assert.doesNotMatch(source, /\.(?:upload|insert|upsert|delete|remove)\s*\(/);
    assert.doesNotMatch(source, /\.update\s*\(\s*\{/);
    assert.match(source, /\.download\s*\(/);
    assert.match(source, /\.select\s*\(/);
  });
});
