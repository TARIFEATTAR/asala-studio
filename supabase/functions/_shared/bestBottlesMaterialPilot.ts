import { resolveBestBottlesGlobalScalePct } from "./familyRig.ts";

export const BEST_BOTTLES_MATERIAL_PILOT_CANVAS = Object.freeze({
  width: 2080,
  height: 2288,
  backgroundHex: "#F5F3EF",
});

export const BEST_BOTTLES_MATERIAL_PILOT_SCALE_VERSION =
  "best-bottles-catalog-scale-v1" as const;
export const BEST_BOTTLES_CANONICAL_BODY_SCALE_VERSION =
  "best-bottles-canonical-body-scale-v2" as const;
export const BEST_BOTTLES_MATERIAL_PILOT_BASELINE_PCT = 9 as const;

export interface MaterialPilotScaleInput {
  capacityMl: number;
  canonBodyHeightMm: number;
  canonBodyWidthMm: number;
  canonAssembledHeightMm: number;
}

export interface MaterialPilotScaleContract {
  version:
    | typeof BEST_BOTTLES_MATERIAL_PILOT_SCALE_VERSION
    | typeof BEST_BOTTLES_CANONICAL_BODY_SCALE_VERSION;
  canvasWidthPx: number;
  canvasHeightPx: number;
  baselinePct: number;
  baselineYPx: number;
  assembledTargetPct: number;
  assembledTargetPx: number;
  bodyTargetPx: number;
  bodyTargetRangePx: { min: number; max: number };
  bodyWidthTargetPx: number;
  bodyWidthTargetRangePx: { min: number; max: number };
  canonicalBodyHeightMm: number;
  canonicalBodyWidthMm: number;
  canonicalAssembledHeightMm: number;
  qaStatus: "measurement-required";
}

const CYLINDER_CANONICAL_BODY_SCALE_KNOTS = [
  { bodyHeightMm: 37, bodyTargetPx: 878 },
  { bodyHeightMm: 53, bodyTargetPx: 1027 },
  { bodyHeightMm: 70, bodyTargetPx: 1151 },
  { bodyHeightMm: 83, bodyTargetPx: 1287 },
  { bodyHeightMm: 117, bodyTargetPx: 1470 },
  { bodyHeightMm: 154, bodyTargetPx: 1540 },
] as const;

function resolveCanonicalBodyTargetPx(bodyHeightMm: number): number {
  const first = CYLINDER_CANONICAL_BODY_SCALE_KNOTS[0];
  const last = CYLINDER_CANONICAL_BODY_SCALE_KNOTS[
    CYLINDER_CANONICAL_BODY_SCALE_KNOTS.length - 1
  ];
  if (bodyHeightMm <= first.bodyHeightMm) return first.bodyTargetPx;
  if (bodyHeightMm >= last.bodyHeightMm) return last.bodyTargetPx;
  const upperIndex = CYLINDER_CANONICAL_BODY_SCALE_KNOTS.findIndex(
    (knot) => knot.bodyHeightMm >= bodyHeightMm,
  );
  const lower = CYLINDER_CANONICAL_BODY_SCALE_KNOTS[upperIndex - 1];
  const upper = CYLINDER_CANONICAL_BODY_SCALE_KNOTS[upperIndex];
  const progress = (bodyHeightMm - lower.bodyHeightMm)
    / (upper.bodyHeightMm - lower.bodyHeightMm);
  return Math.round(
    lower.bodyTargetPx + progress * (upper.bodyTargetPx - lower.bodyTargetPx),
  );
}

/**
 * Geometry-first Cylinder scale used by the six-size role-clean pilot. The
 * target keys on canonical bottle-body height, so cap proportions cannot make
 * a larger body render shorter than a smaller one. Both cap-on and sidecar
 * roles receive the same body target and baseline.
 */
