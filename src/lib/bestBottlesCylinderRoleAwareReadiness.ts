import { createHash } from "node:crypto";

import type {
  CylinderProductionCanonicalIdentity,
  CylinderProductionReadinessRow,
} from "./bestBottlesCylinderProductionCutover";

export const BEST_BOTTLES_CYLINDER_ROLE_AWARE_READINESS_VERSION =
  "best-bottles-cylinder-role-aware-readiness-v2" as const;

export type CylinderReferenceRoleStatus = "verified" | "blocked";
export type CylinderReferenceProductionStatus = "generation-authorized" | "blocked";
export type CylinderReferenceRemoteStatus = "verified" | "unverified";
export type CylinderReferenceSourceReviewStatus =
  | "approved"
  | "pending"
  | "evidence-only"
  | "missing";
export type CylinderReferenceSourceRoute =
  | "production-readiness-cap-on"
  | "exact-psd-sidecar"
  | "exact-live-pdp-sidecar"
  | "reviewed-immutable-sidecar-remediation"
  | "reviewed-bbuat-studio-capped"
  | "live-topology-exception"
  | null;
export type CylinderReferenceResolutionStatus =
  | "high-resolution"
  | "low-resolution"
  | "missing";
export type CylinderRoleTopology =
  | "assembled-cap-on"
  | "fitment-attached-cap-right-sidecar"
  | "assembled-live-site-exception"
  | null;
export type CylinderApprovedTopologyException =
  | "live-site-vintage-bulb"
  | "live-site-genuine-two-piece"
  | null;

interface ArtifactSource<T> {
  path: string;
  fileSha256: string;
  data: T;
}

interface PromotionPlanRow {
  canonicalIdentityKey: string;
  websiteSku: string;
  graceSku: string;
  canonical?: CylinderProductionCanonicalIdentity;
  exportSha256: string;
  bytes: number;
  width: number;
  height: number;
  opaque: boolean;
  storage: { bucket: string; path: string; publicUrl: string };
  remote: { status: string; sha256?: string; bytes?: number };
  pipeline: { status: string; exactJobCount: number; currentReferencePath?: string | null };
  blockers: string[];
  decision: string;
}

interface PromotionExecutionRow {
  canonicalIdentityKey: string;
  storagePath: string;
  publicUrl: string;
  exportSha256: string;
  uploadDisposition: string;
  jobDisposition: string;
}

interface PromotionAuditArtifact {
  version: string;
  manifestSha256?: string;
  sourceManifestSha256?: string;
  preflightSha256?: string;
  plan: {
    version: string;
    summary: { qualifiedIdentityCount: number; blockedCount: number };
    rows: PromotionPlanRow[];
  };
}

interface PromotionExecutionArtifact {
  version: string;
  manifestSha256?: string;
  sourceManifestSha256?: string;
  preflightSha256?: string;
  executionSha256: string;
  result: {
    version: string;
    summary: { identityCount: number; verifiedCount: number; failedCount: number };
    rows: PromotionExecutionRow[];
  };
}

interface SidecarManifestRecord {
  canonicalIdentityKey: string;
  websiteSku: string;
  graceSku: string;
  route: string;
  requiredOutputTopology: string;
  blockers: string[];
  source: {
    reviewStatus?: string | null;
    canonicalReviewMetadata?: {
      applicator?: string | null;
      assemblyType?: string | null;
    } | null;
  } | null;
  output: {
    sha256: string;
    width: number;
    height: number;
    opaque: boolean;
  };
}

interface SidecarManifestArtifact {
  version: string;
  summary: { targetCount: number; blockedCount: number };
  records: SidecarManifestRecord[];
}

interface LivePointerDecision {
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
  };
}

interface RecoveryDecision {
  websiteSku: string;
  graceSku: string;
  identityDecision: string;
  classification: string;
  resolutionStatus: string;
  productionDisposition: string;
  sourceSha256: string;
  outputSha256: string;
  width: number;
  height: number;
}

interface ProductionReadinessArtifact {
  version: string;
  minimumReferencePixels: number;
  summary: {
    canonicalIdentityCount: number;
    productionQualifiedCount: number;
    totalBlockedCount: number;
  };
  rows: CylinderProductionReadinessRow[];
}

interface LivePointerApprovalArtifact {
  version: string;
  sha256?: string;
  decisions: LivePointerDecision[];
}

interface RecoveryApprovalArtifact {
  version: string;
  decisions: RecoveryDecision[];
}

export interface CylinderReviewedRoleApproval {
  canonicalIdentityKey: string;
  websiteSku: string;
  graceSku: string;
  roleId: "identity-cap-on" | "pdp-cap-off-sidecar";
  sourceSha256: string;
  reviewedOutputSha256: string;
  decision: "preserve-exact-local-reference";
}

interface ReviewedRoleApprovalArtifact {
  version: "best-bottles-cylinder-reviewed-role-approvals-v1";
  decisions: CylinderReviewedRoleApproval[];
}

