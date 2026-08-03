# 18-415 Faux-Leather Cap — Profile Review Candidate

**State:** local dimension-calibrated candidate; not geometry locked; material placeholders not approved

**Recipe:** `docs/paper-doll-rig/faux-leather-cap-18-415-family-recipe.json`

**Candidate manifest:** `outputs/paper-doll-parametric-overcaps/18-415-faux-leather-cap/candidate-v1/candidate-manifest.json`

## What this candidate covers

- `CP18-415BlkLthr` — black faux-leather wrap, silver trim
- `CP18-415BrwnLthr` — brown faux-leather wrap, silver trim
- `CP18-415LBrwnLthr` — light-brown faux-leather wrap, silver trim
- `CP18-415LIvyLthr` — ivory faux-leather wrap, gold trim
- `CP18-415LPnkLthr` — pink faux-leather wrap, gold trim

All five component rows independently record the same verified outside diameter of **25 ±0.5 mm** and cap height of **30 ±0.5 mm**.

## Geometry versus material responsibility

- The revolved shell and raised top/bottom trim bands are the shared structural review candidate.
- The two trim bands occupy source-derived review zones at normalized heights `0–0.18` and `0.82–1.0`; these ratios are not verified tooling dimensions.
- Leather color, reptile/pebbled pattern, grain, seam character, and trim coating are material pixels. They must not change the shared silhouette.
- The Blender leather shaders are routing placeholders only. They do not reproduce the supplier material closely enough for material approval.
- A later GPT material reconstruction should use the exact supplier reference for each appearance, normalize into this authority mask, and copy the mask alpha byte-for-byte.

## Evidence and limits

- `CP18-415LBrwnLthr` is the diagnostic medoid and calibration reference.
- The worst source-pair silhouette IoU is `0.9544857768052516`.
- Source bounds have an `8.97599838353515%` aspect spread, including inconsistent crop/perspective between the supplier files.
- All five local renders have exact shared alpha: IoU `1.0000`, maximum mismatched pixels `0`.

These facts support one 25 × 30 mm two-zone profile review candidate. They do not earn geometry authority, material approval, compatibility, family placement, or production eligibility. No remote ledger, Current Release, or Sanity state changed.
