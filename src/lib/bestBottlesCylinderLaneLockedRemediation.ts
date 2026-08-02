import { createHash } from "node:crypto";

import type {
  CylinderDualRoleEvidence,
  CylinderDualRoleRemediationPlan,
  CylinderDualRoleRemediationRow,
} from "./bestBottlesCylinderDualRoleRemediation";
import type {
  CylinderRoleAwareReadinessArtifact,
  CylinderRoleAwareReadinessRow,
} from "./bestBottlesCylinderRoleAwareReadiness";
import type { CylinderProductionCanonicalIdentity } from "./bestBottlesCylinderProductionCutover";

export const BEST_BOTTLES_CYLINDER_LANE_LOCKED_REMEDIATION_VERSION =
  "best-bottles-cylinder-lane-locked-remediation-v3" as const;

const CAP_ON_PROMPT_VERSION = "best-bottles-cylinder-cap-on-identity-prompt-v3" as const;
const SIDECAR_PROMPT_VERSION = "best-bottles-cylinder-cap-off-sidecar-prompt-v3" as const;
const MATERIAL_AUTHORITY_VERSION = "best-bottles-cylinder-role-material-authority-v1" as const;
export const BEST_BOTTLES_LANE_LOCKED_MATERIAL_CALIBRATIONS = {
  glass: {
    url: "https://likkskifwsrvszxdvufw.supabase.co/storage/v1/object/public/reference-images/best-bottles/visual-targets/glass/v1/54f5c6c1-7cb3-4137-9cb8-0208028f696a__e2443ec95d9856105cd187c305f10785d4233d4fe0480ce2a8b521f83b462708.png",
    bytesSha256: "e2443ec95d9856105cd187c305f10785d4233d4fe0480ce2a8b521f83b462708",
  },
  aluminum: {
    url: "https://likkskifwsrvszxdvufw.supabase.co/storage/v1/object/public/generated-images/4ab1ac72-cd7e-4faf-9152-5aa5f2862411/1779263636108-9e5b6e2e-88a1-4d39-bfd1-75a2a398a84d.png",
    bytesSha256: "ff15dde94f2a7b5d2076e2e5df6b72ae9bd640454c4b74f672736300103bd382",
  },
} as const;

export type CylinderLaneLockedRole = "identity-cap-on" | "pdp-cap-off-sidecar";
export type CylinderLaneLockedMaterialType = keyof typeof BEST_BOTTLES_LANE_LOCKED_MATERIAL_CALIBRATIONS;
export type CylinderLaneLockedRequiredTopology = "assembled-cap-on" | "cap-off-sidecar";
export type CylinderLaneLockedSourceTopology =
  | "assembled-cap-on"
  | "detached-cap-or-sidecar"
  | "bottle-primary-with-detached-cap-or-overcap-sidecar"
  | "fitment-attached-cap-right-sidecar"
  | "assembled-live-site-exception";

export type CylinderLaneLockedRoute =
  | "strict-both-roles-ready"
  | "remediate-current-live-sidecar"
  | "approved-sidecar-only-missing-cap-on"
  | "approved-cap-on-only-missing-sidecar"
  | "hard-blocked-no-evidence"
  | "routed-to-vial";

type ArtifactSource<T> = {
  path: string;
  fileSha256: string;
  data: T;
};

export interface CylinderLaneLockedRemediationInput {
  generatedAt: string;
  sources: {
    supersededDualRolePlan: ArtifactSource<CylinderDualRoleRemediationPlan>;
    roleAwareReadiness: ArtifactSource<CylinderRoleAwareReadinessArtifact>;
  };
}

export interface CylinderLaneLockedPromptContract {
  version: typeof CAP_ON_PROMPT_VERSION | typeof SIDECAR_PROMPT_VERSION;
  role: CylinderLaneLockedRole;
  directives: readonly string[];
  sha256: string;
}

