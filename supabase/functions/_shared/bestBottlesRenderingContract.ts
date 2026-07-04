import { getFamilyRigForProduct, type FamilyRigConfig } from "./familyRig.ts";
import { shouldForceBestBottlesOpenAIProvider } from "./bestBottlesProviderRouting.ts";

export type BestBottlesRenderingLane =
  | "bottle_catalog"
  | "component_enhancement"
  | "packaging_enhancement"
  | "blocked_unknown";

export type BestBottlesBottleScaleStatus =
  | "mapped"
  | "needs_review"
  | "not_bottle"
  | "blocked";

export type BestBottlesEnhancementStatus = "ready" | "needs_review" | "blocked";

export type BestBottlesContractStatus = "ready" | "needs_review" | "blocked";

export type BestBottlesPromptProfile =
  | "bottle_glass"
  | "component_enhancement"
  | "packaging_enhancement"
  | "blocked";

export interface BestBottlesContractCanvas {
  width: number;
  height: number;
  backgroundHex: string;
  baselinePct: number;
  primaryObjectCenterXPct: number;
}

export const BEST_BOTTLES_CONTRACT_CANVAS: BestBottlesContractCanvas = {
  width: 2080,
  height: 2288,
  backgroundHex: "#F5F3EF",
  baselinePct: 9,
  primaryObjectCenterXPct: 50,
};

export interface BestBottlesContractProduct {
  graceSku?: string | null;
  websiteSku?: string | null;
  family?: string | null;
  bottleCollection?: string | null;
  category?: string | null;
  itemName?: string | null;
  itemDescription?: string | null;
  color?: string | null;
  capacity?: string | null;
  capacityMl?: number | null;
  applicator?: string | null;
  capStyle?: string | null;
  capColor?: string | null;
  trimColor?: string | null;
  heightWithCap?: string | null;
  heightWithoutCap?: string | null;
  diameter?: string | null;
  bodyMaterial?: string | null;
  identityStatus?: string | null;
  identityBlockers?: string[] | null;
}

export interface BestBottlesCategorizedReferences {
  product: Array<{ url: string; description?: string; label?: string }>;
  background: Array<{ url: string; description?: string; label?: string }>;
  style: Array<{ url: string; description?: string; label?: string }>;
}

export interface BestBottlesRenderingContractInput {
  isBestBottlesStudioMasterRequest: boolean;
  isRefinement?: boolean;
  allowBestBottlesProviderOverride?: boolean | null;
  productContext?: Record<string, unknown> | null;
  precompiledPromptRecord?: unknown;
  categorizedRefs: BestBottlesCategorizedReferences;
  extraLibraryTags?: string[];
  referenceAuditValues?: readonly unknown[];
}

export interface BestBottlesProductTruthResolver {
  fetchProductBySku?: (sku: string) => Promise<BestBottlesContractProduct | null>;
  fetchProductByWebsiteSku?: (websiteSku: string) => Promise<BestBottlesContractProduct | null>;
}

export interface BestBottlesRenderingContract {
  version: "v1";
  status: BestBottlesContractStatus;
  error: string | null;
  product: BestBottlesContractProduct | null;
  productContext: Record<string, unknown>;
  sku: string | null;
  websiteSku: string | null;
  family: string | null;
  renderingLane: BestBottlesRenderingLane;
  bottleScaleStatus: BestBottlesBottleScaleStatus;
  enhancementStatus: BestBottlesEnhancementStatus;
  promptProfile: BestBottlesPromptProfile;
  canvas: BestBottlesContractCanvas;
  rig: FamilyRigConfig | null;
  providerPolicy: {
    provider: "openai" | "requested";
    model: "gpt-image-2" | null;
    comparisonOnly: boolean;
  };
  qaPolicy: {
    kind: "bottle_framing_qa" | "component_enhancement_qa" | "packaging_enhancement_qa" | "blocked";
    enforceFillHeight: boolean;
    allowedDecisions: Array<"pass" | "normalize" | "reject">;
  };
  libraryTags: string[];
}

interface FamilyLaneDefinition {
  renderingLane: BestBottlesRenderingLane;
  bottleScaleStatus: BestBottlesBottleScaleStatus;
  enhancementStatus: BestBottlesEnhancementStatus;
}

