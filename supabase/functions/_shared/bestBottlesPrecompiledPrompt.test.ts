import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveBestBottlesPrecompiledPrompt } from "./bestBottlesPrecompiledPrompt";

const validRecord = {
  sku: "GB-CYL-CLR-9ML-SPR-GLD",
  reference_image_path: "https://example.com/GB-CYL-CLR-9ML-SPR-GLD.png",
  product_family: "cylinder",
  frame_class: "tall_narrow",
  final_prompt: [
    "REFERENCE-LOCKED BEST BOTTLES PDP MASTER",
    "",
    "Task: transform the uploaded real product reference PNG into a premium photorealistic editorial ecommerce product image.",
    "SKU LOCK:",
    "- SKU: GB-CYL-CLR-9ML-SPR-GLD",
    "PRODUCT FAMILY MODULE:",
    "- Preserve the Cylinder bottle's exact tube geometry, circular base, vertical sidewalls, shoulder and neck proportions, and SKU-specific applicator identity.",
    "MATERIAL MODULE:",
    "- Material truth: transparent clear glass with visible wall thickness, rim glints, edge density, internal back-wall separation, and controlled refraction.",
    "CLOSURE / APPLICATOR MODULE:",
    "- White, clear, translucent, or pale cap/actuator/over-cap surfaces must remain visible against the Bone background.",
    "FRAME MODULE:",
    "- Frame as a tall narrow product on a 2080 x 2288 portrait canvas.",
    "NEGATIVE RULES:",
    "- No geometry changes.",
    "Output: exact 2080 x 2288 portrait PDP canvas.",
  ].join("\n"),
  qa_checklist: ["reference_png_identity_lock", "white_caps_visible"],
};

const canonDraftRecord = {
  ...validRecord,
  final_prompt: [
    "You are ENHANCING an existing product reference photograph, not creating a new one. The provided image is the SOURCE OF TRUTH for the bottle's identity.",
    "",
    "GLASS (clear): preserve the clear colorless glass exactly. Render it as believable OPTICAL clear glass with DEPTH, not a flat outline:",
    "- ONE single, bright, near-white vertical highlight band running the FULL height of the LEFT sidewall.",
    "- The back wall of the bottle must be clearly distinguishable from the front wall through refraction.",
    "",
    "ENHANCE the presentation DRAMATICALLY while keeping the bottle's identity untouched.",
    "Lighting: single large rectangular softbox key from upper camera-left at clock 7:30-8:00, ~30-45° elevation, 5200K daylight.",
    "Shadow: soft contact shadow grounding the base, back-right at clock 2:00-2:30.",
    "Camera: 85mm macro, f/11, ISO 100, tripod, dead-on front.",
  ].join("\n"),
  qa_checklist: [
    ...validRecord.qa_checklist,
    "catalog_canon_v1_1_draft_prompt",
    "catalog_canon_source:/Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Website-02-20-2026/pipeline/aios-shopify-pdp-images/prompt-template-canon-v1-1-draft.mjs",
  ],
};

describe("resolveBestBottlesPrecompiledPrompt", () => {
  it("accepts a valid JSON compiler record for Best Bottles Studio masters", () => {
    const result = resolveBestBottlesPrecompiledPrompt(validRecord, {
      isBestBottlesStudioMasterRequest: true,
    });

    assert.equal(result.error, null);
    assert.equal(result.prompt, validRecord.final_prompt);
    assert.equal(result.sku, validRecord.sku);
    assert.deepEqual(result.qaChecklist, validRecord.qa_checklist);
  });

  it("accepts the catalog canon v1.1 draft prompt marker for Best Bottles Studio masters", () => {
    const result = resolveBestBottlesPrecompiledPrompt(canonDraftRecord, {
      isBestBottlesStudioMasterRequest: true,
    });

    assert.equal(result.error, null);
    assert.equal(result.prompt, canonDraftRecord.final_prompt);
    assert.equal(result.sku, canonDraftRecord.sku);
    assert.deepEqual(result.qaChecklist, canonDraftRecord.qa_checklist);
  });

  it("rejects precompiled prompts outside the Studio master path", () => {
    const result = resolveBestBottlesPrecompiledPrompt(validRecord, {
      isBestBottlesStudioMasterRequest: false,
    });

    assert.equal(result.prompt, null);
    assert.match(result.error ?? "", /only supported for Best Bottles Studio masters/i);
  });

  it("rejects records that carry neither the PDP master header nor a catalog canon marker", () => {
    const result = resolveBestBottlesPrecompiledPrompt(
      { ...validRecord, final_prompt: "one-off prompt" },
      { isBestBottlesStudioMasterRequest: true },
    );

    assert.equal(result.prompt, null);
    assert.match(result.error ?? "", /PDP master header or catalog canon marker/i);
  });

  it("rejects records missing SKU, reference, or QA metadata", () => {
    const result = resolveBestBottlesPrecompiledPrompt(
      { ...validRecord, sku: "", qa_checklist: [] },
      { isBestBottlesStudioMasterRequest: true },
    );

    assert.equal(result.prompt, null);
    assert.match(result.error ?? "", /sku/i);
  });
});
