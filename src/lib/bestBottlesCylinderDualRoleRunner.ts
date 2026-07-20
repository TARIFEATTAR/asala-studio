import { createHash } from "node:crypto";

import { buildBestBottlesPromptPreflight } from "./bestBottlesPromptPreflight";
import type { PromptSystem } from "./bestBottlesPromptCompiler";
import type {
  CylinderDualRoleJob,
  CylinderDualRoleJobType,
  CylinderDualRoleRemediationPlan,
  CylinderDualRoleRemediationRow,
  CylinderDualRoleRoute,
} from "./bestBottlesCylinderDualRoleRemediation";
import type { CylinderProductionCanonicalIdentity } from "./bestBottlesCylinderProductionCutover";
import type { FramingQaReport } from "./product-image/framingQa";

export const BEST_BOTTLES_CYLINDER_DUAL_ROLE_RUNNER_VERSION =
  "best-bottles-cylinder-dual-role-runner-v1" as const;

export const BEST_BOTTLES_CYLINDER_DUAL_ROLE_EXECUTE_LIMIT = 8;

export type CylinderDualRoleRunnerMode = "compile-only" | "execute-local-only";

export interface CylinderDualRoleRunnerOptions {
  mode: CylinderDualRoleRunnerMode;
  all: boolean;
  routes: CylinderDualRoleRoute[];
  cohorts: string[];
  allowlist: string[];
  count: number | null;
}

export interface CylinderDualRoleCompiledJob {
  workflowVersion: typeof BEST_BOTTLES_CYLINDER_DUAL_ROLE_RUNNER_VERSION;
  jobId: string;
  jobType: CylinderDualRoleJobType;
  canonicalIdentityKey: string;
  websiteSku: string;
  graceSku: string;
  role: "identity-cap-on" | "pdp-cap-off-sidecar";
  route: CylinderDualRoleRoute;
  evidenceLane: string;
  sourceLocator: string;
  planSha256: string;
  sourceSha256: string | null;
  referenceSha256: string;
  canonicalProductTruthFileSha256: string;
  canonicalProductTruthRecordSha256: string;
  prompt: string | null;
  promptSha256: string | null;
  deterministicOperation: CylinderDualRoleDeterministicOperation | null;
  deterministicOperationSha256: string | null;
  canonicalGeometrySha256: string;
  outputRelativePath: string;
  status: "compiled-dry-run" | "queued-local-execution";
  reviewStatus: "review-pending";
  warnings: string[];
}

export interface CylinderDualRoleDeterministicOperation {
  version: "best-bottles-exact-reference-copy-v1";
  action: "copy-source-bytes-without-pixel-mutation";
  requiredFormat: "png";
  requiredWidth: 2080;
  requiredHeight: 2288;
  requiredOpaque: true;
  topologyDisposition: "identity-cap-on" | "approved-assembled-live-site-exception";
}

export interface CylinderDualRoleCompileResult {
  workflowVersion: typeof BEST_BOTTLES_CYLINDER_DUAL_ROLE_RUNNER_VERSION;
  mode: CylinderDualRoleRunnerMode;
  planSha256: string;
  canonicalProductTruthFileSha256: string;
  selectedJobCount: number;
  jobs: CylinderDualRoleCompiledJob[];
  externalWriteCount: 0;
}

export interface CylinderDualRoleOutputValidation {
  disposition: "rendered" | "existing";
  outputSha256: string;
  width: number;
  height: number;
  opaque: boolean;
  framingQa: FramingQaReport;
}

export interface CylinderDualRoleSuccessfulResult extends CylinderDualRoleCompiledJob {
  status: "rendered-review-pending" | "skipped-existing-review-pending";
  outputSha256: string;
  outputDimensions: { width: 2080; height: 2288 };
  opaque: true;
  framingQa: FramingQaReport;
}

const ROUTES = new Set<CylinderDualRoleRoute>([
  "strict-both-roles-ready",
  "remediate-current-live-sidecar",
  "approved-detached-dual-role",
  "approved-topology-exception",
  "hard-blocked-no-evidence",
  "routed-to-vial",
]);