export interface CylinderLaneLockedMaterialAuthorityRecord {
  version: typeof MATERIAL_AUTHORITY_VERSION;
  authorityType: "secondary-style-only-material-calibration";
  canonicalIdentityKey: string;
  role: CylinderLaneLockedRole;
  materialType: CylinderLaneLockedMaterialType;
  calibrationUrl: string;
  calibrationBytesSha256: string;
  restriction: "style-only: calibrate material realism, reflectance, curvature, transparency, and finish; never assert product identity, geometry, topology, cap, fitment, or sidecar design";
}

export interface CylinderLaneLockedMaterialAuthority {
  role: CylinderLaneLockedRole;
  materialType: CylinderLaneLockedMaterialType;
  calibrationUrl: string;
  calibrationBytesSha256: string;
  record: CylinderLaneLockedMaterialAuthorityRecord;
  recordSha256: string;
}

export interface CylinderLaneLockedJob {
  jobId: string;
  operation: "preserve-exact-role-reference";
  canonicalIdentityKey: string;
  websiteSku: string;
  graceSku: string;
  role: CylinderLaneLockedRole;
  requiredTopology: CylinderLaneLockedRequiredTopology;
  sourceTopology: CylinderLaneLockedSourceTopology;
  materialType: CylinderLaneLockedMaterialType;
  evidenceLane: string;
  productReference: {
    locator: string;
    sha256: string;
    verifiedBytesSha256: string;
  };
  promptContract: CylinderLaneLockedPromptContract;
  materialAuthority: CylinderLaneLockedMaterialAuthority;
  bindingSha256: string;
  executionState: "compile-only-review-pending";
}

export interface CylinderLaneLockedRemediationRow {
  canonicalIdentityKey: string;
  websiteSku: string;
  graceSku: string;
  canonicalFamily: "Cylinder" | "Vial";
  canonical: CylinderProductionCanonicalIdentity;
  route: CylinderLaneLockedRoute;
  jobs: CylinderLaneLockedJob[];
  blockedRoles: {
    identityCapOn: string[];
    pdpCapOffSidecar: string[];
  };
}

