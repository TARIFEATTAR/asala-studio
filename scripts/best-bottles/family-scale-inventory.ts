import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT =
  "/Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Website-02-20-2026";

export const CONVEX_SNAPSHOT_PATH =
  `${ROOT}/data/audits/2026-06-27-framing-profiles/convex_snapshot.json`;

export const FAMILY_SCALE_JSON_OUTPUT =
  "public/data/bb-family-scale-inventory.json";

export const FAMILY_SCALE_MARKDOWN_OUTPUT =
  "docs/product-image-system/best-bottles-family-scale-inventory.md";

export type RenderingLane =
  | "bottle_catalog"
  | "component_enhancement"
  | "packaging_enhancement"
  | "blocked_unknown";

export type BottleScaleStatus = "mapped" | "needs_review" | "not_bottle" | "blocked";

export type EnhancementStatus = "ready" | "needs_review" | "blocked";

export type FamilyScaleStatus = BottleScaleStatus;

export type GeometryArchetype =
  | "mixed-cylinder"
  | "sample-vial"
  | "small-bottle"
  | "standard-bottle"
  | "large-bottle"
  | "premium-tall"
  | "low-wide"
  | "component"
  | "packaging"
  | "unknown";

export interface MeasurementInput {
  heightWithCap?: string | null;
  heightWithoutCap?: string | null;
  diameter?: string | null;
}

export interface MeasurementSummary {
  heightWithCapMm: RangeSummary | null;
  heightWithoutCapMm: RangeSummary | null;
  diameterMm: RangeSummary | null;
}

export interface RangeSummary {
  min: number;
  max: number;
}

export interface FamilyScaleStatusResult {
  status: FamilyScaleStatus;
  reason: string;
}

export interface FamilyRenderingPlan {
  renderingLane: RenderingLane;
  bottleScaleStatus: BottleScaleStatus;
  enhancementStatus: EnhancementStatus;
  reason: string;
}

export interface FamilyScaleInventoryRow {
  family: string;
  count: number;
  bottleCollections: string[];
  capacitiesMl: number[];
  heightWithCapMm: RangeSummary | null;
  heightWithoutCapMm: RangeSummary | null;
  diameterMm: RangeSummary | null;
  applicators: string[];
  colors: string[];
  neckThreadSizes: string[];
  exampleSkus: string[];
  proposedArchetype: GeometryArchetype;
  visualScaleBand: string;
  targetFillHeightRangePct: RangeSummary | null;
  renderingLane: RenderingLane;
  bottleScaleStatus: BottleScaleStatus;
  enhancementStatus: EnhancementStatus;
  /** Compatibility alias for older inventory consumers. Prefer bottleScaleStatus. */
  status: FamilyScaleStatus;
  statusReason: string;
}

interface ConvexProductRow extends MeasurementInput {
  family?: string | null;
  bottleCollection?: string | null;
  category?: string | null;
  graceSku?: string | null;
  websiteSku?: string | null;
  itemName?: string | null;
  capacity?: string | null;
  capacityMl?: number | string | null;
  applicator?: string | null;
  color?: string | null;
  neckThreadSize?: string | null;
}

interface ConvexSnapshot {
  generatedAt?: string;
  count?: number;
  products: ConvexProductRow[];
}

interface FamilyScaleDefinition {
  renderingLane: RenderingLane;
  bottleScaleStatus: BottleScaleStatus;
  enhancementStatus: EnhancementStatus;
  reason: string;
  proposedArchetype: GeometryArchetype;
  visualScaleBand: string;
  targetFillHeightRangePct: RangeSummary | null;
}

const MAPPED_REASON = "Covered by current Madison family profile resolver.";
const REVIEW_REASON = "Known Best Bottles family with enough product coverage to map next.";
const COMPONENT_ENHANCEMENT_REASON =
  "Component family; exclude from bottle scale, but keep eligible for material and geometry enhancement.";
