import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

export const CYLINDER_REFERENCE_REMEDIATION_VERSION =
  "best-bottles-cylinder-reference-remediation-plan-v1" as const;

export interface CylinderRecoveryApprovalDecision {
  websiteSku: string;
  graceSku: string;
  sourcePath: string;
  sourceSha256: string;
  outputPath: string;
  outputSha256: string;
  width: number;
  height: number;
  pixelCount: number;
  resolutionStatus: "high-resolution" | "low-resolution";
  classification: "assembled-cap-on" | "detached-cap-or-sidecar";
  identityDecision: string;
  productionDisposition: string;
}

export interface CylinderRecoveryApprovalArtifact {
  version: string;
  minimumPixels: number;
  decisions: CylinderRecoveryApprovalDecision[];
}

export interface CylinderRemediationCanonicalGeometry {
  websiteSku: string;
  graceSku: string;
  family: string;
  productGroupSlug: string;
  capacityMl: string;
  canon_bodyHeightMm: string;
  canon_widthAxisMm: string;
  canon_secondAxisMm: string;
  canon_heightWithCapMm: string;
}

export interface CylinderRemediationReadinessRow {
  canonicalIdentityKey: string;
  websiteSku: string;
  graceSku: string;
  status: string;
  blockers: string[];
  blockerLane: string | null;
  canonical: CylinderRemediationCanonicalGeometry;
  reference: {
    filename: string;
    sourceSha256: string;
    exportSha256: string;
    width: number;
    height: number;
    pixelCount: number;
    opaque: boolean;
    capState: string;
    reviewer: string;
    reviewedAt: string;
  } | null;
}

export interface CylinderRemediationReadinessArtifact {
  version: string;
  rows: CylinderRemediationReadinessRow[];
}

export interface CylinderRemediationGeometryOverride {
  graceSku: string;
  websiteSku: string;
  bodyHeightMm: number | null;
  assembledHeightMm: number;
  widthAxisMm: number;
  secondAxisMm: number;
  scaleAuthority: "exact-pdp-override" | "assembled-height-only";
  source: string;
  sourceUrl: string;
  note: string;
}

export interface CylinderRemediationGeometryOverridesArtifact {
  overrides: CylinderRemediationGeometryOverride[];
}

export interface CylinderRemediationTaxonomyOverride {
  graceSku: string;
  websiteSku: string;
  canonicalFamily: string;
  sourceUrl: string;
  note: string;
}

export interface CylinderRemediationTaxonomyOverridesArtifact {
  overrides: CylinderRemediationTaxonomyOverride[];
}

export type CylinderReferenceRemediationMode =
  | "regenerate-native-resolution"
  | "assemble-detached"
  | "assemble-and-regenerate";

export interface CylinderReferenceRemediationRow {
  canonicalIdentityKey: string;
  websiteSku: string;
  graceSku: string;
  productGroupSlug: string;
  capacityMl: number;
  status: "ready-for-remediation-eval" | "blocked-canonical-geometry";
  blockers: string[];
  remediationMode: CylinderReferenceRemediationMode;
  sourcePath: string;
  sourceReferencePath: string;
  sourcePsdSha256: string;
  sourceReferenceSha256: string;
  sourceDimensions: { widthPx: number; heightPx: number };
  sourceClassification: CylinderRecoveryApprovalDecision["classification"];
  canonicalGeometry: {
    bodyHeightMm: number | null;
    assembledHeightMm: number;
    widthAxisMm: number;
    secondAxisMm: number;
  };
  scaleAuthority: "canonical-columns" | CylinderRemediationGeometryOverride["scaleAuthority"];
  geometrySource: string;
  geometrySourceUrl: string | null;
  targetCanvas: { widthPx: 2080; heightPx: 2288 };
}

export interface CylinderReferenceRemediationPlan {
  version: typeof CYLINDER_REFERENCE_REMEDIATION_VERSION;
  approvalVersion: string;
  readinessVersion: string;
  summary: {
    approvedRegenerationCount: number;
    cylinderRemediationCount: number;
    reclassifiedToVialCount: number;
    generationReadyCount: number;
    geometryBlockedCount: number;
    lowResolutionAssembledCount: number;
    lowResolutionDetachedCount: number;
    highResolutionDetachedCount: number;
  };
  rows: CylinderReferenceRemediationRow[];
  reclassifiedRows: CylinderRemediationTaxonomyOverride[];
  sha256: string;
}

export async function verifyCylinderRemediationSourceEvidence(
  row: CylinderReferenceRemediationRow,
): Promise<{ sourcePsdSha256: string; sourceReferenceSha256: string }> {
  const [psdBytes, pngBytes] = await Promise.all([
    readFile(row.sourcePath),
    readFile(row.sourceReferencePath),
  ]);
  const sourcePsdSha256 = createHash("sha256").update(psdBytes).digest("hex");
  const sourceReferenceSha256 = createHash("sha256").update(pngBytes).digest("hex");
  if (sourcePsdSha256 !== row.sourcePsdSha256) {
    throw new Error(`${row.graceSku} PSD hash mismatch.`);
  }
  if (sourceReferenceSha256 !== row.sourceReferenceSha256) {
    throw new Error(`${row.graceSku} PNG hash mismatch.`);
  }
  return { sourcePsdSha256, sourceReferenceSha256 };
}

