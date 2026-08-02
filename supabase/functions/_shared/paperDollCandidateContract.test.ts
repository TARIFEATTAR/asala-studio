import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  assertProviderModel,
  buildProviderDispatch,
  parsePaperDollCandidateRequest,
} from "./paperDollCandidateContract";

const ORGANIZATION_ID = "10000000-0000-4000-8000-000000000001";
const SHA = "a".repeat(64);

const asset = (name: string) => ({
  bucket: "paper-doll-sources",
  path: `${ORGANIZATION_ID}/CYL-9ML/${name}/${SHA}.png`,
  sha256: SHA,
  contentType: "image/png",
  byteSize: 100,
});

const request = {
  organizationId: ORGANIZATION_ID,
  requirementKey: "CYL-9ML:OVERCAP:MAT-GL",
  componentId: "20000000-0000-4000-8000-000000000002",
  parentComponentVersionId: "30000000-0000-4000-8000-000000000003",
  parentSha256: SHA,
  provider: "google",
  model: "gemini-3.1-flash-image",
  instruction: "Change only the phenolic-plastic surface coating to matte gold.",
  source: asset("source"),
  authoritativeMask: asset("authority"),
  editMask: asset("edit"),
  transform: { translateXPx: 0, translateYPx: 0, scaleX: 1, scaleY: 1 },
  selectionKind: "whole-layer",
};

test("provider/model pairs are exact and have no fallback alias", () => {
  assert.doesNotThrow(() => assertProviderModel("openai", "gpt-image-2"));
  assert.doesNotThrow(() => assertProviderModel("google", "gemini-3.1-flash-image"));
  assert.doesNotThrow(() => assertProviderModel("google", "gemini-3-pro-image"));
  assert.throws(() => assertProviderModel("openai", "gpt-image-1.5"), /not allowed/i);
  assert.throws(() => assertProviderModel("google", "gemini-3-pro-image-preview"), /not allowed/i);
  assert.throws(() => assertProviderModel("auto", "best"), /provider/i);
});

test("references precede prompt text in every network-provider dispatch", () => {
  const references = [
    { role: "source" as const, data: "c291cmNl", mimeType: "image/png" },
    { role: "authoritative-mask" as const, data: "bWFzaw==", mimeType: "image/png" },
  ];
  for (const [provider, model] of [
    ["openai", "gpt-image-2"],
    ["google", "gemini-3.1-flash-image"],
  ] as const) {
    const dispatch = buildProviderDispatch({ provider, model, instruction: request.instruction, references });
    assert.deepEqual(dispatch.orderedInputs.map((part) => part.type), ["image", "image", "text"]);
    assert.equal(dispatch.fallback, null);
  }
});

test("candidate request parser rejects cross-organization assets and asymmetric scale", () => {
  assert.equal(parsePaperDollCandidateRequest(request).model, "gemini-3.1-flash-image");
  assert.throws(() => parsePaperDollCandidateRequest({
    ...request,
    source: { ...request.source, path: `90000000-0000-4000-8000-000000000009/CYL-9ML/source/${SHA}.png` },
  }), /organization/i);
  assert.throws(() => parsePaperDollCandidateRequest({
    ...request,
    transform: { ...request.transform, scaleY: 1.01 },
  }), /asymmetric/i);
  assert.throws(() => parsePaperDollCandidateRequest({
    ...request,
    instruction: "Make this a brushed anodised aluminium cap.",
  }), /phenolic plastic/i);
});

test("manual candidate bytes use a separate immutable output reference", () => {
  assert.throws(() => parsePaperDollCandidateRequest({
    ...request, provider: "manual", model: "manual-v1",
  }), /manualOutput/i);
  const parsed = parsePaperDollCandidateRequest({
    ...request, provider: "manual", model: "manual-v1", manualOutput: asset("manual-output"),
  });
  assert.equal(parsed.source.path, request.source.path);
  assert.match(parsed.manualOutput?.path ?? "", /manual-output/);
});

test("candidate finalization is transactional and unavailable to browser roles", () => {
  const sql = readFileSync(new URL(
    "../../migrations/20260802055156_finalize_paper_doll_candidate_job.sql",
    import.meta.url,
  ), "utf8");
  assert.match(sql, /SECURITY INVOKER/i);
  assert.match(sql, /FOR UPDATE/i);
  assert.match(sql, /status = 'candidate_ready'/i);
  assert.match(sql, /REVOKE ALL[\s\S]*FROM PUBLIC, anon, authenticated/i);
  assert.match(sql, /GRANT EXECUTE[\s\S]*TO service_role/i);
});

test("edge intake queues only after JWT and RLS-backed identity checks", () => {
  const source = readFileSync(new URL(
    "../generate-paper-doll-candidate/index.ts",
    import.meta.url,
  ), "utf8");
  assert.match(source, /auth\.getUser/);
  assert.match(source, /paper_doll_components/);
  assert.match(source, /status:\s*"queued"/);
  assert.match(source, /geometryLocked:\s*false/);
  assert.doesNotMatch(source, /geometryLocked:\s*true/);
});

test("worker records attempts before dispatch and verifies bytes before transactional finalization", () => {
  const source = readFileSync(new URL(
    "../../../scripts/paper-doll/process-paper-doll-candidate.ts",
    import.meta.url,
  ), "utf8");
  assert.match(source, /beginGenerationAttempt[\s\S]*providerResult/);
  assert.match(source, /upsert:\s*false/);
  assert.match(source, /downloadVerified\(client, reference\)/);
  assert.match(source, /finalize_paper_doll_candidate_job/);
  assert.match(source, /paper_doll_worker_heartbeats/);
});
