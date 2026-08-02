import {
  canonicalizeReleaseValue,
  parsePaperDollReleaseManifest,
  type PaperDollReleaseAsset,
  type PaperDollReleaseManifest,
  type PaperDollQaEvidence,
} from "./releaseContract";
import {
  validatePaperDollRelease,
  type PaperDollReleaseValidation,
} from "./releaseValidator";

export interface PaperDollSanityTarget {
  projectId: string;
  dataset: string;
  documentId: string;
  documentType: "paperDollFamily";
}

type WithSanityKey<T> = T & { _key: string };

export interface PaperDollSanityDocument {
  _id: string;
  _type: "paperDollFamily";
  familyKey: string;
  schemaVersion: PaperDollReleaseManifest["schemaVersion"];
  releaseVersion: string;
  releaseStatus: PaperDollReleaseManifest["status"];
  manifestSha256: string;
  canvas: PaperDollReleaseManifest["canvas"];
  assets: Array<WithSanityKey<PaperDollReleaseAsset>>;
  assemblyRecipes: Array<WithSanityKey<PaperDollReleaseManifest["assemblyRecipes"][number]>>;
  assemblyMappings: Array<WithSanityKey<PaperDollReleaseManifest["assemblyMappings"][number]>>;
  qaEvidence: Array<WithSanityKey<PaperDollQaEvidence>>;
  blockers: string[];
  provenance: PaperDollReleaseManifest["provenance"];
}

export interface PaperDollSanityProjection {
  mode: "no-write-preview";
  target: PaperDollSanityTarget;
  document: PaperDollSanityDocument;
  manifestSha256: string;
  payloadSha256: string;
  validation: PaperDollReleaseValidation;
  roundTrip: { passed: boolean; issue: string | null };
  assetPlan: { upload: number; reuse: number; unresolved: number };
  publishEligible: false;
  publishBlockers: string[];
  writeCount: 0;
}

export const UNCONFIGURED_PAPER_DOLL_SANITY_TARGET: PaperDollSanityTarget = {
  projectId: "unconfigured",
  dataset: "unconfigured",
  documentId: "unconfigured",
  documentType: "paperDollFamily",
};

async function sha256Text(value: string): Promise<string> {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.subtle) throw new Error("Web Crypto SHA-256 is unavailable.");
  const digest = await cryptoApi.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function keyPart(value: string): string {
  const normalized = value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  if (!normalized) throw new Error(`Cannot create a stable Sanity key from '${value}'.`);
  return normalized;
}

function keyedAsset(asset: PaperDollReleaseAsset): WithSanityKey<PaperDollReleaseAsset> {
  return {
    _key: `asset-${keyPart(asset.slot)}-${keyPart(asset.variantKey)}-${asset.imageSha256.slice(0, 12)}`,
    ...asset,
  };
}

function keyedRecipe(
  recipe: PaperDollReleaseManifest["assemblyRecipes"][number],
): WithSanityKey<PaperDollReleaseManifest["assemblyRecipes"][number]> {
  return { _key: `recipe-${keyPart(recipe.recipeKey)}`, ...recipe };
}

function keyedMapping(
  mapping: PaperDollReleaseManifest["assemblyMappings"][number],
): WithSanityKey<PaperDollReleaseManifest["assemblyMappings"][number]> {
  return { _key: `mapping-${keyPart(mapping.mappingKey)}`, ...mapping };
}

function keyedEvidence(evidence: PaperDollQaEvidence): WithSanityKey<PaperDollQaEvidence> {
  return { _key: `evidence-${keyPart(evidence.evidenceId)}`, ...evidence };
}

function assertUniqueKeys(label: string, rows: Array<{ _key: string }>): void {
  const keys = new Set<string>();
  for (const row of rows) {
    if (keys.has(row._key)) throw new Error(`Duplicate ${label} Sanity _key '${row._key}'.`);
    keys.add(row._key);
  }
}

