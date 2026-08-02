export type BestBottlesWebsiteTruthStatus =
  | "ready"
  | "needs_website_check"
  | "truth_conflict"
  | "alias_exception"
  | "component_lane";

export interface BestBottlesWebsiteTruthRow {
  truthStatus: BestBottlesWebsiteTruthStatus;
  truthStatusLabel: string;
  severity: string;
  issueTypes: string;
  commercialLane?: "pdp" | "component";
  websiteSku: string;
  graceSku: string;
  convexGraceSku: string;
  expectedFamily: string;
  convexFamily: string;
  sourceCategory?: string;
  productGroupSlug: string;
  liveEvidenceStatus: string;
  liveWebsiteSkuPresent: string;
  liveFamily: string;
  liveConfiguration: string;
  liveSourceUrl: string;
  liveFinalUrl: string;
}

interface BestBottlesWebsiteTruthData {
  generatedAt: string;
  sourceOfTruth: string;
  rows: BestBottlesWebsiteTruthRow[];
}

let truthDataPromise: Promise<BestBottlesWebsiteTruthData | null> | null = null;

async function loadTruthData(): Promise<BestBottlesWebsiteTruthData | null> {
  if (!truthDataPromise) {
    truthDataPromise = fetch("/data/best-bottles-website-truth-status.json").then(
      async (response) => {
        if (response.status === 404) return null;
        if (!response.ok) {
          throw new Error(`Unable to load Best Bottles website truth status (${response.status}).`);
        }
        return response.json() as Promise<BestBottlesWebsiteTruthData>;
      },
    );
  }
  return truthDataPromise;
}

export async function getBestBottlesWebsiteTruthRow(
  graceSku: string,
): Promise<BestBottlesWebsiteTruthRow | null> {
  const normalizedSku = graceSku.trim().toUpperCase();
  if (!normalizedSku) return null;
  const data = await loadTruthData();
  return (
    data?.rows.find((row) => row.graceSku.trim().toUpperCase() === normalizedSku) ?? null
  );
}

const BEST_BOTTLES_COMPATIBLE_FAMILY_ALIASES = new Set([
  "spray bottle::cylinder",
  "tall cylinder::cylinder",
]);

const BEST_BOTTLES_TAXONOMY_ALIAS_ISSUES = new Set([
  "convex_family_mismatch_with_website_sku",
  "product_group_slug_family_mismatch",
  "source_family_conflicts_with_website_sku",
  "grace_prefix_alias_exception",
]);

function normalizeTruthValue(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function normalizeTruthSku(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase();
}

export function getEffectiveBestBottlesWebsiteTruthStatus(
  row: BestBottlesWebsiteTruthRow | null,
): BestBottlesWebsiteTruthStatus | null {
  if (!row) return null;
  if (row.truthStatus !== "truth_conflict") return row.truthStatus;
  if (row.commercialLane !== "pdp") return row.truthStatus;

  const graceSku = normalizeTruthSku(row.graceSku);
  const convexGraceSku = normalizeTruthSku(row.convexGraceSku);
  const websiteSku = normalizeTruthSku(row.websiteSku);
  if (!graceSku || !convexGraceSku || !websiteSku || graceSku !== convexGraceSku) {
    return row.truthStatus;
  }

  const expectedFamily = normalizeTruthValue(row.expectedFamily);
  const convexFamily = normalizeTruthValue(row.convexFamily);
  if (!BEST_BOTTLES_COMPATIBLE_FAMILY_ALIASES.has(`${expectedFamily}::${convexFamily}`)) {
    return row.truthStatus;
  }
  if (normalizeTruthValue(row.sourceCategory) !== "glass bottle") {
    return row.truthStatus;
  }

  const convexFamilySlug = convexFamily.replace(/[^a-z0-9]+/g, "-");
  const productGroupSlug = normalizeTruthValue(row.productGroupSlug);
  if (!convexFamilySlug || !productGroupSlug.startsWith(`${convexFamilySlug}-`)) {
    return row.truthStatus;
  }

  const issues = row.issueTypes
    .split(";")
    .map((issue) => issue.trim())
    .filter(Boolean);
  if (
    !issues.includes("convex_family_mismatch_with_website_sku") ||
    issues.some((issue) => !BEST_BOTTLES_TAXONOMY_ALIAS_ISSUES.has(issue))
  ) {
    return row.truthStatus;
  }

  return "alias_exception";
}

export function getBestBottlesWebsiteTruthBlocker(
  row: BestBottlesWebsiteTruthRow | null,
): string | null {
  if (!row) return "No website-truth audit row exists for this Grace SKU.";
  if (row.commercialLane === "component" || row.truthStatus === "component_lane") {
    return "This SKU is classified as a component asset, not a canonical PDP product.";
  }

  const effectiveStatus = getEffectiveBestBottlesWebsiteTruthStatus(row);
  if (effectiveStatus === "truth_conflict" || effectiveStatus === "needs_website_check") {
    const details = row.issueTypes
      .split(";")
      .map((issue) => issue.trim())
      .filter(Boolean)
      .join(", ");
    return `${row.truthStatusLabel}: ${details || "website/catalog identity requires review"}.`;
  }
  return null;
}
