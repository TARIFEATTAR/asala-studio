import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { parsePaperDollApprovalRequest } from "./paperDollApprovalContract";

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

test("v2 approval implementation binds named lifecycle actions to exact candidate and QA identity", async () => {
  const source = await readFile(new URL("../approve-paper-doll-candidate/index.ts", import.meta.url), "utf8");
  assert.match(source, /createPaperDollActionContext/);
  assert.match(source, /organization_id/);
  assert.match(source, /expectedContentSha256/);
  assert.match(source, /expectedLifecycleState/);
  assert.match(source, /validateApprovalRequest/);
  assert.match(source, /geometryLocked/);
  assert.match(source, /mismatchedPixels/);
  assert.match(source, /paper_doll_approval_events/);
  assert.match(source, /paper_doll_component_versions/);
  assert.match(source, /image_sha256/);
  assert.match(source, /approval_status:\s*"approved"/);
  assert.doesNotMatch(source, /paper_doll_family_release_assets["')]/);
});

test("approval transaction copies candidate identity into a new approved child", async () => {
  const sql = await readFile(
    new URL("../../migrations/20260802063000_paper_doll_approval_and_worker_health.sql", import.meta.url),
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
