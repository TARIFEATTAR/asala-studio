import { createHash } from "node:crypto";

import type {
  CylinderApprovedEvidence,
  CylinderReferenceRole,
  CylinderRoleAwareReadinessArtifact,
  CylinderRoleAwareReadinessRow,
} from "./bestBottlesCylinderRoleAwareReadiness";
import type { CylinderProductionCanonicalIdentity } from "./bestBottlesCylinderProductionCutover";

export const BEST_BOTTLES_CYLINDER_DUAL_ROLE_REMEDIATION_VERSION =
  "best-bottles-cylinder-dual-role-remediation-v2" as const;

export type CylinderDualRoleRoute =
  | "strict-both-roles-ready"
  | "remediate-current-live-sidecar"
  | "approved-detached-dual-role"
  | "approved-topology-exception"
  | "hard-blocked-no-evidence"
  | "routed-to-vial";

export type CylinderDualRoleJobType =
  | "assemble-cap-on-reference"
  | "preserve-cap-on-reference"
  | "preserve-cap-off-sidecar-reference"
  | "preserve-assembled-topology-exception";

type ArtifactSource<T> = {
  path: string;
  fileSha256: string;
  data: T;
};

type RecoveryDecision = {
  websiteSku: string;
  graceSku: string;
  identityDecision: string;
  classification: string;
  resolutionStatus: string;
  productionDisposition: string;
  sourceSha256: string;
  outputSha256: string;
  outputPath?: string;
  width: number;
  height: number;
};

type RecoveryApprovalArtifact = {
  version: string;
  decisions: RecoveryDecision[];
  summary: { approvedIdentityCount: number };
};

type LivePointerDecision = {
  canonicalIdentityKey: string;
  websiteSku: string;
  graceSku: string;
  identityDecision: string;
  componentTopology: string;
  resolutionStatus: string;
  productionDisposition: string;
  approvedReference: {
    sha256: string;
    width: number;
    height: number;
    relativePath?: string;
  };
};

type LivePointerApprovalArtifact = {
  version: string;
  recordCount: number;
  guardrails: {
    exactDualIdentityOnly: boolean;
    canonicalColumnsOnly: boolean;
    substitutionsAllowed: boolean;
    sourceUpscalingAllowed: boolean;
    aiReconstructionPerformed: boolean;
    automaticPromotionAllowed: boolean;
    shopifyPublishAllowed: boolean;
  };
  decisions: LivePointerDecision[];
};

type FamilyTaxonomyOverride = {
  websiteSku: string;
  graceSku: string;
  canonicalFamily: string;
  note?: string;
};

type FamilyTaxonomyOverridesArtifact = {
  version: string;
  overrides: FamilyTaxonomyOverride[];
};

export interface CylinderDualRoleEvidenceVerification {
  canonicalIdentityKey: string;
  evidenceLane: "approved-recovery" | "approved-live-pointer";
  localPath: string;
  referenceSha256: string;
  width: number;
  height: number;
  opaque: boolean;
  originalBackgroundEligible: boolean;
  verificationMethod: "sha256+sharp-alpha-scan";
}

export interface CylinderDualRoleRemediationInput {
  generatedAt: string;
  sources: {
    roleAwareReadiness: ArtifactSource<CylinderRoleAwareReadinessArtifact>;
    recoveryApproval: ArtifactSource<RecoveryApprovalArtifact>;
    livePointerApproval: ArtifactSource<LivePointerApprovalArtifact>;
    taxonomyOverrides: ArtifactSource<FamilyTaxonomyOverridesArtifact>;
  };
  evidenceVerifications: CylinderDualRoleEvidenceVerification[];
}

export type CylinderDualRoleEvidenceLane =
  | "verified-role-pair"
  | "current-live-sidecar"
  | "approved-recovery"
  | "approved-live-pointer"
  | "none";

export interface CylinderDualRoleEvidence {
  lane: CylinderDualRoleEvidenceLane;
  classification: string | null;
  sourceSha256: string | null;
  referenceSha256: string | null;
  width: number | null;
  height: number | null;
  resolutionStatus: string | null;
  sourceLocator: string | null;
  opaque: true | null;
  originalBackgroundEligible: true | null;
  verificationMethod: string | null;
}

export interface CylinderDualRoleJob {
  jobId: string;
  jobType: CylinderDualRoleJobType;
  targetRole: "identity-cap-on" | "pdp-cap-off-sidecar";
  sourceEvidenceLane: CylinderDualRoleEvidenceLane;
  reviewStatus: "sealed-input-review-pending";
}