const PACKAGING_ENHANCEMENT_REASON =
  "Packaging family; exclude from bottle scale, but keep eligible for packaging enhancement.";
const BLOCKED_UNKNOWN_REASON = "Missing or unknown family; requires product-truth review before generation.";
const MIXED_DECORATIVE_REVIEW_REASON =
  "Broad decorative family mixes small and large capacities; needs capacity-aware sub-bands before bulk generation.";

function bottleDefinition(
  bottleScaleStatus: Extract<BottleScaleStatus, "mapped" | "needs_review">,
  reason: string,
  proposedArchetype: GeometryArchetype,
  visualScaleBand: string,
  targetFillHeightRangePct: RangeSummary | null,
): FamilyScaleDefinition {
  return {
    renderingLane: "bottle_catalog",
    bottleScaleStatus,
    enhancementStatus: "needs_review",
    reason,
    proposedArchetype,
    visualScaleBand,
    targetFillHeightRangePct,
  };
}

function componentDefinition(
  proposedArchetype: Extract<GeometryArchetype, "component" | "packaging">,
  visualScaleBand: "component-enhancement" | "packaging-enhancement",
  reason: string,
): FamilyScaleDefinition {
  return {
    renderingLane: proposedArchetype === "component" ? "component_enhancement" : "packaging_enhancement",
    bottleScaleStatus: "not_bottle",
    enhancementStatus: "needs_review",
    reason,
    proposedArchetype,
    visualScaleBand,
    targetFillHeightRangePct: null,
  };
}

function blockedUnknownDefinition(): FamilyScaleDefinition {
  return {
    renderingLane: "blocked_unknown",
    bottleScaleStatus: "blocked",
    enhancementStatus: "blocked",
    reason: BLOCKED_UNKNOWN_REASON,
    proposedArchetype: "unknown",
    visualScaleBand: "blocked-unknown",
    targetFillHeightRangePct: null,
  };
}

