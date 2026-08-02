# Agent handoff — Best Bottles canonical measurement truth (2026-07-12)

> Standing instructions for any agent working on the Best Bottles measurement /
> geometry / image-generation surface, in this repo or the Best-Bottles-Website repo.

Before touching anything measurement- or geometry-related for Best Bottles, read
`docs/best-bottles-canonical-truth/BEST-BOTTLES-CANONICAL-TRUTH.md` in full
(absolute path: `/Users/jordanrichter/Projects/Madison Studio/madison-app/docs/best-bottles-canonical-truth/`).
It is the canonical reconciliation (2026-07-12) of the live bestbottles.com site,
live Convex, the Nemat master catalog, and the client's catalog PDF.

Non-negotiable rules from it:

1. Consume ONLY the `canon_*` columns in `best-bottles-master-truth.csv` (2,484 rows,
   including the 2026-07-16 website-authoritative `GBcyl25SpryShnBlk` reconciliation).
   Never raw `diameter` for flat families (Elegant, Circle, Rectangle, Diamond,
   Grace, Flair); never Convex `widthMm`/`depthMm` (they are programmatic copies of
   `diameter` — verified live 2026-07-12 — and carry no real depth).
2. Geometry keys on the BODY (family × size), not the SKU —
   `best-bottles-body-geometry.csv` has the 118 distinct bodies. `heightWithCap` is
   variant-specific; `heightWithoutCap` is the body constant.
3. Precedence for any dimension: manual override > live-site PDP spec table >
   site-confirmed catalog > product-group consensus. Convex majority vote is NOT
   truth (see finding F4 in the truth sheet).
4. Lane split:
   - **madison-app agent**: wire canonical values into the generation path — either
     generate expanded `public/data/best-bottles-measurement-overrides.json` entries
     from the master CSV's flagged rows (the override mechanism already outranks
     catalog values in `scripts/build-bestbottles-generation-readiness.ts`), or add
     the canonical CSV as an input to `scripts/build-bestbottles-catalog-lite.ts`.
     Do NOT write to Convex from madison-app.
   - **Best-Bottles-Website repo agent** (holds the Convex write token): own the
     839-SKU measurement sync-back migration — write corrected heights/widths, real
     `widthMm`/`depthMm` per the §3 axis semantics, and flip `verified:true` on
     synced rows. Source of values: the master CSV's `canon_*` columns.
   - **Physical measurements** (client/Cowork): the §8 escalation list — Diamond
     60 ml depth, Round 78/128 ml spec-vs-render conflict, Aluminum 100 ml body
     height, Boston Round 30 ml lone 68 mm row, Royal 13 ml 17 mm rows.
5. Commit `docs/best-bottles-canonical-truth/` if it is still untracked, before any
   other work on this surface.
