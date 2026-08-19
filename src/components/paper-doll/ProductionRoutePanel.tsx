import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  Database,
  FileCheck2,
  GitBranch,
  HardDrive,
  Images,
  LockKeyhole,
  PanelRightOpen,
  Route,
  ShieldAlert,
  Table2,
} from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  buildProductionRouteMatrixRow,
  type LivePaperDollReleaseSnapshot,
  type ProductionRouteArtifact,
  type ProductionRouteStage,
  type ProductionRouteStageId,
  type ProductionRouteStageStatus,
} from "@/lib/paperDoll/productionRoute";

interface ProductionRoutePanelProps {
  route: ProductionRouteArtifact;
  liveRelease: LivePaperDollReleaseSnapshot | null;
}

const STATUS_STYLE: Record<ProductionRouteStageStatus, { color: string; background: string; border: string }> = {
  verified: { color: "#7dd3fc", background: "rgba(56,189,248,0.09)", border: "rgba(56,189,248,0.28)" },
  approved: { color: "#6ee7a8", background: "rgba(74,222,128,0.09)", border: "rgba(74,222,128,0.28)" },
  "in-progress": { color: "#f2c078", background: "rgba(242,192,120,0.09)", border: "rgba(242,192,120,0.28)" },
  candidate: { color: "#c4b5fd", background: "rgba(167,139,250,0.09)", border: "rgba(167,139,250,0.28)" },
  blocked: { color: "#fda4af", background: "rgba(251,113,133,0.09)", border: "rgba(251,113,133,0.28)" },
  failed: { color: "#fb7185", background: "rgba(244,63,94,0.13)", border: "rgba(244,63,94,0.36)" },
  "not-started": { color: "#94a3b8", background: "rgba(148,163,184,0.07)", border: "rgba(148,163,184,0.20)" },
  "not-applicable": { color: "#94a3b8", background: "rgba(148,163,184,0.04)", border: "rgba(148,163,184,0.16)" },
  superseded: { color: "#94a3b8", background: "rgba(148,163,184,0.04)", border: "rgba(148,163,184,0.16)" },
};

function statusLabel(status: ProductionRouteStageStatus): string {
  return status.replace(/-/g, " ");
}

function shortHash(hash: string): string {
  return `${hash.slice(0, 12)}…${hash.slice(-8)}`;
}

function formatBytes(bytes: number): string {
  return new Intl.NumberFormat("en-US", { style: "unit", unit: "gigabyte", maximumFractionDigits: 2 }).format(
    bytes / 1_000_000_000,
  );
}

function StatusBadge({ status, label }: { status: ProductionRouteStageStatus; label?: string }) {
  const style = STATUS_STYLE[status];
  return (
    <span
      className="inline-flex rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em]"
      style={{ color: style.color, background: style.background, borderColor: style.border }}
    >
      {label ?? statusLabel(status)}
    </span>
  );
}

function StageIcon({ stage }: { stage: ProductionRouteStage }) {
  if (stage.status === "approved" || stage.status === "verified") return <CheckCircle2 className="h-4 w-4" />;
  if (stage.status === "blocked" || stage.status === "failed") return <ShieldAlert className="h-4 w-4" />;
  if (stage.status === "not-started") return <CircleDashed className="h-4 w-4" />;
  return <FileCheck2 className="h-4 w-4" />;
}

function EvidenceClassification({ classification }: { classification: ProductionRouteArtifact["evidence"][number]["classification"] }) {
  const label = classification === "approval-evidence"
    ? "Approval evidence"
    : classification === "candidate-evidence"
      ? "Candidate evidence"
      : "Visual reference";
  const status: ProductionRouteStageStatus = classification === "approval-evidence"
    ? "approved"
    : classification === "candidate-evidence"
      ? "candidate"
      : "verified";
  return <StatusBadge status={status} label={label} />;
}