const MAPPED_BOTTLE_FAMILIES = new Set([
  "aluminum bottle",
  "boston round",
  "cylinder",
  "diamond",
  "diva",
  "empire",
  "grace",
  "slim",
  "vial",
]);

const REVIEW_BOTTLE_FAMILIES = new Set([
  "apothecary",
  "atomizer",
  "bell",
  "circle",
  "cream jar",
  "decorative",
  "elegant",
  "flair",
  "lotion bottle",
  "pillar",
  "plastic bottle",
  "rectangle",
  "round",
  "royal",
  "sleek",
  "square",
  "tall cylinder",
  "teardrop",
  "tulip",
]);

const COMPONENT_FAMILIES = new Set([
  "cap/closure",
  "cap/component",
  "dropper",
  "lotion pump",
  "roll-on cap",
  "sprayer",
  "tool",
]);

const PACKAGING_FAMILIES = new Set([
  "gift bag",
  "gift box",
  "packaging supply",
]);

const RETIRED_REFERENCE_TOKENS = [
  "reference-imports/background-removed",
  "reference-imports/bg-removed",
  "background-removed",
  "background_removed",
  "bg-removed",
  "bg_removed",
  "transparent-png",
  "transparent",
  "paper-doll",
  "paperdoll",
  "mask-control",
  "mask_ref",
  "mask-ref",
  "studio-mask-control-references",
];

const BLOCKED_CONTRACT = {
  version: "v1" as const,
  product: null,
  productContext: {},
  sku: null,
  websiteSku: null,
  family: null,
  renderingLane: "blocked_unknown" as const,
  bottleScaleStatus: "blocked" as const,
  enhancementStatus: "blocked" as const,
  promptProfile: "blocked" as const,
  canvas: BEST_BOTTLES_CONTRACT_CANVAS,
  rig: null,
  providerPolicy: {
    provider: "openai" as const,
    model: "gpt-image-2" as const,
    comparisonOnly: false,
  },
  qaPolicy: {
    kind: "blocked" as const,
    enforceFillHeight: false,
    allowedDecisions: ["reject" as const],
  },
  libraryTags: ["contract:v1", "contract-status:blocked", "rendering-lane:blocked_unknown"],
};

function textValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeFamily(value: unknown): string {
  return textValue(value).toLowerCase().replace(/[_]+/g, " ").replace(/\s+/g, " ");
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function readSkuCandidates(input: BestBottlesRenderingContractInput): string[] {
  const productContext = input.productContext ?? {};
  const precompiled = readRecord(input.precompiledPromptRecord);
  const tagSku = input.extraLibraryTags
    ?.find((tag) => tag.startsWith("sku:"))
    ?.slice("sku:".length);

  return Array.from(new Set([
    textValue(precompiled?.sku),
    textValue(productContext.sku),
    textValue(productContext.graceSku),
    textValue(tagSku),
    textValue(productContext.websiteSku),
  ].filter(Boolean)));
}

function contractProductContext(product: BestBottlesContractProduct): Record<string, unknown> {
  return {
    ...product,
    sku: product.graceSku ?? null,
    name: product.itemName ?? null,
    collection: product.bottleCollection ?? null,
    canvas: "2080x2288",
    rigVersion: "best-bottles-rendering-contract-v1",
  };
}

async function resolveProductTruth(
  input: BestBottlesRenderingContractInput,
  resolver: BestBottlesProductTruthResolver,
): Promise<BestBottlesContractProduct | null> {
  for (const candidate of readSkuCandidates(input)) {
    const bySku = resolver.fetchProductBySku
      ? await resolver.fetchProductBySku(candidate)
      : null;
    if (bySku) return bySku;

    const byWebsiteSku = resolver.fetchProductByWebsiteSku
      ? await resolver.fetchProductByWebsiteSku(candidate)
      : null;
    if (byWebsiteSku) return byWebsiteSku;
  }
  return null;
}

function getFamilyLaneDefinition(family: string): FamilyLaneDefinition {
  const normalized = normalizeFamily(family);
  if (!normalized || normalized === "unknown") {
    return {
      renderingLane: "blocked_unknown",
      bottleScaleStatus: "blocked",
      enhancementStatus: "blocked",
    };
  }
  if (COMPONENT_FAMILIES.has(normalized)) {
    return {
      renderingLane: "component_enhancement",
      bottleScaleStatus: "not_bottle",
      enhancementStatus: "needs_review",
    };
  }
  if (PACKAGING_FAMILIES.has(normalized)) {
    return {
      renderingLane: "packaging_enhancement",
      bottleScaleStatus: "not_bottle",
      enhancementStatus: "needs_review",
    };
  }
  if (MAPPED_BOTTLE_FAMILIES.has(normalized)) {
    return {
      renderingLane: "bottle_catalog",
      bottleScaleStatus: "mapped",
      enhancementStatus: "needs_review",
    };
  }
  if (REVIEW_BOTTLE_FAMILIES.has(normalized)) {
    return {
      renderingLane: "bottle_catalog",
      bottleScaleStatus: "needs_review",
      enhancementStatus: "needs_review",
    };
  }
  return {
    renderingLane: "blocked_unknown",
    bottleScaleStatus: "blocked",
    enhancementStatus: "blocked",
  };
}

function componentRig(profileId: "component-enhancement" | "packaging-enhancement"): FamilyRigConfig {
  return {
    family: profileId,
    profileId,
    profileLabel: profileId === "component-enhancement" ? "Component Enhancement" : "Packaging Enhancement",
    relativeScaleZoneId: profileId,
    relativeScaleZoneLabel: profileId === "component-enhancement" ? "Component enhancement" : "Packaging enhancement",
    fillHeightPct: profileId === "component-enhancement" ? 62 : 72,
    fillHeightRangePct: profileId === "component-enhancement" ? { min: 50, max: 74 } : { min: 55, max: 82 },
    fillWidthPct: 70,
    baselinePct: BEST_BOTTLES_CONTRACT_CANVAS.baselinePct,
    primaryObjectCenterXPct: BEST_BOTTLES_CONTRACT_CANVAS.primaryObjectCenterXPct,
  };
}

function resolveRig(
  product: BestBottlesContractProduct,
  lane: BestBottlesRenderingLane,
): FamilyRigConfig | null {
  if (lane === "component_enhancement") return componentRig("component-enhancement");
  if (lane === "packaging_enhancement") return componentRig("packaging-enhancement");
  if (lane !== "bottle_catalog") return null;
  return getFamilyRigForProduct({
    family: product.family,
    bottleCollection: product.bottleCollection,
    category: product.category,
    sku: product.graceSku,
    websiteSku: product.websiteSku,
    name: product.itemName,
    itemDescription: product.itemDescription,
    applicator: product.applicator,
    capacity: product.capacity,
    capacityMl: product.capacityMl ?? null,
    heightWithCap: product.heightWithCap,
    heightWithoutCap: product.heightWithoutCap,
    diameter: product.diameter,
  });
}

function resolvePromptProfile(lane: BestBottlesRenderingLane): BestBottlesPromptProfile {
  if (lane === "component_enhancement") return "component_enhancement";
  if (lane === "packaging_enhancement") return "packaging_enhancement";
  if (lane === "bottle_catalog") return "bottle_glass";
  return "blocked";
}

function resolveQaPolicy(lane: BestBottlesRenderingLane): BestBottlesRenderingContract["qaPolicy"] {
  if (lane === "component_enhancement") {
    return {
      kind: "component_enhancement_qa",
      enforceFillHeight: false,
      allowedDecisions: ["pass", "normalize", "reject"],
    };
  }
  if (lane === "packaging_enhancement") {
    return {
      kind: "packaging_enhancement_qa",
      enforceFillHeight: false,
      allowedDecisions: ["pass", "normalize", "reject"],
    };
  }
  if (lane === "bottle_catalog") {
    return {
      kind: "bottle_framing_qa",
      enforceFillHeight: true,
      allowedDecisions: ["pass", "normalize", "reject"],
    };
  }
  return {
    kind: "blocked",
    enforceFillHeight: false,
    allowedDecisions: ["reject"],
  };
}

function getReferenceCountIssue(input: BestBottlesRenderingContractInput): string | null {
  const refs = input.categorizedRefs;
  const total = refs.product.length + refs.background.length + refs.style.length;
  if (refs.product.length === 0) {
    return "Best Bottles master generation requires exactly one product reference image.";
  }
  if (total !== 1 || refs.product.length !== 1) {
    return "Best Bottles master generation accepts exactly one product reference image and no background/style references.";
  }
  return null;
}

function normalizeReferenceValue(value: unknown): string {
  if (value == null) return "";
  let normalized = String(value).trim().toLowerCase().replace(/\\/g, "/");
  try {
    normalized = decodeURIComponent(normalized);
  } catch {
    // Keep undecodable values as-is.
  }
  return normalized.replace(/\s+/g, " ");
}

function collectReferenceValues(value: unknown, seen = new WeakSet<object>(), depth = 0): unknown[] {
  if (value == null || depth > 5) return [];
  if (typeof value !== "object") return [value];
  if (seen.has(value)) return [];
  seen.add(value);
  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectReferenceValues(entry, seen, depth + 1));
  }
  return Object.entries(value as Record<string, unknown>).flatMap(([key, entry]) => [
    key,
    ...collectReferenceValues(entry, seen, depth + 1),
  ]);
}

