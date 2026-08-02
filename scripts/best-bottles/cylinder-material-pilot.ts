import type {
  MaterialPilotAssetRole,
  MaterialPilotRendererId,
  MaterialPilotScaleContract,
} from "../../supabase/functions/_shared/bestBottlesMaterialPilot.ts";
import {
  buildMaterialPilotScaleContract,
} from "../../supabase/functions/_shared/bestBottlesMaterialPilot.ts";

const COHORT = [
  "GBCylBlu5SpryBlkSh",
  "GBCylBlu5MtlRollBlkSh",
  "GBMtlRoll28Blk",
  "GBCyl100RdcrBlkLthr",
  "GBCylBlu5BlkSht",
  "GBCyl5WhtSht",
  "GBCyl100AnSpBlk",
  "GBCyl100AnSpWht",
] as const;
const RENDERERS: MaterialPilotRendererId[] = [
  "openai-gpt-image-2",
  "google-nano-banana-2",
];

interface SourceJob {
  jobId: string;
  role: "identity-cap-on" | "pdp-cap-off-sidecar";
  productReference: {
    locator: string;
    sha256: string;
    verifiedBytesSha256: string;
  };
  promptContract: { version: string; directives: string[] };
  materialAuthority?: {
    calibrationUrl: string;
    calibrationBytesSha256: string;
  };
}
interface SourceRow {
  websiteSku: string;
  graceSku: string;
  canonicalFamily: string;
  canonical: Record<string, unknown>;
  jobs: SourceJob[];
}
interface SourcePlan {
  version: string;
  sha256: string;
  rows: SourceRow[];
}

export interface PilotCompiledReference {
  kind: "product-truth" | "material-calibration";
  role:
    | "cap-on-product-truth"
    | "sidecar-product-truth"
    | "material-calibration";
  locator: string;
  sha256: string;
  conditioning?: MaterialPilotReferenceConditioningEvidence;
}

export interface MaterialPilotReferenceConditioningEvidence {
  version: "best-bottles-material-reference-conditioning-v1";
  websiteSku: string;
  sourceSha256: string;
  outputPath: string;
  outputSha256: string;
  operation: "pre-generation-product-truth-conditioning";
  postGenerationMutationAllowed: false;
  scaleContractVersion: MaterialPilotScaleContract["version"];
  scaleContractBaselineYPx?: number;
  rendererBaselinePrecompensationPx?: number;
}

export interface CylinderMaterialPilotCompileOptions {
  conditionedReferences?: Record<
    string,
    MaterialPilotReferenceConditioningEvidence
  >;
}
export interface PilotCompiledProduct {
  websiteSku: string;
  graceSku: string;
  family: string;
  assetRole: MaterialPilotAssetRole;
  canonicalTruth: Record<string, unknown>;
  canonicalTruthHash: string;
  prompt: string;
  promptHash: string;
  promptVersion: string;
  scaleContract: MaterialPilotScaleContract;
  references: PilotCompiledReference[];
}
export interface PilotCompiledAttempt extends PilotCompiledProduct {
  jobKey: string;
  rendererId: MaterialPilotRendererId;
  attemptOrdinal: number;
}
export interface CylinderMaterialPilotManifest {
  version: "cylinder-material-pilot-v3";
  sourcePlanVersion: string;
  sourcePlanHash: string;
  products: PilotCompiledProduct[];
  attempts: PilotCompiledAttempt[];
}

export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${
      Object.keys(record).sort().map((key) =>
        `${JSON.stringify(key)}:${stableStringify(record[key])}`
      ).join(",")
    }}`;
  }
  return JSON.stringify(value);
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((part) =>
    part.toString(16).padStart(2, "0")
  ).join("");
}

function canonicalNumber(
  canonical: Record<string, unknown>,
  key: string,
): number {
  const value = Number(canonical[key]);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${canonical.websiteSku ?? "Cylinder row"} lacks ${key}.`);
  }
  return value;
}

