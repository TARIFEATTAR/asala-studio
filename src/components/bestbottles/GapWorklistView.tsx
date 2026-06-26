import { useMemo } from "react";
import { Download, ExternalLink, FileText, PackageOpen, AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  GAP_WORKLIST_LANES,
  GAP_WORKLIST_LANE_ORDER,
  countUnrecognizedLanes,
  gapWorklistToCsv,
  summarizeGapWorklistLanes,
  type GapWorklistJoinedRow,
  type GapWorklistLaneId,
  type GapWorklistManifestEntry,
} from "@/lib/bestBottlesGapWorklist";

export type GapWorklistLaneFilter = GapWorklistLaneId | "all";

interface GapWorklistViewProps {
  family: string;
  entry: GapWorklistManifestEntry | null;
  rows: GapWorklistJoinedRow[];
  loading: boolean;
  laneFilter: GapWorklistLaneFilter;
  onLaneFilter: (lane: GapWorklistLaneFilter) => void;
  onOpenStudio: (slug: string) => void;
}

function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(href);
}

function LaneBadge({ laneId, raw }: { laneId: GapWorklistLaneId | null; raw: string }) {
  if (!laneId) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded border border-white/15 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-white/55"
        title="Lane token not recognized — shown verbatim from the CSV."
      >
        {raw || "—"}
      </span>
    );
  }
  const meta = GAP_WORKLIST_LANES[laneId];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[10px]",
        meta.className,
      )}
      title={`${meta.title} — ${meta.description} (${meta.owner})`}
    >
      <span className="font-semibold">{meta.id}</span>
      {meta.label}
    </span>
  );
}

