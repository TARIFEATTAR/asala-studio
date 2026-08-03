import assert from "node:assert/strict";
import test from "node:test";

import {
  cutPaperDollRelease,
  dryRunPaperDollSanityPublic,
  publishPaperDollSanityPublic,
} from "./releaseCutRepository";

const request = {
  organizationId: "4ab1ac72-cd7e-4faf-9152-5aa5f2862411",
  familyKey: "CYL-9ML" as const,
  expectedCurrentReleaseId: "4fc87a1b-9b7d-4555-ab03-00fa14ed6ba0",
  releaseVersion: "1.1.0-rollon-pair.1",
  selectedComponents: [{
    componentVersionId: "02161d6f-fb7c-4b44-ba98-a61500181529",
    slot: "roller" as const,
    variantKey: "PLASTIC",
    placementVersionId: "fbe551b9-19ca-4202-842c-06634fdae2da",
  }],
  compatibleBodyComponentVersionIds: [
    "11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222",
    "33333333-3333-4333-8333-333333333333", "44444444-4444-4444-8444-444444444444",
    "55555555-5555-4555-8555-555555555555",
  ],
  approverDisplayName: "Jordan Richter", approvalNote: "Approved", sourceGitCommit: "e63eeaf",
  rendererVersion: "paper-doll-release-cut-v1",
};

test("cutPaperDollRelease invokes the service boundary and parses the immutable result", async () => {
  const calls: unknown[] = [];
  const result = await cutPaperDollRelease({ functions: { async invoke(name, options) {
    calls.push({ name, options });
    return { data: {
      releaseId: "66666666-6666-4666-8666-666666666666",
      releaseCutId: "77777777-7777-4777-8777-777777777777",
      publishRunId: "88888888-8888-4888-8888-888888888888",
      manifestSha256: "a".repeat(64), releaseStatus: "blocked",
      readiness: { ready: 0, incomplete: 100 },
      draftDocumentId: "drafts.d5291f24-f02b-4fb7-aa99-78c5f63d8c9d", publicDocumentId: "d5291f24-f02b-4fb7-aa99-78c5f63d8c9d",
      sanityPublished: false,
    }, error: null };
  } } }, request);
  assert.equal(calls[0] && (calls[0] as { name: string }).name, "cut-paper-doll-release");
  assert.equal(result.readiness.incomplete, 100);
  assert.equal(result.sanityPublished, false);
});

test("cutPaperDollRelease surfaces the Edge response error body", async () => {
  await assert.rejects(cutPaperDollRelease({ functions: { async invoke() {
    return { data: null, error: { message: "non-2xx", context: { async json() { return { error: "Current Release changed; refresh before cutting" }; } } } };
  } } }, request), /Current Release changed/);
});

test("public publication is two explicit calls bound to the exact dry-run SHA", async () => {
  const calls: Array<{ name: string; options: { body: unknown } }> = [];
  const client = { functions: { async invoke(name: string, options: { body: unknown }) {
    calls.push({ name, options });
    if ((options.body as { mode: string }).mode === "dry-run") return { data: {
      dryRunId: "99999999-9999-4999-8999-999999999999",
      draftSha256: "b".repeat(64), currentPublicSha256: null, changed: true,
      readiness: { ready: 100, incomplete: 0, total: 100 }, publicPublished: false,
    }, error: null };
    return { data: {
      publishRunId: "99999999-9999-4999-8999-999999999999",
      documentId: "d5291f24-f02b-4fb7-aa99-78c5f63d8c9d", status: "published",
      draftSha256: "b".repeat(64), publicPublished: true,
    }, error: null };
  } } };
  const dryRun = await dryRunPaperDollSanityPublic(client, {
    organizationId: request.organizationId,
    releaseCutId: "77777777-7777-4777-8777-777777777777",
  });
  assert.equal(dryRun.publicPublished, false);
  const published = await publishPaperDollSanityPublic(client, {
    organizationId: request.organizationId,
    releaseCutId: "77777777-7777-4777-8777-777777777777",
    dryRunId: dryRun.dryRunId,
    expectedDraftSha256: dryRun.draftSha256,
    approverDisplayName: "Jordan Richter",
    approvalNote: "Approved for public catalog",
  });
  assert.equal(published.publicPublished, true);
  assert.equal(calls.length, 2);
  assert.equal((calls[1].options.body as { expectedDraftSha256: string }).expectedDraftSha256, "b".repeat(64));
});
