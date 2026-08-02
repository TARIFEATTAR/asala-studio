# CYL-9ML Roll-On Component Qualification

**Evidence date:** 2026-08-02

**Scope:** ten opaque overcaps plus plastic and metal roller fitments

**Decision rule:** measured structure can block a candidate, but cannot substitute for named catalog approval.

## Executive verdict

The twelve unique components are fully accounted for. One is currently usable as an existing approved source (plastic roller), eleven remain blocked, and no asset in this evidence set has been added to a release.

- The ten Blender overcaps are genuinely geometry locked by exact authoritative-mask alpha identity. They are still unregistered, catalog-unapproved candidates.
- The frozen metal roller is rejected: 45,022 of 61,719 opaque pixels are exact white (`72.9467%`). The previous connected-region gate saw one region and missed the contiguous patch.
- A deterministic repair command now requires an externally ML-matted transparent PNG, crops from alpha, places on the locked `2080×2288` canvas at axis `1041` / seat `1002`, and emits a new SHA without modifying the frozen file.
- The repair output was not fabricated in this run because the local Yaps matting engine was unavailable. The metal roller therefore remains blocked.

## Gate calibration

Gate versions:

- `opaque-white-fraction-v1`: exact-white RGB pixels among alpha ≥250; reject above `5%`.
- `cyl9-opaque-finish-structure-v1`: finish-specific luminance and horizontal-gradient evidence.
- `exact-authoritative-mask-alpha`: every beauty alpha must equal the authority-mask bytes exactly.
- `cyl9-rollon-rhinestone-layout-v1`: ordered layout identity plus shared stone-mask SHA.

The white-junk threshold was calibrated on real files, not assumed from shape:

| Fixture | SHA-256 | Opaque pixels | Exact-white pixels | Fraction | Verdict |
|---|---|---:|---:|---:|---|
| Plastic roller | `442e94e1e1b5c034648d40a06950642eaf770ab9d51d717d7be59adc4511d11c` | 15,266 | 0 | 0.0000% | Pass |
| Frozen metal roller | `db65f5072e978a369f3011a63a9f51acd5aed36899a583ca014d85fc67d9fce1` | 61,719 | 45,022 | 72.9467% | **Block** |
| Ten canonical overcaps | individual hashes below | 184,990 each | 0 each | 0.0000% | Pass this gate only |

The 5% ceiling is deliberately wide between the measured approved-material range (`0%`) and the known failure (`72.9467%`). It is scoped to these opaque CYL-9ML parts and must not be reused for translucent plastic.

## Overcap evidence

Shared immutable geometry evidence:

- Geometry recipe SHA: `5ed7917a5d27edb2e95820893be91422dde7ca59fca58e2fd36367f842681550`
- Authority mask SHA: `8f03e365ae9cb1673a79056d54ba072eec968974ba707c11e52a83a4d1691aca`
- Mask bounds: `left 860, top 482, right 1221, bottom 1001`
- Mask foreground: `184,990` pixels; binary; does not touch the frame
- Placement: width `363px`, axis `1041`, seat `1002`
- Component-version IDs: none. These are local renderer candidates and have not been registered or approved.

`Range` is luminance p95−p05. `Sharp mass` is the fraction of adjacent opaque horizontal pairs with Δluma ≥10.

