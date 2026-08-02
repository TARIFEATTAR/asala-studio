#!/usr/bin/env tsx
import "dotenv/config";

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

import {
  buildCylinderCanonicalRosterAuthority,
  type CylinderCanonicalRosterAuthority,
  type CylinderRoleAwareReadinessArtifact,
  type CylinderRoleAwareReadinessRow,
  type CylinderReferenceRoleId,
} from "../../src/lib/bestBottlesCylinderRoleAuthority";
import { computeCanonicalGeometrySha256 } from "../../src/lib/bestBottlesCylinderDualRoleRunner";

export const REVIEWED_CYLINDER_ROLE_PROMOTION_VERSION =
  "best-bottles-reviewed-cylinder-role-promotion-v1" as const;

type ReviewedFinalStatus = "approved" | "reviewed" | string;
type ReviewedTopology =
  | "assembled-cap-on"
  | "fitment-attached-cap-right-sidecar"
  | "assembled-live-site-exception";
type ReviewedException = "live-site-vintage-bulb" | "live-site-genuine-two-piece" | null;

export interface ReviewedCylinderRoleCandidate {
  canonicalIdentityKey: string;
  websiteSku: string;
  graceSku: string;
  roleId: CylinderReferenceRoleId;
  source: {
    canonicalIdentityKey: string;
    roleId: CylinderReferenceRoleId;
    sha256: string;
  };
  output: {
    path: string;
    sha256: string;
    bytes: number;
    width: number;
    height: number;
    opaque: true;
    canonicalGeometrySha256: string;
  };
  review: {
    finalStatus: ReviewedFinalStatus;
    reviewerId: string;
    reviewedAt: string;
    canonicalIdentityKey: string;
    roleId: CylinderReferenceRoleId;
    sourceSha256: string;
    outputSha256: string;
    canonicalGeometrySha256: string;
    reviewedException: null | {
      status: "approved" | "reviewed";
      approvedException: Exclude<ReviewedException, null>;
      reviewerId: string;
      reviewedAt: string;
      sourceSha256: string;
      outputSha256: string;
      canonicalGeometrySha256: string;
    };
  };
  topology: ReviewedTopology;
  approvedException: ReviewedException;
}

export type ReviewedCylinderRoleRemoteObject =
  | { path: string; status: "absent" }
  | { path: string; status: "present"; sha256?: string; bytes?: number }
  | { path: string; status: "error"; error: string };

export interface ReviewedCylinderRolePromotionRow {
  canonicalIdentityKey: string;
  websiteSku: string;
  graceSku: string;
  roleId: CylinderReferenceRoleId;
  sourceSha256: string;
  outputSha256: string;
  canonicalGeometrySha256: string;
  localPath: string;
  bytes: number;
  width: number;
  height: number;
  opaque: true;
  topology: ReviewedTopology;
  approvedException: ReviewedException;
  review: ReviewedCylinderRoleCandidate["review"];
  storage: { bucket: string; path: string; publicUrl: string };
  remote:
    | { status: "absent" }
    | { status: "exact-match"; sha256: string; bytes: number }
    | { status: "byte-collision"; sha256: string | null; bytes: number | null }
    | { status: "read-error"; error: string };
  blockers: Array<"immutable-path-byte-collision" | "remote-object-read-error">;
  decision: "ready-to-upload" | "ready-to-reuse" | "blocked";
}

export interface ReviewedCylinderRolePromotionPlan {
  version: typeof REVIEWED_CYLINDER_ROLE_PROMOTION_VERSION;
  generatedAt: string;
  mode: "read-only";
  sourceRoleArtifactSha256: string;
  summary: {
    candidateCount: number;
    readyToUploadCount: number;
    readyToReuseCount: number;
    blockedCount: number;
    externalWriteCount: 0;
  };
  rows: ReviewedCylinderRolePromotionRow[];
  sourceRoleArtifact: CylinderRoleAwareReadinessArtifact;
  sha256: string;
}

export interface ReviewedCylinderRolePromotionAdapter {
  readLocalFile(path: string): Promise<Uint8Array>;
  inspectRemote(bucket: string, path: string): Promise<
    { status: "absent" } | { status: "present"; bytes: Uint8Array }
  >;
  uploadImmutable(
    bucket: string,
    path: string,
    bytes: Uint8Array,
    options: { contentType: "image/png"; upsert: false },
  ): Promise<void>;
}

