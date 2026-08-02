import type {
  PaperDollReleaseAsset,
  PaperDollReleaseManifest,
  PaperDollSlot,
} from "@/lib/paperDoll/releaseContract";
import type {
  ReleaseWorkbenchState,
  ReleaseWorkbenchStatusFilter,
} from "./releaseWorkbenchState";

export interface CatalogSkuIdentity {
  graceSku: string;
  websiteSku: string;
}

export interface MatrixRow {
  requirementKey: string;
  system: string;
  role: PaperDollSlot;
  variantKey: string;
  finish: string;
  componentVersionId: string;
  parentVersionId: null;
  approvalStatus: PaperDollReleaseAsset["approvalStatus"];
  qaStatus: "passed" | "failed" | "advisory" | "blocked" | "not-recorded";
  lifecycleStatus: ReleaseWorkbenchStatusFilter;
  inRelease: true;
  published: boolean;
  blockers: string[];
  nextAction: string;
  sha256: string;
}

export interface MatrixModel {
  rows: MatrixRow[];
  summary: {
    required: number;
    approved: number;
    blocked: number;
    inRelease: number;
    published: number;
  };
  catalogReconciliation: {
    catalogProducts: number;
    mappedProducts: number;
    previewMappings: number;
    unmatchedProducts: number;
  };
}

function normalizedSku(value: string | null | undefined): string | null {
  const normalized = value?.trim().toUpperCase() ?? "";
  return normalized || null;
}

function systemForAsset(manifest: PaperDollReleaseManifest, asset: PaperDollReleaseAsset): string {
  if (asset.slot === "body") return "body";
  const modes = new Set(
    manifest.assemblyRecipes
      .filter((recipe) => recipe.layerOrder.includes(asset.slot))
      .map((recipe) => recipe.mode),
  );
  return modes.size === 1 ? [...modes][0] : "unresolved";
}

function qaForAsset(manifest: PaperDollReleaseManifest, asset: PaperDollReleaseAsset) {
  const evidence = manifest.qaEvidence.filter(
    (item) => item.subjectId === asset.componentVersionId || item.subjectId === asset.geometryFamilyId,
  );
  if (evidence.length === 0) return { status: "not-recorded" as const, blockers: [] as string[] };
  const blocking = evidence.find((item) => item.blocking && item.status !== "passed");
  if (blocking) return { status: blocking.status, blockers: blocking.issues };
  const failed = evidence.find((item) => item.status !== "passed");
  return failed
    ? { status: failed.status, blockers: failed.issues }
    : { status: "passed" as const, blockers: [] as string[] };
}

function lifecycleForAsset(
  manifest: PaperDollReleaseManifest,
  asset: PaperDollReleaseAsset,
): ReleaseWorkbenchStatusFilter {
  if (manifest.status === "published" && asset.approvalStatus === "approved") return "published";
  if (asset.approvalStatus === "blocked") return "blocked";
  if (asset.approvalStatus === "candidate") return "candidate";
  if (asset.approvalStatus === "rejected") return "rejected";
  return "in-release";
}

function nextActionForAsset(asset: PaperDollReleaseAsset, blockers: string[]): string {
  if (asset.approvalStatus === "blocked") {
    return blockers.length > 0 ? blockers.join(", ") : "Resolve blocking QA and create a new component version";
  }
  if (asset.approvalStatus === "candidate") return "Run calibrated component QA";
  if (asset.approvalStatus === "rejected") return "Create a superseding component version";
  return "Resolve family blockers before named release approval";
}

export function buildMatrixModel(
  manifest: PaperDollReleaseManifest,
  catalogProducts: readonly CatalogSkuIdentity[],
): MatrixModel {
  const rows = manifest.assets.map((asset): MatrixRow => {
    const qa = qaForAsset(manifest, asset);
    return {
      requirementKey: `${asset.slot}:${asset.variantKey}`,
      system: systemForAsset(manifest, asset),
      role: asset.slot,
      variantKey: asset.variantKey,
      finish: asset.materialVariant,
      componentVersionId: asset.componentVersionId,
      parentVersionId: null,
      approvalStatus: asset.approvalStatus,
      qaStatus: qa.status,
      lifecycleStatus: lifecycleForAsset(manifest, asset),
      inRelease: true,
      published: manifest.status === "published" && asset.approvalStatus === "approved",
      blockers: qa.blockers,
      nextAction: nextActionForAsset(asset, qa.blockers),
      sha256: asset.imageSha256,
    };
  });

  const mappingSkuSets = manifest.assemblyMappings.map((mapping) => new Set(
    [normalizedSku(mapping.graceSku), normalizedSku(mapping.websiteSku)].filter(Boolean),
  ));
  const mappedProducts = catalogProducts.filter((product) => {
    const identities = [normalizedSku(product.graceSku), normalizedSku(product.websiteSku)].filter(Boolean);
    return mappingSkuSets.some((mappingSkus) => identities.some((identity) => mappingSkus.has(identity)));
  }).length;
  const previewMappings = manifest.assemblyMappings.filter((mapping) =>
    [mapping.graceSku, mapping.websiteSku].some((value) => normalizedSku(value)?.startsWith("PREVIEW-")),
  ).length;

  return {
    rows,
    summary: {
      required: rows.length,
      approved: rows.filter((row) => row.approvalStatus === "approved").length,
      blocked: rows.filter((row) => row.lifecycleStatus === "blocked").length,
      inRelease: rows.filter((row) => row.inRelease).length,
      published: rows.filter((row) => row.published).length,
    },
    catalogReconciliation: {
      catalogProducts: catalogProducts.length,
      mappedProducts,
      previewMappings,
      unmatchedProducts: catalogProducts.length - mappedProducts,
    },
  };
}

export function filterMatrixRows(
  rows: readonly MatrixRow[],
  filters: ReleaseWorkbenchState["filters"],
): MatrixRow[] {
  return rows.filter((row) =>
    (!filters.system || row.system === filters.system) &&
    (!filters.role || row.role === filters.role) &&
    (!filters.finish || row.finish === filters.finish) &&
    (!filters.status || row.lifecycleStatus === filters.status),
  );
}
