# Best Bottles master reusable plate shot list

## Answer

The catalog does **not** require one rendered product per SKU. The source-backed reusable plate ceiling is **309 plates**:

- 161 body appearance plates across 118 measured geometries;
- 148 explicit component appearance plates.

The operational ledger has 318 rows because it also preserves 6 already-built local plates that do not yet have an exact source-row crosswalk and 3 blocked source gaps. Those support/review rows are not additional generation commitments.

## Current status

- 22 source-backed requirements already have exact local authority coverage.
- 287 source-backed requirements remain authority or truth work.
- 29 outstanding component appearances now have local dimension-calibrated profile candidates awaiting named authority review; they are not counted as approved coverage.
- Status distribution: authority-existing-local 23, locked-existing 5, manual-review-required 156, needs-authority 131, needs-source 3.

This is an upper-bound appearance shot list, not a claim that every row needs a separately modeled mesh. Geometry-family deduplication and deterministic material variants should reduce modeling work while retaining one approved output plate per required appearance.

## Operating sequence

1. Verify/release existing local authorities.
2. Resolve P0 truth and missing-source rows.
3. Group source-backed component appearances by measured physical geometry.
4. Produce one authority per geometry family.
5. Produce and exact-alpha clamp each required appearance plate.
6. Review family fit and lock placement.
7. Cut immutable releases and sync Sanity drafts.
