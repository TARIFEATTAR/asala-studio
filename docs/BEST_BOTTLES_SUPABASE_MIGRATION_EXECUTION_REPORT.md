# Best Bottles Supabase Migration Execution Report

**Execution completed:** 2026-07-11  
**Linked Supabase project:** `likkskifwsrvszxdvufw`  
**Repository:** `/Users/jordanrichter/Projects/Madison Studio/madison-app`  
**Branch:** `codex/best-bottles-product-hub-pipeline`

## Result

The Best Bottles image reconciliation schema and least-privilege hardening are
applied to the linked production Supabase project. The local and remote active
migration ledgers are aligned, and the final dry run reports:

`Remote database is up to date.`

## Pre-migration ledger state

The initial normal dry run was blocked because 21 local-only historical
migration files appeared before later versions already recorded remotely. The
CLI suggested `--include-all`; that option was not used.

An exact schema audit found three classes of orphaned migration:

1. Final schema effects already existed remotely, but no corresponding ledger
   entry existed.
2. Intended schema effects were materially absent or conflicted with current
   production.
3. Data/Storage-only effects could not be proven from a schema-only snapshot.

No historical migration was falsely marked applied and no historical SQL was
replayed.

With explicit repository-owner approval, all 21 files were preserved unchanged
outside the active migration directory at:

`supabase/migrations_archive/2026-07-10-orphaned-local-history/`

The archive README contains the file-by-file evidence. No migration-ledger
repair commands were performed.

## Backup and recovery evidence

Supabase reported completed physical backups in East US (Ohio), including:

- 2026-07-10 09:11:24 UTC
- daily completed backups for the preceding six days

A fresh schema-only pre-migration snapshot was saved outside the repository:

`/Users/jordanrichter/Backups/Supabase/madison-likkskifwsrvszxdvufw-pre-best-bottles-20260710.sql`

Snapshot SHA-256:

`9c84a30500a8a76e0b3f43a0dcb4ac38641a9abddb984e7f8fde3bf6f36375ae`

## Isolated validation

A fresh schema-only dump of the linked database was loaded into the isolated
Supabase project `madison-reconcile-supabase` on alternate ports. Required
extensions were installed, and the migration ran with `ON_ERROR_STOP=1`.

A transaction-scoped SQL lifecycle suite validated:

- image evidence ownership;
- exact one-SKU and explicit multi-SKU linkage;
- rejection of unlisted SKUs;
- cross-organization rejection;
- approval gates for truth, dimensions, baseline, framing, and QA;
- replacement-image superseding and one active approval per job;
- pending destination state after write receipts;
- Shopify and Convex match/mismatch behavior;
- aggregate mismatch visibility across assignments;
- full reconciliation only when every assignment is verified;
- service-role-only destination verification;
- anonymous/authenticated table, view, and internal-function privileges.

All lifecycle/security assertions passed. The fixture transaction rolled back,
and zero fixture rows remained.

The first test run identified a real default-function-privilege defect. The base
migration was corrected before production application. A post-application schema
dump then exposed broader project-level default table/internal-function grants;
a separately tested hardening migration narrowed those privileges.

## Applied migrations

### Reconciliation control plane

`20260710090000_best_bottles_image_reconciliation.sql`

SHA-256:

`9dd17de2610ed1c26c9c39057198aaed8d4b3ed5d96046c1c456c45cd4dd2f6b`

Applied using:

`npx supabase db push --yes`

Result: successful.

### Least-privilege hardening

`20260711000200_best_bottles_reconciliation_privilege_hardening.sql`

SHA-256:

`f0ba3e4de079052486d3741c67a6f6901dbc15c01640bef5daf5ba39589de292`

Applied using:

`npx supabase db push --yes`

Result: successful.

## Production verification

The post-hardening production schema dump verifies:

- `public.best_bottles_image_reconciliations` exists;
- `public.best_bottles_pipeline_sku_images` exists;
- `public.best_bottles_image_reconciliation_status` exists with
  `security_invoker=true`;
- linking, approval, and destination-verification functions exist as
  `SECURITY DEFINER` functions with a fixed `public` search path;
- RLS is enabled on both tables;
- all five organization-scoped policies exist;
- organization-consistency triggers exist;
- the SKU-job synchronization trigger exists;
- unique image/job assignment constraint exists;
- partial unique index enforces one `approved-keep` image per SKU job;
- `authenticated` can link and approve;
- only `service_role` can invoke destination verification;
- `anon` has no reconciliation table/view privileges;
- `authenticated` has only CRUD on evidence, SELECT on assignments, and SELECT
  on the aggregate view;
- internal trigger/helper functions are service-role-only.

Before/after remote table statistics were unchanged for the existing source
relations:

- `public.generated_images`: 4,283 estimated live tuples before and after;
- `public.best_bottles_pipeline_sku_jobs`: 2,479 estimated live tuples before
  and after.

Both new reconciliation tables contain zero live rows before historical
backfill. The read-only production reconciliation audit returned:

- Tracked: 0
- PDP pipeline: 0
- Library-only: 0
- Reconciled: 0
- Exceptions: 0

## Final ledger state

Both applied versions appear in the local and remote ledger:

- `20260710090000`
- `20260711000200`

Final command:

`npx supabase db push --dry-run`

Final result:

`Remote database is up to date.`

## Remaining non-database work

- Review the historical backfill in dry-run mode before any write.
- Deploy the schema-dependent Shopify and Convex Edge Function changes.
- Deploy the schema-dependent web client.
- Perform a browser walkthrough.
- Run one controlled existing-image lifecycle smoke test.
- Paid image generation remains blocked by provider billing and requires
  separate explicit authorization after credits return.

## Explicitly not performed

- No web-client deployment.
- No Edge Function deployment.
- No production reconciliation backfill.
- No Shopify publication.
- No Convex production synchronization.
- No image generation or paid provider call.
- No commit, push, merge, or history rewrite.
