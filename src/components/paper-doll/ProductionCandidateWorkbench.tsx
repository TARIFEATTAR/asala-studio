import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Boxes,
  Brush,
  Eye,
  EyeOff,
  Layers3,
  LockKeyhole,
  MousePointer2,
  RectangleHorizontal,
  RotateCcw,
  ShieldAlert,
  Sparkles,
} from "lucide-react";

import { LEDIndicator, LCDDisplay } from "@/components/darkroom/LEDIndicator";
import { supabase } from "@/integrations/supabase/client";
import {
  loadPaperDollReleaseWorkbench,
  type PaperDollReleaseRpcClient,
  type PaperDollReleaseWorkbenchData,
} from "@/lib/paperDoll/releaseRepository";
import { AssemblyEditCanvas } from "./AssemblyEditCanvas";
import { CandidateActionPanel } from "./CandidateActionPanel";
import { CandidateInspector, type CandidateInspection } from "./CandidateInspector";
import {
  type AssemblyEditMode,
  type CandidateSelectionKind,
} from "./assemblyEditModel";
import { useCandidateMask } from "./useCandidateMask";

interface ProductionCandidateWorkbenchProps {
  organizationId: string | null;
  familyKey: string | null;
}

type ReleaseAsset = PaperDollReleaseWorkbenchData["assets"][number];

const IDENTITY_TRANSFORM = { translateXPx: 0, translateYPx: 0, scaleX: 1, scaleY: 1 };
const CYL9_FAMILY_KEY = "CYL-9ML";

function ToneBadge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "good" | "warning" }) {
  const color = tone === "good" ? "#6ee7a8" : tone === "warning" ? "#f2c078" : "var(--darkroom-text-muted)";
  return <span className="rounded-full border px-2 py-0.5 text-[8px] uppercase tracking-[0.15em]" style={{ borderColor: `${color}55`, color }}>{children}</span>;
}

function Unavailable({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-h-[460px] items-center justify-center rounded border border-dashed p-8" style={{ borderColor: "var(--darkroom-border-subtle)", background: "rgba(0,0,0,0.1)" }}>
      <div className="max-w-lg text-center">
        <ShieldAlert className="mx-auto h-6 w-6" style={{ color: "#f2c078" }} />
        <h3 className="mt-3 font-serif text-xl" style={{ color: "var(--darkroom-text-primary)" }}>{title}</h3>
        <p className="mt-2 text-xs leading-6" style={{ color: "var(--darkroom-text-muted)" }}>{children}</p>
      </div>
    </div>
  );
}

