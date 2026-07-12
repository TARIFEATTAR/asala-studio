import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type {
  BestBottlesImageReconciliationStatusRow,
  BestBottlesReconciliationStatus,
} from "@/lib/bestBottlesImageReconciliation";

interface BestBottlesReconciliationBadgesProps {
  reconciliation: BestBottlesImageReconciliationStatusRow | null;
  isStudioMaster: boolean;
}

const STATUS_PRESENTATION: Record<
  BestBottlesReconciliationStatus,
  { label: string; className: string }
> = {
  "library-only": {
    label: "Library asset",
    className: "border-slate-400/70 bg-slate-950/75 text-slate-100",
  },
  "qa-failed": {
    label: "QA failed",
    className: "border-red-400/70 bg-red-950/75 text-red-200",
  },
  "truth-missing": {
    label: "Truth missing",
    className: "border-red-400/70 bg-red-950/75 text-red-200",
  },
  "truth-conflict": {
    label: "Truth conflict",
    className: "border-red-400/70 bg-red-950/75 text-red-200",
  },
  "measurement-missing": {
    label: "Measure missing",
    className: "border-red-400/70 bg-red-950/75 text-red-200",
  },
  "rig-pending": {
    label: "Rig pending",
    className: "border-amber-400/70 bg-amber-950/75 text-amber-100",
  },
  unlinked: {
    label: "SKU unlinked",
    className: "border-amber-400/70 bg-amber-950/75 text-amber-100",
  },
  "pipeline-image-mismatch": {
    label: "Image mismatch",
    className: "border-red-400/70 bg-red-950/75 text-red-200",
  },
  "approval-divergence": {
    label: "Approval drift",
    className: "border-red-400/70 bg-red-950/75 text-red-200",
  },
  "review-pending": {
    label: "Review pending",
    className: "border-sky-400/70 bg-sky-950/75 text-sky-100",
  },
  "approved-pending-shopify": {
    label: "Awaiting Shopify",
    className: "border-violet-400/70 bg-violet-950/75 text-violet-100",
  },
  "shopify-verification-pending": {
    label: "Verify Shopify",
    className: "border-violet-400/70 bg-violet-950/75 text-violet-100",
  },
  "shopify-pending-convex": {
    label: "Awaiting Convex",
    className: "border-fuchsia-400/70 bg-fuchsia-950/75 text-fuchsia-100",
  },
  "convex-verification-pending": {
    label: "Verify Convex",
    className: "border-fuchsia-400/70 bg-fuchsia-950/75 text-fuchsia-100",
  },
  "destination-mismatch": {
    label: "Destination mismatch",
    className: "border-red-400/70 bg-red-950/75 text-red-200",
  },
  reconciled: {
    label: "Reconciled",
    className: "border-emerald-400/70 bg-emerald-950/75 text-emerald-100",
  },
};

function signed(value: number): string {
  if (value > 0) return `+${value}`;
  return String(value);
}