| Requirement | Finish class | Beauty SHA-256 | Range | Median | Gradient p95 | Sharp mass | Structure | Catalog verdict |
|---|---|---|---:|---:|---:|---:|---|---|
| `CYL-9ML:OVERCAP:SHN-SL` | mirror | `1f8b8faf1cd711d5f9c4f4b5a3b63b47da0ceebc2c17f024a1d5a5aa611a6f53` | 132.79 | 124.72 | 10.93 | 5.32% | Pass | **Blocked — named mirror-band art-direction approval missing** |
| `CYL-9ML:OVERCAP:SHN-GL` | mirror | `02d382e08c4f2ed03c1731f7a4a0b891f82d975dd14a050a5a9e0bab6b97b516` | 103.41 | 92.59 | 8.86 | 3.35% | Pass | **Blocked — named mirror-band art-direction approval missing** |
| `CYL-9ML:OVERCAP:MAT-CU` | matte | `dce356be97fff005000fc3ca5eb0567feb7aa3175e16157c7fbfed801d02f82f` | 14.76 | 68.82 | 1.07 | 0.00% | Pass | **Blocked — named catalog approval missing** |
| `CYL-9ML:OVERCAP:SHN-BLK` | glossy black | `a9be653115ba9706748da7757a4370c651d19c0062e2a9e4c024d3ee081ca99a` | 66.86 | 23.00 | 5.00 | 1.17% | Pass | **Blocked — named catalog approval missing** |
| `CYL-9ML:OVERCAP:MAT-SL` | matte | `3a97edcc85baa69f55ace5e432ceec0d322aab6b4c83e4566418d47d8268f56f` | 21.65 | 94.37 | 1.00 | 0.00% | Pass | **Blocked — named catalog approval missing** |
| `CYL-9ML:OVERCAP:MAT-GL` | matte | `65c1382af7b4306b7b348b639ab240ce266de04e54429a1d9a5e3b9324d3cb57` | 19.46 | 89.97 | 1.07 | 0.00% | Pass | **Blocked — assembly review says too ochre/flat** |
| `CYL-9ML:OVERCAP:WHT` | glossy white | `757bc4cd2eff2cfe0e1ae0cd0c5e7b4101910821f88f9f5ace190a1215d335f2` | 22.72 | 144.85 | 1.07 | 0.02% | Pass | **Blocked — assembly review says gray** |
| `CYL-9ML:OVERCAP:SL-DOT` | mirror + stones | `c0f8d78d531e76b7e8fd315dc5b767e7c7cc562c0657ea29448e9efa43d5c34f` | 132.79 | 124.93 | 12.00 | 6.06% | Pass | **Blocked — stones read as studs** |
| `CYL-9ML:OVERCAP:BLK-DOT` | mirror + stones | `a1ca35481ffc2e67b0739e5ac2cf964205bb5a54e33d78b0d9c36377eeff0c7a` | 132.79 | 123.93 | 12.00 | 5.99% | Pass | **Blocked — stones read as studs** |
| `CYL-9ML:OVERCAP:PNK-DOT` | mirror + stones | `e0e7779de58da9c8cd292bd5a27cbc3afe99573c441bd478ce1433fc2cc7a7b9` | 132.79 | 123.93 | 12.00 | 6.02% | Pass | **Blocked — stones read as studs** |

## Rhinestone identity

- Layout key: `cyl9-rollon-rhinestone-layout-v1`
- Ordered layout entries: `24`
- Layout SHA: `78f809de5c94c9d827a099740ea3fad1682dde091a318097182c83a57fe568eb`
- Shared rendered stone-mask SHA: `3409ba05e4bcf8ffde4ef8cf53a50abd294cf05aa441e93f02c0f46da5d09ecd`
- Visible stone-mask components in the level-camera render: `12`
- `SL-DOT`, `BLK-DOT`, and `PNK-DOT` all bind the exact same stone-mask SHA.

This preserves placement, count, and ordered layout deterministically. It does not override the visual blocker: the current rendered stones do not yet read as final faceted rhinestones.

## Twelve-component disposition

| Component | Existing or candidate version | Decision | Release eligible now? |
|---|---|---|---|
| Plastic roller | existing frozen SHA `442e94e1…` | Existing approved source; white-junk gate passes | Yes, after registration into the private component inventory |
| Metal roller | frozen SHA `db65f507…` | **Rejected; do not ship** | No |
| Repaired metal roller | no version produced | **Blocked on real ML matting** | No |
| Ten opaque overcaps | unregistered renderer candidates | Geometry-qualified; catalog-blocked as listed above | No |

## Non-negotiable release consequence

The CYL-9ML roll-on release must remain `blocked`. No missing version may be disguised as complete, no candidate may be inserted into the active release, and this evidence authorizes no Sanity publication.
