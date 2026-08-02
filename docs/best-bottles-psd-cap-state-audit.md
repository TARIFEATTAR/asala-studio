# Best Bottles PSD cap-state archive audit

Audit date: 2026-07-12

Audit scope: read-only inventory, evidence rendering, canonical identity routing, and review-sheet generation for the complete local PSD archive.

## Result

The audit accounted for all **4,493** PSD source paths and found **3,963** unique source hashes. It produced **4,268** source-hash-plus-canonical-identity review units. The 4,493 source rows include 530 repeated-hash paths; identity-safe grouping consolidated 225 duplicate source paths into 225 two-source review units. Every review-unit key appears exactly once in the review sheets, and the review-unit source lists trace back to all 4,493 unique archive paths.

All **4,493** evidence renders succeeded and **0** failed. Extractor `best-bottles-psd-evidence-v3` produced the existing 3,963 hash-keyed evidence JSON files and 3,963 hash-keyed preview PNGs. During the recovery verification run, all 4,493 source rows reused those saved v3 assets and **0** invalid entries required pixel regeneration. Cache reuse now requires the complete ready-evidence runtime schema and cross-field invariants, exact hash-keyed paths, matching preview bytes, a decodable single-page PNG, and exact recorded preview dimensions. No source metadata mutation or source-byte mutation was detected.

The corrected embedded-scene count was queried from each full PSD path while only scene zero was rendered. Counts range from 1 to 18 scenes; 4,485 source rows contain more than one scene. This replaces the invalid scene-zero-only count from the earlier audit state.

Initial approvals are **zero**. All 4,493 source rows remain pending human review. Machine classifications, routing hints, queue placement, and confidence values described below are **non-approval metadata only**; they do not establish a cap state, qualify an export, or represent a human decision.

## Identity routing

Counts below are source-row counts from `summary.json`.

| Identity result | Sources |
|---|---:|
| Exact website SKU | 2,731 |
| Exact Grace SKU | 0 |
| Reviewed alias | 0 |
| Ambiguous identity | 165 |
| Identity conflict | 0 |
| Unmatched | 1,597 |
| **Total accounted** | **4,493** |

The reviewed-alias input file was absent, which the audited loader treats as an empty alias set. No implicit or machine-created aliases were used.

## Review units by queue

The 314 renderer-owned sheets contain exactly 4,268 unique tiles.

| Queue | Review units |
|---|---:|
| Identity blockers | 165 |
| Evidence blockers | 0 |
| Unmatched | 1,597 |
| Ambiguous layout | 1,138 |
| Exact matched | 1,368 |
| **Total** | **4,268** |

Queue assignment is prioritization for human review, not an approval or a human-blocked decision. `ambiguous-layout` now means the evidence contains an actual layout signal (`multiple_large_components` or an explicit multi-product proposal); the universal pending classification no longer sends every exact identity there. Exact identities without that layout signal reach family/capacity/applicator `exact-matched` cohorts while remaining pending human cap-state review. Every tile includes capacity plus dedicated, untruncated lines for the complete proposed classification, confidence, and review status. All 4,268 representative rows remain low-confidence machine routing: 4,103 are proposed as `ambiguous-manual-review` and 165 as `blocked-identity-conflict` for routing purposes only.

## Review units by family

| Family | Review units | Family | Review units |
|---|---:|---|---:|
| Aluminum Bottle | 6 | Apothecary | 8 |
| Atomizer | 21 | Cap/Closure | 20 |
| Circle | 287 | Cream Jar | 12 |
| Cylinder | 484 | Decorative | 13 |
| Diamond | 67 | Diva | 158 |
| Dropper | 21 | Elegant | 309 |
| Empire | 152 | Flair | 11 |
| Grace | 77 | Lotion Pump | 4 |
| Plastic Bottle | 3 | Rectangle | 30 |
| Roll-On Cap | 34 | Round | 270 |
| Royal | 12 | Sleek | 218 |
| Slim | 209 | Sprayer | 20 |
| Square | 11 | Teardrop | 6 |
| Tulip | 11 | Unassigned | 1,762 |
| Vial | 32 | **Total** | **4,268** |

## Machine routing hints — non-approvals

Routing-hint occurrences are counted across source rows and may overlap. Another 1,845 source rows have no path/component hint and still require human review.

| Machine hint | Source-row occurrences |
|---|---:|
| Multiple large components | 1,952 |
| Folder hint: uncapped | 638 |
| Folder hint: capped | 243 |
| Component path hint | 184 |

