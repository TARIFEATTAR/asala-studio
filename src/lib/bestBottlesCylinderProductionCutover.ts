export const BEST_BOTTLES_CYLINDER_MIN_REFERENCE_PIXELS = 1_000_000;
export const BEST_BOTTLES_CYLINDER_PRODUCTION_READINESS_VERSION =
  "best-bottles-cylinder-production-readiness-v1" as const;

export type CylinderProductionCanonicalIdentity = {
  websiteSku: string;
  graceSku: string;
  family: string;
  productGroupSlug: string;
  capacityMl: string;
  canon_bodyHeightMm: string;
  canon_widthAxisMm: string;
  canon_secondAxisMm: string;
  canon_heightWithCapMm: string;
};

type ArtifactInputProvenance = {
  path: string;
  sha256: string;
};

export type CylinderReferenceProductionArtifact = {
  version: string;
  provenance: {
    inputs: {
      coverageManifest: ArtifactInputProvenance;
      reviewedManifest: ArtifactInputProvenance;
      [key: string]: ArtifactInputProvenance;
    };
  };
  summary: {
    canonicalIdentityCount: number;
    exportQualifiedCount: number;
    blockedIdentityCount: number;
    externalWriteCount: number;
    [key: string]: number;
  };
  planVersion: string;
  exports: Array<{
    canonicalIdentityKey: string;
    canonical: CylinderProductionCanonicalIdentity;
    source: {
      sourcePath: string;
      sourceRelativePath: string;
      sourceSha256: string;
      reviewer: string;
      reviewedAt: string;
      capState: string;
      [key: string]: unknown;
    };
    output: {
      path: string;
      filename: string;
      sha256: string;
      bytes: number;
      format: string;
      width: number;
      height: number;
      opaque: boolean;
      colorspace: string;
      primaryBounds: {
        left: number;
        top: number;
        width: number;
        height: number;
      };
    };
    [key: string]: unknown;
  }>;
};

export type CylinderReferenceBlockerArtifact = {
  version: string;
  provenance: CylinderReferenceProductionArtifact["provenance"];
  summary: CylinderReferenceProductionArtifact["summary"];
  planVersion: string;
  blockedIdentities: Array<{
    canonicalIdentityKey: string;
    canonical: CylinderProductionCanonicalIdentity;
    blockers: string[];
    lane: string;
    approvedReferenceCount: number;
    primaryReference: unknown;
  }>;
};

export type CylinderProductionReadinessBlocker =
  | "reference-below-minimum-pixels"
  | string;

export type CylinderProductionReadinessRow = {
  canonicalIdentityKey: string;
  websiteSku: string;
  graceSku: string;
  status: "production-qualified" | "blocked";
  blockers: CylinderProductionReadinessBlocker[];
  blockerLane: string | null;
  canonical: CylinderProductionCanonicalIdentity;
  reference: {
    filename: string;
    sourceSha256: string;
    exportSha256: string;
    width: number;
    height: number;
    pixelCount: number;
    opaque: true;
    capState: string;
    reviewer: string;
    reviewedAt: string;
  } | null;
};

export type CylinderProductionReadinessArtifact = {
  version: typeof BEST_BOTTLES_CYLINDER_PRODUCTION_READINESS_VERSION;
  minimumReferencePixels: number;
  provenance: {
    referenceProductionVersion: string;
    referenceProductionPlanVersion: string;
    coverageManifestSha256: string;
    reviewedManifestSha256: string;
  };
  summary: {
    canonicalIdentityCount: number;
    localReferenceExportCount: number;
    productionQualifiedCount: number;
    belowMinimumPixelsCount: number;
    evidenceBlockedCount: number;
    totalBlockedCount: number;
    externalWriteCount: 0;
  };
  rows: CylinderProductionReadinessRow[];
};

function normalizedIdentity(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function expectedIdentityKey(canonical: CylinderProductionCanonicalIdentity): string {
  return `${normalizedIdentity(canonical.websiteSku)}|${normalizedIdentity(canonical.graceSku)}`;
}

function assertCanonicalIdentity(
  canonicalIdentityKey: string,
  canonical: CylinderProductionCanonicalIdentity,
): void {
  const expected = expectedIdentityKey(canonical);
  if (!normalizedIdentity(canonical.websiteSku) || !normalizedIdentity(canonical.graceSku)) {
    throw new Error(`Canonical identity ${canonicalIdentityKey} is missing Website or Grace SKU.`);
  }
  if (canonicalIdentityKey !== expected) {
    throw new Error(
      `Canonical identity key ${canonicalIdentityKey} does not match exact Website + Grace SKU ${expected}.`,
    );
  }
  for (const field of [
    "canon_bodyHeightMm",
    "canon_widthAxisMm",
    "canon_secondAxisMm",
    "canon_heightWithCapMm",
  ] as const) {
    const parsed = Number(canonical[field]);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new Error(`Canonical identity ${canonicalIdentityKey} has invalid ${field}.`);
    }
  }
}

function assertSha256(value: string, label: string): void {
  if (!/^[a-f0-9]{64}$/i.test(value)) throw new Error(`${label} must be a SHA-256 hash.`);
}

