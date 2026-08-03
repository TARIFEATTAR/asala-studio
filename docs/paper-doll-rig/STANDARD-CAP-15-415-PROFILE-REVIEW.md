# 15-415 Standard Cap — Profile Review Candidate

**State:** local dimension-calibrated candidate; not geometry locked; not production approved

**Recipe:** `docs/paper-doll-rig/standard-cap-15-415-family-recipe.json`

**Candidate manifest:** `outputs/paper-doll-parametric-overcaps/15-415-standard-cap/candidate-v1/candidate-manifest.json`

## What this candidate covers

This candidate covers the two source-backed 15-415 standard-cap appearances in the catalog:

- `CP15-415ShnGl` — shiny gold
- `CP15-415ShnSl` — shiny silver

The canonical catalog records a verified outside diameter of **19 ±0.5 mm** and a cap height of **32 ±0.5 mm**. One parametric Blender profile produces both material variants.

## Evidence and limits

- `CP15-415ShnGl` is the source-review medoid and calibration reference.
- The diagnostic source-pair silhouette IoU is `0.9885026863614291`.
- Source bounds range from `0.6095238095238096` to `0.6238095238095238`, a `2.2900763358778544%` spread.
- Both rendered candidates have exact shared alpha: minimum pairwise IoU `1.0000`, maximum mismatched pixels `0`.

These measurements support a shared **review candidate**. They do not make either website image a physical authority and do not prove bottle compatibility. Source-image IoU remains diagnostic evidence only.

## Required gate

Before promotion, a named reviewer must:

1. compare the calibrated profile against the physical cap or an approved orthographic authority;
2. approve the profile as geometry authority;
3. approve the gold and silver material pixels;
4. validate compatibility and family placement on the applicable body plates;
5. approve the resulting immutable candidate and placement versions.

Until those gates pass, `geometryLocked` and `productionPlateEligible` remain `false`. No remote ledger, Current Release, or Sanity state was changed while producing this candidate.
