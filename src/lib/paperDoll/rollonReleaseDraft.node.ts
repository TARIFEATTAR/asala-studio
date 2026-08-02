import { createHash } from "node:crypto";

import {
  PAPER_DOLL_RELEASE_CANVAS,
  parsePaperDollReleaseManifest,
  type PaperDollReleaseAsset,
  type PaperDollReleaseManifest,
  type PaperDollSlot,
} from "./releaseContract";
import type { Cyl9RollonRequirementSnapshot } from "./rollonRequirements";

export interface RollonReleaseInventoryVersion extends PaperDollReleaseAsset {
  requirementKey: string;
  blockingQaPassed: boolean;
  qaEvidenceIds: string[];
}

export interface RollonReleaseDisposition {
  requirementKey: string;
  status: "approved" | "blocked" | "missing";
  componentVersionId: string | null;
  issues: string[];
}

export interface RollonReleaseDraft {
  releaseStatus: "blocked" | "ready";
  counts: { required: number; approved: number; blocked: number; missing: number };
  dispositions: RollonReleaseDisposition[];
  blockers: string[];
  manifest: PaperDollReleaseManifest;
  manifestSha256: string;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalize(child)]),
    );
  }
  return value;
}

function sha256Canonical(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex");
}

function slotForRequirement(kind: string): PaperDollSlot {
  if (kind === "body" || kind === "overcap" || kind === "roller") return kind;
  throw new Error(`Unsupported CYL-9ML requirement kind: ${kind}`);
}

