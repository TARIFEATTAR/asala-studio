import { createHash } from "node:crypto";
import {
  access,
  mkdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import sharp from "sharp";

import {
  PILOT_REVIEW_GRACE_SKU,
  PILOT_REVIEW_WEBSITE_SKU,
  PILOT_SUPPORTING_IDENTITY_EVIDENCE,
  buildCylinderPilotRoleReview,
  renderCylinderPilotRoleReviewHtml,
  type CylinderPilotReviewRole,
  type CylinderPilotRoleReviewArtifact,
  type CylinderPilotRoleReviewBuildInput,
  type CylinderPilotRoleReviewInput,
} from "../../src/lib/bestBottlesCylinderPilotRoleReview";
import {
  computeCanonicalGeometrySha256,
  computeCylinderDualRolePlanSha256,
} from "../../src/lib/bestBottlesCylinderDualRoleRunner";
import { detectModelShadowContactBounds } from "../../src/lib/product-image/rigPostprocess";
import { analyzeModelOwnedShadow } from "../../src/lib/product-image/shadowQa";

const REQUIRED_ROLES = [
  "identity-cap-on",
  "pdp-cap-off-sidecar",
] as const satisfies readonly CylinderPilotReviewRole[];
const ROLE_SLUG_PREFIX = `${PILOT_REVIEW_WEBSITE_SKU}__${PILOT_REVIEW_GRACE_SKU}__`;
const WORKSPACE_ROOT = path.resolve(import.meta.dirname, "../..");

export interface CylinderPilotRoleReviewCliOptions {
  planPath: string;
  runDirectory: string;
  websiteSku: typeof PILOT_REVIEW_WEBSITE_SKU;
  graceSku: typeof PILOT_REVIEW_GRACE_SKU;
}

export interface CylinderPilotRoleReviewCliResult {
  outputDirectory: string;
  manifestPath: string;
  htmlPath: string;
  artifact: CylinderPilotRoleReviewArtifact;
}

function assertCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function isLocalPath(value: string): boolean {
  return value.length > 0 && !/^[a-z][a-z0-9+.-]*:\/\//i.test(value);
}

function sha256(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function readFlag(argv: string[], flag: string): string {
  const indexes = argv.flatMap((value, index) => value === flag ? [index] : []);
  assertCondition(indexes.length === 1, `${flag} is required exactly once.`);
  const value = argv[indexes[0] + 1];
  assertCondition(value && !value.startsWith("--"), `${flag} requires a value.`);
  return value;
}

export function parseCylinderPilotRoleReviewArgs(
  argv: string[],
): CylinderPilotRoleReviewCliOptions {
  const allowed = new Set(["--plan", "--run-dir", "--website-sku", "--grace-sku"]);
  for (let index = 0; index < argv.length; index += 2) {
    assertCondition(allowed.has(argv[index]), `Unknown flag ${argv[index] ?? "(missing)"}.`);
    assertCondition(argv[index + 1] != null, `${argv[index]} requires a value.`);
  }
  const planPath = readFlag(argv, "--plan");
  const runDirectory = readFlag(argv, "--run-dir");
  const websiteSku = readFlag(argv, "--website-sku");
  const graceSku = readFlag(argv, "--grace-sku");
  assertCondition(isLocalPath(planPath) && isLocalPath(runDirectory), "Plan and run directory must be local paths.");
  assertCondition(
    websiteSku === PILOT_REVIEW_WEBSITE_SKU && graceSku === PILOT_REVIEW_GRACE_SKU,
    "CLI identity must match the exact pilot identity.",
  );
  return {
    planPath: path.resolve(planPath),
    runDirectory: path.resolve(runDirectory),
    websiteSku,
    graceSku,
  };
}

function assertRecordAuthority(record: any, pass2: any, compiledJob: any, role: CylinderPilotReviewRole): void {
  const fields = [
    "websiteSku",
    "graceSku",
    "role",
    "jobId",
    "planSha256",
    "sourceSha256",
    "referenceSha256",
    "promptSha256",
    "canonicalGeometrySha256",
  ];
  for (const field of fields) {
    assertCondition(
      record[field] === pass2.job?.[field] && record[field] === compiledJob[field],
      `${role} recovery record ${field} crosses sealed compiled-job authority.`,
    );
  }
  assertCondition(
    record.planFileSha256 === pass2.job?.planFileSha256,
    `${role} recovery record plan file SHA crosses sealed authority.`,
  );
  assertCondition(record.externalWriteCount === 0, `${role} recovery record must have zero external writes.`);
  assertCondition(record.promotionStatus === "not-promoted", `${role} recovery record must remain not-promoted.`);
}

async function loadRoleInput(
  runDirectory: string,
  role: CylinderPilotReviewRole,
  compiledJob: any,
): Promise<CylinderPilotRoleReviewInput> {
  const relativeDirectory = `normalized/framing-recovery-v3/${ROLE_SLUG_PREFIX}${role}`;
  const recordPath = path.join(runDirectory, relativeDirectory, "recovery-record.json");
  const pngRelativePath = `${relativeDirectory}/pass-02.png`;
  const pngPath = path.join(runDirectory, pngRelativePath);
  const [recordBytes, pngBytes] = await Promise.all([readFile(recordPath), readFile(pngPath)]);
  const record = JSON.parse(recordBytes.toString("utf8"));
  const pass1 = record.passes?.find((entry: any) => entry.passNumber === 1);
  const pass2 = record.passes?.find((entry: any) => entry.passNumber === 2);
  assertCondition(pass1 && pass2, `${role} recovery record must contain passes 1 and 2.`);
  assertRecordAuthority(record, pass2, compiledJob, role);
  const expectedTopology = role === "identity-cap-on" ? "assembled" : "detached";
  assertCondition(record.topology === expectedTopology, `${role} recovery topology crosses its role.`);
  assertCondition(pass2.outputRelativePath === pngRelativePath, `${role} pass-02 path crosses its recovery record.`);
  assertCondition(
    typeof compiledJob.prompt === "string" &&
      sha256(compiledJob.prompt) === compiledJob.promptSha256,
    `${role} prompt SHA does not match actual compiled prompt text.`,
  );
  const evidencePath = path.resolve(WORKSPACE_ROOT, compiledJob.sourceLocator);
  const evidenceRelative = path.relative(WORKSPACE_ROOT, evidencePath);
  assertCondition(
    evidenceRelative === "tmp" ||
      (evidenceRelative.startsWith(`tmp${path.sep}`) && !evidenceRelative.includes(`..${path.sep}`)),
    `${role} evidence locator must remain inside the local tmp workspace.`,
  );
  const actualReferenceSha256 = sha256(await readFile(evidencePath));
  assertCondition(
    actualReferenceSha256 === compiledJob.referenceSha256,
    `${role} reference SHA does not match actual locator bytes.`,
  );

  const image = sharp(pngBytes, { failOn: "error" });
  const metadata = await image.metadata();
  const { data, info } = await sharp(pngBytes, { failOn: "error" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const opaque = info.channels === 4 && (() => {
    for (let index = 3; index < data.length; index += 4) {
      if (data[index] !== 255) return false;
    }
    return true;
  })();
  const pixels = new Uint8ClampedArray(data);
  const topology = role === "identity-cap-on"
    ? {
        kind: "assembled" as const,
        expectedContacts: ["bottle"] as const,
        source: "reviewed-reference" as const,
      }
    : {
        kind: "detached-sidecar" as const,
        expectedContacts: ["bottle", "sidecar"] as const,
        source: "reviewed-reference" as const,
      };
  const normalization = pass2.normalization;
  assertCondition(normalization?.objectBounds, `${role} recovery object bounds are required.`);
  assertCondition(Number.isFinite(normalization.detectedBaselineYPx), `${role} recovery baseline is required.`);
  const background = { r: 245, g: 243, b: 239 };
  const contactBounds = detectModelShadowContactBounds({
    pixels,
    width: info.width,
    height: info.height,
    background,
    groupBounds: normalization.objectBounds,
    baselineYPx: normalization.detectedBaselineYPx,
    topology,
  });
  const recomputedShadowQa = analyzeModelOwnedShadow({
    pixels,
    width: info.width,
    height: info.height,
    background,
    baselineYPx: normalization.detectedBaselineYPx,
    objectBounds: normalization.objectBounds,
    contactBounds,
    topology,
  }).report;
  return {
    websiteSku: record.websiteSku,
    graceSku: record.graceSku,
    role,
    topology: expectedTopology,
    jobId: record.jobId,
    jobType: compiledJob.jobType,
    planSha256: record.planSha256,
    sourceSha256: record.sourceSha256,
    referenceSha256: record.referenceSha256,
    promptSha256: record.promptSha256,
    canonicalGeometrySha256: record.canonicalGeometrySha256,
    evidenceLocator: compiledJob.sourceLocator,
    actualReferenceSha256,
    referenceVerification: "direct-locator-bytes",
    sourceVerification: "sealed-plan-semantic-sha-no-byte-locator",
    recordFileSha256: sha256(recordBytes),
    rawInputSha256: record.rawOutputSha256Before,
    rawInputSha256After: record.rawOutputSha256After,
    pass1InputSha256: pass1.inputSha256,
    pass1OutputSha256: pass1.outputSha256,
    pass2InputSha256: pass2.inputSha256,
    pass2OutputSha256: pass2.outputSha256,
    png: {
      relativePath: pngRelativePath,
      actualSha256: sha256(pngBytes),
      format: metadata.format as "png",
      width: info.width,
      height: info.height,
      opaque,
    },
    framingDecision: normalization.framingDecision,
    qaIssues: normalization.qaIssues,
    framingQa: normalization.framingQa,
    recordedShadowQaStatus: normalization.shadowQa?.status,
    recomputedShadowQa,
  };
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function buildCylinderPilotRoleReviewFromLocalFiles(
  options: CylinderPilotRoleReviewCliOptions,
): Promise<CylinderPilotRoleReviewCliResult> {
  assertCondition(
    options.websiteSku === PILOT_REVIEW_WEBSITE_SKU &&
      options.graceSku === PILOT_REVIEW_GRACE_SKU,
    "Build identity must match the exact pilot identity.",
  );
  const planPath = path.resolve(options.planPath);
  const runDirectory = path.resolve(options.runDirectory);
  assertCondition(isLocalPath(planPath) && isLocalPath(runDirectory), "Inputs must be local paths.");
  const expectedPlanPath = path.resolve(
    runDirectory,
    "../../../cylinder-dual-role-remediation-plan.json",
  );
  assertCondition(planPath === expectedPlanPath, "Plan path must belong to the sealed run directory.");
  const sealedRunPlanSha256 = path.basename(path.dirname(runDirectory));
  assertCondition(/^[a-f0-9]{64}$/i.test(sealedRunPlanSha256), "Run directory must be nested beneath a sealed plan SHA.");

  const compiledJobsPath = path.join(runDirectory, "compiled-jobs.json");
  const [planBytes, compiledJobsBytes] = await Promise.all([
    readFile(planPath),
    readFile(compiledJobsPath),
  ]);
  const plan = JSON.parse(planBytes.toString("utf8"));
  const compiled = JSON.parse(compiledJobsBytes.toString("utf8"));
  const recomputedPlanSha256 = computeCylinderDualRolePlanSha256(plan);
  assertCondition(
    recomputedPlanSha256 === plan.sha256 && plan.sha256 === sealedRunPlanSha256,
    `Recomputed semantic plan SHA ${recomputedPlanSha256} does not match the embedded seal or sealed run directory.`,
  );
  assertCondition(compiled.planSha256 === plan.sha256, "Compiled jobs plan SHA does not match the sealed plan.");
  assertCondition(compiled.planFileSha256 === sha256(planBytes), "Compiled jobs plan file SHA does not match actual plan bytes.");
  const identity = plan.rows?.find(
    (row: any) => row.websiteSku === options.websiteSku && row.graceSku === options.graceSku,
  );
  assertCondition(identity, "Exact pilot identity is absent from the sealed plan.");
  const canonicalGeometrySha256 = computeCanonicalGeometrySha256(identity.canonical);
  const compiledJobs = (compiled.jobs ?? []).filter(
    (job: any) => job.websiteSku === options.websiteSku && job.graceSku === options.graceSku,
  );
  assertCondition(compiledJobs.length === 2, "Both exact compiled role jobs are required.");
  for (const job of compiledJobs) {
    assertCondition(
      job.canonicalGeometrySha256 === canonicalGeometrySha256,
      `${job.role} canonical geometry SHA does not match geometry recomputed from the sealed plan.`,
    );
    assertCondition(
      job.sourceSha256 === identity.evidence.sourceSha256 &&
        job.referenceSha256 === identity.evidence.referenceSha256 &&
        job.sourceLocator === identity.evidence.sourceLocator,
      `${job.role} source SHA, reference SHA, or locator does not match sealed-plan authority.`,
    );
    assertCondition(
      typeof job.prompt === "string" && sha256(job.prompt) === job.promptSha256,
      `${job.role} prompt SHA does not match actual compiled prompt text.`,
    );
  }
  const roleInputs = await Promise.all(REQUIRED_ROLES.map(async (role) => {
    const compiledJob = compiledJobs.find((job: any) => job.role === role);
    assertCondition(compiledJob, `Required compiled role ${role} is absent.`);
    return loadRoleInput(runDirectory, role, compiledJob);
  }));
  const buildInput: CylinderPilotRoleReviewBuildInput = {
    sealedRunPlanSha256,
    plan: {
      version: plan.version,
      semanticSha256: plan.sha256,
      recordedFileSha256: compiled.planFileSha256,
      actualFileSha256: sha256(planBytes),
      document: plan,
      authorization: plan.authorization,
      identity: {
        websiteSku: identity.websiteSku,
        graceSku: identity.graceSku,
        canonicalIdentityKey: identity.canonicalIdentityKey,
        roleJobs: identity.roleJobs,
      },
    },
    compiledJobsFileSha256: sha256(compiledJobsBytes),
    compiledJobs,
    roles: roleInputs,
    supportingIdentityEvidence: { ...PILOT_SUPPORTING_IDENTITY_EVIDENCE },
  };

  // Build and render completely before creating any directory.
  const artifact = buildCylinderPilotRoleReview(buildInput);
  const manifestBytes = `${JSON.stringify(artifact, null, 2)}\n`;
  const htmlBytes = renderCylinderPilotRoleReviewHtml(artifact);
  const outputDirectory = path.join(
    runDirectory,
    "pilot-role-review-v1",
    artifact.inputSetSha256,
  );
  const manifestPath = path.join(outputDirectory, "pilot-role-review.json");
  const htmlPath = path.join(outputDirectory, "index.html");
  if (await pathExists(outputDirectory)) {
    const [existingManifest, existingHtml] = await Promise.all([
      readFile(manifestPath, "utf8"),
      readFile(htmlPath, "utf8"),
    ]);
    assertCondition(existingManifest === manifestBytes, "Existing addressed manifest bytes do not match current validated output.");
    assertCondition(existingHtml === htmlBytes, "Existing addressed HTML bytes do not match current validated output.");
  } else {
    await mkdir(outputDirectory, { recursive: true });
    await Promise.all([
      writeFile(manifestPath, manifestBytes, { flag: "wx" }),
      writeFile(htmlPath, htmlBytes, { flag: "wx" }),
    ]);
  }
  return { outputDirectory, manifestPath, htmlPath, artifact };
}

async function main(): Promise<void> {
  const result = await buildCylinderPilotRoleReviewFromLocalFiles(
    parseCylinderPilotRoleReviewArgs(process.argv.slice(2)),
  );
  process.stdout.write(`${JSON.stringify({
    outputDirectory: result.outputDirectory,
    manifestPath: result.manifestPath,
    htmlPath: result.htmlPath,
    inputSetSha256: result.artifact.inputSetSha256,
    machineStatus: result.artifact.machineStatus,
    reviewStatus: result.artifact.reviewStatus,
    humanVisualApproval: result.artifact.humanVisualApproval,
    promotionStatus: result.artifact.promotionStatus,
    externalWriteCount: result.artifact.externalWriteCount,
  }, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
