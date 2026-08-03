# 13-415 Standard Cap — Profile Review Candidate

**State:** local dimension-calibrated candidate; not geometry locked; not production approved

**Recipe:** `docs/paper-doll-rig/standard-cap-13-415-family-recipe.json`

**Candidate manifest:** `outputs/paper-doll-parametric-overcaps/13-415-standard-cap/candidate-v1/candidate-manifest.json`

## What this candidate covers

This candidate covers the two source-backed 13-415 standard-cap appearances in the catalog:

- `CP13-415Gl` — shiny gold
- `CP13-415Sl` — silver

The canonical catalog records a verified outside diameter of **17 ±0.5 mm** and a cap height of **24 ±0.5 mm**. One parametric Blender profile produces both material variants.

## Evidence and limits

- `CP13-415Gl` is the source-review medoid and the calibration reference.
- The diagnostic source-pair silhouette IoU is `0.9978712494367357`.
- Both source bounds have an aspect ratio of `0.6738095238095239`.
- The two rendered candidates have exact shared alpha: minimum pairwise IoU `1.0000`, maximum mismatched pixels `0`.

These measurements support a shared **review candidate**. They do not make either website image a physical authority and do not prove compatibility. Source-image IoU is diagnostic evidence only.

This standard-cap profile is intentionally separate from the 13-415 roll-on overcap profile. Matching nominal dimensions do not prove that the two product types share one silhouette.

## Required gate

Before promotion, a named reviewer must:

1. compare the calibrated profile against the physical cap or an approved orthographic authority;
2. approve the profile as geometry authority;
3. approve gold and silver material pixels;
4. validate compatibility and family placement on the applicable body plates;
5. approve the resulting immutable candidate and placement versions.

Until those gates pass, `geometryLocked` and `productionPlateEligible` remain `false`. No remote ledger, Current Release, or Sanity state was changed while producing this candidate.
