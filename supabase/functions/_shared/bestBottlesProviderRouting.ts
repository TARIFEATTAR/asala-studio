export interface BestBottlesProviderRoutingInput {
  isBestBottlesReferenceLocked: boolean;
  allowBestBottlesProviderOverride?: boolean | null;
}

export interface BestBottlesResolutionRoutingInput {
  isBestBottlesReferenceLocked: boolean;
  resolution?: string | null;
}

export function shouldForceBestBottlesOpenAIProvider(
  input: BestBottlesProviderRoutingInput,
): boolean {
  return input.isBestBottlesReferenceLocked && input.allowBestBottlesProviderOverride !== true;
}

export function resolveBestBottlesProductionResolution(
  input: BestBottlesResolutionRoutingInput,
): string | undefined {
  if (input.isBestBottlesReferenceLocked) return "high";
  return input.resolution ?? undefined;
}
