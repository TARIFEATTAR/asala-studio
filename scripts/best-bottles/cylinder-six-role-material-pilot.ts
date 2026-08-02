import { createHash } from "node:crypto";

import type { CylinderSixRolePilotArtifact } from "../../src/lib/bestBottlesCylinderSixRolePilot";
import {
  buildMaterialPilotCanonicalBodyScaleContract,
  type MaterialPilotAssetRole,
  type MaterialPilotScaleContract,
} from "../../supabase/functions/_shared/bestBottlesMaterialPilot";

export interface CylinderSixRoleMaterialProduct {
  websiteSku: string;
  graceSku: string | null;
  family: "Cylinder";
  capacityMl: number;
  assetRole: MaterialPilotAssetRole;
  canonicalTruth: Record<string, unknown>;
  canonicalTruthHash: string;
  prompt: string;
  promptHash: string;
  promptVersion:
    | "best-bottles-cylinder-cap-on-identity-prompt-v4-glass-only-material"
    | "best-bottles-cylinder-cap-off-sidecar-prompt-v7-body-material-mask";
  scaleContract: MaterialPilotScaleContract;
  references: Array<{
    kind: "product-truth" | "material-calibration";
    role: "cap-on-product-truth" | "sidecar-product-truth" | "material-calibration";
    locator: string;
    sha256: string;
    conditioning?: CylinderSixRolePilotArtifact["products"][number]["roles"]["pdpCapOffSidecar"]["conditioning"];
  }>;
  productionStatus: "ready" | "blocked";
  productionBlockers: string[];
}

export interface CylinderSixRoleMaterialPilotManifest {
  version: "cylinder-six-role-material-pilot-v1";
  sourceManifestVersion: CylinderSixRolePilotArtifact["version"];
  sourceManifestHash: string;
  canonicalMaster: CylinderSixRolePilotArtifact["canonicalMaster"];
  rendererPolicy: {
    active: ["openai-gpt-image-2"];
    future: ["google-nano-banana-2", "higgsfield-future"];
  };
  materialCalibration: CylinderSixRoleMaterialPilotOptions["materialCalibration"] & {
    identityRegionsExcluded: true;
    postGenerationMutationAllowed: false;
  };
  authorization: CylinderSixRolePilotArtifact["authorization"];
  products: CylinderSixRoleMaterialProduct[];
  attempts: Array<CylinderSixRoleMaterialProduct & {
    jobKey: string;
    rendererId: "openai-gpt-image-2";
    attemptOrdinal: 1;
  }>;
  sha256: string;
}

