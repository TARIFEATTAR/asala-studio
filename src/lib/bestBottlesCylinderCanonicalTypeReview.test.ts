import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type {
  CanonicalCylinderCoverageRow,
  CylinderApprovedCoverageManifest,
  CylinderApprovedCoverageRow,
  CylinderApprovedReference,
} from "./bestBottlesCylinderApprovedCoverageManifest";
import type {
  PsdReviewedAuditRecord,
  PsdReviewedUnit,
} from "./bestBottlesPsdReviewDecisions";
import {
  buildCylinderCanonicalTypeReview,
  type CylinderCanonicalMasterRecord,
  type CylinderCanonicalTypeReviewInput,
} from "./bestBottlesCylinderCanonicalTypeReview";

type TypeSpec = Pick<
  CylinderCanonicalMasterRecord,
  | "family"
  | "capacityMl"
  | "canon_bodyHeightMm"
  | "canon_widthAxisMm"
  | "canon_secondAxisMm"
  | "canon_heightWithCapMm"
  | "neckThreadSize"
  | "applicator"
  | "capStyle"
>;

const candidateTypeSpecs: TypeSpec[] = [
  { family: "Cylinder", capacityMl: "9", canon_bodyHeightMm: "74", canon_widthAxisMm: "21", canon_secondAxisMm: "21", canon_heightWithCapMm: "90", neckThreadSize: "17-415", applicator: "Metal Roller Ball", capStyle: "Dot Cap" },
  { family: "Cylinder", capacityMl: "9", canon_bodyHeightMm: "74", canon_widthAxisMm: "21", canon_secondAxisMm: "21", canon_heightWithCapMm: "90", neckThreadSize: "17-415", applicator: "Metal Roller Ball", capStyle: "Roll-On" },
  { family: "Cylinder", capacityMl: "50", canon_bodyHeightMm: "117", canon_widthAxisMm: "32", canon_secondAxisMm: "32", canon_heightWithCapMm: "135", neckThreadSize: "18-415", applicator: "Lotion Pump", capStyle: "Pump" },
  { family: "Cylinder", capacityMl: "50", canon_bodyHeightMm: "117", canon_widthAxisMm: "32", canon_secondAxisMm: "32", canon_heightWithCapMm: "135", neckThreadSize: "18-415", applicator: "Lotion Pump", capStyle: "Screw Cap" },
  { family: "Cylinder", capacityMl: "100", canon_bodyHeightMm: "154", canon_widthAxisMm: "35", canon_secondAxisMm: "35", canon_heightWithCapMm: "175", neckThreadSize: "18-415", applicator: "Lotion Pump", capStyle: "Pump" },
  { family: "Cylinder", capacityMl: "100", canon_bodyHeightMm: "154", canon_widthAxisMm: "35", canon_secondAxisMm: "35", canon_heightWithCapMm: "175", neckThreadSize: "18-415", applicator: "Lotion Pump", capStyle: "Screw Cap" },
  { family: "Cylinder", capacityMl: "50", canon_bodyHeightMm: "117", canon_widthAxisMm: "32", canon_secondAxisMm: "32", canon_heightWithCapMm: "180", neckThreadSize: "18-415", applicator: "Vintage Bulb Sprayer with Tassel", capStyle: "Spray" },
  { family: "Cylinder", capacityMl: "50", canon_bodyHeightMm: "117", canon_widthAxisMm: "32", canon_secondAxisMm: "32", canon_heightWithCapMm: "180", neckThreadSize: "18-415", applicator: "Vintage Bulb Sprayer with Tassel", capStyle: "Screw Cap" },
  { family: "Cylinder", capacityMl: "100", canon_bodyHeightMm: "154", canon_widthAxisMm: "35", canon_secondAxisMm: "35", canon_heightWithCapMm: "210", neckThreadSize: "18-415", applicator: "Vintage Bulb Sprayer with Tassel", capStyle: "Spray" },
  { family: "Cylinder", capacityMl: "100", canon_bodyHeightMm: "154", canon_widthAxisMm: "35", canon_secondAxisMm: "35", canon_heightWithCapMm: "210", neckThreadSize: "18-415", applicator: "Vintage Bulb Sprayer with Tassel", capStyle: "Screw Cap" },
  { family: "Cylinder", capacityMl: "100", canon_bodyHeightMm: "154", canon_widthAxisMm: "35", canon_secondAxisMm: "35", canon_heightWithCapMm: "205", neckThreadSize: "18-415", applicator: "Vintage Bulb Sprayer", capStyle: "Spray" },
  { family: "Cylinder", capacityMl: "100", canon_bodyHeightMm: "154", canon_widthAxisMm: "35", canon_secondAxisMm: "35", canon_heightWithCapMm: "205", neckThreadSize: "18-415", applicator: "Vintage Bulb Sprayer", capStyle: "Screw Cap" },
];

