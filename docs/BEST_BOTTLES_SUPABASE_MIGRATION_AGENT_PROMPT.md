# Best Bottles Supabase Migration Execution Prompt

Work directly in this repository:

`/Users/jordanrichter/Projects/Madison Studio/madison-app`

Use the existing branch:

`codex/best-bottles-product-hub-pipeline`

The latest Best Bottles reconciliation migration is:

`supabase/migrations/20260710090000_best_bottles_image_reconciliation.sql`

The implementation handoff is:

`docs/BEST_BOTTLES_RECONCILIATION_HANDOFF.md`

Your job is to bring the Supabase database migration state fully up to date and safely apply the Best Bottles reconciliation schema. This is an execution task, not a planning-only task. Continue until the migration has been validated, the migration ledger has been reconciled, the intended production migration has been applied, and the resulting schema has been verified. Do not deploy the web application or Edge Functions in this task.

## Safety constraints

- Read `AGENTS.md`, `CLAUDE.md`, `.cursorrules`, and the handoff before changing or executing anything.
- Preserve the existing dirty working tree. Do not reset, discard, overwrite, commit, push, merge, or reformat unrelated work.
- Do not read or print secrets. Use the existing linked Supabase project and environment configuration without displaying credentials.
- Do not use `supabase db push --include-all` as a shortcut.
- Do not blindly replay historical migrations.
- Do not mark a historical migration applied merely because its filename exists. First prove that its intended schema objects already exist remotely.
- Do not perform destructive drops or data deletion. If an unavoidable destructive operation appears necessary, stop and report the exact blocker before executing it.
- Do not deploy the web client or Supabase Edge Functions. This task is database migrations and database verification only.
- Never report success based only on a dry run. Execute and verify the actual intended migration.

## Known migration-history issue

A zero-state replay currently fails because:

`20250101000000_create_brand_scans.sql`

references `public.organizations` before the later migration that creates that table. A previous `supabase db push --dry-run --include-all` also attempted to include roughly 20 old migrations. Treat this as a migration-ledger/baseline problem. Do not edit old migration files casually and do not push all historical migrations to production.

The reconciliation migration has previously applied successfully to an isolated local database loaded from a schema-only dump of the current remote schema. However, two small SQL changes were made afterward for explicit multi-SKU eligibility and linking additional eligible assignments. Therefore, validate the current file again from a fresh schema clone before applying it remotely.

## Required execution sequence

### 1. Establish the exact current state

Run and record:

```bash
pwd
git branch --show-current
git status --short
npx supabase migration list
npx supabase db push --dry-run
```

Confirm the linked project is the intended Madison Supabase project without printing credentials.

Inspect:

- the complete reconciliation migration;
- the current remote migration ledger;
- the local migration directory;
- the relevant current remote schema objects;
- any local/remote version mismatches.

### 2. Validate the latest migration in an isolated database

Do not interfere with any existing local Supabase project. A project named `convey` may already occupy ports `54321` through `54327`.

Use an isolated temporary Supabase project and alternate ports, such as:

- API: `55321`
- database: `55322`
- Studio: `55323`
- mail: `55324`
- analytics: `55327`
- shadow database: `55320`

Create a new schema-only dump of the linked remote database. Load that schema into the isolated local database, including required extensions such as `vector` and `uuid-ossp`, and apply only:

`20260710090000_best_bottles_image_reconciliation.sql`

The migration must execute with `ON_ERROR_STOP=1`.

Do not rely on the repository’s complete zero-state migration replay for this validation because the historical ordering is currently broken.

### 3. Add and run database lifecycle assertions

Create a repeatable SQL test that runs inside a transaction and rolls back its fixture data. It must prove all of the following:

