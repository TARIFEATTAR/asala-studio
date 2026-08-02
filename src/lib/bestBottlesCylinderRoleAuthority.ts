import type { CylinderProductionReadinessRow } from "./bestBottlesCylinderProductionCutover";
import { cylinderProductionIdentityKey } from "./bestBottlesCylinderProductionCutover";
export { cylinderProductionIdentityKey } from "./bestBottlesCylinderProductionCutover";

export const BEST_BOTTLES_CYLINDER_ROLE_AWARE_READINESS_VERSION =
  "best-bottles-cylinder-role-aware-readiness-v2" as const;
export const BEST_BOTTLES_CYLINDER_ROLE_AWARE_READINESS_PATH =
  "/data/best-bottles-cylinder-sidecar-promotion.json" as const;

export type CylinderReferenceRoleId = "identity-cap-on" | "pdp-cap-off-sidecar";
export type CylinderReferenceTopology =
  | "assembled-cap-on"
  | "fitment-attached-cap-right-sidecar"
  | "assembled-live-site-exception";
export type CylinderReferenceApprovedException =
  | "live-site-vintage-bulb"
  | "live-site-genuine-two-piece"
  | null;

export interface CylinderRoleAwareReference {
  roleId: CylinderReferenceRoleId;
  status?: "verified" | "blocked";
  remoteStatus: "verified" | "unverified" | "blocked";
  sourceReviewStatus: string;
  sourceRoute?: string | null;
  productionStatus: "generation-authorized" | "blocked";
  publicUrl: string | null;
  storagePath: string | null;
  exportSha256: string | null;
  reviewedOutputSha256?: string | null;
  topology: CylinderReferenceTopology | null;
  approvedException: CylinderReferenceApprovedException;
  blockers: string[];
  width?: number | null;
  height?: number | null;
  opaque?: true | null;
}

export interface CylinderRoleAwareReadinessRow {
  canonicalIdentityKey: string;
  websiteSku: string;
  graceSku: string;
  status: string;
  blockers: string[];
  canonical: CylinderProductionReadinessRow["canonical"];
  references: {
    identityCapOn: CylinderRoleAwareReference;
    pdpCapOffSidecar: CylinderRoleAwareReference;
  };
  approvedEvidence: {
    livePointer: Record<string, unknown> | null;
    recovery: Record<string, unknown> | null;
  };
}

export interface CylinderRoleAwareReadinessArtifact {
  version: typeof BEST_BOTTLES_CYLINDER_ROLE_AWARE_READINESS_VERSION;
  generatedAt: string;
  provenance: {
    productionReadiness: Record<string, unknown>;
    identityCapOn: Record<string, unknown>;
    pdpCapOffSidecar: Record<string, unknown>;
    livePointerApproval: Record<string, unknown>;
    recoveryApproval: Record<string, unknown>;
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
    externalWriteCount: number;
  };
  authorization: {
    exactEvidenceIdentityCount: number;
    generationScope: "controlled-studio-only";
    generationStatus: "authorized-for-controlled-generation";
    publishStatus: "not-publish-ready";
    individualContentReviewStatus: "not-individually-content-approved";
    requiredNextGate: "generated-output-qa-and-explicit-publish-approval";
  };
  rows: CylinderRoleAwareReadinessRow[];
  sha256: string;
}

export type CylinderRoleAwareReadinessIndex = Map<string, CylinderRoleAwareReadinessRow>;

export interface CylinderCanonicalRosterAuthority {
  readonly version: "best-bottles-cylinder-canonical-roster-v1";
  readonly sourceFileSha256: string;
  readonly identities: ReadonlySet<string>;
}

export interface CylinderCanonicalProductLike {
  websiteSku: string | null | undefined;
  graceSku: string | null | undefined;
  family: string | null | undefined;
  capacityMl: number | null | undefined;
  heightWithoutCap: string | null | undefined;
  heightWithCap: string | null | undefined;
  diameter: string | null | undefined;
}

export interface CylinderCanonicalGeometryContract {
  version: "best-bottles-canonical-geometry-v1";
  websiteSku: string;
  graceSku: string;
  canon_bodyHeightMm: string;
  canon_heightWithCapMm: string;
  canon_widthAxisMm: string;
  canon_secondAxisMm: string;
  sha256: string;
}

