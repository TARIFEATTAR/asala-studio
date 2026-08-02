import assert from "node:assert/strict";
import test from "node:test";

import {
  CYL9_BODY_VARIANTS,
  CYL9_ROLLER_CONTACT,
  applyPlacementToBounds,
  deriveContactPlacement,
  familyPlacementTargets,
  initialFamilyFitState,
  nudgePlacement,
  placementObjectOrigin,
  placementTransformFromObject,
  resizePlacementAroundContact,
  validateFamilyPlacement,
} from "./familyPlacementModel";

test("derives the CYL-9ML roller candidate from calibrated width, center, and contact anchors", () => {
  assert.deepEqual(deriveContactPlacement(CYL9_ROLLER_CONTACT), {
    translateXPx: 27.066,
    translateYPx: -134.132,
    scaleX: 0.974,
    scaleY: 0.974,
  });
});

test("the calibrated candidate narrows the shell to 262 px while keeping its center and mouth contact fixed", () => {
  const transform = deriveContactPlacement(CYL9_ROLLER_CONTACT);
  assert.deepEqual(
    applyPlacementToBounds({ left: 907, top: 675, right: 1175, bottom: 918 }, transform),
    { left: 910, top: 523, right: 1172, bottom: 760 },
  );
});

test("changing uniform scale preserves the current family centerline and contact line", () => {
  const start = deriveContactPlacement(CYL9_ROLLER_CONTACT);
  const resized = resizePlacementAroundContact(start, CYL9_ROLLER_CONTACT, 0.96);
  assert.equal(resized.scaleX, 0.96);
  assert.equal(resized.scaleY, 0.96);
  assert.ok(Math.abs(
    CYL9_ROLLER_CONTACT.sourceCenterXPx * resized.scaleX + resized.translateXPx
      - CYL9_ROLLER_CONTACT.targetCenterXPx
  ) < 0.001);
  assert.ok(Math.abs(
    CYL9_ROLLER_CONTACT.sourceContactYPx * resized.scaleY + resized.translateYPx
      - CYL9_ROLLER_CONTACT.targetContactYPx
  ) < 0.001);
});

test("one family placement targets all five locked body variants without per-body offsets", () => {
  assert.deepEqual(CYL9_BODY_VARIANTS, ["AMB", "BLU", "CLR", "FRS", "SWL"]);
  const targets = familyPlacementTargets(deriveContactPlacement(CYL9_ROLLER_CONTACT));
  assert.equal(targets.length, 5);
  assert.deepEqual(new Set(targets.map((target) => JSON.stringify(target.transform))).size, 1);
  assert.deepEqual(targets.map((target) => target.bodyVariantKey), CYL9_BODY_VARIANTS);
});

test("family placement permits translation and uniform scale but rejects geometry distortion", () => {
  assert.deepEqual(validateFamilyPlacement({ translateXPx: 0, translateYPx: -158, scaleX: 1, scaleY: 1 }), []);
  assert.deepEqual(validateFamilyPlacement({ translateXPx: 0, translateYPx: -158, scaleX: 1.01, scaleY: 0.99 }), [
    "Family placement scale must remain uniform.",
  ]);
});

test("nudge changes one family transform rather than creating a body-specific adjustment", () => {
  const start = deriveContactPlacement(CYL9_ROLLER_CONTACT);
  assert.deepEqual(nudgePlacement(start, { x: -1, y: 2 }), {
    translateXPx: 26.066,
    translateYPx: -132.132,
    scaleX: 0.974,
    scaleY: 0.974,
  });
});

test("the interactive alpha box round-trips the family transform", () => {
  const bounds = { left: 907, top: 675, right: 1175, bottom: 918 };
  const transform = deriveContactPlacement(CYL9_ROLLER_CONTACT);
  assert.deepEqual(placementObjectOrigin(bounds, transform), { x: 910.484, y: 523.318 });
  assert.deepEqual(
    placementTransformFromObject({ left: 910.484, top: 523.318, scale: 0.974, bounds }),
    { translateXPx: 27, translateYPx: -134, scaleX: 0.974, scaleY: 0.974 },
  );
});

test("a refreshed CYL-9ML workbench opens the measured roller fit instead of the identity release view", () => {
  assert.deepEqual(initialFamilyFitState({
    familyKey: "CYL-9ML",
    assets: [
      { componentVersionId: "body-clear", slot: "body", variantKey: "CLR" },
      { componentVersionId: "body-amber", slot: "body", variantKey: "AMB" },
      { componentVersionId: "roller-plastic", slot: "roller", variantKey: "PLASTIC" },
    ],
  }), {
    mode: "family-fit",
    selectedBodyId: "body-amber",
    selectedLayerId: "roller-plastic",
    transform: { translateXPx: 27.066, translateYPx: -134.132, scaleX: 0.974, scaleY: 0.974 },
  });
});

test("a family without a registered roller remains in the immutable release view", () => {
  assert.deepEqual(initialFamilyFitState({
    familyKey: "CYL-9ML",
    assets: [{ componentVersionId: "body-amber", slot: "body", variantKey: "AMB" }],
  }), {
    mode: "release-lock",
    selectedBodyId: "body-amber",
    selectedLayerId: "body-amber",
    transform: { translateXPx: 0, translateYPx: 0, scaleX: 1, scaleY: 1 },
  });
});
