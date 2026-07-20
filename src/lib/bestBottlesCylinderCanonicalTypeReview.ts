import {
  BEST_BOTTLES_CATALOG_SCALE_VERSION,
  resolveBestBottlesGlobalScalePct,
} from "../config/bestBottlesCatalogScale";
import type {
  CylinderApprovedCoverageBlocker,
  CylinderApprovedCoverageManifest,
  CylinderApprovedCoverageRow,
  CylinderApprovedReference,
} from "./bestBottlesCylinderApprovedCoverageManifest";
import type {
  PsdReviewedAuditRecord,
  PsdReviewedUnit,
} from "./bestBottlesPsdReviewDecisions";

export type CylinderCanonicalMasterRecord = {
  websiteSku: string;
  graceSku: string;
  productGroupSlug: string;
  family: string;
  capacityMl: string;
  canon_bodyHeightMm: string;
  canon_widthAxisMm: string;
  canon_secondAxisMm: string;
  canon_heightWithCapMm: string;
  neckThreadSize: string;
  applicator: string;
  capStyle: string;
};

export type CylinderTypeReviewInputFile = {
  path: string;
  sha256: string;
};

export type CylinderCanonicalTypeReviewProvenance = {
  inputs: {
    coverageArtifact: CylinderTypeReviewInputFile;
    canonicalMaster: CylinderTypeReviewInputFile;
    reviewedManifest: CylinderTypeReviewInputFile;
  };
};

export type CylinderCanonicalTypeReviewInput = {
  coverageManifest: CylinderApprovedCoverageManifest;
  canonicalRecords: CylinderCanonicalMasterRecord[];
  reviewedUnits: PsdReviewedUnit[];
  provenance?: CylinderCanonicalTypeReviewProvenance;
};

export type CylinderCanonicalTypeFields = {
  family: string;
  capacityMl: number;
  bodyHeightMm: number;
  widthAxisMm: number;
  secondAxisMm: number;
  neckThreadSize: string;
  applicator: string;
  capStyle: string;
};

export type CylinderCanonicalTypeReviewIdentity = {
  canonicalIdentityKey: string;
  canonical: CylinderCanonicalMasterRecord;
  referenceReady: boolean;
  blockers: CylinderApprovedCoverageBlocker[];
  approvedReferences: CylinderApprovedReference[];
  primaryReference: CylinderApprovedReference | null;
};

export type CylinderCanonicalTypeReferenceProvenance = CylinderApprovedReference & {
  canonicalIdentityKey: string;
  selected: boolean;
};

export type CylinderCanonicalTypeRepresentative = CylinderApprovedReference & {
  canonicalIdentityKey: string;
  foregroundBounds: { left: number; top: number; width: number; height: number };
  compositeWidth: number;
  compositeHeight: number;
  opaque: true;
};

export type CylinderCanonicalTypeScale = {
  contractVersion: typeof BEST_BOTTLES_CATALOG_SCALE_VERSION;
  status: "ready" | "blocked" | "unavailable";
  blocker: "canonical-with-cap-below-body" | "no-reference-ready-representative" | null;
  canonical: {
    capacityMl: number;
    bodyHeightMm: number;
    widthAxisMm: number;
    secondAxisMm: number;
    heightWithCapMm: number;
  };
  placement: {
    assembledHeightPct: number;
    bodyToAssembledRatio: number;
  } | null;
};

export type CylinderCanonicalTypeReviewType = {
  typeKey: string;
  status: "ready" | "blocked";
  canonical: CylinderCanonicalTypeFields;
  identities: CylinderCanonicalTypeReviewIdentity[];
  representative: CylinderCanonicalTypeRepresentative | null;
  approvedReferenceProvenance: CylinderCanonicalTypeReferenceProvenance[];
  scale: CylinderCanonicalTypeScale;
};

export type CylinderCanonicalBlockedIdentity = {
  canonicalIdentityKey: string;
  typeKey: string;
  canonical: CylinderCanonicalMasterRecord;
  blockers: CylinderApprovedCoverageBlocker[];
};

export type CylinderCanonicalCollapseCandidate = {
  candidateId: string;
  leftTypeKey: string;
  rightTypeKey: string;
  sharedCanonical: Omit<CylinderCanonicalTypeFields, "capStyle">;
  capStyles: [string, string];
  decision: "pending-human-review";
  applied: false;
};

