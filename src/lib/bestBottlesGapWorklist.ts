// Gap worklist ingestion for the Best Bottles pipeline workbench.
//
// Cowork produces per-family "gap worklist" CSVs that segment the product
// variants still missing a clean, background-removed reference image into
// lanes (A–G) keyed by *why* a clean reference is missing and *who* resolves
// it. Those lane assignments depend on reference-prep knowledge that only
// lives on the Cowork side (which PSDs are flattened → rembg, which finishes
// have no art, which sizes are mislabels, …) and CANNOT be re-derived from
// Madison's intake. So Madison's job here is strictly to INGEST and DISPLAY —
// it never recomputes the lane.
//
// See docs/BEST-BOTTLES-IMAGE-PIPELINE-BRIEF.md (§5, the two-agent lane split)
// and public/data/audits/<family>-gap-worklist-README.md (the legend).

export type GapWorklistLaneId = "A" | "B" | "C" | "D" | "E" | "F" | "G";

export interface GapWorklistLaneMeta {
  id: GapWorklistLaneId;
  /** Short chip label, e.g. "rembg-cutout". */
  label: string;
  /** Full lane name as written in the README, e.g. "A. rembg-cutout". */
  title: string;
  /** One-line description of what the lane means. */
  description: string;
  /** Who is best placed to resolve the lane (from the README). */
  owner: string;
  /** Tailwind classes for the lane badge/chip. */
  className: string;
}

// Lane vocabulary, transcribed from the Cylinder gap-worklist README. Display
// metadata only — the *assignment* of a row to a lane always comes from the CSV.
export const GAP_WORKLIST_LANES: Record<GapWorklistLaneId, GapWorklistLaneMeta> = {
  A: {
    id: "A",
    label: "rembg-cutout",
    title: "A. rembg-cutout",
    description:
      "Source PSD exists but is flattened; needs the ML background-removal pass. Clears on its own — no team input.",
    owner: "Internal / Mac",
    className: "border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-200",
  },
  B: {
    id: "B",
    label: "frosted — no PSD",
    title: "B. frosted variant — PSD missing",
    description:
      "Frosted variant whose specific PSD isn't in the library. Needs art/photo, or generate from a clear sibling.",
    owner: "Nemat / internal",
    className: "border-violet-500/30 bg-violet-500/[0.08] text-violet-200",
  },
  C: {
    id: "C",
    label: "matte sprayer",
    title: "C. matte sprayer — only shiny art",
    description:
      "Catalog lists a matte-finish sprayer, but only the shiny sprayer PSD exists. Confirm matte is a real sold variant.",
    owner: "Nemat",
    className: "border-amber-500/30 bg-amber-500/[0.08] text-amber-200",
  },
  D: {
    id: "D",
    label: "screw-cap — no PSD",
    title: "D. screw-cap-only — no PSD",
    description:
      "Bottle + plain screw cap, never drawn as a paper-doll. Needs a reference photo, compose body+cap, or generate.",
    owner: "Nemat / internal",
    className: "border-sky-500/30 bg-sky-500/[0.08] text-sky-200",
  },
  E: {
    id: "E",
    label: "25ml lotion",
    title: "E. 25ml lotion — no 25ml art",
    description:
      "No 25ml lotion PSD exists, only 30ml. Confirm 25ml is a real distinct size or a mislabel of 30ml.",
    owner: "Nemat (catalog)",
    className: "border-teal-500/30 bg-teal-500/[0.08] text-teal-200",
  },
  F: {
    id: "F",
    label: "plastic flip-top",
    title: "F. plastic flip-top — wrong family",
    description:
      "Plastic flip-top bottles filed under Cylinder. Confirm correct family or remove from Cylinder scope.",
    owner: "Nemat (catalog)",
    className: "border-rose-500/30 bg-rose-500/[0.08] text-rose-200",
  },
  G: {
    id: "G",
    label: "other — review",
    title: "G. other — needs review",
    description: "No clean source matched; review identity against the legacy site.",
    owner: "Internal",
    className: "border-slate-400/30 bg-slate-400/[0.08] text-slate-200",
  },
};

