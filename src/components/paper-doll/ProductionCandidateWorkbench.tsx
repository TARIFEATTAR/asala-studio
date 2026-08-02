import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Boxes,
  Brush,
  Eye,
  EyeOff,
  Layers3,
  LockKeyhole,
  Move3d,
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
import type { ApprovedCandidateDetails } from "@/lib/paperDoll/candidateReviewPolicy";
import {
  loadSharedPlacement,
  lockSharedPlacement,
  type SharedPlacementRecord,
} from "@/lib/paperDoll/placementRepository";
import {
  applyCandidateAssetPreview,
  selectWorkbenchBody,
  shouldMountCandidatePreview,
} from "./candidatePreviewModel";
import { RollonLineup } from "./RollonLineup";
import { SharedPlacementPanel } from "./SharedPlacementPanel";
import {
  type AssemblyEditMode,
  type CandidateSelectionKind,
} from "./assemblyEditModel";
import { useCandidateMask } from "./useCandidateMask";
import {
  CYL9_ROLLER_CONTACT,
  IDENTITY_FAMILY_PLACEMENT,
  deriveContactPlacement,
  fromSharedPlacementRecord,
  initialFamilyFitState,
  nudgePlacement,
  placementTransformsEqual,
  resizePlacementAroundContact,
  toPlacementLockTransform,
  type FamilyPlacementTransform,
} from "./familyPlacementModel";
import { canEnterFamilyFit } from "./workbenchStageModel";

interface ProductionCandidateWorkbenchProps {
  organizationId: string | null;
  familyKey: string | null;
}

type ReleaseAsset = PaperDollReleaseWorkbenchData["assets"][number];

