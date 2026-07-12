import {
  getBestBottlesShadowPolicyTags,
  resolveBestBottlesShadowPolicy,
} from "./bestBottlesShadowPolicy";

export type JsonRecord = Record<string, unknown>;

export interface PromptSku {
  sku: string;
  filename: string;
  product_family: string;
  frame_class: string;
  body_shape: string;
  body_material: string;
  body_color: string;
  closure_type: string;
  closure_material: string;
  cap_color: string;
  collar_material: string;
  applicator_type: string;
  detached_components: string[];
  orientation: string;
  transparency_type: string;
  special_geometry_notes: string;
  reference_image_path: string;
  output_canvas_width: number;
  output_canvas_height: number;
}

export interface ModuleConfig<T> {
  version: string;
  modules: Record<string, T>;
}

export interface FamilyModule {
  display_name: string;
  default_frame_class?: string;
  preserve: string[];
  do_not_change: string[];
  prompt_lines: string[];
  qa: string[];
}

export interface MaterialModule {
  display_name: string;
  truth: string;
  prompt_lines: string[];
  avoid: string[];
  qa: string[];
}

export interface FrameModule {
  display_name: string;
  centerline: string;
  baseline: string;
  safe_zone: string;
  detached_components: string;
  scale_logic: string;
  prompt_lines: string[];
}

export interface ClosureModule {
  display_name: string;
  prompt_lines: string[];
  forbidden: string[];
  qa: string[];
}

export interface NegativeRule {
  id: string;
  category: string;
  prompt: string;
  qa_key: string;
}

export interface NegativeRulesConfig {
  version: string;
  rules: NegativeRule[];
}

export interface PromptSystem {
  masterTemplate: string;
  families: Record<string, FamilyModule>;
  materials: Record<string, MaterialModule>;
  frames: Record<string, FrameModule>;
  closures: Record<string, ClosureModule>;
  negativeRules: NegativeRule[];
}

export interface PromptRecord {
  sku: string;
  reference_image_path: string;
  product_family: string;
  frame_class: string;
  prompt_version: string;
  shadow_owner: "rig" | "model";
  final_prompt: string;
  qa_checklist: string[];
}

function uniq(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function parseNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(asString(value).trim());
  if (!Number.isFinite(parsed)) return 0;
  return parsed;
}

function parseDetachedComponents(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(asString).filter(Boolean);
  const text = asString(value).trim();
  if (!text) return [];
  return text.split(/[|;,]/).map((part) => part.trim()).filter(Boolean);
}

export function normalizePromptSkuRow(row: JsonRecord): PromptSku {
  return {
    sku: asString(row.sku),
    filename: asString(row.filename),
    product_family: asString(row.product_family),
    frame_class: asString(row.frame_class),
    body_shape: asString(row.body_shape),
    body_material: asString(row.body_material),
    body_color: asString(row.body_color),
    closure_type: asString(row.closure_type),
    closure_material: asString(row.closure_material),
    cap_color: asString(row.cap_color),
    collar_material: asString(row.collar_material),
    applicator_type: asString(row.applicator_type),
    detached_components: parseDetachedComponents(row.detached_components),
    orientation: asString(row.orientation),
    transparency_type: asString(row.transparency_type),
    special_geometry_notes: asString(row.special_geometry_notes),
    reference_image_path: asString(row.reference_image_path),
    output_canvas_width: parseNumber(row.output_canvas_width),
    output_canvas_height: parseNumber(row.output_canvas_height),
  };
}

function requireModule<T>(
  modules: Record<string, T>,
  kind: string,
  key: string,
  sku: string,
): T {
  const found = modules[key];
  if (!found) {
    throw new Error(`Unknown ${kind} "${key}" for SKU ${sku}`);
  }
  return found;
}

function formatList(values: string[]): string {
  return values.length > 0 ? values.join(", ") : "none";
}