export function ProductionCandidateWorkbench({ organizationId, familyKey }: ProductionCandidateWorkbenchProps) {
  const query = useQuery({
    queryKey: ["paper-doll-production-workbench", organizationId, familyKey],
    queryFn: () => loadPaperDollReleaseWorkbench(
      supabase as unknown as PaperDollReleaseRpcClient,
      organizationId!,
      familyKey!,
    ),
    enabled: Boolean(organizationId && familyKey === CYL9_FAMILY_KEY),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const [mode, setMode] = useState<AssemblyEditMode>("release-lock");
  const [selectionKind, setSelectionKind] = useState<CandidateSelectionKind>("whole-layer");
  const [selectedBodyId, setSelectedBodyId] = useState<string | null>(null);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [transform, setTransform] = useState(IDENTITY_TRANSFORM);
  const [inspection, setInspection] = useState<CandidateInspection | null>(null);
  const mask = useCandidateMask();
  const handleInspectionChange = useCallback((next: CandidateInspection | null) => setInspection(next), []);

  const bodies = useMemo(() => query.data?.assets.filter((asset) => asset.slot === "body") ?? [], [query.data]);
  const components = useMemo(() => query.data?.assets.filter((asset) => asset.slot !== "body") ?? [], [query.data]);

  useEffect(() => {
    if (!selectedBodyId && bodies[0]) {
      setSelectedBodyId(bodies[0].componentVersionId);
      setSelectedLayerId(bodies[0].componentVersionId);
    }
  }, [bodies, selectedBodyId]);

  const selectedAsset = useMemo(
    () => query.data?.assets.find((asset) => asset.componentVersionId === selectedLayerId) ?? null,
    [query.data, selectedLayerId],
  );
  const visibleLayers = useMemo(() => {
    const body = bodies.find((asset) => asset.componentVersionId === selectedBodyId);
    const component = components.find((asset) => asset.componentVersionId === selectedLayerId);
    return [body, component].filter((asset): asset is ReleaseAsset => Boolean(asset && !hiddenIds.has(asset.componentVersionId)));
  }, [bodies, components, hiddenIds, selectedBodyId, selectedLayerId]);

  useEffect(() => {
    setTransform(IDENTITY_TRANSFORM);
    setInspection(null);
    mask.reset();
    // Resetting candidate-local state is intentional when the immutable source layer changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLayerId]);

  if (!organizationId) {
    return <Unavailable title="Organization context required">The private release ledger cannot be resolved without an organization. No local images or query-string preview will substitute for it.</Unavailable>;
  }
  if (familyKey !== CYL9_FAMILY_KEY) {
    return <Unavailable title="Production workbench unavailable">This calibration bench is intentionally restricted to the registered {CYL9_FAMILY_KEY} release. This product group is not connected to that release family.</Unavailable>;
  }
  if (query.isLoading) {
    return <div className="flex min-h-[460px] items-center justify-center gap-3 text-xs" style={{ color: "var(--darkroom-text-muted)" }}><LEDIndicator state="processing" />Resolving private CYL‑9ML assets and checksums…</div>;
  }
  if (query.error) {
    return <Unavailable title="Release ledger unavailable">{query.error instanceof Error ? query.error.message : String(query.error)}</Unavailable>;
  }
  if (!query.data) {
    return <Unavailable title="No registered CYL‑9ML release">The workbench never fabricates a release from bundled or public files. Register the five locked plates in the private ledger first.</Unavailable>;
  }

  const candidateEditingEnabled = mode === "edit-lab"
    && selectedAsset?.slot !== "body"
    && Boolean(selectedAsset?.geometryMaskUrl);
  const selectionReady = selectionKind === "whole-layer"
    || (selectionKind === "rectangle" && Boolean(mask.rectangle))
    || (selectionKind === "brush" && mask.brushStrokes.length > 0);

  const toggleVisibility = (id: string) => {
    setHiddenIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <section className="space-y-3">
      <header className="flex flex-wrap items-start justify-between gap-3 rounded border px-4 py-3" style={{ borderColor: "var(--darkroom-border-subtle)", background: "linear-gradient(120deg,rgba(215,168,95,0.09),rgba(0,0,0,0.12))" }}>
        <div>
          <div className="flex items-center gap-2 text-[9px] uppercase tracking-[0.24em]" style={{ color: "var(--darkroom-accent)" }}><Boxes className="h-3.5 w-3.5" />Production candidate bench</div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h2 className="font-serif text-xl">{query.data.release.familyKey}</h2>
            <LCDDisplay>{query.data.release.version}</LCDDisplay>
            <ToneBadge tone={query.data.release.status === "ready" ? "good" : "warning"}>{query.data.release.status}</ToneBadge>
            <ToneBadge>{query.data.release.canvasWidthPx}×{query.data.release.canvasHeightPx}</ToneBadge>
          </div>
          <div className="mt-1 font-mono text-[8px]" style={{ color: "var(--darkroom-text-dim)" }}>manifest {query.data.release.manifestSha256.slice(0, 16)}… · live private ledger</div>
        </div>
        <div className="flex overflow-hidden rounded border" style={{ borderColor: "var(--darkroom-border-subtle)" }}>
          {(["release-lock", "edit-lab"] as AssemblyEditMode[]).map((item) => (
            <button key={item} type="button" onClick={() => setMode(item)} className="flex items-center gap-1.5 border-r px-3 py-2 text-[9px] uppercase tracking-[0.14em] last:border-0" style={{ borderColor: "var(--darkroom-border-subtle)", background: mode === item ? "rgba(215,168,95,0.12)" : "rgba(0,0,0,0.12)", color: mode === item ? "var(--darkroom-accent)" : "var(--darkroom-text-dim)" }}>
              {item === "release-lock" ? <LockKeyhole className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}{item.replace("-", " ")}
            </button>
          ))}
        </div>
      </header>

      <div>
        <div className="mb-2 flex items-center justify-between text-[9px] uppercase tracking-[0.18em]" style={{ color: "var(--darkroom-text-dim)" }}><span>Five locked body plates</span><span>baseline alignment sequence</span></div>
        <div className="grid grid-cols-5 gap-2">
          {bodies.map((body) => (
            <button key={body.componentVersionId} type="button" onClick={() => { setSelectedBodyId(body.componentVersionId); setSelectedLayerId(body.componentVersionId); }} className="group overflow-hidden rounded border text-left" style={{ borderColor: selectedBodyId === body.componentVersionId ? "var(--darkroom-accent)" : "var(--darkroom-border-subtle)", background: "rgba(255,255,255,0.015)" }}>
              <div className="aspect-[10/11] bg-[#f5f3ef] p-1"><img src={body.imageUrl} alt={body.displayName} className="h-full w-full object-contain" /></div>
              <div className="truncate border-t px-2 py-1.5 text-[8px] uppercase tracking-[0.12em]" style={{ borderColor: "var(--darkroom-border-subtle)", color: selectedBodyId === body.componentVersionId ? "var(--darkroom-accent)" : "var(--darkroom-text-dim)" }}>{body.materialVariant}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="grid min-w-0 gap-3 2xl:grid-cols-[190px_minmax(420px,1fr)_230px]">
        <aside className="space-y-3 rounded border p-3" style={{ borderColor: "var(--darkroom-border-subtle)", background: "rgba(0,0,0,0.12)" }}>
          <div className="flex items-center gap-2 text-[9px] uppercase tracking-[0.19em]" style={{ color: "var(--darkroom-accent)" }}><Layers3 className="h-3.5 w-3.5" />Assembly stack</div>
          <div className="space-y-1">
            {[...bodies.filter((asset) => asset.componentVersionId === selectedBodyId), ...components].map((asset) => {
              const selected = selectedLayerId === asset.componentVersionId;
              const hidden = hiddenIds.has(asset.componentVersionId);
              return (
                <div key={asset.componentVersionId} className="flex items-center gap-1 rounded border p-1" style={{ borderColor: selected ? "rgba(215,168,95,0.52)" : "var(--darkroom-border-subtle)", background: selected ? "rgba(215,168,95,0.07)" : "transparent" }}>
                  <button type="button" onClick={() => setSelectedLayerId(asset.componentVersionId)} className="min-w-0 flex-1 px-1 text-left">
                    <div className="truncate text-[10px]" style={{ color: selected ? "var(--darkroom-text-primary)" : "var(--darkroom-text-muted)" }}>{asset.displayName}</div>
                    <div className="truncate font-mono text-[8px]" style={{ color: "var(--darkroom-text-dim)" }}>{asset.slot} · {asset.materialVariant}</div>
                  </button>
                  <button type="button" onClick={() => toggleVisibility(asset.componentVersionId)} className="rounded p-1 hover:bg-white/5" aria-label={`${hidden ? "Show" : "Hide"} ${asset.displayName}`}>{hidden ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}</button>
                </div>
              );
            })}
          </div>
          {components.length === 0 && <div className="rounded border border-dashed p-2 text-[9px] leading-4" style={{ borderColor: "var(--darkroom-border-subtle)", color: "#f2c078" }}>No roll-on component versions are registered yet. The five body plates remain the only surfaced assets.</div>}

          <div className="border-t pt-3" style={{ borderColor: "var(--darkroom-border-subtle)" }}>
            <div className="mb-2 text-[8px] uppercase tracking-[0.16em]" style={{ color: "var(--darkroom-text-dim)" }}>Candidate selection</div>
            <div className="space-y-1">
              {([
                ["whole-layer", MousePointer2, "Whole layer"],
                ["rectangle", RectangleHorizontal, "Rectangle"],
                ["brush", Brush, "Brush mask"],
              ] as const).map(([kind, Icon, label]) => (
                <button key={kind} type="button" disabled={!candidateEditingEnabled} onClick={() => { setSelectionKind(kind); mask.reset(); }} className="flex w-full items-center gap-2 rounded border px-2 py-1.5 text-[9px] disabled:opacity-35" style={{ borderColor: selectionKind === kind ? "rgba(97,214,200,0.48)" : "var(--darkroom-border-subtle)", color: selectionKind === kind ? "#61d6c8" : "var(--darkroom-text-dim)" }}><Icon className="h-3 w-3" />{label}</button>
              ))}
            </div>
          </div>

          <button type="button" onClick={() => { setTransform(IDENTITY_TRANSFORM); mask.reset(); }} className="flex w-full items-center justify-center gap-2 rounded border px-2 py-2 text-[8px] uppercase tracking-[0.14em]" style={{ borderColor: "var(--darkroom-border-subtle)", color: "var(--darkroom-text-dim)" }}><RotateCcw className="h-3 w-3" />Reset candidate edit</button>
        </aside>

        <div className="rounded border p-3" style={{ borderColor: "var(--darkroom-border-subtle)", background: "rgba(0,0,0,0.12)" }}>
          <AssemblyEditCanvas
            layers={visibleLayers}
            selectedLayerId={selectedLayerId}
            mode={mode}
            selectionKind={selectionKind}
            showGuides
            showMaskOverlay
            candidateEditingEnabled={candidateEditingEnabled}
            onSelectLayer={setSelectedLayerId}
            onTransformChange={setTransform}
            onRectangleChange={mask.setRectangle}
            onBrushStroke={mask.addBrushStroke}
          />
          <div className="mt-3">
            <CandidateActionPanel
              organizationId={organizationId}
              familyKey="CYL-9ML"
              asset={selectedAsset}
              assemblyContext={bodies.find((asset) => asset.componentVersionId === selectedBodyId) ?? null}
              selectionKind={selectionKind}
              transform={transform}
              candidateEditingEnabled={candidateEditingEnabled}
              selectionReady={selectionReady}
              serializeMask={() => mask.serializeMask(selectionKind)}
              onInspectionChange={handleInspectionChange}
            />
          </div>
        </div>

        <CandidateInspector asset={selectedAsset} mode={mode} selectionKind={selectionKind} transform={transform} inspection={inspection} />
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-2 rounded border px-3 py-2 text-[8px] uppercase tracking-[0.14em]" style={{ borderColor: "rgba(242,192,120,0.25)", color: "#f2c078", background: "rgba(242,192,120,0.035)" }}>
        <span className="flex items-center gap-2"><AlertTriangle className="h-3 w-3" />Candidate-only writes · active release unchanged · no Sanity publication</span>
        <span>{components.length} components registered · {bodies.length}/5 locked plates</span>
      </footer>
    </section>
  );
}
