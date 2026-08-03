export type ReleaseCutComponent = {
  componentVersionId: string;
  slot: "body" | "cap" | "roller" | "sprayer" | "overcap" | "pump";
  variantKey: string;
  placementVersionId?: string | null;
};

export type ReleaseCutRequest = {
  organizationId: string;
  familyKey: "CYL-9ML";
  expectedCurrentReleaseId: string;
  releaseVersion: string;
  selectedComponents: ReleaseCutComponent[];
  compatibleBodyComponentVersionIds: string[];
  approverDisplayName: string;
  approvalNote: string;
  sourceGitCommit: string;
  rendererVersion: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLOTS = new Set(["body", "cap", "roller", "sprayer", "overcap", "pump"]);

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return value as Record<string, unknown>;
}

function uuid(value: unknown, label: string): string {
  if (typeof value !== "string" || !UUID.test(value)) throw new Error(`${label} must be a UUID.`);
  return value;
}

function text(value: unknown, label: string, max: number): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new Error(`${label} is required.`);
  return value.trim();
}

export function parseReleaseCutRequest(value: unknown): ReleaseCutRequest {
  const input = record(value, "Release cut request");
  if (input.familyKey !== "CYL-9ML") throw new Error("familyKey must be CYL-9ML.");
  if (!Array.isArray(input.selectedComponents) || input.selectedComponents.length < 1 || input.selectedComponents.length > 100) {
    throw new Error("At least one selected component is required.");
  }
  const selectedComponents = input.selectedComponents.map((raw, index) => {
    const item = record(raw, `selectedComponents[${index}]`);
    if (typeof item.slot !== "string" || !SLOTS.has(item.slot)) throw new Error(`selectedComponents[${index}].slot is invalid.`);
    return {
      componentVersionId: uuid(item.componentVersionId, `selectedComponents[${index}].componentVersionId`),
      slot: item.slot as ReleaseCutComponent["slot"],
      variantKey: text(item.variantKey, `selectedComponents[${index}].variantKey`, 100),
      placementVersionId: item.placementVersionId == null ? null : uuid(item.placementVersionId, `selectedComponents[${index}].placementVersionId`),
    };
  });
  const keys = selectedComponents.map((item) => `${item.slot}:${item.variantKey}`);
  if (new Set(keys).size !== keys.length) throw new Error("Each selected slot and variant must be unique.");
  if (new Set(selectedComponents.map((item) => item.componentVersionId)).size !== selectedComponents.length) {
    throw new Error("Each selected component version must be unique.");
  }
  if (!Array.isArray(input.compatibleBodyComponentVersionIds) || input.compatibleBodyComponentVersionIds.length !== 5) {
    throw new Error("Five body versions are required.");
  }
  const bodyIds = input.compatibleBodyComponentVersionIds.map((id) => uuid(id, "compatibleBodyComponentVersionIds"));
  if (new Set(bodyIds).size !== 5) throw new Error("The five body versions must be unique.");
  return {
    organizationId: uuid(input.organizationId, "organizationId"),
    familyKey: "CYL-9ML",
    expectedCurrentReleaseId: uuid(input.expectedCurrentReleaseId, "expectedCurrentReleaseId"),
    releaseVersion: text(input.releaseVersion, "releaseVersion", 200),
    selectedComponents,
    compatibleBodyComponentVersionIds: bodyIds,
    approverDisplayName: text(input.approverDisplayName, "approverDisplayName", 200),
    approvalNote: text(input.approvalNote, "approvalNote", 1000),
    sourceGitCommit: text(input.sourceGitCommit, "sourceGitCommit", 200),
    rendererVersion: text(input.rendererVersion, "rendererVersion", 200),
  };
}
