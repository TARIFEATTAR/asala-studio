export type BestBottlesDarkroomAssetStatus =
  | "not-darkroom-workflow"
  | "unassigned"
  | "needs-product-match"
  | "sku-bound-candidate"
  | "approved"
  | "ready-to-push"
  | "concept"
  | "rejected"
  | "truth-conflict";

export type BestBottlesDarkroomIdentityStatus =
  | "unknown"
  | "needs-product-match"
  | "matched"
  | "truth-conflict";

export type BestBottlesDarkroomAllowedAction =
  | "attach-to-product"
  | "visual-qa"
  | "keep-as-concept"
  | "reject";

export interface BestBottlesDarkroomAssetWorkflowInput {
  libraryTags?: readonly string[] | null;
  brandContextUsed?: unknown;
  hasWebsiteSku?: boolean;
  hasGraceSku?: boolean;
  hasVerifiedProductMatch?: boolean;
}

export interface BestBottlesDarkroomAssetWorkflow {
  status: BestBottlesDarkroomAssetStatus;
  identityStatus: BestBottlesDarkroomIdentityStatus;
  pushBlocked: boolean;
  allowedActions: BestBottlesDarkroomAllowedAction[];
}

export const BEST_BOTTLES_DARKROOM_ASSET_TAG_SOURCE = "source:darkroom-generated" as const;
export const BEST_BOTTLES_DARKROOM_INTENDED_USE_PDP_CANDIDATE = "intended-use:pdp-candidate" as const;
export const BEST_BOTTLES_DARKROOM_STATUS_TAG_UNASSIGNED = "asset-status:unassigned" as const;
export const BEST_BOTTLES_DARKROOM_STATUS_TAG_NEEDS_PRODUCT_MATCH = "asset-status:needs-product-match" as const;
export const BEST_BOTTLES_DARKROOM_STATUS_TAG_SKU_BOUND_CANDIDATE = "asset-status:sku-bound-candidate" as const;
export const BEST_BOTTLES_DARKROOM_STATUS_TAG_APPROVED = "asset-status:approved" as const;
export const BEST_BOTTLES_DARKROOM_STATUS_TAG_READY_TO_PUSH = "asset-status:ready-to-push" as const;
export const BEST_BOTTLES_DARKROOM_STATUS_TAG_CONCEPT = "asset-status:concept" as const;
export const BEST_BOTTLES_DARKROOM_STATUS_TAG_REJECTED = "asset-status:rejected" as const;
export const BEST_BOTTLES_DARKROOM_STATUS_TAG_TRUTH_CONFLICT = "asset-status:truth-conflict" as const;
export const BEST_BOTTLES_DARKROOM_IDENTITY_TAG_NEEDS_PRODUCT_MATCH = "identity-status:needs-product-match" as const;
export const BEST_BOTTLES_DARKROOM_IDENTITY_TAG_MATCHED = "identity-status:matched" as const;
export const BEST_BOTTLES_DARKROOM_IDENTITY_TAG_TRUTH_CONFLICT = "identity-status:truth-conflict" as const;
export const BEST_BOTTLES_DARKROOM_PUSH_BLOCKED_TAG = "push-blocked:true" as const;

export const BEST_BOTTLES_DARKROOM_UNASSIGNED_TAGS = [
  BEST_BOTTLES_DARKROOM_ASSET_TAG_SOURCE,
  BEST_BOTTLES_DARKROOM_INTENDED_USE_PDP_CANDIDATE,
  BEST_BOTTLES_DARKROOM_STATUS_TAG_UNASSIGNED,
  BEST_BOTTLES_DARKROOM_IDENTITY_TAG_NEEDS_PRODUCT_MATCH,
  BEST_BOTTLES_DARKROOM_PUSH_BLOCKED_TAG,
] as const;

