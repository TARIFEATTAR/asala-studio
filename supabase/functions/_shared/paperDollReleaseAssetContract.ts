import {
  PaperDollActionError,
} from "./paperDollLifecycle.ts";

type JsonRecord = Record<string, unknown>;

const releaseSlots = new Set(["body", "cap", "roller", "sprayer", "overcap", "pump"]);

function record(value: unknown, field: string): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new PaperDollActionError(422, "invalid_release_manifest", `${field} must be an object.`, [
      { field, message: `${field} must be an object.` },
    ]);
  }
  return value as JsonRecord;
}

function nonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new PaperDollActionError(422, "invalid_release_manifest", `${field} is required.`, [
      { field, message: `${field} is required.` },
    ]);
  }
  return value.trim();
}

function manifestBounds(value: unknown, field: string): JsonRecord {
  const bounds = record(value, field);
  for (const key of ["left", "top", "width", "height"]) {
    const number = Number(bounds[key]);
    if (!Number.isFinite(number) || ((key === "width" || key === "height") && number <= 0)) {
      throw new PaperDollActionError(422, "invalid_release_manifest", `${field}.${key} is invalid.`, [
        { field: `${field}.${key}`, message: `${field}.${key} is invalid.` },
      ]);
    }
  }
  return bounds;
}

export type DerivedReleaseAssetRow = {
  component_candidate_id: string | null;
  component_version_id: string;
  placement_version_id: string | null;
  slot: string;
  variant_key: string;
  source_bounds: JsonRecord | null;
  edit_bounds: JsonRecord | null;
  authority_bounds: JsonRecord | null;
  placement_bounds: JsonRecord | null;
};

export function deriveReleaseAssetRows(manifestValue: unknown): DerivedReleaseAssetRow[] {
  const manifest = record(manifestValue, "manifest");
  if (!Array.isArray(manifest.assets) || manifest.assets.length === 0) {
    throw new PaperDollActionError(422, "invalid_release_manifest", "manifest.assets must contain at least one asset.", [
      { field: "manifest.assets", message: "At least one reviewed asset is required." },
    ]);
  }

  const identities = new Set<string>();
  return manifest.assets.map((value, index) => {
    const asset = record(value, `manifest.assets.${index}`);
    const slot = nonEmptyString(asset.slot, `manifest.assets.${index}.slot`);
    if (!releaseSlots.has(slot)) {
      throw new PaperDollActionError(422, "invalid_release_slot", `manifest.assets.${index}.slot is unsupported.`, [
        { field: `manifest.assets.${index}.slot`, message: "Unsupported release slot." },
      ]);
    }
    const variantKey = nonEmptyString(asset.variantKey, `manifest.assets.${index}.variantKey`);
    const identity = `${slot}:${variantKey}`;
    if (identities.has(identity)) {
      throw new PaperDollActionError(422, "duplicate_release_asset", `Duplicate reviewed release asset ${identity}.`, [
        { field: `manifest.assets.${index}`, message: `Duplicate ${identity}.` },
      ]);
    }
    identities.add(identity);

    const componentVersionId = nonEmptyString(
      asset.componentVersionId,
      `manifest.assets.${index}.componentVersionId`,
    );
    if (slot === "body") {
      return {
        component_candidate_id: null,
        component_version_id: componentVersionId,
        placement_version_id: null,
        slot,
        variant_key: variantKey,
        source_bounds: null,
        edit_bounds: null,
        authority_bounds: null,
        placement_bounds: null,
      };
    }

    return {
      component_candidate_id: nonEmptyString(
        asset.candidateId ?? asset.componentCandidateId,
        `manifest.assets.${index}.candidateId`,
      ),
      component_version_id: componentVersionId,
      placement_version_id: nonEmptyString(
        asset.placementVersionId,
        `manifest.assets.${index}.placementVersionId`,
      ),
      slot,
      variant_key: variantKey,
      source_bounds: manifestBounds(
        asset.sourceBoundsPx ?? asset.sourceBounds,
        `manifest.assets.${index}.sourceBoundsPx`,
      ),
      edit_bounds: manifestBounds(
        asset.editBoundsPx ?? asset.editBounds,
        `manifest.assets.${index}.editBoundsPx`,
      ),
      authority_bounds: manifestBounds(
        asset.authorityBoundsPx ?? asset.authorityBounds,
        `manifest.assets.${index}.authorityBoundsPx`,
      ),
      placement_bounds: manifestBounds(
        asset.placementBoundsPx ?? asset.placementBounds,
        `manifest.assets.${index}.placementBoundsPx`,
      ),
    };
  });
}