export function selectCylinderReferenceRemediationEval(
  rows: CylinderReferenceRemediationRow[],
  count = 8,
): CylinderReferenceRemediationRow[] {
  const candidates = rows
    .filter((row) => row.status === "ready-for-remediation-eval")
    .sort((left, right) => left.graceSku.localeCompare(right.graceSku));
  const selected: CylinderReferenceRemediationRow[] = [];
  const selectedSkus = new Set<string>();
  const modes = new Set<CylinderReferenceRemediationMode>();
  const capacities = new Set<number>();
  const groups = new Set<string>();

  while (selected.length < Math.min(count, candidates.length)) {
    const next = candidates
      .filter((row) => !selectedSkus.has(row.graceSku))
      .map((row) => ({
        row,
        score:
          (capacities.has(row.capacityMl) ? 0 : 100)
          + (modes.has(row.remediationMode) ? 0 : 40)
          + (groups.has(row.productGroupSlug) ? 0 : 20),
      }))
      .sort((left, right) => right.score - left.score || left.row.graceSku.localeCompare(right.row.graceSku))[0]
      ?.row;
    if (!next) break;
    selected.push(next);
    selectedSkus.add(next.graceSku);
    modes.add(next.remediationMode);
    capacities.add(next.capacityMl);
    groups.add(next.productGroupSlug);
  }
  return selected;
}

