export type PaperDollLifecycleState =
  | "candidate"
  | "pixels-approved"
  | "family-fit-approved"
  | "placement-locked"
  | "released"
  | "sanity-draft"
  | "published"
  | "rejected";

export interface PaperDollActionIssue {
  field: string;
  message: string;
}

export class PaperDollActionError extends Error {
  constructor(
    public readonly status: 403 | 409 | 422,
    public readonly code: string,
    message: string,
    public readonly issues: PaperDollActionIssue[] = [],
  ) {
    super(message);
    this.name = "PaperDollActionError";
  }
}

interface NamedActionInput {
  userId: string;
  organizationMember: boolean;
  approvedByName: string;
  approvalNote: string;
}

export interface ApprovalRequest extends NamedActionInput {
  action: "pixels-approved" | "family-fit-approved";
  expectedLifecycleState: PaperDollLifecycleState;
  actualLifecycleState: PaperDollLifecycleState;
  expectedContentSha256: string;
  actualContentSha256: string;
  qa: { geometryLocked: boolean; minIoU: number; mismatchedPixels: number };
}

export interface PublicPublicationRequest extends NamedActionInput {
  downstreamScopeConfirmed: boolean;
  releaseCutId: string;
  successfulDraftReleaseCutId: string | null;
}

function issue(field: string, message: string): PaperDollActionIssue {
  return { field, message };
}

export function validateNamedAction(input: NamedActionInput): void {
  if (!input.userId.trim()) {
    throw new PaperDollActionError(
      403,
      "authentication_required",
      "Authenticated user is required.",
      [issue("userId", "Authenticated user is required.")],
    );
  }
  if (!input.organizationMember) {
    throw new PaperDollActionError(
      403,
      "organization_forbidden",
      "Organization membership is required.",
      [issue("organizationId", "User is not a member of this organization.")],
    );
  }
  if (!input.approvedByName.trim()) {
    throw new PaperDollActionError(
      422,
      "named_approver_required",
      "Named approver is required.",
      [issue("approvedByName", "Named approver is required.")],
    );
  }
  if (!input.approvalNote.trim()) {
    throw new PaperDollActionError(
      422,
      "approval_note_required",
      "Approval note is required.",
      [issue("approvalNote", "Approval note is required.")],
    );
  }
}

export function validateApprovalRequest(input: ApprovalRequest): void {
  validateNamedAction(input);
  if (input.actualLifecycleState !== input.expectedLifecycleState) {
    throw new PaperDollActionError(
      409,
      "stale_lifecycle_state",
      "Candidate lifecycle changed before this action completed.",
      [issue(
        "expectedLifecycleState",
        `Expected ${input.expectedLifecycleState}, received ${input.actualLifecycleState}.`,
      )],
    );
  }
  if (input.actualContentSha256 !== input.expectedContentSha256) {
    throw new PaperDollActionError(
      409,
      "stale_content_hash",
      "Candidate content hash changed before this action completed.",
      [issue("expectedContentSha256", "Candidate content hash is stale.")],
    );
  }
  if (
    input.action === "pixels-approved" &&
    (!input.qa.geometryLocked || input.qa.minIoU !== 1 ||
      input.qa.mismatchedPixels !== 0)
  ) {
    throw new PaperDollActionError(
      422,
      "exact_geometry_required",
      "Pixel approval requires exact geometry from authority-mask clamp evidence.",
      [issue(
        "qa",
        "Exact geometry requires IoU 1.0000 and zero mismatched alpha bytes.",
      )],
    );
  }
}

export function validatePublicPublicationRequest(
  input: PublicPublicationRequest,
): void {
  validateNamedAction(input);
  if (!input.downstreamScopeConfirmed) {
    throw new PaperDollActionError(
      422,
      "downstream_scope_unconfirmed",
      "Downstream catalog scope must be explicitly confirmed before public publication.",
      [issue(
        "downstreamScopeConfirmed",
        "Confirm the downstream catalog safely handles this release scope.",
      )],
    );
  }
  if (
    !input.successfulDraftReleaseCutId ||
    input.successfulDraftReleaseCutId !== input.releaseCutId
  ) {
    throw new PaperDollActionError(
      409,
      "matching_draft_required",
      "Public publication requires a successful Sanity draft sync for the same release cut.",
      [issue("releaseCutId", "No successful matching draft sync exists.")],
    );
  }
}

export function buildSanityMutation(input: {
  action: "draft" | "public";
  documentId: string;
  document: Record<string, unknown>;
}): {
  documentId: string;
  publicWrite: boolean;
  document: Record<string, unknown> & { _id: string };
} {
  const baseId = input.documentId.replace(/^drafts\./, "");
  if (!baseId.trim()) {
    throw new PaperDollActionError(
      422,
      "document_id_required",
      "Sanity document ID is required.",
      [
        issue("documentId", "Sanity document ID is required."),
      ],
    );
  }
  const documentId = input.action === "draft" ? `drafts.${baseId}` : baseId;
  return {
    documentId,
    publicWrite: input.action === "public",
    document: { ...input.document, _id: documentId },
  };
}

export function actionErrorBody(error: unknown): {
  status: number;
  body: { code: string; message: string; issues: PaperDollActionIssue[] };
} {
  if (error instanceof PaperDollActionError) {
    return {
      status: error.status,
      body: { code: error.code, message: error.message, issues: error.issues },
    };
  }
  return {
    status: 500,
    body: {
      code: "internal_error",
      message: "Unexpected paper-doll action failure.",
      issues: [],
    },
  };
}
