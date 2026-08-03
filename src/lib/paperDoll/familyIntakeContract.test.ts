import assert from "node:assert/strict";
import { test } from "node:test";

import {
  parsePaperDollCatalogFamilyIntakeIndex,
  parsePaperDollFamilyIntake,
  type PaperDollCatalogFamilyIntakeIndex,
  type PaperDollFamilyIntake,
} from "./familyIntakeContract";

const SHA = "a".repeat(64);

function fixture(): PaperDollFamilyIntake {
  return {
    schemaVersion: 1,
    familyKey: "CYL-5ML-13-415",
    familyName: "Cylinder 5ml",
    scope: "13-415 pilot",
    sourceBacklogPath: "docs/backlog.json",
    sourceBacklogSha256: SHA,
    canvas: { widthPx: 2080, heightPx: 2288, backgroundHex: "#F5F3EF" },
    geometries: [{ geometryKey: "geometry-1", capacityMl: 5, dimensionsMm: { bodyHeight: 53, widthAxis: 17, depthAxis: 17, axisSemantics: "round" }, productGroupSlugs: ["cylinder-5ml"], conflictFlags: [], authorityStatus: "missing" }],
    bodyAppearances: [{ bodyAppearanceKey: "geometry-1:clear", geometryKey: "geometry-1", color: "Clear", truthStatus: "ready", authorityStatus: "missing", plateStatus: "missing" }],
    componentRequirements: [{ componentRequirementKey: "roller-1", slot: "roller", descriptor: { applicator: "Plastic Roller Ball" }, compatibleGeometryKeys: ["geometry-1"], sourceIdentity: null, compatibilityStatus: "unverified", authorityStatus: "missing" }],
    catalogIdentities: [{ websiteSku: "SKU-1", graceSkus: ["GRACE-1"], bodyGeometryKeys: ["geometry-1"], bodyColors: ["Clear"], componentRequirementKeys: ["roller-1"], reviewStatus: "ready", issues: [] }],
    blockers: ["body-authority-missing"],
    mutationPolicy: { candidatesGenerated: false, remoteWritesPerformed: false, currentReleaseChanged: false, sanityChanged: false },
  };
}

test("family intake accepts pre-authority inventory without weakening the production manifest", () => {
  assert.equal(parsePaperDollFamilyIntake(fixture()).bodyAppearances[0].plateStatus, "missing");
});

test("family intake rejects dangling geometry and component references", () => {
  const invalidGeometry = fixture();
  invalidGeometry.bodyAppearances[0].geometryKey = "unknown";
  assert.throws(() => parsePaperDollFamilyIntake(invalidGeometry), /unknown geometry/i);

  const invalidRequirement = fixture();
  invalidRequirement.catalogIdentities[0].componentRequirementKeys = ["unknown"];
  assert.throws(() => parsePaperDollFamilyIntake(invalidRequirement), /unknown component requirement/i);
});

test("catalog family intake index proves its summary and keeps unresolved identities separate", () => {
  const intake = fixture();
  const index: PaperDollCatalogFamilyIntakeIndex = {
    schemaVersion: 1,
    sourceBacklogPath: "docs/backlog.json",
    sourceBacklogSha256: SHA,
    summary: {
      cohortCount: 1,
      catalogIdentityCount: 1,
      uniqueGeometryCount: 1,
      geometryMembershipCount: 1,
      bodyAppearanceRequirementCount: 1,
      componentRequirementCount: 1,
      unresolvedIdentityCount: 1,
    },
    cohorts: [intake],
    unresolvedCatalogIdentities: [{
      websiteSku: "SKU-UNRESOLVED",
      graceSkus: ["GRACE-UNRESOLVED"],
      family: ["Cylinder"],
      capacityMl: ["5"],
      geometryStatus: "unresolved",
      geometryKeys: [],
      issues: ["body-geometry-unresolved"],
    }],
    mutationPolicy: { candidatesGenerated: false, remoteWritesPerformed: false, currentReleaseChanged: false, sanityChanged: false },
  };
  assert.equal(parsePaperDollCatalogFamilyIntakeIndex(index).summary.cohortCount, 1);
  index.summary.catalogIdentityCount = 2;
  assert.throws(() => parsePaperDollCatalogFamilyIntakeIndex(index), /does not match indexed evidence/i);
});