const CYLINDER_PDP_SIDECAR_PRESET_ID = "grid-card-exploded-2000x2200";
const SHA_256 = /^[a-f0-9]{64}$/;

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

// Browser-safe synchronous SHA-256. Artifact validation is deliberately
// synchronous so no consumer can accidentally build an index before checking
// the producer seal.
function sha256Hex(value: string | Uint8Array): string {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLength);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  const bitLength = bytes.length * 8;
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000));
  view.setUint32(paddedLength - 4, bitLength >>> 0);
  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  const h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const w = new Uint32Array(64);
  const rotr = (word: number, bits: number) => (word >>> bits) | (word << (32 - bits));
  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let i = 0; i < 16; i += 1) w[i] = view.getUint32(offset + i * 4);
    for (let i = 16; i < 64; i += 1) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i += 1) {
      const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + s1 + ch + k[i] + w[i]) >>> 0;
      const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (s0 + maj) >>> 0;
      hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    h[0] = (h[0] + a) >>> 0; h[1] = (h[1] + b) >>> 0;
    h[2] = (h[2] + c) >>> 0; h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0; h[5] = (h[5] + f) >>> 0;
    h[6] = (h[6] + g) >>> 0; h[7] = (h[7] + hh) >>> 0;
  }
  return h.map((word) => word.toString(16).padStart(8, "0")).join("");
}