const FAMILY_DEFINITIONS: Record<string, FamilyScaleDefinition> = {
  "aluminum bottle": bottleDefinition("mapped", MAPPED_REASON, "premium-tall", "aluminum-bottle", { min: 88, max: 92 }),
  apothecary: bottleDefinition("needs_review", REVIEW_REASON, "standard-bottle", "round-upright", { min: 78, max: 82 }),
  atomizer: bottleDefinition("needs_review", REVIEW_REASON, "premium-tall", "atomizer", { min: 76, max: 84 }),
  bell: bottleDefinition("needs_review", REVIEW_REASON, "standard-bottle", "small-decorative", { min: 68, max: 76 }),
  "boston round": bottleDefinition("mapped", MAPPED_REASON, "standard-bottle", "boston-round", { min: 78, max: 82 }),
  "cap/closure": componentDefinition("component", "component-enhancement", COMPONENT_ENHANCEMENT_REASON),
  "cap/component": componentDefinition("component", "component-enhancement", COMPONENT_ENHANCEMENT_REASON),
  circle: bottleDefinition("needs_review", REVIEW_REASON, "standard-bottle", "round-upright", { min: 78, max: 82 }),
  "cream jar": bottleDefinition("needs_review", REVIEW_REASON, "low-wide", "low-wide", { min: 45, max: 68 }),
  cylinder: bottleDefinition("mapped", MAPPED_REASON, "mixed-cylinder", "sample/small/standard/large-cylinder", { min: 55, max: 84 }),
  decorative: bottleDefinition("needs_review", MIXED_DECORATIVE_REVIEW_REASON, "premium-tall", "mixed-decorative", { min: 55, max: 88 }),
  diamond: bottleDefinition("mapped", MAPPED_REASON, "premium-tall", "heavy-perfume-bottle", { min: 84, max: 88 }),
  diva: bottleDefinition("mapped", MAPPED_REASON, "premium-tall", "heavy-perfume-bottle", { min: 84, max: 88 }),
  dropper: componentDefinition("component", "component-enhancement", COMPONENT_ENHANCEMENT_REASON),
  elegant: bottleDefinition("needs_review", MIXED_DECORATIVE_REVIEW_REASON, "premium-tall", "mixed-decorative", { min: 64, max: 88 }),
  empire: bottleDefinition("mapped", MAPPED_REASON, "large-bottle", "empire-bottle", { min: 80, max: 84 }),
  flair: bottleDefinition("needs_review", REVIEW_REASON, "standard-bottle", "small-decorative", { min: 68, max: 76 }),
  "gift bag": componentDefinition("packaging", "packaging-enhancement", PACKAGING_ENHANCEMENT_REASON),
  "gift box": componentDefinition("packaging", "packaging-enhancement", PACKAGING_ENHANCEMENT_REASON),
  grace: bottleDefinition("mapped", MAPPED_REASON, "premium-tall", "heavy-perfume-bottle", { min: 84, max: 88 }),
  "lotion bottle": bottleDefinition("needs_review", REVIEW_REASON, "large-bottle", "treatment-pump", { min: 80, max: 84 }),
  "lotion pump": componentDefinition("component", "component-enhancement", COMPONENT_ENHANCEMENT_REASON),
  "packaging supply": componentDefinition("packaging", "packaging-enhancement", PACKAGING_ENHANCEMENT_REASON),
  pillar: bottleDefinition(
    "needs_review",
    "Mixed decorative and roll-on collection evidence; requires product-truth review before resolver mapping.",
    "standard-bottle",
    "small-decorative",
    { min: 68, max: 76 },
  ),
  "plastic bottle": bottleDefinition("needs_review", REVIEW_REASON, "standard-bottle", "plastic-bottle", { min: 72, max: 78 }),
  rectangle: bottleDefinition("needs_review", REVIEW_REASON, "standard-bottle", "rectangular-upright", { min: 72, max: 80 }),
  "roll-on cap": componentDefinition("component", "component-enhancement", COMPONENT_ENHANCEMENT_REASON),
  round: bottleDefinition("needs_review", REVIEW_REASON, "standard-bottle", "round-upright", { min: 78, max: 82 }),
  royal: bottleDefinition("needs_review", REVIEW_REASON, "standard-bottle", "small-decorative", { min: 68, max: 76 }),
  sleek: bottleDefinition("needs_review", MIXED_DECORATIVE_REVIEW_REASON, "premium-tall", "mixed-decorative", { min: 55, max: 88 }),
  slim: bottleDefinition("mapped", MAPPED_REASON, "premium-tall", "heavy-perfume-bottle", { min: 84, max: 88 }),
  sprayer: componentDefinition("component", "component-enhancement", COMPONENT_ENHANCEMENT_REASON),
  square: bottleDefinition("needs_review", REVIEW_REASON, "standard-bottle", "small-decorative", { min: 68, max: 76 }),
  "tall cylinder": bottleDefinition(
    "needs_review",
    "Single-row tall-cylinder family conflicts with current measured-height resolver behavior; requires explicit resolver test.",
    "standard-bottle",
    "tall-cylinder-review",
    { min: 72, max: 78 },
  ),
  teardrop: bottleDefinition("needs_review", REVIEW_REASON, "standard-bottle", "small-decorative", { min: 68, max: 76 }),
  tool: componentDefinition("component", "component-enhancement", COMPONENT_ENHANCEMENT_REASON),
  tulip: bottleDefinition("needs_review", REVIEW_REASON, "standard-bottle", "small-decorative", { min: 68, max: 76 }),
  unknown: blockedUnknownDefinition(),
  vial: bottleDefinition("mapped", MAPPED_REASON, "sample-vial", "sample-vial", { min: 55, max: 60 }),
};