function storageSlug(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function cylinderRemediationSourceStoragePath(
  organizationId: string,
  row: CylinderReferenceRemediationRow,
): string {
  return [
    organizationId,
    "best-bottles/reference-remediation/v1/source-evidence",
    `${storageSlug(row.websiteSku)}__${storageSlug(row.graceSku)}__${row.sourceReferenceSha256.slice(0, 12)}.png`,
  ].join("/");
}

function identityKey(websiteSku: string, graceSku: string): string {
  return `${websiteSku.trim().toUpperCase()}|${graceSku.replace(/[^A-Za-z0-9]/g, "").toUpperCase()}`;
}

function positiveNumber(value: string, label: string, sku: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${sku} has invalid canonical ${label}: ${JSON.stringify(value)}.`);
  }
  return parsed;
}

function remediationMode(
  decision: CylinderRecoveryApprovalDecision,
): CylinderReferenceRemediationMode {
  if (decision.classification === "assembled-cap-on") {
    return "regenerate-native-resolution";
  }
  return decision.resolutionStatus === "high-resolution"
    ? "assemble-detached"
    : "assemble-and-regenerate";
}

export function buildCylinderReferenceRemediationPlan(input: {
  approval: CylinderRecoveryApprovalArtifact;
  readiness: CylinderRemediationReadinessArtifact;
  geometryOverrides?: CylinderRemediationGeometryOverridesArtifact;
  taxonomyOverrides?: CylinderRemediationTaxonomyOverridesArtifact;
}): CylinderReferenceRemediationPlan {
  const readinessByIdentity = new Map(
    input.readiness.rows.map((row) => [identityKey(row.websiteSku, row.graceSku), row]),
  );
  const regeneration = input.approval.decisions.filter(
    (decision) => decision.productionDisposition !== "production-gate-candidate",
  );
  const overridesByIdentity = new Map(
    (input.geometryOverrides?.overrides ?? []).map((override) => [
      identityKey(override.websiteSku, override.graceSku),
      override,
    ]),
  );
  const taxonomyByIdentity = new Map(
    (input.taxonomyOverrides?.overrides ?? []).map((override) => [
      identityKey(override.websiteSku, override.graceSku),
      override,
    ]),
  );
  const reclassifiedRows = regeneration.flatMap((decision) => {
    const override = taxonomyByIdentity.get(identityKey(decision.websiteSku, decision.graceSku));
    return override && override.canonicalFamily.toLowerCase() !== "cylinder" ? [override] : [];
  });
  const cylinderRegeneration = regeneration.filter(
    (decision) => !taxonomyByIdentity.has(identityKey(decision.websiteSku, decision.graceSku)),
  );
  const seen = new Set<string>();
  const rows = cylinderRegeneration.map((decision): CylinderReferenceRemediationRow => {
    if (decision.identityDecision !== "approved-exact-product") {
      throw new Error(`${decision.graceSku} is not an approved exact product identity.`);
    }
    const key = identityKey(decision.websiteSku, decision.graceSku);
    if (seen.has(key)) throw new Error(`Duplicate remediation identity ${key}.`);
    seen.add(key);
    const readiness = readinessByIdentity.get(key);
    if (!readiness) throw new Error(`${decision.graceSku} is missing from canonical production readiness.`);
    if (!readiness.reference && decision.classification === "assembled-cap-on") {
      throw new Error(`${decision.graceSku} has no assembled reviewed reference evidence.`);
    }
    if (readiness.reference) {
      if (
        readiness.reference.exportSha256 !== decision.outputSha256
        || readiness.reference.sourceSha256 !== decision.sourceSha256
      ) {
        throw new Error(`${decision.graceSku} approved reference hash mismatch.`);
      }
      if (!readiness.reference.opaque) {
        throw new Error(`${decision.graceSku} approved reference is not opaque.`);
      }
    }

    const canonical = readiness.canonical;
    const override = overridesByIdentity.get(key);
    const geometry = override
      ? {
          bodyHeightMm: override.bodyHeightMm,
          assembledHeightMm: override.assembledHeightMm,
          widthAxisMm: override.widthAxisMm,
          secondAxisMm: override.secondAxisMm,
        }
      : {
          bodyHeightMm: positiveNumber(canonical.canon_bodyHeightMm, "body height", decision.graceSku),
          assembledHeightMm: positiveNumber(canonical.canon_heightWithCapMm, "assembled height", decision.graceSku),
          widthAxisMm: positiveNumber(canonical.canon_widthAxisMm, "width axis", decision.graceSku),
          secondAxisMm: positiveNumber(canonical.canon_secondAxisMm, "second axis", decision.graceSku),
        };
    if (override) {
      for (const [label, value] of [
        ["assembled height", override.assembledHeightMm],
        ["width axis", override.widthAxisMm],
        ["second axis", override.secondAxisMm],
      ] as const) {
        if (!Number.isFinite(value) || value <= 0) {
          throw new Error(`${decision.graceSku} has invalid override ${label}.`);
        }
      }
      if (override.scaleAuthority === "exact-pdp-override" && (!override.bodyHeightMm || override.bodyHeightMm <= 0)) {
        throw new Error(`${decision.graceSku} exact PDP override requires a positive body height.`);
      }
      if (override.scaleAuthority === "assembled-height-only" && override.bodyHeightMm !== null) {
        throw new Error(`${decision.graceSku} assembled-height-only override must not assert a body height.`);
      }
    }
    const blockers: string[] = [];
    if (!override && readiness.blockers.includes("ambiguous-canonical-body-geometry")) {
      blockers.push("ambiguous-canonical-body-geometry");
    }
    if (geometry.bodyHeightMm !== null && geometry.assembledHeightMm < geometry.bodyHeightMm) {
      blockers.push("assembled-height-less-than-body-height");
    }

    return {
      canonicalIdentityKey: readiness.canonicalIdentityKey,
      websiteSku: decision.websiteSku,
      graceSku: decision.graceSku,
      productGroupSlug: canonical.productGroupSlug,
      capacityMl: positiveNumber(canonical.capacityMl, "capacity", decision.graceSku),
      status: blockers.length > 0
        ? "blocked-canonical-geometry"
        : "ready-for-remediation-eval",
      blockers,
      remediationMode: remediationMode(decision),
      sourcePath: decision.sourcePath,
      sourceReferencePath: decision.outputPath,
      sourcePsdSha256: decision.sourceSha256,
      sourceReferenceSha256: decision.outputSha256,
      sourceDimensions: { widthPx: decision.width, heightPx: decision.height },
      sourceClassification: decision.classification,
      canonicalGeometry: geometry,
      scaleAuthority: override?.scaleAuthority ?? "canonical-columns",
      geometrySource: override?.source ?? "docs/best-bottles-canonical-truth/best-bottles-master-truth.csv canon_* columns",
      geometrySourceUrl: override?.sourceUrl ?? null,
      targetCanvas: { widthPx: 2080, heightPx: 2288 },
    };
  }).sort((left, right) => left.graceSku.localeCompare(right.graceSku));

  const summary = {
    approvedRegenerationCount: regeneration.length,
    cylinderRemediationCount: rows.length,
    reclassifiedToVialCount: reclassifiedRows.filter((row) => row.canonicalFamily.toLowerCase() === "vial").length,
    generationReadyCount: rows.filter((row) => row.status === "ready-for-remediation-eval").length,
    geometryBlockedCount: rows.filter((row) => row.status === "blocked-canonical-geometry").length,
    lowResolutionAssembledCount: cylinderRegeneration.filter((decision) =>
      decision.resolutionStatus === "low-resolution"
      && decision.classification === "assembled-cap-on").length,
    lowResolutionDetachedCount: cylinderRegeneration.filter((decision) =>
      decision.resolutionStatus === "low-resolution"
      && decision.classification === "detached-cap-or-sidecar").length,
    highResolutionDetachedCount: cylinderRegeneration.filter((decision) =>
      decision.resolutionStatus === "high-resolution"
      && decision.classification === "detached-cap-or-sidecar").length,
  };
  const hashInput = JSON.stringify({
    version: CYLINDER_REFERENCE_REMEDIATION_VERSION,
    approvalVersion: input.approval.version,
    readinessVersion: input.readiness.version,
    summary,
    rows,
    reclassifiedRows,
  });

  return {
    version: CYLINDER_REFERENCE_REMEDIATION_VERSION,
    approvalVersion: input.approval.version,
    readinessVersion: input.readiness.version,
    summary,
    rows,
    reclassifiedRows,
    sha256: createHash("sha256").update(hashInput).digest("hex"),
  };
}
