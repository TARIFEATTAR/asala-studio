# Native migration replay (no Docker)

Runs the ordered migration suite and the paper-doll pgTAP gate against a native
PostgreSQL 16 cluster, for environments where no Docker daemon is available —
Claude Code on the web, and CI runners without privileged containers.

```bash
bash supabase/tests/native-replay/run-native-replay.sh
```

Exit code is `0` only when every pgTAP assertion passes.

## When to use the real CLI instead

This harness is a **stand-in, not a replacement**. Where a Docker daemon exists,
prefer:

```bash
npx supabase start
npx supabase test db --local supabase/tests/paper_doll_family_release_v1.sql
npx supabase db lint --local
```

The CLI runs the genuine Supabase platform images. This harness runs stock
PostgreSQL 16 plus `00_supabase_bootstrap.sql`, a shim that reproduces only the
platform surface the migrations actually touch:

| Surface | Shim provides |
|---|---|
| `auth.uid()` / `auth.role()` / `auth.jwt()` | resolved from `request.jwt.claim.*`, same as the platform |
| `auth.users` | the columns migrations read, not the full GoTrue table |
| `storage.objects` / `storage.buckets` | table shape + RLS enabled |
| `storage.foldername` / `filename` / `extension` | path helpers |
| reserved roles | `anon`, `authenticated`, `service_role`, and the admin roles |
| `extensions` schema | `uuid-ossp`, `pgcrypto`, `vector`, `pgtap` |
| `pg_net` | inert stub — **never** performs network I/O during replay |

Because the shim is narrower than the platform, a pass here is necessary but not
sufficient for production. A green run means the migrations are internally
consistent and the ledger's RLS/immutability contract holds; it does not
exercise GoTrue, Realtime, or the storage API.

## Known replay failures

A from-scratch replay does not reach 185/185, and the gap is in the repository,
not the harness. These are tracked in
`docs/paper-doll-rig/evidence/CYL-9ML-MIGRATION-GATE-VERIFICATION.md`:

- `public.generation_attempts` is referenced by a foreign key but has no `CREATE
  TABLE` anywhere in the repo, which blocks the five candidate-job migrations.
- `20251219211156_dam_storage_buckets.sql` is unparseable — a `image/*` MIME
  wildcard inside a `/* … */` block opens a nested comment, and PostgreSQL
  nests block comments.
- `20250101000000_create_brand_scans.sql` sorts before the migration that
  creates `public.organizations`, which it depends on.

The six release-ledger tables the pgTAP gate covers are unaffected by all three.