export const BEST_BOTTLES_DARKROOM_SKU_BOUND_CANDIDATE_TAGS = [
  BEST_BOTTLES_DARKROOM_ASSET_TAG_SOURCE,
  BEST_BOTTLES_DARKROOM_INTENDED_USE_PDP_CANDIDATE,
  BEST_BOTTLES_DARKROOM_STATUS_TAG_SKU_BOUND_CANDIDATE,
  BEST_BOTTLES_DARKROOM_IDENTITY_TAG_MATCHED,
] as const;

const STATUS_TAG_TO_STATUS: Record<string, BestBottlesDarkroomAssetStatus> = {
  [BEST_BOTTLES_DARKROOM_STATUS_TAG_UNASSIGNED]: "unassigned",
  [BEST_BOTTLES_DARKROOM_STATUS_TAG_NEEDS_PRODUCT_MATCH]: "needs-product-match",
  [BEST_BOTTLES_DARKROOM_STATUS_TAG_SKU_BOUND_CANDIDATE]: "sku-bound-candidate",
  [BEST_BOTTLES_DARKROOM_STATUS_TAG_APPROVED]: "approved",
  [BEST_BOTTLES_DARKROOM_STATUS_TAG_READY_TO_PUSH]: "ready-to-push",
  [BEST_BOTTLES_DARKROOM_STATUS_TAG_CONCEPT]: "concept",
  [BEST_BOTTLES_DARKROOM_STATUS_TAG_REJECTED]: "rejected",
  [BEST_BOTTLES_DARKROOM_STATUS_TAG_TRUTH_CONFLICT]: "truth-conflict",
};

const IDENTITY_TAG_TO_STATUS: Record<string, BestBottlesDarkroomIdentityStatus> = {
  [BEST_BOTTLES_DARKROOM_IDENTITY_TAG_NEEDS_PRODUCT_MATCH]: "needs-product-match",
  [BEST_BOTTLES_DARKROOM_IDENTITY_TAG_MATCHED]: "matched",
  [BEST_BOTTLES_DARKROOM_IDENTITY_TAG_TRUTH_CONFLICT]: "truth-conflict",
};

function normalizedTags(tags: readonly string[] | null | undefined): string[] {
  return (tags ?? [])
    .map((tag) => String(tag ?? "").trim())
    .filter(Boolean);
}

function lowerTags(tags: readonly string[] | null | undefined): Set<string> {
  return new Set(normalizedTags(tags).map((tag) => tag.toLowerCase()));
}

function brandContextSource(value: unknown): string {
  return value && typeof value === "object"
    ? String((value as Record<string, unknown>).source ?? "").trim().toLowerCase()
    : "";
}

function inferExplicitStatus(tags: Set<string>): BestBottlesDarkroomAssetStatus | null {
  if (tags.has(BEST_BOTTLES_DARKROOM_STATUS_TAG_TRUTH_CONFLICT)) return "truth-conflict";
  if (tags.has(BEST_BOTTLES_DARKROOM_STATUS_TAG_REJECTED)) return "rejected";
  if (tags.has(BEST_BOTTLES_DARKROOM_STATUS_TAG_CONCEPT)) return "concept";
  if (tags.has(BEST_BOTTLES_DARKROOM_STATUS_TAG_READY_TO_PUSH)) return "ready-to-push";
  if (tags.has(BEST_BOTTLES_DARKROOM_STATUS_TAG_APPROVED)) return "approved";
  if (tags.has(BEST_BOTTLES_DARKROOM_STATUS_TAG_UNASSIGNED)) return "unassigned";
  if (tags.has(BEST_BOTTLES_DARKROOM_STATUS_TAG_NEEDS_PRODUCT_MATCH)) return "needs-product-match";
  if (tags.has(BEST_BOTTLES_DARKROOM_STATUS_TAG_SKU_BOUND_CANDIDATE)) return "sku-bound-candidate";
  for (const tag of tags) {
    const status = STATUS_TAG_TO_STATUS[tag];
    if (status) return status;
  }
  return null;
}