export default function GapWorklistView({
  family,
  entry,
  rows,
  loading,
  laneFilter,
  onLaneFilter,
  onOpenStudio,
}: GapWorklistViewProps) {
  const laneCounts = useMemo(() => summarizeGapWorklistLanes(rows), [rows]);
  const unrecognized = useMemo(() => countUnrecognizedLanes(rows), [rows]);
  const notInIntake = useMemo(() => rows.filter((row) => !row.inIntake).length, [rows]);

  const filteredRows = useMemo(
    () => (laneFilter === "all" ? rows : rows.filter((row) => row.laneId === laneFilter)),
    [rows, laneFilter],
  );

  const handleExport = () => {
    if (filteredRows.length === 0) return;
    const datePart = entry?.date ?? "latest";
    const slug = entry?.familySlug ?? family.toLowerCase();
    const lanePart = laneFilter === "all" ? "all-lanes" : `lane-${laneFilter}`;
    downloadCsv(`${slug}-gap-worklist-${datePart}-${lanePart}.csv`, gapWorklistToCsv(filteredRows));
  };

  if (family === "all") {
    return (
      <EmptyPanel
        icon={<PackageOpen className="h-5 w-5" />}
        title="Pick a family to see its gap worklist"
        body="The gap worklist is per family. Use the family filter above (e.g. Cylinder) to load that family's CSV."
      />
    );
  }

  if (!entry) {
    return (
      <EmptyPanel
        icon={<PackageOpen className="h-5 w-5" />}
        title={`No gap worklist published for ${family} yet`}
        body={
          <>
            Cowork drops <code className="rounded bg-white/[0.06] px-1 py-0.5 text-[11px]">{family.toLowerCase()}-gap-worklist-&lt;date&gt;.csv</code>{" "}
            into <code className="rounded bg-white/[0.06] px-1 py-0.5 text-[11px]">public/data/audits/</code>, then re-index with{" "}
            <code className="rounded bg-white/[0.06] px-1 py-0.5 text-[11px]">npm run bestbottles:gap-worklist:index</code>.
          </>
        }
      />
    );
  }

  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02]">
      {/* Header: source + summary + export */}
      <div className="flex flex-col gap-3 border-b border-white/[0.06] p-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-white/90">{family} gap worklist</h2>
            <span className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-white/55">
              {entry.date}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-white/45">
            Variants still missing a clean, background-removed reference, segmented into lanes by Cowork.
            Madison displays the lanes as declared — it does not re-derive them.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-[10px] text-white/45">
            <span>{rows.length} rows</span>
            <span className="text-white/20">·</span>
            <span className="truncate">source: {entry.file}</span>
            {entry.readme && (
              <a
                href={entry.readme}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-sky-300 hover:text-sky-200"
              >
                <FileText className="h-3 w-3" />
                legend
              </a>
            )}
          </div>
          {(unrecognized > 0 || notInIntake > 0) && (
            <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
              {notInIntake > 0 && (
                <span className="inline-flex items-center gap-1 rounded border border-rose-500/25 bg-rose-500/[0.06] px-1.5 py-0.5 text-rose-200">
                  <AlertTriangle className="h-3 w-3" />
                  {notInIntake} not in intake
                </span>
              )}
              {unrecognized > 0 && (
                <span className="inline-flex items-center gap-1 rounded border border-amber-500/25 bg-amber-500/[0.06] px-1.5 py-0.5 text-amber-200">
                  <AlertTriangle className="h-3 w-3" />
                  {unrecognized} unrecognized lane
                </span>
              )}
            </div>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={filteredRows.length === 0}
          className="h-8 shrink-0 border-emerald-500/25 bg-emerald-500/[0.06] px-3 text-xs text-emerald-100 hover:bg-emerald-500/[0.12]"
        >
          <Download className="mr-1.5 h-3.5 w-3.5" />
          Export CSV{laneFilter === "all" ? "" : ` (lane ${laneFilter})`}
        </Button>
      </div>

      {/* Lane filter chips */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-white/[0.06] p-3">
        <LaneChip
          label={`All (${rows.length})`}
          active={laneFilter === "all"}
          onClick={() => onLaneFilter("all")}
        />
        {GAP_WORKLIST_LANE_ORDER.map((laneId) => {
          const meta = GAP_WORKLIST_LANES[laneId];
          const count = laneCounts.find((c) => c.laneId === laneId)?.count ?? 0;
          return (
            <LaneChip
              key={laneId}
              label={`${laneId} ${meta.label} (${count})`}
              active={laneFilter === laneId}
              disabled={count === 0}
              className={meta.className}
              onClick={() => onLaneFilter(laneId)}
            />
          );
        })}
      </div>

      {/* Table */}
      {loading ? (
        <div className="p-8 text-center text-sm text-white/55">Loading gap worklist…</div>
      ) : filteredRows.length === 0 ? (
        <div className="p-8 text-center text-sm text-white/55">
          {rows.length === 0
            ? "This worklist has no open gaps — every variant has a clean reference. 🎉"
            : `No rows in lane ${laneFilter}.`}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b border-white/[0.06] text-left text-[10px] uppercase tracking-wider text-white/40">
              <tr>
                <th className="px-3 py-2 font-medium">SKU</th>
                <th className="px-3 py-2 font-medium">Product</th>
                <th className="px-3 py-2 font-medium">Size</th>
                <th className="px-3 py-2 font-medium">Color</th>
                <th className="px-3 py-2 font-medium">Applicator</th>
                <th className="px-3 py-2 font-medium">Lane</th>
                <th className="px-3 py-2 font-medium">Action</th>
                <th className="px-3 py-2 font-medium">Resolution needed</th>
                <th className="px-3 py-2 font-medium">Owner</th>
                <th className="px-3 py-2 font-medium">Links</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, index) => (
                <tr
                  key={`${row.graceSku || "row"}-${index}`}
                  className="border-b border-white/[0.035] align-top last:border-b-0 hover:bg-white/[0.03]"
                >
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5 font-mono text-white/85">
                      {row.graceSku || "—"}
                      {!row.inIntake && row.graceSku && (
                        <span
                          className="rounded border border-rose-500/30 bg-rose-500/[0.08] px-1 text-[9px] text-rose-200"
                          title="This graceSku did not match a live intake row."
                        >
                          not in intake
                        </span>
                      )}
                    </div>
                    {row.websiteSku && (
                      <div className="mt-0.5 font-mono text-[10px] text-white/35">{row.websiteSku}</div>
                    )}
                  </td>
                  <td className="min-w-[160px] px-3 py-2 text-white/80">{row.productName || "—"}</td>
                  <td className="px-3 py-2 font-mono text-white/55">{row.capacityMl || "—"}</td>
                  <td className="px-3 py-2 text-white/70">{row.color || "—"}</td>
                  <td className="px-3 py-2 text-white/70">{row.applicator || "—"}</td>
                  <td className="px-3 py-2">
                    <LaneBadge laneId={row.laneId} raw={row.lane} />
                  </td>
                  <td className="min-w-[120px] px-3 py-2 text-white/70">{row.action || "—"}</td>
                  <td className="min-w-[220px] px-3 py-2 text-white/60">{row.resolutionNeeded || "—"}</td>
                  <td className="min-w-[120px] px-3 py-2 text-white/70">{row.suggestedOwner || "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <div className="flex flex-col gap-1">
                      {row.legacyUrl && (
                        <a
                          href={row.legacyUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-sky-300 hover:text-sky-200"
                          title={row.legacyDescription || row.legacyUrl}
                        >
                          <ExternalLink className="h-3 w-3" />
                          legacy
                        </a>
                      )}
                      {row.productGroupSlug && (
                        <button
                          type="button"
                          onClick={() => onOpenStudio(row.productGroupSlug as string)}
                          className="inline-flex items-center gap-1 text-left text-emerald-300 hover:text-emerald-200"
                        >
                          <PackageOpen className="h-3 w-3" />
                          studio
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function LaneChip({
  label,
  active,
  disabled,
  className,
  onClick,
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  className?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded border px-2 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors",
        active
          ? cn("border-white/30 bg-white/[0.12] text-white", className)
          : "border-white/10 bg-white/[0.03] text-white/55 hover:bg-white/[0.08]",
        disabled && "cursor-not-allowed opacity-40 hover:bg-white/[0.03]",
      )}
    >
      {label}
    </button>
  );
}

function EmptyPanel({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-10 text-center">
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.05] text-white/50">
        {icon}
      </div>
      <div className="text-sm font-semibold text-white/85">{title}</div>
      <div className="mx-auto mt-2 max-w-md text-xs text-white/50">{body}</div>
    </div>
  );
}
