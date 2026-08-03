import { useEffect, useMemo, useState } from "react";
import { ImagePlus, RefreshCw, ShieldCheck } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { uploadCandidateSource } from "@/lib/paperDoll/candidateRepository";
import { normalizeComponentSource } from "@/lib/paperDoll/componentSourceNormalizer";
import { registerPaperDollComponentSource } from "@/lib/paperDoll/componentSourceRepository";

type IntakeSlot = "cap" | "roller" | "sprayer" | "overcap" | "pump";

function safeKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9.-]+/g, "-").replace(/^-+|-+$/g, "");
}

export function ComponentSourceIntakePanel({
  organizationId,
  registrarDisplayName,
  onRegistrarDisplayNameChange,
  onRegistered,
}: {
  organizationId: string;
  registrarDisplayName: string;
  onRegistrarDisplayNameChange: (value: string) => void;
  onRegistered: (componentVersionId: string) => void;
}) {
  const [slot, setSlot] = useState<IntakeSlot>("cap");
  const [variantKey, setVariantKey] = useState("SHN-SL");
  const [displayName, setDisplayName] = useState("17-415 shiny silver roll-on cap");
  const [geometryFamilyId, setGeometryFamilyId] = useState("closure__17-415__rollon-overcap__v1");
  const [materialVariant, setMaterialVariant] = useState("vacuum-metallized mirror chrome on moulded phenolic plastic");
  const [versionKey, setVersionKey] = useState("proposed-source-v1");
  const [targetVisibleWidthPx, setTargetVisibleWidthPx] = useState(363);
  const [seatYPx, setSeatYPx] = useState(1002);
  const [intakeNote, setIntakeNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [normalized, setNormalized] = useState<Awaited<ReturnType<typeof normalizeComponentSource>> | null>(null);
  const [normalizedFor, setNormalizedFor] = useState<{ targetVisibleWidthPx: number; seatYPx: number } | null>(null);
  const [normalizing, setNormalizing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const componentKey = useMemo(() => `closure__17-415__${safeKey(displayName)}__${variantKey.toLowerCase()}`, [displayName, variantKey]);

  useEffect(() => () => {
    if (normalized?.previewUrl) URL.revokeObjectURL(normalized.previewUrl);
  }, [normalized?.previewUrl]);

  const chooseFile = async (next: File) => {
    setFile(next); setMessage(null); setError(null); setNormalizing(true);
    try {
      const result = await normalizeComponentSource(next, { targetVisibleWidthPx, seatYPx });
      setNormalized((previous) => {
        if (previous?.previewUrl) URL.revokeObjectURL(previous.previewUrl);
        return result;
      });
      setNormalizedFor({ targetVisibleWidthPx, seatYPx });
    } catch (cause) {
      setNormalized(null);
      setNormalizedFor(null);
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally { setNormalizing(false); }
  };

  const previewMatchesSettings = normalizedFor?.targetVisibleWidthPx === targetVisibleWidthPx
    && normalizedFor?.seatYPx === seatYPx;

  const register = async () => {
    if (!file || !normalized) return;
    if (!registrarDisplayName.trim()) { setError("Enter the named operator above before registering a source."); return; }
    if (!intakeNote.trim()) { setError("Record why this proposed source is entering the candidate workflow."); return; }
    setSubmitting(true); setError(null); setMessage(null);
    try {
      const [source, authorityMask] = await Promise.all([
        uploadCandidateSource(supabase, {
          organizationId, familyKey: "CYL-9ML", assetId: `${componentKey}-source`,
          bytes: new Uint8Array(await normalized.sourceBlob.arrayBuffer()), contentType: "image/png", extension: "png",
        }),
        uploadCandidateSource(supabase, {
          organizationId, familyKey: "CYL-9ML", assetId: `${componentKey}-authority-mask`,
          bytes: new Uint8Array(await normalized.authorityMaskBlob.arrayBuffer()), contentType: "image/png", extension: "png",
        }),
      ]);
      const result = await registerPaperDollComponentSource(
        supabase as unknown as Parameters<typeof registerPaperDollComponentSource>[0],
        {
          organizationId, familyKey: "CYL-9ML", slot, componentKey, geometryFamilyId,
          displayName, variantKey, versionKey, materialVariant, originalFilename: file.name,
          source, authorityMask, alphaBounds: normalized.alphaBounds,
          mountAxisXPx: normalized.mountAxisXPx, seatYPx: normalized.seatYPx,
          registrarDisplayName, intakeNote,
          normalization: {
            targetVisibleWidthPx,
            removedDetachedIslands: normalized.removedDetachedIslands,
            sourceVisibleBounds: normalized.sourceVisibleBounds,
          },
        },
      );
      setMessage("Proposed source registered. Current Release is unchanged; approve its pixels before Family Fit.");
      onRegistered(result.componentVersionId);
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="space-y-3 rounded border p-3" style={{ borderColor: "rgba(97,214,200,0.32)", background: "rgba(97,214,200,0.025)" }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[8px] uppercase tracking-[0.17em]" style={{ color: "#61d6c8" }}><ImagePlus className="h-3.5 w-3.5" />Add proposed component source</div>
          <p className="mt-1 text-[9px] leading-4" style={{ color: "var(--darkroom-text-dim)" }}>Transparent PNG → one clean 2080×2288 source and binary authority mask. This creates a candidate parent only. It does not approve pixels, lock geometry, change Current Release, or publish to Sanity.</p>
        </div>
        <ShieldCheck className="h-4 w-4 shrink-0" style={{ color: "#61d6c8" }} />
      </div>
      <div className="grid gap-2 md:grid-cols-3">
        <label className="rounded border px-2 py-1.5" style={{ borderColor: "var(--darkroom-border-subtle)" }}><span className="block text-[7px] uppercase tracking-[0.14em]">Slot</span><select value={slot} onChange={(event) => setSlot(event.target.value as IntakeSlot)} className="mt-1 w-full bg-transparent text-[10px] outline-none"><option value="cap">Cap</option><option value="sprayer">Sprayer</option><option value="pump">Lotion pump</option><option value="overcap">Protective overcap</option><option value="roller">Roller fitment</option></select></label>
        <label className="rounded border px-2 py-1.5" style={{ borderColor: "var(--darkroom-border-subtle)" }}><span className="block text-[7px] uppercase tracking-[0.14em]">Variant key</span><input value={variantKey} onChange={(event) => setVariantKey(event.target.value.toUpperCase())} className="mt-1 w-full bg-transparent font-mono text-[10px] outline-none" /></label>
        <label className="rounded border px-2 py-1.5" style={{ borderColor: "var(--darkroom-border-subtle)" }}><span className="block text-[7px] uppercase tracking-[0.14em]">Version key</span><input value={versionKey} onChange={(event) => setVersionKey(event.target.value)} className="mt-1 w-full bg-transparent font-mono text-[10px] outline-none" /></label>
        <label className="rounded border px-2 py-1.5 md:col-span-2" style={{ borderColor: "var(--darkroom-border-subtle)" }}><span className="block text-[7px] uppercase tracking-[0.14em]">Display name</span><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="mt-1 w-full bg-transparent text-[10px] outline-none" /></label>
        <label className="rounded border px-2 py-1.5" style={{ borderColor: "var(--darkroom-border-subtle)" }}><span className="block text-[7px] uppercase tracking-[0.14em]">Visible width px</span><input type="number" min="1" max="2080" value={targetVisibleWidthPx} onChange={(event) => setTargetVisibleWidthPx(Number(event.target.value))} className="mt-1 w-full bg-transparent font-mono text-[10px] outline-none" /></label>
        <label className="rounded border px-2 py-1.5 md:col-span-2" style={{ borderColor: "var(--darkroom-border-subtle)" }}><span className="block text-[7px] uppercase tracking-[0.14em]">Geometry family</span><input value={geometryFamilyId} onChange={(event) => setGeometryFamilyId(event.target.value)} className="mt-1 w-full bg-transparent font-mono text-[10px] outline-none" /></label>
        <label className="rounded border px-2 py-1.5" style={{ borderColor: "var(--darkroom-border-subtle)" }}><span className="block text-[7px] uppercase tracking-[0.14em]">Seat Y px</span><input type="number" min="0" max="2287" value={seatYPx} onChange={(event) => setSeatYPx(Number(event.target.value))} className="mt-1 w-full bg-transparent font-mono text-[10px] outline-none" /></label>
        <label className="rounded border px-2 py-1.5 md:col-span-3" style={{ borderColor: "var(--darkroom-border-subtle)" }}><span className="block text-[7px] uppercase tracking-[0.14em]">Material truth</span><input value={materialVariant} onChange={(event) => setMaterialVariant(event.target.value)} className="mt-1 w-full bg-transparent text-[10px] outline-none" /></label>
        <label className="rounded border px-2 py-1.5" style={{ borderColor: "var(--darkroom-border-subtle)" }}><span className="block text-[7px] uppercase tracking-[0.14em]">Named operator</span><input value={registrarDisplayName} onChange={(event) => onRegistrarDisplayNameChange(event.target.value)} className="mt-1 w-full bg-transparent text-[10px] outline-none" /></label>
        <label className="rounded border px-2 py-1.5 md:col-span-2" style={{ borderColor: "var(--darkroom-border-subtle)" }}><span className="block text-[7px] uppercase tracking-[0.14em]">Intake note</span><input value={intakeNote} onChange={(event) => setIntakeNote(event.target.value)} className="mt-1 w-full bg-transparent text-[10px] outline-none" placeholder="Why this source is entering review" /></label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="cursor-pointer rounded border px-3 py-2 text-[8px] uppercase tracking-[0.14em]" style={{ borderColor: "rgba(97,214,200,0.45)", color: "#61d6c8" }}>Choose transparent PNG<input type="file" accept="image/png" className="hidden" onChange={(event) => { const next = event.target.files?.[0]; if (next) void chooseFile(next); event.target.value = ""; }} /></label>
        {file && <span className="max-w-xs truncate font-mono text-[8px]" style={{ color: "var(--darkroom-text-dim)" }}>{file.name}</span>}
        {file && !previewMatchesSettings && <button type="button" disabled={normalizing} onClick={() => void chooseFile(file)} className="flex items-center gap-1 rounded border px-2 py-1 text-[8px] uppercase tracking-[0.12em] disabled:opacity-35" style={{ borderColor: "rgba(242,192,120,0.45)", color: "#f2c078" }}><RefreshCw className="h-3 w-3" />Rebuild preview with dimensions</button>}
        {normalized && <span className="text-[8px]" style={{ color: normalized.removedDetachedIslands ? "#f2c078" : "#6ee7a8" }}>{normalized.alphaBounds.right - normalized.alphaBounds.left + 1}px wide · {normalized.removedDetachedIslands} detached islands removed</span>}
      </div>
      {normalized && <div className="flex items-end gap-3"><div className="h-28 w-28 overflow-hidden rounded bg-[#F5F3EF]"><img src={normalized.previewUrl} alt="Normalized component preview" className="h-full w-full object-contain" /></div><div className="font-mono text-[8px] leading-4" style={{ color: "var(--darkroom-text-dim)" }}>component {componentKey}<br />mask status: proposed, not geometry locked</div></div>}
      <button type="button" disabled={!normalized || !previewMatchesSettings || normalizing || submitting || !registrarDisplayName.trim() || !intakeNote.trim()} onClick={() => void register()} className="rounded border px-4 py-2 text-[8px] uppercase tracking-[0.15em] disabled:cursor-not-allowed disabled:opacity-35" style={{ borderColor: "rgba(110,231,168,0.5)", color: "#6ee7a8" }}>{normalizing ? "Normalizing…" : submitting ? "Registering immutable source…" : "Register Proposed Source"}</button>
      {error && <div className="text-[9px]" style={{ color: "#fca5a5" }}>{error}</div>}
      {message && <div className="text-[9px]" style={{ color: "#6ee7a8" }}>{message}</div>}
    </div>
  );
}
