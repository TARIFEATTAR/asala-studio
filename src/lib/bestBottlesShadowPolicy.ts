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
