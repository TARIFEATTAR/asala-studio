# Madison app — agent notes

## Best Bottles image pipeline — READ FIRST
Before touching the Best Bottles image / library / pipeline / coverage surface, read
**`docs/BEST-BOTTLES-IMAGE-PIPELINE-BRIEF.md`**. It defines the two-axis model
(lineage vs quality), why "done" = `status:approved-keep` (NOT "has any image"), the
`library_tags` vocabulary, the `coverageStatus` state machine, the UI build targets
(provenance-gated completeness, the legacy/clean library filter, the from-zero
worklist), and the two-agent lane split (this repo owns the app + Supabase +
generation; Cowork owns reference prep + Shopify + QA via reviewed artifacts).

The **Gap worklist** surface (per-family lists of variants still missing a clean
reference, lane-segmented by Cowork) is documented in
**`docs/best-bottles-gap-worklist.md`**: Cowork drops
`public/data/audits/<family>-gap-worklist-<date>.csv`, Madison re-indexes with
`npm run bestbottles:gap-worklist:index` and displays it — **never re-deriving the
lanes**. Lib: `src/lib/bestBottlesGapWorklist.ts`. View:
`src/components/bestbottles/GapWorklistView.tsx`.

## Product image pipeline — pixel sizes

| Stage | Dimensions | Ratio |
|-------|------------|--------|
| OpenAI raw output (`grid-images/output/openai/raw/*.png`) | 2080 × 2288 | 10:11 |
| Paper-doll composition canvas (`manifest` / `geometry_spec`) | 1000 × 1300 | 10:13 |
| Example Sanity CDN hero (paper-doll group) | 928 × 1152 | ~4:5 |

Note: as of 2026-04-26 catalog masters render at 2080×2288 (was 2000×2200) so both edges are multiples of 16, complying with gpt-image-2's size constraint. The 10:11 ratio is exact and preserved.

Constants: `src/config/productImageDimensions.ts`. Detail: `docs/product-image-system/pixel-contracts.md`.
