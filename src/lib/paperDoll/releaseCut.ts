import {
  canonicalizeReleaseValue,
  parsePaperDollReleaseManifest,
  type PaperDollReleaseAsset,
  type PaperDollReleaseManifest,
} from "./releaseContract";

export interface PaperDollUnresolvedCatalogMapping {
  mappingKey: string;
  issue: string;
}

export interface PaperDollReleaseCut {
  cutId: string;
  familyKey: string;
  releaseVersion: string;
  manifestSha256: string;
  componentVersionIds: string[];
  placementVersionIds: string[];
  resolvedCatalogMappingKeys: string[];
  unresolvedCatalogMappings: PaperDollUnresolvedCatalogMapping[];
  manifest: PaperDollReleaseManifest;
}

export interface PaperDollReleaseHead {
  familyKey: string;
  currentReleaseCutId: string;
  revision: number;
}

async function sha256Text(value: string): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error("Web Crypto SHA-256 is unavailable.");
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function requireImmutableAssets(assets: PaperDollReleaseAsset[]): void {
  for (const asset of assets) {
    if (asset.approvalStatus !== "approved") {
      throw new Error(
        `Release cuts require an approved immutable component version; ${asset.componentVersionId} is ${asset.approvalStatus}.`,
      );
    }
    if (asset.slot === "body") continue;
    if (!asset.candidateId || !asset.placementVersionId) {
      throw new Error(
        `Release cuts require an approved immutable candidate and placement for ${asset.componentVersionId}.`,
      );
    }
    if (
      !asset.sourceBoundsPx ||
      !asset.editBoundsPx ||
      !asset.authorityBoundsPx ||
      !asset.placementBoundsPx
    ) {
      throw new Error(`Release asset ${asset.componentVersionId} is missing four-box provenance.`);
    }
  }

  const placementIdsByGeometry = new Map<string, Set<string>>();
  for (const asset of assets) {
    if (asset.slot === "body" || !asset.placementVersionId) continue;
    const ids = placementIdsByGeometry.get(asset.geometryFamilyId) ?? new Set<string>();
    ids.add(asset.placementVersionId);
    placementIdsByGeometry.set(asset.geometryFamilyId, ids);
  }
  for (const [geometryFamilyId, ids] of placementIdsByGeometry) {
    if (ids.size > 1) {
      throw new Error(
        `Release cut contains mixed placement versions for geometry family ${geometryFamilyId}.`,
      );
    }
  }
}

function mappingIssue(
  manifest: PaperDollReleaseManifest,
  mapping: PaperDollReleaseManifest["assemblyMappings"][number],
): string | null {
  const recipe = manifest.assemblyRecipes.find((row) => row.recipeKey === mapping.recipeKey);
  if (!recipe) return `recipe_missing:${mapping.recipeKey}`;

  const requirements: Array<{ slot: PaperDollReleaseAsset["slot"]; variantKey: string | null }> = [
    { slot: "body", variantKey: mapping.bodyVariantKey },
    { slot: "cap", variantKey: mapping.closureVariantKey },
    { slot: "overcap", variantKey: mapping.overcapVariantKey },
  ];
  const fitmentSlot = recipe.layerOrder.find((slot) =>
    slot === "roller" || slot === "sprayer" || slot === "pump"
  );
  if (mapping.fitmentVariantKey && fitmentSlot) {
    requirements.push({ slot: fitmentSlot, variantKey: mapping.fitmentVariantKey });
  } else if (mapping.fitmentVariantKey && !fitmentSlot) {
    return `fitment_slot_missing:${mapping.fitmentVariantKey}`;
  }

  for (const requirement of requirements) {
    if (!requirement.variantKey) continue;
    const match = manifest.assets.find((asset) =>
      asset.slot === requirement.slot &&
      asset.variantKey === requirement.variantKey &&
      asset.approvalStatus === "approved"
    );
    if (!match) return `asset_missing:${requirement.slot}:${requirement.variantKey}`;
  }
  return null;
}

export async function buildReleaseCut(input: {
  manifest: PaperDollReleaseManifest;
}): Promise<PaperDollReleaseCut> {
  const manifest = parsePaperDollReleaseManifest(input.manifest);
  requireImmutableAssets(manifest.assets);

  const manifestSha256 = await sha256Text(canonicalizeReleaseValue(manifest));
  const componentVersionIds = manifest.assets
    .map((asset) => asset.componentVersionId)
    .sort((a, b) => a.localeCompare(b));
  const placementVersionIds = [...new Set(
    manifest.assets.flatMap((asset) => asset.placementVersionId ? [asset.placementVersionId] : []),
  )].sort((a, b) => a.localeCompare(b));
  const identitySha256 = await sha256Text(canonicalizeReleaseValue({
    familyKey: manifest.familyKey,
    releaseVersion: manifest.releaseVersion,
    manifestSha256,
    componentVersionIds,
    placementVersionIds,
  }));

  const resolvedCatalogMappingKeys: string[] = [];
  const unresolvedCatalogMappings: PaperDollUnresolvedCatalogMapping[] = [];
  for (const mapping of [...manifest.assemblyMappings].sort((a, b) =>
    a.mappingKey.localeCompare(b.mappingKey)
  )) {
    const issue = mappingIssue(manifest, mapping);
    if (issue) unresolvedCatalogMappings.push({ mappingKey: mapping.mappingKey, issue });
    else resolvedCatalogMappingKeys.push(mapping.mappingKey);
  }

  return {
    cutId: `cut-${manifest.familyKey.toLowerCase()}-${identitySha256.slice(0, 24)}`,
    familyKey: manifest.familyKey,
    releaseVersion: manifest.releaseVersion,
    manifestSha256,
    componentVersionIds,
    placementVersionIds,
    resolvedCatalogMappingKeys,
    unresolvedCatalogMappings,
    manifest,
  };
}

export function advanceReleaseHead(
  current: PaperDollReleaseHead | null,
  cut: PaperDollReleaseCut,
  expectedRevision: number,
): PaperDollReleaseHead {
  if (current?.currentReleaseCutId === cut.cutId) return current;
  const actualRevision = current?.revision ?? 0;
  if (actualRevision !== expectedRevision) {
    throw new Error(
      `Current Release revision changed: expected ${expectedRevision}, received ${actualRevision}.`,
    );
  }
  if (current && current.familyKey !== cut.familyKey) {
    throw new Error(`Release head family ${current.familyKey} does not match cut ${cut.familyKey}.`);
  }
  return {
    familyKey: cut.familyKey,
    currentReleaseCutId: cut.cutId,
    revision: actualRevision + 1,
  };
}