function inferIdentityStatus(
  tags: Set<string>,
  hasCommercialSku: boolean,
  hasVerifiedProductMatch: boolean,
): BestBottlesDarkroomIdentityStatus {
  if (tags.has(BEST_BOTTLES_DARKROOM_IDENTITY_TAG_TRUTH_CONFLICT)) return "truth-conflict";
  if (hasCommercialSku && hasVerifiedProductMatch) return "matched";
  if (tags.has(BEST_BOTTLES_DARKROOM_IDENTITY_TAG_NEEDS_PRODUCT_MATCH)) return "needs-product-match";
  if (tags.has(BEST_BOTTLES_DARKROOM_IDENTITY_TAG_MATCHED)) {
    return hasVerifiedProductMatch ? "matched" : "needs-product-match";
  }
  if (!hasCommercialSku || !hasVerifiedProductMatch) return "needs-product-match";
  return "matched";
}

function isDarkroomWorkflow(input: BestBottlesDarkroomAssetWorkflowInput, tags: Set<string>): boolean {
  return (
    tags.has(BEST_BOTTLES_DARKROOM_ASSET_TAG_SOURCE) ||
    tags.has(BEST_BOTTLES_DARKROOM_INTENDED_USE_PDP_CANDIDATE) ||
    tags.has(BEST_BOTTLES_DARKROOM_PUSH_BLOCKED_TAG) ||
    [...tags].some((tag) => tag.startsWith("asset-status:") || tag.startsWith("identity-status:")) ||
    brandContextSource(input.brandContextUsed) === "darkroom-generated"
  );
}

function allowedActionsFor(status: BestBottlesDarkroomAssetStatus): BestBottlesDarkroomAllowedAction[] {
  if (status === "not-darkroom-workflow" || status === "rejected") return [];
  if (status === "sku-bound-candidate" || status === "approved" || status === "ready-to-push") {
    return ["visual-qa", "keep-as-concept", "reject"];
  }
  return ["attach-to-product", "keep-as-concept", "reject"];
}

export function getBestBottlesDarkroomAssetWorkflow(
  input: BestBottlesDarkroomAssetWorkflowInput,
): BestBottlesDarkroomAssetWorkflow {
  const tags = lowerTags(input.libraryTags);
  if (!isDarkroomWorkflow(input, tags)) {
    return {
      status: "not-darkroom-workflow",
      identityStatus: "unknown",
      pushBlocked: false,
      allowedActions: [],
    };
  }

  const hasCommercialSku = Boolean(input.hasWebsiteSku || input.hasGraceSku);
  const hasVerifiedProductMatch = Boolean(input.hasVerifiedProductMatch);
  const identityStatus = inferIdentityStatus(tags, hasCommercialSku, hasVerifiedProductMatch);
  const explicitStatus = inferExplicitStatus(tags);
  let status: BestBottlesDarkroomAssetStatus =
    explicitStatus ?? (hasCommercialSku ? "sku-bound-candidate" : "unassigned");

  if (
    identityStatus === "matched" &&
    (status === "unassigned" || status === "needs-product-match")
  ) {
    status = "sku-bound-candidate";
  }
  if (status === "sku-bound-candidate" && identityStatus !== "matched") {
    status = "needs-product-match";
  }
  if (identityStatus === "truth-conflict") {
    status = "truth-conflict";
  }

  const pushBlocked =
    status === "unassigned" ||
    status === "needs-product-match" ||
    status === "concept" ||
    status === "rejected" ||
    status === "truth-conflict" ||
    identityStatus !== "matched";

  return {
    status,
    identityStatus,
    pushBlocked,
    allowedActions: allowedActionsFor(status),
  };
}

export function isBestBottlesDarkroomPushBlocked(
  workflow: BestBottlesDarkroomAssetWorkflow | BestBottlesDarkroomAssetWorkflowInput,
): boolean {
  return "pushBlocked" in workflow
    ? workflow.pushBlocked
    : getBestBottlesDarkroomAssetWorkflow(workflow).pushBlocked;
}