export const GAP_WORKLIST_LANE_ORDER: GapWorklistLaneId[] = ["A", "B", "C", "D", "E", "F", "G"];

// Keyword fallbacks so a CSV that writes the lane name without the leading
// letter (e.g. "rembg-cutout") still normalizes. Order matters — first match wins.
const LANE_KEYWORDS: Array<{ id: GapWorklistLaneId; test: RegExp }> = [
  { id: "A", test: /rembg|cutout|background[ -]?remov/i },
  { id: "C", test: /matte\s*sprayer|shiny\s*art/i },
  { id: "B", test: /frosted/i },
  { id: "D", test: /screw[ -]?cap/i },
  { id: "E", test: /25\s*ml|lotion/i },
  { id: "F", test: /plastic|flip[ -]?top/i },
  { id: "G", test: /other|needs?\s*review/i },
];

/**
 * Normalize a raw `lane` cell to a canonical A–G id. Accepts the README forms
 * ("A", "A. rembg-cutout", "A. rembg-cutout (9)") and, as a fallback, recognizes
 * the lane by keyword. Returns null when nothing matches — the row still renders,
 * just without lane styling/grouping (surfaced as "unrecognized lane").
 */
export function normalizeGapWorklistLane(raw: string | null | undefined): GapWorklistLaneId | null {
  const value = (raw ?? "").trim();
  if (!value) return null;
  const lead = value.charAt(0).toUpperCase();
  if ((GAP_WORKLIST_LANE_ORDER as string[]).includes(lead)) {
    return lead as GapWorklistLaneId;
  }
  for (const { id, test } of LANE_KEYWORDS) {
    if (test.test(value)) return id;
  }
  return null;
}

export interface GapWorklistRow {
  graceSku: string;
  websiteSku: string;
  productName: string;
  capacityMl: string;
  color: string;
  applicator: string;
  capStyle: string;
  /** Raw lane token exactly as written in the CSV. */
  lane: string;
  /** Normalized lane id (A–G), or null if the token wasn't recognized. */
  laneId: GapWorklistLaneId | null;
  action: string;
  resolutionNeeded: string;
  suggestedOwner: string;
  legacyUrl: string;
  legacyDescription: string;
  /** Any CSV columns we don't model explicitly, preserved for round-trip export. */
  extra: Record<string, string>;
}

// Canonical column order for export. Matches the README/legend column list.
export const GAP_WORKLIST_CSV_COLUMNS = [
  "graceSku",
  "websiteSku",
  "productName",
  "capacityMl",
  "color",
  "applicator",
  "capStyle",
  "lane",
  "action",
  "resolutionNeeded",
  "suggestedOwner",
  "legacyUrl",
  "legacyDescription",
] as const;

// Header aliases (lowercased, non-alphanumeric stripped) → canonical field.
const HEADER_ALIASES: Record<string, keyof GapWorklistRow> = {
  gracesku: "graceSku",
  sku: "graceSku",
  websitesku: "websiteSku",
  legacysku: "websiteSku",
  productname: "productName",
  capacityml: "capacityMl",
  capacity: "capacityMl",
  color: "color",
  glasscolor: "color",
  applicator: "applicator",
  capstyle: "capStyle",
  lane: "lane",
  action: "action",
  resolutionneeded: "resolutionNeeded",
  resolution: "resolutionNeeded",
  suggestedowner: "suggestedOwner",
  owner: "suggestedOwner",
  legacyurl: "legacyUrl",
  url: "legacyUrl",
  legacydescription: "legacyDescription",
  description: "legacyDescription",
};

