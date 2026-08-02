import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { PromptRecord, PromptSku } from "../../src/lib/bestBottlesPromptCompiler";
import {
  buildCylinderSmokePromptRecord,
  getCylinderSmokePromptMode,
  getCylinderSmokeResolution,
} from "./cylinder-smoke-prompt-mode";

const sku: PromptSku = {
  sku: "GB-CYL-CLR-9ML-T-06",
  filename: "GB-CYL-CLR-9ML-T-06.png",
  product_family: "cylinder",
  frame_class: "tall_narrow",
  body_shape: "cylinder",
  body_material: "clear_glass",
  body_color: "clear",
  closure_type: "metal_roller_ball",
  closure_material: "black metal cap",
  cap_color: "black",
  collar_material: "none",
  applicator_type: "metal_roller_ball",
  detached_components: ["black_cap"],
  orientation: "front",
  transparency_type: "transparent",
  special_geometry_notes: "",
  reference_image_path: "/references/GB-CYL-CLR-9ML-T-06.png",
  output_canvas_width: 2080,
  output_canvas_height: 2288,
};

const record: PromptRecord = {
  sku: sku.sku,
  reference_image_path: sku.reference_image_path,
  product_family: sku.product_family,
  frame_class: sku.frame_class,
  prompt_version: "best-bottles-reference-locked-v6.0",
  shadow_owner: "rig",
  final_prompt: [
    "You are enhancing the attached product reference image into a premium photorealistic ecommerce product photograph.",
    "ROLLER BOTTLE FRAMING PROFILE (CANVAS COMPOSITION AUTHORITY):",
    "- Render the full assembled product so it fills approximately 67% of the canvas height.",
  ].join("\n\n"),
  qa_checklist: ["catalog_canon_v3_prompt", "cylinder_family_profile:roller-bottle"],
};

describe("cylinder smoke prompt mode", () => {
  it("defaults to canon plus framing", () => {
    assert.equal(getCylinderSmokePromptMode(undefined), "canon-framing");
    assert.equal(getCylinderSmokePromptMode(""), "canon-framing");
  });

  it("builds the exact canon prompt without the framing appendix for canon-only", () => {
    const result = buildCylinderSmokePromptRecord({
      record,
      sku,
      mode: "canon-only",
    });

    assert.match(result.final_prompt, /^You are enhancing the attached product reference image/);
    assert.match(result.final_prompt, /PRIMARY GOAL:/);
    assert.doesNotMatch(result.final_prompt, /FRAMING PROFILE \(CANVAS COMPOSITION AUTHORITY\):/);
    assert.ok(result.qa_checklist.includes("smoke-prompt-mode:canon-only"));
  });

  it("preserves the preflight prompt for canon-framing", () => {
    const result = buildCylinderSmokePromptRecord({
      record,
      sku,
      mode: "canon-framing",
    });

    assert.equal(result.final_prompt, record.final_prompt);
    assert.ok(result.qa_checklist.includes("smoke-prompt-mode:canon-framing"));
  });
});

describe("cylinder smoke resolution", () => {
  it("defaults to standard resolution", () => {
    assert.equal(getCylinderSmokeResolution(undefined), "standard");
    assert.equal(getCylinderSmokeResolution(""), "standard");
  });

  it("accepts high resolution for OpenAI high-quality smoke tests", () => {
    assert.equal(getCylinderSmokeResolution("high"), "high");
  });

  it("rejects unknown smoke resolutions", () => {
    assert.throws(
      () => getCylinderSmokeResolution("ultra"),
      /Invalid BB_SMOKE_RESOLUTION=ultra/,
    );
  });
});
