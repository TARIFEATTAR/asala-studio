import type {
  CanonicalBodyGeometryRow,
  CanonicalCylinderCoverageRow,
  CylinderApprovedCoverageBlocker,
  CylinderApprovedCoverageManifest,
  CylinderApprovedCoverageRow,
  CylinderApprovedReference,
} from "./bestBottlesCylinderApprovedCoverageManifest";
import type {
  PsdReviewedAuditRecord,
  PsdReviewedUnit,
} from "./bestBottlesPsdReviewDecisions";

export const CYLINDER_REFERENCE_PRODUCTION_PLAN_VERSION =
  "best-bottles-cylinder-reference-production-plan-v1" as const;

export type CylinderReferenceBlockerLane =
  | "canonical-geometry"
  | "source-evidence"
  | "source-and-geometry"
  | "other";

export type CylinderReferenceSource = {
  sourcePath: string;
  sourceRelativePath: string;
  sourceSha256: string;
  sourceBytes: number;
  previewPath: string;
  previewSha256: string;
  reviewUnitKey: string;
  reviewer: string;
  reviewedAt: string;
  capState: "assembled-cap-on";
  composite: {
    width: number;
    height: number;
    opaque: true;
    sceneCount: number;
    foregroundBounds: { left: number; top: number; width: number; height: number } | null;
    largeForegroundComponentCount: number;
    whiteCornerCount: number;
    minimumSafeMarginPct: number | null;
  };
};

export type CylinderReferenceExportJob = {
  canonicalIdentityKey: string;
  canonical: CanonicalCylinderCoverageRow;
  bodyGeometry: CanonicalBodyGeometryRow;
  source: CylinderReferenceSource;
  outputFilename: string;
};

export type CylinderReferenceBlockedIdentity = {
  canonicalIdentityKey: string;
  canonical: CanonicalCylinderCoverageRow;
  blockers: CylinderApprovedCoverageBlocker[];
  lane: CylinderReferenceBlockerLane;
  approvedReferenceCount: number;
  primaryReference: CylinderApprovedReference | null;
};

export type CylinderReferenceProductionPlan = {
  version: typeof CYLINDER_REFERENCE_PRODUCTION_PLAN_VERSION;
  summary: {
    canonicalIdentityCount: number;
    exportQualifiedCount: number;
    blockedIdentityCount: number;
    canonicalGeometryBlockedCount: number;
    sourceEvidenceBlockedCount: number;
    sourceAndGeometryBlockedCount: number;
    otherBlockedCount: number;
    uniqueSourceCount: number;
    externalWriteCount: 0;
  };
  exportJobs: CylinderReferenceExportJob[];
  blockedIdentities: CylinderReferenceBlockedIdentity[];
};

const GEOMETRY_BLOCKERS = new Set<CylinderApprovedCoverageBlocker>([
  "missing-canon-body-height-mm",
  "missing-canon-width-axis-mm",
  "missing-canon-second-axis-mm",
  "missing-canon-height-with-cap-mm",
  "missing-canonical-body-geometry",
  "ambiguous-canonical-body-geometry",
]);

const SOURCE_BLOCKERS = new Set<CylinderApprovedCoverageBlocker>([
  "no-approved-exact-reference",
  "no-approved-assembled-cap-on-reference",
]);

