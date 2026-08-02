import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  CandidateApprovalRequestSchema,
  CandidateJobRequestSchema,
} from "./candidateJobContract";

const ORGANIZATION_ID = "10000000-0000-4000-8000-000000000001";
const COMPONENT_ID = "20000000-0000-4000-8000-000000000002";
const VERSION_ID = "30000000-0000-4000-8000-000000000003";
const QA_ID = "40000000-0000-4000-8000-000000000004";
const SHA256 = "a".repeat(64);

function asset(bucket: "paper-doll-sources" | "paper-doll-candidates" | "paper-doll-approved") {
  return {
    bucket,
    path: `${ORGANIZATION_ID}/CYL-9ML/test/${SHA256}.png`,
    sha256: SHA256,
    contentType: "image/png",
    byteSize: 1024,
  };
}

function validRequest() {
  return {
    organizationId: ORGANIZATION_ID,
    requirementKey: "CYL-9ML:OVERCAP:MAT-GL",
    componentId: COMPONENT_ID,
    parentComponentVersionId: VERSION_ID,
    parentSha256: SHA256,
    provider: "google",
    model: "gemini-3.1-flash-image",
    instruction: "Change only the phenolic-plastic coating to soft matte gold.",
    source: asset("paper-doll-sources"),
    authoritativeMask: asset("paper-doll-approved"),
    editMask: asset("paper-doll-sources"),
    transform: { translateXPx: 0, translateYPx: 0, scaleX: 1, scaleY: 1 },
  };
}

test("AI jobs require an immutable parent, exact provider, and both masks", () => {
  assert.equal(CandidateJobRequestSchema.safeParse(validRequest()).success, true);

  for (const missing of ["parentSha256", "authoritativeMask", "editMask"] as const) {
    const request: Record<string, unknown> = { ...validRequest() };
    delete request[missing];
    assert.equal(CandidateJobRequestSchema.safeParse(request).success, false, missing);
  }
});

test("auto provider, URLs, and asymmetric stretching fail closed", () => {
  assert.equal(CandidateJobRequestSchema.safeParse({ ...validRequest(), provider: "auto" }).success, false);
  assert.equal(CandidateJobRequestSchema.safeParse({
    ...validRequest(),
    source: { ...asset("paper-doll-sources"), path: "https://example.com/source.png" },
  }).success, false);
  assert.equal(CandidateJobRequestSchema.safeParse({
    ...validRequest(),
    transform: { translateXPx: 0, translateYPx: 0, scaleX: 1, scaleY: 1.01 },
  }).success, false);
});

test("preview and legacy image models fail closed instead of falling back", () => {
  assert.equal(CandidateJobRequestSchema.safeParse({
    ...validRequest(),
    model: "gemini-3-pro-image-preview",
  }).success, false);
  assert.equal(CandidateJobRequestSchema.safeParse({
    ...validRequest(),
    provider: "openai",
    model: "gpt-image-1.5",
  }).success, false);
});

test("overcap prompts reject aluminium-part fabrication language", () => {
  assert.equal(CandidateJobRequestSchema.safeParse({
    ...validRequest(),
    instruction: "Make this brushed anodized aluminum.",
  }).success, false);
});

test("manual uploads are explicit provider outputs and never replace the immutable source", () => {
  const manual = {
    ...validRequest(),
    provider: "manual",
    model: "manual-v1",
    manualOutput: asset("paper-doll-sources"),
  };
  assert.equal(CandidateJobRequestSchema.safeParse(manual).success, true);
  assert.equal(CandidateJobRequestSchema.safeParse({ ...manual, manualOutput: undefined }).success, false);
  assert.equal(CandidateJobRequestSchema.safeParse({ ...validRequest(), manualOutput: asset("paper-doll-sources") }).success, false);
});

test("named approval binds a decision to candidate SHA and QA evidence", () => {
  assert.equal(CandidateApprovalRequestSchema.safeParse({
    organizationId: ORGANIZATION_ID,
    candidateComponentVersionId: VERSION_ID,
    expectedCandidateSha256: SHA256,
    decision: "approved",
    approverDisplayName: "Jordan Richter",
    evidenceIds: [QA_ID],
  }).success, true);

  assert.equal(CandidateApprovalRequestSchema.safeParse({
    organizationId: ORGANIZATION_ID,
    candidateComponentVersionId: VERSION_ID,
    decision: "approved",
    approverDisplayName: "",
    evidenceIds: [],
  }).success, false);
});

test("candidate schema grants browser reads but no browser writes", () => {
  const sql = readFileSync(
    new URL("../../../supabase/migrations/20260802052230_paper_doll_candidate_jobs.sql", import.meta.url),
    "utf8",
  );

  assert.match(sql, /paper_doll_candidate_jobs ENABLE ROW LEVEL SECURITY/i);
  assert.match(sql, /paper_doll_component_approvals ENABLE ROW LEVEL SECURITY/i);
  assert.doesNotMatch(sql, /FOR (INSERT|UPDATE|DELETE) TO authenticated/i);
  assert.match(sql, /SECURITY INVOKER/i);
  assert.match(sql, /REVOKE ALL[\s\S]*FROM PUBLIC, anon/i);
  assert.match(sql, /GRANT SELECT[\s\S]*TO authenticated/i);
  assert.match(sql, /Paper-doll approvals are append-only/i);
});