export interface CylinderSixRoleMaterialPilotOptions {
  materialCalibration: {
    locator: string;
    sha256: string;
    evidenceRecordLocator: string;
  };
  /**
   * Optional per-product/lane material canon resolver (subfamily x lane
   * swatches from the human-selected canon). Returns null to fall back to the
   * shared materialCalibration.
   */
  resolveMaterialCalibration?: (
    product: { websiteSku: string; capacityMl: number },
    assetRole: "cap-on" | "sidecar",
  ) => { locator: string; sha256: string; evidenceRecordLocator: string } | null;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => (
      `${JSON.stringify(key)}:${stableJson(record[key])}`
    )).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function promptFor(input: {
  websiteSku: string;
  graceSku: string | null;
  assetRole: MaterialPilotAssetRole;
  canonicalTruth: Record<string, unknown>;
  scaleContract: MaterialPilotScaleContract;
}): string {
  const roleDirectives = input.assetRole === "cap-on"
    ? [
      "PRESERVE THE EXACT ASSEMBLED CAP-ON TOPOLOGY IN THE CAP-ON PRODUCT-TRUTH REFERENCE.",
      "DO NOT REMOVE, DETACH, REPLACE, INFER, RECONSTRUCT, OR REDESIGN THE CAP OR CLOSURE.",
    ]
    : [
      "PRESERVE THE EXACT CAP-OFF BOTTLE, ATTACHED SPRAYER, AND DETACHED SIDECAR CAP TOPOLOGY IN THE SIDECAR PRODUCT-TRUTH REFERENCE.",
      "DO NOT ATTACH, ASSEMBLE, REPLACE, INFER, RECONSTRUCT, OR REDESIGN THE SIDECAR CAP.",
      "THE SIDECAR PRODUCT-TRUTH REFERENCE IS PRECONDITIONED ON THE NATIVE BONE CANVAS AT THE CANONICAL BODY SCALE AND BASELINE. MATCH ITS BOTTLE PLACEMENT, BODY HEIGHT, BODY WIDTH, AND BASELINE ONE-TO-ONE.",
      "A GENERATION-TIME ALPHA MASK IS APPLIED TO THIS FIRST REFERENCE. EDIT ONLY THE TRANSPARENT CANONICAL GLASS-BODY MATERIAL REGION. PRESERVE THE OPAQUE SPRAYER, CLOSURE, DETACHED SIDECAR CAP, BODY SILHOUETTE LIMITS, AND EVERY OPAQUE BONE-CANVAS PIXEL. DO NOT MOVE OR RESCALE ANY COMPONENT.",
    ];
  const scale = input.scaleContract;
  return [
    "BEST BOTTLES CYLINDER MATERIAL PILOT — ROLE-CLEAN SCALE-LOCKED V4",
    `SKU: ${input.websiteSku} / ${input.graceSku ?? "UNRESOLVED-GRACE-SKU"}`,
    `ROLE: ${input.assetRole}`,
    `CANONICAL GEOMETRY: ${stableJson(input.canonicalTruth)}`,
    ...roleDirectives,
    "THE ROLE-SPECIFIC PRODUCT-TRUTH REFERENCE EXCLUSIVELY CONTROLS PRODUCT IDENTITY, GLASS COLOR, COMPONENT DESIGN, CAP, FITMENT, AND TOPOLOGY.",
    "THE MATERIAL-CALIBRATION REFERENCE IS A PIXEL-PRESERVING CLEAR-GLASS SIDEWALL SWATCH. IT CONTAINS NO CAP, COLLAR, SPRAYER, OVERCAP, INTERNAL HARDWARE, OR DIP TUBE.",
    "THE MATERIAL-CALIBRATION REFERENCE CONTROLS ONLY PHYSICAL GLASS OPTICS, REFRACTION, EDGE DENSITY, REFLECTANCE, CURVATURE, AND STUDIO FINISH. IT IS NOT A PRODUCT SILHOUETTE. NEVER COPY IDENTITY, HARDWARE, INTERNAL FITMENT, OR PROPORTIONS FROM IT.",
    "RENDER THE COMPLETE 2080×2288 10:11 IMAGE NATIVELY ON UNIFORM BONE #F5F3EF.",
    "NO POST-GENERATION BACKGROUND PAINTING, FILLING, EXTENSION, MATTE, OR COMPOSITING.",
    "FRONT ORTHOGRAPHIC E-COMMERCE VIEW, SHARED GROUND BASELINE, SOFT NATURAL CONTACT SHADOW.",
    `BODY HEIGHT TARGET: ${scale.bodyTargetPx} PX; ACCEPTABLE QA RANGE ${scale.bodyTargetRangePx.min}-${scale.bodyTargetRangePx.max} PX.`,
    `BODY WIDTH TARGET: ${scale.bodyWidthTargetPx} PX; ACCEPTABLE QA RANGE ${scale.bodyWidthTargetRangePx.min}-${scale.bodyWidthTargetRangePx.max} PX.`,
    `BOTTLE BODY BASELINE: Y=${scale.baselineYPx} PX ON THE ${scale.canvasWidthPx}×${scale.canvasHeightPx} CANVAS.`,
    "MEASURE THE BOTTLE BODY ONLY. THE CLOSURE, SPRAYER, SHADOW, AND DETACHED SIDECAR CAP MUST NOT CHANGE PRIMARY BODY SCALE.",
    "PRESERVE THE CANONICAL BODY HEIGHT-TO-WIDTH RATIO. DO NOT STRETCH, SQUASH, OR NORMALIZE ALL SIZES TO THE SAME FILL HEIGHT.",
  ].join("\n");
}

