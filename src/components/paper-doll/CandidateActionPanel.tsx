import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, CloudUpload, Cpu, FolderOpen, Play, RefreshCw, ShieldCheck } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  CandidateProviderModels,
  type CandidateJobRequest,
  type CandidateProvider,
  type ManualCandidateAssetRef,
  type PrivateAssetRef,
} from "@/lib/paperDoll/candidateJobContract";
import {
  approveCandidate,
  createCandidateJob,
  loadCandidateWorkbench,
  uploadCandidateSource,
  uploadManualCandidateSource,
  verifySignedPrivateAsset,
  type CandidateHistoryEntry,
} from "@/lib/paperDoll/candidateRepository";
import { downloadImageLibraryCandidate } from "@/lib/paperDoll/libraryCandidateSource";
import { authorityMaskBlocker } from "@/lib/paperDoll/authorityMaskPolicy";
import {
  candidateAuditReason,
  candidateAuthorityBlocker,
  candidatePreviewDetails,
  selectCandidateForReview,
} from "@/lib/paperDoll/candidateReviewPolicy";
import type { PaperDollReleaseWorkbenchData } from "@/lib/paperDoll/releaseRepository";
import { ImageLibraryModal } from "@/components/image-editor/ImageLibraryModal";
import type { CandidateInspection } from "./CandidateInspector";
import type { CandidateSelectionKind } from "./assemblyEditModel";
import { candidateHistoryRefreshInterval } from "./candidatePreviewModel";

type ReleaseAsset = PaperDollReleaseWorkbenchData["assets"][number];

interface CandidateActionPanelProps {
  organizationId: string;
  familyKey: "CYL-9ML";
  asset: ReleaseAsset | null;
  assemblyContext: ReleaseAsset | null;
  selectionKind: CandidateSelectionKind;
  transform: { translateXPx: number; translateYPx: number; scaleX: number; scaleY: number };
  candidateEditingEnabled: boolean;
  selectionReady: boolean;
  serializeMask: () => Promise<string>;
  onInspectionChange: (inspection: CandidateInspection | null) => void;
  reviewOnly?: boolean;
}

const PROVIDERS: Array<{ id: CandidateProvider; label: string; detail: string }> = [
  { id: "blender", label: "Blender", detail: "canonical render" },
  { id: "openai", label: "GPT Image", detail: "gpt-image-2" },
  { id: "google", label: "Nano Banana", detail: "Gemini image" },
  { id: "manual", label: "Upload", detail: "versioned source" },
];
const OVERCAP_VARIANTS = new Set(["SHN-SL", "SHN-GL", "MAT-CU", "SHN-BLK", "MAT-SL", "MAT-GL", "WHT", "SL-DOT", "BLK-DOT", "PNK-DOT"]);
const ROLLER_VARIANTS = new Set(["PLASTIC", "METAL"]);