function getRetiredReferenceIssue(input: BestBottlesRenderingContractInput): string | null {
  const values = [
    ...input.categorizedRefs.product,
    ...input.categorizedRefs.background,
    ...input.categorizedRefs.style,
    ...(input.referenceAuditValues ?? []),
  ].flatMap((value) => collectReferenceValues(value));
  const retired = values
    .map(normalizeReferenceValue)
    .some((value) => RETIRED_REFERENCE_TOKENS.some((token) => value.includes(token)));
  return retired
    ? "Best Bottles rendering contract blocked retired transparent or background-removed reference lineage."
    : null;
}

function resolveProviderPolicy(
  input: BestBottlesRenderingContractInput,
): BestBottlesRenderingContract["providerPolicy"] {
  const forceOpenAI = shouldForceBestBottlesOpenAIProvider({
    isBestBottlesReferenceLocked: true,
    allowBestBottlesProviderOverride: input.allowBestBottlesProviderOverride,
  });
  if (forceOpenAI) {
    return {
      provider: "openai",
      model: "gpt-image-2",
      comparisonOnly: false,
    };
  }
  return {
    provider: "requested",
    model: null,
    comparisonOnly: true,
  };
}

function statusForDefinition(definition: FamilyLaneDefinition): BestBottlesContractStatus {
  if (definition.renderingLane === "blocked_unknown") return "blocked";
  if (definition.renderingLane === "bottle_catalog" && definition.bottleScaleStatus === "mapped") {
    return "ready";
  }
  return "needs_review";
}

function libraryTagsForContract(contract: Omit<BestBottlesRenderingContract, "libraryTags">): string[] {
  const tags = [
    "contract:v1",
    `contract-status:${contract.status}`,
    `rendering-lane:${contract.renderingLane}`,
    `bottle-scale:${contract.bottleScaleStatus}`,
    `enhancement-status:${contract.enhancementStatus}`,
    `prompt-profile:${contract.promptProfile}`,
    `canvas:${contract.canvas.width}x${contract.canvas.height}`,
    `qa-policy:${contract.qaPolicy.kind}`,
    contract.providerPolicy.comparisonOnly ? "contract-provider:comparison" : "contract-provider:openai-image-2",
    contract.sku ? `sku:${contract.sku}` : null,
    contract.rig?.profileId ? `profile:${contract.rig.profileId}` : null,
    contract.rig?.relativeScaleZoneId ? `scale-zone:${contract.rig.relativeScaleZoneId}` : null,
  ].filter((tag): tag is string => Boolean(tag));

  return Array.from(new Set(tags));
}

function blockedContract(error: string): BestBottlesRenderingContract {
  return {
    ...BLOCKED_CONTRACT,
    status: "blocked",
    error,
    libraryTags: Array.from(new Set([
      ...BLOCKED_CONTRACT.libraryTags,
      "prompt-profile:blocked",
      "qa-policy:blocked",
    ])),
  };
}

