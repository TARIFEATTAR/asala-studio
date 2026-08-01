import assert from "node:assert/strict";
import test from "node:test";

import { releaseVerificationExitCode } from "./verify-family-release";

test("ready releases exit successfully", () => {
  assert.equal(releaseVerificationExitCode({ ready: true, blockers: [] }), 0);
});

test("the isolated translucent assembly-context block exits two", () => {
  assert.equal(releaseVerificationExitCode({
    ready: false,
    blockers: ["assembly_context_required:x"],
  }), 2);
});

test("unexpected release-integrity blockers exit one", () => {
  assert.equal(releaseVerificationExitCode({
    ready: false,
    blockers: ["duplicate_asset:cap:SHN-SL"],
  }), 1);
});

test("inconsistent readiness states fail closed", () => {
  assert.equal(releaseVerificationExitCode({ ready: true, blockers: ["assembly_context_required:x"] }), 1);
  assert.equal(releaseVerificationExitCode({ ready: false, blockers: [] }), 1);
});