1. Image evidence can be inserted for the correct organization.
2. A passing image can link to one exact SKU job.
3. One image can link to multiple SKU jobs only when each SKU appears in the immutable `eligibleGraceSkus` or `eligibleWebsiteSkus` catalog-truth snapshot.
4. An unlisted SKU is rejected.
5. Cross-organization image/job linkage is rejected.
6. Approval is rejected when product truth, dimensions, baseline, framing decision, or QA is missing.
7. Approval succeeds when every gate is satisfied.
8. Approving a replacement image supersedes the old approved assignment for that SKU job.
9. A Shopify write timestamp without read-back remains verification-pending.
10. A Convex write timestamp without read-back remains verification-pending.
11. A destination mismatch produces `destination-mismatch` and cannot be reconciled.
12. Every active approved assignment must have Shopify and Convex verification state `matched` before the image-level view reports `reconciled`.
13. Authenticated clients cannot forge service-role-only destination verification.
14. The status view correctly aggregates multiple assignments without hiding a failing assignment.

Run the test against the isolated current-schema clone. Fix the new migration if any assertion fails, reset the isolated clone, then rerun the migration and complete test from a clean baseline.

### 4. Reconcile the remote migration ledger safely

Compare local and remote migration versions. For every old local migration that the CLI wants to replay:

- inspect what it creates or alters;
- query the remote schema to prove whether those objects/columns/functions/policies already exist;
- determine whether the migration was historically applied but not recorded, superseded, or truly missing.

If a historical migration’s schema is already present remotely but its ledger entry is missing, use the Supabase migration-repair mechanism only for that specifically proven version. Record the exact evidence and repair command.

Never use `--include-all` to force alignment. Never apply old DDL merely to make the ledger look clean.

After ledger reconciliation, rerun:

```bash
npx supabase migration list
npx supabase db push --dry-run
```

The final dry run must list only the reviewed, intended reconciliation migration. If it lists any unexplained historical migration, stop and fix the ledger before continuing.

### 5. Apply the intended production migration

Before applying it:

- confirm a current Supabase backup or recovery point exists;
- save a schema-only pre-migration dump outside the repository;
- confirm the current migration file is the exact version that passed isolated validation;
- run `git diff --check` on the migration;
- calculate and record its SHA-256 checksum without printing secrets.

Then apply the reviewed migration using the normal Supabase migration command. Do not use `--include-all`.

### 6. Verify the production schema after application

Verify that these objects exist and have the expected columns, constraints, policies, privileges, and function signatures:

```text
public.best_bottles_image_reconciliations
public.best_bottles_pipeline_sku_images
public.best_bottles_image_reconciliation_status
public.link_best_bottles_generated_image
public.approve_best_bottles_reconciled_image
public.record_best_bottles_destination_verification
```

Specifically verify:

- reconciliation evidence is one row per generated image;
- SKU assignment state is one row per image/job pair;
- only one active approved image is allowed per SKU job;
- organization consistency triggers exist;
- linking and approval are available only to intended authenticated roles;
- destination verification is service-role-only;
- RLS is enabled on both tables;
- the aggregate status view cannot claim reconciliation while any assignment is pending or mismatched;
- no existing Best Bottles SKU jobs or generated images were deleted or unexpectedly modified by the schema migration.

Run:

```bash
npx supabase migration list
npx supabase db push --dry-run
```

The final dry run must report no pending migrations.

### 7. Final report

Return a concise execution report containing:

- linked Supabase project reference;
- pre-migration ledger state;
- every ledger repair performed and the evidence for it;
- isolated migration-test result;
- lifecycle assertion result;
- migration filename and SHA-256 checksum applied;
- actual production migration command and result;
- post-migration object verification;
- final migration-list and dry-run result;
- any remaining blockers for the later Edge Function and web deployment;
- confirmation that no web deployment, Edge Function deployment, production backfill, Shopify publication, Convex synchronization, image generation, commit, push, or merge occurred.

Do not stop after producing a plan. Continue through safe execution and post-application verification. If production application is blocked by permissions, missing backup capability, unexplained ledger history, or destructive DDL, stop at that exact point and report the blocker with the completed local evidence. Never fabricate successful output.