import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Boxes, Database, LockKeyhole, ShieldCheck } from "lucide-react";

import { LEDIndicator, LCDDisplay } from "@/components/darkroom/LEDIndicator";
import { supabase } from "@/integrations/supabase/client";
import {
  loadPaperDollReleaseWorkbench,
  type PaperDollReleaseRpcClient,
} from "@/lib/paperDoll/releaseRepository";
import { summarizePaperDollWorkbench } from "@/lib/paperDoll/workbenchSummary";

interface StorageBackedReleasePanelProps {
  organizationId: string | null;
  familyKey: string | null;
}

function Stat({ label, value, tone = "neutral" }: {
  label: string;
  value: string | number;
  tone?: "neutral" | "good" | "warning";
}) {
  const color = tone === "good"
    ? "#6ee7a8"
    : tone === "warning"
      ? "#f2c078"
      : "var(--darkroom-text-primary)";
  return (
    <div className="rounded border px-3 py-2" style={{ borderColor: "var(--darkroom-border-subtle)", background: "rgba(255,255,255,0.018)" }}>
      <div className="text-[9px] uppercase tracking-[0.18em]" style={{ color: "var(--darkroom-text-dim)" }}>{label}</div>
      <div className="mt-1 font-mono text-lg" style={{ color }}>{value}</div>
    </div>
  );
}