These hints only decide where a reviewer looks first. In particular, folder names containing `capped` or `uncapped` are not cap-state evidence sufficient for approval.

## Immutability proof

The before and after manifests each contain 4,493 sorted PSD SHA-256 entries. `cmp` returned success with no output. Both manifest files have SHA-256:

`0fb37562ce3b3cf80d493d110c7e63d96ab1c29ae6a1d77a4e40402d8f168771`

The archive therefore remained byte-for-byte unchanged for every enumerated PSD during this run. The audit also reported 4,493 unchanged source metadata records, 0 source mutations, and 0 external writes.

## Inputs and artifacts

Primary inputs:

| Input | SHA-256 or state |
|---|---|
| `/Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Original-Photoshop-Sources` | 4,493-entry manifest hash `0fb37562ce3b3cf80d493d110c7e63d96ab1c29ae6a1d77a4e40402d8f168771` |
| `docs/best-bottles-canonical-truth/best-bottles-master-truth.csv` | `f2b25bbe4ffe51a3cc98a1b392fb73b4a5715a9c0e911ef2bb672d3e9e0f72c7` |
| `docs/best-bottles-canonical-truth/best-bottles-psd-reviewed-aliases.json` | Not present; loaded as an empty alias set |

Local artifact root: `tmp/best-bottles-reference-production/psd-cap-state-audit-v1/`

| Artifact | SHA-256 |
|---|---|
| `source-inventory.json` | `266b848fa63106b7d117a120767e8d4604185cc404bb8a8cecdf37450f94f0ac` |
| `identity-join.json` | `dad94c71830178e65360907e35e0308c437645ee0a7515a2cda7874d738de8a1` |
| `review-units.json` | `0ca076789f2d91917288cca7753a1e145e915ae0f82eefbb0b278e8285135dc5` |
| `summary.json` | `d7ead168b4d015a87ee327faf1ca4331fe19294124ab62a2c6123d5b0e4bea86` |
| `review-sheets/review-sheet-manifest.json` | `8d60325896208243a1ef25bc557de43b45ea02c66023cb494c0d1fd84d871668` |
| `review-sheets/index.html` | `417c630a80852238e462b9c47dae7be197e5d2eccf6d20b100f2e074ad96a89c` |
| `review-summary.json` | `b6f36326f03ba2f3ac0216b218fafc11880b725e21f44b7859031ec5db4800d3` |

The review index contains 314 current renderer-owned physical 2000 × 2400 PNG sheets matching all 314 manifest entries by filename and dimensions. The renderer manifest carries owner/version markers, and cleanup accepts only owned v2 filenames; unrelated or foreign-manifest files are preserved. The manifest has 4,268 tiles and 4,268 unique review-unit keys; its sorted key set exactly matches `review-units.json`. Flattening those review units yields 4,493 unique source paths, exactly matching `source-inventory.json`.

## Verification

- `npm run test:bestbottles:psd-audit`: 70 passed, 0 failed.
- Strict v3 cache recovery verification: 4,493 source rows reused, 0 regenerated, 0 blocked.
- Fresh preview verification: 3,963 PNGs decoded, with 0 hash, format, or dimension mismatches.
- Focused strict TypeScript for all PSD-audit source/tests: passed.
- Focused ESLint for all PSD-audit source/tests: passed.
- Empty-decision application smoke: 4,268 pending review units, 0 decisions, 0 approvals, 0 external writes.
- `git diff --check`: passed.
- `npx tsc -p tsconfig.app.json --noEmit --pretty false`: did not pass. It reported the current unrelated repository baseline of 1,289 diagnostics across 284 files. A path-filtered audit of the output found 0 diagnostics in the PSD cap-state audit source or tests; the former Task 6 negative-fixture diagnostic is resolved.

## Next review cohort and boundary

The next human-review cohort is **Cylinder**. Begin with the exact 3 ml black sprayer `GBSpry3mlClBlk..psd` (`GBSpry3mlClBlk` / `GB-SPR-CLR-3ML-BLK`, source SHA-256 `4010a54843424f947432363420d864fe520fe259c682e93950a214d660f02445`) and then the already-reviewed clear 9 ml set. This audit does not approve either source; it only places them in the review material.

No PSD export, upload, image generation, network call, Supabase operation, pipeline mutation, Convex operation, Shopify operation, or publication was performed. Any versioned native-resolution opaque PNG export begins only after explicit human review decisions and remains outside this audit.
