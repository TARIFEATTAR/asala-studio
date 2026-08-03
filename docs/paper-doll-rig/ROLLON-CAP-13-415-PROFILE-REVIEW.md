# 13-415 roll-on overcap profile review

**Date:** 2026-08-03  
**State:** local dimension-calibrated candidate; not geometry locked; not production eligible

## What was built

- One parametric Blender geometry recipe for the nine catalog 13-415 roll-on overcap appearances.
- Verified nominal dimensions: 17 ±0.5 mm outside diameter and 24 ±0.5 mm height.
- Nine isolated finish renders and one shared Blender-rendered alpha authority candidate.
- An exact-alpha clamp pass across every variant.
- A 3×3 review contact sheet and an immutable local candidate manifest.

The recipe is `rollon-cap-13-415-family-recipe.json`. The local candidate evidence is under `outputs/paper-doll-parametric-overcaps/13-415-rollon-cap/candidate-v1/`.

## Evidence

| Check | Result |
|---|---:|
| Catalog appearances represented | 9 |
| Physical dimensions verified | yes |
| Minimum pairwise alpha IoU after clamp | 1.0000 |
| Maximum pairwise mismatched alpha pixels | 0 |
| Geometry locked | no |
| Production plate eligible | no |
| Current Release changed | no |
| Sanity changed | no |

The catalog-reference review lane uses `CPRoll13-415BlkSh` as the diagnostic medoid. Its measured source-image bounds ratio is 0.70238. The nominal physical diameter/height ratio is 0.70833. That proximity is useful calibration evidence, but the catalog image is not an approved geometry authority and a two-dimensional ratio does not prove the whole profile.

## Visual review finding

The family is internally consistent, and the dotted variants retain one deterministic eight-stone layout. The first Blender profile has a visibly softer, more rounded top shoulder than several of the catalog references, which read flatter across the top with a tighter corner radius. Material appearance is review-only and is not a reason to change the measured geometry.

The clean contact sheet intentionally labels every tile `PROFILE REVIEW · NOT GEOMETRY LOCKED`.

## Required next gate

1. Review the Blender profile against the preserved catalog-reference contact sheet.
2. If needed, revise only `profileNormalized`; the Blender integration test proves that any profile change produces new mesh provenance.
3. Name and approve the final physical profile authority.
4. Exact-alpha clamp all finish candidates to that approved authority.
5. Perform family-fit review on approved 13-415 body authorities when those exist.
6. Lock placement and cut a release only through the append-only lifecycle.

Until those gates pass, these files are local review artifacts—not approved plates and not evidence of compatibility with a body family.
