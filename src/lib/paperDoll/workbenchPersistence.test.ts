import assert from "node:assert/strict";
import { test } from "node:test";

import { loadCyl9ComponentFactory } from "./cyl9ComponentFactory";
import {
  buildCandidateApprovalPayload,
  buildSharedPlacementPayload,
  mapPersistedCandidates,
  parsePrivateStoragePath,
  resolveApprovedBodyVersionIds,
  type PaperDollCandidateRow,
} from "./workbenchPersistence";
import type { PaperDollReleaseAsset } from "./releaseContract";

const SHA = "a".repeat(64);

test("private candidate paths are parsed without accepting traversal", () => {
  assert.deepEqual(parsePrivateStoragePath("private://paper-doll-candidates/org/candidate.png"), {
    bucket: "paper-doll-candidates",
    path: "org/candidate.png",
  });
  assert.throws(() => parsePrivateStoragePath("public://bucket/file.png"));
  assert.throws(() => parsePrivateStoragePath("private://bucket/../file.png"));
});

test("persisted candidate rows join to the local component registry and signed previews", () => {
  const manifest = loadCyl9ComponentFactory();
  const component = manifest.components[0];
  const privatePath = "private://paper-doll-candidates/org/candidate.png";
  const row: PaperDollCandidateRow = {
    id: "candidate-1",
    component_id: "component-1",
    variant_key: component.variants[0].variantKey,
    original_filename: component.source.originalFilename,
    source_path: "private://paper-doll-candidates/org/raw.png",
    source_sha256: SHA,
    normalized_path: privatePath,
    normalized_sha256: SHA,
    layer_path: "private://paper-doll-candidates/org/layer.png",
    layer_sha256: SHA,
    authority_mask_path: "private://paper-doll-authority/org/mask.png",
    authority_mask_sha256: SHA,
    source_bounds: { left: 869, top: 501, width: 344, height: 501 },
    edit_bounds: { left: 869, top: 501, width: 344, height: 501 },
    authority_bounds: { left: 800, top: 200, width: 420, height: 500 },
    placement_bounds: { left: 800, top: 200, width: 420, height: 500 },
    provider: "openai",
    model: "gpt-image-2",
    prompt_sha256: SHA,
    estimated_cost_usd: "0.42",
    qa: { geometryLocked: true, minIoU: 1, mismatchedPixels: 0 },
    lifecycle_state: "candidate",
    created_at: "2026-08-03T12:00:00.000Z",
  };
  const [candidate] = mapPersistedCandidates({
    familyKey: manifest.familyKey,
    components: manifest.components,
    componentRows: [{ id: "component-1", component_key: component.componentKey }],
    candidateRows: [row],
    signedUrlsByPrivatePath: { [privatePath]: "https://signed.example/candidate.png" },
    placementVersionIdsByCandidateId: { "candidate-1": "placement-version-1" },
    componentVersionsByCandidateId: { "candidate-1": { id: "component-version-1", approvalStatus: "approved" } },
  });
  assert.equal(candidate.componentKey, component.componentKey);
  assert.equal(candidate.normalizedUrl, "https://signed.example/candidate.png");
  assert.deepEqual({ width: candidate.source.widthPx, height: candidate.source.heightPx }, { width: 2080, height: 2288 });
  assert.equal(candidate.qa.geometryLocked, true);
  assert.equal(candidate.estimatedCostUsd, 0.42);
  assert.equal(candidate.placementVersionId, "placement-version-1");
  assert.equal(candidate.componentVersionId, "component-version-1");
  assert.equal(candidate.componentVersionApprovalStatus, "approved");
});

test("approval payload preserves immutable candidate expectations", () => {
  const manifest = loadCyl9ComponentFactory();
  const component = manifest.components[0];
  const candidate = mapPersistedCandidates({
    familyKey: manifest.familyKey,
    components: manifest.components,
    componentRows: [{ id: "component-1", component_key: component.componentKey }],
    candidateRows: [{
      id: "candidate-1", component_id: "component-1", variant_key: component.variants[0].variantKey,
      original_filename: component.source.originalFilename, source_path: "private://paper-doll-candidates/raw.png",
      source_sha256: SHA, normalized_path: "private://paper-doll-candidates/candidate.png", normalized_sha256: SHA,
      layer_path: "private://paper-doll-candidates/layer.png", layer_sha256: SHA,
      authority_mask_path: "private://paper-doll-authority/mask.png", authority_mask_sha256: SHA,
      source_bounds: { left: 0, top: 0, width: 552, height: 736 }, edit_bounds: { left: 0, top: 0, width: 552, height: 736 },
      authority_bounds: { left: 800, top: 200, width: 420, height: 500 }, placement_bounds: { left: 800, top: 200, width: 420, height: 500 },
      provider: "openai", model: "gpt-image-2", prompt_sha256: SHA, estimated_cost_usd: 0.42,
      qa: { geometryLocked: true, minIoU: 1, mismatchedPixels: 0 }, lifecycle_state: "candidate", created_at: "2026-08-03T12:00:00.000Z",
    }],
  })[0];
  assert.deepEqual(buildCandidateApprovalPayload({
    organizationId: "org-1", candidate, action: "pixels-approved", approvedByName: " Jordan Richter ", approvalNote: " Reviewed exact alpha. ",
  }), {
    organizationId: "org-1", candidateId: "candidate-1", action: "pixels-approved", approvedByName: "Jordan Richter",
    approvalNote: "Reviewed exact alpha.", expectedLifecycleState: "candidate", expectedContentSha256: SHA,
  });
});

