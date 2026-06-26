import {
  buildPromptForSku,
  type PromptRecord,
  type PromptSku,
  type PromptSystem,
} from "./bestBottlesPromptCompiler";
import {
  BEST_BOTTLES_CATALOG_CANON_SOURCE_PATH,
  BEST_BOTTLES_CATALOG_CANON_PROMPT_FLAG,
  buildBestBottlesCatalogCanonPrompt,
} from "./bestBottlesCatalogCanonPrompt";
import { parseDimensionMm } from "./product-image/skuInjector";

type ProductLike = {
  graceSku?: string | null;
  websiteSku?: string | null;
  itemName?: string | null;
  itemDescription?: string | null;
  bottleCollection?: string | null;
  family?: string | null;
  category?: string | null;
  color?: string | null;
  capacityMl?: number | null;
  applicator?: string | null;
  capColor?: string | null;
  trimColor?: string | null;
  capStyle?: string | null;
  heightWithoutCap?: string | null;
  heightWithCap?: string | null;
  diameter?: string | null;
};

export type BestBottlesPromptPreflightStatus = "ok" | "warn" | "error";

export interface BestBottlesPromptPreflightInput {
  product: ProductLike;
  referenceImagePath: string | null | undefined;
  bodyMaterial?: string | null;
  canvas?: { widthPx: number; heightPx: number } | null;
  system: PromptSystem;
}

export interface BestBottlesPromptPreflight {
  status: BestBottlesPromptPreflightStatus;
  issue: string | null;
  warnings: string[];
  sku: PromptSku | null;
  record: PromptRecord | null;
}

interface BestBottlesCanvasPreflight {
  qaChecklist: string[];
  warnings: string[];
}

interface PromptSkuBuildInput {
  product: ProductLike;
  referenceImagePath: string | null | undefined;
  bodyMaterial?: string | null;
  canvas?: { widthPx: number; heightPx: number } | null;
}