const IDENTITY_TRANSFORM = { translateXPx: 0, translateYPx: 0, scaleX: 1, scaleY: 1 };
const CYL9_FAMILY_KEY = "CYL-9ML";
const CYL9_ROLLER_GEOMETRY_KEY = "fitment__roller-ball__17-415__v1";
const MEASURED_ROLLER_PLACEMENT = deriveContactPlacement(CYL9_ROLLER_CONTACT);

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
  const queryClient = useQueryClient();
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
  const [candidateTransform, setCandidateTransform] = useState(IDENTITY_TRANSFORM);
  const [familyTransform, setFamilyTransform] = useState<FamilyPlacementTransform>(IDENTITY_FAMILY_PLACEMENT);
  const [inspection, setInspection] = useState<CandidateInspection | null>(null);
  const [approvedCandidate, setApprovedCandidate] = useState<ApprovedCandidateDetails | null>(null);
  const approvedComponentVersionId = approvedCandidate?.componentVersionId ?? null;
  const [approverDisplayName, setApproverDisplayName] = useState("");
  const [placementApprovalNote, setPlacementApprovalNote] = useState("");
  const initializedReleaseRef = useRef<string | null>(null);
  const appliedPlacementRef = useRef<string | null>(null);
  const mask = useCandidateMask();
  const handleInspectionChange = useCallback((next: CandidateInspection | null) => setInspection(next), []);
  const handleApprovedChange = useCallback((next: ApprovedCandidateDetails | null) => setApprovedCandidate(next), []);

  const bodies = useMemo(() => query.data?.assets.filter((asset) => asset.slot === "body") ?? [], [query.data]);
  const components = useMemo(() => query.data?.assets.filter((asset) => asset.slot !== "body") ?? [], [query.data]);
  const placementQueryKey = [
    "paper-doll-shared-placement",
    organizationId,
    CYL9_FAMILY_KEY,
    CYL9_ROLLER_GEOMETRY_KEY,
    approvedCandidate?.authorityMaskSha256 ?? null,
  ] as const;
  const placementQuery = useQuery({
    queryKey: placementQueryKey,
    queryFn: () => loadSharedPlacement(
      supabase as unknown as Parameters<typeof loadSharedPlacement>[0],
      {
        organizationId: organizationId!,
        familyKey: CYL9_FAMILY_KEY,
        fitmentGeometryKey: CYL9_ROLLER_GEOMETRY_KEY,
        authorityMaskSha256: approvedCandidate!.authorityMaskSha256,
      },
    ),
    enabled: Boolean(organizationId && approvedCandidate),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const placementMutation = useMutation({
    mutationFn: async () => {
      if (!organizationId || !approvedCandidate) throw new Error("Approve pixels before locking placement.");
      return lockSharedPlacement(
        supabase as unknown as Parameters<typeof lockSharedPlacement>[0],
        {
          organizationId,
          familyKey: CYL9_FAMILY_KEY,
          fitmentGeometryKey: CYL9_ROLLER_GEOMETRY_KEY,
          calibrationComponentVersionId: approvedCandidate.componentVersionId,
          expectedAuthorityMaskSha256: approvedCandidate.authorityMaskSha256,
          canvas: { widthPx: 2080, heightPx: 2288 },
          transform: toPlacementLockTransform(familyTransform),
          compatibleBodyComponentVersionIds: bodies.map((body) => body.componentVersionId),
          approverDisplayName,
          approvalNote: placementApprovalNote,
        },
      );
    },
    onSuccess: (placement) => {
      queryClient.setQueryData<SharedPlacementRecord>(placementQueryKey, placement);
      appliedPlacementRef.current = placement.id;
      setFamilyTransform(fromSharedPlacementRecord(placement));
    },
  });

  useEffect(() => {
    if (!query.data) return;
    const releaseIdentity = `${query.data.release.familyKey}:${query.data.release.version}:${query.data.release.manifestSha256}`;
    if (initializedReleaseRef.current === releaseIdentity) return;
    const initial = initialFamilyFitState({ familyKey, assets: query.data.assets });
    initializedReleaseRef.current = releaseIdentity;
    // Family Fit is a gated stage. A release with roller assets may suggest the
    // measured starting transform, but it must still open in Edit Lab until the
    // exact immutable approved child has resolved.
    setMode(initial.mode === "family-fit" ? "edit-lab" : initial.mode);
    setSelectedBodyId(initial.selectedBodyId);
    setSelectedLayerId(initial.selectedLayerId);
    setFamilyTransform(initial.transform);
  }, [familyKey, query.data]);

  const selectedAsset = useMemo(
    () => query.data?.assets.find((asset) => asset.componentVersionId === selectedLayerId) ?? null,
    [query.data, selectedLayerId],
  );
  const visibleLayers = useMemo(() => {
    const body = bodies.find((asset) => asset.componentVersionId === selectedBodyId);
    const component = components.find((asset) => asset.componentVersionId === selectedLayerId);
    const layers = [body, component].filter((asset): asset is ReleaseAsset => Boolean(asset && !hiddenIds.has(asset.componentVersionId)));
    const preview = mode === "family-fit" ? approvedCandidate : inspection;
    if (!shouldMountCandidatePreview(mode, preview?.imageUrl ?? null)) return layers;
    return layers.map((asset) => asset.componentVersionId === selectedLayerId && preview?.alphaBounds
      ? applyCandidateAssetPreview(asset, { imageUrl: preview.imageUrl, alphaBounds: preview.alphaBounds })
      : asset,
    );
  }, [approvedCandidate, bodies, components, hiddenIds, inspection, mode, selectedBodyId, selectedLayerId]);

  useEffect(() => {
    setCandidateTransform(IDENTITY_TRANSFORM);
    setInspection(null);
    setApprovedCandidate(null);
    mask.reset();
    // Resetting candidate-local state is intentional when the immutable source layer changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLayerId]);

  useEffect(() => {
    appliedPlacementRef.current = null;
    if (approvedComponentVersionId) setFamilyTransform(MEASURED_ROLLER_PLACEMENT);
  }, [approvedComponentVersionId]);

  useEffect(() => {
    const placement = placementQuery.data;
    if (!placement || appliedPlacementRef.current === placement.id) return;
    appliedPlacementRef.current = placement.id;
    setFamilyTransform(fromSharedPlacementRecord(placement));
  }, [placementQuery.data]);

  useEffect(() => {
    if (mode === "family-fit" && !canEnterFamilyFit({ approved: approvedCandidate })) setMode("edit-lab");
  }, [approvedCandidate, mode]);

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
  const placementEditingEnabled = mode === "family-fit" && selectedAsset?.slot === "roller" && Boolean(approvedCandidate);
  const activeTransform = mode === "family-fit" ? familyTransform : candidateTransform;
  const selectionReady = selectionKind === "whole-layer"
    || (selectionKind === "rectangle" && Boolean(mask.rectangle))
    || (selectionKind === "brush" && mask.brushStrokes.length > 0);
  const lockedPlacement = placementQuery.data ?? null;
  const placementIsExact = Boolean(lockedPlacement
    && approvedCandidate
    && lockedPlacement.authorityMaskSha256 === approvedCandidate.authorityMaskSha256
    && placementTransformsEqual(familyTransform, lockedPlacement.transform));
  const inheritedVariantLabels = components
    .filter((asset) => asset.slot === "roller" && asset.geometryMaskReference?.sha256 === approvedCandidate?.authorityMaskSha256)
    .map((asset) => asset.materialVariant);

  const toggleVisibility = (id: string) => {
    setHiddenIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const enterMode = (nextMode: AssemblyEditMode) => {
    if (nextMode === "family-fit" && !canEnterFamilyFit({ approved: approvedCandidate })) return;
    setMode(nextMode);
    if (nextMode !== "family-fit") return;
    const amber = bodies.find((asset) => asset.variantKey === "AMB") ?? bodies[0];
    if (amber) setSelectedBodyId(amber.componentVersionId);
    setFamilyTransform(lockedPlacement ? fromSharedPlacementRecord(lockedPlacement) : MEASURED_ROLLER_PLACEMENT);
  };

  const setFamilyAxis = (axis: "translateXPx" | "translateYPx", value: number) => {
    if (!Number.isFinite(value)) return;
    setFamilyTransform((current) => ({ ...current, [axis]: Math.round(value) }));
  };

  const setFamilyScale = (value: number) => {
    if (!Number.isFinite(value) || value <= 0) return;
    const scale = Math.round(value * 1000) / 1000;
    setFamilyTransform((current) => resizePlacementAroundContact(current, CYL9_ROLLER_CONTACT, scale));
  };

  const chooseBody = (bodyId: string) => {
    const next = selectWorkbenchBody(selectedLayerId, bodyId);
    setSelectedBodyId(next.selectedBodyId);
    setSelectedLayerId(next.selectedLayerId);
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
          {(["release-lock", "family-fit", "edit-lab"] as AssemblyEditMode[]).map((item) => (
            <button key={item} type="button" disabled={item === "family-fit" && !approvedCandidate} title={item === "family-fit" && !approvedCandidate ? "Approve pixels in Edit Lab first" : undefined} onClick={() => enterMode(item)} className="flex items-center gap-1.5 border-r px-3 py-2 text-[9px] uppercase tracking-[0.14em] last:border-0 disabled:cursor-not-allowed disabled:opacity-35" style={{ borderColor: "var(--darkroom-border-subtle)", background: mode === item ? "rgba(215,168,95,0.12)" : "rgba(0,0,0,0.12)", color: mode === item ? "var(--darkroom-accent)" : "var(--darkroom-text-dim)" }}>
              {item === "release-lock" ? <LockKeyhole className="h-3 w-3" /> : item === "family-fit" ? <Move3d className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}{item === "release-lock" ? "Current Release" : item === "family-fit" ? "Family Fit" : "Edit Lab"}
            </button>
          ))}
        </div>
      </header>

      {mode === "release-lock" && <div className="rounded border px-3 py-2 text-[9px] leading-4" style={{ borderColor: "rgba(215,168,95,0.3)", color: "var(--darkroom-text-muted)", background: "rgba(215,168,95,0.035)" }}><strong style={{ color: "var(--darkroom-accent)" }}>Current Release.</strong> Read-only active ledger snapshot. Approved pixels and placement drafts are not released until a separate release cut. Sanity publication requires its own dry-run and named approval.</div>}

      <div>
        <div className="mb-2 flex items-center justify-between text-[9px] uppercase tracking-[0.18em]" style={{ color: "var(--darkroom-text-dim)" }}><span>Five locked body plates</span><span>baseline alignment sequence</span></div>
        <div className="grid grid-cols-5 gap-2">
          {bodies.map((body) => (
            <button key={body.componentVersionId} type="button" onClick={() => chooseBody(body.componentVersionId)} className="group overflow-hidden rounded border text-left" style={{ borderColor: selectedBodyId === body.componentVersionId ? "var(--darkroom-accent)" : "var(--darkroom-border-subtle)", background: "rgba(255,255,255,0.015)" }}>
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

          <button type="button" onClick={() => { if (mode === "family-fit") setFamilyTransform(lockedPlacement ? fromSharedPlacementRecord(lockedPlacement) : MEASURED_ROLLER_PLACEMENT); else setCandidateTransform(IDENTITY_TRANSFORM); mask.reset(); }} className="flex w-full items-center justify-center gap-2 rounded border px-2 py-2 text-[8px] uppercase tracking-[0.14em]" style={{ borderColor: "var(--darkroom-border-subtle)", color: "var(--darkroom-text-dim)" }}><RotateCcw className="h-3 w-3" />Reset {mode === "family-fit" ? "family placement" : "candidate edit"}</button>
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
            placementEditingEnabled={placementEditingEnabled}
            layerTransform={activeTransform}
            contactGuideYPx={mode === "family-fit" ? CYL9_ROLLER_CONTACT.targetContactYPx : 1002}
            onSelectLayer={setSelectedLayerId}
            onTransformChange={mode === "family-fit" ? setFamilyTransform : setCandidateTransform}
            onRectangleChange={mask.setRectangle}
            onBrushStroke={mask.addBrushStroke}
          />
          {shouldMountCandidatePreview(mode, inspection?.imageUrl ?? null) && (
            <div className="mt-2 rounded border px-3 py-2 text-[8px] uppercase tracking-[0.14em]" style={{ borderColor: "rgba(97,214,200,0.42)", color: "#61d6c8", background: "rgba(97,214,200,0.05)" }}>
              Candidate preview mounted · review before approval · active release unchanged
            </div>
          )}
          {mode === "family-fit" ? (
            <div className="mt-3 rounded border p-3" style={{ borderColor: "rgba(97,214,200,0.35)", background: "rgba(97,214,200,0.035)" }}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-[9px] uppercase tracking-[0.18em]" style={{ color: "#61d6c8" }}><Move3d className="h-3.5 w-3.5" />CYL-9ML roller family placement candidate</div>
                  <p className="mt-1 max-w-xl text-[9px] leading-4" style={{ color: "var(--darkroom-text-dim)" }}>Amber is the calibration reference. Move the complete cropped roller layer; the identical transform cascades to all five locked bodies and every roller material. The hidden insertion plug remains intentionally omitted.</p>
                </div>
                <ToneBadge tone="good">5/5 synchronized</ToneBadge>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
                <label className="rounded border px-2 py-1.5" style={{ borderColor: "var(--darkroom-border-subtle)" }}>
                  <span className="block text-[7px] uppercase tracking-[0.15em]" style={{ color: "var(--darkroom-text-dim)" }}>Family X px</span>
                  <input aria-label="Family X placement" type="number" value={familyTransform.translateXPx} onChange={(event) => setFamilyAxis("translateXPx", Number(event.target.value))} className="mt-1 w-full bg-transparent font-mono text-[11px] outline-none" />
                </label>
                <label className="rounded border px-2 py-1.5" style={{ borderColor: "var(--darkroom-border-subtle)" }}>
                  <span className="block text-[7px] uppercase tracking-[0.15em]" style={{ color: "var(--darkroom-text-dim)" }}>Family Y px</span>
                  <input aria-label="Family Y placement" type="number" value={familyTransform.translateYPx} onChange={(event) => setFamilyAxis("translateYPx", Number(event.target.value))} className="mt-1 w-full bg-transparent font-mono text-[11px] outline-none" />
                </label>
                <label className="rounded border px-2 py-1.5" style={{ borderColor: "var(--darkroom-border-subtle)" }}>
                  <span className="block text-[7px] uppercase tracking-[0.15em]" style={{ color: "var(--darkroom-text-dim)" }}>Uniform scale</span>
                  <input aria-label="Family uniform scale" type="number" min="0.5" max="1.5" step="0.001" value={familyTransform.scaleX} onChange={(event) => setFamilyScale(Number(event.target.value))} className="mt-1 w-full bg-transparent font-mono text-[11px] outline-none" />
                </label>
                <div className="grid grid-cols-3 gap-1 self-center">
                  <span />
                  <button aria-label="Nudge family up one pixel" type="button" onClick={() => setFamilyTransform((current) => nudgePlacement(current, { x: 0, y: -1 }))} className="rounded border p-1.5" style={{ borderColor: "var(--darkroom-border-subtle)" }}><ArrowUp className="h-3 w-3" /></button>
                  <span />
                  <button aria-label="Nudge family left one pixel" type="button" onClick={() => setFamilyTransform((current) => nudgePlacement(current, { x: -1, y: 0 }))} className="rounded border p-1.5" style={{ borderColor: "var(--darkroom-border-subtle)" }}><ArrowLeft className="h-3 w-3" /></button>
                  <button aria-label="Nudge family down one pixel" type="button" onClick={() => setFamilyTransform((current) => nudgePlacement(current, { x: 0, y: 1 }))} className="rounded border p-1.5" style={{ borderColor: "var(--darkroom-border-subtle)" }}><ArrowDown className="h-3 w-3" /></button>
                  <button aria-label="Nudge family right one pixel" type="button" onClick={() => setFamilyTransform((current) => nudgePlacement(current, { x: 1, y: 0 }))} className="rounded border p-1.5" style={{ borderColor: "var(--darkroom-border-subtle)" }}><ArrowRight className="h-3 w-3" /></button>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3" style={{ borderColor: "var(--darkroom-border-subtle)" }}>
                <button type="button" onClick={() => setFamilyTransform(MEASURED_ROLLER_PLACEMENT)} className="rounded border px-3 py-2 text-[8px] uppercase tracking-[0.14em]" style={{ borderColor: "rgba(215,168,95,0.45)", color: "var(--darkroom-accent)" }}>Use calibrated flush · 262 px</button>
                <span className="text-[8px] uppercase tracking-[0.13em]" style={{ color: placementIsExact ? "#6ee7a8" : "#f2c078" }}>{placementIsExact ? `Placement ${lockedPlacement?.id.slice(0, 8)}… loaded` : lockedPlacement ? "Draft changes · lock a new immutable version" : "Placement version not written"}</span>
              </div>
              <SharedPlacementPanel
                approved={approvedCandidate}
                expectedAuthorityMaskSha256={selectedAsset?.geometryMaskReference?.sha256 ?? null}
                bodyPlates={bodies}
                inheritedVariantLabels={inheritedVariantLabels}
                transform={familyTransform}
                lockedPlacement={lockedPlacement}
                approverDisplayName={approverDisplayName}
                approvalNote={placementApprovalNote}
                lockPending={placementMutation.isPending}
                lockError={placementMutation.error instanceof Error
                  ? placementMutation.error.message
                  : placementQuery.error instanceof Error
                    ? placementQuery.error.message
                    : null}
                onApproverDisplayNameChange={setApproverDisplayName}
                onApprovalNoteChange={setPlacementApprovalNote}
                onLock={() => placementMutation.mutate()}
              />
            </div>
          ) : null}
          <div className="mt-3">
            <CandidateActionPanel
              organizationId={organizationId}
              familyKey="CYL-9ML"
              asset={selectedAsset}
              assemblyContext={bodies.find((asset) => asset.componentVersionId === selectedBodyId) ?? null}
              selectionKind={selectionKind}
              transform={candidateTransform}
              candidateEditingEnabled={candidateEditingEnabled}
              selectionReady={selectionReady}
              serializeMask={() => mask.serializeMask(selectionKind)}
              onInspectionChange={handleInspectionChange}
              onApprovedChange={handleApprovedChange}
              reviewOnly={mode === "family-fit"}
            />
          </div>
        </div>

        <CandidateInspector asset={selectedAsset} mode={mode} selectionKind={selectionKind} transform={activeTransform} inspection={inspection} />
      </div>

      <RollonLineup
        assets={query.data.assets}
        rollerVariantKey={selectedAsset?.slot === "roller" ? inspection?.variantLabel ?? selectedAsset.variantKey : undefined}
        rollerImageUrlOverride={selectedAsset?.slot === "roller" && mode === "family-fit" && approvedCandidate
          ? approvedCandidate.imageUrl
          : selectedAsset?.slot === "roller" && shouldMountCandidatePreview(mode, inspection?.imageUrl ?? null)
            ? inspection?.imageUrl ?? undefined
          : undefined}
        placementTransform={mode === "family-fit" ? familyTransform : IDENTITY_FAMILY_PLACEMENT}
        placementId={mode === "family-fit" && placementIsExact ? lockedPlacement?.id : undefined}
      />

      <footer className="flex flex-wrap items-center justify-between gap-2 rounded border px-3 py-2 text-[8px] uppercase tracking-[0.14em]" style={{ borderColor: "rgba(242,192,120,0.25)", color: "#f2c078", background: "rgba(242,192,120,0.035)" }}>
        <span className="flex items-center gap-2"><AlertTriangle className="h-3 w-3" />{mode === "family-fit" ? "Visual placement candidate · active release unchanged · no ledger or Sanity write" : "Candidate-only writes · active release unchanged · no Sanity publication"}</span>
        <span>{components.length} components registered · {bodies.length}/5 locked plates</span>
      </footer>
    </section>
  );
}
