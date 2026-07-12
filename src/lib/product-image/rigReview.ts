import type { FramingDecision, FramingQaReport } from "./framingQa";
import type { RigStrongBounds } from "./rigPostprocess";
import type { BestBottlesShadowOwner } from "@/lib/bestBottlesShadowPolicy";
import type { ShadowQaReport } from "./shadowQa";

export interface RigReviewEvidence {
  required: boolean;
  applied: boolean;
  reason: string;
  framingDecision: FramingDecision | null;
  framingQa: FramingQaReport | null;
  qaIssues: string[];
  objectBounds: RigStrongBounds | null;
  preTransformObjectBounds: RigStrongBounds | null;
  shiftXPx: number | null;
  shiftYPx: number | null;
  scaleFactor: number | null;
  maskControlled: boolean;
  shadowOwner: BestBottlesShadowOwner;
  shadowQa: ShadowQaReport | null;
}

export interface RigReviewRequirement {
  id: "evidence" | "bounds" | "fill" | "baseline" | "centerline" | "qa" | "shadow";
  label: string;
  detail: string;
  status: "pass" | "fail";
}

export interface RigManualChecks {
  identity: boolean;
  applicatorState: boolean;
  surfaceAndCrop: boolean;
}

export const EMPTY_RIG_MANUAL_CHECKS: RigManualChecks = {
  identity: false,
  applicatorState: false,
  surfaceAndCrop: false,
};

function signed(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

export function buildRigReviewRequirements(review: RigReviewEvidence): RigReviewRequirement[] {
  const qa = review.framingQa;
  const measurements = qa?.measurements;
  const target = qa?.target;
  const fillRange = target?.fillHeightRangePct;
  const fill = measurements?.fillHeightPct;
  const baselineDelta = measurements?.baselineDeltaPx;
  const centerDelta = measurements?.centerDeltaPct;
  const fillPass =
    fill != null && fillRange != null && fill >= fillRange.min && fill <= fillRange.max;
  const baselinePass = baselineDelta != null && Math.abs(baselineDelta) <= 8;
  const centerPass = centerDelta != null && Math.abs(centerDelta) <= 2.5;
  const shadowPass = review.shadowOwner === "rig" || review.shadowQa?.status === "pass";

  return [
    {
      id: "evidence",
      label: "Rig evidence recorded",
      detail: review.applied
        ? `${target?.profileId ?? target?.family ?? "Resolved profile"} · ${review.framingDecision ?? "decision missing"}`
        : review.reason,
      status: review.applied && qa != null ? "pass" : "fail",
    },
    {
      id: "bounds",
      label: "Product bounds detected",
      detail: review.objectBounds
        ? `L ${review.objectBounds.left ?? "—"} · T ${review.objectBounds.top} · R ${review.objectBounds.right ?? "—"} · B ${review.objectBounds.bottom}px`
        : "Final product envelope is missing.",
      status: review.objectBounds ? "pass" : "fail",
    },
    {
      id: "fill",
      label: "Fill height",
      detail:
        fill != null && fillRange
          ? `${fill}% measured · ${fillRange.min}–${fillRange.max}% required`
          : "Fill-height measurement is missing.",
      status: fillPass ? "pass" : "fail",
    },
    {
      id: "baseline",
      label: "Shared baseline",
      detail:
        measurements?.baselineYPx != null && baselineDelta != null
          ? `${measurements.baselineYPx}px measured · ${measurements.targetBaselineYPx}px target · Δ${signed(baselineDelta)}px`
          : "Baseline measurement is missing.",
      status: baselinePass ? "pass" : "fail",
    },
    {
      id: "centerline",
      label: "Primary-object centerline",
      detail:
        measurements?.centerXPct != null && centerDelta != null
          ? `${measurements.centerXPct}% measured · ${measurements.targetCenterXPct}% target · Δ${signed(centerDelta)}%`
          : "Centerline measurement is missing.",
      status: centerPass ? "pass" : "fail",
    },
    {
      id: "qa",
      label: "Rig QA decision",
      detail:
        review.qaIssues.length > 0
          ? review.qaIssues.join(" · ")
          : `${qa?.status ?? "missing"} · ${review.framingDecision ?? "decision missing"}`,
      status:
        qa?.status === "pass" &&
        review.framingDecision === "pass" &&
        review.qaIssues.length === 0
          ? "pass"
          : "fail",
    },
    {
      id: "shadow",
      label:
        review.shadowOwner === "model"
          ? "Model-owned grounding shadow"
          : "Deterministic grounding shadow",
      detail:
        review.shadowOwner === "model"
          ? review.shadowQa
            ? `${review.shadowQa.status} · gap ${review.shadowQa.measurements.contactGapPx ?? "—"}px · right ${review.shadowQa.measurements.rightExtensionRatio ?? "—"}× width`
            : "Model-shadow evidence is missing."
          : "Madison deterministic contact shadow applied after geometry QA.",
      status: shadowPass ? "pass" : "fail",
    },
  ];
}

export function isRigApprovalReady(
  review: RigReviewEvidence | null | undefined,
  manualChecks?: RigManualChecks,
): boolean {
  if (!review) return false;
  if (!review.required) return true;
  const machineReady = buildRigReviewRequirements(review).every(
    (requirement) => requirement.status === "pass",
  );
  const humanReady = Boolean(
    manualChecks?.identity && manualChecks.applicatorState && manualChecks.surfaceAndCrop,
  );
  return machineReady && humanReady;
}