const specialGlassRodType: TypeSpec = {
  family: "Cylinder",
  capacityMl: "9",
  canon_bodyHeightMm: "79.4",
  canon_widthAxisMm: "20",
  canon_secondAxisMm: "20",
  canon_heightWithCapMm: "50",
  neckThreadSize: "18-400",
  applicator: "Glass Rod",
  capStyle: "Tall",
};

const genericTypeSpecs: TypeSpec[] = Array.from({ length: 68 }, (_, index) => {
  if (index < 2) {
    return {
      family: "Cylinder",
      capacityMl: "9",
      canon_bodyHeightMm: "75",
      canon_widthAxisMm: "22",
      canon_secondAxisMm: "22",
      canon_heightWithCapMm: "92",
      neckThreadSize: "17-415",
      applicator: "Metal Roller Ball",
      capStyle: index === 0 ? "Dot Cap" : "Roll-On",
    };
  }
  return {
    family: index % 2 === 0 ? "Cylinder" : "Tall Cylinder",
    capacityMl: String(200 + index),
    canon_bodyHeightMm: String(300 + index),
    canon_widthAxisMm: String(40 + index),
    canon_secondAxisMm: String(40 + index),
    canon_heightWithCapMm: String(330 + index),
    neckThreadSize: `generic-neck-${index}`,
    applicator: `Generic Applicator ${index}`,
    capStyle: `Generic Cap ${index}`,
  };
});

