import type {
  PsdReviewedAuditRecord,
  PsdReviewedUnit,
} from "./bestBottlesPsdReviewDecisions";

export type CanonicalCylinderCoverageRow = {
  websiteSku: string;
  graceSku: string;
  family: "Cylinder" | "Tall Cylinder";
  productGroupSlug: string;
  capacityMl: string;
  canon_bodyHeightMm: string;
  canon_widthAxisMm: string;
  canon_secondAxisMm: string;
  canon_heightWithCapMm: string;
};

export type CanonicalBodyGeometryRow = {
  family: "Cylinder" | "Tall Cylinder";
  capacityMl: string;
  bodyHeightMm: string;
  widthAxisMm: string;
  depthAxisMm: string;
  productGroupSlugs: string;
};

export type CylinderApprovedCoverageBlocker =
  | "no-approved-exact-reference"
  | "no-approved-assembled-cap-on-reference"
  | "missing-canon-body-height-mm"
  | "missing-canon-width-axis-mm"
  | "missing-canon-second-axis-mm"
  | "missing-canon-height-with-cap-mm"
  | "missing-canonical-body-geometry"
  | "ambiguous-canonical-body-geometry"
  | "canonical-identity-conflict";

export type CylinderApprovedReference = {
  sourcePath: string;
  sourceRelativePath: string;
  sourceSha256: string;
  previewPath: string;
  previewSha256: string;
  classification: PsdReviewedUnit["classification"];
  reviewUnitKey: string;
};

export type CylinderBodyMatch =
  | {
      method: "product-group-slug";
      bodyGeometry: CanonicalBodyGeometryRow;
    }
  | {
      method: "canonical-axes";
      bodyGeometry: CanonicalBodyGeometryRow;
    }
  | {
      method: "none";
      bodyGeometry: null;
    };

export type CylinderApprovedCoverageRow = {
  canonicalIdentityKey: string;
  canonical: CanonicalCylinderCoverageRow;
  approvedReferences: CylinderApprovedReference[];
  primaryReference: CylinderApprovedReference | null;
  bodyMatch: CylinderBodyMatch;
  blockers: CylinderApprovedCoverageBlocker[];
  referenceReady: boolean;
};

export type CylinderBodyCoverage = {
  bodyGeometry: CanonicalBodyGeometryRow;
  canonicalIdentityKeys: string[];
  referenceReadyIdentityKeys: string[];
  blockedIdentityKeys: string[];
};

export type CylinderApprovedCoverageManifest = {
  version: "best-bottles-cylinder-approved-coverage-manifest-v1";
  summary: {
    canonicalIdentityCount: number;
    referenceReadyCount: number;
    blockedIdentityCount: number;
    canonicalBodyCount: number;
    coveredBodyCount: number;
    externalWriteCount: 0;
  };
  rows: CylinderApprovedCoverageRow[];
  bodyCoverage: CylinderBodyCoverage[];
};

const REQUIRED_CANONICAL_AXES: readonly {
  field: keyof Pick<
    CanonicalCylinderCoverageRow,
    "canon_bodyHeightMm" | "canon_widthAxisMm" | "canon_secondAxisMm" | "canon_heightWithCapMm"
  >;
  blocker: CylinderApprovedCoverageBlocker;
}[] = [
  {
    field: "canon_bodyHeightMm",
    blocker: "missing-canon-body-height-mm",
  },
  {
    field: "canon_widthAxisMm",
    blocker: "missing-canon-width-axis-mm",
  },
  {
    field: "canon_secondAxisMm",
    blocker: "missing-canon-second-axis-mm",
  },
  {
    field: "canon_heightWithCapMm",
    blocker: "missing-canon-height-with-cap-mm",
  },
];

