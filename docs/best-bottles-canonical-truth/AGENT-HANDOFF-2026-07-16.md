# Best Bottles Cylinder pipeline handoff — 2026-07-16

## Non-negotiable repository state

- Repository: `/Users/jordanrichter/Projects/Madison Studio/madison-app`
- Branch: `codex/best-bottles-product-hub-pipeline`
- Do not switch branches, reset, discard files, or overwrite unrelated work.
- The worktree is intentionally very dirty. Treat every pre-existing modification and untracked file as user work.
- Before changing any measurement or geometry behavior, read `BEST-BOTTLES-CANONICAL-TRUTH.md` in full.
- Consume only canonical `canon_*` measurement columns. Do not write to Convex. Do not substitute missing product identities.

## User-approved reference decisions

1. The exact local 3 mL cap-on reference is the identity source for the cap-on lane.
2. The exact local 3 mL cap-off sidecar reference is the identity source for the cap-off lane.
3. Do not regenerate or reconstruct the 3 mL bottle, sprayer, internal hardware, or sidecar to create a different identity reference.
4. Cap-on and cap-off are separate lanes. Each lane must use its own reference and lane-specific prompt/material guidance.
5. Generation may improve material rendering, but it must not change geometry, closure, component topology, or product identity.

Exact 3 mL black-sprayer reference evidence:

- Cap-on SHA-256: `30219a2e8a6034fb4b55bcbcbcd76d8ed0bd0c60f02cc5bd1071a5286759cb3a`
- Cap-off sidecar SHA-256: `cb57723673c9389aab618be65980117137b6b77c8146e9b998e7abd325719ef5`
- The six-role pilot also contains a deterministic Bone-conditioned derivative of the cap-off source with SHA-256 `eddfd5430bb29c0430b77524a43a2d8c1785a5e552584abde2785d9378839e22`. This is not an alternate identity source.

## Work completed in the last turn

### 1. Runtime crash repaired

The Studio crashed with:

`ReferenceError: BEST_BOTTLES_CYLINDER_ROLE_AWARE_READINESS_VERSION is not defined`

Root cause: `src/hooks/useBestBottlesCylinderProductionReadiness.ts` re-exported the constant without importing it into local module scope.

Fix: import the constant from `@/lib/bestBottlesCylinderRoleAuthority`.

Regression test: `src/hooks/useBestBottlesCylinderProductionReadiness.test.tsx`.

The Studio page now renders instead of showing the React error overlay.

### 2. Canonical 25 mL identity mapped

Best Bottles SKU `GBcyl25SpryShnBlk` is now mapped locally to Grace SKU `GB-CYL-CLR-25ML-SPR-SBLK` in:

- `best-bottles-master-truth.csv`
- `best-bottles-body-geometry.csv` conflict bookkeeping

The mapping is explicitly marked as a manual 2026-07-16 assignment because the legacy site SKU was absent from the original 2026-07-12 join. No dimensions were invented or changed.

Regression test: `src/lib/bestBottlesCanonicalIdentity.test.ts`.

The six-role pilot was rebuilt and now reports six production-ready products and zero identity-blocked products.

### 3. Verification already completed

Passing tests:

- `src/lib/bestBottlesCanonicalIdentity.test.ts`
- `src/lib/bestBottlesCylinderSixRolePilot.test.ts`
- `scripts/best-bottles/cylinder-six-role-material-pilot.test.ts`
- `scripts/best-bottles/run-cylinder-six-role-material-pilot.test.ts`
- `src/hooks/useBestBottlesCylinderProductionReadiness.test.tsx`
- `scripts/best-bottles/render-cylinder-body-scale-truth.test.ts`

`npm run build` also passed. Existing CSS/chunk-size warnings remain but are not the current blocker.

## Current blocker — exact root cause

The Studio loads, but Generate master remains disabled with:

`Cylinder generation is locked because the role-aware reference artifact could not be verified.`

This is not a missing 3 mL image. Both exact 3 mL references exist in the role artifact.

The role artifact is rejected as a whole because its producer and consumer disagree:

- `public/data/best-bottles-cylinder-sidecar-promotion.json` marks 56 raw `exact-live-pdp-sidecar` rows as `generation-authorized` even though their review status remains `pending`.
- `src/lib/bestBottlesCylinderRoleAuthority.ts` correctly rejects every generation-authorized raw live-PDP sidecar until it has reviewed immutable remediation.
- First observed rejection: `GBCYL100RDCRBLKLTHR|GBCYLCLR100MLRDCBKLT`.

Current route totals in the public artifact:

- `exact-psd-sidecar`: 145
- `exact-live-pdp-sidecar`: 56
- `live-topology-exception`: 27
- blocked/no route: 149

Because validation is artifact-wide, one invalid raw live-PDP row prevents valid 3 mL rows from being used.

## Required next task

Repair the role artifact contract without weakening the consumer gate:

1. Add an integration test that loads the actual public production-readiness bytes and actual public role artifact, builds the canonical roster, and asserts the role-aware index validates.
2. Confirm the test fails on the raw live-PDP authorization mismatch.
3. Preserve explicitly approved exact references, including both 3 mL lanes, as reviewed immutable evidence with matching `reviewedOutputSha256` and immutable export SHA.
4. Mark remaining unreviewed raw live-PDP sidecars blocked. Do not silently promote all 56 and do not loosen `bestBottlesCylinderRoleAuthority.ts`.
5. Reseal/rebuild the local public role artifact with accurate summary counts and zero external writes.
6. Verify the actual public artifact through `buildCylinderRoleAwareReadinessIndex`.
7. Reload `/best-bottles/studio/cylinder-3ml-clear-12mm-finemist` and confirm the exact lane reference auto-selects and Generate master is enabled.
8. Do not click paid generation or publish anything until the user explicitly approves that external action.

## Important implementation files

- `src/hooks/useBestBottlesCylinderProductionReadiness.ts`
- `src/hooks/useBestBottlesCylinderProductionReadiness.test.tsx`
- `src/lib/bestBottlesCylinderRoleAuthority.ts`
- `src/lib/bestBottlesCylinderRoleAuthority.test.ts`
- `src/lib/bestBottlesCylinderRoleAwareReadiness.ts`
- `scripts/best-bottles/build-cylinder-role-aware-readiness.ts`
- `scripts/best-bottles/promote-cylinder-reviewed-role-references.ts`
- `public/data/best-bottles-cylinder-production-readiness.json`
- `public/data/best-bottles-cylinder-sidecar-promotion.json`
- `scripts/best-bottles/build-cylinder-six-role-pilot.ts`

## Safety notes

- `promote-cylinder-reviewed-role-references.ts --execute` can upload to Supabase. Do not execute it without explicit authorization and valid reviewed inputs.
- A local artifact repair/reseal is allowed and preferred for validation; it must truthfully block unreviewed rows.
- Do not click Generate or push Shopify/Sanity assets as part of merely fixing readiness.
- Preserve the existing fail-closed publishing guard.