function reconciliationTitle(row: BestBottlesImageReconciliationStatusRow): string {
  const qa = row.framing_qa;
  const pieces = [
    `State: ${row.reconciliation_status}`,
    `Lifecycle: ${row.lifecycle_state}`,
    `Raw baseline: ${row.pre_transform_baseline_y_px ?? "missing"}px`,
    `Final baseline: ${row.detected_baseline_y_px ?? "missing"}px`,
    `Target baseline: ${row.target_baseline_y_px ?? "missing"}px`,
    `Baseline delta: ${row.baseline_delta_px == null ? "missing" : `${signed(row.baseline_delta_px)}px`}`,
    `Fill height: ${row.fill_height_pct ?? qa?.measurements.fillHeightPct ?? "missing"}%`,
    `Center delta: ${row.center_delta_pct ?? qa?.measurements.centerDeltaPct ?? "missing"}%`,
    `Scale: ${row.scale_factor ?? "missing"}`,
    `Shift: x ${row.shift_x_px ?? "missing"}px / y ${row.shift_y_px ?? "missing"}px`,
    `Truth: ${row.catalog_truth?.websiteTruthStatus ?? "unrecorded"} · ${row.catalog_truth?.measurementSource ?? "source unrecorded"}`,
    `Assignments: ${row.assignment_count}`,
    `Shopify: ${row.all_shopify_writes_recorded ? "all writes recorded" : "writes incomplete"} · ${row.all_shopify_verified ? "all verified" : "verification incomplete"}`,
    `Convex: ${row.all_convex_writes_recorded ? "all writes recorded" : "writes incomplete"} · ${row.all_convex_verified ? "all verified" : "verification incomplete"}`,
    `Rig: ${row.rig_version ?? qa?.target.profileId ?? "unversioned"}`,
    `Shadow owner: ${row.shadow_owner}`,
    `Shadow status: ${row.shadow_qa?.status ?? (row.shadow_owner === "rig" ? "deterministic" : "missing")}`,
    `Shadow gap: ${row.shadow_qa?.measurements.contactGapPx ?? "missing"}px`,
    `Shadow right extension: ${row.shadow_qa?.measurements.rightExtensionRatio ?? "missing"}× width`,
    `Shadow components: ${row.shadow_qa?.measurements.componentCount ?? "missing"}`,
  ];
  if (row.shadow_qa?.failures.length) pieces.push(`Shadow failures: ${row.shadow_qa.failures.join(" · ")}`);
  if (row.shadow_qa?.warnings.length) pieces.push(`Shadow warnings: ${row.shadow_qa.warnings.join(" · ")}`);
  if (row.qa_issues.length > 0) pieces.push(`QA: ${row.qa_issues.join(" · ")}`);
  if (row.last_error) pieces.push(`Error: ${row.last_error}`);
  return pieces.join("\n");
}

export function BestBottlesReconciliationBadges({
  reconciliation,
  isStudioMaster,
}: BestBottlesReconciliationBadgesProps) {
  if (!reconciliation) {
    if (!isStudioMaster) return null;
    return (
      <Badge
        variant="outline"
        className="text-[10px] border-red-400/70 bg-red-950/75 text-red-200"
        title="This Best Bottles Studio image has no durable rig/reconciliation record."
      >
        Reconciliation missing
      </Badge>
    );
  }

  const presentation = STATUS_PRESENTATION[reconciliation.reconciliation_status];
  const baselineDelta = reconciliation.baseline_delta_px;
  const hasBaseline =
    reconciliation.detected_baseline_y_px != null &&
    reconciliation.target_baseline_y_px != null &&
    baselineDelta != null;
  const qaPassed =
    reconciliation.lifecycle_state !== "qa-failed" &&
    reconciliation.framing_decision === "pass" &&
    reconciliation.qa_issues.length === 0;

  return (
    <>
      <Badge
        variant="outline"
        className={cn("text-[10px]", presentation.className)}
        title={reconciliationTitle(reconciliation)}
      >
        {presentation.label}
      </Badge>
      <Badge
        variant="outline"
        className={cn(
          "text-[10px] font-mono",
          hasBaseline
            ? "border-cyan-400/60 bg-cyan-950/70 text-cyan-100"
            : "border-red-400/70 bg-red-950/75 text-red-200",
        )}
        title={reconciliationTitle(reconciliation)}
      >
        {hasBaseline && baselineDelta != null ? `B Δ${signed(baselineDelta)}px` : "B —"}
      </Badge>
      <Badge
        variant="outline"
        className={cn(
          "text-[10px]",
          qaPassed
            ? "border-emerald-400/60 bg-emerald-950/70 text-emerald-100"
            : "border-amber-400/70 bg-amber-950/75 text-amber-100",
        )}
        title={reconciliationTitle(reconciliation)}
      >
        {qaPassed ? "QA pass" : "QA review"}
      </Badge>
    </>
  );
}
