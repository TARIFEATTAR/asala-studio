import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PsdReviewedAuditRecord, PsdReviewedUnit } from "./bestBottlesPsdReviewDecisions";
import { buildCylinderApprovedCoverageManifest } from "./bestBottlesCylinderApprovedCoverageManifest";

const canonical = {
  websiteSku: "GBCyl9SpryBlk",
  graceSku: "GB-CYL-CLR-9ML-SPR-BLK",
  family: "Cylinder" as const,
  productGroupSlug: "cylinder-9ml-clear-17-415-finemist",
  capacityMl: "9",
  canon_bodyHeightMm: "70",
  canon_widthAxisMm: "20",
  canon_secondAxisMm: "20",
  canon_heightWithCapMm: "96",
};

const body = {
  family: "Cylinder" as const,
  capacityMl: "9",
  bodyHeightMm: "70",
  widthAxisMm: "20",
  depthAxisMm: "20",
  productGroupSlugs: "cylinder-9ml-clear-17-415-finemist",
};

function approved(sourcePath: string, sourceSha256: string): PsdReviewedUnit {
  const source: PsdReviewedAuditRecord = {
    sourcePath,
    sourceRelativePath: sourcePath,
    sourceSha256,
    sourceBytes: 1,
    family: "Cylinder",
    canonicalReviewMetadata: {
      capacityMl: "9",
      applicator: null,
      capStyle: null,
      capColor: null,
      trimColor: null,
      bodyMaterial: null,
      glassFinish: null,
      assemblyType: null,
      ballMaterial: null,
      category: null,
      shape: null,
      canonBodyHeightMm: "70",
      canonWidthAxisMm: "20",
      canonSecondAxisMm: "20",
      canonHeightWithCapMm: "96",
    },
    identityStatus: "exact-website-sku",
    websiteSku: canonical.websiteSku,
    graceSku: canonical.graceSku,
    aliasProvenance: null,
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
      previewPath: `${sourcePath}.png`,
      evidenceSha256: "c".repeat(64),
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
  };

  return {
    reviewUnitKey: `${sourceSha256}|${canonical.websiteSku}`,
    sourceSha256,
    websiteSku: canonical.websiteSku,
    graceSku: canonical.graceSku,
    family: "Cylinder",
    canonicalReviewMetadata: source.canonicalReviewMetadata,
    identityStatus: "exact-website-sku",
    classification: "assembled-cap-on",
    reviewStatus: "approved",
    reviewer: source.reviewer,
    reviewedAt: source.reviewedAt,
    notes: "approved",
    sources: [source],
    representative: source,
  };
}

function approvedVariant(
  sourcePath: string,
  sourceSha256: string,
  options: {
    classification?: PsdReviewedUnit["classification"];
    identityStatus?: PsdReviewedUnit["identityStatus"];
    websiteSku?: string | null;
    graceSku?: string | null;
  } = {},
): PsdReviewedUnit {
  const unit = approved(sourcePath, sourceSha256);
  const classification = options.classification ?? unit.classification;
  const identityStatus = options.identityStatus ?? unit.identityStatus;
  const websiteSku = "websiteSku" in options ? options.websiteSku! : unit.websiteSku;
  const graceSku = "graceSku" in options ? options.graceSku! : unit.graceSku;
  const source = {
    ...unit.sources[0],
    identityStatus,
    websiteSku,
    graceSku,
    humanClassification: classification,
  } as PsdReviewedAuditRecord;

  return {
    ...unit,
    identityStatus,
    websiteSku,
    graceSku,
    classification,
    sources: [source],
    representative: source,
  };
}