function compact(values: Array<string | null | undefined>): string {
  return values
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ");
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function keyFromText(value: string | null | undefined): string {
  return normalizeText(value ?? "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function includesAny(haystack: string, needles: string[]): boolean {
  return needles.some((needle) => haystack.includes(needle));
}

function skuOrCatalogText(product: ProductLike): string {
  return normalizeText(compact([
    product.graceSku,
    product.websiteSku,
    product.itemName,
    product.itemDescription,
    product.applicator,
    product.capColor,
    product.trimColor,
  ]));
}

function getSku(product: ProductLike): string {
  return (product.graceSku || product.websiteSku || "UNKNOWN-SKU").trim();
}

function getFilename(referenceImagePath: string | null | undefined, sku: string): string {
  const reference = referenceImagePath?.trim();
  if (!reference) return `${sku}.png`;
  const lastSegment = reference.split(/[/?#]/)[reference.split(/[/?#]/).length - 1] || reference;
  return lastSegment || `${sku}.png`;
}

export function inferBestBottlesPromptFamily(product: ProductLike): string {
  const haystack = normalizeText(compact([
    product.graceSku,
    product.websiteSku,
    product.family,
    product.bottleCollection,
    product.category,
    product.itemName,
    product.itemDescription,
    product.applicator,
  ]));

  if (includesAny(haystack, ["cylinder", "tall cylinder", "gb-cyl", "lb-cyl", "-cyl-", "swirl"])) {
    return "cylinder";
  }
  if (includesAny(haystack, ["cream jar", " jar", "gb-jar", "cosmetic jar"])) return "cream_jar";
  if (includesAny(haystack, ["roll-on", "roll on", "roller", "-mrl-", "-rol-"])) return "roll_on";
  if (includesAny(haystack, ["boston round", "gb-bos", " boston"])) return "boston_round";
  if (includesAny(haystack, ["atomizer", "gb-atm", "-atm-"])) return "atomizer";
  if (includesAny(haystack, ["dropper", "-drp-", " pipette"])) return "dropper";
  if (includesAny(haystack, ["vintage bulb", "bulb sprayer", "tassel"])) return "vintage_bulb_sprayer";
  if (includesAny(haystack, ["lotion pump"])) return "lotion_pump";
  if (includesAny(haystack, ["classic spray"])) return "classic_spray";
  if (includesAny(haystack, ["fine mist"])) {
    return includesAny(haystack, ["cylinder", "gb-cyl", "-cyl-"]) ? "cylinder" : "fine_mist_sprayer";
  }
  if (includesAny(haystack, ["rectangular", "rectangle"])) return "rectangular";
  if (includesAny(haystack, ["empire"])) return "empire";
  if (includesAny(haystack, ["vial", "gb-via"])) return "vial";
  if (includesAny(haystack, ["reducer", "orifice"])) return "orifice_reducer";
  if (includesAny(haystack, ["splash"])) return "splash_bottle";
  if (includesAny(haystack, ["aluminum", "aluminium"])) return "aluminum_bottle";
  if (includesAny(haystack, ["box", "carton"])) return "box";
  if (includesAny(haystack, ["bag", "organza", "velvet"])) return "bag";

  return keyFromText(product.family || product.bottleCollection || product.category || product.itemName);
}

export function inferBestBottlesPromptBodyMaterial(
  product: ProductLike,
  declaredBodyMaterial?: string | null,
): string {
  const family = inferBestBottlesPromptFamily(product);
  const haystack = normalizeText(compact([
    declaredBodyMaterial,
    product.graceSku,
    product.websiteSku,
    product.family,
    product.bottleCollection,
    product.category,
    product.itemName,
    product.itemDescription,
    product.color,
  ]));
  const color = normalizeText(product.color ?? "");

  if (family === "atomizer" || includesAny(haystack, ["atomizer", "aluminum", "aluminium", "-atm-", "gb-atm"])) {
    return "brushed_aluminum";
  }
  if (includesAny(haystack, ["paperboard", "carton", "box"])) return "folding_carton_paperboard";
  if (includesAny(haystack, ["organza"])) return "organza_fabric";
  if (includesAny(haystack, ["velvet"])) return "velvet_fabric";
  if (family === "cream_jar" || includesAny(haystack, ["white plastic", "opaque white"])) return "white_plastic";
  if (includesAny(haystack, ["black plastic", "opaque black"])) return "black_plastic";
  if (
    family === "cylinder" &&
    includesAny(haystack, ["swirl", "swirled", "swrl", "spiral", "helical", "fluted"])
  ) {
    return "swirl_glass";
  }
  if (includesAny(haystack, ["frosted glass"]) || (color.includes("frost") && !haystack.includes("plastic"))) {
    return "frosted_glass";
  }
  if (includesAny(haystack, ["frosted plastic"])) return "frosted_plastic";
  if (includesAny(haystack, ["amber"])) return "amber_glass";
  if (includesAny(haystack, ["cobalt", "blue glass"]) || color.includes("blue")) return "cobalt_glass";
  if (includesAny(haystack, ["green glass"]) || color.includes("green")) return "green_glass";
  if (
    includesAny(haystack, ["clear plastic", "molded plastic"]) &&
    family !== "cylinder" &&
    family !== "boston_round" &&
    family !== "roll_on" &&
    family !== "dropper" &&
    family !== "classic_spray"
  ) {
    return "clear_molded_plastic";
  }

  return "clear_glass";
}

export function inferBestBottlesPromptClosure(product: ProductLike): string {
  const haystack = normalizeText(compact([
    product.graceSku,
    product.websiteSku,
    product.applicator,
    product.capStyle,
    product.itemName,
    product.itemDescription,
  ]));

  if (includesAny(haystack, ["roll-on", "roll on", "roller", "-mrl-", "-rol-"])) return "metal_roller_ball";
  if (includesAny(haystack, ["dropper", "-drp-", "pipette"])) return "dropper";
  if (includesAny(haystack, ["atomizer", "-atm-", "gb-atm"])) return "atomizer_sprayer";
  if (includesAny(haystack, ["vintage bulb", "bulb sprayer", "tassel"])) return "vintage_bulb_sprayer";
  if (includesAny(haystack, ["lotion pump"])) return "lotion_pump";
  if (includesAny(haystack, ["fine mist", "sprayer", "-spr-"])) return "fine_mist_sprayer";
  if (includesAny(haystack, ["pump"])) return "classic_spray_pump";
  if (includesAny(haystack, ["reducer", "orifice"])) return "orifice_reducer";
  if (includesAny(haystack, ["splash"])) return "splash_cap";
  if (includesAny(haystack, ["carton", "box", "bag"])) return "none";
  return "screw_cap";
}

function inferFrameClass(productFamily: string): string {
  if (productFamily === "cream_jar") return "low_wide_jar";
  if (productFamily === "box" || productFamily === "bag") return "box_or_bag";
  if (
    productFamily === "empire" ||
    productFamily === "vintage_bulb_sprayer" ||
    productFamily === "decorative_bottle"
  ) {
    return "decorative_silhouette";
  }
  if (
    productFamily === "cylinder" ||
    productFamily === "roll_on" ||
    productFamily === "atomizer" ||
    productFamily === "vial" ||
    productFamily === "fine_mist_sprayer"
  ) {
    return "tall_narrow";
  }
  return "medium_upright";
}

function inferBodyShape(product: ProductLike, productFamily: string): string {
  const capacity = product.capacityMl ? `${product.capacityMl} ml ` : "";
  const color = product.color ? `${product.color} ` : "";
  const familyLabel = (product.family || product.bottleCollection || productFamily).replace(/_/g, " ");
  return `${capacity}${color}${familyLabel}`.trim();
}

function inferFineMistCollarMaterial(product: ProductLike): string {
  const haystack = skuOrCatalogText(product);
  const trim = normalizeText(product.trimColor ?? "");
  const cap = normalizeText(product.capColor ?? "");
  if (
    trim.includes("matte silver") ||
    cap.includes("matte silver") ||
    includesAny(haystack, ["-mslv", " mslv", "matte silver", "matt silver", "ltnmtsl"])
  ) {
    return "matte_silver_metal";
  }
  if (
    trim.includes("gold") ||
    cap === "gold" ||
    includesAny(haystack, ["-gld", " gld", "gold collar", "polished gold", "shiny gold"])
  ) {
    return "polished_gold_metal";
  }
  if (
    trim.includes("silver") ||
    trim.includes("chrome") ||
    cap === "silver" ||
    cap === "chrome" ||
    includesAny(haystack, ["-slv", " slv", "silver collar", "chrome collar", "polished silver"])
  ) {
    return "polished_silver_metal";
  }
  if (trim.includes("black") || cap === "black" || includesAny(haystack, ["black collar"])) {
    return "black plastic";
  }
  return "none";
}

function formatMaterialLabel(material: string): string {
  if (material === "polished_gold_metal") return "polished gold";
  if (material === "polished_silver_metal") return "polished silver";
  if (material === "matte_silver_metal") return "matte silver";
  if (material === "black plastic") return "black";
  if (material === "white plastic") return "white";
  return material.replace(/_/g, " ");
}

function inferClosureMaterial(product: ProductLike, closureType: string): string {
  const cap = product.capColor?.trim() || "";
  if (closureType === "fine_mist_sprayer") {
    const collar = inferFineMistCollarMaterial(product);
    const collarLabel = collar === "none" ? "" : ` with ${formatMaterialLabel(collar)} collar`;
    return `white plastic actuator${collarLabel}`;
  }
  if (closureType === "lotion_pump") {
    const collar = inferFineMistCollarMaterial(product);
    const collarLabel = collar === "none" ? "" : ` with ${formatMaterialLabel(collar)} collar`;
    return `white plastic pump${collarLabel}`;
  }
  if (closureType === "metal_roller_ball") return `metal roller ball${cap ? ` with ${cap} cap` : ""}`;
  if (closureType === "dropper") return `${cap || "black"} dropper with rubber bulb and glass pipette`;
  if (closureType === "atomizer_sprayer") return `${cap || product.color || "opaque"} metal atomizer sprayer`;
  if (closureType === "none") return "none";
  return cap ? `${cap} closure` : closureType.replace(/_/g, " ");
}

function inferCollarMaterial(product: ProductLike): string {
  const closure = inferBestBottlesPromptClosure(product);
  if (closure === "fine_mist_sprayer" || closure === "lotion_pump") {
    return inferFineMistCollarMaterial(product);
  }
  const trim = normalizeText(product.trimColor ?? "");
  if (trim.includes("gold")) return "polished_gold_metal";
  if (trim.includes("silver") || trim.includes("chrome")) return "polished_silver_metal";
  if (trim.includes("black")) return "black plastic";
  if (trim.includes("white")) return "white plastic";
  return product.trimColor?.trim() || "none";
}

function inferCapColor(product: ProductLike, closureType: string): string {
  if (closureType === "fine_mist_sprayer" || closureType === "lotion_pump") {
    return "clear or white over-cap";
  }
  return product.capColor?.trim().toLowerCase() || "none";
}

function inferDetachedComponents(product: ProductLike, closureType: string): string[] {
  const haystack = normalizeText(compact([
    product.itemName,
    product.itemDescription,
    product.capStyle,
    product.capColor,
    product.applicator,
  ]));
  if (includesAny(haystack, ["detached cap", "loose cap", "overcap", "over-cap", "cap off"])) {
    if (includesAny(haystack, ["clear", "translucent", "white"])) return ["clear_or_white_overcap"];
    return ["overcap"];
  }
  if (closureType === "fine_mist_sprayer" && includesAny(haystack, ["clear cap", "white cap", "over-cap"])) {
    return ["clear_or_white_overcap"];
  }
  if (
    (closureType === "fine_mist_sprayer" || closureType === "lotion_pump") &&
    inferBestBottlesPromptFamily(product) === "cylinder"
  ) {
    return ["clear_or_white_overcap"];
  }
  return [];
}

function inferTransparency(product: ProductLike, bodyMaterial: string): string {
  if (bodyMaterial.includes("glass") || bodyMaterial === "clear_molded_plastic") return "transparent";
  if (bodyMaterial.includes("frosted")) return "translucent";
  if (bodyMaterial.includes("fabric") || bodyMaterial.includes("paperboard")) return bodyMaterial.replace(/_/g, " ");
  return "opaque";
}

function buildSpecialGeometryNotes(product: ProductLike, family: string, closureType: string): string {
  const notes: string[] = [];
  const name = normalizeText(compact([product.itemName, product.itemDescription]));
  if (family === "cylinder") notes.push("Straight vertical Cylinder sidewalls, circular base, and family baseline remain locked.");
  if (
    includesAny(name, ["swirl", "swirled", "swrl", "spiral", "helical", "fluted"])
  ) {
    notes.push(
      "Preserve swirl-fluted clear glass: shallow diagonal helical ribs belong only to the bottle body; keep the cap, sprayer, collar, tube, and detached over-cap smooth and non-swirl.",
    );
  }
  if (closureType === "fine_mist_sprayer") {
    notes.push("Preserve white plastic actuator/nozzle face, polished collar stack, and exactly one cap state from the reference.");
    notes.push("Do not merge the white actuator, gold/silver collar, clear/white over-cap, or internal dip tube into the body; each component must stay visually separate.");
    notes.push("Clear or white over-cap must remain visible with rim ellipse, sidewall edge, top lip, inner back edge, and local shadow separation.");
  }
  if (closureType === "lotion_pump") {
    notes.push("Preserve white plastic pump head, nozzle face, matte/polished collar stack, and exactly one cap state from the reference.");
    notes.push("Do not merge the white pump, gold/silver collar, clear/white over-cap, or internal dip tube into the body; each component must stay visually separate.");
    notes.push("Clear or white over-cap must remain visible with rim ellipse, sidewall edge, top lip, inner back edge, and local shadow separation.");
  }
  if (product.heightWithoutCap || product.diameter) {
    notes.push(`Measurement hint: body height ${product.heightWithoutCap || "unknown"}, diameter/width ${product.diameter || "unknown"}.`);
  }
  return notes.join(" ");
}

function selectedCanvasLabel(sku: PromptSku): string {
  return `${sku.output_canvas_width}x${sku.output_canvas_height}`;
}

function cylinderHeightDiameterRatio(product: ProductLike): number | null {
  const heightMm = parseDimensionMm(product.heightWithCap) ?? parseDimensionMm(product.heightWithoutCap);
  const diameterMm = parseDimensionMm(product.diameter);
  if (
    typeof heightMm !== "number" ||
    typeof diameterMm !== "number" ||
    !Number.isFinite(heightMm) ||
    !Number.isFinite(diameterMm) ||
    heightMm <= 0 ||
    diameterMm <= 0
  ) {
    return null;
  }
  return heightMm / diameterMm;
}

function buildCanvasPreflight(product: ProductLike, sku: PromptSku): BestBottlesCanvasPreflight {
  const selectedCanvas = selectedCanvasLabel(sku);
  const qaChecklist = [`canvas_selected:${selectedCanvas}`];
  const warnings: string[] = [];

  if (sku.product_family !== "cylinder") {
    return { qaChecklist, warnings };
  }

  const ratio = cylinderHeightDiameterRatio(product);
  const ratioText = ratio == null ? "unknown" : ratio.toFixed(2);
  const selectedIsTallNarrow = selectedCanvas === "1024x1536";

  if (ratio != null && ratio < 3) {
    qaChecklist.push("canvas_recommendation:cylinder_compact_review");
    warnings.push(
      `Compact Cylinder measurements suggest this SKU may not need the native 1024 x 1536 tall canvas; review square/round or 10:11 before batch generation. Measured height/diameter ratio is ${ratioText}:1.`,
    );
    return { qaChecklist, warnings };
  }

  qaChecklist.push("canvas_recommendation:tall_narrow_1024x1536");

  if (!selectedIsTallNarrow) {
    warnings.push(
      `Tall/slender Cylinder should use the native 1024 x 1536 canvas; selected ${selectedCanvas}. Measured height/diameter ratio is ${ratioText}:1.`,
    );
  }

  return { qaChecklist, warnings };
}

export function buildBestBottlesPromptSkuFromProduct(input: PromptSkuBuildInput): PromptSku {
  const sku = getSku(input.product);
  const productFamily = inferBestBottlesPromptFamily(input.product);
  const bodyMaterial = inferBestBottlesPromptBodyMaterial(input.product, input.bodyMaterial);
  const closureType = inferBestBottlesPromptClosure(input.product);
  const widthPx = input.canvas?.widthPx ?? 2080;
  const heightPx = input.canvas?.heightPx ?? 2288;
  const referenceImagePath = input.referenceImagePath?.trim() ?? "";

  return {
    sku,
    filename: getFilename(referenceImagePath, sku),
    product_family: productFamily,
    frame_class: inferFrameClass(productFamily),
    body_shape: inferBodyShape(input.product, productFamily),
    body_material: bodyMaterial,
    body_color: input.product.color?.trim().toLowerCase() || "unknown",
    closure_type: closureType,
    closure_material: inferClosureMaterial(input.product, closureType),
    cap_color: inferCapColor(input.product, closureType),
    collar_material: inferCollarMaterial(input.product),
    applicator_type: closureType,
    detached_components: inferDetachedComponents(input.product, closureType),
    orientation: "front",
    transparency_type: inferTransparency(input.product, bodyMaterial),
    special_geometry_notes: buildSpecialGeometryNotes(input.product, productFamily, closureType),
    reference_image_path: referenceImagePath,
    output_canvas_width: widthPx,
    output_canvas_height: heightPx,
  };
}

function getWarnings(
  product: ProductLike,
  sku: PromptSku,
  declaredBodyMaterial?: string | null,
  canvasWarnings: string[] = [],
): string[] {
  const warnings: string[] = [...canvasWarnings];
  const declared = normalizeText(declaredBodyMaterial ?? "");
  const productText = normalizeText(compact([product.category, product.family, product.bottleCollection, product.itemName]));
  if (
    declared.includes("plastic") &&
    sku.body_material.includes("glass") &&
    (sku.product_family === "cylinder" || sku.product_family === "roll_on" || sku.product_family === "boston_round")
  ) {
    warnings.push("Catalog material says plastic, but this SKU compiles as glass from the product family/color identity.");
  }
  if (
    productText.includes("plastic") &&
    sku.body_material.includes("glass") &&
    (sku.product_family === "cylinder" || sku.product_family === "roll_on" || sku.product_family === "boston_round")
  ) {
    warnings.push("Catalog category includes plastic wording; prompt locks visible body material as glass.");
  }
  if (
    includesAny(normalizeText(compact([sku.cap_color, sku.closure_material, product.capColor])), [
      "white",
      "clear",
      "translucent",
      "pale",
    ])
  ) {
    warnings.push("White or translucent cap risk: QA must verify cap lip, sidewall, nozzle, and loose cap remain visible.");
  }
  if (sku.detached_components.length > 0) {
    warnings.push("Detached cap expected: QA must verify exactly one loose cap on the shared baseline.");
  }
  return Array.from(new Set(warnings));
}

export function buildBestBottlesPromptPreflight(
  input: BestBottlesPromptPreflightInput,
): BestBottlesPromptPreflight {
  if (!input.referenceImagePath?.trim()) {
    return {
      status: "error",
      issue: "A flattened product-truth reference is required before this SKU can be compiled.",
      warnings: [],
      sku: null,
      record: null,
    };
  }

  const sku = buildBestBottlesPromptSkuFromProduct(input);
  const canvasPreflight = buildCanvasPreflight(input.product, sku);
  const warnings = getWarnings(input.product, sku, input.bodyMaterial, canvasPreflight.warnings);
  try {
    const moduleValidationRecord = buildPromptForSku(sku, input.system);
    const record: PromptRecord = {
      ...moduleValidationRecord,
      final_prompt: buildBestBottlesCatalogCanonPrompt(sku),
      qa_checklist: Array.from(
        new Set([
          ...moduleValidationRecord.qa_checklist,
          ...canvasPreflight.qaChecklist,
          BEST_BOTTLES_CATALOG_CANON_PROMPT_FLAG,
          `catalog_canon_source:${BEST_BOTTLES_CATALOG_CANON_SOURCE_PATH}`,
        ]),
      ),
    };
    return {
      status: warnings.length > 0 ? "warn" : "ok",
      issue: null,
      warnings,
      sku,
      record,
    };
  } catch (error) {
    return {
      status: "error",
      issue: error instanceof Error ? error.message : "Prompt compilation failed.",
      warnings,
      sku,
      record: null,
    };
  }
}