function normalizedIdentity(value: string | null | undefined): string {
  return String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function canonicalDimension(value: string, label: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Canonical Cylinder ${label} is missing or invalid.`);
  }
  return parsed;
}

export function applyRoleAwareCanonicalCylinderGeometry<T extends CylinderCanonicalProductLike>(
  product: T,
  readiness: CylinderRoleAwareReadinessRow | null | undefined,
): T & {
  canonicalBodyHeightMm: number;
  canonicalAssembledHeightMm: number;
  canonicalWidthAxisMm: number;
  canonicalSecondAxisMm: number;
  measurementSource: "best-bottles-canonical-truth-2026-07-12";
} {
  if (
    !readiness
    || normalizedIdentity(product.websiteSku) !== normalizedIdentity(readiness.websiteSku)
    || normalizedIdentity(product.graceSku) !== normalizedIdentity(readiness.graceSku)
    || normalizedIdentity(readiness.canonical.websiteSku) !== normalizedIdentity(readiness.websiteSku)
    || normalizedIdentity(readiness.canonical.graceSku) !== normalizedIdentity(readiness.graceSku)
  ) {
    throw new Error(`Canonical Cylinder generation requires exact dual identity ${readiness?.canonicalIdentityKey ?? "unavailable"}.`);
  }
  const bodyHeight = canonicalDimension(readiness.canonical.canon_bodyHeightMm, "canon_bodyHeightMm");
  const assembledHeight = canonicalDimension(readiness.canonical.canon_heightWithCapMm, "canon_heightWithCapMm");
  const widthAxis = canonicalDimension(readiness.canonical.canon_widthAxisMm, "canon_widthAxisMm");
  const secondAxis = canonicalDimension(readiness.canonical.canon_secondAxisMm, "canon_secondAxisMm");
  return {
    ...product,
    family: readiness.canonical.family,
    capacityMl: canonicalDimension(readiness.canonical.capacityMl, "capacityMl"),
    heightWithoutCap: String(bodyHeight),
    heightWithCap: String(assembledHeight),
    diameter: String(widthAxis),
    canonicalBodyHeightMm: bodyHeight,
    canonicalAssembledHeightMm: assembledHeight,
    canonicalWidthAxisMm: widthAxis,
    canonicalSecondAxisMm: secondAxis,
    measurementSource: "best-bottles-canonical-truth-2026-07-12",
  };
}

export function buildCylinderCanonicalGeometryContract(
  readiness: CylinderRoleAwareReadinessRow | null | undefined,
): CylinderCanonicalGeometryContract {
  if (!readiness) throw new Error("Cylinder canonical geometry contract requires exact role-aware readiness.");
  canonicalDimension(readiness.canonical.canon_bodyHeightMm, "canon_bodyHeightMm");
  canonicalDimension(readiness.canonical.canon_heightWithCapMm, "canon_heightWithCapMm");
  canonicalDimension(readiness.canonical.canon_widthAxisMm, "canon_widthAxisMm");
  canonicalDimension(readiness.canonical.canon_secondAxisMm, "canon_secondAxisMm");
  const sealInput = {
    version: "best-bottles-canonical-geometry-v1" as const,
    websiteSku: readiness.websiteSku,
    graceSku: readiness.graceSku,
    canon_bodyHeightMm: readiness.canonical.canon_bodyHeightMm,
    canon_heightWithCapMm: readiness.canonical.canon_heightWithCapMm,
    canon_widthAxisMm: readiness.canonical.canon_widthAxisMm,
    canon_secondAxisMm: readiness.canonical.canon_secondAxisMm,
  };
  return { ...sealInput, sha256: sha256Hex(JSON.stringify(sealInput)) };
}

function assertSha(value: unknown, label: string, nullable = false): void {
  if (nullable && value === null) return;
  if (typeof value !== "string" || !SHA_256.test(value.toLowerCase())) {
    throw new Error(`Cylinder role-aware provenance ${label} must be a SHA-256 hash${nullable ? " or null" : ""}.`);
  }
}

function assertProvenance(artifact: CylinderRoleAwareReadinessArtifact): void {
  if (!artifact.generatedAt || Number.isNaN(Date.parse(artifact.generatedAt))) {
    throw new Error("Cylinder role-aware readiness generatedAt is missing or invalid.");
  }
  const provenance = artifact.provenance;
  if (!provenance || typeof provenance !== "object") {
    throw new Error("Cylinder role-aware readiness provenance is missing.");
  }
  const specs: Array<[keyof typeof provenance, string[], string[]]> = [
    ["productionReadiness", ["path", "version"], ["fileSha256"]],
    ["identityCapOn", ["auditPath", "auditVersion", "executionPath", "executionVersion"], ["auditFileSha256", "executionFileSha256", "executionSeal"]],
    ["pdpCapOffSidecar", ["preflightPath", "preflightVersion", "executionPath", "executionVersion", "sourceManifestPath", "sourceManifestVersion"], ["preflightFileSha256", "executionFileSha256", "executionSeal", "sourceManifestSha256"]],
    ["livePointerApproval", ["path", "version"], ["fileSha256"]],
    ["recoveryApproval", ["path", "version"], ["fileSha256"]],
  ];
  for (const [section, textFields, shaFields] of specs) {
    const record = provenance[section];
    if (!record || typeof record !== "object") throw new Error(`Cylinder role-aware provenance ${section} is missing.`);
    for (const field of textFields) {
      if (typeof record[field] !== "string" || !String(record[field]).trim()) {
        throw new Error(`Cylinder role-aware provenance ${section}.${field} is missing.`);
      }
    }
    for (const field of shaFields) assertSha(record[field], `${section}.${field}`);
  }
  for (const [section, field] of [
    ["identityCapOn", "currentAuditSeal"], ["identityCapOn", "executionAuditSeal"],
    ["pdpCapOffSidecar", "currentAuditPreflightSeal"], ["pdpCapOffSidecar", "executionPreflightSeal"],
    ["livePointerApproval", "approvalSeal"],
  ] as const) assertSha(provenance[section][field], `${section}.${field}`, true);
}

export function buildCylinderCanonicalRosterAuthority(
  roleArtifact: CylinderRoleAwareReadinessArtifact,
  productionReadinessBytes: Uint8Array,
): CylinderCanonicalRosterAuthority {
  const provenance = roleArtifact.provenance?.productionReadiness;
  const expectedSha = String(provenance?.fileSha256 ?? "").toLowerCase();
  const actualSha = sha256Hex(productionReadinessBytes);
  if (!SHA_256.test(expectedSha) || actualSha !== expectedSha) {
    throw new Error("Cylinder canonical roster file SHA-256 does not match role-artifact provenance.");
  }
  let artifact: {
    version?: unknown;
    summary?: { canonicalIdentityCount?: unknown };
    rows?: Array<{
      canonicalIdentityKey?: unknown;
      websiteSku?: unknown;
      graceSku?: unknown;
      canonical?: { websiteSku?: unknown; graceSku?: unknown };
    }>;
  };
  try {
    artifact = JSON.parse(new TextDecoder().decode(productionReadinessBytes));
  } catch {
    throw new Error("Cylinder canonical production-readiness roster is not valid JSON.");
  }
  if (
    artifact.version !== provenance?.version
    || artifact.version !== "best-bottles-cylinder-production-readiness-v1"
    || !Array.isArray(artifact.rows)
    || artifact.summary?.canonicalIdentityCount !== artifact.rows.length
  ) {
    throw new Error("Cylinder canonical production-readiness roster version or row summary is invalid.");
  }
  const identities = new Set<string>();
  for (const row of artifact.rows) {
    const websiteSku = String(row.websiteSku ?? "");
    const graceSku = String(row.graceSku ?? "");
    const key = cylinderProductionIdentityKey(websiteSku, graceSku);
    const canonicalKey = cylinderProductionIdentityKey(
      String(row.canonical?.websiteSku ?? ""),
      String(row.canonical?.graceSku ?? ""),
    );
    if (!websiteSku.trim() || !graceSku.trim() || row.canonicalIdentityKey !== key || canonicalKey !== key) {
      throw new Error(`Cylinder canonical production-readiness identity ${String(row.canonicalIdentityKey)} is invalid.`);
    }
    if (identities.has(key)) throw new Error(`Duplicate Cylinder canonical roster identity ${key}.`);
    identities.add(key);
  }
  return {
    version: "best-bottles-cylinder-canonical-roster-v1",
    sourceFileSha256: actualSha,
    identities,
  };
}

export function getCylinderReferenceRoleForPreset(presetId: string): CylinderReferenceRoleId {
  return presetId === CYLINDER_PDP_SIDECAR_PRESET_ID
    ? "pdp-cap-off-sidecar"
    : "identity-cap-on";
}

function isVerifiedReference(reference: CylinderRoleAwareReference): boolean {
  return reference.remoteStatus === "verified"
    && reference.productionStatus === "generation-authorized"
    && reference.blockers.length === 0;
}

function roleStoragePathIsExact(
  row: CylinderRoleAwareReadinessRow,
  reference: CylinderRoleAwareReference,
): boolean {
  const storagePath = reference.storagePath;
  const exportSha256 = reference.exportSha256?.toLowerCase() ?? "";
  if (!storagePath || !SHA_256.test(exportSha256)) return false;
  const identityFilenamePrefix = `${row.canonicalIdentityKey.replace("|", "__")}__`;
  const roleRoot = reference.roleId === "identity-cap-on"
    ? "best-bottles/production-references/cylinder/v1"
    : "best-bottles/production-references/cylinder/sidecar-v2";
  return storagePath === [
    roleRoot,
    exportSha256.slice(0, 2),
    `${identityFilenamePrefix}${exportSha256}.png`,
  ].join("/");
}

function assertAuthorizedReference(
  row: CylinderRoleAwareReadinessRow,
  reference: CylinderRoleAwareReference,
): void {
  if (!isVerifiedReference(reference)) return;
  if (reference.opaque !== true) {
    throw new Error(`Cylinder role ${reference.roleId} for ${row.canonicalIdentityKey} must be an opaque PNG.`);
  }
  if (!roleStoragePathIsExact(row, reference)) {
    throw new Error(`Cylinder role ${reference.roleId} for ${row.canonicalIdentityKey} has a malformed immutable storage path or SHA.`);
  }
  if (!reference.publicUrl) {
    throw new Error(`Cylinder role ${reference.roleId} for ${row.canonicalIdentityKey} is missing its immutable public URL.`);
  }
  let parsed: URL;
  try {
    parsed = new URL(reference.publicUrl);
  } catch {
    throw new Error(`Cylinder role ${reference.roleId} for ${row.canonicalIdentityKey} has a malformed immutable public URL.`);
  }
  if (
    parsed.protocol !== "https:"
    || parsed.search !== ""
    || parsed.hash !== ""
    || parsed.pathname !== `/storage/v1/object/public/reference-images/${reference.storagePath}`
  ) {
    throw new Error(`Cylinder role ${reference.roleId} for ${row.canonicalIdentityKey} has a non-immutable public URL.`);
  }

  if (reference.roleId === "identity-cap-on") {
    if (reference.topology !== "assembled-cap-on" || reference.approvedException !== null) {
      throw new Error(`Cylinder identity-cap-on role for ${row.canonicalIdentityKey} has invalid topology.`);
    }
    return;
  }

  if (reference.sourceRoute === "exact-live-pdp-sidecar") {
    throw new Error(
      `Cylinder sidecar role for ${row.canonicalIdentityKey} uses raw live-PDP evidence and requires reviewed immutable remediation.`,
    );
  }
  if (reference.sourceRoute === "reviewed-immutable-sidecar-remediation") {
    if (!/^(?:approved|reviewed)$/i.test(reference.sourceReviewStatus.trim())) {
      throw new Error(`Cylinder reviewed remediation for ${row.canonicalIdentityKey} is not in an approved or reviewed final state.`);
    }
    const reviewedOutputSha256 = reference.reviewedOutputSha256?.toLowerCase() ?? "";
    if (!SHA_256.test(reviewedOutputSha256) || reviewedOutputSha256 !== reference.exportSha256?.toLowerCase()) {
      throw new Error(`Cylinder reviewed output SHA for ${row.canonicalIdentityKey} does not match the immutable role SHA.`);
    }
  }
  if (reference.topology === "fitment-attached-cap-right-sidecar") {
    if (reference.approvedException !== null) {
      throw new Error(`Cylinder sidecar role for ${row.canonicalIdentityKey} has an invalid topology exception.`);
    }
    return;
  }
  if (
    reference.topology === "assembled-live-site-exception"
    && (
      reference.approvedException === "live-site-vintage-bulb"
      || reference.approvedException === "live-site-genuine-two-piece"
    )
  ) return;
  throw new Error(`Cylinder sidecar role for ${row.canonicalIdentityKey} has invalid topology.`);
}

function assertPositiveCanonicalGeometry(row: CylinderRoleAwareReadinessRow): void {
  for (const field of [
    "canon_bodyHeightMm",
    "canon_heightWithCapMm",
    "canon_widthAxisMm",
    "canon_secondAxisMm",
  ] as const) {
    if (!(Number(row.canonical[field]) > 0)) {
      throw new Error(`Cylinder role-aware identity ${row.canonicalIdentityKey} has invalid canonical geometry field ${field}.`);
    }
  }
}

export function buildCylinderRoleAwareReadinessIndex(
  artifact: CylinderRoleAwareReadinessArtifact,
  canonicalRoster: CylinderCanonicalRosterAuthority,
): CylinderRoleAwareReadinessIndex {
  if (artifact.version !== BEST_BOTTLES_CYLINDER_ROLE_AWARE_READINESS_VERSION) {
    throw new Error(`Unexpected Cylinder role-aware readiness version ${String(artifact.version)}.`);
  }
  if (
    canonicalRoster?.version !== "best-bottles-cylinder-canonical-roster-v1"
    || canonicalRoster.sourceFileSha256 !== artifact.provenance?.productionReadiness?.fileSha256
  ) {
    throw new Error("Cylinder role-aware readiness requires its independently verified canonical roster.");
  }
  if (artifact.summary.externalWriteCount !== 0) {
    throw new Error("Cylinder role-aware readiness must prove zero external writes.");
  }
  const expectedSummaryKeys = [
    "approvedEvidenceBlockedCount",
    "blockedIdentityCount",
    "bothRolesVerifiedCount",
    "canonicalIdentityCount",
    "externalWriteCount",
    "identityCapOnVerifiedCount",
    "liveSiteExceptionCount",
    "missingApprovedEvidenceBlockedCount",
    "pdpCapOffSidecarVerifiedCount",
    "standardSidecarCount",
  ];
  if (Object.keys(artifact.summary).sort().join("|") !== expectedSummaryKeys.join("|")) {
    throw new Error("Cylinder role-aware readiness summary fields do not match the producer contract.");
  }
  assertProvenance(artifact);
  const { sha256, ...unsigned } = artifact;
  if (!SHA_256.test(String(sha256).toLowerCase()) || sha256Hex(stableJson(unsigned)) !== sha256.toLowerCase()) {
    throw new Error("Cylinder role-aware readiness producer SHA-256 seal is missing or invalid.");
  }
  if (
    artifact.authorization?.generationScope !== "controlled-studio-only"
    || artifact.authorization?.generationStatus !== "authorized-for-controlled-generation"
    || artifact.authorization?.publishStatus !== "not-publish-ready"
    || artifact.authorization?.individualContentReviewStatus !== "not-individually-content-approved"
    || artifact.authorization?.requiredNextGate !== "generated-output-qa-and-explicit-publish-approval"
  ) {
    throw new Error("Cylinder role-aware readiness has an invalid authorization state.");
  }

  const index: CylinderRoleAwareReadinessIndex = new Map();
  let identityCapOnVerifiedCount = 0;
  let pdpCapOffSidecarVerifiedCount = 0;
  let bothRolesVerifiedCount = 0;
  let standardSidecarCount = 0;
  let liveSiteExceptionCount = 0;
  let approvedEvidenceBlockedCount = 0;
  let missingApprovedEvidenceBlockedCount = 0;
  for (const row of artifact.rows) {
    const key = cylinderProductionIdentityKey(row.websiteSku, row.graceSku);
    const canonicalKey = cylinderProductionIdentityKey(row.canonical.websiteSku, row.canonical.graceSku);
    if (!key || key !== row.canonicalIdentityKey || canonicalKey !== key) {
      throw new Error(`Cylinder role-aware identity ${row.canonicalIdentityKey} does not match its exact SKUs.`);
    }
    if (index.has(key)) throw new Error(`Duplicate Cylinder role-aware identity ${key}.`);
    if (!canonicalRoster.identities.has(key)) {
      throw new Error(`Cylinder role-aware identity ${key} is absent from the canonical production roster.`);
    }
    if (
      row.references.identityCapOn.roleId !== "identity-cap-on"
      || row.references.pdpCapOffSidecar.roleId !== "pdp-cap-off-sidecar"
    ) {
      throw new Error(`Cylinder role-aware identity ${key} has an invalid reference role.`);
    }
    assertPositiveCanonicalGeometry(row);
    assertAuthorizedReference(row, row.references.identityCapOn);
    assertAuthorizedReference(row, row.references.pdpCapOffSidecar);
    const capOnVerified = isVerifiedReference(row.references.identityCapOn);
    const sidecarVerified = isVerifiedReference(row.references.pdpCapOffSidecar);
    if (capOnVerified) identityCapOnVerifiedCount += 1;
    if (sidecarVerified) {
      pdpCapOffSidecarVerifiedCount += 1;
      if (row.references.pdpCapOffSidecar.topology === "fitment-attached-cap-right-sidecar") {
        standardSidecarCount += 1;
      } else if (row.references.pdpCapOffSidecar.topology === "assembled-live-site-exception") {
        liveSiteExceptionCount += 1;
      }
    }
    const bothVerified = capOnVerified && sidecarVerified;
    if (bothVerified) bothRolesVerifiedCount += 1;
    if ((row.status === "both-roles-verified") !== bothVerified) {
      throw new Error(`Cylinder role-aware identity ${key} status disagrees with its two reference roles.`);
    }
    if (!bothVerified) {
      if (row.approvedEvidence?.livePointer || row.approvedEvidence?.recovery) approvedEvidenceBlockedCount += 1;
      else missingApprovedEvidenceBlockedCount += 1;
    }
    index.set(key, row);
  }

  if (index.size !== canonicalRoster.identities.size) {
    const missing = [...canonicalRoster.identities].find((key) => !index.has(key));
    throw new Error(`Cylinder role-aware readiness is incomplete against the canonical production roster${missing ? `; missing ${missing}` : ""}.`);
  }

  const derived = {
    canonicalIdentityCount: artifact.rows.length,
    identityCapOnVerifiedCount,
    pdpCapOffSidecarVerifiedCount,
    bothRolesVerifiedCount,
    blockedIdentityCount: artifact.rows.length - bothRolesVerifiedCount,
    standardSidecarCount,
    liveSiteExceptionCount,
    approvedEvidenceBlockedCount,
    missingApprovedEvidenceBlockedCount,
    externalWriteCount: 0,
  };
  for (const [key, value] of Object.entries(derived)) {
    if (artifact.summary[key] !== value) {
      throw new Error(`Cylinder role-aware summary ${key}=${String(artifact.summary[key])} does not match derived total ${value}.`);
    }
  }
  if (artifact.authorization.exactEvidenceIdentityCount !== bothRolesVerifiedCount) {
    throw new Error("Cylinder role-aware authorization exactEvidenceIdentityCount does not match the derived both-role total.");
  }
  return index;
}

export function getCylinderRoleAwareReadinessForIdentity(
  index: CylinderRoleAwareReadinessIndex | null | undefined,
  websiteSku: string | null | undefined,
  graceSku: string | null | undefined,
): CylinderRoleAwareReadinessRow | null {
  if (!index || !websiteSku?.trim() || !graceSku?.trim()) return null;
  return index.get(cylinderProductionIdentityKey(websiteSku, graceSku)) ?? null;
}

export function getCylinderReferenceForPreset(
  row: CylinderRoleAwareReadinessRow | null | undefined,
  presetId: string,
): CylinderRoleAwareReference | null {
  if (!row) return null;
  return getCylinderReferenceRoleForPreset(presetId) === "pdp-cap-off-sidecar"
    ? row.references.pdpCapOffSidecar
    : row.references.identityCapOn;
}

export function resolveCylinderImmutableReferenceForPreset(
  row: CylinderRoleAwareReadinessRow | null | undefined,
  presetId: string,
): CylinderRoleAwareReference | null {
  const reference = getCylinderReferenceForPreset(row, presetId);
  if (!row || !reference || !isVerifiedReference(reference)) return null;
  assertAuthorizedReference(row, reference);
  return reference;
}

export interface CylinderGenerationTopology {
  capState: "assembled" | "detached";
  mode: "cap-on" | "cap-off";
  componentTopology: "assembled" | "fitment-attached-cap-right-sidecar" | "assembled-live-site-exception";
  requiresCapOffReference: boolean;
}

export function getCylinderGenerationTopologyForPreset(
  row: CylinderRoleAwareReadinessRow | null | undefined,
  presetId: string,
): CylinderGenerationTopology | null {
  const reference = resolveCylinderImmutableReferenceForPreset(row, presetId);
  if (!reference) return null;
  if (reference.roleId === "identity-cap-on") {
    return { capState: "assembled", mode: "cap-on", componentTopology: "assembled", requiresCapOffReference: false };
  }
  if (reference.topology === "fitment-attached-cap-right-sidecar") {
    return { capState: "detached", mode: "cap-off", componentTopology: reference.topology, requiresCapOffReference: true };
  }
  return { capState: "assembled", mode: "cap-on", componentTopology: "assembled-live-site-exception", requiresCapOffReference: false };
}

export interface CylinderRoleGenerationAuthority {
  referenceRoleId: CylinderReferenceRoleId;
  componentTopology: CylinderGenerationTopology["componentTopology"];
  capState: CylinderGenerationTopology["capState"];
  capOffReferenceId: string | null;
  topologyReferenceId: string;
  shadowTopology: "detached-sidecar" | "complex-contact";
}

export function buildCylinderRoleGenerationAuthority(
  row: CylinderRoleAwareReadinessRow | null | undefined,
  presetId: string,
  actualInputSha256: string,
): CylinderRoleGenerationAuthority {
  const reference = resolveCylinderImmutableReferenceForPreset(row, presetId);
  const topology = getCylinderGenerationTopologyForPreset(row, presetId);
  const actual = actualInputSha256.toLowerCase();
  if (!reference || !topology || !SHA_256.test(actual)) {
    throw new Error("Cylinder immutable role authority is missing or the actual input SHA-256 is malformed.");
  }
  const expected = reference.exportSha256?.toLowerCase() ?? "";
  if (actual !== expected) {
    throw new Error("Cylinder immutable role hash mismatch: actual input bytes differ from the reviewed role export.");
  }
  return {
    referenceRoleId: reference.roleId,
    componentTopology: topology.componentTopology,
    capState: topology.capState,
    capOffReferenceId: topology.requiresCapOffReference ? expected : null,
    topologyReferenceId: expected,
    shadowTopology: topology.componentTopology === "fitment-attached-cap-right-sidecar"
      ? "detached-sidecar"
      : "complex-contact",
  };
}

export interface CylinderVerifiedReferenceBytes {
  authority: CylinderRoleGenerationAuthority;
  bytes: Uint8Array;
  sha256: string;
  dataUrl: string;
  lineageUrl: string;
  width: number;
  height: number;
}

function readVerifiedPngDimensions(bytes: Uint8Array): { width: number; height: number } {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (
    bytes.length < 24
    || signature.some((value, index) => bytes[index] !== value)
    || new TextDecoder().decode(bytes.subarray(12, 16)) !== "IHDR"
  ) {
    throw new Error("Cylinder immutable reference bytes are not a decodable PNG.");
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  if (width <= 0 || height <= 0) {
    throw new Error("Cylinder immutable reference PNG has invalid dimensions.");
  }
  return { width, height };
}

export function getCylinderVerifiedReferenceCacheKey(
  row: CylinderRoleAwareReadinessRow | null | undefined,
  presetId: string,
): string {
  const reference = resolveCylinderImmutableReferenceForPreset(row, presetId);
  if (!row || !reference) {
    throw new Error("Cylinder verified-reference cache key requires exact role authority.");
  }
  return `${row.canonicalIdentityKey}|${reference.roleId}`;
}

function bytesToDataUrl(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return `data:image/png;base64,${btoa(binary)}`;
}

export async function verifyCylinderImmutableReferenceBytesForPreset(
  row: CylinderRoleAwareReadinessRow | null | undefined,
  presetId: string,
  referenceUrl: string | null | undefined,
  fetcher: typeof fetch = fetch,
): Promise<CylinderVerifiedReferenceBytes> {
  const reference = resolveCylinderImmutableReferenceForPreset(row, presetId);
  if (!reference || !referenceUrl?.trim() || reference.publicUrl !== referenceUrl.trim()) {
    throw new Error("Cylinder generation requires the exact immutable reference role URL selected by this preset.");
  }
  const response = await fetcher(referenceUrl.trim(), { cache: "no-store" });
  if (!response.ok) throw new Error(`Cylinder immutable role bytes could not be loaded (${response.status}).`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const actualSha256 = sha256Hex(bytes);
  const authority = buildCylinderRoleGenerationAuthority(row, presetId, actualSha256);
  const dimensions = readVerifiedPngDimensions(bytes);
  return {
    authority,
    bytes,
    sha256: actualSha256,
    dataUrl: bytesToDataUrl(bytes),
    lineageUrl: referenceUrl.trim(),
    ...dimensions,
  };
}

/**
 * The only allowed bridge from immutable-byte verification to a generation
 * consumer. A batch may pass the exact object it verified during preflight;
 * a single generation verifies once here. In both cases the same object is
 * handed to the invocation callback without reconstructing or refetching it.
 */
export async function invokeWithCylinderVerifiedReference<T>(input: {
  row: CylinderRoleAwareReadinessRow | null | undefined;
  presetId: string;
  referenceUrl: string | null | undefined;
  preverified?: CylinderVerifiedReferenceBytes | null;
  verifyReference?: typeof verifyCylinderImmutableReferenceBytesForPreset;
  invoke: (verified: CylinderVerifiedReferenceBytes) => Promise<T> | T;
}): Promise<T> {
  const expected = resolveCylinderImmutableReferenceForPreset(input.row, input.presetId);
  const referenceUrl = input.referenceUrl?.trim() ?? "";
  if (!expected || !referenceUrl || expected.publicUrl !== referenceUrl) {
    throw new Error("Cylinder generation invocation requires its exact immutable role URL.");
  }
  const verified = input.preverified ?? await (
    input.verifyReference ?? verifyCylinderImmutableReferenceBytesForPreset
  )(input.row, input.presetId, referenceUrl);
  if (
    verified.lineageUrl !== referenceUrl
    || verified.sha256 !== expected.exportSha256
    || verified.authority.referenceRoleId !== expected.roleId
    || !verified.dataUrl.startsWith("data:image/png;base64,")
  ) {
    throw new Error("Cylinder verified generation payload does not match the selected immutable role.");
  }
  return input.invoke(verified);
}

export function isCylinderReferenceAuthorizedForPreset(
  row: CylinderRoleAwareReadinessRow | null | undefined,
  presetId: string,
  referenceUrl: string | null | undefined,
): boolean {
  if (!referenceUrl?.trim()) return false;
  try {
    return resolveCylinderImmutableReferenceForPreset(row, presetId)?.publicUrl === referenceUrl.trim();
  } catch {
    return false;
  }
}
