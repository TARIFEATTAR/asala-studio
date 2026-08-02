import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";

import { buildCylinderRoleSourceAuditFromLocalFiles } from "./build-cylinder-role-source-audit";

const ROOT = path.resolve(import.meta.dirname, "../..");
const RUN_ROOT = path.join(
  ROOT,
  "tmp/best-bottles-reference-production/cylinder-dual-role-remediation-v2/runs/411f34e80f7762da48859ad7cf7056f1668055c929aebac00012ff2031ac4d35",
);
const sourcePaths = {
  roleAwareReadiness: path.join(ROOT, "public/data/best-bottles-cylinder-sidecar-promotion.json"),
  remediationPlan: path.join(ROOT, "tmp/best-bottles-reference-production/cylinder-dual-role-remediation-v2/cylinder-dual-role-remediation-plan.json"),
  compiledJobs: path.join(RUN_ROOT, "compile-all/compiled-jobs.json"),
  pilotReview: path.join(RUN_ROOT, "execute-local-only-304a29d863ee1e5a/pilot-role-review-v1/41ce4ab7062d7d3abe3cb60ef77bde063bd38634eb8dcb1bc55eb2cb29d08312/pilot-role-review.json"),
  nextCohort: path.join(RUN_ROOT, "next-cohort-preflight-v1/dd3119424506238e1461c93e4daea8a33f61b2d6e8a530030303d7f5dd5707d1/next-cohort-preflight.json"),
  fullSchedule: path.join(RUN_ROOT, "full-execution-schedule-v1/962c98db5080c6db00b79ab921f118adab2d4172d22dac1007888377390dbcc0/full-execution-schedule.json"),
  priorFullSchedule: path.join(RUN_ROOT, "full-execution-schedule-v1/a7b31a73c25827216bf296d4eedbd3dd3babeba067550b93143abf4159cc71f6/full-execution-schedule.json"),
} as const;
const negativeEvidencePath = "/tmp/codex-remote-attachments/019f57dd-a528-7a70-8e61-19004fb02105/B2D5E8BB-7FD6-49A7-9BC8-368637A72AD3/1-Photo-1.jpg";
const temporaryRoots: string[] = [];

after(async () => {
  await Promise.all(temporaryRoots.map((entry) => rm(entry, { recursive: true, force: true })));
});

async function fileSha(filePath: string): Promise<string> {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

describe("build Cylinder role-source audit", () => {
  it("writes a hash-addressed local-only report without mutating sealed inputs", async () => {
    const outputRoot = await mkdtemp(path.join(os.tmpdir(), "cylinder-role-source-audit-"));
    temporaryRoots.push(outputRoot);
    const before = await Promise.all(Object.values(sourcePaths).map(fileSha));

    const result = await buildCylinderRoleSourceAuditFromLocalFiles({
      generatedAt: "2026-07-15T12:00:00.000Z",
      outputRoot,
      sourcePaths,
      negativeEvidencePath,
    });

    assert.equal(path.basename(result.outputDirectory), result.artifact.sha256);
    assert.equal(result.artifact.summary.invalidJobCount, 272);
    assert.equal(result.artifact.summary.quarantinedGeneratedOutputCount, 9);
    assert.equal(result.artifact.planCompilationReconciliation.status, "verified");
    assert.equal(result.artifact.planCompilationReconciliation.matchedEvidenceBindingJobCount, 328);
    assert.equal(result.artifact.planCompilationReconciliation.duplicateCompiledIdentityRoleCount, 0);
    assert.equal(result.artifact.promptBindingAudit.nonemptyPromptSha256Count, 328);
    assert.equal(result.artifact.promptBindingAudit.verifiedPromptByteSha256Count, 328);
    assert.deepEqual(result.artifact.promptBindingAudit.promptSha256MismatchJobIds, []);
    assert.equal(result.artifact.materialAuthorityAudit.status, "not-explicitly-bound-in-v2");
    assert.equal(result.artifact.summary.externalWriteCount, 0);
    assert.equal(JSON.parse(await readFile(result.manifestPath, "utf8")).sha256, result.artifact.sha256);
    const report = await readFile(result.reportPath, "utf8");
    assert.match(report, /272 invalid role jobs/);
    assert.match(report, /recomputed from the exact compiled prompt bytes/i);
    assert.match(report, /row-level source locator\/source SHA-256\/reference SHA-256 bindings/i);
    assert.match(report, /material authority.*not explicitly bound in v2/i);
    assert.deepEqual(await Promise.all(Object.values(sourcePaths).map(fileSha)), before);

    const repeated = await buildCylinderRoleSourceAuditFromLocalFiles({
      generatedAt: "2026-07-15T12:00:00.000Z",
      outputRoot,
      sourcePaths,
      negativeEvidencePath,
    });
    assert.equal(repeated.outputDirectory, result.outputDirectory);
  });
});
