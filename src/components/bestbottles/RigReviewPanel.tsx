import { useState } from "react";
import { Check, Eye, EyeOff, X } from "lucide-react";
import type { Product } from "@/integrations/convex/bestBottles";
import {
  buildRigReviewRequirements,
  isRigApprovalReady,
  type RigManualChecks,
  type RigReviewEvidence,
} from "@/lib/product-image/rigReview";

interface RigReviewPanelProps {
  imageUrl: string;
  imageAlt: string;
  canvas: { widthPx: number; heightPx: number };
  product: Product;
  review: RigReviewEvidence | null;
  manualChecks: RigManualChecks;
  onManualChecksChange: (checks: RigManualChecks) => void;
  /** Provider/model the server actually executed (truth, not the selection). */
  usedProvider?: string | null;
  /** The dropdown selection at generation time, for comparison context. */
  selectedModel?: string | null;
  /** Wall-clock generation duration in milliseconds. */
  durationMs?: number | null;
}

/**
 * Per-render cost estimates by executed provider. OpenAI is the OBSERVED
 * production average (2026-07-20 batch: $11 / 21 renders ≈ $0.52 at standard
 * quality on the 2080×2288 canvas). Gemini figures are published-rate
 * estimates — tune them against real billing as comparison runs accumulate.
 */
const PROVIDER_COST_ESTIMATES: Array<{ match: RegExp; label: string }> = [
  { match: /openai|gpt/i, label: "~$0.52 (observed avg)" },
  { match: /gemini.*pro|nano-banana-pro/i, label: "~$0.24 (est.)" },
  { match: /gemini|nano/i, label: "~$0.04 (est.)" },
  { match: /freepik/i, label: "varies (Freepik credits)" },
];

function estimateCostLabel(usedProvider: string | null | undefined): string {
  if (!usedProvider) return "—";
  return (
    PROVIDER_COST_ESTIMATES.find((entry) => entry.match.test(usedProvider))?.label ?? "—"
  );
}

function formatDuration(durationMs: number | null | undefined): string {
  if (durationMs == null || !Number.isFinite(durationMs)) return "—";
  const seconds = durationMs / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
}

function valueOrDash(value: string | number | null | undefined, suffix = ""): string {
  return value == null || value === "" ? "—" : `${value}${suffix}`;
}

function Metric({ label, measured, target }: { label: string; measured: string; target: string }) {
  return (
    <div className="min-w-0 border-l border-white/10 pl-3">
      <div className="text-[9px] uppercase tracking-[0.16em] text-white/40">{label}</div>
      <div className="mt-1 font-mono text-sm text-white">{measured}</div>
      <div className="mt-0.5 text-[10px] text-white/45">Target {target}</div>
    </div>
  );
}