const COHORTS = new Set([
  "verified-role-pair",
  "current-live-sidecar",
  "approved-recovery",
  "approved-live-pointer",
  "none",
]);

export interface CylinderDualRoleCanonicalProductTruthRow extends Record<string, string> {
  graceSku: string;
  websiteSku: string;
  productGroupSlug: string;
  family: string;
  category: string;
  bottleCollection: string;
  color: string;
  capacityMl: string;
  material: string;
  glassFinish: string;
  canon_bodyHeightMm: string;
  canon_widthAxisMm: string;
  canon_secondAxisMm: string;
  canon_heightWithCapMm: string;
  applicator: string;
  capStyle: string;
  capColor: string;
  trimColor: string;
  itemName: string;
}

export interface CylinderDualRoleCanonicalProductTruthInput {
  fileSha256: string;
  rows: CylinderDualRoleCanonicalProductTruthRow[];
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function assertSha256(value: string | null | undefined, label: string): asserts value is string {
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

function normalizedIdentity(value: string | null | undefined): string {
  return String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function exactIdentityKey(websiteSku: string, graceSku: string): string {
  return `${normalizedIdentity(websiteSku)}|${normalizedIdentity(graceSku)}`;
}

function readValues(argv: string[], name: string): string[] {
  const values: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] !== name) continue;
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${name} requires a value.`);
    values.push(...value.split(",").map((part) => part.trim()).filter(Boolean));
  }
  return Array.from(new Set(values));
}

export function parseCylinderDualRoleRunnerArgs(argv: string[]): CylinderDualRoleRunnerOptions {
  const valueFlags = new Set(["--route", "--cohort", "--allowlist", "--count"]);
  const booleanFlags = new Set(["--execute", "--all"]);
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith("--")) continue;
    if (!valueFlags.has(argument) && !booleanFlags.has(argument)) {
      throw new Error(`Unknown argument ${argument}.`);
    }
    if (valueFlags.has(argument)) index += 1;
  }

  const execute = argv.includes("--execute");
  const all = argv.includes("--all");
  const routes = readValues(argv, "--route") as CylinderDualRoleRoute[];
  const cohorts = readValues(argv, "--cohort");
  const allowlist = readValues(argv, "--allowlist");
  const countValues = readValues(argv, "--count");
  if (countValues.length > 1) throw new Error("--count may be supplied only once.");
  const count = countValues.length === 0 ? null : Number(countValues[0]);

  for (const route of routes) {
    if (!ROUTES.has(route)) throw new Error(`Unknown Cylinder dual-role route ${route}.`);
  }
  for (const cohort of cohorts) {
    if (!COHORTS.has(cohort)) throw new Error(`Unknown Cylinder dual-role cohort ${cohort}.`);
  }
  if (count !== null && (!Number.isInteger(count) || count <= 0)) {
    throw new Error("--count must be a positive integer.");
  }
  if (all && (routes.length > 0 || cohorts.length > 0 || allowlist.length > 0 || count !== null)) {
    if (!(execute && count !== null && routes.length === 0 && cohorts.length === 0 && allowlist.length === 0)) {
      throw new Error("--all cannot be combined with --route, --cohort, --allowlist, or --count.");
    }
  }
  if (execute && all) throw new Error("--execute --all is forbidden.");
  if (execute && count === null) throw new Error("A bounded --count is required with --execute.");
  if (execute && count! > BEST_BOTTLES_CYLINDER_DUAL_ROLE_EXECUTE_LIMIT) {
    throw new Error(`--execute --count is capped at ${BEST_BOTTLES_CYLINDER_DUAL_ROLE_EXECUTE_LIMIT}.`);
  }
  if (execute && routes.length === 0 && cohorts.length === 0 && allowlist.length === 0) {
    throw new Error("--execute requires an explicit route, cohort, or allowlist.");
  }

  return {
    mode: execute ? "execute-local-only" : "compile-only",
    all,
    routes,
    cohorts,
    allowlist,
    count,
  };
}

export function computeCylinderDualRolePlanSha256(plan: CylinderDualRoleRemediationPlan): string {
  const { sha256: _seal, ...unsealed } = plan;
  return sha256(stableJson(unsealed));
}

export function computeCanonicalGeometrySha256(
  canonical: CylinderProductionCanonicalIdentity,
): string {
  const geometry = {
    canon_bodyHeightMm: canonical.canon_bodyHeightMm,
    canon_heightWithCapMm: canonical.canon_heightWithCapMm,
    canon_secondAxisMm: canonical.canon_secondAxisMm,
    canon_widthAxisMm: canonical.canon_widthAxisMm,
  };
  for (const [field, value] of Object.entries(geometry)) {
    if (String(value ?? "").trim() === "" || !Number.isFinite(Number(value)) || Number(value) <= 0) {
      throw new Error(`Canonical geometry field ${field} must be a positive canonical value.`);
    }
  }
  return sha256(stableJson(geometry));
}

export function computeCanonicalProductTruthRecordSha256(
  row: CylinderDualRoleCanonicalProductTruthRow,
): string {
  return sha256(stableJson(row));
}

function indexCanonicalProductTruth(
  input: CylinderDualRoleCanonicalProductTruthInput,
): Map<string, CylinderDualRoleCanonicalProductTruthRow> {
  assertSha256(input.fileSha256, "Canonical product-truth file SHA");
  const index = new Map<string, CylinderDualRoleCanonicalProductTruthRow>();
  for (const row of input.rows) {
    if (!normalizedIdentity(row.websiteSku) || !normalizedIdentity(row.graceSku)) {
      continue;
    }
    const key = exactIdentityKey(row.websiteSku, row.graceSku);
    if (index.has(key)) throw new Error(`Duplicate canonical product truth for ${key}.`);
    index.set(key, row);
  }
  return index;
}

function resolveCanonicalProductTruth(
  row: CylinderDualRoleRemediationRow,
  rows: CylinderDualRoleCanonicalProductTruthRow[],
  index: ReadonlyMap<string, CylinderDualRoleCanonicalProductTruthRow>,
): CylinderDualRoleCanonicalProductTruthRow {
  const exact = index.get(row.canonicalIdentityKey);
  if (!exact) {
    const website = normalizedIdentity(row.websiteSku);
    const grace = normalizedIdentity(row.graceSku);
    const nearIdentity = rows.some((candidate) => (
      normalizedIdentity(candidate.websiteSku) === website
      || normalizedIdentity(candidate.graceSku) === grace
    ));
    if (nearIdentity) {
      throw new Error(`Wrong-identity canonical product truth for ${row.canonicalIdentityKey}.`);
    }
    throw new Error(`Missing canonical product truth for ${row.canonicalIdentityKey}.`);
  }
  if (exact.websiteSku !== row.websiteSku || exact.graceSku !== row.graceSku) {
    throw new Error(`Wrong-identity canonical product truth for ${row.canonicalIdentityKey}.`);
  }
  const geometryFields = [
    "canon_bodyHeightMm",
    "canon_widthAxisMm",
    "canon_secondAxisMm",
    "canon_heightWithCapMm",
  ] as const;
  for (const field of geometryFields) {
    if (exact[field].trim() !== String(row.canonical[field]).trim()) {
      throw new Error(
        `Canonical product-truth geometry mismatch for ${row.canonicalIdentityKey} ${field}: Task 1=${row.canonical[field]}, product truth=${exact[field]}.`,
      );
    }
  }
  return exact;
}

function canonicalPromptBodyMaterial(row: CylinderDualRoleCanonicalProductTruthRow): string {
  const material = row.material.trim().toLowerCase();
  const finish = row.glassFinish.trim().toLowerCase();
  const color = row.color.trim().toLowerCase();
  if (material.includes("aluminum") || material.includes("aluminium")) return "brushed_aluminum";
  if (material.includes("plastic")) {
    if (color.includes("white")) return "white_plastic";
    if (color.includes("black")) return "black_plastic";
    if (finish.includes("frost") || color.includes("frost")) return "frosted_plastic";
    return "clear_molded_plastic";
  }
  if (!material.includes("glass")) {
    throw new Error(`Unsupported canonical material "${row.material}" for ${row.websiteSku} + ${row.graceSku}.`);
  }
  if (finish.includes("frost") || color.includes("frost")) return "frosted_glass";
  if (finish.includes("cobalt") || color.includes("cobalt") || color.includes("blue")) return "cobalt_glass";
  if (finish.includes("amber") || color.includes("amber")) return "amber_glass";
  if (finish.includes("green") || color.includes("green")) return "green_glass";
  if (finish.includes("swirl") || finish.includes("flut")) return "swirl_glass";
  return "clear_glass";
}

function assertPlanSeal(
  plan: CylinderDualRoleRemediationPlan,
  expectedPlanSha256: string,
): void {
  assertSha256(expectedPlanSha256, "Expected Task 1 plan SHA");
  assertSha256(plan.sha256, "Embedded Task 1 plan SHA");
  const recomputed = computeCylinderDualRolePlanSha256(plan);
  if (recomputed !== plan.sha256.toLowerCase() || plan.sha256.toLowerCase() !== expectedPlanSha256.toLowerCase()) {
    throw new Error(
      `Task 1 plan SHA mismatch: expected ${expectedPlanSha256}, embedded ${plan.sha256}, recomputed ${recomputed}.`,
    );
  }
  if (plan.authorization.remoteWrites !== "forbidden" || plan.summary.externalWriteCount !== 0) {
    throw new Error("Task 1 plan does not preserve the no-remote-write contract.");
  }
}

function assertRoleJob(row: CylinderDualRoleRemediationRow, job: CylinderDualRoleJob): void {
  if (row.canonicalIdentityKey !== exactIdentityKey(row.websiteSku, row.graceSku)) {
    throw new Error(`Row ${row.canonicalIdentityKey} does not carry exact dual identity.`);
  }
  if (!job.jobId.startsWith(`${row.canonicalIdentityKey}|`)) {
    throw new Error(`Role job ${job.jobId} does not carry exact dual identity.`);
  }
  if (job.sourceEvidenceLane !== row.evidence.lane) {
    throw new Error(`Role job ${job.jobId} evidence lane does not match its sealed row.`);
  }
  const assembledOnly = /assembled-cap-on/i.test(row.evidence.classification ?? "");
  if (
    assembledOnly
    && job.targetRole === "pdp-cap-off-sidecar"
    && !(row.route === "approved-topology-exception"
      && job.jobType === "preserve-assembled-topology-exception")
  ) {
    throw new Error(
      `Assembled-only evidence cannot request pdp-cap-off-sidecar for ordinary role job ${job.jobId}.`,
    );
  }
  const expectedRole: Record<CylinderDualRoleJobType, CylinderDualRoleJob["targetRole"]> = {
    "assemble-cap-on-reference": "identity-cap-on",
    "preserve-cap-on-reference": "identity-cap-on",
    "preserve-cap-off-sidecar-reference": "pdp-cap-off-sidecar",
    "preserve-assembled-topology-exception": "pdp-cap-off-sidecar",
  };
  if (job.targetRole !== expectedRole[job.jobType]) {
    throw new Error(`Role job ${job.jobId} has target ${job.targetRole}, expected ${expectedRole[job.jobType]}.`);
  }
  if (
    (job.jobType === "preserve-cap-on-reference"
      || job.jobType === "preserve-assembled-topology-exception")
    && row.route !== "approved-topology-exception"
  ) {
    throw new Error(`Copy-only topology job ${job.jobId} requires approved-topology-exception route.`);
  }
}

function selectJobs(
  plan: CylinderDualRoleRemediationPlan,
  options: CylinderDualRoleRunnerOptions,
): Array<{ row: CylinderDualRoleRemediationRow; job: CylinderDualRoleJob }> {
  for (const row of plan.rows) {
    const targetRoles = new Set(row.roleJobs.map((job) => job.targetRole));
    if (targetRoles.size > 1) {
      throw new Error(
        `Cross-lane product reference is forbidden for ${row.canonicalIdentityKey}: opposite roles cannot share one row evidence locator/hash.`,
      );
    }
  }
  const allJobs = plan.rows.flatMap((row) => row.roleJobs.map((job) => ({ row, job })))
    .sort((left, right) => left.job.jobId.localeCompare(right.job.jobId));
  if (allJobs.length !== plan.summary.roleJobCount) {
    throw new Error(
      `Task 1 role-job count mismatch: summary ${plan.summary.roleJobCount}, rows ${allJobs.length}.`,
    );
  }
  const jobIds = new Set<string>();
  for (const { row, job } of allJobs) {
    if (jobIds.has(job.jobId)) throw new Error(`Duplicate Task 1 role job ${job.jobId}.`);
    jobIds.add(job.jobId);
    assertRoleJob(row, job);
  }

  if (options.all) return allJobs;
  let selected = allJobs.filter(({ row, job }) => (
    (options.routes.length === 0 || options.routes.includes(row.route))
    && (options.cohorts.length === 0 || options.cohorts.includes(job.sourceEvidenceLane))
    && (options.allowlist.length === 0
      || options.allowlist.includes(job.jobId)
      || options.allowlist.includes(row.canonicalIdentityKey))
  ));
  if (options.allowlist.length > 0) {
    const matched = new Set(selected.flatMap(({ row, job }) => [row.canonicalIdentityKey, job.jobId]));
    const missing = options.allowlist.filter((item) => !matched.has(item));
    if (missing.length > 0) throw new Error(`Allowlist entries did not match sealed jobs: ${missing.join(", ")}.`);
  }
  const limit = options.count ?? BEST_BOTTLES_CYLINDER_DUAL_ROLE_EXECUTE_LIMIT;
  selected = selected.slice(0, limit);
  if (selected.length === 0) throw new Error("Cylinder dual-role selection matched zero sealed jobs.");
  return selected;
}

function copyOperation(
  row: CylinderDualRoleRemediationRow,
  job: CylinderDualRoleJob,
): CylinderDualRoleDeterministicOperation | null {
  // An exact byte copy can satisfy the output contract only when the sealed
  // evidence is already the canonical output size. Lower-resolution approved
  // topology evidence remains product truth for a V6.1 regeneration prompt;
  // it is never silently upscaled or recanvased by this runner.
  if (row.evidence.width !== 2080 || row.evidence.height !== 2288) return null;
  if (job.jobType === "preserve-cap-on-reference") {
    return {
      version: "best-bottles-exact-reference-copy-v1",
      action: "copy-source-bytes-without-pixel-mutation",
      requiredFormat: "png",
      requiredWidth: 2080,
      requiredHeight: 2288,
      requiredOpaque: true,
      topologyDisposition: "identity-cap-on",
    };
  }
  if (job.jobType === "preserve-assembled-topology-exception") {
    return {
      version: "best-bottles-exact-reference-copy-v1",
      action: "copy-source-bytes-without-pixel-mutation",
      requiredFormat: "png",
      requiredWidth: 2080,
      requiredHeight: 2288,
      requiredOpaque: true,
      topologyDisposition: "approved-assembled-live-site-exception",
    };
  }
  return null;
}

function rolePrompt(
  row: CylinderDualRoleRemediationRow,
  job: CylinderDualRoleJob,
  productTruth: CylinderDualRoleCanonicalProductTruthRow,
  system: PromptSystem,
): { prompt: string; warnings: string[] } {
  const sidecar = job.jobType === "preserve-cap-off-sidecar-reference";
  const preserveCapOn = job.jobType === "preserve-cap-on-reference";
  const preserveTopologyException = job.jobType === "preserve-assembled-topology-exception";
  const product = {
    graceSku: row.graceSku,
    websiteSku: row.websiteSku,
    itemName: productTruth.itemName,
    itemDescription: sidecar
      ? "Exact bottle with fitment attached and detached cap right-sidecar."
      : "Exact assembled cap-on bottle.",
    bottleCollection: productTruth.bottleCollection,
    family: productTruth.family,
    category: productTruth.category,
    color: productTruth.color,
    capacityMl: Number(productTruth.capacityMl),
    applicator: productTruth.applicator,
    capStyle: productTruth.capStyle,
    capColor: productTruth.capColor,
    trimColor: productTruth.trimColor,
    material: productTruth.material,
    glassFinish: productTruth.glassFinish,
    capState: sidecar ? "cap-off detached" : "cap-on assembled",
    mode: sidecar ? "cap-off" : "cap-on",
    componentTopology: sidecar
      ? "fitment-attached-cap-right-sidecar" as const
      : "assembled" as const,
    capOffReferenceId: sidecar ? row.evidence.referenceSha256 : null,
    topologyReferenceId: row.route === "approved-topology-exception"
      ? row.evidence.referenceSha256
      : null,
    heightWithoutCap: `${row.canonical.canon_bodyHeightMm} mm`,
    heightWithCap: `${row.canonical.canon_heightWithCapMm} mm`,
    diameter: `${row.canonical.canon_widthAxisMm} mm`,
  };
  const preflight = buildBestBottlesPromptPreflight({
    product,
    referenceImagePath: row.evidence.sourceLocator,
    bodyMaterial: canonicalPromptBodyMaterial(productTruth),
    canvas: { widthPx: 2080, heightPx: 2288 },
    system,
  });
  if (preflight.status === "error" || !preflight.record) {
    throw new Error(`${job.jobId} V6.1 prompt preflight failed: ${preflight.issue ?? "missing prompt record"}.`);
  }
  const identity = `${row.websiteSku} + ${row.graceSku}`;
  const geometry = [
    `body ${row.canonical.canon_bodyHeightMm} mm`,
    `assembled ${row.canonical.canon_heightWithCapMm} mm`,
    `width ${row.canonical.canon_widthAxisMm} mm`,
    `second axis ${row.canonical.canon_secondAxisMm} mm`,
  ].join(", ");
  const productTruthLine = [
    `color ${productTruth.color}`,
    `material ${productTruth.material}`,
    `glass finish ${productTruth.glassFinish}`,
    `applicator ${productTruth.applicator || "none"}`,
    `cap style ${productTruth.capStyle || "none"}`,
    `cap color ${productTruth.capColor || "none"}`,
    `trim color ${productTruth.trimColor || "none"}`,
  ].join(", ");
  const materialLabel = canonicalPromptBodyMaterial(productTruth).replace(/_/g, " ");
  const addendum = sidecar
    ? [
      "ROLE-SPECIFIC PDP CAP-OFF SIDECAR REMEDIATION:",
      `- Preserve the exact cap-off sidecar identity ${identity}; do not assemble the cap onto the bottle.`,
      "- Preserve one primary bottle with its fitment attached and exactly one detached cap at the right-sidecar position on the shared baseline.",
      "- This output is only for role pdp-cap-off-sidecar. Do not reinterpret it as the identity-cap-on role.",
      `- Exact canonical product truth: ${productTruthLine}; prompt material ${materialLabel}.`,
      `- Canonical measured geometry: ${geometry}.`,
    ].join("\n")
    : preserveTopologyException
      ? [
        "ROLE-SPECIFIC APPROVED ASSEMBLED TOPOLOGY-EXCEPTION PRESERVATION:",
        `- Preserve the exact approved assembled topology exception ${identity}; do not synthesize a detached cap or cap-off sidecar.`,
        "- Keep every approved assembled component in its exact product relationship. Do not disassemble, replace, or invent components.",
        "- This is the explicit approved assembled-live-site exception for role pdp-cap-off-sidecar; it is not ordinary cap-off sidecar evidence.",
        `- Exact canonical product truth: ${productTruthLine}; prompt material ${materialLabel}.`,
        `- Canonical measured geometry: ${geometry}.`,
      ].join("\n")
      : preserveCapOn
        ? [
          "ROLE-SPECIFIC IDENTITY CAP-ON PRESERVATION:",
          `- Preserve the exact assembled cap-on identity ${identity}; keep the approved cap seated exactly as shown.`,
          "- Render exactly one assembled primary product. Do not detach, replace, or invent a right-sidecar component.",
          "- This output is only for role identity-cap-on. Do not reinterpret it as the pdp-cap-off-sidecar role.",
          `- Exact canonical product truth: ${productTruthLine}; prompt material ${materialLabel}.`,
          `- Canonical measured geometry: ${geometry}.`,
        ].join("\n")
        : [
      "ROLE-SPECIFIC IDENTITY CAP-ON ASSEMBLY REMEDIATION:",
      `- Assemble the exact cap-on identity ${identity}; seat the approved detached cap on its matching closure without changing either component.`,
      "- Narrow assembly exception: the only authorized positional change overriding generic component-position preservation is seating the exact approved detached cap onto its matching closure. Every other component identity, count, relationship, geometry, material, and finish remains locked.",
      "- Render exactly one assembled primary product. Do not leave a detached cap or right-sidecar component in the output.",
      "- This output is only for role identity-cap-on. Do not reinterpret it as the pdp-cap-off-sidecar role.",
      `- Exact canonical product truth: ${productTruthLine}; prompt material ${materialLabel}.`,
      `- Canonical measured geometry: ${geometry}.`,
        ].join("\n");
  return { prompt: `${preflight.record.final_prompt}\n\n${addendum}`, warnings: preflight.warnings };
}

function safeFilename(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]+/g, "_");
}

function compileJob(
  plan: CylinderDualRoleRemediationPlan,
  row: CylinderDualRoleRemediationRow,
  job: CylinderDualRoleJob,
  productTruth: CylinderDualRoleCanonicalProductTruthRow,
  productTruthFileSha256: string,
  options: CylinderDualRoleRunnerOptions,
  promptSystem: PromptSystem,
): CylinderDualRoleCompiledJob {
  assertSha256(row.evidence.referenceSha256, `${job.jobId} reference SHA`);
  const sourceSha256 = row.evidence.sourceSha256;
  if (sourceSha256 !== null) assertSha256(sourceSha256, `${job.jobId} source SHA`);
  if (!row.evidence.sourceLocator) throw new Error(`${job.jobId} is missing a sealed source locator.`);
  const deterministicOperation = copyOperation(row, job);
  const compiledPrompt = deterministicOperation
    ? null
    : rolePrompt(row, job, productTruth, promptSystem);
  const prompt = compiledPrompt?.prompt ?? null;
  return {
    workflowVersion: BEST_BOTTLES_CYLINDER_DUAL_ROLE_RUNNER_VERSION,
    jobId: job.jobId,
    jobType: job.jobType,
    canonicalIdentityKey: row.canonicalIdentityKey,
    websiteSku: row.websiteSku,
    graceSku: row.graceSku,
    role: job.targetRole,
    route: row.route,
    evidenceLane: job.sourceEvidenceLane,
    sourceLocator: row.evidence.sourceLocator,
    planSha256: plan.sha256,
    sourceSha256: sourceSha256?.toLowerCase() ?? null,
    referenceSha256: row.evidence.referenceSha256.toLowerCase(),
    canonicalProductTruthFileSha256: productTruthFileSha256.toLowerCase(),
    canonicalProductTruthRecordSha256: computeCanonicalProductTruthRecordSha256(productTruth),
    prompt,
    promptSha256: prompt ? sha256(prompt) : null,
    deterministicOperation,
    deterministicOperationSha256: deterministicOperation ? sha256(stableJson(deterministicOperation)) : null,
    canonicalGeometrySha256: computeCanonicalGeometrySha256(row.canonical),
    outputRelativePath: `outputs/${safeFilename(row.websiteSku)}__${safeFilename(row.graceSku)}__${job.targetRole}.png`,
    status: options.mode === "compile-only" ? "compiled-dry-run" : "queued-local-execution",
    reviewStatus: "review-pending",
    warnings: compiledPrompt?.warnings ?? [],
  };
}

export function compileCylinderDualRoleRun(input: {
  plan: CylinderDualRoleRemediationPlan;
  expectedPlanSha256: string;
  options: CylinderDualRoleRunnerOptions;
  promptSystem: PromptSystem;
  canonicalProductTruth: CylinderDualRoleCanonicalProductTruthInput;
}): CylinderDualRoleCompileResult {
  // This validation intentionally precedes selectJobs(): no route, cohort, or
  // allowlist is allowed to inspect or select from an unsealed Task 1 plan.
  assertPlanSeal(input.plan, input.expectedPlanSha256);
  const productTruthIndex = indexCanonicalProductTruth(input.canonicalProductTruth);
  const selected = selectJobs(input.plan, input.options);
  const jobs = selected.map(({ row, job }) => {
    const productTruth = resolveCanonicalProductTruth(
      row,
      input.canonicalProductTruth.rows,
      productTruthIndex,
    );
    return compileJob(
      input.plan,
      row,
      job,
      productTruth,
      input.canonicalProductTruth.fileSha256,
      input.options,
      input.promptSystem,
    );
  });
  return {
    workflowVersion: BEST_BOTTLES_CYLINDER_DUAL_ROLE_RUNNER_VERSION,
    mode: input.options.mode,
    planSha256: input.plan.sha256,
    canonicalProductTruthFileSha256: input.canonicalProductTruth.fileSha256.toLowerCase(),
    selectedJobCount: jobs.length,
    jobs,
    externalWriteCount: 0,
  };
}

const RESUME_KEYS: Array<keyof CylinderDualRoleCompiledJob> = [
  "jobId",
  "jobType",
  "canonicalIdentityKey",
  "websiteSku",
  "graceSku",
  "role",
  "planSha256",
  "sourceSha256",
  "referenceSha256",
  "canonicalProductTruthFileSha256",
  "canonicalProductTruthRecordSha256",
  "promptSha256",
  "deterministicOperationSha256",
  "canonicalGeometrySha256",
];

export function assertCylinderDualRoleResumeCompatible(
  expected: CylinderDualRoleCompiledJob,
  existing: Partial<CylinderDualRoleCompiledJob>,
): void {
  const mismatches = RESUME_KEYS.filter((key) => existing[key] !== expected[key]);
  if (mismatches.length > 0) {
    throw new Error(
      `Stale resume metadata for ${expected.jobId}; mismatched ${mismatches.join(", ")}.`,
    );
  }
}

export function buildSuccessfulCylinderDualRoleResult(
  job: CylinderDualRoleCompiledJob,
  validation: CylinderDualRoleOutputValidation,
): CylinderDualRoleSuccessfulResult {
  assertSha256(validation.outputSha256, `${job.jobId} output SHA`);
  if (validation.width !== 2080 || validation.height !== 2288) {
    throw new Error(`${job.jobId} output must be exactly 2080x2288.`);
  }
  if (validation.opaque !== true) throw new Error(`${job.jobId} output must be opaque.`);
  if (!validation.framingQa || validation.framingQa.status === "fail") {
    throw new Error(`${job.jobId} output must pass family-rig framing QA before success.`);
  }
  return {
    ...job,
    status: validation.disposition === "rendered"
      ? "rendered-review-pending"
      : "skipped-existing-review-pending",
    outputSha256: validation.outputSha256.toLowerCase(),
    outputDimensions: { width: 2080, height: 2288 },
    opaque: true,
    framingQa: validation.framingQa,
    reviewStatus: "review-pending",
  };
}