describe("approved Cylinder coverage manifest", () => {
  it("retains paired approved PSD sources but emits one ready identity", () => {
    const manifest = buildCylinderApprovedCoverageManifest({
      canonicalRows: [canonical], bodyGeometryRows: [body],
      reviewedUnits: [
        approved("one.psd", "a".repeat(64)),
        approved("two.psd", "b".repeat(64)),
      ],
    });
    assert.equal(manifest.summary.canonicalIdentityCount, 1);
    assert.equal(manifest.summary.referenceReadyCount, 1);
    assert.equal(manifest.rows[0].approvedReferences.length, 2);
    assert.equal(manifest.rows[0].bodyMatch.method, "product-group-slug");
  });

  it("keeps an unreferenced canonical identity blocked without substitution", () => {
    const manifest = buildCylinderApprovedCoverageManifest({
      canonicalRows: [canonical], bodyGeometryRows: [body], reviewedUnits: [],
    });
    assert.equal(manifest.summary.referenceReadyCount, 0);
    assert.deepEqual(manifest.rows[0].blockers, ["no-approved-exact-reference"]);
  });

  it("rejects ambiguous canonical-axis fallback instead of selecting a body", () => {
    const manifest = buildCylinderApprovedCoverageManifest({
      canonicalRows: [{ ...canonical, productGroupSlug: "missing-slug" }],
      bodyGeometryRows: [body, { ...body, productGroupSlugs: "other-slug" }],
      reviewedUnits: [approved("one.psd", "a".repeat(64))],
    });
    assert.ok(manifest.rows[0].blockers.includes("ambiguous-canonical-body-geometry"));
  });

  it("uses canonical axes to disambiguate multiple body rows carrying the same product-group slug", () => {
    const outlierBody = {
      ...body,
      widthAxisMm: "21",
      depthAxisMm: "21",
    };
    const manifest = buildCylinderApprovedCoverageManifest({
      canonicalRows: [canonical],
      bodyGeometryRows: [body, outlierBody],
      reviewedUnits: [approved("one.psd", "a".repeat(64))],
    });

    assert.equal(manifest.rows[0].bodyMatch.method, "canonical-axes");
    assert.deepEqual(manifest.rows[0].bodyMatch.bodyGeometry, body);
    assert.deepEqual(manifest.rows[0].blockers, []);
    assert.equal(manifest.rows[0].referenceReady, true);
  });

  it("excludes exact-Grace evidence from exact approved references", () => {
    const manifest = buildCylinderApprovedCoverageManifest({
      canonicalRows: [canonical], bodyGeometryRows: [body],
      reviewedUnits: [approvedVariant("one.psd", "a".repeat(64), {
        identityStatus: "exact-grace-sku",
      })],
    });

    assert.equal(manifest.rows[0].approvedReferences.length, 0);
    assert.equal(manifest.rows[0].referenceReady, false);
    assert.ok(manifest.rows[0].blockers.includes("no-approved-exact-reference"));
  });

  it("excludes exact-website evidence without a paired Grace SKU", () => {
    const manifest = buildCylinderApprovedCoverageManifest({
      canonicalRows: [canonical], bodyGeometryRows: [body],
      reviewedUnits: [approvedVariant("one.psd", "a".repeat(64), { graceSku: null })],
    });

    assert.equal(manifest.rows[0].approvedReferences.length, 0);
    assert.equal(manifest.rows[0].referenceReady, false);
  });

  it("excludes exact-website evidence without a matching Website SKU", () => {
    const manifest = buildCylinderApprovedCoverageManifest({
      canonicalRows: [canonical], bodyGeometryRows: [body],
      reviewedUnits: [approvedVariant("one.psd", "a".repeat(64), { websiteSku: null })],
    });

    assert.equal(manifest.rows[0].approvedReferences.length, 0);
    assert.equal(manifest.rows[0].referenceReady, false);
  });

  it("excludes exact-website evidence when either paired SKU does not match", () => {
    for (const reviewedUnit of [
      approvedVariant("website-mismatch.psd", "a".repeat(64), { websiteSku: "other-website-sku" }),
      approvedVariant("grace-mismatch.psd", "b".repeat(64), { graceSku: "other-grace-sku" }),
    ]) {
      const manifest = buildCylinderApprovedCoverageManifest({
        canonicalRows: [canonical], bodyGeometryRows: [body], reviewedUnits: [reviewedUnit],
      });
      assert.equal(manifest.rows[0].approvedReferences.length, 0);
      assert.equal(manifest.rows[0].referenceReady, false);
    }
  });

  it("blocks identities when either canonical SKU is missing", () => {
    for (const incompleteCanonical of [
      { ...canonical, websiteSku: "" },
      { ...canonical, graceSku: "" },
    ]) {
      const manifest = buildCylinderApprovedCoverageManifest({
        canonicalRows: [incompleteCanonical], bodyGeometryRows: [body],
        reviewedUnits: [approved("one.psd", "a".repeat(64))],
      });
      assert.equal(manifest.rows[0].approvedReferences.length, 0);
      assert.equal(manifest.rows[0].referenceReady, false);
    }
  });

  it("preserves cap-off evidence but blocks an identity without an assembled-cap-on source", () => {
    const manifest = buildCylinderApprovedCoverageManifest({
      canonicalRows: [canonical], bodyGeometryRows: [body],
      reviewedUnits: [approvedVariant("cap-off.psd", "a".repeat(64), {
        classification: "cap-off-applicator-exposed",
      })],
    });

    assert.equal(manifest.rows[0].approvedReferences.length, 1);
    assert.equal(manifest.rows[0].referenceReady, false);
    assert.ok(manifest.rows[0].blockers.includes("no-approved-assembled-cap-on-reference"));
  });
});