export function buildMaterialPilotCanonicalBodyScaleContract(
  input: MaterialPilotScaleInput,
): MaterialPilotScaleContract {
  requirePositiveFinite(input.capacityMl, "capacityMl");
  const bodyHeightMm = requirePositiveFinite(
    input.canonBodyHeightMm,
    "canonBodyHeightMm",
  );
  const bodyWidthMm = requirePositiveFinite(
    input.canonBodyWidthMm,
    "canonBodyWidthMm",
  );
  const assembledHeightMm = requirePositiveFinite(
    input.canonAssembledHeightMm,
    "canonAssembledHeightMm",
  );
  if (bodyHeightMm > assembledHeightMm) {
    throw new Error("Canonical body height cannot exceed assembled height.");
  }
  const { width: canvasWidthPx, height: canvasHeightPx } =
    BEST_BOTTLES_MATERIAL_PILOT_CANVAS;
  const bodyTargetPx = resolveCanonicalBodyTargetPx(bodyHeightMm);
  const assembledTargetPx = Math.round(
    bodyTargetPx * assembledHeightMm / bodyHeightMm,
  );
  const tolerancePx = Math.round(canvasHeightPx * 0.02);
  const bodyMinPx = bodyTargetPx - tolerancePx;
  const bodyMaxPx = bodyTargetPx + tolerancePx;
  const widthAtBodyPx = (bodyPx: number) =>
    bodyPx * (bodyWidthMm / bodyHeightMm);
  return {
    version: BEST_BOTTLES_CANONICAL_BODY_SCALE_VERSION,
    canvasWidthPx,
    canvasHeightPx,
    baselinePct: BEST_BOTTLES_MATERIAL_PILOT_BASELINE_PCT,
    baselineYPx: Math.round(
      canvasHeightPx * (1 - BEST_BOTTLES_MATERIAL_PILOT_BASELINE_PCT / 100),
    ),
    assembledTargetPct: assembledTargetPx / canvasHeightPx * 100,
    assembledTargetPx,
    bodyTargetPx,
    bodyTargetRangePx: { min: bodyMinPx, max: bodyMaxPx },
    bodyWidthTargetPx: Math.round(widthAtBodyPx(bodyTargetPx)),
    bodyWidthTargetRangePx: {
      min: Math.round(widthAtBodyPx(bodyMinPx)),
      max: Math.round(widthAtBodyPx(bodyMaxPx)),
    },
    canonicalBodyHeightMm: bodyHeightMm,
    canonicalBodyWidthMm: bodyWidthMm,
    canonicalAssembledHeightMm: assembledHeightMm,
    qaStatus: "measurement-required",
  };
}

