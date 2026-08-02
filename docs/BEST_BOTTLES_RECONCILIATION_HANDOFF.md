# Best Bottles Image Reconciliation — Hermes Handoff

**Repository:** `/Users/jordanrichter/Projects/Madison Studio/madison-app`  
**Current branch:** `codex/best-bottles-product-hub-pipeline`  
**Status date:** 2026-07-11

## Start here

Ask Hermes:

> Read `docs/BEST_BOTTLES_RECONCILIATION_HANDOFF.md`, inspect the current branch and dirty working tree, and continue the Best Bottles image reconciliation activation. Do not generate paid images, deploy, migrate, publish to Shopify, sync Convex, commit, push, merge, or modify production data without my explicit approval. First verify file provenance and reconcile the Supabase migration ledger.

## Implemented locally

- Per-image raw/final image provenance and lifecycle.
- Website/catalog identity snapshot and hash.
- Raw/pre-transform and final render geometry.
- Final baseline, target baseline, delta, fill height, center delta, transforms, and object bounds.
- Framing QA and identity/website-truth approval gates.
- Explicit PDP-primary, PDP-secondary, marketing, and scene roles.
- Image Library reconciliation badges and read-only audit CLI.
- Separate Shopify/Convex write receipts from destination read-back verification.
- Destination verification RPC; reconciliation now requires both destinations to read back as matched.

## Key files

- `supabase/migrations/20260710090000_best_bottles_image_reconciliation.sql`
- `src/lib/bestBottlesImageReconciliation.ts`
- `src/lib/bestBottlesImageReconciliationRules.ts`
- `src/lib/bestBottlesImageReconciliation.test.ts`
- `src/lib/bestBottlesWebsiteTruth.ts`
- `src/lib/bestBottlesWebsiteTruth.test.ts`
- `src/lib/product-image/rigPostprocess.ts`
- `src/hooks/useAssembledPromptGeneration.ts`
- `src/components/darkroom/MastersTabPanel.tsx`
- `src/components/bestbottles/BestBottlesReconciliationBadges.tsx`
- `src/pages/BestBottlesStudio.tsx`
- `src/pages/ImageLibrary.tsx`
- `scripts/audit-bestbottles-image-reconciliation.ts`
- `package.json`

## Last verified results

- Focused reconciliation/truth/rig tests: **35 passed**.
- Full Best Bottles suite: **251 passed; 0 failed**.
- `npx tsc --noEmit --pretty false`: passed.
- Focused ESLint: 0 errors; existing warnings remain.
- `npm run build`: passed; existing CSS and chunk-size warnings remain.
- `npm run bestbottles:images:audit-reconciliation -- --help`: passed.
- `npx supabase db push --dry-run --include-all`: passed as a plan only.
- Latest reconciliation migration applied to a fresh isolated clone of the
  current remote schema with `ON_ERROR_STOP=1`.
- Transaction-scoped database lifecycle/security assertions passed; fixtures
  rolled back to zero rows.
- Production migrations `20260710090000` and `20260711000200` applied.
- Final `npx supabase db push --dry-run`: `Remote database is up to date.`
- Read-only production reconciliation audit: 0 tracked / 0 exceptions before
  any historical backfill.

## Supabase activation completed

The former ledger blocker was resolved without `--include-all` and without
falsely marking old migrations applied. Twenty-one local-only historical SQL
files were moved unchanged to:

`supabase/migrations_archive/2026-07-10-orphaned-local-history/`

The archive README records which effects already existed remotely, which were
materially absent/conflicting, and which were data/storage-only and unproven.
No archived migration was executed or ledger-repaired.

The production schema now contains the two reconciliation tables, aggregate
status view, linking/approval RPCs, service-role-only destination verification,
RLS, and explicit least-privilege grants.

## Remaining activation order

1. Review the production backfill dry run; do not invent missing measurements.
2. Deploy the already-implemented Shopify and Convex verification callers.
3. Deploy the schema-dependent client code.
4. Perform a real browser walkthrough.
5. Verify one controlled existing-image lifecycle before any paid generation.
6. After provider credits return and Jordan explicitly approves spend, generate
   one canonical smoke image and verify its complete lifecycle.

## Read-only commands

```bash
cd "/Users/jordanrichter/Projects/Madison Studio/madison-app"

git branch --show-current
git status --short
npx supabase migration list
npx supabase db push --dry-run
npx supabase db push --dry-run --include-all
npm run bestbottles:images:audit-reconciliation -- --help
npm run test:bestbottles:image-coverage
npx tsc --noEmit --pretty false
```

The database migrations are now applied. Continue to use dry runs before future
schema changes.

## Product-truth evidence to preserve

| Grace SKU | Website SKU | Catalog measurements | Website-truth state |
|---|---|---|---|
| `GB-CYL-CLR-9ML-T-03` | `GBCyl9MtlRollMattCu` | 9 ml; body 70 ±1 mm; diameter 20 ±0.5 mm; 17-415 | Ready |
| `GB-CYL-CLR-9ML-SPR-SBLK` | `GBTallCyl9SpryBlkSh` | 9 ml; body 106 ±2 mm; diameter 18 ±0.5 mm; 13-415 | Truth conflict: website SKU says Tall Cylinder while Convex says Cylinder |

The truth-conflict SKU must remain blocked until its family/alias conflict is explicitly resolved.

## Explicitly not performed

- No web-client or Edge Function deployment.
- No production backfill.
- No paid generation after the provider billing limit.
- No Shopify publication.
- No Convex production synchronization.
- No commit, push, merge, or client communication.