export type CylinderCanonicalTypeReviewManifest = {
  version: "best-bottles-cylinder-canonical-type-review-v1";
  scaleContractVersion: typeof BEST_BOTTLES_CATALOG_SCALE_VERSION;
  provenance: CylinderCanonicalTypeReviewProvenance | null;
  summary: {
    canonicalIdentityCount: number;
    typeCount: number;
    readyTypeCount: number;
    blockedTypeCount: number;
    blockedIdentityCount: number;
    collapseCandidateCount: number;
    appliedCollapseCount: 0;
    externalWriteCount: 0;
  };
  types: CylinderCanonicalTypeReviewType[];
  blockedIdentities: CylinderCanonicalBlockedIdentity[];
  collapseCandidates: CylinderCanonicalCollapseCandidate[];
};

type ResolvedCoverageRow = {
  coverage: CylinderApprovedCoverageRow;
  canonical: CylinderCanonicalMasterRecord;
};

type ReviewedReferenceResolution = {
  unit: PsdReviewedUnit;
  source: PsdReviewedAuditRecord;
};

const TYPE_FIELDS = [
  "family",
  "capacityMl",
  "canon_bodyHeightMm",
  "canon_widthAxisMm",
  "canon_secondAxisMm",
  "neckThreadSize",
  "applicator",
  "capStyle",
] as const;

const COLLAPSE_CANDIDATE_SPECS = [
  { family: "Cylinder", capacityMl: 9, bodyHeightMm: 74, widthAxisMm: 21, secondAxisMm: 21, neckThreadSize: "17-415", applicator: "Metal Roller Ball", capStyles: ["Dot Cap", "Roll-On"] },
  { family: "Cylinder", capacityMl: 50, bodyHeightMm: 117, widthAxisMm: 32, secondAxisMm: 32, neckThreadSize: "18-415", applicator: "Lotion Pump", capStyles: ["Pump", "Screw Cap"] },
  { family: "Cylinder", capacityMl: 100, bodyHeightMm: 154, widthAxisMm: 35, secondAxisMm: 35, neckThreadSize: "18-415", applicator: "Lotion Pump", capStyles: ["Pump", "Screw Cap"] },
  { family: "Cylinder", capacityMl: 50, bodyHeightMm: 117, widthAxisMm: 32, secondAxisMm: 32, neckThreadSize: "18-415", applicator: "Vintage Bulb Sprayer with Tassel", capStyles: ["Spray", "Screw Cap"] },
  { family: "Cylinder", capacityMl: 100, bodyHeightMm: 154, widthAxisMm: 35, secondAxisMm: 35, neckThreadSize: "18-415", applicator: "Vintage Bulb Sprayer with Tassel", capStyles: ["Spray", "Screw Cap"] },
  { family: "Cylinder", capacityMl: 100, bodyHeightMm: 154, widthAxisMm: 35, secondAxisMm: 35, neckThreadSize: "18-415", applicator: "Vintage Bulb Sprayer", capStyles: ["Spray", "Screw Cap"] },
] as const;

