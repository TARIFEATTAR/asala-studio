import assert from "node:assert/strict";
import test from "node:test";

import {
  deriveAssemblyReadiness,
  parseReleaseCutRequest,
  stableSanityDocumentIds,
} from "./releaseCutContract";

const UUIDS = {
  organization: "4ab1ac72-cd7e-4faf-9152-5aa5f2862411",
  release: "4fc87a1b-9b7d-4555-ab03-00fa14ed6ba0",
  plastic: "02161d6f-fb7c-4b44-ba98-a61500181529",
  metal: "e7a6636a-b2db-4bfe-bbb9-fde0458fe407",
  placement: "fbe551b9-19ca-4202-842c-06634fdae2da",
  body1: "11111111-1111-4111-8111-111111111111",
  body2: "22222222-2222-4222-8222-222222222222",
  body3: "33333333-3333-4333-8333-333333333333",
  body4: "44444444-4444-4444-8444-444444444444",
  body5: "55555555-5555-4555-8555-555555555555",
};

function validRequest() {
  return {
    organizationId: UUIDS.organization,
    familyKey: "CYL-9ML",
    expectedCurrentReleaseId: UUIDS.release,
    releaseVersion: "1.1.0-rollon-pair.1",
    selectedComponents: [
      { componentVersionId: UUIDS.plastic, slot: "roller", variantKey: "PLASTIC", placementVersionId: UUIDS.placement },
      { componentVersionId: UUIDS.metal, slot: "roller", variantKey: "METAL", placementVersionId: UUIDS.placement },
    ],
    compatibleBodyComponentVersionIds: [UUIDS.body1, UUIDS.body2, UUIDS.body3, UUIDS.body4, UUIDS.body5],
    approverDisplayName: "Jordan Richter",
    approvalNote: "Approved both roller materials across all five plates.",
    sourceGitCommit: "e63eeaf",
    rendererVersion: "paper-doll-release-cut-v1",
  };
}

test("release cut accepts the approved roller pair and binds one exact shared placement", () => {
  const parsed = parseReleaseCutRequest(validRequest());
  assert.equal(parsed.selectedComponents.length, 2);
  assert.deepEqual(parsed.selectedComponents.map((item) => item.variantKey), ["PLASTIC", "METAL"]);
  assert.equal(new Set(parsed.selectedComponents.map((item) => item.placementVersionId)).size, 1);
  assert.equal(parsed.compatibleBodyComponentVersionIds.length, 5);
});

test("release cut rejects duplicate slots/variants, missing named approval, or a non-canonical canvas family", () => {
  const duplicate = validRequest();
  duplicate.selectedComponents[1] = { ...duplicate.selectedComponents[0] };
  assert.throws(() => parseReleaseCutRequest(duplicate), /slot and variant/i);
  assert.throws(() => parseReleaseCutRequest({ ...validRequest(), approverDisplayName: " " }), /approver/i);
  assert.throws(() => parseReleaseCutRequest({ ...validRequest(), familyKey: "CYL-3ML" }), /CYL-9ML/i);
});

test("readiness is per SKU: approved bodies and rollers remain incomplete until that SKU cap exists", () => {
  const mapping = {
    mappingKey: "amber-plastic-matte-gold",
    websiteSku: "GB-CYL-AMB-9ML-ROL-MGLD",
    bodyVariantKey: "AMBER-GLASS",
    fitmentVariantKey: "PLASTIC",
    closureVariantKey: null,
    overcapVariantKey: "MAT-GL",
  };
  const withoutCap = deriveAssemblyReadiness(mapping, [
    { slot: "body", variantKey: "AMBER-GLASS" },
    { slot: "roller", variantKey: "PLASTIC" },
  ]);
  assert.deepEqual(withoutCap, { status: "incomplete", missingReasons: ["cap:MAT-GL"] });

  const withCap = deriveAssemblyReadiness(mapping, [
    { slot: "body", variantKey: "AMBER-GLASS" },
    { slot: "roller", variantKey: "PLASTIC" },
    { slot: "cap", variantKey: "MAT-GL" },
  ]);
  assert.deepEqual(withCap, { status: "ready", missingReasons: [] });
});

test("Sanity draft and public IDs are stable and deliberately separate", () => {
  assert.deepEqual(stableSanityDocumentIds("CYL-9ML"), {
    draftId: "drafts.paperDollFamily.CYL-9ML",
    publicId: "paperDollFamily.CYL-9ML",
  });
});
