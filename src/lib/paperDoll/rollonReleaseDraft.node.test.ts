import assert from "node:assert/strict";
import test from "node:test";

import { loadCyl9RollonRequirements } from "./rollonRequirements";
import {
  buildRollonReleaseDraft,
  type RollonReleaseInventoryVersion,
} from "./rollonReleaseDraft.node";

const SHA = "a".repeat(64);

function approvedBody(variantKey: string): RollonReleaseInventoryVersion {
  return {
    requirementKey: `CYL-9ML:BODY:${variantKey}`,
    componentVersionId: `version-${variantKey}`,
    componentKey: `body-${variantKey}`,
    geometryFamilyId: "body__cylinder__9ml__70x20__v1",
    slot: "body",
    variantKey,
    materialVariant: `${variantKey.toLowerCase()}-glass`,
    imagePath: `org/CYL-9ML/body-${variantKey}/${SHA}.png`,
    imageSha256: SHA,
    geometryMaskPath: null,
    geometryMaskSha256: null,
    widthPx: 2080,
    heightPx: 2288,
    alphaBounds: { left: 860, top: 740, right: 1223, bottom: 2100 },
    mountAxisXPx: 1041,
    seatYPx: 2101,
    approvalStatus: "approved",
    blockingQaPassed: true,
    qaEvidenceIds: [`qa-${variantKey}`],
  };
}

function blockedComponent(requirementKey: string, slot: "overcap" | "roller", variantKey: string): RollonReleaseInventoryVersion {
  return {
    ...approvedBody(variantKey),
    requirementKey,
    componentVersionId: `blocked-${variantKey}`,
    componentKey: `${slot}-${variantKey}`,
    geometryFamilyId: slot === "roller"
      ? "fitment__17-415__roller-ball__v1"
      : "closure__cylinder__17-415__rollon-overcap__v1",
    slot,
    materialVariant: "qualification-blocked",
    approvalStatus: "blocked",
    blockingQaPassed: false,
  };
}

function approvedPlasticRoller(): RollonReleaseInventoryVersion {
  return {
    ...approvedBody("PLASTIC"),
    requirementKey: "CYL-9ML:ROLLER:PLASTIC",
    componentVersionId: "version-plastic-roller",
    componentKey: "closure__17-415__plastic-roller-ball__natural",
    geometryFamilyId: "fitment__roller-ball__17-415__v1",
    slot: "roller",
    variantKey: "PLASTIC",
    materialVariant: "matte-white-plastic",
    geometryMaskPath: `org/CYL-9ML/plastic-mask/${"b".repeat(64)}.png`,
    geometryMaskSha256: "b".repeat(64),
  };
}

test("release contains no missing requirement disguised as complete", () => {
  const requirements = loadCyl9RollonRequirements();
  const inventory = [
    ...requirements.bodyVariantKeys.map(approvedBody),
    ...requirements.overcapVariantKeys.map((variant) => blockedComponent(`CYL-9ML:OVERCAP:${variant}`, "overcap", variant)),
    blockedComponent("CYL-9ML:ROLLER:METAL", "roller", "METAL"),
  ];
  const draft = buildRollonReleaseDraft({
    requirements,
    inventory,
    releaseVersion: "1.0.0-rollon-draft.1",
    sourceGitCommit: "test-commit",
    rendererVersion: "cyl9-rollon-blender-v1",
  });

  assert.equal(draft.counts.required, requirements.requirements.length);
  assert.equal(draft.counts.approved + draft.counts.blocked + draft.counts.missing, draft.counts.required);
  assert.deepEqual(draft.counts, { required: 17, approved: 5, blocked: 11, missing: 1 });
  assert.equal(draft.releaseStatus, "blocked");
});

test("unknown or blocked component prevents ready status", () => {
  const requirements = loadCyl9RollonRequirements();
  const inventory = [
    ...requirements.bodyVariantKeys.map(approvedBody),
    blockedComponent("CYL-9ML:ROLLER:METAL", "roller", "METAL"),
  ];
  const draft = buildRollonReleaseDraft({
    requirements,
    inventory,
    releaseVersion: "1.0.0-rollon-draft.2",
    sourceGitCommit: "test-commit",
    rendererVersion: "cyl9-rollon-blender-v1",
  });

  assert.equal(draft.releaseStatus, "blocked");
  assert.ok(draft.blockers.some((blocker) => blocker.includes("CYL-9ML:ROLLER:METAL")));
  assert.ok(draft.manifestSha256.match(/^[a-f0-9]{64}$/));
});

test("approved plastic roller becomes the sixth exact release asset without clearing unrelated blockers", () => {
  const requirements = loadCyl9RollonRequirements();
  const draft = buildRollonReleaseDraft({
    requirements,
    inventory: [
      ...requirements.bodyVariantKeys.map(approvedBody),
      approvedPlasticRoller(),
    ],
    releaseVersion: "1.0.0-rollon-plastic-roller.1",
    sourceGitCommit: "test-commit",
    rendererVersion: "cyl9-rollon-blender-v1",
  });

  assert.deepEqual(draft.counts, { required: 17, approved: 6, blocked: 1, missing: 10 });
  assert.equal(draft.releaseStatus, "blocked");
  assert.equal(draft.manifest.assets.filter((asset) => asset.slot === "roller").length, 1);
  assert.equal(draft.manifest.assets.find((asset) => asset.slot === "roller")?.variantKey, "PLASTIC");
});
