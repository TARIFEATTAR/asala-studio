export interface FamilyBatchGenerationIdentity {
  ledgerHash: string;
  referenceHash: string;
  promptHash: string;
  promptVersion: string;
  shadowOwner: string;
  shadowContract: string;
  shadowTopology: string;
  scaleContractVersion: string;
  calibrationRegistryKey: string;
  resolvedAssembledTargetPct: number;
  resolvedBodyTargetPx: number;
}

export interface FamilyBatchRenderedEntryLike {
  status?: string | null;
  imageUrl?: string | null;
  rawImageUrl?: string | null;
  geometryQa?: { pass?: boolean | null } | null;
  shadowQa?: { pass?: boolean | null } | null;
  lifecycle?: string | null;
  generationIdentity?: Partial<FamilyBatchGenerationIdentity> | null;
}

const IDENTITY_KEYS: ReadonlyArray<keyof FamilyBatchGenerationIdentity> = [
  "ledgerHash",
  "referenceHash",
  "promptHash",
  "promptVersion",
  "shadowOwner",
  "shadowContract",
  "shadowTopology",
  "scaleContractVersion",
  "calibrationRegistryKey",
  "resolvedAssembledTargetPct",
  "resolvedBodyTargetPx",
];

export function canSkipRenderedEntry(
  entry: FamilyBatchRenderedEntryLike | null | undefined,
  currentIdentity: FamilyBatchGenerationIdentity,
): boolean {
  if (!entry || entry.status !== "rendered") return false;
  if (!entry.imageUrl || !entry.rawImageUrl) return false;
  if (entry.geometryQa?.pass !== true || entry.shadowQa?.pass !== true) return false;
  if (entry.lifecycle !== "qa-passed") return false;

  return IDENTITY_KEYS.every(
    (key) => entry.generationIdentity?.[key] === currentIdentity[key],
  );
}

export function isSystemicQaFailure(error: string | null | undefined): boolean {
  return /rig postprocess failed|framing QA did not pass|shadow QA did not pass/i.test(
    String(error ?? ""),
  );
}