function buildSkuLock(
  sku: PromptSku,
  material: MaterialModule,
  family: FamilyModule,
  frame: FrameModule,
  closure: ClosureModule,
): string {
  return [
    "SKU LOCK:",
    `- SKU: ${sku.sku}`,
    `- Source filename: ${sku.filename}`,
    `- Reference image path: ${sku.reference_image_path}`,
    `- Product family: ${sku.product_family} (${family.display_name})`,
    `- Frame class: ${sku.frame_class} (${frame.display_name})`,
    `- Body shape: ${sku.body_shape}`,
    `- Body material: ${material.display_name}`,
    `- Body color: ${sku.body_color}`,
    `- Closure/applicator: ${sku.closure_type} (${closure.display_name})`,
    `- Closure material: ${sku.closure_material}`,
    `- Cap color: ${sku.cap_color}`,
    `- Collar material: ${sku.collar_material}`,
    `- Applicator type: ${sku.applicator_type}`,
    `- Detached components: ${formatList(sku.detached_components)}`,
    `- Orientation: ${sku.orientation}`,
    `- Transparency type: ${sku.transparency_type}`,
    `- Special geometry notes: ${sku.special_geometry_notes || "none"}`,
  ].join("\n");
}

function buildModulePrompt(
  family: FamilyModule,
  material: MaterialModule,
  frame: FrameModule,
  closure: ClosureModule,
  negativeRules: NegativeRule[],
): string {
  return [
    "PRODUCT FAMILY MODULE:",
    ...family.prompt_lines.map((line) => `- ${line}`),
    `- Preserve: ${family.preserve.join(", ")}.`,
    `- Do not change: ${family.do_not_change.join(", ")}.`,
    "",
    "MATERIAL MODULE:",
    `- Material truth: ${material.truth}`,
    ...material.prompt_lines.map((line) => `- ${line}`),
    "",
    "CLOSURE / APPLICATOR MODULE:",
    ...closure.prompt_lines.map((line) => `- ${line}`),
    `- Forbidden closure mutations: ${closure.forbidden.join(", ")}.`,
    "",
    "FRAME MODULE:",
    ...frame.prompt_lines.map((line) => `- ${line}`),
    `- Centerline: ${frame.centerline}.`,
    `- Baseline: ${frame.baseline}.`,
    `- Safe zone: ${frame.safe_zone}.`,
    `- Detached components: ${frame.detached_components}.`,
    `- Scale logic: ${frame.scale_logic}.`,
    "",
    "NEGATIVE RULES:",
    ...negativeRules.map((rule) => `- ${rule.prompt}`),
  ].join("\n");
}

export function buildPromptForSku(sku: PromptSku, system: PromptSystem): PromptRecord {
  const family = requireModule(system.families, "product_family", sku.product_family, sku.sku);
  const material = requireModule(system.materials, "body_material", sku.body_material, sku.sku);
  const frame = requireModule(system.frames, "frame_class", sku.frame_class, sku.sku);
  const closure = requireModule(system.closures, "closure_type", sku.closure_type, sku.sku);

  const skuLock = buildSkuLock(sku, material, family, frame, closure);
  const modulePrompt = buildModulePrompt(family, material, frame, closure, system.negativeRules);
  const finalPrompt = system.masterTemplate
    .replaceAll("{{SKU_LOCK}}", skuLock)
    .replaceAll("{{MODULE_PROMPT}}", modulePrompt)
    .replaceAll("{{OUTPUT_CANVAS_WIDTH}}", String(sku.output_canvas_width))
    .replaceAll("{{OUTPUT_CANVAS_HEIGHT}}", String(sku.output_canvas_height))
    .trim();
  const shadowPolicy = resolveBestBottlesShadowPolicy(sku.sku);

  return {
    sku: sku.sku,
    reference_image_path: sku.reference_image_path,
    product_family: sku.product_family,
    frame_class: sku.frame_class,
    prompt_version: shadowPolicy.promptVersion,
    shadow_owner: shadowPolicy.owner,
    final_prompt: finalPrompt,
    qa_checklist: uniq([
      "reference_png_identity_lock",
      "geometry_preserved",
      "material_truth_preserved",
      "framing_consistent",
      ...family.qa,
      ...material.qa,
      ...closure.qa,
      ...system.negativeRules.map((rule) => rule.qa_key),
      ...getBestBottlesShadowPolicyTags(shadowPolicy),
    ]),
  };
}

export function generateJsonl(skus: PromptSku[], system: PromptSystem): string {
  return skus.map((sku) => JSON.stringify(buildPromptForSku(sku, system))).join("\n");
}
