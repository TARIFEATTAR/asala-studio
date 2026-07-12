export type BestBottlesShadowOwner = "rig" | "model";
export type BestBottlesPromptVersion =
  | "best-bottles-reference-locked-v6.0"
  | "best-bottles-reference-locked-v6.1";

export interface BestBottlesShadowPolicyInput {
  graceSku?: string | null;
  websiteSku?: string | null;
  family?: string | null;
  bottleCollection?: string | null;
}

export interface BestBottlesShadowPolicy {
  promptVersion: BestBottlesPromptVersion;
  owner: BestBottlesShadowOwner;
  contract: "deterministic-contact-v1" | "contact-back-right-v1";
  rollout: "cylinder-family" | null;
}

function normalizedFamily(value: string | null | undefined): string {
  return String(value ?? "").trim().toLowerCase().replace(/[_-]+/g, " ");
}

export function resolveBestBottlesShadowPolicy(
  input?: BestBottlesShadowPolicyInput | string | null,
): BestBottlesShadowPolicy {
  // String-only input is retained for historical record parsing. It cannot
  // promote a new generation because SKU substrings are not family truth.
  const context = typeof input === "object" && input !== null ? input : null;
  const family = normalizedFamily(context?.family);
  const collection = normalizedFamily(context?.bottleCollection);
  if (
    family === "cylinder" ||
    family === "tall cylinder" ||
    collection === "cylinder" ||
    collection === "tall cylinder"
  ) {
    return {
      promptVersion: "best-bottles-reference-locked-v6.1",
      owner: "model",
      contract: "contact-back-right-v1",
      rollout: "cylinder-family",
    };
  }
  return {
    promptVersion: "best-bottles-reference-locked-v6.0",
    owner: "rig",
    contract: "deterministic-contact-v1",
    rollout: null,
  };
}

export function getBestBottlesShadowPolicyTags(policy: BestBottlesShadowPolicy): string[] {
  return [
    `prompt-version:${policy.promptVersion}`,
    `shadow-owner:${policy.owner}`,
    `shadow-contract:${policy.contract}`,
    ...(policy.rollout ? [`shadow-rollout:${policy.rollout}`] : []),
  ];
}

/**
 * Canonical prompt-version metadata written to reconciliation records. General
 * Dark Room requests retain their caller value; Best Bottles studio masters
 * always use the exact SKU policy so persisted lineage cannot drift from the
 * generation contract.
 */
export function resolveBestBottlesReconciliationPromptVersion(
  input: BestBottlesShadowPolicyInput | string | null | undefined,
  isBestBottlesStudioMaster: boolean,
  callerPromptVersion?: string | null,
): string | null | undefined {
  return isBestBottlesStudioMaster
    ? resolveBestBottlesShadowPolicy(input).promptVersion
    : callerPromptVersion;
}