function body(variantKey: string, index: number): PaperDollReleaseAsset {
  return {
    componentVersionId: `local-body-${variantKey}`,
    componentKey: `body-${variantKey}`,
    geometryFamilyId: "body-family",
    slot: "body",
    variantKey,
    materialVariant: variantKey.toLowerCase(),
    imagePath: `${variantKey}.png`,
    imageSha256: String(index + 1).repeat(64),
    geometryMaskPath: null,
    geometryMaskSha256: null,
    widthPx: 2080,
    heightPx: 2288,
    alphaBounds: { left: 800, top: 700, right: 1200, bottom: 2100 },
    mountAxisXPx: 1040,
    seatYPx: 2100,
    approvalStatus: "approved",
  };
}

test("approved body pixels resolve to the exact persisted UUIDs", () => {
  const bodies = ["AMB", "BLU", "CLR", "FRS", "SWL"].map(body);
  const components = bodies.map((item, index) => ({ id: `component-${index}`, component_key: item.componentKey }));
  const versions = bodies.map((item, index) => ({
    id: `00000000-0000-4000-8000-00000000000${index}`,
    component_id: `component-${index}`,
    image_sha256: item.imageSha256,
    approval_status: "approved",
  }));
  const resolved = resolveApprovedBodyVersionIds({ bodies, components, versions });
  assert.equal(Object.keys(resolved).length, 5);
  assert.equal(resolved.AMB, versions[0].id);
});

test("shared placement payload uses exact candidate bounds and five explicit body UUIDs", () => {
  const bodies = ["AMB", "BLU", "CLR", "FRS", "SWL"].map(body);
  const manifest = loadCyl9ComponentFactory();
  const component = manifest.components[0];
  const candidate = mapPersistedCandidates({
    familyKey: manifest.familyKey,
    components: manifest.components,
    componentRows: [{ id: "component-1", component_key: component.componentKey }],
    candidateRows: [{
      id: "candidate-1", component_id: "component-1", variant_key: component.variants[0].variantKey,
      original_filename: component.source.originalFilename, source_path: "private://paper-doll-candidates/raw.png",
      source_sha256: SHA, normalized_path: "private://paper-doll-candidates/candidate.png", normalized_sha256: SHA,
      layer_path: "private://paper-doll-candidates/layer.png", layer_sha256: SHA,
      authority_mask_path: "private://paper-doll-authority/mask.png", authority_mask_sha256: SHA,
      source_bounds: { left: 0, top: 0, width: 552, height: 736 }, edit_bounds: { left: 0, top: 0, width: 552, height: 736 },
      authority_bounds: { left: 800, top: 200, width: 420, height: 500 }, placement_bounds: { left: 800, top: 200, width: 420, height: 500 },
      provider: "openai", model: "gpt-image-2", prompt_sha256: SHA, estimated_cost_usd: 0.42,
      qa: { geometryLocked: true, minIoU: 1, mismatchedPixels: 0 }, lifecycle_state: "family-fit-approved", created_at: "2026-08-03T12:00:00.000Z",
    }],
  })[0];
  const ids = Object.fromEntries(bodies.map((item, index) => [item.variantKey, `00000000-0000-4000-8000-00000000000${index}`]));
  const payload = buildSharedPlacementPayload({
    organizationId: "organization-1", familyKey: "CYL-9ML", geometryFamilyId: component.geometryFamilyId,
    candidate, bodies, bodyVersionIdsByVariant: ids, approvedByName: " Jordan Richter ", approvalNote: " Five plates inspected. ",
  });
  assert.equal(payload.widthPx, 420);
  assert.equal(payload.centerXPx, 1010);
  assert.equal(payload.seatYPx, 700);
  assert.equal(payload.plates.length, 5);
  assert.deepEqual(payload.plates[0].adjustment, { deltaX: 0, deltaY: 0, scale: 1 });
});