function normalizeHeaderKey(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Parse CSV text into headers + records. RFC-4180-ish: handles quoted fields
 * containing commas, escaped quotes (""), CRLF/CR/LF line endings, and a BOM.
 * Fully-blank rows are dropped. A header-only file yields zero records.
 */
export function parseCsv(text: string): { headers: string[]; records: Record<string, string>[] } {
  const grid = parseCsvGrid(text);
  if (grid.length === 0) return { headers: [], records: [] };
  const headers = grid[0].map((h) => h.trim());
  const records = grid
    .slice(1)
    .filter((cols) => cols.some((c) => c.trim() !== ""))
    .map((cols) => {
      const record: Record<string, string> = {};
      headers.forEach((header, index) => {
        record[header] = cols[index] ?? "";
      });
      return record;
    });
  return { headers, records };
}

function parseCsvGrid(text: string): string[][] {
  const grid: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  let started = false; // whether the current row has any field content yet
  let i = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  const pushField = () => {
    row.push(field);
    field = "";
    started = true;
  };
  const pushRow = () => {
    grid.push(row);
    row = [];
    started = false;
  };
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      started = true;
      i += 1;
      continue;
    }
    if (ch === ",") {
      pushField();
      i += 1;
      continue;
    }
    if (ch === "\r") {
      i += 1;
      continue;
    }
    if (ch === "\n") {
      pushField();
      pushRow();
      i += 1;
      continue;
    }
    field += ch;
    started = true;
    i += 1;
  }
  if (started || field !== "") {
    pushField();
    pushRow();
  }
  return grid;
}

/** Parse a Cowork gap-worklist CSV into typed rows. */
export function parseGapWorklistCsv(text: string): GapWorklistRow[] {
  const { headers, records } = parseCsv(text);
  // Map each CSV header to a canonical field (or null → goes to `extra`).
  const headerField = new Map<string, keyof GapWorklistRow | null>();
  for (const header of headers) {
    headerField.set(header, HEADER_ALIASES[normalizeHeaderKey(header)] ?? null);
  }
  return records.map((record) => {
    const row: GapWorklistRow = {
      graceSku: "",
      websiteSku: "",
      productName: "",
      capacityMl: "",
      color: "",
      applicator: "",
      capStyle: "",
      lane: "",
      laneId: null,
      action: "",
      resolutionNeeded: "",
      suggestedOwner: "",
      legacyUrl: "",
      legacyDescription: "",
      extra: {},
    };
    for (const header of headers) {
      const field = headerField.get(header);
      const value = (record[header] ?? "").trim();
      if (field && field !== "extra" && field !== "laneId") {
        (row as Record<string, unknown>)[field] = value;
      } else if (!field) {
        row.extra[header] = value;
      }
    }
    row.laneId = normalizeGapWorklistLane(row.lane);
    return row;
  });
}

/** Per-lane counts for filter chips. Includes lanes with zero rows. */
export function summarizeGapWorklistLanes(
  rows: GapWorklistRow[],
): Array<{ laneId: GapWorklistLaneId; count: number }> {
  const counts = new Map<GapWorklistLaneId, number>();
  for (const id of GAP_WORKLIST_LANE_ORDER) counts.set(id, 0);
  for (const row of rows) {
    if (row.laneId) counts.set(row.laneId, (counts.get(row.laneId) ?? 0) + 1);
  }
  return GAP_WORKLIST_LANE_ORDER.map((laneId) => ({ laneId, count: counts.get(laneId) ?? 0 }));
}

/** Count of rows whose lane token wasn't recognized (data-quality signal). */
export function countUnrecognizedLanes(rows: GapWorklistRow[]): number {
  return rows.reduce((total, row) => total + (row.lane && !row.laneId ? 1 : 0), 0);
}

// ─── Manifest (which CSVs exist; built by scripts/build-bestbottles-gap-worklist-index.ts) ──

export interface GapWorklistManifestEntry {
  /** Display family name, e.g. "Cylinder". */
  family: string;
  /** Family slug as it appears in the filename, e.g. "cylinder". */
  familySlug: string;
  /** ISO date parsed from the filename, e.g. "2026-06-21". */
  date: string;
  /** Public URL of the CSV, e.g. "/data/audits/cylinder-gap-worklist-2026-06-21.csv". */
  file: string;
  /** Public URL of the legend README, when present. */
  readme?: string;
  /** Number of data rows, when the indexer counted them. */
  rowCount?: number;
}