export async function resolveBestBottlesRenderingContract(
  input: BestBottlesRenderingContractInput,
  resolver: BestBottlesProductTruthResolver = createBestBottlesConvexProductTruthResolver(),
): Promise<BestBottlesRenderingContract | null> {
  if (!input.isBestBottlesStudioMasterRequest) return null;

  const referenceCountIssue = getReferenceCountIssue(input);
  if (referenceCountIssue) return blockedContract(referenceCountIssue);

  const retiredReferenceIssue = getRetiredReferenceIssue(input);
  if (retiredReferenceIssue) return blockedContract(retiredReferenceIssue);

  const product = await resolveProductTruth(input, resolver);
  if (!product) {
    return blockedContract("Best Bottles rendering contract could not resolve product truth from Convex.");
  }

  const family = product.family ?? product.bottleCollection ?? null;
  const definition = getFamilyLaneDefinition(family ?? "");
  if (definition.renderingLane === "blocked_unknown") {
    return {
      ...blockedContract("Best Bottles rendering contract blocked unknown product truth or family mapping."),
      product,
      productContext: contractProductContext(product),
      sku: product.graceSku ?? null,
      websiteSku: product.websiteSku ?? null,
      family,
    };
  }

  const providerPolicy = resolveProviderPolicy(input);
  const rig = resolveRig(product, definition.renderingLane);
  const status = statusForDefinition(definition);
  const promptProfile = resolvePromptProfile(definition.renderingLane);
  const productContext = {
    ...contractProductContext(product),
    renderingLane: definition.renderingLane,
    bottleScaleStatus: definition.bottleScaleStatus,
    enhancementStatus: definition.enhancementStatus,
    promptProfile,
    contractVersion: "v1",
  };
  const partial: Omit<BestBottlesRenderingContract, "libraryTags"> = {
    version: "v1",
    status,
    error: null,
    product,
    productContext,
    sku: product.graceSku ?? null,
    websiteSku: product.websiteSku ?? null,
    family,
    renderingLane: definition.renderingLane,
    bottleScaleStatus: definition.bottleScaleStatus,
    enhancementStatus: definition.enhancementStatus,
    promptProfile,
    canvas: BEST_BOTTLES_CONTRACT_CANVAS,
    rig,
    providerPolicy,
    qaPolicy: resolveQaPolicy(definition.renderingLane),
  };

  return {
    ...partial,
    libraryTags: libraryTagsForContract(partial),
  };
}

function cleanEnv(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/^['"]|['"]$/g, "") : "";
}

function getBestBottlesConvexUrl(): string {
  const deno = globalThis as unknown as { Deno?: { env?: { get?: (key: string) => string | undefined } } };
  return cleanEnv(deno.Deno?.env?.get?.("BESTBOTTLES_CONVEX_URL"));
}

async function queryBestBottlesConvex(
  path: string,
  args: Record<string, unknown>,
): Promise<BestBottlesContractProduct | null> {
  const rawUrl = getBestBottlesConvexUrl();
  if (!rawUrl) {
    throw new Error("BESTBOTTLES_CONVEX_URL is required to resolve Best Bottles product truth.");
  }
  const target = `${rawUrl.replace(/\/+$/, "")}/api/query`;
  const response = await fetch(target, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, args, format: "json" }),
  });
  if (!response.ok) {
    throw new Error(`Best Bottles Convex product truth query failed: ${response.status}`);
  }
  const body = await response.json() as { status?: string; value?: unknown; errorMessage?: string };
  if (body.status === "error") {
    throw new Error(body.errorMessage || "Best Bottles Convex returned error.");
  }
  return readRecord(body.value) as BestBottlesContractProduct | null;
}

export function createBestBottlesConvexProductTruthResolver(): BestBottlesProductTruthResolver {
  return {
    fetchProductBySku: (sku) => queryBestBottlesConvex("products:getBySku", { graceSku: sku }),
    fetchProductByWebsiteSku: (websiteSku) => queryBestBottlesConvex("products:getByWebsiteSku", { websiteSku }),
  };
}
