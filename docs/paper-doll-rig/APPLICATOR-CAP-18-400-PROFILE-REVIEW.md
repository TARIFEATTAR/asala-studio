# 18-400 Applicator Cap — Compound Profile Review Candidate

**State:** local dimension-calibrated candidate; not geometry locked; material not approved

**Recipe:** `docs/paper-doll-rig/applicator-cap-18-400-family-recipe.json`

**Candidate manifest:** `outputs/paper-doll-parametric-overcaps/18-400-applicator-cap/candidate-v1/candidate-manifest.json`

## Preserved catalog responsibility

- Source identity: `18-400CpAppBlk`
- Grace SKU: `CMP-APP-BLK-18-400`
- Canonical overall dimensions: **21 ±0.5 mm** outside diameter and **45 ±0.5 mm** total height

This is a compound component, not a plain cap. The source explicitly contains a black fluted cap shell and a clear-glass rod applicator. The local review candidate therefore keeps both responsibilities in one deterministic full-canvas mask.

## Measured versus source-derived geometry

- The 21 × 45 mm overall envelope comes from canonical catalog measurements.
- The cap shell reuses the visible 18-400 short fluted profile at an 11 mm review height.
- The 1.5 mm stem diameter, 2.4 × 2.6 mm terminal, and 1 mm bottom clearance are source-derived review parameters. They are not verified manufacturing drawings.
- The clear-glass stem has its own material assignment and remains distinct from the glossy-black shell.
- The compound mask is one connected occupied region; the stem and terminal are not detached overlay islands.

This candidate does not resolve the catalog-wide standalone `glass-rod` source gap because there is still no independent canonical rod identity. It does preserve the glass-rod responsibility for this exact applicator assembly.

Named profile review, material review, bottle-context fit, and compatibility evidence are required before geometry lock or production use. Current Release and Sanity remain unchanged.
