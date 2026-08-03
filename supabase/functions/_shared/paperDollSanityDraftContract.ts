export type SanityLayerInput = {
  componentVersionId: string;
  slot: string;
  variantKey: string;
  imageAssetId: string;
  sourceFilename: string;
  offsetX?: number;
  offsetY?: number;
};

export function resolvePaperDollSanityConfig(get: (key: string) => string | undefined) {
  return {
    projectId: get("BESTBOTTLES_SANITY_PROJECT_ID") ?? get("SANITY_PROJECT_ID") ?? "",
    dataset: get("BESTBOTTLES_SANITY_DATASET") ?? get("SANITY_DATASET") ?? "",
    token: get("BESTBOTTLES_SANITY_WRITE_TOKEN") ?? get("SANITY_API_TOKEN") ?? get("SANITY_WRITE_TOKEN") ?? "",
  };
}

export function buildPaperDollSanityDraftDocument(input: {
  familyKey: "CYL-9ML";
  publicDocumentId: string;
  releaseId: string;
  releaseCutId: string;
  releaseVersion: string;
  manifestSha256: string;
  rendererVersion: string;
  readiness: Array<{ mappingKey: string; websiteSku: string; graceSku: string; status: string; missingReasons: string[] }>;
  layers: SanityLayerInput[];
  placement: unknown;
  syncedAt: string;
}) {
  const complete = input.readiness.filter((row) => row.status === "ready").length;
  const incomplete = input.readiness.length - complete;
  return {
    _id: `drafts.${input.publicDocumentId}`,
    _type: "paperDollFamily",
    familyKey: input.familyKey,
    displayName: "Cylinder · 9 mL · 17-415",
    canvasPreset: "pdp-2080x2288",
    canvasWidth: 2080,
    canvasHeight: 2288,
    pipelineVersion: input.rendererVersion,
    assetRevision: input.releaseId,
    storefrontReady: incomplete === 0 && complete > 0,
    layerOrderRollon: ["body", "roller", "cap"],
    layerOrderSpray: [],
    layerOrderShortcap: [],
    layerOrderLotion: [],
    anchorsJson: JSON.stringify(input.placement),
    releaseId: input.releaseId,
    releaseCutId: input.releaseCutId,
    releaseVersion: input.releaseVersion,
    manifestSha256: input.manifestSha256,
    draftSyncedAt: input.syncedAt,
    readinessSummary: { ready: complete, incomplete, total: input.readiness.length },
    skuReadiness: input.readiness.map((row) => ({ _key: `sku-${row.mappingKey}`, ...row })),
    layerAssets: input.layers.map((layer) => ({
      _key: `layer-${layer.slot}-${layer.variantKey}`,
      slot: layer.slot,
      variantKey: layer.variantKey,
      sourceFilename: layer.sourceFilename,
      image: { _type: "image", asset: { _type: "reference", _ref: layer.imageAssetId } },
      offsetX: layer.offsetX ?? 0,
      offsetY: layer.offsetY ?? 0,
    })),
  };
}