function requirePositiveFinite(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a positive canonical value.`);
  }
  return value;
}

/**
 * Resolves the existing perceptually compressed catalog curve to an exact
 * body-height/width target on the native 2080x2288 canvas. The body target is
 * persistent across cap-on and sidecar roles; a detached cap never influences
 * the primary bottle measurement.
 */
export function buildMaterialPilotScaleContract(
  input: MaterialPilotScaleInput,
): MaterialPilotScaleContract {
  const capacityMl = requirePositiveFinite(input.capacityMl, "capacityMl");
  const bodyHeightMm = requirePositiveFinite(
    input.canonBodyHeightMm,
    "canonBodyHeightMm",
  );
  const bodyWidthMm = requirePositiveFinite(
    input.canonBodyWidthMm,
    "canonBodyWidthMm",
  );
  const assembledHeightMm = requirePositiveFinite(
    input.canonAssembledHeightMm,
    "canonAssembledHeightMm",
  );
  if (bodyHeightMm > assembledHeightMm) {
    throw new Error("Canonical body height cannot exceed assembled height.");
  }

  const { width: canvasWidthPx, height: canvasHeightPx } =
    BEST_BOTTLES_MATERIAL_PILOT_CANVAS;
  const assembledTargetPct = resolveBestBottlesGlobalScalePct(capacityMl);
  const bodyAtPct = (pct: number) =>
    canvasHeightPx * (pct / 100) * (bodyHeightMm / assembledHeightMm);
  const widthAtBodyPx = (bodyPx: number) =>
    bodyPx * (bodyWidthMm / bodyHeightMm);
  const bodyTargetPx = Math.round(bodyAtPct(assembledTargetPct));
  const bodyMinPx = Math.round(bodyAtPct(assembledTargetPct - 2));
  const bodyMaxPx = Math.round(bodyAtPct(assembledTargetPct + 2));

  return {
    version: BEST_BOTTLES_MATERIAL_PILOT_SCALE_VERSION,
    canvasWidthPx,
    canvasHeightPx,
    baselinePct: BEST_BOTTLES_MATERIAL_PILOT_BASELINE_PCT,
    baselineYPx: Math.round(
      canvasHeightPx * (1 - BEST_BOTTLES_MATERIAL_PILOT_BASELINE_PCT / 100),
    ),
    assembledTargetPct,
    assembledTargetPx: Math.round(
      canvasHeightPx * assembledTargetPct / 100,
    ),
    bodyTargetPx,
    bodyTargetRangePx: { min: bodyMinPx, max: bodyMaxPx },
    bodyWidthTargetPx: Math.round(widthAtBodyPx(bodyTargetPx)),
    bodyWidthTargetRangePx: {
      min: Math.round(widthAtBodyPx(bodyMinPx)),
      max: Math.round(widthAtBodyPx(bodyMaxPx)),
    },
    canonicalBodyHeightMm: bodyHeightMm,
    canonicalBodyWidthMm: bodyWidthMm,
    canonicalAssembledHeightMm: assembledHeightMm,
    qaStatus: "measurement-required",
  };
}

export interface MaterialPilotBodyBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface MaterialPilotScaleQaResult {
  status: "measurement-required" | "pass" | "fail";
  failureReasons: string[];
  observed: {
    bodyHeightPx: number | null;
    bodyWidthPx: number | null;
    baselineYPx: number | null;
  };
  contract: MaterialPilotScaleContract;
}

/** Body-only QA. Closure and detached-sidecar bounds are intentionally ignored. */
export function evaluateMaterialPilotScaleQa(
  contract: MaterialPilotScaleContract,
  bodyBounds: MaterialPilotBodyBounds | null,
  baselineTolerancePx = 8,
): MaterialPilotScaleQaResult {
  if (!bodyBounds) {
    return {
      status: "measurement-required",
      failureReasons: [],
      observed: {
        bodyHeightPx: null,
        bodyWidthPx: null,
        baselineYPx: null,
      },
      contract,
    };
  }
  const bodyHeightPx = bodyBounds.bottom - bodyBounds.top + 1;
  const bodyWidthPx = bodyBounds.right - bodyBounds.left + 1;
  const failureReasons: string[] = [];
  if (
    bodyHeightPx < contract.bodyTargetRangePx.min ||
    bodyHeightPx > contract.bodyTargetRangePx.max
  ) failureReasons.push("body_height_out_of_range");
  if (
    bodyWidthPx < contract.bodyWidthTargetRangePx.min ||
    bodyWidthPx > contract.bodyWidthTargetRangePx.max
  ) failureReasons.push("body_width_out_of_range");
  if (Math.abs(bodyBounds.bottom - contract.baselineYPx) > baselineTolerancePx) {
    failureReasons.push("bottle_baseline_out_of_range");
  }
  return {
    status: failureReasons.length === 0 ? "pass" : "fail",
    failureReasons,
    observed: {
      bodyHeightPx,
      bodyWidthPx,
      baselineYPx: bodyBounds.bottom,
    },
    contract,
  };
}

export type MaterialPilotRendererId =
  | "openai-gpt-image-2"
  | "google-nano-banana-2"
  | "higgsfield-future";

export type MaterialPilotAssetRole = "cap-on" | "sidecar";

export type MaterialPilotReferenceRole =
  | "cap-on-product-truth"
  | "sidecar-product-truth"
  | "material-calibration";

export interface MaterialPilotRendererDescriptor {
  id: MaterialPilotRendererId;
  provider: "openai" | "google" | "higgsfield";
  model: string;
  active: boolean;
  referenceLimit: number;
  nativeAspectRatio: "10:11" | "1:1" | "provider-selected";
  outputStrategy: "exact-canvas" | "whole-raster-normalize" | "future-adapter";
}

export const CYLINDER_MATERIAL_RENDERERS:
  readonly MaterialPilotRendererDescriptor[] = Object.freeze(
    [
      {
        id: "openai-gpt-image-2",
        provider: "openai",
        model: "gpt-image-2",
        active: true,
        referenceLimit: 2,
        nativeAspectRatio: "10:11",
        outputStrategy: "exact-canvas",
      },
      {
        id: "google-nano-banana-2",
        provider: "google",
        model: "models/gemini-3.1-flash-image-preview",
        active: true,
        referenceLimit: 3,
        nativeAspectRatio: "1:1",
        outputStrategy: "whole-raster-normalize",
      },
      {
        id: "higgsfield-future",
        provider: "higgsfield",
        model: "unconfigured",
        active: false,
        referenceLimit: 0,
        nativeAspectRatio: "provider-selected",
        outputStrategy: "future-adapter",
      },
    ] satisfies MaterialPilotRendererDescriptor[],
  );

export const ACTIVE_CYLINDER_MATERIAL_RENDERERS = Object.freeze(
  CYLINDER_MATERIAL_RENDERERS.filter((renderer) => renderer.active),
);

export function getMaterialPilotRenderer(
  rendererId: MaterialPilotRendererId,
): MaterialPilotRendererDescriptor | null {
  return CYLINDER_MATERIAL_RENDERERS.find((renderer) =>
    renderer.id === rendererId
  ) ?? null;
}

export type WholeRasterOperation =
  | { kind: "crop"; x: number; y: number; width: number; height: number }
  | { kind: "resize"; width: number; height: number };

export interface WholeRasterNormalizationPlan {
  sourceWidth: number;
  sourceHeight: number;
  targetWidth: number;
  targetHeight: number;
  operations: WholeRasterOperation[];
  backgroundMutationAllowed: false;
}

export interface NativeBoneCanvasQaResult {
  pass: boolean;
  targetRgb: [number, number, number];
  sampleCount: number;
  meanChannelError: number;
  maxChannelError: number;
  failureReasons: string[];
}

/**
 * Evaluates pixels sampled from the native output border. This is diagnostic
 * only: failed pixels are never painted, filled, composited, or repaired.
 */
export function evaluateNativeBoneCanvas(
  samples: ReadonlyArray<readonly [number, number, number]>,
  targetRgb: readonly [number, number, number] = [245, 243, 239],
  maxMeanChannelError = 8,
  maxSingleChannelError = 24,
): NativeBoneCanvasQaResult {
  if (samples.length === 0) {
    throw new Error("Native Bone QA requires border samples.");
  }
  let sum = 0;
  let max = 0;
  for (const sample of samples) {
    for (let channel = 0; channel < 3; channel += 1) {
      const error = Math.abs(sample[channel] - targetRgb[channel]);
      sum += error;
      max = Math.max(max, error);
    }
  }
  const mean = sum / (samples.length * 3);
  const failureReasons: string[] = [];
  if (mean > maxMeanChannelError || max > maxSingleChannelError) {
    failureReasons.push("bone_border_color_drift");
  }
  return {
    pass: failureReasons.length === 0,
    targetRgb: [...targetRgb],
    sampleCount: samples.length,
    meanChannelError: Math.round(mean * 100) / 100,
    maxChannelError: max,
    failureReasons,
  };
}

function positiveInteger(value: number, label: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }
  return value;
}

export function buildWholeRasterNormalizationPlan(
  rendererId: MaterialPilotRendererId,
  sourceWidth: number,
  sourceHeight: number,
): WholeRasterNormalizationPlan {
  positiveInteger(sourceWidth, "sourceWidth");
  positiveInteger(sourceHeight, "sourceHeight");
  const renderer = getMaterialPilotRenderer(rendererId);
  if (!renderer || !renderer.active) {
    throw new Error(`Material pilot renderer '${rendererId}' is not active.`);
  }

  const { width: targetWidth, height: targetHeight } =
    BEST_BOTTLES_MATERIAL_PILOT_CANVAS;
  if (renderer.outputStrategy === "exact-canvas") {
    if (sourceWidth !== targetWidth || sourceHeight !== targetHeight) {
      throw new Error(
        `${rendererId} must return the exact ${targetWidth}x${targetHeight} native canvas.`,
      );
    }
    return {
      sourceWidth,
      sourceHeight,
      targetWidth,
      targetHeight,
      operations: [],
      backgroundMutationAllowed: false,
    };
  }

  const targetRatio = targetWidth / targetHeight;
  const sourceRatio = sourceWidth / sourceHeight;
  let cropWidth = sourceWidth;
  let cropHeight = sourceHeight;
  if (sourceRatio > targetRatio) {
    cropWidth = Math.round(sourceHeight * targetRatio);
  } else if (sourceRatio < targetRatio) {
    cropHeight = Math.round(sourceWidth / targetRatio);
  }

  const operations: WholeRasterOperation[] = [];
  if (cropWidth !== sourceWidth || cropHeight !== sourceHeight) {
    operations.push({
      kind: "crop",
      x: Math.max(0, Math.round((sourceWidth - cropWidth) / 2)),
      y: Math.max(0, Math.round((sourceHeight - cropHeight) / 2)),
      width: cropWidth,
      height: cropHeight,
    });
  }
  if (cropWidth !== targetWidth || cropHeight !== targetHeight) {
    operations.push({
      kind: "resize",
      width: targetWidth,
      height: targetHeight,
    });
  }

  return {
    sourceWidth,
    sourceHeight,
    targetWidth,
    targetHeight,
    operations,
    backgroundMutationAllowed: false,
  };
}

export interface MaterialPilotReference {
  role: MaterialPilotReferenceRole;
  url: string;
  sha256: string;
}

export interface MaterialPilotRequest {
  family: string;
  websiteSku: string;
  graceSku: string;
  rendererId: MaterialPilotRendererId;
  assetRole: MaterialPilotAssetRole;
  prompt: string;
  canonicalTruthHash: string;
  references: MaterialPilotReference[];
}

export interface MaterialPilotValidationResult {
  ok: boolean;
  issues: string[];
}

const SHA256_HEX = /^[a-f0-9]{64}$/i;

export function validateMaterialPilotRequest(
  request: MaterialPilotRequest,
): MaterialPilotValidationResult {
  const issues: string[] = [];
  const renderer = getMaterialPilotRenderer(request.rendererId);
  if (!/^(?:tall\s+)?cylinder$/i.test(request.family.trim())) {
    issues.push("The material-upgrade pilot accepts only the Cylinder family.");
  }
  if (!renderer?.active) {
    issues.push(`Renderer '${request.rendererId}' is not active.`);
  }
  if (!request.websiteSku.trim() || !request.graceSku.trim()) {
    issues.push("Both websiteSku and graceSku are required.");
  }
  if (!request.prompt.trim()) issues.push("The exact prompt is required.");
  if (!SHA256_HEX.test(request.canonicalTruthHash)) {
    issues.push("canonicalTruthHash must be a SHA-256 hex digest.");
  }

  const requiredRole: MaterialPilotReferenceRole =
    request.assetRole === "cap-on"
      ? "cap-on-product-truth"
      : "sidecar-product-truth";
  const productTruth = request.references.filter((reference) =>
    reference.role === "cap-on-product-truth" ||
    reference.role === "sidecar-product-truth"
  );
  if (productTruth.length !== 1 || productTruth[0]?.role !== requiredRole) {
    issues.push(
      `${request.assetRole} jobs require exactly one '${requiredRole}' reference and cannot borrow the other role.`,
    );
  }
  if (renderer && request.references.length > renderer.referenceLimit) {
    issues.push(
      `${request.rendererId} accepts at most ${renderer.referenceLimit} pilot references.`,
    );
  }
  request.references.forEach((reference, index) => {
    if (!/^https:\/\//i.test(reference.url)) {
      issues.push(`Reference ${index + 1} must use an immutable HTTPS URL.`);
    }
    if (!SHA256_HEX.test(reference.sha256)) {
      issues.push(`Reference ${index + 1} must carry a SHA-256 digest.`);
    }
  });

  return { ok: issues.length === 0, issues };
}

export interface RoleSemanticQaInput {
  assetRole: MaterialPilotAssetRole;
  productCount: number;
  detachedCapCount: number;
  assembledCapPresent: boolean;
  fitmentPresent: boolean;
  extraComponentCount: number;
  closureIdentityMatch: boolean;
  materialIdentityMatch: boolean;
  sharedBaselinePass: boolean;
}

export interface RoleSemanticReviewChecklist {
  status: "human-review-required";
  assetRole: MaterialPilotAssetRole;
  requiredChecks: string[];
}

export function buildRoleSemanticReviewChecklist(
  assetRole: MaterialPilotAssetRole,
): RoleSemanticReviewChecklist {
  const shared = [
    "exactly_one_product",
    "exact_closure_identity",
    "exact_material_identity",
    "fitment_visible_and_correct",
    "no_extra_components",
    "canonical_body_geometry",
  ];
  return {
    status: "human-review-required",
    assetRole,
    requiredChecks: assetRole === "sidecar"
      ? [
        ...shared,
        "exactly_one_detached_cap",
        "no_assembled_cap",
        "shared_ground_baseline",
      ]
      : [...shared, "assembled_cap_present", "no_detached_cap"],
  };
}

export interface RoleSemanticQaResult {
  decision: "pass" | "reject";
  failureReasons: string[];
  humanReviewRequired: true;
  publishEligible: false;
}

export function evaluateRoleSemanticQa(
  input: RoleSemanticQaInput,
): RoleSemanticQaResult {
  const failureReasons: string[] = [];
  if (input.productCount !== 1) failureReasons.push("product_count_mismatch");
  if (input.extraComponentCount !== 0) failureReasons.push("extra_components");
  if (!input.closureIdentityMatch) failureReasons.push("incorrect_closure");
  if (!input.materialIdentityMatch) {
    failureReasons.push("material_identity_drift");
  }
  if (!input.fitmentPresent) failureReasons.push("missing_fitment");

  if (input.assetRole === "sidecar") {
    if (input.detachedCapCount !== 1) {
      failureReasons.push("sidecar_cap_count_mismatch");
    }
    if (input.assembledCapPresent) {
      failureReasons.push("sidecar_has_assembled_cap");
    }
    if (!input.sharedBaselinePass) {
      failureReasons.push("sidecar_baseline_mismatch");
    }
  } else {
    if (input.detachedCapCount !== 0) {
      failureReasons.push("cap_on_has_detached_cap");
    }
    if (!input.assembledCapPresent) {
      failureReasons.push("cap_on_missing_assembled_cap");
    }
  }

  return {
    decision: failureReasons.length === 0 ? "pass" : "reject",
    failureReasons,
    humanReviewRequired: true,
    publishEligible: false,
  };
}

export interface MaterialPilotAttemptMetric {
  rendererId: MaterialPilotRendererId;
  jobKey: string;
  attemptOrdinal: number;
  providerStatus: "queued" | "running" | "completed" | "failed";
  humanDecision: "approved-keep" | "needs-regen" | "superseded" | null;
  failureReasons: string[];
  durationMs: number;
  estimatedCostUsd: number;
  nativeBonePass: boolean | null;
}

export interface MaterialPilotGatewayFailure {
  failureStage: "gateway";
  failureCode: "edge_idle_timeout";
  failureReasons: ["edge_idle_timeout_150s"];
  errorMessage: string;
  durationMs: 150000;
}

/** Converts a gateway timeout into terminal, queryable attempt telemetry. */
export function classifyMaterialPilotGatewayFailure(
  responseStatus: number,
  responseBody: unknown,
): MaterialPilotGatewayFailure | null {
  const body = responseBody && typeof responseBody === "object"
    ? responseBody as Record<string, unknown>
    : {};
  if (responseStatus !== 504 || body.code !== "IDLE_TIMEOUT") return null;
  return {
    failureStage: "gateway",
    failureCode: "edge_idle_timeout",
    failureReasons: ["edge_idle_timeout_150s"],
    errorMessage: typeof body.message === "string"
      ? body.message
      : "Supabase gateway idle timeout reached.",
    durationMs: 150000,
  };
}

export interface MaterialPilotRendererSummary {
  rendererId: MaterialPilotRendererId;
  totalAttempts: number;
  returnedVisualAttempts: number;
  approvedAttempts: number;
  approvedJobCount: number;
  approvalRate: number | null;
  firstPassApprovalRate: number | null;
  nativeBonePassRate: number | null;
  totalEstimatedCostUsd: number;
  costPerApprovedImageUsd: number | null;
  medianDurationMs: number | null;
  p90DurationMs: number | null;
  failureReasonCounts: Record<string, number>;
}

export interface MaterialPilotSummary {
  totalAttempts: number;
  byRenderer: MaterialPilotRendererSummary[];
}

function ratio(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
}

function roundedCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000;
}

function percentile(values: number[], percentileValue: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * percentileValue;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  const weight = index - lower;
  return Math.round(sorted[lower] * (1 - weight) + sorted[upper] * weight);
}

export function summarizeMaterialPilotAttempts(
  attempts: MaterialPilotAttemptMetric[],
): MaterialPilotSummary {
  const rendererIds = Array.from(
    new Set(attempts.map((attempt) => attempt.rendererId)),
  );
  const byRenderer = rendererIds.map(
    (rendererId): MaterialPilotRendererSummary => {
      const rows = attempts.filter((attempt) =>
        attempt.rendererId === rendererId
      );
      const returned = rows.filter((attempt) =>
        attempt.providerStatus === "completed"
      );
      const approved = returned.filter((attempt) =>
        attempt.humanDecision === "approved-keep"
      );
      const firstPass = returned.filter((attempt) =>
        attempt.attemptOrdinal === 1
      );
      const firstPassApproved = firstPass.filter((attempt) =>
        attempt.humanDecision === "approved-keep"
      );
      const boneReviewed = returned.filter((attempt) =>
        attempt.nativeBonePass !== null
      );
      const bonePassed = boneReviewed.filter((attempt) =>
        attempt.nativeBonePass === true
      );
      const totalEstimatedCostUsd = roundedCurrency(
        rows.reduce((sum, attempt) => sum + attempt.estimatedCostUsd, 0),
      );
      const failureReasonCounts: Record<string, number> = {};
      rows.forEach((attempt) => {
        attempt.failureReasons.forEach((reason) => {
          failureReasonCounts[reason] = (failureReasonCounts[reason] ?? 0) + 1;
        });
      });

      return {
        rendererId,
        totalAttempts: rows.length,
        returnedVisualAttempts: returned.length,
        approvedAttempts: approved.length,
        approvedJobCount:
          new Set(approved.map((attempt) => attempt.jobKey)).size,
        approvalRate: ratio(approved.length, returned.length),
        firstPassApprovalRate: ratio(
          firstPassApproved.length,
          firstPass.length,
        ),
        nativeBonePassRate: ratio(bonePassed.length, boneReviewed.length),
        totalEstimatedCostUsd,
        costPerApprovedImageUsd: approved.length > 0
          ? roundedCurrency(totalEstimatedCostUsd / approved.length)
          : null,
        medianDurationMs: percentile(
          rows.map((attempt) => attempt.durationMs),
          0.5,
        ),
        p90DurationMs: percentile(
          rows.map((attempt) => attempt.durationMs),
          0.9,
        ),
        failureReasonCounts,
      };
    },
  );

  return { totalAttempts: attempts.length, byRenderer };
}