export async function compileCylinderSixRoleMaterialPilot(
  source: CylinderSixRolePilotArtifact,
  options: CylinderSixRoleMaterialPilotOptions,
): Promise<CylinderSixRoleMaterialPilotManifest> {
  if (source.summary.productCount !== 6 || source.summary.roleSlotCount !== 12) {
    throw new Error("Six-role material pilot requires the sealed 6-product/12-role source.");
  }
  const material = options.materialCalibration;
  if (!material?.locator || !/^[a-f0-9]{64}$/i.test(material.sha256)) {
    throw new Error("A hashed glass-only material calibration is required.");
  }
  const products: CylinderSixRoleMaterialProduct[] = [];
  for (const product of source.products) {
    const canonicalTruth = {
      websiteSku: product.websiteSku,
      graceSku: product.graceSku,
      family: "Cylinder",
      capacityMl: product.capacityMl,
      canon_bodyHeightMm: product.canonicalGeometry.bodyHeightMm,
      canon_widthAxisMm: product.canonicalGeometry.widthMm,
      canon_secondAxisMm: product.canonicalGeometry.depthMm,
      canon_heightWithCapMm: product.canonicalGeometry.heightWithCapMm,
      canonicalMasterSha256: source.canonicalMaster.sha256,
    };
    const scaleContract = buildMaterialPilotCanonicalBodyScaleContract({
      capacityMl: product.capacityMl,
      canonBodyHeightMm: product.canonicalGeometry.bodyHeightMm,
      canonBodyWidthMm: product.canonicalGeometry.widthMm,
      canonAssembledHeightMm: product.canonicalGeometry.heightWithCapMm,
    });
    const roles = [
      {
        assetRole: "cap-on" as const,
        promptVersion: "best-bottles-cylinder-cap-on-identity-prompt-v4-glass-only-material" as const,
        referenceRole: "cap-on-product-truth" as const,
        reference: product.roles.identityCapOn,
      },
      {
        assetRole: "sidecar" as const,
        promptVersion: "best-bottles-cylinder-cap-off-sidecar-prompt-v7-body-material-mask" as const,
        referenceRole: "sidecar-product-truth" as const,
        reference: product.roles.pdpCapOffSidecar,
      },
    ];
    for (const role of roles) {
      const prompt = promptFor({
        websiteSku: product.websiteSku,
        graceSku: product.graceSku,
        assetRole: role.assetRole,
        canonicalTruth,
        scaleContract,
      });
      products.push({
        websiteSku: product.websiteSku,
        graceSku: product.graceSku,
        family: "Cylinder",
        capacityMl: product.capacityMl,
        assetRole: role.assetRole,
        canonicalTruth,
        canonicalTruthHash: sha256(stableJson(canonicalTruth)),
        prompt,
        promptHash: sha256(prompt),
        promptVersion: role.promptVersion,
        scaleContract,
        references: [
          {
            kind: "product-truth",
            role: role.referenceRole,
            locator: role.reference.locator,
            sha256: role.reference.sha256,
            ...(role.reference.conditioning
              ? { conditioning: role.reference.conditioning }
              : {}),
          },
          (() => {
            const resolved = options.resolveMaterialCalibration?.(
              { websiteSku: product.websiteSku, capacityMl: product.capacityMl },
              role.assetRole,
            ) ?? material;
            if (!/^[a-f0-9]{64}$/i.test(resolved.sha256)) {
              throw new Error(`Material canon swatch for ${product.websiteSku}/${role.assetRole} is missing its hash.`);
            }
            return {
              kind: "material-calibration" as const,
              role: "material-calibration" as const,
              locator: resolved.locator,
              sha256: resolved.sha256,
            };
          })(),
        ],
        productionStatus: product.productionStatus,
        productionBlockers: product.blockers,
      });
    }
  }
  const attempts = products.map((product) => ({
    ...product,
    jobKey: `${product.websiteSku}|${product.assetRole}`,
    rendererId: "openai-gpt-image-2" as const,
    attemptOrdinal: 1 as const,
  }));
  const unsigned = {
    version: "cylinder-six-role-material-pilot-v1" as const,
    sourceManifestVersion: source.version,
    sourceManifestHash: source.sha256,
    canonicalMaster: source.canonicalMaster,
    rendererPolicy: {
      active: ["openai-gpt-image-2"] as ["openai-gpt-image-2"],
      future: [
        "google-nano-banana-2",
        "higgsfield-future",
      ] as ["google-nano-banana-2", "higgsfield-future"],
    },
    materialCalibration: {
      ...material,
      identityRegionsExcluded: true as const,
      postGenerationMutationAllowed: false as const,
    },
    authorization: source.authorization,
    products,
    attempts,
  };
  return { ...unsigned, sha256: sha256(stableJson(unsigned)) };
}
