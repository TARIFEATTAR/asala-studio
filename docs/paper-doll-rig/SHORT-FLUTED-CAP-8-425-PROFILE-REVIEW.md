# 8-425 Short Fluted Cap — Profile Review Candidate

**State:** local dimension-calibrated candidate; not geometry locked; not production approved

**Recipe:** `docs/paper-doll-rig/short-fluted-cap-8-425-family-recipe.json`

**Candidate manifest:** `outputs/paper-doll-parametric-overcaps/8-425-short-fluted-cap/candidate-v1/candidate-manifest.json`

## What this candidate covers

- `8-425CpShortBlack` — glossy black
- `8-425CpShortWhite` — glossy white

The catalog records a verified outside diameter of **12 ±0.5 mm** and cap height of **9 ±0.1 mm**.

## Deterministic surface construction

- The lower flange is part of the axial mesh profile and never painted into a material.
- The renderer creates 32 recessed vertical flutes with deterministic phase, start, end, depth, and fade parameters.
- The flute count is a source-derived review parameter, not verified tooling truth.
- The Blender manifest records 1,056 recessed vertices, a maximum radius of 6 mm, and a maximum recess depth of approximately 0.1032 mm.

## Evidence and limits

- `8-425CpShortBlack` is the diagnostic medoid and calibration reference.
- The worst source-pair silhouette IoU is `0.9861519027317227`.
- Source bounds have a `1.6393442622950845%` aspect spread.
- Both local renders have exact shared alpha: IoU `1.0000`, maximum mismatched pixels `0`.

These facts support one fluted/flanged short-cap review profile but do not earn geometry authority or compatibility. A named reviewer must approve the profile, surface parameter, material pixels, and family placement. No remote ledger, Current Release, or Sanity state changed.