export interface BbuatReviewedReferenceRecord {
  canonicalIdentityKey: string;
  websiteSku: string;
  graceSku: string;
  roleId: "identity-cap-on" | "pdp-cap-off-sidecar";
  storagePath: string;
  publicUrl: string;
  exportSha256: string;
  bytes: number;
  width: number;
  height: number;
  opaque: boolean;
  pixelCount: number;
  // Vintage bulb sprayers are two-piece products with no cap-off state: their
  // sidecar lane is satisfied by the assembled image under an explicitly
  // approved exception (Jordan, 2026-07-18). Reducers are normally dual-state;
  // a reducer may carry this exception only as an explicit per-SKU interim
  // allowance (currently just GBCyl50RdcrShnBlkTall, flagged for retake).
  sidecarTopologyException?: "live-site-vintage-bulb" | "live-site-genuine-two-piece";
}

interface BbuatReviewedReferencesArtifact {
  version: "best-bottles-bbuat-cylinder-reviewed-references-v1";
  reviewedBy: string;
  reviewedAt: string;
  records: BbuatReviewedReferenceRecord[];
}

export interface CylinderRoleAwareReadinessInput {
  generatedAt: string;
  sources: {
    productionReadiness: ArtifactSource<ProductionReadinessArtifact>;
    identityCapOnAudit: ArtifactSource<PromotionAuditArtifact>;
    identityCapOnExecution: ArtifactSource<PromotionExecutionArtifact>;
    pdpCapOffSidecarPreflight: ArtifactSource<PromotionAuditArtifact>;
    pdpCapOffSidecarExecution: ArtifactSource<PromotionExecutionArtifact>;
    pdpCapOffSidecarManifest: ArtifactSource<SidecarManifestArtifact>;
    livePointerApproval: ArtifactSource<LivePointerApprovalArtifact>;
    recoveryApproval: ArtifactSource<RecoveryApprovalArtifact>;
    reviewedRoleApprovals?: ArtifactSource<ReviewedRoleApprovalArtifact>;
    bbuatStudioReferences?: ArtifactSource<BbuatReviewedReferencesArtifact>;
  };
}

export interface CylinderReferenceRole {
  roleId: "identity-cap-on" | "pdp-cap-off-sidecar";
  status: CylinderReferenceRoleStatus;
  remoteStatus: CylinderReferenceRemoteStatus;
  productionStatus: CylinderReferenceProductionStatus;
  sourceReviewStatus: CylinderReferenceSourceReviewStatus;
  sourceRoute: CylinderReferenceSourceRoute;
  resolutionStatus: CylinderReferenceResolutionStatus;
  pixelCount: number | null;
  publicUrl: string | null;
  storagePath: string | null;
  exportSha256: string | null;
  reviewedOutputSha256?: string | null;
  width: number | null;
  height: number | null;
  opaque: true | null;
  topology: CylinderRoleTopology;
  approvedException: CylinderApprovedTopologyException;
  blockers: string[];
}

export interface CylinderApprovedEvidence {
  livePointer: {
    identityDecision: string;
    componentTopology: string;
    referenceSha256: string;
    width: number;
    height: number;
    resolutionStatus: string;
    productionDisposition: string;
  } | null;
  recovery: {
    identityDecision: string;
    classification: string;
    sourceSha256: string;
    outputSha256: string;
    width: number;
    height: number;
    resolutionStatus: string;
    productionDisposition: string;
  } | null;
}

export interface CylinderRoleAwareReadinessRow {
  canonicalIdentityKey: string;
  websiteSku: string;
  graceSku: string;
  status: "both-roles-verified" | "blocked";
  blockers: string[];
  canonical: CylinderProductionCanonicalIdentity;
  references: {
    identityCapOn: CylinderReferenceRole & { roleId: "identity-cap-on" };
    pdpCapOffSidecar: CylinderReferenceRole & { roleId: "pdp-cap-off-sidecar" };
  };
  approvedEvidence: CylinderApprovedEvidence;
}

export interface CylinderRoleAwareReadinessArtifact {
  version: typeof BEST_BOTTLES_CYLINDER_ROLE_AWARE_READINESS_VERSION;
  generatedAt: string;
  provenance: Record<string, unknown>;
  authorization: {
    exactEvidenceIdentityCount: number;
    generationScope: "controlled-studio-only";
    generationStatus: "authorized-for-controlled-generation";
    publishStatus: "not-publish-ready";
    individualContentReviewStatus: "not-individually-content-approved";
    requiredNextGate: "generated-output-qa-and-explicit-publish-approval";
  };
  summary: {
    canonicalIdentityCount: number;
    identityCapOnVerifiedCount: number;
    pdpCapOffSidecarVerifiedCount: number;
    bothRolesVerifiedCount: number;
    blockedIdentityCount: number;
    standardSidecarCount: number;
    liveSiteExceptionCount: number;
    approvedEvidenceBlockedCount: number;
    missingApprovedEvidenceBlockedCount: number;
    externalWriteCount: 0;
  };
  rows: CylinderRoleAwareReadinessRow[];
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
  row: { canonicalIdentityKey: string; websiteSku: string; graceSku: string },
  label: string,
): void {
  const expected = identityKey(row.websiteSku, row.graceSku);
  if (!normalizedIdentity(row.websiteSku) || !normalizedIdentity(row.graceSku)) {
    throw new Error(`${label} is missing exact Website + Grace SKU identity.`);
  }
  if (row.canonicalIdentityKey !== expected) {
    throw new Error(
      `${label} ${row.canonicalIdentityKey} does not match exact Website + Grace SKU ${expected}.`,
    );
  }
}