function normalizedIdentity(value: string | null | undefined): string {
  return String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function normalizedText(value: string | null | undefined): string {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function positiveNumber(value: string, field: string): number {
  const parsed = Number(value.trim());
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Canonical master ${field} must be a positive finite number; received ${JSON.stringify(value)}.`);
  }
  return parsed;
}

function requiredText(value: string, field: string): string {
  const normalized = normalizedText(value);
  if (!normalized) throw new Error(`Canonical master ${field} must be nonempty.`);
  return normalized;
}

function identityKey(websiteSku: string, graceSku: string): string {
  const website = normalizedIdentity(websiteSku);
  const grace = normalizedIdentity(graceSku);
  if (!website || !grace) {
    throw new Error("Cylinder type review requires both Website and Grace SKU identity keys.");
  }
  return `${website}|${grace}`;
}

function exactCanonicalSignature(record: CylinderCanonicalMasterRecord): string {
  return JSON.stringify([
    normalizedIdentity(record.websiteSku),
    normalizedIdentity(record.graceSku),
    normalizedText(record.productGroupSlug),
    ...TYPE_FIELDS.map((field) => (
      field.startsWith("canon_") || field === "capacityMl"
        ? positiveNumber(record[field], field)
        : normalizedText(record[field])
    )),
    positiveNumber(record.canon_heightWithCapMm, "canon_heightWithCapMm"),
  ]);
}

function canonicalType(record: CylinderCanonicalMasterRecord): CylinderCanonicalTypeFields {
  return {
    family: requiredText(record.family, "family"),
    capacityMl: positiveNumber(record.capacityMl, "capacityMl"),
    bodyHeightMm: positiveNumber(record.canon_bodyHeightMm, "canon_bodyHeightMm"),
    widthAxisMm: positiveNumber(record.canon_widthAxisMm, "canon_widthAxisMm"),
    secondAxisMm: positiveNumber(record.canon_secondAxisMm, "canon_secondAxisMm"),
    neckThreadSize: normalizedText(record.neckThreadSize),
    applicator: normalizedText(record.applicator),
    capStyle: normalizedText(record.capStyle),
  };
}

function canonicalTypeKey(type: CylinderCanonicalTypeFields): string {
  return [
    type.family,
    type.capacityMl,
    type.bodyHeightMm,
    type.widthAxisMm,
    type.secondAxisMm,
    type.neckThreadSize,
    type.applicator,
    type.capStyle,
  ].join("|");
}

function assertCoverageMatchesCanonical(
  coverage: CylinderApprovedCoverageRow,
  canonical: CylinderCanonicalMasterRecord,
): void {
  const coverageCanonical = coverage.canonical;
  const same = normalizedIdentity(coverageCanonical.websiteSku) === normalizedIdentity(canonical.websiteSku)
    && normalizedIdentity(coverageCanonical.graceSku) === normalizedIdentity(canonical.graceSku)
    && normalizedText(coverageCanonical.family) === normalizedText(canonical.family)
    && normalizedText(coverageCanonical.productGroupSlug) === normalizedText(canonical.productGroupSlug)
    && positiveNumber(coverageCanonical.capacityMl, "coverage.capacityMl") === positiveNumber(canonical.capacityMl, "capacityMl")
    && positiveNumber(coverageCanonical.canon_bodyHeightMm, "coverage.canon_bodyHeightMm") === positiveNumber(canonical.canon_bodyHeightMm, "canon_bodyHeightMm")
    && positiveNumber(coverageCanonical.canon_widthAxisMm, "coverage.canon_widthAxisMm") === positiveNumber(canonical.canon_widthAxisMm, "canon_widthAxisMm")
    && positiveNumber(coverageCanonical.canon_secondAxisMm, "coverage.canon_secondAxisMm") === positiveNumber(canonical.canon_secondAxisMm, "canon_secondAxisMm")
    && positiveNumber(coverageCanonical.canon_heightWithCapMm, "coverage.canon_heightWithCapMm") === positiveNumber(canonical.canon_heightWithCapMm, "canon_heightWithCapMm");
  if (!same) {
    throw new Error(`Coverage and canonical master conflict for dual-SKU identity ${coverage.canonicalIdentityKey}.`);
  }
}

function resolveCoverageRows(input: CylinderCanonicalTypeReviewInput): ResolvedCoverageRow[] {
  if (input.coverageManifest.version !== "best-bottles-cylinder-approved-coverage-manifest-v1") {
    throw new Error(`Unsupported approved coverage manifest version: ${String(input.coverageManifest.version)}.`);
  }
  if (input.coverageManifest.summary.canonicalIdentityCount !== input.coverageManifest.rows.length) {
    throw new Error("Approved coverage summary canonical identity count does not match its rows.");
  }
  const readyCount = input.coverageManifest.rows.filter((row) => row.referenceReady).length;
  if (
    input.coverageManifest.summary.referenceReadyCount !== readyCount
    || input.coverageManifest.summary.blockedIdentityCount !== input.coverageManifest.rows.length - readyCount
  ) {
    throw new Error("Approved coverage ready/blocked summary counts do not match its rows.");
  }

  const canonicalByPair = new Map<string, CylinderCanonicalMasterRecord[]>();
  for (const record of input.canonicalRecords) {
    const key = identityKey(record.websiteSku, record.graceSku);
    canonicalByPair.set(key, [...(canonicalByPair.get(key) ?? []), record]);
  }

  const seenCoverageKeys = new Set<string>();
  return input.coverageManifest.rows.map((coverage) => {
    const recomputedKey = identityKey(coverage.canonical.websiteSku, coverage.canonical.graceSku);
    if (coverage.canonicalIdentityKey !== recomputedKey) {
      throw new Error(`Coverage canonical identity key mismatch for ${coverage.canonicalIdentityKey}.`);
    }
    if (seenCoverageKeys.has(recomputedKey)) {
      throw new Error(`Approved coverage contains duplicate dual-SKU identity ${recomputedKey}.`);
    }
    seenCoverageKeys.add(recomputedKey);
    const matches = canonicalByPair.get(recomputedKey) ?? [];
    if (matches.length === 0) {
      throw new Error(`Canonical master is missing exact dual-SKU row ${recomputedKey}.`);
    }
    if (matches.length > 1) {
      const signatures = new Set(matches.map(exactCanonicalSignature));
      const detail = signatures.size > 1 ? "conflicting" : "duplicate";
      throw new Error(`Found ${detail} canonical master rows for exact dual-SKU identity ${recomputedKey}.`);
    }
    assertCoverageMatchesCanonical(coverage, matches[0]);
    if (coverage.referenceReady && (coverage.blockers.length > 0 || coverage.primaryReference === null)) {
      throw new Error(`Reference-ready coverage identity ${recomputedKey} has blockers or no primary reference.`);
    }
    if (!coverage.referenceReady && coverage.blockers.length === 0) {
      throw new Error(`Blocked coverage identity ${recomputedKey} has no blocker code.`);
    }
    return { coverage, canonical: { ...matches[0] } };
  });
}

function indexReviewedUnits(reviewedUnits: readonly PsdReviewedUnit[]): Map<string, PsdReviewedUnit> {
  const byKey = new Map<string, PsdReviewedUnit>();
  for (const unit of reviewedUnits) {
    if (byKey.has(unit.reviewUnitKey)) {
      throw new Error(`Reviewed manifest contains duplicate review-unit key ${unit.reviewUnitKey}.`);
    }
    byKey.set(unit.reviewUnitKey, unit);
  }
  return byKey;
}

function resolveReviewedReference(input: {
  reference: CylinderApprovedReference;
  canonical: CylinderCanonicalMasterRecord;
  reviewedByKey: ReadonlyMap<string, PsdReviewedUnit>;
  role: "approved" | "primary";
}): ReviewedReferenceResolution {
  const unit = input.reviewedByKey.get(input.reference.reviewUnitKey);
  const label = `${input.role} reference for ${identityKey(input.canonical.websiteSku, input.canonical.graceSku)}`;
  if (!unit) throw new Error(`${label} does not resolve to a reviewed unit.`);
  if (
    unit.identityStatus !== "exact-website-sku"
    || normalizedIdentity(unit.websiteSku) !== normalizedIdentity(input.canonical.websiteSku)
    || normalizedIdentity(unit.graceSku) !== normalizedIdentity(input.canonical.graceSku)
    || normalizedText(unit.family) !== normalizedText(input.canonical.family)
  ) {
    throw new Error(`${label} has a reviewed-unit dual-SKU or family mismatch.`);
  }
  const sources = unit.sources.filter((source) => (
    source.sourcePath === input.reference.sourcePath
    && source.sourceSha256 === input.reference.sourceSha256
  ));
  if (sources.length !== 1) {
    throw new Error(`${label} must resolve to exactly one reviewed source.`);
  }
  const source = sources[0];
  if (
    source.identityStatus !== "exact-website-sku"
    || normalizedIdentity(source.websiteSku) !== normalizedIdentity(input.canonical.websiteSku)
    || normalizedIdentity(source.graceSku) !== normalizedIdentity(input.canonical.graceSku)
    || normalizedText(source.family) !== normalizedText(input.canonical.family)
    || unit.reviewStatus !== "approved"
    || source.reviewStatus !== "approved"
    || unit.classification !== input.reference.classification
    || source.humanClassification !== input.reference.classification
    || source.sourceRelativePath !== input.reference.sourceRelativePath
    || source.composite?.previewPath !== input.reference.previewPath
    || source.composite.evidenceSha256 !== input.reference.previewSha256
  ) {
    throw new Error(`${label} conflicts with its exact reviewed source evidence.`);
  }
  return { unit, source };
}

function approvedReferenceKey(reference: CylinderApprovedReference): string {
  return JSON.stringify([
    reference.reviewUnitKey,
    reference.sourcePath,
    reference.sourceRelativePath,
    reference.sourceSha256,
    reference.previewPath,
    reference.previewSha256,
    reference.classification,
  ]);
}

function reviewedResolutionKey(
  canonicalIdentityKey: string,
  reference: CylinderApprovedReference,
): string {
  return `${canonicalIdentityKey}\n${approvedReferenceKey(reference)}`;
}

function assertSelectedReferenceReady(
  identity: ResolvedCoverageRow,
  resolution: ReviewedReferenceResolution,
): asserts resolution is ReviewedReferenceResolution & {
  source: PsdReviewedAuditRecord & {
    composite: NonNullable<PsdReviewedAuditRecord["composite"]> & {
      foregroundBounds: NonNullable<NonNullable<PsdReviewedAuditRecord["composite"]>["foregroundBounds"]>;
      opaque: true;
    };
  };
} {
  const primary = identity.coverage.primaryReference;
  const composite = resolution.source.composite;
  if (
    primary === null
    || primary.classification !== "assembled-cap-on"
    || resolution.unit.classification !== "assembled-cap-on"
    || resolution.source.humanClassification !== "assembled-cap-on"
    || composite === null
    || composite.opaque !== true
    || !composite.previewPath.trim()
    || composite.foregroundBounds === null
    || !Number.isInteger(composite.foregroundBounds.left)
    || !Number.isInteger(composite.foregroundBounds.top)
    || !Number.isInteger(composite.foregroundBounds.width)
    || !Number.isInteger(composite.foregroundBounds.height)
    || composite.foregroundBounds.width <= 0
    || composite.foregroundBounds.height <= 0
  ) {
    throw new Error(
      `Selected primary reference for ${identity.coverage.canonicalIdentityKey} must be approved, assembled-cap-on, opaque, previewed, and carry composite foreground bounds.`,
    );
  }
}

function reviewIdentity(row: ResolvedCoverageRow): CylinderCanonicalTypeReviewIdentity {
  return {
    canonicalIdentityKey: row.coverage.canonicalIdentityKey,
    canonical: { ...row.canonical },
    referenceReady: row.coverage.referenceReady,
    blockers: [...row.coverage.blockers],
    approvedReferences: row.coverage.approvedReferences.map((reference) => ({ ...reference })),
    primaryReference: row.coverage.primaryReference === null
      ? null
      : { ...row.coverage.primaryReference },
  };
}

function scaleForType(input: {
  canonical: CylinderCanonicalMasterRecord;
  hasRepresentative: boolean;
}): CylinderCanonicalTypeScale {
  const canonical = {
    capacityMl: positiveNumber(input.canonical.capacityMl, "capacityMl"),
    bodyHeightMm: positiveNumber(input.canonical.canon_bodyHeightMm, "canon_bodyHeightMm"),
    widthAxisMm: positiveNumber(input.canonical.canon_widthAxisMm, "canon_widthAxisMm"),
    secondAxisMm: positiveNumber(input.canonical.canon_secondAxisMm, "canon_secondAxisMm"),
    heightWithCapMm: positiveNumber(input.canonical.canon_heightWithCapMm, "canon_heightWithCapMm"),
  };
  if (!input.hasRepresentative) {
    return {
      contractVersion: BEST_BOTTLES_CATALOG_SCALE_VERSION,
      status: "unavailable",
      blocker: "no-reference-ready-representative",
      canonical,
      placement: null,
    };
  }
  if (canonical.heightWithCapMm < canonical.bodyHeightMm) {
    return {
      contractVersion: BEST_BOTTLES_CATALOG_SCALE_VERSION,
      status: "blocked",
      blocker: "canonical-with-cap-below-body",
      canonical,
      placement: null,
    };
  }
  return {
    contractVersion: BEST_BOTTLES_CATALOG_SCALE_VERSION,
    status: "ready",
    blocker: null,
    canonical,
    placement: {
      assembledHeightPct: resolveBestBottlesGlobalScalePct(canonical.capacityMl),
      bodyToAssembledRatio: canonical.bodyHeightMm / canonical.heightWithCapMm,
    },
  };
}

function sameCandidateBase(
  left: CylinderCanonicalTypeReviewType,
  right: CylinderCanonicalTypeReviewType,
): boolean {
  return left.canonical.family === right.canonical.family
    && left.canonical.capacityMl === right.canonical.capacityMl
    && left.canonical.bodyHeightMm === right.canonical.bodyHeightMm
    && left.canonical.widthAxisMm === right.canonical.widthAxisMm
    && left.canonical.secondAxisMm === right.canonical.secondAxisMm
    && left.canonical.neckThreadSize === right.canonical.neckThreadSize
    && left.canonical.applicator === right.canonical.applicator;
}

function resolveCollapseCandidates(
  types: readonly CylinderCanonicalTypeReviewType[],
): CylinderCanonicalCollapseCandidate[] {
  return COLLAPSE_CANDIDATE_SPECS.map((spec, index) => {
    const applicator = normalizedText(spec.applicator);
    const leftCapStyle = normalizedText(spec.capStyles[0]);
    const rightCapStyle = normalizedText(spec.capStyles[1]);
    const leftTypes = types.filter((type) => (
      type.canonical.family === normalizedText(spec.family)
      && type.canonical.capacityMl === spec.capacityMl
      && type.canonical.bodyHeightMm === spec.bodyHeightMm
      && type.canonical.widthAxisMm === spec.widthAxisMm
      && type.canonical.secondAxisMm === spec.secondAxisMm
      && type.canonical.neckThreadSize === normalizedText(spec.neckThreadSize)
      && type.canonical.applicator === applicator
      && type.canonical.capStyle === leftCapStyle
    ));
    const rightTypes = types.filter((type) => (
      type.canonical.capacityMl === spec.capacityMl
      && type.canonical.applicator === applicator
      && type.canonical.capStyle === rightCapStyle
    ));
    const pairs = leftTypes.flatMap((left) => rightTypes
      .filter((right) => sameCandidateBase(left, right))
      .map((right) => ({ left, right })));
    if (pairs.length !== 1) {
      throw new Error(
        `Collapse candidate ${index + 1} did not resolve uniquely; found ${pairs.length} exact type pairs.`,
      );
    }
    const { left, right } = pairs[0];
    const sharedCanonical = {
      family: left.canonical.family,
      capacityMl: left.canonical.capacityMl,
      bodyHeightMm: left.canonical.bodyHeightMm,
      widthAxisMm: left.canonical.widthAxisMm,
      secondAxisMm: left.canonical.secondAxisMm,
      neckThreadSize: left.canonical.neckThreadSize,
      applicator: left.canonical.applicator,
    };
    return {
      candidateId: `cylinder-collapse-candidate-${String(index + 1).padStart(2, "0")}`,
      leftTypeKey: left.typeKey,
      rightTypeKey: right.typeKey,
      sharedCanonical,
      capStyles: [spec.capStyles[0], spec.capStyles[1]],
      decision: "pending-human-review",
      applied: false,
    };
  });
}

export function buildCylinderCanonicalTypeReview(
  input: CylinderCanonicalTypeReviewInput,
): CylinderCanonicalTypeReviewManifest {
  const resolvedRows = resolveCoverageRows(input);
  const reviewedByKey = indexReviewedUnits(input.reviewedUnits);
  const resolvedReferences = new Map<string, ReviewedReferenceResolution>();
  for (const row of resolvedRows) {
    const primaryKey = row.coverage.primaryReference === null
      ? null
      : approvedReferenceKey(row.coverage.primaryReference);
    const matchingPrimaryReferences = primaryKey === null
      ? []
      : row.coverage.approvedReferences.filter((reference) => (
        approvedReferenceKey(reference) === primaryKey
      ));
    if (primaryKey !== null && matchingPrimaryReferences.length !== 1) {
      throw new Error(`Coverage primary reference is not preserved uniquely in approved references for ${row.coverage.canonicalIdentityKey}.`);
    }
    for (const reference of row.coverage.approvedReferences) {
      resolvedReferences.set(reviewedResolutionKey(row.coverage.canonicalIdentityKey, reference), resolveReviewedReference({
        reference,
        canonical: row.canonical,
        reviewedByKey,
        role: approvedReferenceKey(reference) === primaryKey ? "primary" : "approved",
      }));
    }
  }

  const rowsByType = new Map<string, { canonical: CylinderCanonicalTypeFields; rows: ResolvedCoverageRow[] }>();
  for (const row of resolvedRows) {
    const canonical = canonicalType(row.canonical);
    const typeKey = canonicalTypeKey(canonical);
    const group = rowsByType.get(typeKey) ?? { canonical, rows: [] };
    group.rows.push(row);
    rowsByType.set(typeKey, group);
  }

  const types = [...rowsByType.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([typeKey, group]): CylinderCanonicalTypeReviewType => {
      const rows = [...group.rows].sort((left, right) => (
        left.coverage.canonicalIdentityKey.localeCompare(right.coverage.canonicalIdentityKey)
      ));
      const representativeIdentity = rows.find((row) => row.coverage.referenceReady) ?? null;
      let representative: CylinderCanonicalTypeRepresentative | null = null;
      if (representativeIdentity !== null) {
        const primary = representativeIdentity.coverage.primaryReference;
        if (primary === null) {
          throw new Error(`Reference-ready identity ${representativeIdentity.coverage.canonicalIdentityKey} has no primary reference.`);
        }
        const resolution = resolvedReferences.get(reviewedResolutionKey(
          representativeIdentity.coverage.canonicalIdentityKey,
          primary,
        ));
        if (!resolution) {
          throw new Error(`Selected primary reference for ${representativeIdentity.coverage.canonicalIdentityKey} has no reviewed resolution.`);
        }
        assertSelectedReferenceReady(representativeIdentity, resolution);
        representative = {
          ...primary,
          canonicalIdentityKey: representativeIdentity.coverage.canonicalIdentityKey,
          foregroundBounds: { ...resolution.source.composite.foregroundBounds },
          compositeWidth: resolution.source.composite.width,
          compositeHeight: resolution.source.composite.height,
          opaque: true,
        };
      }
      const approvedReferenceProvenance = rows.flatMap((row) => (
        row.coverage.approvedReferences.map((reference) => ({
          ...reference,
          canonicalIdentityKey: row.coverage.canonicalIdentityKey,
          selected: representative !== null
            && representative.canonicalIdentityKey === row.coverage.canonicalIdentityKey
            && representative.reviewUnitKey === reference.reviewUnitKey
            && representative.sourcePath === reference.sourcePath
            && representative.sourceSha256 === reference.sourceSha256,
        }))
      )).sort((left, right) => (
        left.canonicalIdentityKey.localeCompare(right.canonicalIdentityKey)
        || left.sourceSha256.localeCompare(right.sourceSha256)
        || left.sourcePath.localeCompare(right.sourcePath)
      ));
      return {
        typeKey,
        status: representative === null ? "blocked" : "ready",
        canonical: group.canonical,
        identities: rows.map(reviewIdentity),
        representative,
        approvedReferenceProvenance,
        scale: scaleForType({
          canonical: representativeIdentity?.canonical ?? rows[0].canonical,
          hasRepresentative: representative !== null,
        }),
      };
    });

  const typeKeyByIdentity = new Map(types.flatMap((type) => (
    type.identities.map((identity) => [identity.canonicalIdentityKey, type.typeKey] as const)
  )));
  const blockedIdentities = resolvedRows
    .filter((row) => !row.coverage.referenceReady)
    .map((row): CylinderCanonicalBlockedIdentity => ({
      canonicalIdentityKey: row.coverage.canonicalIdentityKey,
      typeKey: typeKeyByIdentity.get(row.coverage.canonicalIdentityKey)!,
      canonical: { ...row.canonical },
      blockers: [...row.coverage.blockers],
    }))
    .sort((left, right) => left.canonicalIdentityKey.localeCompare(right.canonicalIdentityKey));
  const collapseCandidates = resolveCollapseCandidates(types);
  const readyTypeCount = types.filter((type) => type.status === "ready").length;
  return {
    version: "best-bottles-cylinder-canonical-type-review-v1",
    scaleContractVersion: BEST_BOTTLES_CATALOG_SCALE_VERSION,
    provenance: input.provenance ?? null,
    summary: {
      canonicalIdentityCount: resolvedRows.length,
      typeCount: types.length,
      readyTypeCount,
      blockedTypeCount: types.length - readyTypeCount,
      blockedIdentityCount: blockedIdentities.length,
      collapseCandidateCount: collapseCandidates.length,
      appliedCollapseCount: 0,
      externalWriteCount: 0,
    },
    types,
    blockedIdentities,
    collapseCandidates,
  };
}
