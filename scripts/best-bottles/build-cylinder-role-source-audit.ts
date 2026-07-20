import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import sharp from "sharp";

import {
  buildCylinderRoleSourceDefectAudit,
  type CylinderRoleSourceDefectAuditArtifact,
  type CylinderRoleSourceDefectAuditInput,
} from "../../src/lib/bestBottlesCylinderRoleSourceAudit";

const WORKSPACE_ROOT = path.resolve(import.meta.dirname, "../..");
const RUN_ROOT = path.join(
  WORKSPACE_ROOT,
  "tmp/best-bottles-reference-production/cylinder-dual-role-remediation-v2/runs/411f34e80f7762da48859ad7cf7056f1668055c929aebac00012ff2031ac4d35",
);
const WRONG_CAP_EVIDENCE = {
  sha256: "ca30e61c985aa00e67eb0dd1c80ad82f8f8d1c6163247dcee6fad99ba4f6ba66",
  width: 1163,
  height: 1280,
  userFinding: "cap identity is wrong",
} as const;

export interface CylinderRoleSourceAuditCliOptions {
  generatedAt: string;
  outputRoot: string;
  sourcePaths: {
    roleAwareReadiness: string;
    remediationPlan: string;
    compiledJobs: string;
    pilotReview: string;
    nextCohort: string;
    fullSchedule: string;
    priorFullSchedule: string;
  };
  negativeEvidencePath: string;
}

export interface CylinderRoleSourceAuditCliResult {
  outputDirectory: string;
  manifestPath: string;
  reportPath: string;
  artifact: CylinderRoleSourceDefectAuditArtifact;
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function displayPath(filePath: string): string {
  const relative = path.relative(WORKSPACE_ROOT, filePath);
  return relative.startsWith("..") ? filePath : relative.split(path.sep).join("/");
}

async function loadJsonSource(filePath: string) {
  const bytes = await readFile(filePath);
  return {
    path: displayPath(filePath),
    fileSha256: sha256(bytes),
    data: JSON.parse(bytes.toString("utf8")),
  };
}

async function collectInvalidPilotPngDerivatives(pilotReviewPath: string) {
  const executeRoot = path.resolve(path.dirname(pilotReviewPath), "../..");
  const paths: string[] = [];
  const visit = async (directory: string): Promise<void> => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(entryPath);
      else if (
        entry.name.endsWith(".png")
        && entryPath.includes("GBCylBlu5SpryBlkSh__GB-CYL-BLU-5ML-SPR-SBLK__identity-cap-on")
      ) paths.push(entryPath);
    }
  };
  await visit(executeRoot);
  if (paths.length === 0) throw new Error("No invalid pilot cap-on PNG derivatives were found.");
  return Promise.all(paths.sort().map(async (filePath) => ({
    path: path.relative(executeRoot, filePath).split(path.sep).join("/"),
    sha256: sha256(await readFile(filePath)),
  })));
}

function renderReport(artifact: CylinderRoleSourceDefectAuditArtifact): string {
  const affected = artifact.affectedDerivatives.map((entry) => (
    `- ${entry.kind}: \`${entry.path}\` — ${entry.invalidJobIds.length} invalid jobs — SHA-256 \`${entry.fileSha256}\``
  )).join("\n");
  return `# Cylinder role-source defect audit v1

This immutable local-only audit supersedes the affected dual-role execution artifacts. It records **${artifact.summary.invalidJobCount} invalid role jobs** across ${artifact.summary.crossLaneSharedReferenceIdentityCount} identities where one evidence image was reused across cap-state lanes.

## Disposition

- Missing exact cap-on references: ${artifact.summary.missingExactCapOnReferenceCount}
- Missing exact sidecar references: ${artifact.summary.missingExactSidecarReferenceCount}
- Valid role-specific remediation jobs retained: ${artifact.summary.validRoleSpecificJobCount}
- Generated outputs quarantined: ${artifact.summary.quarantinedGeneratedOutputCount}
- External writes: ${artifact.summary.externalWriteCount}

Cap-on and cap-off/sidecar lanes require separate exact product references, prompts, and material authority. No topology may be invented from the opposite lane.

## Binding audit

- Prompt SHA-256 bindings: ${artifact.promptBindingAudit.nonemptyPromptSha256Count}/${artifact.promptBindingAudit.requiredJobCount} present and ${artifact.promptBindingAudit.verifiedPromptByteSha256Count}/${artifact.promptBindingAudit.requiredJobCount} recomputed from the exact compiled prompt bytes; opposite-role shared prompt hashes: ${artifact.promptBindingAudit.sharedOppositeRolePromptSha256IdentityCount}.
- Material authority is **not explicitly bound in v2**. The prompt text contains material language, but v2 provides no role-specific material authority locator or SHA-256. The replacement plan must add it.
- Plan ↔ compilation reconciliation: ${artifact.planCompilationReconciliation.status}; ${artifact.planCompilationReconciliation.matchedJobCount} jobs and ${artifact.planCompilationReconciliation.matchedEvidenceBindingJobCount} row-level source locator/source SHA-256/reference SHA-256 bindings matched semantic plan SHA-256 \`${artifact.planCompilationReconciliation.semanticPlanSha256}\`.
- Identity-role cardinality: at most one job per role per canonical identity; duplicate plan and compiled identity-role counts are both zero.

## Affected derivatives

${affected}

## Negative supporting evidence

The user-supplied wrong-cap image is recorded only as negative supporting evidence: \`${artifact.negativeEvidence.path}\`, SHA-256 \`${artifact.negativeEvidence.sha256}\`, ${artifact.negativeEvidence.width}×${artifact.negativeEvidence.height}. It is not eligible as a production reference.

The complete job lists, blockers, hashes, and quarantine records are in \`cylinder-role-source-defect-audit.json\`.
`;
}