function indexExactRows<T extends { canonicalIdentityKey: string }>(
  rows: readonly T[],
  label: string,
  canonicalIdentities: ReadonlySet<string>,
  validateDualIdentity: boolean,
): Map<string, T> {
  const index = new Map<string, T>();
  for (const row of rows) {
    if (validateDualIdentity) {
      assertExactIdentity(
        row as T & { websiteSku: string; graceSku: string },
        label,
      );
    }
    if (!canonicalIdentities.has(row.canonicalIdentityKey)) {
      throw new Error(
        `${label} ${row.canonicalIdentityKey} does not match exact Website + Grace SKU in canonical readiness.`,
      );
    }
    if (index.has(row.canonicalIdentityKey)) {
      throw new Error(`Duplicate ${label} identity ${row.canonicalIdentityKey}.`);
    }
    index.set(row.canonicalIdentityKey, row);
  }
  return index;
}

function blockedRole(
  roleId: CylinderReferenceRole["roleId"],
  blockers: string[],
  topology: CylinderRoleTopology = null,
): CylinderReferenceRole {
  return {
    roleId,
    status: "blocked",
    remoteStatus: "unverified",
    productionStatus: "blocked",
    sourceReviewStatus: "missing",
    sourceRoute: null,
    resolutionStatus: "missing",
    pixelCount: null,
    publicUrl: null,
    storagePath: null,
    exportSha256: null,
    width: null,
    height: null,
    opaque: null,
    topology,
    approvedException: null,
    blockers: Array.from(new Set(blockers)),
  };
}

function resolutionStatus(
  width: number,
  height: number,
  minimumReferencePixels: number,
): Exclude<CylinderReferenceResolutionStatus, "missing"> {
  return width * height >= minimumReferencePixels
    ? "high-resolution"
    : "low-resolution";
}

function promotionConsistencyBlockers(input: {
  label: string;
  audit: PromotionPlanRow | undefined;
  execution: PromotionExecutionRow | undefined;
  executionSummaryFailedCount: number;
}): string[] {
  const blockers: string[] = [];
  if (!input.audit) blockers.push(`missing exact ${input.label} audit`);
  if (!input.execution) blockers.push(`missing exact ${input.label} execution`);
  if (input.executionSummaryFailedCount !== 0) {
    blockers.push(`${input.label} execution summary reports failures`);
  }
  if (!input.audit || !input.execution) return blockers;
  if (input.audit.blockers.length > 0 || input.audit.decision === "blocked") {
    blockers.push(`${input.label} audit is blocked`);
  }
  if (input.audit.remote.status !== "exact-match") {
    blockers.push(`${input.label} remote object is not an exact byte match`);
  }
  if (input.audit.pipeline.status !== "already-target") {
    blockers.push(`${input.label} current audit is not already at the immutable target`);
  }
  if (
    input.execution.storagePath !== input.audit.storage.path
    || input.execution.publicUrl !== input.audit.storage.publicUrl
    || input.execution.exportSha256 !== input.audit.exportSha256
  ) {
    blockers.push(`${input.label} execution disagrees with current audit URL/path/hash`);
  }
  if (
    input.audit.remote.sha256 !== input.audit.exportSha256
    || input.audit.remote.bytes !== input.audit.bytes
  ) {
    blockers.push(`${input.label} current audit remote bytes disagree with export`);
  }
  assertSha256(input.audit.exportSha256, `${input.label} export hash`);
  if (!/^https:\/\//i.test(input.audit.storage.publicUrl)) {
    blockers.push(`${input.label} public URL is not HTTPS`);
  }
  return blockers;
}

function approvedExceptionFor(record: SidecarManifestRecord): {
  approvedException: CylinderApprovedTopologyException;
  blocker: string | null;
} {
  if (record.requiredOutputTopology !== "assembled-live-site-exception") {
    return { approvedException: null, blocker: null };
  }
  const applicator = record.source?.canonicalReviewMetadata?.applicator ?? "";
  const assemblyType = record.source?.canonicalReviewMetadata?.assemblyType ?? "";
  if (/\b(?:vintage|antique|bulb|tassel)\b/i.test(applicator)) {
    return { approvedException: "live-site-vintage-bulb", blocker: null };
  }
  if (/^2[- ]part$/i.test(assemblyType)) {
    return { approvedException: "live-site-genuine-two-piece", blocker: null };
  }
  return { approvedException: null, blocker: "unapproved live-site topology exception" };
}

function sourceReviewStatus(record: SidecarManifestRecord): CylinderReferenceSourceReviewStatus {
  const value = String(record.source?.reviewStatus ?? "").toLowerCase();
  if (value.includes("approved") || value.includes("reviewed")) return "approved";
  return "pending";
}

function liveEvidence(decision: LivePointerDecision | undefined): CylinderApprovedEvidence["livePointer"] {
  if (!decision) return null;
  return {
    identityDecision: decision.identityDecision,
    componentTopology: decision.componentTopology,
    referenceSha256: decision.approvedReference.sha256,
    width: decision.approvedReference.width,
    height: decision.approvedReference.height,
    resolutionStatus: decision.resolutionStatus,
    productionDisposition: decision.productionDisposition,
  };
}

