# Best Bottles Global Catalog Scale Verification

**Verified:** 2026-07-12  
**Branch:** `codex/best-bottles-product-hub-pipeline`  
**Scale contract:** `best-bottles-catalog-scale-v1`  
**Prompt/shadow contract:** `best-bottles-reference-locked-v6.1`

## Implemented

- One monotonic global capacity curve at 1, 3, 4, 5, 9, 28, 30, 50, 100, 118, 227, and 454 ml.
- Family corrections bounded to ±2 percentage points; initial correction is zero for every authored family.
- Cap-on assembled target separated from persistent bottle-body target.
- Detached sidecars excluded from primary-bottle scale, centerline, baseline, and fill-height QA.
- Explicit cap-off generation blocked without confirmed cap-off PSD evidence.
- Vintage bulb, tassel, and other multi-component generation blocked without topology PSD evidence.
- Canonical v6.1 model-owned shadow policy extended to every bottle family; component/packaging lanes remain excluded.
- Scale contract, registry key, assembled target, and body target added to generation/resume lineage.
- Deterministic registry and technical/hero lineup builders added. Both lineup outputs must consume one identical actual-product manifest.

## Verification

| Check | Result |
|---|---:|
| New catalog-scale tests | 19 passed, 0 failed |
| Existing Best Bottles regression tests | 360 passed, 0 failed |
| TypeScript (`npx tsc --noEmit`) | passed |
| Diff whitespace check | passed |
| Paid generation | not run |
| Supabase/Convex mutation | not run |
| Shopify mutation | not run |

## Real registry result

The strict real-data build intentionally fails closed until the approved PSD inventory is populated.

- Catalog rows inspected: 2,483
- Registry-eligible rows: 1
- Explicit exclusions: 2,482
- Eligible Cylinder calibration anchors: 1 (`GB-SPR-CLR-3ML-BLK`, 3 ml)
- Missing Cylinder anchors: 1, 4, 5, 9, 28, 30, 50, 100, 118, 227, and 454 ml
- Dominant exclusion: 2,230 rows lack an approved opaque PSD-derived cap-on reference in the current migration manifest
- Actual lineup render: blocked; the eligible 3 ml row still lacks a lineup-specific approved PSD-derived alpha product layer with primary-bottle QA bounds

No legacy website GIF, retired transparent derivative, sibling SKU, or generated stand-in was substituted.

## Artifact hashes

| Artifact | SHA-256 |
|---|---|
| `public/data/best-bottles-catalog-scale-registry.json` | `2c5ce6f942f909765432125bce9f4da71c5dd2850822ac9eeffc1d64868be1a1` |
| `public/data/best-bottles-cylinder-calibration-manifest.json` | `e70e834898a21feb2805e77a6f4cfb1cbd624d49e1db3bbcc46d731107aad4ca` |
| `tmp/best-bottles-calibration/lineup-blockers.json` | `3b3fccbcec9014e3f2de755ae78813fffaf7d23a586a9d1624087e409be43464` |

## Next production gate

Populate the approved PSD/reference inventory for the eleven missing Cylinder anchors and export a lineup-only alpha product layer plus primary-bottle QA bounds for each approved anchor. Then rerun:

```bash
npm run bestbottles:scale:registry
npm run bestbottles:scale:lineups
```

The registry command exits non-zero while anchors are missing. The lineup command exits non-zero rather than fabricating a bottle when an approved product layer is absent.
