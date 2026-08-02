import { useState } from "react";
import { AlertTriangle, CheckCircle2, Fingerprint, ShieldCheck } from "lucide-react";

import type { PaperDollReleaseWorkbenchData } from "@/lib/paperDoll/releaseRepository";
import {
  shouldShowGeometryLocked,
  type AssemblyEditMode,
  type CandidateSelectionKind,
} from "./assemblyEditModel";

type ReleaseAsset = PaperDollReleaseWorkbenchData["assets"][number];
type InspectorTab = "source" | "candidate" | "difference";

export interface CandidateInspection {
  imageUrl: string | null;
  differenceUrl: string | null;
  provider: string;
  model: string;
  estimatedCostUsd: number | null;
  promptHash: string | null;
  changedPixels: number | null;
  geometryLocked: boolean;
  geometryGate: string | null;
  qaStatus: "not-run" | "passed" | "failed";
}

interface CandidateInspectorProps {
  asset: ReleaseAsset | null;
  mode: AssemblyEditMode;
  selectionKind: CandidateSelectionKind;
  transform: { translateXPx: number; translateYPx: number; scaleX: number; scaleY: number };
  inspection: CandidateInspection | null;
}

const TABS: InspectorTab[] = ["source", "candidate", "difference"];

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b py-2 last:border-0" style={{ borderColor: "var(--darkroom-border-subtle)" }}>
      <span className="text-[9px] uppercase tracking-[0.16em]" style={{ color: "var(--darkroom-text-dim)" }}>{label}</span>
      <span className="max-w-[62%] break-all text-right font-mono text-[9px]" style={{ color: "var(--darkroom-text-muted)" }}>{value}</span>
    </div>
  );
}

export function CandidateInspector({ asset, mode, selectionKind, transform, inspection }: CandidateInspectorProps) {
  const [tab, setTab] = useState<InspectorTab>("source");
  const geometryLocked = inspection ? shouldShowGeometryLocked(inspection) : false;
  const previewUrl = tab === "source" ? asset?.imageUrl : tab === "candidate" ? inspection?.imageUrl : inspection?.differenceUrl;

  return (
    <aside className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[9px] uppercase tracking-[0.22em]" style={{ color: "var(--darkroom-accent)" }}>Candidate inspector</div>
          <div className="mt-1 font-serif text-base" style={{ color: "var(--darkroom-text-primary)" }}>{asset?.displayName ?? "No layer selected"}</div>
        </div>
        <Fingerprint className="h-4 w-4" style={{ color: "var(--darkroom-text-dim)" }} />
      </div>

      <div className="grid grid-cols-3 overflow-hidden rounded border" style={{ borderColor: "var(--darkroom-border-subtle)" }}>
        {TABS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            className="border-r px-1 py-2 text-[8px] uppercase tracking-[0.12em] last:border-0"
            style={{
              borderColor: "var(--darkroom-border-subtle)",
              background: tab === item ? "rgba(215,168,95,0.11)" : "rgba(255,255,255,0.015)",
              color: tab === item ? "var(--darkroom-accent)" : "var(--darkroom-text-dim)",
            }}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="flex aspect-[10/11] items-center justify-center overflow-hidden rounded border" style={{ borderColor: "var(--darkroom-border-subtle)", background: "#f5f3ef" }}>
        {previewUrl ? (
          <img src={previewUrl} alt={`${tab} preview`} className="h-full w-full object-contain" />
        ) : (
          <div className="max-w-[180px] px-4 text-center text-[10px] leading-5" style={{ color: "#716d67" }}>
            {tab === "source" ? "Select a registered release layer." : `${tab} appears only after a candidate job is processed and verified.`}
          </div>
        )}
      </div>

      <div className="rounded border p-3" style={{ borderColor: geometryLocked ? "rgba(110,231,168,0.42)" : "var(--darkroom-border-subtle)", background: "rgba(255,255,255,0.015)" }}>
        <div className="flex items-center gap-2 text-[9px] uppercase tracking-[0.16em]" style={{ color: geometryLocked ? "#6ee7a8" : "#f2c078" }}>
          {geometryLocked ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
          {geometryLocked ? "Geometry locked" : "Geometry lock not earned"}
        </div>
        <p className="mt-2 text-[9px] leading-4" style={{ color: "var(--darkroom-text-dim)" }}>
          Exact server-side authority-mask alpha identity is the only accepted lock gate. A reference image or bounding box is not a lock.
        </p>
      </div>

      <div className="rounded border px-3" style={{ borderColor: "var(--darkroom-border-subtle)", background: "rgba(0,0,0,0.14)" }}>
        <Metric label="Mode" value={mode} />
        <Metric label="Selection" value={selectionKind} />
        <Metric label="Source SHA" value={asset ? `${asset.reference.sha256.slice(0, 14)}…` : "—"} />
        <Metric label="Version" value={asset?.versionKey ?? "—"} />
        <Metric label="Authority mask" value={asset?.geometryMaskUrl ? "registered" : "missing"} />
        <Metric label="Transform" value={`x ${transform.translateXPx} · y ${transform.translateYPx} · ${transform.scaleX.toFixed(3)}×`} />
        <Metric label="Provider" value={inspection?.provider ?? "not dispatched"} />
        <Metric label="Model" value={inspection?.model ?? "—"} />
        <Metric label="Estimated cost" value={inspection?.estimatedCostUsd == null ? "—" : `$${inspection.estimatedCostUsd.toFixed(4)}`} />
        <Metric label="Prompt hash" value={inspection?.promptHash ? `${inspection.promptHash.slice(0, 14)}…` : "—"} />
        <Metric label="Changed pixels" value={inspection?.changedPixels?.toLocaleString() ?? "—"} />
        <Metric label="QA" value={inspection?.qaStatus ?? "not-run"} />
      </div>

      <div className="flex items-center gap-2 rounded border px-3 py-2 text-[9px] uppercase tracking-[0.14em]" style={{ borderColor: "rgba(242,192,120,0.28)", color: "#f2c078" }}>
        <ShieldCheck className="h-3.5 w-3.5" />Sanity publication remains locked
      </div>
    </aside>
  );
}