function normalizedIdentity(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function sha(index: number): string {
  return index.toString(16).padStart(64, "0");
}

function reference(input: {
  sourceSha256: string;
  websiteSku: string;
  graceSku: string;
  suffix?: string;
}): CylinderApprovedReference {
  const suffix = input.suffix ?? "primary";
  return {
    sourcePath: `/approved/${input.websiteSku}-${suffix}.psd`,
    sourceRelativePath: `${input.websiteSku}-${suffix}.psd`,
    sourceSha256: input.sourceSha256,
    previewPath: `/approved/${input.websiteSku}-${suffix}.png`,
    previewSha256: input.sourceSha256.split("").reverse().join(""),
    classification: "assembled-cap-on",
    reviewUnitKey: [
      input.sourceSha256,
      normalizedIdentity(input.websiteSku),
      normalizedIdentity(input.graceSku),
    ].join("|"),
  };
}

function reviewedUnit(input: {
  canonical: CylinderCanonicalMasterRecord;
  approvedReference: CylinderApprovedReference;
}): PsdReviewedUnit {
  const source: PsdReviewedAuditRecord = {
    sourcePath: input.approvedReference.sourcePath,
    sourceRelativePath: input.approvedReference.sourceRelativePath,
    sourceSha256: input.approvedReference.sourceSha256,
    sourceBytes: 100,
    family: input.canonical.family,
    canonicalReviewMetadata: null,
    identityStatus: "exact-website-sku",
    websiteSku: input.canonical.websiteSku,
    graceSku: input.canonical.graceSku,
    aliasProvenance: null,
    identityReasons: [],
    composite: {
      width: 1000,
      height: 1300,
      opaque: true,
      sceneCount: 1,
      foregroundBounds: { left: 100, top: 90, width: 800, height: 1100 },
      largeForegroundComponentCount: 1,
      whiteCornerCount: 4,
      minimumSafeMarginPct: 5,
      previewPath: input.approvedReference.previewPath,
      evidenceSha256: input.approvedReference.previewSha256,
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
    reviewUnitKey: input.approvedReference.reviewUnitKey,
    sourceSha256: input.approvedReference.sourceSha256,
    websiteSku: input.canonical.websiteSku,
    graceSku: input.canonical.graceSku,
    family: input.canonical.family,
    canonicalReviewMetadata: null,
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

function buildFixture(): CylinderCanonicalTypeReviewInput {
  const typeSpecs = [specialGlassRodType, ...candidateTypeSpecs, ...genericTypeSpecs];
  assert.equal(typeSpecs.length, 81);
  const canonicalRecords: CylinderCanonicalMasterRecord[] = [];
  const reviewedUnits: PsdReviewedUnit[] = [];
  const rows: CylinderApprovedCoverageRow[] = [];
  let identityIndex = 1;

  const addIdentity = (type: TypeSpec, typeIndex: number, ready: boolean): void => {
    const special = typeIndex === 0 && rows.length === 0;
    const websiteSku = special ? "GB09BlackCapApp" : `${ready ? "ZZReady" : "Blocked"}${identityIndex}`;
    const graceSku = special ? "GB-CYL-CLR-9ML-T-01" : `GRACE-${ready ? "READY" : "BLOCKED"}-${identityIndex}`;
    const productGroupSlug = `fixture-type-${typeIndex}`;
    const canonical: CylinderCanonicalMasterRecord = {
      websiteSku,
      graceSku,
      productGroupSlug,
      ...type,
    };
    const coverageCanonical: CanonicalCylinderCoverageRow = {
      websiteSku,
      graceSku,
      family: type.family,
      productGroupSlug,
      capacityMl: type.capacityMl,
      canon_bodyHeightMm: type.canon_bodyHeightMm,
      canon_widthAxisMm: type.canon_widthAxisMm,
      canon_secondAxisMm: type.canon_secondAxisMm,
      canon_heightWithCapMm: type.canon_heightWithCapMm,
    };
    const primary = ready ? reference({ sourceSha256: sha(identityIndex), websiteSku, graceSku }) : null;
    const approvedReferences = primary ? [primary] : [];
    if (special && primary) {
      approvedReferences.push(reference({
        sourceSha256: "f".repeat(64),
        websiteSku,
        graceSku,
        suffix: "alternate",
      }));
    }
    const canonicalIdentityKey = `${normalizedIdentity(websiteSku)}|${normalizedIdentity(graceSku)}`;
    canonicalRecords.push(canonical);
    rows.push({
      canonicalIdentityKey,
      canonical: coverageCanonical,
      approvedReferences,
      primaryReference: primary,
      bodyMatch: {
        method: "product-group-slug",
        bodyGeometry: {
          family: type.family,
          capacityMl: type.capacityMl,
          bodyHeightMm: type.canon_bodyHeightMm,
          widthAxisMm: type.canon_widthAxisMm,
          depthAxisMm: type.canon_secondAxisMm,
          productGroupSlugs: productGroupSlug,
        },
      },
      blockers: ready ? [] : ["no-approved-exact-reference"],
      referenceReady: ready,
    });
    for (const approvedReference of approvedReferences) {
      reviewedUnits.push(reviewedUnit({ canonical, approvedReference }));
    }
    identityIndex += 1;
  };

  typeSpecs.forEach((type, typeIndex) => {
    const readyCount = typeIndex === 13 ? 121 : typeIndex < 41 ? 1 : 0;
    const blockedCount = typeIndex === 41 ? 177 : typeIndex >= 41 ? 1 : 0;
    for (let index = 0; index < readyCount; index += 1) addIdentity(type, typeIndex, true);
    for (let index = 0; index < blockedCount; index += 1) addIdentity(type, typeIndex, false);
  });

  assert.equal(rows.length, 377);
  const coverageManifest: CylinderApprovedCoverageManifest = {
    version: "best-bottles-cylinder-approved-coverage-manifest-v1",
    summary: {
      canonicalIdentityCount: 377,
      referenceReadyCount: 161,
      blockedIdentityCount: 216,
      canonicalBodyCount: 0,
      coveredBodyCount: 0,
      externalWriteCount: 0,
    },
    rows,
    bodyCoverage: [],
  };
  return { coverageManifest, canonicalRecords, reviewedUnits };
}

describe("canonical Cylinder type review", () => {
  it("groups all 377 identities into the canonical 81-type review set", () => {
    const result = buildCylinderCanonicalTypeReview(buildFixture());

    assert.equal(result.summary.canonicalIdentityCount, 377);
    assert.equal(result.summary.typeCount, 81);
    assert.equal(result.summary.readyTypeCount, 41);
    assert.equal(result.summary.blockedTypeCount, 40);
    assert.equal(result.summary.blockedIdentityCount, 216);
    assert.equal(result.summary.collapseCandidateCount, 6);
    assert.equal(result.summary.appliedCollapseCount, 0);
    assert.equal(result.summary.externalWriteCount, 0);
    assert.equal(result.collapseCandidates.length, 6);
    assert.ok(result.collapseCandidates.every((pair) => (
      pair.decision === "pending-human-review" && pair.applied === false
    )));
    assert.deepEqual(result.collapseCandidates[0].sharedCanonical, {
      family: "cylinder",
      capacityMl: 9,
      bodyHeightMm: 74,
      widthAxisMm: 21,
      secondAxisMm: 21,
      neckThreadSize: "17-415",
      applicator: "metal roller ball",
    });

    const memberships = result.types.flatMap((type) => type.identities.map((identity) => (
      identity.canonicalIdentityKey
    )));
    assert.equal(memberships.length, 377);
    assert.equal(new Set(memberships).size, 377);
    assert.equal(result.blockedIdentities.length, 216);
    assert.equal(new Set(result.blockedIdentities.map((row) => row.canonicalIdentityKey)).size, 216);
    assert.ok(result.types.filter((type) => type.status === "blocked").every((type) => (
      type.representative === null
    )));
  });

  it("fails closed on conflicting exact dual-SKU canonical records", () => {
    const fixture = buildFixture();
    fixture.canonicalRecords = [
      ...fixture.canonicalRecords,
      { ...fixture.canonicalRecords[0], capStyle: "Conflicting Cap" },
    ];
    assert.throws(
      () => buildCylinderCanonicalTypeReview(fixture),
      /conflicting canonical master rows.*dual-SKU/i,
    );
  });

  it("preserves alternate approved sources as provenance without selecting one", () => {
    const result = buildCylinderCanonicalTypeReview(buildFixture());
    const type = result.types.find((entry) => (
      entry.identities.some((identity) => identity.canonical.websiteSku === "GB09BlackCapApp")
    ));
    assert.ok(type?.representative);
    assert.equal(type.representative.sourcePath, "/approved/GB09BlackCapApp-primary.psd");
    assert.equal(type.approvedReferenceProvenance.length, 2);
    assert.deepEqual(
      type.approvedReferenceProvenance.map((source) => source.sourcePath).sort(),
      [
        "/approved/GB09BlackCapApp-alternate.psd",
        "/approved/GB09BlackCapApp-primary.psd",
      ],
    );
  });

  it("keeps GB09BlackCapApp visible while blocking only its impossible scale placement", () => {
    const result = buildCylinderCanonicalTypeReview(buildFixture());
    const type = result.types.find((entry) => (
      entry.identities.some((identity) => identity.canonical.websiteSku === "GB09BlackCapApp")
    ));
    assert.ok(type?.representative);
    assert.equal(type.representative.previewPath, "/approved/GB09BlackCapApp-primary.png");
    assert.equal(type.scale.blocker, "canonical-with-cap-below-body");
    assert.equal(type.scale.placement, null);
    assert.equal(type.scale.canonical.bodyHeightMm, 79.4);
    assert.equal(type.scale.canonical.heightWithCapMm, 50);
  });

  it("rejects a ready primary that does not resolve to its exact reviewed unit and source", () => {
    const fixture = buildFixture();
    fixture.reviewedUnits = fixture.reviewedUnits.filter((unit) => (
      unit.reviewUnitKey !== fixture.coverageManifest.rows[0].primaryReference?.reviewUnitKey
    ));
    assert.throws(
      () => buildCylinderCanonicalTypeReview(fixture),
      /primary reference.*reviewed unit/i,
    );
  });

  it("fails closed when a fixed collapse pair no longer resolves uniquely", () => {
    const fixture = buildFixture();
    const target = fixture.canonicalRecords.find((row) => (
      row.capacityMl === "9" && row.applicator === "Metal Roller Ball" && row.capStyle === "Roll-On"
    ));
    assert.ok(target);
    target.capStyle = "Unplanned Taxonomy";
    assert.throws(
      () => buildCylinderCanonicalTypeReview(fixture),
      /collapse candidate.*resolve uniquely/i,
    );
  });
});