function recoveryEvidence(decision: RecoveryDecision | undefined): CylinderApprovedEvidence["recovery"] {
  if (!decision) return null;
  return {
    identityDecision: decision.identityDecision,
    classification: decision.classification,
    sourceSha256: decision.sourceSha256,
    outputSha256: decision.outputSha256,
    width: decision.width,
    height: decision.height,
    resolutionStatus: decision.resolutionStatus,
    productionDisposition: decision.productionDisposition,
  };
}

export function composeCylinderRoleAwareReadiness(
  input: CylinderRoleAwareReadinessInput,
): CylinderRoleAwareReadinessArtifact {
  const { sources } = input;
  for (const [name, source] of Object.entries(sources)) {
    assertSha256(source.fileSha256, `${name} file hash`);
  }
  if (sources.productionReadiness.data.version !== "best-bottles-cylinder-production-readiness-v1") {
    throw new Error("Role-aware readiness requires Cylinder production readiness v1.");
  }
  const readinessRows = sources.productionReadiness.data.rows;
  if (readinessRows.length !== sources.productionReadiness.data.summary.canonicalIdentityCount) {
    throw new Error("Cylinder production readiness row count disagrees with its summary.");
  }
  const minimumReferencePixels = sources.productionReadiness.data.minimumReferencePixels;
  if (!Number.isInteger(minimumReferencePixels) || minimumReferencePixels <= 0) {
    throw new Error("Cylinder production readiness has an invalid minimum-reference-pixel threshold.");
  }
  const canonicalIdentities = new Set<string>();
  for (const row of readinessRows) {
    assertExactIdentity(row, "Cylinder readiness row");
    if (canonicalIdentities.has(row.canonicalIdentityKey)) {
      throw new Error(`Duplicate Cylinder readiness identity ${row.canonicalIdentityKey}.`);
    }
    canonicalIdentities.add(row.canonicalIdentityKey);
  }

  const capOnAudit = indexExactRows(
    sources.identityCapOnAudit.data.plan.rows,
    "cap-on audit",
    canonicalIdentities,
    true,
  );
  const capOnExecution = indexExactRows(
    sources.identityCapOnExecution.data.result.rows,
    "cap-on execution",
    canonicalIdentities,
    false,
  );
  const sidecarAudit = indexExactRows(
    sources.pdpCapOffSidecarPreflight.data.plan.rows,
    "sidecar audit",
    canonicalIdentities,
    true,
  );
  const sidecarExecution = indexExactRows(
    sources.pdpCapOffSidecarExecution.data.result.rows,
    "sidecar execution",
    canonicalIdentities,
    false,
  );
  const sidecarManifest = indexExactRows(
    sources.pdpCapOffSidecarManifest.data.records,
    "sidecar source manifest",
    canonicalIdentities,
    true,
  );
  const livePointer = indexExactRows(
    sources.livePointerApproval.data.decisions,
    "live-pointer approval",
    canonicalIdentities,
    true,
  );
  const recoveryRows = sources.recoveryApproval.data.decisions.map((decision) => ({
    ...decision,
    canonicalIdentityKey: identityKey(decision.websiteSku, decision.graceSku),
  }));
  const recovery = indexExactRows(
    recoveryRows,
    "recovery approval",
    canonicalIdentities,
    true,
  );

  const reviewedApprovals = new Map<string, CylinderReviewedRoleApproval>();
  if (sources.reviewedRoleApprovals) {
    const approvals = sources.reviewedRoleApprovals.data;
    if (approvals.version !== "best-bottles-cylinder-reviewed-role-approvals-v1") {
      throw new Error("Reviewed role approvals artifact has an unexpected version.");
    }
    for (const decision of approvals.decisions) {
      assertExactIdentity(decision, "reviewed role approval");
      if (!canonicalIdentities.has(decision.canonicalIdentityKey)) {
        throw new Error(
          `Reviewed role approval ${decision.canonicalIdentityKey} does not match exact Website + Grace SKU in canonical readiness.`,
        );
      }
      if (decision.decision !== "preserve-exact-local-reference") {
        throw new Error(`Reviewed role approval ${decision.canonicalIdentityKey} has an unsupported decision.`);
      }
      if (decision.roleId !== "identity-cap-on" && decision.roleId !== "pdp-cap-off-sidecar") {
        throw new Error(`Reviewed role approval ${decision.canonicalIdentityKey} has an unsupported role.`);
      }
      assertSha256(decision.sourceSha256, `Reviewed role approval ${decision.canonicalIdentityKey} source hash`);
      assertSha256(
        decision.reviewedOutputSha256,
        `Reviewed role approval ${decision.canonicalIdentityKey} reviewed output hash`,
      );
      if (decision.sourceSha256.toLowerCase() !== decision.reviewedOutputSha256.toLowerCase()) {
        throw new Error(
          `Reviewed role approval ${decision.canonicalIdentityKey} must preserve exact bytes; source and reviewed output hashes differ.`,
        );
      }
      const approvalKey = `${decision.canonicalIdentityKey}::${decision.roleId}`;
      if (reviewedApprovals.has(approvalKey)) {
        throw new Error(`Duplicate reviewed role approval ${approvalKey}.`);
      }
      reviewedApprovals.set(approvalKey, decision);
    }
  }
  const consumedApprovals = new Set<string>();

  // BBUAT studio archive references: human-reviewed capped/uncapped exports
  // whose bytes are already immutable in storage. They may only FILL a lane
  // that the primary evidence chain left blocked — they never displace an
  // already-verified lane.
  const bbuatByKeyRole = new Map<string, BbuatReviewedReferenceRecord>();
  if (sources.bbuatStudioReferences) {
    const bbuat = sources.bbuatStudioReferences.data;
    if (bbuat.version !== "best-bottles-bbuat-cylinder-reviewed-references-v1") {
      throw new Error("BBUAT reviewed references artifact has an unexpected version.");
    }
    if (!bbuat.reviewedBy?.trim() || Number.isNaN(Date.parse(bbuat.reviewedAt))) {
      throw new Error("BBUAT reviewed references artifact is missing human review provenance.");
    }
    for (const record of bbuat.records) {
      assertExactIdentity(record, "BBUAT reviewed reference");
      if (!canonicalIdentities.has(record.canonicalIdentityKey)) {
        throw new Error(
          `BBUAT reviewed reference ${record.canonicalIdentityKey} does not match exact Website + Grace SKU in canonical readiness.`,
        );
      }
      if (record.roleId !== "identity-cap-on" && record.roleId !== "pdp-cap-off-sidecar") {
        throw new Error(`BBUAT reviewed reference ${record.canonicalIdentityKey} has an unsupported role.`);
      }
      assertSha256(record.exportSha256, `BBUAT reviewed reference ${record.canonicalIdentityKey} export hash`);
      if (record.opaque !== true || !(record.width > 0) || !(record.height > 0)) {
        throw new Error(`BBUAT reviewed reference ${record.canonicalIdentityKey} must be an opaque image with positive dimensions.`);
      }
      const sha = record.exportSha256.toLowerCase();
      const root = record.roleId === "identity-cap-on"
        ? "best-bottles/production-references/cylinder/v1"
        : "best-bottles/production-references/cylinder/sidecar-v2";
      const expectedPath = `${root}/${sha.slice(0, 2)}/${record.canonicalIdentityKey.replace("|", "__")}__${sha}.png`;
      if (record.storagePath !== expectedPath) {
        throw new Error(`BBUAT reviewed reference ${record.canonicalIdentityKey} has a malformed immutable storage path.`);
      }
      if (!/^https:\/\//.test(record.publicUrl) || !record.publicUrl.endsWith(`/storage/v1/object/public/reference-images/${expectedPath}`)) {
        throw new Error(`BBUAT reviewed reference ${record.canonicalIdentityKey} has a non-immutable public URL.`);
      }
      const mapKey = `${record.canonicalIdentityKey}::${record.roleId}`;
      if (bbuatByKeyRole.has(mapKey)) {
        throw new Error(`Duplicate BBUAT reviewed reference ${mapKey}.`);
      }
      bbuatByKeyRole.set(mapKey, record);
    }
  }

  function bbuatVerifiedRole(record: BbuatReviewedReferenceRecord): CylinderReferenceRole {
    const isCapOn = record.roleId === "identity-cap-on";
    return {
      roleId: record.roleId,
      status: "verified",
      remoteStatus: "verified",
      productionStatus: "generation-authorized",
      sourceReviewStatus: "approved",
      sourceRoute: isCapOn ? "reviewed-bbuat-studio-capped" : "reviewed-immutable-sidecar-remediation",
      resolutionStatus: resolutionStatus(record.width, record.height, minimumReferencePixels),
      pixelCount: record.pixelCount,
      publicUrl: record.publicUrl,
      storagePath: record.storagePath,
      exportSha256: record.exportSha256.toLowerCase(),
      ...(isCapOn ? {} : { reviewedOutputSha256: record.exportSha256.toLowerCase() }),
      width: record.width,
      height: record.height,
      opaque: true,
      topology: isCapOn
        ? "assembled-cap-on"
        : record.sidecarTopologyException
          ? "assembled-live-site-exception"
          : "fitment-attached-cap-right-sidecar",
      approvedException: isCapOn ? null : record.sidecarTopologyException ?? null,
      blockers: [],
    };
  }

  const sidecarSourceSha = sources.pdpCapOffSidecarManifest.fileSha256.toLowerCase();
  const embeddedSidecarSourceHashes = [
    sources.pdpCapOffSidecarPreflight.data.sourceManifestSha256,
    sources.pdpCapOffSidecarExecution.data.sourceManifestSha256,
  ];
  if (embeddedSidecarSourceHashes.some((value) => value?.toLowerCase() !== sidecarSourceSha)) {
    throw new Error("Sidecar promotion artifacts do not share the exact source manifest hash.");
  }

  const rows = readinessRows.map((readiness): CylinderRoleAwareReadinessRow => {
    const key = readiness.canonicalIdentityKey;
    const approvedEvidence: CylinderApprovedEvidence = {
      livePointer: liveEvidence(livePointer.get(key)),
      recovery: recoveryEvidence(recovery.get(key)),
    };
    const evidenceTopologyConflict = approvedEvidence.livePointer && approvedEvidence.recovery
      && (
        approvedEvidence.livePointer.componentTopology.includes("sidecar")
        !== approvedEvidence.recovery.classification.includes("sidecar")
      );
    const commonBlockers = evidenceTopologyConflict
      ? ["contradictory approved reference topology"]
      : [];

    let identityCapOn: CylinderReferenceRole;
    let pdpCapOffSidecar: CylinderReferenceRole;
    if (readiness.status !== "production-qualified") {
      const readinessBlockers = readiness.blockers.length > 0
        ? readiness.blockers
        : ["not production-qualified in Cylinder readiness v1"];
      identityCapOn = blockedRole("identity-cap-on", [...readinessBlockers, ...commonBlockers]);
      identityCapOn.sourceReviewStatus = readiness.reference ? "evidence-only" : "missing";
      if (readiness.reference) {
        identityCapOn.sourceRoute = "production-readiness-cap-on";
        identityCapOn.resolutionStatus = resolutionStatus(
          readiness.reference.width,
          readiness.reference.height,
          minimumReferencePixels,
        );
        identityCapOn.pixelCount = readiness.reference.width * readiness.reference.height;
        identityCapOn.exportSha256 = readiness.reference.exportSha256;
        identityCapOn.width = readiness.reference.width;
        identityCapOn.height = readiness.reference.height;
        identityCapOn.opaque = true;
      }
      pdpCapOffSidecar = blockedRole(
        "pdp-cap-off-sidecar",
        ["not-promoted sidecar reference", ...readinessBlockers, ...commonBlockers],
      );
      pdpCapOffSidecar.sourceReviewStatus = approvedEvidence.livePointer || approvedEvidence.recovery
        ? "evidence-only"
        : "missing";
    } else {
      const capOnPlan = capOnAudit.get(key);
      const capOnResult = capOnExecution.get(key);
      const capOnBlockers = [
        ...commonBlockers,
        ...promotionConsistencyBlockers({
          label: "cap-on",
          audit: capOnPlan,
          execution: capOnResult,
          executionSummaryFailedCount: sources.identityCapOnExecution.data.result.summary.failedCount,
        }),
      ];
      if (!readiness.reference) capOnBlockers.push("production-qualified row has no cap-on reference");
      if (
        readiness.reference
        && capOnPlan
        && readiness.reference.exportSha256 !== capOnPlan.exportSha256
      ) {
        capOnBlockers.push("cap-on readiness hash disagrees with promoted reference");
      }
      identityCapOn = capOnBlockers.length > 0 || !capOnPlan
        ? blockedRole("identity-cap-on", capOnBlockers, "assembled-cap-on")
        : {
            roleId: "identity-cap-on",
            status: "verified",
            remoteStatus: "verified",
            productionStatus: "generation-authorized",
            sourceReviewStatus: "approved",
            sourceRoute: "production-readiness-cap-on",
            resolutionStatus: resolutionStatus(
              capOnPlan.width,
              capOnPlan.height,
              minimumReferencePixels,
            ),
            pixelCount: capOnPlan.width * capOnPlan.height,
            publicUrl: capOnPlan.storage.publicUrl,
            storagePath: capOnPlan.storage.path,
            exportSha256: capOnPlan.exportSha256,
            width: capOnPlan.width,
            height: capOnPlan.height,
            opaque: true,
            topology: "assembled-cap-on",
            approvedException: null,
            blockers: [],
          };
      const capOnApproval = reviewedApprovals.get(`${key}::identity-cap-on`);
      if (capOnApproval) {
        if (
          identityCapOn.status !== "verified"
          || identityCapOn.exportSha256?.toLowerCase() !== capOnApproval.reviewedOutputSha256.toLowerCase()
        ) {
          throw new Error(
            `Reviewed cap-on approval for ${key} does not match the promoted immutable export hash.`,
          );
        }
        identityCapOn.reviewedOutputSha256 = capOnApproval.reviewedOutputSha256.toLowerCase();
        consumedApprovals.add(`${key}::identity-cap-on`);
      }

      const sidecarPlan = sidecarAudit.get(key);
      const sidecarResult = sidecarExecution.get(key);
      const sourceRecord = sidecarManifest.get(key);
      const sidecarBlockers = [
        ...commonBlockers,
        ...promotionConsistencyBlockers({
          label: "sidecar",
          audit: sidecarPlan,
          execution: sidecarResult,
          executionSummaryFailedCount: sources.pdpCapOffSidecarExecution.data.result.summary.failedCount,
        }),
      ];
      if (!sourceRecord) {
        sidecarBlockers.push("missing exact sidecar source manifest record");
      } else {
        if (sourceRecord.blockers.length > 0) sidecarBlockers.push("sidecar source manifest is blocked");
        if (!sidecarPlan || (
          sourceRecord.output.sha256 !== sidecarPlan.exportSha256
          || sourceRecord.output.width !== sidecarPlan.width
          || sourceRecord.output.height !== sidecarPlan.height
          || sourceRecord.output.opaque !== true
        )) {
          sidecarBlockers.push("sidecar source manifest disagrees with promoted export");
        }
      }
      let topology: CylinderRoleTopology = null;
      let approvedException: CylinderApprovedTopologyException = null;
      if (sourceRecord?.requiredOutputTopology === "fitment-attached-cap-right-sidecar") {
        if (!["exact-psd-sidecar", "exact-live-pdp-sidecar"].includes(sourceRecord.route)) {
          sidecarBlockers.push("sidecar route/topology mismatch");
        }
        topology = "fitment-attached-cap-right-sidecar";
      } else if (sourceRecord?.requiredOutputTopology === "assembled-live-site-exception") {
        if (sourceRecord.route !== "live-topology-exception") {
          sidecarBlockers.push("sidecar route/topology mismatch");
        }
        topology = "assembled-live-site-exception";
        const exception = approvedExceptionFor(sourceRecord);
        approvedException = exception.approvedException;
        if (exception.blocker) sidecarBlockers.push(exception.blocker);
      } else if (sourceRecord) {
        sidecarBlockers.push("unsupported sidecar output topology");
      }
      let sidecarRoute = (sourceRecord?.route ?? null) as CylinderReferenceSourceRoute;
      let reviewedSidecarOutputSha256: string | null = null;
      if (sourceRecord?.route === "exact-live-pdp-sidecar") {
        const sidecarApproval = reviewedApprovals.get(`${key}::pdp-cap-off-sidecar`);
        if (!sidecarApproval) {
          sidecarBlockers.push("raw live-PDP sidecar requires reviewed immutable remediation");
        } else if (
          !sidecarPlan
          || sidecarApproval.reviewedOutputSha256.toLowerCase() !== sidecarPlan.exportSha256.toLowerCase()
        ) {
          throw new Error(
            `Reviewed sidecar approval for ${key} does not match the promoted immutable export hash.`,
          );
        } else {
          sidecarRoute = "reviewed-immutable-sidecar-remediation";
          reviewedSidecarOutputSha256 = sidecarApproval.reviewedOutputSha256.toLowerCase();
          consumedApprovals.add(`${key}::pdp-cap-off-sidecar`);
        }
      }
      pdpCapOffSidecar = sidecarBlockers.length > 0 || !sidecarPlan || !sourceRecord
        ? blockedRole("pdp-cap-off-sidecar", sidecarBlockers, topology)
        : {
            roleId: "pdp-cap-off-sidecar",
            status: "verified",
            remoteStatus: "verified",
            productionStatus: "generation-authorized",
            sourceReviewStatus: reviewedSidecarOutputSha256 ? "approved" : sourceReviewStatus(sourceRecord),
            sourceRoute: sidecarRoute,
            ...(reviewedSidecarOutputSha256 ? { reviewedOutputSha256: reviewedSidecarOutputSha256 } : {}),
            resolutionStatus: resolutionStatus(
              sidecarPlan.width,
              sidecarPlan.height,
              minimumReferencePixels,
            ),
            pixelCount: sidecarPlan.width * sidecarPlan.height,
            publicUrl: sidecarPlan.storage.publicUrl,
            storagePath: sidecarPlan.storage.path,
            exportSha256: sidecarPlan.exportSha256,
            width: sidecarPlan.width,
            height: sidecarPlan.height,
            opaque: true,
            topology,
            approvedException,
            blockers: [],
          };
    }

    const bbuatCapOn = bbuatByKeyRole.get(`${key}::identity-cap-on`);
    if (bbuatCapOn && identityCapOn.status !== "verified") {
      identityCapOn = bbuatVerifiedRole(bbuatCapOn);
    }
    const bbuatSidecar = bbuatByKeyRole.get(`${key}::pdp-cap-off-sidecar`);
    if (bbuatSidecar && pdpCapOffSidecar.status !== "verified") {
      pdpCapOffSidecar = bbuatVerifiedRole(bbuatSidecar);
    }
    if (
      identityCapOn.exportSha256
      && identityCapOn.exportSha256 === pdpCapOffSidecar.exportSha256
    ) {
      throw new Error(
        `Cylinder identity ${key} has byte-identical evidence in both lanes; one image cannot satisfy cap-on and cap-off.`,
      );
    }

    const blockers = Array.from(new Set([
      ...identityCapOn.blockers.map((blocker) => `identity-cap-on:${blocker}`),
      ...pdpCapOffSidecar.blockers.map((blocker) => `pdp-cap-off-sidecar:${blocker}`),
    ]));
    return {
      canonicalIdentityKey: readiness.canonicalIdentityKey,
      websiteSku: readiness.websiteSku,
      graceSku: readiness.graceSku,
      status: identityCapOn.status === "verified" && pdpCapOffSidecar.status === "verified"
        ? "both-roles-verified"
        : "blocked",
      blockers,
      canonical: { ...readiness.canonical },
      references: {
        identityCapOn: identityCapOn as CylinderRoleAwareReadinessRow["references"]["identityCapOn"],
        pdpCapOffSidecar: pdpCapOffSidecar as CylinderRoleAwareReadinessRow["references"]["pdpCapOffSidecar"],
      },
      approvedEvidence,
    };
  }).sort((left, right) => (
    left.graceSku.localeCompare(right.graceSku)
    || left.websiteSku.localeCompare(right.websiteSku)
  ));

  for (const approvalKey of reviewedApprovals.keys()) {
    if (!consumedApprovals.has(approvalKey)) {
      throw new Error(
        `Reviewed role approval ${approvalKey} could not be bound to a verified immutable role.`,
      );
    }
  }

  const summary = {
    canonicalIdentityCount: rows.length,
    identityCapOnVerifiedCount: rows.filter((row) => row.references.identityCapOn.status === "verified").length,
    pdpCapOffSidecarVerifiedCount: rows.filter((row) => row.references.pdpCapOffSidecar.status === "verified").length,
    bothRolesVerifiedCount: rows.filter((row) => row.status === "both-roles-verified").length,
    blockedIdentityCount: rows.filter((row) => row.status === "blocked").length,
    standardSidecarCount: rows.filter((row) => (
      row.references.pdpCapOffSidecar.status === "verified"
      && row.references.pdpCapOffSidecar.topology === "fitment-attached-cap-right-sidecar"
    )).length,
    liveSiteExceptionCount: rows.filter((row) => (
      row.references.pdpCapOffSidecar.status === "verified"
      && row.references.pdpCapOffSidecar.topology === "assembled-live-site-exception"
    )).length,
    approvedEvidenceBlockedCount: rows.filter((row) => (
      row.status === "blocked"
      && (row.approvedEvidence.livePointer || row.approvedEvidence.recovery)
    )).length,
    missingApprovedEvidenceBlockedCount: rows.filter((row) => (
      row.status === "blocked"
      && !row.approvedEvidence.livePointer
      && !row.approvedEvidence.recovery
    )).length,
    externalWriteCount: 0 as const,
  };
  const provenance = {
    productionReadiness: {
      path: sources.productionReadiness.path,
      version: sources.productionReadiness.data.version,
      fileSha256: sources.productionReadiness.fileSha256,
    },
    identityCapOn: {
      auditPath: sources.identityCapOnAudit.path,
      auditVersion: sources.identityCapOnAudit.data.version,
      auditFileSha256: sources.identityCapOnAudit.fileSha256,
      currentAuditSeal: sources.identityCapOnAudit.data.manifestSha256 ?? null,
      executionPath: sources.identityCapOnExecution.path,
      executionVersion: sources.identityCapOnExecution.data.version,
      executionFileSha256: sources.identityCapOnExecution.fileSha256,
      executionSeal: sources.identityCapOnExecution.data.executionSha256,
      executionAuditSeal: sources.identityCapOnExecution.data.manifestSha256 ?? null,
    },
    pdpCapOffSidecar: {
      preflightPath: sources.pdpCapOffSidecarPreflight.path,
      preflightVersion: sources.pdpCapOffSidecarPreflight.data.version,
      preflightFileSha256: sources.pdpCapOffSidecarPreflight.fileSha256,
      currentAuditPreflightSeal: sources.pdpCapOffSidecarPreflight.data.preflightSha256 ?? null,
      executionPath: sources.pdpCapOffSidecarExecution.path,
      executionVersion: sources.pdpCapOffSidecarExecution.data.version,
      executionFileSha256: sources.pdpCapOffSidecarExecution.fileSha256,
      executionSeal: sources.pdpCapOffSidecarExecution.data.executionSha256,
      executionPreflightSeal: sources.pdpCapOffSidecarExecution.data.preflightSha256 ?? null,
      sourceManifestPath: sources.pdpCapOffSidecarManifest.path,
      sourceManifestVersion: sources.pdpCapOffSidecarManifest.data.version,
      sourceManifestSha256: sidecarSourceSha,
    },
    livePointerApproval: {
      path: sources.livePointerApproval.path,
      version: sources.livePointerApproval.data.version,
      fileSha256: sources.livePointerApproval.fileSha256,
      approvalSeal: sources.livePointerApproval.data.sha256 ?? null,
    },
    recoveryApproval: {
      path: sources.recoveryApproval.path,
      version: sources.recoveryApproval.data.version,
      fileSha256: sources.recoveryApproval.fileSha256,
    },
    ...(sources.bbuatStudioReferences ? {
      bbuatStudioReferences: {
        path: sources.bbuatStudioReferences.path,
        version: sources.bbuatStudioReferences.data.version,
        fileSha256: sources.bbuatStudioReferences.fileSha256,
        reviewedBy: sources.bbuatStudioReferences.data.reviewedBy,
        reviewedAt: sources.bbuatStudioReferences.data.reviewedAt,
      },
    } : {}),
    ...(sources.reviewedRoleApprovals ? {
      reviewedRoleApprovals: {
        path: sources.reviewedRoleApprovals.path,
        version: sources.reviewedRoleApprovals.data.version,
        fileSha256: sources.reviewedRoleApprovals.fileSha256,
      },
    } : {}),
  };
  const authorization = {
    exactEvidenceIdentityCount: summary.bothRolesVerifiedCount,
    generationScope: "controlled-studio-only" as const,
    generationStatus: "authorized-for-controlled-generation" as const,
    publishStatus: "not-publish-ready" as const,
    individualContentReviewStatus: "not-individually-content-approved" as const,
    requiredNextGate: "generated-output-qa-and-explicit-publish-approval" as const,
  };
  const unsigned = {
    version: BEST_BOTTLES_CYLINDER_ROLE_AWARE_READINESS_VERSION,
    generatedAt: input.generatedAt,
    provenance,
    authorization,
    summary,
    rows,
  };
  return {
    ...unsigned,
    sha256: sha256(stableJson(unsigned)),
  };
}
