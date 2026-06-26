import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildBestBottlesPromptPreflight,
  buildBestBottlesPromptSkuFromProduct,
} from "./bestBottlesPromptPreflight";
import { BEST_BOTTLES_CATALOG_CANON_PROMPT_FLAG } from "./bestBottlesCatalogCanonPrompt";
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

describe("Best Bottles prompt preflight", () => {
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
    assert.match(preflight.record.final_prompt, /^You are ENHANCING an existing product reference photograph/);
    assert.match(preflight.record.final_prompt, /GLASS \(swirl\)/i);
    assert.match(preflight.record.final_prompt, /physical molded ridges/i);
    assert.match(preflight.record.final_prompt, /ENHANCE the presentation DRAMATICALLY/i);
    assert.match(preflight.record.final_prompt, /5200K daylight/i);
    assert.match(preflight.record.final_prompt, /White card fill from camera-right at ~4800K/i);
    assert.match(preflight.record.final_prompt, /Cross-polarized capture/i);
    assert.match(preflight.record.final_prompt, /back-right at clock 2:00-2:30/i);
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
    assert.deepEqual(sku.detached_components, ["clear_or_white_overcap"]);

    const preflight = buildBestBottlesPromptPreflight({
      product: actualCatalogShape,
      referenceImagePath:
        "https://example.com/best-bottles/reference-intake/cylinder/gb-cyl-clr-9ml-spr-gld.png",
      bodyMaterial: "plastic",
      canvas: { widthPx: 2080, heightPx: 2288 },
      system: promptSystem,
    });

    assert.ok(preflight.record);
    assert.match(preflight.record.final_prompt, /^You are ENHANCING an existing product reference photograph/);
    assert.match(preflight.record.final_prompt, /GLASS \(swirl\)/i);
    assert.match(preflight.record.final_prompt, /Cross-polarized capture/i);
    assert.equal(preflight.sku?.closure_material, "white plastic actuator with polished gold collar");
    assert.equal(preflight.sku?.cap_color, "clear or white over-cap");
    assert.deepEqual(preflight.sku?.detached_components, ["clear_or_white_overcap"]);
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
    assert.deepEqual(sku.detached_components, ["clear_or_white_overcap"]);
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
    assert.match(preflight.record.final_prompt, /^You are ENHANCING an existing product reference photograph/);
    assert.match(preflight.record.final_prompt, /GLASS \(clear\)/i);
    assert.match(preflight.record.final_prompt, /ONE single, bright, near-white vertical highlight band running the FULL height of the LEFT sidewall/i);
    assert.match(preflight.record.final_prompt, /back wall of the bottle must be clearly distinguishable/i);
    assert.match(preflight.record.final_prompt, /5200K daylight/i);
    assert.match(preflight.record.final_prompt, /Cross-polarized capture/i);
    assert.ok(preflight.record.qa_checklist.includes(BEST_BOTTLES_CATALOG_CANON_PROMPT_FLAG));
    assert.doesNotMatch(preflight.record.final_prompt, /2048 x 2048 portrait PDP canvas/i);
  });

  it("marks tall Cylinder SKUs for the native 1024 x 1536 canvas", () => {
    const preflight = buildBestBottlesPromptPreflight({
      product: baseProduct,
      referenceImagePath: "/references/GB-CYL-CLR-9ML-SPR-GLD.png",
      bodyMaterial: "plastic",
      canvas: { widthPx: 1024, heightPx: 1536 },
      system: promptSystem,
    });

    assert.notEqual(preflight.status, "error");
    assert.equal(preflight.sku?.output_canvas_width, 1024);
    assert.equal(preflight.sku?.output_canvas_height, 1536);
    assert.ok(preflight.record?.qa_checklist.includes("canvas_recommendation:tall_narrow_1024x1536"));
    assert.ok(preflight.record?.qa_checklist.includes("canvas_selected:1024x1536"));
    assert.equal(
      preflight.warnings.some((warning) => /Tall\/slender Cylinder should use the native 1024 x 1536 canvas/i.test(warning)),
      false,
    );
  });

  it("warns when a tall Cylinder SKU is placed on a non-native canvas", () => {
    const preflight = buildBestBottlesPromptPreflight({
      product: baseProduct,
      referenceImagePath: "/references/GB-CYL-CLR-9ML-SPR-GLD.png",
      bodyMaterial: "plastic",
      canvas: { widthPx: 2048, heightPx: 2048 },
      system: promptSystem,
    });

    assert.notEqual(preflight.status, "error");
    assert.ok(preflight.record?.qa_checklist.includes("canvas_recommendation:tall_narrow_1024x1536"));
    assert.ok(
      preflight.warnings.some((warning) =>
        /Tall\/slender Cylinder should use the native 1024 x 1536 canvas/i.test(warning),
      ),
    );
  });

  it("flags compact Cylinder dimensions for canvas review instead of forcing the tall frame silently", () => {
    const compactCylinder = {
      ...baseProduct,
      graceSku: "GB-CYL-CLR-3ML-WHT",
      websiteSku: "GBCyl3Wht",
      itemName: "3 ml Clear Cylinder Bottle with White Cap",
      itemDescription: "Compact clear cylinder bottle with short white cap.",
      applicator: "Cap/Closure",
      trimColor: null,
      heightWithoutCap: "32 mm",
      heightWithCap: "41 mm",
      diameter: "24 mm",
      capacityMl: 3,
    };

    const preflight = buildBestBottlesPromptPreflight({
      product: compactCylinder,
      referenceImagePath: "/references/GB-CYL-CLR-3ML-WHT.png",
      bodyMaterial: "clear glass",
      canvas: { widthPx: 1024, heightPx: 1536 },
      system: promptSystem,
    });

    assert.notEqual(preflight.status, "error");
    assert.ok(preflight.record?.qa_checklist.includes("canvas_recommendation:cylinder_compact_review"));
    assert.match(
      preflight.warnings[0] ?? "",
      /Compact Cylinder measurements suggest this SKU may not need the native 1024 x 1536 tall canvas/i,
    );
    assert.ok(
      preflight.warnings.some((warning) =>
        /Compact Cylinder measurements suggest this SKU may not need the native 1024 x 1536 tall canvas/i.test(warning),
      ),
    );
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

  it("reports unknown prompt modules as hard preflight errors", () => {
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

    assert.equal(preflight.status, "error");
    assert.equal(preflight.record, null);
    assert.match(preflight.issue ?? "", /Unknown product_family|Unknown body_material/i);
  });
});
