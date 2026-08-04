# CYL-9ML migration gate verification

Status: **pgTAP gate passed** — the hold recorded in `PRODUCTION-ASSET-PLANE.md`
is lifted for the release ledger.

Date: 2026-08-04

Environment: native PostgreSQL 16 cluster (no Docker daemon available), via
`supabase/tests/native-replay/run-native-replay.sh`.

Sanity publication: still disabled. Nothing in this run mutated production,
Sanity, or any remote Supabase project.

## Result

| Step | Outcome |
|---|---|
| Ordered migration replay | 172 of 185 applied |
| `paper_doll_family_release_v1.sql` (pgTAP) | **17 of 17 assertions passed, 0 failed, 0 errors** |
| `supabase db lint --schema public` | 4 findings, **0 in any `paper_doll` object** |

All six release-ledger tables exist with RLS enabled, and every immutability,
tenancy, and privilege assertion holds:

```
ok 1  - all six paper-doll release ledger tables exist
ok 2  - RLS is enabled on all six ledger tables
ok 3  - each table has one authenticated organization-member read policy
ok 4  - component versions carry a required immutable object-storage contract
ok 5  - paper-doll storage has explicit authenticated select and append policies
ok 6  - authenticated paper-doll storage has no overwrite or delete policy
ok 7  - component_key is unique within an organization
ok 8  - component version organization must match its component
ok 9  - ledger rejects absolute and signed asset URLs
ok 10 - release slot and variant membership is unique
ok 11 - release asset organization matches release and component version
ok 12 - approved component identity and approval state are immutable
ok 13 - QA evidence rejects update and delete
ok 14 - ready and published release identities are immutable
ok 15 - service role can write five bodies, three approved caps, one blocked cap, QA, and a draft release
ok 16 - read-only workbench API returns every exact release asset
ok 17 - authenticated receives no ledger write privileges
```

## Scope limit

The harness runs stock PostgreSQL plus a bootstrap shim, not the Supabase
platform images. A pass proves the migrations are internally consistent and the
ledger contract holds. It does not exercise GoTrue, Realtime, or the storage
API. Re-run `npx supabase test db --local` wherever a Docker daemon exists, and
re-run the pgTAP test against a non-production Supabase project before applying
these migrations to production — that step of the controlled rollout is
unchanged.

## Defects found by the replay

Three repository defects surfaced that a Docker-based run would have found
equally. None touch the six release-ledger tables, so none block the gate above
— but the first blocks half the paper-doll migration chain.

### 1. `public.generation_attempts` has no DDL — blocks 5 migrations

`20260802052230_paper_doll_candidate_jobs.sql:55` declares

```sql
generation_attempt_id UUID REFERENCES public.generation_attempts(id) ON DELETE RESTRICT,
```

and line 169 selects `FROM public.generation_attempts`. No `CREATE TABLE` for
that relation exists anywhere in the repository. The table is presumably live in
the hosted project, created out of band.

Cascade — these five never apply on a clean database:

- `20260802052230_paper_doll_candidate_jobs.sql`
- `20260802052407_paper_doll_candidate_job_fk_indexes.sql`
- `20260802055156_finalize_paper_doll_candidate_job.sql`
- `20260802063000_paper_doll_approval_and_worker_health.sql`
- `20260802065000_paper_doll_worker_job_fk_index.sql`

plus `20260802210000_expose_approved_candidate_children.sql`.

That is the candidate-job, worker-health, and approval surface — the intake loop
proven in Production Run 001. It cannot be rebuilt from the repository alone.
**Fix: add the missing `generation_attempts` migration, ordered before
`20260802052230`.**

### 2. Nested block comment makes a migration unparseable

`20251219211156_dam_storage_buckets.sql` opens a `/* … */` block at line 16 and
closes it at line 58. Inside it, lines 23 and 45 document MIME types as
`image/*` and `video/*`. PostgreSQL **nests** block comments, so each `/*`
inside the literal opens another level. Two open, one closes, and the file dies
at line 168 with `unterminated /* comment`. Reproduction:

```sql
/* a image/* b */ SELECT 'reached'::text;
-- ERROR: unterminated /* comment
```

Cascade: `storage.user_has_org_access()` is defined in this file and is
referenced by 18 policy definitions, so `20260213000001_press_storage_buckets.sql`
fails with `function storage.user_has_org_access(text) does not exist`.

**Fix: convert that block to `--` line comments, or write the wildcards as
`image/&ast;`.**

### 3. First migration sorts ahead of its own dependency

`20250101000000_create_brand_scans.sql` references `public.organizations`, which
is created by `20251006164614_…sql` — nine months later in sort order. On a
clean database the first migration in the suite fails immediately.

**Fix: renumber `create_brand_scans` after the organizations migration.**

## Lint findings outside paper-doll

`supabase db lint --schema public` reports four, none in a `paper_doll` object.
Two are cascades from defect 1's sibling (`brand_products` missing); two are
genuine latent bugs worth fixing independently:

- `public.get_team_member_profiles` — `column reference "user_id" is ambiguous`
  between the PL/pgSQL variable and `organization_members.user_id`.
- `public.accept_pending_invitations_for_user` — `column reference
  "organization_id" is ambiguous` in the `INSERT … ON CONFLICT`.

Both resolve by qualifying the column or renaming the variable.
