import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildBestBottlesFamilyRigPromptAdjustment } from "./bestBottlesFamilyRigPrompt";

describe("buildBestBottlesFamilyRigPromptAdjustment", () => {
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
    assert.doesNotMatch(adjustment.sourceTruthLines.join("\n"), /bounding-box footprint, centerline, baseline, crop, camera distance, and relative scale/i);
    assert.match(adjustment.canvasCompositionLines.join("\n"), /IMPOSED STUDIO RIG/);
    assert.match(adjustment.canvasCompositionLines.join("\n"), /SAME generous size/i);
    assert.match(adjustment.canvasCompositionLines.join("\n"), /Do NOT vary the on-canvas size by ml capacity/i);
    assert.doesNotMatch(adjustment.canvasCompositionLines.join("\n"), /Fixed-family QA target/i);
    assert.doesNotMatch(adjustment.canvasCompositionLines.join("\n"), /uploaded reference canvas is the placement lock/i);
  });

  it("keeps legacy reference-locked composition for non-rig families", () => {
    const adjustment = buildBestBottlesFamilyRigPromptAdjustment({
      family: "Boston Round",
      sku: "GB-BOS-CLR-30ML-T",
      heightWithoutCap: "80 mm",
      heightWithCap: "90 mm",
    });

    assert.equal(adjustment.rigImposed, false);
    assert.match(adjustment.taskLine, /canvas placement, centerline, baseline, crop, camera distance, and scale are locked/i);
    assert.match(adjustment.sourceTruthLines.join("\n"), /bounding-box footprint, centerline, baseline, crop, camera distance, and relative scale/i);
    assert.match(adjustment.canvasCompositionLines.join("\n"), /uploaded reference canvas is the placement lock/i);
    assert.match(adjustment.canvasCompositionLines.join("\n"), /Fixed-family QA target/i);
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

  it("infers detached-cap rig for Cylinder roll-ons even without explicit mode", () => {
    const adjustment = buildBestBottlesFamilyRigPromptAdjustment({
      family: "Cylinder",
      sku: "GB-CYL-BLU-5ML-MRL-MBLK",
      websiteSku: "GBCylBlu5MrlMBlk",
      applicator: "Metal Roller Ball",
    });

    assert.equal(adjustment.rigImposed, true);
    const composition = adjustment.canvasCompositionLines.join("\n");
    assert.match(composition, /CYLINDER/);
    assert.match(composition, /ONE two-object assembly/);
    assert.match(composition, /DETACHED cap upright to the RIGHT/);
    assert.match(composition, /roller ball plug seated on the bottle neck centerline/i);
    assert.match(composition, /over-cap upright to the right/i);
  });
});
