# Best Bottles — Gap worklist (ingest + display)

The **Gap worklist** is the per-family list of product variants that still do NOT have a
clean, background-removed reference image, segmented into lanes by *why* a clean reference
is missing and *who* resolves it. It surfaces in the Best Bottles pipeline workbench.

## Single-writer contract (who owns what)
- **Cowork produces** the segmented CSV. The lane assignment (A–G) depends on reference-prep
  knowledge that lives only on the Cowork side — which PSDs are flattened (→ rembg), which
  finishes have no art, which sizes are mislabels, etc. It **cannot** be re-derived from
  Madison's intake.
- **Madison ingests + displays** it. The app reads the CSV verbatim, joins each row to the
  live Convex/intake row by `graceSku`, and renders it. **Madison never recomputes the lane.**

See `docs/BEST-BOTTLES-IMAGE-PIPELINE-BRIEF.md` §5 (the two-agent lane split).

## Data contract (the files)
Cowork drops files into `public/data/audits/` (served at `/data/audits/…`, matching the app's
existing `fetch("/data/…")` convention):

| File | Producer | Purpose |
|------|----------|---------|
| `<family-slug>-gap-worklist-<YYYY-MM-DD>.csv` | Cowork | the segmented worklist |
| `<family-slug>-gap-worklist-README.md` | Cowork | the lane legend |
| `gap-worklists.json` | Madison (indexer) | manifest of every CSV discovered |

**CSV columns:** `graceSku, websiteSku, productName, capacityMl, color, applicator, capStyle,
lane, action, resolutionNeeded, suggestedOwner, legacyUrl, legacyDescription`. Unknown columns
are preserved through export. The `lane` cell may be `"A"`, `"A. rembg-cutout"`, or
`"A. rembg-cutout (9)"`; it normalizes to a canonical A–G id (with a keyword fallback). Lanes:

- **A** rembg-cutout · **B** frosted (no PSD) · **C** matte sprayer (only shiny art) ·
  **D** screw-cap (no PSD) · **E** 25ml lotion · **F** plastic flip-top (wrong family) ·
  **G** other (needs review)

## How a new CSV reaches the UI
A static Vite SPA can't list a directory at runtime, so a manifest mediates discovery:

1. Cowork drops `<family>-gap-worklist-<date>.csv` into `public/data/audits/`.
2. Madison re-indexes: `npm run bestbottles:gap-worklist:index`
   (`scripts/build-bestbottles-gap-worklist-index.ts` globs the dir, parses family + date from
   each filename, counts rows, writes `gap-worklists.json`).
3. The workbench reads the manifest and selects the **newest dated CSV per family**. Dropping a
   newer-dated CSV + re-indexing is how the view "refreshes" to the latest.

## Where it lives in the app
- **Lib:** `src/lib/bestBottlesGapWorklist.ts` — dependency-free CSV parser (handles quoted
  commas/newlines), lane vocabulary, `selectNewestGapWorklistPerFamily`, `graceSku`→intake join,
  CSV export serializer. Tested in `src/lib/bestBottlesGapWorklist.test.ts`.
- **View:** `src/components/bestbottles/GapWorklistView.tsx` — lane filter chips (A–G + counts),
  the worklist table, an **Export CSV** button (downloads the lane-filtered rows for handoff to
  Baymard/Nemat), and health badges (`not in intake`, `unrecognized lane`).
- **Wiring:** `src/pages/BestBottlesPipeline.tsx` — `coverageView === "gap-worklist"`, a
  **Gap worklist** view-toggle tab, and react-query loaders for the manifest + the active
  family's CSV. The intake join uses `best-bottles-reference-intake.json` (already loaded).
- **Entry point:** the **`rename/source refs`** movement pill in the PDP-readiness view is a
  clickable button that deep-links to the gap worklist filtered to that family. (That pill's
  number is Madison-derived; the CSV is Cowork's authoritative lane-segmented list — the pill is
  the entry point, not a guaranteed-equal count.)
