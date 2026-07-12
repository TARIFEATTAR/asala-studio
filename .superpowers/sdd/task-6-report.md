# Task 6 report — persist shadow evidence and block approval until pass

## Outcome

Implemented the V6.1 model-owned shadow evidence lane through persistence, approval readiness, SQL status, and Dark Room review UI. Existing RPC-backed approval remains the only approval action; the generation path records evidence and does not mutate an already-approved image.

## Changes

- Added `shadow_owner` (`rig`/`model`) and `shadow_qa` JSONB to reconciliation rows with comments.
- Recreated the approval RPC predicate so model-owned images require `status=pass` and `contact-back-right-v1`; rig-owned rows remain compatible with `shadow_qa IS NULL`.
- Recreated the reconciliation status view with `review-pending` before `unlinked` and shadow-aware `is_reconciled`.
- Added `buildBestBottlesRigReconciliationPayload`, shadow fields to raw/rig writes, and success/failure evidence propagation from `useAssembledPromptGeneration`.
- Added the `shadow` rig review requirement, owner/spread metrics, failure/warning rendering, and reconciliation tooltip evidence.
- Added the exact smoke-SKU approved comparison hook and identical-scale comparison panel, shown only for model-owned review results with an approved URL.
- Extended client and SQL tests for model review rejection, passing model approval, legacy rig compatibility, and durable payload evidence.

## Verification

- `npx tsx --test src/lib/bestBottlesImageReconciliation.test.ts src/lib/product-image/rigReview.test.ts src/lib/product-image/shadowQa.test.ts` — 17 passing.
- `npm run test:bestbottles:image-coverage` — 274 tests / 72 suites passing.
- `npm run build` — passed; existing CSS/chunk-size warnings only.
- Targeted ESLint — 0 errors; existing warnings remain in `MastersTabPanel.tsx`.
- `npx tsc -p tsconfig.app.json --noEmit` was invoked without reported diagnostics.

## Blocker / concern

The SQL integration run could not execute in this environment: `supabase db reset` could not connect because Docker Desktop is unavailable, and `psql` is not installed. No remote migration, provider call, paid image generation, Shopify/Convex synchronization, or deployment was attempted.

## Review fix pass — 2026-07-11

### Changes

- Reapplied the hardened reconciliation-status view privileges after the migration recreates the view: both `anon` and `authenticated` are revoked, then only authenticated `SELECT` is restored.
- Removed the `required: false` approval bypass. Rig approval readiness now always requires every machine requirement plus all three human confirmations; `required` remains available as display metadata only.
- Matched client shadow eligibility to the SQL approval predicate: model-owned evidence must have both `status = pass` and the exact `contact-back-right-v1` target contract.
- Added regressions for `required: false` with missing machine/human evidence and for a passing report carrying an invalid shadow contract.

### Verification

- `npx tsx --test src/lib/bestBottlesImageReconciliation.test.ts src/lib/product-image/rigReview.test.ts src/lib/product-image/shadowQa.test.ts` — 18 passing.
- `npm run test:bestbottles:image-coverage` — 274 tests passing.
- `npm run build` — passed; existing stale browser-data, CSS minification, and chunk-size warnings remain.
- `npx eslint src/lib/product-image/rigReview.ts src/lib/product-image/rigReview.test.ts` — passed with no diagnostics.
- File-scoped TypeScript check for `rigReview.ts` and `rigReview.test.ts` — passed with `strictNullChecks` disabled to isolate an unrelated existing nullability error imported from `rigPostprocess.ts`.
- Repository-wide `npx tsc -p tsconfig.app.json --noEmit` remains non-clean because of the existing project-wide TypeScript backlog; no diagnostics implicated the Task 6 fix files.
- SQL integration was not rerun: Docker is unavailable and `psql` is not installed. The existing SQL test already asserts the intended anonymous/authenticated view privilege contract.

No remote migration, deployment, provider call, paid generation, or external synchronization was attempted.

## Final review-blocker fix — 2026-07-11

### Changes

- Routed the Studio master-approval callback through `approveBestBottlesGeneratedMaster`; the page no longer imports the strict approval RPC or calls the Library tag mutator directly.
- Made the helper's production default a single link-then-approve sequence using `link_best_bottles_generated_image` followed by `approve_best_bottles_reconciled_image`. The existing group status write remains a post-approval rollup and cannot substitute for the strict SKU/image approval RPC.
- Added regressions that lock the Studio callback behind the helper, assert link-before-approve ordering, and verify the exact strict approval RPC name and identifiers.
- Added the previously uncommitted reconciliation dependencies required by the reviewed Task 6 code: `bestBottlesImageReconciliationRules.ts`, `bestBottlesMasterApproval.ts`, and the foundational `20260710090000_best_bottles_image_reconciliation.sql` migration.

### Verification