export function StorageBackedReleasePanel({ organizationId, familyKey }: StorageBackedReleasePanelProps) {
  const query = useQuery({
    queryKey: ["paper-doll-release-workbench", organizationId, familyKey],
    queryFn: () => loadPaperDollReleaseWorkbench(
      supabase as unknown as PaperDollReleaseRpcClient,
      organizationId!,
      familyKey!,
    ),
    enabled: Boolean(organizationId && familyKey),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const summary = useMemo(
    () => query.data ? summarizePaperDollWorkbench(query.data) : null,
    [query.data],
  );

  if (!organizationId || !familyKey) {
    return (
      <div className="rounded border border-dashed p-6 text-sm" style={{ borderColor: "var(--darkroom-border-subtle)", color: "var(--darkroom-text-muted)" }}>
        Connect this product group to a paper-doll family key before loading its release ledger.
      </div>
    );
  }

  if (query.isLoading) {
    return (
      <div className="flex min-h-64 items-center justify-center gap-3 text-sm" style={{ color: "var(--darkroom-text-muted)" }}>
        <LEDIndicator state="processing" />
        Resolving the private {familyKey} release…
      </div>
    );
  }

  if (query.error) {
    return (
      <div className="rounded border p-4 text-sm" style={{ borderColor: "var(--darkroom-error)", background: "rgba(239,68,68,0.05)", color: "var(--darkroom-error)" }}>
        <div className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" />Release ledger unavailable</div>
        <div className="mt-2 text-xs opacity-80">{query.error instanceof Error ? query.error.message : String(query.error)}</div>
      </div>
    );
  }

  if (!query.data || !summary) {
    return (
      <div className="rounded border border-dashed p-6" style={{ borderColor: "var(--darkroom-border-subtle)", color: "var(--darkroom-text-muted)" }}>
        <div className="flex items-center gap-2 text-sm font-medium"><Database className="h-4 w-4" />Storage connection ready</div>
        <p className="mt-2 text-xs leading-5">
          No {familyKey} release exists yet. Upload the locked masters to private Storage, register their checksums, and this panel will populate without another frontend deploy.
        </p>
      </div>
    );
  }

  const { release, assets } = query.data;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded border p-4" style={{ borderColor: "var(--darkroom-border-subtle)", background: "linear-gradient(135deg, rgba(184,149,106,0.09), rgba(255,255,255,0.015))" }}>
        <div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em]" style={{ color: "var(--darkroom-accent)" }}>
            <Boxes className="h-3.5 w-3.5" />Paper-Doll release console
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="font-serif text-xl">{release.familyKey}</span>
            <LCDDisplay>{release.version}</LCDDisplay>
            <span className="rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-wider" style={{ borderColor: "var(--darkroom-border-subtle)", color: release.status === "ready" ? "#6ee7a8" : "#f2c078" }}>
              {release.status}
            </span>
          </div>
          <div className="mt-2 font-mono text-[9px]" style={{ color: "var(--darkroom-text-dim)" }}>
            {release.canvasWidthPx}×{release.canvasHeightPx} · manifest {release.manifestSha256.slice(0, 12)}…
          </div>
        </div>
        <div className="flex items-center gap-2 rounded border px-3 py-2 text-[10px] uppercase tracking-wider" style={{ borderColor: "rgba(242,192,120,0.35)", color: "#f2c078", background: "rgba(242,192,120,0.05)" }}>
          <LockKeyhole className="h-3.5 w-3.5" />Sanity publication locked
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat label="Assets" value={summary.totalAssets} />
        <Stat label="Approved" value={`${summary.approvedAssets}/${summary.totalAssets}`} tone={summary.approvedAssets === summary.totalAssets ? "good" : "neutral"} />
        <Stat label="Blocking gates" value={`${summary.passedBlockingGates} pass`} tone={summary.failedBlockingGates === 0 ? "good" : "warning"} />
        <Stat label="Dry-run" value={summary.dryRunEligible ? "Eligible" : "Locked"} tone={summary.dryRunEligible ? "good" : "warning"} />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-[0.17em]" style={{ color: "var(--darkroom-text-dim)" }}>
          <span>Catalog baseline sequence</span>
          <span>Private signed previews</span>
        </div>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
          {assets.map((asset) => (
            <article key={asset.componentVersionId} className="overflow-hidden rounded border" style={{ borderColor: asset.approvalStatus === "blocked" ? "rgba(242,192,120,0.5)" : "var(--darkroom-border-subtle)", background: "rgba(255,255,255,0.015)" }}>
              <div className="aspect-[10/11] p-2" style={{ background: release.backgroundHex }}>
                <img src={asset.imageUrl} alt={asset.displayName} className="h-full w-full object-contain" />
              </div>
              <div className="space-y-1 border-t p-2" style={{ borderColor: "var(--darkroom-border-subtle)" }}>
                <div className="truncate text-[11px] font-medium" style={{ color: "var(--darkroom-text-primary)" }}>{asset.displayName}</div>
                <div className="truncate font-mono text-[9px]" style={{ color: "var(--darkroom-text-dim)" }}>{asset.slot} · {asset.materialVariant}</div>
                <div className="flex items-center justify-between text-[9px] uppercase tracking-wider">
                  <span style={{ color: asset.approvalStatus === "approved" ? "#6ee7a8" : "#f2c078" }}>{asset.approvalStatus}</span>
                  <span style={{ color: "var(--darkroom-text-dim)" }}>axis {asset.mountAxisXPx}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_240px]">
        <div className="rounded border p-3" style={{ borderColor: "var(--darkroom-border-subtle)" }}>
          <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.17em]" style={{ color: "var(--darkroom-text-dim)" }}>
            <ShieldCheck className="h-3.5 w-3.5" />Release blockers
          </div>
          {summary.blockers.length === 0 ? (
            <div className="text-xs" style={{ color: "#6ee7a8" }}>No recorded blocking QA failures.</div>
          ) : (
            <ul className="space-y-1 text-xs" style={{ color: "#f2c078" }}>
              {summary.blockers.map((blocker) => <li key={blocker}>• {blocker}</li>)}
            </ul>
          )}
        </div>
        <div className="rounded border p-3 text-xs leading-5" style={{ borderColor: "var(--darkroom-border-subtle)", color: "var(--darkroom-text-muted)" }}>
          <div className="font-medium" style={{ color: "var(--darkroom-text-primary)" }}>Production safety</div>
          Read-only release data. Uploads, approval mutation and Sanity writes remain disabled in this slice.
        </div>
      </div>
    </section>
  );
}