export interface CylinderDualRoleRemediationRow {
  canonicalIdentityKey: string;
  websiteSku: string;
  graceSku: string;
  canonicalFamily: "Cylinder" | "Vial";
  route: CylinderDualRoleRoute;
  canonical: CylinderProductionCanonicalIdentity;
  evidence: CylinderDualRoleEvidence;
  roleJobs: CylinderDualRoleJob[];
  blockers: string[];
}

export interface CylinderDualRoleRemediationPlan {
  version: typeof BEST_BOTTLES_CYLINDER_DUAL_ROLE_REMEDIATION_VERSION;
  generatedAt: string;
  provenance: {
    inputs: Record<string, { path: string; sha256: string }>;
    localEvidenceVerificationCount: 136;
  };
  authorization: {
    planMode: "read-only";
    outputState: "review-pending";
    remoteWrites: "forbidden";
    publishStatus: "not-authorized";
  };
  summary: {
    sourceIdentityCount: 377;
    cylinderIdentityCount: 375;
    vialHandoffCount: 2;
    strictBothRolesReadyCount: 172;
    currentLiveSidecarRemediationCount: 56;
    approvedDetachedDualRoleCount: 123;
    approvedTopologyExceptionCount: 13;
    hardBlockedNoEvidenceCount: 11;
    roleJobCount: number;
    externalWriteCount: 0;
  };
  rows: CylinderDualRoleRemediationRow[];
  sha256: string;
}

