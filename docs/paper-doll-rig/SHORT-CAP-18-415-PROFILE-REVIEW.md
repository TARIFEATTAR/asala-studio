# 18-415 Short Cap — Profile Review Candidate

**State:** local dimension-calibrated candidate; not geometry locked; not production approved

**Recipe:** `docs/paper-doll-rig/short-cap-18-415-family-recipe.json`

**Candidate manifest:** `outputs/paper-doll-parametric-overcaps/18-415-short-cap/candidate-v1/candidate-manifest.json`

## What this candidate covers

This candidate covers three source-backed 18-415 short-cap appearances:

- `CP18-415MtSl` — matte silver
- `CP18-415ShnGl` — shiny gold
- `CP18-415ShnSl` — shiny silver

The canonical catalog records a verified outside diameter of **21 ±0.5 mm** and a cap height of **19 ±0.5 mm**. One parametric Blender profile produces all three material variants.

## Evidence and limits

- `CP18-415ShnSl` is the source-review medoid and calibration reference.
- The worst diagnostic source-pair silhouette IoU is `0.9856594347041681`.
- Source bounds range from `1.0112994350282485` to `1.0434782608695652`, a `3.1091090883300367%` spread.
- All three rendered candidates have exact shared alpha: minimum pairwise IoU `1.0000`, maximum mismatched pixels `0`.
- The reusable Blender camera now frames from both physical height and width, preventing squat components from being cropped by portrait render dimensions.

These measurements support a shared **review candidate**. They do not make the source photography a physical authority and do not prove bottle compatibility.

## Required gate

A named reviewer must approve the calibrated profile, each material finish, and family placement against compatible body plates before promotion. Until then, `geometryLocked` and `productionPlateEligible` remain `false`. No remote ledger, Current Release, or Sanity state was changed.