export function buildRollonReleaseDraft(input: {
  requirements: Cyl9RollonRequirementSnapshot;
  inventory: RollonReleaseInventoryVersion[];
  releaseVersion: string;
  sourceGitCommit: string;
  rendererVersion: string;
  rendererRecipeSha256?: string;
}): RollonReleaseDraft {
  const requirementByKey = new Map(input.requirements.requirements.map((requirement) => [requirement.requirementKey, requirement]));
  const unknownInventory = input.inventory.filter((version) => !requirementByKey.has(version.requirementKey));
  const blockers = unknownInventory.map((version) => `Unknown inventory requirement ${version.requirementKey} (${version.componentVersionId}).`);
  const assets: PaperDollReleaseAsset[] = [];
  const dispositions: RollonReleaseDisposition[] = input.requirements.requirements.map((requirement) => {
    const candidates = input.inventory.filter((version) => version.requirementKey === requirement.requirementKey);
    const approved = candidates.filter((version) => version.approvalStatus === "approved" && version.blockingQaPassed);
    if (approved.length === 1) {
      const selected = approved[0];
      if (selected.slot !== slotForRequirement(requirement.componentKind) || selected.variantKey !== requirement.variantKey) {
        const issue = `${requirement.requirementKey}: approved inventory identity does not match the requirement.`;
        blockers.push(issue);
        return { requirementKey: requirement.requirementKey, status: "blocked", componentVersionId: null, issues: [issue] };
      }
      assets.push({
        componentVersionId: selected.componentVersionId,
        componentKey: selected.componentKey,
        geometryFamilyId: selected.geometryFamilyId,
        slot: selected.slot,
        variantKey: selected.variantKey,
        materialVariant: selected.materialVariant,
        imagePath: selected.imagePath,
        imageSha256: selected.imageSha256,
        geometryMaskPath: selected.geometryMaskPath,
        geometryMaskSha256: selected.geometryMaskSha256,
        widthPx: selected.widthPx,
        heightPx: selected.heightPx,
        alphaBounds: selected.alphaBounds,
        mountAxisXPx: selected.mountAxisXPx,
        seatYPx: selected.seatYPx,
        approvalStatus: selected.approvalStatus,
      });
      return { requirementKey: requirement.requirementKey, status: "approved", componentVersionId: selected.componentVersionId, issues: [] };
    }
    if (approved.length > 1) {
      const issue = `${requirement.requirementKey}: multiple approved versions require an explicit selection.`;
      blockers.push(issue);
      return { requirementKey: requirement.requirementKey, status: "blocked", componentVersionId: null, issues: [issue] };
    }
    if (candidates.length > 0 || requirement.releaseStatus === "blocked") {
      const issues = candidates.flatMap((candidate) => candidate.blockingQaPassed ? [] : [`${candidate.componentVersionId} has not passed blocking QA.`]);
      if (issues.length === 0) issues.push(...requirement.blockers);
      const issue = `${requirement.requirementKey}: ${issues.join(" ") || "no approved version"}`;
      blockers.push(issue);
      return { requirementKey: requirement.requirementKey, status: "blocked", componentVersionId: null, issues };
    }
    const issue = `${requirement.requirementKey}: no inventory version exists.`;
    blockers.push(issue);
    return { requirementKey: requirement.requirementKey, status: "missing", componentVersionId: null, issues: [issue] };
  });

  for (const issue of input.requirements.knownIssues.filter((issue) => issue.severity === "blocking")) {
    blockers.push(`Requirement snapshot blocker ${issue.issueKey}: ${issue.summary}`);
  }

  const counts = {
    required: dispositions.length,
    approved: dispositions.filter((entry) => entry.status === "approved").length,
    blocked: dispositions.filter((entry) => entry.status === "blocked").length,
    missing: dispositions.filter((entry) => entry.status === "missing").length,
  };
  if (counts.approved + counts.blocked + counts.missing !== counts.required) {
    throw new Error("Roll-on release disposition counts do not reconcile.");
  }
  const releaseStatus = counts.approved === counts.required && blockers.length === 0 ? "ready" : "blocked";
  const qaEvidence = input.inventory
    .filter((version) => assets.some((asset) => asset.componentVersionId === version.componentVersionId))
    .flatMap((version) => version.qaEvidenceIds.map((evidenceId) => ({
      evidenceId,
      subjectId: version.componentVersionId,
      gateKey: "approved-blocking-qa",
      gateVersion: "inventory-v1",
      status: "passed" as const,
      blocking: true,
      calibratedWith: [`component-version:${version.componentVersionId}`],
      measurements: { blockingQaPassed: true },
      issues: [],
    })));

  const manifest = parsePaperDollReleaseManifest({
    schemaVersion: 1,
    familyKey: "CYL-9ML",
    releaseVersion: input.releaseVersion,
    status: releaseStatus,
    canvas: PAPER_DOLL_RELEASE_CANVAS,
    assets: assets.sort((left, right) => `${left.slot}:${left.variantKey}`.localeCompare(`${right.slot}:${right.variantKey}`)),
    assemblyRecipes: [{ recipeKey: "CYL-9ML:ROLLON", mode: "rollon", layerOrder: ["body", "roller", "overcap"] }],
    assemblyMappings: input.requirements.assemblyMappings.map((mapping) => ({
      mappingKey: mapping.mappingKey,
      websiteSku: mapping.websiteSku,
      graceSku: mapping.graceSku,
      recipeKey: "CYL-9ML:ROLLON",
      bodyVariantKey: mapping.bodyVariantKey,
      fitmentVariantKey: mapping.rollerVariantKey,
      closureVariantKey: null,
      overcapVariantKey: mapping.overcapVariantKey,
    })),
    qaEvidence,
    blockers: [...new Set(blockers)].sort(),
    provenance: {
      sourceGitCommit: input.sourceGitCommit,
      rendererVersion: input.rendererVersion,
      requirementsSha256: input.requirements.snapshotSha256,
      ...(input.rendererRecipeSha256 ? { rendererRecipeSha256: input.rendererRecipeSha256 } : {}),
    },
  });

  return {
    releaseStatus,
    counts,
    dispositions,
    blockers: manifest.blockers,
    manifest,
    manifestSha256: sha256Canonical(manifest),
  };
}
