# Parametric component geometry review book

## Purpose

This review book consolidates the twelve dimension-calibrated cap families already rendered locally. It is the visual gate between candidate creation and named geometry-authority approval.

Run:

```bash
npm run paperdoll:parametric-review-book
```

Primary review artifact:

`outputs/paper-doll-parametric-overcaps/catalog-review-book-v1/overview.png`

Machine-readable evidence:

`outputs/paper-doll-parametric-overcaps/catalog-review-book-v1/review-book-manifest.json`

The manifest SHA-binds every recipe, candidate manifest, source review sheet, generated neck-finish page, and the overview. The current overview SHA-256 is `dd2c65d5d1bc759451c92b8ab7585f90fd103c113f305c75c2fda95658591a8a`.

## Coverage

| Neck finish | Geometry families | Candidate outputs | Catalog identities |
|---|---:|---:|---:|
| 8-425 | 2 | 5 | 5 |
| 13-415 | 2 | 11 | 11 |
| 15-415 | 1 | 2 | 2 |
| 18-400 | 2 | 2 | 2 |
| 18-415 | 3 | 10 | 10 |
| 20-400 | 2 | 7 | 8 |
| **Total** | **12** | **37** | **38** |

The 20-400 difference is intentional. `20-400Cp2ozShortBlk` and `20-400cp1ozShortBlk` resolve to one identical source file, one Grace SKU, and one measured 23 × 12 mm output. They remain separate catalog identities but do not justify duplicate pixels.

## Approval sequence

1. Use `overview.png` for family-level triage.
2. Inspect the corresponding full-resolution page under `groups/<neck-finish>.png`.
3. Record a named approve/reject decision for each `familyKey`, including a note about physical profile, flange, top radius, and any compound responsibility.
4. An approved profile may become geometry authority only through a new immutable authority version and exact mask registration.
5. Review material pixels separately. Profile approval does not approve mirror, matte, leather, rhinestone, or translucent appearance.
6. Review each approved authority on compatible body families before locking placement.

## Guardrails

- Every page states `NOT GEOMETRY LOCKED` and `NOT PRODUCTION ELIGIBLE`.
- The builder never modifies candidate pixels.
- Exact alpha is proven only among variants inside the same candidate family.
- A source photograph or dimension-calibrated Blender profile is still review evidence until named authority approval.
- Compatibility is never inferred from a neck label or visual resemblance alone.
- No Supabase, Current Release, Sanity draft, or public write occurs.