export function ProductionRoutePanel({ route, liveRelease }: ProductionRoutePanelProps) {
  const [view, setView] = useState<"route" | "matrix">("route");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedStageId, setSelectedStageId] = useState<ProductionRouteStageId>("source");
  const matrixRow = useMemo(() => buildProductionRouteMatrixRow(route, liveRelease), [liveRelease, route]);
  const selectedStage = route.stages.find((stage) => stage.id === selectedStageId) ?? route.stages[0];
  const verifiedCount = route.stages.filter((stage) => stage.status === "verified" || stage.status === "approved").length;
  const blockedCount = route.stages.filter((stage) => stage.status === "blocked" || stage.status === "failed").length;

  const openEvidence = (stageId: ProductionRouteStageId = "source") => {
    setSelectedStageId(stageId);
    setDrawerOpen(true);
  };

  return (
    <section
      className="mb-4 min-w-0 w-full max-w-full overflow-hidden rounded border"
      style={{ borderColor: "var(--darkroom-border-subtle)", background: "rgba(7,9,12,0.72)" }}
      aria-label={`Production Route for ${route.identity.commercialName}`}
    >
      <div
        className="flex flex-col gap-3 border-b px-4 py-3 lg:flex-row lg:items-center lg:justify-between"
        style={{ borderColor: "var(--darkroom-border-subtle)" }}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Route className="h-4 w-4" style={{ color: "var(--darkroom-accent)" }} />
            <h2 className="font-serif text-base" style={{ color: "var(--darkroom-text)" }}>Production Route</h2>
            <span className="font-mono text-[10px]" style={{ color: "var(--darkroom-text-dim)" }}>{route.familyKey} · {route.identity.finish}</span>
            <StatusBadge status={route.overallStatus === "ready" ? "approved" : route.overallStatus} />
          </div>
          <p className="mt-1 text-[11px] leading-5" style={{ color: "var(--darkroom-text-muted)" }}>
            All {route.stages.length} stages are represented. Provenance is complete; product release remains blocked until named gates pass.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px]" style={{ color: "var(--darkroom-text-dim)" }}>
            {verifiedCount} verified/approved · {blockedCount} blocked
          </span>
          <div className="inline-flex rounded border p-0.5" style={{ borderColor: "var(--darkroom-border-subtle)" }}>
            <button
              type="button"
              onClick={() => setView("route")}
              className="inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[10px] uppercase tracking-[0.1em]"
              style={{ color: view === "route" ? "var(--darkroom-accent)" : "var(--darkroom-text-muted)", background: view === "route" ? "rgba(184,149,106,0.12)" : "transparent" }}
              aria-pressed={view === "route"}
            >
              <Route className="h-3 w-3" /> Route
            </button>
            <button
              type="button"
              onClick={() => setView("matrix")}
              className="inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[10px] uppercase tracking-[0.1em]"
              style={{ color: view === "matrix" ? "var(--darkroom-accent)" : "var(--darkroom-text-muted)", background: view === "matrix" ? "rgba(184,149,106,0.12)" : "transparent" }}
              aria-pressed={view === "matrix"}
            >
              <Table2 className="h-3 w-3" /> Matrix
            </button>
          </div>
          <button
            type="button"
            onClick={() => openEvidence("source")}
            className="inline-flex items-center gap-2 rounded border px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] transition-colors hover:bg-white/[0.04]"
            style={{ borderColor: "rgba(184,149,106,0.36)", color: "var(--darkroom-accent)" }}
          >
            <PanelRightOpen className="h-3.5 w-3.5" /> Source &amp; Build
          </button>
        </div>
      </div>

      {view === "route" ? (
        <div className="min-w-0 w-full max-w-full overflow-x-auto p-3">
          <ol className="grid min-w-[1080px] grid-cols-9 gap-2" aria-label="Nine-stage production route">
            {route.stages.map((stage, index) => {
              const style = STATUS_STYLE[stage.status];
              return (
                <li key={stage.id} className="min-w-0">
                  <button
                    type="button"
                    onClick={() => openEvidence(stage.id)}
                    className="group h-full w-full rounded border p-2.5 text-left transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2"
                    style={{ borderColor: style.border, background: style.background, color: style.color }}
                    aria-label={`Open evidence for ${stage.label}: ${statusLabel(stage.status)}`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[9px] opacity-70">{String(index + 1).padStart(2, "0")}</span>
                      <StageIcon stage={stage} />
                    </span>
                    <span className="mt-4 block text-[10px] font-semibold uppercase tracking-[0.08em]">{stage.label}</span>
                    <span className="mt-1 block text-[9px] uppercase tracking-[0.12em] opacity-80">{statusLabel(stage.status)}</span>
                  </button>
                </li>
              );
            })}
          </ol>
          <div className="mt-3 grid gap-2 lg:grid-cols-[1fr_auto] lg:items-center">
            <p className="text-[10px] leading-5" style={{ color: "var(--darkroom-text-muted)" }}>
              <span className="font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--darkroom-accent)" }}>Next action</span>
              <span className="mx-2" aria-hidden="true">—</span>{route.nextAction}
            </p>
            {liveRelease ? (
              <p className="font-mono text-[9px]" style={{ color: "var(--darkroom-text-dim)" }}>
                PRIVATE LEDGER · v{liveRelease.version} · {liveRelease.status} · {liveRelease.assetCount} assets
              </p>
            ) : (
              <p className="font-mono text-[9px]" style={{ color: "#f2c078" }}>PRIVATE LEDGER · unavailable</p>
            )}
          </div>
        </div>
      ) : (
        <div className="min-w-0 w-full max-w-full overflow-x-auto p-3">
          <div className="mb-2 flex items-center gap-2">
            <Table2 className="h-3.5 w-3.5" style={{ color: "var(--darkroom-accent)" }} />
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--darkroom-text)" }}>
              Consolidated Production Matrix
            </h3>
            <span className="text-[9px]" style={{ color: "var(--darkroom-text-dim)" }}>repository route + current private ledger</span>
          </div>
          <table className="min-w-[1460px] w-full border-separate border-spacing-0 text-left">
            <thead>
              <tr>
                <th className="border-b px-2 py-2 text-[9px] uppercase tracking-[0.1em]" style={{ borderColor: "var(--darkroom-border-subtle)", color: "var(--darkroom-text-dim)" }}>Production unit</th>
                {route.stages.map((stage) => (
                  <th key={stage.id} className="border-b px-2 py-2 text-[9px] uppercase tracking-[0.1em]" style={{ borderColor: "var(--darkroom-border-subtle)", color: "var(--darkroom-text-dim)" }}>{stage.label}</th>
                ))}
                <th className="border-b px-2 py-2 text-[9px] uppercase tracking-[0.1em]" style={{ borderColor: "var(--darkroom-border-subtle)", color: "var(--darkroom-text-dim)" }}>Live release</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border-b px-2 py-3 align-top" style={{ borderColor: "var(--darkroom-border-subtle)" }}>
                  <div className="font-mono text-[10px]" style={{ color: "var(--darkroom-text)" }}>{matrixRow.routeId}</div>
                  <div className="mt-1 text-[9px]" style={{ color: "var(--darkroom-text-muted)" }}>{matrixRow.identity.graceSku}</div>
                </td>
                {matrixRow.stages.map((stage) => (
                  <td key={stage.id} className="border-b px-2 py-3 align-top" style={{ borderColor: "var(--darkroom-border-subtle)" }}>
                    <button type="button" onClick={() => openEvidence(stage.id)} className="text-left" aria-label={`Open evidence for ${stage.label}: ${statusLabel(stage.status)}`}>
                      <StatusBadge status={stage.status} />
                      <span className="mt-1.5 block max-w-[130px] text-[9px] leading-4" style={{ color: "var(--darkroom-text-muted)" }}>{stage.summary}</span>
                    </button>
                  </td>
                ))}
                <td className="border-b px-2 py-3 align-top" style={{ borderColor: "var(--darkroom-border-subtle)" }}>
                  {matrixRow.liveRelease ? (
                    <>
                      <div className="font-mono text-[10px]" style={{ color: "#7dd3fc" }}>v{matrixRow.liveRelease.version}</div>
                      <div className="mt-1 text-[9px] uppercase" style={{ color: "var(--darkroom-text-muted)" }}>{matrixRow.liveRelease.status}</div>
                      <div className="mt-1 text-[9px]" style={{ color: "var(--darkroom-text-dim)" }}>{matrixRow.liveRelease.bodyCount} bodies · {matrixRow.liveRelease.componentCount} components</div>
                    </>
                  ) : <span className="text-[9px]" style={{ color: "#f2c078" }}>Unavailable</span>}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent
          side="right"
          className="w-full overflow-y-auto border-l p-0 sm:max-w-2xl"
          style={{ background: "#0c0f13", borderColor: "var(--darkroom-border-subtle)", color: "var(--darkroom-text)" }}
        >
          <SheetHeader className="border-b px-5 py-4 text-left" style={{ borderColor: "var(--darkroom-border-subtle)" }}>
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4" style={{ color: "var(--darkroom-accent)" }} />
              <SheetTitle className="font-serif text-lg" style={{ color: "var(--darkroom-text)" }}>Source &amp; Build · {route.familyKey}</SheetTitle>
            </div>
            <SheetDescription style={{ color: "var(--darkroom-text-muted)" }}>
              Read-only repository provenance and scoped evidence for Madison’s first complete production-route row.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-5 px-5 py-5">
            <section className="rounded border p-3" style={{ borderColor: STATUS_STYLE[selectedStage.status].border, background: STATUS_STYLE[selectedStage.status].background }}>
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--darkroom-text)" }}>{selectedStage.label}</h3>
                <StatusBadge status={selectedStage.status} />
              </div>
              <p className="mt-2 text-xs leading-5" style={{ color: "var(--darkroom-text-muted)" }}>{selectedStage.summary}</p>
              <p className="mt-2 text-[9px] uppercase tracking-[0.1em]" style={{ color: "var(--darkroom-text-dim)" }}>Gate scope · {selectedStage.gateScope}</p>
            </section>

            <section>
              <div className="mb-2 flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5" style={{ color: "#fda4af" }} />
                <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--darkroom-text)" }}>Identity discrepancy</h3>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded border p-3" style={{ borderColor: "var(--darkroom-border-subtle)" }}>
                  <div className="text-[9px] uppercase tracking-[0.1em]" style={{ color: "var(--darkroom-text-dim)" }}>Commercial/catalog</div>
                  <div className="mt-1 text-sm" style={{ color: "var(--darkroom-text)" }}>{route.identity.catalog.volumeMl} mL · {route.identity.catalog.heightMm} × {route.identity.catalog.diameterMm} mm</div>
                  <div className="mt-1 font-mono text-[9px]" style={{ color: "var(--darkroom-text-muted)" }}>{route.identity.graceSku}</div>
                </div>
                <div className="rounded border p-3" style={{ borderColor: "rgba(251,113,133,0.28)" }}>
                  <div className="text-[9px] uppercase tracking-[0.1em]" style={{ color: "#fda4af" }}>Governing drawing</div>
                  <div className="mt-1 text-sm" style={{ color: "var(--darkroom-text)" }}>{route.identity.drawing.volumeMl} mL · {route.identity.drawing.heightMm} × {route.identity.drawing.diameterMm} mm</div>
                  <div className="mt-1 text-[9px]" style={{ color: "var(--darkroom-text-muted)" }}>Unresolved—not normalized</div>
                </div>
              </div>
              <p className="mt-2 text-[10px] leading-5" style={{ color: "var(--darkroom-text-muted)" }}>{route.identity.discrepancy}</p>
            </section>

            <section>
              <div className="mb-2 flex items-center gap-2">
                <HardDrive className="h-3.5 w-3.5" style={{ color: "#7dd3fc" }} />
                <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--darkroom-text)" }}>Containment receipt</h3>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  ["Receipt SHA-256", shortHash(route.sourceRecord.sha256)],
                  ["Manifest SHA-256", shortHash(route.artifact.protection.manifestSha256)],
                  ["Protected scope", `${route.artifact.protection.protectedEntriesIncludingBundle} entries · ${formatBytes(route.artifact.protection.totalBytesIncludingBundle)}`],
                  ["Checksums", `${route.artifact.protection.localChecksumsPassed}/${route.artifact.protection.checksumEntries} local · ${route.artifact.protection.mirrorChecksumsPassed}/${route.artifact.protection.checksumEntries} mirror`],
                ].map(([label, value]) => (
                  <div key={label} className="rounded border p-2.5" style={{ borderColor: "var(--darkroom-border-subtle)" }}>
                    <div className="text-[8px] uppercase tracking-[0.1em]" style={{ color: "var(--darkroom-text-dim)" }}>{label}</div>
                    <div className="mt-1 font-mono text-[9px] break-all" style={{ color: "var(--darkroom-text-muted)" }}>{value}</div>
                  </div>
                ))}
              </div>
              <div className="mt-2 space-y-2 rounded border p-3" style={{ borderColor: "var(--darkroom-border-subtle)" }}>
                <div className="flex items-center gap-2 text-[10px]" style={{ color: "var(--darkroom-text-muted)" }}><GitBranch className="h-3 w-3" /> {route.artifact.git.branch} · <code>{route.artifact.git.commit.slice(0, 12)}</code></div>
                <div className="text-[9px] break-all" style={{ color: "var(--darkroom-text-dim)" }}>Source record: {route.sourceRecord.path}</div>
                <div className="text-[9px] break-all" style={{ color: "var(--darkroom-text-dim)" }}>Local capsule: {route.artifact.protection.localCapsule}</div>
                <div className="text-[9px] break-all" style={{ color: "var(--darkroom-text-dim)" }}>Drive mirror: {route.artifact.protection.googleDriveMirror}</div>
                {!route.artifact.protection.providerSideCloudSyncIndependentlyVerified && (
                  <div className="flex items-start gap-2 text-[9px] leading-4" style={{ color: "#f2c078" }}><AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> Provider-side Drive sync was not independently verified; filesystem mirror checksum and read-only state were verified.</div>
                )}
              </div>
            </section>

            <section>
              <div className="mb-2 flex items-center gap-2">
                <Images className="h-3.5 w-3.5" style={{ color: "var(--darkroom-accent)" }} />
                <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--darkroom-text)" }}>Visual evidence · review proxies</h3>
              </div>
              <p className="mb-3 text-[9px] leading-4" style={{ color: "var(--darkroom-text-dim)" }}>
                Optimized Madison-local display derivatives only. The registered source paths, source hashes, and containment receipt remain evidence authority.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {route.evidence.map((evidence) => (
                  <article key={evidence.id} className="overflow-hidden rounded border" style={{ borderColor: "var(--darkroom-border-subtle)", background: "rgba(255,255,255,0.02)" }}>
                    <img src={evidence.previewUrl} alt={evidence.title} loading="lazy" className="aspect-[10/11] w-full object-contain" style={{ background: "#f6f5f1" }} />
                    <div className="space-y-2 p-3">
                      <EvidenceClassification classification={evidence.classification} />
                      <h4 className="text-xs font-medium" style={{ color: "var(--darkroom-text)" }}>{evidence.title}</h4>
                      <p className="text-[9px] leading-4" style={{ color: "var(--darkroom-text-muted)" }}>{evidence.scope}</p>
                      <div className="font-mono text-[8px] break-all" style={{ color: "var(--darkroom-text-dim)" }}>source {shortHash(evidence.sourceSha256)}</div>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="grid gap-3 sm:grid-cols-2">
              <div className="rounded border p-3" style={{ borderColor: "var(--darkroom-border-subtle)" }}>
                <div className="mb-2 flex items-center gap-2"><LockKeyhole className="h-3.5 w-3.5" style={{ color: "#6ee7a8" }} /><h3 className="text-[10px] font-semibold uppercase tracking-[0.1em]">Verified scope</h3></div>
                <p className="text-[10px] leading-5" style={{ color: "var(--darkroom-text-muted)" }}>{route.artifact.approvalScope.hashVerified}</p>
                <div className="mt-3 space-y-1 font-mono text-[9px]" style={{ color: "var(--darkroom-text-dim)" }}>
                  <div>{route.artifact.verification.pythonContractTests}</div>
                  <div>17-415 helix · {route.artifact.verification.blender17415Helix}</div>
                  <div>Five-variant baseline · {route.artifact.verification.blenderFiveVariantBaseline}</div>
                  <div>Git bundle · {route.artifact.verification.gitBundle}</div>
                </div>
              </div>
              <div className="rounded border p-3" style={{ borderColor: "rgba(251,113,133,0.24)" }}>
                <div className="mb-2 flex items-center gap-2"><ShieldAlert className="h-3.5 w-3.5" style={{ color: "#fda4af" }} /><h3 className="text-[10px] font-semibold uppercase tracking-[0.1em]">Not implied</h3></div>
                <ul className="space-y-1 text-[9px] leading-4" style={{ color: "var(--darkroom-text-muted)" }}>
                  {route.artifact.approvalScope.notImplied.map((scope) => <li key={scope}>• {scope}</li>)}
                </ul>
              </div>
            </section>

            <section className="rounded border p-3" style={{ borderColor: "rgba(242,192,120,0.28)", background: "rgba(242,192,120,0.05)" }}>
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.1em]" style={{ color: "#f2c078" }}>Open blockers</h3>
              <ul className="mt-2 space-y-1 text-[10px] leading-5" style={{ color: "var(--darkroom-text-muted)" }}>
                {route.blockers.map((blocker) => <li key={blocker}>• {blocker}</li>)}
              </ul>
              <p className="mt-3 border-t pt-3 text-[10px] leading-5" style={{ borderColor: "rgba(242,192,120,0.16)", color: "var(--darkroom-text)" }}><strong>Next:</strong> {route.nextAction}</p>
            </section>
          </div>
        </SheetContent>
      </Sheet>
    </section>
  );
}
