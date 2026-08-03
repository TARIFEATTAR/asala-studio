# 20-400 Tall Roll-On Cap — Profile Review Candidate

**State:** local dimension-calibrated candidate; not geometry locked; not production approved

**Recipe:** `docs/paper-doll-rig/tall-rollon-cap-20-400-family-recipe.json`

**Candidate manifest:** `outputs/paper-doll-parametric-overcaps/20-400-tall-rollon-cap/candidate-v1/candidate-manifest.json`

## What this candidate covers

- `CPRoll20-400TallMattBlk` — matte black
- `CPRoll20-400TallMattGl` — matte gold
- `CPRoll20-400TallMattSl` — matte silver
- `CPRoll20-400TallShnBlk` — shiny black
- `CPRoll20-400TallShnGl` — shiny gold
- `CPRoll20-400TallShnSl` — shiny silver

The catalog records the same verified outside diameter of **23 ±0.5 mm** and cap height of **35 ±0.5 mm** for all six appearances.

## Evidence and limits

- `CPRoll20-400TallMattGl` is the diagnostic medoid and calibration reference.
- The reviewed sources all show a plain smooth tall cylindrical roll-on cap.
- The worst source-pair silhouette IoU is `0.9668184273477892`.
- Source bounds have an `8.106080949126069%` aspect spread.
- All six local renders have exact shared alpha: IoU `1.0000`, maximum mismatched pixels `0`.
- Matte black has its own dielectric material preset and is not an alias for glossy black.

The source-image spread is diagnostic presentation noise, not a geometry-lock threshold. These facts support one 23 × 35 mm smooth profile review candidate but do not earn geometry authority or compatibility. A named reviewer must approve the physical profile, material pixels, and target-family placement. Material reconstruction may replace Blender surface pixels later only through the exact authority mask. No remote ledger, Current Release, or Sanity state changed.