export function RigReviewPanel({
  imageUrl,
  imageAlt,
  canvas,
  product,
  review,
  manualChecks,
  onManualChecksChange,
  usedProvider,
  selectedModel,
  durationMs,
}: RigReviewPanelProps) {
  const [showOverlay, setShowOverlay] = useState(true);
  const requirements = review ? buildRigReviewRequirements(review) : [];
  const approvalReady = isRigApprovalReady(review, manualChecks);
  const qa = review?.framingQa;
  const measurements = qa?.measurements;
  const target = qa?.target;
  const bounds = review?.objectBounds;
  const boundStyle = bounds
    ? {
        left: `${((bounds.left ?? 0) / canvas.widthPx) * 100}%`,
        top: `${(bounds.top / canvas.heightPx) * 100}%`,
        width: `${(((bounds.right ?? canvas.widthPx) - (bounds.left ?? 0) + 1) / canvas.widthPx) * 100}%`,
        height: `${((bounds.bottom - bounds.top + 1) / canvas.heightPx) * 100}%`,
      }
    : null;
  const baselineTop = measurements?.baselineYPx == null
    ? null
    : `${(measurements.baselineYPx / canvas.heightPx) * 100}%`;
  const centerLeft = measurements?.targetCenterXPct == null
    ? null
    : `${measurements.targetCenterXPct}%`;

  return (
    <section className="overflow-hidden rounded-sm border border-white/10 bg-[var(--darkroom-panel)]" aria-label="Rig review">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-white/45">Rig review</div>
          <div className="mt-1 flex items-center gap-2 text-sm text-white">
            <span className={`inline-block h-2 w-2 rounded-full ${approvalReady ? "bg-emerald-400" : "bg-red-400"}`} />
            {approvalReady ? "All required gates pass" : "Approval blocked"}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowOverlay((current) => !current)}
          className="inline-flex h-8 items-center gap-2 rounded-sm border border-white/15 px-3 text-[11px] text-white/75 transition-colors hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:opacity-50"
          aria-pressed={showOverlay}
        >
          {showOverlay ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          {showOverlay ? "Hide geometry" : "Show geometry"}
        </button>
      </div>

      <div className="grid min-w-0 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <div className="relative min-w-0 bg-[var(--darkroom-bg)] p-4 sm:p-6">
          <div className="relative mx-auto max-w-[760px] overflow-hidden bg-white">
            <img src={imageUrl} alt={imageAlt} className="block h-auto w-full" />
            {showOverlay && (
              <div className="pointer-events-none absolute inset-0" aria-hidden="true">
                {boundStyle && <div className="absolute border border-amber-400/90 bg-amber-400/[0.04]" style={boundStyle} />}
                {baselineTop && (
                  <div className="absolute inset-x-0 border-t border-cyan-300/90" style={{ top: baselineTop }}>
                    <span className="absolute bottom-1 left-2 bg-black/80 px-1.5 py-0.5 font-mono text-[9px] text-cyan-200">BASELINE</span>
                  </div>
                )}
                {centerLeft && (
                  <div className="absolute inset-y-0 border-l border-fuchsia-300/80" style={{ left: centerLeft }}>
                    <span className="absolute left-1 top-2 bg-black/80 px-1.5 py-0.5 font-mono text-[9px] text-fuchsia-200">CENTER</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="min-w-0 border-t border-white/10 lg:border-l lg:border-t-0">
          <div className="grid grid-cols-2 gap-y-4 border-b border-white/10 p-4">
            <Metric
              label="Fill height"
              measured={valueOrDash(measurements?.fillHeightPct, "%")}
              target={target ? `${target.fillHeightRangePct.min}–${target.fillHeightRangePct.max}%` : "—"}
            />
            <Metric
              label="Baseline"
              measured={valueOrDash(measurements?.baselineYPx, "px")}
              target={valueOrDash(measurements?.targetBaselineYPx, "px")}
            />
            <Metric
              label="Centerline"
              measured={valueOrDash(measurements?.centerXPct, "%")}
              target={valueOrDash(measurements?.targetCenterXPct, "%")}
            />
            <Metric
              label="Scale"
              measured={valueOrDash(review?.scaleFactor)}
              target={target?.profileId ?? target?.family ?? "—"}
            />
            <Metric
              label="Shadow owner"
              measured={review?.shadowOwner ?? "—"}
              target={review?.shadowOwner === "model" ? "model QA" : "deterministic"}
            />
            <Metric
              label="Shadow spread"
              measured={valueOrDash(review?.shadowQa?.measurements.rightExtensionRatio, "× width")}
              target={review?.shadowQa ? `${review.shadowQa.target.rightExtensionRatio.min}–${review.shadowQa.target.rightExtensionRatio.max}×` : "—"}
            />
            <Metric
              label="Image model"
              measured={valueOrDash(usedProvider)}
              target={selectedModel ? `selected: ${selectedModel}` : "—"}
            />
            <Metric
              label="Generation time"
              measured={formatDuration(durationMs)}
              target="typical 60–120s"
            />
            <Metric
              label="Est. cost"
              measured={estimateCostLabel(usedProvider)}
              target="per render"
            />
            <Metric
              label="Prompt version"
              measured={review?.promptVersion ?? "—"}
              target="best-bottles-reference-locked-v6.1"
            />
            <Metric
              label="Shadow topology"
              measured={review?.shadowTopology?.kind ?? "—"}
              target={review?.shadowTopology?.expectedContacts.join(" + ") ?? "—"}
            />
          </div>

          <div className="border-b border-white/10 p-4">
            <div className="mb-3 text-[10px] uppercase tracking-[0.18em] text-white/45">Catalog truth</div>
            <dl className="grid grid-cols-[minmax(110px,0.8fr)_minmax(0,1.2fr)] gap-x-3 gap-y-2 text-[11px]">
              <dt className="text-white/40">SKU</dt><dd className="min-w-0 break-all font-mono text-white/80">{product.graceSku}</dd>
              <dt className="text-white/40">Capacity</dt><dd className="text-white/80">{valueOrDash(product.capacityMl, " ml")}</dd>
              <dt className="text-white/40">Height with cap</dt><dd className="text-white/80">{valueOrDash(product.heightWithCap)}</dd>
              <dt className="text-white/40">Height without cap</dt><dd className="text-white/80">{valueOrDash(product.heightWithoutCap)}</dd>
              <dt className="text-white/40">Diameter / width</dt><dd className="text-white/80">{valueOrDash(product.diameter)}</dd>
              <dt className="text-white/40">Applicator</dt><dd className="text-white/80">{valueOrDash(product.applicator)}</dd>
              <dt className="text-white/40">Transform</dt><dd className="font-mono text-white/80">x {valueOrDash(review?.shiftXPx, "px")} · y {valueOrDash(review?.shiftYPx, "px")}</dd>
            </dl>
          </div>

          <div className="p-4">
            <div className="mb-3 text-[10px] uppercase tracking-[0.18em] text-white/45">Requirements</div>
            {requirements.length > 0 ? (
              <ul className="space-y-2.5">
                {requirements.map((requirement) => (
                  <li key={requirement.id} className="grid grid-cols-[18px_minmax(0,1fr)] gap-2.5">
                    <span className={`mt-0.5 flex h-4 w-4 items-center justify-center rounded-full ${requirement.status === "pass" ? "bg-emerald-400/15 text-emerald-300" : "bg-red-400/15 text-red-300"}`}>
                      {requirement.status === "pass" ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                    </span>
                    <div className="min-w-0">
                      <div className="text-[11px] text-white/85">{requirement.label}</div>
                      <div className="mt-0.5 break-words font-mono text-[9px] leading-relaxed text-white/40">{requirement.detail}</div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="border border-red-400/25 bg-red-400/[0.06] p-3 text-[11px] leading-relaxed text-red-200">
                No rig evidence was returned with this result. Approval is blocked.
              </div>
            )}
            {review?.shadowQa && (review.shadowQa.failures.length > 0 || review.shadowQa.warnings.length > 0) && (
              <div className="mt-4 space-y-2 border-t border-white/10 pt-4">
                {review.shadowQa.failures.length > 0 && (
                  <div className="rounded border border-red-400/25 bg-red-400/[0.06] p-2 text-[10px] leading-relaxed text-red-200">
                    <div className="mb-1 uppercase tracking-[0.14em] text-red-300/80">Shadow failures</div>
                    {review.shadowQa.failures.join(" · ")}
                  </div>
                )}
                {review.shadowQa.warnings.length > 0 && (
                  <div className="rounded border border-amber-400/25 bg-amber-400/[0.06] p-2 text-[10px] leading-relaxed text-amber-100">
                    <div className="mb-1 uppercase tracking-[0.14em] text-amber-200/80">Shadow warnings</div>
                    {review.shadowQa.warnings.join(" · ")}
                  </div>
                )}
              </div>
            )}
            {(review?.shadowQa?.contacts?.length ?? 0) > 0 && (
              <div className="mt-4 border-t border-white/10 pt-4">
                <div className="mb-3 text-[10px] uppercase tracking-[0.18em] text-white/45">
                  Shadow contacts · reference {review?.sourceReferenceHash ?? "hash pending"}
                </div>
                <ul className="space-y-2">
                  {review!.shadowQa!.contacts!.map((contact) => (
                    <li key={contact.contact} className="rounded border border-white/10 p-2 font-mono text-[9px] text-white/55">
                      {contact.contact} · {contact.status} · gap {contact.measurements.contactGapPx ?? "—"}px · spread {contact.measurements.rightExtensionRatio ?? "—"}×
                      {contact.failures.length > 0 ? ` · ${contact.failures.join(" · ")}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-4 border-t border-white/10 pt-4">
              <div className="mb-3 text-[10px] uppercase tracking-[0.18em] text-white/45">Human visual confirmation</div>
              <div className="space-y-2.5">
                {([
                  ["identity", "Geometry, finish, and product identity match the SKU"],
                  ["applicatorState", "Cap state and exposed applicator are correct; no extra component"],
                  ["surfaceAndCrop", "No clipping, matte plate, reflection, damage, or detached-cap remnant"],
                ] as const).map(([key, label]) => (
                  <label key={key} className="grid cursor-pointer grid-cols-[18px_minmax(0,1fr)] gap-2.5 text-[11px] leading-relaxed text-white/80">
                    <input
                      type="checkbox"
                      checked={manualChecks[key]}
                      onChange={(event) => onManualChecksChange({ ...manualChecks, [key]: event.target.checked })}
                      className="mt-0.5 h-4 w-4 accent-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
