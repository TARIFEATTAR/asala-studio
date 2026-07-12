export type BestBottlesShadowOwner = "rig" | "model";

export interface BestBottlesShadowPolicy {
  promptVersion: "best-bottles-reference-locked-v6.0" | "best-bottles-reference-locked-v6.1-shadow-smoke";
  owner: BestBottlesShadowOwner;
  contract: "deterministic-contact-v1" | "contact-back-right-v1";
  smokeSku: "GB-SPR-CLR-3ML-BLK" | null;
}

export function resolveBestBottlesShadowPolicy(graceSku?: string | null): BestBottlesShadowPolicy {
  if (graceSku?.trim().toUpperCase() === "GB-SPR-CLR-3ML-BLK") {
    return {
      promptVersion: "best-bottles-reference-locked-v6.1-shadow-smoke",
      owner: "model",
      contract: "contact-back-right-v1",
      smokeSku: "GB-SPR-CLR-3ML-BLK",
    };
  }
  return {
    promptVersion: "best-bottles-reference-locked-v6.0",
    owner: "rig",
    contract: "deterministic-contact-v1",
    smokeSku: null,
  };
}

export function getBestBottlesShadowPolicyTags(policy: BestBottlesShadowPolicy): string[] {
  return [
    `prompt-version:${policy.promptVersion}`,
    `shadow-owner:${policy.owner}`,
    `shadow-contract:${policy.contract}`,
    ...(policy.smokeSku ? [`shadow-smoke-sku:${policy.smokeSku}`] : []),
  ];
}

/**
 * Canonical prompt-version metadata written to reconciliation records. General
 * Dark Room requests retain their caller value; Best Bottles studio masters
 * always use the exact SKU policy so persisted lineage cannot drift from the
 * generation contract.
 */
export function resolveBestBottlesReconciliationPromptVersion(
  graceSku: string | null | undefined,
  isBestBottlesStudioMaster: boolean,
  callerPromptVersion?: string | null,
): string | null | undefined {
  return isBestBottlesStudioMaster
    ? resolveBestBottlesShadowPolicy(graceSku).promptVersion
    : callerPromptVersion;
}
