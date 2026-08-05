import React from "react";
import { AlertTriangle, CheckCircle2, Fingerprint, LockKeyhole } from "lucide-react";

import type { ApprovedCandidateDetails } from "@/lib/paperDoll/candidateReviewPolicy";
import type { SharedPlacementRecord } from "@/lib/paperDoll/placementRepository";
import {
  placementTransformsEqual,
  toPlacementLockTransform,
  type FamilyPlacementTransform,
} from "./familyPlacementModel";
import { sharedPlacementLockEligible } from "./sharedPlacementPanelModel";

export interface SharedPlacementBodyPlate {
  componentVersionId: string;
  displayName: string;
  materialVariant: string;
}

interface SharedPlacementPanelProps {
  approved: ApprovedCandidateDetails | null;
  expectedAuthorityMaskSha256: string | null;
  bodyPlates: SharedPlacementBodyPlate[];
  transform: FamilyPlacementTransform;
  approverDisplayName: string;
  approvalNote: string;
  inheritedVariantLabels: string[];
  lockedPlacement: SharedPlacementRecord | null;
  lockPending: boolean;
  lockError: string | null;
  onApproverDisplayNameChange: (value: string) => void;
  onApprovalNoteChange: (value: string) => void;
  onLock: () => void;
}

export function SharedPlacementPanel({
  approved,
  expectedAuthorityMaskSha256,
  bodyPlates,
  inheritedVariantLabels,
  transform,
  lockedPlacement,
  approverDisplayName,
  approvalNote,
  lockPending,
  lockError,
  onApproverDisplayNameChange,
  onApprovalNoteChange,
  onLock,
}: SharedPlacementPanelProps) {
  const serialized = (() => {
    try { return toPlacementLockTransform(transform); } catch { return null; }
  })();
  const exactLock = Boolean(lockedPlacement
    && approved
    && lockedPlacement.authorityMaskSha256 === approved.authorityMaskSha256
    && placementTransformsEqual(transform, lockedPlacement.transform));
  const eligible = sharedPlacementLockEligible({
    approved,
    expectedAuthorityMaskSha256,
    bodyPlates,
    transform,
    approverDisplayName,
    approvalNote,
  });

  return (
    <section className="mt-3 rounded border p-3" style={{ borderColor: exactLock ? "rgba(110,231,168,0.45)" : "rgba(215,168,95,0.4)", background: exactLock ? "rgba(110,231,168,0.035)" : "rgba(215,168,95,0.035)" }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[9px] uppercase tracking-[0.18em]" style={{ color: exactLock ? "#6ee7a8" : "var(--darkroom-accent)" }}>
            {exactLock ? <CheckCircle2 className="h-3.5 w-3.5" /> : <LockKeyhole className="h-3.5 w-3.5" />}
            {exactLock ? "Shared placement locked" : lockedPlacement ? "Draft changes" : "Lock shared placement"}
          </div>
          <p className="mt-1 max-w-2xl text-[9px] leading-4" style={{ color: "var(--darkroom-text-dim)" }}>
            One immutable X/Y/uniform-scale transform applies to all five compatible plates. This action records placement truth only; it does not change Current Release or publish to Sanity.
          </p>
        </div>
        {lockedPlacement && <span className="font-mono text-[8px]" style={{ color: exactLock ? "#6ee7a8" : "#f2c078" }}>placement {lockedPlacement.id.slice(0, 8)}…</span>}
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-3">
        <div className="rounded border p-2" style={{ borderColor: "var(--darkroom-border-subtle)" }}>
          <div className="flex items-center gap-1.5 text-[7px] uppercase tracking-[0.15em]" style={{ color: "var(--darkroom-text-dim)" }}><Fingerprint className="h-3 w-3" />Exact geometry</div>
          <div className="mt-1 break-all font-mono text-[8px]" style={{ color: approved?.authorityMaskSha256 === expectedAuthorityMaskSha256 ? "#6ee7a8" : "#ef8d7d" }}>{approved?.authorityMaskSha256 ?? "Pixels not approved"}</div>
        </div>
        <div className="rounded border p-2" style={{ borderColor: "var(--darkroom-border-subtle)" }}>
          <div className="text-[7px] uppercase tracking-[0.15em]" style={{ color: "var(--darkroom-text-dim)" }}>Release transform</div>
          <div className="mt-1 font-mono text-[9px]" style={{ color: "var(--darkroom-text-muted)" }}>X {serialized?.translateXPx ?? "—"} · Y {serialized?.translateYPx ?? "—"} · {serialized?.uniformScale ?? "—"}×</div>
        </div>
        <div className="rounded border p-2" style={{ borderColor: "var(--darkroom-border-subtle)" }}>
          <div className="text-[7px] uppercase tracking-[0.15em]" style={{ color: "var(--darkroom-text-dim)" }}>Inherited exact-mask variants</div>
          <div className="mt-1 text-[9px]" style={{ color: "var(--darkroom-text-muted)" }}>{inheritedVariantLabels.length > 0 ? inheritedVariantLabels.join(" · ") : "Selected approved variant only"}</div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-5 gap-1">
        {bodyPlates.map((body) => <div key={body.componentVersionId} className="rounded border px-2 py-1.5" style={{ borderColor: "rgba(110,231,168,0.25)" }}><div className="truncate text-[8px]" style={{ color: "var(--darkroom-text-muted)" }}>{body.displayName}</div><div className="truncate text-[7px]" style={{ color: "var(--darkroom-text-dim)" }}>{body.materialVariant}</div></div>)}
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <label className="rounded border px-2 py-1.5" style={{ borderColor: "var(--darkroom-border-subtle)" }}><span className="block text-[7px] uppercase tracking-[0.15em]" style={{ color: "var(--darkroom-text-dim)" }}>Named approver</span><input value={approverDisplayName} onChange={(event) => onApproverDisplayNameChange(event.target.value)} placeholder="Full name" className="mt-1 w-full bg-transparent text-[10px] outline-none" /></label>
        <label className="rounded border px-2 py-1.5" style={{ borderColor: "var(--darkroom-border-subtle)" }}><span className="block text-[7px] uppercase tracking-[0.15em]" style={{ color: "var(--darkroom-text-dim)" }}>Assembly-context approval note</span><input value={approvalNote} onChange={(event) => onApprovalNoteChange(event.target.value)} placeholder="Confirmed flush across all five plates" className="mt-1 w-full bg-transparent text-[10px] outline-none" /></label>
      </div>

      {lockError && <div className="mt-2 flex items-start gap-2 text-[8px]" style={{ color: "#ef8d7d" }}><AlertTriangle className="h-3 w-3 shrink-0" />{lockError}</div>}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3" style={{ borderColor: "var(--darkroom-border-subtle)" }}>
        <span className="text-[8px] uppercase tracking-[0.13em]" style={{ color: exactLock ? "#6ee7a8" : "#f2c078" }}>{exactLock ? `Locked by ${lockedPlacement?.approverDisplayName}` : "Requires exact mask + five explicit plates + named approval"}</span>
        <button type="button" disabled={!eligible || lockPending || exactLock} onClick={onLock} className="rounded border px-3 py-2 text-[8px] uppercase tracking-[0.14em] disabled:cursor-not-allowed disabled:opacity-35" style={{ borderColor: "rgba(110,231,168,0.45)", color: "#6ee7a8" }}>{lockPending ? "Locking…" : exactLock ? "Placement locked" : "Lock Shared Placement"}</button>
      </div>
    </section>
  );
}
