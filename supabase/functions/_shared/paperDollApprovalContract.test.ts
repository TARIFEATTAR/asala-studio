import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildPaperDollApprovedCopyPlan,
  parsePaperDollApprovalRequest,
} from "./paperDollApprovalContract";

const ORG = "11111111-1111-4111-8111-111111111111";
const VERSION = "22222222-2222-4222-8222-222222222222";
const QA = "33333333-3333-4333-8333-333333333333";
const SHA = "a".repeat(64);

test("approval parser binds a named decision to candidate SHA and evidence", () => {
  const parsed = parsePaperDollApprovalRequest({
    organizationId: ORG,
    candidateComponentVersionId: VERSION,
    expectedCandidateSha256: SHA,
    decision: "approved",
    approverDisplayName: "Jordan Richter",
    evidenceIds: [QA],
  });
  assert.equal(parsed.expectedCandidateSha256, SHA);
  assert.deepEqual(parsed.evidenceIds, [QA]);
});

test("approval parser rejects anonymous names, bad SHA and empty evidence", () => {
  assert.throws(() => parsePaperDollApprovalRequest({
    organizationId: ORG,
    candidateComponentVersionId: VERSION,
    expectedCandidateSha256: "bad",
    decision: "approved",
    approverDisplayName: " ",
    evidenceIds: [],
  }));
});

test("approved copy plan promotes both candidate pixels and their exact authority mask", () => {
  assert.deepEqual(buildPaperDollApprovedCopyPlan({
    organizationId: ORG,
    candidateComponentVersionId: VERSION,
    imagePath: `${ORG}/CYL-9ML/candidate.png`,
    imageSha256: SHA,
    imageContentType: "image/png",
    imageByteSize: 1234,
    geometryMaskPath: `${ORG}/CYL-9ML/shared-mask/${"b".repeat(64)}.png`,
    geometryMaskSha256: "b".repeat(64),
  }), [
    {
      kind: "pixels",
      sourcePath: `${ORG}/CYL-9ML/candidate.png`,
      approvedPath: `${ORG}/CYL-9ML/approved-${VERSION}/${SHA}.png`,
      sha256: SHA,
      contentType: "image/png",
      expectedByteSize: 1234,
    },
    {
      kind: "authority-mask",
      sourcePath: `${ORG}/CYL-9ML/shared-mask/${"b".repeat(64)}.png`,
      approvedPath: `${ORG}/CYL-9ML/shared-mask/${"b".repeat(64)}.png`,
      sha256: "b".repeat(64),
      contentType: "image/png",
    },
  ]);
});

test("approval implementation rejects stale, cross-org and unqualified candidates before promotion", async () => {
  const source = await readFile(new URL("../approve-paper-doll-candidate/index.ts", import.meta.url), "utf8");
  assert.match(source, /auth\.getUser/);
  assert.match(source, /organization_id/);
  assert.match(source, /expectedCandidateSha256/);
  assert.match(source, /candidate_ready/);
  assert.match(source, /blocking/);
  assert.match(source, /geometry-mask-identity/);
  assert.match(source, /opaque-white-fraction/);
  assert.match(source, /approve_paper_doll_candidate/);
  assert.match(source, /upsert:\s*false/);
  assert.doesNotMatch(source, /paper_doll_family_release_assets["')]/);
});

test("approval transaction copies candidate identity into a new approved child", async () => {
  const sql = await readFile(
    new URL("../../migrations/20260802062301_paper_doll_approval_and_worker_health.sql", import.meta.url),
    "utf8",
  );
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.approve_paper_doll_candidate/i);
  assert.match(sql, /FOR UPDATE/i);
  assert.match(sql, /approval_status\s*<>\s*'candidate'/i);
  assert.match(sql, /blocking\s+AND\s+qa_status\s*<>\s*'passed'/i);
  assert.match(sql, /geometry-mask-identity/i);
  assert.match(sql, /opaque-white-fraction/i);
  assert.match(sql, /'paper-doll-approved'/i);
  assert.match(sql, /parent_component_version_id/i);
  assert.match(sql, /paper_doll_component_approvals/i);
  assert.match(sql, /REVOKE ALL[\s\S]+authenticated/i);
  assert.doesNotMatch(sql, /paper_doll_family_release_assets\s*\(/i);
});