- RED confirmation: the focused reconciliation test failed on the direct Studio RPC import and on the missing injected RPC seam before the production fix.
- `npx tsx --test src/lib/bestBottlesImageReconciliation.test.ts src/lib/product-image/rigReview.test.ts src/lib/product-image/shadowQa.test.ts` — 20 tests passing.
- `npm run test:bestbottles:image-coverage` — 276 tests / 66 suites passing.
- `npm run build` — passed; existing stale browser-data, CSS minification, and chunk-size warnings remain.
- Focused ESLint for the Studio/reconciliation/rig/shadow files — 0 errors; one existing `BestBottlesStudio.tsx` hook dependency warning remains.
- Scoped TypeScript check for the reconciliation approval files — passed with `strictNullChecks` disabled to isolate the existing imported `rigPostprocess.ts` nullability error.
- Repository-wide `npx tsc -p tsconfig.app.json --noEmit` remains non-clean because of the existing project-wide TypeScript backlog; the focused lint, scoped check, tests, and production build cover the changed Task 6 path.

### Local SQL limitation

The foundational migration SQL test could not run: the Docker CLI is installed but its daemon socket is unavailable, and `psql` is not installed. No remote migration, deployment, provider call, paid generation, Shopify/Convex synchronization, or other external mutation was attempted.

## Final dependency follow-up — 2026-07-11

- Added the existing `20260711000200_best_bottles_reconciliation_privilege_hardening.sql` migration required by the reconciliation SQL assertions.
- Static verification confirms it revokes anonymous access to the reconciliation tables/view, restores only the intended authenticated table privileges, and revokes `PUBLIC`, `anon`, and `authenticated` execute access from all four internal trigger functions.
- Local SQL execution remains unavailable because the Docker daemon is not running and `psql` is absent. No remote migration or external mutation was attempted.

## Final predicate/type alignment — 2026-07-11

### Changes

- Aligned the reconciliation-status `CASE` with the model-shadow approval RPC and `is_reconciled`: model-owned evidence remains `review-pending` unless both `status = pass` and `target.contract = contact-back-right-v1`, including null/missing contract values.
- Added SQL regressions proving a passing shadow report with either an invalid or missing contract remains review-pending and is rejected by approval before the valid contract is restored.
- Added `eligibleGraceSkus` and `eligibleWebsiteSkus` to `BestBottlesCatalogTruthSnapshot`, matching the existing generation-hook payload and exact-SKU SQL eligibility fields.
- Added client source/type regressions for the shared SQL predicate and both eligibility arrays.

### Verification

- RED confirmation: the focused client test failed because the status `CASE` omitted the shadow contract, and the scoped TypeScript check rejected both missing snapshot keys.
- `npx tsx --test src/lib/bestBottlesImageReconciliation.test.ts src/lib/product-image/rigReview.test.ts src/lib/product-image/shadowQa.test.ts` — 22 tests passing.
- `npm run test:bestbottles:image-coverage` — 278 tests / 66 suites passing.
- `npm run build` — passed; existing stale browser-data, CSS minification, and chunk-size warnings remain.
- Targeted ESLint for the reconciliation/rig/shadow files — passed with no diagnostics.
- Scoped TypeScript check for the reconciliation approval files — passed with `strictNullChecks` disabled to isolate the existing imported `rigPostprocess.ts` nullability error.
- Static SQL contract check confirmed the null-safe status predicate and both invalid/missing-contract regression markers.

Local SQL execution remains unavailable because the Docker daemon is not running and `psql` is absent. No remote migration, deployment, provider call, paid generation, Shopify/Convex synchronization, or other external mutation was attempted.

## Terminal-link and nullable-status hardening — 2026-07-11

### Changes

- Made `link_best_bottles_generated_image` lock and inspect the SKU job before reading the candidate or mutating any assignment. It now raises for `approved`, `shopify-pushed`, or `synced` jobs and for any row that already has an approved image.
- Added a SQL regression that snapshots a synced job and an unlinked candidate reconciliation, attempts the terminal link, and verifies the job, approved image fields, assignment set, and reconciliation state remain unchanged.
- Added a helper regression proving a failed link prevents the strict approval operation from running, and corrected the helper contract comment to reflect fail-closed terminal behavior.
- Wrapped the complete model-shadow branch in the view's `is_reconciled` predicate with `COALESCE(..., FALSE)` so missing status or contract evidence returns exactly false instead of SQL null.
- Added an otherwise fully reconciled model-row regression with missing shadow evidence that requires `review-pending` and `is_reconciled IS FALSE`.

### Verification

- RED confirmation: focused source tests failed because the link RPC had no pre-mutation terminal guard and `is_reconciled` lacked a null-safe shadow wrapper.
- `npx tsx --test src/lib/bestBottlesImageReconciliation.test.ts src/lib/product-image/rigReview.test.ts src/lib/product-image/shadowQa.test.ts` — 25 tests passing.
- `npm run test:bestbottles:image-coverage` — 281 tests / 66 suites passing.
- `npm run build` — passed; existing stale browser-data, CSS minification, and chunk-size warnings remain.
- Targeted ESLint for the reconciliation approval/rig/shadow files — passed with no diagnostics.
- Static SQL verification confirmed the terminal guard runs before assignment insertion, covers all terminal statuses plus existing approved images, and the model-shadow view predicate is null-safe.

Local SQL execution remains unavailable because the Docker daemon is not running and `psql` is absent. No remote migration, deployment, provider call, paid generation, Shopify/Convex synchronization, or other external mutation was attempted.
