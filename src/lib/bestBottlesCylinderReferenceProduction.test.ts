import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type {
  CylinderApprovedCoverageManifest,
  CylinderApprovedCoverageRow,
} from "./bestBottlesCylinderApprovedCoverageManifest";
import type { PsdReviewedUnit } from "./bestBottlesPsdReviewDecisions";
import {
  buildCylinderReferenceProductionPlan,
} from "./bestBottlesCylinderReferenceProduction";

const SOURCE_SHA = "a".repeat(64);
const PREVIEW_SHA = "b".repeat(64);
const SOURCE_PATH = "/photoshop/GBCyl9SpryBlk.psd";
const WEBSITE_SKU = "GBCyl9SpryBlk";
const GRACE_SKU = "GB-CYL-CLR-9ML-SPR-BLK";

function readyCoverageRow(overrides: Partial<CylinderApprovedCoverageRow> = {}): CylinderApprovedCoverageRow {
  const reference = {
    sourcePath: SOURCE_PATH,
    sourceRelativePath: "Cylinder/GBCyl9SpryBlk.psd",
    sourceSha256: SOURCE_SHA,
    previewPath: "/audit/previews/a.png",
    previewSha256: PREVIEW_SHA,
    classification: "assembled-cap-on" as const,
    reviewUnitKey: `${SOURCE_SHA}|GBCYL9SPRYBLK|GBCYLCLR9MLSPRBLK`,
  };
  return {
    canonicalIdentityKey: "GBCYL9SPRYBLK|GBCYLCLR9MLSPRBLK",
    canonical: {
      websiteSku: WEBSITE_SKU,
      graceSku: GRACE_SKU,
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
    ...overrides,
  };
}

function reviewedUnit(overrides: Record<string, unknown> = {}): PsdReviewedUnit {
  const source = {
    sourcePath: SOURCE_PATH,
    sourceRelativePath: "Cylinder/GBCyl9SpryBlk.psd",
    sourceSha256: SOURCE_SHA,
    sourceBytes: 1234,
    family: "Cylinder",
    canonicalReviewMetadata: null,
    identityStatus: "exact-website-sku",
    websiteSku: WEBSITE_SKU,
    graceSku: GRACE_SKU,
    aliasProvenance: null,
    identityReasons: [],
    composite: {
      width: 750,
      height: 1594,
      opaque: true,
      sceneCount: 4,
      foregroundBounds: { left: 120, top: 80, width: 510, height: 1420 },
      largeForegroundComponentCount: 1,
      whiteCornerCount: 4,
      minimumSafeMarginPct: 5.02,
      previewPath: "/audit/previews/a.png",
      evidenceSha256: PREVIEW_SHA,
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
    ...overrides,
  };
  return {
    reviewUnitKey: `${SOURCE_SHA}|GBCYL9SPRYBLK|GBCYLCLR9MLSPRBLK`,
    sourceSha256: SOURCE_SHA,
    websiteSku: WEBSITE_SKU,
    graceSku: GRACE_SKU,
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
  } as PsdReviewedUnit;
}

function manifest(rows: CylinderApprovedCoverageRow[]): CylinderApprovedCoverageManifest {
  return {
    version: "best-bottles-cylinder-approved-coverage-manifest-v1",
    summary: {
      canonicalIdentityCount: rows.length,
      referenceReadyCount: rows.filter((row) => row.referenceReady).length,
      blockedIdentityCount: rows.filter((row) => !row.referenceReady).length,
      canonicalBodyCount: 1,
      coveredBodyCount: 1,
      externalWriteCount: 0,
    },
    rows,
    bodyCoverage: [],
  };
}

describe("Cylinder reference production plan", () => {
  it("creates one exact export job and partitions all blockers into disjoint lanes", () => {
    const ready = readyCoverageRow();
    const geometry = readyCoverageRow({
      canonicalIdentityKey: "GEOMETRY|BLOCKED",
      canonical: { ...ready.canonical, websiteSku: "Geometry", graceSku: "Blocked" },
      bodyMatch: { method: "none", bodyGeometry: null },
      blockers: ["ambiguous-canonical-body-geometry"],
      referenceReady: false,
    });
    const source = readyCoverageRow({
      canonicalIdentityKey: "SOURCE|BLOCKED",
      canonical: { ...ready.canonical, websiteSku: "Source", graceSku: "Blocked" },
      approvedReferences: [],
      primaryReference: null,
      blockers: ["no-approved-exact-reference"],
      referenceReady: false,
    });
    const both = readyCoverageRow({
      canonicalIdentityKey: "BOTH|BLOCKED",
      canonical: { ...ready.canonical, websiteSku: "Both", graceSku: "Blocked" },
      approvedReferences: [],
      primaryReference: null,
      bodyMatch: { method: "none", bodyGeometry: null },
      blockers: ["no-approved-exact-reference", "ambiguous-canonical-body-geometry"],
      referenceReady: false,
    });

    const plan = buildCylinderReferenceProductionPlan({
      coverageManifest: manifest([ready, geometry, source, both]),
      reviewedUnits: [reviewedUnit()],
    });

    assert.equal(plan.summary.canonicalIdentityCount, 4);
    assert.equal(plan.summary.exportQualifiedCount, 1);
    assert.equal(plan.summary.blockedIdentityCount, 3);
    assert.equal(plan.summary.canonicalGeometryBlockedCount, 1);
    assert.equal(plan.summary.sourceEvidenceBlockedCount, 1);
    assert.equal(plan.summary.sourceAndGeometryBlockedCount, 1);
    assert.equal(plan.summary.otherBlockedCount, 0);
    assert.equal(plan.summary.uniqueSourceCount, 1);
    assert.equal(plan.summary.externalWriteCount, 0);
    assert.equal(plan.exportJobs[0].source.sourcePath, SOURCE_PATH);
    assert.equal(plan.exportJobs[0].source.composite.width, 750);
    assert.equal(plan.exportJobs[0].source.capState, "assembled-cap-on");
    assert.equal(
      plan.exportJobs[0].outputFilename,
      `GBCYL9SPRYBLK__GBCYLCLR9MLSPRBLK__${SOURCE_SHA.slice(0, 12)}.png`,
    );
    assert.deepEqual(
      plan.blockedIdentities.map((row) => [row.canonicalIdentityKey, row.lane]),
      [
        ["BOTH|BLOCKED", "source-and-geometry"],
        ["GEOMETRY|BLOCKED", "canonical-geometry"],
        ["SOURCE|BLOCKED", "source-evidence"],
      ],
    );
    assert.equal(
      new Set([
        ...plan.exportJobs.map((row) => row.canonicalIdentityKey),
        ...plan.blockedIdentities.map((row) => row.canonicalIdentityKey),
      ]).size,
      4,
    );
  });

  it("rejects a ready row whose reviewed composite is not opaque", () => {
    assert.throws(
      () => buildCylinderReferenceProductionPlan({
        coverageManifest: manifest([readyCoverageRow()]),
        reviewedUnits: [reviewedUnit({
          composite: {
            width: 750,
            height: 1594,
            opaque: false,
            sceneCount: 4,
            foregroundBounds: null,
            largeForegroundComponentCount: 1,
            whiteCornerCount: 0,
            minimumSafeMarginPct: 0,
            previewPath: "/audit/previews/a.png",
            evidenceSha256: PREVIEW_SHA,
          },
        })],
      }),
      /must be opaque/i,
    );
  });

  it("rejects detached, non-exact, and conflicting reviewed evidence for a ready row", () => {
    const invalidSources = [
      { humanClassification: "detached-cap-or-sidecar" },
      { identityStatus: "exact-grace-sku" },
      { graceSku: "GB-CYL-CONFLICT" },
    ];
    for (const sourceOverride of invalidSources) {
      assert.throws(
        () => buildCylinderReferenceProductionPlan({
          coverageManifest: manifest([readyCoverageRow()]),
          reviewedUnits: [reviewedUnit(sourceOverride)],
        }),
        /approved assembled-cap-on exact identity/i,
      );
    }
  });

  it("accepts a human-reviewed alias carrying the exact canonical SKU pair and complete provenance", () => {
    const unit = reviewedUnit({
      identityStatus: "reviewed-alias",
      aliasProvenance: {
        observedAliasToken: "LegacyCyl9SpryBlk",
        canonicalWebsiteSku: WEBSITE_SKU,
        canonicalGraceSku: GRACE_SKU,
        reviewer: { kind: "human", identity: "Jordan Richter" },
        reviewedAt: "2026-07-14T16:00:00.000Z",
      },
    });
    unit.identityStatus = "reviewed-alias";
    const result = buildCylinderReferenceProductionPlan({
      coverageManifest: manifest([readyCoverageRow()]),
      reviewedUnits: [unit],
    });
    assert.equal(result.summary.exportQualifiedCount, 1);
  });

  it("rejects a ready coverage row that cannot be joined to reviewed evidence", () => {
    assert.throws(
      () => buildCylinderReferenceProductionPlan({
        coverageManifest: manifest([readyCoverageRow()]),
        reviewedUnits: [],
      }),
      /no reviewed source evidence/i,
    );
  });
});
