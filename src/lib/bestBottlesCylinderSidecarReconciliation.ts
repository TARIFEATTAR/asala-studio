import { createHash } from "node:crypto";

export const CYLINDER_SIDECAR_RECONCILIATION_VERSION =
  "best-bottles-cylinder-sidecar-reconciliation-v2" as const;

export interface CylinderSidecarReadinessRow {
  canonicalIdentityKey: string;
  websiteSku: string;
  graceSku: string;
  status: string;
  canonical: {
    family: string;
    capacityMl: string;
    canon_bodyHeightMm: string;
    canon_widthAxisMm: string;
    canon_secondAxisMm: string;
    canon_heightWithCapMm: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface CylinderSidecarIdentityJoinRow {
  sourcePath: string;
  sourceRelativePath: string;
  sourceSha256: string;
  sourceBytes: number;
  websiteSku: string | null;
  graceSku: string | null;
  identityStatus: string;
  family: string | null;
  canonicalReviewMetadata: {
    applicator: string | null;
    assemblyType: string | null;
    [key: string]: unknown;
  } | null;
  composite: {
    width: number;
    height: number;
    opaque: boolean;
    previewPath: string;
    evidenceSha256: string;
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
}

export type CylinderSidecarReconciliationRoute =
  | "exact-psd-sidecar"
  | "exact-live-pdp-sidecar"
  | "reviewed-immutable-sidecar-remediation"
  | "live-topology-exception"
  | "blocked";

export interface CylinderSidecarReconciliationRow {
  canonicalIdentityKey: string;
  websiteSku: string;
  graceSku: string;
  canonical: CylinderSidecarReadinessRow["canonical"];
  route: CylinderSidecarReconciliationRoute;
  requiredOutputTopology:
    | "fitment-attached-cap-right-sidecar"
    | "assembled-live-site-exception"
    | "blocked";
  source: CylinderSidecarIdentityJoinRow | null;
  liveSourceUrl: string | null;
  blockers: string[];
}

export interface CylinderSidecarReconciliationPlan {
  version: typeof CYLINDER_SIDECAR_RECONCILIATION_VERSION;
  summary: {
    targetCount: number;
    exactPsdSidecarCount: number;
    exactLivePdpSidecarCount: number;
    liveTopologyExceptionCount: number;
    blockedCount: number;
  };
  rows: CylinderSidecarReconciliationRow[];
  sha256: string;
}

export interface CylinderSidecarGenerationRecord {
  route: CylinderSidecarReconciliationRoute;
  requiredOutputTopology: CylinderSidecarReconciliationRow["requiredOutputTopology"];
  blockers: readonly string[];
  output: {
    sha256: string;
  };
}

export interface CylinderSidecarGenerationAuthority {
  componentTopology:
    | "fitment-attached-cap-right-sidecar"
    | "assembled-live-site-exception";
  capState: "detached" | "assembled";
  capOffReferenceId: string | null;
  topologyReferenceId: string;
  shadowTopology: "detached-sidecar" | "complex-contact";
}

function assertSha256(value: string, label: string): void {
  if (!/^[a-f0-9]{64}$/i.test(value)) {
    throw new Error(`${label} must be a 64-character SHA-256 hash`);
  }
}

export function buildCylinderSidecarGenerationAuthority(
  record: CylinderSidecarGenerationRecord,
  actualReferenceSha256: string,
): CylinderSidecarGenerationAuthority {
  if (record.blockers.length > 0 || record.route === "blocked") {
    throw new Error(`Cylinder reference is blocked: ${record.blockers.join(", ") || "blocked route"}`);
  }
  assertSha256(record.output.sha256, "Reviewed reference hash");
  assertSha256(actualReferenceSha256, "Actual reference hash");
  if (record.output.sha256.toLowerCase() !== actualReferenceSha256.toLowerCase()) {
    throw new Error("Cylinder reference hash mismatch: generation input differs from reviewed export");
  }

  if (
    record.requiredOutputTopology === "fitment-attached-cap-right-sidecar"
    && record.route === "exact-live-pdp-sidecar"
  ) {
    throw new Error(
      "Live-PDP composite requires deterministic sidecar remediation before generation authority can be issued",
    );
  }

  if (
    record.requiredOutputTopology === "fitment-attached-cap-right-sidecar"
    && (
      record.route === "exact-psd-sidecar"
      || record.route === "reviewed-immutable-sidecar-remediation"
    )
  ) {
    return {
      componentTopology: "fitment-attached-cap-right-sidecar",
      capState: "detached",
      capOffReferenceId: record.output.sha256.toLowerCase(),
      topologyReferenceId: record.output.sha256.toLowerCase(),
      shadowTopology: "detached-sidecar",
    };
  }

  if (
    record.requiredOutputTopology === "assembled-live-site-exception"
    && record.route === "live-topology-exception"
  ) {
    return {
      componentTopology: "assembled-live-site-exception",
      capState: "assembled",
      capOffReferenceId: null,
      topologyReferenceId: record.output.sha256.toLowerCase(),
      shadowTopology: "complex-contact",
    };
  }

  throw new Error(
    `Cylinder route/topology mismatch: ${record.route} cannot authorize ${record.requiredOutputTopology}`,
  );
}

function normalizedIdentity(value: string | null | undefined): string {
  return String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function identityKey(value: Pick<CylinderSidecarReadinessRow, "websiteSku" | "graceSku">): string {
  return `${normalizedIdentity(value.websiteSku)}|${normalizedIdentity(value.graceSku)}`;
}

function isExplicitUncappedSource(source: CylinderSidecarIdentityJoinRow): boolean {
  return source.sourceRelativePath
    .split(/[\\/]/)
    .some((segment) => (
      !/capped\s*&\s*uncapped/i.test(segment)
      && /uncapp(?:ed)?|cap[ -]?off|detached|sidecar/i.test(segment)
    ));
}

function isVintageBulb(source: CylinderSidecarIdentityJoinRow): boolean {
  return /\b(?:vintage|antique|bulb|tassel)\b/i
    .test(source.canonicalReviewMetadata?.applicator ?? "");
}

function deterministicSource(
  sources: readonly CylinderSidecarIdentityJoinRow[],
): CylinderSidecarIdentityJoinRow {
  return [...sources].sort((left, right) => {
    const rightUpdated = /updated tassels/i.test(right.sourceRelativePath) ? 1 : 0;
    const leftUpdated = /updated tassels/i.test(left.sourceRelativePath) ? 1 : 0;
    return rightUpdated - leftUpdated
      || left.sourceRelativePath.localeCompare(right.sourceRelativePath)
      || left.sourceSha256.localeCompare(right.sourceSha256);
  })[0];
}

export function buildCylinderSidecarReconciliation(input: {
  readinessRows: readonly CylinderSidecarReadinessRow[];
  identityJoinRows: readonly CylinderSidecarIdentityJoinRow[];
}): CylinderSidecarReconciliationPlan {
  const targets = input.readinessRows
    .filter((row) => row.status === "production-qualified")
    .sort((left, right) => left.graceSku.localeCompare(right.graceSku));
  const sourcesByIdentity = new Map<string, CylinderSidecarIdentityJoinRow[]>();
  for (const source of input.identityJoinRows) {
    const key = `${normalizedIdentity(source.websiteSku)}|${normalizedIdentity(source.graceSku)}`;
    if (key === "|") continue;
    sourcesByIdentity.set(key, [...(sourcesByIdentity.get(key) ?? []), source]);
  }

  const rows = targets.map((target): CylinderSidecarReconciliationRow => {
    const exactSources = (sourcesByIdentity.get(identityKey(target)) ?? []).filter((source) => (
      normalizedIdentity(source.websiteSku) === normalizedIdentity(target.websiteSku)
      && normalizedIdentity(source.graceSku) === normalizedIdentity(target.graceSku)
      && normalizedIdentity(source.websiteSku) !== ""
      && normalizedIdentity(source.graceSku) !== ""
    ));
    if (exactSources.length === 0) {
      return {
        canonicalIdentityKey: target.canonicalIdentityKey,
        websiteSku: target.websiteSku,
        graceSku: target.graceSku,
        canonical: target.canonical,
        route: "blocked",
        requiredOutputTopology: "blocked",
        source: null,
        liveSourceUrl: null,
        blockers: ["no-exact-dual-identity-source"],
      };
    }

    const uncappedSources = exactSources.filter(isExplicitUncappedSource);
    if (uncappedSources.length === 1) {
      return {
        canonicalIdentityKey: target.canonicalIdentityKey,
        websiteSku: target.websiteSku,
        graceSku: target.graceSku,
        canonical: target.canonical,
        route: "exact-psd-sidecar",
        requiredOutputTopology: "fitment-attached-cap-right-sidecar",
        source: uncappedSources[0],
        liveSourceUrl: null,
        blockers: [],
      };
    }
    if (uncappedSources.length > 1) {
      return {
        canonicalIdentityKey: target.canonicalIdentityKey,
        websiteSku: target.websiteSku,
        graceSku: target.graceSku,
        canonical: target.canonical,
        route: "blocked",
        requiredOutputTopology: "blocked",
        source: null,
        liveSourceUrl: null,
        blockers: ["multiple-exact-uncapped-psd-sources"],
      };
    }

    const source = deterministicSource(exactSources);
    if (exactSources.some(isVintageBulb)) {
      return {
        canonicalIdentityKey: target.canonicalIdentityKey,
        websiteSku: target.websiteSku,
        graceSku: target.graceSku,
        canonical: target.canonical,
        route: "live-topology-exception",
        requiredOutputTopology: "assembled-live-site-exception",
        source,
        liveSourceUrl: `https://www.bestbottles.com/images/store/enlarged_pics/${target.websiteSku}.gif`,
        blockers: [],
      };
    }

    return {
      canonicalIdentityKey: target.canonicalIdentityKey,
      websiteSku: target.websiteSku,
      graceSku: target.graceSku,
      canonical: target.canonical,
      route: "exact-live-pdp-sidecar",
      requiredOutputTopology: "fitment-attached-cap-right-sidecar",
      source,
      liveSourceUrl: `https://www.bestbottles.com/images/store/enlarged_pics/${target.websiteSku}.gif`,
      blockers: [],
    };
  });

  const summary = {
    targetCount: rows.length,
    exactPsdSidecarCount: rows.filter((row) => row.route === "exact-psd-sidecar").length,
    exactLivePdpSidecarCount: rows.filter((row) => row.route === "exact-live-pdp-sidecar").length,
    liveTopologyExceptionCount: rows.filter((row) => row.route === "live-topology-exception").length,
    blockedCount: rows.filter((row) => row.route === "blocked").length,
  };
  const hashInput = JSON.stringify({
    version: CYLINDER_SIDECAR_RECONCILIATION_VERSION,
    summary,
    rows,
  });
  return {
    version: CYLINDER_SIDECAR_RECONCILIATION_VERSION,
    summary,
    rows,
    sha256: createHash("sha256").update(hashInput).digest("hex"),
  };
}
