# Best Bottles PSD cap-state archive audit

Audit date: 2026-07-12

Audit scope: read-only inventory, evidence rendering, canonical identity routing, and review-sheet generation for the complete local PSD archive.

## Result

The audit accounted for all **4,493** PSD source paths and found **3,963** unique source hashes. It produced **4,268** source-hash-plus-canonical-identity review units. The 4,493 source rows include 530 repeated-hash paths; identity-safe grouping consolidated 225 duplicate source paths into 225 two-source review units. Every review-unit key appears exactly once in the review sheets, and the review-unit source lists trace back to all 4,493 unique archive paths.

All **4,493** evidence renders succeeded and **0** failed. The run created or reused 3,963 unique evidence JSON files and 3,963 unique preview PNGs; at source-row level, 3,961 evidence inspections were generated and 532 were reused. No source metadata mutation or source-byte mutation was detected.

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

The 228 rendered sheets contain exactly 4,268 unique tiles.

| Queue | Review units |
|---|---:|
| Identity blockers | 165 |
| Evidence blockers | 0 |
| Unmatched | 1,597 |
| Ambiguous layout | 2,506 |
| Exact matched | 0 |
| **Total** | **4,268** |

Queue assignment is prioritization for human review, not an approval or a human-blocked decision. All 4,268 representative rows have low-confidence machine routing: 4,103 are proposed as `ambiguous-manual-review` and 165 as `blocked-identity-conflict` for routing purposes only.

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
| `source-inventory.json` | `b73eabbb90260869de472797d90f309c83b3b732293a9b35690303702b5b34ec` |
| `identity-join.json` | `4283dea6690cf3986b71fd81843fae5fe4542d52f9a163bbc78c3b224ed08502` |
| `review-units.json` | `9e290423353a9babb64b76618297db4ac2166780239d9b81f57366f64e32f708` |
| `summary.json` | `d7ead168b4d015a87ee327faf1ca4331fe19294124ab62a2c6123d5b0e4bea86` |
| `review-sheets/review-sheet-manifest.json` | `6bb11152bd8da6f21581b59e7c2b0d7c801df66619159697461e77af8b91a801` |
| `review-sheets/index.html` | `c0748f2d2b4966819924e66dc76ba53d15ca49463853d814879930d1486306fe` |

The review index contains 228 physical 2000 × 2400 PNG sheets matching the 228 manifest entries. The manifest has 4,268 tiles and 4,268 unique review-unit keys; its sorted key set exactly matches `review-units.json`. Flattening those review units yields 4,493 unique source paths, exactly matching `source-inventory.json`.

## Verification

- `npm run test:bestbottles:psd-audit`: 60 passed, 0 failed.
- `git diff --check`: passed.
- `npx tsc -p tsconfig.app.json --noEmit`: did not pass. It reported the pre-existing repository baseline of 1,290 diagnostics across 285 files; this is not a passing verification result. One diagnostic is in the clean, previously committed Task 6 test fixture at `src/lib/bestBottlesPsdReviewDecisions.test.ts:69`: TS2345 because a negative-test decision omits the now-required `sourceSha256`. Task 7 did not edit or stage that source; it is reserved for the focused Task 6 follow-up before final branch review. The other diagnostics belong to the existing unrelated project-wide TypeScript backlog.

## Next review cohort and boundary

The next human-review cohort is **Cylinder**. Begin with the exact 3 ml black sprayer `GBSpry3mlClBlk..psd` (`GBSpry3mlClBlk` / `GB-SPR-CLR-3ML-BLK`, source SHA-256 `4010a54843424f947432363420d864fe520fe259c682e93950a214d660f02445`) and then the already-reviewed clear 9 ml set. This audit does not approve either source; it only places them in the review material.

No PSD export, upload, image generation, network call, Supabase operation, pipeline mutation, Convex operation, Shopify operation, or publication was performed. Any versioned native-resolution opaque PNG export begins only after explicit human review decisions and remains outside this audit.
