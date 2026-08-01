import type {
  PaperDollReleaseAsset,
  PaperDollReleaseManifest,
  PaperDollSlot,
} from "./releaseContract";

export interface PaperDollReleaseValidation {
  ready: boolean;
  blockers: string[];
  advisories: string[];
  assetCountBySlot: Partial<Record<PaperDollSlot, number>>;
}

export interface ResolvedPaperDollAssembly {
  mappingKey: string;
  recipeKey: string;
  layers: PaperDollReleaseAsset[];
}

function assetIdentity(slot: PaperDollSlot, variantKey: string): string {
  return `${slot}:${variantKey}`;
}

function selectedVariantForSlot(
  slot: PaperDollSlot,
  mapping: PaperDollReleaseManifest["assemblyMappings"][number],
): string | null {
  if (slot === "body") return mapping.bodyVariantKey;
  if (slot === "cap") return mapping.closureVariantKey;
  if (slot === "overcap") return mapping.overcapVariantKey;
  return mapping.fitmentVariantKey;
}

export function resolvePaperDollAssembly(
  manifest: PaperDollReleaseManifest,
  mappingKey: string,
): ResolvedPaperDollAssembly {
  const mapping = manifest.assemblyMappings.find((entry) => entry.mappingKey === mappingKey);
  if (!mapping) throw new Error(`No assembly mapping '${mappingKey}'.`);

  const recipe = manifest.assemblyRecipes.find((entry) => entry.recipeKey === mapping.recipeKey);
  if (!recipe) throw new Error(`No assembly recipe '${mapping.recipeKey}' for mapping '${mappingKey}'.`);

  const layers = recipe.layerOrder.map((slot) => {
    const variantKey = selectedVariantForSlot(slot, mapping);
    if (!variantKey) {
      throw new Error(`Mapping '${mappingKey}' does not select a variant for slot '${slot}'.`);
    }
    const matching = manifest.assets.filter(
      (asset) => asset.slot === slot && asset.variantKey === variantKey,
    );
    if (matching.length === 0) throw new Error(`Missing asset '${assetIdentity(slot, variantKey)}'.`);
    if (matching.length > 1) throw new Error(`Duplicate asset '${assetIdentity(slot, variantKey)}'.`);
    if (matching[0].approvalStatus !== "approved") {
      throw new Error(
        `Asset '${assetIdentity(slot, variantKey)}' is '${matching[0].approvalStatus}', not approved.`,
      );
    }
    return matching[0];
  });

  return { mappingKey, recipeKey: recipe.recipeKey, layers };
}

export function validatePaperDollRelease(
  manifest: PaperDollReleaseManifest,
): PaperDollReleaseValidation {
  const blockers = [...manifest.blockers];
  const advisories: string[] = [];
  const assetCountBySlot: Partial<Record<PaperDollSlot, number>> = {};
  const assetKeys = new Set<string>();

  for (const asset of manifest.assets) {
    assetCountBySlot[asset.slot] = (assetCountBySlot[asset.slot] ?? 0) + 1;
    const key = assetIdentity(asset.slot, asset.variantKey);
    if (assetKeys.has(key)) blockers.push(`duplicate_asset:${key}`);
    assetKeys.add(key);

    if (asset.materialVariant === "translucent-frosted" && asset.approvalStatus !== "rejected") {
      blockers.push(`assembly_context_required:${asset.componentVersionId}`);
    }
  }

  const approvedOpaqueCaps = manifest.assets.filter(
    (asset) => asset.slot === "cap" &&
      asset.approvalStatus === "approved" &&
      asset.materialVariant !== "translucent-frosted",
  );
  const maskHashes = new Set<string>();
  const geometryFamilies = new Set<string>();
  for (const asset of approvedOpaqueCaps) {
    if (!asset.geometryMaskPath || !asset.geometryMaskSha256) {
      blockers.push(`missing_geometry_mask:${asset.componentVersionId}`);
      continue;
    }
    maskHashes.add(asset.geometryMaskSha256);
    geometryFamilies.add(asset.geometryFamilyId);
  }
  if (maskHashes.size > 1) blockers.push("closure_geometry_mask_mismatch");
  if (geometryFamilies.size > 1) blockers.push("closure_geometry_family_mismatch");

  const mappingKeys = new Set<string>();
  const websiteSkus = new Set<string>();
  for (const mapping of manifest.assemblyMappings) {
    if (mappingKeys.has(mapping.mappingKey)) blockers.push(`duplicate_mapping:${mapping.mappingKey}`);
    mappingKeys.add(mapping.mappingKey);
    if (websiteSkus.has(mapping.websiteSku)) blockers.push(`duplicate_website_sku:${mapping.websiteSku}`);
    websiteSkus.add(mapping.websiteSku);
    try {
      resolvePaperDollAssembly(manifest, mapping.mappingKey);
    } catch (error) {
      blockers.push(
        error instanceof Error
          ? error.message
              .replace(/^Missing asset '([^']+)'.$/, "missing_asset:$1")
              .replace(/^Duplicate asset '([^']+)'.$/, "duplicate_asset:$1")
          : `assembly_resolution_failed:${mapping.mappingKey}`,
      );
    }
  }

  for (const evidence of manifest.qaEvidence) {
    if (evidence.blocking && evidence.calibratedWith.length === 0) {
      blockers.push(`uncalibrated_gate:${evidence.gateKey}`);
    }
    if (evidence.blocking && evidence.status !== "passed") {
      blockers.push(`blocking_gate_${evidence.status}:${evidence.gateKey}`);
    }
    if (!evidence.blocking && evidence.status !== "passed") {
      advisories.push(`advisory_gate_${evidence.status}:${evidence.gateKey}`);
    }
  }

  const uniqueBlockers = [...new Set(blockers)];
  return {
    ready: uniqueBlockers.length === 0,
    blockers: uniqueBlockers,
    advisories: [...new Set(advisories)],
    assetCountBySlot,
  };
}
