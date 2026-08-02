import { createHash } from "node:crypto";

import type {
  CylinderDualRoleCompiledJob,
  CylinderDualRoleCompileResult,
} from "./bestBottlesCylinderDualRoleRunner";
import type {
  CylinderDualRoleRemediationPlan,
  CylinderDualRoleRemediationRow,
} from "./bestBottlesCylinderDualRoleRemediation";
import type { FramingDecision, FramingQaReport } from "./product-image/framingQa";
import type { RigStrongBounds } from "./product-image/rigPostprocess";
import type { ShadowQaReport } from "./product-image/shadowQa";
import type { DetachedSidecarLaneFloorQa } from "./product-image/detachedSidecarLaneQa";

export const BEST_BOTTLES_CYLINDER_FRAMING_RECOVERY_VERSION =
  "best-bottles-cylinder-framing-recovery-v3" as const;
export const BEST_BOTTLES_CYLINDER_FRAMING_RECOVERY_LIMIT = 8;
export const BEST_BOTTLES_CYLINDER_FRAMING_RECOVERY_MAX_PASSES = 2;

export function isAllowedCylinderFramingRecoveryResourceUrl(value: string): boolean {
  if (/^(?:data|blob):/i.test(value)) return true;
  try {
    const url = new URL(value);
    return url.protocol === "http:"
      && url.hostname === "127.0.0.1"
      && url.port === "8080";
  } catch {
    return false;
  }
}

type RecoveryMode = "plan-only" | "execute-local-only";

export interface CylinderFramingRecoveryOptions {
  mode: RecoveryMode;
  runDirectory: string;
  allowlist: string[];
  count: number;
}

interface StoredFailedFramingResult extends CylinderDualRoleCompiledJob {
  status: string;
  reviewStatus: string;
  outputSha256?: string;
  outputDimensions?: { width: number; height: number };
  opaque?: boolean;
  framingQa?: FramingQaReport;
  error?: string;
}

interface CompileArtifactWithPlanFileSha extends CylinderDualRoleCompileResult {
  planFileSha256: string;
}

export interface CylinderFramingRecoveryPlannerInput {
  mode: RecoveryMode;
  runDirectory: string;
  allowlist: string[];
  count: number;
  actualPlanFileSha256: string;
  actualCanonicalTruthFileSha256: string;
  compileArtifact: CompileArtifactWithPlanFileSha;
  resultArtifact: {
    planFileSha256: string;
    planSha256: string;
    canonicalProductTruthFileSha256: string;
    results: StoredFailedFramingResult[];
  };
  sealedPlan: CylinderDualRoleRemediationPlan;
  rawOutputSha256ByRelativePath: Record<string, string>;
}

export interface CylinderFramingRecoveryNormalizerInput {
  family: string;
  bottleCollection: string;
  graceSku: string;
  websiteSku: string;
  capacityMl: number;
  heightWithCap: string;
  heightWithoutCap: string;
  diameter: string;
  capState: "assembled" | "detached";
  mode: "assembled" | "detached-sidecar";
  targetBackgroundHex: "#F5F3EF";
  maskReferenceUrl: null;
  requireMaskControl: false;
  preserveGeneratedScale: false;
}

export interface CylinderFramingRecoveryJob {
  workflowVersion: typeof BEST_BOTTLES_CYLINDER_FRAMING_RECOVERY_VERSION;
  jobId: string;
  canonicalIdentityKey: string;
  websiteSku: string;
  graceSku: string;
  role: "identity-cap-on" | "pdp-cap-off-sidecar";
  topology: "assembled" | "detached";
  planSha256: string;
  planFileSha256: string;
  canonicalProductTruthFileSha256: string;
  canonicalProductTruthRecordSha256: string;
  canonicalGeometrySha256: string;
  sourceSha256: string | null;
  referenceSha256: string;
  promptSha256: string | null;
  rawOutputRelativePath: string;
  rawOutputSha256: string;
  rawOutputPreservation: "immutable";
  passOutputRelativePaths: [string, string];
  recordRelativePath: string;
  normalizer: CylinderFramingRecoveryNormalizerInput;
  sidecarQaPolicy: "primary-bottle-centerline-shared-group-baseline-no-cap-box" | null;
  reviewStatus: "framing-rejected";
}

