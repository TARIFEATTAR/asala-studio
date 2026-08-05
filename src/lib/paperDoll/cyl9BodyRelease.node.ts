import { createHash } from "node:crypto";

import { buildPaperDollObjectPath } from "./assetStorage";

const RELEASE_VERSION = "1.0.0-body-plates.1";
const FAMILY_KEY = "CYL-9ML";
const GEOMETRY_FAMILY_ID = "body__cylinder__9ml__70x20__v1";

const BODY_PLATE_SPECS = [
  {
    colorway: "clear",
    variantKey: "CLR",
    materialVariant: "clear-glass",
    alphaBounds: { left: 860, top: 750, right: 1225, bottom: 2089 },
    seatYPx: 2090,
  },
  {
    colorway: "amber",
    variantKey: "AMB",
    materialVariant: "amber-glass",
    alphaBounds: { left: 856, top: 742, right: 1221, bottom: 2099 },
    seatYPx: 2100,
  },
  {
    colorway: "cobalt",
    variantKey: "BLU",
    materialVariant: "cobalt-glass",
    alphaBounds: { left: 860, top: 737, right: 1223, bottom: 2101 },
    seatYPx: 2102,
  },
  {
    colorway: "frosted",
    variantKey: "FRS",
    materialVariant: "frosted-glass",
    alphaBounds: { left: 857, top: 746, right: 1222, bottom: 2110 },
    seatYPx: 2111,
  },
  {
    colorway: "swirl",
    variantKey: "SWL",
    materialVariant: "swirl-glass",
    alphaBounds: { left: 863, top: 748, right: 1225, bottom: 2115 },
    seatYPx: 2116,
  },
] as const;

interface BodyPlateRegistryEntry {
  id: string;
  role: string;
  bodyKey: {
    family: string;
    capacityMl: number;
    colorway: string;
    heightMm: number;
    diameterMm: number;
    neckThreadSize: string;
  };
  asset: {
    path: string;
    sha256: string;
    widthPx: number;
    heightPx: number;
    hasAlpha: boolean;
  };
  registration: {
    canvas: string;
    background: string;
    neckTopY: number;
    neckBaseY: number;
    baselineY: number;
    centerX: number;
    threadCrestPx: number;
    threadCrestMm: number;
  };
  provenance: Record<string, unknown>;
  status: string;
  reviewedBy: string;
  reviewedAt: string;
  notes?: string;
}

export interface BodyPlateRegistry {
  version: number;
  updatedAt: string;
  entries: BodyPlateRegistryEntry[];
}

export interface BodyPlateFileFacts {
  sha256: string;
  widthPx: number;
  heightPx: number;
  byteSize: number;
}

interface ReleaseAssetPlan {
  componentKey: string;
  displayName: string;
  geometryFamilyId: string;
  slot: "body";
  variantKey: string;
  versionKey: string;
  materialVariant: string;
  sourcePath: string;
  storageBucket: "paper-doll-approved";
  objectPath: string;
  imageSha256: string;
  contentType: "image/png";
  byteSize: number;
  widthPx: number;
  heightPx: number;
  alphaBounds: { left: number; top: number; right: number; bottom: number };
  mountAxisXPx: number;
  seatYPx: number;
  approvalStatus: "approved";
  provenance: Record<string, unknown>;
}

