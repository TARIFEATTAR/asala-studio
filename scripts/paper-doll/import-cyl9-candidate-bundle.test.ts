import assert from "node:assert/strict";
import { test } from "node:test";

import {
  assertImportCandidateBundleAuthorization,
  buildCandidateImportDryRun,
  parseImportCandidateBundleArgs,
  uuidFromSha256,
} from "./import-cyl9-candidate-bundle";

test("candidate bundle import is dry-run only by default", async () => {
  const options = parseImportCandidateBundleArgs([]);
  assert.equal(options.execute, false);
  assert.doesNotThrow(() => assertImportCandidateBundleAuthorization(options));
  const plan = await buildCandidateImportDryRun(options);
  assert.equal(plan.candidateCount, 23);
  assert.equal(plan.mode, "dry-run");
  assert.deepEqual(plan.forbiddenMutations, ["approval", "placement", "current-release", "sanity-draft", "public-publication"]);
});

test("remote import requires two write flags, exact confirmation, organization, and user", () => {
  const base = parseImportCandidateBundleArgs(["--execute"]);
  assert.throws(() => assertImportCandidateBundleAuthorization(base), /allow-remote-write/);
  const authorized = parseImportCandidateBundleArgs([
    "--execute", "--allow-remote-write", "--confirmation", "CYL9-CANDIDATE-IMPORT",
    "--organization-id", "11111111-1111-4111-8111-111111111111",
    "--requested-by", "22222222-2222-4222-8222-222222222222",
  ]);
  assert.doesNotThrow(() => assertImportCandidateBundleAuthorization(authorized));
});

test("content-addressed UUIDs are stable and namespace-specific", () => {
  const sha = "a".repeat(64);
  const candidate = uuidFromSha256(sha, "candidate");
  assert.equal(candidate, uuidFromSha256(sha, "candidate"));
  assert.notEqual(candidate, uuidFromSha256(sha, "request"));
  assert.match(candidate, /^[0-9a-f-]{36}$/);
});
