export interface PaperDollApprovalRequest {
  organizationId: string;
  candidateComponentVersionId: string;
  expectedCandidateSha256: string;
  decision: "approved" | "rejected";
  approverDisplayName: string;
  evidenceIds: string[];
}

export type PaperDollApprovedCopy = {
  kind: "pixels" | "authority-mask";
  sourcePath: string;
  approvedPath: string;
  sha256: string;
  contentType: string;
  expectedByteSize?: number;
};

export function buildPaperDollApprovedCopyPlan(input: {
  organizationId: string;
  candidateComponentVersionId: string;
  imagePath: string;
  imageSha256: string;
  imageContentType: string;
  imageByteSize: number;
  geometryMaskPath: string;
  geometryMaskSha256: string;
}): PaperDollApprovedCopy[] {
  return [
    {
      kind: "pixels",
      sourcePath: input.imagePath,
      approvedPath: `${input.organizationId}/CYL-9ML/approved-${input.candidateComponentVersionId}/${input.imageSha256}.png`,
      sha256: input.imageSha256,
      contentType: input.imageContentType,
      expectedByteSize: input.imageByteSize,
    },
    {
      kind: "authority-mask",
      sourcePath: input.geometryMaskPath,
      approvedPath: input.geometryMaskPath,
      sha256: input.geometryMaskSha256,
      contentType: "image/png",
    },
  ];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256 = /^[a-f0-9]{64}$/;

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Approval request must be an object.");
  return value as Record<string, unknown>;
}

function uuid(value: unknown, field: string): string {
  if (typeof value !== "string" || !UUID.test(value)) throw new Error(`${field} must be a UUID.`);
  return value;
}

export function parsePaperDollApprovalRequest(value: unknown): PaperDollApprovalRequest {
  const input = record(value);
  const organizationId = uuid(input.organizationId, "organizationId");
  const candidateComponentVersionId = uuid(input.candidateComponentVersionId, "candidateComponentVersionId");
  if (typeof input.expectedCandidateSha256 !== "string" || !SHA256.test(input.expectedCandidateSha256)) {
    throw new Error("expectedCandidateSha256 must be a lowercase SHA-256.");
  }
  if (input.decision !== "approved" && input.decision !== "rejected") {
    throw new Error("decision must be approved or rejected.");
  }
  if (typeof input.approverDisplayName !== "string" || !input.approverDisplayName.trim() || input.approverDisplayName.length > 200) {
    throw new Error("approverDisplayName is required and must not exceed 200 characters.");
  }
  if (!Array.isArray(input.evidenceIds) || input.evidenceIds.length < 1) {
    throw new Error("At least one QA evidence ID is required.");
  }
  const evidenceIds = input.evidenceIds.map((id) => uuid(id, "evidenceIds"));
  if (new Set(evidenceIds).size !== evidenceIds.length) throw new Error("QA evidence IDs must be unique.");
  return {
    organizationId,
    candidateComponentVersionId,
    expectedCandidateSha256: input.expectedCandidateSha256,
    decision: input.decision,
    approverDisplayName: input.approverDisplayName.trim(),
    evidenceIds,
  };
}
