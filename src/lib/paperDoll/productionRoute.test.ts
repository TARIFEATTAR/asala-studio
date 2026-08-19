import assert from "node:assert/strict";
import test from "node:test";

import {
  PRODUCTION_ROUTE_STAGE_IDS,
  adaptContainmentReceiptToProductionRoute,
  buildProductionRouteMatrixRow,
  type ProductionRouteRegistration,
} from "./productionRoute";
import { cyl9ProductionRoute } from "./cyl9ProductionRoute";

const sourceRecordSha256 = "ee23de8a981b3c0c1db68508b195db7ebb6059a69cf5f9cd60edac361b630043";

const receipt = {
  schemaVersion: 1,
  recordType: "artifact-containment-receipt",
  project: "Best Bottles",
  assetKey: "cyl-009-17-415",
  createdAt: "2026-08-19",
  scope: "Contained Cylinder 9 mL / 17-415 production evidence.",
  sourceRepository: "/tmp/best-bottles",
  git: {
    branch: "checkpoint/best-bottles-9ml-containment-2026-08-19",
    commit: "e8ef19aa68f96cb31a958c9272f7bd90f692e22e",
    bundle: "repo/best-bottles-9ml-source-checkpoint.bundle",
    bundleVerified: true,
    completeHistory: true,
    pushed: false,
  },
  protection: {
    protectedEntriesIncludingBundle: 413,
    checksumEntries: 415,
    totalBytesIncludingBundle: 1_998_854_267,
    localCapsule: "/tmp/local-capsule",
    googleDriveMirror: "/tmp/drive-mirror",
    manifestSha256: "24af1c6acc1b58a01e5391d6167ec22dcb88f1b9e7eb45f54b53aa2be34a41ea",
    localChecksumsPassed: 415,
    mirrorChecksumsPassed: 415,
    localFilesystemReadOnly: true,
    mirrorFilesystemReadOnly: true,
    sourceFilesMoved: false,
    sourceBlendFilesEdited: false,
    providerSideCloudSyncIndependentlyVerified: false,
  },
  approvalScope: {
    hashVerified: "17-415 thread/geometry across the five locked scenes",
    notImplied: [
      "final material approval",
      "studio approval",
      "component approval",
      "assembly approval",
      "catalog approval",
      "PDP approval",
    ],
  },
  verification: {
    pythonContractTests: "29/29 passed",
    blender17415Helix: "passed",
    blenderFiveVariantBaseline: "passed",
    gitBundle: "valid; complete history",
    substanceAddonWarning: "Non-fatal warning.",
  },
};

const registration: ProductionRouteRegistration = {
  schemaVersion: 1,
  routeId: "CYL-9ML-17-415-COBALT-ROLLER",
  sourceAssetKey: "cyl-009-17-415",
  sourceRecordPath: "pipeline/paper-doll-3d/artifacts/records/9ml-containment-2026-08-19.json",
  expectedSourceRecordSha256: sourceRecordSha256,
  familyKey: "CYL-9ML",
  identity: {
    commercialName: "Cobalt Cylinder 9 mL",
    graceSku: "GB-CYL-BLU-9ML-MRL-MSLV",
    websiteSku: "GBCylBlu9MtlRollMattSl",
    finish: "17-415",
    housing: "Natural roller housing",
    ball: "Metal roller ball",
    cap: "Matte-silver cap",
    catalog: { volumeMl: 9, heightMm: 70, diameterMm: 20 },
    drawing: { volumeMl: 10, heightMm: 72, diameterMm: 19.7 },
    discrepancy: "Catalog 9 mL / 70 × 20 mm conflicts with drawing 10 mL / 72 × 19.7 mm.",
  },
  stages: [
    { id: "source", label: "Source", status: "verified", summary: "Containment receipt verified.", gateScope: "Document and artifact provenance" },
    { id: "identity", label: "Identity", status: "blocked", summary: "Catalog and drawing identity conflict.", gateScope: "Commercial and drawing identity" },
    { id: "contract", label: "Contract", status: "in-progress", summary: "Contract retains both identities.", gateScope: "Deterministic geometry contract" },
    { id: "blender-build", label: "Blender Build", status: "verified", summary: "Source checkpoint and tests verified.", gateScope: "Recoverable deterministic build" },
    { id: "geometry-lock", label: "Geometry Lock", status: "approved", summary: "17-415 thread/geometry only.", gateScope: "Five locked scenes" },
    { id: "material-studio", label: "Material + Studio", status: "candidate", summary: "Visual baseline only.", gateScope: "Materials, lighting, canvas, shadow" },
    { id: "components-assembly", label: "Components + Assembly", status: "candidate", summary: "Roller and cap remain candidates.", gateScope: "Housing, ball, cap, assembled fit" },
    { id: "qa-release", label: "QA + Release", status: "blocked", summary: "Assembly and PDP gates remain open.", gateScope: "Named assembly and PDP approvals" },
    { id: "publish-verify", label: "Publish + Verify", status: "not-started", summary: "No downstream release asserted.", gateScope: "Sanity, Convex, Shopify read-back" },
  ],
  blockers: [
    "Resolve catalog/drawing dimensional identity.",
    "Approve components and complete assembly separately.",
    "Approve cap-off applicator-visible PDP before publication.",
  ],
  nextAction: "Resolve the 9 mL catalog versus 10 mL drawing identity before downstream release.",
  evidence: [],
};