function stripKey<T extends { _key: string }>(value: T): Omit<T, "_key"> {
  const { _key: _ignored, ...rest } = value;
  return rest;
}

export function parseManifestFromPaperDollSanityDocument(
  document: PaperDollSanityDocument,
): PaperDollReleaseManifest {
  return parsePaperDollReleaseManifest({
    schemaVersion: document.schemaVersion,
    familyKey: document.familyKey,
    releaseVersion: document.releaseVersion,
    status: document.releaseStatus,
    canvas: document.canvas,
    assets: document.assets.map(stripKey),
    assemblyRecipes: document.assemblyRecipes.map(stripKey),
    assemblyMappings: document.assemblyMappings.map(stripKey),
    qaEvidence: document.qaEvidence.map(stripKey),
    blockers: document.blockers,
    provenance: document.provenance,
  });
}

export async function buildPaperDollSanityProjection(
  manifest: PaperDollReleaseManifest,
  target: PaperDollSanityTarget = UNCONFIGURED_PAPER_DOLL_SANITY_TARGET,
): Promise<PaperDollSanityProjection> {
  const parsedManifest = parsePaperDollReleaseManifest(manifest);
  const manifestSha256 = await sha256Text(canonicalizeReleaseValue(parsedManifest));
  const assets = parsedManifest.assets.map(keyedAsset);
  const assemblyRecipes = parsedManifest.assemblyRecipes.map(keyedRecipe);
  const assemblyMappings = parsedManifest.assemblyMappings.map(keyedMapping);
  const qaEvidence = parsedManifest.qaEvidence.map(keyedEvidence);
  assertUniqueKeys("asset", assets);
  assertUniqueKeys("recipe", assemblyRecipes);
  assertUniqueKeys("mapping", assemblyMappings);
  assertUniqueKeys("evidence", qaEvidence);

  const document: PaperDollSanityDocument = {
    _id: target.documentId,
    _type: target.documentType,
    familyKey: parsedManifest.familyKey,
    schemaVersion: parsedManifest.schemaVersion,
    releaseVersion: parsedManifest.releaseVersion,
    releaseStatus: parsedManifest.status,
    manifestSha256,
    canvas: parsedManifest.canvas,
    assets,
    assemblyRecipes,
    assemblyMappings,
    qaEvidence,
    blockers: parsedManifest.blockers,
    provenance: parsedManifest.provenance,
  };
  const payloadSha256 = await sha256Text(canonicalizeReleaseValue(document));
  const validation = validatePaperDollRelease(parsedManifest);

  let roundTrip: PaperDollSanityProjection["roundTrip"];
  try {
    const recovered = parseManifestFromPaperDollSanityDocument(document);
    const passed = canonicalizeReleaseValue(recovered) === canonicalizeReleaseValue(parsedManifest);
    roundTrip = {
      passed,
      issue: passed ? null : "Projected document did not reconstruct the canonical release manifest.",
    };
  } catch (error) {
    roundTrip = {
      passed: false,
      issue: error instanceof Error ? error.message : "Round-trip parsing failed.",
    };
  }

  const targetConfigured = Object.entries(target)
    .filter(([key]) => key !== "documentType")
    .every(([, value]) => value !== "unconfigured");
  const publishBlockers = [
    ...validation.blockers,
    ...(!roundTrip.passed ? [roundTrip.issue ?? "round_trip_failed"] : []),
    ...(!targetConfigured ? ["sanity_target_unconfigured"] : []),
    "named_approval_required",
    "server_authorization_required",
    "preview_is_no_write",
  ];

  return {
    mode: "no-write-preview",
    target,
    document,
    manifestSha256,
    payloadSha256,
    validation,
    roundTrip,
    assetPlan: { upload: 0, reuse: 0, unresolved: parsedManifest.assets.length },
    publishEligible: false,
    publishBlockers: [...new Set(publishBlockers)],
    writeCount: 0,
  };
}