function normalizedIdentity(value: string | null | undefined): string {
  return String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function isSha256(value: string): boolean {
  return /^[a-f0-9]{64}$/i.test(value);
}

function positiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

function sameCanonicalIdentity(
  source: Pick<PsdReviewedAuditRecord, "websiteSku" | "graceSku">,
  canonical: CanonicalCylinderCoverageRow,
): boolean {
  return normalizedIdentity(source.websiteSku) === normalizedIdentity(canonical.websiteSku)
    && normalizedIdentity(source.graceSku) === normalizedIdentity(canonical.graceSku)
    && normalizedIdentity(source.websiteSku) !== ""
    && normalizedIdentity(source.graceSku) !== "";
}

function blockerLane(blockers: readonly CylinderApprovedCoverageBlocker[]): CylinderReferenceBlockerLane {
  const geometry = blockers.some((blocker) => GEOMETRY_BLOCKERS.has(blocker));
  const source = blockers.some((blocker) => SOURCE_BLOCKERS.has(blocker));
  const other = blockers.some((blocker) => (
    !GEOMETRY_BLOCKERS.has(blocker) && !SOURCE_BLOCKERS.has(blocker)
  ));
  if (other) return "other";
  if (geometry && source) return "source-and-geometry";
  if (geometry) return "canonical-geometry";
  if (source) return "source-evidence";
  return "other";
}

function assertCoverageRowState(row: CylinderApprovedCoverageRow): void {
  if (row.referenceReady) {
    if (row.blockers.length > 0 || row.primaryReference === null || row.bodyMatch.method === "none") {
      throw new Error(`Ready coverage row ${row.canonicalIdentityKey} has an inconsistent gate state.`);
    }
    return;
  }
  if (row.blockers.length === 0) {
    throw new Error(`Blocked coverage row ${row.canonicalIdentityKey} has no explicit blocker.`);
  }
}

function reviewedSourceForReadyRow(input: {
  row: CylinderApprovedCoverageRow;
  reviewedUnits: readonly PsdReviewedUnit[];
}): { unit: PsdReviewedUnit; source: PsdReviewedAuditRecord } {
  const primary = input.row.primaryReference;
  if (primary === null) {
    throw new Error(`Ready coverage row ${input.row.canonicalIdentityKey} has no primary reference.`);
  }
  const candidates: Array<{ unit: PsdReviewedUnit; source: PsdReviewedAuditRecord }> = [];
  for (const unit of input.reviewedUnits) {
    for (const source of unit.sources) {
      if (source.sourcePath === primary.sourcePath && source.sourceSha256 === primary.sourceSha256) {
        candidates.push({ unit, source });
      }
    }
  }
  if (candidates.length === 0) {
    throw new Error(
      `Ready coverage row ${input.row.canonicalIdentityKey} has no reviewed source evidence for ${primary.sourcePath}.`,
    );
  }
  if (candidates.length !== 1) {
    throw new Error(
      `Ready coverage row ${input.row.canonicalIdentityKey} has ${candidates.length} reviewed source records; expected one.`,
    );
  }
  return candidates[0];
}

function assertApprovedExactAssembledSource(input: {
  row: CylinderApprovedCoverageRow;
  primary: CylinderApprovedReference;
  unit: PsdReviewedUnit;
  source: PsdReviewedAuditRecord;
}): void {
  const { row, primary, unit, source } = input;
  const approvedIdentityStatus = (value: string): boolean => (
    value === "exact-website-sku" || value === "reviewed-alias"
  );
  const reviewedAliasHasProvenance = source.identityStatus !== "reviewed-alias" || (
    source.aliasProvenance !== null
    && source.aliasProvenance.observedAliasToken.trim() !== ""
    && normalizedIdentity(source.aliasProvenance.canonicalWebsiteSku)
      === normalizedIdentity(row.canonical.websiteSku)
    && normalizedIdentity(source.aliasProvenance.canonicalGraceSku)
      === normalizedIdentity(row.canonical.graceSku)
    && source.aliasProvenance.reviewer.kind === "human"
    && source.aliasProvenance.reviewer.identity.trim() !== ""
    && !Number.isNaN(Date.parse(source.aliasProvenance.reviewedAt))
  );
  const exactApprovedAssembled = (
    primary.classification === "assembled-cap-on"
    && primary.reviewUnitKey === unit.reviewUnitKey
    && unit.reviewStatus === "approved"
    && unit.classification === "assembled-cap-on"
    && approvedIdentityStatus(unit.identityStatus)
    && source.reviewStatus === "approved"
    && source.humanClassification === "assembled-cap-on"
    && approvedIdentityStatus(source.identityStatus)
    && reviewedAliasHasProvenance
    && source.family === row.canonical.family
    && sameCanonicalIdentity(source, row.canonical)
    && normalizedIdentity(unit.websiteSku) === normalizedIdentity(row.canonical.websiteSku)
    && normalizedIdentity(unit.graceSku) === normalizedIdentity(row.canonical.graceSku)
  );
  if (!exactApprovedAssembled) {
    throw new Error(
      `Ready coverage row ${row.canonicalIdentityKey} requires approved assembled-cap-on exact identity evidence.`,
    );
  }
  if (
    source.sourceRelativePath !== primary.sourceRelativePath
    || source.composite?.previewPath !== primary.previewPath
    || source.composite?.evidenceSha256 !== primary.previewSha256
  ) {
    throw new Error(`Ready coverage row ${row.canonicalIdentityKey} has mismatched reviewed preview evidence.`);
  }
  if (!isSha256(source.sourceSha256) || !isSha256(source.composite.evidenceSha256)) {
    throw new Error(`Ready coverage row ${row.canonicalIdentityKey} has an invalid evidence hash.`);
  }
  if (!positiveInteger(source.sourceBytes)) {
    throw new Error(`Ready coverage row ${row.canonicalIdentityKey} has invalid source bytes.`);
  }
  if (
    !positiveInteger(source.composite.width)
    || !positiveInteger(source.composite.height)
    || !positiveInteger(source.composite.sceneCount)
  ) {
    throw new Error(`Ready coverage row ${row.canonicalIdentityKey} has invalid composite dimensions.`);
  }
  if (source.composite.opaque !== true) {
    throw new Error(`Ready coverage row ${row.canonicalIdentityKey} composite must be opaque.`);
  }
  if (
    unit.reviewer?.kind !== "human"
    || unit.reviewer.identity.trim() === ""
    || source.reviewer?.kind !== "human"
    || source.reviewer.identity.trim() === ""
    || unit.reviewedAt !== source.reviewedAt
    || Number.isNaN(Date.parse(source.reviewedAt))
  ) {
    throw new Error(`Ready coverage row ${row.canonicalIdentityKey} has invalid human review provenance.`);
  }
}

function exportJob(input: {
  row: CylinderApprovedCoverageRow;
  reviewedUnits: readonly PsdReviewedUnit[];
}): CylinderReferenceExportJob {
  const primary = input.row.primaryReference;
  if (primary === null || input.row.bodyMatch.method === "none") {
    throw new Error(`Ready coverage row ${input.row.canonicalIdentityKey} is missing its reference or body.`);
  }
  const { unit, source } = reviewedSourceForReadyRow(input);
  assertApprovedExactAssembledSource({ row: input.row, primary, unit, source });
  const composite = source.composite;
  if (composite === null || composite.opaque !== true) {
    throw new Error(`Ready coverage row ${input.row.canonicalIdentityKey} composite must be opaque.`);
  }
  const websiteSku = normalizedIdentity(input.row.canonical.websiteSku);
  const graceSku = normalizedIdentity(input.row.canonical.graceSku);
  const outputFilename = `${websiteSku}__${graceSku}__${source.sourceSha256.slice(0, 12).toLowerCase()}.png`;
  return {
    canonicalIdentityKey: input.row.canonicalIdentityKey,
    canonical: { ...input.row.canonical },
    bodyGeometry: { ...input.row.bodyMatch.bodyGeometry },
    source: {
      sourcePath: source.sourcePath,
      sourceRelativePath: source.sourceRelativePath,
      sourceSha256: source.sourceSha256.toLowerCase(),
      sourceBytes: source.sourceBytes,
      previewPath: composite.previewPath,
      previewSha256: composite.evidenceSha256.toLowerCase(),
      reviewUnitKey: unit.reviewUnitKey,
      reviewer: source.reviewer.identity,
      reviewedAt: source.reviewedAt,
      capState: "assembled-cap-on",
      composite: {
        width: composite.width,
        height: composite.height,
        opaque: true,
        sceneCount: composite.sceneCount,
        foregroundBounds: composite.foregroundBounds === null
          ? null
          : { ...composite.foregroundBounds },
        largeForegroundComponentCount: composite.largeForegroundComponentCount,
        whiteCornerCount: composite.whiteCornerCount,
        minimumSafeMarginPct: composite.minimumSafeMarginPct,
      },
    },
    outputFilename,
  };
}

function assertUniqueJobs(jobs: readonly CylinderReferenceExportJob[]): void {
  const filenames = new Map<string, string>();
  const sources = new Map<string, string>();
  for (const job of jobs) {
    const filenameIdentity = filenames.get(job.outputFilename);
    if (filenameIdentity !== undefined && filenameIdentity !== job.canonicalIdentityKey) {
      throw new Error(`Duplicate Cylinder reference output filename ${job.outputFilename}.`);
    }
    filenames.set(job.outputFilename, job.canonicalIdentityKey);

    const sourceKey = `${job.source.sourceSha256}|${job.source.sourcePath}`;
    const sourceIdentity = sources.get(sourceKey);
    if (sourceIdentity !== undefined && sourceIdentity !== job.canonicalIdentityKey) {
      throw new Error(`Cylinder reference source ${job.source.sourcePath} is assigned to multiple identities.`);
    }
    sources.set(sourceKey, job.canonicalIdentityKey);
  }
}

function assertCoverageSummary(
  coverage: CylinderApprovedCoverageManifest,
  jobs: readonly CylinderReferenceExportJob[],
  blocked: readonly CylinderReferenceBlockedIdentity[],
): void {
  if (
    coverage.version !== "best-bottles-cylinder-approved-coverage-manifest-v1"
    || coverage.summary.externalWriteCount !== 0
    || coverage.summary.canonicalIdentityCount !== coverage.rows.length
    || coverage.summary.referenceReadyCount !== jobs.length
    || coverage.summary.blockedIdentityCount !== blocked.length
  ) {
    throw new Error("Cylinder approved coverage manifest summary is inconsistent.");
  }
  const identities = [...jobs, ...blocked].map((row) => row.canonicalIdentityKey);
  if (new Set(identities).size !== coverage.rows.length) {
    throw new Error("Cylinder reference production plan does not partition canonical identities exactly once.");
  }
}

export function buildCylinderReferenceProductionPlan(input: {
  coverageManifest: CylinderApprovedCoverageManifest;
  reviewedUnits: readonly PsdReviewedUnit[];
}): CylinderReferenceProductionPlan {
  const exportJobs: CylinderReferenceExportJob[] = [];
  const blockedIdentities: CylinderReferenceBlockedIdentity[] = [];

  for (const row of input.coverageManifest.rows) {
    assertCoverageRowState(row);
    if (row.referenceReady) {
      exportJobs.push(exportJob({ row, reviewedUnits: input.reviewedUnits }));
      continue;
    }
    blockedIdentities.push({
      canonicalIdentityKey: row.canonicalIdentityKey,
      canonical: { ...row.canonical },
      blockers: [...row.blockers],
      lane: blockerLane(row.blockers),
      approvedReferenceCount: row.approvedReferences.length,
      primaryReference: row.primaryReference === null ? null : { ...row.primaryReference },
    });
  }

  exportJobs.sort((left, right) => left.canonicalIdentityKey.localeCompare(right.canonicalIdentityKey));
  blockedIdentities.sort((left, right) => left.canonicalIdentityKey.localeCompare(right.canonicalIdentityKey));
  assertUniqueJobs(exportJobs);
  assertCoverageSummary(input.coverageManifest, exportJobs, blockedIdentities);

  const laneCount = (lane: CylinderReferenceBlockerLane) => (
    blockedIdentities.filter((row) => row.lane === lane).length
  );
  return {
    version: CYLINDER_REFERENCE_PRODUCTION_PLAN_VERSION,
    summary: {
      canonicalIdentityCount: input.coverageManifest.rows.length,
      exportQualifiedCount: exportJobs.length,
      blockedIdentityCount: blockedIdentities.length,
      canonicalGeometryBlockedCount: laneCount("canonical-geometry"),
      sourceEvidenceBlockedCount: laneCount("source-evidence"),
      sourceAndGeometryBlockedCount: laneCount("source-and-geometry"),
      otherBlockedCount: laneCount("other"),
      uniqueSourceCount: new Set(exportJobs.map((job) => (
        `${job.source.sourceSha256}|${job.source.sourcePath}`
      ))).size,
      externalWriteCount: 0,
    },
    exportJobs,
    blockedIdentities,
  };
}