test("committed CYL-9ML route artifact parses as the first complete registered row", () => {
  assert.equal(cyl9ProductionRoute.routeId, "CYL-9ML-17-415-COBALT-ROLLER");
  assert.equal(cyl9ProductionRoute.stageCoverageComplete, true);
  assert.equal(cyl9ProductionRoute.provenanceComplete, true);
  assert.equal(cyl9ProductionRoute.releaseReady, false);
  assert.equal(cyl9ProductionRoute.evidence.length, 4);
});

test("adapter registers one structurally complete but release-blocked production route", () => {
  const route = adaptContainmentReceiptToProductionRoute(receipt, registration, sourceRecordSha256);

  assert.equal(route.routeId, "CYL-9ML-17-415-COBALT-ROLLER");
  assert.deepEqual(route.stages.map((stage) => stage.id), PRODUCTION_ROUTE_STAGE_IDS);
  assert.equal(route.stageCoverageComplete, true);
  assert.equal(route.provenanceComplete, true);
  assert.equal(route.releaseReady, false);
  assert.equal(route.overallStatus, "blocked");
  assert.equal(route.stages.find((stage) => stage.id === "geometry-lock")?.status, "approved");
  assert.equal(route.stages.find((stage) => stage.id === "components-assembly")?.status, "candidate");
  assert.equal(route.stages.find((stage) => stage.id === "publish-verify")?.status, "not-started");
});

test("adapter preserves both commercial and drawing identity instead of silently normalizing", () => {
  const route = adaptContainmentReceiptToProductionRoute(receipt, registration, sourceRecordSha256);

  assert.equal(route.identity.catalog.volumeMl, 9);
  assert.equal(route.identity.catalog.heightMm, 70);
  assert.equal(route.identity.drawing.volumeMl, 10);
  assert.equal(route.identity.drawing.heightMm, 72);
  assert.match(route.identity.discrepancy, /conflicts/i);
});

test("adapter rejects incomplete stage coverage and a drifted source record", () => {
  assert.throws(
    () => adaptContainmentReceiptToProductionRoute(
      receipt,
      { ...registration, stages: registration.stages.slice(0, -1) },
      sourceRecordSha256,
    ),
    /exactly once/i,
  );
  assert.throws(
    () => adaptContainmentReceiptToProductionRoute(receipt, registration, "a".repeat(64)),
    /source record checksum/i,
  );
});

test("adapter rejects containment that is not independently checksum-matched and read-only", () => {
  assert.throws(
    () => adaptContainmentReceiptToProductionRoute(
      {
        ...receipt,
        protection: {
          ...receipt.protection,
          mirrorChecksumsPassed: 414,
          mirrorFilesystemReadOnly: false,
        },
      },
      registration,
      sourceRecordSha256,
    ),
    /containment protection/i,
  );
});

test("matrix row combines the immutable route with the current private ledger without changing route gates", () => {
  const route = adaptContainmentReceiptToProductionRoute(receipt, registration, sourceRecordSha256);
  const row = buildProductionRouteMatrixRow(route, {
    version: "1.3.10",
    status: "ready",
    manifestSha256: "b".repeat(64),
    assetCount: 14,
    bodyCount: 5,
    componentCount: 9,
  });

  assert.equal(row.liveRelease?.version, "1.3.10");
  assert.equal(row.liveRelease?.bodyCount, 5);
  assert.equal(row.stages.find((stage) => stage.id === "identity")?.status, "blocked");
  assert.equal(row.releaseReady, false);
});