export async function buildCylinderRoleSourceAuditFromLocalFiles(
  options: CylinderRoleSourceAuditCliOptions,
): Promise<CylinderRoleSourceAuditCliResult> {
  const negativeBytes = await readFile(options.negativeEvidencePath);
  const negativeMetadata = await sharp(negativeBytes).metadata();
  if (sha256(negativeBytes) !== WRONG_CAP_EVIDENCE.sha256) {
    throw new Error("Wrong-cap negative evidence SHA-256 does not match the user-supplied file.");
  }
  if (
    negativeMetadata.width !== WRONG_CAP_EVIDENCE.width
    || negativeMetadata.height !== WRONG_CAP_EVIDENCE.height
  ) {
    throw new Error("Wrong-cap negative evidence dimensions do not match the user-supplied file.");
  }

  const sourceEntries = await Promise.all(
    Object.entries(options.sourcePaths).map(async ([name, filePath]) => [name, await loadJsonSource(filePath)] as const),
  );
  const sources = Object.fromEntries(sourceEntries) as CylinderRoleSourceDefectAuditInput["sources"];
  const invalidPilotPngDerivatives = await collectInvalidPilotPngDerivatives(
    options.sourcePaths.pilotReview,
  );
  const artifact = buildCylinderRoleSourceDefectAudit({
    generatedAt: options.generatedAt,
    sources,
    negativeEvidence: {
      path: options.negativeEvidencePath,
      sha256: WRONG_CAP_EVIDENCE.sha256,
      width: WRONG_CAP_EVIDENCE.width,
      height: WRONG_CAP_EVIDENCE.height,
      userFinding: WRONG_CAP_EVIDENCE.userFinding,
    },
    invalidPilotPngDerivatives,
  });

  const outputDirectory = path.join(options.outputRoot, artifact.sha256);
  const manifestPath = path.join(outputDirectory, "cylinder-role-source-defect-audit.json");
  const reportPath = path.join(outputDirectory, "README.md");
  await mkdir(outputDirectory, { recursive: true });
  await Promise.all([
    writeFile(manifestPath, `${JSON.stringify(artifact, null, 2)}\n`),
    writeFile(reportPath, renderReport(artifact)),
  ]);
  return { outputDirectory, manifestPath, reportPath, artifact };
}

function defaultOptions(): CylinderRoleSourceAuditCliOptions {
  return {
    generatedAt: new Date().toISOString(),
    outputRoot: path.join(
      WORKSPACE_ROOT,
      "tmp/best-bottles-reference-production/cylinder-role-source-audit-v1",
    ),
    sourcePaths: {
      roleAwareReadiness: path.join(WORKSPACE_ROOT, "public/data/best-bottles-cylinder-sidecar-promotion.json"),
      remediationPlan: path.join(WORKSPACE_ROOT, "tmp/best-bottles-reference-production/cylinder-dual-role-remediation-v2/cylinder-dual-role-remediation-plan.json"),
      compiledJobs: path.join(RUN_ROOT, "compile-all/compiled-jobs.json"),
      pilotReview: path.join(RUN_ROOT, "execute-local-only-304a29d863ee1e5a/pilot-role-review-v1/41ce4ab7062d7d3abe3cb60ef77bde063bd38634eb8dcb1bc55eb2cb29d08312/pilot-role-review.json"),
      nextCohort: path.join(RUN_ROOT, "next-cohort-preflight-v1/dd3119424506238e1461c93e4daea8a33f61b2d6e8a530030303d7f5dd5707d1/next-cohort-preflight.json"),
      fullSchedule: path.join(RUN_ROOT, "full-execution-schedule-v1/962c98db5080c6db00b79ab921f118adab2d4172d22dac1007888377390dbcc0/full-execution-schedule.json"),
      priorFullSchedule: path.join(RUN_ROOT, "full-execution-schedule-v1/a7b31a73c25827216bf296d4eedbd3dd3babeba067550b93143abf4159cc71f6/full-execution-schedule.json"),
    },
    negativeEvidencePath: "/tmp/codex-remote-attachments/019f57dd-a528-7a70-8e61-19004fb02105/B2D5E8BB-7FD6-49A7-9BC8-368637A72AD3/1-Photo-1.jpg",
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  buildCylinderRoleSourceAuditFromLocalFiles(defaultOptions())
    .then((result) => {
      process.stdout.write(`${JSON.stringify({
        outputDirectory: displayPath(result.outputDirectory),
        manifestPath: displayPath(result.manifestPath),
        reportPath: displayPath(result.reportPath),
        sha256: result.artifact.sha256,
        summary: result.artifact.summary,
      }, null, 2)}\n`);
    })
    .catch((error) => {
      process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
      process.exitCode = 1;
    });
}
