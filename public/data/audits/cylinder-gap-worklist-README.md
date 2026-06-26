# Cylinder Gap Worklist — Handoff Legend (2026-06-21)

`cylinder-gap-worklist-2026-06-21.csv` — the **57** Cylinder-family product variants that
do NOT yet have a clean, background-removed reference image, segmented by *why* and *who
resolves it*. As reference images get produced (rembg, new art), this list shrinks.

Cylinder status at export: **~327 / 384 clean reference-ready**; this CSV is the remaining ~57.

> **Producer:** Cowork (reference-prep lane). **Consumer:** Madison (this app ingests + displays
> it; it never re-derives the lanes — that knowledge lives only on the Cowork side). See
> `docs/BEST-BOTTLES-IMAGE-PIPELINE-BRIEF.md` §5.

## Columns
- `graceSku` — Madison/Convex import key (the canonical SKU).
- `websiteSku` — the legacy **bestbottles.com** item name (what the product is called on the live site).
- `productName`, `capacityMl`, `color`, `applicator`, `capStyle` — identity, from Convex.
- `lane` — the bucket (see below).
- `action` — the type of work needed.
- `resolutionNeeded` — the specific step to clear it.
- `suggestedOwner` — who's best placed to resolve (adjust as you see fit).
- `legacyUrl` — the live bestbottles.com product page (verify the real product here).
- `legacyDescription` — the legacy product description (cap color / finish in plain English).

## Lanes (what each means)
- **A. rembg-cutout (9)** — the source PSD exists but is flattened; just needs the ML
  background-removal pass (`run_cylinder_rembg_fallback.py`). *Internal / Mac.* No decision needed.
- **B. frosted variant — PSD missing (10)** — frosted variant whose specific PSD isn't in
  the library. Needs art/photo, or generate from a clear sibling. *Nemat / internal.*
- **C. matte sprayer — only shiny art (17)** — catalog lists a matte-finish sprayer, but only
  the SHINY sprayer PSD exists. **Confirm matte is a real sold variant** before producing it. *Nemat.*
- **D. screw-cap-only — no PSD (8)** — bottle + plain screw cap, never drawn as a paper-doll.
  Needs a reference photo, or compose body+cap, or generate. *Nemat / internal.*
- **E. 25ml lotion — no 25ml art** — *(folded into other this run)* no 25ml lotion PSD exists,
  only 30ml; confirm 25ml is a real distinct size or a mislabel of 30ml. *Nemat (catalog).*
- **F. plastic flip-top — wrong family (3)** — plastic flip-top bottles filed under Cylinder;
  confirm correct family or remove from Cylinder scope. *Nemat (catalog).*
- **G. other — needs review (10)** — no clean source matched; review identity against the
  legacy site. *Internal.*

## How to use
- **Lane A** clears on its own (ML run) — no team input needed.
- **Lanes C, E, F** are mostly **catalog confirmations** (is this variant/size real?) — fastest wins.
- **Lanes B, D** need **source art or a generation decision**.
- Sort by `lane`, assign `suggestedOwner`, and resolve top-down. Every row links to its live
  bestbottles.com page so identity can be confirmed against what's actually sold.

## How Madison ingests this
Drop a CSV named `<family-slug>-gap-worklist-<YYYY-MM-DD>.csv` into `public/data/audits/`,
then rebuild the index: `npm run bestbottles:gap-worklist:index`. The Best Bottles pipeline
workbench reads the index, picks the **newest** dated CSV per family, joins each row to the live
Convex/intake row by `graceSku`, and surfaces it under the **Gap worklist** view (also reachable
by clicking the `rename/source refs` count). Lanes are shown exactly as the CSV declares them.