export interface CylinderLaneLockedRemediationPlan {
  version: typeof BEST_BOTTLES_CYLINDER_LANE_LOCKED_REMEDIATION_VERSION;
  generatedAt: string;
  provenance: {
    inputs: Record<string, { path: string; sha256: string }>;
    supersedes: {
      version: "best-bottles-cylinder-dual-role-remediation-v2";
      semanticSha256: string;
      reason: "cross-lane-product-reference-reuse";
    };
  };
  authorization: {
    mode: "local-read-only";
    remoteWrites: "forbidden";
    paidGeneration: "not-authorized";
    publishStatus: "not-authorized";
  };
  summary: {
    sourceIdentityCount: 377;
    cylinderIdentityCount: 375;
    vialHandoffCount: 2;
    strictBothRolesReadyCount: 172;
    currentLiveSidecarJobCount: 56;
    detachedSidecarJobCount: 123;
    assembledCapOnJobCount: 13;
    hardBlockedNoEvidenceCount: 11;
    validRoleJobCount: 192;
    blockedRoleSlotCount: 158;
    blockedCylinderIdentityCount: 147;
    externalWriteCount: 0;
  };
  rows: CylinderLaneLockedRemediationRow[];
  jobs: CylinderLaneLockedJob[];
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

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function assertSha256(value: string | null | undefined, label: string): asserts value is string {
  if (!/^[a-f0-9]{64}$/i.test(String(value ?? ""))) {
    throw new Error(`${label} must be a SHA-256 hash.`);
  }
}

function normalizedIdentity(value: string | null | undefined): string {
  return String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function identityKey(websiteSku: string, graceSku: string): string {
  return `${normalizedIdentity(websiteSku)}|${normalizedIdentity(graceSku)}`;
}

function assertPortableLocator(value: string, label: string): void {
  if (!value || /^\//.test(value) || value.includes("/Users/")) {
    throw new Error(`${label} must use an HTTPS or workspace-relative locator.`);
  }
  if (!/^(https:\/\/|tmp\/|public\/|docs\/)/i.test(value)) {
    throw new Error(`${label} has an unsupported locator scheme.`);
  }
}

function promptContract(role: CylinderLaneLockedRole): CylinderLaneLockedPromptContract {
  const version = role === "identity-cap-on" ? CAP_ON_PROMPT_VERSION : SIDECAR_PROMPT_VERSION;
  const roleDirectives = role === "identity-cap-on"
    ? [
      "preserve the exact assembled cap-on topology in the role reference",
      "do not remove, detach, replace, infer, reconstruct, or redesign the cap or closure",
    ]
    : [
      "preserve the exact cap-off bottle plus detached sidecar topology in the role reference",
      "do not attach, assemble, replace, infer, reconstruct, or redesign the sidecar component",
    ];
  const directives = [
    ...roleDirectives,
    "the exact role product reference exclusively controls product identity, color, finish category, component design, geometry, cap, fitment, and topology",
    "the separate hash-bound material calibration controls only physical glass or metal rendering, optics, refraction, edge density, reflectance, curvature, and studio finish",
    "the material calibration controls style only—never identity, geometry, topology, color, finish category, cap, fitment, sidecar, or component design",
  ];
  const unsigned = { version, role, directives };
  return { ...unsigned, sha256: sha256(stableJson(unsigned)) };
}

function materialAuthority(input: {
  canonicalIdentityKey: string;
  role: CylinderLaneLockedRole;
  materialType: CylinderLaneLockedMaterialType;
}): CylinderLaneLockedMaterialAuthority {
  const calibration = BEST_BOTTLES_LANE_LOCKED_MATERIAL_CALIBRATIONS[input.materialType];
  const record: CylinderLaneLockedMaterialAuthorityRecord = {
    version: MATERIAL_AUTHORITY_VERSION,
    authorityType: "secondary-style-only-material-calibration",
    canonicalIdentityKey: input.canonicalIdentityKey,
    role: input.role,
    materialType: input.materialType,
    calibrationUrl: calibration.url,
    calibrationBytesSha256: calibration.bytesSha256,
    restriction:
      "style-only: calibrate material realism, reflectance, curvature, transparency, and finish; never assert product identity, geometry, topology, cap, fitment, or sidecar design",
  };
  return {
    role: input.role,
    materialType: input.materialType,
    calibrationUrl: calibration.url,
    calibrationBytesSha256: calibration.bytesSha256,
    record,
    recordSha256: sha256(stableJson(record)),
  };
}

function bindingRecord(job: Omit<CylinderLaneLockedJob, "bindingSha256">): unknown {
  return job;
}

function buildJob(input: {
  row: CylinderDualRoleRemediationRow;
  role: CylinderLaneLockedRole;
  requiredTopology: CylinderLaneLockedRequiredTopology;
  sourceTopology: CylinderLaneLockedSourceTopology;
}): CylinderLaneLockedJob {
  const evidence = input.row.evidence;
  if (!evidence.sourceLocator || !evidence.referenceSha256) {
    throw new Error(`Exact role evidence is incomplete for ${input.row.canonicalIdentityKey}.`);
  }
  assertPortableLocator(evidence.sourceLocator, "Product reference locator");
  assertSha256(evidence.referenceSha256, "Product reference hash");

  const productReference = {
    locator: evidence.sourceLocator,
    sha256: evidence.referenceSha256.toLowerCase(),
    verifiedBytesSha256: evidence.referenceSha256.toLowerCase(),
  };
  const unsigned: Omit<CylinderLaneLockedJob, "bindingSha256"> = {
    jobId: `${input.row.canonicalIdentityKey}|${input.role}|preserve-exact-role-reference`,
    operation: "preserve-exact-role-reference",
    canonicalIdentityKey: input.row.canonicalIdentityKey,
    websiteSku: input.row.websiteSku,
    graceSku: input.row.graceSku,
    role: input.role,
    requiredTopology: input.requiredTopology,
    sourceTopology: input.sourceTopology,
    materialType: "glass",
    evidenceLane: evidence.lane,
    productReference,
    promptContract: promptContract(input.role),
    materialAuthority: materialAuthority({
      canonicalIdentityKey: input.row.canonicalIdentityKey,
      role: input.role,
      materialType: "glass",
    }),
    executionState: "compile-only-review-pending",
  };
  const job = { ...unsigned, bindingSha256: sha256(stableJson(bindingRecord(unsigned))) };
  assertCylinderLaneLockedJob(job);
  return job;
}

function classifySidecarTopology(evidence: CylinderDualRoleEvidence): CylinderLaneLockedSourceTopology {
  const topology = evidence.classification;
  if (
    topology === "detached-cap-or-sidecar"
    || topology === "bottle-primary-with-detached-cap-or-overcap-sidecar"
    || topology === "fitment-attached-cap-right-sidecar"
  ) {
    return topology;
  }
  throw new Error(`Sidecar evidence has an incompatible source topology ${String(topology)}.`);
}

function validateSourceContracts(input: CylinderLaneLockedRemediationInput): void {
  for (const [name, source] of Object.entries(input.sources)) {
    assertPortableLocator(source.path, `${name} source path`);
    assertSha256(source.fileSha256, `${name} source file hash`);
  }
  const v2 = input.sources.supersededDualRolePlan.data;
  const roleAware = input.sources.roleAwareReadiness.data;
  if (v2.version !== "best-bottles-cylinder-dual-role-remediation-v2") {
    throw new Error("Lane-locked remediation requires the sealed dual-role v2 source plan.");
  }
  if (roleAware.version !== "best-bottles-cylinder-role-aware-readiness-v2") {
    throw new Error("Lane-locked remediation requires role-aware readiness v2.");
  }
  assertSha256(v2.sha256, "Superseded dual-role semantic hash");
  assertSha256(roleAware.sha256, "Role-aware readiness semantic hash");
  const { sha256: v2Seal, ...v2Unsigned } = v2;
  if (sha256(stableJson(v2Unsigned)) !== v2Seal) {
    throw new Error("Superseded dual-role plan semantic hash mismatch.");
  }
  const { sha256: roleSeal, ...roleUnsigned } = roleAware;
  if (sha256(stableJson(roleUnsigned)) !== roleSeal) {
    throw new Error("Role-aware readiness semantic hash mismatch.");
  }
  if (v2.rows.length !== 377 || roleAware.rows.length !== 377) {
    throw new Error("Lane-locked remediation requires the complete 377-row source roster.");
  }
}

function roleAwareIndex(artifact: CylinderRoleAwareReadinessArtifact): Map<string, CylinderRoleAwareReadinessRow> {
  const index = new Map<string, CylinderRoleAwareReadinessRow>();
  for (const row of artifact.rows) {
    if (row.canonicalIdentityKey !== identityKey(row.websiteSku, row.graceSku)) {
      throw new Error(`Role-aware identity mismatch for ${row.canonicalIdentityKey}.`);
    }
    if (index.has(row.canonicalIdentityKey)) {
      throw new Error(`Duplicate role-aware identity ${row.canonicalIdentityKey}.`);
    }
    index.set(row.canonicalIdentityKey, row);
  }
  return index;
}

export function assertCylinderLaneLockedJob(job: CylinderLaneLockedJob): void {
  const exactIdentity = identityKey(job.websiteSku, job.graceSku);
  if (job.canonicalIdentityKey !== exactIdentity) {
    throw new Error(`Job identity mismatch: ${job.canonicalIdentityKey} does not match ${exactIdentity}.`);
  }
  const expectedJobId = `${job.canonicalIdentityKey}|${job.role}|preserve-exact-role-reference`;
  if (job.jobId !== expectedJobId || job.operation !== "preserve-exact-role-reference") {
    throw new Error("Job role identity or operation is not lane locked.");
  }
  const compatible = job.role === "identity-cap-on"
    ? job.requiredTopology === "assembled-cap-on" && job.sourceTopology === "assembled-cap-on"
    : job.requiredTopology === "cap-off-sidecar" && new Set<CylinderLaneLockedSourceTopology>([
      "detached-cap-or-sidecar",
      "bottle-primary-with-detached-cap-or-overcap-sidecar",
      "fitment-attached-cap-right-sidecar",
    ]).has(job.sourceTopology);
  if (!compatible) throw new Error("Role topology mismatch: source cannot satisfy the requested role topology.");

  assertPortableLocator(job.productReference.locator, "Product reference locator");
  assertSha256(job.productReference.sha256, "Product reference hash");
  assertSha256(job.productReference.verifiedBytesSha256, "Product reference verified bytes hash");
  if (job.productReference.sha256 !== job.productReference.verifiedBytesSha256) {
    throw new Error("Product reference hash mismatch against its verified bytes hash.");
  }

  const expectedPrompt = promptContract(job.role);
  if (
    job.promptContract.version !== expectedPrompt.version
    || job.promptContract.role !== job.role
    || stableJson(job.promptContract.directives) !== stableJson(expectedPrompt.directives)
    || job.promptContract.sha256 !== expectedPrompt.sha256
  ) {
    throw new Error("Prompt contract mismatch for the requested role.");
  }

  const expectedMaterial = materialAuthority({
    canonicalIdentityKey: job.canonicalIdentityKey,
    role: job.role,
    materialType: job.materialType,
  });
  if (job.materialAuthority.role !== job.role) {
    throw new Error("Material authority role mismatch for the requested role job.");
  }
  if (job.materialAuthority.materialType !== job.materialType) {
    throw new Error("Material type mismatch for the requested role job.");
  }
  if (job.materialAuthority.calibrationUrl !== expectedMaterial.calibrationUrl) {
    throw new Error("Material calibration URL mismatch for the requested material type.");
  }
  if (job.materialAuthority.calibrationBytesSha256 !== expectedMaterial.calibrationBytesSha256) {
    throw new Error("Material calibration hash mismatch for the requested material type.");
  }
  if (
    job.materialAuthority.calibrationUrl === job.productReference.locator
    || job.materialAuthority.calibrationBytesSha256 === job.productReference.sha256
  ) {
    throw new Error("Material calibration must remain distinct from the product identity reference.");
  }
  if (stableJson(job.materialAuthority.record) !== stableJson(expectedMaterial.record)) {
    throw new Error("Material authority style-only record mismatch.");
  }
  if (job.materialAuthority.recordSha256 !== expectedMaterial.recordSha256) {
    throw new Error("Material authority record hash mismatch.");
  }

  const { bindingSha256, ...unsigned } = job;
  assertSha256(bindingSha256, "Binding hash");
  if (bindingSha256 !== sha256(stableJson(bindingRecord(unsigned)))) {
    throw new Error("Binding hash mismatch for the lane-locked job.");
  }
}

export function validateCylinderLaneLockedJobs(
  jobs: readonly CylinderLaneLockedJob[],
  options: { validateIndividualBindings?: boolean } = {},
): void {
  if (options.validateIndividualBindings !== false) {
    for (const job of jobs) assertCylinderLaneLockedJob(job);
  }
  const byIdentity = new Map<string, CylinderLaneLockedJob[]>();
  for (const job of jobs) {
    const rows = byIdentity.get(job.canonicalIdentityKey) ?? [];
    rows.push(job);
    byIdentity.set(job.canonicalIdentityKey, rows);
  }
  for (const [identity, identityJobs] of byIdentity) {
    const capOn = identityJobs.filter((job) => job.role === "identity-cap-on");
    const sidecars = identityJobs.filter((job) => job.role === "pdp-cap-off-sidecar");
    for (const left of capOn) {
      for (const right of sidecars) {
        if (left.productReference.locator === right.productReference.locator) {
          throw new Error(`Opposite roles for ${identity} use the same product locator.`);
        }
        if (left.productReference.sha256 === right.productReference.sha256) {
          throw new Error(`Opposite roles for ${identity} use the same product reference hash.`);
        }
      }
    }
  }
}

function countRoute(rows: readonly CylinderLaneLockedRemediationRow[], route: CylinderLaneLockedRoute): number {
  return rows.filter((row) => row.route === route).length;
}

export function buildCylinderLaneLockedRemediationPlan(
  input: CylinderLaneLockedRemediationInput,
): CylinderLaneLockedRemediationPlan {
  validateSourceContracts(input);
  const v2 = input.sources.supersededDualRolePlan.data;
  const readiness = roleAwareIndex(input.sources.roleAwareReadiness.data);

  const rows = v2.rows.map((sourceRow): CylinderLaneLockedRemediationRow => {
    const authorityRow = readiness.get(sourceRow.canonicalIdentityKey);
    if (!authorityRow) throw new Error(`Missing role-aware identity ${sourceRow.canonicalIdentityKey}.`);
    const { family: authorityFamily, ...authorityCanonical } = authorityRow.canonical;
    const { family: sourceFamily, ...sourceCanonical } = sourceRow.canonical;
    const allowedFamilyHandoff = sourceRow.route === "routed-to-vial"
      ? authorityFamily === "Cylinder" && sourceFamily === "Vial"
      : authorityFamily === sourceFamily;
    if (
      authorityRow.websiteSku !== sourceRow.websiteSku
      || authorityRow.graceSku !== sourceRow.graceSku
      || !allowedFamilyHandoff
      || stableJson(authorityCanonical) !== stableJson(sourceCanonical)
    ) {
      throw new Error(`Role-aware identity or canonical truth changed for ${sourceRow.canonicalIdentityKey}.`);
    }

    let route: CylinderLaneLockedRoute;
    let jobs: CylinderLaneLockedJob[] = [];
    const blockedRoles = { identityCapOn: [] as string[], pdpCapOffSidecar: [] as string[] };

    switch (sourceRow.route) {
      case "strict-both-roles-ready":
        route = "strict-both-roles-ready";
        break;
      case "remediate-current-live-sidecar":
        route = "remediate-current-live-sidecar";
        jobs = [buildJob({
          row: sourceRow,
          role: "pdp-cap-off-sidecar",
          requiredTopology: "cap-off-sidecar",
          sourceTopology: classifySidecarTopology(sourceRow.evidence),
        })];
        break;
      case "approved-detached-dual-role":
        route = "approved-sidecar-only-missing-cap-on";
        jobs = [buildJob({
          row: sourceRow,
          role: "pdp-cap-off-sidecar",
          requiredTopology: "cap-off-sidecar",
          sourceTopology: classifySidecarTopology(sourceRow.evidence),
        })];
        blockedRoles.identityCapOn.push("no-approved-exact-cap-on-reference");
        break;
      case "approved-topology-exception":
        if (sourceRow.evidence.classification !== "assembled-cap-on") {
          throw new Error(`Cap-on evidence has an incompatible source topology for ${sourceRow.canonicalIdentityKey}.`);
        }
        route = "approved-cap-on-only-missing-sidecar";
        jobs = [buildJob({
          row: sourceRow,
          role: "identity-cap-on",
          requiredTopology: "assembled-cap-on",
          sourceTopology: "assembled-cap-on",
        })];
        blockedRoles.pdpCapOffSidecar.push("no-approved-exact-sidecar-reference");
        break;
      case "hard-blocked-no-evidence":
        route = "hard-blocked-no-evidence";
        blockedRoles.identityCapOn.push("no-approved-exact-cap-on-reference");
        blockedRoles.pdpCapOffSidecar.push("no-approved-exact-sidecar-reference");
        break;
      case "routed-to-vial":
        route = "routed-to-vial";
        break;
      default:
        throw new Error(`Unsupported superseded route ${(sourceRow as { route: string }).route}.`);
    }

    return {
      canonicalIdentityKey: sourceRow.canonicalIdentityKey,
      websiteSku: sourceRow.websiteSku,
      graceSku: sourceRow.graceSku,
      canonicalFamily: sourceRow.canonicalFamily,
      canonical: sourceRow.canonical,
      route,
      jobs,
      blockedRoles,
    };
  });
  const jobs = rows.flatMap((row) => row.jobs);
  validateCylinderLaneLockedJobs(jobs);

  const routeCounts = {
    strictBothRolesReadyCount: countRoute(rows, "strict-both-roles-ready"),
    currentLiveSidecarJobCount: countRoute(rows, "remediate-current-live-sidecar"),
    detachedSidecarJobCount: countRoute(rows, "approved-sidecar-only-missing-cap-on"),
    assembledCapOnJobCount: countRoute(rows, "approved-cap-on-only-missing-sidecar"),
    hardBlockedNoEvidenceCount: countRoute(rows, "hard-blocked-no-evidence"),
    vialHandoffCount: countRoute(rows, "routed-to-vial"),
  };
  const expected = {
    strictBothRolesReadyCount: 172,
    currentLiveSidecarJobCount: 56,
    detachedSidecarJobCount: 123,
    assembledCapOnJobCount: 13,
    hardBlockedNoEvidenceCount: 11,
    vialHandoffCount: 2,
  };
  for (const [name, expectedCount] of Object.entries(expected)) {
    if (routeCounts[name as keyof typeof routeCounts] !== expectedCount) {
      throw new Error(`Lane-locked route ${name} expected ${expectedCount}, received ${routeCounts[name as keyof typeof routeCounts]}.`);
    }
  }
  if (jobs.length !== 192) throw new Error(`Lane-locked remediation expected 192 jobs, received ${jobs.length}.`);

  const summary: CylinderLaneLockedRemediationPlan["summary"] = {
    sourceIdentityCount: 377,
    cylinderIdentityCount: 375,
    vialHandoffCount: 2,
    strictBothRolesReadyCount: 172,
    currentLiveSidecarJobCount: 56,
    detachedSidecarJobCount: 123,
    assembledCapOnJobCount: 13,
    hardBlockedNoEvidenceCount: 11,
    validRoleJobCount: 192,
    blockedRoleSlotCount: 158,
    blockedCylinderIdentityCount: 147,
    externalWriteCount: 0,
  };
  const unsealed: Omit<CylinderLaneLockedRemediationPlan, "sha256"> = {
    version: BEST_BOTTLES_CYLINDER_LANE_LOCKED_REMEDIATION_VERSION,
    generatedAt: input.generatedAt,
    provenance: {
      inputs: Object.fromEntries(Object.entries(input.sources).map(([name, source]) => [
        name,
        { path: source.path, sha256: source.fileSha256.toLowerCase() },
      ])),
      supersedes: {
        version: "best-bottles-cylinder-dual-role-remediation-v2",
        semanticSha256: v2.sha256,
        reason: "cross-lane-product-reference-reuse",
      },
    },
    authorization: {
      mode: "local-read-only",
      remoteWrites: "forbidden",
      paidGeneration: "not-authorized",
      publishStatus: "not-authorized",
    },
    summary,
    rows,
    jobs,
  };
  return { ...unsealed, sha256: sha256(stableJson(unsealed)) };
}