export interface CylinderFramingRecoveryPlan {
  workflowVersion: typeof BEST_BOTTLES_CYLINDER_FRAMING_RECOVERY_VERSION;
  mode: RecoveryMode;
  runDirectory: string;
  planSha256: string;
  maxPasses: 2;
  jobs: CylinderFramingRecoveryJob[];
  externalWriteCount: 0;
  generationCallCount: 0;
  uploadCount: 0;
  promotionCount: 0;
}

export interface CylinderFramingRecoveryNormalizationSummary {
  scale: number;
  shiftXPx: number;
  shiftYPx: number;
  detectedBaselineYPx: number | null;
  targetBaselineYPx: number | null;
  framingQa: FramingQaReport | null;
  framingDecision: FramingDecision | null;
  qaIssues: string[];
  objectBounds: RigStrongBounds | null;
  detachedSidecarLaneFloorQa?: DetachedSidecarLaneFloorQa | null;
  shadowOwner: "model" | "rig";
  shadowQa: ShadowQaReport | null;
}

export interface CylinderFramingRecoveryDetachedGroupBaselineQa {
  policy: "complete-group-shared-baseline-primary-centerline-no-cap-box";
  status: "pass" | "fail";
  completeGroupBounds: RigStrongBounds | null;
  completeGroupBaselineYPx: number | null;
  detectedSharedBaselineYPx: number | null;
  targetBaselineYPx: number | null;
  completeGroupBaselineDeltaPx: number | null;
  detectedSharedBaselineDeltaPx: number | null;
  primaryCenterXPct: number | null;
  primaryCenterDeltaPct: number | null;
  baselineTolerancePx: 8;
  capBoundingBoxUsed: false;
  capCenterlineRequired: false;
  sidecarLaneFloorQa: DetachedSidecarLaneFloorQa | null;
  failures: string[];
}

export interface CylinderFramingRecoveryPassInput {
  job: CylinderFramingRecoveryJob;
  passNumber: 1 | 2;
  inputSha256: string;
  outputSha256: string;
  width: number;
  height: number;
  opaque: boolean;
  normalization: CylinderFramingRecoveryNormalizationSummary;
}

export interface CylinderFramingRecoveryPassResult extends CylinderFramingRecoveryPassInput {
  workflowVersion: typeof BEST_BOTTLES_CYLINDER_FRAMING_RECOVERY_VERSION;
  outputRelativePath: string;
  status: "normalized-review-pending" | "normalized-shadow-review-required" | "normalized-rejected";
  reviewStatus: "review-pending" | "shadow-review-required" | "framing-rejected";
  promotionStatus: "not-promoted";
  externalWriteCount: 0;
  failures: string[];
  shadowFailures: string[];
  detachedGroupBaselineQa: CylinderFramingRecoveryDetachedGroupBaselineQa | null;
}

function assertSha256(value: unknown, label: string): asserts value is string {
  if (!/^[a-f0-9]{64}$/i.test(String(value ?? ""))) {
    throw new Error(`${label} must be a SHA-256 hash.`);
  }
}

