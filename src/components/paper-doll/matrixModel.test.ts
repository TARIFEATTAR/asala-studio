import assert from "node:assert/strict";
import { test } from "node:test";

import type { PaperDollReleaseManifest } from "@/lib/paperDoll/releaseContract";
import { buildMatrixModel, filterMatrixRows } from "./matrixModel";

const manifest: PaperDollReleaseManifest = {
  schemaVersion: 1,
  familyKey: "TEST",
  releaseVersion: "1.0.0",
  status: "blocked",
  canvas: { widthPx: 2080, heightPx: 2288, backgroundHex: "#F5F3EF" },
  assets: [
    {
      componentVersionId: "body@fixture",
      componentKey: "body",
      geometryFamilyId: "body-v1",
      slot: "body",
      variantKey: "CLR",
      materialVariant: "clear-glass",
      imagePath: "body.png",
      imageSha256: "a".repeat(64),
      geometryMaskPath: null,
      geometryMaskSha256: null,
      widthPx: 2080,
      heightPx: 2288,
      alphaBounds: { left: 860, top: 750, right: 1225, bottom: 2089 },
      mountAxisXPx: 1041,
      seatYPx: 2090,
      approvalStatus: "approved",
    },
    {
      componentVersionId: "cap@fixture",
      componentKey: "cap",
      geometryFamilyId: "cap-v1",
      slot: "cap",
      variantKey: "TRNS",
      materialVariant: "translucent-frosted",
      imagePath: "cap.png",
      imageSha256: "b".repeat(64),
      geometryMaskPath: "mask.png",
      geometryMaskSha256: "c".repeat(64),
      widthPx: 2080,
      heightPx: 2288,
      alphaBounds: { left: 860, top: 494, right: 1222, bottom: 1001 },
      mountAxisXPx: 1041,
      seatYPx: 1002,
      approvalStatus: "blocked",
    },
  ],
  assemblyRecipes: [{ recipeKey: "rollon", mode: "rollon", layerOrder: ["body", "cap"] }],
  assemblyMappings: [{
    mappingKey: "PREVIEW",
    websiteSku: "PREVIEW-WEB",
    graceSku: "PREVIEW-GRACE",
    recipeKey: "rollon",
    bodyVariantKey: "CLR",
    fitmentVariantKey: null,
    closureVariantKey: "TRNS",
    overcapVariantKey: null,
  }],
  qaEvidence: [{
    evidenceId: "translucent",
    subjectId: "cap@fixture",
    gateKey: "assembly-context",
    gateVersion: "1",
    status: "blocked",
    blocking: true,
    calibratedWith: ["fixture"],
    measurements: {},
    issues: ["context_required"],
  }],
  blockers: ["context_required"],
  provenance: { sourceGitCommit: "fixture", rendererVersion: "fixture" },
};

test("matrix keeps release lifecycle states and denominator separate", () => {
  const model = buildMatrixModel(manifest, [
    { graceSku: "REAL-GRACE", websiteSku: "REAL-WEB" },
    { graceSku: "SECOND-GRACE", websiteSku: "SECOND-WEB" },
  ]);
  assert.equal(model.rows.length, 2);
  assert.deepEqual(model.summary, {
    required: 2,
    approved: 1,
    blocked: 1,
    inRelease: 2,
    published: 0,
  });
  assert.equal(model.rows.find((row) => row.variantKey === "TRNS")?.lifecycleStatus, "blocked");
  assert.equal(model.rows.find((row) => row.variantKey === "TRNS")?.qaStatus, "blocked");
});

test("catalog reconciliation matches exact SKUs and does not count preview identities", () => {
  const preview = buildMatrixModel(manifest, [{ graceSku: "REAL", websiteSku: "WEB" }]);
  assert.deepEqual(preview.catalogReconciliation, {
    catalogProducts: 1,
    mappedProducts: 0,
    previewMappings: 1,
    unmatchedProducts: 1,
  });
  const exact = buildMatrixModel({
    ...manifest,
    assemblyMappings: [{ ...manifest.assemblyMappings[0], graceSku: "REAL", websiteSku: "WEB" }],
  }, [{ graceSku: "REAL", websiteSku: "WEB" }]);
  assert.equal(exact.catalogReconciliation.mappedProducts, 1);
  assert.equal(exact.catalogReconciliation.previewMappings, 0);
});

test("matrix filters rows without changing the source denominator", () => {
  const model = buildMatrixModel(manifest, []);
  const rows = filterMatrixRows(model.rows, { system: "rollon", role: "cap", finish: null, status: "blocked" });
  assert.equal(rows.length, 1);
  assert.equal(model.summary.required, 2);
});
