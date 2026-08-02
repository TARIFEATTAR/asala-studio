export const BEST_BOTTLES_CYLINDER_BLOCKED_RECOVERY_VERSION =
  "best-bottles-cylinder-blocked-recovery-v1" as const;

export type CylinderBlockedReadinessRow = {
  canonicalIdentityKey: string;
  websiteSku: string;
  graceSku: string;
  status: "blocked";
  blockers: string[];
  blockerLane: string | null;
  canonical: Record<string, unknown> & {
    websiteSku: string;
    graceSku: string;
    family: string;
  };
  reference: unknown;
};

export type CylinderPsdRecoveryRecord = {
  websiteSku: string | null;
  graceSku: string | null;
  family: string | null;
  sourcePath: string;
  sourceRelativePath: string;
  sourceSha256: string;
  sourceBytes: number;
  reviewStatus: string;
  composite: {
    width: number;
    height: number;
    opaque: boolean;
    previewPath: string;
    evidenceSha256: string;
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
};

export type CylinderBlockedRecoveryCandidate = {
  sourcePath: string;
  sourceRelativePath: string;
  sourceSha256: string;
  sourceBytes: number;
  reviewStatus: string;
  width: number;
  height: number;
  pixelCount: number;
  opaque: boolean;
  previewPath: string;
  previewSha256: string;
};

export type CylinderBlockedRecoveryStatus =
  | "exact-high-resolution-pending-review"
  | "exact-low-resolution-only"
  | "no-exact-psd-candidate";

export type CylinderBlockedRecoveryRow = {
  canonicalIdentityKey: string;
  websiteSku: string;
  graceSku: string;
  blockers: string[];
  blockerLane: string | null;
  recoveryStatus: CylinderBlockedRecoveryStatus;
  promotionState: "blocked-pending-human-review" | "blocked-source-evidence";
  selectedCandidate: CylinderBlockedRecoveryCandidate | null;
  candidates: CylinderBlockedRecoveryCandidate[];
};

export type CylinderBlockedRecoveryQueue = {
  version: typeof BEST_BOTTLES_CYLINDER_BLOCKED_RECOVERY_VERSION;
  minimumPixels: number;
  summary: {
    blockedIdentityCount: number;
    exactHighResolutionPendingReviewCount: number;
    exactLowResolutionOnlyCount: number;
    noExactPsdCandidateCount: number;
    geometryBlockedCount: number;
    promotableNowCount: 0;
  };
  rows: CylinderBlockedRecoveryRow[];
};

function normalizedIdentity(value: unknown): string {
  return String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function exactDualSkuMatch(
  row: CylinderBlockedReadinessRow,
  candidate: CylinderPsdRecoveryRecord,
): boolean {
  return normalizedIdentity(candidate.family) === "CYLINDER"
    && normalizedIdentity(candidate.websiteSku) !== ""
    && normalizedIdentity(candidate.graceSku) !== ""
    && normalizedIdentity(candidate.websiteSku) === normalizedIdentity(row.websiteSku)
    && normalizedIdentity(candidate.graceSku) === normalizedIdentity(row.graceSku);
}

function toCandidate(record: CylinderPsdRecoveryRecord): CylinderBlockedRecoveryCandidate | null {
  const composite = record.composite;
  if (
    composite === null
    || !Number.isInteger(composite.width)
    || composite.width <= 0
    || !Number.isInteger(composite.height)
    || composite.height <= 0
  ) {
    return null;
  }
  return {
    sourcePath: record.sourcePath,
    sourceRelativePath: record.sourceRelativePath,
    sourceSha256: record.sourceSha256.toLowerCase(),
    sourceBytes: record.sourceBytes,
    reviewStatus: record.reviewStatus,
    width: composite.width,
    height: composite.height,
    pixelCount: composite.width * composite.height,
    opaque: composite.opaque,
    previewPath: composite.previewPath,
    previewSha256: composite.evidenceSha256.toLowerCase(),
  };
}

function compareCandidates(
  left: CylinderBlockedRecoveryCandidate,
  right: CylinderBlockedRecoveryCandidate,
): number {
  return right.pixelCount - left.pixelCount
    || left.sourceRelativePath.localeCompare(right.sourceRelativePath)
    || left.sourceSha256.localeCompare(right.sourceSha256);
}

export function buildCylinderBlockedRecoveryQueue(input: {
  blockedRows: readonly CylinderBlockedReadinessRow[];
  psdRecords: readonly CylinderPsdRecoveryRecord[];
  minimumPixels: number;
}): CylinderBlockedRecoveryQueue {
  if (!Number.isInteger(input.minimumPixels) || input.minimumPixels <= 0) {
    throw new Error("Cylinder blocked recovery minimumPixels must be a positive integer.");
  }
  const identityKeys = new Set<string>();
  const rows = input.blockedRows.map((row): CylinderBlockedRecoveryRow => {
    if (row.status !== "blocked") {
      throw new Error(`Recovery queue received non-blocked identity ${row.canonicalIdentityKey}.`);
    }
    const exactKey = `${normalizedIdentity(row.websiteSku)}|${normalizedIdentity(row.graceSku)}`;
    if (exactKey === "|" || identityKeys.has(exactKey)) {
      throw new Error(`Recovery queue has missing or duplicate exact identity ${exactKey}.`);
    }
    identityKeys.add(exactKey);
    const candidates = input.psdRecords
      .filter((record) => exactDualSkuMatch(row, record))
      .map(toCandidate)
      .filter((candidate): candidate is CylinderBlockedRecoveryCandidate => candidate !== null)
      .sort(compareCandidates);
    const highResolution = candidates.filter((candidate) => candidate.pixelCount >= input.minimumPixels);
    const recoveryStatus: CylinderBlockedRecoveryStatus = highResolution.length > 0
      ? "exact-high-resolution-pending-review"
      : candidates.length > 0
        ? "exact-low-resolution-only"
        : "no-exact-psd-candidate";
    return {
      canonicalIdentityKey: row.canonicalIdentityKey,
      websiteSku: row.websiteSku,
      graceSku: row.graceSku,
      blockers: [...row.blockers],
      blockerLane: row.blockerLane,
      recoveryStatus,
      promotionState: recoveryStatus === "exact-high-resolution-pending-review"
        ? "blocked-pending-human-review"
        : "blocked-source-evidence",
      selectedCandidate: highResolution[0] ?? candidates[0] ?? null,
      candidates,
    };
  });

  return {
    version: BEST_BOTTLES_CYLINDER_BLOCKED_RECOVERY_VERSION,
    minimumPixels: input.minimumPixels,
    summary: {
      blockedIdentityCount: rows.length,
      exactHighResolutionPendingReviewCount: rows.filter((row) => (
        row.recoveryStatus === "exact-high-resolution-pending-review"
      )).length,
      exactLowResolutionOnlyCount: rows.filter((row) => (
        row.recoveryStatus === "exact-low-resolution-only"
      )).length,
      noExactPsdCandidateCount: rows.filter((row) => (
        row.recoveryStatus === "no-exact-psd-candidate"
      )).length,
      geometryBlockedCount: rows.filter((row) => row.blockers.some((blocker) => (
        blocker.includes("canonical-body-geometry")
      ))).length,
      promotableNowCount: 0,
    },
    rows,
  };
}
