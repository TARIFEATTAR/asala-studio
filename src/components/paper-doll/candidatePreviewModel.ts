import type { AssemblyEditMode } from "./assemblyEditModel";

export const PRIVATE_ASSET_REFRESH_INTERVAL_MS = 4 * 60 * 1_000;

export function shouldMountCandidatePreview(mode: AssemblyEditMode, candidateImageUrl: string | null): boolean {
  return (mode === "edit-lab" || mode === "family-fit") && Boolean(candidateImageUrl);
}

const PENDING_CANDIDATE_STATUSES = new Set(["queued", "running", "clamping", "qa"]);

export function candidateHistoryRefreshInterval(
  jobs: Array<{ job: { status: string; updatedAt?: string } }> | undefined,
  nowEpochMs = Date.now(),
): number | false {
  const activeWindowMs = 2 * 60 * 1_000;
  return jobs?.some((entry) => {
    if (!PENDING_CANDIDATE_STATUSES.has(entry.job.status) || !entry.job.updatedAt) return false;
    const updatedAt = Date.parse(entry.job.updatedAt);
    return Number.isFinite(updatedAt) && nowEpochMs - updatedAt <= activeWindowMs;
  }) ? 5_000 : PRIVATE_ASSET_REFRESH_INTERVAL_MS;
}

export function selectWorkbenchBody(currentLayerId: string | null, bodyId: string) {
  return {
    selectedBodyId: bodyId,
    selectedLayerId: currentLayerId,
  };
}

export function applyCandidateAssetPreview<T extends {
  imageUrl: string;
  alphaBounds: { left: number; top: number; right: number; bottom: number };
}>(asset: T, preview: Pick<T, "imageUrl" | "alphaBounds">): T {
  return {
    ...asset,
    imageUrl: preview.imageUrl,
    alphaBounds: preview.alphaBounds,
  };
}