function normalizedIdentity(value: string | null | undefined): string {
  return String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function identityKey(websiteSku: string, graceSku: string): string {
  return `${normalizedIdentity(websiteSku)}|${normalizedIdentity(graceSku)}`;
}

function assertSha256(value: string | null | undefined, label: string): void {
  if (!/^[a-f0-9]{64}$/i.test(String(value ?? ""))) {
    throw new Error(`${label} must be a SHA-256 hash.`);
  }
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => (
      `${JSON.stringify(key)}:${stableJson(record[key])}`
    )).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function assertExactIdentity(
  row: { canonicalIdentityKey?: string; websiteSku: string; graceSku: string },
  label: string,
): string {
  const key = identityKey(row.websiteSku, row.graceSku);
  if (!normalizedIdentity(row.websiteSku) || !normalizedIdentity(row.graceSku)) {
    throw new Error(`${label} is missing exact Website + Grace SKU identity.`);
  }
  if (row.canonicalIdentityKey !== undefined && row.canonicalIdentityKey !== key) {
    throw new Error(`${label} ${row.canonicalIdentityKey} does not match ${key}.`);
  }
  return key;
}

function indexExactRows<T extends { websiteSku: string; graceSku: string; canonicalIdentityKey?: string }>(
  rows: readonly T[],
  label: string,
  canonicalIdentities: ReadonlySet<string>,
): Map<string, T> {
  const index = new Map<string, T>();
  for (const row of rows) {
    const key = assertExactIdentity(row, label);
    if (!canonicalIdentities.has(key)) {
      throw new Error(`${label} ${key} is not in role-aware readiness.`);
    }
    if (index.has(key)) throw new Error(`Duplicate ${label} identity ${key}.`);
    index.set(key, row);
  }
  return index;
}

function portableLocator(value: string | null | undefined): string | null {
  if (!value) return null;
  if (/^https:\/\//i.test(value)) return value;
  const normalized = value.replace(/\\/g, "/");
  const workspaceRelative = normalized.match(/\/(tmp\/best-bottles-reference-production\/.*)$/);
  return workspaceRelative?.[1] ?? normalized.replace(/^\/+/, "");
}

const RETIRED_REFERENCE_TOKEN =
  /clean-references|transparent|background-removed|paper-doll|mask-/i;

const EXPECTED_VIAL_HANDOFFS = new Set([
  "GB09BLACKCAPAPP|GBCYLCLR9MLT01",
  "GB09BLACKCAPSHT|GBCYLCLR9MLS01",
]);

function verificationKey(
  canonicalIdentityKey: string,
  lane: CylinderDualRoleEvidenceVerification["evidenceLane"],
): string {
  return `${canonicalIdentityKey}|${lane}`;
}

function recoveryEvidence(
  decision: RecoveryDecision,
  verification: CylinderDualRoleEvidenceVerification,
): CylinderDualRoleEvidence {
  assertSha256(decision.sourceSha256, "Recovery source hash");
  assertSha256(decision.outputSha256, "Recovery output hash");
  return {
    lane: "approved-recovery",
    classification: decision.classification,
    sourceSha256: decision.sourceSha256.toLowerCase(),
    referenceSha256: decision.outputSha256.toLowerCase(),
    width: decision.width,
    height: decision.height,
    resolutionStatus: decision.resolutionStatus,
    sourceLocator: verification.localPath,
    opaque: true,
    originalBackgroundEligible: true,
    verificationMethod: verification.verificationMethod,
  };
}

function livePointerEvidence(
  decision: LivePointerDecision,
  verification: CylinderDualRoleEvidenceVerification,
): CylinderDualRoleEvidence {
  assertSha256(decision.approvedReference.sha256, "Live-pointer reference hash");
  return {
    lane: "approved-live-pointer",
    classification: decision.componentTopology,
    sourceSha256: null,
    referenceSha256: decision.approvedReference.sha256.toLowerCase(),
    width: decision.approvedReference.width,
    height: decision.approvedReference.height,
    resolutionStatus: decision.resolutionStatus,
    sourceLocator: verification.localPath,
    opaque: true,
    originalBackgroundEligible: true,
    verificationMethod: verification.verificationMethod,
  };
}

function roleEvidence(
  lane: "verified-role-pair" | "current-live-sidecar",
  role: CylinderReferenceRole,
): CylinderDualRoleEvidence {
  if (role.exportSha256) assertSha256(role.exportSha256, `${lane} export hash`);
  return {
    lane,
    classification: role.topology,
    sourceSha256: null,
    referenceSha256: role.exportSha256?.toLowerCase() ?? null,
    width: role.width,
    height: role.height,
    resolutionStatus: role.resolutionStatus,
    sourceLocator: portableLocator(role.publicUrl),
    opaque: true,
    originalBackgroundEligible: true,
    verificationMethod: "role-aware-readiness-explicit-opaque-original-background",
  };
}

function noEvidence(): CylinderDualRoleEvidence {
  return {
    lane: "none",
    classification: null,
    sourceSha256: null,
    referenceSha256: null,
    width: null,
    height: null,
    resolutionStatus: null,
    sourceLocator: null,
    opaque: null,
    originalBackgroundEligible: null,
    verificationMethod: null,
  };
}

function roleJob(
  identity: string,
  jobType: CylinderDualRoleJobType,
  sourceEvidenceLane: CylinderDualRoleEvidenceLane,
): CylinderDualRoleJob {
  return {
    jobId: `${identity}|${jobType}`,
    jobType,
    targetRole: jobType === "preserve-cap-off-sidecar-reference"
      || jobType === "preserve-assembled-topology-exception"
      ? "pdp-cap-off-sidecar"
      : "identity-cap-on",
    sourceEvidenceLane,
    reviewStatus: "sealed-input-review-pending",
  };
}

function validateEmbeddedEvidence(
  row: CylinderRoleAwareReadinessRow,
  recovery: RecoveryDecision | undefined,
  livePointer: LivePointerDecision | undefined,
): void {
  const embedded: CylinderApprovedEvidence = row.approvedEvidence;
  if (Boolean(recovery) !== Boolean(embedded.recovery)) {
    throw new Error(`Recovery approval disagrees with role-aware readiness for ${row.canonicalIdentityKey}.`);
  }
  if (Boolean(livePointer) !== Boolean(embedded.livePointer)) {
    throw new Error(`Live-pointer approval disagrees with role-aware readiness for ${row.canonicalIdentityKey}.`);
  }
  if (recovery && embedded.recovery && (
    recovery.classification !== embedded.recovery.classification
    || recovery.outputSha256 !== embedded.recovery.outputSha256
  )) {
    throw new Error(`Recovery evidence bytes or classification changed for ${row.canonicalIdentityKey}.`);
  }
  if (livePointer && embedded.livePointer && (
    livePointer.componentTopology !== embedded.livePointer.componentTopology
    || livePointer.approvedReference.sha256 !== embedded.livePointer.referenceSha256
  )) {
    throw new Error(`Live-pointer evidence bytes or topology changed for ${row.canonicalIdentityKey}.`);
  }
}

function validateApprovalSemantics(input: CylinderDualRoleRemediationInput): void {
  for (const decision of input.sources.recoveryApproval.data.decisions) {
    if (decision.identityDecision !== "approved-exact-product") {
      throw new Error(
        `Recovery identity decision must be approved-exact-product for ${identityKey(decision.websiteSku, decision.graceSku)}.`,
      );
    }
    const expectedDisposition = decision.resolutionStatus === "low-resolution"
      && (decision.classification === "assembled-cap-on"
        || decision.classification === "detached-cap-or-sidecar")
      ? "regeneration-required-low-resolution"
      : decision.resolutionStatus === "high-resolution"
        && decision.classification === "assembled-cap-on"
        ? "production-gate-candidate"
        : decision.resolutionStatus === "high-resolution"
          && decision.classification === "detached-cap-or-sidecar"
          ? "regeneration-required-detached-topology"
          : null;
    if (
      expectedDisposition === null
      || decision.productionDisposition !== expectedDisposition
    ) {
      throw new Error(
        `Recovery production disposition is not accepted for ${identityKey(decision.websiteSku, decision.graceSku)}.`,
      );
    }
  }

  const liveArtifact = input.sources.livePointerApproval.data;
  const guardrails = liveArtifact.guardrails;
  if (
    guardrails.exactDualIdentityOnly !== true
    || guardrails.canonicalColumnsOnly !== true
    || guardrails.substitutionsAllowed !== false
    || guardrails.sourceUpscalingAllowed !== false
    || guardrails.aiReconstructionPerformed !== false
    || guardrails.automaticPromotionAllowed !== false
    || guardrails.shopifyPublishAllowed !== false
  ) {
    throw new Error(
      "Live-pointer guardrails must preserve exact canonical identity and forbid substitutions, source upscaling, AI reconstruction, automatic promotion, and Shopify publish.",
    );
  }
  for (const decision of liveArtifact.decisions) {
    if (decision.identityDecision !== "approved-exact-live-pointer-reference") {
      throw new Error(
        `Live-pointer identity decision must be approved-exact-live-pointer-reference for ${identityKey(decision.websiteSku, decision.graceSku)}.`,
      );
    }
    if (decision.productionDisposition
      !== "generation-reference-approved-remediation-required") {
      throw new Error(
        `Live-pointer production disposition must require remediation for ${identityKey(decision.websiteSku, decision.graceSku)}.`,
      );
    }
  }
}

function assertVerifiedRoleEligibility(row: CylinderRoleAwareReadinessRow): void {
  for (const role of [row.references.identityCapOn, row.references.pdpCapOffSidecar]) {
    if (role.status !== "verified" || role.opaque !== true) {
      throw new Error(
        `Current verified roles must be explicitly opaque for ${row.canonicalIdentityKey}.`,
      );
    }
    const locator = `${role.publicUrl ?? ""} ${role.storagePath ?? ""}`;
    if (!role.publicUrl || !role.storagePath || RETIRED_REFERENCE_TOKEN.test(locator)) {
      throw new Error(
        `Current verified roles must be original-background eligible for ${row.canonicalIdentityKey}.`,
      );
    }
  }
}

function buildVerificationIndex(input: {
  records: readonly CylinderDualRoleEvidenceVerification[];
  required: ReadonlyMap<string, {
    canonicalIdentityKey: string;
    evidenceLane: CylinderDualRoleEvidenceVerification["evidenceLane"];
    referenceSha256: string;
    width: number;
    height: number;
  }>;
}): Map<string, CylinderDualRoleEvidenceVerification> {
  if (input.records.length !== 136 || input.required.size !== 136) {
    throw new Error("Local evidence verification must cover exactly 96 recovery and 40 live-pointer rows.");
  }
  const index = new Map<string, CylinderDualRoleEvidenceVerification>();
  for (const record of input.records) {
    if (!/^[A-Z0-9]+\|[A-Z0-9]+$/.test(record.canonicalIdentityKey)) {
      throw new Error(`Local evidence verification has an invalid identity ${record.canonicalIdentityKey}.`);
    }
    const key = verificationKey(record.canonicalIdentityKey, record.evidenceLane);
    if (index.has(key)) throw new Error(`Duplicate local evidence verification ${key}.`);
    const required = input.required.get(key);
    if (!required) throw new Error(`Unexpected local evidence verification ${key}.`);
    assertSha256(record.referenceSha256, `${key} verification hash`);
    if (record.referenceSha256.toLowerCase() !== required.referenceSha256.toLowerCase()) {
      throw new Error(`Local evidence verification hash disagrees with approval for ${key}.`);
    }
    if (record.width !== required.width || record.height !== required.height) {
      throw new Error(`Local evidence verification dimensions disagree with approval for ${key}.`);
    }
    if (record.opaque !== true) {
      throw new Error(`Local evidence must be opaque for ${key}.`);
    }
    if (
      record.originalBackgroundEligible !== true
      || RETIRED_REFERENCE_TOKEN.test(record.localPath)
    ) {
      throw new Error(`Local evidence must be original-background eligible for ${key}.`);
    }
    if (
      record.verificationMethod !== "sha256+sharp-alpha-scan"
      || /^\//.test(record.localPath)
      || record.localPath.includes("/Users/")
    ) {
      throw new Error(`Local evidence verification is not sealed and portable for ${key}.`);
    }
    index.set(key, record);
  }
  for (const key of input.required.keys()) {
    if (!index.has(key)) throw new Error(`Missing local evidence verification ${key}.`);
  }
  const recoveryCount = input.records.filter((row) => row.evidenceLane === "approved-recovery").length;
  const liveCount = input.records.filter((row) => row.evidenceLane === "approved-live-pointer").length;
  if (recoveryCount !== 96 || liveCount !== 40) {
    throw new Error("Local evidence verification must cover exactly 96 recovery and 40 live-pointer rows.");
  }
  return index;
}

function countRoute(rows: readonly CylinderDualRoleRemediationRow[], route: CylinderDualRoleRoute): number {
  return rows.filter((row) => row.route === route).length;
}

export function buildCylinderDualRoleRemediationPlan(
  input: CylinderDualRoleRemediationInput,
): CylinderDualRoleRemediationPlan {
  const { sources } = input;
  for (const [name, source] of Object.entries(sources)) {
    assertSha256(source.fileSha256, `${name} file hash`);
    if (/^\//.test(source.path) || source.path.includes("/Users/")) {
      throw new Error(`${name} must use a workspace-relative artifact path.`);
    }
  }

  const readiness = sources.roleAwareReadiness.data;
  if (readiness.version !== "best-bottles-cylinder-role-aware-readiness-v2") {
    throw new Error("Dual-role remediation requires role-aware readiness v2.");
  }
  if (
    readiness.rows.length !== 377
    || readiness.summary.canonicalIdentityCount !== 377
    || readiness.summary.bothRolesVerifiedCount !== 228
    || readiness.summary.blockedIdentityCount !== 149
    || readiness.summary.externalWriteCount !== 0
  ) {
    throw new Error("Role-aware readiness does not match the sealed 377-row input contract.");
  }
  if (
    sources.recoveryApproval.data.version !== "best-bottles-cylinder-recovery-approval-v1"
    || sources.recoveryApproval.data.decisions.length !== 106
    || sources.recoveryApproval.data.summary.approvedIdentityCount !== 106
  ) {
    throw new Error("Recovery approval does not match the sealed 106-decision input contract.");
  }
  if (
    sources.livePointerApproval.data.version !== "best-bottles-cylinder-live-pointer-approval-v1"
    || sources.livePointerApproval.data.decisions.length !== 40
    || sources.livePointerApproval.data.recordCount !== 40
  ) {
    throw new Error("Live-pointer approval does not match the sealed 40-decision input contract.");
  }
  if (
    sources.taxonomyOverrides.data.version !== "best-bottles-family-taxonomy-overrides-v1"
    || sources.taxonomyOverrides.data.overrides.length !== 2
  ) {
    throw new Error("Taxonomy overrides do not match the sealed two-handoff input contract.");
  }
  validateApprovalSemantics(input);

  const canonicalIdentities = new Set<string>();
  const readinessByIdentity = new Map<string, CylinderRoleAwareReadinessRow>();
  for (const row of readiness.rows) {
    const key = assertExactIdentity(row, "Role-aware readiness row");
    if (canonicalIdentities.has(key)) throw new Error(`Duplicate readiness identity ${key}.`);
    if (
      row.canonical.family !== "Cylinder"
      || identityKey(row.canonical.websiteSku, row.canonical.graceSku) !== key
    ) {
      throw new Error(`Embedded canonical family must be Cylinder with exact identity for ${key}.`);
    }
    canonicalIdentities.add(key);
    readinessByIdentity.set(key, row);
  }
  const recovery = indexExactRows(
    sources.recoveryApproval.data.decisions,
    "recovery approval",
    canonicalIdentities,
  );
  const livePointer = indexExactRows(
    sources.livePointerApproval.data.decisions,
    "live-pointer approval",
    canonicalIdentities,
  );
  const taxonomy = indexExactRows(
    sources.taxonomyOverrides.data.overrides,
    "taxonomy override",
    canonicalIdentities,
  );

  for (const key of recovery.keys()) {
    if (livePointer.has(key)) {
      throw new Error(`Approved evidence lanes overlap for ${key}.`);
    }
  }
  for (const [key, override] of taxonomy) {
    if (override.canonicalFamily !== "Vial") {
      throw new Error(`Taxonomy override ${key} must be an explicit Vial handoff.`);
    }
  }
  if (
    taxonomy.size !== EXPECTED_VIAL_HANDOFFS.size
    || [...EXPECTED_VIAL_HANDOFFS].some((key) => !taxonomy.has(key))
  ) {
    throw new Error("Taxonomy overrides must contain the exact canonical Vial handoff identities.");
  }

  const requiredVerifications = new Map<string, {
    canonicalIdentityKey: string;
    evidenceLane: CylinderDualRoleEvidenceVerification["evidenceLane"];
    referenceSha256: string;
    width: number;
    height: number;
  }>();
  for (const [key, decision] of recovery) {
    if (readinessByIdentity.get(key)?.status !== "blocked" || taxonomy.has(key)) continue;
    const required = {
      canonicalIdentityKey: key,
      evidenceLane: "approved-recovery" as const,
      referenceSha256: decision.outputSha256,
      width: decision.width,
      height: decision.height,
    };
    requiredVerifications.set(verificationKey(key, required.evidenceLane), required);
  }
  for (const [key, decision] of livePointer) {
    if (readinessByIdentity.get(key)?.status !== "blocked" || taxonomy.has(key)) continue;
    const required = {
      canonicalIdentityKey: key,
      evidenceLane: "approved-live-pointer" as const,
      referenceSha256: decision.approvedReference.sha256,
      width: decision.approvedReference.width,
      height: decision.approvedReference.height,
    };
    requiredVerifications.set(verificationKey(key, required.evidenceLane), required);
  }
  const evidenceVerifications = buildVerificationIndex({
    records: input.evidenceVerifications,
    required: requiredVerifications,
  });

  const rows = readiness.rows.map((sourceRow): CylinderDualRoleRemediationRow => {
    const key = sourceRow.canonicalIdentityKey;
    const recoveryDecision = recovery.get(key);
    const livePointerDecision = livePointer.get(key);
    const taxonomyOverride = taxonomy.get(key);
    validateEmbeddedEvidence(sourceRow, recoveryDecision, livePointerDecision);

    let canonicalFamily: "Cylinder" | "Vial" = "Cylinder";
    let route: CylinderDualRoleRoute;
    let evidence: CylinderDualRoleEvidence;
    let roleJobs: CylinderDualRoleJob[] = [];
    let blockers = [...sourceRow.blockers];

    if (taxonomyOverride) {
      canonicalFamily = "Vial";
      route = "routed-to-vial";
      evidence = noEvidence();
      blockers = [];
    } else if (sourceRow.status === "both-roles-verified") {
      assertVerifiedRoleEligibility(sourceRow);
      const sidecar = sourceRow.references.pdpCapOffSidecar;
      if (sidecar.sourceRoute === "exact-live-pdp-sidecar") {
        route = "remediate-current-live-sidecar";
        evidence = roleEvidence("current-live-sidecar", sidecar);
        roleJobs = [roleJob(key, "preserve-cap-off-sidecar-reference", evidence.lane)];
      } else {
        route = "strict-both-roles-ready";
        evidence = roleEvidence("verified-role-pair", sidecar);
      }
      blockers = [];
    } else if (livePointerDecision) {
      if (livePointerDecision.componentTopology
        !== "bottle-primary-with-detached-cap-or-overcap-sidecar") {
        throw new Error(`Unrecognized live-pointer topology for ${key}.`);
      }
      route = "approved-detached-dual-role";
      evidence = livePointerEvidence(
        livePointerDecision,
        evidenceVerifications.get(verificationKey(key, "approved-live-pointer"))!,
      );
      roleJobs = [
        roleJob(key, "assemble-cap-on-reference", evidence.lane),
        roleJob(key, "preserve-cap-off-sidecar-reference", evidence.lane),
      ];
      blockers = [];
    } else if (recoveryDecision?.classification === "detached-cap-or-sidecar") {
      route = "approved-detached-dual-role";
      evidence = recoveryEvidence(
        recoveryDecision,
        evidenceVerifications.get(verificationKey(key, "approved-recovery"))!,
      );
      roleJobs = [
        roleJob(key, "assemble-cap-on-reference", evidence.lane),
        roleJob(key, "preserve-cap-off-sidecar-reference", evidence.lane),
      ];
      blockers = [];
    } else if (recoveryDecision?.classification === "assembled-cap-on") {
      route = "approved-topology-exception";
      evidence = recoveryEvidence(
        recoveryDecision,
        evidenceVerifications.get(verificationKey(key, "approved-recovery"))!,
      );
      roleJobs = [
        roleJob(key, "preserve-cap-on-reference", evidence.lane),
        roleJob(key, "preserve-assembled-topology-exception", evidence.lane),
      ];
      blockers = [];
    } else if (recoveryDecision) {
      throw new Error(`Unrecognized recovery classification for ${key}.`);
    } else {
      route = "hard-blocked-no-evidence";
      evidence = noEvidence();
      if (blockers.length === 0) blockers = ["no-approved-exact-evidence"];
    }

    return {
      canonicalIdentityKey: key,
      websiteSku: sourceRow.websiteSku,
      graceSku: sourceRow.graceSku,
      canonicalFamily,
      route,
      canonical: { ...sourceRow.canonical, family: canonicalFamily },
      evidence,
      roleJobs,
      blockers,
    };
  });

  const routeCounts = {
    strictBothRolesReadyCount: countRoute(rows, "strict-both-roles-ready"),
    currentLiveSidecarRemediationCount: countRoute(rows, "remediate-current-live-sidecar"),
    approvedDetachedDualRoleCount: countRoute(rows, "approved-detached-dual-role"),
    approvedTopologyExceptionCount: countRoute(rows, "approved-topology-exception"),
    hardBlockedNoEvidenceCount: countRoute(rows, "hard-blocked-no-evidence"),
    vialHandoffCount: countRoute(rows, "routed-to-vial"),
  };
  const expectedCounts = {
    strictBothRolesReadyCount: 172,
    currentLiveSidecarRemediationCount: 56,
    approvedDetachedDualRoleCount: 123,
    approvedTopologyExceptionCount: 13,
    hardBlockedNoEvidenceCount: 11,
    vialHandoffCount: 2,
  };
  for (const [name, expected] of Object.entries(expectedCounts)) {
    if (routeCounts[name as keyof typeof routeCounts] !== expected) {
      throw new Error(
        `Dual-role route ${name} expected ${expected}, received ${routeCounts[name as keyof typeof routeCounts]}.`,
      );
    }
  }
  const roleJobCount = rows.reduce((count, row) => count + row.roleJobs.length, 0);
  if (roleJobCount !== 328) {
    throw new Error(`Dual-role remediation expected 328 role jobs, received ${roleJobCount}.`);
  }

  const unsealed: Omit<CylinderDualRoleRemediationPlan, "sha256"> = {
    version: BEST_BOTTLES_CYLINDER_DUAL_ROLE_REMEDIATION_VERSION,
    generatedAt: input.generatedAt,
    provenance: {
      inputs: Object.fromEntries(Object.entries(sources).map(([name, source]) => [
        name,
        { path: source.path, sha256: source.fileSha256.toLowerCase() },
      ])),
      localEvidenceVerificationCount: 136,
    },
    authorization: {
      planMode: "read-only",
      outputState: "review-pending",
      remoteWrites: "forbidden",
      publishStatus: "not-authorized",
    },
    summary: {
      sourceIdentityCount: 377,
      cylinderIdentityCount: 375,
      vialHandoffCount: 2,
      strictBothRolesReadyCount: 172,
      currentLiveSidecarRemediationCount: 56,
      approvedDetachedDualRoleCount: 123,
      approvedTopologyExceptionCount: 13,
      hardBlockedNoEvidenceCount: 11,
      roleJobCount,
      externalWriteCount: 0,
    },
    rows,
  };

  return { ...unsealed, sha256: sha256(stableJson(unsealed)) };
}