function normalizedIdentity(value: string | null | undefined): string {
  return String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function canonicalIdentityKey(row: CanonicalCylinderCoverageRow): string {
  return `${normalizedIdentity(row.websiteSku)}|${normalizedIdentity(row.graceSku)}`;
}

function canonicalSignature(row: CanonicalCylinderCoverageRow): string {
  return JSON.stringify([
    row.websiteSku,
    row.graceSku,
    row.family,
    row.productGroupSlug,
    row.capacityMl,
    row.canon_bodyHeightMm,
    row.canon_widthAxisMm,
    row.canon_secondAxisMm,
    row.canon_heightWithCapMm,
  ]);
}

function nonempty(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim() !== "";
}

function normalizeDimension(value: string): string | null {
  if (!nonempty(value)) return null;
  const numberValue = Number(value.trim());
  return Number.isFinite(numberValue) && numberValue > 0 ? String(numberValue) : null;
}

function productGroupSlugs(value: string): string[] {
  return value
    .split(/[;,\n|]/)
    .map((slug) => slug.trim())
    .filter(Boolean);
}

function hasProductGroupSlug(body: CanonicalBodyGeometryRow, productGroupSlug: string): boolean {
  return nonempty(productGroupSlug) && productGroupSlugs(body.productGroupSlugs).includes(productGroupSlug.trim());
}

function hasUsableCompositeEvidence(source: PsdReviewedAuditRecord): boolean {
  const composite = source.composite;
  return composite !== null
    && Number.isInteger(composite.width)
    && composite.width > 0
    && Number.isInteger(composite.height)
    && composite.height > 0
    && Number.isInteger(composite.sceneCount)
    && composite.sceneCount > 0
    && nonempty(composite.previewPath)
    && /^[a-f0-9]{64}$/i.test(composite.evidenceSha256)
    && /^[a-f0-9]{64}$/i.test(source.sourceSha256);
}

function matchingExactIdentity(
  unit: Pick<PsdReviewedUnit, "websiteSku" | "graceSku" | "family" | "identityStatus">,
  canonical: CanonicalCylinderCoverageRow,
): "match" | "conflict" | "no-match" {
  const canonicalWebsiteSku = normalizedIdentity(canonical.websiteSku);
  const canonicalGraceSku = normalizedIdentity(canonical.graceSku);
  const websiteSku = normalizedIdentity(unit.websiteSku);
  const graceSku = normalizedIdentity(unit.graceSku);
  const completeIdentity = canonicalWebsiteSku !== ""
    && canonicalGraceSku !== ""
    && websiteSku !== ""
    && graceSku !== "";
  const websiteMatches = completeIdentity && websiteSku === canonicalWebsiteSku;
  const graceMatches = completeIdentity && graceSku === canonicalGraceSku;
  const familyMatches = unit.family === canonical.family;

  if (
    !["exact-website-sku", "reviewed-alias"].includes(unit.identityStatus)
    || !completeIdentity
  ) return "no-match";
  if (familyMatches && websiteMatches && graceMatches) return "match";
  return websiteMatches || graceMatches ? "conflict" : "no-match";
}

function approvedReferencesForCanonical(input: {
  canonical: CanonicalCylinderCoverageRow;
  reviewedUnits: readonly PsdReviewedUnit[];
}): { references: CylinderApprovedReference[]; hasIdentityConflict: boolean } {
  const references = new Map<string, CylinderApprovedReference>();
  let hasIdentityConflict = false;

  for (const unit of input.reviewedUnits) {
    const identityMatch = matchingExactIdentity(unit, input.canonical);
    if (identityMatch === "conflict") {
      hasIdentityConflict = true;
      continue;
    }
    if (identityMatch !== "match" || unit.reviewStatus !== "approved") continue;

    for (const source of unit.sources) {
      const sourceIdentityMatch = matchingExactIdentity(source, input.canonical);
      if (sourceIdentityMatch === "conflict") {
        hasIdentityConflict = true;
        continue;
      }
      if (
        sourceIdentityMatch !== "match"
        || source.humanClassification !== unit.classification
        || source.reviewStatus !== "approved"
        || !hasUsableCompositeEvidence(source)
      ) {
        continue;
      }

      const reference: CylinderApprovedReference = {
        sourcePath: source.sourcePath,
        sourceRelativePath: source.sourceRelativePath,
        sourceSha256: source.sourceSha256,
        previewPath: source.composite.previewPath,
        previewSha256: source.composite.evidenceSha256,
        classification: unit.classification,
        reviewUnitKey: unit.reviewUnitKey,
      };
      references.set(`${reference.sourceSha256}|${reference.sourcePath}`, reference);
    }
  }

  return {
    references: [...references.values()].sort((left, right) => (
      left.sourceSha256.localeCompare(right.sourceSha256)
      || left.sourcePath.localeCompare(right.sourcePath)
      || left.previewSha256.localeCompare(right.previewSha256)
    )),
    hasIdentityConflict,
  };
}

function primaryReference(references: readonly CylinderApprovedReference[]): CylinderApprovedReference | null {
  return [...references].sort((left, right) => (
    Number(right.classification === "assembled-cap-on") - Number(left.classification === "assembled-cap-on")
    || left.sourceSha256.localeCompare(right.sourceSha256)
    || left.sourcePath.localeCompare(right.sourcePath)
    || left.previewSha256.localeCompare(right.previewSha256)
  ))[0] ?? null;
}

function canonicalAxisFallbackMatches(
  canonical: CanonicalCylinderCoverageRow,
  bodyGeometryRows: readonly CanonicalBodyGeometryRow[],
): CanonicalBodyGeometryRow[] {
  const canonicalBodyHeight = normalizeDimension(canonical.canon_bodyHeightMm);
  const canonicalWidth = normalizeDimension(canonical.canon_widthAxisMm);
  const canonicalSecondAxis = normalizeDimension(canonical.canon_secondAxisMm);
  if (canonicalBodyHeight === null || canonicalWidth === null || canonicalSecondAxis === null) {
    return [];
  }

  return bodyGeometryRows.filter((body) => (
    body.family === canonical.family
    && body.capacityMl.trim() === canonical.capacityMl.trim()
    && normalizeDimension(body.bodyHeightMm) === canonicalBodyHeight
    && normalizeDimension(body.widthAxisMm) === canonicalWidth
    && normalizeDimension(body.depthAxisMm) === canonicalSecondAxis
  ));
}

function bodyMatchForCanonical(input: {
  canonical: CanonicalCylinderCoverageRow;
  bodyGeometryRows: readonly CanonicalBodyGeometryRow[];
}): { bodyMatch: CylinderBodyMatch; blocker: CylinderApprovedCoverageBlocker | null } {
  const productGroupMatches = input.bodyGeometryRows.filter((body) => (
    hasProductGroupSlug(body, input.canonical.productGroupSlug)
  ));
  if (productGroupMatches.length === 1) {
    return {
      bodyMatch: { method: "product-group-slug", bodyGeometry: productGroupMatches[0] },
      blocker: null,
    };
  }
  if (productGroupMatches.length > 1) {
    const canonicalAxisMatches = canonicalAxisFallbackMatches(
      input.canonical,
      productGroupMatches,
    );
    if (canonicalAxisMatches.length === 1) {
      return {
        bodyMatch: { method: "canonical-axes", bodyGeometry: canonicalAxisMatches[0] },
        blocker: null,
      };
    }
    return {
      bodyMatch: { method: "none", bodyGeometry: null },
      blocker: "ambiguous-canonical-body-geometry",
    };
  }

  const canonicalAxisMatches = canonicalAxisFallbackMatches(
    input.canonical,
    input.bodyGeometryRows,
  );
  if (canonicalAxisMatches.length === 1) {
    return {
      bodyMatch: { method: "canonical-axes", bodyGeometry: canonicalAxisMatches[0] },
      blocker: null,
    };
  }
  return {
    bodyMatch: { method: "none", bodyGeometry: null },
    blocker: canonicalAxisMatches.length > 1
      ? "ambiguous-canonical-body-geometry"
      : "missing-canonical-body-geometry",
  };
}

function conflictIdentityKeys(canonicalRows: readonly CanonicalCylinderCoverageRow[]): Set<string> {
  const signaturesByWebsiteSku = new Map<string, Set<string>>();
  const signaturesByGraceSku = new Map<string, Set<string>>();

  for (const row of canonicalRows) {
    const signature = canonicalSignature(row);
    const websiteSku = normalizedIdentity(row.websiteSku);
    const graceSku = normalizedIdentity(row.graceSku);
    if (websiteSku) {
      const signatures = signaturesByWebsiteSku.get(websiteSku) ?? new Set<string>();
      signatures.add(signature);
      signaturesByWebsiteSku.set(websiteSku, signatures);
    }
    if (graceSku) {
      const signatures = signaturesByGraceSku.get(graceSku) ?? new Set<string>();
      signatures.add(signature);
      signaturesByGraceSku.set(graceSku, signatures);
    }
  }

  const conflictKeys = new Set<string>();
  for (const row of canonicalRows) {
    const websiteConflict = (signaturesByWebsiteSku.get(normalizedIdentity(row.websiteSku))?.size ?? 0) > 1;
    const graceConflict = (signaturesByGraceSku.get(normalizedIdentity(row.graceSku))?.size ?? 0) > 1;
    if (websiteConflict || graceConflict) conflictKeys.add(canonicalIdentityKey(row));
  }
  return conflictKeys;
}

function addMissingCanonicalDimensionBlockers(
  blockers: CylinderApprovedCoverageBlocker[],
  canonical: CanonicalCylinderCoverageRow,
): void {
  for (const requiredAxis of REQUIRED_CANONICAL_AXES) {
    if (!nonempty(canonical[requiredAxis.field])) blockers.push(requiredAxis.blocker);
  }
}

function indexOfBodyRow(
  bodyGeometryRows: readonly CanonicalBodyGeometryRow[],
  body: CanonicalBodyGeometryRow,
): number {
  return bodyGeometryRows.indexOf(body);
}

export function buildCylinderApprovedCoverageManifest(input: {
  canonicalRows: readonly CanonicalCylinderCoverageRow[];
  bodyGeometryRows: readonly CanonicalBodyGeometryRow[];
  reviewedUnits: readonly PsdReviewedUnit[];
}): CylinderApprovedCoverageManifest {
  const canonicalIdentityConflicts = conflictIdentityKeys(input.canonicalRows);
  const rows = input.canonicalRows.map((canonical) => {
    const blockers: CylinderApprovedCoverageBlocker[] = [];
    addMissingCanonicalDimensionBlockers(blockers, canonical);

    const { references, hasIdentityConflict } = approvedReferencesForCanonical({
      canonical,
      reviewedUnits: input.reviewedUnits,
    });
    if (canonicalIdentityConflicts.has(canonicalIdentityKey(canonical)) || hasIdentityConflict) {
      blockers.push("canonical-identity-conflict");
    }
    if (references.length === 0) blockers.push("no-approved-exact-reference");

    const { bodyMatch, blocker: bodyBlocker } = bodyMatchForCanonical({
      canonical,
      bodyGeometryRows: input.bodyGeometryRows,
    });
    if (bodyBlocker !== null) blockers.push(bodyBlocker);

    const primary = primaryReference(references);
    const hasAssembledCapOnReference = references.some((reference) => (
      reference.classification === "assembled-cap-on"
    ));
    if (references.length > 0 && !hasAssembledCapOnReference) {
      blockers.push("no-approved-assembled-cap-on-reference");
    }
    return {
      canonicalIdentityKey: canonicalIdentityKey(canonical),
      canonical: { ...canonical },
      approvedReferences: references,
      primaryReference: primary,
      bodyMatch,
      blockers,
      referenceReady: blockers.length === 0
        && primary !== null
        && hasAssembledCapOnReference
        && bodyMatch.method !== "none",
    } satisfies CylinderApprovedCoverageRow;
  });

  const bodyCoverage = input.bodyGeometryRows.map((bodyGeometry) => {
    const matchingRows = rows.filter((row) => (
      row.bodyMatch.method !== "none"
      && indexOfBodyRow(input.bodyGeometryRows, row.bodyMatch.bodyGeometry) === indexOfBodyRow(input.bodyGeometryRows, bodyGeometry)
    ));
    return {
      bodyGeometry: { ...bodyGeometry },
      canonicalIdentityKeys: matchingRows.map((row) => row.canonicalIdentityKey),
      referenceReadyIdentityKeys: matchingRows
        .filter((row) => row.referenceReady)
        .map((row) => row.canonicalIdentityKey),
      blockedIdentityKeys: matchingRows
        .filter((row) => !row.referenceReady)
        .map((row) => row.canonicalIdentityKey),
    } satisfies CylinderBodyCoverage;
  });

  const referenceReadyCount = rows.filter((row) => row.referenceReady).length;
  return {
    version: "best-bottles-cylinder-approved-coverage-manifest-v1",
    summary: {
      canonicalIdentityCount: rows.length,
      referenceReadyCount,
      blockedIdentityCount: rows.length - referenceReadyCount,
      canonicalBodyCount: bodyCoverage.length,
      coveredBodyCount: bodyCoverage.filter((body) => body.referenceReadyIdentityKeys.length > 0).length,
      externalWriteCount: 0,
    },
    rows,
    bodyCoverage,
  };
}