function dataUrlBytes(dataUrl: string): Uint8Array {
  const encoded = dataUrl.split(",")[1];
  if (!encoded) throw new Error("Edit mask could not be serialized.");
  const binary = atob(encoded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function assetRef(asset: ReleaseAsset): PrivateAssetRef {
  return {
    bucket: asset.reference.storageBucket,
    path: asset.reference.objectPath,
    sha256: asset.reference.sha256,
    contentType: asset.reference.contentType,
    byteSize: asset.reference.byteSize,
  };
}

function inspectionFrom(entry: CandidateHistoryEntry | null, maskBlocker: string | null): CandidateInspection | null {
  if (!entry) return null;
  const metadata = entry.job.outputMetadata;
  const preview = candidatePreviewDetails(entry);
  const blocking = entry.qa.filter((row) => row.blocking === true);
  const failed = blocking.some((row) => row.qa_status !== "passed");
  return {
    imageUrl: preview?.imageUrl ?? null,
    candidateSha256: preview?.candidateSha256 ?? null,
    alphaBounds: preview?.alphaBounds ?? null,
    differenceUrl: null,
    provider: entry.job.provider,
    model: entry.job.model,
    estimatedCostUsd: null,
    promptHash: entry.job.promptSha256,
    changedPixels: typeof metadata.changedPixelCount === "number" ? metadata.changedPixelCount : null,
    geometryLocked: metadata.geometryLocked === true && !maskBlocker,
    geometryGate: typeof metadata.geometryGate === "string" ? metadata.geometryGate : null,
    qaStatus: maskBlocker ? "failed" : blocking.length === 0 ? "not-run" : failed ? "failed" : "passed",
    variantLabel: entry.job.requirementKey.split(":").at(-1) ?? null,
  };
}

export function CandidateActionPanel({
  organizationId,
  familyKey,
  asset,
  assemblyContext,
  selectionKind,
  transform,
  candidateEditingEnabled,
  selectionReady,
  serializeMask,
  onInspectionChange,
  reviewOnly = false,
}: CandidateActionPanelProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [provider, setProvider] = useState<CandidateProvider>("blender");
  const [model, setModel] = useState<string>(CandidateProviderModels.blender[0]);
  const [instruction, setInstruction] = useState("Preserve the exact moulded phenolic plastic closure geometry. Change only the specified surface finish and retain the catalog lighting direction.");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [reviewVariant, setReviewVariant] = useState<"PLASTIC" | "METAL">(
    asset?.variantKey === "METAL" ? "METAL" : "PLASTIC",
  );

  const history = useQuery({
    queryKey: ["paper-doll-candidate-history", organizationId, familyKey],
    queryFn: () => loadCandidateWorkbench(supabase, organizationId, familyKey),
    refetchInterval: (candidateQuery) => candidateHistoryRefreshInterval(candidateQuery.state.data?.jobs),
    refetchOnWindowFocus: false,
  });
  const componentHistory = useMemo(
    () => history.data?.jobs.filter((entry) => entry.job.componentId === asset?.componentId) ?? [],
    [asset?.componentId, history.data?.jobs],
  );
  const availableReviewVariants = useMemo(() => Array.from(new Set(
    componentHistory
      .map((entry) => entry.job.requirementKey.split(":").at(-1))
      .filter((variant): variant is "PLASTIC" | "METAL" => variant === "PLASTIC" || variant === "METAL"),
  )), [componentHistory]);
  const selectedHistory = useMemo(
    () => componentHistory.filter((entry) => entry.job.requirementKey.endsWith(`:${reviewVariant}`)),
    [componentHistory, reviewVariant],
  );
  useEffect(() => {
    if (!availableReviewVariants.includes(reviewVariant) && availableReviewVariants.length > 0) {
      setReviewVariant(availableReviewVariants[0]);
    }
  }, [availableReviewVariants, reviewVariant]);
  // Failed and revoked outputs remain immutable audit records, but they cannot
  // displace a clean candidate in the working inspector.
  const latest = selectCandidateForReview(selectedHistory);
  const parentMaskBlocker = authorityMaskBlocker(asset?.geometryMaskReference?.sha256);
  const candidateMaskBlocker = candidateAuthorityBlocker(latest);

  useEffect(() => onInspectionChange(inspectionFrom(latest, candidateMaskBlocker)), [latest, candidateMaskBlocker, onInspectionChange]);

  const requirement = useMemo(() => {
    if (!asset) return null;
    if (asset.slot === "roller" && ROLLER_VARIANTS.has(reviewVariant)) return `CYL-9ML:ROLLER:${reviewVariant}`;
    if ((asset.slot === "overcap" || asset.slot === "cap") && OVERCAP_VARIANTS.has(asset.variantKey)) return `CYL-9ML:OVERCAP:${asset.variantKey}`;
    return null;
  }, [asset, reviewVariant]);

  const chooseProvider = (next: CandidateProvider) => {
    setProvider(next);
    setModel(CandidateProviderModels[next][0]);
    setMessage(null);
    setError(null);
  };

  const buildRequest = async (manualOutput?: ManualCandidateAssetRef): Promise<CandidateJobRequest> => {
    if (parentMaskBlocker) throw new Error(parentMaskBlocker);
    if (!asset || !requirement || !asset.geometryMaskUrl || !asset.geometryMaskReference) {
      throw new Error("A registered component requirement and authority mask are required.");
    }
    const editMaskBytes = dataUrlBytes(await serializeMask());
    const editMask = await uploadCandidateSource(supabase, {
      organizationId,
      familyKey,
      assetId: `edit-mask-${asset.componentVersionId}-${selectionKind}`,
      bytes: editMaskBytes,
      contentType: "image/png",
      extension: "png",
    });
    const authoritativeMask = await verifySignedPrivateAsset(asset.geometryMaskUrl, {
      bucket: asset.geometryMaskReference.storageBucket,
      path: asset.geometryMaskReference.objectPath,
      sha256: asset.geometryMaskReference.sha256,
      contentType: "image/png",
    });
    return {
      organizationId,
      requirementKey: requirement,
      componentId: asset.componentId,
      parentComponentVersionId: asset.componentVersionId,
      parentSha256: asset.reference.sha256,
      provider,
      model,
      instruction,
      source: assetRef(asset),
      authoritativeMask,
      editMask,
      assemblyContext: assemblyContext ? assetRef(assemblyContext) : undefined,
      manualOutput,
      transform,
      selectionKind,
    };
  };

  const queue = async (manualFile?: File) => {
    if (!candidateEditingEnabled || !selectionReady) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      let manualOutput: ManualCandidateAssetRef | undefined;
      if (provider === "manual") {
        if (!manualFile) throw new Error("Choose one PNG manual candidate to upload.");
        manualOutput = await uploadManualCandidateSource(supabase, {
          organizationId,
          familyKey,
          assetId: `manual-output-${asset?.componentVersionId ?? "unknown"}`,
          bytes: new Uint8Array(await manualFile.arrayBuffer()),
          contentType: manualFile.type || "image/png",
          extension: "png",
          originalFilename: manualFile.name,
        });
      }
      const queued = await createCandidateJob(supabase, await buildRequest(manualOutput));
      setMessage(`Queued ${queued.provider} / ${queued.model}. The worker has not claimed it yet.`);
      await queryClient.invalidateQueries({ queryKey: ["paper-doll-candidate-history", organizationId, familyKey] });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  const decide = async (decision: "approved" | "rejected") => {
    if (!latest?.candidateVersion) return;
    const candidateSha = latest.candidateVersion.image_sha256;
    if (typeof candidateSha !== "string") return;
    const evidenceIds = latest.qa.map((row) => row.id).filter((id): id is string => typeof id === "string");
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await approveCandidate(supabase, {
        organizationId,
        candidateComponentVersionId: latest.job.candidateComponentVersionId!,
        expectedCandidateSha256: candidateSha,
        decision,
        approverDisplayName,
        evidenceIds,
      });
      setMessage(`${decision === "approved" ? "Approved child created" : "Rejection recorded"}. Active release unchanged.`);
      await queryClient.invalidateQueries({ queryKey: ["paper-doll-candidate-history", organizationId, familyKey] });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  const queueImageLibraryAsset = async (selection: { url: string; name?: string }) => {
    setLibraryOpen(false);
    try {
      await queue(await downloadImageLibraryCandidate(selection));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const blockingQa = latest?.qa.filter((row) => row.blocking === true) ?? [];
  const approverDisplayName = typeof user?.user_metadata?.full_name === "string"
    ? user.user_metadata.full_name
    : typeof user?.user_metadata?.name === "string"
      ? user.user_metadata.name
      : user?.email ?? "";
  const canApprove = latest?.job.status === "candidate_ready"
    && !latest.approval
    && !candidateMaskBlocker
    && blockingQa.length > 0
    && blockingQa.every((row) => row.qa_status === "passed")
    && Boolean(approverDisplayName);

  return (
    <div className="space-y-3 rounded border p-3" style={{ borderColor: candidateEditingEnabled ? "rgba(97,214,200,0.36)" : "var(--darkroom-border-subtle)", background: "rgba(255,255,255,0.015)" }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 text-[9px] uppercase tracking-[0.17em]" style={{ color: "#61d6c8" }}><Cpu className="h-3.5 w-3.5" />{reviewOnly ? "Candidate review" : "Candidate actions"}</div>
          {!reviewOnly && <div className="mt-1 text-[9px]" style={{ color: "var(--darkroom-text-dim)" }}>Worker: <span style={{ color: history.data?.worker.status === "ready" ? "#6ee7a8" : history.data?.worker.status === "error" ? "#ef8d7d" : "#f2c078" }}>{history.data?.worker.status ?? "checking"}</span></div>}
        </div>
        <button type="button" onClick={() => void history.refetch()} className="rounded p-1.5 hover:bg-white/5" aria-label="Refresh candidate history"><RefreshCw className={`h-3.5 w-3.5 ${history.isFetching ? "animate-spin" : ""}`} /></button>
      </div>

      {parentMaskBlocker && !reviewOnly && (
        <div className="flex items-start gap-2 rounded border px-3 py-2 text-[9px] leading-4" style={{ borderColor: "rgba(239,141,125,0.42)", color: "#ef8d7d", background: "rgba(239,141,125,0.05)" }}>
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{parentMaskBlocker} A clean staged replacement can still be reviewed and approved below.
        </div>
      )}
      {parentMaskBlocker && reviewOnly && latest && !candidateMaskBlocker && (
        <div className="rounded border px-3 py-2 text-[9px] leading-4" style={{ borderColor: "rgba(242,192,120,0.32)", color: "#f2c078", background: "rgba(242,192,120,0.035)" }}>
          The revoked release ancestor remains audit-only. This canvas is using the clean, geometry-locked review candidate.
        </div>
      )}

      {asset?.slot === "roller" && availableReviewVariants.length > 0 && (
        <div>
          <div className="mb-1 text-[8px] uppercase tracking-[0.15em]" style={{ color: "var(--darkroom-text-dim)" }}>Review roller variant</div>
          <div className="grid grid-cols-2 gap-1">
            {(["PLASTIC", "METAL"] as const).map((variant) => (
              <button
                key={variant}
                type="button"
                disabled={!availableReviewVariants.includes(variant)}
                onClick={() => setReviewVariant(variant)}
                className="rounded border px-2 py-2 text-[9px] uppercase tracking-[0.14em] disabled:opacity-30"
                style={{ borderColor: reviewVariant === variant ? "rgba(97,214,200,0.52)" : "var(--darkroom-border-subtle)", color: reviewVariant === variant ? "#61d6c8" : "var(--darkroom-text-dim)" }}
              >{variant === "PLASTIC" ? "Natural plastic" : "Metal ball"}</button>
            ))}
          </div>
        </div>
      )}

      {!reviewOnly && <>
      <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
        {PROVIDERS.map((item) => (
          <button key={item.id} type="button" onClick={() => chooseProvider(item.id)} className="rounded border px-2 py-2 text-left" style={{ borderColor: provider === item.id ? "rgba(97,214,200,0.52)" : "var(--darkroom-border-subtle)", background: provider === item.id ? "rgba(97,214,200,0.06)" : "transparent" }}>
            <div className="text-[9px]" style={{ color: provider === item.id ? "#61d6c8" : "var(--darkroom-text-muted)" }}>{item.label}</div>
            <div className="mt-0.5 text-[7px]" style={{ color: "var(--darkroom-text-dim)" }}>{item.detail}</div>
          </button>
        ))}
      </div>

      {provider === "google" && (
        <select value={model} onChange={(event) => setModel(event.target.value)} className="w-full rounded border bg-black/20 px-2 py-2 font-mono text-[9px]" style={{ borderColor: "var(--darkroom-border-subtle)", color: "var(--darkroom-text-muted)" }}>
          {CandidateProviderModels.google.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      )}
      <textarea value={instruction} onChange={(event) => setInstruction(event.target.value)} disabled={provider === "blender"} rows={3} className="w-full resize-y rounded border bg-black/20 p-2 text-[9px] leading-4 disabled:opacity-45" style={{ borderColor: "var(--darkroom-border-subtle)", color: "var(--darkroom-text-muted)" }} aria-label="Candidate instruction" />

      <div className="flex flex-wrap gap-2">
        {provider === "manual" ? (
          <>
            <label className={`inline-flex cursor-pointer items-center gap-2 rounded border px-3 py-2 text-[9px] uppercase tracking-[0.14em] ${!candidateEditingEnabled || !selectionReady || busy ? "pointer-events-none opacity-35" : ""}`} style={{ borderColor: "rgba(97,214,200,0.48)", color: "#61d6c8" }}>
              <CloudUpload className="h-3.5 w-3.5" />Upload from computer
              <input type="file" accept="image/png" className="hidden" disabled={!candidateEditingEnabled || !selectionReady || busy} onChange={(event) => { const file = event.target.files?.[0]; if (file) void queue(file); event.target.value = ""; }} />
            </label>
            <button type="button" disabled={!candidateEditingEnabled || !selectionReady || busy} onClick={() => setLibraryOpen(true)} className="inline-flex items-center gap-2 rounded border px-3 py-2 text-[9px] uppercase tracking-[0.14em] disabled:opacity-35" style={{ borderColor: "rgba(97,214,200,0.48)", color: "#61d6c8" }}>
              <FolderOpen className="h-3.5 w-3.5" />Choose from Image Library
            </button>
          </>
        ) : (
          <button type="button" disabled={!candidateEditingEnabled || !selectionReady || busy || !instruction.trim()} onClick={() => void queue()} className="inline-flex items-center gap-2 rounded border px-3 py-2 text-[9px] uppercase tracking-[0.14em] disabled:opacity-35" style={{ borderColor: "rgba(97,214,200,0.48)", color: "#61d6c8" }}><Play className="h-3.5 w-3.5" />{busy ? "Queuing…" : "Queue candidate"}</button>
        )}
        <button type="button" disabled={!canApprove || busy} onClick={() => void decide("approved")} className="inline-flex items-center gap-2 rounded border px-3 py-2 text-[9px] uppercase tracking-[0.14em] disabled:opacity-35" style={{ borderColor: "rgba(110,231,168,0.42)", color: "#6ee7a8" }}><ShieldCheck className="h-3.5 w-3.5" />Approve child</button>
        <button type="button" disabled={latest?.job.status !== "candidate_ready" || Boolean(latest.approval) || busy} onClick={() => void decide("rejected")} className="rounded border px-3 py-2 text-[9px] uppercase tracking-[0.14em] disabled:opacity-35" style={{ borderColor: "var(--darkroom-border-subtle)", color: "var(--darkroom-text-dim)" }}>Reject</button>
      </div>

      {!candidateEditingEnabled && <div className="flex items-start gap-2 text-[9px] leading-4" style={{ color: "#f2c078" }}><AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />Select a non-body component with a registered authority mask. Locked plates cannot become generation sources.</div>}
      {candidateEditingEnabled && !selectionReady && <div className="flex items-start gap-2 text-[9px] leading-4" style={{ color: "#f2c078" }}><AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />Draw the selected rectangle or brush mask before queuing.</div>}
      </>}
      {reviewOnly && (
        <div className="rounded border px-3 py-2 text-[8px] uppercase tracking-[0.13em]" style={{ borderColor: "rgba(97,214,200,0.34)", color: "#61d6c8", background: "rgba(97,214,200,0.035)" }}>
          Review candidate mounted for family placement · generation and approval remain in Edit Lab
        </div>
      )}
      {message && <div className="flex items-start gap-2 text-[9px] leading-4" style={{ color: "#6ee7a8" }}><CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0" />{message}</div>}
      {error && <div className="flex items-start gap-2 text-[9px] leading-4" style={{ color: "#ef8d7d" }}><AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />{error}</div>}

      <div className="border-t pt-2" style={{ borderColor: "var(--darkroom-border-subtle)" }}>
        <div className="mb-1 text-[8px] uppercase tracking-[0.15em]" style={{ color: "var(--darkroom-text-dim)" }}>Immutable {reviewVariant.toLowerCase()} history · {selectedHistory.length}</div>
        {selectedHistory.length === 0 ? <div className="text-[9px]" style={{ color: "var(--darkroom-text-dim)" }}>No attempts for this component.</div> : selectedHistory.slice(0, 4).map((entry) => (
          <div key={entry.job.id} className="flex items-center justify-between gap-2 border-t py-1.5 text-[8px]" style={{ borderColor: "var(--darkroom-border-subtle)" }}>
            <span className="min-w-0 font-mono" style={{ color: "var(--darkroom-text-muted)" }}>
              <span className="block truncate">{entry.job.provider} · {entry.job.model}</span>
              {entry.job.manualOutput?.originalFilename && <span className="mt-0.5 block truncate" title={entry.job.manualOutput.originalFilename} style={{ color: "var(--darkroom-text-dim)" }}>{entry.job.manualOutput.originalFilename}</span>}
            </span>
            <span className="text-right uppercase tracking-wider" style={{ color: candidateAuditReason(entry) ? "#ef8d7d" : entry.job.status === "candidate_ready" ? "#6ee7a8" : entry.job.status === "failed" ? "#ef8d7d" : "#f2c078" }}>{candidateAuditReason(entry) ?? entry.job.status.replace("_", " ")}</span>
          </div>
        ))}
      </div>
      <ImageLibraryModal
        open={libraryOpen}
        onOpenChange={setLibraryOpen}
        onSelectImage={(selection) => void queueImageLibraryAsset(selection)}
        title={`Choose a candidate for ${asset?.displayName ?? "the selected component"}`}
        allowDesktopUpload={false}
      />
    </div>
  );
}