export function parseMeasurementMm(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = value.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const parsed = Number.parseFloat(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function rangeFromNumbers(values: number[]): RangeSummary | null {
  if (values.length === 0) return null;
  return {
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

export function summarizeMeasurements(rows: MeasurementInput[]): MeasurementSummary {
  return {
    heightWithCapMm: rangeFromNumbers(
      rows.map((row) => parseMeasurementMm(row.heightWithCap)).filter(isFiniteNumber),
    ),
    heightWithoutCapMm: rangeFromNumbers(
      rows.map((row) => parseMeasurementMm(row.heightWithoutCap)).filter(isFiniteNumber),
    ),
    diameterMm: rangeFromNumbers(
      rows.map((row) => parseMeasurementMm(row.diameter)).filter(isFiniteNumber),
    ),
  };
}

export function classifyFamilyScaleStatus(
  family: string | null | undefined,
  bottleCollection?: string | null,
): FamilyScaleStatusResult {
  const plan = classifyFamilyRenderingPlan(family, bottleCollection);
  return {
    status: plan.bottleScaleStatus,
    reason: plan.reason,
  };
}

export function classifyFamilyRenderingPlan(
  family: string | null | undefined,
  bottleCollection?: string | null,
): FamilyRenderingPlan {
  const definition = getFamilyScaleDefinition(family, bottleCollection);
  return {
    renderingLane: definition.renderingLane,
    bottleScaleStatus: definition.bottleScaleStatus,
    enhancementStatus: definition.enhancementStatus,
    reason: definition.reason,
  };
}

function getFamilyScaleDefinition(
  family: string | null | undefined,
  bottleCollection?: string | null,
): FamilyScaleDefinition {
  const normalizedFamily = normalizeKey(family);
  if (normalizedFamily && FAMILY_DEFINITIONS[normalizedFamily]) {
    return FAMILY_DEFINITIONS[normalizedFamily];
  }

  const normalizedCollection = normalizeKey(bottleCollection);
  if (normalizedCollection && FAMILY_DEFINITIONS[normalizedCollection]) {
    return FAMILY_DEFINITIONS[normalizedCollection];
  }

  return FAMILY_DEFINITIONS.unknown;
}

function buildFamilyScaleInventory(snapshot: ConvexSnapshot): FamilyScaleInventoryRow[] {
  const grouped = new Map<string, ConvexProductRow[]>();

  for (const product of snapshot.products) {
    const family = normalizeFamilyName(product.family);
    const rows = grouped.get(family) ?? [];
    rows.push(product);
    grouped.set(family, rows);
  }

  return [...grouped.entries()]
    .sort(([familyA], [familyB]) => familyA.localeCompare(familyB))
    .map(([family, products]) => buildFamilyRow(family, products));
}

function buildFamilyRow(family: string, products: ConvexProductRow[]): FamilyScaleInventoryRow {
  const definition = getFamilyScaleDefinition(family, products[0]?.bottleCollection);
  const measurements = summarizeMeasurements(products);

  return {
    family,
    count: products.length,
    bottleCollections: uniqueSorted(products.map((product) => normalizeNullableText(product.bottleCollection))),
    capacitiesMl: uniqueSortedNumbers(products.map((product) => getCapacityMl(product))),
    heightWithCapMm: measurements.heightWithCapMm,
    heightWithoutCapMm: measurements.heightWithoutCapMm,
    diameterMm: measurements.diameterMm,
    applicators: uniqueSorted(products.map((product) => normalizeNullableText(product.applicator))),
    colors: uniqueSorted(products.map((product) => normalizeNullableText(product.color))),
    neckThreadSizes: uniqueSorted(products.map((product) => normalizeNullableText(product.neckThreadSize))),
    exampleSkus: uniqueSorted(
      products
        .map((product) => normalizeNullableText(product.graceSku) ?? normalizeNullableText(product.websiteSku))
        .filter((value): value is string => Boolean(value)),
    ).slice(0, 8),
    proposedArchetype: definition.proposedArchetype,
    visualScaleBand: definition.visualScaleBand,
    targetFillHeightRangePct: definition.targetFillHeightRangePct,
    renderingLane: definition.renderingLane,
    bottleScaleStatus: definition.bottleScaleStatus,
    enhancementStatus: definition.enhancementStatus,
    status: definition.bottleScaleStatus,
    statusReason: definition.reason,
  };
}

function buildCollectionRows(snapshot: ConvexSnapshot): FamilyScaleInventoryRow[] {
  const grouped = new Map<string, { family: string; products: ConvexProductRow[] }>();

  for (const product of snapshot.products) {
    const family = normalizeFamilyName(product.family);
    const collection = normalizeFamilyName(product.bottleCollection);
    const key = `${family}::${collection}`;
    const group = grouped.get(key) ?? { family, products: [] };
    group.products.push(product);
    grouped.set(key, group);
  }

  return [...grouped.values()]
    .map(({ family, products }) => buildFamilyRow(family, products))
    .sort((a, b) => `${a.family}:${a.bottleCollections[0] ?? ""}`.localeCompare(`${b.family}:${b.bottleCollections[0] ?? ""}`));
}

function buildMarkdown(rows: FamilyScaleInventoryRow[], snapshot: ConvexSnapshot): string {
  const bottleScaleSummary = summarizeBottleScaleStatuses(rows);
  const renderingLaneSummary = summarizeByKey(rows, "renderingLane", {
    bottle_catalog: 0,
    component_enhancement: 0,
    packaging_enhancement: 0,
    blocked_unknown: 0,
  });
  const enhancementSummary = summarizeByKey(rows, "enhancementStatus", {
    ready: 0,
    needs_review: 0,
    blocked: 0,
  });
  const now = new Date().toISOString();
  const lines = [
    "# Best Bottles Family Scale Inventory",
    "",
    `Generated: ${now}`,
    "",
    "Source:",
    "",
    "```text",
    CONVEX_SNAPSHOT_PATH,
    "```",
    "",
    "Policy:",
    "",
    "Madison does not render products at literal real-world scale. Convex measurements are used to choose a catalog-friendly visual scale band, and the rig enforces that band's target on the fixed 2080x2288 studio canvas.",
    "",
    "Summary:",
    "",
    `- Convex products reviewed: ${snapshot.products.length}`,
    `- Families reviewed: ${rows.length}`,
    `- Bottle catalog families: ${renderingLaneSummary.bottle_catalog}`,
    `- Component enhancement families: ${renderingLaneSummary.component_enhancement}`,
    `- Packaging enhancement families: ${renderingLaneSummary.packaging_enhancement}`,
    `- Unknown blocked families: ${renderingLaneSummary.blocked_unknown}`,
    `- Bottle scale mapped: ${bottleScaleSummary.mapped}`,
    `- Bottle scale needs review: ${bottleScaleSummary.needs_review}`,
    `- Not bottle scale: ${bottleScaleSummary.not_bottle}`,
    `- Enhancement needs review: ${enhancementSummary.needs_review}`,
    "",
    "## Family Scale Table",
    "",
    "| Rendering lane | Bottle scale status | Enhancement status | Family | Count | Collections | Capacity ml | Height with cap mm | Diameter mm | Proposed archetype | Visual scale band | Target fill-height | Example SKUs | Reason |",
    "| --- | --- | --- | --- | ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  ];

  for (const row of rows) {
    lines.push([
      row.renderingLane,
      row.bottleScaleStatus,
      row.enhancementStatus,
      row.family,
      String(row.count),
      joinLimited(row.bottleCollections, 4),
      formatNumberList(row.capacitiesMl),
      formatRange(row.heightWithCapMm),
      formatRange(row.diameterMm),
      row.proposedArchetype,
      row.visualScaleBand,
      formatRange(row.targetFillHeightRangePct, "%"),
      joinLimited(row.exampleSkus, 3),
      row.statusReason,
    ].map(escapeTableCell).join(" | ").replace(/^/, "| ").replace(/$/, " |"));
  }

  lines.push(
    "",
    "## Taxonomy Definitions",
    "",
    "- `renderingLane: bottle_catalog`: product participates in bottle-family or jar-family catalog rendering.",
    "- `renderingLane: component_enhancement`: fitments, caps, sprayers, droppers, pumps, tools, or other components. These are not bottle scale targets, but are valid enhancement targets.",
    "- `renderingLane: packaging_enhancement`: gift bags, gift boxes, and packaging supplies. These are not bottle scale targets, but are valid packaging enhancement targets.",
    "- `renderingLane: blocked_unknown`: unknown product truth. Do not generate until reconciled.",
    "- `bottleScaleStatus: mapped`: covered by the current Madison bottle scale resolver or current mapped profile group.",
    "- `bottleScaleStatus: needs_review`: true bottle/catalog family, but not bulk-safe until resolver tests and smoke QA exist.",
    "- `bottleScaleStatus: not_bottle`: excluded from bottle scale logic because it belongs to component or packaging enhancement.",
    "- `enhancementStatus: needs_review`: eligible lane exists, but prompt/rig QA still needs family-specific verification before bulk.",
    "",
    "## Next Implementation Order",
    "",
    "1. Map `Circle`, `Round`, and `Apothecary` as round upright profiles.",
    "2. Map `Atomizer`, `Lotion Bottle`, and `Plastic Bottle` as dedicated upright bottle profiles.",
    "3. Map `Cream Jar` as width-first low-wide.",
    "4. Map small decorative families after a representative visual smoke set: `Tulip`, `Flair`, `Square`, `Royal`, `Bell`, `Rectangle`, `Pillar`, `Teardrop`.",
    "5. Define component enhancement prompt and baseline QA for `Cap/Closure`, `Cap/Component`, `Dropper`, `Lotion Pump`, `Roll-On Cap`, `Sprayer`, and `Tool`.",
    "6. Define packaging enhancement prompt and baseline QA for `Gift Bag`, `Gift Box`, and `Packaging Supply`.",
    "",
  );

  return `${lines.join("\n")}\n`;
}

function summarizeBottleScaleStatuses(rows: FamilyScaleInventoryRow[]): Record<BottleScaleStatus, number> {
  return rows.reduce<Record<BottleScaleStatus, number>>(
    (acc, row) => {
      acc[row.bottleScaleStatus] += 1;
      return acc;
    },
    { mapped: 0, needs_review: 0, not_bottle: 0, blocked: 0 },
  );
}

function summarizeByKey<K extends keyof FamilyScaleInventoryRow, V extends string>(
  rows: FamilyScaleInventoryRow[],
  key: K,
  initial: Record<V, number>,
): Record<V, number> {
  return rows.reduce<Record<V, number>>((acc, row) => {
    const value = row[key] as V;
    acc[value] += 1;
    return acc;
  }, { ...initial });
}

function getCapacityMl(product: ConvexProductRow): number | null {
  if (typeof product.capacityMl === "number" && Number.isFinite(product.capacityMl)) return product.capacityMl;
  if (typeof product.capacityMl === "string") {
    const parsed = Number.parseFloat(product.capacityMl);
    if (Number.isFinite(parsed)) return parsed;
  }
  return parseMeasurementMm(product.capacity);
}

function normalizeKey(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeFamilyName(value: string | null | undefined): string {
  const normalized = (value ?? "").trim();
  return normalized.length > 0 ? normalized : "Unknown";
}

function normalizeNullableText(value: string | null | undefined): string | null {
  const normalized = (value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
}

function uniqueSorted(values: (string | null)[]): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))].sort((a, b) =>
    a.localeCompare(b)
  );
}

function uniqueSortedNumbers(values: (number | null)[]): number[] {
  return [...new Set(values.filter(isFiniteNumber))].sort((a, b) => a - b);
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function formatRange(range: RangeSummary | null, suffix = ""): string {
  if (!range) return "n/a";
  return range.min === range.max ? `${range.min}${suffix}` : `${range.min}-${range.max}${suffix}`;
}

function formatNumberList(values: number[]): string {
  if (values.length === 0) return "n/a";
  if (values.length <= 8) return values.join(", ");
  return `${values.slice(0, 8).join(", ")}...`;
}

function joinLimited(values: string[], limit: number): string {
  if (values.length === 0) return "n/a";
  if (values.length <= limit) return values.join(", ");
  return `${values.slice(0, limit).join(", ")} +${values.length - limit} more`;
}

function escapeTableCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

export function generateFamilyScaleInventory(
  snapshotPath = CONVEX_SNAPSHOT_PATH,
): {
  generatedAt: string;
  sourcePath: string;
  productCount: number;
  familyCount: number;
  summary: Record<BottleScaleStatus, number>;
  bottleScaleSummary: Record<BottleScaleStatus, number>;
  renderingLaneSummary: Record<RenderingLane, number>;
  enhancementSummary: Record<EnhancementStatus, number>;
  families: FamilyScaleInventoryRow[];
  collectionRows: FamilyScaleInventoryRow[];
} {
  const snapshot = JSON.parse(fs.readFileSync(snapshotPath, "utf8")) as ConvexSnapshot;
  const families = buildFamilyScaleInventory(snapshot);
  const bottleScaleSummary = summarizeBottleScaleStatuses(families);
  const renderingLaneSummary = summarizeByKey(families, "renderingLane", {
    bottle_catalog: 0,
    component_enhancement: 0,
    packaging_enhancement: 0,
    blocked_unknown: 0,
  });
  const enhancementSummary = summarizeByKey(families, "enhancementStatus", {
    ready: 0,
    needs_review: 0,
    blocked: 0,
  });

  return {
    generatedAt: new Date().toISOString(),
    sourcePath: snapshotPath,
    productCount: snapshot.products.length,
    familyCount: families.length,
    summary: bottleScaleSummary,
    bottleScaleSummary,
    renderingLaneSummary,
    enhancementSummary,
    families,
    collectionRows: buildCollectionRows(snapshot),
  };
}

function writeInventoryFiles(): void {
  const inventory = generateFamilyScaleInventory();
  const markdown = buildMarkdown(inventory.families, {
    products: Array.from({ length: inventory.productCount }, () => ({})),
  });

  fs.mkdirSync(path.dirname(FAMILY_SCALE_JSON_OUTPUT), { recursive: true });
  fs.mkdirSync(path.dirname(FAMILY_SCALE_MARKDOWN_OUTPUT), { recursive: true });
  fs.writeFileSync(FAMILY_SCALE_JSON_OUTPUT, `${JSON.stringify(inventory, null, 2)}\n`);
  fs.writeFileSync(FAMILY_SCALE_MARKDOWN_OUTPUT, markdown);

  console.log(`${FAMILY_SCALE_JSON_OUTPUT} written`);
  console.log(`${FAMILY_SCALE_MARKDOWN_OUTPUT} written`);
  console.log(
    `${inventory.familyCount} family groups reviewed: ` +
      `${inventory.renderingLaneSummary.bottle_catalog} bottle catalog, ` +
      `${inventory.renderingLaneSummary.component_enhancement} component enhancement, ` +
      `${inventory.renderingLaneSummary.packaging_enhancement} packaging enhancement, ` +
      `${inventory.renderingLaneSummary.blocked_unknown} blocked unknown.`,
  );
}

const isMain = process.argv[1]
  ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;

if (isMain) {
  writeInventoryFiles();
}
