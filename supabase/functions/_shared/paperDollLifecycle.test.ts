import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";

import {
  buildSanityMutation,
  PaperDollActionError,
  validateApprovalRequest,
  validatePublicPublicationRequest,
} from "./paperDollLifecycle.ts";

const baseApproval = {
  action: "pixels-approved" as const,
  userId: "user-1",
  organizationMember: true,
  approvedByName: "Jordan Richter",
  approvalNote: "Approved against the five-body lineup.",
  expectedLifecycleState: "candidate" as const,
  actualLifecycleState: "candidate" as const,
  expectedContentSha256: "a".repeat(64),
  actualContentSha256: "a".repeat(64),
  qa: { geometryLocked: true, minIoU: 1, mismatchedPixels: 0 },
};

Deno.test("pixel approval requires exact geometry QA and a named approver", () => {
  const exactGeometryError = assertThrows(
    () =>
      validateApprovalRequest({
        ...baseApproval,
        qa: { geometryLocked: false, minIoU: 0.999, mismatchedPixels: 4 },
      }),
    PaperDollActionError,
    "exact geometry",
  ) as PaperDollActionError;
  assertEquals(exactGeometryError.status, 422);

  const namedError = assertThrows(
    () => validateApprovalRequest({ ...baseApproval, approvedByName: "" }),
    PaperDollActionError,
    "Named approver",
  ) as PaperDollActionError;
  assertEquals(namedError.issues[0].field, "approvedByName");
});

Deno.test("authorization, stale state, and stale hashes have stable statuses", () => {
  const forbidden = assertThrows(
    () =>
      validateApprovalRequest({ ...baseApproval, organizationMember: false }),
    PaperDollActionError,
  ) as PaperDollActionError;
  assertEquals([forbidden.status, forbidden.code], [
    403,
    "organization_forbidden",
  ]);

  const staleState = assertThrows(
    () =>
      validateApprovalRequest({
        ...baseApproval,
        actualLifecycleState: "pixels-approved",
      }),
    PaperDollActionError,
  ) as PaperDollActionError;
  assertEquals([staleState.status, staleState.code], [
    409,
    "stale_lifecycle_state",
  ]);

  const staleHash = assertThrows(
    () =>
      validateApprovalRequest({
        ...baseApproval,
        actualContentSha256: "b".repeat(64),
      }),
    PaperDollActionError,
  ) as PaperDollActionError;
  assertEquals([staleHash.status, staleHash.code], [409, "stale_content_hash"]);
});

Deno.test("draft sync can never target or publish a public document", () => {
  const operation = buildSanityMutation({
    action: "draft",
    documentId: "d5291f24-f02b-4fb7-aa99-78c5f63d8c9d",
    document: { _type: "paperDollFamily", familyKey: "CYL-9ML" },
  });
  assertEquals(
    operation.documentId,
    "drafts.d5291f24-f02b-4fb7-aa99-78c5f63d8c9d",
  );
  assertEquals(operation.publicWrite, false);
});

Deno.test("public publication requires a second named action and matching successful draft", () => {
  const error = assertThrows(
    () =>
      validatePublicPublicationRequest({
        userId: "user-1",
        organizationMember: true,
        approvedByName: "Jordan Richter",
        approvalNote: "Publish complete roll-on scope.",
        downstreamScopeConfirmed: false,
        releaseCutId: "cut-1",
        successfulDraftReleaseCutId: "cut-1",
      }),
    PaperDollActionError,
  ) as PaperDollActionError;
  assertEquals([error.status, error.code], [
    422,
    "downstream_scope_unconfirmed",
  ]);

  validatePublicPublicationRequest({
    userId: "user-1",
    organizationMember: true,
    approvedByName: "Jordan Richter",
    approvalNote: "Publish complete roll-on scope.",
    downstreamScopeConfirmed: true,
    releaseCutId: "cut-1",
    successfulDraftReleaseCutId: "cut-1",
  });
});
