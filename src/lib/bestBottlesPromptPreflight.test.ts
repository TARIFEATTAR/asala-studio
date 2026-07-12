import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildBestBottlesPromptPreflight,
  buildBestBottlesPromptSkuFromProduct,
} from "./bestBottlesPromptPreflight";
import { buildPromptForSku } from "./bestBottlesPromptCompiler";
import { BEST_BOTTLES_CATALOG_CANON_PROMPT_FLAG } from "./bestBottlesCatalogCanonPrompt";
import { getBestBottlesCatalogFramingProfile } from "@/config/bestBottlesFamilyProfiles";
import { loadPromptSystem } from "../../scripts/generate-prompts";

const promptSystem = loadPromptSystem(process.cwd());

const baseProduct = {
  graceSku: "GB-CYL-CLR-9ML-SPR-GLD",
  websiteSku: "CYL9SWIRLGLD",
  itemName: "9 ml Clear Swirl Cylinder Fine Mist Sprayer with Gold Collar",
  itemDescription: "Clear glass swirl cylinder bottle with fine mist sprayer and loose overcap.",
  bottleCollection: "Cylinder",
  family: "Cylinder",
  category: "Plastic Bottles",
  color: "Clear",
  capacityMl: 9,
  applicator: "Fine Mist Sprayer",
  capColor: "White",
  trimColor: "Gold",
  heightWithoutCap: "78 mm",
  heightWithCap: "96 mm",
  diameter: "16 mm",
  imageUrl: "https://example.com/legacy.gif",
};

function buildThreeMlPreflight(
  graceSku: "GB-SPR-CLR-3ML-BLK" | "GB-SPR-CLR-3ML-WHT",
  websiteSku: "GBSpry3mlClBlk" | "GBSpry3mlClWht",
  capColor: "Black" | "White",
) {
  return buildBestBottlesPromptPreflight({
    product: {
      graceSku,
      websiteSku,
      family: "Cylinder",
      bottleCollection: "Cylinder",
      color: "Clear",
      capacityMl: 3,
      applicator: "Fine Mist Sprayer",
      capColor,
      heightWithCap: "54 ±1 mm",
      heightWithoutCap: "37 ±0.5 mm",
      diameter: "14 ±0.5 mm",
    },
    referenceImagePath: `approved/${websiteSku}.png`,
    bodyMaterial: "clear glass",
    canvas: { widthPx: 2080, heightPx: 2288 },
    system: promptSystem,
  });
}