function scaleContractFor(row: SourceRow): MaterialPilotScaleContract {
  return buildMaterialPilotScaleContract({
    capacityMl: canonicalNumber(row.canonical, "capacityMl"),
    canonBodyHeightMm: canonicalNumber(
      row.canonical,
      "canon_bodyHeightMm",
    ),
    canonBodyWidthMm: canonicalNumber(
      row.canonical,
      "canon_widthAxisMm",
    ),
    canonAssembledHeightMm: canonicalNumber(
      row.canonical,
      "canon_heightWithCapMm",
    ),
  });
}

function promptFor(
  row: SourceRow,
  job: SourceJob,
  scale: MaterialPilotScaleContract,
  conditioning?: MaterialPilotReferenceConditioningEvidence,
): string {
  return [
    "BEST BOTTLES CYLINDER MATERIAL PILOT — ROLE-CLEAN SCALE-LOCKED V2",
    `SKU: ${row.websiteSku} / ${row.graceSku}`,
    `CANONICAL GEOMETRY: ${stableStringify(row.canonical)}`,
    ...job.promptContract.directives.map((directive) =>
      directive.toUpperCase()
    ),
    "RENDER THE COMPLETE 2080×2288 10:11 IMAGE NATIVELY ON UNIFORM BONE #F5F3EF.",
    "NO POST-GENERATION BACKGROUND PAINTING, FILLING, EXTENSION, MATTE, OR COMPOSITING.",
    "PRESERVE THE EXACT PRODUCT ROLE AND COMPONENT TOPOLOGY FROM THE PRODUCT-TRUTH REFERENCE.",
    "THE MATERIAL-CALIBRATION REFERENCE CONTROLS OPTICAL REALISM ONLY AND NEVER PRODUCT IDENTITY.",
    "ONE PRODUCT, FRONT ORTHOGRAPHIC E-COMMERCE VIEW, SHARED GROUND BASELINE, SOFT NATURAL CONTACT SHADOW.",
    "COMPARATIVE SCALE LOCK — BEST-BOTTLES-CATALOG-SCALE-V1:",
    `- NATIVE CANVAS: ${scale.canvasWidthPx}×${scale.canvasHeightPx} PX.`,
    `- ASSEMBLED PRODUCT HEIGHT TARGET: ${scale.assembledTargetPx} PX (${scale.assembledTargetPct}% OF CANVAS HEIGHT).`,
    `- CANONICAL BOTTLE BODY HEIGHT TARGET: ${scale.bodyTargetPx} PX; ACCEPTABLE QA RANGE ${scale.bodyTargetRangePx.min}-${scale.bodyTargetRangePx.max} PX.`,
    `- CANONICAL BOTTLE BODY WIDTH TARGET: ${scale.bodyWidthTargetPx} PX; ACCEPTABLE QA RANGE ${scale.bodyWidthTargetRangePx.min}-${scale.bodyWidthTargetRangePx.max} PX.`,
    `- SEAT THE BOTTLE BODY BASE ON THE SHARED BASELINE AT Y=${scale.baselineYPx} PX (${scale.baselinePct}% UP FROM THE BOTTOM).`,
    "- MEASURE THE BOTTLE BODY ONLY. THE CLOSURE, FITMENT, SHADOW, AND DETACHED SIDECAR CAP MUST NOT CHANGE THE PRIMARY BODY SCALE.",
    "- DO NOT NORMALIZE EVERY SKU TO THE SAME FILL HEIGHT. A REGULAR 9 ML CYLINDER MUST RENDER VISIBLY TALLER THAN A 5 ML CYLINDER ON THIS SHARED CURVE.",
    "- PRESERVE THE EXACT CANONICAL BODY HEIGHT-TO-WIDTH RATIO; DO NOT STRETCH OR SQUASH THE BOTTLE TO HIT ONE AXIS.",
    ...(conditioning
      ? [
        "THE PRODUCT-TRUTH REFERENCE WAS PRE-CONDITIONED BEFORE GENERATION ON THE NATIVE BONE CANVAS TO THIS EXACT CANONICAL SCALE AND BASELINE.",
        conditioning.rendererBaselinePrecompensationPx
          ? "DO NOT REFRAME, ENLARGE, SHRINK, OR RECENTER THE PRODUCT-TRUTH REFERENCE. UPGRADE MATERIAL REALISM IN PLACE AND APPLY ONLY THE RECORDED VERTICAL BASELINE CORRECTION."
          : "DO NOT REFRAME, ENLARGE, SHRINK, RECENTER, OR MOVE THE PRODUCT-TRUTH REFERENCE. UPGRADE MATERIAL REALISM IN PLACE.",
        ...(conditioning.rendererBaselinePrecompensationPx
          ? [
            `THE REFERENCE INCLUDES A MEASURED ${conditioning.rendererBaselinePrecompensationPx} PX RENDERER BASELINE PRECOMPENSATION. THE FINAL BOTTLE BASE MUST LAND AT Y=${scale.baselineYPx} PX; DO NOT RETAIN THE PRECOMPENSATION AS OUTPUT OFFSET.`,
          ]
          : []),
      ]
      : []),
  ].join("\n");
}

