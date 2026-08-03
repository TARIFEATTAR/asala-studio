import type {
  PaperDollReleaseAsset,
  PaperDollReleaseManifest,
} from "./releaseContract";
import { resolvePaperDollAssembly } from "./releaseValidator";

export const CYL9_RELEASE_WORKBENCH_SLUG = "cylinder-9ml-frosted-17-415-rollon";

export const CYL9_RELEASE_WORKBENCH_SLUGS = new Set([
  "cylinder-9ml-amber-17-415-rollon",
  "cylinder-9ml-cobalt-blue-17-415-rollon",
  "cylinder-9ml-clear-17-415-rollon",
  "cylinder-9ml-frosted-17-415-rollon",
  "cylinder-9ml-swirl-17-415-rollon",
]);

export type GeometryVerification = "geometry-locked" | "shared-mask" | "not-verified";

export interface ReleaseInventorySystem {
  key: PaperDollReleaseManifest["assemblyRecipes"][number]["mode"];
  label: string;
  components: PaperDollReleaseAsset[];
}

export interface ReleaseInventory {
  bodies: PaperDollReleaseAsset[];
  systems: ReleaseInventorySystem[];
}

export interface ReleaseLifecycleCounts {
  assets: {
    required: number;
    approved: number;
    blocked: number;
    candidate: number;
    rejected: number;
    published: number;
  };
  assemblies: {
    required: number;
    resolvable: number;
    blocked: number;
    published: number;
  };
}

export interface PercentBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface WorkbenchLineupLayer extends PaperDollReleaseAsset {
  boundsPct: PercentBounds;
}

export interface WorkbenchLineupItem {
  mappingKey: string;
  websiteSku: string;
  graceSku: string;
  recipeKey: string;
  layers: WorkbenchLineupLayer[];
  overlay: {
    canvasWidthPx: number;
    canvasHeightPx: number;
    centerlinePct: number;
    baselinePct: number;
  };
}

const SYSTEM_LABELS: Record<ReleaseInventorySystem["key"], string> = {
  rollon: "Roll-on",
  spray: "Fine-mist spray",
  lotion: "Lotion pump",
  closure: "Closure / reducer",
};

export function isCyl9ReleaseWorkbenchGroup(groupSlug: string | null | undefined): boolean {
  return Boolean(groupSlug && CYL9_RELEASE_WORKBENCH_SLUGS.has(groupSlug));
}

function systemForAsset(
  manifest: PaperDollReleaseManifest,
  asset: PaperDollReleaseAsset,
): ReleaseInventorySystem["key"] | null {
  const modes = new Set(
    manifest.assemblyRecipes
      .filter((recipe) => recipe.layerOrder.includes(asset.slot))
      .map((recipe) => recipe.mode),
  );
  if (modes.size !== 1) return null;
  return [...modes][0];
}

export function buildReleaseInventory(manifest: PaperDollReleaseManifest): ReleaseInventory {
  const bodies = manifest.assets.filter((asset) => asset.slot === "body");
  const systemsByKey = new Map<ReleaseInventorySystem["key"], PaperDollReleaseAsset[]>();
  for (const asset of manifest.assets) {
    if (asset.slot === "body") continue;
    const system = systemForAsset(manifest, asset);
    if (!system) continue;
    const existing = systemsByKey.get(system) ?? [];
    existing.push(asset);
    systemsByKey.set(system, existing);
  }
  return {
    bodies,
    systems: [...systemsByKey.entries()].map(([key, components]) => ({
      key,
      label: SYSTEM_LABELS[key],
      components,
    })),
  };
}

export function resolveWorkbenchAssembly(
  manifest: PaperDollReleaseManifest,
  mappingKey: string,
) {
  return resolvePaperDollAssembly(manifest, mappingKey);
}

