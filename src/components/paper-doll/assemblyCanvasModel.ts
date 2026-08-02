import type {
  PaperDollReleaseAsset,
  PaperDollReleaseManifest,
} from "@/lib/paperDoll/releaseContract";
import { resolveWorkbenchAssembly } from "@/lib/paperDoll/workbenchModel";

export interface CanvasPercentPoint { x: number; y: number }
export interface CanvasPercentBounds { left: number; top: number; width: number; height: number }

export interface AssemblyCanvasLayer extends PaperDollReleaseAsset {
  imageUrl: string;
  geometryMaskUrl: string | null;
  boundsPct: CanvasPercentBounds;
}

export interface AssemblyCanvasModel {
  mapping: PaperDollReleaseManifest["assemblyMappings"][number];
  recipeKey: string;
  layers: AssemblyCanvasLayer[];
  centerlinePct: number;
  baselinePct: number;
}

export function canvasPointToPercent(
  point: { x: number; y: number },
  canvas: PaperDollReleaseManifest["canvas"],
): CanvasPercentPoint {
  return {
    x: (point.x / canvas.widthPx) * 100,
    y: (point.y / canvas.heightPx) * 100,
  };
}

export function boundsToCanvasPercent(
  bounds: PaperDollReleaseAsset["alphaBounds"],
  canvas: PaperDollReleaseManifest["canvas"],
): CanvasPercentBounds {
  return {
    left: (bounds.left / canvas.widthPx) * 100,
    top: (bounds.top / canvas.heightPx) * 100,
    width: ((bounds.right - bounds.left + 1) / canvas.widthPx) * 100,
    height: ((bounds.bottom - bounds.top + 1) / canvas.heightPx) * 100,
  };
}

function requireUrl(urls: Readonly<Record<string, string>>, path: string): string {
  const url = urls[path];
  if (!url) throw new Error(`Missing browser URL for '${path}'.`);
  return url;
}

export function buildAssemblyCanvasModel(
  manifest: PaperDollReleaseManifest,
  mappingKey: string,
  assetUrlsByPath: Readonly<Record<string, string>>,
): AssemblyCanvasModel {
  const mapping = manifest.assemblyMappings.find((entry) => entry.mappingKey === mappingKey);
  if (!mapping) throw new Error(`No assembly mapping '${mappingKey}'.`);
  const resolved = resolveWorkbenchAssembly(manifest, mappingKey);
  const body = resolved.layers.find((layer) => layer.slot === "body");
  if (!body) throw new Error(`Assembly mapping '${mappingKey}' has no body layer.`);
  return {
    mapping,
    recipeKey: resolved.recipeKey,
    layers: resolved.layers.map((layer) => ({
      ...layer,
      imageUrl: requireUrl(assetUrlsByPath, layer.imagePath),
      geometryMaskUrl: layer.geometryMaskPath
        ? requireUrl(assetUrlsByPath, layer.geometryMaskPath)
        : null,
      boundsPct: boundsToCanvasPercent(layer.alphaBounds, manifest.canvas),
    })),
    centerlinePct: canvasPointToPercent(
      { x: body.mountAxisXPx, y: 0 },
      manifest.canvas,
    ).x,
    baselinePct: canvasPointToPercent(
      { x: 0, y: body.seatYPx },
      manifest.canvas,
    ).y,
  };
}