export interface ReviewedCylinderRolePromotionExecution {
  version: "best-bottles-reviewed-cylinder-role-promotion-execution-v1";
  promotionPlanSha256: string;
  summary: { candidateCount: number; uploadedCount: number; reusedCount: number; verifiedCount: number; failedCount: 0 };
  rows: Array<{
    canonicalIdentityKey: string;
    roleId: CylinderReferenceRoleId;
    storagePath: string;
    publicUrl: string;
    outputSha256: string;
    disposition: "uploaded" | "reused";
  }>;
  roleAwareArtifact: CylinderRoleAwareReadinessArtifact;
  sha256: string;
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

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function assertSha256(value: unknown, label: string): asserts value is string {
  if (!/^[a-f0-9]{64}$/i.test(String(value ?? ""))) throw new Error(`${label} must be a SHA-256 hash.`);
}

function exactIdentityKey(websiteSku: string, graceSku: string): string {
  const normalize = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return `${normalize(websiteSku)}|${normalize(graceSku)}`;
}

function storagePath(candidate: ReviewedCylinderRoleCandidate): string {
  const roleRoot = candidate.roleId === "identity-cap-on"
    ? "best-bottles/production-references/cylinder/v1"
    : "best-bottles/production-references/cylinder/sidecar-v2";
  return [
    roleRoot,
    candidate.output.sha256.slice(0, 2).toLowerCase(),
    `${candidate.canonicalIdentityKey.replace("|", "__")}__${candidate.output.sha256.toLowerCase()}.png`,
  ].join("/");
}

function validatePromotionSourceArtifact(
  artifact: CylinderRoleAwareReadinessArtifact,
  canonicalRoster: CylinderCanonicalRosterAuthority,
): Map<string, CylinderRoleAwareReadinessRow> {
  if (artifact.version !== "best-bottles-cylinder-role-aware-readiness-v2") {
    throw new Error("Reviewed promotion requires the sealed Cylinder role-aware readiness v2 artifact.");
  }
  if (
    artifact.provenance?.productionReadiness?.fileSha256 !== canonicalRoster.sourceFileSha256
    || canonicalRoster.version !== "best-bottles-cylinder-canonical-roster-v1"
  ) throw new Error("Reviewed promotion source does not match the independently verified canonical roster.");
  const { sha256: artifactSeal, ...unsigned } = artifact;
  assertSha256(artifactSeal, "Source role artifact seal");
  if (sha256(stableJson(unsigned)) !== artifactSeal.toLowerCase()) {
    throw new Error("Reviewed promotion source role artifact seal mismatch.");
  }
  if (artifact.summary.externalWriteCount !== 0 || artifact.authorization.publishStatus !== "not-publish-ready") {
    throw new Error("Reviewed promotion source artifact has an invalid authorization state.");
  }
  const index = new Map<string, CylinderRoleAwareReadinessRow>();
  for (const row of artifact.rows) {
    const key = exactIdentityKey(row.websiteSku, row.graceSku);
    const canonicalKey = exactIdentityKey(row.canonical.websiteSku, row.canonical.graceSku);
    if (key !== row.canonicalIdentityKey || canonicalKey !== key || !canonicalRoster.identities.has(key)) {
      throw new Error(`Reviewed promotion source identity ${row.canonicalIdentityKey} is invalid.`);
    }
    if (index.has(key)) throw new Error(`Duplicate reviewed promotion source identity ${key}.`);
    if (
      row.references.identityCapOn.roleId !== "identity-cap-on"
      || row.references.pdpCapOffSidecar.roleId !== "pdp-cap-off-sidecar"
    ) throw new Error(`Reviewed promotion source ${key} has crossed role IDs.`);
    computeCanonicalGeometrySha256(row.canonical);
    index.set(key, row);
  }
  if (index.size !== canonicalRoster.identities.size) {
    throw new Error("Reviewed promotion source is incomplete against the canonical roster.");
  }
  const isReady = (reference: CylinderRoleAwareReadinessRow["references"]["identityCapOn"]) => (
    reference.remoteStatus === "verified"
    && reference.productionStatus === "generation-authorized"
    && reference.blockers.length === 0
  );
  const bothReady = artifact.rows.filter((row) => isReady(row.references.identityCapOn) && isReady(row.references.pdpCapOffSidecar));
  const blocked = artifact.rows.filter((row) => !bothReady.includes(row));
  const derived = {
    canonicalIdentityCount: artifact.rows.length,
    identityCapOnVerifiedCount: artifact.rows.filter((row) => isReady(row.references.identityCapOn)).length,
    pdpCapOffSidecarVerifiedCount: artifact.rows.filter((row) => isReady(row.references.pdpCapOffSidecar)).length,
    bothRolesVerifiedCount: bothReady.length,
    blockedIdentityCount: blocked.length,
    standardSidecarCount: artifact.rows.filter((row) => isReady(row.references.pdpCapOffSidecar) && row.references.pdpCapOffSidecar.topology === "fitment-attached-cap-right-sidecar").length,
    liveSiteExceptionCount: artifact.rows.filter((row) => isReady(row.references.pdpCapOffSidecar) && row.references.pdpCapOffSidecar.topology === "assembled-live-site-exception").length,
    approvedEvidenceBlockedCount: blocked.filter((row) => row.approvedEvidence.livePointer || row.approvedEvidence.recovery).length,
    missingApprovedEvidenceBlockedCount: blocked.filter((row) => !row.approvedEvidence.livePointer && !row.approvedEvidence.recovery).length,
    externalWriteCount: 0,
  };
  for (const [field, value] of Object.entries(derived)) {
    if (artifact.summary[field] !== value) {
      throw new Error(`Reviewed promotion source summary ${field} does not match derived value ${value}.`);
    }
  }
  return index;
}

function assertCandidate(
  candidate: ReviewedCylinderRoleCandidate,
  sourceRow: CylinderRoleAwareReadinessRow,
): void {
  const key = exactIdentityKey(candidate.websiteSku, candidate.graceSku);
  if (key !== candidate.canonicalIdentityKey || key !== sourceRow.canonicalIdentityKey) {
    throw new Error(`Reviewed role candidate ${candidate.canonicalIdentityKey} does not match exact product identity.`);
  }
  if (
    candidate.source.canonicalIdentityKey !== key
    || candidate.review.canonicalIdentityKey !== key
  ) {
    throw new Error(`Reviewed role candidate ${key} identity lineage disagrees.`);
  }
  if (
    candidate.source.roleId !== candidate.roleId
    || candidate.review.roleId !== candidate.roleId
  ) {
    throw new Error(`Reviewed role candidate ${key} role lineage disagrees with ${candidate.roleId}.`);
  }
  for (const [value, label] of [
    [candidate.source.sha256, "source SHA"],
    [candidate.output.sha256, "output SHA"],
    [candidate.output.canonicalGeometrySha256, "output canonical geometry SHA"],
    [candidate.review.sourceSha256, "review source SHA"],
    [candidate.review.outputSha256, "review output SHA"],
    [candidate.review.canonicalGeometrySha256, "review canonical geometry SHA"],
  ] as const) assertSha256(value, `${key} ${label}`);
  if (!/^(?:approved|reviewed)$/i.test(candidate.review.finalStatus.trim())) {
    throw new Error(`${key} promotion requires a final approved or reviewed state.`);
  }
  if (!candidate.review.reviewerId.trim() || Number.isNaN(Date.parse(candidate.review.reviewedAt))) {
    throw new Error(`${key} final review is missing its reviewer or timestamp.`);
  }
  const canonicalGeometrySha256 = computeCanonicalGeometrySha256(sourceRow.canonical);
  const selectedRole = candidate.roleId === "identity-cap-on"
    ? sourceRow.references.identityCapOn
    : sourceRow.references.pdpCapOffSidecar;
  assertSha256(selectedRole.exportSha256, `${key} sealed selected source role hash`);
  if (candidate.source.sha256.toLowerCase() !== selectedRole.exportSha256.toLowerCase()) {
    throw new Error(`${key} source SHA does not match the sealed selected source role hash.`);
  }
  if (
    candidate.output.canonicalGeometrySha256.toLowerCase() !== canonicalGeometrySha256
    || candidate.review.canonicalGeometrySha256.toLowerCase() !== canonicalGeometrySha256
  ) {
    throw new Error(`${key} reviewed canonical geometry hash disagrees with sealed canonical geometry.`);
  }
  if (
    candidate.review.sourceSha256.toLowerCase() !== candidate.source.sha256.toLowerCase()
    || candidate.review.outputSha256.toLowerCase() !== candidate.output.sha256.toLowerCase()
  ) {
    throw new Error(`${key} final review does not bind the exact source and output hashes.`);
  }
  const exception = candidate.review.reviewedException;
  if (exception) {
    if (!/^(?:approved|reviewed)$/i.test(exception.status)) {
      throw new Error(`${key} reviewed exception is not approved.`);
    }
    if (!exception.reviewerId.trim() || Number.isNaN(Date.parse(exception.reviewedAt))) {
      throw new Error(`${key} reviewed exception is missing its reviewer or timestamp.`);
    }
    if (
      exception.sourceSha256.toLowerCase() !== candidate.source.sha256.toLowerCase()
      || exception.outputSha256.toLowerCase() !== candidate.output.sha256.toLowerCase()
      || exception.canonicalGeometrySha256.toLowerCase() !== canonicalGeometrySha256
    ) {
      throw new Error(`${key} reviewed exception does not bind the exact final state.`);
    }
  }
  if (
    candidate.output.bytes <= 0
    || candidate.output.width !== 2080
    || candidate.output.height !== 2288
    || candidate.output.opaque !== true
  ) throw new Error(`${key} reviewed output must be an opaque 2080x2288 PNG.`);
  if (candidate.roleId === "identity-cap-on") {
    if (candidate.topology !== "assembled-cap-on" || candidate.approvedException !== null) {
      throw new Error(`${key} identity-cap-on candidate has invalid topology.`);
    }
  } else if (candidate.topology === "fitment-attached-cap-right-sidecar") {
    if (candidate.approvedException !== null) throw new Error(`${key} sidecar candidate has an invalid exception.`);
  } else if (
    candidate.topology !== "assembled-live-site-exception"
    || !["live-site-vintage-bulb", "live-site-genuine-two-piece"].includes(candidate.approvedException ?? "")
  ) {
    throw new Error(`${key} sidecar candidate has invalid topology.`);
  }
  if (candidate.topology === "assembled-live-site-exception") {
    if (!exception) {
      throw new Error(`${key} nonstandard topology requires a separately final-reviewed exception.`);
    }
    if (exception.approvedException !== candidate.approvedException) {
      throw new Error(`${key} reviewed topology exception enum does not match the approved exception.`);
    }
  }
}

async function assertExactOpaquePng(
  bytes: Uint8Array,
  label: string,
): Promise<void> {
  let metadata: sharp.Metadata;
  let opaque: boolean;
  try {
    const image = sharp(bytes, { failOn: "error" });
    [metadata, opaque] = await Promise.all([
      image.metadata(),
      image.clone().stats().then((stats) => stats.isOpaque),
    ]);
  } catch (error) {
    throw new Error(`${label} must be a decodable PNG: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (metadata.format !== "png") throw new Error(`${label} must be PNG bytes.`);
  if (metadata.width !== 2080 || metadata.height !== 2288) {
    throw new Error(`${label} must be exactly 2080x2288 from decoded bytes.`);
  }
  if (!opaque) throw new Error(`${label} must be fully opaque from decoded bytes.`);
}

export async function buildReviewedCylinderRolePromotionPlan(input: {
  roleAwareArtifact: CylinderRoleAwareReadinessArtifact;
  canonicalRoster: CylinderCanonicalRosterAuthority;
  candidates: ReviewedCylinderRoleCandidate[];
  remoteObjects: ReviewedCylinderRoleRemoteObject[];
  bucket: string;
  supabaseUrl: string;
  generatedAt: string;
  readLocalFile(path: string): Promise<Uint8Array>;
}): Promise<ReviewedCylinderRolePromotionPlan> {
  // This validator deliberately permits the known raw-live-PDP rows only as
  // inert source records. It never marks them usable; a row becomes usable
  // solely through an independently bound final review candidate below.
  const index = validatePromotionSourceArtifact(input.roleAwareArtifact, input.canonicalRoster);
  const bucket = input.bucket.trim();
  const baseUrl = input.supabaseUrl.trim().replace(/\/+$/, "");
  if (!bucket || !/^https:\/\//i.test(baseUrl)) throw new Error("Promotion requires an HTTPS Supabase URL and storage bucket.");
  if (!input.candidates.length) throw new Error("Promotion requires at least one explicitly reviewed role candidate.");
  const remoteByPath = new Map(input.remoteObjects.map((item) => [item.path, item]));
  if (remoteByPath.size !== input.remoteObjects.length) throw new Error("Duplicate remote object observation.");
  const candidateKeys = new Set<string>();
  const rows: ReviewedCylinderRolePromotionRow[] = [];
  for (const candidate of input.candidates) {
    const exactRow = index.get(candidate.canonicalIdentityKey);
    if (!exactRow) throw new Error(`Reviewed candidate ${candidate.canonicalIdentityKey} is absent from the sealed role artifact.`);
    assertCandidate(candidate, exactRow);
    const localBytes = await input.readLocalFile(candidate.output.path);
    if (localBytes.length !== candidate.output.bytes || sha256(localBytes) !== candidate.output.sha256.toLowerCase()) {
      throw new Error(`${candidate.canonicalIdentityKey} local candidate bytes disagree with reviewed output SHA/length.`);
    }
    await assertExactOpaquePng(localBytes, `${candidate.canonicalIdentityKey} reviewed output`);
    const candidateKey = `${candidate.canonicalIdentityKey}|${candidate.roleId}`;
    if (candidateKeys.has(candidateKey)) throw new Error(`Duplicate reviewed role candidate ${candidateKey}.`);
    candidateKeys.add(candidateKey);
    const path = storagePath(candidate);
    const observed = remoteByPath.get(path) ?? { path, status: "absent" as const };
    const blockers: ReviewedCylinderRolePromotionRow["blockers"] = [];
    let remote: ReviewedCylinderRolePromotionRow["remote"];
    if (observed.status === "absent") remote = { status: "absent" };
    else if (observed.status === "error") {
      remote = { status: "read-error", error: observed.error };
      blockers.push("remote-object-read-error");
    } else if (
      observed.sha256?.toLowerCase() === candidate.output.sha256.toLowerCase()
      && observed.bytes === candidate.output.bytes
    ) remote = { status: "exact-match", sha256: observed.sha256, bytes: observed.bytes };
    else {
      remote = { status: "byte-collision", sha256: observed.sha256 ?? null, bytes: observed.bytes ?? null };
      blockers.push("immutable-path-byte-collision");
    }
    rows.push({
      canonicalIdentityKey: candidate.canonicalIdentityKey,
      websiteSku: candidate.websiteSku,
      graceSku: candidate.graceSku,
      roleId: candidate.roleId,
      sourceSha256: candidate.source.sha256.toLowerCase(),
      outputSha256: candidate.output.sha256.toLowerCase(),
      canonicalGeometrySha256: candidate.output.canonicalGeometrySha256.toLowerCase(),
      localPath: candidate.output.path,
      bytes: candidate.output.bytes,
      width: candidate.output.width,
      height: candidate.output.height,
      opaque: true,
      topology: candidate.topology,
      approvedException: candidate.approvedException,
      review: candidate.review,
      storage: { bucket, path, publicUrl: `${baseUrl}/storage/v1/object/public/${bucket}/${path}` },
      remote,
      blockers,
      decision: blockers.length ? "blocked" : remote.status === "exact-match" ? "ready-to-reuse" : "ready-to-upload",
    });
  }
  rows.sort((left, right) => (
    left.canonicalIdentityKey.localeCompare(right.canonicalIdentityKey) || left.roleId.localeCompare(right.roleId)
  ));
  const unsigned = {
    version: REVIEWED_CYLINDER_ROLE_PROMOTION_VERSION,
    generatedAt: input.generatedAt,
    mode: "read-only" as const,
    sourceRoleArtifactSha256: input.roleAwareArtifact.sha256.toLowerCase(),
    summary: {
      candidateCount: rows.length,
      readyToUploadCount: rows.filter((row) => row.decision === "ready-to-upload").length,
      readyToReuseCount: rows.filter((row) => row.decision === "ready-to-reuse").length,
      blockedCount: rows.filter((row) => row.decision === "blocked").length,
      externalWriteCount: 0 as const,
    },
    rows,
    sourceRoleArtifact: input.roleAwareArtifact,
  };
  return { ...unsigned, sha256: sha256(stableJson(unsigned)) };
}

function rebuildRoleAwareArtifact(
  plan: ReviewedCylinderRolePromotionPlan,
): CylinderRoleAwareReadinessArtifact {
  const promotedByKey = new Map(plan.rows.map((row) => [`${row.canonicalIdentityKey}|${row.roleId}`, row]));
  const rows = plan.sourceRoleArtifact.rows.map((sourceRow) => {
    const row = structuredClone(sourceRow);
    if (
      row.references.pdpCapOffSidecar.sourceRoute === "exact-live-pdp-sidecar"
      && !promotedByKey.has(`${row.canonicalIdentityKey}|pdp-cap-off-sidecar`)
    ) {
      row.references.pdpCapOffSidecar = {
        ...row.references.pdpCapOffSidecar,
        status: "blocked",
        remoteStatus: "blocked",
        productionStatus: "blocked",
        sourceReviewStatus: "pending",
        sourceRoute: null,
        publicUrl: null,
        storagePath: null,
        exportSha256: null,
        reviewedOutputSha256: null,
        blockers: ["raw live-PDP sidecar requires reviewed immutable remediation"],
        width: null,
        height: null,
        opaque: null,
      };
    }
    for (const roleId of ["identity-cap-on", "pdp-cap-off-sidecar"] as const) {
      const promoted = promotedByKey.get(`${row.canonicalIdentityKey}|${roleId}`);
      if (!promoted) continue;
      const key = roleId === "identity-cap-on" ? "identityCapOn" : "pdpCapOffSidecar";
      row.references[key] = {
        ...row.references[key],
        roleId,
        status: "verified",
        remoteStatus: "verified",
        productionStatus: "generation-authorized",
        sourceReviewStatus: promoted.review.finalStatus.toLowerCase(),
        sourceRoute: roleId === "pdp-cap-off-sidecar"
          ? "reviewed-immutable-sidecar-remediation"
          : "reviewed-immutable-cap-on-remediation",
        publicUrl: promoted.storage.publicUrl,
        storagePath: promoted.storage.path,
        exportSha256: promoted.outputSha256,
        reviewedOutputSha256: promoted.outputSha256,
        topology: promoted.topology,
        approvedException: promoted.approvedException,
        blockers: [],
        width: promoted.width,
        height: promoted.height,
        opaque: true,
      };
    }
    const capReady = row.references.identityCapOn.remoteStatus === "verified"
      && row.references.identityCapOn.productionStatus === "generation-authorized"
      && row.references.identityCapOn.blockers.length === 0;
    const sidecarReady = row.references.pdpCapOffSidecar.remoteStatus === "verified"
      && row.references.pdpCapOffSidecar.productionStatus === "generation-authorized"
      && row.references.pdpCapOffSidecar.blockers.length === 0;
    row.status = capReady && sidecarReady ? "both-roles-verified" : "blocked";
    row.blockers = capReady && sidecarReady
      ? []
      : [...row.references.identityCapOn.blockers, ...row.references.pdpCapOffSidecar.blockers];
    return row;
  });
  const isReady = (reference: CylinderRoleAwareReadinessRow["references"]["identityCapOn"]) => (
    reference.remoteStatus === "verified"
    && reference.productionStatus === "generation-authorized"
    && reference.blockers.length === 0
  );
  const bothReady = rows.filter((row) => isReady(row.references.identityCapOn) && isReady(row.references.pdpCapOffSidecar));
  const blocked = rows.filter((row) => !bothReady.includes(row));
  const summary = {
    canonicalIdentityCount: rows.length,
    identityCapOnVerifiedCount: rows.filter((row) => isReady(row.references.identityCapOn)).length,
    pdpCapOffSidecarVerifiedCount: rows.filter((row) => isReady(row.references.pdpCapOffSidecar)).length,
    bothRolesVerifiedCount: bothReady.length,
    blockedIdentityCount: blocked.length,
    standardSidecarCount: rows.filter((row) => (
      isReady(row.references.pdpCapOffSidecar)
      && row.references.pdpCapOffSidecar.topology === "fitment-attached-cap-right-sidecar"
    )).length,
    liveSiteExceptionCount: rows.filter((row) => (
      isReady(row.references.pdpCapOffSidecar)
      && row.references.pdpCapOffSidecar.topology === "assembled-live-site-exception"
    )).length,
    approvedEvidenceBlockedCount: blocked.filter((row) => row.approvedEvidence.livePointer || row.approvedEvidence.recovery).length,
    missingApprovedEvidenceBlockedCount: blocked.filter((row) => !row.approvedEvidence.livePointer && !row.approvedEvidence.recovery).length,
    externalWriteCount: 0,
  };
  const unsigned = {
    ...plan.sourceRoleArtifact,
    generatedAt: plan.generatedAt,
    provenance: {
      ...plan.sourceRoleArtifact.provenance,
      reviewedRolePromotion: {
        version: plan.version,
        planSha256: plan.sha256,
        sourceRoleArtifactSha256: plan.sourceRoleArtifactSha256,
      },
    },
    authorization: {
      ...plan.sourceRoleArtifact.authorization,
      exactEvidenceIdentityCount: summary.bothRolesVerifiedCount,
    },
    summary,
    rows,
  };
  delete (unsigned as Partial<CylinderRoleAwareReadinessArtifact>).sha256;
  return { ...unsigned, sha256: sha256(stableJson(unsigned)) } as CylinderRoleAwareReadinessArtifact;
}

export async function executeReviewedCylinderRolePromotion(
  plan: ReviewedCylinderRolePromotionPlan,
  adapter: ReviewedCylinderRolePromotionAdapter,
): Promise<ReviewedCylinderRolePromotionExecution> {
  const { sha256: planSeal, ...unsignedPlan } = plan;
  if (sha256(stableJson(unsignedPlan)) !== planSeal) throw new Error("Reviewed role promotion plan seal mismatch.");
  if (plan.mode !== "read-only" || plan.summary.externalWriteCount !== 0 || plan.summary.blockedCount !== 0) {
    throw new Error("Reviewed role promotion execution requires a zero-blocker read-only preflight.");
  }
  const rows = [] as ReviewedCylinderRolePromotionExecution["rows"];
  for (const row of plan.rows) {
    const localBytes = await adapter.readLocalFile(row.localPath);
    if (localBytes.length !== row.bytes || sha256(localBytes) !== row.outputSha256) {
      throw new Error(`Reviewed output bytes failed verification for ${row.canonicalIdentityKey} ${row.roleId}.`);
    }
    await assertExactOpaquePng(localBytes, `${row.canonicalIdentityKey} ${row.roleId} execution input`);
    const before = await adapter.inspectRemote(row.storage.bucket, row.storage.path);
    let disposition: "uploaded" | "reused";
    if (before.status === "present") {
      if (before.bytes.length !== row.bytes || sha256(before.bytes) !== row.outputSha256) {
        throw new Error(`Immutable remote collision for ${row.canonicalIdentityKey} ${row.roleId}.`);
      }
      await assertExactOpaquePng(before.bytes, `${row.canonicalIdentityKey} ${row.roleId} remote object`);
      disposition = "reused";
    } else {
      await adapter.uploadImmutable(row.storage.bucket, row.storage.path, localBytes, {
        contentType: "image/png",
        upsert: false,
      });
      const after = await adapter.inspectRemote(row.storage.bucket, row.storage.path);
      if (after.status !== "present" || after.bytes.length !== row.bytes || sha256(after.bytes) !== row.outputSha256) {
        throw new Error(`Immutable upload readback failed for ${row.canonicalIdentityKey} ${row.roleId}.`);
      }
      await assertExactOpaquePng(after.bytes, `${row.canonicalIdentityKey} ${row.roleId} upload readback`);
      disposition = "uploaded";
    }
    rows.push({
      canonicalIdentityKey: row.canonicalIdentityKey,
      roleId: row.roleId,
      storagePath: row.storage.path,
      publicUrl: row.storage.publicUrl,
      outputSha256: row.outputSha256,
      disposition,
    });
  }
  const roleAwareArtifact = rebuildRoleAwareArtifact(plan);
  const unsigned = {
    version: "best-bottles-reviewed-cylinder-role-promotion-execution-v1" as const,
    promotionPlanSha256: plan.sha256,
    summary: {
      candidateCount: rows.length,
      uploadedCount: rows.filter((row) => row.disposition === "uploaded").length,
      reusedCount: rows.filter((row) => row.disposition === "reused").length,
      verifiedCount: rows.length,
      failedCount: 0 as const,
    },
    rows,
    roleAwareArtifact,
  };
  return { ...unsigned, sha256: sha256(stableJson(unsigned)) };
}

export interface ReviewedCylinderRolePromotionArgs {
  mode: "dry-run" | "execute";
  candidatesPath: string | null;
  roleArtifactPath: string | null;
  canonicalRosterPath: string | null;
  outputDirectory: string;
  supabaseUrl: string | null;
}

export function parseReviewedCylinderRolePromotionArgs(argv: string[]): ReviewedCylinderRolePromotionArgs {
  const values = new Set(["--candidates", "--role-artifact", "--canonical-roster", "--output-dir", "--supabase-url"]);
  const allowed = new Set([...values, "--execute"]);
  const parsed = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!allowed.has(token)) throw new Error(`Unknown argument ${token}.`);
    if (values.has(token)) {
      const value = argv[++index];
      if (!value || value.startsWith("--")) throw new Error(`${token} requires a value.`);
      parsed.set(token, value);
    }
  }
  return {
    mode: argv.includes("--execute") ? "execute" : "dry-run",
    candidatesPath: parsed.get("--candidates") ?? null,
    roleArtifactPath: parsed.get("--role-artifact") ?? null,
    canonicalRosterPath: parsed.get("--canonical-roster") ?? null,
    outputDirectory: resolve(parsed.get("--output-dir") ?? "tmp/best-bottles-reference-production/cylinder-reviewed-role-promotion-v1"),
    supabaseUrl: parsed.get("--supabase-url") ?? null,
  };
}

async function main(): Promise<void> {
  const args = parseReviewedCylinderRolePromotionArgs(process.argv.slice(2));
  if (!args.candidatesPath || !args.roleArtifactPath || !args.canonicalRosterPath) {
    throw new Error("--candidates, --role-artifact, and --canonical-roster are required.");
  }
  const [candidatesBytes, roleBytes, rosterBytes] = await Promise.all([
    readFile(args.candidatesPath), readFile(args.roleArtifactPath), readFile(args.canonicalRosterPath),
  ]);
  const candidates = JSON.parse(candidatesBytes.toString("utf8")) as ReviewedCylinderRoleCandidate[];
  const roleArtifact = JSON.parse(roleBytes.toString("utf8")) as CylinderRoleAwareReadinessArtifact;
  const canonicalRoster = buildCylinderCanonicalRosterAuthority(roleArtifact, rosterBytes);
  const supabaseUrl = args.supabaseUrl ?? String(process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "").trim();
  if (!supabaseUrl) throw new Error("A Supabase URL is required to build immutable role URLs.");

  let adapter: ReviewedCylinderRolePromotionAdapter | null = null;
  let remoteObjects: ReviewedCylinderRoleRemoteObject[] = [];
  if (args.mode === "execute") {
    const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
    if (!serviceRoleKey) throw new Error("--execute requires SUPABASE_SERVICE_ROLE_KEY.");
    const { createClient } = await import("@supabase/supabase-js");
    const client = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
    adapter = {
      readLocalFile: async (path) => readFile(path),
      inspectRemote: async (bucket, path) => {
        const split = path.lastIndexOf("/");
        const listed = await client.storage.from(bucket).list(path.slice(0, split), { search: path.slice(split + 1), limit: 2 });
        if (listed.error) throw new Error(listed.error.message);
        if (!(listed.data ?? []).some((item) => item.name === path.slice(split + 1))) return { status: "absent" };
        const downloaded = await client.storage.from(bucket).download(path);
        if (downloaded.error) throw new Error(downloaded.error.message);
        return { status: "present", bytes: new Uint8Array(await downloaded.data.arrayBuffer()) };
      },
      uploadImmutable: async (bucket, path, bytes, options) => {
        const uploaded = await client.storage.from(bucket).upload(path, bytes, options);
        if (uploaded.error) throw new Error(uploaded.error.message);
      },
    };
    remoteObjects = await Promise.all(candidates.map(async (candidate) => {
      const path = storagePath(candidate);
      try {
        const observed = await adapter!.inspectRemote("reference-images", path);
        return observed.status === "absent"
          ? { path, status: "absent" as const }
          : { path, status: "present" as const, sha256: sha256(observed.bytes), bytes: observed.bytes.length };
      } catch (error) {
        return { path, status: "error" as const, error: error instanceof Error ? error.message : String(error) };
      }
    }));
  }
  const plan = await buildReviewedCylinderRolePromotionPlan({
    roleAwareArtifact: roleArtifact,
    canonicalRoster,
    candidates,
    remoteObjects,
    bucket: "reference-images",
    supabaseUrl,
    generatedAt: new Date().toISOString(),
    readLocalFile: async (path) => readFile(path),
  });
  const planPath = resolve(args.outputDirectory, "reviewed-cylinder-role-promotion-plan.json");
  await mkdir(dirname(planPath), { recursive: true });
  await writeFile(planPath, `${JSON.stringify(plan, null, 2)}\n`);
  if (args.mode === "dry-run") {
    process.stdout.write(`${JSON.stringify({ mode: "dry-run", planPath, summary: plan.summary }, null, 2)}\n`);
    return;
  }
  const result = await executeReviewedCylinderRolePromotion(plan, adapter!);
  const executionPath = resolve(args.outputDirectory, "reviewed-cylinder-role-promotion-execution.json");
  const artifactPath = resolve(args.outputDirectory, "best-bottles-cylinder-sidecar-promotion.json");
  await Promise.all([
    writeFile(executionPath, `${JSON.stringify(result, null, 2)}\n`),
    writeFile(artifactPath, `${JSON.stringify(result.roleAwareArtifact, null, 2)}\n`),
  ]);
  process.stdout.write(`${JSON.stringify({ mode: "execute", executionPath, artifactPath, summary: result.summary }, null, 2)}\n`);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === resolve(fileURLToPath(import.meta.url))) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
  });
}
