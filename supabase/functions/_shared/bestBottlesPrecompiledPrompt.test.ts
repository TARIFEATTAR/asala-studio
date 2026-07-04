import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BEST_BOTTLES_STUDIO_DIRECTION_V2,
  ensureBestBottlesStudioDirection,
  resolveBestBottlesPrecompiledPrompt,
} from "./bestBottlesPrecompiledPrompt";

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

const canonV2Record = {
  ...validRecord,
  final_prompt: [
    "You are ENHANCING an existing product reference photograph, not creating a new one.",
    "",
    "GLASS: this is a clear, colorless, fully transparent glass bottle whose glass currently reads as a flat, lifeless outline.",
    "",
    "ENHANCE ONLY THE PRESENTATION, in a quiet Aesop / Kinfolk editorial style:",
    "- Seamless warm Bone background #F5F3EF that reads as cream, not white.",
    "- One soft, realistic contact shadow grounding the base; no hard edges, no smear.",
    "",
    "You are giving this exact bottle light, depth, and life — not redrawing it. Its identity, geometry, finish, and materials must remain identical to the reference.",
  ].join("\n").padEnd(501, " "),
  qa_checklist: [
    ...validRecord.qa_checklist,
    "catalog_canon_v2_prompt",
    "catalog_canon_source:/Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Website-02-20-2026/pipeline/aios-shopify-pdp-images/prompt-template.mjs",
  ],
};

const canonV3Record = {
  ...validRecord,
  final_prompt: [
    "You are enhancing the attached product reference image into a premium photorealistic ecommerce product photograph.",
    "",
    "The reference image is the source of truth for product identity and geometry.",
    "",
    "PRIMARY GOAL:",
    "Make the clear glass look like real luxury product-photography glass: transparent, colorless, optically clean, premium, dimensional, and specular.",
    "",
    "BACKGROUND AND COMPOSITION:",
    "Place the product on a seamless flat Best Bottles Bone background: #F5F3EF.",
    "",
    "NEGATIVE CONSTRAINTS:",
    "Do not create barcode-like vertical stripes, duplicated rails, etched contour lines, hard full-height highlight bands, or artificial parallel lines.",
  ].join("\n").padEnd(501, " "),
  qa_checklist: [
    ...validRecord.qa_checklist,
    "catalog_canon_v3_prompt",
    "catalog_canon_source:/Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Website-02-20-2026/pipeline/aios-shopify-pdp-images/prompt-template.mjs",
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

  it("accepts the catalog canon v2 prompt marker for Best Bottles Studio masters", () => {
    const result = resolveBestBottlesPrecompiledPrompt(canonV2Record, {
      isBestBottlesStudioMasterRequest: true,
    });

    assert.equal(result.error, null);
    assert.equal(result.prompt, canonV2Record.final_prompt);
    assert.equal(result.sku, canonV2Record.sku);
    assert.deepEqual(result.qaChecklist, canonV2Record.qa_checklist);
  });

  it("accepts the catalog canon v3 prompt marker for Best Bottles Studio masters", () => {
    const result = resolveBestBottlesPrecompiledPrompt(canonV3Record, {
      isBestBottlesStudioMasterRequest: true,
    });

    assert.equal(result.error, null);
    assert.match(result.prompt ?? "", /STUDIO DIRECTION:/);
    assert.match(result.prompt ?? "", /FINAL V2 STUDIO CHECK:/);
    assert.match(result.prompt ?? "", /Kinfolk/);
    assert.match(result.prompt ?? "", /Aesop/);
    assert.doesNotMatch(result.prompt ?? "", /BACKGROUND AND COMPOSITION:/);
    assert.doesNotMatch(result.prompt ?? "", /NEGATIVE CONSTRAINTS:/);
    assert.equal(result.sku, canonV3Record.sku);
    assert.deepEqual(result.qaChecklist, canonV3Record.qa_checklist);
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

describe("ensureBestBottlesStudioDirection", () => {
  it("removes old presentation blocks and makes the approved Kinfolk/Aesop v2 studio direction final", () => {
    const normalized = ensureBestBottlesStudioDirection(canonV3Record.final_prompt);

    assert.match(normalized, /STUDIO DIRECTION:/);
    assert.match(normalized, /FINAL V2 STUDIO CHECK:/);
    assert.match(normalized, /Kinfolk/);
    assert.match(normalized, /Aesop/);
    assert.match(normalized, /fill-height target/);
    assert.match(normalized, /contact-only/);
    assert.doesNotMatch(normalized, /BACKGROUND AND COMPOSITION:/);
    assert.doesNotMatch(normalized, /NEGATIVE CONSTRAINTS:/);
    assert.doesNotMatch(normalized, /FINAL CHECK BEFORE OUTPUT:/);
    assert.match(normalized.trimEnd(), /Respect the resolved family framing measurements while making the photograph feel like the approved v2 studio direction\.$/);
  });

  it("keeps family framing before v2 when normalizing old precompiled prompts", () => {
    const promptWithFraming = [
      canonV3Record.final_prompt,
      "",
      "CYLINDER SAMPLE VIAL FRAMING PROFILE (CANVAS COMPOSITION AUTHORITY):",
      "- Canvas is fixed at 2080 × 2288.",
      "- Approved fill-height range: 55-60% of the canvas height for this family profile.",
    ].join("\n");

    const normalized = ensureBestBottlesStudioDirection(promptWithFraming);

    assert.match(normalized, /CYLINDER SAMPLE VIAL FRAMING PROFILE/);
    assert.ok(
      normalized.indexOf("CYLINDER SAMPLE VIAL FRAMING PROFILE") <
        normalized.indexOf("STUDIO DIRECTION:"),
    );
    assert.doesNotMatch(normalized, /BACKGROUND AND COMPOSITION:/);
    assert.doesNotMatch(normalized, /NEGATIVE CONSTRAINTS:/);
  });

  it("does not duplicate the v2 studio direction when it is already present", () => {
    const promptWithStudioDirection = [
      "You are enhancing the attached product reference image into a premium photorealistic ecommerce product photograph.",
      "",
      BEST_BOTTLES_STUDIO_DIRECTION_V2,
      "",
      "BACKGROUND AND COMPOSITION:",
      "Place the product on Best Bottles Bone.",
    ].join("\n");

    const normalized = ensureBestBottlesStudioDirection(promptWithStudioDirection);
    const occurrences = normalized.match(/Strict studio-direction refinement/g) ?? [];

    assert.equal(occurrences.length, 1);
    assert.match(normalized, /FINAL V2 STUDIO CHECK:/);
  });
});