export function deriveReleaseLifecycleCounts(
  manifest: PaperDollReleaseManifest,
): ReleaseLifecycleCounts {
  let resolvable = 0;
  for (const mapping of manifest.assemblyMappings) {
    try {
      resolveWorkbenchAssembly(manifest, mapping.mappingKey);
      resolvable += 1;
    } catch {
      // The blocked count below preserves failures instead of substituting assets.
    }
  }
  const countStatus = (status: PaperDollReleaseAsset["approvalStatus"]) =>
    manifest.assets.filter((asset) => asset.approvalStatus === status).length;
  const published = manifest.status === "published" ? manifest.assets.length : 0;
  const publishedAssemblies = manifest.status === "published" ? resolvable : 0;
  return {
    assets: {
      required: manifest.assets.length,
      approved: countStatus("approved"),
      blocked: countStatus("blocked"),
      candidate: countStatus("candidate"),
      rejected: countStatus("rejected"),
      published,
    },
    assemblies: {
      required: manifest.assemblyMappings.length,
      resolvable,
      blocked: manifest.assemblyMappings.length - resolvable,
      published: publishedAssemblies,
    },
  };
}

function isPassingGeometryEvidence(
  manifest: PaperDollReleaseManifest,
  asset: PaperDollReleaseAsset,
): boolean {
  return manifest.qaEvidence.some((evidence) => {
    const measurements = evidence.measurements;
    return evidence.subjectId === asset.geometryFamilyId &&
      evidence.gateKey === "shared-geometry-mask" &&
      evidence.blocking &&
      evidence.status === "passed" &&
      evidence.calibratedWith.length > 0 &&
      measurements.exactBinarySilhouette === true &&
      measurements.minIoU === 1 &&
      measurements.maskSha256 === asset.geometryMaskSha256;
  });
}

export function getGeometryVerification(
  manifest: PaperDollReleaseManifest,
  asset: PaperDollReleaseAsset,
): GeometryVerification {
  if (!asset.geometryMaskPath || !asset.geometryMaskSha256) return "not-verified";
  return isPassingGeometryEvidence(manifest, asset) ? "geometry-locked" : "shared-mask";
}

function toPercentBounds(
  asset: PaperDollReleaseAsset,
  canvas: PaperDollReleaseManifest["canvas"],
): PercentBounds {
  return {
    left: (asset.alphaBounds.left / canvas.widthPx) * 100,
    top: (asset.alphaBounds.top / canvas.heightPx) * 100,
    width: ((asset.alphaBounds.right - asset.alphaBounds.left + 1) / canvas.widthPx) * 100,
    height: ((asset.alphaBounds.bottom - asset.alphaBounds.top + 1) / canvas.heightPx) * 100,
  };
}

export function buildWorkbenchLineup(
  manifest: PaperDollReleaseManifest,
  mappingKeys: readonly string[],
): WorkbenchLineupItem[] {
  if (mappingKeys.length < 4 || mappingKeys.length > 5) {
    throw new Error("A catalog lineup requires four or five explicit assembly mappings.");
  }
  if (new Set(mappingKeys).size !== mappingKeys.length) {
    throw new Error("A catalog lineup cannot contain duplicate assembly mappings.");
  }
  return mappingKeys.map((mappingKey) => {
    const mapping = manifest.assemblyMappings.find((candidate) => candidate.mappingKey === mappingKey);
    if (!mapping) throw new Error(`No assembly mapping '${mappingKey}'.`);
    const resolved = resolveWorkbenchAssembly(manifest, mappingKey);
    const body = resolved.layers.find((layer) => layer.slot === "body");
    if (!body) throw new Error(`Assembly mapping '${mappingKey}' has no body layer.`);
    return {
      mappingKey,
      websiteSku: mapping.websiteSku,
      graceSku: mapping.graceSku,
      recipeKey: resolved.recipeKey,
      layers: resolved.layers.map((layer) => ({
        ...layer,
        boundsPct: toPercentBounds(layer, manifest.canvas),
      })),
      overlay: {
        canvasWidthPx: manifest.canvas.widthPx,
        canvasHeightPx: manifest.canvas.heightPx,
        centerlinePct: (body.mountAxisXPx / manifest.canvas.widthPx) * 100,
        baselinePct: (body.seatYPx / manifest.canvas.heightPx) * 100,
      },
    };
  });
}