describe("Best Bottles prompt preflight", () => {
  it("compiles detached-sidecar contact instructions into the shipped prompt", () => {
    const preflight = buildBestBottlesPromptPreflight({
      product: baseProduct,
      referenceImagePath: "/references/GB-CYL-CLR-9ML-SPR-GLD.png",
      bodyMaterial: "swirl glass",
      canvas: { widthPx: 2080, heightPx: 2288 },
      system: promptSystem,
    });

    assert.match(preflight.record?.final_prompt ?? "", /bottle base and detached cap/i);
  });

  it("compiles canonical model-owned V6.1 policy for Cylinder siblings", () => {
    const smoke = buildThreeMlPreflight("GB-SPR-CLR-3ML-BLK", "GBSpry3mlClBlk", "Black");
    const prompt = smoke.record?.final_prompt ?? "";
    assert.equal(smoke.record?.prompt_version, "best-bottles-reference-locked-v6.1");
    assert.equal(smoke.record?.shadow_owner, "model");
    assert.equal(prompt.match(/GROUNDING SHADOW — MODEL OWNED:/g)?.length, 1);
    assert.doesNotMatch(prompt, /deterministic post-processing responsibilities/i);
    assert.doesNotMatch(prompt, /Madison applies both deterministically after generation/i);
    assert.match(prompt, /32–42% opacity/);
    assert.match(prompt, /20–30% of the primary bottle's width/);
    const directCompilerRecord = buildPromptForSku(smoke.sku!, promptSystem);
    assert.equal(directCompilerRecord.prompt_version, "best-bottles-reference-locked-v6.1");
    assert.equal(directCompilerRecord.shadow_owner, "model");
    assert.equal(directCompilerRecord.final_prompt.match(/GROUNDING SHADOW — MODEL OWNED:/g)?.length, 1);
    assert.match(directCompilerRecord.final_prompt, /#F6EFE8/);
    assert.doesNotMatch(directCompilerRecord.final_prompt, /Madison applies both deterministically after generation/i);
    assert.ok(smoke.record?.qa_checklist.includes("prompt-version:best-bottles-reference-locked-v6.1"));
    assert.ok(smoke.record?.qa_checklist.includes("shadow-owner:model"));
    assert.ok(smoke.record?.qa_checklist.includes("shadow-contract:contact-back-right-v1"));
    assert.ok(smoke.record?.qa_checklist.includes("shadow-rollout:cylinder-family"));
    assert.equal(
      smoke.record?.qa_checklist.some((tag) => tag.startsWith("shadow-smoke-sku:")),
      false,
    );

    const sibling = buildThreeMlPreflight("GB-SPR-CLR-3ML-WHT", "GBSpry3mlClWht", "White");
    assert.equal(sibling.record?.prompt_version, "best-bottles-reference-locked-v6.1");
    assert.equal(sibling.record?.shadow_owner, "model");
    assert.match(sibling.record?.final_prompt ?? "", /MODEL OWNED/);
  });

  it("classifies swirl Cylinder fine-mist sprayers as swirl-fluted glass despite catalog plastic category text", () => {
    const sku = buildBestBottlesPromptSkuFromProduct({
      product: baseProduct,
      referenceImagePath: "/references/GB-CYL-CLR-9ML-SPR-GLD.png",
      bodyMaterial: "plastic",
      canvas: { widthPx: 2080, heightPx: 2288 },
    });

    assert.equal(sku.product_family, "cylinder");
    assert.equal(sku.frame_class, "tall_narrow");
    assert.equal(sku.body_material, "swirl_glass");
    assert.equal(sku.closure_type, "fine_mist_sprayer");
    assert.equal(sku.collar_material, "polished_gold_metal");
    assert.deepEqual(sku.detached_components, ["clear_or_white_overcap"]);
  });

  it("does not infer detached caps from ordinary assembled clear-cap fine-mist wording", () => {
    const sku = buildBestBottlesPromptSkuFromProduct({
      product: {
        ...baseProduct,
        graceSku: "GB-SPR-CLR-4ML-BLK",
        websiteSku: "GBSpry4mlClBlk",
        itemName: "Clear Glass Bottle with Black Spray Pump and Clear Cap. Capacity: 4ml",
        itemDescription: "Clear glass sample spray bottle with black fine mist sprayer and clear cap.",
        capacityMl: 4,
        heightWithCap: "67 ±1 mm",
        heightWithoutCap: "49 ±0.5 mm",
        diameter: "14 ±0.5 mm",
      },
      referenceImagePath: "/references/GB-SPR-CLR-4ML-BLK.png",
      bodyMaterial: "glass",
      canvas: { widthPx: 2080, heightPx: 2288 },
    });

    assert.deepEqual(sku.detached_components, []);
  });

  it("compiles a visible preflight record with cap-preservation warnings for pale caps", () => {
    const preflight = buildBestBottlesPromptPreflight({
      product: baseProduct,
      referenceImagePath: "/references/GB-CYL-CLR-9ML-SPR-GLD.png",
      bodyMaterial: "plastic",
      canvas: { widthPx: 2080, heightPx: 2288 },
      system: promptSystem,
    });

    assert.equal(preflight.status, "warn");
    assert.equal(preflight.issue, null);
    assert.ok(preflight.record);
    assert.match(preflight.record.final_prompt, /^You are enhancing the attached product reference image/);
    assert.match(preflight.record.final_prompt, /GLASS: preserve the glass's exact color/i);
    assert.match(preflight.record.final_prompt, /For swirl glass: the swirl pattern must remain visible and intact/i);
    assert.match(preflight.record.final_prompt, /CYLINDER STANDARD FRAMING PROFILE/i);
    assert.match(preflight.record.final_prompt, /STUDIO DIRECTION:/i);
    assert.match(preflight.record.final_prompt, /FINAL V2 STUDIO CHECK:/i);
    assert.doesNotMatch(preflight.record.final_prompt, /ENHANCE ONLY THE PRESENTATION/i);
    assert.doesNotMatch(preflight.record.final_prompt, /BACKGROUND AND COMPOSITION:/i);
    assert.doesNotMatch(preflight.record.final_prompt, /NEGATIVE CONSTRAINTS:/i);
    assert.ok(
      preflight.record.final_prompt.indexOf("CYLINDER STANDARD FRAMING PROFILE") <
        preflight.record.final_prompt.indexOf("STUDIO DIRECTION:"),
    );
    assert.ok(
      preflight.record.final_prompt.indexOf("STUDIO DIRECTION:") <
        preflight.record.final_prompt.indexOf("FINAL V2 STUDIO CHECK:"),
    );
    assert.doesNotMatch(preflight.record.final_prompt, /back-right at clock 2:00-2:30/i);
    assert.doesNotMatch(preflight.record.final_prompt, /#EEE6D4/i);
    assert.doesNotMatch(preflight.record.final_prompt, /Aesop \/ Kinfolk/i);
    assert.doesNotMatch(preflight.record.final_prompt, /slightly polished off-white surface/i);
    assert.doesNotMatch(preflight.record.final_prompt, /faint, slightly darker reflection/i);
    assert.doesNotMatch(preflight.record.final_prompt, /surface reads as paper/i);
    assert.doesNotMatch(preflight.record.final_prompt, /Body material: swirl-fluted clear glass/i);
    assert.ok(preflight.record.qa_checklist.includes("white_caps_visible"));
    assert.ok(preflight.record.qa_checklist.includes("swirl_flutes_preserved"));
    assert.ok(preflight.record.qa_checklist.includes(BEST_BOTTLES_CATALOG_CANON_PROMPT_FLAG));
    assert.ok(preflight.warnings.some((warning) => /catalog material says plastic/i.test(warning)));
    assert.ok(preflight.warnings.some((warning) => /white or translucent cap/i.test(warning)));
  });

  it("treats Cylinder SPR-GLD as white or clear sprayer parts with a polished gold collar", () => {
    const actualCatalogShape = {
      ...baseProduct,
      websiteSku: "GBCylSwrl9SpryGl",
      itemName: "9 ml Swirl Cylinder Fine Mist Sprayer",
      itemDescription: null,
      color: "Swirl",
      capColor: "Gold",
      trimColor: null,
      heightWithoutCap: "74 +/-1 mm",
      diameter: "21 +/-0.5 mm",
    };

    const sku = buildBestBottlesPromptSkuFromProduct({
      product: actualCatalogShape,
      referenceImagePath:
        "https://example.com/best-bottles/reference-intake/cylinder/gb-cyl-clr-9ml-spr-gld.png",
      bodyMaterial: "plastic",
      canvas: { widthPx: 2080, heightPx: 2288 },
    });

    assert.equal(sku.closure_type, "fine_mist_sprayer");
    assert.equal(sku.body_material, "swirl_glass");
    assert.equal(sku.closure_material, "white plastic actuator with polished gold collar");
    assert.equal(sku.cap_color, "clear or white over-cap");
    assert.equal(sku.collar_material, "polished_gold_metal");
    assert.deepEqual(sku.detached_components, []);

    const preflight = buildBestBottlesPromptPreflight({
      product: actualCatalogShape,
      referenceImagePath:
        "https://example.com/best-bottles/reference-intake/cylinder/gb-cyl-clr-9ml-spr-gld.png",
      bodyMaterial: "plastic",
      canvas: { widthPx: 2080, heightPx: 2288 },
      system: promptSystem,
    });

    assert.ok(preflight.record);
    assert.match(preflight.record.final_prompt, /^You are enhancing the attached product reference image/);
    assert.match(preflight.record.final_prompt, /GLASS: preserve the glass's exact color/i);
    assert.match(preflight.record.final_prompt, /For swirl glass: the swirl pattern must remain visible and intact/i);
    assert.match(preflight.record.final_prompt, /Cross-polarized capture/i);
    assert.equal(preflight.sku?.closure_material, "white plastic actuator with polished gold collar");
    assert.equal(preflight.sku?.cap_color, "clear or white over-cap");
    assert.deepEqual(preflight.sku?.detached_components, []);
  });

  it("keeps Cylinder lotion-pump variants in the Cylinder family while compiling pump closure truth", () => {
    const lotionPumpVariant = {
      ...baseProduct,
      graceSku: "LB-CYL-CLR-9ML-LPM-MSLV",
      websiteSku: "LBCylSwrl9LtnMtSl",
      itemName: "9 ml Swirl Cylinder Lotion Pump",
      itemDescription: null,
      color: "Swirl",
      applicator: "Lotion Pump",
      capColor: "Matte Silver",
      trimColor: null,
      heightWithoutCap: "74 +/-1 mm",
      diameter: "21 +/-0.5 mm",
    };

    const sku = buildBestBottlesPromptSkuFromProduct({
      product: lotionPumpVariant,
      referenceImagePath:
        "https://example.com/best-bottles/reference-intake/cylinder/lb-cyl-clr-9ml-lpm-mslv.png",
      bodyMaterial: "plastic",
      canvas: { widthPx: 2080, heightPx: 2288 },
    });

    assert.equal(sku.product_family, "cylinder");
    assert.equal(sku.frame_class, "tall_narrow");
    assert.equal(sku.body_material, "swirl_glass");
    assert.equal(sku.closure_type, "lotion_pump");
    assert.equal(sku.closure_material, "white plastic pump with matte silver collar");
    assert.equal(sku.cap_color, "clear or white over-cap");
    assert.equal(sku.collar_material, "matte_silver_metal");
    assert.deepEqual(sku.detached_components, []);
  });

  it("compiles Circle families for the square-round canvas tier", () => {
    const circleVariant = {
      ...baseProduct,
      graceSku: "GB-CIR-WHT-15ML-WHT-S",
      websiteSku: "GBCir15WhtSht",
      itemName: "15 ml Clear Circle Bottle with Cap",
      itemDescription:
        "Circle design 15ml, 1/2oz Clear glass bottle with short white cap.",
      bottleCollection: "Circle",
      family: "Circle",
      category: "Glass Bottles",
      color: "Clear",
      capacityMl: 15,
      applicator: "Cap/Closure",
      capColor: "White",
      trimColor: null,
      heightWithoutCap: "45 mm",
      heightWithCap: "57 mm",
      diameter: "30 mm",
    };

    const preflight = buildBestBottlesPromptPreflight({
      product: circleVariant,
      referenceImagePath: "/references/GB-CIR-WHT-15ML-WHT-S.png",
      bodyMaterial: "clear glass",
      canvas: { widthPx: 2048, heightPx: 2048 },
      system: promptSystem,
    });

    assert.notEqual(preflight.status, "error");
    assert.equal(preflight.issue, null);
    assert.ok(preflight.record);
    assert.equal(preflight.sku?.product_family, "circle");
    assert.equal(preflight.sku?.frame_class, "medium_upright");
    assert.match(preflight.record.final_prompt, /^You are enhancing the attached product reference image/);
    assert.match(preflight.record.final_prompt, /PRIMARY GOAL:/i);
    assert.match(preflight.record.final_prompt, /Make the clear glass look like real luxury product-photography glass/i);
    assert.match(preflight.record.final_prompt, /GLASS APPEARANCE:/i);
    assert.match(preflight.record.final_prompt, /STUDIO DIRECTION:/i);
    assert.match(preflight.record.final_prompt, /FINAL V2 STUDIO CHECK:/i);
    assert.doesNotMatch(preflight.record.final_prompt, /BACKGROUND AND COMPOSITION:/i);
    assert.doesNotMatch(preflight.record.final_prompt, /NEGATIVE CONSTRAINTS:/i);
    assert.doesNotMatch(preflight.record.final_prompt, /Do not create barcode-like vertical stripes/i);
    assert.doesNotMatch(preflight.record.final_prompt, /FINAL CHECK BEFORE OUTPUT:/i);
    assert.doesNotMatch(preflight.record.final_prompt, /vertical highlight band/i);
    assert.doesNotMatch(preflight.record.final_prompt, /softer secondary band/i);
    assert.doesNotMatch(preflight.record.final_prompt, /TEST-ONLY MATERIAL POLISH ADDENDUM/i);
    assert.match(preflight.record.final_prompt, /rear wall of the bottle should be faintly visible through the front wall/i);
    assert.match(preflight.record.final_prompt, /exact 2080x2288 canvas/i);
    assert.doesNotMatch(preflight.record.final_prompt, /This kills surface haze/i);
    assert.doesNotMatch(preflight.record.final_prompt, /#EEE6D4/i);
    assert.ok(preflight.record.qa_checklist.includes(BEST_BOTTLES_CATALOG_CANON_PROMPT_FLAG));
    assert.doesNotMatch(preflight.record.final_prompt, /2048 x 2048 portrait PDP canvas/i);
  });

  it("marks measured Cylinder SKUs for the fixed 2080 x 2288 studio canvas", () => {
    const preflight = buildBestBottlesPromptPreflight({
      product: baseProduct,
      referenceImagePath: "/references/GB-CYL-CLR-9ML-SPR-GLD.png",
      bodyMaterial: "plastic",
      canvas: { widthPx: 2080, heightPx: 2288 },
      system: promptSystem,
    });

    assert.notEqual(preflight.status, "error");
    assert.equal(preflight.sku?.output_canvas_width, 2080);
    assert.equal(preflight.sku?.output_canvas_height, 2288);
    assert.ok(preflight.record?.qa_checklist.includes("canvas_recommendation:fixed_studio_2080x2288"));
    assert.ok(preflight.record?.qa_checklist.includes("cylinder_family_profile:cylinder-standard"));
    assert.ok(preflight.record?.qa_checklist.includes("primary_object_centerline:canvas_center"));
    assert.ok(preflight.record?.qa_checklist.includes("detached_component_sidecar:right_does_not_shift_primary"));
    assert.ok(preflight.record?.qa_checklist.includes("canvas_selected:2080x2288"));
    assert.equal(
      preflight.warnings.some((warning) => /Cylinder family uses the fixed 2080 x 2288 studio canvas/i.test(warning)),
      false,
    );
  });

  it("warns when a Cylinder SKU is placed on a non-fixed canvas", () => {
    const preflight = buildBestBottlesPromptPreflight({
      product: baseProduct,
      referenceImagePath: "/references/GB-CYL-CLR-9ML-SPR-GLD.png",
      bodyMaterial: "plastic",
      canvas: { widthPx: 2048, heightPx: 2048 },
      system: promptSystem,
    });

    assert.notEqual(preflight.status, "error");
    assert.ok(preflight.record?.qa_checklist.includes("canvas_recommendation:fixed_studio_2080x2288"));
    assert.ok(preflight.record?.qa_checklist.includes("cylinder_family_profile:cylinder-standard"));
    assert.ok(
      preflight.warnings.some((warning) =>
        /Cylinder family uses the fixed 2080 x 2288 studio canvas/i.test(warning),
      ),
    );
  });

  it("routes the compact 3ml Cylinder fine-mist SKU to the standard 10:11 frame", () => {
    const compactCylinder = {
      ...baseProduct,
      graceSku: "GB-SPR-CLR-3ML-BLK",
      websiteSku: "GBSpry3mlClBlk",
      itemName: "3 ml Clear Cylinder Fine Mist Sprayer",
      itemDescription: "3.3ml Clear Glass Bottle with Black Spray Pump and Clear Cap.",
      applicator: "Fine Mist Sprayer",
      trimColor: "Black",
      heightWithoutCap: "37 mm",
      heightWithCap: "54 mm",
      diameter: "14 mm",
      capacityMl: 3,
    };

    const tallCanvasPreflight = buildBestBottlesPromptPreflight({
      product: compactCylinder,
      referenceImagePath: "/references/GB-SPR-CLR-3ML-BLK.png",
      bodyMaterial: "clear glass",
      canvas: { widthPx: 1024, heightPx: 1536 },
      system: promptSystem,
    });

    assert.notEqual(tallCanvasPreflight.status, "error");
    assert.equal(tallCanvasPreflight.sku?.frame_class, "medium_upright");
    assert.ok(tallCanvasPreflight.record?.qa_checklist.includes("canvas_recommendation:fixed_studio_2080x2288"));
    assert.ok(tallCanvasPreflight.record?.qa_checklist.includes("cylinder_family_profile:sample-vial"));
    assert.ok(tallCanvasPreflight.record?.qa_checklist.includes("canvas_selected:1024x1536"));
    assert.match(
      tallCanvasPreflight.warnings[0] ?? "",
      /Cylinder family uses the fixed 2080 x 2288 studio canvas/i,
    );

    const standardCanvasPreflight = buildBestBottlesPromptPreflight({
      product: compactCylinder,
      referenceImagePath: "/references/GB-SPR-CLR-3ML-BLK.png",
      bodyMaterial: "clear glass",
      canvas: { widthPx: 2080, heightPx: 2288 },
      system: promptSystem,
    });

    assert.notEqual(standardCanvasPreflight.status, "error");
    assert.ok(standardCanvasPreflight.record?.qa_checklist.includes("canvas_recommendation:fixed_studio_2080x2288"));
    assert.ok(standardCanvasPreflight.record?.qa_checklist.includes("cylinder_family_profile:sample-vial"));
    assert.ok(standardCanvasPreflight.record?.qa_checklist.includes("canvas_selected:2080x2288"));
    assert.equal(
      standardCanvasPreflight.warnings.some((warning) => /fixed 2080 x 2288 studio canvas/i.test(warning)),
      false,
    );
  });

  it("adds resolved Cylinder framing profile instructions to the canon prompt", () => {
    const compactCylinder = {
      ...baseProduct,
      graceSku: "GB-SPR-CLR-3ML-BLK",
      websiteSku: "GBSpry3mlClBlk",
      itemName: "3 ml Clear Cylinder Fine Mist Sprayer",
      itemDescription: "3.3ml Clear Glass Bottle with Black Spray Pump and Clear Cap.",
      applicator: "Fine Mist Sprayer",
      trimColor: "Black",
      heightWithoutCap: "37 mm",
      heightWithCap: "54 mm",
      diameter: "14 mm",
      capacityMl: 3,
    };

    const compactPreflight = buildBestBottlesPromptPreflight({
      product: compactCylinder,
      referenceImagePath: "/references/GB-SPR-CLR-3ML-BLK.png",
      bodyMaterial: "clear glass",
      canvas: { widthPx: 2080, heightPx: 2288 },
      system: promptSystem,
    });
    const tallPreflight = buildBestBottlesPromptPreflight({
      product: baseProduct,
      referenceImagePath: "/references/GB-CYL-CLR-9ML-SPR-GLD.png",
      bodyMaterial: "plastic",
      canvas: { widthPx: 2080, heightPx: 2288 },
      system: promptSystem,
    });

    assert.ok(compactPreflight.record);
    assert.ok(tallPreflight.record);
    assert.match(compactPreflight.record.final_prompt, /CYLINDER SAMPLE VIAL FRAMING PROFILE/i);
    assert.match(compactPreflight.record.final_prompt, /Approved fill-height range: 55-60%/i);
    assert.match(compactPreflight.record.final_prompt, /fills approximately 56% of the canvas height/i);
    assert.match(compactPreflight.record.final_prompt, /Relative scale zone: Sample vials \(sample-vial\)/i);
    assert.match(compactPreflight.record.final_prompt, /primary bottle centered on the canvas vertical centerline/i);
    assert.match(compactPreflight.record.final_prompt, /PRIMARY GOAL:/i);
    assert.match(compactPreflight.record.final_prompt, /The base should show clear curved glass geometry, transparent thickness, and crisp circular base rings/i);
    assert.doesNotMatch(compactPreflight.record.final_prompt, /A subtle internal caustic where the back wall meets the sidewall at the base/i);
    assert.doesNotMatch(compactPreflight.record.final_prompt, /NEGATIVE CONSTRAINTS:/i);
    assert.doesNotMatch(compactPreflight.record.final_prompt, /vertical highlight band/i);
    assert.doesNotMatch(compactPreflight.record.final_prompt, /secondary band/i);
    assert.doesNotMatch(compactPreflight.record.final_prompt, /paired sidewall lines/i);
    assert.doesNotMatch(compactPreflight.record.final_prompt, /Do not create cloudy white fill/i);
    assert.doesNotMatch(compactPreflight.record.final_prompt, /Do not create milky haze/i);
    assert.doesNotMatch(compactPreflight.record.final_prompt, /Do not create frosted glass/i);
    assert.doesNotMatch(compactPreflight.record.final_prompt, /Do not create opaque white patches inside the bottle/i);
    assert.doesNotMatch(compactPreflight.record.final_prompt, /Do not create a white plug or solid base block/i);
    assert.doesNotMatch(compactPreflight.record.final_prompt, /Do not create bubbles, dust, smoke, sediment, residue, scratches, speckles/i);
    assert.match(compactPreflight.record.final_prompt, /STUDIO DIRECTION:/i);
    assert.match(compactPreflight.record.final_prompt, /FINAL V2 STUDIO CHECK:/i);
    assert.ok(
      compactPreflight.record.final_prompt.indexOf("PRIMARY GOAL:") <
        compactPreflight.record.final_prompt.indexOf("CYLINDER SAMPLE VIAL FRAMING PROFILE"),
    );
    assert.ok(
      compactPreflight.record.final_prompt.indexOf("CYLINDER SAMPLE VIAL FRAMING PROFILE") <
        compactPreflight.record.final_prompt.indexOf("STUDIO DIRECTION:"),
    );
    assert.ok(
      compactPreflight.record.final_prompt.indexOf("STUDIO DIRECTION:") <
        compactPreflight.record.final_prompt.indexOf("FINAL V2 STUDIO CHECK:"),
    );
    assert.doesNotMatch(compactPreflight.record.final_prompt, /CLEAR GLASS POLLUTION GUARD/i);
    assert.doesNotMatch(compactPreflight.record.final_prompt, /CLEAR GLASS SIDEWALL CLEANLINESS GUARD/i);
    assert.doesNotMatch(compactPreflight.record.final_prompt, /SPRAYER \/ PUMP GLASS BOUNDARY GUARD/i);
    assert.doesNotMatch(compactPreflight.record.final_prompt, /white pump housing must be centered/i);
    assert.doesNotMatch(compactPreflight.record.final_prompt, /Do not stack multiple opaque or translucent pump cylinders/i);
    assert.doesNotMatch(compactPreflight.record.final_prompt, /Do not render it as a distinct rectangular white block below the cap/i);
    assert.doesNotMatch(compactPreflight.record.final_prompt, /exactly as Image 1 shows it/i);
    assert.doesNotMatch(compactPreflight.record.final_prompt, /external pump housing position/i);
    assert.match(tallPreflight.record.final_prompt, /CYLINDER STANDARD FRAMING PROFILE/i);
    assert.match(tallPreflight.record.final_prompt, /Approved fill-height range: 60-64%/i);
    assert.match(tallPreflight.record.final_prompt, /fills approximately 64% of the canvas height/i);
    assert.match(tallPreflight.record.final_prompt, /Relative scale zone: Small Cylinder bottles \(small-cylinder\)/i);
    assert.doesNotMatch(compactPreflight.record.final_prompt, /Do NOT vary the on-canvas size by ml capacity/i);
    assert.doesNotMatch(tallPreflight.record.final_prompt, /Do NOT vary the on-canvas size by ml capacity/i);
  });

  it("uses the roller-bottle profile for Cylinder roller products in prompt and QA", () => {
    const cylinderRoller = {
      ...baseProduct,
      graceSku: "GB-CYL-CLR-28ML-MRL-01",
      websiteSku: "GBMtlRoll28Blk",
      itemName: "28 ml Clear Cylinder Metal Roller Bottle",
      itemDescription: "28 ml clear cylinder bottle with metal roller ball and black cap.",
      applicator: "Metal Roller Ball",
      capColor: "Clear",
      trimColor: null,
      heightWithoutCap: "81 mm",
      heightWithCap: "100 mm",
      diameter: "31 mm",
      capacityMl: 28,
    };

    const preflight = buildBestBottlesPromptPreflight({
      product: cylinderRoller,
      referenceImagePath: "/references/GB-CYL-CLR-28ML-MRL-01.png",
      bodyMaterial: "clear glass",
      canvas: { widthPx: 2080, heightPx: 2288 },
      system: promptSystem,
    });

    assert.notEqual(preflight.status, "error");
    assert.ok(preflight.record);
    assert.equal(preflight.sku?.product_family, "cylinder");
    assert.match(preflight.record.final_prompt, /ROLLER BOTTLE FRAMING PROFILE/i);
    const rollerProfile = getBestBottlesCatalogFramingProfile(cylinderRoller);
    assert.ok(rollerProfile);
    assert.match(
      preflight.record.final_prompt,
      new RegExp(`Approved fill-height range: ${rollerProfile.targetProductHeightRangePct.min}-${rollerProfile.targetProductHeightRangePct.max}%`, "i"),
    );
    assert.match(
      preflight.record.final_prompt,
      new RegExp(`fills approximately ${rollerProfile.targetProductHeightPct}% of the canvas height`, "i"),
    );
    assert.ok(preflight.record.qa_checklist.includes("cylinder_family_profile:roller-bottle"));
    assert.equal(preflight.record.qa_checklist.includes("cylinder_family_profile:cylinder-standard"), false);
  });

  it("blocks missing references before prompt compilation", () => {
    const preflight = buildBestBottlesPromptPreflight({
      product: baseProduct,
      referenceImagePath: "",
      bodyMaterial: "clear glass",
      canvas: { widthPx: 2080, heightPx: 2288 },
      system: promptSystem,
    });

    assert.equal(preflight.status, "error");
    assert.equal(preflight.record, null);
    assert.match(preflight.issue ?? "", /flattened product-truth reference/i);
  });

  it("degrades gracefully for unknown modules — still ships the canon + generic framing", () => {
    const preflight = buildBestBottlesPromptPreflight({
      product: {
        ...baseProduct,
        graceSku: "GB-MYS-001",
        websiteSku: "MYS001",
        family: "Mystery Family",
        bottleCollection: "Mystery Family",
        category: "Unknown",
        itemName: "Mystery Bottle",
        itemDescription: "Unclassified product with no known Best Bottles family cues.",
        applicator: "Unknown",
      },
      referenceImagePath: "/references/GB-MYSTERY.png",
      bodyMaterial: "unobtanium",
      canvas: { widthPx: 2080, heightPx: 2288 },
      system: promptSystem,
    });

    // A family with no module must NOT block generation: the shipped canon+framing
    // prompt does not depend on the module system. We degrade to a warning + record.
    assert.notEqual(preflight.status, "error");
    assert.ok(preflight.record, "unknown-module family should still produce a record");
    assert.equal(preflight.issue, null);
    assert.match(preflight.record.final_prompt, /^You are enhancing the attached product reference image/);
    assert.match(preflight.record.final_prompt, /FRAMING PROFILE \(CANVAS COMPOSITION AUTHORITY\)/i);
    assert.match(preflight.record.final_prompt, /FINAL V2 STUDIO CHECK:/i);
    assert.ok(preflight.record.qa_checklist.includes(BEST_BOTTLES_CATALOG_CANON_PROMPT_FLAG));
    assert.ok(
      preflight.warnings.some((warning) => /Module validation skipped/i.test(warning)),
      "should warn that module validation was skipped",
    );
  });

  it("ships a real framing profile for every previously-uncovered bottle family (render sampler)", () => {
    const samplers = [
      { family: "Empire", label: /EMPIRE BOTTLE FRAMING PROFILE/i, height: "116 mm" },
      { family: "Cream Jar", label: /CREAM JAR FRAMING PROFILE/i, height: "48 mm" },
      { family: "Round", label: /ROUND BOTTLE FRAMING PROFILE/i, height: "90 mm" },
      { family: "Square", label: /SQUARE BOTTLE FRAMING PROFILE/i, height: "70 mm" },
      { family: "Apothecary", label: /APOTHECARY BOTTLE FRAMING PROFILE/i, height: "150 mm" },
    ];

    for (const sampler of samplers) {
      const preflight = buildBestBottlesPromptPreflight({
        product: {
          ...baseProduct,
          graceSku: `GB-${sampler.family.replace(/\s+/g, "").toUpperCase()}-CLR-15`,
          websiteSku: `SAMP-${sampler.family.replace(/\s+/g, "")}`,
          family: sampler.family,
          bottleCollection: sampler.family,
          category: "Glass Bottles",
          itemName: `${sampler.family} clear glass bottle`,
          itemDescription: `${sampler.family} design clear glass bottle with cap.`,
          applicator: "Cap/Closure",
          color: "Clear",
          capacityMl: 15,
          heightWithCap: sampler.height,
          heightWithoutCap: sampler.height,
          diameter: "30 mm",
        },
        referenceImagePath: `/references/${sampler.family.replace(/\s+/g, "")}.png`,
        bodyMaterial: "clear glass",
        canvas: { widthPx: 2080, heightPx: 2288 },
        system: promptSystem,
      });

      assert.notEqual(preflight.status, "error", `${sampler.family} must not error`);
      assert.ok(preflight.record, `${sampler.family} must produce a record`);
      // Canon identity + material block present.
      assert.match(preflight.record.final_prompt, /^You are enhancing the attached product reference image/);
      // Per-family framing block present (the fix) on the fixed studio canvas.
      assert.match(preflight.record.final_prompt, sampler.label);
      assert.match(preflight.record.final_prompt, /Canvas is fixed at 2080 × 2288/);
      // Studio direction still the final controlling instruction.
      assert.match(preflight.record.final_prompt, /FINAL V2 STUDIO CHECK:/i);
      assert.ok(
        preflight.record.final_prompt.indexOf("FRAMING PROFILE (CANVAS COMPOSITION AUTHORITY)") <
          preflight.record.final_prompt.indexOf("FINAL V2 STUDIO CHECK:"),
        `${sampler.family} framing must precede the final studio check`,
      );
      assert.ok(preflight.record.qa_checklist.includes(BEST_BOTTLES_CATALOG_CANON_PROMPT_FLAG));
    }
  });
});
