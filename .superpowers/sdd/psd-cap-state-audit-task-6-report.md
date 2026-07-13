# Task 6 — Human Review Decision Validation and Local Merge

## Status

Implemented and verified.

## Scope

- Added strict validation for the seven PSD cap-state taxonomy decisions plus `blocked`.
- Required a named human reviewer and valid ISO date-time for every completed decision.
- Normalized accepted offset timestamps to canonical UTC ISO provenance required by Task 1.
- Allowed approvals only for the five concrete visual states and only with exact website SKU, exact Grace SKU, or reviewed-alias identity status.
- Kept ambiguous/conflicting identities and the two unresolved taxonomy values non-exportable.
- Rejected duplicate decision rows, unknown review-unit keys, source-hash mismatches, machine reviewers, unsupported decisions, invalid dates, and approval of ambiguous/conflicting identities.
- Applied decisions only by full review-unit key with an exact source-hash check; no hash-only propagation exists.
- Added the local-only CLI and nine required manifest/worklist/summary artifacts.
- Added `bestbottles:references:apply-psd-review` without altering any other package script.

## TDD evidence

Initial focused test run failed with `ERR_MODULE_NOT_FOUND` for both Task 6 modules. After implementation, the focused suite passed 10/10 tests. A self-review regression for `2026-02-31T20:00:00Z` was then observed failing before calendar validation was added and passing afterward.

## Verification

- `npx tsx --test src/lib/bestBottlesPsdReviewDecisions.test.ts scripts/best-bottles/apply-psd-cap-state-review.test.ts` — 10 tests passed, 0 failed.
- `npx tsc --noEmit --pretty false` — exited 0.
- `npm run test:bestbottles:psd-audit` — 59 tests passed, 0 failed.
- `npm run bestbottles:references:apply-psd-review` — untouched template produced 2 pending units, 0 decisions, 0 approvals, 0 blocked reviews, and 0 external writes.
- Approval CSVs were header-only; `pending-human-review.csv` contained both review units.

## Self-review

No correctness or scope concerns remain. The CLI reads `review-decisions.csv` when present and intentionally falls back to the untouched Task 4 template for the required empty-decision smoke. All writes are confined to the selected local output directory; there are no export, upload, pipeline, network, or external-write paths.
