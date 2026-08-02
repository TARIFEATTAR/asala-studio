export interface PaperDollPlacementLockRequest {
  organizationId: string;
  familyKey: "CYL-9ML";
  fitmentGeometryKey: "fitment__roller-ball__17-415__v1";
  calibrationComponentVersionId: string;
  expectedAuthorityMaskSha256: string;
  canvas: { widthPx: 2080; heightPx: 2288 };
  transform: { translateXPx: number; translateYPx: number; uniformScale: number };
  compatibleBodyComponentVersionIds: string[];
  approverDisplayName: string;
  approvalNote: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256 = /^[a-f0-9]{64}$/;

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return value as Record<string, unknown>;
}

function uuid(value: unknown, label: string): string {
  if (typeof value !== "string" || !UUID.test(value)) throw new Error(`${label} must be a UUID.`);
  return value;
}

function finite(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${label} must be finite.`);
  return value;
}

export function parsePaperDollPlacementLockRequest(value: unknown): PaperDollPlacementLockRequest {
  const input = record(value, "Placement request");
  if (input.familyKey !== "CYL-9ML") throw new Error("familyKey must be CYL-9ML.");
  if (input.fitmentGeometryKey !== "fitment__roller-ball__17-415__v1") throw new Error("fitmentGeometryKey must match the registered CYL-9ML roller geometry family.");
  if (typeof input.expectedAuthorityMaskSha256 !== "string" || !SHA256.test(input.expectedAuthorityMaskSha256)) {
    throw new Error("expectedAuthorityMaskSha256 must be a lowercase SHA-256.");
  }
  const canvas = record(input.canvas, "canvas");
  if (canvas.widthPx !== 2080 || canvas.heightPx !== 2288) throw new Error("Placement canvas must be 2080x2288.");
  const transform = record(input.transform, "transform");
  const uniformScale = finite(transform.uniformScale, "uniformScale");
  if (uniformScale <= 0) throw new Error("uniformScale must be positive.");
  if (!Array.isArray(input.compatibleBodyComponentVersionIds) || input.compatibleBodyComponentVersionIds.length !== 5) {
    throw new Error("CYL-9ML placement requires five body versions.");
  }
  const bodyIds = input.compatibleBodyComponentVersionIds.map((id) => uuid(id, "compatibleBodyComponentVersionIds"));
  if (new Set(bodyIds).size !== 5) throw new Error("CYL-9ML body versions must be unique.");
  if (typeof input.approverDisplayName !== "string" || !input.approverDisplayName.trim() || input.approverDisplayName.length > 200) {
    throw new Error("approverDisplayName is required and must not exceed 200 characters.");
  }
  if (typeof input.approvalNote !== "string" || !input.approvalNote.trim() || input.approvalNote.length > 500) {
    throw new Error("approvalNote is required and must not exceed 500 characters.");
  }
  return {
    organizationId: uuid(input.organizationId, "organizationId"),
    familyKey: "CYL-9ML",
    fitmentGeometryKey: "fitment__roller-ball__17-415__v1",
    calibrationComponentVersionId: uuid(input.calibrationComponentVersionId, "calibrationComponentVersionId"),
    expectedAuthorityMaskSha256: input.expectedAuthorityMaskSha256,
    canvas: { widthPx: 2080, heightPx: 2288 },
    transform: {
      translateXPx: finite(transform.translateXPx, "translateXPx"),
      translateYPx: finite(transform.translateYPx, "translateYPx"),
      uniformScale,
    },
    compatibleBodyComponentVersionIds: bodyIds,
    approverDisplayName: input.approverDisplayName.trim(),
    approvalNote: input.approvalNote.trim(),
  };
}