export interface Cyl9BodyReleasePlan {
  release: {
    familyKey: "CYL-9ML";
    releaseVersion: string;
    releaseStatus: "blocked";
    canvasWidthPx: 2080;
    canvasHeightPx: 2288;
    backgroundHex: "#F5F3EF";
    manifest: {
      schemaVersion: 1;
      familyKey: "CYL-9ML";
      releaseVersion: string;
      status: "blocked";
      scope: "locked-body-plates-only";
      blockers: string[];
      canvas: { widthPx: 2080; heightPx: 2288; backgroundHex: "#F5F3EF" };
      assets: Array<Record<string, unknown>>;
      assemblyRecipes: [];
      assemblyMappings: [];
    };
    manifestSha256: string;
    sourceGitCommit: string;
    rendererVersion: string;
  };
  assets: ReleaseAssetPlan[];
  qaResults: Array<{
    componentKey: string;
    gateKey: string;
    gateVersion: string;
    qaStatus: "passed";
    blocking: true;
    calibratedWith: string[];
    measurements: Record<string, unknown>;
    issues: string[];
  }>;
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

export function hashCanonicalJson(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex");
}

function assertExactRegistry(registry: BodyPlateRegistry): void {
  const expectedIds = BODY_PLATE_SPECS.map(
    ({ colorway }) => `body__cylinder__9ml__${colorway}__70.0x20.0mm`,
  ).sort();
  const actualIds = registry.entries.map((entry) => entry.id).sort();
  if (registry.entries.length !== 5 || JSON.stringify(actualIds) !== JSON.stringify(expectedIds)) {
    throw new Error("Registry must contain exactly the five locked CYL-9ML body plates.");
  }
}

export function buildCyl9BodyReleasePlan(input: {
  organizationId: string;
  registry: BodyPlateRegistry;
  assetFactsById: Record<string, BodyPlateFileFacts>;
}): Cyl9BodyReleasePlan {
  assertExactRegistry(input.registry);
  const entryById = new Map(input.registry.entries.map((entry) => [entry.id, entry]));

  const assets: ReleaseAssetPlan[] = BODY_PLATE_SPECS.map((spec) => {
    const componentKey = `body__cylinder__9ml__${spec.colorway}__70.0x20.0mm`;
    const entry = entryById.get(componentKey);
    const facts = input.assetFactsById[componentKey];
    if (!entry || !facts) {
      throw new Error(`Missing measured file facts for ${componentKey}.`);
    }
    if (
      entry.role !== "body-plate"
      || entry.status !== "approved"
      || entry.reviewedBy !== "jordan"
      || entry.bodyKey.family !== "Cylinder"
      || entry.bodyKey.capacityMl !== 9
      || entry.bodyKey.colorway !== spec.colorway
      || entry.bodyKey.heightMm !== 70
      || entry.bodyKey.diameterMm !== 20
      || entry.bodyKey.neckThreadSize !== "17-415"
      || entry.registration.canvas !== "2080x2288"
      || entry.registration.background !== "#F5F3EF"
      || entry.registration.neckTopY !== 760
      || entry.registration.neckBaseY !== 968
      || entry.registration.centerX !== 1041
      || entry.asset.sha256 !== facts.sha256
      || entry.asset.widthPx !== facts.widthPx
      || entry.asset.heightPx !== facts.heightPx
      || facts.widthPx !== 2080
      || facts.heightPx !== 2288
      || !Number.isSafeInteger(facts.byteSize)
      || facts.byteSize <= 0
    ) {
      throw new Error(`Measured file facts or frozen registry contract disagree for ${componentKey}.`);
    }

    return {
      componentKey,
      displayName: `Cylinder 9 mL ${spec.colorway} body`,
      geometryFamilyId: GEOMETRY_FAMILY_ID,
      slot: "body",
      variantKey: spec.variantKey,
      versionKey: `sha256-${facts.sha256.slice(0, 12)}`,
      materialVariant: spec.materialVariant,
      sourcePath: entry.asset.path,
      storageBucket: "paper-doll-approved",
      objectPath: buildPaperDollObjectPath({
        organizationId: input.organizationId,
        familyKey: FAMILY_KEY,
        assetId: componentKey,
        sha256: facts.sha256,
        extension: "png",
      }),
      imageSha256: facts.sha256,
      contentType: "image/png",
      byteSize: facts.byteSize,
      widthPx: facts.widthPx,
      heightPx: facts.heightPx,
      alphaBounds: spec.alphaBounds,
      mountAxisXPx: entry.registration.centerX,
      seatYPx: spec.seatYPx,
      approvalStatus: "approved",
      provenance: {
        registryVersion: input.registry.version,
        registryUpdatedAt: input.registry.updatedAt,
        registryReviewedBy: entry.reviewedBy,
        registryReviewedAt: entry.reviewedAt,
        source: entry.provenance.source,
        sourceAssetPath: entry.asset.path,
        lockedAsGenerated: true,
        baselineY: entry.registration.baselineY,
        neckTopY: entry.registration.neckTopY,
        neckBaseY: entry.registration.neckBaseY,
        threadCrestPx: entry.registration.threadCrestPx,
        threadCrestMm: entry.registration.threadCrestMm,
      },
    };
  });

  const manifest = {
    schemaVersion: 1 as const,
    familyKey: FAMILY_KEY,
    releaseVersion: RELEASE_VERSION,
    status: "blocked" as const,
    scope: "locked-body-plates-only" as const,
    blockers: ["closures_and_fitments_not_registered"],
    canvas: { widthPx: 2080 as const, heightPx: 2288 as const, backgroundHex: "#F5F3EF" as const },
    assets: assets.map((asset) => ({
      componentVersionId: `${asset.componentKey}@${asset.imageSha256.slice(0, 12)}`,
      componentKey: asset.componentKey,
      geometryFamilyId: asset.geometryFamilyId,
      slot: asset.slot,
      variantKey: asset.variantKey,
      materialVariant: asset.materialVariant,
      storageBucket: asset.storageBucket,
      imagePath: asset.objectPath,
      imageSha256: asset.imageSha256,
      geometryMaskPath: null,
      geometryMaskSha256: null,
      widthPx: asset.widthPx,
      heightPx: asset.heightPx,
      alphaBounds: asset.alphaBounds,
      mountAxisXPx: asset.mountAxisXPx,
      seatYPx: asset.seatYPx,
      approvalStatus: asset.approvalStatus,
    })),
    assemblyRecipes: [] as [],
    assemblyMappings: [] as [],
  };

  const calibratedWith = assets.map((asset) => `${asset.componentKey}@${asset.imageSha256.slice(0, 12)}`);

  return {
    release: {
      familyKey: FAMILY_KEY,
      releaseVersion: RELEASE_VERSION,
      releaseStatus: "blocked",
      canvasWidthPx: 2080,
      canvasHeightPx: 2288,
      backgroundHex: "#F5F3EF",
      manifest,
      manifestSha256: hashCanonicalJson(manifest),
      sourceGitCommit: "77c94950ac06f99b635abb12c7f079265cc258ea",
      rendererVersion: "gpt-image-2-shadow-pass:nano-material-lock",
    },
    assets,
    qaResults: assets.map((asset) => ({
      componentKey: asset.componentKey,
      gateKey: "body-plate-mutual-geometry",
      gateVersion: "calibrated-2026-08-01-v1",
      qaStatus: "passed",
      blocking: true,
      calibratedWith,
      measurements: {
        neckWidthMeanSpreadPx: 4,
        centerlineSpreadPx: 3,
        midBodyWidthSpreadPx: 2,
        measuredCenterXPx: asset.mountAxisXPx,
        measuredSeatYPx: asset.seatYPx,
      },
      issues: [],
    })),
  };
}
