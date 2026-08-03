import assert from "node:assert/strict";
import { test } from "node:test";

import type { PaperDollReleaseManifest } from "@/lib/paperDoll/releaseContract";
import { buildPaperDollSanityProjection } from "@/lib/paperDoll/sanityProjection";
import { buildPublishPreviewModel } from "./publishPreviewModel";

const manifest: PaperDollReleaseManifest = {
  schemaVersion: 1,
  familyKey: "CYL-9ML",
  releaseVersion: "1.0.0-draft.1",
  status: "blocked",
  canvas: { widthPx: 2080, heightPx: 2288, backgroundHex: "#F5F3EF" },
  assets: [{
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
  }],
  assemblyRecipes: [],
  assemblyMappings: [],
  qaEvidence: [{
    evidenceId: "translucent-context",
    subjectId: "cap@fixture",
    gateKey: "translucent-assembly-context",
    gateVersion: "1",
    status: "blocked",
    blocking: true,
    calibratedWith: ["isolated-translucent"],
    measurements: { isolatedLayer: true },
    issues: ["assembly_context_required"],
  }],
  blockers: ["assembly_context_required:cap@fixture"],
  provenance: { sourceGitCommit: "fixture", rendererVersion: "fixture" },
};

test("publish preview preserves nine ordered gates and exact blockers", async () => {
  const projection = await buildPaperDollSanityProjection(manifest);
  const model = buildPublishPreviewModel({
    manifest,
    projection,
    catalogReconciliation: { catalogProducts: 10, mappedProducts: 0, previewMappings: 15, unmatchedProducts: 10 },
    lineupReady: false,
  });
  assert.deepEqual(model.phases.map((phase) => phase.key), [
    "catalog-identity",
    "component-truth",
    "geometry-lock",
    "assembly-context",
    "matrix-completeness",
    "catalog-lineup",
    "sanity-round-trip",
    "named-visual-approval",
    "publication-verification",
  ]);
  assert.equal(model.phases.find((phase) => phase.key === "assembly-context")?.status, "blocked");
  assert.match(model.blockers.join("\n"), /assembly_context_required/);
});

test("publish preview proves unconfigured zero-write state and disables actions", async () => {
  const projection = await buildPaperDollSanityProjection(manifest);
  const model = buildPublishPreviewModel({
    manifest,
    projection,
    catalogReconciliation: { catalogProducts: 0, mappedProducts: 0, previewMappings: 0, unmatchedProducts: 0 },
    lineupReady: false,
  });
  assert.equal(model.target.projectId, "unconfigured");
  assert.equal(model.writeCount, 0);
  assert.equal(model.roundTripPassed, true);
  assert.equal(model.approvalEnabled, false);
  assert.equal(model.publishEnabled, false);
  assert.equal(model.diff.mode, "full-document-create-preview");
  assert.equal(model.diff.changes, 0);
  assert.match(model.payloadSha256, /^[a-f0-9]{64}$/);
});

test("draft and public guards remain separate named actions", async () => {
  const projection = await buildPaperDollSanityProjection(manifest, {
    projectId: "gh97irjh",
    dataset: "production",
    documentId: "d5291f24-f02b-4fb7-aa99-78c5f63d8c9d",
    documentType: "paperDollFamily",
  });
  const draftReady = buildPublishPreviewModel({
    manifest,
    projection,
    catalogReconciliation: { catalogProducts: 1, mappedProducts: 1, previewMappings: 0, unmatchedProducts: 0 },
    lineupReady: true,
    releaseCutId: "cut-cyl9-v1",
    draftApproval: { approvedByName: "Jordan Richter", approvalNote: "Sync approved layers." },
    successfulDraftSync: null,
    publicApproval: null,
    downstreamScopeConfirmed: false,
  });
  assert.equal(draftReady.draftSyncEnabled, true);
  assert.equal(draftReady.publishEnabled, false);

  const publicReady = buildPublishPreviewModel({
    manifest,
    projection,
    catalogReconciliation: { catalogProducts: 1, mappedProducts: 1, previewMappings: 0, unmatchedProducts: 0 },
    lineupReady: true,
    releaseCutId: "cut-cyl9-v1",
    draftApproval: { approvedByName: "Jordan Richter", approvalNote: "Sync approved layers." },
    successfulDraftSync: { releaseCutId: "cut-cyl9-v1", revision: "draft-rev-1" },
    publicApproval: { approvedByName: "Jordan Richter", approvalNote: "Publish roll-on scope." },
    downstreamScopeConfirmed: true,
  });
  assert.equal(publicReady.draftSyncEnabled, true);
  assert.equal(publicReady.publishEnabled, true);
});
