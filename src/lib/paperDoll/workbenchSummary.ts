import type { PaperDollReleaseWorkbenchData } from "./releaseRepository";

export interface PaperDollWorkbenchSummary {
  totalAssets: number;
  approvedAssets: number;
  blockedAssets: number;
  passedBlockingGates: number;
  failedBlockingGates: number;
  dryRunEligible: boolean;
  blockers: string[];
}

export function summarizePaperDollWorkbench(
  data: PaperDollReleaseWorkbenchData,
): PaperDollWorkbenchSummary {
  const blockingGates = data.assets.flatMap((asset) =>
    asset.qa.filter((result) => result.blocking).map((result) => ({ asset, result })),
  );
  const blockers = blockingGates
    .filter(({ result }) => result.status !== "passed")
    .flatMap(({ asset, result }) => {
      const issues = result.issues.length > 0 ? result.issues : [`${result.gateKey}_${result.status}`];
      return issues.map((issue) => `${asset.displayName}: ${issue}`);
    });
  const everyAssetHasPassingBlockingEvidence = data.assets.length > 0 && data.assets.every((asset) => {
    const gates = asset.qa.filter((result) => result.blocking);
    return gates.length > 0 && gates.every((result) => result.status === "passed");
  });
  const approvedAssets = data.assets.filter((asset) => asset.approvalStatus === "approved").length;

  return {
    totalAssets: data.assets.length,
    approvedAssets,
    blockedAssets: data.assets.filter((asset) => asset.approvalStatus === "blocked").length,
    passedBlockingGates: blockingGates.filter(({ result }) => result.status === "passed").length,
    failedBlockingGates: blockingGates.filter(({ result }) => result.status !== "passed").length,
    dryRunEligible:
      data.release.status === "ready"
      && approvedAssets === data.assets.length
      && everyAssetHasPassingBlockingEvidence,
    blockers,
  };
}