export function buildCylinderProductionReadiness(input: {
  productionArtifact: CylinderReferenceProductionArtifact;
  blockerArtifact: CylinderReferenceBlockerArtifact;
  minimumReferencePixels?: number;
}): CylinderProductionReadinessArtifact {
  const minimumReferencePixels =
    input.minimumReferencePixels ?? BEST_BOTTLES_CYLINDER_MIN_REFERENCE_PIXELS;
  if (!Number.isInteger(minimumReferencePixels) || minimumReferencePixels <= 0) {
    throw new Error("Minimum reference pixels must be a positive integer.");
  }
  if (input.productionArtifact.version !== input.blockerArtifact.version) {
    throw new Error("Reference production and blocker artifacts have different versions.");
  }
  if (input.productionArtifact.planVersion !== input.blockerArtifact.planVersion) {
    throw new Error("Reference production and blocker artifacts have different plan versions.");
  }
  if (
    input.productionArtifact.summary.externalWriteCount !== 0 ||
    input.blockerArtifact.summary.externalWriteCount !== 0
  ) {
    throw new Error("Reference artifacts must prove zero external writes.");
  }

  const rows: CylinderProductionReadinessRow[] = [];
  const seen = new Set<string>();
  const recordIdentity = (key: string): void => {
    if (seen.has(key)) throw new Error(`Duplicate canonical identity ${key}.`);
    seen.add(key);
  };

  for (const item of input.productionArtifact.exports) {
    assertCanonicalIdentity(item.canonicalIdentityKey, item.canonical);
    recordIdentity(item.canonicalIdentityKey);
    assertSha256(item.source.sourceSha256, `${item.canonicalIdentityKey} source hash`);
    assertSha256(item.output.sha256, `${item.canonicalIdentityKey} export hash`);
    if (
      item.output.format.toUpperCase() !== "PNG" ||
      item.output.opaque !== true ||
      !Number.isInteger(item.output.width) ||
      !Number.isInteger(item.output.height) ||
      item.output.width <= 0 ||
      item.output.height <= 0
    ) {
      throw new Error(`${item.canonicalIdentityKey} is not a native opaque PNG export.`);
    }
    const pixelCount = item.output.width * item.output.height;
    const productionQualified = pixelCount >= minimumReferencePixels;
    rows.push({
      canonicalIdentityKey: item.canonicalIdentityKey,
      websiteSku: item.canonical.websiteSku,
      graceSku: item.canonical.graceSku,
      status: productionQualified ? "production-qualified" : "blocked",
      blockers: productionQualified ? [] : ["reference-below-minimum-pixels"],
      blockerLane: productionQualified ? null : "technical-reference-resolution",
      canonical: { ...item.canonical },
      reference: {
        filename: item.output.filename,
        sourceSha256: item.source.sourceSha256,
        exportSha256: item.output.sha256,
        width: item.output.width,
        height: item.output.height,
        pixelCount,
        opaque: true,
        capState: item.source.capState,
        reviewer: item.source.reviewer,
        reviewedAt: item.source.reviewedAt,
      },
    });
  }

  for (const item of input.blockerArtifact.blockedIdentities) {
    assertCanonicalIdentity(item.canonicalIdentityKey, item.canonical);
    recordIdentity(item.canonicalIdentityKey);
    if (item.blockers.length === 0) {
      throw new Error(`Blocked identity ${item.canonicalIdentityKey} has no blocker reason.`);
    }
    rows.push({
      canonicalIdentityKey: item.canonicalIdentityKey,
      websiteSku: item.canonical.websiteSku,
      graceSku: item.canonical.graceSku,
      status: "blocked",
      blockers: [...item.blockers],
      blockerLane: item.lane,
      canonical: { ...item.canonical },
      reference: null,
    });
  }

  const expectedCanonicalCount = input.productionArtifact.summary.canonicalIdentityCount;
  if (rows.length !== expectedCanonicalCount) {
    throw new Error(
      `Cylinder readiness resolved ${rows.length}/${expectedCanonicalCount} canonical identities.`,
    );
  }
  if (input.productionArtifact.exports.length !== input.productionArtifact.summary.exportQualifiedCount) {
    throw new Error("Reference export count does not match the production artifact summary.");
  }
  if (input.blockerArtifact.blockedIdentities.length !== input.productionArtifact.summary.blockedIdentityCount) {
    throw new Error("Evidence blocker count does not match the production artifact summary.");
  }

  rows.sort((left, right) =>
    left.graceSku.localeCompare(right.graceSku) || left.websiteSku.localeCompare(right.websiteSku),
  );
  const belowMinimumPixelsCount = rows.filter((row) =>
    row.blockers.includes("reference-below-minimum-pixels"),
  ).length;
  const productionQualifiedCount = rows.filter(
    (row) => row.status === "production-qualified",
  ).length;
  const evidenceBlockedCount = input.blockerArtifact.blockedIdentities.length;

  return {
    version: BEST_BOTTLES_CYLINDER_PRODUCTION_READINESS_VERSION,
    minimumReferencePixels,
    provenance: {
      referenceProductionVersion: input.productionArtifact.version,
      referenceProductionPlanVersion: input.productionArtifact.planVersion,
      coverageManifestSha256:
        input.productionArtifact.provenance.inputs.coverageManifest.sha256,
      reviewedManifestSha256:
        input.productionArtifact.provenance.inputs.reviewedManifest.sha256,
    },
    summary: {
      canonicalIdentityCount: rows.length,
      localReferenceExportCount: input.productionArtifact.exports.length,
      productionQualifiedCount,
      belowMinimumPixelsCount,
      evidenceBlockedCount,
      totalBlockedCount: belowMinimumPixelsCount + evidenceBlockedCount,
      externalWriteCount: 0,
    },
    rows,
  };
}

export function cylinderProductionIdentityKey(
  websiteSku: string | null | undefined,
  graceSku: string | null | undefined,
): string | null {
  const website = normalizedIdentity(String(websiteSku ?? ""));
  const grace = normalizedIdentity(String(graceSku ?? ""));
  return website && grace ? `${website}|${grace}` : null;
}