export async function compileCylinderMaterialPilotManifest(
  plan: SourcePlan,
  options: CylinderMaterialPilotCompileOptions = {},
): Promise<CylinderMaterialPilotManifest> {
  const products: PilotCompiledProduct[] = [];
  for (const websiteSku of COHORT) {
    const row = plan.rows.find((candidate) =>
      candidate.websiteSku === websiteSku
    );
    if (!row) throw new Error(`Missing cohort identity ${websiteSku}`);
    if (!/^(?:Tall )?Cylinder$/.test(row.canonicalFamily)) {
      throw new Error(`Non-Cylinder cohort identity ${websiteSku}`);
    }
    if (row.jobs.length !== 1) {
      throw new Error(`${websiteSku} must expose exactly one role-locked job`);
    }
    const job = row.jobs[0];
    const assetRole: MaterialPilotAssetRole = job.role === "identity-cap-on"
      ? "cap-on"
      : "sidecar";
    const scaleContract = scaleContractFor(row);
    const conditioning = options.conditionedReferences?.[row.websiteSku];
    const sourceReferenceSha = job.productReference.verifiedBytesSha256 ||
      job.productReference.sha256;
    if (conditioning) {
      if (conditioning.websiteSku !== row.websiteSku) {
        throw new Error(`Conditioning SKU mismatch for ${row.websiteSku}`);
      }
      if (conditioning.sourceSha256 !== sourceReferenceSha) {
        throw new Error(
          `Conditioning source hash mismatch for ${row.websiteSku}`,
        );
      }
      if (
        conditioning.postGenerationMutationAllowed !== false ||
        conditioning.operation !==
          "pre-generation-product-truth-conditioning" ||
        conditioning.scaleContractVersion !== scaleContract.version
      ) {
        throw new Error(`Invalid conditioning contract for ${row.websiteSku}`);
      }
    }
    const prompt = promptFor(row, job, scaleContract, conditioning);
    const references: PilotCompiledReference[] = [{
      kind: "product-truth",
      role: assetRole === "cap-on"
        ? "cap-on-product-truth"
        : "sidecar-product-truth",
      locator: conditioning?.outputPath ?? job.productReference.locator,
      sha256: conditioning?.outputSha256 ?? sourceReferenceSha,
      ...(conditioning ? { conditioning } : {}),
    }];
    if (job.materialAuthority) {
      references.push({
        kind: "material-calibration",
        role: "material-calibration",
        locator: job.materialAuthority.calibrationUrl,
        sha256: job.materialAuthority.calibrationBytesSha256,
      });
    }
    const canonicalTruth = { ...row.canonical };
    products.push({
      websiteSku: row.websiteSku,
      graceSku: row.graceSku,
      family: row.canonicalFamily,
      assetRole,
      canonicalTruth,
      canonicalTruthHash: await sha256(stableStringify(canonicalTruth)),
      prompt,
      promptHash: await sha256(prompt),
      promptVersion: job.promptContract.version,
      scaleContract,
      references,
    });
  }
  const attempts = products.flatMap((product) =>
    RENDERERS.flatMap((rendererId) =>
      [1, 2].map((attemptOrdinal) => ({
        ...product,
        jobKey: `${product.websiteSku}|${product.assetRole}`,
        rendererId,
        attemptOrdinal,
      }))
    )
  );
  return {
    version: "cylinder-material-pilot-v3",
    sourcePlanVersion: plan.version,
    sourcePlanHash: plan.sha256,
    products,
    attempts,
  };
}