export interface GapWorklistManifest {
  generatedAt: string;
  entries: GapWorklistManifestEntry[];
}

/**
 * Reduce a raw manifest (every CSV discovered) to the newest dated file per
 * family. This is what drives "refresh the view when a newer dated CSV appears".
 */
export function selectNewestGapWorklistPerFamily(
  entries: GapWorklistManifestEntry[],
): GapWorklistManifestEntry[] {
  const newest = new Map<string, GapWorklistManifestEntry>();
  for (const entry of entries) {
    const key = entry.familySlug.toLowerCase();
    const current = newest.get(key);
    // ISO dates sort lexicographically; tie-break on filename for determinism.
    if (!current || entry.date > current.date || (entry.date === current.date && entry.file > current.file)) {
      newest.set(key, entry);
    }
  }
  return Array.from(newest.values()).sort((a, b) => a.family.localeCompare(b.family));
}

/** Newest CSV entry for a given family name, or null if none published. */
export function findGapWorklistEntryForFamily(
  manifest: GapWorklistManifest | null | undefined,
  family: string,
): GapWorklistManifestEntry | null {
  if (!manifest || !family || family === "all") return null;
  const target = family.toLowerCase();
  const candidates = selectNewestGapWorklistPerFamily(manifest.entries).filter(
    (entry) => entry.family.toLowerCase() === target || entry.familySlug.toLowerCase() === target,
  );
  return candidates[0] ?? null;
}

// ─── Join to the live reference intake (keyed by graceSku) ──────────────────

/** The subset of a reference-intake row this view needs for the join. */
export interface GapWorklistIntakeLike {
  graceSku: string;
  family?: string | null;
  productGroupSlug?: string | null;
  productGroupDisplayName?: string | null;
  coverageStatus?: string | null;
  productUrl?: string | null;
  liveReferenceUrl?: string | null;
}

export interface GapWorklistJoinedRow extends GapWorklistRow {
  /** True when the graceSku matched a live intake row. */
  inIntake: boolean;
  /** Convex/intake product group slug, for the studio deep-link. */
  productGroupSlug: string | null;
  intake: GapWorklistIntakeLike | null;
}

export function indexIntakeByGraceSku(
  rows: GapWorklistIntakeLike[],
): Map<string, GapWorklistIntakeLike> {
  const map = new Map<string, GapWorklistIntakeLike>();
  for (const row of rows) {
    if (row.graceSku) map.set(row.graceSku, row);
  }
  return map;
}

/** Join worklist rows to intake rows by graceSku. Never mutates the lane. */
export function joinGapWorklistToIntake(
  rows: GapWorklistRow[],
  intakeByGraceSku: Map<string, GapWorklistIntakeLike>,
): GapWorklistJoinedRow[] {
  return rows.map((row) => {
    const intake = intakeByGraceSku.get(row.graceSku) ?? null;
    return {
      ...row,
      inIntake: intake != null,
      productGroupSlug: intake?.productGroupSlug ?? null,
      intake,
    };
  });
}

// ─── Export (serialize filtered rows back to CSV) ───────────────────────────

function csvCell(value: unknown): string {
  const text = value == null ? "" : String(value);
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

/**
 * Serialize rows back to CSV, preserving the canonical column order plus any
 * extra columns the source CSV carried (so an export round-trips losslessly).
 */
export function gapWorklistToCsv(rows: GapWorklistRow[]): string {
  const extraKeys: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row.extra)) {
      if (!seen.has(key)) {
        seen.add(key);
        extraKeys.push(key);
      }
    }
  }
  const columns = [...GAP_WORKLIST_CSV_COLUMNS, ...extraKeys];
  const header = columns.map(csvCell).join(",");
  const lines = rows.map((row) =>
    columns
      .map((column) => {
        if (column in row.extra) return row.extra[column];
        return (row as Record<string, unknown>)[column];
      })
      .map(csvCell)
      .join(","),
  );
  return [header, ...lines].join("\n") + "\n";
}
