import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildBestBottlesFamilyRigPromptAdjustment } from "./bestBottlesFamilyRigPrompt";

describe("buildBestBottlesFamilyRigPromptAdjustment", () => {
  it("uses the reference canvas lock for Cylinder flattened product-truth references", () => {
    const adjustment = buildBestBottlesFamilyRigPromptAdjustment({
      family: "Cylinder",
      sku: "GB-CYL-CLR-9ML-SPR-GLD",
      websiteSku: "GBCylSwrl9SpryGl",
      applicator: "Fine Mist Sprayer",
      referenceWorkflow: "single-flattened-product-truth",
      sourceReference: "https://example.com/storage/v1/object/public/generated-images/reference-intake/cylinder/gb-cyl-clr-9ml-spr-gld.png",
    });

    const sourceTruth = adjustment.sourceTruthLines.join("\n");
    const composition = adjustment.canvasCompositionLines.join("\n");
    const fullPromptPart = [adjustment.taskLine, sourceTruth, composition].join("\n");

    assert.equal(adjustment.rigImposed, false);
    assert.match(adjustment.taskLine, /canvas placement, centerline, baseline, crop, camera distance, and scale are locked/i);
    assert.match(sourceTruth, /bounding-box footprint, centerline, baseline, crop, camera distance, and relative scale/i);
    assert.match(composition, /uploaded reference canvas is the placement lock/i);
    assert.doesNotMatch(fullPromptPart, /Composition is set by the imposed studio rig/i);
    assert.doesNotMatch(fullPromptPart, /background-removed PNG/i);
  });

  it("imposes the Cylinder rig when real body measurements are present", () => {
    const adjustment = buildBestBottlesFamilyRigPromptAdjustment({
      family: "Cylinder",
      sku: "GB-CYL-CLR-454ML-T",
      heightWithoutCap: "195 mm",
      heightWithCap: "199 mm",
    });

    assert.equal(adjustment.rigImposed, true);
    assert.match(adjustment.taskLine, /Composition is set by the imposed studio rig/i);
    assert.match(adjustment.sourceTruthLines.join("\n"), /reference governs product identity/i);
    assert.match(adjustment.sourceTruthLines.join("\n"), /excess transparent padding/i);
    assert.match(adjustment.sourceTruthLines.join("\n"), /source foreground size is not product truth/i);
    assert.doesNotMatch(adjustment.sourceTruthLines.join("\n"), /bounding-box footprint, centerline, baseline, crop, camera distance, and relative scale/i);
    assert.match(adjustment.canvasCompositionLines.join("\n"), /IMPOSED STUDIO RIG/);
    assert.match(adjustment.canvasCompositionLines.join("\n"), /balanced, inspectable, CONSISTENT PDP catalog size/i);
    assert.match(adjustment.canvasCompositionLines.join("\n"), /Do NOT vary the on-canvas size by ml capacity/i);
    assert.doesNotMatch(adjustment.canvasCompositionLines.join("\n"), /Fixed-family QA target/i);
    assert.doesNotMatch(adjustment.canvasCompositionLines.join("\n"), /uploaded reference canvas is the placement lock/i);
  });

  it("uses the universal PDP rig for families without a custom override", () => {
    const adjustment = buildBestBottlesFamilyRigPromptAdjustment({
      family: "Boston Round",
      sku: "GB-BOS-CLR-30ML-T",
      heightWithoutCap: "80 mm",
      heightWithCap: "90 mm",
    });

    assert.equal(adjustment.rigImposed, true);
    assert.match(adjustment.taskLine, /Composition is set by the imposed studio rig/i);
    assert.match(adjustment.sourceTruthLines.join("\n"), /source foreground size is not product truth/i);
    assert.match(adjustment.canvasCompositionLines.join("\n"), /UNIVERSAL PDP/);
    assert.match(adjustment.canvasCompositionLines.join("\n"), /Do NOT vary the on-canvas size by ml capacity/i);
    assert.doesNotMatch(adjustment.canvasCompositionLines.join("\n"), /uploaded reference canvas is the placement lock/i);
    assert.doesNotMatch(adjustment.canvasCompositionLines.join("\n"), /Fixed-family QA target/i);
  });

  it("forbids reflective floor plates and inner background rectangles on PDP masters", () => {
    const adjustment = buildBestBottlesFamilyRigPromptAdjustment({
      family: "Cylinder",
      sku: "GB-SPR-CLR-3ML-WHT",
      websiteSku: "GBSpry3mlClWht",
      applicator: "Fine Mist Sprayer",
    });

    const composition = adjustment.canvasCompositionLines.join("\n");

    assert.match(composition, /no mirror reflection/i);
    assert.match(composition, /no rectangular studio plate/i);
    assert.match(composition, /flat Bone/i);
  });

  it("still imposes the rig when a rig family lacks body height", () => {
    const adjustment = buildBestBottlesFamilyRigPromptAdjustment({
      family: "Cylinder",
      sku: "GB-CYL-UNKNOWN",
      heightWithoutCap: null,
      heightWithCap: "199 mm",
    });

    assert.equal(adjustment.rigImposed, true);
    assert.match(adjustment.canvasCompositionLines.join("\n"), /IMPOSED STUDIO RIG/);
    assert.doesNotMatch(adjustment.canvasCompositionLines.join("\n"), /uploaded reference canvas is the placement lock/i);
  });

  it("imposes the Circle cap-off rig for roll-on detached cap compositions", () => {
    const adjustment = buildBestBottlesFamilyRigPromptAdjustment({
      family: "Circle",
      sku: "GB-CIR-CLR-15ML-ROL",
      mode: "cap-off",
    });

    assert.equal(adjustment.rigImposed, true);
    assert.match(adjustment.canvasCompositionLines.join("\n"), /IMPOSED STUDIO RIG/);
    assert.match(adjustment.canvasCompositionLines.join("\n"), /CIRCLE/);
    assert.match(adjustment.canvasCompositionLines.join("\n"), /ONE two-object assembly/);
    assert.match(adjustment.canvasCompositionLines.join("\n"), /same horizontal baseline/i);
  });

  it("keeps roll-ons assembled unless cap-off is explicit", () => {
    const adjustment = buildBestBottlesFamilyRigPromptAdjustment({
      family: "Cylinder",
      sku: "GB-CYL-BLU-5ML-MRL-MBLK",
      websiteSku: "GBCylBlu5MrlMBlk",
      applicator: "Metal Roller Ball",
    });

    assert.equal(adjustment.rigImposed, true);
    const composition = adjustment.canvasCompositionLines.join("\n");
    const sourceTruth = adjustment.sourceTruthLines.join("\n");
    assert.match(composition, /CYLINDER/);
    assert.match(composition, /assembled bottle centered/i);
    assert.doesNotMatch(composition, /ONE two-object assembly/);
    assert.match(composition, /no detached cap/i);
    assert.match(sourceTruth, /Applicator type is not cap state/i);
  });

  it("infers detached-cap rig for Cylinder sprayers from exploded preset/source references", () => {
    const adjustment = buildBestBottlesFamilyRigPromptAdjustment({
      family: "Cylinder",
      sku: "GB-CYL-AMB-9ML-SPR-MSLV",
      websiteSku: "GBCylAmb9SpryMtSlv",
      applicator: "Perfume Spray Pump",
      presetId: "grid-card-exploded-2000x2200",
      sourceReference: "/best-bottles/cylinder/amber-9ml/cap-off/GB-CYL-AMB-9ML-SPR-MSLV.png",
    });

    assert.equal(adjustment.rigImposed, true);
    const composition = adjustment.canvasCompositionLines.join("\n");
    assert.match(composition, /CYLINDER/);
    assert.match(composition, /ONE two-object assembly/);
    assert.match(composition, /DETACHED cap upright to the RIGHT/);
    assert.match(composition, /only detached object is the matching over-cap/i);
    assert.match(composition, /Do not render a second loose cap/i);
    assert.match(composition, /same horizontal baseline/i);
  });

  it("keeps sprayers assembled without a cap-off/exploded signal", () => {
    const adjustment = buildBestBottlesFamilyRigPromptAdjustment({
      family: "Cylinder",
      sku: "GB-CYL-AMB-9ML-SPR-MSLV",
      websiteSku: "GBCylAmb9SpryMtSlv",
      applicator: "Perfume Spray Pump",
    });

    assert.equal(adjustment.rigImposed, true);
    const composition = adjustment.canvasCompositionLines.join("\n");
    assert.match(composition, /assembled bottle centered/i);
    assert.doesNotMatch(composition, /ONE two-object assembly/);
    assert.match(composition, /no detached cap/i);
    assert.match(composition, /no extra cap/i);
  });
});
