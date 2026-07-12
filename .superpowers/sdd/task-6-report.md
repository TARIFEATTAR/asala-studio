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