function readFlagValues(argv: string[], flag: string): string[] {
  const values: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] !== flag) continue;
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value.`);
    values.push(...value.split(",").map((part) => part.trim()).filter(Boolean));
  }
  return Array.from(new Set(values));
}

export function parseCylinderFramingRecoveryArgs(argv: string[]): CylinderFramingRecoveryOptions {
  const valueFlags = new Set(["--run-dir", "--allowlist", "--count"]);
  const booleanFlags = new Set(["--execute"]);
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    if (!valueFlags.has(token) && !booleanFlags.has(token)) {
      throw new Error(`Unknown argument ${token}.`);
    }
    if (valueFlags.has(token)) index += 1;
  }
  const runDirectories = readFlagValues(argv, "--run-dir");
  const allowlist = readFlagValues(argv, "--allowlist");
  const counts = readFlagValues(argv, "--count");
  if (runDirectories.length !== 1) throw new Error("Exactly one --run-dir is required.");
  if (allowlist.length === 0) throw new Error("An explicit --allowlist is required.");
  if (counts.length !== 1) throw new Error("A bounded --count is required.");
  const count = Number(counts[0]);
  if (!Number.isInteger(count) || count <= 0) throw new Error("--count must be a positive integer.");
  if (count > BEST_BOTTLES_CYLINDER_FRAMING_RECOVERY_LIMIT) {
    throw new Error(`--count is capped at ${BEST_BOTTLES_CYLINDER_FRAMING_RECOVERY_LIMIT}.`);
  }
  if (allowlist.length > count) {
    throw new Error("The explicit allowlist cannot exceed the bounded --count.");
  }
  return {
    mode: argv.includes("--execute") ? "execute-local-only" : "plan-only",
    runDirectory: runDirectories[0],
    allowlist,
    count,
  };
}

const CONTINUITY_FIELDS = [
  "workflowVersion",
  "jobId",
  "jobType",
  "canonicalIdentityKey",
  "websiteSku",
  "graceSku",
  "role",
  "route",
  "evidenceLane",
  "sourceLocator",
  "planSha256",
  "sourceSha256",
  "referenceSha256",
  "canonicalProductTruthFileSha256",
  "canonicalProductTruthRecordSha256",
  "promptSha256",
  "deterministicOperationSha256",
  "canonicalGeometrySha256",
  "outputRelativePath",
] as const;

function findPlanRow(
  plan: CylinderDualRoleRemediationPlan,
  compiled: CylinderDualRoleCompiledJob,
): CylinderDualRoleRemediationRow {
  const row = plan.rows.find((candidate) => candidate.canonicalIdentityKey === compiled.canonicalIdentityKey);
  if (!row || row.websiteSku !== compiled.websiteSku || row.graceSku !== compiled.graceSku) {
    throw new Error(`Missing exact sealed plan identity ${compiled.canonicalIdentityKey}.`);
  }
  return row;
}

function assertExactSealedRoleJob(
  row: CylinderDualRoleRemediationRow,
  compiled: CylinderDualRoleCompiledJob,
): void {
  const sealed = row.roleJobs.find((candidate) => candidate.jobId === compiled.jobId);
  if (!sealed) {
    throw new Error(`${compiled.jobId} is absent from the exact sealed role job list.`);
  }
  const comparisons = [
    ["jobType", sealed.jobType, compiled.jobType],
    ["targetRole", sealed.targetRole, compiled.role],
    ["sourceEvidenceLane", sealed.sourceEvidenceLane, compiled.evidenceLane],
  ] as const;
  for (const [field, expected, actual] of comparisons) {
    if (expected !== actual) {
      throw new Error(
        `${compiled.jobId} sealed role job ${field} mismatch: sealed=${expected}, compiled=${actual}.`,
      );
    }
  }
}

function safePathSegment(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]+/g, "_");
}

function canonicalGeometryHash(row: CylinderDualRoleRemediationRow): string {
  const canonical = row.canonical;
  const stable = JSON.stringify({
    canon_bodyHeightMm: canonical.canon_bodyHeightMm,
    canon_heightWithCapMm: canonical.canon_heightWithCapMm,
    canon_secondAxisMm: canonical.canon_secondAxisMm,
    canon_widthAxisMm: canonical.canon_widthAxisMm,
  });
  return createHash("sha256").update(stable).digest("hex");
}

function assertRunSeals(input: CylinderFramingRecoveryPlannerInput): void {
  const { compileArtifact, resultArtifact, sealedPlan } = input;
  for (const [label, value] of [
    ["actual plan file SHA", input.actualPlanFileSha256],
    ["actual canonical truth file SHA", input.actualCanonicalTruthFileSha256],
    ["compile plan SHA", compileArtifact.planSha256],
    ["result plan SHA", resultArtifact.planSha256],
    ["sealed plan SHA", sealedPlan.sha256],
  ] as const) assertSha256(value, label);
  if (
    compileArtifact.planSha256 !== resultArtifact.planSha256
    || compileArtifact.planSha256 !== sealedPlan.sha256
  ) throw new Error("Task 2 plan SHA continuity failed.");
  if (
    compileArtifact.planFileSha256 !== input.actualPlanFileSha256
    || resultArtifact.planFileSha256 !== input.actualPlanFileSha256
  ) throw new Error("Task 2 plan file SHA continuity failed.");
  if (
    compileArtifact.canonicalProductTruthFileSha256 !== input.actualCanonicalTruthFileSha256
    || resultArtifact.canonicalProductTruthFileSha256 !== input.actualCanonicalTruthFileSha256
  ) throw new Error("Canonical product truth file SHA continuity failed.");
  if (compileArtifact.externalWriteCount !== 0) {
    throw new Error("The sealed compile artifact does not preserve zero external writes.");
  }
  const planDirectorySegment = input.runDirectory.replaceAll("\\", "/").split("/runs/")[1]?.split("/")[0];
  if (planDirectorySegment !== compileArtifact.planSha256) {
    throw new Error("Run directory is not nested under its sealed plan SHA.");
  }
}

export function buildCylinderFramingRecoveryPlan(
  input: CylinderFramingRecoveryPlannerInput,
): CylinderFramingRecoveryPlan {
  if (!Number.isInteger(input.count) || input.count <= 0 || input.count > 8) {
    throw new Error("Recovery count must be a positive bounded count capped at 8.");
  }
  if (input.allowlist.length === 0) throw new Error("Recovery requires an explicit allowlist.");
  if (input.allowlist.length > input.count) {
    throw new Error("The explicit allowlist cannot exceed the bounded count.");
  }
  assertRunSeals(input);
  const compiledByJob = new Map(input.compileArtifact.jobs.map((job) => [job.jobId, job]));
  const priorByJob = new Map(input.resultArtifact.results.map((result) => [result.jobId, result]));
  const selectedJobIds = new Set<string>();
  for (const allow of input.allowlist) {
    const matches = input.compileArtifact.jobs.filter((job) => (
      job.jobId === allow || job.canonicalIdentityKey === allow
    ));
    if (matches.length === 0) throw new Error(`Allowlist entry did not match sealed Task 2 job: ${allow}.`);
    for (const match of matches) selectedJobIds.add(match.jobId);
  }
  if (selectedJobIds.size > input.count) {
    throw new Error("Selected jobs exceed the bounded count.");
  }
  const jobs = Array.from(selectedJobIds).sort().map((jobId): CylinderFramingRecoveryJob => {
    const compiled = compiledByJob.get(jobId)!;
    const prior = priorByJob.get(jobId);
    if (!prior) throw new Error(`Missing stored Task 2 result for ${jobId}.`);
    if (prior.status !== "failed-framing") {
      throw new Error(`${jobId} is not eligible: stored result must be failed-framing.`);
    }
    for (const field of CONTINUITY_FIELDS) {
      if (compiled[field] !== prior[field]) {
        throw new Error(`${jobId} stale resume metadata: ${field} does not match sealed compile record.`);
      }
    }
    assertSha256(prior.outputSha256, `${jobId} stored output SHA`);
    const rawSha = input.rawOutputSha256ByRelativePath[compiled.outputRelativePath];
    assertSha256(rawSha, `${jobId} on-disk raw output SHA`);
    if (rawSha !== prior.outputSha256) {
      throw new Error(`${jobId} raw output SHA does not match the stored failed-framing output SHA.`);
    }
    const row = findPlanRow(input.sealedPlan, compiled);
    assertExactSealedRoleJob(row, compiled);
    if (canonicalGeometryHash(row) !== compiled.canonicalGeometrySha256) {
      throw new Error(`${jobId} canonical geometry SHA does not match the sealed plan row.`);
    }
    const detached = compiled.role === "pdp-cap-off-sidecar";
    const slug = safePathSegment(`${compiled.websiteSku}__${compiled.graceSku}__${compiled.role}`);
    const base = `normalized/framing-recovery-v3/${slug}`;
    return {
      workflowVersion: BEST_BOTTLES_CYLINDER_FRAMING_RECOVERY_VERSION,
      jobId: compiled.jobId,
      canonicalIdentityKey: compiled.canonicalIdentityKey,
      websiteSku: compiled.websiteSku,
      graceSku: compiled.graceSku,
      role: compiled.role,
      topology: detached ? "detached" : "assembled",
      planSha256: compiled.planSha256,
      planFileSha256: input.actualPlanFileSha256,
      canonicalProductTruthFileSha256: compiled.canonicalProductTruthFileSha256,
      canonicalProductTruthRecordSha256: compiled.canonicalProductTruthRecordSha256,
      canonicalGeometrySha256: compiled.canonicalGeometrySha256,
      sourceSha256: compiled.sourceSha256,
      referenceSha256: compiled.referenceSha256,
      promptSha256: compiled.promptSha256,
      rawOutputRelativePath: compiled.outputRelativePath,
      rawOutputSha256: prior.outputSha256,
      rawOutputPreservation: "immutable",
      passOutputRelativePaths: [`${base}/pass-01.png`, `${base}/pass-02.png`],
      recordRelativePath: `${base}/recovery-record.json`,
      normalizer: {
        family: row.canonical.family,
        bottleCollection: row.canonical.family,
        graceSku: row.graceSku,
        websiteSku: row.websiteSku,
        capacityMl: Number(row.canonical.capacityMl),
        heightWithCap: row.canonical.canon_heightWithCapMm,
        heightWithoutCap: row.canonical.canon_bodyHeightMm,
        diameter: row.canonical.canon_widthAxisMm,
        capState: detached ? "detached" : "assembled",
        mode: detached ? "detached-sidecar" : "assembled",
        targetBackgroundHex: "#F5F3EF",
        maskReferenceUrl: null,
        requireMaskControl: false,
        preserveGeneratedScale: false,
      },
      sidecarQaPolicy: detached
        ? "primary-bottle-centerline-shared-group-baseline-no-cap-box"
        : null,
      reviewStatus: "framing-rejected",
    };
  });
  return {
    workflowVersion: BEST_BOTTLES_CYLINDER_FRAMING_RECOVERY_VERSION,
    mode: input.mode,
    runDirectory: input.runDirectory,
    planSha256: input.compileArtifact.planSha256,
    maxPasses: 2,
    jobs,
    externalWriteCount: 0,
    generationCallCount: 0,
    uploadCount: 0,
    promotionCount: 0,
  };
}

export function validateCylinderFramingRecoveryPass(
  input: CylinderFramingRecoveryPassInput,
): CylinderFramingRecoveryPassResult {
  if (input.passNumber !== 1 && input.passNumber !== 2) {
    throw new Error("Framing recovery pass number must be 1 or 2.");
  }
  assertSha256(input.inputSha256, "Framing recovery pass input SHA");
  assertSha256(input.outputSha256, "Framing recovery pass output SHA");
  const failures: string[] = [];
  if (input.width !== 2080 || input.height !== 2288) failures.push("Output must be 2080 × 2288.");
  if (!input.opaque) failures.push("Output must be fully opaque.");
  if (input.normalization.framingQa?.status !== "pass") failures.push("Framing QA must pass.");
  if (input.normalization.framingDecision !== "pass") failures.push("Framing decision must pass.");
  if (input.normalization.qaIssues.length > 0) failures.push(...input.normalization.qaIssues);
  let detachedGroupBaselineQa: CylinderFramingRecoveryDetachedGroupBaselineQa | null = null;
  if (input.job.topology === "detached") {
    const groupFailures: string[] = [];
    const bounds = input.normalization.objectBounds;
    const targetBaseline = input.normalization.targetBaselineYPx;
    const detectedBaseline = input.normalization.detectedBaselineYPx;
    const completeGroupBaseline = bounds?.bottom ?? null;
    const completeGroupDelta = completeGroupBaseline != null && targetBaseline != null
      ? completeGroupBaseline - targetBaseline
      : null;
    const detectedDelta = detectedBaseline != null && targetBaseline != null
      ? detectedBaseline - targetBaseline
      : null;
    if (
      !bounds
      || !Number.isFinite(bounds.top)
      || !Number.isFinite(bounds.bottom)
      || !Number.isFinite(bounds.left)
      || !Number.isFinite(bounds.right)
    ) {
      groupFailures.push("Detached complete group bounds are required for shared-baseline QA.");
    } else {
      if (
        bounds.top < 0
        || bounds.bottom > input.height - 1
        || (bounds.left ?? -1) < 0
        || (bounds.right ?? input.width) > input.width - 1
      ) groupFailures.push("Detached complete group bounds must remain inside the canvas.");
      if (completeGroupDelta == null || Math.abs(completeGroupDelta) > 8) {
        groupFailures.push("Detached complete group shared baseline must be within 8px of the family-rig target.");
      }
    }
    if (detectedDelta == null || Math.abs(detectedDelta) > 8) {
      groupFailures.push("Detached detected shared baseline must be within 8px of the family-rig target.");
    }
    const primaryCenter = input.normalization.framingQa?.measurements.centerXPct ?? null;
    const primaryCenterDelta = input.normalization.framingQa?.measurements.centerDeltaPct ?? null;
    if (primaryCenter == null || primaryCenterDelta == null || Math.abs(primaryCenterDelta) > 3) {
      groupFailures.push("Detached primary bottle centerline must remain within 3% of the family-rig target.");
    }
    const sidecarLaneFloorQa = input.normalization.detachedSidecarLaneFloorQa ?? null;
    if (!sidecarLaneFloorQa) {
      groupFailures.push("Detached sidecar-lane floor evidence is required and cannot be waived by shadow review.");
    } else {
      if (sidecarLaneFloorQa.policy !== "distinct-right-sidecar-lane-shared-floor-no-cap-box") {
        groupFailures.push("Detached sidecar-lane floor evidence policy is invalid.");
      }
      if (!sidecarLaneFloorQa.sidecarPresent) {
        groupFailures.push("Detached output requires distinct sidecar foreground presence in the right sidecar lane.");
      }
      if (
        sidecarLaneFloorQa.sidecarLaneStartXPx == null
        || sidecarLaneFloorQa.sidecarLaneEndXPx == null
        || sidecarLaneFloorQa.sidecarLaneEndXPx < sidecarLaneFloorQa.sidecarLaneStartXPx
      ) {
        groupFailures.push("Detached output must establish a distinct right sidecar lane.");
      }
      if (sidecarLaneFloorQa.sidecarLowestContactRowYPx == null) {
        groupFailures.push("Detached sidecar lowest contact row is required.");
      }
      if (
        sidecarLaneFloorQa.sidecarPrimaryBaselineDeltaPx == null
        || Math.abs(sidecarLaneFloorQa.sidecarPrimaryBaselineDeltaPx) > 8
      ) {
        groupFailures.push("Detached sidecar lowest contact row must be within shared floor tolerance of the primary bottle.");
      }
      if (
        sidecarLaneFloorQa.sidecarGroupBaselineDeltaPx == null
        || Math.abs(sidecarLaneFloorQa.sidecarGroupBaselineDeltaPx) > 8
      ) {
        groupFailures.push("Detached sidecar lowest contact row must be within shared floor tolerance of the complete group.");
      }
      if (sidecarLaneFloorQa.capBoundingBoxUsed || sidecarLaneFloorQa.capCenterlineRequired) {
        groupFailures.push("Detached sidecar QA must not use a cap bounding box or cap centerline.");
      }
      groupFailures.push(...sidecarLaneFloorQa.failures);
      if (sidecarLaneFloorQa.status !== "pass" && sidecarLaneFloorQa.failures.length === 0) {
        groupFailures.push("Detached sidecar-lane floor evidence must pass.");
      }
    }
    detachedGroupBaselineQa = {
      policy: "complete-group-shared-baseline-primary-centerline-no-cap-box",
      status: groupFailures.length === 0 ? "pass" : "fail",
      completeGroupBounds: bounds,
      completeGroupBaselineYPx: completeGroupBaseline,
      detectedSharedBaselineYPx: detectedBaseline,
      targetBaselineYPx: targetBaseline,
      completeGroupBaselineDeltaPx: completeGroupDelta,
      detectedSharedBaselineDeltaPx: detectedDelta,
      primaryCenterXPct: primaryCenter,
      primaryCenterDeltaPct: primaryCenterDelta,
      baselineTolerancePx: 8,
      capBoundingBoxUsed: false,
      capCenterlineRequired: false,
      sidecarLaneFloorQa,
      failures: groupFailures,
    };
    failures.push(...groupFailures);
  }
  const framingAccepted = failures.length === 0;
  const shadowFailures = input.normalization.shadowQa?.status === "fail"
    ? [...input.normalization.shadowQa.failures]
    : [];
  if (framingAccepted && input.normalization.shadowOwner === "model" && !input.normalization.shadowQa) {
    failures.push("Model-owned shadow QA report is required.");
  }
  const accepted = failures.length === 0 && shadowFailures.length === 0;
  const shadowReviewRequired = framingAccepted && failures.length === 0 && shadowFailures.length > 0;
  return {
    ...input,
    workflowVersion: BEST_BOTTLES_CYLINDER_FRAMING_RECOVERY_VERSION,
    outputRelativePath: input.job.passOutputRelativePaths[input.passNumber - 1],
    status: accepted
      ? "normalized-review-pending"
      : shadowReviewRequired
        ? "normalized-shadow-review-required"
        : "normalized-rejected",
    reviewStatus: accepted
      ? "review-pending"
      : shadowReviewRequired
        ? "shadow-review-required"
        : "framing-rejected",
    promotionStatus: "not-promoted",
    externalWriteCount: 0,
    failures,
    shadowFailures,
    detachedGroupBaselineQa,
  };
}
